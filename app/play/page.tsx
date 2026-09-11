'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, RefreshCw, Crosshair, Zap, Swords } from 'lucide-react';
import SiteHeader from '../site-header';
import '../maps.css';
import '../live-platform.css';
import './play-restore.css';
import { useLiveStatus } from '../use-live-status';
import LiveRoomList from '../live-room-list';
import { requestLiveMatch } from '@/lib/live/launch';
import { firebaseIdToken } from '@/lib/firebase-client';
import { maps, getMap } from '@/lib/fps/maps';
import type { LiveMode } from '@/lib/live/security';
import type { OpenRoom } from '@/lib/live/matchmaking';
import type { MatchConfig, Result } from '@/lib/game-rules';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import LiveMatchResult from '../live-match-result';
import { duelOutcome } from '@/lib/duel-result';
import { accountApi, useAccount } from '../account-context';
import { equippedCosmetics } from '@/lib/catalog';
const Arena = dynamic(() => import('../arena'), {
  ssr: false,
  loading: () => (
    <main className="real-article" role="status">
      Loading arena…
    </main>
  ),
});
const ffaTiers = [
  { id: 'rookie', name: 'Rookie', value: 1, label: '€1 / kill' },
  { id: 'classic', name: 'Classic', value: 2, label: '€2 / kill' },
  { id: 'pro', name: 'Pro', value: 5, label: '€5 / kill' },
  { id: 'elite', name: 'Elite', value: 10, label: '€10 / kill' },
] as const;
const duelStakes = [
  { id: 'five', value: 5, label: '€5' },
  { id: 'ten', value: 10, label: '€10' },
  { id: 'twenty-five', value: 25, label: '€25' },
  { id: 'fifty', value: 50, label: '€50' },
] as const;
export default function Play() {
  const [category, setCategory] = useState<'practice' | 'ffa' | 'duels'>(
    'practice',
  );
  const [mode, setMode] = useState<LiveMode>('ffa'),
    [mapId, setMapId] = useState('citadel'),
    [ffaTier, setFfaTier] =
      useState<(typeof ffaTiers)[number]['id']>('classic'),
    [duelStake, setDuelStake] =
      useState<(typeof duelStakes)[number]['id']>('ten'),
    [game, setGame] = useState<MatchConfig | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [stakePickerOpen, setStakePickerOpen] = useState(false),
    [duelSearching, setDuelSearching] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const duelSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { status, checking, refresh } = useLiveStatus(!game),
    { data } = useAccount();
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('mode');
    if (requested === 'ffa' || requested === '1v1' || requested === '2v2') {
      setMode(requested);
      setCategory(requested === 'ffa' ? 'ffa' : 'duels');
    }
  }, []);
  useEffect(
    () => () => {
      if (duelSearchTimer.current) clearTimeout(duelSearchTimer.current);
    },
    [],
  );
  async function join(
    nextMode = mode,
    nextMap = category === 'ffa' ? status?.currentFfaMapId ?? mapId : mapId,
    roomId?: string,
    practice = category === 'practice',
  ) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      let cosmetics: ReturnType<typeof equippedCosmetics> = {
        skin: undefined,
        knifeStyle: 'standard',
      };
      if (data) {
        try {
          const p = await accountApi<{
            inventory: { sku: string; equipped: number }[];
          }>(undefined, '?action=platform');
          cosmetics = equippedCosmetics(p.inventory);
        } catch {}
      }
      const ffaValue =
        ffaTiers.find((tier) => tier.id === ffaTier)?.value ?? 2;
      const stakeValue =
        duelStakes.find((stake) => stake.id === duelStake)?.value ?? 10;
      const accountBalance = (data?.player.balance ?? 10000) / 100;
      const config = await requestLiveMatch(practice ? 'practice' : nextMode, nextMap, fetch, roomId, await firebaseIdToken());
      setMode(nextMode);
      if (practice) setCategory('practice');
      else setCategory(nextMode === 'ffa' ? 'ffa' : 'duels');
      setMapId(config.mapId ?? nextMap);
      setResult(null);
      setGame({
        ...config,
        ...cosmetics,
        mode: practice ? 'practice' : nextMode === 'ffa' ? 'ffa' : 'duel',
        team: nextMode === '2v2' ? '2v2' : '1v1',
        rate: practice ? 0 : nextMode === 'ffa' ? ffaValue : 0,
        stake: practice || nextMode === 'ffa' ? 0 : stakeValue,
        entry: 0,
        target: practice ? 0 : nextMode === 'ffa' ? 30 : 10,
        bestOf: 1,
        balance: practice ? 0 : accountBalance,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not join. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  function requestJoin() {
    if (category === 'practice') {
      void join('ffa', rotatingMapId, undefined, true);
      return;
    }
    setStakePickerOpen(true);
  }
  function startDuelSearch() {
    setStakePickerOpen(false);
    setDuelSearching(true);
    setError('');
    if (duelSearchTimer.current) clearTimeout(duelSearchTimer.current);
    duelSearchTimer.current = setTimeout(() => {
      setDuelSearching(false);
      duelSearchTimer.current = null;
      void finishDuelSearch();
    }, 3200);
  }
  async function freshRooms() {
    try {
      const response = await fetch('/api/live', {
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) throw new Error();
      const value = (await response.json()) as { rooms?: OpenRoom[] };
      return Array.isArray(value.rooms) ? value.rooms : (status?.rooms ?? []);
    } catch {
      return status?.rooms ?? [];
    }
  }
  function matchingRealDuel(
    rooms: OpenRoom[],
    nextMode = mode,
    nextMap = mapId,
  ) {
    return rooms.find(
      (room) =>
        !room.instantFill &&
        room.mode === nextMode &&
        room.mapId === nextMap &&
        room.status === 'waiting' &&
        room.openSlots > 0,
    );
  }
  async function finishDuelSearch() {
    const room = matchingRealDuel(await freshRooms());
    if (room) void join(room.mode, room.mapId, room.id, false);
    else void join(mode, mapId, undefined, false);
  }
  function cancelDuelSearch() {
    if (duelSearchTimer.current) clearTimeout(duelSearchTimer.current);
    duelSearchTimer.current = null;
    setDuelSearching(false);
  }
  if (game)
    return (
      <Arena
        config={game}
        onFinish={(r) => {
          setResult(r);
          setGame(null);
          void refresh();
        }}
      />
    );
  const selectedFfa = ffaTiers.find((tier) => tier.id === ffaTier)!;
  const selectedStake = duelStakes.find((stake) => stake.id === duelStake)!;
  const rotatingMapId = status?.currentFfaMapId ?? mapId;
  const displayMapId = category === 'duels' ? mapId : rotatingMapId;
  const selectedMap = getMap(displayMapId);
  const title =
    category === 'practice' ? 'Practice' : category === 'ffa' ? 'FFA' : 'Duels';
  const moneyLabel =
    category === 'practice'
      ? 'Free'
      : category === 'ffa'
        ? selectedFfa.label
        : selectedStake.label + ' buy-in';
  const formatLabel =
    category === 'practice'
      ? 'Practice opponents'
      : category === 'ffa'
        ? `-€${selectedFfa.value} / death`
        : mode === '2v2'
          ? `€${selectedStake.value * 4} pot`
          : `€${selectedStake.value * 2} pot`;
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="main play-main restored-play">
        <div className="lobby-layout">
          <section className="modes-section" aria-label="Game modes">
            <div className="section-heading">
              <h1>Choose your mode</h1>
            </div>
            <div className="mode-grid">
              {(
                [
                  {
                    id: 'practice',
                    title: 'Practice',
                    tag: 'Warm up',
                    foot: 'Always open',
                    Icon: Crosshair,
                  },
                  {
                    id: 'ffa',
                    title: 'FFA',
                    tag: 'Cash FFA',
                    foot: '€2 per kill',
                    Icon: Zap,
                  },
                  {
                    id: 'duels',
                    title: 'Duels',
                    tag: 'Head to head',
                    foot: '€10 buy-in',
                    Icon: Swords,
                  },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  className={
                    'mode-card mode-' +
                    m.id +
                    (category === m.id ? ' selected' : '')
                  }
                  aria-pressed={category === m.id}
                  onClick={() => {
                    cancelDuelSearch();
                    setCategory(m.id);
                    setMode(m.id === 'duels' ? '1v1' : 'ffa');
                    setError('');
                  }}
                >
                  <div
                    className={
                      'mode-art art-' + (m.id === 'duels' ? 'duel' : m.id)
                    }
                  />
                  <div className="mode-shade" />
                  <m.Icon
                    className="mode-emblem"
                    size={82}
                    strokeWidth={0.8}
                    aria-hidden="true"
                  />
                  <div className="card-top">
                    <span className="mode-index">{m.tag}</span>
                    <span className="mode-check">
                      {category === m.id ? (
                        <>
                          <span />
                          Selected
                        </>
                      ) : (
                        '↗'
                      )}
                    </span>
                  </div>
                  <div className="mode-content">
                    <span className="mode-icon">
                      <m.Icon size={22} />
                    </span>
                    <h3>{m.title}</h3>
                  </div>
                  <div className="card-bottom">
                    <strong>{m.foot}</strong>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section
            className={'feature feature-' + category}
            aria-label="Selected game mode"
          >
            <div className={'feature-art map-art-' + displayMapId} />
            <div className="feature-shade" />
            <div className="feature-label">
              <span />
              {category === 'practice'
                ? 'Practice'
                : category === 'ffa'
                  ? 'Cash FFA'
                  : 'Staked duel'}
            </div>
            <div className="feature-copy">
              <span className="feature-kicker">Selected arena</span>
              <h2>
                {selectedMap.name.toUpperCase()}
                <em>{category === 'duels' ? mode + ' DUEL' : title}</em>
              </h2>
              <p>{selectedMap.tagline}</p>
            </div>
            <div className="feature-bottom">
              <div className="map-stamp">
                <Crosshair size={23} />
                <div>
                  <b>{selectedMap.name.toUpperCase()}</b>
                  <small>
                    {displayMapId === 'depot'
                      ? 'CONTAINER LANES · INDUSTRIAL WAREHOUSE'
                      : displayMapId === 'underpass'
                        ? 'RAIL PLATFORMS · VAULTED STATION'
                        : 'ENCLOSED HALLWAYS · CONNECTED ROOMS'}
                  </small>
                </div>
              </div>
              <span className="map-format">
                {category === 'duels' ? mode : '10 PLAYER FFA'}
              </span>
            </div>
          </section>
          <section className="match-panel" aria-label="Match setup">
            <div className="match-heading">
              <span className="eyebrow">Match setup</span>
            </div>
            <div className="match-title">
              <h2>{duelSearching ? 'Searching' : title}</h2>
            </div>
            {duelSearching ? (
              <div className="duel-search-card" role="status">
                <span className="duel-search-pulse" />
                <b>Finding your duel</b>
                <p>
                  {mode} on {selectedMap.name} · {selectedStake.label} buy-in ·{' '}
                  {formatLabel}
                </p>
                <button
                  type="button"
                  className="secondary compact"
                  onClick={cancelDuelSearch}
                >
                  Cancel search
                </button>
              </div>
            ) : (
              category === 'duels' && (
                <div
                  className="real-formats"
                  role="group"
                  aria-label="Duel format"
                >
                  {(['1v1', '2v2'] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={mode === value}
                      onClick={() => setMode(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              )
            )}
            {!duelSearching && category === 'duels' && (
              <label className="match-map-picker">
                Map
                <select
                  value={mapId}
                  onChange={(e) => setMapId(e.target.value)}
                >
                  {maps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="match-bottom">
              <div className="stake-summary">
                <div>
                  <small>Entry</small>
                  <b className={category === 'practice' ? 'free' : ''}>
                    {moneyLabel}
                  </b>
                </div>
                <div>
                  <small>
                    {category === 'duels'
                      ? 'Winner gets'
                      : category === 'ffa'
                        ? 'Death'
                        : 'Format'}
                  </small>
                  <b>{formatLabel}</b>
                </div>
              </div>
              <button
                className="primary play-button"
                disabled={
                  busy ||
                  duelSearching ||
                  !status?.online
                }
                onClick={requestJoin}
              >
                {duelSearching
                  ? 'Searching for duel…'
                  : busy
                    ? 'Connecting…'
                    : checking && !status
                      ? 'Checking servers…'
                      : category === 'practice'
                        ? 'Start practice'
                        : category === 'duels'
                          ? 'Find money duel'
                          : 'Enter Cash FFA'}
                <ArrowRight size={18} />
              </button>
              <p className="queue-note">
                {!status
                  ? 'Connecting to match server…'
                  : status.online
                    ? status.players + ' players online'
                    : 'Match server unavailable. Retry shortly.'}
              </p>
              {!data && (
                <a className="record-signin" href="/signin">
                  Save your results · Sign in
                </a>
              )}
              {error && (
                <p role="alert" className="error-text">
                  {error}
                </p>
              )}
            </div>
          </section>
        </div>
        <section className="restored-open-matches" aria-label="Open matches">
          <div className="section-heading">
            <h2>Open matches</h2>
            <button
              className="secondary compact"
              disabled={checking || busy}
              onClick={() => void refresh()}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
          {duelSearching ? (
            <div className="available-empty" role="status">
              <Swords size={22} aria-hidden="true" />
              <div>
                <strong>Searching for an opponent</strong>
                <p>
                  Stay here while the matchmaker finds a {mode} duel. The match
                  opens when both sides are ready.
                </p>
              </div>
            </div>
          ) : (
            <LiveRoomList
              status={status}
              checking={checking}
              filter="all"
              instantMapId={mapId}
              standingFfaMapId={rotatingMapId}
              instantStake={selectedStake.value}
              onJoin={(room) => void join(room.mode, room.mapId, room.standing ? undefined : room.id, room.mode === 'practice')}
            />
          )}
        </section>
        <Dialog open={stakePickerOpen} onOpenChange={setStakePickerOpen}>
          <DialogContent className="sc-dialog stake-dialog">
            <DialogTitle>
              {category === 'ffa' ? 'Choose cash tier' : 'Choose duel stake'}
            </DialogTitle>
            <DialogDescription>
              {category === 'ffa'
                ? 'Each kill adds to your balance. Each death removes the same amount.'
                : 'Pick the buy-in before the duel starts. Winner takes the pot.'}
            </DialogDescription>
            {category === 'ffa' ? (
              <div
                className="tier-grid"
                role="group"
                aria-label="FFA cash tier"
              >
                {ffaTiers.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    className={'tier' + (ffaTier === tier.id ? ' active' : '')}
                    onClick={() => setFfaTier(tier.id)}
                  >
                    <span className="radio-dot" />
                    <span className="tier-name">
                      <b>{tier.name}</b>
                      <small>Kill and death value</small>
                    </span>
                    <span className="tier-rate">
                      €{tier.value}
                      <small>per elim</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div
                  className="real-formats"
                  role="group"
                  aria-label="Duel format"
                >
                  {(['1v1', '2v2'] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={mode === value}
                      onClick={() => setMode(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="tier-grid" role="group" aria-label="Duel stake">
                  {duelStakes.map((stake) => (
                    <button
                      key={stake.id}
                      type="button"
                      className={
                        'tier' + (duelStake === stake.id ? ' active' : '')
                      }
                      onClick={() => setDuelStake(stake.id)}
                    >
                      <span className="radio-dot" />
                      <span className="tier-name">
                        <b>{stake.label}</b>
                        <small>
                          {mode === '2v2' ? 'Each player' : 'Each side'}
                        </small>
                      </span>
                      <span className="tier-rate">
                        €{stake.value * (mode === '2v2' ? 4 : 2)}
                        <small>pot</small>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="stake-dialog-summary">
              <span>
                <small>{category === 'ffa' ? 'Kill' : 'Entry'}</small>
                <b>{moneyLabel}</b>
              </span>
              <span>
                <small>{category === 'ffa' ? 'Death' : 'Pot'}</small>
                <b>{formatLabel}</b>
              </span>
            </div>
            <button
              className="primary"
              disabled={busy || (category === 'ffa' && !status?.online)}
              onClick={() => {
                if (category === 'duels') startDuelSearch();
                else {
                  setStakePickerOpen(false);
                  void join('ffa', rotatingMapId, undefined, false);
                }
              }}
            >
              {category === 'ffa' ? 'Enter cash FFA' : 'Enter money duel'}
              <ArrowRight size={17} />
            </button>
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!result}
          onOpenChange={(open) => {
            if (!open) setResult(null);
          }}
        >
          <DialogContent className="sc-dialog">
            <DialogTitle>
              {result
                ? result.liveMode === 'ffa'
                  ? result.reason
                  : duelOutcome(result).title
                : 'Match report'}
            </DialogTitle>
            <DialogDescription>
              {result?.liveMode === 'ffa'
                ? 'Cash FFA'
                : result?.liveMode === '1v1' || result?.liveMode === '2v2'
                  ? 'Money duel'
                  : 'Practice match'}{' '}
              · {result?.kills ?? 0} kills · {result?.deaths ?? 0} deaths
            </DialogDescription>
            {result && <LiveMatchResult result={result} />}
            <button
              className="primary"
              onClick={() => void join()}
              disabled={busy}
            >
              Find another match
            </button>
            {result?.rematch && (
              <button
                className="secondary"
                onClick={() => {
                  if (result.rematch && result.rematch.expiresAt > Date.now()) {
                    setGame({
                      mode: 'practice',
                      balance: 0,
                      rate: 0,
                      team: mode === '2v2' ? '2v2' : '1v1',
                      mapId,
                      live: result.rematch,
                    });
                    setResult(null);
                  } else {
                    setError(
                      'The rematch invitation expired. Find another match.',
                    );
                    setResult(null);
                  }
                }}
              >
                Rematch
              </button>
            )}
            <button className="secondary" onClick={() => setResult(null)}>
              Return to lobby
            </button>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
