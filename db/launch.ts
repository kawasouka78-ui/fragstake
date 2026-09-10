import type {Player} from './service.ts';
import {InputError} from '../lib/account-rules.ts';
export function allowLaunchMutation(action:unknown){
 if(typeof action!=='string')throw new InputError('Choose an action.');
 if(['topup','match_start','match_finish','shop_buy'].includes(action)||action.startsWith('lobby_')||action.startsWith('challenge_'))throw new InputError('This feature is not available. Join a free player match from Play.',403);
}
export async function ensureLaunchPlayer(db:D1Database,id:string){
 const now=Date.now();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id)))).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,10);
 await db.prepare('INSERT OR IGNORE INTO players(id,handle,name,balance,created_at,last_seen) VALUES(?,?,?,0,?,?)').bind(id,'player_'+hash,'Player '+hash.slice(0,4).toUpperCase(),now,now).run();
 const player=await db.prepare('SELECT * FROM players WHERE id=?').bind(id).first<Player>();
 if(!player)throw new Error('Could not load your player account.');
 if(now-player.last_seen>30000)await db.prepare('UPDATE players SET last_seen=? WHERE id=?').bind(now,id).run();
 return {...player,balance:0};
}
export async function launchStats(db:D1Database,id:string){return await db.prepare('SELECT COUNT(*) AS matches,COALESCE(SUM(kills),0) AS kills,COALESCE(SUM(deaths),0) AS deaths,COALESCE(SUM(won),0) AS wins,COALESCE(SUM(headshots),0) AS headshots,COALESCE(MAX(max_streak),0) AS maxStreak,0 AS net FROM live_results WHERE player_id=? AND completed=1').bind(id).first()}
export async function launchState(db:D1Database,id:string){
 const [player,stats,pending]=await Promise.all([db.prepare('SELECT * FROM players WHERE id=?').bind(id).first<Player>(),launchStats(db,id),db.prepare("SELECT COUNT(*) AS count FROM friendships WHERE receiver_id=? AND status='pending'").bind(id).first<{count:number}>()]);
 return {player:player?{...player,balance:0}:null,stats,pending:pending?.count??0,transactions:[],matches:[],active:null};
}
export async function launchRecords(db:D1Database,id:string|null){
 const leaders=await db.prepare('SELECT p.handle,p.name,COUNT(*) AS matches,SUM(r.kills) AS kills,SUM(r.deaths) AS deaths,SUM(r.won) AS wins FROM live_results r JOIN players p ON p.id=r.player_id WHERE r.completed=1 GROUP BY p.id ORDER BY wins DESC,kills DESC,p.handle LIMIT 50').all();
 if(!id)return {leaders:leaders.results,recent:[],stats:null};
 const [recent,stats]=await Promise.all([db.prepare('SELECT r.id,r.kills,r.deaths,r.won,r.completed,r.finished_at,m.mode,m.map_id FROM live_results r JOIN live_matches m ON m.id=r.match_id WHERE r.player_id=? ORDER BY r.finished_at DESC LIMIT 50').bind(id).all(),launchStats(db,id)]);
 return {leaders:leaders.results,recent:recent.results,stats};
}
