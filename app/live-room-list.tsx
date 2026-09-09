'use client';
import { ArrowRight, Users, Radio } from 'lucide-react';
import { getMap } from '@/lib/fps/maps';
import type { OpenRoom } from '@/lib/live/matchmaking';
import type { LiveStatus } from './use-live-status';

export default function LiveRoomList({
  status,
  checking,
  filter,
  onJoin,
}: {
  status: LiveStatus | null;
  checking: boolean;
  filter: string;
  onJoin: (room: OpenRoom) => void;
}) {
  const rooms = (status?.rooms ?? []).filter(
    (room) => filter === 'all' || room.mode === filter,
  );
  return (
    <div className="available-matches" aria-label="Available player matches">
      <div className="duel-list-caption">
        <span>
          <Radio size={13} /> PLAYER MATCHES
        </span>
        <span>FREE ENTRY</span>
      </div>
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
                  {room.mode === 'ffa' ? 'Free-for-all' : room.mode + ' duel'}
                </small>
              </h3>
              <p>
                <i className={room.status} />
                {room.status === 'waiting'
                  ? 'Waiting for players'
                  : 'Round in progress'}{' '}
                · {room.ready} ready
              </p>
            </div>
            <span className="available-slots">
              <Users size={16} />
              {room.players}/{room.capacity}
              <small>{room.openSlots} open</small>
            </span>
            <button
              className="primary compact"
              aria-label={`Join ${getMap(room.mapId).name} ${room.mode} match`}
              onClick={() => onJoin(room)}
            >
              Join <ArrowRight size={16} />
            </button>
          </article>
        ))
      ) : (
        <p className="available-empty" role="status">
          {checking && !status
            ? 'Finding open matches…'
            : !status?.online
              ? 'Player server unavailable. Try Refresh, or play a bot match.'
              : 'No open matches' +
                (filter !== 'all' ? ' in this format' : '') +
                ' yet. Choose Players above and start one.'}
        </p>
      )}
    </div>
  );
}
