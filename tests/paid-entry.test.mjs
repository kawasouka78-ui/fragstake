import assert from 'node:assert/strict';
import test from 'node:test';
import { assertEntryEnabled } from '../lib/live/entry-policy.ts';
import { requestLiveMatch } from '../lib/live/launch.ts';
import { Simulation } from '../lib/fps/simulation.ts';
import { settlement } from '../lib/account-rules.ts';

test('paid modes cannot issue free tickets, even for a selected room', async () => {
  for (const mode of ['ffa', '1v1', '2v2']) {
    assert.throws(() => assertEntryEnabled(mode), /deposits and payouts/);
    let requests = 0;
    await assert.rejects(requestLiveMatch(mode, 'citadel', async () => {
      requests++;
      return Response.json({ ticket: 'unfunded', url: 'wss://example.com', guest: false });
    }, 'room-1'), /deposits and payouts/);
    assert.equal(requests, 0);
  }
  assert.doesNotThrow(() => assertEntryEnabled('practice'));
});

test('leaving open practice with a zero score target produces a non-cash result', () => {
  const game = new Simulation({ mode: 'practice', team: '1v1', rate: 0, stake: 0, balance: 0, target: 0 }, () => .5);
  game.start();
  game.player.kills = 3;
  game.player.deaths = 1;
  game.leave();
  assert.ok(game.ended);
  assert.equal(game.result.net, 0);
  assert.equal(game.result.returned, 0);
  assert.equal(game.result.reason, 'Left the arena');
  assert.throws(() => settlement({mode:'duel', rate:0, target:10}, {
    kills:10, deaths:10, score:10, enemyScore:10, ending:'complete',
  }, 0), /Both teams cannot win/);
});
