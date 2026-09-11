export type BotDifficulty = 'easy' | 'hard' | 'pro';
type Range = readonly [number, number];
export type BotSkill = {
  reaction: Range; turnRate: Range; sense: Range; decision: Range;
  aggression: Range; mobility: Range; jumpCooldown: Range; slideCooldown: Range;
  burstPause: Range; semiPause: Range; aimError: number; aimSpread: number;
  tracking: number; memory: number; coverHealth: number; flankChance: number;
};

/** Skill changes decisions and execution, never health, damage or player physics. */
export const botSkills: Record<BotDifficulty, BotSkill> = {
  easy: {
    reaction: [.5, .78], turnRate: [2.8, 3.6], sense: [.14, .2], decision: [.9, 1.25],
    aggression: [.25, .45], mobility: [.3, .5], jumpCooldown: [5.5, 8], slideCooldown: [6, 9],
    burstPause: [.45, .7], semiPause: [.25, .4], aimError: .03, aimSpread: .023,
    tracking: .15, memory: 3, coverHealth: 30, flankChance: .1,
  },
  hard: {
    reaction: [.24, .34], turnRate: [4.6, 5.8], sense: [.075, .115], decision: [.55, .8],
    aggression: [.45, .65], mobility: [.6, .8], jumpCooldown: [4, 6.5], slideCooldown: [4, 6],
    burstPause: [.2, .36], semiPause: [.12, .2], aimError: .013, aimSpread: .01,
    tracking: .68, memory: 4.5, coverHealth: 40, flankChance: .25,
  },
  pro: {
    reaction: [.17, .23], turnRate: [6, 7.2], sense: [.05, .08], decision: [.35, .55],
    aggression: [.58, .85], mobility: [.8, .98], jumpCooldown: [3.2, 5], slideCooldown: [3.2, 4.8],
    burstPause: [.08, .15], semiPause: [.035, .075], aimError: .006, aimSpread: .0045,
    tracking: .92, memory: 5, coverHealth: 52, flankChance: .38,
  },
};

export function sampleSkill(range: Range, rng: () => number) {
  return range[0] + rng() * (range[1] - range[0]);
}

/** Shuffle skills separately from names, spawns and weapons; keep them for the whole match. */
export function assignBotSkills(ids: number[], rng: () => number): Map<number, BotDifficulty> {
  if (ids.length === 1) {
    const roll = rng();
    return new Map([[ids[0], roll < .7 ? 'pro' : roll < .9 ? 'hard' : 'easy']]);
  }
  const easy = ids.length >= 6 ? Math.max(1, Math.floor(ids.length * .1)) : 0;
  const hard = Math.round(ids.length * 2 / 9);
  const roster: BotDifficulty[] = [
    ...Array<BotDifficulty>(ids.length - easy - hard).fill('pro'),
    ...Array<BotDifficulty>(hard).fill('hard'),
    ...Array<BotDifficulty>(easy).fill('easy'),
  ];
  for (let i = roster.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [roster[i], roster[j]] = [roster[j], roster[i]];
  }
  return new Map(ids.map((id, i) => [id, roster[i]]));
}
