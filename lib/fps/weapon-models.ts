import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {WeaponId} from './simulation.ts';

/** Distances are metres. The barrel points along -Z and the receiver sits at the origin. */
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
type Finish = 'shell' | 'polymer' | 'steel' | 'edge' | 'recess' | 'accent' | 'glove' | 'fabric' | 'stitch' | 'lens' | 'reticle';

const defaults: Record<WeaponId, string> = {
  rifle: '#62696b', carbine: '#818675', smg: '#52656c', vector: '#928978',
  marksman: '#707665', pistol: '#616d73', handcannon: '#929c9f', shotgun: '#665e53',
};

class ModelBuilder {
  root = new THREE.Group() as WeaponModel;
  body = new THREE.Group();
  magazine = new THREE.Group();
  action = new THREE.Group();
  supportHand = new THREE.Group();
  pump = new THREE.Group();
  finishes: Record<Finish, THREE.Material>;
  muzzle = new THREE.Vector3();
  sightHeight = .172;

  id: WeaponId;
  constructor(id: WeaponId, skin?: string) {
    this.id=id;
    const material = (color: string, metalness: number, roughness: number) => new THREE.MeshStandardMaterial({color, metalness, roughness});
    this.finishes = {
      shell: material(skin ?? defaults[id], .5, .39),
      polymer: material('#232c31', .12, .72),
      steel: material('#404d54', .8, .28),
      edge: material('#8a999f', .75, .31),
      recess: material('#10191e', .14, .72),
      accent: material('#e8a159', .58, .35),
      glove: material('#626b59', .04, .93),
      fabric: material('#303d3d', .03, 1),
      stitch: material('#929986', .08, .9),
      lens: new THREE.MeshBasicMaterial({color: '#76bfcc', transparent: true, opacity: .11, side: THREE.DoubleSide, depthWrite: false}),
      reticle: new THREE.MeshBasicMaterial({color: '#ff715c', transparent: true, opacity: .82, depthWrite: false}),
    };
    this.root.name = `viewmodel-${id}`;
    for (const [name, node] of Object.entries({body: this.body, magazine: this.magazine, action: this.action, supportHand: this.supportHand, pump: this.pump})) {
      node.name = name; this.root.add(node);
    }
  }

  mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, finish: Finish, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, this.finishes[finish]);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }

  /** A bevelled side profile gives receivers/stocks distinct silhouettes without box seams. */
  profile(parent: THREE.Group, points: Profile, width: number, finish: Finish, bevel = .0035, x = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (const [z, y] of points.slice(1)) shape.lineTo(z, y);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3, steps: 1});
    geometry.rotateY(-Math.PI / 2).translate(width / 2 + x, 0, 0);
    return this.mesh(parent, geometry, finish);
  }

  box(parent: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, finish: Finish, bevel = .0025) {
    return this.profile(parent, [[z-d/2,y-h/2],[z+d/2,y-h/2],[z+d/2,y+h/2],[z-d/2,y+h/2]], w, finish, Math.min(bevel,w*.22,h*.22,d*.22), x);
  }

  tube(parent: THREE.Group, x: number, y: number, z: number, radius: number, length: number, finish: Finish, segments = 12) {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1);
    geometry.rotateX(Math.PI / 2);
    return this.mesh(parent, geometry, finish, x, y, z);
  }

  ring(parent: THREE.Group, x: number, y: number, z: number, outer: number, inner: number, length: number, finish: Finish, segments = 12) {
    const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: length, bevelEnabled: false, curveSegments: Math.ceil(segments / 2), steps: 1});
    geometry.translate(0, 0, -length / 2);
    return this.mesh(parent, geometry, finish, x, y, z);
  }

  bolt(x: number, y: number, z: number, parent = this.body, radius = .0055) {
    const mesh = this.tube(parent, x, y, z, radius, .004, 'edge', 8);
    mesh.rotation.y = Math.PI / 2;
    this.box(parent, x + Math.sign(x) * .003, y, z, .002, .0018, radius * 1.2, 'recess', 0);
  }

  rail(start: number, end: number, y = .08, width = .068) {
    this.box(this.body, 0, y, (start + end) / 2, width * .75, .012, Math.abs(end-start), 'steel');
    for (let z = Math.min(start,end); z < Math.max(start,end); z += .021) this.box(this.body, 0, y + .008, z, width, .009, .011, 'polymer', .0015);
  }

  muzzleAt(z: number, y = .022, radius = .021, brake = true) {
    const length = brake ? .062 : .025;
    this.ring(this.body, 0, y, z + length / 2, radius, radius * .51, length, 'steel');
    this.ring(this.body, 0, y, z + .002, radius * 1.055, radius * .53, .005, 'edge');
    // A recessed dark backstop and real open ring keep the muzzle from looking solid.
    this.tube(this.body, 0, y, z + length * .82, radius * .49, .002, 'recess');
    if (brake) for (const side of [-1,1]) for (let i = 0; i < 2; i++) this.box(this.body, side * radius * .91, y, z + .018 + i * .019, .002, radius * .82, .007, 'recess', 0);
    this.muzzle.set(0, y, z - .012);
  }

  reflex(z = -.035, compact = false) {
    const h = compact ? .141 : .172; this.sightHeight = h;
    const width = compact ? .053 : .074, bottom = h - .035;
    this.box(this.body, 0, bottom - .013, z, width * .78, .016, .061, 'steel');
    this.box(this.body, 0, bottom, z, width, .012, .047, 'polymer');
    for (const s of [-1,1]) {
      const upright = this.box(this.body, s * width / 2, h, z, .007, .069, .023, 'steel');
      upright.rotation.z = -s * .1;
    }
    this.box(this.body, 0, h + .035, z, width * .92, .007, .025, 'steel');
    this.mesh(this.body, new THREE.PlaneGeometry(width * .82, .059), 'lens', 0, h, z - .001);
    this.mesh(this.body, new THREE.CircleGeometry(.0018, 10), 'reticle', 0, h, z + .001);
    this.box(this.body, width*.61, bottom + .005, z, .018, .019, .032, 'polymer');
    this.bolt(width*.76,bottom+.005,z);
  }

  irons(frontZ: number, rearZ: number, height = .116) {
    this.sightHeight = height;
    this.box(this.body,0,height-.016,frontZ,.038,.018,.019,'polymer');
    this.box(this.body,0,height-.004,frontZ,.008,.014,.009,'edge',.001);
    this.box(this.body,0,height+.002,frontZ+.004,.004,.003,.003,'accent',0);
    for(const s of [-1,1])this.box(this.body,s*.013,height-.005,rearZ,.011,.025,.026,'steel');
    this.box(this.body,0,height-.019,rearZ,.033,.006,.026,'polymer');
  }

  scope() {
    this.sightHeight = .185;
    for (const z of [-.08, -.235]) {
      this.box(this.body,0,.113,z,.068,.046,.043,'steel');
      this.ring(this.body,0,.185,z,.038,.029,.025,'polymer');
    }
    this.ring(this.body,0,.185,-.155,.029,.024,.30,'steel',16);
    this.ring(this.body,0,.185,-.325,.045,.037,.068,'polymer',16);
    this.ring(this.body,0,.185,.018,.036,.029,.048,'polymer',16);
    this.ring(this.body,0,.185,-.362,.046,.037,.006,'edge',16);
    this.ring(this.body,0,.185,.047,.037,.030,.006,'edge',16);
    this.mesh(this.body,new THREE.CircleGeometry(.028,24),'lens',0,.185,.048);
    this.mesh(this.body,new THREE.CircleGeometry(.036,24),'lens',0,.185,-.363);
    this.box(this.body,0,.185,.049,.0015,.047,.001,'recess',0);
    this.box(this.body,0,.185,.049,.047,.0015,.001,'recess',0);
    this.mesh(this.body,new THREE.CircleGeometry(.0017,10),'reticle',0,.185,.051);
    const turret=this.tube(this.body,0,.23,-.16,.021,.028,'polymer');turret.rotation.x=Math.PI/2;
    this.box(this.body,.041,.185,-.16,.036,.033,.031,'polymer');
    for(let i=0;i<6;i++)this.box(this.body,0,.247,-.172+i*.005,.037,.003,.0014,'edge',0);
  }

  grip(z = .073, y = -.025, angle = .20, wide = false) {
    const w = wide ? .069 : .058;
    const pts: Profile = [[z-.045,y],[z+.04,y-.008],[z+.055+angle*.1,y-.19],[z-.027+angle*.1,y-.19]];
    this.profile(this.body, pts, w, 'polymer', .007);
    for (const s of [-1,1]) {
      this.profile(this.body, [[z-.034,y-.034],[z+.032,y-.045],[z+.043+angle*.1,y-.168],[z-.019+angle*.1,y-.166]], .005, 'shell', .002, s * w * .51);
      for (let i=0;i<5;i++) this.box(this.body,s*(w*.55+.002),y-.057-i*.022,z+.001+i*angle*.012,.003,.007,.044,'recess',.001);
    }
    this.box(this.body,0,y-.188,z+.013+angle*.1,w+.004,.017,.086,'polymer');
  }

  guard(z = .01, y = -.074, w = .069, size = 1) {
    // Separate rails leave an actual opening around the trigger.
    this.box(this.body,0,y-.047*size,z-.022*size,w,.012,.089*size,'steel');
    const front=this.box(this.body,0,y-.019*size,z-.065*size,w,.058*size,.012,'steel');front.rotation.x=-.2;
    this.box(this.body,0,y-.015*size,z+.025*size,w,.052*size,.011,'polymer');
    const trigger=this.box(this.body,0,y+.002,z-.022*size,.012,.043*size,.012,'edge');trigger.rotation.x=.35;
  }

  straightMagazine(z: number, length: number, width = .059, depth = .084, tilt = -.09) {
    const mag = this.magazine;
    this.profile(mag, [[z-depth/2,-.052],[z+depth/2,-.052],[z+depth/2+tilt*length,-.052-length],[z-depth/2+tilt*length,-.052-length]], width, 'steel', .004);
    this.box(mag,0,-.06-length,z+tilt*length,width+.009,.018,depth+.009,'polymer');
    for (const s of [-1,1]) for(let i=0;i<3;i++) this.box(mag,s*(width/2+.004),-.09-length*.38,z-depth*.27+i*depth*.26,.002,length*.55,.005,'recess',.001);
  }

  curvedMagazine(z = -.095) {
    const mag=this.magazine;
    this.profile(mag,[[z-.048,-.036],[z+.048,-.036],[z+.046,-.17],[z+.005,-.269],[z-.092,-.284],[z-.089,-.251],[z-.043,-.15]],.066,'steel',.006);
    this.profile(mag,[[z-.093,-.273],[z+.011,-.263],[z+.009,-.29],[z-.097,-.3]],.078,'polymer',.004);
    for (const s of [-1,1]) for(let i=0;i<3;i++)this.profile(mag,[[z-.027+i*.021,-.064],[z-.02+i*.021,-.064],[z-.022+i*.021,-.165],[z-.058+i*.021,-.247],[z-.067+i*.021,-.25],[z-.029+i*.021,-.163]],.002,'recess',.001,s*.039);
  }

  skeletonStock(z = .16, compact = false) {
    const end=compact?.37:.43;
    this.tube(this.body,0,.016,(z+end-.065)/2,.025,end-.065-z,'steel');
    this.profile(this.body,[[z+.025,.035],[end-.055,.04],[end-.02,.013],[end-.02,-.104],[end-.061,-.113],[end-.098,-.053],[z+.025,-.043]],.077,'polymer',.005);
    this.profile(this.body,[[end-.129,-.018],[end-.065,-.008],[end-.059,-.061],[end-.09,-.055]],.078,'recess',.002);
    this.box(this.body,0,-.028,end-.001,.091,.19,.027,'polymer',.007);
    for(let i=0;i<5;i++)this.box(this.body,0,-.094+i*.032,end+.015,.074,.004,.003,'recess',0);
    this.box(this.body,0,.046,end-.08,.075,.018,.093,'shell');
  }

  hands(supportZ: number, pistol = false, gripZ = .08) {
    const glove=(parent:THREE.Group,x:number,y:number,z:number,scale=1)=>{
      const palm=this.mesh(parent,new THREE.SphereGeometry(1,8,6),'glove',x,y,z);palm.scale.set(.053*scale,.041*scale,.064*scale);palm.rotation.z=-.2;
      const panel=this.box(parent,x,y+.025*scale,z,.063*scale,.023*scale,.067*scale,'fabric',.006);panel.rotation.z=-.18;
      for(let i=0;i<4;i++) {
        const finger=this.mesh(parent,new THREE.CapsuleGeometry(.011*scale,.049*scale,2,6),'glove',x+.019*scale,y-.014*scale,z+(-.036+i*.022)*scale);
        finger.rotation.z=Math.PI/2-.18;
        this.box(parent,x+.002*scale,y+.014*scale,z+(-.036+i*.022)*scale,.026*scale,.013*scale,.014*scale,'fabric',.003);
      }
      const thumb=this.mesh(parent,new THREE.CapsuleGeometry(.014*scale,.044*scale,2,6),'glove',x+.034*scale,y+.027*scale,z+.027*scale);thumb.rotation.z=-.65;thumb.rotation.x=.5;
    };
    // The firing wrist points back toward the lower right of the screen.
    glove(this.body,.004,-.129,gripZ+.032,.93);
    const wrist=this.box(this.body,.037,-.22,gripZ+.067,.086,.09,.091,'fabric',.012);wrist.rotation.x=-.30;wrist.rotation.z=.17;
    this.box(this.body,.042,-.202,gripZ+.089,.091,.027,.096,'polymer',.005);
    const rightArm=this.mesh(this.body,new THREE.CylinderGeometry(.046,.064,.21,8),'fabric',.081,-.32,gripZ+.133);rightArm.rotation.x=-.45;rightArm.rotation.z=.3;
    if(pistol) {
      glove(this.supportHand,-.038,-.139,gripZ-.016,.89);
      const arm=this.mesh(this.supportHand,new THREE.CylinderGeometry(.044,.064,.29,8),'fabric',-.14,-.27,gripZ+.025);arm.rotation.z=-.62;arm.rotation.x=-.25;
    } else {
      glove(this.supportHand,-.036,-.055,supportZ,1);
      const cuff=this.box(this.supportHand,-.092,-.122,supportZ+.047,.097,.074,.102,'fabric',.012);cuff.rotation.z=-.48;
      this.box(this.supportHand,-.09,-.095,supportZ+.048,.094,.024,.09,'polymer',.005);
      const arm=this.mesh(this.supportHand,new THREE.CylinderGeometry(.046,.065,.28,8),'fabric',-.16,-.24,supportZ+.13);arm.rotation.x=-.48;arm.rotation.z=-.39;
      this.box(this.supportHand,-.114,-.133,supportZ+.081,.009,.049,.048,'stitch',.002);
    }
  }

  finish() {
    // Baking only within named animation groups keeps the entire visible viewmodel to ~20 draw calls.
    for(const node of [this.body,this.magazine,this.action,this.supportHand,this.pump]) {
      const buckets = new Map<THREE.Material,THREE.BufferGeometry[]>();
      for(const child of [...node.children]) {
        if(!(child instanceof THREE.Mesh))continue;
        child.updateMatrix();
        const original=child.geometry;
        let geometry=original.index ? original.toNonIndexed() : original.clone();
        geometry.applyMatrix4(child.matrix);
        // Every primitive carries position and normals; unused UV/tangent layouts must not prevent merging.
        for(const key of Object.keys(geometry.attributes))if(key!=='position'&&key!=='normal')geometry.deleteAttribute(key);
        geometry.clearGroups();
        const material=child.material as THREE.Material;
        const group=buckets.get(material)??[];group.push(geometry);buckets.set(material,group);
        original.dispose();node.remove(child);
      }
      for(const [material,parts] of buckets) {
        const merged=mergeGeometries(parts,false);
        if(!merged)throw new Error(`Could not build ${this.id} weapon geometry`);
        parts.forEach(part=>part.dispose());
        merged.computeBoundingBox();merged.computeBoundingSphere();
        const mesh=new THREE.Mesh(merged,material);mesh.name=`${node.name}-${material.type}`;mesh.castShadow=false;mesh.receiveShadow=false;node.add(mesh);
      }
    }
    // Dispose unreferenced palette entries (e.g. the scope's unused default reflex material).
    const used=new Set<THREE.Material>();this.root.traverse(child=>{if(child instanceof THREE.Mesh)used.add(child.material as THREE.Material);});
    for(const material of Object.values(this.finishes))if(!used.has(material))material.dispose();
    this.root.rig={id:this.id,muzzle:this.muzzle.clone(),sightHeight:this.sightHeight,magazine:this.magazine,action:this.action,supportHand:this.supportHand,pump:this.pump};
    return this.root;
  }
}

