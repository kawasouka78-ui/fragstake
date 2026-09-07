import layouts from './maps.json' with {type:'json'};
export type MapId = 'foundry' | 'relay' | 'drydock';
export type Box = {x:number;z:number;w:number;d:number;h:number;y?:number;material:string;color?:string};
export type ArenaMap = {id:MapId;name:string;tagline:string;description:string;width:number;depth:number;sky:string;fog:string;ground:string;accent:string;walls:Box[];spawns:{x:number;z:number;yaw:number}[];landmarks:{x:number;z:number;label:string}[];decorations:{kind:string;x:number;z:number;h?:number}[]};
export const maps = layouts as ArenaMap[];
export function getMap(id?:string){return maps.find(m=>m.id===id)??maps[0];}
export function collisionBoxes(map:ArenaMap):Box[]{return [...map.walls,...map.decorations.flatMap(d=>{
 const base=map.walls.find(b=>Math.abs(b.x-d.x)<b.w/2&&Math.abs(b.z-d.z)<b.d/2)?.h??0;
 const box=(w:number,h:number,depth:number,y:number):Box=>({x:d.x,z:d.z,w,h,d:depth,y,material:'prop'});
 if(d.kind==='tower')return [box(.28,4,.28,base),box(.8,.25,.65,base+3.875)];
 if(d.kind==='pipe')return [box(2.2,.56,.56,base+.12)];
 if(d.kind==='barrel')return [box(.7,1,.7,base)];
 return [box(.7,.35,.7,base)];
 }),
 {x:0,z:-map.depth/2-.5,w:map.width+2,d:1,h:7,material:'concrete'},
 {x:0,z:map.depth/2+.5,w:map.width+2,d:1,h:7,material:'concrete'},
 {x:-map.width/2-.5,z:0,w:1,d:map.depth,h:7,material:'concrete'},
 {x:map.width/2+.5,z:0,w:1,d:map.depth,h:7,material:'concrete'}];}
