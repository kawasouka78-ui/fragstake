import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PreviewArmory} from '../lib/preview-armory.ts';
import {equippedCosmetics} from '../lib/catalog.ts';

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
