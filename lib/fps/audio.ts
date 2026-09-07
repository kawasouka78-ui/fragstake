import type {GameEvent} from './simulation.ts';
export class ArenaAudio{
 context:AudioContext|null=null;gain:GainNode|null=null;muted=false;noise:AudioBuffer|null=null;
 unlock(){try{this.context??=new AudioContext();this.gain??=this.context.createGain();this.gain.gain.value=this.muted?0:.22;this.gain.connect(this.context.destination);void this.context.resume();if(!this.noise){this.noise=this.context.createBuffer(1,this.context.sampleRate*.25,this.context.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*5);}}catch{}}
 volume(muted:boolean){this.muted=muted;if(this.gain)this.gain.gain.value=muted?0:.22;}
 tone(frequency:number,length:number,volume=.3,type:OscillatorType='sine',end=frequency){if(!this.context||!this.gain)return;const t=this.context.currentTime,o=this.context.createOscillator(),g=this.context.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(end,t+length);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+length);o.connect(g);g.connect(this.gain);o.start(t);o.stop(t+length);o.onended=()=>{o.disconnect();g.disconnect();};}
 play(event:GameEvent){if(!this.context||this.muted)return;
  if(event.kind==='shot'){this.tone(event.weapon==='marksman'?95:150,.13,.55,'triangle',38);if(this.noise&&this.gain){const source=this.context.createBufferSource(),filter=this.context.createBiquadFilter();source.buffer=this.noise;filter.type='lowpass';filter.frequency.value=event.weapon==='smg'?2500:1800;source.connect(filter);filter.connect(this.gain);source.start();source.onended=()=>{source.disconnect();filter.disconnect();};}}
  else if(event.kind==='enemyShot')this.tone(125,.09,.17*Math.max(.05,1-(event.distance??20)/28),'triangle',45);
  else if(event.kind==='footstep')this.tone(75,.065,.08,'triangle',32);
  else if(event.kind==='hit')this.tone(event.head?1550:950,.065,.22,'triangle');
  else if(event.kind==='kill'){this.tone(660,.2,.2);this.tone(990,.28,.13);}
  else if(event.kind==='hurt')this.tone(70,.14,.35,'sine',32);
  else if(event.kind==='reload')this.tone(230,.11,.1,'square',100);
  else if(event.kind==='pickup'||event.kind==='spawn')this.tone(520,.2,.14,'sine',1040);
 }
 dispose(){void this.context?.close();this.context=null;}
}
