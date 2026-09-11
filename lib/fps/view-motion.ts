export type MotionSample = {
  speed: number;
  grounded: boolean;
  vy: number;
  crouch: boolean;
  sprinting: boolean;
  sliding: boolean;
  aim: number;
  reload: number;
  switching: boolean;
  kick: number;
  sightHeight: number;
  bobScale?: number;
};
const damp = (value: number, target: number, rate: number, dt: number) =>
  value + (target - value) * (1 - Math.exp(-rate * dt));
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Keep the actual render placement available to camera-clipping regression checks. */
export function viewmodelPose(
  pose: ReturnType<ViewMotion['step']>,
  knifeStyle?: 'standard' | 'karambit',
) {
  if (knifeStyle === 'karambit')
    return {
      ...pose,
      x: pose.x - 0.055,
      y: pose.y + 0.14,
      z: pose.z + 0.12,
      rx: pose.rx + 0.06,
      ry: pose.ry - 1.05,
      rz: pose.rz - 0.38,
      order: 'ZYX' as const,
    };
  if (knifeStyle === 'standard')
    return {
      ...pose,
      x: pose.x + 0.025,
      y: pose.y + 0.085,
      z: pose.z + 0.075,
      rx: pose.rx + 0.72,
      ry: pose.ry + 0.22,
      rz: pose.rz - 0.18,
      order: 'XYZ' as const,
    };
  return { ...pose, order: 'XYZ' as const };
}

/** Continuous, bounded view motion; stance changes never snap or accumulate transforms. */
export class ViewMotion {
  sprint = 0;
  slide = 0;
  crouch = 0;
  movement = 0;
  air = 0;
  landing = 0;
  swap = 0;
  phase = 0;
  wasGrounded = true;
  lastVy = 0;
  step(dt: number, s: MotionSample) {
    dt = clamp(dt, 0, 0.1);
    this.sprint = damp(this.sprint, Number(s.sprinting), 10, dt);
    this.slide = damp(this.slide, Number(s.sliding), 12, dt);
    this.crouch = damp(this.crouch, Number(s.crouch), 14, dt);
    this.movement = damp(
      this.movement,
      s.grounded && !s.sliding ? clamp(s.speed / 7.5, 0, 1) : 0,
      12,
      dt,
    );
    this.air = damp(
      this.air,
      s.grounded ? 0 : clamp(s.vy * 0.006, -0.025, 0.025),
      10,
      dt,
    );
    this.swap = damp(this.swap, Number(s.switching), 18, dt);
    if (dt > 0) {
      if (!this.wasGrounded && s.grounded)
        this.landing = Math.min(0.035, Math.abs(this.lastVy) * 0.006);
      this.wasGrounded = s.grounded;
      this.lastVy = s.vy;
    }
    this.landing = damp(this.landing, 0, 16, dt);
    this.phase += dt * clamp(s.speed, 0, 10) * 1.6;
    const hip = 1 - clamp(s.aim, 0, 1),
      bob =
        Math.sin(this.phase) *
        0.007 *
        this.movement *
        hip *
        clamp(s.bobScale ?? 1, 0, 1.45);
    return {
      x:
        0.23 * hip +
        Math.sin(this.phase * 0.5) * 0.005 * this.movement * hip +
        this.slide * 0.012,
      y:
        -0.245 +
        s.aim * (0.245 - s.sightHeight) -
        Math.abs(bob) -
        this.sprint * 0.035 -
        this.slide * 0.025 -
        this.air -
        this.landing -
        s.reload * 0.16 -
        this.swap * 0.1,
      z: -0.62 + clamp(s.kick, 0, 1) * 0.025 - this.sprint * 0.025,
      rx:
        clamp(s.kick, 0, 1) * 0.035 -
        s.reload * 0.25 +
        this.air * 0.8 +
        this.slide * 0.025,
      ry: -this.sprint * 0.12,
      rz: -s.reload * 0.24 - this.sprint * 0.1 - this.slide * 0.035 + bob * 0.3,
      eyeOffset: -this.crouch * 0.57 - this.landing * 0.35,
      cameraBob: bob * 0.4,
      cameraRoll: bob * 0.035,
      sprintBlend: this.sprint,
      slideBlend: this.slide,
    };
  }
}
