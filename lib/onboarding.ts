export type OnboardingPlayer = { handle?: string | null; name?: string | null };

export function needsOnboarding(player: OnboardingPlayer | null | undefined) {
  if (!player) return true;
  return /^player_[a-f0-9]{10}$/i.test(player.handle ?? '') &&
    /^Player [A-F0-9]{4}$/i.test(player.name ?? '');
}

export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/play';
  try {
    const parsed = new URL(value, 'https://fragstake.local');
    return parsed.origin === 'https://fragstake.local' && parsed.pathname !== '/signin'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : '/play';
  } catch {
    return '/play';
  }
}
