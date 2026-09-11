import * as THREE from 'three';
import {type Simulation,type Actor,weapons,matchWeaponIds,type WeaponId} from './simulation.ts';
import {buildWeapon,animateWeapon,updateWeaponFinish,type WeaponModel} from './weapon-models.ts';
import {ArenaWorld} from './world.ts';
import {ArenaPipeline} from './pipeline.ts';
import {ViewMotion,viewmodelPose} from './view-motion.ts';
import {ActorAnimation} from './actor-motion.ts';

type Rig={root:THREE.Group;hips:THREE.Group;torso:THREE.Group;head:THREE.Group;aim:THREE.Group;legs:THREE.Group[];knees:THREE.Group[];feet:THREE.Group[];arms:THREE.Group[];forearms:THREE.Group[];gun:THREE.Group;flash:THREE.Mesh;animation:ActorAnimation;shield:THREE.Mesh;health:THREE.Mesh};
export class ArenaRenderer{
 world:ArenaWorld;pipeline:ArenaPipeline;ready:Promise<void>;disposed=false;motion=new ViewMotion();
 renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(80,1,.08,500);weaponScene=new THREE.Scene();weaponCamera=new THREE.PerspectiveCamera(65,1,.02,10);gunRoot=new THREE.Group();gunModels=new Map<WeaponId,WeaponModel>();flash:THREE.Mesh;sun:THREE.DirectionalLight;rigs:Rig[]=[];pickupMeshes:THREE.Group[]=[];tracers:THREE.Line[]=[];impacts:THREE.Mesh[]=[];materials=new Map<string,THREE.MeshStandardMaterial>();disposables:THREE.Texture[]=[];game:Simulation;kick=0;lastShotCount=0;bob=0;fov=80;quality='high';weaponBob=1;
 constructor(canvas:HTMLCanvasElement,game:Simulation){
  this.game=game;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
  this.renderer.toneMappingExposure=.94;this.camera.rotation.order='YXZ';this.world=new ArenaWorld(this.scene,this.renderer,game.map);this.sun=this.world.sun;this.ready=this.world.ready;this.buildWorld();
  this.rigs=game.actors.slice(1).map(a=>this.actor(a));
  this.weaponScene.add(new THREE.HemisphereLight(0xffffff,0x3b332f,3));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-2,4,2);this.weaponScene.add(key);this.weaponScene.add(this.gunRoot);
  for(const id of matchWeaponIds){const model=this.weapon(id);this.gunModels.set(id,model);this.gunRoot.add(model);}
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
  const hips=new THREE.Group(),torso=new THREE.Group(),head=new THREE.Group(),aim=new THREE.Group();
  hips.position.y=.89;root.add(hips);hips.add(torso);head.position.y=.72;torso.add(head);aim.position.set(0,.44,-.02);torso.add(aim);
  this.box(torso,0,.27,0,.57,.53,.34,armor,.35);this.box(hips,0,.02,.01,.45,.17,.29,'#252c30');this.box(torso,0,.27,-.19,.43,.36,.1,'#292f31');this.box(torso,0,.43,-.25,.2,.04,.018,trim);
  this.box(torso,0,.26,.2,.35,.39,.16,'#262d30');
  this.box(head,0,0,0,.4,.34,.37,'#383f43',.4);this.box(head,0,.025,-.195,.34,.09,.025,trim,.6);this.box(head,0,-.13,-.1,.3,.1,.25,'#282e31');
  const legs:THREE.Group[]=[],knees:THREE.Group[]=[],feet:THREE.Group[]=[],arms:THREE.Group[]=[],forearms:THREE.Group[]=[];
  for(const side of [-1,1]){
   const leg=new THREE.Group(),knee=new THREE.Group();leg.position.set(side*.155,0,0);knee.position.y=-.41;leg.add(knee);hips.add(leg);
   this.box(leg,0,-.2,0,.22,.4,.25,'#303639');this.box(knee,0,-.19,0,.18,.37,.21,armor);this.box(knee,0,-.03,-.13,.2,.14,.07,'#252a2c');
   const foot=new THREE.Group();foot.position.y=-.41;knee.add(foot);this.box(foot,0,0,-.06,.22,.13,.34,'#171c1e');legs.push(leg);knees.push(knee);feet.push(foot);
   const arm=new THREE.Group(),forearm=new THREE.Group();arm.position.set(side*.35,0,0);forearm.position.y=-.28;arm.add(forearm);aim.add(arm);
   this.box(arm,0,-.125,0,.19,.28,.22,armor);this.box(arm,0,-.03,0,.22,.15,.24,'#363c40');this.box(forearm,0,-.13,0,.16,.27,.19,'#303639');this.box(forearm,0,-.29,-.015,.16,.12,.18,'#171c1e');arms.push(arm);forearms.push(forearm);
  }
  const gun=new THREE.Group();gun.position.set(.23,-.15,-.4);aim.add(gun);
  this.box(gun,0,0,0,.13,.14,.48,'#111416',.65);this.box(gun,0,-.03,.29,.12,.16,.23,'#171a1b');this.box(gun,0,-.14,.05,.075,.21,.1,'#111416');this.box(gun,0,.015,-.37,.045,.045,.25,'#22272b',.7);this.box(gun,0,.095,-.02,.055,.05,.25,'#212729');
  const flash=new THREE.Mesh(new THREE.ConeGeometry(.035,.13,5),new THREE.MeshBasicMaterial({color:0xffca7a,transparent:true,opacity:.85,depthWrite:false}));flash.position.set(0,.015,-.54);flash.rotation.x=-Math.PI/2;flash.visible=false;gun.add(flash);
  const shield=new THREE.Mesh(new THREE.CapsuleGeometry(.52,1.05,4,10),new THREE.MeshBasicMaterial({color:ally?0x63dffc:0xffbb75,transparent:true,opacity:.1,wireframe:true,depthWrite:false}));shield.position.y=.95;root.add(shield);
  const health=new THREE.Mesh(new THREE.PlaneGeometry(.65,.045),new THREE.MeshBasicMaterial({color:trim,side:THREE.DoubleSide,depthTest:true}));health.position.y=2.1;root.add(health);this.scene.add(root);return {root,hips,torso,head,aim,legs,knees,feet,arms,forearms,gun,flash,animation:new ActorAnimation(a.id,a.yaw),shield,health};
 }
 weapon(id:WeaponId){return buildWeapon(id,this.game.config.skin,true,this.game.config.knifeStyle);}
 resize(width:number,height:number){this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.weaponCamera.aspect=width/height;this.weaponCamera.updateProjectionMatrix();this.pipeline.resize(width,height);}
 setQuality(quality:string){if(this.quality===quality)return;this.quality=quality;this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?1.5:1));this.renderer.shadowMap.enabled=true;this.pipeline.setQuality(quality);}
 lastWeapon:WeaponId='rifle';slashSide=-1;inspectLeft=0;
 shot(){this.kick=1;this.inspectLeft=0;this.lastWeapon=this.game.weapon;if(this.game.weapon==='knife')this.slashSide*=-1;}
 inspect(){if(this.game.weapon==='knife'&&!this.game.paused&&this.game.player.hp>0&&this.game.shotCooldown===0)this.inspectLeft=1.5;}
 updateActor(rig:Rig,a:Actor,dt:number){
  const g=this.game;rig.root.visible=!!a&&a.hp>0;if(!a||a.hp<=0)return;
  const pose=rig.animation.step(dt,a);rig.root.position.set(a.x,a.y,a.z);rig.root.rotation.y=pose.bodyYaw;
  rig.hips.position.y=pose.hipsY;rig.torso.rotation.set(pose.lean,pose.aimYaw,pose.roll);
  rig.head.position.y=.72-pose.crouch*.2;rig.head.rotation.x=-pose.pitch*.45;rig.aim.position.y=.44-pose.crouch*.13;rig.aim.rotation.set(-pose.pitch*.8+pose.reload*.32+pose.slide*.1,0,-pose.reload*.25);
  rig.legs.forEach((leg,j)=>{leg.rotation.set(pose.legs[j].hip,0,pose.legs[j].side);rig.knees[j].rotation.x=pose.legs[j].knee;rig.feet[j].rotation.set(-pose.legs[j].hip-pose.legs[j].knee,0,-pose.legs[j].side);});
  rig.arms.forEach((arm,j)=>{arm.rotation.set(.65+pose.arms*(j?-1:1)-pose.reload*(j?.1:.5),j?.08:-1.05,j?.08:.48);rig.forearms[j].rotation.x=1.05+pose.reload*(j?-.1:-.6);});
  rig.gun.position.z=-.4+pose.recoil;rig.gun.rotation.z=pose.reload*-.18;rig.flash.visible=pose.recoil>.035;
  rig.shield.visible=a.shield>0;rig.shield.rotation.y=g.elapsed;rig.health.position.y=2.08-pose.crouch*.5;rig.health.scale.x=a.hp/100;rig.health.rotation.y=g.yaw-pose.bodyYaw;
 }
 render(dt:number){
  this.world.update(this.game.elapsed,this.quality);
  const g=this.game,p=g.player;
  if(g.weapon!==this.lastWeapon){this.kick=0;this.inspectLeft=0;this.lastWeapon=g.weapon;this.slashSide=-1;}
  this.kick=Math.max(0,this.kick-dt*(g.weapon==='knife'?2.15:10));
  this.inspectLeft=Math.max(0,this.inspectLeft-dt);
  const model=this.gunModels.get(g.weapon)!;
  const reload=g.reloadLeft>0?Math.sin(Math.PI*(1-g.reloadLeft/weapons[g.weapon].reload)):0;
  const aim=g.weapon==='knife'?0:g.aim;
  const pose=this.motion.step(dt,{speed:p.hp>0?p.moving:0,grounded:p.y===0,vy:p.vy,crouch:p.crouch,sprinting:g.sprinting,sliding:g.sliding,aim,reload,switching:g.switchLeft>0,kick:g.weapon==='knife'?0:this.kick,sightHeight:model.rig.sightHeight,bobScale:this.weaponBob});
  const eye=g.eye(p);this.camera.position.set(eye.x,eye.y+pose.cameraBob,eye.z);this.camera.rotation.set(g.pitch+g.recoil,g.yaw,pose.cameraRoll);
  const desired=this.fov-aim*(g.weapon==='marksman'?37:21)+pose.sprintBlend*5+pose.slideBlend*3;this.camera.fov+=(desired-this.camera.fov)*(1-Math.exp(-dt*12));this.camera.updateProjectionMatrix();
  for(let i=0;i<this.rigs.length;i++)this.updateActor(this.rigs[i],g.actors[i+1],dt);
  this.pickupMeshes.forEach((mesh,i)=>{mesh.visible=g.pickups[i].ready<=0;mesh.position.y=.45+Math.sin(g.elapsed*2+i)*.1;mesh.rotation.y=g.elapsed*.7;});
  for(let i=0;i<this.tracers.length;i++){const shot=g.shots[i],line=this.tracers[i],impact=this.impacts[i];line.visible=!!shot;impact.visible=!!shot;if(!shot)continue;const from=shot.from;const positions=line.geometry.attributes.position as THREE.BufferAttribute;positions.setXYZ(0,from.x,from.y-.08,from.z);positions.setXYZ(1,shot.to.x,shot.to.y,shot.to.z);positions.needsUpdate=true;(line.material as THREE.LineBasicMaterial).opacity=(1-shot.age/.08)*.75;impact.position.set(shot.to.x,shot.to.y,shot.to.z);}
  for(const [id,mesh]of this.gunModels)mesh.visible=id===g.weapon;
  animateWeapon(model,this.kick,g.reloadLeft>0?1-g.reloadLeft/weapons[g.weapon].reload:0,{slashSide:this.slashSide,draw:g.switchLeft/.25,inspect:this.inspectLeft/1.5});
  updateWeaponFinish(model,g.elapsed);
  const placed=viewmodelPose(pose,g.weapon==='knife'?g.config.knifeStyle??'standard':undefined);
  this.gunRoot.visible=p.hp>0;this.gunRoot.position.set(placed.x,placed.y,placed.z);
  this.gunRoot.rotation.set(placed.rx,placed.ry,placed.rz,placed.order);this.flash.scale.setScalar(g.weapon==='knife'?0:['pistol','handcannon','smg','vector'].includes(g.weapon)?.6:1);this.flash.position.copy(model.rig.muzzle);this.flash.position.z-=.06;this.flash.visible=g.weapon!=='knife'&&this.kick>.6;this.flash.rotation.z=g.elapsed*200;
  this.sun.shadow.needsUpdate=true;this.pipeline.render(dt);
 }
 dispose(){if(this.disposed)return;this.disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();for(const scene of [this.scene,this.weaponScene])scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.disposables.forEach(t=>t.dispose());this.world.dispose();this.pipeline.dispose();this.renderer.dispose();}
}
