import assert from 'node:assert';
import { describe, it } from 'node:test';

import { titleCase } from '../util/names.ts';

void describe('titleCase', () => {
  void it('should title case from dash case', () => {
    assert.equal(titleCase('linz-imagery-bucket'), 'LinzImageryBucket');
    assert.equal(titleCase('linz_elevation_Bucket'), 'LinzElevationBucket');
    assert.equal(titleCase('linz imagery bucket'), 'LinzImageryBucket');
  });

  void it('should support a mixture of - _ and " "', () => {
    assert.equal(titleCase('linz_imagery bucket-two'), 'LinzImageryBucketTwo');
    assert.equal(titleCase('linz_elevation bucket-two'), 'LinzElevationBucketTwo');
  });
});
