import type {GameEvent} from './simulation.ts';

type VoiceKind = 'shot' | 'enemy' | 'step' | 'hit' | 'kill' | 'hurt' | 'utility';
type Voice = {source: AudioScheduledSourceNode; envelope: GainNode; nodes: AudioNode[]; kind: VoiceKind; ends: number};
type ShotSound = {body: number; end: number; length: number; crack: number; weight: number; tail: number};

const SHOTS: Record<string, ShotSound> = {
  rifle: {body: 148, end: 52, length: .105, crack: 2250, weight: .44, tail: .12},
  carbine: {body: 175, end: 65, length: .085, crack: 2600, weight: .39, tail: .09},
  smg: {body: 190, end: 83, length: .070, crack: 1850, weight: .32, tail: .07},
  vector: {body: 225, end: 92, length: .055, crack: 3100, weight: .28, tail: .05},
  marksman: {body: 105, end: 34, length: .170, crack: 1700, weight: .53, tail: .21},
  shotgun: {body: 118, end: 37, length: .150, crack: 1350, weight: .48, tail: .18},
};

/** Short procedural combat sounds; feedback has its own bus so it stays readable under gunfire. */
export class ArenaAudio {
  context: AudioContext | null = null;
  gain: GainNode | null = null;
  muted = false;
  noise: AudioBuffer | null = null;
  private world: GainNode | null = null;
  private feedback: GainNode | null = null;
  private graph: AudioNode[] = [];
  private voices = new Set<Voice>();
  private lastHit = -Infinity;
  private lastHead = -Infinity;
  private lastKill = -Infinity;
  private lastEnemy = -Infinity;
  private lastHurt = -Infinity;
  private lastStep = -Infinity;
  private readonly level = .34;

  unlock() {
    try {
      if (!this.context || this.context.state === 'closed') {
        const context = new AudioContext();
        this.context = context;
        this.gain = context.createGain();
        this.world = context.createGain();
        this.feedback = context.createGain();
        const rumble = context.createBiquadFilter();
        rumble.type = 'highpass';
        rumble.frequency.value = 28;
        rumble.Q.value = .5;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -9;
        compressor.knee.value = 10;
        compressor.ratio.value = 4.5;
        compressor.attack.value = .003;
        compressor.release.value = .09;
        const ceiling = context.createWaveShaper();
        const curve = new Float32Array(2049);
        for (let i = 0; i < curve.length; i++) {
          const x = i / (curve.length - 1) * 2 - 1, magnitude = Math.abs(x);
          curve[i] = Math.sign(x) * (magnitude <= .75 ? magnitude : .75 + .2 * Math.tanh((magnitude - .75) / .2));
        }
        ceiling.curve = curve;
        ceiling.oversample = '2x';
        this.world.connect(rumble);
        this.feedback.connect(rumble);
        rumble.connect(compressor);
        compressor.connect(this.gain);
        this.gain.connect(ceiling);
        ceiling.connect(context.destination);
        this.gain.gain.value = this.muted ? 0 : this.level;
        this.graph = [this.world, this.feedback, rumble, compressor, this.gain, ceiling];
        this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * .65), context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.resetGates();
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      // Browsers without unlocked WebAudio can still run the match normally.
    }
  }

  volume(muted: boolean) {
    this.muted = muted;
    if (!this.context || !this.gain || this.context.state === 'closed') return;
    const t = this.context.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(muted ? 0 : this.level, t + .012);
    if (muted) for (const voice of [...this.voices]) this.retire(voice, t);
  }

  /** Kept for existing callers; gameplay uses the envelopes and buses below. */
  tone(frequency: number, length: number, volume = .3, type: OscillatorType = 'sine', end = frequency) {
    this.note('utility', frequency, end, length, volume, type);
  }

  private ready() {
    return !!this.context && this.context.state === 'running' && !this.muted && !!this.gain;
  }

