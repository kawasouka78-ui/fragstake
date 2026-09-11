import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, idleInput, clearAt, weapons, sprintRecovery } from '../lib/fps/simulation.ts';
import { BotController, angleDelta, turnToward, visibleTargetPoint } from '../lib/fps/bot-controller.ts';
import { assignBotSkills } from '../lib/fps/bot-skills.ts';
import { ActorAnimation } from '../lib/fps/actor-motion.ts';
import { ArenaRenderer } from '../lib/fps/renderer.ts';
import { Box3, Scene, Vector3 } from 'three';

const dt = 1 / 60;
function seeded(seed = 7) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function scene(difficulty = 'hard', seed = 7) {
  const sim = new Simulation({ mode: 'practice', mapId: 'citadel', team: '1v1', rate: 0, balance: 0 }, seeded(seed));
  sim.boxes = []; sim.pickups = []; sim.actors = sim.actors.slice(0, 2);
  const bot = sim.actors[1];
  Object.assign(bot, { x: 0, z: 0, yaw: 0, shield: 0, cooldown: 0 });
  Object.assign(sim.player, { x: 0, z: -12, shield: 0, moving: 0 });
  const brain = new BotController(sim, bot, difficulty);
  sim.bots.set(bot.id, brain); sim.start();
  return { sim, bot, brain };
}
function tickBrain(sim, bot, seconds) {
  for (let t = 0; t < seconds - 1e-8; t += dt) { sim.elapsed += dt; sim.botStep(bot, dt); }
}

test('full lobbies have six Pro, two Hard and one Easy, shuffled independently of weapon slots', () => {
  const positions = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const sim = new Simulation({ mode: 'practice', mapId: 'citadel', team: '1v1', rate: 0, balance: 0 }, seeded(seed));
    const counts = { pro: 0, hard: 0, easy: 0 };
    for (const [id, difficulty] of sim.botSkills) {
      counts[difficulty]++;
      if (difficulty === 'easy') positions.add(id);
      const actor = sim.actors.find(a => a.id === id);
      const brain = new BotController(sim, actor);
      sim.bots.set(id, brain);
      assert.equal(brain.difficulty, difficulty);
      sim.respawn(actor);
      assert.equal(sim.bots.get(id).difficulty, difficulty, 'respawn changed skill');
    }
    assert.deepEqual(counts, { pro: 6, hard: 2, easy: 1 });
    assert.equal(sim.botSkills.has(sim.player.id), false);
  }
  assert.ok(positions.size > 3, 'the easy bot is tied to one weapon or spawn');
});

test('small duels stay mainly Pro without adding extra opponents', () => {
  const counts = { pro: 0, hard: 0, easy: 0 }, rng = seeded(17);
  for (let i = 0; i < 2000; i++) counts[assignBotSkills([1], rng).get(1)]++;
  assert.ok(counts.pro > 1300 && counts.pro < 1500);
  assert.ok(counts.hard > counts.easy && counts.easy > 100);
  assert.deepEqual([...assignBotSkills([1, 2, 3], seeded()).values()].sort(), ['hard', 'pro', 'pro']);
  assert.equal(assignBotSkills([], seeded()).size, 0);
});

for (const difficulty of ['easy', 'hard', 'pro']) {
  test(`${difficulty}: reaction, walls, damage, fire rate and reload limits remain fair`, () => {
    const { sim, bot, brain } = scene(difficulty);
    brain.perceive(sim, bot);
    tickBrain(sim, bot, brain.reactionTime * .5);
    assert.equal(sim.shots.length, 0);
    sim.boxes = [{ x: 0, z: -5, w: 60, d: 1, h: 6, material: 'concrete' }];
    tickBrain(sim, bot, .5);
    assert.equal(brain.sighted, -1);
    assert.equal(sim.shots.length, 0);
    sim.boxes = []; sim.rng = () => .5;
    Object.assign(bot, { x: 0, z: 0, y: 0, yaw: 0, crouch: false, shield: 0, cooldown: 0, reaction: 0 });
    brain.aimPoint = { x: 0, y: 1.18, z: -12 };
    brain.pitch = Math.atan2(1.18 - sim.eye(bot).y, 12);
    brain.burstPause = brain.reloadLeft = brain.slideLeft = 0;
    brain.shoot(sim, bot, sim.player);
    assert.equal(sim.player.hp, 100 - weapons.rifle.damage);
    assert.equal(bot.cooldown, weapons.rifle.interval);
    assert.equal(brain.ammo, weapons.rifle.mag - 1);
    brain.shoot(sim, bot, sim.player);
    assert.equal(brain.ammo, weapons.rifle.mag - 1, 'bypassed gun fire rate');
    bot.cooldown = 0; brain.reloadLeft = .5;
    brain.shoot(sim, bot, sim.player);
    assert.equal(brain.ammo, weapons.rifle.mag - 1, 'fired during a reload');
  });
}

