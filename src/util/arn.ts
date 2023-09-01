import { Arn, ArnComponents, ArnFormat, Stack } from 'aws-cdk-lib';
import { ArnPrincipal, CompositePrincipal } from 'aws-cdk-lib/aws-iam';

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

/**
 *
 * Lookup a list of role ARNs from context
 *
 * @throws {Error} If any arn is invalid
 * @returns arns if they are valid, null otherwise
 */
export function tryGetContextArns(stack: Stack, context: string): string[] | null {
  const ctx = stack.node.tryGetContext(context);
  if (ctx == null) return null;
  if (!Array.isArray(ctx)) throw new Error('Failed to parse ARN, is not a string[]');
  for (const arn of ctx) validateRoleArn(arn);
  return ctx;
}

/** Create a arn principal for a single arn, or a composite principal when multiple arns are supplied */
export function getArnPrincipal(arns: string | string[]): ArnPrincipal | CompositePrincipal {
  if (typeof arns === 'string') arns = [arns];
  if (arns.length === 0) throw new Error('No arns supplied');
  if (arns.length === 1) return new ArnPrincipal(arns[0] ?? '');
  return new CompositePrincipal(...arns.map((arn) => new ArnPrincipal(arn)));
}
