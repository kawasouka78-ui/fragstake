export type MotionSample={speed:number;grounded:boolean;vy:number;crouch:boolean;sprinting:boolean;sliding:boolean;aim:number;reload:number;switching:boolean;kick:number;sightHeight:number};
const damp=(value:number,target:number,rate:number,dt:number)=>value+(target-value)*(1-Math.exp(-rate*dt));
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** Continuous, bounded view motion; stance changes never snap or accumulate transforms. */
export class ViewMotion{
  sprint=0;slide=0;crouch=0;movement=0;air=0;landing=0;swap=0;phase=0;
  wasGrounded=true;lastVy=0;
  step(dt:number,s:MotionSample){
    dt=clamp(dt,0,.1);
    this.sprint=damp(this.sprint,Number(s.sprinting),10,dt);
    this.slide=damp(this.slide,Number(s.sliding),12,dt);
    this.crouch=damp(this.crouch,Number(s.crouch),14,dt);
    this.movement=damp(this.movement,s.grounded&&!s.sliding?clamp(s.speed/7.5,0,1):0,12,dt);
    this.air=damp(this.air,s.grounded?0:clamp(s.vy*.006,-.025,.025),10,dt);
    this.swap=damp(this.swap,Number(s.switching),18,dt);
    if(dt>0){if(!this.wasGrounded&&s.grounded)this.landing=Math.min(.035,Math.abs(this.lastVy)*.006);this.wasGrounded=s.grounded;this.lastVy=s.vy;}
    this.landing=damp(this.landing,0,16,dt);this.phase+=dt*clamp(s.speed,0,10)*1.6;
    const hip=1-clamp(s.aim,0,1),bob=Math.sin(this.phase)*.007*this.movement*hip;
    return {
      x:.23*hip+Math.sin(this.phase*.5)*.005*this.movement*hip+this.slide*.012,
      y:-.245+s.aim*(.245-s.sightHeight)-Math.abs(bob)-this.sprint*.035-this.slide*.025-this.air-this.landing-s.reload*.16-this.swap*.10,
      z:-.62+clamp(s.kick,0,1)*.025-this.sprint*.025,
      rx:clamp(s.kick,0,1)*.035-s.reload*.25+this.air*.8+this.slide*.025,
      ry:-this.sprint*.12,
      rz:-s.reload*.24-this.sprint*.10-this.slide*.035+bob*.3,
      eyeOffset:-this.crouch*.57-this.landing*.35,
      cameraBob:bob*.4,cameraRoll:bob*.035,sprintBlend:this.sprint,slideBlend:this.slide,
    };
  }
}
