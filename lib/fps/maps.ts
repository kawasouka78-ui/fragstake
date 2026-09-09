// Citadel is carved from a solid footprint: every passage has real enclosing
// walls, and the same boxes drive movement, navigation, shots, and rendering.
export type MapId = 'citadel' | 'foundry' | 'relay' | 'drydock';
export type Box = {x:number;z:number;w:number;d:number;h:number;y?:number;material:string;color?:string};
export type ArenaMap = {id:MapId;name:string;tagline:string;description:string;width:number;depth:number;sky:string;fog:string;ground:string;accent:string;walls:Box[];spawns:{x:number;z:number;yaw:number}[];landmarks:{x:number;z:number;label:string}[];decorations:{kind:string;x:number;z:number;h?:number}[]};
type Rect = {x1:number;z1:number;x2:number;z2:number};
export type CitadelRoom = Rect & {name:string;code:string;color:string};
export type CitadelDoor = {x:number;z:number;width:number;axis:'x'|'z';label:string;color:string};
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
const door=(x:number,z:number,axis:'x'|'z',label:string,color='#e5b67a'):CitadelDoor=>({x,z,axis,width:4,label,color});
export const citadelDoors:CitadelDoor[]=[
 door(-16,-20,'z','SECURITY'),door(-6,-20,'z','FREIGHT'),door(6,-14,'z','WORKSHOP'),door(16,-14,'z','SECURITY'),
 door(-26,-12,'x','WEST  /  04'),door(-26,-6,'x','FREIGHT'),door(4,-12,'x','CONCOURSE'),door(4,-6,'x','SECURITY'),
 door(26,-12,'x','SERVER  /  06'),door(26,-6,'x','WORKSHOP'),door(-20,2,'z','CONCOURSE'),door(-8,2,'z','WEST  /  04'),
 door(8,-2,'z','SERVER  /  06'),door(20,-2,'z','CONCOURSE'),door(-22,6,'x','DISPATCH'),door(-22,12,'x','WEST  /  04'),
 door(-4,6,'x','CONTROL'),door(-4,12,'x','CONCOURSE'),door(22,6,'x','LOADING'),door(22,12,'x','SERVER  /  06'),
 door(-16,20,'z','CONTROL'),door(-6,20,'z','DISPATCH'),door(6,14,'z','LOADING'),door(16,14,'z','CONTROL'),
 door(-18,-12,'x','SERVICE  /  A','#79c7c6'),door(-18,12,'x','SERVICE  /  A','#79c7c6'),
 door(18,-12,'x','SERVICE  /  B','#79c7c6'),door(18,12,'x','SERVICE  /  B','#79c7c6'),
];
const cols=CITADEL_WIDTH/CITADEL_CELL,rows=CITADEL_DEPTH/CITADEL_CELL;
export const citadelFloor=Array.from({length:rows},(_,row)=>Array.from({length:cols},(_,col)=>{
 const x=col*CITADEL_CELL-CITADEL_WIDTH/2+1,z=row*CITADEL_CELL-CITADEL_DEPTH/2+1;
 return [...citadelRooms,...citadelPassages].some(r=>x>r.x1&&x<r.x2&&z>r.z1&&z<r.z2);
}));
export function citadelWalkable(x:number,z:number){return citadelFloor[Math.floor((z+CITADEL_DEPTH/2)/2)]?.[Math.floor((x+CITADEL_WIDTH/2)/2)]??false;}

// Greedy rectangles compact the solid grid without approximating its outline.
const used=citadelFloor.map(row=>row.map(Boolean));
const walls:Box[]=[];
for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)if(!used[row][col]){
 let w=1,d=1;while(col+w<cols&&!used[row][col+w])w++;
 while(row+d<rows&&Array.from({length:w},(_,i)=>!used[row+d][col+i]).every(Boolean))d++;
 for(let z=row;z<row+d;z++)for(let x=col;x<col+w;x++)used[z][x]=true;
 walls.push({x:(col+w/2)*2-CITADEL_WIDTH/2,z:(row+d/2)*2-CITADEL_DEPTH/2,w:w*2,d:d*2,h:CITADEL_HEIGHT,material:'concrete'});
}
const cover=(x:number,z:number,w:number,d:number,h:number,material:string,color?:string)=>walls.push({x,z,w,d,h,material,color});
cover(-23,-18,2.6,2.6,2.25,'cargo','#ad7854');
cover(-1,-20,2,2.4,2.25,'terminal','#476d72');
cover(22,-18,2.5,3,2.25,'machine','#90988e');
cover(-27.3,1,1.2,4,2.4,'locker','#628185');
cover(0,0,3.2,1.6,1.05,'console','#506b6c');
cover(-4,2,1,1,4.4,'pillar','#b1aca0');
cover(4,-2,1,1,4.4,'pillar','#b1aca0');
cover(26.8,1,1.6,4,2.5,'server','#344f58');
cover(-21,18,3.2,2,1.8,'cargo','#ad7854');
cover(1,19,3,2.4,2,'terminal','#506b6c');
cover(22,20,3,2.4,2.6,'cargo','#b28b61');
for(const p of citadelDoors)for(const side of [-1,1])cover(p.x+(p.axis==='x'?side*1.94:0),p.z+(p.axis==='z'?side*1.94:0),p.axis==='x'?.12:.24,p.axis==='x'?.24:.12,3.45,'frame','#40575c');

