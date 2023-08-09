import { Arn, ArnComponents, ArnFormat, Stack } from 'aws-cdk-lib';

/**
 * Validate that a object is a AWS IAM role arn
 *
 * @param arn arn to validate
 * @returns ARN if valid
 * @throws {Error} If ARN is not for a AWS IAM Role
 */
export function validateRoleArn(arn: unknown): ArnComponents {
  if (typeof arn !== 'string') throw new Error('Failed to parse ARN, is not a string');
  if (arn.includes('*')) throw new Error(`ARN cannot include "*" ${arn}`);
  try {
    const components = Arn.split(arn, ArnFormat.SLASH_RESOURCE_NAME);
    if (components.service !== 'iam') throw new Error('ARN is not a iam service');
    if (components.resource !== 'role') throw new Error('ARN is not a role');
    return components;
  } catch (e) {
    throw new Error(`Failed to parse ARN: "${arn}"`, { cause: e });
  }
}

/**
 * Lookup a role ARN from context
 *
 * @returns arn if its valid, null otherwise
 * @throws {Error} If arn is invalid
 */
export function tryGetContextArn(stack: Stack, context: string): string | null {
  const ctx = stack.node.tryGetContext(context);
  if (ctx == null) return null;
  validateRoleArn(ctx);
  return ctx;
}
