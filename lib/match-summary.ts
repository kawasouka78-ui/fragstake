import {settlement} from './account-rules.ts';
import type {MatchConfig} from './game-rules.ts';

export type CombatStats={kills:number;deaths:number;score:number;enemyScore:number;headshots?:number;maxStreak?:number;elapsed?:number};
export function matchOutcome(config:MatchConfig,stats:CombatStats,ending:'cashout'|'leave'|'cancel'|'complete'){
 const settled=settlement({mode:config.mode,rate:config.rate,stake:Math.round((config.stake??10)*100),entry:Math.round((config.entry??0)*100),target:config.target,best_of:config.bestOf},{...stats,ending},Math.round(config.balance*100));
 return {net:settled.net/100,returned:settled.delta/100};
}
/** Only FFA has a cash-out preview. Duel scores must not be settled while the pause menu renders. */
export function ffaCashoutPreview(config:MatchConfig,stats:CombatStats){
 return config.mode==='ffa'?matchOutcome(config,stats,'cashout'):null;
}
export const signedEuros=(amount:number)=>`${amount<0?'−':amount>0?'+':''}€${Math.abs(amount).toFixed(2)}`;
export const matchDuration=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
