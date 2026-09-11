import { clamp, type Actor } from './simulation.ts';
import { angleDelta } from './bot-controller.ts';

/** Distance-driven gait with independent upper body aim and lower body movement. */
export class ActorAnimation {
  phase: number;
  speed = 0;
  crouch = 0;
  slide = 0;
  sprint = 0;
  airborne = 0;
  landing = 0;
  reload = 0;
  recoil = 0;
  bodyYaw: number;
  wasGrounded = true;
  previousVy = 0;

  constructor(id: number, yaw = 0) { this.phase = id * 2.399; this.bodyYaw = yaw; }

  step(dt: number, actor: Actor) {
    dt = clamp(dt, 0, .05);
    const blend = 1 - Math.exp(-dt * 14), motion = actor.motion;
    const grounded = actor.y < .005 && actor.vy <= 0;
    this.speed += (actor.moving - this.speed) * blend;
    this.crouch += (Number(actor.crouch) - this.crouch) * blend;
    this.slide += (Number(motion?.sliding ?? false) - this.slide) * blend;
    this.sprint += (Number(motion?.sprinting ?? actor.moving > 5.5) - this.sprint) * blend;
    this.airborne += (Number(!grounded) - this.airborne) * blend;
    this.reload += (Number(motion?.reloading ?? false) - this.reload) * blend;
    if (grounded && !this.wasGrounded) this.landing = clamp(Math.abs(this.previousVy) / 12, .15, .45);
    this.landing *= Math.exp(-dt * 12);
    this.wasGrounded = grounded; this.previousVy = actor.vy;
    this.recoil = motion?.firing ? .065 : this.recoil * Math.exp(-dt * 22);
    const vx = motion?.vx ?? -Math.sin(actor.yaw) * actor.moving;
    const vz = motion?.vz ?? -Math.cos(actor.yaw) * actor.moving;
    const travel = Math.hypot(vx, vz) > .3 ? Math.atan2(-vx, -vz) : actor.yaw;
    let offset = angleDelta(actor.yaw, travel);
    // Backpedalling keeps the chest toward the fight; hips lead a sidestep slightly.
    if (Math.abs(offset) > Math.PI / 2) offset -= Math.sign(offset) * Math.PI;
    const desiredBody = actor.yaw + clamp(offset, -.55, .55) * (1 - this.slide);
    this.bodyYaw += angleDelta(this.bodyYaw, desiredBody) * (1 - Math.exp(-dt * 12));
    this.phase += this.speed * dt * (2.6 - this.sprint * .6) * (1 - this.airborne) * (1 - this.slide);
    const forward = (-Math.sin(actor.yaw) * vx - Math.cos(actor.yaw) * vz) / Math.max(1, this.speed);
    const sideways = (Math.cos(actor.yaw) * vx - Math.sin(actor.yaw) * vz) / Math.max(1, this.speed);
    const stride = clamp(this.speed / 5, 0, 1) * (1 - this.airborne) * (1 - this.slide) * (1 - this.crouch * .45);
    const swing = Math.sin(this.phase) * .6 * stride;
    const stepHeight = Math.abs(Math.sin(this.phase)) * .025 * stride;
    const legs = [-1, 1].map((side, i) => {
      const cycle = swing * side;
      return {
        hip: cycle * forward + this.crouch * 1.08 + this.airborne * (i ? .7 : .35) + this.slide * (i ? .57 : .32),
        knee: -Math.max(0, cycle * forward) * 1.25 - this.crouch * 1.86 - this.airborne * (i ? 1.15 : .7) + this.slide * (i ? .7 : .95),
        side: -cycle * sideways * .65 + this.slide * side * .15,
      };
    });
    return {
      bodyYaw: this.bodyYaw,
      aimYaw: clamp(angleDelta(this.bodyYaw, actor.yaw), -.85, .85),
      pitch: clamp(motion?.pitch ?? 0, -.75, .75),
      hipsY: .89 - this.crouch * .34 - this.slide * .04 - this.landing * .17 + stepHeight,
      lean: -this.sprint * .14 + this.slide * .27,
      roll: -sideways * .07 * stride,
      bob: stepHeight,
      legs,
      arms: swing * .1 * this.sprint,
      reload: this.reload,
      recoil: this.recoil,
      slide: this.slide,
      crouch: this.crouch,
    };
  }
}
