import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {WeaponId} from './simulation.ts';
import {createWeaponFinish} from './weapon-finish.ts';

/** Metres; the bore points down -Z. Named groups are independent animation channels. */
export type WeaponRig = {
  id: WeaponId;
  muzzle: THREE.Vector3;
  sightHeight: number;
  magazine: THREE.Group;
  action: THREE.Group;
  supportHand: THREE.Group;
  pump: THREE.Group;
};
export type WeaponModel = THREE.Group & {rig: WeaponRig};
type Profile = readonly (readonly [number, number])[];
type Point = readonly [number, number, number];
type Finish = 'shell' | 'polymer' | 'steel' | 'edge' | 'recess' | 'accent' | 'glove' | 'fabric' | 'stitch' | 'lens' | 'reticle';
type Section = readonly [z: number, width: number, height: number, centerY: number];

const defaultFinish = '#141619';

class ModelBuilder {
  root = new THREE.Group() as WeaponModel;
  body = new THREE.Group();
  magazine = new THREE.Group();
  action = new THREE.Group();
  supportHand = new THREE.Group();
  pump = new THREE.Group();
  finishes: Record<Finish, THREE.Material>;
  muzzle = new THREE.Vector3();
  sightHeight = .143;

  id:WeaponId;showHands:boolean;
  constructor(id: WeaponId, skin?: string, showHands = true) {
    this.id=id;this.showHands=showHands;
    const material = (color: string, metalness: number, roughness: number) => new THREE.MeshStandardMaterial({color, metalness, roughness});
    const finish=createWeaponFinish(skin??defaultFinish);
    this.root.userData.finish=finish;
    this.finishes = {
      shell: finish.material,
      polymer: material('#0e1012', .06, .78),
      steel: material('#1c1f23', .72, .36),
      edge: material('#30343a', .65, .4),
      recess: material('#08090b', .2, .81),
      accent: material('#24272b', .52, .46),
      glove: material('#505849', .02, .95),
      fabric: material('#323d38', .02, 1),
      stitch: material('#737b67', .02, .96),
      lens: new THREE.MeshBasicMaterial({color: '#88ccd2', transparent: true, opacity: .07, side: THREE.DoubleSide, depthWrite: false}),
      reticle: new THREE.MeshBasicMaterial({color: '#ff644b', transparent: true, opacity: .86, depthWrite: false}),
    };
    this.root.name = `viewmodel-${id}`;
    for (const [name, node] of Object.entries({body: this.body, magazine: this.magazine, action: this.action, supportHand: this.supportHand, pump: this.pump})) {
      node.name = name;
      this.root.add(node);
    }
  }

  mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, finish: Finish, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, this.finishes[finish]);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  /** Chamfered side silhouettes, used only where the real part has flat side plates. */
  profile(parent: THREE.Group, points: Profile, width: number, finish: Finish, bevel = .002, x = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (const [z, y] of points.slice(1)) shape.lineTo(z, y);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4, steps: 1});
    geometry.rotateY(-Math.PI / 2).translate(width / 2 + x, 0, 0);
    return this.mesh(parent, geometry, finish);
  }

  box(parent: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, finish: Finish, bevel = .0015) {
    return this.profile(parent, [[z-d/2,y-h/2],[z+d/2,y-h/2],[z+d/2,y+h/2],[z-d/2,y+h/2]], w, finish, Math.min(bevel,w*.19,h*.19,d*.19), x);
  }

  /** Variable octagonal sections produce continuous tapered, machined surfaces. */
  shell(parent: THREE.Group, sections: readonly Section[], finish: Finish, chamfer = .21) {
    const vertices: number[] = [];
    const rings = [...sections].sort((a,b)=>a[0]-b[0]).map(([z,w,h,y]) => {
      const x=w/2, v=h/2, cx=w*chamfer, cy=h*chamfer;
      return [[-x+cx,y-v,z],[x-cx,y-v,z],[x,y-v+cy,z],[x,y+v-cy,z],[x-cx,y+v,z],[-x+cx,y+v,z],[-x,y+v-cy,z],[-x,y-v+cy,z]];
    });
    const triangle = (a:number[],b:number[],c:number[]) => vertices.push(...a,...b,...c);
    for(let n=0;n<rings.length-1;n++) for(let i=0;i<8;i++) {
      const j=(i+1)%8;
      triangle(rings[n][i],rings[n][j],rings[n+1][i]);
      triangle(rings[n][j],rings[n+1][j],rings[n+1][i]);
    }
    for(let i=1;i<7;i++) {
      triangle(rings[0][0],rings[0][i+1],rings[0][i]);
      const last=rings[rings.length-1];
      triangle(last[0],last[i],last[i+1]);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();
    return this.mesh(parent,geometry,finish);
  }

  tube(parent: THREE.Group, x: number, y: number, z: number, radius: number, length: number, finish: Finish, segments = 16) {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1);
    geometry.rotateX(Math.PI / 2);
    return this.mesh(parent, geometry, finish, x, y, z);
  }

  link(parent: THREE.Group, from: Point, to: Point, radius: number, endRadius: number, finish: Finish, segments = 12) {
    const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),delta=b.clone().sub(a);
    const mesh=this.mesh(parent,new THREE.CylinderGeometry(endRadius,radius,delta.length(),segments,1),finish);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    return mesh;
  }

  oval(parent: THREE.Group, center: Point, radii: Point, finish: Finish) {
    const mesh=this.mesh(parent,new THREE.SphereGeometry(1,12,8),finish,...center);
    mesh.scale.set(...radii);
    return mesh;
  }

  ring(parent: THREE.Group, x: number, y: number, z: number, outer: number, inner: number, length: number, finish: Finish, segments = 16) {
    const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: length, bevelEnabled: false, curveSegments: Math.ceil(segments / 2), steps: 1});
    geometry.translate(0, 0, -length / 2);
    return this.mesh(parent, geometry, finish, x, y, z);
  }

  bolt(x: number, y: number, z: number, parent = this.body, radius = .0035) {
    const mesh = this.tube(parent, x, y, z, radius, .002, 'edge', 8);
    mesh.rotation.y = Math.PI / 2;
    this.box(parent,x+Math.sign(x)*.0012,y,z,.0008,.001,radius*1.2,'recess',0);
  }

  rail(start: number, end: number, y = .072, width = .042) {
    this.box(this.body,0,y,(start+end)/2,width*.75,.008,Math.abs(end-start),'steel');
    for(let z=Math.min(start,end)+.006;z<Math.max(start,end);z+=.019) this.box(this.body,0,y+.005,z,width,.006,.009,'polymer',.0007);
  }

  muzzleAt(z: number, y = .025, radius = .018, brake = true) {
    const length=brake?.043:.019;
    this.ring(this.body,0,y,z+length/2,radius,radius*.50,length,'steel');
    this.ring(this.body,0,y,z+.0015,radius*1.025,radius*.51,.003,'edge');
    this.tube(this.body,0,y,z+length*.84,radius*.49,.001,'recess');
    if(brake) for(const s of [-1,1]) for(let i=0;i<3;i++) this.box(this.body,s*radius*.955,y,z+.010+i*.010,.0015,radius*.71,.004,'recess',.0005);
    this.muzzle.set(0,y,z-.006);
  }

  reflex(z = -.018, compact = false, railY = .072) {
    const width=compact?.047:.056, height=compact?.038:.046;
    const bottom=railY+.026, center=bottom+height*.5;
    this.sightHeight=center;
    this.box(this.body,0,railY+.012,z,.038,.017,.046,'steel');
    this.box(this.body,0,bottom-.002,z,.046,.010,.038,'polymer');
    // One curved hood with a real opening: no oversized separate pillars or floating mount.
    const rounded=(path:THREE.Path,w:number,h:number,r:number)=>{
      path.moveTo(-w/2,0); path.lineTo(w/2,0); path.lineTo(w/2,h-r);
      path.quadraticCurveTo(w/2,h,w/2-r,h);path.lineTo(-w/2+r,h);
      path.quadraticCurveTo(-w/2,h,-w/2,h-r);path.lineTo(-w/2,0);
    };
    const frame=new THREE.Shape();rounded(frame,width,height,.010);
    // A clockwise inset gives the hood a genuinely open, curved sight window.
    const inset=new THREE.Path();
    inset.moveTo(-width/2+.004,.004);inset.lineTo(-width/2+.004,height-.010);
    inset.quadraticCurveTo(-width/2+.004,height-.004,-width/2+.010,height-.004);
    inset.lineTo(width/2-.010,height-.004);inset.quadraticCurveTo(width/2-.004,height-.004,width/2-.004,height-.010);
    inset.lineTo(width/2-.004,.004);inset.closePath();frame.holes.push(inset);
    const geometry=new THREE.ExtrudeGeometry(frame,{depth:.012,bevelEnabled:true,bevelThickness:.0008,bevelSize:.0008,bevelSegments:1,curveSegments:6});
    this.mesh(this.body,geometry,'steel',0,bottom,z-.006);
    this.mesh(this.body,new THREE.PlaneGeometry(width-.010,height-.010),'lens',0,center,z-.001);
    this.mesh(this.body,new THREE.CircleGeometry(.00125,12),'reticle',0,center,z+.002);
    this.tube(this.body,width/2+.002,bottom+.004,z,.007,.019,'polymer',12).rotation.y=Math.PI/2;
    this.bolt(width/2+.012,bottom+.004,z,this.body,.003);
  }

  irons(frontZ: number,rearZ: number,height=.095,parent=this.body) {
    this.sightHeight=height;
    this.box(parent,0,height-.010,frontZ,.016,.019,.014,'steel');
    this.box(parent,0,height-.001,frontZ+.005,.0025,.003,.0015,'accent',0);
    for(const s of [-1,1]) this.box(parent,s*.009,height-.004,rearZ,.008,.016,.014,'steel');
    this.box(parent,0,height-.013,rearZ,.025,.006,.015,'polymer');
  }

  scope() {
    const y=.147;this.sightHeight=y;
    for(const z of [-.055,-.18]) {
      this.box(this.body,0,.099,z,.032,.042,.026,'steel');
      this.ring(this.body,0,y,z,.025,.019,.018,'polymer');
      for(const s of [-1,1])this.bolt(s*.027,y,z,this.body,.0025);
    }
    this.ring(this.body,0,y,-.114,.020,.016,.252,'steel',20);
    this.ring(this.body,0,y,-.255,.031,.025,.065,'polymer',20);
    this.ring(this.body,0,y,.024,.026,.020,.044,'polymer',20);
    this.ring(this.body,0,y,-.289,.032,.025,.005,'edge',20);
    this.ring(this.body,0,y,.048,.027,.020,.005,'edge',20);
    this.mesh(this.body,new THREE.CircleGeometry(.019,24),'lens',0,y,.051);
    this.mesh(this.body,new THREE.CircleGeometry(.024,24),'lens',0,y,-.292);
    this.box(this.body,0,y,.052,.0007,.033,.0007,'recess',0);
    this.box(this.body,0,y,.052,.033,.0007,.0007,'recess',0);
    this.mesh(this.body,new THREE.CircleGeometry(.0009,10),'reticle',0,y,.053);
    this.link(this.body,[0,y+.014,-.119],[0,y+.04,-.119],.013,.014,'polymer',16);
    this.link(this.body,[.013,y,-.119],[.038,y,-.119],.012,.013,'polymer',16);
    for(let i=0;i<9;i++)this.ring(this.body,0,y,.006+i*.004,.0263,.025,.0015,'steel',16);
  }

  grip(z=.075,y=-.029,lean=.024,width=.049) {
    this.profile(this.body,[[z-.029,y],[z+.026,y],[z+.026+lean,y-.139],[z-.033+lean,y-.145],[z-.038,y-.051]],width,'polymer',.006);
    for(const s of [-1,1]) {
      this.profile(this.body,[[z-.025,y-.035],[z+.021,y-.035],[z+.023+lean,y-.124],[z-.024+lean,y-.130]],.002,'shell',.002,s*(width/2+.005));
      for(let i=0;i<6;i++)this.box(this.body,s*(width/2+.007),y-.055-i*.011,z+.002+lean*i/6,.0015,.0035,.029,'recess',.0005);
    }
    this.box(this.body,0,y-.139,z+lean-.001,width+.003,.011,.060,'polymer',.004);
  }

  guard(z=.005,y=-.065,width=.049,scale=1) {
    const points:Profile=[[z-.058*scale,y+.011],[z-.063*scale,y-.032*scale],[z-.048*scale,y-.043*scale],[z+.023*scale,y-.043*scale]];
    for(let i=0;i<points.length-1;i++) {
      const a=points[i],c=points[i+1];
      this.link(this.body,[0,a[1],a[0]],[0,c[1],c[0]],.005,.005,'polymer',8).scale.x=width/.010;
    }
    this.link(this.body,[0,y+.010,z-.024],[0,y-.022,z-.030],.004,.004,'steel',8);
  }

  straightMagazine(z:number,length:number,width=.046,depth=.061,tilt=-.05,top=-.045) {
    this.profile(this.magazine,[[z-depth/2,top],[z+depth/2,top],[z+depth/2+tilt*length,top-length],[z-depth/2+tilt*length,top-length]],width,'steel',.003);
    this.box(this.magazine,0,top-length,z+tilt*length,width+.006,.012,depth+.007,'polymer');
    for(const s of [-1,1])for(let i=0;i<2;i++)this.profile(this.magazine,[[z-depth*.25+i*depth*.39,top-.029],[z-depth*.17+i*depth*.39,top-.029],[z-depth*.17+i*depth*.39+tilt*length*.8,top-length*.89],[z-depth*.25+i*depth*.39+tilt*length*.8,top-length*.89]],.0012,'recess',.0005,s*(width/2+.0035));
  }

  curvedMagazine(z=-.096,small=false) {
    const scale=small?.80:1,w=small?.034:.048;
    const shape:Profile=[[-.035,-.047],[.035,-.047],[.033,-.146],[.005,-.219],[-.028,-.250],[-.087,-.225],[-.056,-.187],[-.033,-.130]];
    this.profile(this.magazine,shape.map(([zz,y])=>[z+zz*scale,y*scale]),w,'polymer',.004);
    this.profile(this.magazine,[[z-.087*scale,-.225*scale],[z-.028*scale,-.250*scale],[z-.024*scale,-.240*scale],[z-.082*scale,-.215*scale]],w+.007,'steel',.002);
    for(const s of [-1,1])for(let i=0;i<3;i++)this.profile(this.magazine,[[z+(-.022+i*.017)*scale,-.071*scale],[z+(-.017+i*.017)*scale,-.071*scale],[z+(-.025+i*.014)*scale,-.146*scale],[z+(-.057+i*.014)*scale,-.209*scale],[z+(-.063+i*.014)*scale,-.208*scale],[z+(-.031+i*.014)*scale,-.145*scale]],.0013,'recess',.0004,s*(w/2+.0045));
  }

  stock(start=.125,end=.288,light=false) {
    this.tube(this.body,0,.019,(start+end-.029)/2,.017,end-.029-start,'steel');
    if(light) {
      for(const s of [-1,1])this.link(this.body,[s*.021,-.030,start],[s*.021,-.072,end-.022],.006,.006,'steel',10);
      this.shell(this.body,[[end-.073,.054,.034,.026],[end-.018,.057,.052,.015]],'polymer');
    }else {
      this.profile(this.body,[[start+.027,.037],[end-.025,.044],[end-.008,.018],[end-.011,-.099],[end-.042,-.097],[end-.065,-.041],[start+.027,-.037]],.056,'polymer',.004);
      // The tapered cheek piece follows the upper stock surface.
      this.shell(this.body,[[start+.034,.054,.032,.035],[end-.031,.062,.034,.039]],'shell');
    }
    this.shell(this.body,[[end-.010,.061,.152,-.032],[end+.003,.066,.156,-.032],[end+.008,.059,.147,-.032]],'polymer');
    for(let i=0;i<6;i++)this.box(this.body,0,-.087+i*.022,end+.009,.046,.0025,.001,'recess',0);
  }

  hands(supportZ:number,pistol=false,gripZ=.075) {
    if(!this.showHands)return;
    const finger=(parent:THREE.Group,points:Point[],radius:number)=>{
      for(let i=0;i<points.length-1;i++)this.link(parent,points[i],points[i+1],radius*(1-i*.07),radius*(.96-i*.07),'glove',10);
      for(let i=0;i<points.length;i++)this.oval(parent,points[i],[radius*.98,radius*.98,radius*.98],'glove');
    };
    const sleeve=(parent:THREE.Group,wrist:Point,cuff:Point,elbow:Point)=>{
      this.link(parent,wrist,cuff,.028,.034,'glove',14);
      this.oval(parent,cuff,[.034,.036,.038],'fabric');
      this.link(parent,cuff,elbow,.034,.052,'fabric',16);
      // A soft overlapping sleeve fold follows the arm axis instead of forming a detached box.
      const near:Point=[cuff[0]*.87+elbow[0]*.13,cuff[1]*.87+elbow[1]*.13,cuff[2]*.87+elbow[2]*.13];
      this.link(parent,cuff,near,.035,.038,'fabric',16);
    };
    const right=this.body;
    this.oval(right,[.030,-.116,gripZ+.020],[.027,.047,.034],'glove').rotation.z=-.15;
    this.oval(right,[.048,-.112,gripZ+.022],[.011,.035,.027],'fabric');
    for(let i=0;i<3;i++) {
      const y=-.105-i*.018,z=gripZ-.015+i*.003;
      finger(right,[[.044,y,gripZ+.009],[.039,y-.003,z-.011],[.011,y-.005,z-.023],[-.012,y-.003,z-.010]],.0085-i*.0004);
    }
    finger(right,[[.040,-.078,gripZ+.003],[.040,-.068,gripZ-.033],[.020,-.074,gripZ-.059],[.004,-.080,gripZ-.054]],.008);
    finger(right,[[.025,-.084,gripZ+.034],[-.012,-.073,gripZ+.024],[-.026,-.086,gripZ-.004]],.011);
    sleeve(right,[.036,-.151,gripZ+.047],[.051,-.179,gripZ+.082],[.125,-.335,.267]);
    if(pistol) {
      this.oval(this.supportHand,[-.026,-.123,gripZ-.006],[.025,.038,.038],'glove');
      this.oval(this.supportHand,[-.044,-.126,gripZ-.006],[.010,.025,.028],'fabric');
      for(let i=0;i<3;i++)finger(this.supportHand,[[-.039,-.106-i*.018,gripZ-.016],[-.012,-.112-i*.018,gripZ-.042],[.025,-.110-i*.017,gripZ-.033]],.008);
      finger(this.supportHand,[[-.032,-.103,gripZ+.009],[-.035,-.078,gripZ-.023],[-.026,-.074,gripZ-.051]],.010);
      sleeve(this.supportHand,[-.039,-.151,gripZ+.027],[-.063,-.181,gripZ+.061],[-.172,-.315,.211]);
    }else {
      this.oval(this.supportHand,[-.042,-.047,supportZ],[.024,.029,.045],'glove').rotation.z=-.32;
      this.oval(this.supportHand,[-.056,-.046,supportZ+.006],[.010,.019,.033],'fabric');
      for(let i=0;i<4;i++) {
        const z=supportZ-.027+i*.017;
        finger(this.supportHand,[[-.045,-.051,z],[-.022,-.067,z],[.014,-.063,z],[.033,-.041,z]],.0085-i*.00035);
      }
      finger(this.supportHand,[[-.045,-.028,supportZ+.028],[-.043,.003,supportZ+.010],[-.025,.014,supportZ-.017]],.011);
      sleeve(this.supportHand,[-.059,-.073,supportZ+.030],[-.081,-.109,supportZ+.065],[-.196,-.283,supportZ+.248]);
    }
  }

  finish() {
    for(const node of [this.body,this.magazine,this.action,this.supportHand,this.pump]) {
      const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
      for(const child of [...node.children]) {
        if(!(child instanceof THREE.Mesh))continue;
        child.updateMatrix();
        const original=child.geometry,geometry=original.index?original.toNonIndexed():original.clone();
        geometry.applyMatrix4(child.matrix);
        for(const key of Object.keys(geometry.attributes))if(key!=='position'&&key!=='normal')geometry.deleteAttribute(key);
        geometry.clearGroups();
        const material=child.material as THREE.Material;
        const group=buckets.get(material)??[];group.push(geometry);buckets.set(material,group);
        original.dispose();node.remove(child);
      }
      for(const [material,parts] of buckets) {
        const merged=mergeGeometries(parts,false);
        if(!merged)throw new Error(`Could not build ${this.id} weapon geometry`);
        parts.forEach(part=>part.dispose());merged.computeBoundingBox();merged.computeBoundingSphere();
        const mesh=new THREE.Mesh(merged,material);mesh.name=`${node.name}-${Object.entries(this.finishes).find(([,value])=>value===material)?.[0]}`;
        mesh.castShadow=false;mesh.receiveShadow=false;node.add(mesh);
      }
    }
    const used=new Set<THREE.Material>();this.root.traverse(child=>{if(child instanceof THREE.Mesh)used.add(child.material as THREE.Material);});
    for(const material of Object.values(this.finishes))if(!used.has(material))material.dispose();
    this.root.rig={id:this.id,muzzle:this.muzzle.clone(),sightHeight:this.sightHeight,magazine:this.magazine,action:this.action,supportHand:this.supportHand,pump:this.pump};
    return this.root;
  }
}

