'use client';
import { useEffect, useState } from 'react';
import SiteHeader from './site-header';
import { Trophy, History, RefreshCw, Swords, Target, Crown } from 'lucide-react';
import { PageHeading, EmptyState } from './page-ui';
import { dateLabel, useAccount } from './account-context';
import { getMap } from '@/lib/fps/maps';
type Records = {
  leaders: {
    handle: string;
    name: string;
    matches: number;
    kills: number;
    deaths: number;
    wins: number;
  }[];
  recent: {
    id: string;
    mode: string;
    map_id: string;
    kills: number;
    deaths: number;
    won: number;
    completed: number;
    finished_at: number;
  }[];
  stats: {
    matches: number;
    kills: number;
    deaths: number;
    wins: number;
  } | null;
};
const rankColors = ['orange', 'blue', 'purple', 'green', 'pink'];
const formatKd = (kills: number, deaths: number) =>
  deaths ? (kills / deaths).toFixed(2) : kills ? `${kills}.00` : '0.00';
const winRate = (wins: number, matches: number) =>
  matches ? Math.round((wins / matches) * 100) : 0;
export default function PlayerRecords({
  history = false,
}: {
  history?: boolean;
}) {
  const { data } = useAccount(),
    [records, setRecords] = useState<Records | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/records', {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok)
        throw new Error('Records are unavailable. Please retry.');
      const next = (await response.json()) as Records;
      setRecords(next);
      setError('');
    } catch (e) {
      setRecords(null);
      setError('Match records are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [data?.player.id]);
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="main account-main">
        <PageHeading
          title={history ? 'History & stats' : 'Leaderboard'}
          description={
            history
              ? 'Your match results and performance.'
              : 'Player rankings, ordered by wins, then kills.'
          }
          action={
            <button
              className="secondary compact"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          }
        />
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="records-loading" role="status">
            Loading match records…
          </p>
        ) : error ? null : history && !data ? (
          <EmptyState
            icon={<History size={26} />}
            title="Your match history"
            action={
              <a className="primary" href="/signin">
                Sign in
              </a>
            }
          >
            Sign in before playing to save your results and track your
            performance.
          </EmptyState>
        ) : history ? (
          <>
            {records?.stats && (
              <div className="real-stats">
                {Object.entries(records.stats)
                  .filter(([key]) =>
                    ['matches', 'kills', 'deaths', 'wins'].includes(key),
                  )
                  .map(([key, value]) => (
                    <div key={key}>
                      <strong>{value}</strong>
                      {key.toUpperCase()}
                    </div>
                  ))}
              </div>
            )}
            {records?.recent.length ? (
              <table className="real-record">
                <thead>
                  <tr>
                    <th>Match</th>
                    <th>K / D</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {records.recent.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {getMap(row.map_id).name}
                        <small style={{ display: 'block' }}>
                          {row.mode.toUpperCase()} ·{' '}
                          {dateLabel(row.finished_at)}
                        </small>
                      </td>
                      <td>
                        {row.kills} / {row.deaths}
                      </td>
                      <td>
                        {!row.completed
                          ? 'Left early'
                          : row.won
                            ? 'Won'
                            : 'Completed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                icon={<History size={26} />}
                title="No matches yet"
                action={
                  <a className="primary" href="/play">
                    Find a match
                  </a>
                }
              >
                Your completed matches will appear here.
              </EmptyState>
            )}
          </>
        ) : records?.leaders.length ? (
          <section className="leaderboard-page">
            <div className="leaderboard-hero">
              <div>
                <span className="leaderboard-kicker">
                  <Trophy size={16} /> Season leaderboard
                </span>
                <h2>Top fighters this week</h2>
                <p>
                  Rankings update from completed matches. Wins lead the board,
                  then eliminations decide the tie.
                </p>
              </div>
              <a className="primary compact" href="/play">
                Find a money match
              </a>
            </div>
            <div className="leader-podium" aria-label="Top ranked players">
              {records.leaders.slice(0, 3).map((row, i) => (
                <article
                  className={'leader-podium-card rank-card-' + (i + 1)}
                  key={row.handle}
                >
                  <span className="leader-medal">
                    {i === 0 ? <Crown size={18} /> : '#' + (i + 1)}
                  </span>
                  <div className="leader-identity">
                    <span
                      className={
                        'player-avatar color-' +
                        rankColors[i % rankColors.length]
                      }
                    >
                      {row.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h3>{row.name}</h3>
                      <p>@{row.handle}</p>
                    </div>
                  </div>
                  <div className="leader-card-stats">
                    <span>
                      <b>{row.wins}</b>
                      wins
                    </span>
                    <span>
                      <b>{row.kills}</b>
                      kills
                    </span>
                    <span>
                      <b>{formatKd(row.kills, row.deaths)}</b>
                      K/D
                    </span>
                  </div>
                </article>
              ))}
            </div>
            <div className="leaderboard-table-wrap">
              <div className="leaderboard-table-head">
                <h2>All players</h2>
                <span>{records.leaders.length} ranked</span>
              </div>
              <table className="real-record leaderboard-record">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Wins</th>
                    <th>Kills</th>
                    <th>K/D</th>
                    <th>Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {records.leaders.map((row, i) => (
                    <tr key={row.handle}>
                      <td>
                        <span className={'leader-rank rank-' + (i + 1)}>
                          {i < 3 ? <Trophy size={15} /> : null}
                          #{i + 1}
                        </span>
                      </td>
                      <td>
                        <span className="leader-table-player">
                          <span
                            className={
                              'player-avatar color-' +
                              rankColors[i % rankColors.length]
                            }
                          >
                            {row.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span>
                            <b>{row.name}</b>
                            <small>@{row.handle}</small>
                          </span>
                        </span>
                      </td>
                      <td>{row.wins}</td>
                      <td>{row.kills}</td>
                      <td>{formatKd(row.kills, row.deaths)}</td>
                      <td>
                        <span className="leader-win-rate">
                          <i
                            style={{
                              width: `${winRate(row.wins, row.matches)}%`,
                            }}
                          />
                        </span>
                        <small>{winRate(row.wins, row.matches)}%</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="leaderboard-footer-cards">
              <div>
                <Swords size={18} />
                <span>
                  <b>FFA and duels count</b>
                  Practice stays separate from paid rankings.
                </span>
              </div>
              <div>
                <Target size={18} />
                <span>
                  <b>Skill first</b>
                  More wins, cleaner fights, better position.
                </span>
              </div>
            </div>
          </section>
        ) : (
          <EmptyState
            icon={<Trophy size={26} />}
            title="No rankings yet"
            action={
              <a className="primary" href="/play">
                Find a match
              </a>
            }
          >
            Rankings appear once signed-in players complete matches.
          </EmptyState>
        )}
      </main>
    </div>
  );
}
