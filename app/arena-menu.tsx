'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Keyboard,
  Settings2,
  Crosshair,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { weapons, type Simulation, type WeaponId } from '@/lib/fps/simulation';
import type { LoadoutRenderer } from '@/lib/fps/loadout-renderer';
import type { MatchConfig } from '@/lib/game-rules';
import type { ArenaMap } from '@/lib/fps/maps';
import './arena-menu.css';
import PausedSession from './paused-session';
import LiveRoster from './live-roster';
import { NetworkSimulation } from '@/lib/live/client';

type Preferences = {
  sensitivity: number;
  fov: number;
  quality: string;
  muted: boolean;
};
type Props = {
  game: Simulation | undefined;
  config: MatchConfig;
  map: ArenaMap;
  ready: boolean;
  error: string;
  settings: boolean;
  prefs: Preferences;
  setSettings: (value: boolean) => void;
  preference: (value: Partial<Preferences>) => void;
  select: (id: WeaponId) => void;
  resume: () => void;
  leave: () => void;
  cashOut: () => void;
};

export function WeaponPreview({
  id,
  skin,
  angle = 0,
  knifeStyle = 'standard',
}: {
  id: WeaponId;
  skin?: string;
  angle?: number;
  knifeStyle?: 'standard' | 'karambit';
}) {
  const host = useRef<HTMLDivElement>(null),
    view = useRef<LoadoutRenderer | null>(null),
    selection = useRef({ id, skin, angle, knifeStyle });
  const label = `${id === 'knife' && knifeStyle === 'karambit' ? 'Obsidian Karambit' : weapons[id].name} weapon model`;
  const [failed, setFailed] = useState(false);
  selection.current = { id, skin, angle, knifeStyle };
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let cancelled = false,
      visible = false,
      generation = 0,
      observer: ResizeObserver | undefined,
      element: HTMLCanvasElement | undefined;
    const release = () => {
      generation++;
      observer?.disconnect();
      observer = undefined;
      view.current?.dispose();
      view.current = null;
      element?.remove();
      element = undefined;
    };
    const mount = async () => {
      const current = ++generation;
      try {
        const { LoadoutRenderer } = await import('@/lib/fps/loadout-renderer');
        if (cancelled || !visible || generation !== current) return;
        // Each visit gets a fresh canvas; offscreen previews release their GPU context.
        element = document.createElement('canvas');
        element.setAttribute('aria-hidden', 'true');
        container.appendChild(element);
        const renderer = new LoadoutRenderer(element);
        view.current = renderer;
        const resize = () => {
          const rect = container.getBoundingClientRect();
          renderer.resize(Math.max(1, rect.width), Math.max(1, rect.height));
        };
        resize();
        renderer.setAngle(selection.current.angle);
        renderer.select(
          selection.current.id,
          selection.current.skin,
          selection.current.knifeStyle,
        );
        observer = new ResizeObserver(resize);
        observer.observe(container);
        setFailed(false);
      } catch {
        release();
        if (!cancelled) setFailed(true);
      }
    };
    const visibility = new IntersectionObserver(
      (entries) => {
        const next = entries.some((entry) => entry.isIntersecting);
        if (next === visible) return;
        visible = next;
        if (visible) void mount();
        else release();
      },
      { rootMargin: '80px' },
    );
    visibility.observe(container);
    return () => {
      cancelled = true;
      visibility.disconnect();
      release();
    };
  }, []);
  useEffect(() => {
    try {
      view.current?.select(id, skin, knifeStyle);
    } catch {
      setFailed(true);
    }
  }, [id, skin, knifeStyle]);
  useEffect(() => {
    view.current?.setAngle(angle);
  }, [angle]);
  return (
    <div ref={host} className="loadout-model" role="img" aria-label={label}>
      {failed && (
        <p className="loadout-preview-error">
          Weapon model unavailable. You can still choose your loadout.
        </p>
      )}
    </div>
  );
}

