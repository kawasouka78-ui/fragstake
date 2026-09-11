import { Crosshair, ArrowRight, ShieldCheck } from 'lucide-react';
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
        <strong>YOUR NAME.<br />YOUR RECORD.<br /><em>YOUR STAKES.</em></strong>
        <p>One verified player account connects your matches, inventory and squad across every device.</p>
      </div>
      <div className="signin-card">
        <div className="signin-card-mark"><Crosshair size={28} /></div>
        <small className="signin-eyebrow">PLAYER ACCESS</small>
        <h1>Enter FragStake</h1>
        <p>Sign in, finish your player setup, then enter the arena.</p>
        <SignInPanel />
        <small className="signin-trust">
          <ShieldCheck size={15} />
          Your account protects your identity, inventory and match history.
        </small>
      </div>
    </main>
  );
}
