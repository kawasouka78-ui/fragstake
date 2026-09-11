import {Pause,Skull} from 'lucide-react';
import type {Simulation} from '@/lib/fps/simulation';
import type {MatchConfig} from '@/lib/game-rules';
import {matchDuration,matchOutcome,signedEuros} from '@/lib/match-summary';

export default function PausedSession({game,config}:{game:Simulation;config:MatchConfig}){
 const stats={kills:game.player.kills,deaths:game.player.deaths,headshots:game.headshots,maxStreak:game.maxStreak,score:game.score,enemyScore:game.enemyScore};
 const outcome=matchOutcome(config,stats,config.mode==='ffa'?'cashout':'leave');
 return <section className="paused-session" aria-label="Paused match summary">
  <div className="paused-session-heading"><span><Pause size={14}/> MATCH FROZEN</span><p>Players, match time and respawns stay paused until you resume.</p></div>
  <div className="paused-session-body">
   {config.mode==='ffa'&&<div className="paused-session-money"><span>SESSION {outcome.net<0?'LOSS':outcome.net>0?'PROFIT':'NET'}</span><strong className={outcome.net<0?'session-loss':'session-gain'}>{signedEuros(outcome.net)}</strong><small>{outcome.returned<0?'Wallet deduction':'Back to wallet'} <b>€{Math.abs(outcome.returned).toFixed(2)}</b></small></div>}
   <dl className="paused-session-stats">{[['Kills',stats.kills],['Deaths',stats.deaths],['K/D',(stats.kills/Math.max(1,stats.deaths)).toFixed(2)],['Headshots',stats.headshots],['Best streak',stats.maxStreak],['Time played',matchDuration(game.elapsed)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </div>
  {config.mode==='ffa'&&game.player.hp<=0&&<p className="paused-death"><Skull size={15}/> Last death <b>{signedEuros(-game.lastDeathLoss)}</b> · Included in your total. You can cash out now.</p>}
  {config.mode==='duel'&&<p className="paused-forfeit">Leaving forfeits your €{(config.stake??10).toFixed(2)} stake. Resume to finish the duel.</p>}
 </section>;
}
