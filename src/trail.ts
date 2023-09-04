import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { ManagedPolicy, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { getArnPrincipal, tryGetContextArns } from './util/arn.js';
import { Trail } from 'aws-cdk-lib/aws-cloudtrail';

/**

 */
export class OdrCloudTrail extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const cloudTrailBucket = tryGetContextArns(this, 'cloud-trail-bucket');
    if (cloudTrailBucket == null) {
      console.error('No Cloudtrail bucket specified skipping');
      return;
    }

    new Trail(this, 'CentralizedTrail', {});
  }
}
