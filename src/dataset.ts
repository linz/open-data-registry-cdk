import { applyTags, SecurityClassification } from '@linzjs/cdk-tags';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AccountPrincipal, AnyPrincipal, Effect, PolicyStatement, Role, StarPrincipal } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketAccessControl, HttpMethods, StorageClass } from 'aws-cdk-lib/aws-s3';
import { SnsDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { getArnPrincipal, tryGetContextArns } from './util/arn.js';
import { titleCase } from './util/names.js';

export class OdrDatasets extends Stack {
  datasets: {
    /** Dataset name @example "nz-imagery" */
    name: string;
    /** Dataset storage bucket @example "s3://nz-imagery" */
    bucket: Bucket;
    /** SNS topic for object created events @example "nz-imagery-object_created" */
    topic: Topic;
  }[];
  /** Bucket where S3 access logs are stored */
  logBucket: Bucket;

  constructor(scope: Construct, id: string, props: StackProps & { datasets: string[]; logBucketName: string }) {
    super(scope, id, props);

    // Allow testing with `--context dataset-suffix="-non-prod"`
    const suffix = scope.node.tryGetContext('dataset-suffix') ?? '';

    this.logBucket = new Bucket(this, 'Logs', {
      bucketName: props.logBucketName + suffix,
      // Only logs can be written to this bucket
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      // to prevent the log bucket getting too large, delete logs after 30 days
      lifecycleRules: [{ expiration: Duration.days(30) }],
    });

    this.datasets = props.datasets.map((ds) => {
      const datasetName = ds + suffix;
      if (datasetName.includes('.')) throw new Error(`Dataset name must not contain ".": ${datasetName}`);
      const datasetTitle = titleCase(datasetName);

      const topic = new Topic(this, 'ObjectCreated' + datasetTitle, {
        topicName: `${datasetName}-object_created`,
      });

      // Allow any AWS Lambda or AWS SQS to listen to `object_created` events
      topic.addToResourcePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['sns:Subscribe', 'sns:Receive'],
          principals: [new AnyPrincipal()],
          resources: [topic.topicArn],
          conditions: {
            StringEquals: {
              'SNS:Protocol': ['sqs', 'lambda'],
            },
          },
        }),
      );
      // 🚨 This bucket is public! 🚨
      const bucket = new Bucket(this, 'Data' + datasetTitle, {
        bucketName: datasetName,
        // Keep older versions and move them into Deep Archive after 30 days in case of accidental delete.
        versioned: true,

        // Write the access logs into this.logBucket
        serverAccessLogsBucket: this.logBucket,
        serverAccessLogsPrefix: `s3_${datasetName}/`,

        // If the stack gets deleted don't delete the data!
        removalPolicy: RemovalPolicy.RETAIN,

        lifecycleRules: [
          {
            // Ensure files are in intelligent tiering access
            transitions: [{ storageClass: StorageClass.INTELLIGENT_TIERING, transitionAfter: Duration.days(0) }],
            // Retain noncurrent versions in Standard for 30 days, then move to Deep Archive
            noncurrentVersionTransitions: [
              {
                storageClass: StorageClass.DEEP_ARCHIVE,
                transitionAfter: Duration.days(30),
                noncurrentVersionsToRetain: 100,
              },
            ],
            expiredObjectDeleteMarker: true,
            // Ensure incomplete uploads are deleted
            abortIncompleteMultipartUploadAfter: Duration.days(3),
          },
        ],

        // 🚨 This allows bucket to be public! 🚨
        // Slightly weird way of making public bucket due to https://github.com/aws/aws-cdk/issues/25358
        blockPublicAccess: new BlockPublicAccess({
          blockPublicAcls: false,
          blockPublicPolicy: false,
          ignorePublicAcls: false,
          restrictPublicBuckets: false,
        }),

        // Standard CORS setup from https://s3-us-west-2.amazonaws.com/opendata.aws/pds-bucket-cf.yml
        cors: [
          {
            maxAge: 3000,
            allowedHeaders: ['*'],
            allowedMethods: [HttpMethods.GET, HttpMethods.HEAD],
            allowedOrigins: ['*'],
            exposedHeaders: ['ETag', 'x-amz-meta-custom-header'],
          },
        ],
      });

      // add LINZ common AWS tags to bucket
      applyTags(bucket, {
        application: 'odr',
        environment: 'prod',
        group: 'li',
        classification: SecurityClassification.Unclassified,
        data: { isMaster: true, isPublic: true, role: 'archive' },
        impact: 'moderate',
      });

      // 🚨 This makes the bucket public! 🚨
      bucket.addToResourcePolicy(
        new PolicyStatement({
          actions: ['s3:List*', 's3:Get*'],
          effect: Effect.ALLOW,
          principals: [new StarPrincipal()],
          resources: [bucket.bucketArn, bucket.arnForObjects('*')],
        }),
      );

      // Put `object_created` events into the sns topic
      bucket.addObjectCreatedNotification(new SnsDestination(topic));

      new CfnOutput(this, 'Bucket' + datasetTitle, { value: bucket.bucketName });

      return { name: datasetName, bucket, topic };
    });

    this.setupLogReader();
    this.setupDataManager();
  }

  /** Create a role that can read log records */
  setupLogReader(): void {
    const logReaderArns = tryGetContextArns(this, 'log-reader-role-arns');
    if (logReaderArns == null) {
      console.error('Unable to create logging role as "log-reader-role-arns" is not set.');
      return;
    }

    const loggingReadRole = new Role(this, 'LogReader', {
      assumedBy: getArnPrincipal(logReaderArns).withSessionTags(),
    });
    this.logBucket.grantRead(loggingReadRole);

    new CfnOutput(this, 'LogReaderArn', { value: loggingReadRole.roleArn });
  }

  /** Create a role that can publish new data into the open data bucket */
  setupDataManager(): void {
    const dataManagerArns = tryGetContextArns(this, 'data-manager-role-arns');
    if (dataManagerArns == null) {
      console.error('Unable to create data manager role as "data-manager-role-arns" is not set.');
      return;
    }

    const dataManagerRole = new Role(this, 'DataManager', {
      assumedBy: getArnPrincipal(dataManagerArns).withSessionTags(),
    });

    const kxRole = this.SetupKxReadRole();

    for (const dataset of this.datasets) {
      dataset.bucket.grantReadWrite(dataManagerRole);
      dataset.bucket.grantPutAcl(dataManagerRole); // https://github.com/aws/aws-cdk/issues/25358
      dataset.bucket.grantRead(kxRole);
    }
    this.logBucket.grantRead(dataManagerRole);

    new CfnOutput(this, 'DataManagerArn', { value: dataManagerRole.roleArn });
  }

  /**Create Kx read role so that Data can be loaded from the ODR bucket to the LINZ data Service */
  SetupKxReadRole(): Role {
    const kxRole = new Role(this, 'Kx', {
      roleName: 'koordinates-s3-access-read',
      assumedBy: new AccountPrincipal('276514628126'),
    });
    new CfnOutput(this, 'KxRoleReadArn', { value: kxRole.roleArn });
    return kxRole;
  }
}
