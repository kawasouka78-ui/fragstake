import test from 'node:test';
import assert from 'node:assert/strict';
import { needsOnboarding, safeReturnTo } from '../lib/onboarding.ts';

test('only untouched generated profiles require onboarding', () => {
  assert.equal(needsOnboarding(null), true);
  assert.equal(needsOnboarding({ handle: 'player_0123abcdef', name: 'Player 0123' }), true);
  assert.equal(needsOnboarding({ handle: 'player_0123abcdef', name: 'Ace Nova' }), false);
  assert.equal(needsOnboarding({ handle: 'acenova', name: 'Player 0123' }), false);
});

test('post-login return paths stay on FragStake', () => {
  assert.equal(safeReturnTo('/wallet?tab=history'), '/wallet?tab=history');
  assert.equal(safeReturnTo('https://evil.example'), '/play');
  assert.equal(safeReturnTo('//evil.example'), '/play');
  assert.equal(safeReturnTo('/signin'), '/play');
});
