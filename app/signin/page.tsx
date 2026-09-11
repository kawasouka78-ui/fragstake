import { Crosshair } from 'lucide-react';
import SignInPanel from './signin-panel';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in | FragStake' };
export default function Page() {
  return (
    <main className="signin-page">
      <a className="signin-brand" href="/" aria-label="FragStake home">
        <span><Crosshair size={22} /></span>
        <b>FRAG<em>STAKE</em></b>
      </a>
      <div className="signin-stage" aria-hidden="true">
        <span>01</span><span>IDENTITY</span><i />
        <strong>MAKE A NAME.<br />TAKE THE <em>POT.</em></strong>
        <p>Your callsign follows every match, win and payout.</p>
      </div>
      <div className="signin-card">
        <div className="signin-card-mark"><Crosshair size={28} /></div>
        <small className="signin-eyebrow">PLAYER ACCESS</small>
        <h1>Enter FragStake</h1>
        <p>Sign in, finish your player setup, then enter the arena.</p>
        <SignInPanel />
      </div>
    </main>
  );
}
