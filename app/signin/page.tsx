import { Crosshair, ArrowRight, ShieldCheck } from 'lucide-react';
import SignInPanel from './signin-panel';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in | FragStake' };
export default function Page() {
  return (
    <main className="signin-page">
      <div className="signin-card">
        <Crosshair size={48} />
        <h1>Sign in to FragStake</h1>
        <p>
          Sign in to save your profile, find friends, and keep your match record
          across devices.
        </p>
        <SignInPanel />
        <small>
          <ShieldCheck size={15} />
          A real account is required for wallet, social, shop and saved match
          progress.
        </small>
      </div>
    </main>
  );
}
