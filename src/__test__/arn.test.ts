import assert from 'node:assert';
import { describe, it } from 'node:test';

import { validateRoleArn } from '../util/arn.ts';

void describe('roleArnValidator', () => {
  void it('should error if arn is not a valid role', () => {
    assert.throws(() => validateRoleArn(''));
    assert.throws(() => validateRoleArn('ABC'));
    assert.throws(() => validateRoleArn(1));
    assert.throws(() => validateRoleArn(null));
  });

  void it('should allow role arns', () => {
    const arn = validateRoleArn('arn:aws:iam::1234567890:role/AccountAdminRole');
    assert.equal(arn.service, 'iam');
    assert.equal(arn.resource, 'role');
    assert.equal(arn.partition, 'aws');
  });

  void it('should not allow *', () => {
    assert.throws(() => validateRoleArn('arn:aws:iam::1234567890:role/*'));
  });
});
