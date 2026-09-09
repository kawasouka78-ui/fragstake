// Every arena is carved from a solid footprint. The same geometry drives
// movement, navigation, bullets and rendering; each map has its own floor plan.
export type MapId='citadel'|'depot'|'underpass'|'foundry'|'relay'|'drydock';
export type Box={x:number;z:number;w:number;d:number;h:number;y?:number;material:string;color?:string};
export type ArenaMap={id:MapId;name:string;tagline:string;description:string;width:number;depth:number;sky:string;fog:string;ground:string;accent:string;walls:Box[];spawns:{x:number;z:number;yaw:number}[];landmarks:{x:number;z:number;label:string}[];decorations:{kind:string;x:number;z:number;h?:number}[]};
export type Rect={x1:number;z1:number;x2:number;z2:number};
export type ArenaRoom=Rect&{name:string;code:string;color:string};
export type ArenaDoor={x:number;z:number;width:number;axis:'x'|'z';label:string;color:string;room:ArenaRoom;destination:ArenaRoom;roomNormal:number;clearance?:number};
export type ArenaEdge={x:number;z:number;length:number;axis:'x'|'z';normal:number};
export type ArenaRoomSign=ArenaEdge&{room:ArenaRoom};
export type CitadelRoom=ArenaRoom;
export type CitadelDoor=ArenaDoor;
export type CitadelEdge=ArenaEdge;
export type CitadelRoomSign=ArenaRoomSign;
export type MapLayout={width:number;depth:number;height:number;cell:number;rooms:ArenaRoom[];passages:Rect[];floor:boolean[][];doors:ArenaDoor[];edges:ArenaEdge[];roomSigns:ArenaRoomSign[];walls:Box[];frameColor:string;beamColor:string;walkable:(x:number,z:number)=>boolean};
type LayoutDesign={width:number;depth:number;height:number;rooms:ArenaRoom[];passages:Rect[];cover:Box[];frameColor?:string;beamColor?:string;doorWidths?:number[];largeDoorHeight?:number};
const contains=(r:Rect,x:number,z:number)=>x>r.x1&&x<r.x2&&z>r.z1&&z<r.z2;
const cover=(x:number,z:number,w:number,d:number,h:number,material:string,color?:string):Box=>({x,z,w,d,h,material,color});
const spawn=(x:number,z:number,yaw:number)=>({x,z,yaw});

