import type { LiveRoom } from './world.ts';
import type { LiveMode, Ticket } from './security.ts';

export type OpenRoom = {
  id: string;
  mode: LiveMode;
  mapId: string;
  status: 'waiting' | 'playing';
  players: number;
  ready: number;
  capacity: number;
  openSlots: number;
  instantFill?: boolean;
  standing?: boolean;
  stake?: number;
};

export const validRoomId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

export function canJoinRoom(room: LiveRoom) {
  return (
    room.status !== 'finished' &&
    (room.status === 'waiting' || room.continuous) &&
    room.humanCount < room.capacity
  );
}

/** Public listing deliberately excludes identities, claims, and reconnect tokens. */
export function openRooms(rooms: Iterable<LiveRoom>): OpenRoom[] {
  return [...rooms]
    .filter(
      (room) =>
        !room.reservedSlots && canJoinRoom(room) &&
        [...room.players.values()].some((p) => !p.left && p.connected && !p.bot),
    )
    .slice(0, 24)
    .map((room) => ({
      id: room.id,
      mode: room.mode,
      mapId: room.mapId,
      status: room.status === 'finished' ? 'waiting' : room.status,
      players: room.humanCount,
      ready: [...room.players.values()].filter(
        (p) => !p.left && p.connected && p.ready && !p.bot,
      ).length,
      capacity: room.capacity,
      openSlots: room.capacity - room.humanCount,
    }));
}

export function findRoom(
  rooms: Iterable<LiveRoom>,
  claims: Pick<Ticket, 'mode' | 'mapId' | 'roomId'>,
) {
  const available = [...rooms];
  if (claims.roomId) {
    const room = available.find((room) => room.id === claims.roomId);
    if (
      !room ||
      room.mode !== claims.mode ||
      room.mapId !== claims.mapId ||
      !canJoinRoom(room)
    )
      throw new Error(
        'That match is no longer available. Refresh the match list and try another.',
      );
    return room;
  }
  return available.find(
    (room) =>
      !room.reservedSlots && room.mode === claims.mode &&
      room.mapId === claims.mapId &&
      canJoinRoom(room),
  );
}
