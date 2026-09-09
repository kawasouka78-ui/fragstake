'use client';
import { Users, Check, WifiOff } from 'lucide-react';
import type { NetworkSimulation } from '@/lib/live/client';
export default function LiveRoster({ game }: { game: NetworkSimulation }) {
  const snapshot = game.latest;
  if (!snapshot?.roster) return null;
  const remaining =
    game.capacity - snapshot.roster.filter((p) => !p.left).length;
  return (
    <section className="live-roster" aria-label="Match players">
      <div className="live-roster-heading">
        <h2>
          <Users size={17} /> IN THIS MATCH{' '}
          <span>
            {game.count} / {game.capacity}
          </span>
        </h2>
        <small>
          {snapshot.status === 'waiting'
            ? snapshot.roster.some((p) => p.you && p.ready)
              ? 'You’re ready. Waiting for the other players.'
              : 'Choose your loadout, then press Ready up.'
            : snapshot.mode === 'ffa'
              ? 'Free-for-all'
              : `Your team ${game.score} — ${game.enemyScore} Opponents`}
        </small>
      </div>
      <div className="live-roster-grid">
        {snapshot.roster.map((p) => (
          <div
            key={p.slot}
            className={
              'live-player ' +
              (p.you ? 'is-you' : '') +
              (p.left ? ' has-left' : '')
            }
          >
            <span className="live-player-avatar">
              {p.name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <b>
                {p.name}
                {p.you && <em>YOU</em>}
              </b>
              <small>
                {p.left
                  ? 'Left the match'
                  : !p.connected
                    ? 'Reconnecting…'
                    : p.ready
                      ? 'Ready'
                      : 'Choosing loadout'}
                {snapshot.mode !== 'ffa' && !p.left && ` · Team ${p.team + 1}`}
              </small>
            </span>
            {p.connected && p.ready && !p.left ? (
              <Check size={16} />
            ) : !p.connected && !p.left ? (
              <WifiOff size={16} />
            ) : (
              <i />
            )}
          </div>
        ))}
      </div>
      {remaining > 0 && snapshot.status === 'waiting' && (
        <p className="live-roster-spaces">
          {remaining} open {remaining === 1 ? 'place' : 'places'} ·{' '}
          {snapshot.mode === 'ffa'
            ? 'Starts with 2 ready players'
            : 'Everyone must be ready to start'}
        </p>
      )}
    </section>
  );
}