function buildLayout(design:LayoutDesign):MapLayout{
 const {width,depth,height,rooms,passages}=design,cell=2,cols=width/cell,rows=depth/cell;
 const frameColor=design.frameColor??'#40575c',beamColor=design.beamColor??'#52686b';
 const floor=Array.from({length:rows},(_,row)=>Array.from({length:cols},(_,col)=>[...rooms,...passages].some(r=>contains(r,(col+.5)*cell-width/2,(row+.5)*cell-depth/2))));
 const walkable=(x:number,z:number)=>floor[Math.floor((z+depth/2)/cell)]?.[Math.floor((x+width/2)/cell)]??false;
 function hallwayDestination(room:ArenaRoom,x:number,z:number):ArenaRoom|undefined{
  const queue=[{col:Math.floor((x+width/2)/cell),row:Math.floor((z+depth/2)/cell)}],seen=new Set<number>();
  for(let i=0;i<queue.length;i++){
   const {col,row}=queue[i],key=row*cols+col;
   if(col<0||col>=cols||row<0||row>=rows||seen.has(key)||!floor[row][col])continue;
   seen.add(key);const cx=(col+.5)*cell-width/2,cz=(row+.5)*cell-depth/2;
   if(contains(room,cx,cz))continue;
   const destination=rooms.find(r=>r!==room&&contains(r,cx,cz));if(destination)return destination;
   for(const [dx,dz]of [[-1,0],[1,0],[0,-1],[0,1]])queue.push({col:col+dx,row:row+dz});
  }
 }
 // Complete room-to-hall openings only. Both jambs need solid support;
 // broad intersections never acquire freestanding frames or partial lintels.
 const doors:ArenaDoor[]=[];
 for(const room of rooms){
  const sides:{axis:'x'|'z';constant:number;first:number;last:number;roomNormal:number}[]=[
   {axis:'x',constant:room.z1,first:room.x1,last:room.x2,roomNormal:1},
   {axis:'x',constant:room.z2,first:room.x1,last:room.x2,roomNormal:-1},
   {axis:'z',constant:room.x1,first:room.z1,last:room.z2,roomNormal:1},
   {axis:'z',constant:room.x2,first:room.z1,last:room.z2,roomNormal:-1},
  ];
  for(const {axis,constant,first,last,roomNormal}of sides){
   const point=(along:number,offset:number)=>({x:axis==='x'?along:constant+offset,z:axis==='x'?constant+offset:along});
   let start:number|undefined;
   for(let along=first;along<=last;along+=cell){
    const outside=point(along+cell/2,-roomNormal*.25),open=along<last&&walkable(outside.x,outside.z);
    if(open){start??=along;continue;}if(start===undefined)continue;
    const openingWidth=along-start,centre=(start+along)/2,ends=[point(start-.2,-roomNormal*.2),point(along+.2,-roomNormal*.2)];
    if((design.doorWidths??[4,6]).includes(openingWidth)&&ends.every(p=>!walkable(p.x,p.z))){
     const entry=point(centre,-roomNormal*.25),destination=hallwayDestination(room,entry.x,entry.z),position=point(centre,0);
     if(destination){const door:ArenaDoor={...position,width:openingWidth,axis,label:destination.name.toUpperCase(),color:room.color,room,destination,roomNormal};if(design.largeDoorHeight&&openingWidth>=8)door.clearance=design.largeDoorHeight;doors.push(door);}
    }start=undefined;
   }
  }
 }
 // Greedy rectangles preserve the exact solid-cell outline.
 const used=floor.map(row=>row.map(Boolean)),walls:Box[]=[];
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)if(!used[row][col]){
  let w=1,d=1;while(col+w<cols&&!used[row][col+w])w++;
  while(row+d<rows&&Array.from({length:w},(_,i)=>!used[row+d][col+i]).every(Boolean))d++;
  for(let z=row;z<row+d;z++)for(let x=col;x<col+w;x++)used[z][x]=true;
  walls.push({x:(col+w/2)*cell-width/2,z:(row+d/2)*cell-depth/2,w:w*cell,d:d*cell,h:height,material:'concrete'});
 }
 walls.push(...design.cover);
 for(const p of doors)for(const side of [-1,1])walls.push(cover(p.x+(p.axis==='x'?side*p.width/2:0),p.z+(p.axis==='z'?side*p.width/2:0),p.axis==='x'?.18:.28,p.axis==='x'?.28:.18,(p.clearance??3.2)+.25,'frame',frameColor));
 // Only exposed wall faces receive architectural trim and sign mounting.
 const edgeCells=new Map<string,number[]>(),edges:ArenaEdge[]=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(floor[r][c])for(const [dx,dz]of [[-1,0],[1,0],[0,-1],[0,1]]){
  if(floor[r+dz]?.[c+dx])continue;
  const axis=dx?'z':'x',normal=dx?-dx:-dz,constant=dx?(c+(dx>0?1:0))*cell-width/2:(r+(dz>0?1:0))*cell-depth/2;
  const key=[axis,constant,normal].join(':'),values=edgeCells.get(key)??[];values.push(dx?r*cell-depth/2:c*cell-width/2);edgeCells.set(key,values);
 }
 for(const [key,values]of edgeCells){const [axis,constant,normal]=key.split(':');values.sort((a,b)=>a-b);let first=values[0],last=first;
  const commit=()=>edges.push({x:axis==='x'?(first+last+cell)/2:Number(constant),z:axis==='z'?(first+last+cell)/2:Number(constant),length:last-first+cell,axis:axis as 'x'|'z',normal:Number(normal)});
  for(const v of values.slice(1)){if(v===last+cell)last=v;else{commit();first=last=v;}}commit();
 }
 const roomSigns:ArenaRoomSign[]=rooms.flatMap(room=>{
  const candidates=edges.flatMap(edge=>{
   const alongX=edge.axis==='x',onWall=alongX?(edge.z===room.z1&&edge.normal===1)||(edge.z===room.z2&&edge.normal===-1):(edge.x===room.x1&&edge.normal===1)||(edge.x===room.x2&&edge.normal===-1);
   if(!onWall)return [];
   const middle=alongX?edge.x:edge.z,first=Math.max(middle-edge.length/2,alongX?room.x1:room.z1),last=Math.min(middle+edge.length/2,alongX?room.x2:room.z2);
   if(last-first<5)return [];
   return [{...edge,room,x:alongX?(first+last)/2:edge.x,z:alongX?edge.z:(first+last)/2,length:last-first}];
  });candidates.sort((a,b)=>b.length-a.length);return candidates.slice(0,1);
 });
 return {width,depth,height,cell,rooms,passages,floor,doors,edges,roomSigns,walls,frameColor,beamColor,walkable};
}

