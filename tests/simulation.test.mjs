import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, Navigation, idleInput, clearAt, moveActor, direction, weapons, wallDistance } from '../lib/fps/simulation.ts';
import { maps, collisionBoxes } from '../lib/fps/maps.ts';
import { settlement } from '../lib/account-rules.ts';
import {PerspectiveCamera,Vector3} from 'three';

test('rendered camera direction matches shot rays for all look angles',()=>{
 const camera=new PerspectiveCamera();camera.rotation.order='YXZ';
 for(const yaw of [-2.5,-1,0,.9,2.4])for(const pitch of [-1,-.4,0,.5,1.2]){
  camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld();const rendered=camera.getWorldDirection(new Vector3()),shot=direction(yaw,pitch);
  assert.ok(rendered.distanceTo(new Vector3(shot.x,shot.y,shot.z))<1e-6);
 }
 const sim=new Simulation({mode:'practice',rate:2,team:'1v1',balance:100});sim.yaw=sim.pitch=0;sim.look(.1,-.1);const aimed=direction(sim.yaw,sim.pitch);assert.ok(aimed.x>0&&aimed.y>0,'right and upward mouse movement aims right and up');
});

// Pure gameplay regression tests; no browser or live account is required.
const fixedDt = 1 / 60;
test('Citadel ceiling and door lintels stop bullets while doorways remain traversable',()=>{const boxes=collisionBoxes(maps[0]);assert.ok(wallDistance(boxes,{x:-26,y:1.62,z:-12},{x:0,y:1,z:0})<2);assert.ok(clearAt(boxes,-26,-12,.4));assert.ok(wallDistance(boxes,{x:-25,y:1.62,z:-15},{x:0,y:1,z:0})<4);});
const config = (extra = {}) => ({ mode: 'practice', rate: 5, team: '1v1', balance: 90, mapId: 'foundry', ...extra });
const create = (extra = {}) => new Simulation(config(extra), () => 0.5);
const box = (extra = {}) => ({ x: 0, z: -5, w: 3, d: 1, h: 4, material: 'concrete', ...extra });
const advance = (sim, seconds, input = idleInput()) => {
  const count = Math.ceil(seconds / fixedDt);
  for (let i = 0; i < count; i++) sim.step(Math.min(fixedDt, seconds - i * fixedDt), input);
};
function isolated(extra = {}) {
  const sim = create(extra);
  sim.actors = [sim.player];
  sim.boxes = [];
  sim.pickups = [];
  Object.assign(sim.player, { x: 0, z: 0, y: 0, shield: 0 });
  sim.yaw = 0;
  sim.start();
  return sim;
}
function shooting(extra = {}) {
  const sim = create(extra);
  sim.actors = sim.actors.slice(0, 2);
  sim.boxes = [];
  sim.pickups = [];
  Object.assign(sim.player, { x: 0, z: 0, y: 0, shield: 0, yaw: 0 });
  Object.assign(sim.actors[1], { x: 0, z: -10, y: 0, shield: 0, hp: 100 });
  sim.yaw = 0;
  sim.start();
  return sim;
}
function aimAt(sim, point) {
  const from = sim.eye(sim.player);
  const d = { x: point.x - from.x, y: point.y - from.y, z: point.z - from.z };
  const length = Math.hypot(d.x, d.y, d.z);
  return { x: d.x / length, y: d.y / length, z: d.z / length };
}
function kill(sim, victim = sim.actors[1], attacker = sim.player) {
  victim.hp = 100; victim.shield = 0;
  sim.damage(victim, attacker, 100);
}
function matchesServerSettlement(sim, ending) {
  const result = sim.result;
  assert.ok(result);
  const server = settlement(sim.config, { ...result, ending }, sim.config.balance * 100);
  assert.equal(result.balance, (sim.config.balance * 100 + server.delta) / 100);
  assert.equal(result.won, server.won);
  assert.equal(result.reason, server.reason);
}

