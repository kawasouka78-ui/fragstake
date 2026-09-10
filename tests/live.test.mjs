import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  issueTicket,
  readTicket,
  signature,
  verifySignature,
} from '../lib/live/security.ts';
import { parseInput, LIVE_TICK } from '../lib/live/protocol.ts';
import { LiveRoom } from '../lib/live/world.ts';
import { idleInput, direction } from '../lib/fps/simulation.ts';
import { paymentEligibility, validateJournal } from '../lib/payments.ts';
const secret = 'test-only-secret-with-at-least-32-characters';
const claims = (id, mode = 'ffa') => ({
  sub: id,
  name: id,
  guest: true,
  mode,
  mapId: 'citadel',
  aud: 'skillclash-game',
  nonce: id,
  exp: Date.now() + 60000,
});
test('join tickets reject expiry, forgery, wrong audience and cross-purpose signatures', async () => {
  const token = await issueTicket(secret, claims('alice'), 1000);
  assert.equal((await readTicket(secret, token, 1100)).sub, 'alice');
  assert.equal(await readTicket(secret, token, 62000), null);
  assert.equal(await readTicket(secret, token + 'bad', 1100), null);
  assert.equal(
    await readTicket(
      'different-secret-with-at-least-32-characters',
      token,
      1100,
    ),
    null,
  );
  const sig = await signature(secret, 'join', 'payload');
  assert.equal(await verifySignature(secret, 'result', 'payload', sig), false);
});
test('inputs accept controls only; reject replay, non-finite aim and forged movement', () => {
  const frame = {
    type: 'input',
    seq: 1,
    yaw: 0,
    pitch: 0,
    controls: idleInput(),
    x: 9999,
    kills: 200,
  };
  const parsed = parseInput(frame, 0);
  assert.ok(parsed);
  assert.equal(parsed.x, undefined);
  assert.equal(parsed.kills, undefined);
  assert.equal(parseInput(frame, 1), null);
  assert.equal(parseInput({ ...frame, yaw: Infinity }, 0), null);
  assert.equal(
    parseInput({ ...frame, controls: { ...idleInput(), forward: 100 } }, 0),
    null,
  );
  assert.equal(
    parseInput(
      { ...frame, controls: { ...idleInput(), weapon: 'handcannon' } },
      0,
    ),
    null,
  );
});
test('FFA waits for two ready humans; ten-player capacity is enforced', () => {
  const r = new LiveRoom('ffa', 'citadel');
  r.add(claims('a'));
  r.ready('a');
  r.step();
  assert.equal(r.status, 'waiting');
  r.add(claims('b'));
  r.ready('b');
  r.step();
  assert.equal(r.status, 'playing');
  for (let i = 2; i < 10; i++) r.add(claims('p' + i));
  assert.throws(() => r.add(claims('overflow')), /full/);
  assert.equal(r.players.size, 10);
});
test('2v2 waits for four ready humans and allocates two players per side', () => {
  const r = new LiveRoom('2v2', 'depot');
  for (const id of ['a', 'b', 'c', 'd']) r.add(claims(id, '2v2'));
  for (const id of ['a', 'b', 'c']) r.ready(id);
  r.step();
  assert.equal(r.status, 'waiting');
  r.ready('d');
  r.step();
  assert.equal(r.status, 'playing');
  assert.deepEqual(
    [...r.players.values()].map((p) => p.game.player.team),
    [0, 1, 0, 1],
  );
  const [a,b,c,d]=[...r.players.values()].map((p)=>p.game.player);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=40);
  assert.ok(Math.hypot(a.x-c.x,a.z-c.z)<Math.hypot(a.x-b.x,a.z-b.z));
  assert.ok(Math.hypot(b.x-d.x,b.z-d.z)<Math.hypot(a.x-b.x,a.z-b.z));
});
test('roster reports real participants and readiness without exposing account or ticket claims', () => {
  const r = new LiveRoom('1v1', 'citadel');
  r.add(claims('a', '1v1'));
  const b = r.add(claims('b', '1v1'));
  r.ready('a');
  let snapshot = r.snapshot('a');
  assert.equal(snapshot.roster.length, 2);
  assert.deepEqual(snapshot.roster[0], {
    slot: 0,
    name: 'a',
    team: 0,
    you: true,
    ready: true,
    connected: true,
    left: false,
  });
  assert.equal(snapshot.roster[1].ready, false);
  assert.equal(snapshot.roster[1].you, false);
  assert.equal(r.snapshot('b').roster[1].you, true);
  b.connected = false;
  assert.equal(r.snapshot('a').roster[1].connected, false);
  r.leave('b');
  snapshot = r.snapshot('a');
  assert.equal(snapshot.count, 1);
  assert.equal(snapshot.roster[1].left, true);
  for (const member of snapshot.roster) {
    assert.deepEqual(Object.keys(member).sort(), [
      'connected',
      'left',
      'name',
      'ready',
      'slot',
      'team',
      'you',
    ]);
  }
});

