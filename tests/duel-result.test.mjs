import {test} from 'node:test';
import assert from 'node:assert/strict';
import {duelOutcome,rematchRules,nextDuel} from '../lib/duel-result.ts';
import {Simulation} from '../lib/fps/simulation.ts';
import {settlePreviewMatch} from '../lib/preview-match.ts';

const config={mode:'duel',team:'1v1',rate:2,balance:90,stake:10,target:5,bestOf:1,weaponRule:'sniper',mapId:'citadel'};
void test('unfinished live duels never fabricate a final loss or draw',()=>{
 const base={live:true,won:false,score:0,enemyScore:0};
 assert.equal(duelOutcome({...base,reason:'Match cancelled'}).title,'MATCH CANCELLED');
 assert.equal(duelOutcome({...base,reason:'Left live match'}).title,'MATCH LEFT');
 assert.equal(duelOutcome({...base,reason:'Connection lost'}).title,'MATCH LEFT');
 assert.equal(duelOutcome({...base,reason:'Live match complete',enemyScore:10}).title,'YOU LOST');
});
test('duel results distinguish profit from total return for wins, losses, draws and forfeits',()=>{
 for(const row of [
  {score:5,enemy:2,tone:'win',title:'YOU WON',net:10,returned:20},
  {score:2,enemy:5,tone:'loss',title:'YOU LOST',net:-10,returned:0},
  {score:2,enemy:2,tone:'neutral',title:'MATCH DRAWN',net:0,returned:10},
  {score:4,enemy:1,reason:'Duel forfeited',tone:'loss',title:'YOU LOST',net:-10,returned:0},
  {score:0,enemy:0,reason:'Match cancelled',tone:'neutral',title:'MATCH CANCELLED',net:0,returned:10},
 ]){
  const game=new Simulation(config,()=>.5);game.score=row.score;game.enemyScore=row.enemy;game.finish(row.reason);
  const summary=duelOutcome(game.result);assert.equal(summary.tone,row.tone);assert.equal(summary.title,row.title);
  assert.equal(game.result.net,row.net);assert.equal(game.result.returned,row.returned);
  const active={id:'demo-duel',mode:'duel',rate:2,stake:1000,entry:0,target:5,best_of:1,status:'active'};
  const ending=row.reason==='Match cancelled'?'cancel':row.reason==='Duel forfeited'?'leave':'complete';
  const preview=settlePreviewMatch(active,{id:active.id,kills:0,deaths:0,score:row.score,enemyScore:row.enemy,headshots:0,maxStreak:0,ending},9000);
  assert.equal(preview.saved.delta/100,row.net);assert.equal(preview.returned/100,row.returned);
  assert.equal(duelOutcome({...game.result,reason:preview.saved.reason,won:!!preview.saved.won}).title,row.title);
 }
});
test('preview settlement rejects stale match ids and uses euros consistently for FFA',()=>{
 const active={id:'active',mode:'ffa',rate:2,stake:0,entry:2000,target:10,best_of:1,status:'active'};
 const body={id:'active',kills:3,deaths:1,score:0,enemyScore:0,headshots:0,maxStreak:0,ending:'cashout'};
 assert.throws(()=>settlePreviewMatch(active,{...body,id:'old'},10000),/active match/);
 const {saved,returned}=settlePreviewMatch(active,body,10000);
 assert.equal(saved.delta,400);assert.equal(returned,2400);
});
test('rematch preserves the full rule set without recycling the old balance, game id or ticket',()=>{
 const settings=rematchRules({...config,id:'old-match',skin:'wrap:carbon',live:{ticket:'old'}});
 assert.deepEqual(settings,{mode:'duel',rate:2,team:'1v1',mapId:'citadel',stake:10,target:5,bestOf:1,weaponRule:'sniper',entry:0});
});
test('find another duel chooses a different arena and keeps a party in 2v2',()=>{
 const maps=['citadel','depot','underpass'];
 for(const random of [()=>0,()=>.5,()=>.99]){
  const found=nextDuel(maps,'citadel',2,random);assert.notEqual(found.mapId,'citadel');assert.equal(found.team,'2v2');
 }
 assert.equal(nextDuel(maps,'depot',1,()=>0).team,'1v1');
 assert.equal(nextDuel(maps,'depot',1,()=>.99).team,'2v2');
});