function assault(b:ModelBuilder) {
  const carbine=b.id==='carbine';
  if(carbine) {
    // Compact monolithic upper, rear magazine and integrated shoulder shell: a bullpup silhouette.
    b.profile(b.body,[[-.40,.025],[-.355,.074],[.255,.064],[.29,.02],[.283,-.085],[.17,-.103],[.025,-.033],[-.32,-.055]],.095,'shell',.006);
    b.profile(b.body,[[.06,-.018],[.263,-.021],[.273,-.121],[.177,-.146],[.105,-.097]],.091,'polymer',.006);
    b.box(b.body,0,-.049,.292,.105,.208,.034,'polymer',.008);
    b.box(b.body,0,.078,.15,.082,.023,.205,'polymer');
    b.straightMagazine(.15,.192,.063,.082,-.14);b.grip(-.044,-.023,-.16);b.guard(-.098,-.07,.072);
    b.tube(b.body,0,.022,-.455,.020,.16,'steel');b.muzzleAt(-.553,.022,.025);
    b.profile(b.body,[[-.395,.025],[-.34,.049],[-.164,.045],[-.164,-.038],[-.352,-.04]],.104,'polymer',.004);
    for(const s of [-1,1])for(let i=0;i<5;i++)b.box(b.body,s*.056,.01,-.20-i*.031,.003,.024,.017,'recess');
    b.rail(-.285,.105,.087);b.reflex(-.10);b.hands(-.297,false,-.04);
    for(const s of [-1,1]){b.box(b.body,s*.052,.024,.07,.005,.025,.084,'recess');b.box(b.body,s*.058,.013,-.01,.014,.012,.051,'steel');b.bolt(s*.052,-.012,.226);b.bolt(s*.052,.028,-.126);}
  } else {
    // Long alloy upper, vented handguard, curved magazine and telescopic stock.
    b.profile(b.body,[[-.177,.043],[-.138,.071],[.117,.07],[.163,.035],[.146,-.032],[-.138,-.044],[-.177,-.02]],.091,'shell',.005);
    b.profile(b.body,[[-.137,-.026],[.12,-.026],[.118,-.075],[-.03,-.072],[-.063,-.111],[-.141,-.11]],.082,'polymer',.004);
    b.profile(b.body,[[-.457,.025],[-.444,.06],[-.166,.062],[-.163,-.055],[-.435,-.051]],.095,'shell',.005);
    b.tube(b.body,0,.022,-.512,.018,.14,'steel');b.muzzleAt(-.621,.022,.025);
    b.tube(b.body,0,.057,-.465,.008,.114,'steel',8);
    b.grip();b.guard();b.curvedMagazine();b.skeletonStock();
    for(const s of [-1,1]) {
      for(let i=0;i<6;i++)b.box(b.body,s*.051,.012,-.213-i*.034,.003,.027,.021,'recess',.0015);
      b.box(b.body,s*.047,.027,-.014,.004,.029,.094,'recess');
      b.box(b.body,s*.054,.007,-.047,.012,.009,.03,'steel');
      for(const z of [-.126,.08])b.bolt(s*.049,-.014,z);
      b.box(b.body,s*.049,-.025,.026,.003,.008,.029,'accent');
    }
    b.rail(-.437,.096,.079);b.reflex(-.008);b.hands(-.32);
  }
}