for (const map of maps) {
  test(`${map.name}: all spawns and navigation routes are clear and mutually reachable`, () => {
    const nav = new Navigation(map), boxes = collisionBoxes(map);
    for (const spawn of map.spawns) assert.ok(clearAt(boxes, spawn.x, spawn.z, 0.4));
    for (const start of map.spawns) for (const end of map.spawns) {
      const path = nav.route(start, end);
      assert.ok(path.length, `No path between ${JSON.stringify(start)} and ${JSON.stringify(end)}`);
      const points = [start, ...path, end];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const pieces = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1));
        for (let j = 0; j <= pieces; j++) {
          const x = a.x + (b.x - a.x) * j / pieces, z = a.z + (b.z - a.z) * j / pieces;
          assert.ok(clearAt(boxes, x, z, 0.4), `Route cuts through cover at (${x}, ${z})`);
        }
      }
    }
  });
}

test('normalized diagonal movement travels the same distance as forward movement', () => {
  const straight = isolated(), diagonal = isolated();
  advance(straight, 1, { ...idleInput(), forward: 1 });
  advance(diagonal, 1, { ...idleInput(), forward: 1, right: 1 });
  assert.ok(Math.abs(Math.hypot(straight.player.x, straight.player.z) - Math.hypot(diagonal.player.x, diagonal.player.z)) < 1e-10);
  assert.ok(Math.abs(diagonal.player.x + diagonal.player.z) < 1e-10);
  assert.ok(Math.hypot(straight.vx, straight.vz) <= 4.7 + 1e-10);
});

test('oversized movement input is normalized and rotated by camera yaw', () => {
  const regular = isolated(), oversized = isolated(), rotated = isolated();
  rotated.yaw = Math.PI / 2;
  advance(regular, 1, { ...idleInput(), forward: 1 });
  advance(oversized, 1, { ...idleInput(), forward: 10 });
  advance(rotated, 1, { ...idleInput(), forward: 1 });
  assert.ok(Math.abs(regular.player.z - oversized.player.z) < 1e-10);
  assert.ok(Math.abs(rotated.player.x - regular.player.z) < 1e-10);
  assert.ok(Math.abs(rotated.player.z) < 1e-10);
});

test('movement cannot tunnel through tall or crouch-height cover and can slide along it', () => {
  for (const height of [1.1, 4]) {
    const sim = isolated(), obstacle = box({ x: 2, z: 0, w: 1, d: 10, h: height });
    moveActor(sim.player, 10, 3, [obstacle]);
    assert.ok(sim.player.x <= 1.1 + 1e-10);
    assert.ok(sim.player.z > 2.99);
    assert.ok(clearAt([obstacle], sim.player.x, sim.player.z));
  }
});

test('a long stalled frame is capped and does not teleport the player', () => {
  const sim = isolated();
  sim.step(20, { ...idleInput(), forward: 1 });
  assert.equal(sim.elapsed, 1 / 30);
  assert.ok(Math.abs(sim.player.z) < 0.16);
});

test('a tall wall stops a shot before an enemy and records the wall impact', () => {
  const sim = shooting();
  sim.boxes = [box()];
  sim.cast(sim.player, direction(0), 28, 2.5, 75);
  assert.equal(sim.actors[1].hp, 100);
  assert.equal(sim.shots.length, 1);
  assert.equal(sim.shots[0].to.z, -4.5);
  assert.equal(sim.events.some(e => e.kind === 'hit'), false);
});

test('a clear headshot applies the multiplier while a torso shot applies base damage', () => {
  const head = shooting(), body = shooting();
  head.cast(head.player, direction(0), 28, 2.5, 75);
  body.cast(body.player, aimAt(body, { x: 0, y: 1, z: -10 }), 28, 2.5, 75);
  assert.equal(head.actors[1].hp, 30);
  assert.equal(body.actors[1].hp, 72);
  assert.ok(head.events.some(e => e.kind === 'hit' && e.head));
  assert.ok(body.events.some(e => e.kind === 'hit' && !e.head));
});

