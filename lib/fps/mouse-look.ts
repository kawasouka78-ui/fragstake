// Tracks ordinary cursor positions when an embedded browser denies pointer lock.
export class MouseLook {
 last:{x:number;y:number}|null=null; edge=0;
 reset(){this.last=null;this.edge=0;}
 move(x:number,y:number,rect:{left:number;top:number;width:number;height:number}){
  const inside=x>=rect.left&&x<=rect.left+rect.width&&y>=rect.top&&y<=rect.top+rect.height;
  if(!inside){this.reset();return {x:0,y:0};}
  const delta=this.last?{x:x-this.last.x,y:y-this.last.y}:{x:0,y:0};this.last={x,y};
  const margin=Math.min(36,rect.width*.08),local=x-rect.left;
  this.edge=local<margin?-(1-local/margin):local>rect.width-margin?(local-rect.width+margin)/margin:0;
  return delta;
 }
}