function assault(b:ModelBuilder) {
  if(b.id==='carbine') {
    // Compact bullpup: rounded fore-end, high cheek rest and rear magazine well.
    b.shell(b.body,[[-.325,.054,.064,.010],[-.281,.080,.099,.006],[.080,.081,.110,.008],[.245,.078,.104,.006],[.273,.067,.122,-.003]],'shell',.23);
    b.profile(b.body,[[.031,-.027],[.249,-.031],[.259,-.112],[.164,-.119],[.103,-.062]],.073,'polymer',.004);
    b.shell(b.body,[[.259,.080,.159,-.021],[.276,.084,.159,-.021],[.282,.076,.150,-.021]],'polymer');
    b.shell(b.body,[[.080,.074,.026,.070],[.231,.076,.032,.069]],'polymer');
    b.straightMagazine(.156,.167,.047,.061,-.12);b.grip(-.032,-.031,.008);b.guard(-.083,-.063,.050,.88);
    b.tube(b.body,0,.025,-.362,.014,.103,'steel');b.muzzleAt(-.431,.025,.019);
    b.shell(b.body,[[-.321,.062,.061,-.005],[-.290,.085,.084,-.006],[-.145,.083,.083,-.006]],'polymer');
    for(const s of [-1,1]) {
      for(let i=0;i<4;i++)b.box(b.body,s*.043,.003,-.185-i*.029,.002,.019,.018,'recess',.002);
      b.box(b.body,s*.042,.026,.079,.002,.020,.066,'recess');
      b.box(b.body,s*.047,.010,-.072,.009,.010,.031,'steel');
      b.bolt(s*.044,-.002,.215);b.bolt(s*.044,-.001,-.105);
    }
    b.rail(-.267,.090,.074);b.reflex(-.108,false,.074);b.hands(-.239,false,-.032);
  }else {
    // Alloy carbine: continuous octagonal handguard, forged upper and compact adjustable stock.
    b.shell(b.body,[[-.144,.060,.068,.029],[-.118,.072,.082,.027],[.083,.070,.077,.029],[.121,.048,.061,.025]],'shell',.19);
    b.profile(b.body,[[-.123,-.009],[.096,-.009],[.098,-.061],[-.021,-.066],[-.052,-.095],[-.123,-.091]],.059,'polymer',.003);
    b.shell(b.body,[[-.424,.062,.076,.014],[-.409,.077,.092,.014],[-.159,.077,.092,.014],[-.139,.065,.078,.015]],'shell',.22);
    b.ring(b.body,0,.025,-.431,.027,.016,.011,'steel');
    b.tube(b.body,0,.025,-.459,.013,.087,'steel');b.muzzleAt(-.532,.025,.019);
    b.grip();b.guard();b.curvedMagazine();b.stock(.115,.289);
    for(const s of [-1,1]) {
      for(let i=0;i<6;i++) {
        b.box(b.body,s*.039,.019,-.181-i*.037,.0015,.014,.023,'recess',.002);
        b.box(b.body,s*.030,-.025,-.180-i*.037,.0015,.012,.023,'recess',.001);
      }
      b.box(b.body,s*.037,.029,-.017,.0015,.024,.071,'recess');
      b.box(b.body,s*.040,.010,-.031,.006,.009,.047,'steel');
      for(const z of [-.101,.062])b.bolt(s*.034,-.025,z);
      b.bolt(s*.040,-.039,.033,b.body,.004);
      b.box(b.body,s*.044,-.036,.045,.0015,.003,.015,'accent',0);
    }
    b.rail(-.407,.079);b.reflex(-.025);b.hands(-.289);
  }
}

