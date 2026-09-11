'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  setPersistence,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  firebaseWebConfig,
  hasFirebaseConfig,
} from './firebase-config.ts';

let app: FirebaseApp | null = null;
let persistenceReady: Promise<void> | null = null;

export function firebaseEnabled() {
  return hasFirebaseConfig();
}

export function firebaseApp() {
  if (!firebaseEnabled()) return null;
  app ??= getApps()[0] ?? initializeApp(firebaseWebConfig());
  return app;
}

export function firebaseAuth() {
  const initialized = firebaseApp();
  return initialized ? getAuth(initialized) : null;
}

async function persistentFirebaseAuth() {
  const auth = firebaseAuth();
  if (!auth) throw new Error('Firebase sign-in is not configured yet.');
  persistenceReady ??= setPersistence(auth, browserLocalPersistence);
  await persistenceReady;
  return auth;
}

export function onFirebaseUserChange(callback: (user: User | null) => void) {
  const auth = firebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  const auth = await persistentFirebaseAuth();
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signInWithEmail(email: string, password: string) {
  const auth = await persistentFirebaseAuth();
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function createEmailAccount(email: string, password: string) {
  const auth = await persistentFirebaseAuth();
  await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function resetEmailPassword(email: string) {
  const auth = firebaseAuth();
  if (!auth) throw new Error('Firebase sign-in is not configured yet.');
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutFirebase() {
  const auth = firebaseAuth();
  if (auth) await signOut(auth);
}

export async function firebaseIdToken() {
  const user = firebaseAuth()?.currentUser;
  return user ? user.getIdToken() : null;
}

export type FirebasePlayerProfile = {
  handle: string;
  displayName: string;
  avatarPath: string;
  anonymous: boolean;
  country: string;
  walletStatus: string;
  stats: { matches: number; kills: number; deaths: number; wins: number };
};

function profileCacheKey(uid: string) {
  return `fragstake-player-profile:${uid}`;
}

function cachedProfile(uid: string) {
  try {
    const value = localStorage.getItem(profileCacheKey(uid));
    if (!value) return null;
    const profile = JSON.parse(value) as Partial<FirebasePlayerProfile>;
    if (typeof profile.handle !== 'string' || typeof profile.displayName !== 'string' || typeof profile.anonymous !== 'boolean') return null;
    return {
      handle: profile.handle,
      displayName: profile.displayName,
      avatarPath: typeof profile.avatarPath === 'string' ? profile.avatarPath : '',
      anonymous: profile.anonymous,
      country: typeof profile.country === 'string' ? profile.country : '',
      walletStatus: typeof profile.walletStatus === 'string' ? profile.walletStatus : 'unfunded',
      stats: profile.stats ?? { matches: 0, kills: 0, deaths: 0, wins: 0 },
    };
  } catch { return null; }
}

function cacheProfile(uid: string, profile: FirebasePlayerProfile) {
  try { localStorage.setItem(profileCacheKey(uid), JSON.stringify(profile)); } catch {}
}

export async function loadFirebaseProfile() {
  const user = firebaseAuth()?.currentUser;
  const initialized = firebaseApp();
  if (!user || !initialized) return null;
  const cached = cachedProfile(user.uid);
  try {
    const snapshot = await getDoc(doc(getFirestore(initialized), 'players', user.uid));
    if (!snapshot.exists()) return cached;
    const profile = snapshot.data() as FirebasePlayerProfile;
    cacheProfile(user.uid, profile);
    return profile;
  } catch { return cached; }
}

export async function saveFirebaseProfile(profile: Pick<FirebasePlayerProfile, 'handle' | 'displayName' | 'anonymous'>) {
  const user = firebaseAuth()?.currentUser;
  const initialized = firebaseApp();
  if (!user || !initialized) throw new Error('Sign in again to finish your profile.');
  const cached = cachedProfile(user.uid);
  cacheProfile(user.uid, {
    handle: profile.handle,
    displayName: profile.displayName,
    avatarPath: cached?.avatarPath ?? '',
    anonymous: profile.anonymous,
    country: cached?.country ?? '',
    walletStatus: cached?.walletStatus ?? 'unfunded',
    stats: cached?.stats ?? { matches: 0, kills: 0, deaths: 0, wins: 0 },
  });
  const reference = doc(getFirestore(initialized), 'players', user.uid);
  try {
    const existing = await getDoc(reference);
    if (existing.exists()) {
      await setDoc(reference, { handle: profile.handle, displayName: profile.displayName, anonymous: profile.anonymous, lastSeen: serverTimestamp() }, { merge: true });
    } else {
      await setDoc(reference, { handle: profile.handle, displayName: profile.displayName, avatarPath: '', anonymous: profile.anonymous, country: '', createdAt: serverTimestamp(), lastSeen: serverTimestamp(), walletStatus: 'unfunded', stats: { matches: 0, kills: 0, deaths: 0, wins: 0 } });
    }
  } catch {
    // The signed-in player can continue from the local profile while Firestore reconnects.
  }
}