test('Pro acquires and damages a strafing opponent more effectively than Hard and Easy', () => {
  const results = {};
  for (const difficulty of ['easy', 'hard', 'pro']) {
    let damage = 0, firstShotTime = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { sim, bot, brain } = scene(difficulty, seed);
      Object.assign(sim.player, { z: -30, hp: 100000 });
      // Isolate target tracking and bursts from route/cover choices.
      brain.aggression = 0; brain.steadyLeft = brain.jumpIn = brain.slideIn = 99;
      let firstShot = null;
      for (let frame = 0; frame < 360; frame++) {
        sim.player.x = Math.sin(frame * dt * 1.3) * 3;
        sim.elapsed += dt; sim.botStep(bot, dt);
        if (sim.shots.length && firstShot === null) firstShot = sim.elapsed;
      }
      assert.notEqual(firstShot, null, `${difficulty} never engaged`);
      damage += 100000 - sim.player.hp;
      firstShotTime += firstShot;
    }
    results[difficulty] = { damage, firstShotTime };
  }
  assert.ok(results.pro.firstShotTime < results.hard.firstShotTime);
  assert.ok(results.hard.firstShotTime < results.easy.firstShotTime);
  assert.ok(results.pro.damage > results.hard.damage * 1.15, JSON.stringify(results));
  assert.ok(results.hard.damage > results.easy.damage * 1.15, JSON.stringify(results));
});

test('a silent unseen enemy does not become a patrol target, even when nearby behind the bot', () => {
  const { sim, bot, brain } = scene();
  sim.player.z = 12;
  brain.perceive(sim, bot); brain.decide(sim, bot);
  assert.equal(brain.sighted, -1);
  assert.equal(brain.memory, null);
  assert.equal(bot.target, -1);
  assert.equal(brain.intent, 'patrol');
  assert.notDeepEqual(brain.goal, { x: sim.player.x, z: sim.player.z });
});

test('aim has a reaction delay and turns across the shortest arc at a bounded speed', () => {
  const { sim, bot, brain } = scene();
  sim.player.x = 6;
  brain.perceive(sim, bot);
  assert.equal(brain.sighted, sim.player.id);
  tickBrain(sim, bot, .2);
  assert.equal(sim.shots.length, 0, 'fired before the reaction delay');
  for (let i = 0; i < 120; i++) {
    const previous = bot.yaw; sim.elapsed += dt; sim.botStep(bot, dt);
    assert.ok(Math.abs(angleDelta(previous, bot.yaw)) <= brain.turnRate * dt + 1e-9);
  }
  const nearWrap = turnToward(Math.PI - .02, -Math.PI + .02, dt);
  assert.ok(Math.abs(angleDelta(Math.PI - .02, nearWrap)) < .04);
});

test('losing sight preserves the last observed position and never follows an enemy through a wall', () => {
  const { sim, bot, brain } = scene();
  brain.perceive(sim, bot);
  const lastSeen = { ...brain.memory.point };
  sim.boxes = [{ x: 0, z: -5, w: 60, d: 1, h: 6, material: 'concrete' }];
  sim.player.x = 8; sim.player.z = -15;
  brain.perceive(sim, bot); brain.decide(sim, bot);
  assert.equal(brain.sighted, -1);
  assert.deepEqual(brain.memory.point, lastSeen);
  assert.equal(brain.intent, 'investigate');
  assert.deepEqual(brain.goal, { x: lastSeen.x, z: lastSeen.z });
  tickBrain(sim, bot, .5);
  assert.equal(sim.shots.length, 0);
  sim.elapsed = 5; brain.perceive(sim, bot);
  assert.equal(brain.memory, null);
});