function submachine(b:ModelBuilder) {
  const vector=b.id==='vector';
  if(vector) {
    // The deep recoil housing and grip-fed magazine keep this clearly distinct from a short rifle.
    b.profile(b.body,[[-.26,.045],[-.222,.074],[.101,.071],[.146,.035],[.13,-.079],[-.009,-.19],[-.131,-.187],[-.167,-.067],[-.249,-.041]],.093,'shell',.006);
    b.profile(b.body,[[-.121,-.079],[-.022,-.076],[.064,-.124],[.037,-.197],[-.109,-.207]],.08,'polymer',.006);
    b.grip(.063,-.02,.15);b.guard(-.004,-.077,.077,.87);
    b.straightMagazine(.095,.275,.051,.071,.12);
    b.tube(b.body,0,.026,-.292,.017,.098,'steel');b.muzzleAt(-.358,.026,.025);
    for(const s of [-1,1]) {
      b.box(b.body,s*.05,.025,-.084,.004,.025,.098,'recess');
      b.profile(b.body,[[-.117,-.10],[-.069,-.103],[-.077,-.174],[-.107,-.174]],.002,'recess',.002,s*.051);
      b.bolt(s*.051,.016,.074);b.bolt(s*.051,-.158,-.032);
      for(let i=0;i<3;i++)b.box(b.body,s*.051,.017,-.194-i*.019,.003,.027,.01,'recess');
    }
    b.box(b.body,0,-.025,.193,.05,.078,.122,'steel');
    b.profile(b.body,[[.194,.018],[.354,.012],[.362,-.101],[.319,-.11],[.315,-.035],[.194,-.039]],.049,'polymer',.005);
    b.box(b.body,0,-.04,.365,.067,.17,.026,'polymer',.006);
    b.rail(-.227,.097,.083);b.reflex(-.015,true);b.hands(-.2);
  }else {
    // Rounded stamped receiver, tubular cocking tube, slim straight magazine and wire stock.
    b.tube(b.body,0,.02,-.04,.047,.32,'shell');
    b.profile(b.body,[[-.2,.015],[.12,.012],[.126,-.07],[-.17,-.068]],.069,'polymer',.004);
    b.profile(b.body,[[-.344,.032],[-.298,.049],[-.179,.037],[-.174,-.047],[-.318,-.05]],.086,'polymer',.008);
    b.tube(b.body,0,.068,-.178,.012,.305,'steel');
    b.tube(b.body,-.047,.071,-.233,.009,.044,'steel',8).rotation.y=Math.PI/2;
    b.tube(b.body,0,.02,-.348,.021,.115,'steel');b.muzzleAt(-.422,.02,.024);
    b.grip(.06,-.026,.28);b.guard(.002,-.079,.062,.91);b.straightMagazine(-.106,.226,.043,.065,-.22);
    for(const s of [-1,1]) {
      b.box(b.body,s*.034,.015,.204,.012,.014,.225,'steel');
      b.box(b.body,s*.044,.009,-.285,.004,.037,.005,'recess');
      b.box(b.body,s*.049,.009,-.018,.003,.031,.075,'recess');
      b.bolt(s*.044,-.044,.084);
    }
    b.box(b.body,0,-.028,.33,.091,.177,.022,'polymer',.006);
    b.rail(-.10,.071,.077);b.reflex(-.011,true);b.hands(-.255);
  }
}

