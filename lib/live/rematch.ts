import {LiveRoom} from './world.ts';
import {issueTicket} from './security.ts';

/** Private, short-lived invitations retain the original players and team slots. */
export async function prepareRematch(previous:LiveRoom,secret:string,now=Date.now()){
 if(previous.mode==='ffa'||previous.status!=='finished'||!previous.hadOpponents)return null;
 const room=new LiveRoom(previous.mode,previous.mapId),expiresAt=now+60000;
 room.reservedSlots=new Map([...previous.players].map(([id,player])=>[id,player.slot]));
 room.inviteExpiresAt=expiresAt;
 const invitations=new Map(await Promise.all([...previous.players].map(async([id,{claims}])=>[id,{
  ticket:await issueTicket(secret,{sub:id,name:claims.name,guest:claims.guest,mode:room.mode,mapId:room.mapId,roomId:room.id},now),expiresAt,
 }] as const)));
 return {room,invitations};
}
