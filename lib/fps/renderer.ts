import * as THREE from 'three';
import {type Simulation,type Actor,weapons,type WeaponId} from './simulation.ts';
import {type Box} from './maps.ts';

type Rig={root:THREE.Group;legs:THREE.Group[];shield:THREE.Mesh;health:THREE.Mesh};
export class ArenaRenderer{
 renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(80,1,.06,160);weaponScene=new THREE.Scene();weaponCamera=new THREE.PerspectiveCamera(65,1,.02,10);gunRoot=new THREE.Group();gunModels=new Map<WeaponId,THREE.Group>();flash:THREE.Mesh;sun:THREE.DirectionalLight;rigs:Rig[]=[];pickupMeshes:THREE.Group[]=[];tracers:THREE.Line[]=[];impacts:THREE.Mesh[]=[];materials=new Map<string,THREE.MeshStandardMaterial>();disposables:THREE.Texture[]=[];game:Simulation;kick=0;lastShotCount=0;bob=0;fov=80;quality='high';
 constructor(canvas:HTMLCanvasElement,game:Simulation){
  this.game=game;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
  this.scene.background=new THREE.Color(game.map.sky);this.scene.fog=new THREE.Fog(game.map.fog,27,100);
  this.scene.add(new THREE.HemisphereLight(0xc8dcf4,0x342b21,2.2));
  this.sun=new THREE.DirectionalLight(game.map.id==='relay'?0xc6e9ff:0xffdeb1,3.5);this.sun.position.set(-18,35,12);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-35,right:35,top:30,bottom:-30,near:1,far:90});this.sun.shadow.bias=-.0006;this.sun.shadow.normalBias=.03;this.scene.add(this.sun);
  this.camera.rotation.order='YXZ';this.buildWorld();
  this.rigs=game.actors.slice(1).map(a=>this.actor(a));
  this.weaponScene.add(new THREE.HemisphereLight(0xffffff,0x3b332f,3));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-2,4,2);this.weaponScene.add(key);this.weaponScene.add(this.gunRoot);
  for(const id of ['rifle','smg','marksman'] as WeaponId[]){const model=this.weapon(id);this.gunModels.set(id,model);this.gunRoot.add(model);}
  this.flash=new THREE.Mesh(new THREE.ConeGeometry(.06,.22,6),new THREE.MeshBasicMaterial({color:0xffd16f,transparent:true,opacity:.9,depthWrite:false}));this.flash.rotation.x=-Math.PI/2;this.flash.position.set(0,.025,-.68);this.gunRoot.add(this.flash);
  for(let i=0;i<32;i++){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xffcc88,transparent:true,opacity:.8,depthWrite:false}));line.frustumCulled=false;line.visible=false;this.tracers.push(line);this.scene.add(line);const impact=new THREE.Mesh(new THREE.SphereGeometry(.045,5,4),new THREE.MeshBasicMaterial({color:0xffcf83}));impact.visible=false;this.impacts.push(impact);this.scene.add(impact);}
 }
 material(color:string,metal=.1,rough=.75){const key=color+metal+rough;if(!this.materials.has(key))this.materials.set(key,new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough}));return this.materials.get(key)!;}
 box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string,metal=.1){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.material(color,metal));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 cylinder(parent:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,color:string){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),this.material(color,.5));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 label(text:string,width=3,color='#eddfc8'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,512,128);ctx.fillStyle=color;ctx.font='bold 55px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,65,490);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.disposables.push(texture);return new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
 }
 buildWorld(){
  const {map,boxes,pickups}=this.game,accent=map.accent;
  this.box(this.scene,0,-.22,0,map.width+20,.4,map.depth+20,map.ground);
  // Thin inlaid strips give the floor scale and mark actual routes through the arena.
  for(let x=-24;x<=24;x+=4)this.box(this.scene,x,-.012,0,.035,.012,40,'#292f32');
  for(let z=-20;z<=20;z+=4)this.box(this.scene,0,-.012,z,48,.012,.035,'#292f32');
  for(const b of boxes)if(b.material!=='prop')this.cover(b);
  for(const s of map.spawns){const ring=new THREE.Mesh(new THREE.RingGeometry(.7,.76,32),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.4,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(s.x,.012,s.z);this.scene.add(ring);}
  for(let i=0;i<map.landmarks.length;i++){const p=map.landmarks[i];const sign=this.label(p.label.toUpperCase(),3.4,accent);sign.rotation.x=-Math.PI/2;sign.position.set(p.x,.018,p.z+1.2);this.scene.add(sign);}
  for(const d of map.decorations){const covering=map.walls.find(b=>Math.abs(b.x-d.x)<b.w/2&&Math.abs(b.z-d.z)<b.d/2),base=covering?.h??0;
   if(d.kind==='tower'){this.cylinder(this.scene,d.x,base+2,d.z,.14,4,'#555c5f');this.box(this.scene,d.x,base+4,d.z,.8,.25,.65,accent);}
   else if(d.kind==='pipe'){const pipe=this.cylinder(this.scene,d.x,base+.4,d.z,.28,2.2,'#747b78');pipe.rotation.z=Math.PI/2;}
   else if(d.kind==='barrel'){this.cylinder(this.scene,d.x,base+.5,d.z,.35,1,'#676348');}
   else {this.box(this.scene,d.x,base+.15,d.z,.7,.3,.7,'#343e42');if(d.kind==='light')this.glow(d.x,base+.32,d.z,.5,.05,.5,accent);}
  }
  // Perimeter architecture remains outside the playable floor.
  for(let i=0;i<10;i++){const x=-30+i*7,h=10+(i*7%11);this.box(this.scene,x,h/2,-29,5,h,8,map.id==='relay'?'#394853':'#51453e');this.box(this.scene,x,h+.15,-29,5.3,.3,8.3,'#252d32');for(let j=3;j<h;j+=3)this.box(this.scene,x,j,-24.97,4,.4,.05,'#718088');}
  if(map.id==='foundry'){
   for(const x of [-29,29]){this.cylinder(this.scene,x,10,-10,2,20,'#4d4540');this.cylinder(this.scene,x,18,-10,2.1,.7,'#b67446');}
   for(const z of [-18,18]){this.box(this.scene,0,7.5,z,50,.35,.4,'#544d45');for(const x of [-24.8,24.8])this.box(this.scene,x,3.75,z,.4,7.5,.4,'#544d45');}
  }else if(map.id==='relay'){
   this.cylinder(this.scene,28,11,0,1.4,22,'#b4bec2');const dish=new THREE.Mesh(new THREE.SphereGeometry(4,20,12,0,Math.PI*2,0,Math.PI/2),this.material('#bac6c9',.4));dish.position.set(28,20,0);dish.rotation.z=-.45;this.scene.add(dish);
   for(const z of [-18,18])this.glow(0,.025,z,42,.03,.08,accent);
  }else{
   for(const x of [-25,25]){this.box(this.scene,x,10,6,.8,20,.8,'#aa773c');this.box(this.scene,x,19,-7,.9,1,32,'#ba8647');for(let z=-19;z<8;z+=5)this.box(this.scene,x,16,z,.15,6,.15,'#49483d');}
  }
  const name=this.label('SKILLCLASH / '+map.name.toUpperCase(),12);name.position.set(0,5,-19.97);this.scene.add(name);
  this.pickupMeshes=pickups.map(p=>{const root=new THREE.Group();root.position.set(p.x,.42,p.z);const color=p.kind==='health'?'#69e2b0':'#75b9ff';this.box(root,0,0,0,.48,.22,.48,'#25323c');this.box(root,0,.125,0,.28,.02,.07,color);if(p.kind==='health')this.box(root,0,.126,0,.07,.02,.28,color);else this.box(root,0,.126,.12,.28,.02,.06,color);const light=new THREE.Mesh(new THREE.RingGeometry(.48,.52,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5,side:THREE.DoubleSide}));light.rotation.x=-Math.PI/2;light.position.y=-.4;root.add(light);this.scene.add(root);return root;});
 }
 glow(x:number,y:number,z:number,w:number,h:number,d:number,color:string){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));mesh.position.set(x,y,z);this.scene.add(mesh);}
 cover(b:Box){
  const color=b.color??'#5c6264';this.box(this.scene,b.x,b.h/2,b.z,b.w,b.h,b.d,color,b.material==='concrete'?.05:.5);
  this.box(this.scene,b.x,b.h+.045,b.z,b.w+.08,.09,b.d+.08,'#30383b');
  if(b.material==='container'){
   const wide=b.w>b.d;const count=Math.floor((wide?b.w:b.d)/.6);for(let i=1;i<count;i++){const offset=(-(wide?b.w:b.d)/2+i*.6);if(wide){for(const side of [-1,1])this.box(this.scene,b.x+offset,b.h/2,b.z+side*(b.d/2+.035),.065,b.h-.22,.065,color,.5);}else for(const side of [-1,1])this.box(this.scene,b.x+side*(b.w/2+.035),b.h/2,b.z+offset,.065,b.h-.22,.065,color,.5);}
   const label=this.label('SC / '+String(Math.abs(Math.round(b.x*13+b.z*5))).padStart(3,'0'),Math.min(b.w-.2,2.4));label.position.set(b.x,b.h*.65,b.z+b.d/2+.071);this.scene.add(label);
  }else if(b.material==='crate'){
   for(const x of [-1,1])this.box(this.scene,b.x+x*b.w*.33,b.h/2,b.z,b.w*.055,b.h+.06,b.d+.07,'#333c3a');
   this.box(this.scene,b.x,b.h*.6,b.z+b.d/2+.02,Math.min(1,b.w*.7),.1,.025,this.game.map.accent);
  }else{
   this.box(this.scene,b.x,.22,b.z,b.w+.07,.44,b.d+.07,'#3b4142');
   if(b.h>2){this.box(this.scene,b.x,b.h-.55,b.z+b.d/2+.014,b.w*.8,.12,.028,this.game.map.accent);for(const side of [-1,1])this.box(this.scene,b.x+side*(b.w/2-.12),b.h/2,b.z+b.d/2+.06,.12,b.h,.12,'#353d40');}
  }
 }
 actor(a:Actor):Rig{
  const root=new THREE.Group(),ally=a.team===this.game.player.team,armor=ally?'#315c72':'#514d48',trim=ally?'#6ae7ff':'#ff8662';
  this.box(root,0,1.15,0,.59,.55,.35,armor,.45);this.box(root,0,.9,.02,.45,.17,.29,'#252c30');this.box(root,0,1.18,-.2,.43,.36,.1,'#292f31');this.box(root,0,1.32,-.263,.2,.05,.018,trim);
  this.box(root,0,1.64,0,.42,.36,.39,'#383f43',.45);this.box(root,0,1.67,-.203,.35,.1,.025,trim,.6);this.box(root,0,1.49,-.1,.32,.1,.28,'#282e31');
  const legs:THREE.Group[]=[];for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.16,.84,0);this.box(leg,0,-.2,0,.22,.42,.25,'#303639');this.box(leg,0,-.55,0,.19,.34,.22,armor);this.box(leg,0,-.77,-.06,.23,.14,.36,'#20282b');root.add(leg);legs.push(leg);const arm=this.box(root,side*.39,1.16,-.11,.19,.48,.23,armor);arm.rotation.x=-.6;this.box(root,side*.36,.98,-.37,.16,.16,.3,'#272e30');}
  this.box(root,.25,1.08,-.48,.13,.15,.62,'#171f24',.6);this.box(root,.25,1.1,-.83,.06,.06,.25,'#697274',.7);
  const shield=new THREE.Mesh(new THREE.CapsuleGeometry(.52,1.05,4,10),new THREE.MeshBasicMaterial({color:ally?0x63dffc:0xffbb75,transparent:true,opacity:.1,wireframe:true,depthWrite:false}));shield.position.y=.95;root.add(shield);
  const health=new THREE.Mesh(new THREE.PlaneGeometry(.65,.045),new THREE.MeshBasicMaterial({color:trim,side:THREE.DoubleSide,depthTest:true}));health.position.y=2.1;root.add(health);this.scene.add(root);return {root,legs,shield,health};
 }
 weapon(id:WeaponId){
  const root=new THREE.Group(),short=id==='smg',long=id==='marksman',color=long?'#5c6659':short?'#475866':'#555b5a';
  this.box(root,0,0,0,.095,.12,.32,color,.6);this.box(root,0,.072,-.04,.078,.025,.35,'#151e24',.7);
  this.box(root,0,-.115,.05,.06,.19,.09,'#252d32');this.box(root,0,-.15,-.085,.063,.23,.12,'#242e34');
  this.box(root,0,.004,-.3,.074,.09,short?.2:long?.43:.32,color,.5);const barrel=this.cylinder(root,0,.024,long?-.68:short?-.48:-.57,.021,long?.3:.2,'#222d32');barrel.rotation.x=Math.PI/2;
  this.box(root,0,-.016,.22,.09,.1,.16,'#242c31');this.box(root,0,-.05,.34,.1,.18,.08,'#182328');
  for(let i=0;i<5;i++)this.box(root,0,.026,-.18-i*.042,.083,.067,.012,'#1d282d');
  // Reflex sight: its center lines up with the camera when aiming.
  this.box(root,0,.106,-.01,.07,.05,.045,'#1c282f');for(const side of [-1,1])this.box(root,side*.038,.173,-.01,.01,.09,.025,'#1c282f');this.box(root,0,.218,-.01,.086,.012,.025,'#1c282f');
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(.064,.074),new THREE.MeshBasicMaterial({color:0x95d7f0,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false}));glass.position.set(0,.172,-.012);root.add(glass);
  this.box(root,.052,.03,.025,.006,.035,.09,this.game.map.accent);
  // Gloved support hand and forearm, part of the first-person rig.
  const hand=this.box(root,-.045,-.068,-.26,.11,.085,.14,'#525b54');hand.rotation.z=-.2;const arm=this.box(root,-.1,-.2,-.19,.11,.28,.12,'#2b3639');arm.rotation.z=-.35;
  this.box(root,.01,-.16,.075,.09,.1,.13,'#525b54');return root;
 }
 resize(width:number,height:number){this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.weaponCamera.aspect=width/height;this.weaponCamera.updateProjectionMatrix();}
 setQuality(quality:string){if(this.quality===quality)return;this.quality=quality;this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?1.6:1));this.renderer.shadowMap.enabled=quality==='high';}
 shot(){this.kick=1;}
 render(dt:number){
  const g=this.game,p=g.player;this.kick=Math.max(0,this.kick-dt*10);this.bob+=dt*p.moving*2.5;
  const bob=Math.sin(this.bob)*.022*(1-g.aim)*Number(p.y===0&&p.hp>0),eye=g.eye(p);this.camera.position.set(eye.x,eye.y+bob,eye.z);this.camera.rotation.set(g.pitch+g.recoil,g.yaw,Math.sin(this.bob*.5)*.002*(1-g.aim));
  const desired=this.fov-g.aim*(g.weapon==='marksman'?37:21)+(g.sprinting?7:0);this.camera.fov+=(desired-this.camera.fov)*Math.min(1,dt*12);this.camera.updateProjectionMatrix();
  for(let i=0;i<this.rigs.length;i++){const a=g.actors[i+1],rig=this.rigs[i];rig.root.visible=a.hp>0;if(a.hp<=0)continue;rig.root.position.set(a.x,a.y,a.z);rig.root.rotation.y=a.yaw;rig.root.scale.y=a.crouch?.7:1;rig.legs.forEach((leg,j)=>leg.rotation.x=Math.sin(g.elapsed*10+j*Math.PI)*Math.min(.6,a.moving*.14));rig.shield.visible=a.shield>0;rig.shield.rotation.y=g.elapsed;rig.health.scale.x=a.hp/100;rig.health.rotation.y=g.yaw-a.yaw;}
  this.pickupMeshes.forEach((mesh,i)=>{mesh.visible=g.pickups[i].ready<=0;mesh.position.y=.45+Math.sin(g.elapsed*2+i)*.1;mesh.rotation.y=g.elapsed*.7;});
  for(let i=0;i<this.tracers.length;i++){const shot=g.shots[i],line=this.tracers[i],impact=this.impacts[i];line.visible=!!shot;impact.visible=!!shot;if(!shot)continue;const from=shot.from;const positions=line.geometry.attributes.position as THREE.BufferAttribute;positions.setXYZ(0,from.x,from.y-.08,from.z);positions.setXYZ(1,shot.to.x,shot.to.y,shot.to.z);positions.needsUpdate=true;(line.material as THREE.LineBasicMaterial).opacity=(1-shot.age/.08)*.75;impact.position.set(shot.to.x,shot.to.y,shot.to.z);}
  for(const [id,mesh]of this.gunModels)mesh.visible=id===g.weapon;
  const reload=g.reloadLeft>0?Math.sin(Math.PI*(1-g.reloadLeft/weapons[g.weapon].reload)):0;
  this.gunRoot.visible=p.hp>0;this.gunRoot.position.set(.27*(1-g.aim)+Math.sin(this.bob*.5)*.008*(1-g.aim),-.25+g.aim*.078-Math.abs(bob)-reload*.25-(g.switchLeft>0?.16:0),-.43+this.kick*.04);
  this.gunRoot.rotation.set(this.kick*.05-reload*.4,g.sprinting?-.28:0,-reload*.45+(g.sprinting?-.25:0));this.flash.visible=this.kick>.6;this.flash.rotation.z=g.elapsed*200;
  this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.weaponCamera);
 }
 dispose(){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();for(const scene of [this.scene,this.weaponScene])scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.disposables.forEach(t=>t.dispose());this.renderer.dispose();}
}