function submachine(b:ModelBuilder) {
  if(b.id==='vector') {
    // Delayed-blowback SMG: short bore, deep forward recoil housing and a folding wire stock.
    b.shell(b.body,[[-.240,.054,.062,.020],[-.218,.073,.085,.020],[.085,.071,.081,.022],[.111,.052,.060,.015]],'shell');
    b.profile(b.body,[[-.177,-.010],[-.048,-.008],[-.005,-.098],[-.043,-.167],[-.140,-.167],[-.175,-.064]],.066,'shell',.005);
    b.profile(b.body,[[-.134,-.069],[-.065,-.069],[-.054,-.162],[-.144,-.168]],.059,'polymer',.004);
    b.grip(.052,-.028,.017);b.guard(-.010,-.064,.050,.86);
    b.straightMagazine(-.108,.202,.039,.052,-.07,-.112);
    b.tube(b.body,0,.025,-.265,.013,.085,'steel');b.muzzleAt(-.318,.025,.020);
    b.shell(b.body,[[-.237,.058,.057,-.007],[-.181,.072,.064,-.008]],'polymer');
    for(const s of [-1,1]) {
      b.box(b.body,s*.038,.028,-.041,.002,.018,.073,'recess');
      b.profile(b.body,[[-.140,-.071],[-.116,-.071],[-.111,-.142],[-.131,-.142]],.0015,'recess',.001,s*.037);
      b.bolt(s*.037,.003,.061);b.bolt(s*.036,-.125,-.063);
      b.box(b.body,s*.041,-.003,-.033,.008,.008,.028,'steel');
    }
    b.link(b.body,[0,.020,.110],[0,.020,.135],.022,.022,'steel');
    for(const s of [-1,1]) {
      b.link(b.body,[s*.018,.020,.135],[s*.021,.016,.264],.0055,.0055,'steel');
      b.link(b.body,[s*.018,-.030,.135],[s*.021,-.067,.264],.0055,.0055,'steel');
    }
    b.shell(b.body,[[.241,.045,.029,.022],[.268,.051,.031,.019]],'polymer');
    b.shell(b.body,[[.266,.051,.136,-.030],[.280,.055,.138,-.030]],'polymer');
    b.rail(-.214,.071);b.reflex(-.021,true);b.hands(-.207,false,.052);
  }else {
    // Roller-lock SMG: stamped round receiver, cocking tube, curved narrow magazine, wire stock.
    b.tube(b.body,0,.024,-.038,.034,.281,'shell',20);
    b.profile(b.body,[[-.171,.009],[.092,.009],[.099,-.055],[-.141,-.057]],.049,'polymer',.003);
    b.shell(b.body,[[-.301,.045,.049,-.002],[-.272,.068,.078,-.005],[-.173,.069,.079,-.004]],'polymer',.32);
    b.tube(b.body,0,.058,-.162,.009,.267,'steel');
    b.link(b.body,[-.006,.058,-.213],[-.043,.058,-.213],.006,.009,'steel');
    b.tube(b.body,0,.024,-.312,.014,.090,'steel');b.muzzleAt(-.380,.024,.018);
    b.grip(.055,-.029,.026,.045);b.guard(-.004,-.064,.046,.84);b.curvedMagazine(-.098,true);
    for(const s of [-1,1]) {
      b.link(b.body,[s*.026,.012,.072],[s*.027,.007,.274],.0045,.0045,'steel');
      b.box(b.body,s*.035,.022,-.017,.0014,.019,.066,'recess');
      b.bolt(s*.029,-.026,.067);
      for(let i=0;i<3;i++)b.box(b.body,s*.034,-.001,-.195-i*.029,.0015,.032,.0025,'recess',0);
    }
    b.shell(b.body,[[.270,.059,.127,-.031],[.282,.064,.137,-.031],[.287,.057,.127,-.031]],'polymer');
    b.rail(-.104,.065,.073);b.reflex(-.013,true,.073);b.hands(-.232,false,.055);
  }
}

