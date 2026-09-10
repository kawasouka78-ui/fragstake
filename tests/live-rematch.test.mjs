import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LiveRoom} from '../lib/live/world.ts';
import {prepareRematch} from '../lib/live/rematch.ts';
import {readTicket} from '../lib/live/security.ts';
import {findRoom,openRooms} from '../lib/live/matchmaking.ts';

const secret='rematch-secret-for-tests-at-least-32-characters';
const claims=(sub,mode='2v2')=>({sub,name:sub,guest:true,mode,mapId:'citadel',nonce:sub,exp:Date.now()+60000,aud:'skillclash-game'});
test('private rematch invitations retain guests and original teams regardless of join order',async()=>{
 const old=new LiveRoom('2v2','citadel');
 for(const id of ['alice','bob','charlie','dana'])old.add(claims(id));
 old.hadOpponents=true;old.finish();
 const now=Date.now(),next=await prepareRematch(old,secret,now);
 assert.ok(next);assert.notEqual(next.room.id,old.id);
 assert.equal(findRoom([next.room],claims('outsider')),undefined);
 assert.throws(()=>next.room.add(claims('outsider')),/reserved/);
 for(const id of ['dana','charlie','bob','alice']){
  const invitation=next.invitations.get(id),ticket=await readTicket(secret,invitation.ticket,now);
  assert.equal(ticket.sub,id);assert.equal(ticket.roomId,next.room.id);assert.equal(ticket.guest,true);
  const player=next.room.add(ticket);
  assert.equal(player.slot,old.players.get(id).slot);assert.equal(player.game.player.team,old.players.get(id).game.player.team);
  assert.deepEqual(openRooms([next.room]),[]);
  assert.equal(await readTicket(secret,invitation.ticket,now+60000),null);
 }
});
test('cancelled empty matches and FFA never create rematch invitations',async()=>{
 for(const mode of ['1v1','ffa']){
  const room=new LiveRoom(mode,'citadel');room.finish();assert.equal(await prepareRematch(room,secret),null);
 }
});
test('authoritative snapshots carry the exhaustion lock as well as the stamina value',()=>{
 const room=new LiveRoom('1v1','citadel'),player=room.add(claims('a','1v1'));
 player.game.stamina=12;player.game.sprintExhausted=true;player.game.sprintCooldown=0.9;
 const {state}=room.snapshot('a');assert.equal(state.stamina,12);assert.equal(state.sprintExhausted,true);assert.equal(state.sprintCooldown,0.9);
});
