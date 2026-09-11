'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  firebaseWebConfig,
  hasFirebaseConfig,
} from './firebase-config';

let app: FirebaseApp | null = null;

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

export function onFirebaseUserChange(callback: (user: User | null) => void) {
  const auth = firebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  const auth = firebaseAuth();
  if (!auth) throw new Error('Firebase sign-in is not configured yet.');
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signInWithEmail(email: string, password: string) {
  const auth = firebaseAuth();
  if (!auth) throw new Error('Firebase sign-in is not configured yet.');
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function createEmailAccount(email: string, password: string) {
  const auth = firebaseAuth();
  if (!auth) throw new Error('Firebase sign-in is not configured yet.');
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

export async function loadFirebaseProfile() {
  const user = firebaseAuth()?.currentUser;
  const initialized = firebaseApp();
  if (!user || !initialized) return null;
  const snapshot = await getDoc(doc(getFirestore(initialized), 'players', user.uid));
  return snapshot.exists() ? (snapshot.data() as FirebasePlayerProfile) : null;
}

export async function saveFirebaseProfile(profile: Pick<FirebasePlayerProfile, 'handle' | 'displayName' | 'anonymous'>) {
  const user = firebaseAuth()?.currentUser;
  const initialized = firebaseApp();
  if (!user || !initialized) throw new Error('Sign in again to finish your profile.');
  const reference = doc(getFirestore(initialized), 'players', user.uid);
  const existing = await getDoc(reference);
  if (existing.exists()) {
    await setDoc(reference, {
      handle: profile.handle,
      displayName: profile.displayName,
      anonymous: profile.anonymous,
      lastSeen: serverTimestamp(),
    }, { merge: true });
  } else {
    await setDoc(reference, {
      handle: profile.handle,
      displayName: profile.displayName,
      avatarPath: '',
      anonymous: profile.anonymous,
      country: '',
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      walletStatus: 'unfunded',
      stats: { matches: 0, kills: 0, deaths: 0, wins: 0 },
    });
  }
}