function marksman(b:ModelBuilder) {
  // Bolt rifle: slender floated barrel, low chassis fore-end, short magazine and adjustable cheek piece.
  b.shell(b.body,[[-.363,.044,.041,-.019],[-.328,.067,.061,-.021],[-.116,.074,.072,-.014],[.098,.073,.072,-.010],[.126,.050,.057,-.012]],'shell');
  b.tube(b.body,0,.029,-.019,.026,.256,'steel',20);
  b.tube(b.body,0,.029,-.430,.011,.468,'steel',20);
  b.ring(b.body,0,.029,-.176,.023,.012,.025,'steel');b.muzzleAt(-.702,.029,.020);
  b.profile(b.body,[[.100,.023],[.264,.020],[.294,-.009],[.280,-.125],[.226,-.121],[.197,-.053],[.109,-.047]],.066,'shell',.004);
  b.shell(b.body,[[.162,.061,.036,.039],[.256,.065,.042,.039]],'polymer');
  b.shell(b.body,[[.277,.071,.160,-.047],[.294,.077,.166,-.047],[.300,.069,.157,-.047]],'polymer');
  b.grip(.070,-.038,.021,.053);b.guard(.006,-.072,.052,.92);b.straightMagazine(-.071,.103,.052,.078,0);
  for(const s of [-1,1]) {
    for(let i=0;i<4;i++)b.box(b.body,s*.036,-.016,-.160-i*.039,.0015,.012,.023,'recess');
    b.bolt(s*.038,-.026,-.116);b.bolt(s*.036,-.035,.243);
    b.link(b.body,[s*.044,-.043,-.327],[s*.044,-.045,-.169],.006,.005,'steel');
    b.oval(b.body,[s*.044,-.043,-.324],[.011,.010,.014],'polymer');
  }
  b.link(b.action,[.020,.033,.060],[.050,.016,.071],.006,.006,'steel');
  b.oval(b.action,[.055,.011,.074],[.012,.012,.015],'polymer');
  b.rail(-.187,.077,.069);b.scope();b.hands(-.260,false,.070);
}

