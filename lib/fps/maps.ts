import layouts from './maps.json' with {type:'json'};
export type MapId = 'foundry' | 'relay' | 'drydock';
export type Box = {x:number;z:number;w:number;d:number;h:number;y?:number;material:string;color?:string};
export type ArenaMap = {id:MapId;name:string;tagline:string;description:string;width:number;depth:number;sky:string;fog:string;ground:string;accent:string;walls:Box[];spawns:{x:number;z:number;yaw:number}[];landmarks:{x:number;z:number;label:string}[];decorations:{kind:string;x:number;z:number;h?:number}[]};
export const maps = layouts as ArenaMap[];
export function getMap(id?:string){return maps.find(m=>m.id===id)??maps[0];}
export function overheadBoxes(map:ArenaMap):Box[]{
 const beam=(x:number,z:number,w:number,d:number,y:number,h:number,color:string):Box=>({x,z,w,d,y,h,color,material:'overhead'});
 const awnings=map.walls.filter(b=>b.material==='concrete'&&b.w>=4&&b.d>=3&&b.h>=4).map(b=>beam(b.x,b.z+b.d/2+1.1,Math.min(b.w,8),2.2,3.25,.16,'#69818a'));
 if(map.id==='foundry')return [...awnings,...[-20,20].flatMap(z=>[beam(0,z,map.width+2,.65,8,.5,'#666d65'),beam(0,z+.65,map.width+2,.35,8.2,.35,'#b58c54')])];
 if(map.id==='relay')return [...awnings,...[-1,1].map(side=>beam(side*map.width*.28,0,1.2,map.depth*.6,8,.4,'#d0d7ca'))];
 return [...awnings,beam(0,-22,map.width+4,1.5,17,1.2,'#c8944b')];
}
export function collisionBoxes(map:ArenaMap):Box[]{return [...map.walls,...overheadBoxes(map),...map.decorations.flatMap(d=>{
 const base=map.walls.find(b=>Math.abs(b.x-d.x)<b.w/2&&Math.abs(b.z-d.z)<b.d/2)?.h??0;
 const box=(w:number,h:number,depth:number,y:number):Box=>({x:d.x,z:d.z,w,h,d:depth,y,material:'prop'});
 if(d.kind==='tower')return [box(.28,4,.28,base),box(.8,.25,.65,base+3.875)];
 if(d.kind==='pipe')return [box(2.2,.56,.56,base+.12)];
 if(d.kind==='barrel')return [box(.7,1,.7,base)];
 return [box(.7,.35,.7,base)];
 }),
 {x:0,z:-map.depth/2-.5,w:map.width+2,d:1,h:4.4,material:'concrete'},
 {x:0,z:map.depth/2+.5,w:map.width+2,d:1,h:map.id==='drydock'?1.15:3,material:'concrete'},
 {x:-map.width/2-.5,z:0,w:1,d:map.depth,h:map.id==='relay'?3:4.4,material:'concrete'},
 {x:map.width/2+.5,z:0,w:1,d:map.depth,h:map.id==='relay'?3:4.4,material:'concrete'}];}