test('low cover blocks a crouched target but allows a standing target headshot', () => {
  const standing = shooting(), crouched = shooting();
  // Put the crate near the target so its 1.1 m height covers the crouched head centre.
  standing.boxes = [box({ z: -8.5, h: 1.1 })];
  crouched.boxes = [box({ z: -8.5, h: 1.1 })];
  crouched.actors[1].crouch = true;
  standing.cast(standing.player, direction(0), 28, 2.5, 75);
  crouched.cast(crouched.player, aimAt(crouched, { x: 0, y: 1.04, z: -10 }), 28, 2.5, 75);
  assert.equal(standing.actors[1].hp, 30);
  assert.equal(crouched.actors[1].hp, 100);
});

test('the closest actor intercepts the ray and maximum range is enforced', () => {
  const sim = shooting();
  const near = { ...sim.actors[1], id: 20, name: 'Near', z: -5 };
  sim.actors.push(near);
  sim.cast(sim.player, direction(0), 28, 2.5, 75);
  assert.equal(near.hp, 30);
  assert.equal(sim.actors[1].hp, 100);
  const limited = shooting();
  limited.cast(limited.player, direction(0), 100, 2, 5);
  assert.equal(limited.actors[1].hp, 100);
  assert.equal(limited.shots[0].to.z, -5);
});

test('spawn shields and friendly teams reject damage; firing removes the shooter shield', () => {
  const sim = shooting({ mode: 'duel', team: '2v2' });
  const enemy = sim.actors[1];
  enemy.shield = 1;
  sim.damage(enemy, sim.player, 100);
  assert.equal(enemy.hp, 100);
  enemy.shield = 0;
  enemy.team = sim.player.team;
  sim.damage(enemy, sim.player, 100);
  assert.equal(enemy.hp, 100);
  sim.player.shield = 1;
  assert.equal(sim.fire(), true);
  assert.equal(sim.player.shield, 0);
});

test('duel ends at five points and ignores any later damage and settlement calls', () => {
  const sim = shooting({ mode: 'duel' });
  for (let i = 0; i < 5; i++) kill(sim);
  assert.equal(sim.ended, true);
  assert.equal(sim.score, 5);
  assert.equal(sim.enemyScore, 0);
  assert.equal(sim.balance, 110);
  const firstResult = structuredClone(sim.result);
  kill(sim);
  kill(sim, sim.player, sim.actors[1]);
  sim.leave(); sim.finish(); sim.step(1 / 30, { ...idleInput(), fire: true });
  assert.deepEqual(sim.result, firstResult);
  assert.equal(sim.player.kills, 5);
  assert.equal(sim.score, 5);
  assert.equal(sim.enemyScore, 0);
  assert.equal(sim.balance, 110);
  matchesServerSettlement(sim, 'complete');
});

test('2v2 ally eliminations count toward the same terminal team score', () => {
  const sim = create({ mode: 'duel', team: '2v2' });
  sim.start();
  assert.equal(sim.actors[3].team, sim.player.team);
  for (let i = 0; i < 5; i++) kill(sim, sim.actors[1], sim.actors[3]);
  assert.equal(sim.score, 5);
  assert.equal(sim.player.kills, 0);
  assert.equal(sim.result.won, true);
  assert.equal(sim.balance, 110);
  matchesServerSettlement(sim, 'complete');
});

test('the fifth player kill stops bot actions during the same simulation tick', () => {
  const sim = shooting({ mode: 'duel' });
  sim.score = sim.enemyScore = 4;
  Object.assign(sim.actors[1], { hp: 1, cooldown: 0, reaction: 0, target: sim.player.id });
  sim.player.hp = 1;
  sim.player.lastDamage = sim.elapsed;
  sim.step(fixedDt, { ...idleInput(), fire: true });
  assert.equal(sim.score, 5);
  assert.equal(sim.enemyScore, 4);
  assert.equal(sim.player.hp, 1);
  assert.equal(sim.result.won, true);
});

