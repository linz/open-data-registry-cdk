import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { ManagedPolicy, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { getArnPrincipal, tryGetContextArns } from './util/arn.js';

/**
 * Stack to grant access to a remote roles to have access to either
 * "ReadOnlyAccess" or "AdministratorAccess" in the ODR account
 */
export class OdrConsole extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    /** Give a specific role in another account the ability to login as an readonly admin to view things like billing and metrics */
    const bastionReadOnlyArns = tryGetContextArns(this, 'console-read-only-role-arns');
    if (bastionReadOnlyArns != null) {
      const consoleReadOnly = new Role(this, 'ConsoleReadOnly', { assumedBy: getArnPrincipal(bastionReadOnlyArns) });

      consoleReadOnly.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));
      new CfnOutput(this, 'ConsoleReadOnlyArn', { value: consoleReadOnly.roleArn });
      new CfnOutput(this, 'ConsoleReadOnlySourceArns', { value: bastionReadOnlyArns.join(', ') });
    }

    /** Give a specific role in another account the ability to login as an account admin */
    const bastionAdminArns = tryGetContextArns(this, 'console-admin-role-arns');
    if (bastionAdminArns != null) {
      const consoleAdmin = new Role(this, 'ConsoleAdmin', { assumedBy: getArnPrincipal(bastionAdminArns) });

      consoleAdmin.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
      new CfnOutput(this, 'ConsoleAdminArn', { value: consoleAdmin.roleArn });
      new CfnOutput(this, 'ConsoleAdminSourceArns', { value: bastionAdminArns.join(', ') });
    }
  }
}
