'use client';
import { useEffect, useRef, useState } from 'react';
const Link = 'a';
import SiteHeader from './site-header';
import { useAccount, accountApi, type AccountData } from './account-context';
import type { MatchRow, Player } from '@/db/service';
import Arena from './arena';
import { useLiveStatus } from './use-live-status';
import { requestLiveMatch } from '@/lib/live/launch';
import type { OpenRoom } from '@/lib/live/matchmaking';
import './live-platform.css';
import { equippedCosmetics } from '@/lib/catalog';
import { maps, getMap, type MapId } from '@/lib/fps/maps';
import OpenDuels, { DuelFields, type DuelRules } from './open-duels';
import './lobby-refresh.css';
import './maps.css';
import MatchReceipt from './match-receipt';
import LiveMatchResult from './live-match-result';
import DuelResult from './duel-result';
import {rematchRules,nextDuel} from '@/lib/duel-result';
import { canEnter, type MatchConfig, type Result } from '@/lib/game-rules';
import {
  Crosshair,
  ArrowUpRight,
  ArrowRight,
  Target,
  Swords,
  Zap,
  Wallet,
  ShieldCheck,
  Gamepad2,
  CircleHelp,
  Trophy,
  Users,
  RefreshCw,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
type Mode = 'practice' | 'ffa' | 'duel';
type PartySummary = {
  id: string;
  name: string;
  members: { status: string; name?: string; handle?: string }[];
} | null;
type DuelQueue = {
  searching: boolean;
  found?: { mapId: MapId; team: '1v1' | '2v2' };
};
const tiers = [
  { name: 'Rookie', rate: 1, desc: 'Start small', icon: Target },
  { name: 'Beginner', rate: 2, desc: 'Find your footing', icon: Target },
  { name: 'Contender', rate: 5, desc: 'Raise the stakes', icon: Zap },
  { name: 'Pro', rate: 10, desc: 'Every shot matters', icon: Trophy },
];
export default function Home() {
  const [duelStake, setDuelStake] = useState(10),
    [killTarget, setKillTarget] = useState(10),
    [bestOf, setBestOf] = useState(1),
    [weaponRule, setWeaponRule] = useState('standard'),
    [entry, setEntry] = useState(20),
    [skin, setSkin] = useState<string | undefined>();
  const [knifeStyle,setKnifeStyle]=useState<'standard'|'karambit'>('standard');
  const [mapId, setMapId] = useState<MapId>('citadel');
  const selectedMap = getMap(mapId);
  const [mode, setMode] = useState<Mode>('practice');
  const [tier, setTier] = useState(1);
  const [team, setTeam] = useState('1v1');
  const [info, setInfo] = useState(false);
  const [launch, setLaunch] = useState(false);
  const { data, loading, error: accountError, update, refresh } = useAccount();
  const balance = data ? data.player.balance / 100 : 0,
    loaded = !!data && !loading;
  const [party, setParty] = useState<PartySummary>(null);
  const [game, setGame] = useState<(MatchConfig & { id: string }) | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [lastMatch,setLastMatch]=useState<MatchConfig|null>(null);
  const resultIsDuel=!!result&&(result.mode==='duel'||result.liveMode==='1v1'||result.liveMode==='2v2');
  const [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(''),
    [pendingResult, setPendingResult] = useState<Record<
      string,
      unknown
    > | null>(null);
  const startKey = useRef('');
  const [opponents, setOpponents] = useState<'players' | 'bots'>('players');
  const livePlay = mode !== 'practice' && opponents === 'players';
  const live = useLiveStatus(!game);
  const [selectedRoom, setSelectedRoom] = useState<OpenRoom | null>(null);
  const [duelQueue, setDuelQueue] = useState<DuelQueue>({ searching: false });
  const partyCount =
    party?.members.filter((m) => m.status === 'joined').length ?? 0;
  const partyNames =
    party?.members
      .filter((m) => m.status === 'joined')
      .map((m) => m.name || m.handle)
      .filter(Boolean)
      .join(', ') ?? '';
  async function startLive() {
    if (busy) return;
    setBusy(true);
    setSaveError('');
    try {
      if (!live.status?.online)
        throw new Error('The player server is offline. Try again in a moment.');
      const config = await requestLiveMatch(
        mode === 'ffa' ? 'ffa' : team === '2v2' ? '2v2' : '1v1',
        mapId,
        fetch,
        selectedRoom?.id,
      );
      setLaunch(false);
      setResult(null);
      setGame({ ...config, id: 'live', skin, knifeStyle });
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function reviewMatch() {
    if (mode === 'duel' && !selectedRoom) {
      const found=nextDuel(maps.map(map=>map.id),mapId,partyCount);
      setDuelQueue({ searching: true, found });
      setSaveError('');
      setLaunch(true);
      return;
    }
    setSelectedRoom(null);
    setDuelQueue({ searching: false });
    setSaveError('');
    setLaunch(true);
  }
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('opponents') === 'bots' || q.has('stake') || q.has('rate'))
      setOpponents('bots');
    if (['practice', 'ffa', 'duel'].includes(q.get('mode') ?? ''))
      setMode(q.get('mode') as Mode);
    const index = tiers.findIndex((t) => t.rate === Number(q.get('rate')));
    if (index >= 0) {
      setTier(index);
      setEntry(tiers[index].rate * 10);
    }
    if (q.get('mapId')) setMapId(getMap(q.get('mapId')!).id);
    const stake = Number(q.get('stake'));
    if (stake >= 5 && stake <= 100) setDuelStake(stake);
    if (q.get('target') === '5') setKillTarget(5);
    if (q.get('bestOf') === '3') setBestOf(3);
    if (q.get('team') === '2v2') setTeam('2v2');
    if (
      ['standard', 'rifle', 'sniper', 'headshots'].includes(
        q.get('weaponRule') ?? '',
      )
    )
      setWeaponRule(q.get('weaponRule')!);
  }, []);
  useEffect(() => {
    if (data)
      void accountApi<{ inventory: { sku: string; equipped: number }[] }>(
        undefined,
        '?action=platform',
      )
        .then((p) => {const equipped=equippedCosmetics(p.inventory);setSkin(equipped.skin);setKnifeStyle(equipped.knifeStyle);})
        .catch(() => {});
  }, [data?.player.id]);
  useEffect(() => {
    if (!duelQueue.searching || !duelQueue.found || mode !== 'duel') return;
    const timer = window.setTimeout(() => {
      setMapId(duelQueue.found!.mapId);
      setTeam(duelQueue.found!.team);
      setKillTarget(10);
      setBestOf(1);
      setWeaponRule('standard');
      setDuelQueue({ searching: false, found: duelQueue.found });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [duelQueue, mode]);
  useEffect(() => {
    let alive = true;
    if (!data) {
      setParty(null);
      return;
    }
    void accountApi<{ party: PartySummary }>(undefined, '?action=platform')
      .then((p) => {
        if (alive) setParty(p.party ?? null);
      })
      .catch(() => {
        if (alive) setParty(null);
      });
    return () => {
      alive = false;
    };
  }, [data?.player.id]);
  function openSavedMatch(match: MatchRow, player: Player) {
    setGame({
      id: match.id,
      mode: match.mode as Mode,
      rate: match.rate,
      team: match.team as '1v1' | '2v2',
      mapId: getMap(match.map_id).id,
      balance: player.balance / 100,
      stake: match.stake / 100,
      target: match.target,
      bestOf: match.best_of,
      weaponRule: match.weapon_rule,
      entry: match.entry / 100,
      skin,
      knifeStyle,
    });
  }
  function startGuestPractice() {
    setLaunch(false);
    setResult(null);
    setSaveError('');
    setGame({
      id: 'guest-practice',
      mode: 'practice',
      rate: 2,
      team: '1v1',
      mapId,
      balance: 0,
      skin,
      knifeStyle,
    });
  }
  async function start(closeSaved = false, replay?:MatchConfig) {
    if (busy) return;
    if (!replay && mode === 'practice' && (!loaded || data?.active)) {
      startGuestPractice();
      return;
    }
    setBusy(true);
    setSaveError('');
    try {
      let account = data;
      if (closeSaved && data?.active) {
        account = await accountApi<AccountData>({
          action: 'match_finish',
          id: data.active.id,
          kills: 0,
          deaths: 0,
          score: 0,
          enemyScore: 0,
          ending: 'cancel',
        });
        update(account);
        startKey.current = '';
      }
      startKey.current ||= crypto.randomUUID();
      const r = await accountApi<{ match: MatchRow; player: Player }>({
        action: 'match_start',
        key: startKey.current,
        mode,
        rate: tiers[tier].rate,
        team,
        mapId,
        stake: duelStake,
        target: killTarget,
        bestOf,
        weaponRule,
        entry: mode === 'ffa' ? entry : 0,
        ...(replay?rematchRules(replay):{}),
      });
      if (!r?.match || r.match.status !== 'active')
        throw new Error('This match has already ended. Try again.');
      startKey.current = '';
      if (account) update({ ...account, player: r.player, active: r.match });
      setLaunch(false);
      setResult(null);
      openSavedMatch(r.match, r.player);
    } catch (e) {
      setSaveError((e as Error).message);
      void refresh();
    } finally {
      setBusy(false);
    }
  }
  async function replayDuel(){
    if(busy||pendingResult||!lastMatch||!result)return;
    setSaveError('');
    if(lastMatch.live){
      if(!result.rematch||result.rematch.expiresAt<=Date.now()){
        setSaveError('The rematch invitation has expired. Choose Find another game.');return;
      }
      const {expiresAt,...connection}=result.rematch;
      setGame({...lastMatch,live:connection,id:'live'});setResult(null);setLaunch(false);
    }else await start(false,lastMatch);
  }
  function findNextDuel(){
    if(busy||pendingResult||!lastMatch)return;
    setMode('duel');setOpponents(lastMatch.live?'players':'bots');
    setDuelStake(lastMatch.stake??10);setSelectedRoom(null);setSaveError('');
    setDuelQueue({searching:true,found:nextDuel(maps.map(map=>map.id),getMap(lastMatch.mapId).id,partyCount)});
    setResult(null);setLaunch(true);
  }
  async function saveMatch(payload: Record<string, unknown>) {
    setBusy(true);
    setSaveError('');
    try {
      const saved = await accountApi<AccountData & { match: MatchRow }>(
        payload,
      );
      update(saved);
      setResult((current) => ({
        ...current,
        kills: saved.match.kills,
        deaths: saved.match.deaths,
        balance: saved.player.balance / 100,
        walletBalance: saved.player.balance / 100,
        reason: saved.match.reason,
        won: !!saved.match.won,
        score: saved.match.score,
        enemyScore: saved.match.enemy_score,
        headshots: saved.match.headshots,
        maxStreak: saved.match.max_streak,
        net: saved.match.delta / 100,
        returned:
          ((saved.match.mode === 'duel'
            ? saved.match.stake
            : saved.match.entry) +
            saved.match.delta) /
          100,
        mode: saved.match.mode as Mode,
        mapId: saved.match.map_id,
        rate: saved.match.rate,
      }));
      setPendingResult(null);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function finishMatch(r: Result) {
    if (!game) return;
    setLastMatch(game);
    if (game.live) {
      setResult(r);
      setGame(null);
      void refresh();
      return;
    }
    if (game.id === 'guest-practice') {
      setResult({
        ...r,
        reason:
          r.reason === 'Match cancelled'
            ? 'Practice cancelled'
            : 'Practice complete · Not saved to an account',
      });
      setGame(null);
      return;
    }
    const payload = {
      action: 'match_finish',
      id: game.id,
      kills: r.kills,
      deaths: r.deaths,
      score: r.score,
      enemyScore: r.enemyScore,
      headshots: r.headshots ?? 0,
      maxStreak: r.maxStreak ?? 0,
      ending:
        r.reason === 'Match cancelled'
          ? 'cancel'
          : r.reason === 'Arena cash-out'
            ? 'cashout'
            : ['Duel forfeited', 'Left the arena'].includes(r.reason)
              ? 'leave'
              : 'complete',
    };
    setPendingResult(payload);
    setResult(r);
    setGame(null);
    void saveMatch(payload);
  }
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => void;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      context.registerTool(
        {
          name: 'configure_match',
          title: 'Configure a FragStake match',
          description:
            'Select a demo mode and open its pre-match review. Does not spend credits or start gameplay.',
          inputSchema: {
            type: 'object',
            properties: {
              mode: { type: 'string', enum: ['practice', 'ffa', 'duel'] },
              tier: { type: 'integer', minimum: 0, maximum: 3 },
              team: { type: 'string', enum: ['1v1', '2v2'] },
              mapId: { type: 'string', enum: maps.map((m) => m.id) },
            },
            required: ['mode'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: async (input: unknown) => {
            const v = input as {
              mode: Mode;
              tier?: number;
              team?: string;
              mapId?: MapId;
            };
            if (
              !v ||
              !['practice', 'ffa', 'duel'].includes(v.mode) ||
              (v.tier !== undefined &&
                (!Number.isInteger(v.tier) || v.tier < 0 || v.tier > 3)) ||
              (v.team !== undefined && !['1v1', '2v2'].includes(v.team))
            )
              throw new Error('Invalid match configuration');
            if (v.mapId && !maps.some((m) => m.id === v.mapId))
              throw new Error('Invalid map');
            if (game) throw new Error('Leave the current match first');
            setMode(v.mode);
            setOpponents('bots');
            if (v.tier !== undefined) {
              setTier(v.tier);
              setEntry(tiers[v.tier].rate * 10);
            }
            if (v.mapId) setMapId(v.mapId);
            if (v.team) setTeam(v.team);
            setLaunch(true);
            await new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
            return { mode: v.mode, status: 'ready_for_review', demo: true };
          },
        },
        { signal: lifecycle.signal },
      );
    } catch {}
    return () => lifecycle.abort();
  }, [game]);
  function configureDuel(r: DuelRules) {
    setDuelStake(r.stake);
    setKillTarget(r.target);
    setBestOf(r.bestOf);
    setTeam(r.team);
    setWeaponRule(r.weaponRule === 'pistol' ? 'standard' : r.weaponRule);
    if (r.mapId) setMapId(getMap(r.mapId).id);
  }
  const reserved = data?.active
    ? (data.active.mode === 'duel' ? data.active.stake : data.active.entry) /
      100
    : 0;
  const affordable = canEnter({
    mode,
    rate: tiers[tier].rate,
    team: team === '2v2' ? '2v2' : '1v1',
    balance: balance + reserved,
    stake: duelStake,
    entry,
  });
  const validDuel =
    Number.isInteger(duelStake) && duelStake >= 5 && duelStake <= 100;
  if (game) return <Arena config={game} onFinish={finishMatch} />;
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="main play-main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="orange-line" /> FRAGSTAKE / PLAY
            </div>
            <h1>
              READY TO PLAY<span>?</span>
            </h1>
          </div>
        </div>
        <div className="lobby-layout">
          <section className="modes-section" aria-label="Game modes">
            <div className="section-heading">
              <h2>
                <span>01</span> CHOOSE YOUR MODE
              </h2>
              <span>THREE WAYS TO PLAY</span>
            </div>
            <div className="mode-grid">
              {(
                [
                  {
                    id: 'practice',
                    title: 'PRACTICE',
                    tag: 'WARM UP',
                    desc: 'Dial in your aim. Leave the stakes behind.',
                    icon: Crosshair,
                    foot: 'FREE TO PLAY',
                    meta: '10 player FFA',
                  },
                  {
                    id: 'ffa',
                    title: 'FFA',
                    tag: 'FREE FOR ALL',
                    desc: 'Fight for the top spot. Keep moving.',
                    icon: Zap,
                    foot: 'PLAYERS · DEMO STAKES',
                    meta: '10 player FFA',
                  },
                  {
                    id: 'duel',
                    title: 'DUELS',
                    tag: 'FACE OFF',
                    desc: 'Search, get a random duel, pick your gun.',
                    icon: Swords,
                    foot: 'RANDOM MATCH',
                    meta: '1v1 or 2v2',
                  },
                ] as const
              ).map((m, i) => (
                <button
                  key={m.id}
                  className={
                    'mode-card mode-' +
                    m.id +
                    ' ' +
                    (mode === m.id ? 'selected' : '')
                  }
                  onClick={() => {
                    setMode(m.id);
                    setSaveError('');
                  }}
                  aria-pressed={mode === m.id}
                >
                  <div className={'mode-art art-' + m.id} />
                  <div className="mode-shade" />
                  <div className="card-top">
                    <span className="mode-index">
                      0{i + 1} / {m.tag}
                    </span>
                    <span className="mode-check">
                      {mode === m.id ? (
                        <>
                          <span /> SELECTED
                        </>
                      ) : (
                        <ArrowUpRight size={20} />
                      )}
                    </span>
                  </div>
                  <div className="mode-content">
                    <span className="mode-icon">
                      <m.icon size={22} />
                    </span>
                    <h3>{m.title}</h3>
                    <p>{m.desc}</p>
                  </div>
                  <div className="card-bottom">
                    <strong>{m.foot}</strong>
                    <span>{m.meta}</span>
                    <ArrowUpRight size={17} />
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section
            className={'feature feature-' + mode}
            aria-label="Selected game mode"
          >
            <div key={mapId} className={'feature-art map-art-' + mapId} />
            <div className="feature-shade" />
            <div className="feature-label">
              <span />{' '}
              {mode === 'ffa'
                ? livePlay
                  ? 'FREE-FOR-ALL'
                  : 'DEMO CASH FFA'
                : mode === 'duel'
                  ? 'HEAD-TO-HEAD DUELS'
                  : 'FREE PRACTICE'}
            </div>
            <div className="feature-copy">
              <span className="feature-kicker">YOUR NEXT ARENA</span>
              <h2>
                {selectedMap.name.toUpperCase()}
                <em>
                  {mode === 'ffa'
                    ? livePlay
                      ? 'FFA'
                      : 'CASH FFA'
                    : mode === 'duel'
                      ? team + ' DUEL'
                      : 'PRACTICE'}
                </em>
              </h2>
              <p>{selectedMap.tagline}</p>
            </div>
            <div className="feature-bottom">
              <div className="map-stamp">
                <Crosshair size={23} />
                <div>
                  <b>{selectedMap.name.toUpperCase()}</b>
                  <small>
                    {selectedMap.id === 'depot'
                      ? 'CONTAINER LANES · INDUSTRIAL WAREHOUSE'
                      : selectedMap.id === 'underpass'
                        ? 'RAIL PLATFORMS · VAULTED STATION'
                        : 'ENCLOSED HALLWAYS · CONNECTED ROOMS'}
                  </small>
                </div>
              </div>
              <span className="map-format">
                {mode === 'duel' ? team : '10 PLAYER FFA'}
                <span>{livePlay ? 'PLAYER MATCH' : 'BOT ARENA'}</span>
              </span>
            </div>
            <span className="feature-corner" aria-hidden="true">
              SC—01
            </span>
          </section>
          <section className="match-panel" aria-label="Match configuration">
            <div className="match-heading">
              <span className="eyebrow">YOUR NEXT MATCH</span>
              <span className="demo-badge">
                {livePlay ? 'FREE PLAY' : 'DEMO'}
              </span>
            </div>
            <div className="match-title">
              <h2>
                {mode === 'ffa'
                  ? livePlay
                    ? 'FFA'
                    : 'CASH FFA'
                  : mode === 'duel'
                    ? 'DUELS'
                    : 'PRACTICE'}
              </h2>
              <span>
                {mode === 'ffa' ? '01' : mode === 'duel' ? '02' : '00'}
              </span>
            </div>
            {mode !== 'practice' && (
              <Tabs
                value={opponents}
                onValueChange={(v) => {
                  setOpponents(v as 'players' | 'bots');
                  setSaveError('');
                }}
              >
                <TabsList className="opponent-tabs" aria-label="Opponents">
                  <TabsTrigger value="players">
                    <Users size={16} />
                    Players
                  </TabsTrigger>
                  <TabsTrigger value="bots">
                    <Gamepad2 size={16} />
                    Bots · demo
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <p className="setup-label">
              {mode === 'ffa'
                ? livePlay
                  ? 'Climb the scoreboard against other players.'
                  : 'Select your demo stakes'
                : mode === 'duel'
                  ? 'Quick queue chooses the format and map'
                  : 'No stakes. Just you and the arena.'}
            </p>
            {mode === 'ffa' && !livePlay ? (
              <div className="tier-grid">
                {tiers.map((t, i) => (
                  <button
                    className={'tier ' + (tier === i ? 'active' : '')}
                    key={t.name}
                    onClick={() => {
                      setTier(i);
                      setEntry(t.rate * 10);
                    }}
                    aria-pressed={tier === i}
                  >
                    <span className="tier-icon">
                      <t.icon size={20} />
                    </span>
                    <div className="tier-name">
                      <b>{t.name}</b>
                      <small>{t.desc}</small>
                    </div>
                    <div className="tier-rate">
                      €{t.rate}
                      <small>/ kill</small>
                    </div>
                    <span className="radio-dot" />
                  </button>
                ))}
              </div>
            ) : mode === 'duel' && !livePlay ? (
              <div className="duel-pot">
                <span>DEMO DUEL STAKE</span>
                <b>
                  €{duelStake}
                  <i>.00</i>
                </b>
              </div>
            ) : null}
            {mode !== 'duel' && <label className="match-map-picker">
              MAP
              <select
                value={mapId}
                onChange={(e) => setMapId(e.target.value as MapId)}
              >
                {maps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.width} × {m.depth} m
                  </option>
                ))}
              </select>
              <span>{selectedMap.tagline}</span>
            </label>}
            <div className="match-bottom">
              <div className="stake-summary">
                {livePlay ? (
                  <>
                    <span>
                      <small>ENTRY</small>
                      <b className="positive">FREE</b>
                    </span>
                    <span>
                      <small>
                        {mode === 'duel' ? 'WIN CONDITION' : 'ROUND LENGTH'}
                      </small>
                      <b>{mode === 'duel' ? 'RANDOM DUEL' : '3 MINUTES'}</b>
                    </span>
                  </>
                ) : mode === 'ffa' ? (
                  <>
                    <span>
                      <small>PER KILL</small>
                      <b className="positive">+€{tiers[tier].rate}.00</b>
                    </span>
                    <span>
                      <small>PER DEATH</small>
                      <b className="negative">−€{tiers[tier].rate}.00</b>
                    </span>
                  </>
                ) : mode === 'duel' ? (
                  <>
                    <span>
                      <small>YOUR STAKE</small>
                      <b>€{duelStake.toFixed(2)}</b>
                    </span>
                    <span>
                      <small>WIN CONDITION</small>
                      <b>RANDOM DUEL</b>
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      <small>ENTRY</small>
                      <b className="positive">FREE</b>
                    </span>
                    <span>
                      <small>ROUND LENGTH</small>
                      <b>3 MINUTES</b>
                    </span>
                  </>
                )}
              </div>
              {!livePlay && data?.active && (
                <button
                  className="text-button resume-match"
                  onClick={() => openSavedMatch(data.active!, data.player)}
                >
                  Resume saved match <ArrowRight size={14} />
                </button>
              )}
              <button className="primary play-button" onClick={reviewMatch}>
                <Gamepad2 size={19} />
                {livePlay
                  ? mode === 'ffa'
                    ? 'FIND FFA MATCH'
                    : 'FIND ' + team + ' DUEL'
                  : mode === 'practice'
                    ? 'START PRACTICE'
                  : mode === 'ffa'
                    ? 'PLAY ' + tiers[tier].name.toUpperCase()
                    : 'FIND DUEL'}
                <ArrowRight size={20} />
              </button>
              <small className="queue-note">
                <ShieldCheck size={13} />{' '}
                {livePlay
                  ? live.status?.online
                    ? 'Player matches available · Free entry'
                    : live.checking
                      ? 'Checking player matches…'
                      : 'Player server offline'
                  : mode === 'duel'
                    ? '€' + duelStake + ' demo per player'
                    : 'Instant bot match · No queue'}
              </small>
            </div>
          </section>
        </div>
        <OpenDuels
          mapId={mapId}
          live={live}
          onJoin={(room) => {
            setMode(room.mode === 'ffa' ? 'ffa' : 'duel');
            setTeam(room.mode === '2v2' ? '2v2' : '1v1');
            setMapId(getMap(room.mapId).id);
            setOpponents('players');
            setSelectedRoom(room);
            setDuelQueue({searching:false});
            setSaveError('');
            setLaunch(true);
          }}
          onPractice={(r) => {
            configureDuel(r);
            setMode('duel');
            setOpponents('bots');
            setSelectedRoom(null);setDuelQueue({searching:false});setSaveError('');setLaunch(true);
          }}
        />
        <footer>
          <span className="footer-brand">FRAGSTAKE</span>
          <span>YOUR SKILL. YOUR GAME.</span>
          <button onClick={() => setInfo(true)}>
            Game rules <ArrowUpRight size={14} />
          </button>
        </footer>
      </main>
      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent className="sc-dialog">
          <DialogTitle>Know the rules</DialogTitle>
          <DialogDescription>
            Choose Practice to warm up, or FFA and Duels to play against
            players. Bot matches also offer demo stakes.
          </DialogDescription>
          <div className="rule">
            <Crosshair />
            <div>
              <h3>Practice</h3>
              <p>
                Free FFA. Warm up with nine bots. Kills and deaths do not change
                your balance.
              </p>
            </div>
          </div>
          <div className="rule">
            <Zap />
            <div>
              <h3>Cash FFA</h3>
              <p>
                Player FFA is free. For bot matches with demo credits: Rookie
                €1, Beginner: €2, Contender: €5, Pro: €10 per kill or death. A
                kill credits your balance; a death deducts the same amount. A
                round ends if you cannot cover another death.
              </p>
            </div>
          </div>
          <div className="rule">
            <Swords />
            <div>
              <h3>Duels</h3>
              <p>
                Player duels are free and first to 10. In bot matches, choose a
                €5–€100 demo stake, first to 5 or 10, and a single round or best
                of three. Each winning player receives twice their stake. Choose
                weapon restrictions directly on Play. Leaving early forfeits the
                stake.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={launch} onOpenChange={setLaunch}>
        <DialogContent className="sc-dialog">
          <DialogTitle>
            {mode === 'duel' && duelQueue.searching
              ? 'Finding duel'
              : livePlay
              ? mode === 'ffa'
                ? 'FFA'
                : team + ' duel'
              : mode === 'practice'
                ? 'Practice'
                : mode === 'ffa'
                  ? tiers[tier].name + ' FFA'
                  : team + ' duel'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'duel' && duelQueue.searching
              ? 'Searching for a match, then you choose your weapon.'
              : selectedMap.name + ' · '}{' '}
            {mode === 'duel' && duelQueue.searching
              ? ''
              : livePlay
              ? 'Player match · Free entry'
              : 'Bot arena · Demo credits'}
          </DialogDescription>
          {saveError && (
            <p className="error-text" role="alert">
              {saveError}
            </p>
          )}
          {mode === 'duel' && duelQueue.searching ? (
            <div className="duel-searching" role="status">
              <span />
              <h3>Looking for a duel…</h3>
              <p>
                Picking a random map and format. When the match is found,
                you’ll get a short loadout screen before spawning far from the
                enemy.
              </p>
              {duelQueue.found && (
                <div>
                  <b>{getMap(duelQueue.found.mapId).name}</b>
                  <small>{duelQueue.found.team} · First to 10</small>
                </div>
              )}
            </div>
          ) : livePlay ? (
            <>
              <div className="live-review">
                <div>
                  <Users size={24} />
                  <strong>
                    {mode === 'ffa'
                      ? 'UP TO 10 PLAYERS'
                      : team.toUpperCase() + ' DUEL'}
                  </strong>
                </div>
                <p>
                  {mode === 'ffa'
                    ? 'Three minutes. Everyone is an opponent. The round starts with 2 ready players.'
                    : 'Match found: ' +
                      selectedMap.name +
                      ' · ' +
                      team +
                      '. First to 10 after the loadout countdown.'}
                </p>
                <p>
                  Choose your weapon after joining. Escape opens the loadout
                  menu while the shared match continues.
                </p>
                {partyCount > 1 && (
                  <p className="party-queue-note">
                    <Users size={15} />
                    {mode === 'ffa'
                      ? 'Your party stays out of FFA. Everyone joins FFA solo so there is no teaming.'
                      : `${party?.name} is ready for duels: ${partyNames}.`}
                  </p>
                )}
                <span>
                  {data
                    ? 'Finish the match after at least 30 seconds to earn XP.'
                    : 'Guests can play. Sign in to save your results and XP.'}{' '}
                  No cash prizes.
                </span>
              </div>
              <div className="live-availability">
                <span>
                  {live.status?.online
                    ? selectedRoom
                      ? 'Joining your selected match'
                      : 'Ready to find a match'
                    : live.checking
                      ? 'Checking match availability…'
                      : 'The player server is offline'}
                </span>
                <button
                  className="text-button"
                  onClick={() => void live.refresh()}
                  disabled={live.checking}
                  aria-label="Refresh match availability"
                >
                  <RefreshCw size={14} />
                  Retry
                </button>
              </div>
              <button
                className="primary"
                disabled={busy || !live.status?.online}
                onClick={() => void startLive()}
              >
                {busy ? 'Joining match…' : 'Join match'}
                <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <>
              {data?.active && mode !== 'practice' && (
                <div className="saved-match-recovery">
                  <b>
                    You have a saved{' '}
                    {data.active.mode === 'duel'
                      ? 'duel'
                      : data.active.mode.toUpperCase()}{' '}
                    match.
                  </b>
                  <p>
                    Resume it, or close it and enter this match. Closing
                    discards unsaved progress and returns €{reserved.toFixed(2)}{' '}
                    reserved demo credits.
                  </p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setLaunch(false);
                      openSavedMatch(data.active!, data.player);
                    }}
                  >
                    Resume saved match
                  </button>
                </div>
              )}
              {loading && (
                <p>
                  Connecting to your account… Free practice is available now.
                </p>
              )}
              {accountError && (
                <div role="alert">
                  <p className="error-text">{accountError}</p>
                  <div className="dialog-actions">
                    <button
                      className="secondary"
                      onClick={() => void refresh()}
                    >
                      Retry account
                    </button>
                    <a
                      className="secondary"
                      href="/signin-with-chatgpt?return_to=%2F"
                      target="_top"
                    >
                      Sign in with ChatGPT
                    </a>
                  </div>
                </div>
              )}
              {mode === 'practice' && (!loaded || data?.active) && (
                <p>
                  Play without an account connection. This practice score will
                  not be saved.
                </p>
              )}
              <p>
                  {mode === 'practice'
                  ? 'Free entry. Warm up against nine bots in a three-minute round.'
                  : mode === 'ffa'
                    ? 'Earn €' +
                      tiers[tier].rate +
                      ' per kill and lose €' +
                      tiers[tier].rate +
                      ' per death. The round ends if your balance cannot cover another death.'
                    : 'Match found: ' +
                      selectedMap.name +
                      ' · ' +
                      team +
                      '. €' +
                      duelStake +
                      ' will be reserved from your demo wallet. First to '+killTarget+'. Leaving early forfeits your stake.'}
              </p>
              <p>
                WASD to move · Mouse to aim · Click to fire · Right-click to aim
                down sights · Shift to sprint · Space to jump · C to slide ·
                Ctrl to crouch · R to reload · 1 for your gun · 2 for your knife · Esc for
                cash-out and exit. Touch controls are available.
              </p>
              {entry > 0 && mode === 'ffa' && (
                <p>
                  Reserve €{entry} for this session. Your remaining wallet stays
                  separate. Press Escape to pause immediately, choose a weapon,
                  or cash out and leave with your remaining session credits.
                </p>
              )}
              {!affordable && (
                <p className="error-text">
                  Insufficient demo credits.{' '}
                  <a href="/wallet">Add credits in your wallet</a> or choose
                  lower stakes.
                </p>
              )}
              {mode === 'duel' && !validDuel && (
                <p className="error-text">
                  Choose a whole-euro stake between €5 and €100.
                </p>
              )}
              <button
                className="primary"
                disabled={
                  busy ||
                  (mode !== 'practice' && (!loaded || !affordable)) ||
                  (mode === 'duel' && !validDuel)
                }
                onClick={() =>
                  void start(!!data?.active && mode !== 'practice')
                }
              >
                {busy
                  ? 'Preparing match…'
                  : data?.active && mode !== 'practice'
                    ? 'Close saved match & enter'
                    : mode === 'duel'
                      ? 'Reserve €' + duelStake + ' & enter'
                      : 'Enter bot arena'}
                <ArrowRight size={18} />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!result}
        onOpenChange={(open) => {
          if (!open && !pendingResult) setResult(null);
        }}
      >
        <DialogContent className={resultIsDuel?"sc-dialog duel-result-dialog":"sc-dialog result-dialog"}>
          {resultIsDuel&&result?<DuelResult result={result} config={lastMatch} pending={!!pendingResult} busy={busy} error={saveError} retry={()=>{if(pendingResult)void saveMatch(pendingResult);}} rematch={()=>void replayDuel()} findNext={findNextDuel} leave={()=>setResult(null)}/>:<>
          <span className="exit-review-meta">
            {getMap(result?.mapId).name} · MATCH REPORT
          </span>
          <DialogTitle>{result?.reason}</DialogTitle>
          <DialogDescription>
            {result?.live
              ? 'Free player match · ' +
                (result.liveMode === 'ffa' ? 'FFA' : result.liveMode + ' duel')
              : busy
                ? 'Saving your match…'
                : 'Match results · Demo credits only'}
          </DialogDescription>
          {saveError && (
            <p className="error-text" role="alert">
              {saveError}
            </p>
          )}
          {result?.live && <LiveMatchResult result={result} />}
          {result && (
            <MatchReceipt
              stats={result}
              hideTotal={!!result.live && !!result.standings?.length}
              mode={result.mode ?? 'practice'}
              net={result.net}
              returned={result.returned}
              rate={result.rate}
              lastDeathLoss={result.lastDeathLoss}
              caption={
                result.live
                  ? 'Kills / deaths · Free human match'
                  : busy
                    ? 'Saving your session…'
                    : result.reason === 'Arena session forfeited'
                      ? 'Remaining session credits forfeited'
                      : 'Final result · Demo credits'
              }
            />
          )}
          <div className="result-wallet">
            <span>{result?.live ? 'Live match record' : 'Wallet balance'}</span>
            <b>
              {result?.live
                ? result.liveGuest
                  ? 'Guest match · Not saved'
                  : 'Server result · View Progression'
                : busy
                  ? 'Updating…'
                  : result?.walletBalance !== undefined
                    ? '€' + result.walletBalance.toFixed(2)
                    : 'Not saved · Free practice'}
            </b>
          </div>
          <div className="dialog-actions">
            {pendingResult && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void saveMatch(pendingResult)}
              >
                {busy ? 'Saving…' : 'Retry saving match'}
              </button>
            )}
            <button
              className="primary"
              disabled={!!pendingResult}
              onClick={() => {
                setSelectedRoom(null);
                setSaveError('');
                setLaunch(true);
                setResult(null);
              }}
            >
              Play again <ArrowRight size={17} />
            </button>
            <button
              className="secondary"
              disabled={!!pendingResult}
              onClick={() => setResult(null)}
            >
              Back to lobby
            </button>
          </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