function handgun(b:ModelBuilder) {
  const heavy=b.id==='handcannon',front=heavy?-.257:-.192,w=heavy?.062:.050;
  b.shell(b.action,[[front,w*.80,.046,.045],[front+.013,w,.058,.045],[.072,w,.058,.045],[.087,w*.80,.048,.042]],'shell',heavy?.20:.16);
  b.profile(b.body,[[front+.026,.014],[.071,.014],[.081,-.038],[-.092,-.040],[-.110,-.017],[front+.026,-.014]],w*.86,'polymer',.003);
  const gripZ=.034;
  b.grip(gripZ,-.026,heavy?.029:.023,heavy?.052:.044);b.guard(-.031,-.054,w*.85,heavy?.91:.81);
  b.straightMagazine(.057,.126,w*.67,.046,.13,-.042);
  b.box(b.magazine,0,-.171,.074,w*.97,.012,.063,'polymer',.003);
  b.tube(b.body,0,.044,front+.074,heavy?.013:.010,heavy?.16:.13,'steel');
  b.muzzleAt(front-.005,.044,heavy?.016:.014,false);
  b.box(b.body,0,-.013,front+.059,w*.57,.006,.054,'steel');
  for(const s of [-1,1]) {
    for(let i=0;i<7;i++)b.box(b.action,s*(w/2+.0015),.042,.062-i*.009,.0014,.032,.0023,'recess',.0003);
    if(heavy)for(let i=0;i<3;i++)b.box(b.action,s*(w/2+.0016),.051,front+.035+i*.017,.0013,.012,.009,'recess',.001);
    b.box(b.action,s*(w/2+.0016),.050,-.054,.0012,.019,.037,'recess');
    b.box(b.body,s*w*.48,-.014,.009,.004,.008,.030,'steel');
    b.bolt(s*w*.53,-.074,.050,b.body,.0027);
  }
  b.box(b.action,0,.074,-.049,w*.54,.0017,.040,'recess',.001);
  b.box(b.action,0,.075,-.049,w*.37,.002,.027,'steel',.001);
  if(heavy)b.profile(b.action,[[front+.006,.074],[front+.028,.084],[.066,.084],[.077,.074]],w*.48,'steel',.001);
  b.irons(front+.026,.063,heavy?.101:.093,b.action);
  b.hands(-.1,true,gripZ);
}

