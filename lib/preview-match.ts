import {InputError,settlement} from './account-rules.ts';
import type {MatchRow} from '../db/service.ts';

/** Preview matches use the same cents, outcomes and forfeit rules as saved accounts. */
export function settlePreviewMatch(active:MatchRow,body:Record<string,unknown>,balance:number,now=Date.now()){
 if(body.id!==active.id)throw new InputError('This is not your active match.');
 if(active.status!=='active')throw new InputError('This match has already ended.');
 const value=settlement(active,body,balance);
 const saved:MatchRow={...active,kills:value.kills,deaths:value.deaths,score:value.score,enemy_score:value.enemyScore,headshots:value.headshots,max_streak:value.maxStreak,won:Number(value.won),delta:value.net,reason:value.reason,status:value.status,finished_at:now};
 return {saved,returned:value.delta};
}
