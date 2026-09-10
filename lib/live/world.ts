import {
  Simulation,
  idleInput,
  rayBox,
  wallDistance,
  visible,
  meleeTarget,
  direction,
  weapons,
  type Actor,
  type Vec,
  type Controls,
} from '../fps/simulation.ts';
import { parseInput, LIVE_TICK } from './protocol.ts';
import type { Ticket, LiveMode } from './security.ts';

// Reuse the tested movement, collision, slide, ammo and recoil rules on the server.
// Every human owns one simulation. No bot AI or browser result ever runs here.
class HumanSimulation extends Simulation {
  room?: LiveRoom;
  subject = '';
  override melee() { this.room?.melee(this.subject); }
  override cast(
    _attacker: Actor,
    dir: Vec,
    damage: number,
    headMultiplier: number,
    range: number,
  ) {
    this.room?.cast(this.subject, dir, damage, headMultiplier, range);
  }
  override finish() {} // The shared room alone ends the match.
}
export type Participant = {
  claims: Ticket;
  game: HumanSimulation;
  slot: number;
  seq: number;
  input: Controls;
  lastInput: number;
  connected: boolean;
  disconnectedAt: number;
  ready: boolean;
  left: boolean;
  seconds: number;
};
export class LiveRoom {
  id = crypto.randomUUID();
  players = new Map<string, Participant>();
  reservedSlots:Map<string,number>|null=null;
  inviteExpiresAt=0;
  status: 'waiting' | 'playing' | 'finished' = 'waiting';
  elapsed = 0;
  tick = 0;
  created = Date.now();
  endedAt = 0;
  score = [0, 0];
  feed: Simulation['feed'] = [];
  events: {
    tick: number;
    kind: string;
    actor: string;
    target?: string;
    head?: boolean;
  }[] = [];
  hadOpponents = false;
  mode: LiveMode;
  mapId: string;
  capacity: number;
  startAt = 0;
  constructor(mode: LiveMode, mapId: string) {
    this.mode = mode;
    this.mapId = mapId;
    this.capacity = mode === 'ffa' ? 10 : mode === '1v1' ? 2 : 4;
  }
  add(claims: Ticket) {
    if(this.reservedSlots&&!this.reservedSlots.has(claims.sub))throw new Error('This rematch is reserved for its original players.');
    if (
      this.status === 'finished' ||
      this.players.size >= this.capacity ||
      this.players.has(claims.sub) ||
      (this.status === 'playing' && this.mode !== 'ffa')
    )
      throw new Error('This match is full or already started.');
    const game = new HumanSimulation({
        mode: 'practice',
        mapId: this.mapId,
        team: '1v1',
        rate: 0,
        balance: 0,
      }),
      slot = this.reservedSlots?.get(claims.sub)??this.players.size;
    game.actors = game.actors.slice(0, 1);
    game.pickups = [];
    game.player.name = claims.name;
    game.player.team = this.mode === 'ffa' ? slot : slot % 2;
    const spawn =
      this.mode === 'ffa'
        ? game.map.spawns[
            Math.floor((slot * game.map.spawns.length) / this.capacity)
          ]
        : this.duelSpawns(game)[slot];
    Object.assign(game.player, { x: spawn.x, z: spawn.z, yaw: spawn.yaw });
    game.yaw = spawn.yaw;
    game.room = this;
    game.subject = claims.sub;
    const p: Participant = {
      claims,
      game,
      slot,
      seq: -1,
      input: idleInput(),
      lastInput: 0,
      connected: true,
      disconnectedAt: 0,
      ready: false,
      left: false,
      seconds: 0,
    };
    this.players.set(claims.sub, p);
    return p;
  }
  duelSpawns(game: HumanSimulation) {
    const options = [...game.map.spawns],
      distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
        Math.hypot(a.x - b.x, a.z - b.z),
      face = (from: { x: number; z: number }, to: { x: number; z: number }) =>
        Math.atan2(from.x - to.x, from.z - to.z),
      pairs = options
        .flatMap((a, i) =>
          options.slice(i + 1).map((b) => ({
            a,
            b,
            score:
              distance(a, b) -
              (visible(
                game.boxes,
                { x: a.x, y: 1.6, z: a.z },
                { x: b.x, y: 1.6, z: b.z },
              )
                ? 8
                : 0),
          })),
        )
        .sort((a, b) => b.score - a.score),
      home = pairs[0].a,
      rival = pairs[0].b,
      buddies = options.filter((s) => s !== home && s !== rival),
      ally =
        [...buddies].sort((a, b) => distance(a, home) - distance(b, home))[0] ??
        home,
      enemyBuddy =
        buddies
          .filter((s) => s !== ally)
          .sort((a, b) => distance(a, rival) - distance(b, rival))[0] ?? rival;
    return [
      { ...home, yaw: face(home, rival) },
      { ...rival, yaw: face(rival, home) },
      { ...ally, yaw: face(ally, rival) },
      { ...enemyBuddy, yaw: face(enemyBuddy, home) },
    ];
  }
  input(subject: string, value: unknown) {
    const p = this.players.get(subject);
    if (!p || !p.connected || p.left) return false;
    const frame = parseInput(value, p.seq);
    if (!frame) return false;
    p.seq = frame.seq;
    const firePressed = frame.controls.firePressed || p.input.firePressed;
    p.input = { ...frame.controls, firePressed };
    if (frame.controls.weapon) p.game.switchWeapon(frame.controls.weapon);
    p.game.yaw = frame.yaw;
    p.game.pitch = frame.pitch;
    p.lastInput = this.tick;
    return true;
  }
  ready(subject: string) {
    const p = this.players.get(subject);
    if (p && !p.left) {
      p.ready = true;
      p.game.start();
    }
  }
  leave(subject: string) {
    const p = this.players.get(subject);
    if (!p || p.left) return;
    p.left = true;
    p.connected = false;
    p.game.player.hp = 0;
    p.input = idleInput();
    this.events.push({ tick: this.tick, kind: 'leave', actor: subject });
    // Rebuild an incomplete group instead of trapping it with consumed slots.
    if (this.status === 'waiting') {
      this.finish();
      return;
    }
    if (this.status === 'playing' && this.mode !== 'ffa') {
      this.score[1 - p.game.player.team] = Math.max(
        10,
        this.score[p.game.player.team] + 1,
      );
      this.finish();
    }
  }
  step() {
    if (this.status === 'finished') return;
    this.tick++;
    const ready = [...this.players.values()].filter(
      (p) => p.ready && !p.left && p.connected,
    );
    if (this.status === 'waiting') {
      const enough =
        this.mode === 'ffa'
          ? ready.length >= 2
          : ready.length === this.capacity;
      if (enough) {
        this.status = 'playing';
        this.startAt = Date.now();
        this.hadOpponents = true;
      } else return;
    }
    this.elapsed += LIVE_TICK;
    for (const p of this.players.values()) {
      if (p.left) continue;
      const g = p.game;
      const input =
        p.connected && p.ready && this.tick - p.lastInput <= 15
          ? p.input
          : idleInput();
      if (p.ready) {
        g.start();
        g.step(LIVE_TICK, input);
        p.seconds += LIVE_TICK;
      }
      p.input.reload = false;
      p.input.firePressed = false;
      p.input.weapon = undefined;
      g.time = Math.max(0, 180 - this.elapsed);
    }
    this.feed = this.feed.filter((e) => e.age < 6);
    for (const e of this.feed) e.age += LIVE_TICK;
    if (
      this.elapsed >= 180 ||
      (this.mode !== 'ffa' && this.score.some((n) => n >= 10))
    )
      this.finish();
    if (![...this.players.values()].some((p) => !p.left)) this.finish();
  }
  finish() {
    if (this.status === 'finished') return;
    this.status = 'finished';
    this.endedAt = Date.now();
  }
  cast(
    subject: string,
    dir: Vec,
    amount: number,
    multiplier: number,
    range: number,
  ) {
    if (this.status !== 'playing') return;
    const shooter = this.players.get(subject)!;
    const g = shooter.game,
      from = g.eye(g.player);
    let distance = Math.min(range, wallDistance(g.boxes, from, dir)),
      victim: Participant | undefined,
      head = false;
    for (const p of this.players.values()) {
      const a = p.game.player;
      if (p === shooter || !p.ready || p.left || a.hp <= 0) continue;
      const scale = a.crouch ? 0.67 : 1;
      const body = rayBox(
        from,
        dir,
        { x: a.x - 0.32, y: a.y + 0.35, z: a.z - 0.26 },
        { x: a.x + 0.32, y: a.y + 1.4 * scale, z: a.z + 0.26 },
      );
      const skull = rayBox(
        from,
        dir,
        { x: a.x - 0.22, y: a.y + 1.4 * scale, z: a.z - 0.22 },
        { x: a.x + 0.22, y: a.y + 1.84 * scale, z: a.z + 0.22 },
      );
      if (Math.min(body, skull) < distance) {
        distance = Math.min(body, skull);
        victim = p;
        head = skull < body;
      }
    }
    const to = {
      x: from.x + dir.x * distance,
      y: from.y + dir.y * distance,
      z: from.z + dir.z * distance,
    };
    for (const p of this.players.values())
      p.game.shots.push({
        from,
        to,
        friendly: p.game.player.team === g.player.team,
        age: 0,
      });
    this.events.push({ tick: this.tick, kind: 'shot', actor: subject });
    if (
      !victim ||
      victim.game.player.shield > 0 ||
      victim.game.player.team === g.player.team
    )
      return;
    this.hit(shooter, victim, amount, multiplier, head);
  }
  melee(subject: string) {
    const shooter = this.players.get(subject);
    if (!shooter || this.status !== 'playing') return;
    const g = shooter.game;
    const targets = [...this.players.values()].filter(p => p !== shooter && p.ready && !p.left);
    const hit = meleeTarget(g.boxes, g.eye(g.player), direction(g.yaw, g.pitch), targets.map(p => p.game.player));
    if (!hit) return;
    const victim = targets.find(p => p.game.player === hit.actor)!;
    if (hit.actor.shield > 0 || hit.actor.team === g.player.team) return;
    this.hit(shooter, victim, weapons.knife.damage, 1, hit.head);
  }
  hit(shooter: Participant, victim: Participant, amount: number, multiplier: number, head: boolean) {
    const g = shooter.game, subject = shooter.claims.sub;
    const target = victim.game,
      a = target.player;
    a.hp = Math.max(0, a.hp - Math.round(amount * (head ? multiplier : 1)));
    a.lastDamage = target.elapsed;
    g.hitMarker = 0.17;
    g.headMarker = head;
    g.events.push({ kind: 'hit', head });
    target.hurt = 0.6;
    target.events.push({ kind: 'hurt' });
    if (a.hp > 0) return;
    a.deaths++;
    a.respawn = 2.4;
    target.combo = 0;
    g.player.kills++;
    g.combo++;
    g.maxStreak = Math.max(g.maxStreak, g.combo);
    if (head) g.headshots++;
    g.killConfirm = { id: this.tick, victim: a.name, head, age: 0 };
    g.events.push({ kind: 'kill', head });
    this.score[g.player.team % 2]++;
    this.feed.unshift({
      id: this.tick,
      killer: g.player.name,
      victim: a.name,
      head,
      you: false,
      age: 0,
    });
    this.feed = this.feed.slice(0, 5);
    this.events.push({
      tick: this.tick,
      kind: 'kill',
      actor: subject,
      target: victim.claims.sub,
      head,
    });
  }
  snapshot(subject: string) {
    const p = this.players.get(subject)!,
      g = p.game;
    const actor = (member: Participant, id: number) => ({
      ...member.game.player,
      id,
      path: [],
      hp: member.ready && !member.left ? member.game.player.hp : 0,
    });
    return {
      type: 'snapshot',
      won:
        this.status === 'finished' &&
        !p.left &&
        (this.mode === 'ffa'
          ? g.player.kills > 0 &&
            g.player.kills ===
              Math.max(
                ...[...this.players.values()].map((p) => p.game.player.kills),
              )
          : this.score[g.player.team] > this.score[1 - g.player.team]),
      room: this.id,
      status: this.status,
      cancelled: this.status === 'finished' && !this.hadOpponents,
      rematch: undefined as {ticket:string;expiresAt:number}|undefined,
      mode: this.mode,
      tick: this.tick,
      ack: p.seq,
      elapsed: this.elapsed,
      time: Math.max(0, 180 - this.elapsed),
      count: [...this.players.values()].filter((p) => !p.left).length,
      ready: [...this.players.values()].filter(
        (p) => p.ready && !p.left && p.connected,
      ).length,
      capacity: this.capacity,
      roster: [...this.players.values()].map((member) => ({
        slot: member.slot,
        name: member.claims.name,
        team: member.game.player.team,
        you: member === p,
        ready: member.ready,
        connected: member.connected,
        left: member.left,
      })),
      actors: [
        actor(p, 0),
        ...[...this.players.values()]
          .filter((a) => a !== p)
          .map((a, i) => actor(a, i + 1)),
      ],
      state: {
        weapon: g.weapon,
        matchWeapon: g.matchWeapon,
        ammo: g.ammo,
        reserve: g.reserve,
        reloadLeft: g.reloadLeft,
        shotCooldown: g.shotCooldown,
        switchLeft: g.switchLeft,
        aim: g.aim,
        recoil: g.recoil,
        bloom: g.bloom,
        stamina: g.stamina,
        sprintExhausted: g.sprintExhausted,
        sprintCooldown: g.sprintCooldown,
        sprinting: g.sprinting,
        slideLeft: g.slideLeft,
        playerEyeHeight: g.playerEyeHeight,
        hitMarker: g.hitMarker,
        headMarker: g.headMarker,
        hurt: g.hurt,
        combo: g.combo,
        headshots: g.headshots,
        maxStreak: g.maxStreak,
        killConfirm: g.killConfirm,
        vx: g.vx,
        vz: g.vz,
        shots: g.shots,
        feed: this.feed,
        score: this.score[g.player.team % 2],
        enemyScore: this.score[1 - (g.player.team % 2)],
      },
      events: g.events.splice(0),
    };
  }
  result() {
    return {
      id: this.id,
      mode: this.mode,
      mapId: this.mapId,
      startedAt: this.startAt,
      finishedAt: this.endedAt,
      duration: Math.round(this.elapsed),
      players: [...this.players.values()]
        .filter((p) => !p.claims.guest)
        .map((p) => ({
          id: p.claims.sub,
          kills: p.game.player.kills,
          deaths: p.game.player.deaths,
          headshots: p.game.headshots,
          maxStreak: p.game.maxStreak,
          seconds: Math.round(p.seconds),
          completed: !p.left && this.hadOpponents,
          won:
            !p.left &&
            (this.mode === 'ffa'
              ? p.game.player.kills > 0 &&
                p.game.player.kills ===
                  Math.max(
                    ...[...this.players.values()].map(
                      (p) => p.game.player.kills,
                    ),
                  )
              : this.score[p.game.player.team % 2] >
                this.score[1 - (p.game.player.team % 2)]),
        })),
    };
  }
}
export type Snapshot = ReturnType<LiveRoom['snapshot']>;
