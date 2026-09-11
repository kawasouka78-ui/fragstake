'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Check, LogOut, ShieldCheck } from 'lucide-react';
import {
  firebaseEnabled,
  loadFirebaseProfile,
  onFirebaseUserChange,
  saveFirebaseProfile,
  signInWithGoogle,
  signOutFirebase,
} from '@/lib/firebase-client';
import { useAccount } from '../account-context';
import { safeReturnTo } from '@/lib/onboarding';

export default function SignInPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [visibility, setVisibility] = useState<'visible' | 'anonymous'>('visible');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const { saveProfilePrefs } = useAccount();
  const returnTo = useMemo(() => {
    if (typeof location === 'undefined') return '/play';
    return safeReturnTo(new URLSearchParams(location.search).get('returnTo'));
  }, []);

  useEffect(() => onFirebaseUserChange(async (user) => {
    setChecking(true);
    setUserEmail(user?.email ?? '');
    if (!user) {
      setOnboarding(false);
      setChecking(false);
      return;
    }
    try {
      const profile = await loadFirebaseProfile();
      if (!profile) {
        const suggested = (user.displayName || user.email?.split('@')[0] || '')
          .replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 32);
        setDisplayName(suggested.length >= 2 ? suggested : 'New Player');
        setHandle((suggested || 'player').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20));
        setOnboarding(true);
      } else {
        location.replace(returnTo);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your player account.');
    } finally {
      setChecking(false);
    }
  }), [returnTo]);

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

  async function finishOnboarding(event: FormEvent) {
    event.preventDefault();
    if (!adult || !terms) {
      setError('Confirm your age and accept the platform rules to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveFirebaseProfile({
        displayName,
        handle,
        anonymous: visibility === 'anonymous',
      });
      saveProfilePrefs({ avatar: '', anonymous: visibility === 'anonymous' });
      location.replace(returnTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish your profile.');
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

  if (checking) {
    return <div className="signin-checking" role="status"><i /><span>Checking your account…</span></div>;
  }

  if (onboarding) {
    return (
      <form className="onboarding-form" onSubmit={finishOnboarding}>
        <div className="onboarding-account">
          <span><Check size={15} /></span>
          <div><small>GOOGLE ACCOUNT CONNECTED</small><b>{userEmail}</b></div>
          <button type="button" aria-label="Use a different account" onClick={() => void signOutFirebase()}><LogOut size={16} /></button>
        </div>
        <div className="onboarding-heading">
          <small>PLAYER SETUP · 2 OF 2</small>
          <h2>Build your identity</h2>
        </div>
        <label>
          <span>Display name</span>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={32} autoComplete="nickname" required />
        </label>
        <label>
          <span>Unique handle</span>
          <div className="handle-field"><i>@</i><input value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} minLength={3} maxLength={20} pattern="[a-z0-9_]+" required /></div>
        </label>
        <fieldset className="visibility-choice">
          <legend>Public match identity</legend>
          <button type="button" aria-pressed={visibility === 'visible'} onClick={() => setVisibility('visible')}><b>Visible</b><small>Players see your name</small></button>
          <button type="button" aria-pressed={visibility === 'anonymous'} onClick={() => setVisibility('anonymous')}><b>Anonymous</b><small>Shown as Anonymous Player</small></button>
        </fieldset>
        <label className="onboarding-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} /><span>I confirm that I am at least 18 years old.</span></label>
        <label className="onboarding-check"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /><span>I accept the <a href="/rules" target="_blank">platform rules</a> and <a href="/privacy" target="_blank">privacy policy</a>.</span></label>
        <button className="primary onboarding-submit" disabled={busy}>
          {busy ? 'Creating player…' : 'Enter the arena'} <ArrowRight size={18} />
        </button>
        {error && <p className="error-text" role="alert">{error}</p>}
      </form>
    );
  }

  return (
    <>
      <button className="primary signin-google" onClick={() => void signIn()} disabled={busy}>
        <span className="google-mark">G</span>
        {busy ? 'Opening Google…' : 'Continue with Google'}
        <ArrowRight size={18} />
      </button>
      <p className="signin-access-note"><ShieldCheck size={14} /> An account is required to enter the platform.</p>
      {error && <p className="error-text" role="alert">{error}</p>}
    </>
  );
}
