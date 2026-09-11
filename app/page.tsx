import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Crosshair,
  Zap,
  Swords,
} from 'lucide-react';
import LandingHeader from './landing-header';
export default function Home() {
  return (
    <div className="launch-site">
      <LandingHeader />
      <main>
        <section className="launch-hero">
          <div className="launch-hero-copy">
            <span className="launch-kicker launch-cash-kicker">
              CASH MATCHES · COMING SOON
            </span>
            <h1>
              Fight for
              <br />
              <em>real money.</em>
            </h1>
            <p>
              Win the pot in duels. Earn per elimination in cash FFA. FragStake
              is building a competitive FPS with money on the line.
            </p>
            <div className="launch-actions">
              <Link className="primary" href="/play">
                Play free now <ArrowRight size={19} />
              </Link>
              <a className="launch-text-link" href="#how-to-play">
                How it works ↓
              </a>
            </div>
            <span className="launch-small">
              Paid entry and withdrawals are not live yet. Current matches are
              free.
            </span>
          </div>
          <div className="launch-hero-map">
            <span>CITADEL / 01</span>
            <p>
              Citadel
              <br />
              <small>Enclosed corridors. Connected rooms.</small>
            </p>
          </div>
        </section>
        <section
          className="launch-stakes-modes"
          aria-label="Free and planned cash modes"
        >
          <article>
            <div className="stakes-mode-heading">
              <Crosshair size={21} />
              <h2>Practice</h2>
              <span className="stakes-available">Free to play</span>
            </div>
            <p>
              Learn the maps and warm up against other players. No money at
              stake.
            </p>
          </article>
          <article>
            <div className="stakes-mode-heading">
              <Zap size={21} />
              <h2>Cash FFA</h2>
              <span>Coming soon</span>
            </div>
            <p>
              The planned format: earn money for each kill and lose the same
              amount for each death.
            </p>
          </article>
          <article>
            <div className="stakes-mode-heading">
              <Swords size={21} />
              <h2>Staked duels</h2>
              <span>Coming soon</span>
            </div>
            <p>
              The planned format: both sides put money in. The winning side
              takes the pot in 1v1 or 2v2.
            </p>
          </article>
        </section>
        <section id="how-to-play" className="launch-how">
          <div>
            <span className="launch-kicker">START WITH FREE MATCHES</span>
            <h2>
              Three steps.
              <br />
              Then you’re in.
            </h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Choose your match</h3>
                <p>Start a player room or join an open match.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Pick your weapon</h3>
                <p>Choose your primary weapon. Your knife comes with you.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Ready up</h3>
                <p>
                  The round starts when enough players are ready. Sign in to
                  keep your record.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="launch-fair">
          <ShieldCheck />
          <div>
            <h2>Same weapons. Same rules.</h2>
            <p>
              The match server controls movement, hits and results. Weapon
              finishes never change damage.
            </p>
          </div>
          <Link href="/rules">
            Read the rules <ArrowUpRight size={16} />
          </Link>
        </section>
        <section className="launch-funding">
          <h2>Real stakes. A launch that has to be ready.</h2>
          <p>
            Cash matches are in development. Crypto deposits, withdrawals and
            paid entry will only open in approved locations after payment
            processing and eligibility checks are ready. For now, every match is
            free.
          </p>
        </section>
      </main>
      <footer className="launch-footer">
        <Link className="launch-brand" href="/">
          FRAG<span>STAKE</span>
        </Link>
        <nav aria-label="Information">
          <Link href="/rules">Game rules</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/support">Support</Link>
        </nav>
        <span>© {new Date().getFullYear()} FragStake</span>
      </footer>
    </div>
  );
}
