import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildWeapon,animateWeapon} from '../lib/fps/weapon-models.ts';
import {weaponIds} from '../lib/fps/simulation.ts';
import {ViewMotion} from '../lib/fps/view-motion.ts';

test('weapons and hands never cross the view camera near plane during movement, ADS or reloads',()=>{
 const base={speed:0,grounded:true,vy:0,crouch:false,sprinting:false,sliding:false,aim:0,reload:0,switching:false,kick:0,sightHeight:.1};
 const states=[{}, {speed:7.5,sprinting:true}, {grounded:false,vy:5.4}, {grounded:false,vy:-5}, {speed:10,crouch:true,sliding:true}, {aim:1}, {switching:true}, {reload:1}, {aim:1,reload:1}];
 for(const id of weaponIds){
  const model=buildWeapon(id),root=new THREE.Group();root.add(model);const motion=new ViewMotion();
  for(const state of states)for(const kick of [0,1]){
   const sample={...base,...state,kick,sightHeight:model.rig.sightHeight};let pose;
   for(let i=0;i<45;i++)pose=motion.step(1/60,sample);
   animateWeapon(model,kick,sample.reload?.5:0);root.position.set(pose.x,pose.y,pose.z);root.rotation.set(pose.rx,pose.ry,pose.rz);root.updateMatrixWorld(true);
   let closest=-Infinity;const vertex=new THREE.Vector3();
   model.traverse(mesh=>{if(!mesh.isMesh)return;const points=mesh.geometry.attributes.position;for(let i=0;i<points.count;i++){vertex.fromBufferAttribute(points,i).applyMatrix4(mesh.matrixWorld);assert.ok(Number.isFinite(vertex.z));closest=Math.max(closest,vertex.z);}});
   assert.ok(closest<-.025,`${id} crossed the camera plane: ${closest}`);
  }
  const materials=new Set();model.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();materials.add(mesh.material);}});materials.forEach(m=>m.dispose());
 }
});