export default function ArenaMenu({
  game,
  config,
  map,
  ready,
  error,
  settings,
  prefs,
  setSettings,
  preference,
  select,
  resume,
  leave,
  cashOut,
}: Props) {
  const selected =
    game?.weapon === 'knife'
      ? game.matchWeapon
      : (game?.weapon ??
        (config.weaponRule === 'sniper' ? 'marksman' : 'rifle'));
  const gun = weapons[selected],
    mode = config.live
      ? config.live.mode === 'ffa'
        ? 'Cash FFA'
        : config.live.mode + ' Duel'
      : config.mode === 'duel'
        ? `${config.team} Duel`
        : config.mode === 'ffa'
          ? 'Cash FFA'
          : 'Practice';
  const round =
    config.mode === 'duel'
      ? config.bestOf === 3
        ? `Best of 3 · First to ${config.target ?? 5}`
        : `First to ${config.target ?? 5}`
      : config.mode === 'ffa'
        ? 'Drop-in arena'
        : '3 minutes';
  const loadoutWeapons = game?.paused
      ? game.allowedWeapons
      : (game?.switchWeapons ?? []),
    helpKeys = loadoutWeapons.length || 6,
    isDuel = config.live ? config.live.mode !== 'ffa' : config.mode === 'duel';
  const showDuelPrep = !game?.started && isDuel;
  return (
    <div className="fps-menu-scrim deployment-scrim">
      <section
        className={'deployment-menu' + (game?.started ? ' is-paused' : '')}
        aria-label="Arena menu"
      >
        <header className="deployment-heading">
          <div>
            <span className="deployment-eyebrow">
              {game?.started
                ? config.live
                  ? 'LIVE MATCH · MENU OPEN'
                  : 'MATCH PAUSED'
                : 'MATCH SETUP'}
              <i />
              {mode}
            </span>
            <h1>
              {error
                ? 'LET’S TRY AGAIN'
                : settings
                  ? 'GAME SETTINGS'
                  : game?.started
                    ? config.live
                      ? 'YOUR LOADOUT'
                      : 'MATCH PAUSED'
                    : 'CHOOSE YOUR LOADOUT'}
              <span>.</span>
            </h1>
          </div>
          <div className="deployment-location">
            <Crosshair size={18} />
            <div>
              <b>{map.name}</b>
              <span>
                {config.live
                  ? config.live.mode === 'ffa'
                    ? 'Drop-in arena · Leave anytime'
                    : 'Live match · Arena keeps running'
                  : round + ' · Practice match'}
              </span>
            </div>
          </div>
        </header>
        {error ? (
          <div className="deployment-error" role="alert">
            <p>{error}</p>
            <button className="secondary" onClick={leave}>
              <ArrowLeft size={17} /> Back to Play
            </button>
          </div>
        ) : (
          <>
            <div className="deployment-body">
              <section
                className="loadout-spotlight"
                aria-label="Selected weapon"
              >
                <div className="loadout-sheen" />
                <div className="loadout-spotlight-top">
                  <span>
                    <i /> SELECTED WEAPON
                  </span>
                  <span>
                    {showDuelPrep
                      ? 'DUEL READY'
                      : gun.auto
                        ? 'FULL AUTO'
                        : 'SEMI AUTO'}
                  </span>
                </div>
                <WeaponPreview
                  id={selected}
                  skin={config.skin}
                  knifeStyle={config.knifeStyle}
                />
                <div className="loadout-name">
                  <span>{gun.type}</span>
                  <h2>{gun.name}</h2>
                </div>
                <dl className="loadout-stats">
                  <div>
                    <dt>Magazine</dt>
                    <dd>
                      {gun.mag}
                      <small> rounds</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Reload</dt>
                    <dd>
                      {gun.reload.toFixed(2)}
                      <small> s</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Max. range</dt>
                    <dd>
                      {gun.range}
                      <small> m</small>
                    </dd>
                  </div>
                </dl>
              </section>
              <section
                className="loadout-selection"
                aria-label={settings ? 'Game settings' : 'Choose a weapon'}
              >
                <div className="loadout-section-heading">
                  <h2>{settings ? 'GAME SETTINGS' : 'YOUR ARSENAL'}</h2>
                  <span>
                    {settings
                      ? 'Saved on this device'
                      : game?.started && !game.paused
                        ? 'In match'
                        : `${game?.allowedWeapons.length ?? '—'} weapons available`}
                  </span>
                </div>
                {settings ? (
                  <div className="deployment-settings">
                    <label>
                      Mouse sensitivity <b>{prefs.sensitivity.toFixed(1)}</b>
                      <Slider
                        aria-label="Mouse sensitivity"
                        min={0.3}
                        max={2.5}
                        step={0.1}
                        value={[prefs.sensitivity]}
                        onValueChange={(v) =>
                          preference({
                            sensitivity: Array.isArray(v) ? v[0] : v,
                          })
                        }
                      />
                    </label>
                    <label>
                      Field of view <b>{prefs.fov}°</b>
                      <Slider
                        aria-label="Field of view"
                        min={65}
                        max={100}
                        step={1}
                        value={[prefs.fov]}
                        onValueChange={(v) =>
                          preference({ fov: Array.isArray(v) ? v[0] : v })
                        }
                      />
                    </label>
                    <div>
                      <span>Graphics</span>
                      <Tabs
                        value={prefs.quality}
                        onValueChange={(v) =>
                          preference({ quality: String(v) })
                        }
                      >
                        <TabsList>
                          <TabsTrigger value="high">High</TabsTrigger>
                          <TabsTrigger value="low">Performance</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <p>
                      Changes apply immediately. Choose Performance for smoother
                      play on slower devices.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="loadout-grid">
                      {loadoutWeapons.map((id, i) => (
                        <button
                          type="button"
                          key={id}
                          disabled={!ready}
                          aria-pressed={selected === id}
                          aria-label={`Select ${weapons[id].name}`}
                          className={
                            'loadout-card ' +
                            (selected === id ? 'selected' : '')
                          }
                          onClick={() => select(id)}
                        >
                          <span className="loadout-card-number">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span>
                            <b>{weapons[id].name}</b>
                            <small>{weapons[id].type}</small>
                          </span>
                          {selected === id && (
                            <Check size={16} aria-hidden="true" />
                          )}
                        </button>
                      ))}
                    </div>
                    {!ready && (
                      <p role="status" className="loadout-rule">
                        Preparing your loadout…
                      </p>
                    )}
                    {(config.weaponRule === 'headshots' ||
                      (game && game.allowedWeapons.length < 6)) && (
                      <p className="loadout-rule">
                        {config.weaponRule === 'headshots'
                          ? 'Headshots only. Body shots deal no damage.'
                          : 'This match uses a restricted weapon pool.'}
                      </p>
                    )}
                  </>
                )}
              </section>
            </div>
            {game?.started && !config.live && (
              <PausedSession game={game} config={config} />
            )}
            {game instanceof NetworkSimulation && <LiveRoster game={game} />}
            <details className="deployment-controls">
              <summary>
                <Keyboard size={17} />
                <span>Controls & tips</span>
                <span className="deployment-key-hint">
                  WASD to move · Mouse to aim
                </span>
                <ChevronDown size={15} />
              </summary>
              <div className="deployment-controls-body">
                <div className="deployment-key-grid">
                  {[
                    ['Move', 'W A S D'],
                    ['Look / aim', 'Mouse / Arrow keys'],
                    ['Fire / aim down sights', 'LMB / RMB'],
                    ['Sprint / crouch', 'Shift / Ctrl'],
                    ['Slide', 'C'],
                    ['Jump / reload', 'Space / R'],
                    [
                      'Switch weapons',
                      game?.started
                        ? '1 gun · 2 knife'
                        : helpKeys === 1
                          ? '1'
                          : `1 – ${helpKeys}`,
                    ],
                    ['Inspect knife', 'V'],
                    ['Scoreboard', 'Tab'],
                    ['Pause / loadout / cash-out', 'Esc / P'],
                  ].map(([label, keys]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <kbd>{keys}</kbd>
                    </div>
                  ))}
                </div>
                <p>
                  Press C to slide in your movement direction. No sprint or
                  stamina required. Press C in the air to slide on landing.
                  Press Space to jump out of a slide. Health regenerates after 7
                  seconds without damage. Pick up health and ammo at marked
                  stations. Touch controls appear on touch devices. Press F for
                  keyboard firing.
                </p>
              </div>
            </details>
            <footer className="deployment-actions">
              <button
                className={
                  game?.started && config.mode === 'ffa'
                    ? 'secondary deployment-cashout'
                    : 'deployment-back'
                }
                disabled={!ready}
                onClick={
                  game?.started && config.mode === 'ffa' ? cashOut : leave
                }
              >
                <ArrowLeft size={16} />
                {!game?.started
                  ? 'Back to Play'
                  : config.live && config.live.mode !== 'ffa'
                    ? 'Forfeit & leave'
                    : config.mode === 'ffa'
                      ? 'Cash out & leave'
                      : config.mode === 'duel'
                        ? `Forfeit €${(config.stake ?? 10).toFixed(2)} & leave`
                        : 'Leave match'}
              </button>
              <div>
                <button
                  className="secondary"
                  onClick={() => setSettings(!settings)}
                >
                  {settings ? <Crosshair size={17} /> : <Settings2 size={17} />}{' '}
                  {settings ? 'Loadout' : 'Settings'}
                </button>
                <button
                  className="primary deployment-start"
                  disabled={!ready}
                  onClick={resume}
                >
                  {ready
                    ? game?.started
                      ? 'RESUME MATCH'
                      : isDuel
                        ? 'SPAWN NOW'
                        : config.live
                          ? 'READY UP'
                          : 'ENTER MATCH'
                    : 'LOADING ARENA…'}
                  <ArrowRight size={19} />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
