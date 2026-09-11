import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/** Only call behind Sites dispatch (or its local plugin), which owns these headers.
 * Some existing private dispatch sessions forward a verified email without the
 * newer per-site subject ID. Keep those legacy accounts isolated in a namespace;
 * never accept identity from request bodies, query strings or ordinary headers.
 * A later subject ID remains authoritative; email accounts are not auto-merged.
 */
export async function accountIdentity(headers: Pick<Headers, 'get'>): Promise<string | null> {
  const firebaseUser = await firebaseIdentity(headers);
  if (firebaseUser) return firebaseUser;
  const subject = headers.get('oai-authenticated-user-id')?.trim();
  if (subject) return subject;
  const email = headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('skillclash:legacy-dispatch-email:' + email));
  return 'dispatch-email:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function firebaseIdentity(headers: Pick<Headers, 'get'>) {
  const header = headers.get('authorization') || headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  try {
    const decoded = await firebaseAdminAuth().verifyIdToken(token);
    return 'firebase:' + decoded.uid;
  } catch {
    return null;
  }
}

function firebaseAdminAuth() {
  return getAuth(firebaseAdminApp());
}

export function firebaseAdminApp() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (clientEmail && privateKey) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } else {
      initializeApp(projectId ? { projectId } : undefined);
    }
  }
  return getApps()[0];
}

export function firebaseAdminFirestore() {
  return getFirestore(firebaseAdminApp());
}

export async function firebasePlayerName(identity: string) {
  if (!identity.startsWith('firebase:')) return null;
  const uid = identity.slice('firebase:'.length);
  if (!uid) return null;
  const snapshot = await firebaseAdminFirestore().collection('players').doc(uid).get();
  if (!snapshot.exists) return null;
  const profile = snapshot.data() as { displayName?: unknown; anonymous?: unknown };
  if (profile.anonymous === true) return 'Anonymous Player';
  return typeof profile.displayName === 'string' && profile.displayName.trim().length >= 2
    ? profile.displayName.trim().slice(0, 32)
    : null;
}
