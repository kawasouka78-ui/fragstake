import { InputError } from './account-rules.ts';
import {
  firebasePlayerProfile,
  firestoreDocumentRoot,
  firestoreFields,
  firestoreRequest,
  toFirestore,
  type FirestoreValue,
} from './firebase-rest.ts';
import { signature } from './live/security.ts';

type ResultPlayer = {
  id: string; kills: number; deaths: number; headshots: number;
  maxStreak: number; seconds: number; completed: boolean; won: boolean;
};
type MatchResult = {
  id: string; mode: 'ffa' | '1v1' | '2v2';
  mapId: 'citadel' | 'depot' | 'underpass'; startedAt: number;
  finishedAt: number; duration: number; players: ResultPlayer[];
};
type FirestoreDocument = { name?: string; fields?: Record<string, FirestoreValue> };

function validInteger(value: unknown, maximum: number) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
}

function validatedResult(value: unknown): MatchResult {
  if (!value || typeof value !== 'object') throw new InputError('Invalid result');
  const result = value as Record<string, unknown>;
  if (
    typeof result.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(result.id) ||
    !['ffa', '1v1', '2v2'].includes(String(result.mode)) ||
    !['citadel', 'depot', 'underpass'].includes(String(result.mapId)) ||
    !validInteger(result.startedAt, Date.now()) ||
    !validInteger(result.finishedAt, Date.now() + 60000) ||
    Number(result.finishedAt) < Number(result.startedAt) ||
    !validInteger(result.duration, 181) || !Array.isArray(result.players) ||
    result.players.length > 10
  ) throw new InputError('Invalid result');

  const ids = new Set<string>();
  const players = result.players.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new InputError('Invalid participant result');
    const player = entry as Record<string, unknown>;
    if (
      typeof player.id !== 'string' || player.id.length > 200 || ids.has(player.id) ||
      !validInteger(player.kills, 2000) || !validInteger(player.deaths, 2000) ||
      !validInteger(player.headshots, Number(player.kills)) ||
      !validInteger(player.maxStreak, Number(player.kills)) ||
      !validInteger(player.seconds, 181) || typeof player.completed !== 'boolean' ||
      typeof player.won !== 'boolean'
    ) throw new InputError('Invalid participant result');
    ids.add(player.id);
    return {
      id: player.id, kills: Number(player.kills), deaths: Number(player.deaths),
      headshots: Number(player.headshots), maxStreak: Number(player.maxStreak),
      seconds: Number(player.seconds), completed: player.completed, won: player.won,
    };
  });
  return {
    id: result.id, mode: result.mode as MatchResult['mode'],
    mapId: result.mapId as MatchResult['mapId'], startedAt: Number(result.startedAt),
    finishedAt: Number(result.finishedAt), duration: Number(result.duration), players,
  };
}

function matchDocumentName(id: string) {
  return `${firestoreDocumentRoot()}/matchResults/${id}`;
}

async function existingDigest(id: string) {
  const response = await firestoreRequest(`/matchResults/${encodeURIComponent(id)}?mask.fieldPaths=digest`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not verify the existing result.');
  const document = await response.json() as FirestoreDocument;
  const digest = firestoreFields(document.fields).digest;
  return typeof digest === 'string' ? digest : null;
}

export async function recordFirebaseMatchResult(value: unknown) {
  const result = validatedResult(value);
  const digest = await signature('skillclash-result-digest-not-a-secret', 'digest', JSON.stringify(result));
  const writes: Record<string, unknown>[] = [{
    update: {
      name: matchDocumentName(result.id),
      fields: Object.fromEntries(Object.entries({ ...result, digest }).map(([key, entry]) => [key, toFirestore(entry)])),
    },
    currentDocument: { exists: false },
  }];
  for (const player of result.players) {
    if (!player.completed || !player.id.startsWith('firebase:')) continue;
    const uid = player.id.slice('firebase:'.length);
    if (!uid) continue;
    writes.push({
      transform: {
        document: `${firestoreDocumentRoot()}/players/${uid}`,
        fieldTransforms: [
          ['stats.matches', 1], ['stats.kills', player.kills],
          ['stats.deaths', player.deaths], ['stats.wins', player.won ? 1 : 0],
        ].map(([fieldPath, amount]) => ({
          fieldPath, increment: { integerValue: String(amount) },
        })),
      },
    });
  }
  const response = await firestoreRequest(':commit', { method: 'POST', body: JSON.stringify({ writes }) });
  if (response.ok) return { ok: true };
  const previous = await existingDigest(result.id);
  if (previous === digest) return { ok: true, duplicate: true };
  if (previous) throw new InputError('Conflicting result already recorded.', 409);
  throw new Error('Result could not be stored.');
}

type Totals = { matches: number; kills: number; deaths: number; wins: number };
const emptyTotals = (): Totals => ({ matches: 0, kills: 0, deaths: 0, wins: 0 });

async function recentMatches() {
  const response = await firestoreRequest(':runQuery', {
    method: 'POST',
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'matchResults' }],
      orderBy: [{ field: { fieldPath: 'finishedAt' }, direction: 'DESCENDING' }],
      limit: 500,
    } }),
  });
  if (!response.ok) throw new Error('Match records are unavailable.');
  const rows = await response.json() as { document?: FirestoreDocument }[];
  return rows.flatMap((row) => row.document ? [firestoreFields(row.document.fields) as MatchResult] : []);
}

export async function firebaseRecords(identity: string | null) {
  const matches = await recentMatches();
  const totals = new Map<string, Totals>();
  for (const match of matches) for (const player of match.players ?? []) {
    if (!player.completed) continue;
    const value = totals.get(player.id) ?? emptyTotals();
    value.matches += 1; value.kills += player.kills; value.deaths += player.deaths;
    value.wins += player.won ? 1 : 0; totals.set(player.id, value);
  }

  const identities = [...totals.keys()];
  const profiles = new Map<string, Awaited<ReturnType<typeof firebasePlayerProfile>>>();
  await Promise.all(identities.filter((id) => id.startsWith('firebase:')).map(async (id) => {
    profiles.set(id, await firebasePlayerProfile(id.slice('firebase:'.length)));
  }));
  const leaders = identities.map((id) => {
    const profile = profiles.get(id);
    const suffix = id.replace(/^firebase:/, '').slice(0, 8).toLowerCase();
    const name = profile?.anonymous === true ? 'Anonymous Player'
      : typeof profile?.displayName === 'string' && profile.displayName.trim()
        ? profile.displayName.trim().slice(0, 32) : 'FragStake Player';
    const handle = typeof profile?.handle === 'string' && /^[a-z0-9_]{3,20}$/.test(profile.handle)
      ? profile.handle : `player_${suffix}`;
    return { handle, name, ...totals.get(id)! };
  }).sort((a, b) => b.wins - a.wins || b.kills - a.kills || a.handle.localeCompare(b.handle)).slice(0, 50);

  if (!identity) return { leaders, recent: [], stats: null };
  const recent = matches.flatMap((match) => (match.players ?? [])
    .filter((player) => player.id === identity)
    .map((player) => ({
      id: `${match.id}:${player.id}`, mode: match.mode, map_id: match.mapId,
      kills: player.kills, deaths: player.deaths, won: player.won ? 1 : 0,
      completed: player.completed ? 1 : 0, finished_at: match.finishedAt,
    }))).slice(0, 50);
  return { leaders, recent, stats: totals.get(identity) ?? emptyTotals() };
}