function shotgun(b:ModelBuilder) {
  // Tactical pump: separate upper bore and lower magazine tube, ribbed oval pump, restrained shell carrier.
  b.shell(b.body,[[-.132,.064,.068,.026],[-.110,.077,.084,.023],[.089,.077,.076,.022],[.124,.053,.053,.014]],'steel',.23);
  b.tube(b.body,0,.030,-.390,.018,.540,'steel',20);
  b.tube(b.body,0,-.021,-.334,.015,.417,'steel',16);
  b.muzzleAt(-.678,.030,.021,false);
  b.ring(b.body,0,.030,-.525,.023,.018,.016,'polymer');
  b.tube(b.body,0,-.021,-.551,.017,.024,'steel');
  b.shell(b.pump,[[-.429,.052,.055,-.022],[-.416,.075,.073,-.019],[-.265,.075,.073,-.019],[-.250,.052,.055,-.020]],'shell',.32);
  for(let i=0;i<8;i++)b.shell(b.pump,[[-.274-i*.018,.078,.077,-.019],[-.278-i*.018,.078,.077,-.019]],'polymer',.32);
  for(const s of [-1,1]) {
    b.box(b.body,s*.040,.019,-.023,.0014,.028,.078,'recess');
    b.box(b.body,s*.044,.009,-.033,.007,.008,.026,'edge');
    b.bolt(s*.039,-.014,.064);
  }
  b.grip(.061,-.030,.021,.052);b.guard(-.001,-.068,.052,.92);
  b.profile(b.body,[[.109,.021],[.260,.009],[.287,-.016],[.276,-.122],[.227,-.121],[.198,-.053],[.109,-.046]],.069,'shell',.004);
  b.shell(b.body,[[.269,.075,.161,-.048],[.286,.079,.167,-.048],[.293,.071,.157,-.048]],'polymer');
  b.shell(b.body,[[.165,.060,.024,.026],[.253,.066,.027,.021]],'polymer');
  for(let i=0;i<4;i++) {
    const z=.062-i*.025;
    b.link(b.body,[-.049,-.024,z],[-.049,.017,z],.008,.008,'accent',12);
    b.link(b.body,[-.049,.017,z],[-.049,.023,z],.0088,.0088,'edge',12);
    b.box(b.body,-.047,-.016,z,.017,.016,.019,'polymer');
  }
  // Raised bead and ghost-ring are anchored to the barrel/receiver.
  b.profile(b.body,[[-.592,.043],[-.574,.078],[-.560,.078],[-.550,.043]],.014,'steel',.001);
  b.ring(b.body,0,.083,.069,.013,.008,.008,'steel');
  b.box(b.body,0,.061,.069,.025,.025,.017,'polymer');
  b.box(b.body,0,.083,-.567,.003,.007,.004,'accent',.001);
  b.sightHeight=.083;b.hands(-.337,false,.061);
}

