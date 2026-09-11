import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LiveRoom } from '../lib/live/world.ts';
import { findRoom, openRooms } from '../lib/live/matchmaking.ts';
import { instantDuelRooms } from '../lib/live/instant-rooms.ts';
import { liveResultDetails } from '../lib/live/result.ts';
import { issueTicket, readTicket } from '../lib/live/security.ts';

const claims = (sub, mode = '1v1') => ({
  sub,
  mode,
  name: sub,
  guest: true,
  mapId: 'citadel',
  nonce: sub,
  exp: Date.now() + 60000,
  aud: 'skillclash-game',
});
const room = (mode = '1v1') => {
  const value = new LiveRoom(mode, 'citadel');
  value.add(claims('a', mode));
  return value;
};

test('public match listing exposes only join details and hides full, finished, disconnected and empty rooms', () => {
  const available = room(),
    empty = new LiveRoom('ffa', 'citadel'),
    full = room(),
    done = room(),
    offline = room();
  full.add(claims('b'));
  done.status = 'finished';
  offline.players.get('a').connected = false;
  const list = openRooms([available, empty, full, done, offline]);
  assert.deepEqual(list, [
    {
      id: available.id,
      mode: '1v1',
      mapId: 'citadel',
      status: 'waiting',
      players: 1,
      ready: 0,
      capacity: 2,
      openSlots: 1,
    },
  ]);
  available.ready('a');
  assert.equal(openRooms([available])[0].ready, 1);
  available.status = 'playing';
  assert.deepEqual(openRooms([available]), []);
});

test('selecting a match joins that exact room and never falls back after a race', () => {
  const first = room(),
    selected = room();
  assert.equal(findRoom([first, selected], claims('b')), first);
  const targeted = { ...claims('b'), roomId: selected.id };
  assert.equal(findRoom([first, selected], targeted), selected);
  selected.add(claims('c'));
  assert.throws(
    () => findRoom([first, selected], targeted),
    /no longer available/,
  );
  assert.throws(
    () => findRoom([first], { ...claims('b'), roomId: crypto.randomUUID() }),
    /no longer available/,
  );
  assert.throws(
    () =>
      findRoom([first], { ...claims('b'), roomId: first.id, mapId: 'depot' }),
    /no longer available/,
  );
  assert.throws(
    () => findRoom([first], { ...claims('b'), roomId: first.id, mode: 'ffa' }),
    /no longer available/,
  );
});

test('in-progress FFA can be joined but consumed slots are not advertised as available', () => {
  const value = room('ffa');
  value.add(claims('b', 'ffa'));
  value.ready('a');
  value.ready('b');
  value.step();
  value.leave('b');
  assert.equal(openRooms([value])[0].status, 'playing');
  assert.equal(openRooms([value])[0].players, 1);
  assert.equal(openRooms([value])[0].openSlots, 8);
  assert.equal(findRoom([value], claims('c', 'ffa')), value);
});

test('instant-fill duel rows are deterministic and marked below real rooms by the UI', () => {
  const rows = instantDuelRooms('underpass', 25);
  assert.deepEqual(
    rows.map(({ id, mode, mapId, instantFill, stake, openSlots }) => ({
      id,
      mode,
      mapId,
      instantFill,
      stake,
      openSlots,
    })),
    [
      {
        id: 'instant-fill-1v1-underpass-25',
        mode: '1v1',
        mapId: 'underpass',
        instantFill: true,
        stake: 25,
        openSlots: 0,
      },
      {
        id: 'instant-fill-2v2-underpass-25',
        mode: '2v2',
        mapId: 'underpass',
        instantFill: true,
        stake: 25,
        openSlots: 0,
      },
    ],
  );
});

test('room targeting is signed and malformed room ids are rejected', async () => {
  const secret = 'test-secret-at-least-32-characters-long';
  const id = crypto.randomUUID();
  const token = await issueTicket(secret, { ...claims('a'), roomId: id });
  assert.equal((await readTicket(secret, token)).roomId, id);
  const invalid = await issueTicket(secret, {
    ...claims('a'),
    roomId: '../other',
  });
  assert.equal(await readTicket(secret, invalid), null);
});

test('final duel reports distinguish victory, defeat and draw with actual server standings', () => {
  const value = room();
  value.add(claims('b'));
  value.ready('a');
  value.ready('b');
  value.step();
  value.score = [10, 4];
  value.status = 'finished';
  assert.equal(liveResultDetails(value.snapshot('a'), true).reason, 'Victory');
  assert.equal(liveResultDetails(value.snapshot('b'), true).reason, 'Defeat');
  const final = liveResultDetails(value.snapshot('b'), true);
  assert.equal(final.standings.length, 2);
  assert.equal(final.standings.find((p) => p.you).name, 'b');
  value.score = [4, 4];
  assert.equal(liveResultDetails(value.snapshot('a'), true).reason, 'Draw');
  assert.deepEqual(liveResultDetails(value.snapshot('a'), false), {});
  assert.deepEqual(liveResultDetails(null, true), {});
});

test('leaving before the round cancels the waiting group rather than trapping the next player', () => {
  const value = room('2v2');
  value.add(claims('b', '2v2'));
  value.leave('a');
  assert.equal(value.status, 'finished');
  assert.deepEqual(openRooms([value]), []);
  assert.equal(findRoom([value], claims('c', '2v2')), undefined);
  const report = liveResultDetails(value.snapshot('b'), true);
  assert.equal(report.reason, 'Match cancelled');
  assert.equal(report.standings, undefined);
});

test('FFA final positions share ties and do not mutate the server snapshot', () => {
  const value = room('ffa');
  value.add(claims('b', 'ffa'));
  value.add(claims('c', 'ffa'));
  value.players.get('a').game.player.kills = 5;
  value.players.get('b').game.player.kills = 7;
  value.players.get('c').game.player.kills = 5;
  const snapshot = value.snapshot('a');
  const report = liveResultDetails(snapshot, true);
  assert.equal(report.placement, 2);
  assert.equal(report.standings[0].name, 'b');
  assert.equal(snapshot.actors[0].name, 'a');
  assert.equal(liveResultDetails(value.snapshot('c'), true).placement, 2);
});