export const CITADEL_WIDTH=64,CITADEL_DEPTH=56,CITADEL_HEIGHT=4.75,CITADEL_CELL=2;
export const citadelRooms:CitadelRoom[]=[
 {x1:-28,z1:-24,x2:-16,z2:-12,name:'Freight',code:'01',color:'#eba164'},
 {x1:-6,z1:-24,x2:6,z2:-12,name:'Security',code:'02',color:'#70c3c7'},
 {x1:16,z1:-24,x2:28,z2:-12,name:'Workshop',code:'03',color:'#eba164'},
 {x1:-28,z1:-6,x2:-20,z2:6,name:'West passage',code:'04',color:'#70c3c7'},
 {x1:-8,z1:-6,x2:8,z2:6,name:'Concourse',code:'05',color:'#e9c68a'},
 {x1:20,z1:-6,x2:28,z2:6,name:'Server room',code:'06',color:'#70c3c7'},
 {x1:-28,z1:12,x2:-16,z2:24,name:'Dispatch',code:'07',color:'#eba164'},
 {x1:-6,z1:12,x2:6,z2:24,name:'Control',code:'08',color:'#70c3c7'},
 {x1:16,z1:12,x2:28,z2:24,name:'Loading bay',code:'09',color:'#eba164'},
];
export const citadelPassages:Rect[]=[
 {x1:-16,z1:-22,x2:-6,z2:-18},{x1:6,z1:-16,x2:16,z2:-12},
 {x1:-28,z1:-12,x2:-24,z2:-6},{x1:2,z1:-12,x2:6,z2:-6},{x1:24,z1:-12,x2:28,z2:-6},
 {x1:-20,z1:0,x2:-8,z2:4},{x1:8,z1:-4,x2:20,z2:0},
 {x1:-24,z1:6,x2:-20,z2:12},{x1:-6,z1:6,x2:-2,z2:12},{x1:20,z1:6,x2:24,z2:12},
 {x1:-16,z1:18,x2:-6,z2:22},{x1:6,z1:12,x2:16,z2:16},
 // Two flanking routes turn at the centre instead of exposing a full-length lane.
 {x1:-20,z1:-14,x2:-12,z2:-10},{x1:-16,z1:-12,x2:-12,z2:2},
 {x1:-16,z1:0,x2:-10,z2:4},{x1:-14,z1:2,x2:-10,z2:12},{x1:-20,z1:10,x2:-10,z2:14},
 {x1:12,z1:-14,x2:20,z2:-10},{x1:12,z1:-12,x2:16,z2:-2},
 {x1:10,z1:-4,x2:16,z2:0},{x1:10,z1:-2,x2:14,z2:12},{x1:10,z1:10,x2:20,z2:14},
];