  private resetGates() {
    this.lastHit = this.lastHead = this.lastKill = this.lastEnemy = this.lastHurt = this.lastStep = -Infinity;
  }

  private retire(voice: Voice, time: number) {
    voice.envelope.gain.cancelScheduledValues(time);
    voice.envelope.gain.setValueAtTime(Math.max(.0001, voice.envelope.gain.value), time);
    voice.envelope.gain.exponentialRampToValueAtTime(.0001, time + .006);
    try { voice.source.stop(time + .008); } catch { /* Already finished. */ }
    this.voices.delete(voice);
  }

  private reserve(kind: VoiceKind) {
    if (!this.ready()) return false;
    const t = this.context!.currentTime;
    for (const voice of this.voices) if (voice.ends <= t) this.voices.delete(voice);
    const cap = kind === 'shot' ? 12 : kind === 'enemy' ? 8 : kind === 'kill' ? 8 : kind === 'hit' ? 5 : 6;
    const related = [...this.voices].filter(voice => voice.kind === kind);
    if (related.length >= cap) this.retire(related[0], t);
    if (this.voices.size >= 40) {
      const expendable = [...this.voices].find(voice => voice.kind !== 'kill' && voice.kind !== 'hit');
      if (!expendable) return false;
      this.retire(expendable, t);
    }
    return true;
  }

