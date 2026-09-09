import {InputError,matchSetup,textValue} from '../lib/account-rules.ts';

export async function lobbyData(db:D1Database,id:string){
 const now=Date.now();
 const rooms=await db.prepare("SELECT l.id,l.owner_id,l.rules,l.created_at,l.expires_at,p.name AS host_name,p.handle AS host_handle,(SELECT COUNT(*) FROM duel_lobby_members m WHERE m.lobby_id=l.id) AS members,EXISTS(SELECT 1 FROM duel_lobby_members m WHERE m.lobby_id=l.id AND m.player_id=?) AS joined FROM duel_lobbies l JOIN players p ON p.id=l.owner_id WHERE l.status='open' AND l.expires_at>? ORDER BY l.created_at DESC LIMIT 50").bind(id,now).all();
 const members=await db.prepare("SELECT m.lobby_id,m.player_id,m.ready,p.name,p.handle FROM duel_lobby_members m JOIN players p ON p.id=m.player_id JOIN duel_lobbies l ON l.id=m.lobby_id WHERE l.status='open' AND l.expires_at>? AND EXISTS(SELECT 1 FROM duel_lobby_members mine WHERE mine.lobby_id=m.lobby_id AND mine.player_id=?) ORDER BY m.joined_at").bind(now,id).all();
 return {rooms:rooms.results,members:members.results};
}

export async function lobbyMutation(db:D1Database,id:string,b:Record<string,unknown>){
 const action=String(b.action),now=Date.now();
 if(!['lobby_create','lobby_join','lobby_leave','lobby_ready','lobby_close'].includes(action))return false;
 if(action==='lobby_create'){
  const rules=matchSetup({...b,mode:'duel',rate:2,mapId:'citadel'}),key=id+':'+textValue(b.key,'Lobby key',8,80);
  if(await db.prepare('SELECT id FROM duel_lobbies WHERE id=? AND owner_id=?').bind(key,id).first())return true;
  const prior=await db.prepare("SELECT id FROM duel_lobbies WHERE owner_id=? AND status='open' AND expires_at>?").bind(id,now).first();if(prior)throw new InputError('Close your existing lobby before opening another.',409);
  await db.batch([
   db.prepare("UPDATE duel_lobbies SET status='closed' WHERE owner_id=? AND status='open' AND expires_at<=?").bind(id,now),
   db.prepare("INSERT INTO duel_lobbies(id,owner_id,rules,status,created_at,expires_at) VALUES(?,?,?,'open',?,?)").bind(key,id,JSON.stringify(rules),now,now+3600000),
   db.prepare('INSERT INTO duel_lobby_members(id,lobby_id,player_id,joined_at) VALUES(?,?,?,?)').bind(key+':'+id,key,id,now)
  ]);return true;
 }
 const key=textValue(b.id,'Lobby',1,300),room=await db.prepare("SELECT * FROM duel_lobbies WHERE id=? AND status='open' AND expires_at>?").bind(key,now).first<{owner_id:string;rules:string}>();if(!room)throw new InputError('This lobby has closed or expired.',404);
 if(action==='lobby_join'){
  const capacity=JSON.parse(room.rules).team==='2v2'?4:2;
  await db.prepare('INSERT OR IGNORE INTO duel_lobby_members(id,lobby_id,player_id,joined_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM duel_lobby_members WHERE lobby_id=?)<?').bind(key+':'+id,key,id,now,key,capacity).run();
  if(!await db.prepare('SELECT id FROM duel_lobby_members WHERE lobby_id=? AND player_id=?').bind(key,id).first())throw new InputError('This lobby is full. Choose another match.',409);
 }else if(action==='lobby_close'||(action==='lobby_leave'&&room.owner_id===id)){
  if(room.owner_id!==id)throw new InputError('Only the host can close this lobby.',403);
  await db.prepare("UPDATE duel_lobbies SET status='closed' WHERE id=? AND owner_id=?").bind(key,id).run();
 }else if(action==='lobby_leave')await db.prepare('DELETE FROM duel_lobby_members WHERE lobby_id=? AND player_id=?').bind(key,id).run();
 else {const result=await db.prepare('UPDATE duel_lobby_members SET ready=? WHERE lobby_id=? AND player_id=?').bind(b.ready===true?1:0,key,id).run();if(!result.meta.changes)throw new InputError('Join this lobby before marking yourself ready.',403);}
 return true;
}