function marksman(b:ModelBuilder) {
  b.profile(b.body,[[-.39,.022],[-.36,.055],[.098,.048],[.175,.017],[.166,-.055],[-.1,-.079],[-.37,-.044]],.105,'shell',.006);
  b.tube(b.body,0,.028,-.036,.038,.302,'steel',12);
  b.tube(b.body,0,.028,-.509,.017,.42,'steel',16);b.muzzleAt(-.762,.028,.025);
  for(const z of [-.37,-.32])b.ring(b.body,0,.028,z,.033,.025,.028,'steel');
  b.profile(b.body,[[.104,.028],[.362,.04],[.414,.008],[.406,-.152],[.331,-.143],[.29,-.061],[.109,-.055]],.097,'shell',.007);
  b.box(b.body,0,-.057,.423,.107,.212,.029,'polymer',.008);
  b.box(b.body,0,.052,.285,.09,.041,.167,'polymer',.006);
  b.grip(.083,-.035,.31,true);b.guard(.012,-.082,.077,.98);b.straightMagazine(-.067,.129,.071,.106,0);
  for(const s of [-1,1]) {
    b.profile(b.body,[[-.36,-.003],[-.138,-.019],[-.149,-.055],[-.353,-.028]],.005,'polymer',.002,s*.054);
    b.bolt(s*.056,-.018,-.219);b.bolt(s*.052,-.038,.279);
    for(let i=0;i<4;i++)b.box(b.body,s*.056,-.013,-.17-i*.042,.003,.014,.022,'recess');
  }
  b.tube(b.action,.061,.048,.082,.011,.064,'steel').rotation.y=Math.PI/2;
  const knob=b.mesh(b.action,new THREE.SphereGeometry(.02,8,6),'polymer',.094,.039,.087);knob.scale.set(1,1,1.17);
  // Folded bipod legs sit along the fore-end, without adding aim-obscuring bulk.
  for(const s of [-1,1]) {b.box(b.body,s*.065,-.054,-.326,.014,.018,.197,'steel');b.box(b.body,s*.065,-.049,-.218,.018,.023,.021,'polymer');}
  b.rail(-.19,.089,.085);b.scope();b.hands(-.274);
}

