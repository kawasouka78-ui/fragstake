import {InputError,textValue,matchSetup} from '../lib/account-rules.ts';
import {catalog,cosmeticSlot,playerRating} from '../lib/catalog.ts';

export async function platformData(db:D1Database,id:string){
 const membership=await db.prepare("SELECT p.* FROM parties p JOIN party_members m ON m.party_id=p.id WHERE m.player_id=? AND m.status='joined'").bind(id).first<{id:string;owner_id:string;name:string}>();
 const [members,invites,challengeRows,items,cases,ratings]=await Promise.all([
  membership?db.prepare('SELECT m.id,m.player_id,m.status,p.name,p.handle,p.color FROM party_members m JOIN players p ON p.id=m.player_id WHERE m.party_id=? ORDER BY m.created_at').bind(membership.id).all():Promise.resolve({results:[]}),
  db.prepare("SELECT m.id,p.name,p.owner_id FROM party_members m JOIN parties p ON p.id=m.party_id WHERE m.player_id=? AND m.status='invited'").bind(id).all(),
  db.prepare('SELECT c.*,s.name AS sender_name,r.name AS receiver_name FROM challenges c JOIN players s ON s.id=c.sender_id JOIN players r ON r.id=c.receiver_id WHERE c.sender_id=? OR c.receiver_id=? ORDER BY c.created_at DESC LIMIT 30').bind(id,id).all(),
  db.prepare('SELECT sku,equipped,created_at FROM inventory WHERE player_id=? ORDER BY created_at DESC').bind(id).all(),
  db.prepare('SELECT * FROM reports WHERE player_id=? ORDER BY created_at DESC LIMIT 30').bind(id).all(),
  db.prepare("SELECT mode,COUNT(*) AS matches,SUM(won) AS wins,SUM(kills) AS kills,SUM(deaths) AS deaths,SUM(delta) AS net FROM matches WHERE player_id=? AND status='completed' GROUP BY mode").bind(id).all<{mode:string;matches:number;wins:number;kills:number;deaths:number;net:number}>()
 ]);
 return {party:membership?{...membership,members:members.results}:null,invites:invites.results,challenges:challengeRows.results,inventory:items.results,reports:cases.results,ratings:ratings.results.map(r=>({...r,...playerRating(r.wins,r.matches)})),catalog};
}
export async function platformMutation(db:D1Database,id:string,b:Record<string,unknown>){
 const action=String(b.action),now=Date.now();
 if(action==='party_create'){
  const partyId=crypto.randomUUID(),name=textValue(b.name,'Party name',2,40);
  if(await db.prepare("SELECT id FROM party_members WHERE player_id=? AND status='joined'").bind(id).first())throw new InputError('Leave your current party first.',409);
  await db.batch([db.prepare('INSERT INTO parties(id,owner_id,name,created_at) VALUES(?,?,?,?)').bind(partyId,id,name,now),db.prepare("INSERT INTO party_members(id,party_id,player_id,status,created_at) VALUES(?,?,?,'joined',?)").bind(partyId+':'+id,partyId,id,now)]);
 }else if(action==='party_invite'){
  const party=await db.prepare('SELECT id FROM parties WHERE owner_id=?').bind(id).first<{id:string}>();if(!party)throw new InputError('Create a party first.');
  const player=await db.prepare('SELECT id FROM players WHERE handle=?').bind(textValue(b.handle,'Handle',3,20).toLowerCase()).first<{id:string}>();if(!player||player.id===id)throw new InputError('Choose another registered player.');
  const count=await db.prepare('SELECT COUNT(*) AS n FROM party_members WHERE party_id=?').bind(party.id).first<{n:number}>();if((count?.n??0)>=6)throw new InputError('The party already has six members or invitations.');
  await db.prepare("INSERT OR IGNORE INTO party_members(id,party_id,player_id,status,created_at) SELECT ?,?,?,'invited',? WHERE (SELECT COUNT(*) FROM party_members WHERE party_id=?)<6").bind(party.id+':'+player.id,party.id,player.id,now,party.id).run();
 }else if(action==='party_accept'){
  if(await db.prepare("SELECT id FROM party_members WHERE player_id=? AND status='joined'").bind(id).first())throw new InputError('Leave your current party first.');
  const result=await db.prepare("UPDATE party_members SET status='joined' WHERE id=? AND player_id=? AND status='invited'").bind(String(b.id),id).run();if(!result.meta.changes)throw new InputError('Invitation not found.',404);
 }else if(action==='party_decline'){
  await db.prepare("DELETE FROM party_members WHERE id=? AND player_id=? AND status='invited'").bind(String(b.id),id).run();
 }else if(action==='party_leave'){
  const party=await db.prepare("SELECT p.id,p.owner_id FROM parties p JOIN party_members m ON m.party_id=p.id WHERE m.player_id=? AND m.status='joined'").bind(id).first<{id:string;owner_id:string}>();if(!party)throw new InputError('You are not in a party.');
  if(party.owner_id===id)await db.batch([db.prepare('DELETE FROM party_members WHERE party_id=?').bind(party.id),db.prepare('DELETE FROM parties WHERE id=? AND owner_id=?').bind(party.id,id)]);else await db.prepare('DELETE FROM party_members WHERE party_id=? AND player_id=?').bind(party.id,id).run();
 }else if(action==='challenge_create'){
  const rules=matchSetup({...b,mode:'duel',rate:2});const receiver=await db.prepare('SELECT id FROM players WHERE handle=?').bind(textValue(b.handle,'Handle',3,20).toLowerCase()).first<{id:string}>();if(!receiver||receiver.id===id)throw new InputError('Choose another registered player.');
  await db.prepare("INSERT INTO challenges(id,sender_id,receiver_id,rules,status,created_at,expires_at) VALUES(?,?,?,?,'pending',?,?)").bind(crypto.randomUUID(),id,receiver.id,JSON.stringify(rules),now,now+86400000).run();
 }else if(['challenge_accept','challenge_decline','challenge_cancel'].includes(action)){
  const status=action==='challenge_accept'?'accepted':action==='challenge_decline'?'declined':'cancelled';const owner=action==='challenge_cancel'?'sender_id':'receiver_id';
  const result=await db.prepare(`UPDATE challenges SET status=? WHERE id=? AND ${owner}=? AND status='pending' AND expires_at>?`).bind(status,String(b.id),id,now).run();if(!result.meta.changes)throw new InputError('This invitation has expired or is not yours to answer.',409);
 }else if(action==='shop_buy'){
  const item=catalog.find(item=>item.sku===b.sku);if(!item)throw new InputError('Unknown cosmetic.');const key='shop:'+id+':'+item.sku;
  if(!await db.prepare('SELECT id FROM inventory WHERE id=?').bind(key).first()){
   await db.batch([
    db.prepare('INSERT INTO inventory(id,player_id,sku,created_at) SELECT ?,?,?,? FROM players WHERE id=? AND balance>=?').bind(key,id,item.sku,now,id,item.price),
    db.prepare("INSERT INTO transactions(id,player_id,kind,amount,label,created_at) SELECT ?,?,'cosmetic',?,?,? FROM inventory WHERE id=?").bind(key,id,-item.price,item.name+' cosmetic',now,key),
    db.prepare('UPDATE players SET balance=balance-? WHERE id=? AND EXISTS(SELECT 1 FROM inventory WHERE id=?)').bind(item.price,id,key)
   ]);
   if(!await db.prepare('SELECT id FROM inventory WHERE id=?').bind(key).first())throw new InputError('Add enough funds in your wallet first.',409);
  }
 }else if(action==='inventory_equip'){
  const sku=String(b.sku||''),item=catalog.find(item=>item.sku===sku);
  if(sku&&!item)throw new InputError('Unknown cosmetic.');
  const slot=item?cosmeticSlot(item):b.slot==='knife'?'knife':'finish';
  if(item){
   if(slot==='knife'){
    if(!await db.prepare('SELECT id FROM inventory WHERE player_id=? AND sku=?').bind(id,sku).first())throw new InputError('Buy this knife in the shop first.',409);
   }else await db.prepare('INSERT OR IGNORE INTO inventory(id,player_id,sku,created_at) VALUES(?,?,?,?)').bind('shop:'+id+':'+sku,id,sku,now).run();
  }
  const skus=catalog.filter(item=>cosmeticSlot(item)===slot).map(item=>item.sku);
  await db.prepare(`UPDATE inventory SET equipped=CASE WHEN sku=? THEN 1 ELSE 0 END WHERE player_id=? AND sku IN (${skus.map(()=>'?').join(',')})`).bind(sku,id,...skus).run();
 }else if(action==='report_create'){
  const category=String(b.category);if(!['bug','cheating','payment','other'].includes(category))throw new InputError('Choose a report type.');
  const matchId=String(b.matchId||'');if(matchId&&!await db.prepare('SELECT id FROM matches WHERE id=? AND player_id=?').bind(matchId,id).first())throw new InputError('Match not found.',404);
  await db.prepare('INSERT INTO reports(id,player_id,match_id,category,details,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,matchId||null,category,textValue(b.details,'Report details',10,2000),now).run();
 }else return false;
 return true;
}

