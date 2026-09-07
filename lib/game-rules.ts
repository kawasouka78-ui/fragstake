export type Mode = 'practice' | 'ffa' | 'duel';
export type MatchConfig = { mode: Mode; rate: number; team: '1v1' | '2v2'; balance: number };
export type Result = { kills:number; deaths:number; balance:number; reason:string; won:boolean; score:number; enemyScore:number };
export function canEnter(c:MatchConfig){return Number.isFinite(c.balance) && c.balance >= (c.mode==='duel'?10:c.mode==='ffa'?c.rate:0);}
export function killBalance(balance:number,mode:Mode,rate:number){return mode==='ffa'?balance+rate:balance;}
export function deathBalance(balance:number,mode:Mode,rate:number){return mode==='ffa'?Math.max(0,balance-rate):balance;}
export function duelPayout(won:boolean,draw:boolean){return won?20:draw?10:0;}
