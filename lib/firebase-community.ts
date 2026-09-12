import { InputError, validateProfile } from './account-rules.ts';
import { catalog } from './catalog.ts';
import { firebaseRecords } from './firebase-records.ts';
import {
  firebasePlayerProfile,
  firestoreRequest,
  toFirestore,
} from './firebase-rest.ts';

function uidFromIdentity(identity: string) {
  if (!identity.startsWith('firebase:')) throw new InputError('Sign in again.', 401);
  const uid = identity.slice('firebase:'.length);
  if (!uid) throw new InputError('Sign in again.', 401);
  return uid;
}

async function accountState(identity: string) {
  const uid = uidFromIdentity(identity);
  const profile = await firebasePlayerProfile(uid);
  const suffix = uid.slice(0, 8).toLowerCase();
  const handle =
    typeof profile?.handle === 'string' && /^[a-z0-9_]{3,20}$/.test(profile.handle)
      ? profile.handle
      : `player_${suffix}`;
  const name =
    profile?.anonymous === true
      ? 'Anonymous Player'
      : typeof profile?.displayName === 'string' && profile.displayName.trim()
        ? profile.displayName.trim().slice(0, 32)
        : 'FragStake Player';
  const storedStats =
    profile?.stats && typeof profile.stats === 'object'
      ? (profile.stats as Record<string, unknown>)
      : {};
  const stats = {
    matches: Number(storedStats.matches) || 0,
    kills: Number(storedStats.kills) || 0,
    deaths: Number(storedStats.deaths) || 0,
    wins: Number(storedStats.wins) || 0,
  };
  return {
    player: {
      id: identity,
      handle,
      name,
      bio: '',
      color: 'orange',
      balance: 0,
      created_at: 0,
      last_seen: Date.now(),
    },
    stats: { ...stats, net: 0, headshots: 0, maxStreak: 0 },
    transactions: [],
    matches: [],
    active: null,
    pending: 0,
  };
}

function platformData() {
  return {
    party: null,
    invites: [],
    challenges: [],
    inventory: [],
    reports: [],
    ratings: [],
    catalog,
  };
}

export async function firebaseCommunityGet(identity: string, url: URL) {
  const action = url.searchParams.get('action') || 'state';
  if (action === 'state') return accountState(identity);
  if (action === 'platform') return platformData();
  if (action === 'friends') return { friends: [] };
  if (action === 'social') return { friends: [], messages: [] };
  if (action === 'lobbies') return { lobbies: [] };
  if (action === 'search') {
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();
    if (query.length < 2) return { players: [] };
    const records = await firebaseRecords(null);
    return {
      players: records.leaders
        .filter((player) =>
          player.handle.toLowerCase().includes(query) ||
          player.name.toLowerCase().includes(query),
        )
        .slice(0, 20)
        .map((player) => ({
          id: `firebase-profile:${player.handle}`,
          handle: player.handle,
          name: player.name,
          color: 'orange',
          created_at: 0,
          last_seen: 0,
        })),
    };
  }
  if (action === 'leaderboard') {
    const records = await firebaseRecords(identity);
    const players = records.leaders.map((player, index) => ({
      ...player,
      id: `firebase-profile:${player.handle}`,
      handle: player.handle,
      name: player.name,
      color: 'orange',
      points: player.kills * 10 + player.wins * 100,
      net: 0,
      streak: 0,
      kd: player.kills / Math.max(1, player.deaths),
      rank: index + 1,
    }));
    return { players, total: players.length, page: 0 };
  }
  if (action === 'player') {
    const handle = (url.searchParams.get('handle') || '').toLowerCase();
    const records = await firebaseRecords(null);
    const player = records.leaders.find((entry) => entry.handle === handle);
    if (!player) throw new InputError('Player not found.', 404);
    return {
      player: {
        id: `firebase-profile:${player.handle}`,
        handle: player.handle,
        name: player.name,
        color: 'orange',
        bio: '',
        created_at: 0,
        last_seen: 0,
      },
      stats: { ...player, net: 0, headshots: 0, maxStreak: 0 },
    };
  }
  throw new InputError('Unknown view.', 404);
}

export async function firebaseCommunityPost(
  identity: string,
  body: Record<string, unknown>,
) {
  const uid = uidFromIdentity(identity);
  const action = typeof body.action === 'string' ? body.action : '';
  if (action === 'profile') {
    const profile = validateProfile(body);
    const response = await firestoreRequest(
      `/players/${encodeURIComponent(uid)}?updateMask.fieldPaths=handle&updateMask.fieldPaths=displayName&updateMask.fieldPaths=lastSeen`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            handle: toFirestore(profile.handle),
            displayName: toFirestore(profile.name),
            lastSeen: toFirestore(Date.now()),
          },
        }),
      },
    );
    if (!response.ok) throw new Error('Could not save the player profile.');
  } else if (action !== 'presence') {
    throw new InputError('This account feature is still connecting to Firebase.', 503);
  }
  return { ...(await accountState(identity)), platform: platformData() };
}
