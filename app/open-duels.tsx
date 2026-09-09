'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Swords,
  Plus,
  RefreshCw,
  Users,
  ArrowRight,
  Check,
  X,
} from 'lucide-react';
import { accountApi, euro, useAccount } from './account-context';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { maps, getMap, type MapId } from '@/lib/fps/maps';
export type DuelRules = {
  mapId?: string;
  stake: number;
  target: number;
  bestOf: number;
  team: string;
  weaponRule: string;
};
import LiveRoomList from './live-room-list';
import type { OpenRoom } from '@/lib/live/matchmaking';
import type { useLiveStatus } from './use-live-status';
const initial: DuelRules = {
  stake: 10,
  target: 10,
  bestOf: 1,
  team: '1v1',
  weaponRule: 'standard',
};
const weaponLabels: Record<string, string> = {
  standard: 'All weapons',
  rifle: 'Rifles only',
  sniper: 'Snipers only',
  headshots: 'Headshots only',
};
type Room = {
  id: string;
  owner_id: string;
  host_name: string;
  host_handle: string;
  rules: string;
  members: number;
  joined: number;
  expires_at: number;
  mock?: boolean;
};
type LobbyData = {
  rooms: Room[];
  members: {
    lobby_id: string;
    player_id: string;
    name: string;
    handle: string;
    ready: number;
  }[];
};
const mockRooms: Room[] = [
  {
    id: 'preview-ace',
    owner_id: 'preview-ace',
    host_name: 'AceNova',
    host_handle: '@acenova',
    rules: JSON.stringify({
      mapId: 'citadel',
      stake: 10,
      target: 10,
      bestOf: 1,
      team: '1v1',
      weaponRule: 'standard',
    }),
    members: 1,
    joined: 0,
    expires_at: 0,
    mock: true,
  },
  {
    id: 'preview-vex',
    owner_id: 'preview-vex',
    host_name: 'Vex',
    host_handle: '@vexfps',
    rules: JSON.stringify({
      mapId: 'depot',
      stake: 25,
      target: 10,
      bestOf: 3,
      team: '2v2',
      weaponRule: 'rifle',
    }),
    members: 3,
    joined: 0,
    expires_at: 0,
    mock: true,
  },
  {
    id: 'preview-mira',
    owner_id: 'preview-mira',
    host_name: 'Mira',
    host_handle: '@mira',
    rules: JSON.stringify({
      mapId: 'underpass',
      stake: 5,
      target: 5,
      bestOf: 1,
      team: '1v1',
      weaponRule: 'sniper',
    }),
    members: 1,
    joined: 0,
    expires_at: 0,
    mock: true,
  },
];
export function DuelFields({
  rules,
  onChange,
}: {
  rules: DuelRules;
  onChange: (r: DuelRules) => void;
}) {
  return (
    <div className="duel-fields">
      <label>
        Stake per player · demo €
        <input
          type="number"
          min={5}
          max={100}
          step={1}
          value={rules.stake}
          onChange={(e) =>
            onChange({ ...rules, stake: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Format
        <select
          value={rules.team}
          onChange={(e) => onChange({ ...rules, team: e.target.value })}
        >
          <option>1v1</option>
          <option>2v2</option>
        </select>
      </label>
      <label>
        Series
        <select
          value={rules.bestOf}
          onChange={(e) =>
            onChange({ ...rules, bestOf: Number(e.target.value) })
          }
        >
          <option value={1}>Single round</option>
          <option value={3}>Best of 3</option>
        </select>
      </label>
      <label>
        Round target
        <select
          value={rules.target}
          onChange={(e) =>
            onChange({ ...rules, target: Number(e.target.value) })
          }
        >
          <option value={5}>First to 5</option>
          <option value={10}>First to 10</option>
        </select>
      </label>
      <label className="wide">
        Weapons
        <select
          value={rules.weaponRule}
          onChange={(e) => onChange({ ...rules, weaponRule: e.target.value })}
        >
          {Object.entries(weaponLabels).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
export default function OpenDuels({
  onPractice,
  mapId,
  live,
  onJoin,
}: {
  mapId: MapId;
  onPractice: (r: DuelRules) => void;
  live: ReturnType<typeof useLiveStatus>;
  onJoin: (room: OpenRoom) => void;
}) {
  const { data } = useAccount(),
    [lobbies, setLobbies] = useState<LobbyData>({ rooms: [], members: [] }),
    [loading, setLoading] = useState(true),
    [failure, setFailure] = useState(''),
    [busy, setBusy] = useState(false),
    [create, setCreate] = useState(false),
    [rules, setRules] = useState(initial),
    [filter, setFilter] = useState('all');
  const key = useRef('');
  async function load() {
    if (!data) {
      setLoading(false);
      return;
    }
    try {
      setLobbies(await accountApi(undefined, '?action=lobbies'));
      setFailure('');
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    if (!data) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 10000);
    return () => clearInterval(timer);
  }, [data?.player.id]);
  async function act(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setFailure('');
    try {
      setLobbies(await accountApi(body));
      if (body.action === 'lobby_create') {
        setCreate(false);
        key.current = '';
      }
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visibleRooms = [...lobbies.rooms, ...mockRooms].filter(
    (room) => filter === 'all' || JSON.parse(room.rules).team === filter,
  );
  const visibleMembers = lobbies.members;
  return (
    <section
      className="open-duels duel-browser"
      id="duels"
      aria-label="Open matches"
    >
      <div className="section-heading">
        <div>
          <h2>
            <Swords size={23} /> OPEN MATCHES
          </h2>
          <p>Find a player match or warm up against bots.</p>
        </div>
        {data ? (
          <button
            className="secondary compact"
            disabled={busy}
            onClick={() => {
              setRules({ ...initial, mapId });
              setCreate(true);
            }}
          >
            <Plus size={17} />
            Create lobby
          </button>
        ) : (
          <a className="secondary compact" href="/signin">
            <Plus size={17} />
            Create lobby
          </a>
        )}
      </div>
      <div className="lobby-toolbar">
        <div role="group" aria-label="Match format filter">
          {['all', 'ffa', '1v1', '2v2'].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              className={filter === f ? 'active' : ''}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All matches' : f === 'ffa' ? 'FFA' : f}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          disabled={busy || live.checking}
          onClick={() => {
            void live.refresh();
            if (data) {
              setLoading(true);
              void load();
            }
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>
      <LiveRoomList
        status={live.status}
        checking={live.checking}
        filter={filter}
        onJoin={onJoin}
      />
      {filter !== 'ffa' && (
        <>
          <div className="duel-list-caption">
            <span>QUICK MATCH</span>
            <span>BOT OPPONENTS · DEMO CREDITS</span>
          </div>
          <div className="quick-duels">
            {['1v1', '2v2']
              .filter((team) => filter === 'all' || filter === team)
              .map((team) => (
                <article key={team}>
                  <div className="quick-duel-format" aria-hidden="true">
                    {team === '1v1' ? (
                      <Swords size={24} />
                    ) : (
                      <Users size={24} />
                    )}
                    <span>{team}</span>
                  </div>
                  <div className="quick-duel-details">
                    <h3>
                      {team === '1v1' ? 'Solo duel' : 'Team duel'}
                      <span className="duel-bot-tag">BOTS</span>
                    </h3>
                    <p>
                      {getMap(mapId).name}
                      <span>·</span>First to 10<span>·</span>
                      {team === '1v1'
                        ? 'You vs. 1 bot'
                        : 'You + bot vs. 2 bots'}
                    </p>
                  </div>
                  <div className="quick-duel-stake">
                    <b>€10</b>
                    <span>DEMO ENTRY</span>
                  </div>
                  <button
                    className="primary compact"
                    onClick={() => onPractice({ ...initial, team, mapId })}
                  >
                    Play {team}
                    <ArrowRight size={16} />
                  </button>
                </article>
              ))}
          </div>
          <div className="duel-list-caption duel-player-caption">
            <span>PLAYER LOBBIES</span>
            <span>LOBBY PREVIEW</span>
          </div>
          {failure && (
            <p role="alert" className="error-text">
              {failure}
            </p>
          )}
          {loading && data ? (
            <p className="lobby-empty">Loading open lobbies…</p>
          ) : (
            <div className="duel-room-list">
              {visibleRooms.map((room) => {
                const r = JSON.parse(room.rules) as DuelRules,
                  capacity = r.team === '2v2' ? 4 : 2,
                  people = visibleMembers.filter((m) => m.lobby_id === room.id),
                  me = people.find((m) => m.player_id === data?.player.id),
                  host = room.owner_id === data?.player.id;
                return (
                  <article
                    className={
                      'duel-room ' +
                      (room.joined ? 'joined' : '') +
                      (room.mock ? ' preview-room' : '')
                    }
                    key={room.id}
                  >
                    <div className="room-main">
                      <div className="room-format">
                        <Swords size={22} />
                        <b>{r.team}</b>
                      </div>
                      <div className="room-description">
                        <h3>
                          {room.host_name}’s duel{' '}
                          {room.mock && (
                            <span className="preview-badge">PREVIEW</span>
                          )}
                        </h3>
                        <p>
                          {getMap(r.mapId).name} <i /> First to {r.target} <i />{' '}
                          {r.bestOf === 3 ? 'Best of 3' : 'Single round'} <i />{' '}
                          {weaponLabels[r.weaponRule] ?? weaponLabels.standard}
                        </p>
                      </div>
                      <span className="room-slots">
                        <Users size={15} />
                        {room.members}/{capacity}
                      </span>
                      <div className="room-stake">
                        <b>{euro(r.stake * 100)}</b>
                        <small>DEMO STAKE</small>
                      </div>
                      {room.mock ? (
                        <button
                          className="primary compact"
                          onClick={() => onPractice(r)}
                        >
                          Preview
                          <ArrowRight size={16} />
                        </button>
                      ) : room.joined ? (
                        <span className="joined-label">
                          <Check size={16} />
                          JOINED
                        </span>
                      ) : (
                        <button
                          className="primary compact"
                          disabled={busy || !data || room.members >= capacity}
                          onClick={() =>
                            void act({ action: 'lobby_join', id: room.id })
                          }
                        >
                          {room.members >= capacity ? 'Full' : 'Join lobby'}
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                    {!!room.joined && (
                      <div className="room-members">
                        <div>
                          {people.map((p) => (
                            <span key={p.player_id}>
                              <i className={p.ready ? 'ready' : ''} />
                              {p.name}
                              {p.player_id === room.owner_id ? ' · Host' : ''}
                              {p.ready ? ' · Ready' : ''}
                            </span>
                          ))}
                        </div>
                        <div className="dialog-actions">
                          <button
                            className="secondary compact"
                            disabled={busy}
                            onClick={() =>
                              void act({
                                action: 'lobby_ready',
                                id: room.id,
                                ready: !me?.ready,
                              })
                            }
                          >
                            {me?.ready ? 'Unready' : 'Ready up'}
                          </button>
                          <button
                            className="secondary compact"
                            onClick={() => onPractice(r)}
                          >
                            Bot warm-up
                          </button>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              void act({
                                action: host ? 'lobby_close' : 'lobby_leave',
                                id: room.id,
                              })
                            }
                          >
                            <X size={14} />
                            {host ? 'Close lobby' : 'Leave lobby'}
                          </button>
                        </div>
                        <small>
                          Lobby saved. This saved lobby uses demo rules; bot
                          warm-up opens a separate match. Joining or readying
                          does not reserve credits.
                        </small>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <p className="lobby-footnote">
            These saved lobbies use demo rules. Select Players in the match
            setup above for free FFA and duels.
          </p>
        </>
      )}
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent className="sc-dialog">
          <DialogTitle>Open a Duel lobby</DialogTitle>
          <DialogDescription>
            Choose your map and rules. Players can join and ready up here for a
            demo bot warm-up. For free player matches, use Players in the main
            setup.
          </DialogDescription>
          <label className="match-map-picker">
            Map
            <select
              value={rules.mapId ?? mapId}
              onChange={(e) => setRules({ ...rules, mapId: e.target.value })}
            >
              {maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <DuelFields rules={rules} onChange={setRules} />
          {failure && <p className="error-text">{failure}</p>}
          <button
            className="primary"
            disabled={
              busy ||
              rules.stake < 5 ||
              rules.stake > 100 ||
              !Number.isInteger(rules.stake)
            }
            onClick={() => {
              key.current ||= crypto.randomUUID();
              void act({ action: 'lobby_create', key: key.current, ...rules });
            }}
          >
            {busy ? 'Creating…' : 'Create open lobby'}
            <Plus size={17} />
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
