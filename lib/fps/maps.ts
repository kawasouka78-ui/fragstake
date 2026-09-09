// Every arena is carved from a solid footprint. The same geometry drives
// movement, navigation, bullets and rendering; each map has its own floor plan.
export type MapId='citadel'|'depot'|'underpass'|'foundry'|'relay'|'drydock';
export type Box={x:number;z:number;w:number;d:number;h:number;y?:number;material:string;color?:string};
export type ArenaMap={id:MapId;name:string;tagline:string;description:string;width:number;depth:number;sky:string;fog:string;ground:string;accent:string;walls:Box[];spawns:{x:number;z:number;yaw:number}[];landmarks:{x:number;z:number;label:string}[];decorations:{kind:string;x:number;z:number;h?:number}[]};
export type Rect={x1:number;z1:number;x2:number;z2:number};
export type ArenaRoom=Rect&{name:string;code:string;color:string};
export type ArenaDoor={x:number;z:number;width:number;axis:'x'|'z';label:string;color:string;room:ArenaRoom;destination:ArenaRoom;roomNormal:number};
export type ArenaEdge={x:number;z:number;length:number;axis:'x'|'z';normal:number};
export type ArenaRoomSign=ArenaEdge&{room:ArenaRoom};
export type CitadelRoom=ArenaRoom;
export type CitadelDoor=ArenaDoor;
export type CitadelEdge=ArenaEdge;
export type CitadelRoomSign=ArenaRoomSign;
export type MapLayout={width:number;depth:number;height:number;cell:number;rooms:ArenaRoom[];passages:Rect[];floor:boolean[][];doors:ArenaDoor[];edges:ArenaEdge[];roomSigns:ArenaRoomSign[];walls:Box[];frameColor:string;beamColor:string;walkable:(x:number,z:number)=>boolean};
type LayoutDesign={width:number;depth:number;height:number;rooms:ArenaRoom[];passages:Rect[];cover:Box[];frameColor?:string;beamColor?:string};
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
    if((openingWidth===4||openingWidth===6)&&ends.every(p=>!walkable(p.x,p.z))){
     const entry=point(centre,-roomNormal*.25),destination=hallwayDestination(room,entry.x,entry.z),position=point(centre,0);
     if(destination)doors.push({...position,width:openingWidth,axis,label:destination.name.toUpperCase(),color:room.color,room,destination,roomNormal});
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
 for(const p of doors)for(const side of [-1,1])walls.push(cover(p.x+(p.axis==='x'?side*p.width/2:0),p.z+(p.axis==='z'?side*p.width/2:0),p.axis==='x'?.18:.28,p.axis==='x'?.28:.18,3.45,'frame',frameColor));
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

// Depot: a broad sorting hall links separate receiving and dispatch yards.
// The packing gallery and switch room provide two protected flanking loops.
const depotRooms:ArenaRoom[]=[
 {x1:-32,z1:-18,x2:-18,z2:-4,name:'Receiving',code:'D1',color:'#ecc17a'},
 {x1:-32,z1:6,x2:-18,z2:20,name:'Dispatch',code:'D2',color:'#de9360'},
 {x1:-10,z1:-8,x2:12,z2:8,name:'Sorting hall',code:'D3',color:'#f0c46d'},
 {x1:-12,z1:-20,x2:6,z2:-14,name:'Packing gallery',code:'D4',color:'#c7b291'},
 {x1:20,z1:-18,x2:32,z2:4,name:'Transfer bay',code:'D5',color:'#f0b263'},
 {x1:20,z1:10,x2:32,z2:20,name:'Loading dock',code:'D6',color:'#e6a473'},
 {x1:-2,z1:14,x2:12,z2:20,name:'Switch room',code:'D7',color:'#a5b9a0'},
];
const depotPassages:Rect[]=[
 {x1:-28,z1:-4,x2:-24,z2:6},
 {x1:-18,z1:-8,x2:-10,z2:-4},
 {x1:-18,z1:12,x2:-4,z2:16},{x1:-8,z1:8,x2:-4,z2:12},
 {x1:-18,z1:-18,x2:-12,z2:-14},{x1:-4,z1:-14,x2:0,z2:-8},
 {x1:6,z1:-20,x2:16,z2:-16},{x1:12,z1:-16,x2:16,z2:-8},{x1:16,z1:-12,x2:20,z2:-8},
 {x1:12,z1:-2,x2:20,z2:4},
 {x1:26,z1:4,x2:30,z2:10},
 {x1:4,z1:8,x2:8,z2:14},{x1:12,z1:16,x2:20,z2:20},
];
const depotLayout=buildLayout({width:72,depth:48,height:5.25,rooms:depotRooms,passages:depotPassages,frameColor:'#6c5c46',beamColor:'#756750',cover:[
 cover(-26,-12,3,4,2.6,'cargo','#b28048'),cover(-21,-16,2.4,2,1.65,'cargo','#ad8b5d'),
 cover(-25,13,4,2.4,2.2,'cargo','#b17b4b'),cover(-21,18,2.2,2.2,1.4,'cargo','#bf9b63'),
 cover(-4,-2,3.2,4.6,2.6,'cargo','#a87a47'),cover(5,2,4.4,2.6,2.1,'cargo','#b3925c'),
 cover(5,-4,2.5,2.6,2.15,'machine','#8b8d75'),cover(-5,5,2.4,1.4,1.1,'console','#7d816a'),
 cover(-3,-18,3.2,1.8,2,'machine','#999880'),
 cover(26,-10,3.6,5,2.65,'cargo','#a77544'),cover(23,-1,2.4,2.8,2.15,'cargo','#b89b65'),
 cover(26,15,3.2,3,2.4,'cargo','#af8051'),
 cover(10.8,15,1.5,1.2,2.5,'server','#535e51'),cover(2.5,18.6,3,1.5,1.8,'terminal','#767c64'),
]});
const depotMap:ArenaMap={
 id:'depot',name:'Depot',tagline:'Cut through cargo. Control the transfer.',
 description:'A warm freight depot built around a covered sorting hall, staggered cargo lanes, a packing gallery and two protected flanking loops.',
 width:72,depth:48,sky:'#302c23',fog:'#555044',ground:'#968978',accent:'#edb461',walls:depotLayout.walls,
 spawns:[spawn(-30,-16,Math.PI),spawn(-20,-7,0),spawn(-29,-6,-Math.PI/2),spawn(-30,9,Math.PI),spawn(-20,9,Math.PI/2),spawn(-29,18,0),spawn(-7,-5,-Math.PI/2),spawn(9,6,Math.PI/2),spawn(0,5,0),spawn(9,-5,Math.PI/2),spawn(-9,-17,-Math.PI/2),spawn(3,-17,Math.PI/2),spawn(29,-15,Math.PI),spawn(29,1,0),spawn(22,12,Math.PI),spawn(30,18,0),spawn(0,16,-Math.PI/2),spawn(8,16,Math.PI/2)],
 landmarks:[{x:-29,z:-10,label:'Receiving'},{x:-29,z:15,label:'Dispatch'},{x:0,z:2,label:'Sorting hall'},{x:-8,z:-17,label:'Packing gallery'},{x:23,z:-15,label:'Transfer bay'},{x:22,z:17,label:'Loading dock'},{x:6,z:17,label:'Switch room'}],decorations:[],
};

// Underpass: offset platform chambers surround a central crossing. The main
// tunnel turns south of the crossing; pump and generator loops bend around it.
const underpassRooms:ArenaRoom[]=[
 {x1:-10,z1:-6,x2:10,z2:6,name:'Crossing',code:'U1',color:'#a4d6da'},
 {x1:-6,z1:-26,x2:6,z2:-14,name:'North platform',code:'U2',color:'#7cc9db'},
 {x1:-6,z1:16,x2:6,z2:28,name:'South platform',code:'U3',color:'#83afce'},
 {x1:-24,z1:-18,x2:-14,z2:-4,name:'Pump station',code:'U4',color:'#89c9bb'},
 {x1:14,z1:0,x2:24,z2:18,name:'Generator',code:'U5',color:'#96b9de'},
 {x1:-24,z1:14,x2:-14,z2:26,name:'Sump vault',code:'U6',color:'#82b8ba'},
 {x1:14,z1:-28,x2:24,z2:-16,name:'Signal room',code:'U7',color:'#7ec2d9'},
];
const underpassPassages:Rect[]=[
 {x1:-2,z1:-14,x2:2,z2:-6},
 {x1:-2,z1:6,x2:2,z2:12},{x1:2,z1:8,x2:6,z2:12},{x1:2,z1:12,x2:6,z2:16},
 {x1:-18,z1:-24,x2:-6,z2:-20},{x1:-18,z1:-20,x2:-14,z2:-18},
 {x1:-22,z1:-4,x2:-18,z2:14},{x1:-18,z1:0,x2:-10,z2:4},
 {x1:-14,z1:22,x2:-6,z2:26},
 {x1:6,z1:-24,x2:14,z2:-20},
 {x1:18,z1:-16,x2:22,z2:-8},{x1:14,z1:-12,x2:18,z2:-8},{x1:14,z1:-8,x2:18,z2:0},
 {x1:10,z1:0,x2:14,z2:4},
 {x1:18,z1:18,x2:22,z2:24},{x1:6,z1:20,x2:18,z2:24},
];
const underpassLayout=buildLayout({width:56,depth:64,height:4.5,rooms:underpassRooms,passages:underpassPassages,frameColor:'#365166',beamColor:'#416274',cover:[
 cover(-5,-1,1.3,1.3,4.5,'pillar','#859aa2'),cover(5,1,1.3,1.3,4.5,'pillar','#859aa2'),
 cover(0,-1.5,3.6,1.4,1.05,'console','#526e7a'),cover(6,-4,2.4,1.8,2,'machine','#6e858c'),
 cover(-2,-19,2.8,2.2,1.7,'terminal','#5e7e89'),cover(3,-22,1.3,1.3,4.5,'pillar','#879ca6'),
 cover(0,23,2.8,3,2.1,'machine','#7f9096'),cover(-3.5,19,2,1,1.05,'console','#597585'),
 cover(-19,-12,3,3.8,2.35,'machine','#7f999b'),
 cover(22.8,9,1.6,7,2.4,'server','#435c70'),cover(18,11,2.5,3.5,2.3,'machine','#6c8998'),
 cover(-19,20,3,3,2.2,'machine','#718d96'),cover(-22.4,24,1.8,1.2,1,'console','#4f6b78'),
 cover(18,-22,2.8,2.2,1.8,'terminal','#526f7c'),cover(22.8,-25,1.2,3.4,2.4,'locker','#6b8a96'),
]});
const underpassMap:ArenaMap={
 id:'underpass',name:'Underpass',tagline:'Hold the crossing. Break the tunnel line.',
 description:'A cool subterranean route through offset platforms, pump chambers and a central crossing, with bent tunnels and two service loops.',
 width:56,depth:64,sky:'#172632',fog:'#334c5c',ground:'#718994',accent:'#82cddd',walls:underpassLayout.walls,
 spawns:[spawn(-7,-3,-Math.PI/2),spawn(7,3,Math.PI/2),spawn(-2,4,0),spawn(2,-4,Math.PI),spawn(-4,-24,Math.PI),spawn(4,-16,0),spawn(-4,26,0),spawn(4,18,Math.PI),spawn(4,26,0),spawn(-22,-16,Math.PI),spawn(-16,-6,0),spawn(-22,-6,-Math.PI/2),spawn(16,2,Math.PI),spawn(22,16,0),spawn(-22,16,Math.PI),spawn(-16,24,0),spawn(16,-26,Math.PI),spawn(22,-18,0)],
 landmarks:[{x:0,z:4,label:'Crossing'},{x:0,z:-24,label:'North platform'},{x:-3,z:22,label:'South platform'},{x:-22,z:-10,label:'Pump station'},{x:16,z:14,label:'Generator'},{x:-16,z:17,label:'Sump vault'},{x:16,z:-20,label:'Signal room'}],decorations:[],
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
export function getMapLayout(map:ArenaMap|string):MapLayout{const id=typeof map==='string'?map:map.id;return layouts[id as keyof typeof layouts]??citadelLayout;}
export function overheadBoxes(map:ArenaMap):Box[]{const layout=getMapLayout(map);return [
 {x:0,z:0,w:layout.width,d:layout.depth,y:layout.height,h:.3,material:'ceiling'},
 ...layout.doors.map(p=>({x:p.x,z:p.z,w:p.axis==='x'?p.width+.24:.28,d:p.axis==='x'?.28:p.width+.24,y:3.2,h:layout.height-3.2,material:'overhead',color:layout.frameColor})),
 ...layout.rooms.flatMap(r=>[-1,1].map(side=>({x:(r.x1+r.x2)/2,z:(r.z1+r.z2)/2+side*Math.min(3,(r.z2-r.z1)/2-1),w:r.x2-r.x1,d:.28,y:layout.height-.6,h:.3,material:'overhead',color:layout.beamColor}))),
];}
export function collisionBoxes(map:ArenaMap):Box[]{return [...map.walls,...overheadBoxes(map)];}
