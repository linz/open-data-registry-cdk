import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AnyPrincipal, ArnPrincipal, Effect, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  EventType,
  HttpMethods,
  StorageClass,
} from 'aws-cdk-lib/aws-s3';
import { SnsDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { titleCase } from './names.js';

export class OdrDatasets extends Stack {
  /** Bucket where the data is stored  generally the same as `datasetName` */
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

      const bucket = new Bucket(this, 'Data' + datasetTitle, {
        bucketName: datasetName,
        // Keep older versions but expire them after 30 days incase of accidental delete.
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
            // Delete any old versions of files after 30 days
            noncurrentVersionExpiration: Duration.days(30),
            expiredObjectDeleteMarker: true,
            // Ensure incomplete uploads are deleted
            abortIncompleteMultipartUploadAfter: Duration.days(7),
          },
        ],

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

      // Put `object_created` events into the sns topic
      bucket.addEventNotification(EventType.OBJECT_CREATED, new SnsDestination(topic));

      new CfnOutput(this, 'Bucket' + datasetTitle, { value: bucket.bucketName });

      return { name: datasetName, bucket, topic };
    });

    this.setupLogReader();
    this.setupDataManager();
  }

  /** Create a role that can read log records */
  setupLogReader(): void {
    const logReaderBastionArn = this.node.tryGetContext('log-reader-role-arn');
    if (logReaderBastionArn == null) {
      console.error('Unable to create logging role as "log-reader-role-arn" is not set.');
      return;
    }
    const loggingReadRole = new Role(this, 'LogReader', { assumedBy: new ArnPrincipal(logReaderBastionArn) });
    this.logBucket.grantRead(loggingReadRole);

    new CfnOutput(this, 'LogReaderArn', { value: loggingReadRole.roleArn });
  }

  /** Create a role that can publish new data into the open data bucket */
  setupDataManager(): void {
    const dataManagerBastionArn = this.node.tryGetContext('data-manager-role-arn');
    if (dataManagerBastionArn == null) {
      console.error('Unable to create data manager role as "data-manager-role-arn" is not set.');
      return;
    }

    const dataManagerRole = new Role(this, 'DataManager', { assumedBy: new ArnPrincipal(dataManagerBastionArn) });

    for (const dataset of this.datasets) dataset.bucket.grantReadWrite(dataManagerRole);
    this.logBucket.grantRead(dataManagerRole);

    new CfnOutput(this, 'DataManagerArn', { value: dataManagerRole.roleArn });
  }
}
