import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {buildWeapon,animateWeapon} from '../lib/fps/weapon-models.ts';import {weaponIds} from '../lib/fps/simulation.ts';
for(const id of weaponIds)test(id+' model has finite geometry, aligned sights and resetting animation',()=>{const m=buildWeapon(id);m.updateMatrixWorld(true);let draws=0;const geos=new Set(),mats=new Set();m.traverse(o=>{if(o.isMesh){draws++;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));geos.add(o.geometry);mats.add(o.material)}});assert.ok(draws<35);assert.ok(m.rig.muzzle.z<-.2);assert.ok(m.rig.sightHeight>.075&&m.rig.sightHeight<.25);animateWeapon(m,1,.5);assert.ok(m.rig.action.position.z>0);animateWeapon(m,0,0);assert.equal(m.rig.action.position.z,0);assert.equal(Math.abs(m.rig.magazine.position.y),0);for(const g of geos)g.dispose();for(const t of mats)t.dispose();});

for(const style of ['standard','karambit'])test(style+' knife has finite geometry and a resetting slash with no magazine motion',()=>{
 const model=buildWeapon('knife',undefined,true,style);let draws=0;
 model.traverse(o=>{if(o.isMesh){draws++;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));}});
 assert.ok(draws>0&&draws<20);assert.ok(model.rig.muzzle.length()>.15);assert.equal(model.userData.knifeStyle,style);
 animateWeapon(model,.5,0);assert.ok(model.rig.body.rotation.z+(model.rig.arm?.rotation.z??0)<-.5);assert.equal(model.rig.magazine.position.y,0);
 animateWeapon(model,0,0);assert.equal(model.rig.body.position.length(),0);assert.equal(Math.abs(model.rig.body.rotation.z),0);
 const bare=buildWeapon('knife',undefined,false,style);assert.ok(!bare.getObjectByName('body-glove'));
 const box=new THREE.Box3().setFromObject(bare),size=box.getSize(new THREE.Vector3());assert.ok(style==='karambit'?size.z>.23&&size.z<.29:size.z>.4&&size.z<.6);assert.ok(size.x<.06);
 for(const m of [model,bare]){const materials=new Set();m.traverse(o=>{if(o.isMesh){o.geometry.dispose();materials.add(o.material);}});materials.forEach(m=>m.dispose());}
});

test('karambit swings the forearm and keeps the glove joined to the sleeve',()=>{
 const model=buildWeapon('knife',undefined,true,'karambit'),wrist=new THREE.Vector3(.064,-.008,-.025);
 model.updateMatrixWorld(true);
 const restingWrist=model.rig.supportHand.localToWorld(wrist.clone());
 for(const slashSide of [-1,1]){
  animateWeapon(model,.55,0,{slashSide});model.updateMatrixWorld(true);
  const sleeveWrist=model.rig.supportHand.localToWorld(wrist.clone());
  assert.ok(sleeveWrist.distanceTo(restingWrist)>.06,'The forearm must travel through the swing');
  for(let frame=0;frame<=24;frame++){
   animateWeapon(model,1-frame/24,0,{slashSide});model.updateMatrixWorld(true);
   assert.ok(model.rig.body.localToWorld(wrist.clone()).distanceTo(model.rig.supportHand.localToWorld(wrist.clone()))<1e-6,'Wrist separated from the cuff');
  }
 }
 animateWeapon(model,0,0);model.updateMatrixWorld(true);
 assert.ok(model.rig.supportHand.localToWorld(wrist.clone()).distanceTo(restingWrist)<1e-6,'Arm did not settle back to rest');
 const materials=new Set();model.traverse(o=>{if(o.isMesh){o.geometry.dispose();materials.add(o.material);}});materials.forEach(m=>m.dispose());
});
