'use client';
import { AccountProvider } from './account-context';
import AuthGate from './auth-gate';

export default function AccountProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountProvider>
      <AuthGate>{children}</AuthGate>
    </AccountProvider>
  );
}
