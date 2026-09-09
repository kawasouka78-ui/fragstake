import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestLiveMatch } from '../lib/live/launch.ts';

for (const mode of ['ffa', '1v1', '2v2']) {
  test(`main selector joins ${mode} on the selected map without a wallet transaction`, async () => {
    const calls = [];
    const config = await requestLiveMatch(
      mode,
      'depot',
      async (url, options) => {
        calls.push({ url, options });
        return Response.json({
          ticket: 'test-ticket',
          url: 'ws://localhost:3010/play',
          guest: true,
        });
      },
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/live');
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      mode,
      mapId: 'depot',
    });
    assert.ok(calls[0].options.signal instanceof AbortSignal);
    assert.equal(config.mapId, 'depot');
    assert.equal(config.live.mode, mode);
    assert.equal(config.live.guest, true);
    assert.equal(config.team, mode === '2v2' ? '2v2' : '1v1');
    assert.equal(config.balance, 0);
    assert.equal(config.rate, 0);
    assert.equal(config.stake, undefined);
    assert.equal(config.entry, undefined);
  });
}

test('match entry surfaces server rejection and rejects unusable connections', async () => {
  await assert.rejects(
    requestLiveMatch('ffa', 'citadel', async () =>
      Response.json({ error: 'Server is full.' }, { status: 503 }),
    ),
    /Server is full/,
  );
  await assert.rejects(
    requestLiveMatch(
      'ffa',
      'citadel',
      async () => new Response('offline', { status: 502 }),
    ),
    /did not respond correctly/,
  );
  for (const value of [
    null,
    {},
    { ticket: '', url: 'ws://localhost/play', guest: true },
    { ticket: 'x', url: 'https://localhost/play', guest: true },
    { ticket: 'x', url: 'ws://localhost/play' },
  ]) {
    await assert.rejects(
      requestLiveMatch('ffa', 'citadel', async () => Response.json(value)),
      /connection is unavailable/,
    );
  }
});
