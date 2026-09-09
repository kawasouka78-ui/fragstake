import * as THREE from 'three';
import {type Simulation,type Actor,weapons,weaponIds,type WeaponId} from './simulation.ts';
import {buildWeapon,animateWeapon,type WeaponModel} from './weapon-models.ts';
import {ArenaWorld} from './world.ts';
import {ArenaPipeline} from './pipeline.ts';

type Rig={root:THREE.Group;legs:THREE.Group[];shield:THREE.Mesh;health:THREE.Mesh};
export class ArenaRenderer{
 world:ArenaWorld;pipeline:ArenaPipeline;ready:Promise<void>;disposed=false;
 renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(80,1,.08,500);weaponScene=new THREE.Scene();weaponCamera=new THREE.PerspectiveCamera(65,1,.02,10);gunRoot=new THREE.Group();gunModels=new Map<WeaponId,WeaponModel>();flash:THREE.Mesh;sun:THREE.DirectionalLight;rigs:Rig[]=[];pickupMeshes:THREE.Group[]=[];tracers:THREE.Line[]=[];impacts:THREE.Mesh[]=[];materials=new Map<string,THREE.MeshStandardMaterial>();disposables:THREE.Texture[]=[];game:Simulation;kick=0;lastShotCount=0;bob=0;fov=80;quality='high';
 constructor(canvas:HTMLCanvasElement,game:Simulation){
  this.game=game;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
  this.renderer.toneMappingExposure=.94;this.camera.rotation.order='YXZ';this.world=new ArenaWorld(this.scene,this.renderer,game.map);this.sun=this.world.sun;this.ready=this.world.ready;this.buildWorld();
  this.rigs=game.actors.slice(1).map(a=>this.actor(a));
  this.weaponScene.add(new THREE.HemisphereLight(0xffffff,0x3b332f,3));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-2,4,2);this.weaponScene.add(key);this.weaponScene.add(this.gunRoot);
  for(const id of weaponIds){const model=this.weapon(id);this.gunModels.set(id,model);this.gunRoot.add(model);}
  this.flash=new THREE.Mesh(new THREE.ConeGeometry(.06,.22,6),new THREE.MeshBasicMaterial({color:0xffd16f,transparent:true,opacity:.9,depthWrite:false}));this.flash.rotation.x=-Math.PI/2;this.flash.position.set(0,.025,-.68);this.gunRoot.add(this.flash);
  for(let i=0;i<32;i++){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xffcc88,transparent:true,opacity:.8,depthWrite:false}));line.frustumCulled=false;line.visible=false;this.tracers.push(line);this.scene.add(line);const impact=new THREE.Mesh(new THREE.SphereGeometry(.045,5,4),new THREE.MeshBasicMaterial({color:0xffcf83}));impact.visible=false;this.impacts.push(impact);this.scene.add(impact);}
  this.pipeline=new ArenaPipeline(this.renderer,this.scene,this.camera,this.weaponScene,this.weaponCamera);
 }
 material(color:string,metal=.1,rough=.75){const key=color+metal+rough;if(!this.materials.has(key))this.materials.set(key,new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough}));return this.materials.get(key)!;}
 box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string,metal=.1){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.material(color,metal));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 cylinder(parent:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,color:string){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),this.material(color,.5));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 label(text:string,width=3,color='#eddfc8'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,512,128);ctx.fillStyle=color;ctx.font='bold 55px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,65,490);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.disposables.push(texture);return new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
 }
 buildWorld(){
  const {pickups}=this.game;
  this.pickupMeshes=pickups.map(p=>{const root=new THREE.Group();root.position.set(p.x,.42,p.z);const color=p.kind==='health'?'#69e2b0':'#75b9ff';this.box(root,0,0,0,.48,.22,.48,'#25323c');this.box(root,0,.125,0,.28,.02,.07,color);if(p.kind==='health')this.box(root,0,.126,0,.07,.02,.28,color);else this.box(root,0,.126,.12,.28,.02,.06,color);const light=new THREE.Mesh(new THREE.RingGeometry(.48,.52,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5,side:THREE.DoubleSide}));light.rotation.x=-Math.PI/2;light.position.y=-.4;root.add(light);this.scene.add(root);return root;});
 }
 glow(x:number,y:number,z:number,w:number,h:number,d:number,color:string){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));mesh.position.set(x,y,z);this.scene.add(mesh);}
 actor(a:Actor):Rig{
  const root=new THREE.Group(),ally=a.team===this.game.player.team,armor=ally?'#315c72':'#514d48',trim=ally?'#6ae7ff':'#ff8662';
  this.box(root,0,1.15,0,.59,.55,.35,armor,.45);this.box(root,0,.9,.02,.45,.17,.29,'#252c30');this.box(root,0,1.18,-.2,.43,.36,.1,'#292f31');this.box(root,0,1.32,-.263,.2,.05,.018,trim);
  this.box(root,0,1.64,0,.42,.36,.39,'#383f43',.45);this.box(root,0,1.67,-.203,.35,.1,.025,trim,.6);this.box(root,0,1.49,-.1,.32,.1,.28,'#282e31');
  const legs:THREE.Group[]=[];for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.16,.84,0);this.box(leg,0,-.2,0,.22,.42,.25,'#303639');this.box(leg,0,-.55,0,.19,.34,.22,armor);this.box(leg,0,-.77,-.06,.23,.14,.36,'#20282b');root.add(leg);legs.push(leg);const arm=this.box(root,side*.39,1.16,-.11,.19,.48,.23,armor);arm.rotation.x=-.6;this.box(root,side*.36,.98,-.37,.16,.16,.3,'#272e30');}
  this.box(root,.25,1.08,-.48,.13,.15,.62,'#171f24',.6);this.box(root,.25,1.1,-.83,.06,.06,.25,'#697274',.7);
  const shield=new THREE.Mesh(new THREE.CapsuleGeometry(.52,1.05,4,10),new THREE.MeshBasicMaterial({color:ally?0x63dffc:0xffbb75,transparent:true,opacity:.1,wireframe:true,depthWrite:false}));shield.position.y=.95;root.add(shield);
  const health=new THREE.Mesh(new THREE.PlaneGeometry(.65,.045),new THREE.MeshBasicMaterial({color:trim,side:THREE.DoubleSide,depthTest:true}));health.position.y=2.1;root.add(health);this.scene.add(root);return {root,legs,shield,health};
 }
 weapon(id:WeaponId){return buildWeapon(id,this.game.config.skin);}
 resize(width:number,height:number){this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.weaponCamera.aspect=width/height;this.weaponCamera.updateProjectionMatrix();this.pipeline.resize(width,height);}
 setQuality(quality:string){if(this.quality===quality)return;this.quality=quality;this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?1.5:1));this.renderer.shadowMap.enabled=true;this.pipeline.setQuality(quality);}
 shot(){this.kick=1;}
 render(dt:number){
  this.world.update(this.game.elapsed,this.quality);
  const g=this.game,p=g.player;this.kick=Math.max(0,this.kick-dt*10);this.bob+=dt*p.moving*2.5;
  const bob=Math.sin(this.bob)*.022*(1-g.aim)*Number(p.y===0&&p.hp>0),eye=g.eye(p);this.camera.position.set(eye.x,eye.y+bob,eye.z);this.camera.rotation.set(g.pitch+g.recoil,g.yaw,Math.sin(this.bob*.5)*.002*(1-g.aim));
  const desired=this.fov-g.aim*(g.weapon==='marksman'?37:21)+(g.sprinting?7:0);this.camera.fov+=(desired-this.camera.fov)*Math.min(1,dt*12);this.camera.updateProjectionMatrix();
  for(let i=0;i<this.rigs.length;i++){const a=g.actors[i+1],rig=this.rigs[i];rig.root.visible=a.hp>0;if(a.hp<=0)continue;rig.root.position.set(a.x,a.y,a.z);rig.root.rotation.y=a.yaw;rig.root.scale.y=a.crouch?.7:1;rig.legs.forEach((leg,j)=>leg.rotation.x=Math.sin(g.elapsed*10+j*Math.PI)*Math.min(.6,a.moving*.14));rig.shield.visible=a.shield>0;rig.shield.rotation.y=g.elapsed;rig.health.scale.x=a.hp/100;rig.health.rotation.y=g.yaw-a.yaw;}
  this.pickupMeshes.forEach((mesh,i)=>{mesh.visible=g.pickups[i].ready<=0;mesh.position.y=.45+Math.sin(g.elapsed*2+i)*.1;mesh.rotation.y=g.elapsed*.7;});
  for(let i=0;i<this.tracers.length;i++){const shot=g.shots[i],line=this.tracers[i],impact=this.impacts[i];line.visible=!!shot;impact.visible=!!shot;if(!shot)continue;const from=shot.from;const positions=line.geometry.attributes.position as THREE.BufferAttribute;positions.setXYZ(0,from.x,from.y-.08,from.z);positions.setXYZ(1,shot.to.x,shot.to.y,shot.to.z);positions.needsUpdate=true;(line.material as THREE.LineBasicMaterial).opacity=(1-shot.age/.08)*.75;impact.position.set(shot.to.x,shot.to.y,shot.to.z);}
  for(const [id,mesh]of this.gunModels)mesh.visible=id===g.weapon;
  const model=this.gunModels.get(g.weapon)!;animateWeapon(model,this.kick,g.reloadLeft>0?1-g.reloadLeft/weapons[g.weapon].reload:0);
  const reload=g.reloadLeft>0?Math.sin(Math.PI*(1-g.reloadLeft/weapons[g.weapon].reload)):0;
  this.gunRoot.visible=p.hp>0;this.gunRoot.position.set(.27*(1-g.aim)+Math.sin(this.bob*.5)*.008*(1-g.aim),-.25+g.aim*(.25-model.rig.sightHeight)-Math.abs(bob)-reload*.25-(g.switchLeft>0?.16:0),-.43+this.kick*.04);
  this.gunRoot.rotation.set(this.kick*.05-reload*.4,g.sprinting?-.28:0,-reload*.45+(g.sprinting?-.25:0));this.flash.scale.setScalar(['pistol','handcannon','smg','vector'].includes(g.weapon)?.6:1);this.flash.position.copy(model.rig.muzzle);this.flash.position.z-=.06;this.flash.visible=this.kick>.6;this.flash.rotation.z=g.elapsed*200;
  this.sun.shadow.needsUpdate=true;this.pipeline.render(dt);
 }
 dispose(){if(this.disposed)return;this.disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();for(const scene of [this.scene,this.weaponScene])scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.disposables.forEach(t=>t.dispose());this.world.dispose();this.pipeline.dispose();this.renderer.dispose();}
}
