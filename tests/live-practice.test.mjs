import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveRoom } from '../lib/live/world.ts';
import { findRoom, openRooms } from '../lib/live/matchmaking.ts';
import { direction } from '../lib/fps/simulation.ts';

const claims = sub => ({ sub, name: sub, guest: true, mode: 'practice', mapId: 'citadel', nonce: sub, exp: Date.now() + 60000, aud: 'skillclash-game' });

test('practice shares bots with joining humans, releases slots, and never ends on the round timer', () => {
  const room = new LiveRoom('practice', 'citadel');
  room.add(claims('alice')); room.ready('alice'); room.step();
  assert.equal(room.players.size, 10);
  assert.equal([...room.players.values()].filter(p => p.bot).length, 9);
  assert.equal(openRooms([room])[0].openSlots, 9);
  assert.equal(findRoom([room], claims('bob')), room);
  room.add(claims('bob')); room.ready('bob'); room.step();
  assert.equal(room.players.size, 10);
  assert.equal(room.humanCount, 2);
  assert.equal(new Set([...room.players.values()].map(p => p.slot)).size, 10);
  const a = room.snapshot('alice'), b = room.snapshot('bob');
  assert.deepEqual(a.actors.map(x => x.name).sort(), b.actors.map(x => x.name).sort());
  assert.equal(new Set(a.actors.map(x => x.id)).size, 10);
  room.elapsed = 1200; room.step();
  assert.equal(room.status, 'playing');
  room.leave('bob'); room.add(claims('charlie')); room.ready('charlie'); room.step();
  assert.equal(room.humanCount, 2);
  assert.equal(room.players.size, 10);
  assert.equal(new Set([...room.players.values()].map(p => p.slot)).size, 10);
  room.leave('alice'); room.leave('charlie'); room.step();
  assert.equal(room.status, 'finished', 'empty practice should release server resources');
});

test('humans and practice bots damage the same server actors and share deaths', () => {
  const room = new LiveRoom('practice', 'citadel');
  const alice = room.add(claims('alice')); room.ready('alice'); room.step();
  const bob = room.add(claims('bob')); room.ready('bob');
  const bot = [...room.players.values()].find(p => p.bot);
  for (const p of room.players.values()) {
    p.game.boxes = [];
    Object.assign(p.game.player, { x: 40, z: 40, shield: 0 });
  }
  Object.assign(alice.game.player, { x: 0, z: 0, yaw: 0 });
  Object.assign(bob.game.player, { x: 0, z: -6 });
  room.cast('alice', direction(0), 100, 1, 20);
  assert.equal(bob.game.player.hp, 0);
  assert.equal(room.snapshot('bob').actors[0].deaths, 1);
  Object.assign(bot.game.player, { x: 0, z: -10 });
  room.cast('alice', direction(0), 25, 1, 20);
  assert.equal(bot.game.player.hp, 75);
  bot.game.player.yaw = Math.PI;
  room.cast(bot.claims.sub, direction(Math.PI), 25, 1, 20);
  assert.equal(alice.game.player.hp, 75);
  assert.equal(room.snapshot('bob').actors.find(a => a.name === 'alice').hp, 75);
});

test('practice bot AI moves and fires on the shared server without client input', () => {
  const room = new LiveRoom('practice', 'citadel');
  const human = room.add(claims('alice')); room.ready('alice'); room.step();
  const bot = [...room.players.values()].find(p => p.bot);
  for (const p of room.players.values()) {
    p.game.boxes = [];
    Object.assign(p.game.player, { x: 40, z: 40, shield: 0 });
  }
  Object.assign(human.game.player, { x: 0, z: -12, hp: 10000 });
  Object.assign(bot.game.player, { x: 0, z: 0, yaw: 0, cooldown: 0 });
  bot.bot.jumpIn = bot.bot.slideIn = 99;
  for (let i = 0; i < 120; i++) room.step();
  assert.ok(human.game.player.hp < 10000, 'server bot never damaged the human');
  assert.ok(bot.game.player.motion, 'server bot has no replicated animation');
  assert.ok(room.snapshot('alice').actors.some(a => a.motion?.weapon));
});
