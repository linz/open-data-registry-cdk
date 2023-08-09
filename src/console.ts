import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { ArnPrincipal, ManagedPolicy, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class OdrConsole extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    /** Give a specific role in another account the ability to login as an readonly admin to view things like billing and metrics */
    const bastionReadOnlyRoleArn = this.node.tryGetContext('console-read-only-role-arn');
    if (bastionReadOnlyRoleArn != null) {
      const consoleReadOnly = new Role(this, 'ConsoleReadOnly', {
        assumedBy: new ArnPrincipal(bastionReadOnlyRoleArn),
        roleName: 'console-read-only',
      });

      consoleReadOnly.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));
      new CfnOutput(this, 'ConsoleReadOnlyArn', { value: consoleReadOnly.roleArn });
    }

    /** Give a specific role in another account the ability to login as an account admin */
    const bastionAdminRoleArn = this.node.tryGetContext('console-admin-role-arn');
    if (bastionAdminRoleArn != null) {
      const consoleAdmin = new Role(this, 'ConsoleAdmin', {
        assumedBy: new ArnPrincipal(bastionAdminRoleArn),
        roleName: 'console-admin',
      });

      consoleAdmin.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
      new CfnOutput(this, 'ConsoleAdminArn', { value: consoleAdmin.roleArn });
    }
  }
}