test('nearby gunfire provides an approximate investigation point but does not grant sight', () => {
  const { sim, bot, brain } = scene();
  sim.player.z = 12;
  sim.notifyBotSound(sim.player, 32);
  assert.ok(brain.memory);
  assert.equal(brain.memory.id, -1);
  assert.equal(brain.sighted, -1);
  assert.ok(Math.hypot(brain.memory.point.x - sim.player.x, brain.memory.point.z - sim.player.z) < 3);
  const remembered = { ...brain.memory.point };
  sim.player.x = 20;
  assert.deepEqual(brain.memory.point, remembered);
});

test('distant players are noticed beyond 46 metres and a rifle engages within its actual range', () => {
  const { sim, bot, brain } = scene();
  sim.player.z = -70;
  brain.perceive(sim, bot);
  assert.equal(brain.sighted, sim.player.id);
  tickBrain(sim, bot, 2);
  assert.ok(sim.shots.length > 0, 'ignored a distant opponent within rifle range');
  assert.ok(sim.shots.every(shot => Math.hypot(shot.to.x-shot.from.x, shot.to.y-shot.from.y, shot.to.z-shot.from.z) <= weapons.rifle.range + 1e-8));
  const far = scene();
  far.sim.player.z = -105;
  far.brain.perceive(far.sim, far.bot);
  assert.equal(far.brain.sighted, far.sim.player.id);
  far.sim.boxes = [{x:0,z:-40,w:200,d:1,h:6,material:'concrete'}];
  far.brain.perceive(far.sim, far.bot);
  assert.equal(far.brain.sighted, -1, 'extended vision must still respect walls');
});

test('seeing someone beside a walking route turns attention toward them before shooting', () => {
  const { sim, bot, brain } = scene();
  Object.assign(sim.player, {x:8,z:0,hp:10000});
  brain.vz = -7;
  brain.perceive(sim, bot);
  assert.equal(brain.sighted, sim.player.id, 'missed a player beside the route');
  tickBrain(sim, bot, .2);
  assert.ok(bot.yaw < -.3, 'kept looking along the walking route during reaction time');
  assert.equal(sim.shots.length, 0, 'aiming sooner must not bypass reaction time');
  tickBrain(sim, bot, 1.5);
  assert.equal(brain.sighted, sim.player.id);
  assert.ok(sim.shots.length > 0, 'repeated reacquisition prevented the bot from ever engaging');
});

test('a close player passing behind stays noticed, but close proximity never reveals through walls', () => {
  const { sim, bot, brain } = scene();
  sim.player.z = -8; brain.perceive(sim, bot);
  sim.player.x = 4; sim.player.z = 1;
  brain.perceive(sim, bot);
  assert.equal(brain.sighted, sim.player.id);
  sim.boxes = [{x:2,z:0,w:1,d:20,h:5,material:'concrete'}];
  brain.perceive(sim, bot);
  assert.equal(brain.sighted, -1);
});

test('a nearby threat interrupts a locked flank rather than being walked past', () => {
  const { sim, bot, brain } = scene();
  const distant = {...sim.player,id:2,x:0,z:-20,team:2}; sim.actors.push(distant);
  brain.sighted = distant.id;
  brain.memory = {id:distant.id,point:{x:0,y:1.18,z:-20},expires:4};
  brain.goal = {x:10,z:-20}; brain.goalUntil = 5; brain.intent = 'flank';
  Object.assign(sim.player,{x:3,z:-2});
  brain.perceive(sim,bot); brain.decide(sim,bot);
  assert.equal(brain.sighted,sim.player.id);
  assert.equal(brain.intent,'engage');
  assert.equal(brain.goal,null);
});

test('being hit from behind makes the bot turn toward the hit without tracking a hidden shooter', () => {
  const { sim, bot, brain } = scene();
  Object.assign(sim.player,{x:12,z:10});
  sim.damage(bot,sim.player,25);
  const cue = {...brain.alertPoint};
  sim.player.x = 25;
  sim.boxes = [{x:6,z:0,w:1,d:60,h:6,material:'concrete'}];
  tickBrain(sim,bot,.5);
  assert.ok(Math.abs(bot.yaw) > .5);
  assert.deepEqual(brain.alertPoint,cue);
  assert.equal(brain.sighted,-1);
  assert.equal(sim.shots.length,0);
});