// Depot is one tall freight warehouse with staggered container rows. Narrow
// north/south service lanes loop around its machinery and loading apron.
const depotRooms:ArenaRoom[]=[
 {x1:-32,z1:-18,x2:20,z2:18,name:'Transfer warehouse',code:'D1',color:'#efbd69'},
 {x1:26,z1:-22,x2:36,z2:12,name:'Loading apron',code:'D2',color:'#e7b770'},
 {x1:-28,z1:-28,x2:12,z2:-24,name:'North service lane',code:'D3',color:'#b7c09e'},
 {x1:-28,z1:24,x2:6,z2:30,name:'Packing lane',code:'D4',color:'#e2c492'},
 {x1:14,z1:24,x2:34,z2:30,name:'Dispatch lane',code:'D5',color:'#df9f61'},
];
const depotPassages:Rect[]=[
 {x1:20,z1:-12,x2:26,z2:-4},{x1:20,z1:4,x2:26,z2:12},
 {x1:-26,z1:-24,x2:-22,z2:-18},{x1:6,z1:-24,x2:10,z2:-18},
 {x1:-24,z1:18,x2:-20,z2:24},{x1:-2,z1:18,x2:2,z2:24},
 {x1:14,z1:18,x2:18,z2:24},{x1:30,z1:12,x2:34,z2:24},
 {x1:6,z1:26,x2:14,z2:30},
];
const depotCover:Box[]=[
 cover(-24,-9,12,5,6.2,'container-stack','#a45e3b'),
 cover(4,-10,14,4.8,3.2,'container','#a4a28b'),
 cover(-15,9,14,5,3.2,'container','#ae7143'),
 cover(11,9,12,5,3.2,'container','#526b70'),
 cover(-28,8,3.2,3.2,1.2,'pallet-stack','#aa8558'),
 cover(-6,-12,3.2,3,1.65,'pallet-stack','#b99866'),
 cover(14,-1,3.6,3,1.3,'pallet-stack','#ae8857'),
 cover(-5,14,3,2.6,1.1,'pallet-stack','#a68050'),
 // The transfer press is a real composite obstacle, including its overhead head.
 cover(-6,0,6.8,5.2,2.65,'freight-press','#b79a50'),
 cover(-8.95,0,.65,5.2,5.5,'press-upright','#6f7970'),
 cover(-3.05,0,.65,5.2,5.5,'press-upright','#6f7970'),
 cover(31,-15,3,5,2.7,'cargo','#a88958'),cover(31,6,3.2,4,2.2,'pallet-stack','#b49365'),
 cover(-13,26.9,3.2,1.5,1.35,'pallet-stack','#b69465'),cover(24,27,3.2,1.4,1.4,'cargo','#b28c58'),
 // Closed loading shutters are shallow skins against the actual east wall.
 cover(35.9,-15,.18,8,4.9,'loading-shutter','#73786f'),
 cover(35.9,-3,.18,8,4.9,'loading-shutter','#7e8176'),
 cover(35.9,8,.18,6,4.9,'loading-shutter','#6e766f'),
];
for(const z of [-12,0,12])for(const x of [-31.5,19.5])depotCover.push(cover(x,z,.8,.8,z===0?8.25:7.3,'steel-column','#5c6864'));
const depotLayout=buildLayout({width:80,depth:64,height:8.25,rooms:depotRooms,passages:depotPassages,cover:depotCover,doorWidths:[4,6,8],largeDoorHeight:4.8,frameColor:'#666d60',beamColor:'#5f6b66'});
const roofBox=(x:number,z:number,w:number,d:number,y:number,h:number,material:string,color?:string):Box=>({x,z,w,d,y,h,material,color});
const depotRoof:Box[]=[
 roofBox(0,0,80,64,8.25,.35,'ceiling'),
 roofBox(-6,-14,52,8,7.3,.95,'warehouse-roof','#9ea38e'),roofBox(-6,14,52,8,7.3,.95,'warehouse-roof','#9ea38e'),
 roofBox(-6,-7,52,6,7.8,.45,'warehouse-roof','#a8ac97'),roofBox(-6,7,52,6,7.8,.45,'warehouse-roof','#a8ac97'),
 roofBox(31,-5,10,34,6.5,1.75,'warehouse-roof','#929d92'),
 roofBox(-8,-26,40,4,3.75,4.5,'service-ceiling','#94998c'),
 roofBox(-11,27,34,6,4.25,4,'service-ceiling','#a4a28e'),roofBox(24,27,20,6,4.25,4,'service-ceiling','#a4a28e'),
 roofBox(-6,0,7.45,1.1,5.45,.7,'press-head','#c0a052'),
];
for(const p of depotPassages){const wide=p.z2-p.z1>=8,y=wide?6.5:3.75;depotRoof.push(roofBox((p.x1+p.x2)/2,(p.z1+p.z2)/2,p.x2-p.x1,p.z2-p.z1,y,8.25-y,'service-ceiling','#92998b'));}
// Open rectangular steel trusses: both chords and every web member collide.
for(const z of [-12,0,12]){const top=z===0?7.98:7.03;
 depotRoof.push(roofBox(-6,z,52,.34,6,.24,'truss-member','#5c6964'),roofBox(-6,z,52,.34,top,.22,'truss-member','#5c6964'));
 for(let x=-31.5;x<=19.5;x+=6.375)depotRoof.push(roofBox(x,z,.18,.34,6.24,top-6.24,'truss-member','#697771'));
}
const depotMap:ArenaMap={
 id:'depot',name:'Depot',tagline:'Work the container lanes. Seize the press.',
 description:'A tall freight warehouse with stacked containers, a giant transfer press, closed loading shutters, exposed steel trusses and compressed service lanes.',
 width:80,depth:64,sky:'#36392f',fog:'#555a4e',ground:'#918c79',accent:'#efbd69',walls:depotLayout.walls,
 spawns:[spawn(-29,-15,-Math.PI/2),spawn(-17,-15,-Math.PI/2),spawn(-28,0,-Math.PI/2),spawn(-22,15,0),spawn(-12,14,0),spawn(-15,0,-Math.PI/2),spawn(0,0,Math.PI/2),spawn(15,-15,Math.PI),spawn(17,15,0),spawn(8,3,Math.PI/2),spawn(29,-20,Math.PI),spawn(29,10,0),spawn(-25,-26,-Math.PI/2),spawn(9,-26,Math.PI/2),spawn(-25,27,-Math.PI/2),spawn(3,27,Math.PI/2),spawn(17,27,-Math.PI/2),spawn(32,27,Math.PI/2)],
 landmarks:[{x:-13,z:0,label:'Transfer press'},{x:-27,z:14,label:'Container bays'},{x:14,z:-15,label:'Warehouse north'},{x:29,z:-7,label:'Loading apron'},{x:-8,z:-26,label:'North service lane'},{x:-20,z:27,label:'Packing lane'},{x:30,z:27,label:'Dispatch lane'}],decorations:[],
};

