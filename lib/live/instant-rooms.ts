import type { OpenRoom } from './matchmaking.ts';
import type { LiveMode } from './security.ts';

export function instantDuelRooms(mapId: string, stake: number): OpenRoom[] {
  return (['1v1', '2v2'] as LiveMode[]).map((mode) => {
    const capacity = mode === '2v2' ? 4 : 2;
    const friendlyBots = mode === '2v2' ? 1 : 0;
    const enemyBots = mode === '2v2' ? 2 : 1;
    return {
      id: `instant-fill-${mode}-${mapId}-${stake}`,
      mode,
      mapId,
      status: 'waiting',
      players: 1 + friendlyBots + enemyBots,
      ready: 1,
      capacity,
      openSlots: 0,
      instantFill: true,
      stake,
    };
  });
}
