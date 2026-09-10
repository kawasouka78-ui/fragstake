import {
  Simulation,
  idleInput,
  type Controls,
  type Actor,
  type WeaponId,
} from '../fps/simulation.ts';
import type { MatchConfig } from '../game-rules.ts';
import type { Snapshot } from './world.ts';
import { liveResultDetails } from './result.ts';
export class NetworkSimulation extends Simulation {
  socket: WebSocket | null = null;
  resumeToken = '';
  seq = 0;
  status = 'Connecting…';
  count = 1;
  capacity = 10;
  ping = 0;
  disposed = false;
  reconnecting = false;
  lastSnapshot = 0;
  nextInput = idleInput();
  latest: Snapshot | null = null;
  target: Actor[] = [];
  interval: ReturnType<typeof setInterval> | undefined;
  reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(config: MatchConfig) {
    super(config);
    this.pickups = [];
    this.actors.forEach((a) => (a.hp = 0));
  }
  async connect() {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.config.live!.url);
      this.socket = ws;
      let received = false;
      const timeout = setTimeout(() => {
        ws.close();
        reject(
          new Error('The game server did not respond. Try joining again.'),
        );
      }, 7000);
      ws.onopen = () =>
        this.send(
          this.resumeToken
            ? { type: 'resume', token: this.resumeToken }
            : { type: 'join', ticket: this.config.live!.ticket },
        );
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'welcome') {
          this.resumeToken = msg.resume;
          this.reconnecting = false;
        }
        if (msg.type === 'error') {
          this.status = msg.message;
          clearTimeout(timeout);
          reject(new Error(msg.message));
        }
        if (msg.type === 'pong')
          this.ping = Math.max(0, Math.round(performance.now() - msg.sent));
        if (msg.type === 'snapshot') {
          const s = msg as Snapshot;
          this.latest = s;
          this.lastSnapshot = performance.now();
          this.count = s.count;
          this.capacity = s.capacity;
          this.status =
            s.status === 'waiting'
              ? `Waiting for ready players · ${s.ready}/${s.mode === 'ffa' ? 2 : s.capacity}`
              : s.status === 'finished'
                ? 'Match complete'
                : 'Connected';
          this.target = s.actors;
          if (!received) {
            this.actors = this.actors.map((old, i) =>
              s.actors[i] ? { ...s.actors[i] } : { ...old, hp: 0 },
            );
            this.yaw = this.player.yaw;
            clearTimeout(timeout);
            received = true;
            resolve();
          }
          this.elapsed = s.elapsed;
          this.time = s.time;
          Object.assign(this, s.state);
          this.events.push(...s.events);
          if (s.status === 'finished') {
            this.end('Live match complete');
          }
        }
      };
      ws.onerror = () => {
        this.status = 'Connection interrupted';
      };
      ws.onclose = (e) => {
        clearTimeout(timeout);
        if (!received)
          reject(
            new Error(
              this.status === 'Connecting…'
                ? 'Unable to reach the game server.'
                : this.status,
            ),
          );
        if (this.disposed || this.ended) return;
        this.nextInput = idleInput();
        this.status = 'Reconnecting… Your player remains in the match.';
        if (this.resumeToken && e.code !== 4001 && e.code !== 4008) {
          this.reconnecting = true;
          this.reconnectTimer = setTimeout(() => {
            void this.connect().catch(() => {
              this.status = 'Disconnected. Leave and rejoin from Play.';
            });
          }, 1000);
        }
      };
      if (!this.interval)
        this.interval = setInterval(() => {
          if (this.disposed || this.ended) return;
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.flushInput();
            if (this.seq % 30 === 0)
              this.send({ type: 'ping', sent: performance.now() });
          }
          if (
            this.lastSnapshot &&
            performance.now() - this.lastSnapshot > 3000 &&
            this.status === 'Connected'
          )
            this.status = 'Connection delayed…';
        }, 1000 / 30);
    });
  }
  send(value: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(value));
  }
  flushInput() {
    this.send({type:'input',seq:++this.seq,yaw:Math.atan2(Math.sin(this.yaw),Math.cos(this.yaw)),pitch:this.pitch,controls:this.nextInput});
    this.nextInput.reload = false;
    this.nextInput.firePressed = false;
    this.nextInput.slide = false;
    this.nextInput.jump = false;
    this.nextInput.weapon = undefined;
  }
  updateView(dt: number) {
    const factor = 1 - Math.exp(-dt * 30);
    this.actors.forEach((a, i) => {
      const target = this.target[i];
      if (!target) {
        a.hp = 0;
        return;
      }
      const snap =
        Math.hypot(a.x - target.x, a.z - target.z) > 3 ||
        (a.hp <= 0 && target.hp > 0);
      const x = a.x,
        z = a.z,
        y = a.y;
      Object.assign(a, target);
      if (!snap) {
        a.x = x + (target.x - x) * factor;
        a.z = z + (target.z - z) * factor;
        a.y = y + (target.y - y) * factor;
      }
    });
  }
  override step(_dt: number, input: Controls) {
    this.nextInput = {
      ...input,
      firePressed: input.firePressed || this.nextInput.firePressed,
      reload: input.reload || this.nextInput.reload,
      slide: input.slide || this.nextInput.slide,
      jump: input.jump || this.nextInput.jump,
      weapon: input.weapon || this.nextInput.weapon,
    };
  }
  override start() {
    // Send the chosen loadout before ready locks the server's two weapon slots.
    this.flushInput();
    super.start();
    this.send({ type: 'ready' });
  }
  override pause() {
    super.pause();
    this.nextInput = idleInput();
    this.send({
      type: 'input',
      seq: ++this.seq,
      yaw: Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw)),
      pitch: this.pitch,
      controls: this.nextInput,
    });
  }
  override switchWeapon(id: WeaponId) {
    this.nextInput.weapon = id;
  }
  override leave() {
    this.send({ type: 'leave' });
    this.end(this.latest?.status === 'waiting' || !this.started ? 'Match cancelled' : 'Left live match');
  }
  end(reason: string) {
    if (this.ended) return;
    this.ended = true;
    const p = this.latest?.actors[0] || this.player;
    this.result = {
      live: true,
      liveGuest: this.config.live?.guest,
      kills: p.kills,
      deaths: p.deaths,
      balance: 0,
      reason,
      won: reason === 'Live match complete' && !!this.latest?.won,
      score: this.score,
      enemyScore: this.enemyScore,
      headshots: this.headshots,
      maxStreak: this.maxStreak,
      elapsed: this.elapsed,
      mode: 'practice',
      mapId: this.map.id,
      net: 0,
      liveMode: this.config.live?.mode,
      rematch:reason==='Live match complete'&&this.latest?.rematch&&this.config.live?{...this.config.live,...this.latest.rematch}:undefined,
      ...liveResultDetails(this.latest, reason === 'Live match complete'),
    };
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.interval);
    clearTimeout(this.reconnectTimer);
    this.socket?.close(1000, 'Leaving arena');
  }
}
