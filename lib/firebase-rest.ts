import { firebaseWebConfig } from './firebase-config.ts';

type AccessToken = { value: string; expiresAt: number };
let cachedToken: AccessToken | null = null;

function projectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || firebaseWebConfig().projectId;
}

export function firestoreDocumentRoot() {
  return `projects/${projectId()}/databases/(default)/documents`;
}

export function firestoreRoot() {
  return `https://firestore.googleapis.com/v1/${firestoreDocumentRoot()}`;
}

async function cloudAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(2500) },
  );
  if (!response.ok) throw new Error('Cloud identity is unavailable.');
  const payload = await response.json() as { access_token?: unknown; expires_in?: unknown };
  if (typeof payload.access_token !== 'string') throw new Error('Cloud identity is unavailable.');
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in) || 300) * 1000,
  };
  return cachedToken.value;
}

export async function firestoreRequest(path: string, init: RequestInit = {}) {
  const token = await cloudAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  return fetch(firestoreRoot() + path, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(8000),
  });
}

export async function firebaseUid(idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseWebConfig().apiKey)}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }), signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) return null;
  const payload = await response.json() as { users?: { localId?: unknown }[] };
  const uid = payload.users?.[0]?.localId;
  return typeof uid === 'string' && uid.length <= 128 ? uid : null;
}

export type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
};

export function fromFirestore(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('arrayValue' in value) return (value.arrayValue?.values ?? []).map(fromFirestore);
  if ('mapValue' in value) return Object.fromEntries(
    Object.entries(value.mapValue?.fields ?? {}).map(([key, entry]) => [key, fromFirestore(entry)]),
  );
  return undefined;
}

export function firestoreFields(fields: Record<string, FirestoreValue> | undefined) {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([key, value]) => [key, fromFirestore(value)]));
}

export function toFirestore(value: unknown): FirestoreValue {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number' && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestore) } };
  if (value && typeof value === 'object') return {
    mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toFirestore(entry)])) },
  };
  throw new Error('Unsupported Firestore value.');
}

export async function firebasePlayerProfile(uid: string) {
  const response = await firestoreRequest(`/players/${encodeURIComponent(uid)}?mask.fieldPaths=displayName&mask.fieldPaths=handle&mask.fieldPaths=anonymous`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Player profile is unavailable.');
  const document = await response.json() as { fields?: Record<string, FirestoreValue> };
  return firestoreFields(document.fields) as { displayName?: unknown; handle?: unknown; anonymous?: unknown };
}
