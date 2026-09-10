import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {ensureLaunchPlayer,launchState,launchRecords,allowLaunchMutation} from '../db/launch.ts';

void test('launch accounts have no welcome funds and never expose legacy demo money or matches',async()=>{
 const sql=new DatabaseSync(':memory:');
 try{
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const statement=(query,values=[])=>({
   bind:(...args)=>statement(query,args),
   first:async()=>sql.prepare(query).get(...values)??null,
   all:async()=>({results:sql.prepare(query).all(...values)}),
   run:async()=>({meta:{changes:Number(sql.prepare(query).run(...values).changes)}}),
  });
  const db={prepare:statement};
  await ensureLaunchPlayer(db,'new-player');await ensureLaunchPlayer(db,'new-player');
  assert.equal(sql.prepare('SELECT balance FROM players WHERE id=?').get('new-player').balance,0);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM transactions').get().n,0);
  sql.prepare('UPDATE players SET balance=99999 WHERE id=?').run('new-player');
  const state=await launchState(db,'new-player');
  assert.equal(state.player.balance,0);assert.deepEqual(state.transactions,[]);assert.deepEqual(state.matches,[]);assert.equal(state.active,null);
  assert.equal(sql.prepare('SELECT balance FROM players WHERE id=?').get('new-player').balance,99999,'legacy records are preserved, not converted or deleted');
  const records=await launchRecords(db,null);assert.deepEqual(records.leaders,[]);assert.deepEqual(records.recent,[]);assert.equal(records.stats,null);
 }finally{sql.close()}
});
void test('launch rejects demo money, client-authored results and legacy stake lobbies',()=>{
 for(const action of ['topup','match_start','match_finish','shop_buy','lobby_create','lobby_join','challenge_send'])assert.throws(()=>allowLaunchMutation(action),/not available/);
 for(const action of ['profile','friend_send','party_create','inventory_equip','report_create'])assert.doesNotThrow(()=>allowLaunchMutation(action));
});
