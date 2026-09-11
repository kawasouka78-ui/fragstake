'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Crosshair } from 'lucide-react';
import { onFirebaseUserChange } from '@/lib/firebase-client';

const publicPages = new Set(['/', '/signin', '/privacy', '/rules', '/support']);

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const isPublic = publicPages.has(pathname);

  useEffect(
    () =>
      onFirebaseUserChange((user) => {
        setSignedIn(!!user);
        setAuthReady(true);
      }),
    [],
  );

  useEffect(() => {
    if (!authReady || isPublic) return;
    if (!signedIn) {
      location.replace(`/signin?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
  }, [authReady, isPublic, pathname, signedIn]);

  if (isPublic) return children;
  if (!authReady || !signedIn) {
    return (
      <main className="auth-loading" role="status" aria-live="polite">
        <span className="auth-loading-mark"><Crosshair /></span>
        <strong>Securing your session</strong>
        <small>Connecting your FragStake account…</small>
      </main>
    );
  }
  return children;
}
