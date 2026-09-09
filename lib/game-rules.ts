export type Mode = 'practice' | 'ffa' | 'duel';
export type MatchConfig = { mode: Mode; rate: number; team: '1v1' | '2v2'; balance: number; mapId?:string;stake?:number;target?:number;bestOf?:number;weaponRule?:string;entry?:number;skin?:string;live?:{ticket:string;url:string;mode:'ffa'|'1v1'|'2v2';guest:boolean} };
export type Result = { liveMode?:'ffa'|'1v1'|'2v2';placement?:number;standings?:{id:number;name:string;team:number;you:boolean;kills:number;deaths:number}[];live?:boolean;liveGuest?:boolean;kills:number; deaths:number; balance:number; reason:string; won:boolean; score:number; enemyScore:number;headshots?:number;maxStreak?:number;elapsed?:number;net?:number;returned?:number;walletBalance?:number;mode?:Mode;mapId?:string;rate?:number;entry?:number;lastDeathLoss?:number };
export function canEnter(c:MatchConfig){return Number.isFinite(c.balance) && c.balance >= (c.mode==='duel'?(c.stake??10):c.mode==='ffa'?(c.entry||c.rate):0);}
export function killBalance(balance:number,mode:Mode,rate:number){return mode==='ffa'?balance+rate:balance;}
export function deathBalance(balance:number,mode:Mode,rate:number){return mode==='ffa'?Math.max(0,balance-rate):balance;}
export function duelPayout(won:boolean,draw:boolean){return won?20:draw?10:0;}
