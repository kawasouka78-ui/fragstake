'use client';
import { useEffect, useState } from 'react';
import { Target, Trophy, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import SiteHeader from '../site-header';
import { accountApi, useAccount } from '../account-context';
import type { progression } from '@/db/live';
import '../live-platform.css';
type Progress = Awaited<ReturnType<typeof progression>>;
export default function Progression() {
  const { data } = useAccount(),
    [progress, setProgress] = useState<Progress | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (!data) return;
    void accountApi<Progress>(undefined, '?action=progression')
      .then(setProgress)
      .catch((e) => setError(e.message));
  }, [data?.player.id]);
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="main">
        <div className="page-heading">
          <div>
            <span className="eyebrow">YOUR NEXT CHALLENGE</span>
            <h1>
              MAKE EVERY ROUND COUNT<span>.</span>
            </h1>
            <p>Build your record in live multiplayer.</p>
          </div>
        </div>
        <section className="progress-hero">
          <div className="progress-level">
            <Zap />
            <span>LEVEL</span>
            <strong>{progress?.level || 1}</strong>
          </div>
          <div>
            <span className="eyebrow">YOUR JOURNEY</span>
            <h2>
              {progress?.total.xp
                ? `${progress.total.xp.toLocaleString('en-GB')} XP EARNED`
                : 'YOUR FIRST ROUND STARTS HERE.'}
            </h2>
            <progress max={1000} value={(progress?.total.xp || 0) % 1000} />
            <p>{progress?.nextLevel || 1000} XP to the next level</p>
          </div>
          <a className="primary" href="/">
            PLAY LIVE <ArrowRight size={17} />
          </a>
        </section>
        {!data && (
          <p className="live-note">
            Sign in to save XP, achievements and your match record.{' '}
            <a href="/signin">Sign in →</a>
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="section-heading">
          <h2>
            <Target size={18} /> TODAY’S GOALS
          </h2>
          <span>RESETS AT 00:00 UTC</span>
        </div>
        <div className="challenge-grid">
          {[
            {
              title: 'Get in the game',
              detail: 'Finish 3 live matches',
              key: 'matches',
              goal: 3,
            },
            {
              title: 'Find your rhythm',
              detail: 'Get 20 eliminations',
              key: 'kills',
              goal: 20,
            },
            {
              title: 'Take the win',
              detail: 'Win a live match',
              key: 'wins',
              goal: 1,
            },
          ].map((c) => {
            const n = progress?.today[c.key] || 0;
            return (
              <article className="challenge-card" key={c.key}>
                <Target />
                <h3>{c.title}</h3>
                <p>{c.detail}</p>
                <progress max={c.goal} value={Math.min(n, c.goal)} />
                <b>
                  {Math.min(n, c.goal)} / {c.goal}
                </b>
                <span>{n >= c.goal ? 'COMPLETE' : 'IN PROGRESS'}</span>
              </article>
            );
          })}
        </div>
        <div className="section-heading">
          <h2>
            <Trophy size={18} /> ACHIEVEMENTS
          </h2>
        </div>
        <div className="achievement-grid">
          {(
            progress?.achievements || [
              { name: 'First deployment', goal: 1, value: 0 },
              { name: 'Sharpshooter', goal: 25, value: 0 },
              { name: 'Centurion', goal: 100, value: 0 },
              { name: 'On a roll', goal: 5, value: 0 },
              { name: 'Winner’s circle', goal: 10, value: 0 },
            ]
          ).map((a) => (
            <article
              key={a.name}
              className={a.value >= a.goal ? 'unlocked' : ''}
            >
              <Trophy />
              <h3>{a.name}</h3>
              <p>
                {Math.min(a.value, a.goal)} / {a.goal}
              </p>
              <span>{a.value >= a.goal ? 'UNLOCKED' : 'LOCKED'}</span>
            </article>
          ))}
        </div>
        <section className="account-panel">
          <h2>
            <ShieldCheck size={20} /> VERIFIED LEADERBOARD
          </h2>
          <p>
            Human matches scored by the game server. Demo bot results stay
            separate.
          </p>
          <div className="live-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>XP</th>
                  <th>Kills</th>
                  <th>Wins</th>
                </tr>
              </thead>
              <tbody>
                {(progress?.leaders || []).map((row: any, i) => (
                  <tr key={row.handle}>
                    <td>{i + 1}</td>
                    <td>{row.name}</td>
                    <td>{row.xp}</td>
                    <td>{row.kills}</td>
                    <td>{row.wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!progress?.leaders.length && (
            <p className="platform-empty">
              No verified results yet. Finish a live match to begin.
            </p>
          )}
        </section>
        <section className="account-panel">
          <h2>RECENT LIVE MATCHES</h2>
          {progress?.recent.length ? (
            progress.recent.map((row: any) => (
              <div className="platform-list-row" key={row.id}>
                <div>
                  <b>
                    {row.mode.toUpperCase()} · {row.map_id.toUpperCase()}
                  </b>
                  <p>
                    {row.kills} kills · {row.deaths} deaths ·{' '}
                    {row.completed ? 'Completed' : 'Left early'}
                  </p>
                </div>
                <strong>+{row.xp} XP</strong>
              </div>
            ))
          ) : (
            <p>No live matches recorded yet.</p>
          )}
        </section>
        <p className="live-note">
          Complete at least 30 seconds of a live match for 100 XP, plus 10 per
          elimination (up to 50), and 50 for a win. Daily goals and achievements
          track milestones; they do not grant extra currency.
        </p>
      </main>
    </div>
  );
}
