import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FFA_ROTATION_MS,
  currentFfaMapId,
  nextFfaRotationAt,
  ffaRotationRemainingSeconds,
} from '../lib/live/rotation.ts';

test('FFA map rotation advances every ten minutes', () => {
  assert.equal(FFA_ROTATION_MS, 10 * 60 * 1000);
  assert.equal(currentFfaMapId(0), 'citadel');
  assert.equal(currentFfaMapId(FFA_ROTATION_MS - 1), 'citadel');
  assert.equal(currentFfaMapId(FFA_ROTATION_MS), 'depot');
  assert.equal(currentFfaMapId(2 * FFA_ROTATION_MS), 'underpass');
  assert.equal(currentFfaMapId(3 * FFA_ROTATION_MS), 'citadel');
});

test('FFA rotation exposes the next change time and remaining seconds', () => {
  const now = FFA_ROTATION_MS + 1234;
  assert.equal(nextFfaRotationAt(now), 2 * FFA_ROTATION_MS);
  assert.equal(ffaRotationRemainingSeconds(2 * FFA_ROTATION_MS - 1), 1);
});