test('server movement uses fixed ticks, stops stale controls and cannot teleport from payloads', () => {
  const r = new LiveRoom('ffa', 'citadel');
  for (const id of ['a', 'b']) {
    r.add(claims(id));
    r.ready(id);
  }
  const a = r.players.get('a');
  const before = { x: a.game.player.x, z: a.game.player.z };
  r.input('a', {
    type: 'input',
    seq: 1,
    yaw: 0,
    pitch: 0,
    controls: { ...idleInput(), forward: 1 },
    x: 9999,
  });
  for (let i = 0; i < 30; i++) r.step();
  assert.ok(
    Math.hypot(a.game.player.x - before.x, a.game.player.z - before.z) < 6,
  );
  for (let i = 0; i < 90; i++) r.step();
  assert.equal(a.game.player.moving, 0);
  assert.equal(a.game.player.kills, 0);
});
test('server hits enforce walls, spawn shields, damage and exactly one kill per death', () => {
  const r = new LiveRoom('ffa', 'citadel');
  for (const id of ['a', 'b']) {
    r.add(claims(id));
    r.ready(id);
  }
  r.step();
  const a = r.players.get('a'),
    b = r.players.get('b');
  const s = a.game.map.spawns[0];
  Object.assign(a.game.player, { x: s.x, z: s.z, shield: 0 });
  Object.assign(b.game.player, { x: s.x, z: s.z + 1, shield: 1 });
  r.cast('a', direction(Math.PI, 0), 100, 2, 5);
  assert.equal(b.game.player.hp, 100);
  b.game.player.shield = 0;
  r.cast('a', direction(Math.PI, 0), 100, 2, 5);
  assert.equal(b.game.player.hp, 0);
  assert.equal(a.game.player.kills, 1);
  r.cast('a', direction(Math.PI, 0), 100, 2, 5);
  assert.equal(a.game.player.kills, 1);
  b.game.player.hp = 100;
  b.game.player.shield = 0;
  a.game.boxes = [{ x: s.x, z: s.z + 0.5, w: 2, d: 0.2, h: 5, y: 0 }];
  r.cast('a', direction(Math.PI, 0), 100, 2, 5);
  assert.equal(b.game.player.hp, 100);
});
test('leaving a live duel forfeits to the opposing team and ends the shared match', () => {
  const r = new LiveRoom('1v1', 'citadel');
  for (const id of ['a', 'b']) {
    r.add({ ...claims(id, '1v1'), guest: false });
    r.ready(id);
  }
  r.step();
  r.leave('a');
  assert.equal(r.status, 'finished');
  const p = r.result().players;
  assert.equal(p.find((p) => p.id === 'a').completed, false);
  assert.equal(p.find((p) => p.id === 'b').won, true);
});
test('live server ends FFA at the common deadline', () => {
  const r = new LiveRoom('ffa', 'underpass');
  for (const id of ['a', 'b']) {
    r.add(claims(id));
    r.ready(id);
  }
  r.step();
  r.elapsed = 180 - LIVE_TICK / 2;
  r.step();
  assert.equal(r.status, 'finished');
  assert.equal(r.result().players.length, 0);
});
test('real payments fail closed and ledger movements must balance', () => {
  const p = {
    country: 'BE',
    allowedCountries: [],
    ageVerified: true,
    identityVerified: true,
    selfExcluded: false,
    providerApproved: true,
  };
  assert.equal(paymentEligibility(p).allowed, false);
  assert.equal(
    paymentEligibility({ ...p, allowedCountries: ['BE'], selfExcluded: true })
      .allowed,
    false,
  );
  assert.throws(
    () =>
      validateJournal([
        { account: 'cash', cents: 100, currency: 'EUR' },
        { account: 'escrow', cents: -99, currency: 'EUR' },
      ]),
    /equal/,
  );
  assert.equal(
    validateJournal([
      { account: 'cash', cents: 100, currency: 'EUR' },
      { account: 'escrow', cents: -100, currency: 'EUR' },
    ]).length,
    2,
  );
});