export function buildWeapon(id: WeaponId, skin?: string, showHands = true): WeaponModel {
  const b=new ModelBuilder(id,skin,showHands);
  if(id==='rifle'||id==='carbine')assault(b);
  else if(id==='smg'||id==='vector')submachine(b);
  else if(id==='marksman')marksman(b);
  else if(id==='pistol'||id==='handcannon')handgun(b);
  else shotgun(b);
  return b.finish();
}

/** Root locomotion is supplied by the renderer; these channels only animate moving parts. */
export function animateWeapon(model: WeaponModel, kick: number, reloadFraction: number) {
  const {id,action,magazine,supportHand,pump}=model.rig;
  const recoil=THREE.MathUtils.clamp(Number.isFinite(kick)?kick:0,0,1);
  const progress=THREE.MathUtils.clamp(Number.isFinite(reloadFraction)?reloadFraction:0,0,1);
  const reload=Math.sin(Math.PI*progress);
  action.position.z=(id==='pistol'||id==='handcannon'?.030:.013)*recoil;
  magazine.position.y=-(id==='pistol'||id==='handcannon'?.105:.155)*reload;
  magazine.rotation.x=reload*.10;
  supportHand.position.y=-reload*.025;
  supportHand.position.z=0;pump.position.z=0;
  if(id==='shotgun') {
    const travel=Math.sin(Math.PI*THREE.MathUtils.clamp((1-recoil)*1.5,0,1))*(recoil>0?.053:0);
    pump.position.z=travel;supportHand.position.z=travel;magazine.position.y=0;
  }
}
export function updateWeaponFinish(model:WeaponModel,time:number){model.userData.finish.time.value=Number.isFinite(time)?time:0;}