test('opponent reaching five ends the duel without refunding the reserved stake', () => {
  const sim = shooting({ mode: 'duel' });
  for (let i = 0; i < 5; i++) kill(sim, sim.player, sim.actors[1]);
  assert.equal(sim.enemyScore, 5);
  assert.equal(sim.balance, 90);
  assert.equal(sim.result.won, false);
  matchesServerSettlement(sim, 'complete');
});

test('leaving before play refunds exactly one reserved stake', () => {
  const sim = create({ mode: 'duel' });
  sim.leave(); sim.leave();
  assert.equal(sim.balance, 100);
  assert.equal(sim.result.reason, 'Match cancelled');
  matchesServerSettlement(sim, 'cancel');
});

test('leaving after play is a forfeit even when ahead and never refunds the stake', () => {
  const sim = shooting({ mode: 'duel' });
  kill(sim);
  sim.leave();
  assert.equal(sim.balance, 90);
  assert.equal(sim.result.won, false);
  assert.equal(sim.result.reason, 'Duel forfeited');
  matchesServerSettlement(sim, 'leave');
});

test('a timed duel draw returns the reserved stake and freezes later ticks', () => {
  const sim = isolated({ mode: 'duel' });
  sim.score = sim.enemyScore = 2;
  sim.time = 0.01;
  sim.step(fixedDt, idleInput());
  assert.equal(sim.balance, 100);
  assert.equal(sim.result.reason, 'Draw — stake returned');
  const elapsed = sim.elapsed;
  advance(sim, 1);
  assert.equal(sim.elapsed, elapsed);
  matchesServerSettlement(sim, 'complete');
});

test('free practice leaves balance unchanged while FFA applies kill/death credits', () => {
  const practice = shooting(), ffa = shooting({ mode: 'ffa', balance: 10, rate: 5 });
  kill(practice);
  assert.equal(practice.balance, 90);
  kill(ffa);
  assert.equal(ffa.balance, 15);
  kill(ffa, ffa.player, ffa.actors[1]);
  assert.equal(ffa.balance, 10);
  ffa.finish();
  matchesServerSettlement(ffa, 'complete');
});

test('leaving FFA while ahead reports the same result as server settlement', () => {
  const sim = shooting({ mode: 'ffa' });
  kill(sim);
  sim.leave();
  assert.equal(sim.balance, 95);
  matchesServerSettlement(sim, 'leave');
});

test('FFA ends when the remaining balance cannot fund another death', () => {
  const sim = shooting({ mode: 'ffa', balance: 12, rate: 5 });
  kill(sim, sim.player, sim.actors[1]);
  assert.equal(sim.ended, false);
  kill(sim, sim.player, sim.actors[1]);
  assert.equal(sim.ended, true);
  assert.equal(sim.balance, 2);
  matchesServerSettlement(sim, 'complete');
});

test('rifle fire respects cooldown and holding automatic fire consumes multiple rounds', () => {
  const sim = isolated();
  assert.equal(sim.fire(), true);
  assert.equal(sim.fire(), false);
  assert.equal(sim.ammo.rifle, 29);
  advance(sim, weapons.rifle.interval - 0.02);
  assert.equal(sim.fire(), false);
  advance(sim, 0.021);
  assert.equal(sim.fire(), true);
  const auto = isolated();
  advance(auto, 0.5, { ...idleInput(), fire: true });
  assert.ok(auto.ammo.rifle <= 26 && auto.ammo.rifle >= 25);
});

test('marksman fires once per press and requires release before another shot', () => {
  const sim = isolated();
  sim.switchWeapon('marksman');
  advance(sim, 0.3);
  advance(sim, 1, { ...idleInput(), fire: true });
  assert.equal(sim.ammo.marksman, 9);
  sim.step(fixedDt, idleInput());
  sim.step(fixedDt, { ...idleInput(), fire: true });
  assert.equal(sim.ammo.marksman, 8);
});