test('bots aim at a visible head above cover and reacquire without restarting the full reaction delay', () => {
  const { sim, bot, brain } = scene();
  sim.player.z=-12; sim.player.hp=10000;
  sim.boxes=[{x:0,z:-10,w:8,d:1,h:1.5,material:'concrete'}];
  const exposed=visibleTargetPoint(sim,bot,sim.player);
  assert.ok(exposed && exposed.y>1.5);
  brain.perceive(sim,bot);
  assert.deepEqual(brain.aimPoint,exposed);
  tickBrain(sim,bot,1.5);
  assert.ok(sim.shots.length>0);
  // Briefly duck out of sight and return to the same corner.
  sim.player.crouch=true;
  brain.perceive(sim,bot);
  assert.equal(brain.sighted,-1);
  sim.elapsed+=.1; sim.player.crouch=false;
  brain.perceive(sim,bot);
  assert.equal(brain.sighted,sim.player.id);
  assert.ok(bot.reaction<=.12);
});

test('empty magazines require a full reload before the next burst', () => {
  const { sim, bot, brain } = scene();
  brain.ammo = 0;
  sim.botStep(bot, dt);
  assert.equal(brain.reloadLeft, weapons[brain.weapon].reload);
  tickBrain(sim, bot, weapons[brain.weapon].reload - .1);
  assert.equal(brain.ammo, 0);
  assert.equal(sim.shots.length, 0);
  tickBrain(sim, bot, .12);
  assert.ok(brain.ammo > 0);
});

test('sprint exhaustion waits for the same stamina recovery as a player', () => {
  const { sim, bot, brain } = scene();
  sim.player.hp = 0;
  brain.goal = { x: 0, z: -30 }; brain.goalUntil = 99; brain.decideIn = 99;
  sim.nav.route = () => [{ x: 0, z: -30 }];
  brain.stamina = .01; brain.jumpIn = brain.slideIn = 99;
  sim.botStep(bot, dt);
  assert.equal(brain.exhausted, true);
  assert.equal(bot.motion.sprinting, false);
  tickBrain(sim, bot, 1);
  assert.equal(brain.exhausted, true);
  assert.ok(brain.stamina < sprintRecovery.restartStamina);
});

test('a slide is fast, collides with cover, and cannot immediately retrigger', () => {
  const { sim, bot, brain } = scene();
  sim.player.hp = 0;
  brain.goal = { x: 0, z: -30 }; brain.goalUntil = 99; brain.decideIn = 99;
  sim.nav.route = () => [{ x: 0, z: -30 }];
  brain.vz = -7; brain.mobility = 1; brain.slideIn = 0; brain.jumpIn = 99;
  sim.botStep(bot, dt);
  assert.ok(bot.motion.sliding && bot.crouch);
  assert.ok(bot.moving > 10);
  sim.boxes = [{ x: 0, z: -2, w: 8, d: 1, h: 5, material: 'concrete' }];
  tickBrain(sim, bot, .5);
  assert.ok(clearAt(sim.boxes, bot.x, bot.z));
  assert.ok(bot.z > -1.11);
  assert.equal(brain.slideLeft, 0);
  assert.ok(brain.slideIn > 2);
});

test('evasive jump uses player gravity, lands, and respawn clears all movement and perception', () => {
  const { sim, bot, brain } = scene();
  sim.player.hp = 0;
  bot.lastDamage = sim.elapsed;
  brain.memory = { id: -1, point: { x: 0, y: 1.2, z: -10 }, expires: 99 };
  brain.goal = { x: 0, z: -30 }; brain.goalUntil = 99; brain.decideIn = 99;
  sim.nav.route = () => [{ x: 0, z: -30 }];
  brain.vz = -5; brain.mobility = 1; brain.jumpIn = 0; brain.slideIn = 99;
  sim.botStep(bot, dt);
  assert.ok(bot.y > 0 && bot.vy > 0);
  tickBrain(sim, bot, .65);
  assert.equal(bot.y, 0);
  assert.ok(brain.jumpIn > 0);
  brain.reloadLeft = 1; brain.slideLeft = .4;
  sim.respawn(bot);
  assert.equal(brain.vz, 0); assert.equal(brain.slideLeft, 0); assert.equal(brain.reloadLeft, 0);
  assert.equal(brain.memory, null); assert.equal(brain.stamina, 100); assert.equal(bot.crouch, false);
});

