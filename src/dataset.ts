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

export class OdrDataset extends Stack {
  /** Name of the dataset @example "nz-imagery" */
  datasetName: string;
  /** Bucket where the data is stored  generally the same as `datasetName` */
  bucket: Bucket;
  /** Bucket where S3 access logs are stored */
  logBucket: Bucket;
  /** SNS topic for s3 `object_created` events */
  topic: Topic;

  constructor(scope: Construct, id: string, props: StackProps & { datasetName: string }) {
    super(scope, id, props);

    this.datasetName = props.datasetName;
    if (this.datasetName.includes('.')) throw new Error(`Dataset name must not contain ".": ${this.datasetName}`);

    this.logBucket = new Bucket(this, 'Logs', {
      bucketName: `${this.datasetName}-logs`,
      // Only logs can be written to this bucket
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      // to prevent the log bucket getting too large, delete logs after 30 days
      lifecycleRules: [{ expiration: Duration.days(30) }],
    });

    this.topic = new Topic(this, 'ObjectCreated', {
      topicName: `${this.datasetName}-object_created`,
    });

    // Allow any AWS Lambda or AWS SQS to listen to `object_created` events
    this.topic.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sns:Subscribe', 'sns:Receive'],
        principals: [new AnyPrincipal()],
        conditions: {
          StringEquals: {
            'SNS:Protocol': ['sqs', 'lambda'],
          },
        },
      }),
    );

    this.bucket = new Bucket(this, 'Data', {
      bucketName: this.datasetName,
      // Keep older versions but expire them after 30 days incase of accidental delete.
      versioned: true,

      // Write the access logs into this.logBucket
      serverAccessLogsBucket: this.logBucket,
      serverAccessLogsPrefix: `s3_${this.datasetName}/`,

      // If the stack gets deleted don't delete the data!
      removalPolicy: RemovalPolicy.RETAIN,

      lifecycleRules: [
        {
          // Ensure files are in infrequent access
          transitions: [{ storageClass: StorageClass.INFREQUENT_ACCESS, transitionAfter: Duration.days(0) }],
          // Delete any old versions of files
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
    this.bucket.addEventNotification(EventType.OBJECT_CREATED, new SnsDestination(this.topic));

    new CfnOutput(this, 'Bucket', { value: this.bucket.bucketName });
    new CfnOutput(this, 'BucketLog', { value: this.logBucket.bucketName });

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
    const loggingReadRole = new Role(this, 'LogReader', {
      assumedBy: new ArnPrincipal(logReaderBastionArn),
      roleName: `s3-${this.datasetName}-log-read`,
    });
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

    const dataManagerRole = new Role(this, 'DataManager', {
      assumedBy: new ArnPrincipal(dataManagerBastionArn),
      roleName: `s3-${this.datasetName}-data-manager`,
    });
    this.bucket.grantReadWrite(dataManagerRole);
    this.logBucket.grantRead(dataManagerRole);

    new CfnOutput(this, 'DataManagerArn', { value: dataManagerRole.roleArn });
  }
}