test('reload transfers available reserve only at completion and prevents firing', () => {
  const sim = isolated();
  sim.ammo.rifle = 20; sim.reserve.rifle = 3;
  sim.reload();
  assert.equal(sim.fire(), false);
  advance(sim, weapons.rifle.reload - 0.02);
  assert.equal(sim.ammo.rifle, 20);
  assert.equal(sim.reserve.rifle, 3);
  advance(sim, 0.021);
  assert.equal(sim.ammo.rifle, 23);
  assert.equal(sim.reserve.rifle, 0);
  assert.equal(sim.reloadLeft, 0);
  sim.reload();
  assert.equal(sim.reloadLeft, 0);
});

test('switching weapons cancels reload without transferring ammunition', () => {
  const sim = isolated();
  sim.ammo.rifle = 10;
  sim.reload(); advance(sim, 0.5);
  sim.switchWeapon('smg');
  assert.equal(sim.reloadLeft, 0);
  assert.equal(sim.fire(), false);
  advance(sim, 2);
  assert.equal(sim.ammo.rifle, 10);
  assert.equal(sim.reserve.rifle, 120);
  assert.equal(sim.fire(), true);
});

test('death cancels a reload and respawn replenishes ammunition without double credit', () => {
  const sim = isolated();
  sim.ammo.rifle = 1; sim.reserve.rifle = 2;
  sim.reload(); sim.player.hp = 0; sim.player.respawn = 2.4;
  sim.step(fixedDt, idleInput());
  assert.equal(sim.reloadLeft, 0);
  advance(sim, 2.5);
  assert.equal(sim.player.hp, 100);
  assert.equal(sim.ammo.rifle, weapons.rifle.mag);
  assert.equal(sim.reserve.rifle, 120);
});

test('pre-start ticks freeze clocks, movement, cooldown, and reload state', () => {
  const sim = create();
  sim.shotCooldown = 0.5; sim.reloadLeft = 1;
  const before = { time: sim.time, elapsed: sim.elapsed, x: sim.player.x, z: sim.player.z, cooldown: sim.shotCooldown, reload: sim.reloadLeft };
  advance(sim, 1, { ...idleInput(), forward: 1, fire: true });
  assert.deepEqual({ time: sim.time, elapsed: sim.elapsed, x: sim.player.x, z: sim.player.z, cooldown: sim.shotCooldown, reload: sim.reloadLeft }, before);
});

test('caller-controlled pause preserves time and active-match forfeiture semantics', () => {
  const sim = isolated({ mode: 'duel' });
  sim.ammo.rifle = 10; sim.reload();
  advance(sim, 0.4);
  const before = [sim.time, sim.elapsed, sim.reloadLeft, sim.player.x, sim.player.z];
  // Renderer pause must withhold step() calls and keep started=true.
  let paused = true;
  for (let i = 0; i < 60; i++) if (!paused) sim.step(fixedDt, idleInput());
  assert.deepEqual([sim.time, sim.elapsed, sim.reloadLeft, sim.player.x, sim.player.z], before);
  paused = false;
  if (!paused) sim.step(fixedDt, idleInput());
  assert.ok(sim.reloadLeft < before[2]);
  sim.leave();
  assert.equal(sim.result.reason, 'Duel forfeited');
  assert.equal(sim.balance, 90);
});

test('AI sharing the target position keeps finite movement and shot coordinates', () => {
  const sim = shooting();
  const bot = sim.actors[1];
  Object.assign(bot, { x: sim.player.x, z: sim.player.z, shield: 0, cooldown: 0, target: sim.player.id, reaction: 0 });
  sim.botStep(bot, fixedDt);
  assert.ok(Number.isFinite(bot.x) && Number.isFinite(bot.z));
  assert.ok(Number.isFinite(bot.moving), 'Overlapping actors produced NaN movement');
  for (const shot of sim.shots) assert.ok(Object.values(shot.to).every(Number.isFinite));
});
