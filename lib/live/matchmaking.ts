import type { LiveRoom } from './world.ts';
import type { Ticket } from './security.ts';

export const validRoomId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

export function canJoinRoom(room: LiveRoom) {
  return (
    room.status !== 'finished' &&
    (room.status === 'waiting' || room.mode === 'ffa') &&
    room.players.size < room.capacity
  );
}

/** Public listing deliberately excludes identities, claims, and reconnect tokens. */
export function openRooms(rooms: Iterable<LiveRoom>) {
  return [...rooms]
    .filter(
      (room) =>
        !room.reservedSlots && canJoinRoom(room) &&
        [...room.players.values()].some((p) => !p.left && p.connected),
    )
    .slice(0, 24)
    .map((room) => ({
      id: room.id,
      mode: room.mode,
      mapId: room.mapId,
      status: room.status,
      players: [...room.players.values()].filter((p) => !p.left).length,
      ready: [...room.players.values()].filter(
        (p) => !p.left && p.connected && p.ready,
      ).length,
      capacity: room.capacity,
      openSlots: room.capacity - room.players.size,
    }));
}
export type OpenRoom = ReturnType<typeof openRooms>[number];

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
