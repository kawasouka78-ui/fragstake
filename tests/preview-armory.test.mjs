import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PreviewArmory} from '../lib/preview-armory.ts';
import {catalog,equippedCosmetics,cosmeticFinish} from '../lib/catalog.ts';
import {createWeaponFinish} from '../lib/fps/weapon-finish.ts';
import {ShaderLib} from 'three';

test('preview karambit purchase, equip and reload retain both equipment slots',()=>{
 const armory=new PreviewArmory(),sku='karambit-obsidian';
 assert.ok(!armory.inventory.some(item=>item.sku===sku));
 assert.throws(()=>armory.equip(sku),/Buy/);assert.throws(()=>armory.buy(sku,100),/credits/);
 assert.equal(armory.buy(sku,10000),4999);assert.equal(armory.buy(sku,0),0);
 armory.equip(sku);armory.equip('inferno');
 assert.deepEqual(equippedCosmetics(armory.inventory),{skin:'#ff783e',knifeStyle:'karambit'});
 const restored=new PreviewArmory();restored.restore(armory.serialize());assert.equal(restored.spent,4999);
 assert.deepEqual(equippedCosmetics(restored.inventory),{skin:'#ff783e',knifeStyle:'karambit'});
 restored.equip('','knife');assert.deepEqual(equippedCosmetics(restored.inventory),{skin:'#ff783e',knifeStyle:'standard'});
 restored.equip(sku);restored.equip('');assert.deepEqual(equippedCosmetics(restored.inventory),{skin:undefined,knifeStyle:'karambit'});
});

test('every animated finish equips free, survives reload and reaches its own animated shader',()=>{
 const armory=new PreviewArmory(),programs=new Set(),fragments=new Set();
 armory.buy('karambit-obsidian',10000);armory.equip('karambit-obsidian');
 for(const item of catalog.filter(item=>'effect' in item)){
  assert.equal(armory.buy(item.sku,0),0);
  armory.equip(item.sku);
  const restored=new PreviewArmory();restored.restore(armory.serialize());
  const equipment=equippedCosmetics(restored.inventory);
  assert.deepEqual(equipment,{skin:cosmeticFinish(item),knifeStyle:'karambit'});
  assert.equal(restored.spent,4999,'a finish must not spend credits');
  assert.equal(restored.inventory.filter(row=>row.equipped).length,2,'one finish and one knife');
  const finish=createWeaponFinish(equipment.skin);
  assert.equal(finish.animated,true,item.name+' must animate');
  const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};
  finish.material.onBeforeCompile(shader);
  finish.time.value=3.5;
  assert.equal(shader.uniforms.uFinishTime.value,3.5,'animation clock must reach the compiled material');
  assert.ok(!shader.fragmentShader.includes('undefined'));
  const key=finish.material.customProgramCacheKey();
  assert.ok(!programs.has(key),'finishes must not reuse another effect’s program');programs.add(key);
  assert.ok(!fragments.has(shader.fragmentShader),'each finish needs its own pattern');fragments.add(shader.fragmentShader);
  finish.material.dispose();
 }
});

test('missing and unrecognized finishes retain the standard black material',()=>{
 for(const skin of [undefined,'fx:missing','fx:constructor','fx:toString']){
  const finish=createWeaponFinish(skin);
  assert.equal(finish.animated,false);assert.equal(finish.material.color.getHexString(),'141619');
  finish.material.dispose();
 }
});
