import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { ArnPrincipal, ManagedPolicy, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { tryGetContextArn } from './util/arn.js';

/**
 * Stack to grant access to a remote roles to have access to either
 * "ReadOnlyAccess" or "AdministratorAccess" in the ODR account
 */
export class OdrConsole extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    /** Give a specific role in another account the ability to login as an readonly admin to view things like billing and metrics */
    const bastionReadOnlyArn = tryGetContextArn(this, 'console-read-only-role-arn');
    if (bastionReadOnlyArn != null) {
      const consoleReadOnly = new Role(this, 'ConsoleReadOnly', { assumedBy: new ArnPrincipal(bastionReadOnlyArn) });

      consoleReadOnly.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));
      new CfnOutput(this, 'ConsoleReadOnlyArn', { value: consoleReadOnly.roleArn });
      new CfnOutput(this, 'ConsoleReadOnlySourceArn', { value: bastionReadOnlyArn });
    }

    /** Give a specific role in another account the ability to login as an account admin */
    const bastionAdminArn = tryGetContextArn(this, 'console-admin-role-arn');
    if (bastionAdminArn != null) {
      const consoleAdmin = new Role(this, 'ConsoleAdmin', { assumedBy: new ArnPrincipal(bastionAdminArn) });

      consoleAdmin.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
      new CfnOutput(this, 'ConsoleAdminArn', { value: consoleAdmin.roleArn });
      new CfnOutput(this, 'ConsoleAdminSourceArn', { value: bastionAdminArn });
    }
  }
}
