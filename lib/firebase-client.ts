'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
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

export async function signOutFirebase() {
  const auth = firebaseAuth();
  if (auth) await signOut(auth);
}

export async function firebaseIdToken() {
  const user = firebaseAuth()?.currentUser;
  return user ? user.getIdToken() : null;
}