test('full-body poses blend crouch, slide, airborne legs and landing without scaling the actor', () => {
  const { bot } = scene(), motion = new ActorAnimation(bot.id);
  const standing = motion.step(dt, bot);
  bot.crouch = true; bot.moving = 11;
  bot.motion = { vx: 0, vz: -11, pitch: 0, sliding: true, sprinting: false, reloading: false, weapon: 'rifle', firing: false };
  let sliding;
  for (let i = 0; i < 30; i++) sliding = motion.step(dt, bot);
  assert.ok(sliding.hipsY < standing.hipsY - .3);
  assert.notEqual(sliding.legs[0].knee, sliding.legs[1].knee);
  bot.crouch = false; bot.motion.sliding = false; bot.y = .6; bot.vy = -4;
  for (let i = 0; i < 10; i++) motion.step(dt, bot);
  bot.y = 0; bot.vy = 0;
  motion.step(dt, bot);
  assert.ok(motion.landing > 0);
  bot.moving = 0; bot.motion.vx = bot.motion.vz = 0;
  for (let i = 0; i < 120; i++) motion.step(dt, bot);
  const phase = motion.phase;
  motion.step(dt, bot);
  assert.ok(Math.abs(motion.phase - phase) < 1e-8, 'stationary feet still walk');
});

test('crouch and slide keep the rendered feet above the floor and the head inside the hit volume', () => {
  const { sim, bot } = scene();
  const renderer = Object.create(ArenaRenderer.prototype);
  Object.assign(renderer, { game: sim, scene: new Scene(), materials: new Map() });
  for (const sliding of [false, true]) {
    const actor = { ...bot, crouch: true, motion: { vx: 0, vz: 0, pitch: 0, sprinting: false, sliding, reloading: false, firing: false, weapon: 'rifle' } };
    const rig = renderer.actor(actor);
    for (let i = 0; i < 100; i++) renderer.updateActor(rig, actor, dt);
    rig.root.updateMatrixWorld(true);
    assert.equal(rig.root.scale.y, 1);
    for (const foot of rig.feet) assert.ok(new Box3().setFromObject(foot).min.y >= -.025, 'foot sinks below floor');
    const headY = rig.head.getWorldPosition(new Vector3()).y;
    assert.ok(headY > 1.4 * .67 && headY < 1.84 * .67, 'head is outside the crouching hitbox');
  }
});

for (const mapId of ['citadel', 'depot', 'underpass']) {
  test(`${mapId}: a full practice match has varied movement and combat without wall clipping`, () => {
    const sim = new Simulation({ mode: 'practice', mapId, team: '1v1', balance: 0, rate: 0 }, seeded(32));
    const observed = new Set(), travelled = new Map(), last = new Map();
    sim.start();
    for (let frame = 0; frame < 60 * 45; frame++) {
      sim.step(dt, idleInput());
      for (const bot of sim.actors.slice(1)) {
        assert.ok([bot.x, bot.y, bot.z, bot.yaw, bot.moving].every(Number.isFinite));
        assert.ok(clearAt(sim.boxes, bot.x, bot.z), `actor ${bot.id} entered a wall`);
        const prior = last.get(bot.id);
        if (prior && bot.hp > 0 && prior.hp > 0) {
          assert.ok(Math.hypot(bot.x - prior.x, bot.z - prior.z) <= 14 * dt + 1e-8, 'teleported instead of moving');
          travelled.set(bot.id, (travelled.get(bot.id) ?? 0) + Math.hypot(bot.x - prior.x, bot.z - prior.z));
        }
        last.set(bot.id, { x: bot.x, z: bot.z, hp: bot.hp });
        if (bot.motion?.sprinting) observed.add('sprint');
        if (bot.motion?.sliding) observed.add('slide');
        if (bot.y > .15) observed.add('jump');
        if (bot.motion?.reloading) observed.add('reload');
        if (bot.kills) observed.add('kill');
      }
      sim.events = [];
    }
    for (const action of ['sprint', 'slide', 'jump', 'reload', 'kill']) assert.ok(observed.has(action), `never observed ${action}`);
    for (const bot of sim.actors.slice(1)) assert.ok(travelled.get(bot.id) > 20, `actor ${bot.id} barely moved`);
  });
}