function handgun(b:ModelBuilder) {
  const heavy=b.id==='handcannon',front=heavy?-.304:-.234,w=heavy?.082:.069;
  // The complete slide is a separate animation group, with its own exposed ejection recess.
  b.profile(b.action,[[front,.026],[front+.015,.076],[.089,.076],[.104,.054],[.098,.01],[front+.006,.009]],w,'shell',.0045);
  b.profile(b.body,[[front+.033,.009],[.085,.008],[.089,-.048],[-.116,-.047],[-.14,-.02],[front+.033,-.024]],w*.88,'polymer',.005);
  const gripZ=.036;
  b.grip(gripZ,-.028,.31,heavy);b.guard(-.031,-.069,w*.92,heavy?1.04:.9);
  b.straightMagazine(.075,.164,w*.7,.066,.14);
  b.box(b.magazine,0,-.225,.084,w*.98,.023,.095,'polymer',.004);
  b.tube(b.body,0,.039,front+.079,.014,heavy?.20:.14,'steel');
  b.muzzleAt(front-.012,.039,heavy?.022:.019,false);
  b.box(b.body,0,-.011,front+.079,w*.74,.008,.075,'steel');
  for(const s of [-1,1]) {
    for(let i=0;i<6;i++) b.box(b.action,s*(w/2+.005),.038,.062-i*.012,.003,.045,.0034,'recess',.0006);
    if(heavy)for(let i=0;i<3;i++)b.box(b.action,s*(w/2+.005),.048,front+.051+i*.022,.003,.018,.012,'recess',.001);
    b.box(b.action,s*(w/2+.005),.046,-.068,.002,.025,.056,'recess');
    b.box(b.body,s*w*.47,-.02,.012,.007,.012,.04,'steel');
    b.box(b.body,s*w*.5,-.056,.058,.006,.015,.025,'polymer');
    b.bolt(s*w*.53,-.101,.074);
  }
  if(heavy) {
    b.profile(b.action,[[front+.004,.077],[front+.025,.098],[.074,.098],[.089,.077]],w*.51,'steel',.002);
    b.irons(front+.033,.071,.116);
  } else b.irons(front+.035,.071,.102);
  b.hands(-.1,true,gripZ);
}