  private envelope(kind: VoiceKind, source: AudioScheduledSourceNode, nodes: AudioNode[], start: number, length: number, volume: number, attack = .002) {
    const envelope = this.context!.createGain();
    const peak = Math.min(1, Math.max(.0001, volume));
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.linearRampToValueAtTime(peak, start + Math.min(attack, length * .2));
    envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
    nodes[nodes.length - 1].connect(envelope);
    envelope.connect((kind === 'hit' || kind === 'kill' || kind === 'utility') ? this.feedback! : this.world!);
    const voice: Voice = {source, envelope, nodes: [...nodes, envelope], kind, ends: start + length + .01};
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      for (const node of voice.nodes) node.disconnect();
    };
    source.stop(voice.ends);
    return voice;
  }

  private note(kind: VoiceKind, frequency: number, end: number, length: number, volume: number, type: OscillatorType = 'sine', delay = 0) {
    if (![frequency, end, length, volume, delay].every(Number.isFinite) || volume <= 0 || !this.reserve(kind)) return;
    const context = this.context!, start = context.currentTime + Math.max(0, delay);
    length = Math.min(1, Math.max(.012, length));
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.min(12000, Math.max(20, frequency)), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.min(12000, Math.max(20, end)), start + length);
    oscillator.start(start);
    this.envelope(kind, oscillator, [oscillator], start, length, volume, kind === 'kill' ? .005 : .002);
  }

  private burst(kind: VoiceKind, frequency: number, length: number, volume: number, type: BiquadFilterType = 'bandpass', delay = 0) {
    if (!this.noise || !this.reserve(kind)) return;
    const context = this.context!, start = context.currentTime + delay;
    const source = context.createBufferSource(), filter = context.createBiquadFilter();
    source.buffer = this.noise;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(90, frequency * .58), start + length);
    filter.Q.value = .62;
    source.connect(filter);
    source.start(start, Math.random() * Math.max(0, this.noise.duration - length - .02));
    this.envelope(kind, source, [source, filter], start, length, volume, .001);
  }

  private duckGunfire() {
    if (!this.world || !this.context) return;
    const t = this.context.currentTime;
    this.world.gain.cancelScheduledValues(t);
    this.world.gain.setValueAtTime(this.world.gain.value, t);
    this.world.gain.linearRampToValueAtTime(.73, t + .008);
    this.world.gain.setValueAtTime(.73, t + .09);
    this.world.gain.linearRampToValueAtTime(1, t + .22);
  }

  play(event: GameEvent) {
    if (!this.ready()) return;
    const t = this.context!.currentTime;
    if (event.kind === 'shot') {
      const sound = SHOTS[event.weapon ?? 'rifle'] ?? SHOTS.rifle;
      const pitch = .975 + Math.random() * .05;
      this.note('shot', sound.body * pitch, sound.end, sound.length, sound.weight, 'triangle');
      this.burst('shot', sound.crack * pitch, Math.min(.065, sound.length * .55), .60);
      this.burst('shot', 540, sound.tail, sound.weight * .47, 'lowpass', .008);
    } else if (event.kind === 'enemyShot') {
      if (t - this.lastEnemy < .028) return;
      this.lastEnemy = t;
      const distance = Number.isFinite(event.distance) ? event.distance! : 20;
      const attenuation = Math.max(0, 1 - Math.max(0, distance) / 30) ** 1.5;
      if (attenuation < .025) return;
      this.note('enemy', 125, 49, .082, .21 * attenuation, 'triangle');
      this.burst('enemy', 1150, .055, .22 * attenuation);
    } else if (event.kind === 'footstep') {
      if (t - this.lastStep < .13) return;
      this.lastStep = t;
      this.note('step', 83, 39, .058, .075);
      this.burst('step', 340, .04, .05, 'lowpass');
    } else if (event.kind === 'hit') {
      // Pellet hits in one shot share one tick; a later head hit can still upgrade it.
      if (t - this.lastKill < .075) return;
      if (event.head) {
        if (t - this.lastHead < .048) return;
        this.lastHead = this.lastHit = t;
        for (const voice of [...this.voices]) if (voice.kind === 'hit') this.retire(voice, t);
        this.note('hit', 1540, 1370, .075, .21);
        this.note('hit', 2240, 2080, .045, .065, 'sine', .004);
        this.burst('hit', 3400, .024, .11);
      } else {
        if (t - this.lastHit < .045) return;
        this.lastHit = t;
        this.note('hit', 910, 740, .045, .18);
        this.burst('hit', 1900, .026, .13);
      }
    } else if (event.kind === 'kill') {
      if (t - this.lastKill < .065) return;
      this.lastKill = t;
      for (const voice of [...this.voices]) if (voice.kind === 'hit' || voice.kind === 'kill') this.retire(voice, t);
      this.duckGunfire();
      // Fast impact followed by a short rising resolution, leaving the next shot clear.
      this.note('kill', 185, 100, .075, .17);
      this.note('kill', event.head ? 900 : 720, event.head ? 880 : 705, .11, .23);
      this.note('kill', event.head ? 1350 : 1080, event.head ? 1330 : 1065, .18, .19, 'sine', .065);
      if (event.head) this.note('kill', 1800, 1760, .105, .06, 'sine', .070);
    } else if (event.kind === 'hurt') {
      if (t - this.lastHurt < .065) return;
      this.lastHurt = t;
      this.note('hurt', 74, 35, .13, .25);
      this.burst('hurt', 390, .07, .13, 'lowpass');
    } else if (event.kind === 'reload') {
      this.burst('utility', 1550, .035, .14);
      this.note('utility', 260, 135, .045, .065, 'triangle', .045);
      this.burst('utility', 2200, .025, .095, 'bandpass', .08);
    } else if (event.kind === 'pickup' || event.kind === 'spawn') {
      const level = event.kind === 'spawn' ? .075 : .11;
      this.note('utility', 520, 520, .105, level);
      this.note('utility', 780, 780, .14, level * .8, 'sine', .055);
    }
  }

  dispose() {
    const context = this.context;
    for (const voice of this.voices) {
      voice.source.onended = null;
      try { voice.source.stop(); } catch { /* Already finished. */ }
      for (const node of voice.nodes) node.disconnect();
    }
    this.voices.clear();
    for (const node of this.graph) node.disconnect();
    this.graph = [];
    this.context = null;
    this.gain = this.world = this.feedback = null;
    this.noise = null;
    this.resetGates();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
