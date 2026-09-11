'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  firebaseEnabled,
  onFirebaseUserChange,
  signInWithGoogle,
} from '@/lib/firebase-client';

export default function SignInPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    () =>
      onFirebaseUserChange((user) => {
        if (user) window.location.href = '/play';
      }),
    [],
  );

  async function signIn() {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
      setBusy(false);
    }
  }

  if (!firebaseEnabled()) {
    return (
      <p className="error-text">
        Firebase sign-in is not configured on this deployment yet.
      </p>
    );
  }

  return (
    <>
      <button className="primary" onClick={() => void signIn()} disabled={busy}>
        {busy ? 'Opening Google...' : 'Sign in with Google'}
        <ArrowRight size={18} />
      </button>
      {error && <p className="error-text">{error}</p>}
    </>
  );
}