export type CitadelEdge={x:number;z:number;length:number;axis:'x'|'z';normal:number};
// Only exposed faces receive architectural trim, never hidden block interiors.
const edgeCells=new Map<string,number[]>();
for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(citadelFloor[r][c])for(const [dx,dz]of [[-1,0],[1,0],[0,-1],[0,1]]){
 if(citadelFloor[r+dz]?.[c+dx])continue;
 const axis=dx?'z':'x',normal=dx?-dx:-dz,constant=dx?(c+(dx>0?1:0))*2-32:(r+(dz>0?1:0))*2-28;
 const key=[axis,constant,normal].join(':'),values=edgeCells.get(key)??[];values.push(dx?r*2-28:c*2-32);edgeCells.set(key,values);
}
export const citadelEdges:CitadelEdge[]=[];
for(const [key,values]of edgeCells){const [axis,constant,normal]=key.split(':');values.sort((a,b)=>a-b);let first=values[0],last=first;
 const commit=()=>citadelEdges.push({x:axis==='x'?(first+last+2)/2:Number(constant),z:axis==='z'?(first+last+2)/2:Number(constant),length:last-first+2,axis:axis as 'x'|'z',normal:Number(normal)});
 for(const v of values.slice(1)){if(v===last+2)last=v;else{commit();first=last=v;}}commit();
}
const spawn=(x:number,z:number,yaw:number)=>({x,z,yaw});
export const maps:ArenaMap[]=[{
 id:'citadel',name:'Citadel',tagline:'Own the corner. Take the next room.',
 description:'A connected indoor facility with nine distinct rooms, framed doorways, bent service passages and multiple flanking routes.',
 width:CITADEL_WIDTH,depth:CITADEL_DEPTH,sky:'#18232a',fog:'#24363c',ground:'#737c7b',accent:'#efa775',walls,
 spawns:[spawn(-26,-21,Math.PI),spawn(-18,-15,0),spawn(-3,-21,-Math.PI/2),spawn(3,-15,0),spawn(19,-21,Math.PI),spawn(26,-15,0),spawn(-23,-3,Math.PI),spawn(-23,4,0),spawn(-5,0,-Math.PI/2),spawn(5,2,Math.PI/2),spawn(23,-3,Math.PI),spawn(23,4,0),spawn(-25,21,0),spawn(-18,15,Math.PI),spawn(-3,15,Math.PI),spawn(3,22,0),spawn(18,21,0),spawn(25,15,Math.PI)],
 landmarks:[{x:-25,z:-15,label:'Freight'},{x:-3,z:-15,label:'Security'},{x:25,z:-21,label:'Workshop'},{x:-23,z:2,label:'West passage'},{x:5,z:4,label:'Concourse'},{x:23,z:2,label:'Server room'},{x:-25,z:15,label:'Dispatch'},{x:3,z:15,label:'Control'},{x:25,z:21,label:'Loading bay'}],decorations:[],
}];
// Legacy saved match identifiers resolve here; removed arenas are never offered.
export function getMap(_id?:string){return maps[0];}
export function overheadBoxes(_map:ArenaMap):Box[]{return [
 {x:0,z:0,w:CITADEL_WIDTH,d:CITADEL_DEPTH,y:CITADEL_HEIGHT,h:.3,material:'ceiling'},
 ...citadelDoors.map(p=>({x:p.x,z:p.z,w:p.axis==='x'?4.2:.28,d:p.axis==='x'?.28:4.2,y:3.2,h:1.55,material:'overhead',color:'#40575c'})),
 ...citadelRooms.flatMap(r=>[-1,1].map(side=>({x:(r.x1+r.x2)/2,z:(r.z1+r.z2)/2+side*3,w:r.x2-r.x1,d:.28,y:4.15,h:.3,material:'overhead',color:'#52686b'}))),
];}
export function collisionBoxes(map:ArenaMap):Box[]{return [...map.walls,...overheadBoxes(map)];}
