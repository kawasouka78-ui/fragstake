'use client';
import { ArrowRight, Users } from 'lucide-react';
import { getMap } from '@/lib/fps/maps';
import type { OpenRoom } from '@/lib/live/matchmaking';
import type { LiveStatus } from './use-live-status';

export default function LiveRoomList({
  status,
  checking,
  filter,
  instantMapId = 'citadel',
  standingFfaMapId = status?.currentFfaMapId ?? 'citadel',
  instantStake = 10,
  onJoin,
}: {
  status: LiveStatus | null;
  checking: boolean;
  filter: string;
  instantMapId?: string;
  standingFfaMapId?: string;
  instantStake?: number;
  onJoin: (room: OpenRoom) => void;
}) {
  const realRooms = (status?.rooms ?? []).filter(
    (room) => (room.mode === 'practice' || status?.paidMatches === true) &&
      (filter === 'all' || room.mode === filter),
  );
  const hasStandingFfa = realRooms.some(
    (room) => room.mode === 'ffa' && room.mapId === standingFfaMapId,
  );
  const standingFfaRooms: OpenRoom[] =
    !!status?.online && status.paidMatches === true && (filter === 'all' || filter === 'ffa') && !hasStandingFfa
      ? [
          {
            id: `standing-ffa-${standingFfaMapId}`,
            mode: 'ffa',
            mapId: standingFfaMapId,
            status: 'playing',
            players: 0,
            ready: 0,
            capacity: 10,
            openSlots: 10,
            standing: true,
          },
        ]
      : [];
  const instantRooms: OpenRoom[] = [];
  const rooms = [...realRooms, ...standingFfaRooms, ...instantRooms];
  return (
    <div className="available-matches" aria-label="Available player matches">
      {rooms.length ? (
        rooms.map((room) => (
          <article className="available-match" key={room.id}>
            <div
              className={'available-map map-' + room.mapId}
              aria-hidden="true"
            >
              <span>{room.mode.toUpperCase()}</span>
            </div>
            <div className="available-description">
              <h3>
                {getMap(room.mapId).name}{' '}
                <small>
                  {room.standing
                    ? 'Always-on Cash FFA'
                    : room.instantFill
                      ? room.mode + ' instant duel'
                      : room.mode === 'ffa'
                        ? 'Cash FFA'
                        : room.mode === 'practice' ? 'Open practice' : room.mode + ' money duel'}
                </small>
              </h3>
              <p>
                <i className={room.status} />
                {room.standing
                  ? 'Always open'
                  : room.instantFill
                    ? 'Instant opponent ready'
                    : room.status === 'waiting'
                      ? 'Waiting for players'
                      : room.mode === 'ffa'
                        ? 'Drop in anytime'
                        : 'Match in progress'}{' '}
                · {room.standing
                  ? 'map rotates every 10 min'
                  : room.instantFill
                    ? `€${room.stake} buy-in`
                    : room.ready + ' ready'}
              </p>
            </div>
            <span className="available-slots">
              <Users size={16} />
              {room.standing
                ? 'OPEN'
                : room.instantFill
                  ? 'INSTANT'
                  : `${room.players}/${room.capacity}`}
              <small>
                {room.standing
                  ? 'drop in'
                  : room.instantFill
                    ? 'instant'
                    : room.openSlots + ' open'}
              </small>
            </span>
            <button
              className="primary compact"
              aria-label={`${room.instantFill ? 'Play' : 'Join'} ${getMap(room.mapId).name} ${room.mode} match`}
              onClick={() => onJoin(room)}
            >
              {room.instantFill ? 'Play' : 'Join'} <ArrowRight size={16} />
            </button>
          </article>
        ))
      ) : (
        <div className="available-empty" role="status">
          <Users size={22} aria-hidden="true" />
          <div>
            <strong>
              {checking && !status
                ? 'Finding matches…'
                : !status?.online
                  ? 'Unable to reach the match server'
                  : 'No open matches' +
                    (filter !== 'all' ? ' in this format' : '')}
            </strong>
            <p>
              {checking && !status
                ? 'Checking available rooms.'
                : !status?.online
                  ? 'Try refreshing in a moment.'
                  : 'Start practice above, or refresh to check for available rooms.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