function shotgun(b:ModelBuilder) {
  b.profile(b.body,[[-.15,.042],[-.115,.072],[.098,.066],[.145,.027],[.126,-.047],[-.149,-.047]],.107,'steel',.005);
  b.tube(b.body,0,.027,-.447,.026,.606,'steel',16);
  b.tube(b.body,0,-.031,-.372,.022,.45,'steel');
  b.ring(b.body,0,.027,-.599,.033,.026,.024,'polymer');
  b.muzzleAt(-.77,.027,.030,false);
  b.tube(b.body,0,-.031,-.606,.025,.028,'edge');
  b.profile(b.pump,[[-.491,.011],[-.465,.03],[-.284,.028],[-.26,.004],[-.27,-.065],[-.47,-.07],[-.491,-.044]],.097,'shell',.006);
  for(let i=0;i<8;i++)b.box(b.pump,0,-.021,-.285-i*.025,.105,.082,.008,'polymer',.002);
  for(const s of [-1,1]) {
    b.box(b.body,s*.058,.013,-.036,.003,.039,.111,'recess');
    b.box(b.body,s*.063,.006,-.044,.013,.012,.035,'edge');
    b.bolt(s*.056,-.018,.083);
  }
  b.grip(.064,-.027,.18,true);b.guard(-.003,-.078,.079,1.02);
  b.profile(b.body,[[.129,.027],[.37,.008],[.405,-.023],[.387,-.154],[.319,-.153],[.275,-.067],[.129,-.053]],.101,'shell',.006);
  b.box(b.body,0,-.07,.404,.107,.194,.035,'polymer',.008);
  b.box(b.body,0,.025,.287,.085,.028,.143,'polymer');
  // Visible spare shells identify the shotgun even when only the receiver is onscreen.
  for(let i=0;i<4;i++) {
    const shell=b.tube(b.body,-.071,-.004,.069-i*.032,.011,.055,'accent',10);shell.rotation.x=Math.PI/2;
    const cap=b.tube(b.body,-.071,.026,.069-i*.032,.012,.011,'edge',10);cap.rotation.x=Math.PI/2;
    b.box(b.body,-.071,-.014,.069-i*.032,.029,.018,.025,'polymer');
  }
  b.irons(-.651,.082,.117);b.hands(-.368);
}

