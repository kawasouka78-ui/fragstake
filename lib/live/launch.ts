import type { MatchConfig } from '../game-rules.ts';
import type { LiveMode } from './security.ts';

/** Live entry never uses the demo-wallet start or settlement routes. */
export async function requestLiveMatch(
  mode: LiveMode,
  mapId: string,
  fetcher: typeof fetch = fetch,
): Promise<MatchConfig> {
  const response = await fetcher('/api/live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, mapId }),
    signal: AbortSignal.timeout(8000),
  });
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(
      'The match service did not respond correctly. Please try again.',
    );
  }
  const data = value as {
    error?: string;
    ticket?: string;
    url?: string;
    guest?: boolean;
  } | null;
  if (!response.ok)
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : 'Could not join this match. Please try again.',
    );
  if (
    !data ||
    typeof data.ticket !== 'string' ||
    !data.ticket ||
    typeof data.url !== 'string' ||
    !/^wss?:\/\//.test(data.url) ||
    typeof data.guest !== 'boolean'
  )
    throw new Error('The match connection is unavailable. Please try again.');
  return {
    mode: 'practice',
    mapId,
    team: mode === '2v2' ? '2v2' : '1v1',
    rate: 0,
    balance: 0,
    live: { ticket: data.ticket, url: data.url, guest: data.guest, mode },
  };
}
