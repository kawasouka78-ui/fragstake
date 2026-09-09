import type { Result } from '@/lib/game-rules';
import { Trophy, Swords } from 'lucide-react';

export default function LiveMatchResult({ result }: { result: Result }) {
  if (!result.standings?.length) return null;
  const duel = result.liveMode !== 'ffa';
  return (
    <section className="live-result" aria-label="Final match standings">
      <div className={'live-result-score ' + (result.won ? 'victory' : '')}>
        {duel ? <Swords size={26} /> : <Trophy size={26} />}
        <span>{duel ? 'FINAL TEAM SCORE' : 'YOUR POSITION'}</span>
        <strong>
          {duel
            ? `${result.score} — ${result.enemyScore}`
            : `#${result.placement}`}
        </strong>
        <small>
          {duel
            ? 'Your team · Opponents'
            : `of ${result.standings.length} players · Ties share a position`}
        </small>
      </div>
      <details className="result-standings">
        <summary>Final scoreboard</summary>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Kills</th>
              <th>Deaths</th>
              <th>K/D</th>
            </tr>
          </thead>
          <tbody>
            {result.standings.map((player) => (
              <tr key={player.id} className={player.you ? 'is-you' : ''}>
                <td>
                  <b>{player.name}</b>
                  <small>
                    {player.you
                      ? 'YOU'
                      : duel
                        ? `TEAM ${player.team + 1}`
                        : 'PLAYER'}
                  </small>
                </td>
                <td>{player.kills}</td>
                <td>{player.deaths}</td>
                <td>
                  {(player.kills / Math.max(1, player.deaths)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
