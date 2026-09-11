'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import {
  createEmailAccount,
  firebaseEnabled,
  loadFirebaseProfile,
  onFirebaseUserChange,
  resetEmailPassword,
  saveFirebaseProfile,
  signInWithEmail,
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
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [visibility, setVisibility] = useState<'visible' | 'anonymous'>('visible');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [emailMode, setEmailMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
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

  function friendlyAuthError(value: unknown) {
    const message = value instanceof Error ? value.message : '';
    if (message.includes('invalid-credential')) return 'That email or password is incorrect.';
    if (message.includes('email-already-in-use')) return 'An account already exists for that email. Sign in instead.';
    if (message.includes('weak-password')) return 'Use a password with at least 6 characters.';
    if (message.includes('invalid-email')) return 'Enter a valid email address.';
    if (message.includes('too-many-requests')) return 'Too many attempts. Wait a moment and try again.';
    if (message.includes('operation-not-allowed')) return 'Email sign-in must be enabled in Firebase Authentication first.';
    return message || 'Could not sign in. Try again.';
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (emailMode === 'create') await createEmailAccount(email, password);
      else await signInWithEmail(email, password);
    } catch (value) {
      setError(friendlyAuthError(value));
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      setError('Enter your email first, then choose Forgot password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await resetEmailPassword(email);
      setNotice('Password reset email sent. Check your inbox.');
    } catch (value) {
      setError(friendlyAuthError(value));
    } finally {
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

  async function submitOnboarding(event: FormEvent) {
    if (onboardingStep < 3) {
      event.preventDefault();
      setError('');
      setOnboardingStep(onboardingStep === 1 ? 2 : 3);
      return;
    }
    await finishOnboarding(event);
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
      <form className="onboarding-form onboarding-multistep" onSubmit={submitOnboarding}>
        <header className="onboarding-topline">
          <ol className="onboarding-progress" aria-label={`Player setup, step ${onboardingStep} of 3`}>
            {(['CALLSIGN', 'VISIBILITY', 'CONFIRM'] as const).map((label, index) => {
              const number = (index + 1) as 1 | 2 | 3;
              return <li key={label} data-active={number === onboardingStep} data-complete={number < onboardingStep}><span>{number < onboardingStep ? <Check size={12} /> : `0${number}`}</span><b>{label}</b></li>;
            })}
          </ol>
          <div className="onboarding-account">
            <span><Check size={14} /></span>
            <div><small>CONNECTED AS</small><b>{userEmail}</b></div>
            <button type="button" aria-label="Use a different account" title="Use a different account" onClick={() => void signOutFirebase()}><LogOut size={16} /></button>
          </div>
        </header>

        <div className="onboarding-step-content">
          {onboardingStep === 1 && (
            <section className="onboarding-screen" aria-labelledby="callsign-title">
              <div className="onboarding-heading">
                <small>STEP 1 OF 3</small>
                <h2 id="callsign-title">Choose your callsign.</h2>
                <p>Set the name other players will remember.</p>
              </div>
              <div className="callsign-layout">
                <div className="onboarding-fields" aria-label="Player identity details">
                  <label>
                    <span>Display name <small>2–32 characters</small></span>
                    <input value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={32} autoComplete="nickname" placeholder="How players know you" required autoFocus />
                  </label>
                  <label>
                    <span>Player handle <small>Unique account tag</small></span>
                    <div className="handle-field"><i>@</i><input value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} minLength={3} maxLength={20} pattern="[a-z0-9_]+" placeholder="your_handle" required /></div>
                  </label>
                </div>
                <aside className="step-player-preview" aria-label="Player card preview">
                  <div className="step-preview-avatar"><UserRound size={30} /></div>
                  <div className="preview-identity"><small>YOUR PLAYER CARD</small><strong>{displayName.trim() || 'YOUR CALLSIGN'}</strong><span>@{handle || 'your_handle'}</span></div>
                </aside>
              </div>
            </section>
          )}

          {onboardingStep === 2 && (
            <section className="onboarding-screen" aria-labelledby="visibility-title">
              <div className="onboarding-heading">
                <small>STEP 2 OF 3</small>
                <h2 id="visibility-title">Choose how you appear.</h2>
                <p>You can change this later from your profile.</p>
              </div>
              <fieldset className="visibility-choice step-visibility">
                <legend className="sr-only">Match visibility</legend>
                <button type="button" aria-pressed={visibility === 'visible'} onClick={() => setVisibility('visible')}>
                  <Eye size={24} /><span><b>Public callsign</b><small>Players see {displayName.trim() || 'your name'} and @{handle || 'your_handle'}.</small></span><Check className="choice-check" size={17} />
                </button>
                <button type="button" aria-pressed={visibility === 'anonymous'} onClick={() => setVisibility('anonymous')}>
                  <EyeOff size={24} /><span><b>Anonymous player</b><small>Your name and account tag stay hidden in matches.</small></span><Check className="choice-check" size={17} />
                </button>
              </fieldset>
              <div className="visibility-result"><span>Match preview</span><b>{visibility === 'anonymous' ? 'ANONYMOUS PLAYER' : displayName.trim() || 'YOUR CALLSIGN'}</b><small>{visibility === 'anonymous' ? 'IDENTITY HIDDEN' : `@${handle || 'your_handle'}`}</small></div>
            </section>
          )}

          {onboardingStep === 3 && (
            <section className="onboarding-screen" aria-labelledby="confirm-title">
              <div className="onboarding-heading">
                <small>STEP 3 OF 3</small>
                <h2 id="confirm-title">Ready to enter?</h2>
                <p>Confirm the essentials before your first match.</p>
              </div>
              <div className="onboarding-summary"><div><span>CALLSIGN</span><b>{displayName}</b><small>@{handle}</small></div><div><span>IN MATCHES</span><b>{visibility === 'anonymous' ? 'Anonymous' : 'Public'}</b><small>Change anytime</small></div></div>
              <div className="onboarding-confirmations">
                <label className="onboarding-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} /><span><b>I am 18 or older</b>Cash matches are restricted to adults.</span></label>
                <label className="onboarding-check"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /><span><b>I accept the platform rules</b>I agree to the <a href="/rules" target="_blank" rel="noreferrer">rules</a> and <a href="/privacy" target="_blank" rel="noreferrer">privacy policy</a>.</span></label>
              </div>
            </section>
          )}
        </div>

        <footer className="onboarding-actions">
          {onboardingStep > 1 ? <button className="onboarding-back" type="button" onClick={() => { setError(''); setOnboardingStep(onboardingStep === 3 ? 2 : 1); }}><ArrowLeft size={17} /> Back</button> : <span><ShieldCheck size={16} /> Protected player account</span>}
          <button className="primary onboarding-submit" disabled={busy}>
            {busy ? 'Creating player…' : onboardingStep === 3 ? 'Enter FragStake' : 'Continue'} <ArrowRight size={18} />
          </button>
        </footer>
        {error && <p className="error-text onboarding-error" role="alert">{error}</p>}
      </form>
    );
  }

  return (
    <>
      <div className="signin-method-tabs" role="tablist" aria-label="Email account action">
        <button type="button" role="tab" aria-selected={emailMode === 'signin'} onClick={() => { setEmailMode('signin'); setError(''); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={emailMode === 'create'} onClick={() => { setEmailMode('create'); setError(''); }}>Create account</button>
      </div>
      <form className="signin-email-form" onSubmit={submitEmail}>
        <label><span>Email</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
        <label><span>Password</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={emailMode === 'create' ? 'new-password' : 'current-password'} placeholder={emailMode === 'create' ? 'At least 6 characters' : 'Your password'} minLength={6} required /></label>
        {emailMode === 'signin' && <button className="signin-forgot" type="button" onClick={() => void forgotPassword()} disabled={busy}>Forgot password?</button>}
        <button className="primary signin-email-submit" disabled={busy}>
          {busy ? 'Please wait…' : emailMode === 'create' ? 'Create account' : 'Sign in'} <ArrowRight size={18} />
        </button>
      </form>
      <div className="signin-divider"><span>or</span></div>
      <button className="primary signin-google" onClick={() => void signIn()} disabled={busy}>
        <span className="google-mark">G</span>
        {busy ? 'Opening Google…' : 'Continue with Google'}
        <ArrowRight size={18} />
      </button>
      <p className="signin-access-note"><ShieldCheck size={14} /> An account is required to enter the platform.</p>
      {notice && <p className="signin-notice" role="status">{notice}</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
    </>
  );
}
