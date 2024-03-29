import { describe, it } from 'node:test';
import assert from 'node:assert';
import { titleCase } from '../util/names.js';

describe('titleCase', () => {
  it('should title case from dash case', () => {
    assert.equal(titleCase('linz-imagery-bucket'), 'LinzImageryBucket');
    assert.equal(titleCase('linz_elevation_Bucket'), 'LinzElevationBucket');
    assert.equal(titleCase('linz imagery bucket'), 'LinzImageryBucket');
  });

  it('should support a mixture of - _ and " "', () => {
    assert.equal(titleCase('linz_imagery bucket-two'), 'LinzImageryBucketTwo');
    assert.equal(titleCase('linz_elevation bucket-two'), 'LinzElevationBucketTwo');
  });
});