// Underpass is a single long underground station. A wide island platform and
// two rail channels dominate the room; end crossings and a central crosswalk
// join its side walks. Pump and signal loops sit outside that station volume.
const underpassRooms:ArenaRoom[]=[
 {x1:-16,z1:-32,x2:16,z2:32,name:'Central line',code:'U1',color:'#aad4d8'},
 {x1:-28,z1:-6,x2:-20,z2:8,name:'West concourse',code:'U2',color:'#e5d9ab'},
 {x1:22,z1:-10,x2:30,z2:6,name:'Ticket hall',code:'U3',color:'#b3d3d8'},
 {x1:-28,z1:-28,x2:-20,z2:-16,name:'Pump chamber',code:'U4',color:'#9dbda9'},
 {x1:-28,z1:18,x2:-20,z2:30,name:'South utility',code:'U5',color:'#9bb5ca'},
 {x1:22,z1:18,x2:30,z2:30,name:'Signal south',code:'U6',color:'#b4cbd6'},
 {x1:22,z1:-30,x2:30,z2:-18,name:'Signal north',code:'U7',color:'#a6c8c9'},
];
const underpassPassages:Rect[]=[
 {x1:-20,z1:-4,x2:-16,z2:4},{x1:16,z1:-4,x2:22,z2:2},
 {x1:-20,z1:-26,x2:-16,z2:-22},{x1:-26,z1:-16,x2:-22,z2:-6},
 {x1:-20,z1:22,x2:-16,z2:26},{x1:-26,z1:8,x2:-22,z2:18},
 {x1:16,z1:22,x2:22,z2:26},{x1:24,z1:6,x2:28,z2:18},
 {x1:16,z1:-26,x2:22,z2:-22},{x1:24,z1:-18,x2:28,z2:-10},
];
const underpassCover:Box[]=[
 cover(-24,-22,3.2,3.4,2.3,'pump-unit','#6b8b8b'),
 cover(-24,24,2.8,3.2,2.1,'pump-unit','#70888e'),
 cover(27.8,-2,2.4,2,1.65,'ticket-machine','#657f83'),
 cover(27,24,2.5,3,2.35,'signal-cabinet','#566d7e'),
 cover(26,-24,2.6,2.8,2.3,'signal-cabinet','#58777f'),
];
for(const x of [-5,5])for(const z of [-24,-12,12,24])underpassCover.push(cover(x,z,1.2,1.2,7.4,'metro-column','#b5c5c7'));
// Rails and curb/guard members are separate exact collision boxes. The dark
// ballast beds stay at floor level and are not navigable; crossings stay flat.
for(const x of [-10,10])for(const z of [-16,16]){
 underpassCover.push(cover(x,z,4,24,.065,'track-bed','#28363a'));
 for(const side of [-1,1]){
  underpassCover.push(cover(x+side*2,z,.18,24,.22,'track-curb','#7c8a8a'));
  underpassCover.push({...cover(x+side*2,z,.13,24,.12,'track-guard','#688089'),y:.9});
  for(let p=z-11;p<=z+11;p+=4)underpassCover.push(cover(x+side*2,p,.14,.14,1.02,'track-guard','#688089'));
  underpassCover.push({...cover(x+side*.9,z,.1,24,.12,'rail','#aab7b7'),y:.065});
 }
 for(let p=z-11.5;p<z+12;p+=1.2)underpassCover.push({...cover(x,p,3.5,.28,.065,'sleeper','#6a675e'),y:.065});
}
for(const z of [-18,-8,8,18]){const x=z<0?-2.2:2.2;
 underpassCover.push({...cover(x,z,3.2,1,.18,'bench-seat','#777f78'),y:.42});
 underpassCover.push({...cover(x,z+.45,3.2,.14,.75,'bench-back','#73908f'),y:.6});
 for(const side of [-1,1])underpassCover.push(cover(x+side*1.2,z,.14,.75,.42,'bench-leg','#405b66'));
}
const underpassLayout=buildLayout({width:64,depth:80,height:8.1,rooms:underpassRooms,passages:underpassPassages,cover:underpassCover,frameColor:'#526c78',beamColor:'#6d858c'});
const vaultLevel=(x:number)=>4.55+3.5*Math.sqrt(Math.max(0,1-(x/16)**2));
const underpassRoof:Box[]=[roofBox(0,0,64,80,8.1,.35,'ceiling')];
// One-metre faceted vault segments form a real curved ceiling silhouette.
for(let x=-15.5;x<16;x+=1){const level=vaultLevel(x);underpassRoof.push(roofBox(x,0,1,64,level,8.1-level,'vault-shell','#8b9a99'));
 for(const z of [-28,-20,-12,-4,4,12,20,28]){
  underpassRoof.push(roofBox(x,z,1,.3,level-.28,.28,'vault-rib','#b6c4bb'));
  if(x<15.5){const next=vaultLevel(x+1),low=Math.min(level,next),high=Math.max(level,next);underpassRoof.push(roofBox(x+.5,z,.13,.3,low-.28,high-low+.28,'vault-rib','#b6c4bb'));}
 }
}
for(const x of [-5,5])underpassRoof.push(roofBox(x,0,.8,64,7.4,.4,'platform-beam','#657c80'));
for(const room of underpassRooms.slice(1))underpassRoof.push(roofBox((room.x1+room.x2)/2,(room.z1+room.z2)/2,room.x2-room.x1,room.z2-room.z1,3.85,4.25,'utility-ceiling','#738b90'));
for(const p of underpassPassages)underpassRoof.push(roofBox((p.x1+p.x2)/2,(p.z1+p.z2)/2,p.x2-p.x1,p.z2-p.z1,3.7,4.4,'utility-ceiling','#69858c'));
// Suspended platform information boards, with real support rods to the vault.
for(const z of [-16,16]){
 underpassRoof.push(roofBox(0,z,6,.2,3.7,1,'platform-board','#344f60'));
 for(const x of [-2.5,2.5])underpassRoof.push(roofBox(x,z,.075,.075,4.7,vaultLevel(x)-4.7,'sign-hanger','#758b91'));
}
const underpassMap:ArenaMap={
 id:'underpass',name:'Underpass',tagline:'Own the platform. Cross between the rails.',
 description:'A vaulted underground station with twin rail channels, a long island platform, tiled crossing halls, platform columns and pump/signal side loops.',
 width:64,depth:80,sky:'#1e323c',fog:'#48616a',ground:'#818f8e',accent:'#a7d0d6',walls:underpassLayout.walls,
 spawns:[spawn(-3,-27,Math.PI),spawn(3,-18,Math.PI),spawn(0,-10,Math.PI),spawn(0,10,0),spawn(-3,18,0),spawn(3,27,0),spawn(-14,-14,Math.PI),spawn(14,14,0),spawn(-26,-3,-Math.PI/2),spawn(-22,5,Math.PI/2),spawn(-26,-25,Math.PI),spawn(-22,-18,0),spawn(-26,21,Math.PI),spawn(-22,28,0),spawn(24,-7,Math.PI),spawn(28,3,0),spawn(24,20,Math.PI),spawn(28,-28,Math.PI)],
 landmarks:[{x:0,z:0,label:'Central crossing'},{x:0,z:-25,label:'Platform north'},{x:0,z:25,label:'Platform south'},{x:-26,z:3,label:'West concourse'},{x:24,z:3,label:'Ticket hall'},{x:-26,z:-18,label:'Pump chamber'},{x:-22,z:20,label:'South utility'},{x:24,z:28,label:'Signal south'},{x:28,z:-20,label:'Signal north'}],decorations:[],
};
const citadelLayout=buildLayout({width:CITADEL_WIDTH,depth:CITADEL_DEPTH,height:CITADEL_HEIGHT,rooms:citadelRooms,passages:citadelPassages,cover:[
cover(-23,-18,2.6,2.6,2.25,'cargo','#ad7854'),
cover(-1,-20,2,2.4,2.25,'terminal','#476d72'),
cover(22,-18,2.5,3,2.25,'machine','#90988e'),
cover(-27.3,1,1.2,4,2.4,'locker','#628185'),
cover(0,0,3.2,1.6,1.05,'console','#506b6c'),
cover(-7.5,-5.5,1,1,4.75,'pillar','#b1aca0'),
cover(7.5,5.5,1,1,4.75,'pillar','#b1aca0'),
cover(26.8,1,1.6,4,2.5,'server','#344f58'),
cover(-21,18,3.2,2,1.8,'cargo','#ad7854'),
cover(1,19,3,2.4,2,'terminal','#506b6c'),
cover(22,20,3,2.4,2.6,'cargo','#b28b61'),
]});
export const citadelFloor=citadelLayout.floor,citadelDoors=citadelLayout.doors,citadelEdges=citadelLayout.edges,citadelRoomSigns=citadelLayout.roomSigns;
export const citadelWalkable=citadelLayout.walkable;
const layouts={citadel:citadelLayout,depot:depotLayout,underpass:underpassLayout};
export const maps:ArenaMap[]=[{
 id:'citadel',name:'Citadel',tagline:'Own the corner. Take the next room.',
 description:'A connected indoor facility with nine distinct rooms, framed doorways, bent service passages and multiple flanking routes.',
 width:CITADEL_WIDTH,depth:CITADEL_DEPTH,sky:'#18232a',fog:'#24363c',ground:'#737c7b',accent:'#efa775',walls:citadelLayout.walls,
 spawns:[spawn(-26,-21,Math.PI),spawn(-18,-15,0),spawn(-3,-21,-Math.PI/2),spawn(3,-15,0),spawn(19,-21,Math.PI),spawn(26,-15,0),spawn(-23,-3,Math.PI),spawn(-23,4,0),spawn(-5,0,-Math.PI/2),spawn(5,2,Math.PI/2),spawn(23,-3,Math.PI),spawn(23,4,0),spawn(-25,21,0),spawn(-18,15,Math.PI),spawn(-3,15,Math.PI),spawn(3,22,0),spawn(18,21,0),spawn(25,15,Math.PI)],
 landmarks:[{x:-25,z:-15,label:'Freight'},{x:-3,z:-15,label:'Security'},{x:25,z:-21,label:'Workshop'},{x:-23,z:2,label:'West passage'},{x:5,z:4,label:'Concourse'},{x:23,z:2,label:'Server room'},{x:-25,z:15,label:'Dispatch'},{x:3,z:15,label:'Control'},{x:25,z:21,label:'Loading bay'}],decorations:[],
},depotMap,underpassMap];
// Old saved arenas and unknown identifiers retain the original Citadel fallback.
export function getMap(id?:string){return maps.find(map=>map.id===id)??maps[0];}
export function getMapLayout(map:ArenaMap|string):MapLayout{const id=typeof map==='string'?map:map.id;return Object.hasOwn(layouts,id)?layouts[id as keyof typeof layouts]:citadelLayout;}
export function overheadBoxes(map:ArenaMap):Box[]{const layout=getMapLayout(map);
 const portals=layout.doors.map(p=>({x:p.x,z:p.z,w:p.axis==='x'?p.width+.24:.28,d:p.axis==='x'?.28:p.width+.24,y:p.clearance??3.2,h:layout.height-(p.clearance??3.2),material:'overhead',color:layout.frameColor}));
 if(map.id==='depot')return [...depotRoof,...portals];
 if(map.id==='underpass')return [...underpassRoof,...portals];
 return [
 {x:0,z:0,w:layout.width,d:layout.depth,y:layout.height,h:.3,material:'ceiling'},
 ...layout.doors.map(p=>({x:p.x,z:p.z,w:p.axis==='x'?p.width+.24:.28,d:p.axis==='x'?.28:p.width+.24,y:3.2,h:layout.height-3.2,material:'overhead',color:layout.frameColor})),
 ...layout.rooms.flatMap(r=>[-1,1].map(side=>({x:(r.x1+r.x2)/2,z:(r.z1+r.z2)/2+side*Math.min(3,(r.z2-r.z1)/2-1),w:r.x2-r.x1,d:.28,y:layout.height-.6,h:.3,material:'overhead',color:layout.beamColor}))),
];}
export function collisionBoxes(map:ArenaMap):Box[]{return [...map.walls,...overheadBoxes(map)];}
