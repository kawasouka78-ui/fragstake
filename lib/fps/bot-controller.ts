import {
  clamp, clearAt, direction, moveActor, sprintRecovery, visible, weapons,
  type Actor, type Simulation, type Vec, type WeaponId,
} from './simulation.ts';
import { botSkills, sampleSkill, type BotDifficulty, type BotSkill } from './bot-skills.ts';

type Point = { x: number; z: number };
type Observation = { id: number; point: Vec; expires: number };
export type BotIntent = 'patrol' | 'investigate' | 'engage' | 'flank' | 'cover';

export const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
export function turnToward(from: number, to: number, dt: number, rate = 4.4) {
  const delta = angleDelta(from, to);
  return from + clamp(delta * (1 - Math.exp(-9 * dt)), -rate * dt, rate * dt);
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

export const botAwareness = { sightRange: 110, closeRange: 5, trackingGrace: .85 } as const;

/** Use the exposed body part both for noticing a player and for aiming around cover. */
export function visibleTargetPoint(sim: Simulation, observer: Actor, target: Actor): Vec | null {
  const eye = sim.eye(observer), scale = target.crouch ? .67 : 1;
  const head = { x: target.x, y: target.y + 1.58 * scale, z: target.z };
  const chest = { x: target.x, y: target.y + 1.18 * scale, z: target.z };
  const probes = sim.config.weaponRule === 'headshots' ? [head] : [chest, head];
  const side = direction(observer.yaw + Math.PI / 2);
  for (const sign of [-1, 1]) probes.push({
    x: target.x + side.x * sign * .19,
    y: sim.config.weaponRule === 'headshots' ? head.y : chest.y,
    z: target.z + side.z * sign * .19,
  });
  return probes.find(point => visible(sim.boxes, eye, point)) ?? null;
}

/** Swept navigation clearance, including the actor's radius, rather than a sight ray. */
export function walkableSegment(sim: Simulation, a: Point, b: Point) {
  const steps = Math.max(1, Math.ceil(distance(a, b) / .3));
  for (let i = 1; i <= steps; i++) {
    if (!clearAt(sim.boxes, a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps, .45)) return false;
  }
  return true;
}

/** One persistent decision maker per opponent. Hidden players never become navigation targets. */
export class BotController {
  readonly difficulty: BotDifficulty;
  readonly skill: BotSkill;
  intent: BotIntent = 'patrol';
  weapon: WeaponId;
  ammo: number;
  reloadLeft = 0;
  memory: Observation | null = null;
  sighted = -1;
  goal: Point | null = null;
  goalUntil = 0;
  senseIn = 0;
  decideIn = 0;
  heardAt = -99;
  lastVisualAt = -99;
  alertPoint: Vec | null = null;
  alertUntil = 0;
  attackerId = -1;
  attackedUntil = 0;
  scanIn = 1.5;
  scanLeft = 0;
  scanSide = 1;
  scanOffset = 0;
  trackedVelocity: Point = { x: 0, z: 0 };
  settledAim = 0;
  vx = 0;
  vz = 0;
  pitch = 0;
  aimPoint: Vec | null = null;
  aimErrorX = 0;
  aimErrorY = 0;
  strafe = 1;
  strafeIn = 0;
  burst = 0;
  burstPause = 0;
  steadyLeft = 0;
  crouchLeft = 0;
  jumpIn: number;
  slideIn: number;
  slideLeft = 0;
  slideSpeed = 0;
  slideX = 0;
  slideZ = 0;
  stamina = 100;
  exhausted = false;
  recovery = 0;
  stuck = 0;
  escapeLeft = 0;
  escapeSide = 1;
  stepDistance = 0;
  corridorIn = 0;
  openAhead = false;
  aggression: number;
  mobility: number;
  turnRate: number;
  reactionTime: number;
  preferredRange: number;
  phase: number;

  constructor(sim: Simulation, actor: Actor, difficulty = sim.botSkills.get(actor.id) ?? 'pro') {
    this.difficulty = difficulty;
    this.skill = botSkills[difficulty];
    const pool = sim.allowedWeapons;
    this.weapon = pool[(actor.id - 1) % pool.length] ?? 'rifle';
    this.ammo = weapons[this.weapon].mag;
    this.aggression = sampleSkill(this.skill.aggression, sim.rng);
    this.mobility = sampleSkill(this.skill.mobility, sim.rng);
    this.turnRate = sampleSkill(this.skill.turnRate, sim.rng);
    this.reactionTime = sampleSkill(this.skill.reaction, sim.rng);
    this.preferredRange = this.weapon === 'shotgun' ? 6 : this.weapon === 'marksman' ? 25 : ['smg', 'vector'].includes(this.weapon) ? 10 : 16;
    this.phase = actor.id * 2.399 + sim.rng();
    this.jumpIn = 1.4 + sim.rng() * 3;
    this.slideIn = 1 + sim.rng() * 2.5;
    this.senseIn = actor.id * .013;
    this.strafe = sim.rng() < .5 ? -1 : 1;
  }

  reset(actor: Actor) {
    this.memory = this.goal = this.aimPoint = null;
    this.alertPoint = null;
    this.lastVisualAt = this.heardAt = -99;
    this.alertUntil = this.attackedUntil = this.scanLeft = this.scanOffset = this.settledAim = 0;
    this.attackerId = -1;
    this.trackedVelocity = { x: 0, z: 0 };
    this.scanIn = 1.5;
    this.sighted = -1;
    this.intent = 'patrol';
    this.vx = this.vz = this.pitch = this.slideLeft = this.reloadLeft = this.stuck = this.escapeLeft = 0;
    this.senseIn = this.decideIn = this.goalUntil = this.crouchLeft = this.burst = this.burstPause = this.steadyLeft = 0;
    this.stamina = 100;
    this.exhausted = false;
    this.recovery = 0;
    this.corridorIn = this.stepDistance = 0;
    this.openAhead = false;
    this.jumpIn = 1.5;
    this.slideIn = 2;
    this.ammo = weapons[this.weapon].mag;
    actor.target = -1;
    actor.crouch = false;
    actor.moving = 0;
    actor.motion = undefined;
  }

  hear(sim: Simulation, actor: Actor, source: Actor, range: number) {
    if (source.team === actor.team || this.sighted >= 0 || sim.elapsed - this.heardAt < .65 || distance(actor, source) > range) return;
    // An occluded sound only gives an approximate place to investigate.
    if (!visible(sim.boxes, sim.eye(actor), sim.eye(source)) && distance(actor, source) > range * .6) return;
    this.heardAt = sim.elapsed;
    this.memory = {
      id: -1,
      point: { x: source.x + (sim.rng() - .5) * 4, y: 1.3, z: source.z + (sim.rng() - .5) * 4 },
      expires: sim.elapsed + 3,
    };
    this.alertPoint = { ...this.memory.point };
    this.alertUntil = sim.elapsed + 1.1;
    this.decideIn = 0;
  }

  onDamage(sim: Simulation, actor: Actor, source: Actor) {
    this.attackerId = source.id;
    this.attackedUntil = sim.elapsed + 2.5;
    // A hit reveals a direction, not a live position that follows someone behind walls.
    this.alertPoint = { x: source.x + (sim.rng() - .5) * 2, y: sim.eye(source).y, z: source.z + (sim.rng() - .5) * 2 };
    this.alertUntil = sim.elapsed + 1.2;
    if (this.sighted !== source.id && (this.sighted < 0 || distance(actor, source) < 12)) {
      this.memory = { id: -1, point: { ...this.alertPoint }, expires: sim.elapsed + 3 };
      this.sighted = actor.target = -1;
      this.goalUntil = 0;
    }
    this.senseIn = this.decideIn = 0;
  }

  perceive(sim: Simulation, actor: Actor) {
    const forward = direction(actor.yaw);
    let best: Actor | undefined, bestPoint: Vec | null = null, bestScore = -Infinity;
    for (const candidate of sim.actors) {
      if (candidate.hp <= 0 || candidate.team === actor.team) continue;
      const d = distance(actor, candidate);
      if (d > botAwareness.sightRange) continue;
      const dot = ((candidate.x - actor.x) * forward.x + (candidate.z - actor.z) * forward.z) / Math.max(.001, d);
      const tracking = candidate.id === this.memory?.id && sim.elapsed - this.lastVisualAt < botAwareness.trackingGrace;
      const halfFov = tracking ? 2.6 : d < 18 ? 1.85 : d < 45 ? 1.5 : 1.3;
      if (d > botAwareness.closeRange && dot < Math.cos(halfFov)) continue;
      let point = visibleTargetPoint(sim, actor, candidate);
      if (!point) continue;
      // Skilled opponents raise their aim once settled, but only at an exposed head.
      if (this.difficulty !== 'easy' && this.settledAim > .35 && d < 42) {
        const head = { x: candidate.x, y: candidate.y + 1.58 * (candidate.crouch ? .67 : 1), z: candidate.z };
        if (visible(sim.boxes, sim.eye(actor), head)) point = head;
      }
      const score = 100 / (1 + d * .08) + (candidate.id === this.sighted ? 13 : 0) + (d < 7 ? 32 : 0) + (candidate.id === this.attackerId && sim.elapsed < this.attackedUntil ? 24 : 0);
      if (score > bestScore) { best = candidate; bestPoint = point; bestScore = score; }
    }
    if (best && bestPoint) {
      const reacquiring = this.memory?.id === best.id && sim.elapsed - this.lastVisualAt < botAwareness.trackingGrace;
      if (best.id !== this.sighted) {
        actor.reaction = reacquiring ? Math.min(actor.reaction, .12) : this.reactionTime + Math.max(0, distance(actor, best) - 45) * .002;
        this.burst = 0;
        this.settledAim = 0;
        this.steadyLeft = Math.max(this.steadyLeft, actor.reaction + .25);
        this.trackedVelocity = { x: 0, z: 0 };
        if (distance(actor, best) < 9 && actor.hp >= this.skill.coverHealth && !this.reloadLeft) this.goalUntil = 0;
        this.decideIn = 0;
      }
      // Estimate motion from two actual sightings; never read a hidden target's velocity.
      const sinceSeen = sim.elapsed - this.lastVisualAt;
      if (this.memory?.id === best.id && sinceSeen > .03 && sinceSeen < .4) {
        this.trackedVelocity.x += (clamp((bestPoint.x - this.memory.point.x) / sinceSeen, -12, 12) - this.trackedVelocity.x) * .6;
        this.trackedVelocity.z += (clamp((bestPoint.z - this.memory.point.z) / sinceSeen, -12, 12) - this.trackedVelocity.z) * .6;
      }
      this.sighted = actor.target = best.id;
      this.memory = { id: best.id, point: { ...bestPoint }, expires: sim.elapsed + this.skill.memory };
      this.lastVisualAt = sim.elapsed;
      // Observations arrive at human reaction intervals; aim cannot follow every input frame.
      this.aimPoint = { ...this.memory.point };
      const error = this.skill.aimError * (1 - this.settledAim * .45);
      this.aimErrorX += ((sim.rng() - .5) * error * 2 - this.aimErrorX) * .55;
      this.aimErrorY += ((sim.rng() - .5) * error - this.aimErrorY) * .55;
    } else {
      if (this.sighted >= 0) { this.decideIn = 0; actor.repath = 0; }
      this.sighted = actor.target = -1;
      if (this.memory && this.memory.expires <= sim.elapsed) this.memory = null;
      for (const candidate of sim.actors) {
        if (candidate.hp > 0 && candidate.y === 0 && candidate.moving > 2.8 && !candidate.crouch) {
          this.hear(sim, actor, candidate, candidate.motion?.sprinting ? 14 : 8);
        }
      }
    }
    this.senseIn = sampleSkill(this.skill.sense, sim.rng);
  }

  setGoal(actor: Actor, point: Point, intent: BotIntent, until: number) {
    if (!this.goal || distance(this.goal, point) > 1.5) { actor.path = []; actor.repath = 0; }
    this.goal = { x: point.x, z: point.z };
    this.intent = intent;
    this.goalUntil = until;
  }

  findCover(sim: Simulation, actor: Actor): Point | null {
    if (!this.memory) return null;
    const threat = this.memory.point;
    let result: Point | null = null, best = -Infinity;
    // Local cover probes are staggered with decisions, never run for every animation frame.
    for (const radius of [3, 6, 9]) for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + this.phase;
      const point = { x: actor.x + Math.cos(angle) * radius, z: actor.z + Math.sin(angle) * radius };
      if (Math.abs(point.x) > sim.map.width / 2 - 1 || Math.abs(point.z) > sim.map.depth / 2 - 1 || !clearAt(sim.boxes, point.x, point.z, .6)) continue;
      if (visible(sim.boxes, threat, { ...point, y: .95 })) continue;
      if (!walkableSegment(sim, actor, point)) continue;
      const score = distance(point, threat) * .3 - radius + sim.rng();
      if (score > best) { result = point; best = score; }
    }
    return result;
  }

  decide(sim: Simulation, actor: Actor) {
    this.decideIn = sampleSkill(this.skill.decision, sim.rng);
    if (this.goal && sim.elapsed < this.goalUntil && (this.intent === 'cover' || this.intent === 'flank')) return;
    const seen = this.sighted >= 0;
    if (this.memory && (actor.hp < this.skill.coverHealth || this.reloadLeft > 0)) {
      const cover = this.findCover(sim, actor);
      if (cover) { this.setGoal(actor, cover, 'cover', sim.elapsed + 2.4); return; }
    }
    if (seen && this.memory) {
      if (distance(actor, this.memory.point) > 10 && sim.rng() < this.aggression * this.skill.flankChance) {
        const away = Math.atan2(actor.z - this.memory.point.z, actor.x - this.memory.point.x) + this.strafe * .85;
        const point = { x: this.memory.point.x + Math.cos(away) * this.preferredRange, z: this.memory.point.z + Math.sin(away) * this.preferredRange };
        if (Math.abs(point.x) < sim.map.width / 2 - 1 && Math.abs(point.z) < sim.map.depth / 2 - 1 && clearAt(sim.boxes, point.x, point.z, .6)) {
          this.setGoal(actor, point, 'flank', sim.elapsed + 2.2); return;
        }
      }
      this.intent = 'engage'; this.goal = null; actor.path = [];
    } else if (this.memory) {
      if (distance(actor, this.memory.point) < 1.4) {
        this.memory = null; this.goal = null;
      } else {
        this.setGoal(actor, this.memory.point, 'investigate', sim.elapsed + 1); return;
      }
    }
    if (!seen && (!this.goal || distance(actor, this.goal) < 1.5 || sim.elapsed > this.goalUntil)) {
      const places = [...sim.map.landmarks, ...sim.map.spawns];
      const candidates = places.filter(p => distance(actor, p) > 8 && clearAt(sim.boxes, p.x, p.z, .55));
      const pool = candidates.length ? candidates : sim.map.spawns;
      const point = pool[Math.min(pool.length - 1, Math.floor(sim.rng() * pool.length))];
      if (point) this.setGoal(actor, point, 'patrol', sim.elapsed + 14);
    }
  }

  navigate(sim: Simulation, actor: Actor): Point {
    if (!this.goal || distance(actor, this.goal) < .65) return { x: 0, z: 0 };
    if (actor.repath <= 0) {
      actor.path = sim.nav.route(actor, this.goal);
      actor.repath = .9 + sim.rng() * .65;
    }
    while (actor.path.length && distance(actor, actor.path[0]) < .65) actor.path.shift();
    // Skip grid corners only when the full body fits through the shortcut.
    if (actor.path.length > 1 && this.corridorIn === 0) {
      const ahead = Math.min(5, actor.path.length - 1);
      for (let i = ahead; i > 0; i--) if (walkableSegment(sim, actor, actor.path[i])) { actor.path.splice(0, i); break; }
    }
    const next = actor.path[0];
    if (!next) return { x: 0, z: 0 };
    const length = Math.max(.001, distance(actor, next));
    return { x: (next.x - actor.x) / length, z: (next.z - actor.z) / length };
  }

  step(sim: Simulation, actor: Actor, dt: number) {
    if (dt <= 0 || actor.hp <= 0 || sim.paused || sim.ended) return;
    for (const key of ['senseIn', 'decideIn', 'strafeIn', 'burstPause', 'steadyLeft', 'crouchLeft', 'jumpIn', 'slideIn', 'escapeLeft', 'recovery', 'corridorIn', 'scanIn', 'scanLeft'] as const) this[key] = Math.max(0, this[key] - dt);
    actor.cooldown = Math.max(0, actor.cooldown - dt);
    actor.reaction = Math.max(0, actor.reaction - dt);
    actor.repath -= dt;
    if (this.reloadLeft > 0) {
      this.reloadLeft = Math.max(0, this.reloadLeft - dt);
      if (this.reloadLeft === 0) this.ammo = weapons[this.weapon].mag;
    }
    if (this.senseIn === 0) this.perceive(sim, actor);
    if (this.decideIn === 0) this.decide(sim, actor);
    const target = this.sighted < 0 ? undefined : sim.actors.find(a => a.id === this.sighted && a.hp > 0 && a.team !== actor.team);
    const combat = !!target && !!this.memory;
    const range = this.memory ? distance(actor, this.memory.point) : Infinity;
    const damaged = sim.elapsed - actor.lastDamage < 1.2;
    if (this.scanIn === 0 && !combat) {
      this.scanSide *= -1;
      this.scanLeft = .55 + sim.rng() * .35;
      this.scanIn = 2 + sim.rng() * 2;
    }
    this.scanOffset += ((this.scanLeft > 0 && !combat ? this.scanSide * .65 : 0) - this.scanOffset) * (1 - Math.exp(-dt * 7));
    if (this.strafeIn === 0) {
      this.strafe = sim.rng() < .72 ? -this.strafe : this.strafe;
      this.strafeIn = .65 + sim.rng() * 1.15;
      this.steadyLeft = Math.max(this.steadyLeft, combat && sim.rng() < (range > 28 ? .8 : .45) ? .18 + sim.rng() * (range > 28 ? .45 : .18) : 0);
      if (combat && range > 12 && sim.rng() < .22) this.crouchLeft = .4 + sim.rng() * .55;
    }
    if (!this.reloadLeft && (this.ammo === 0 || (!combat && this.ammo < weapons[this.weapon].mag * .4))) {
      this.reloadLeft = weapons[this.weapon].reload;
      this.burst = 0;
      this.decideIn = 0;
    }

    let move: Point;
    if (combat && this.intent === 'engage' && this.memory) {
      const dx = (this.memory.point.x - actor.x) / Math.max(.001, range), dz = (this.memory.point.z - actor.z) / Math.max(.001, range);
      const approach = this.steadyLeft > 0 && range > 7 ? 0 : range > this.preferredRange + 3 ? .85 : range < this.preferredRange * .55 || this.reloadLeft > 0 ? -.7 : .05;
      const side = this.steadyLeft > 0 ? 0 : this.strafe * (.5 + this.mobility * .3);
      move = { x: dx * approach + dz * side, z: dz * approach - dx * side };
    } else move = this.navigate(sim, actor);
    // Personal space keeps a squad from marching through one another in a doorway.
    for (const other of sim.actors) if (other !== actor && other.hp > 0) {
      const d = distance(actor, other);
      if (d < 1.15 && d > .001) {
        move.x += (actor.x - other.x) / d * (1.15 - d) * 1.4;
        move.z += (actor.z - other.z) / d * (1.15 - d) * 1.4;
      }
    }
    if (this.escapeLeft > 0) {
      move = { x: Math.cos(actor.yaw) * this.escapeSide, z: -Math.sin(actor.yaw) * this.escapeSide };
    }
    let length = Math.hypot(move.x, move.z);
    if (length > 1) { move.x /= length; move.z /= length; length = 1; }
    const speedBefore = Math.hypot(this.vx, this.vz);
    const moving = length > .1;
    let desiredYaw = actor.yaw;
    let lookPoint = combat ? this.aimPoint : this.alertPoint && sim.elapsed < this.alertUntil ? this.alertPoint : this.memory && sim.elapsed - this.lastVisualAt < .7 ? this.memory.point : null;
    if (combat && lookPoint && actor.reaction === 0) {
      const lead = Math.min(.1, Math.max(0, sim.elapsed - this.lastVisualAt)) * this.skill.tracking;
      const predicted = { x: lookPoint.x + this.trackedVelocity.x * lead, y: lookPoint.y, z: lookPoint.z + this.trackedVelocity.z * lead };
      if (visible(sim.boxes, sim.eye(actor), predicted)) lookPoint = predicted;
    }
    // Start turning when someone is noticed. Reaction time gates the trigger, not awareness.
    if (lookPoint) desiredYaw = Math.atan2(actor.x - lookPoint.x, actor.z - lookPoint.z) + (combat ? this.aimErrorX : 0);
    else if (moving) desiredYaw = Math.atan2(-move.x, -move.z) + this.scanOffset;
    else desiredYaw += Math.sin(sim.elapsed * 1.6 + this.phase) * dt * .9;
    actor.yaw = turnToward(actor.yaw, desiredYaw, dt, this.turnRate);
    const desiredPitch = lookPoint ? Math.atan2(lookPoint.y - sim.eye(actor).y, Math.max(.1, distance(actor, lookPoint))) + (combat ? this.aimErrorY : 0) : 0;
    this.pitch += clamp((desiredPitch - this.pitch) * (1 - Math.exp(-7 * dt)), -1.8 * dt, 1.8 * dt);

    if (this.exhausted && this.recovery === 0 && this.stamina >= sprintRecovery.restartStamina) this.exhausted = false;
    const aligned = moving && Math.abs(angleDelta(actor.yaw, Math.atan2(-move.x, -move.z))) < .75;
    const wantsSprint = moving && aligned && (
      (!combat && !lookPoint && this.scanLeft === 0) ||
      (combat && range > weapons[this.weapon].range * .95 && this.steadyLeft === 0)
    );
    let sprinting = wantsSprint && !this.exhausted && this.crouchLeft === 0 && this.slideLeft === 0 && this.reloadLeft === 0;
    if (this.corridorIn === 0) {
      this.openAhead = moving && walkableSegment(sim, actor, { x: actor.x + move.x * 3.8, z: actor.z + move.z * 3.8 });
      this.corridorIn = .14;
    }
    const openAhead = this.openAhead;
    if (!openAhead && !combat) sprinting = false;
    if (this.slideIn === 0 && actor.y === 0 && speedBefore > 5 && openAhead && (damaged || this.intent === 'cover' || (combat && range < 23) || this.mobility > .7)) {
      this.slideLeft = .8;
      this.slideSpeed = Math.min(14, Math.max(11, speedBefore + 3.5));
      this.slideX = this.vx / speedBefore; this.slideZ = this.vz / speedBefore;
      this.slideIn = sampleSkill(this.skill.slideCooldown, sim.rng);
      this.crouchLeft = 0;
      sprinting = false;
    }
    const slideJump = this.slideLeft > 0 && this.slideLeft < .2 && this.jumpIn === 0 && combat && range < 18 && this.mobility > .6;
    const evasiveJump = (damaged && range < 24) || (combat && range < 12 && this.steadyLeft === 0);
    if (actor.y === 0 && this.jumpIn === 0 && openAhead && speedBefore > 2.7 && this.crouchLeft === 0 && (slideJump || (this.slideLeft === 0 && evasiveJump))) {
      actor.vy = 5.4;
      this.jumpIn = sampleSkill(this.skill.jumpCooldown, sim.rng);
      this.slideLeft = 0;
    }
    const sliding = this.slideLeft > 0;
    actor.crouch = sliding || (actor.y === 0 && actor.vy === 0 && (this.crouchLeft > 0 || (this.intent === 'cover' && !moving)));
    sprinting = sprinting && !actor.crouch;
    this.stamina = clamp(this.stamina + (sliding ? 0 : sprinting ? -sprintRecovery.drain : sprintRecovery.regen) * dt, 0, 100);
    if (this.stamina === 0 && !this.exhausted) { this.exhausted = true; this.recovery = sprintRecovery.cooldown; sprinting = false; }
    const speed = actor.crouch ? 2.35 : sprinting ? 7.5 : combat && this.steadyLeft > 0 ? 1 : combat ? 3.15 : 4.7;
    if (sliding) {
      this.slideSpeed = Math.max(0, this.slideSpeed - 7.2 * dt);
      this.vx = this.slideX * this.slideSpeed; this.vz = this.slideZ * this.slideSpeed;
    } else {
      const response = 1 - Math.exp(-dt * (actor.y > 0 || actor.vy > 0 ? 5 : 18));
      this.vx += (move.x * speed - this.vx) * response;
      this.vz += (move.z * speed - this.vz) * response;
    }
    const before = { x: actor.x, z: actor.z };
    moveActor(actor, this.vx * dt, this.vz * dt, sim.boxes);
    actor.moving = distance(before, actor) / dt;
    this.settledAim = clamp(this.settledAim + (combat && actor.moving < 1.5 && actor.y === 0 && !damaged ? dt * 1.4 : -dt * 3), 0, 1);
    if (sliding) {
      this.slideLeft = Math.max(0, this.slideLeft - dt);
      if (actor.moving < this.slideSpeed * .35 || actor.y > 0) this.slideLeft = 0;
    }
    this.stuck = moving && actor.moving < .65 ? this.stuck + dt : Math.max(0, this.stuck - dt * 2);
    if (this.stuck > .4) {
      this.escapeSide = this.strafe = -this.strafe;
      this.escapeLeft = .45;
      this.stuck = 0;
      actor.repath = 0; actor.path = [];
      if (this.intent === 'patrol') this.goalUntil = 0;
    }
    const wasAirborne = actor.y > 0;
    actor.vy -= 20 * dt;
    actor.y = Math.max(0, actor.y + actor.vy * dt);
    if (actor.y === 0) actor.vy = 0;
    actor.motion = { vx: (actor.x - before.x) / dt, vz: (actor.z - before.z) / dt, pitch: this.pitch, sprinting, sliding: this.slideLeft > 0, reloading: this.reloadLeft > 0, weapon: this.weapon, firing: false };
    if (actor.y === 0 && !actor.crouch && actor.moving > 1) {
      this.stepDistance += actor.moving * dt;
      if (this.stepDistance > (sprinting ? 2.1 : 1.7) || wasAirborne) {
        this.stepDistance = 0;
        const d = distance(actor, sim.player);
        if (d < 16) sim.events.push({ kind: 'footstep', distance: d + (visible(sim.boxes, sim.eye(actor), sim.eye(sim.player)) ? 0 : 5) });
      }
    }
    if (combat && target && !sprinting) this.shoot(sim, actor, target);
    for (const pickup of sim.pickups) if (pickup.ready === 0 && distance(actor, pickup) < 1.1 && pickup.kind === 'health' && actor.hp < 75) { actor.hp = Math.min(100, actor.hp + 45); pickup.ready = 18; }
  }

  shoot(sim: Simulation, actor: Actor, target: Actor) {
    if (!this.aimPoint || actor.reaction > 0 || actor.cooldown > 0 || this.reloadLeft > 0 || this.burstPause > 0 || this.ammo <= 0 || actor.shield > .8) return;
    const gun = weapons[this.weapon], d = distance(actor, target);
    if (d > gun.range || !visible(sim.boxes, sim.eye(actor), this.aimPoint) || !visibleTargetPoint(sim, actor, target)) return;
    const yawError = Math.abs(angleDelta(actor.yaw, Math.atan2(actor.x - this.aimPoint.x, actor.z - this.aimPoint.z)));
    if (yawError > .11 || Math.abs(this.pitch - Math.atan2(this.aimPoint.y - sim.eye(actor).y, Math.max(.1, d))) > .12) return;
    if (sim.actors.some(a => a !== actor && a.hp > 0 && a.team === actor.team && distance(a, actor) < d && Math.abs(angleDelta(actor.yaw, Math.atan2(actor.x - a.x, actor.z - a.z))) < .1)) return;
    if (this.burst === 0) this.burst = gun.auto ? 2 + Math.floor(sim.rng() * (d > 20 ? 3 : 5)) : 1;
    actor.shield = 0;
    actor.cooldown = gun.interval;
    this.ammo--;
    const spread = gun.spread * (actor.crouch ? .5 : .75) * (1 - this.settledAim * .75) + (actor.y > 0 ? .045 : 0) + (this.slideLeft > 0 ? .035 : 0) + this.skill.aimSpread * (1 - this.settledAim * .6);
    for (let i = 0; i < (this.weapon === 'shotgun' ? 8 : 1); i++) {
      if (sim.ended) break;
      sim.cast(actor, direction(actor.yaw + (sim.rng() - .5) * spread * 2, this.pitch + (sim.rng() - .5) * spread * 2), gun.damage, gun.head, gun.range);
    }
    if (actor.motion) actor.motion.firing = true;
    const listenerDistance = distance(actor, sim.player);
    if (listenerDistance < 28) sim.events.push({ kind: 'enemyShot', weapon: this.weapon, distance: listenerDistance });
    sim.notifyBotSound(actor, 32);
    this.burst--;
    if (this.burst <= 0) this.burstPause = sampleSkill(gun.auto ? this.skill.burstPause : this.skill.semiPause, sim.rng);
  }
}