export function buildWeapon(id: WeaponId, skin?: string): WeaponModel {
  const b=new ModelBuilder(id,skin);
  if(id==='rifle'||id==='carbine')assault(b);
  else if(id==='smg'||id==='vector')submachine(b);
  else if(id==='marksman')marksman(b);
  else if(id==='pistol'||id==='handcannon')handgun(b);
  else shotgun(b);
  return b.finish();
}

/** Optional animation layered on the renderer's existing root recoil/reload motion. */
export function animateWeapon(model: WeaponModel, kick: number, reloadFraction: number) {
  const {id,action,magazine,supportHand,pump}=model.rig;
  const reload=Math.sin(Math.PI*THREE.MathUtils.clamp(reloadFraction,0,1));
  action.position.z=(id==='pistol'||id==='handcannon'? .037:.019)*kick;
  magazine.position.y=-(id==='pistol'||id==='handcannon'?.115:.19)*reload;
  magazine.rotation.x=reload*.14;
  supportHand.position.y=-reload*.045;
  if(id==='shotgun') {
    const pumpTravel=Math.sin(Math.PI*THREE.MathUtils.clamp((1-kick)*1.5,0,1))*(kick>0?.065:0);
    pump.position.z=pumpTravel;supportHand.position.z=pumpTravel;
    magazine.position.y=0;
  }
}
