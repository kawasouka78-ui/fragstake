'use client';
import CosmeticShop from './cosmetic-shop';
import { useEffect, useState } from 'react';
import {
  Users,
  ArrowRight,
  Check,
  Trophy,
  Settings2,
  Flag,
  Gauge,
  Monitor,
  MousePointer2,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import SiteHeader from './site-header';
import { PageHeading } from './page-ui';
import {
  dateLabel,
  useAccount,
  accountApi,
  type AccountData,
} from './account-context';
import { rankNames, playerRating as ratingEstimate } from '@/lib/catalog';
import './platform.css';

type Platform = {
  party: null | {
    id: string;
    owner_id: string;
    name: string;
    members: {
      id: string;
      player_id: string;
      name: string;
      handle: string;
      status: string;
    }[];
  };
  invites: { id: string; name: string }[];
  challenges: {
    id: string;
    sender_id: string;
    receiver_id: string;
    sender_name: string;
    receiver_name: string;
    rules: string;
    status: string;
    expires_at: number;
  }[];
  inventory: { sku: string; equipped: number }[];
  reports: {
    id: string;
    category: string;
    details: string;
    status: string;
    created_at: number;
  }[];
  ratings: {
    mode: string;
    matches: number;
    wins: number;
    kills: number;
    deaths: number;
    rating: number;
    rank: string;
  }[];
};
const titles = {
  party: ['Party', 'Invite friends and plan your next match.'],
  shop: ['Shop', 'Weapon finishes and knives. Cosmetics never affect damage.'],
  inventory: ['Inventory', 'Your cosmetics, ready to equip.'],
  ranked: [
    'YOUR COMPETITIVE RECORD',
    'Separate Duel and Arena progress, with clear placement rules.',
  ],
  settings: ['Settings', 'Controls, sound and graphics.'],
  support: ['Support', 'Report a problem or suspicious play.'],
};
export type PlatformSection = keyof typeof titles;
const defaultPreferences = {
  sensitivity: 1,
  fov: 80,
  quality: 'high',
  muted: false,
  crosshair: 'classic',
  hitmarker: true,
  hudScale: 100,
  weaponBob: 'medium',
  announcer: true,
  motion: 'full',
};
type Preferences = typeof defaultPreferences;
const settingPresets = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Clean default feel for most matches.',
    values: {
      sensitivity: 1,
      fov: 80,
      quality: 'high',
      hudScale: 100,
      weaponBob: 'medium',
      motion: 'full',
    },
  },
  {
    id: 'competitive',
    name: 'Competitive',
    description: 'Less movement on screen, wider view.',
    values: {
      sensitivity: 0.9,
      fov: 92,
      quality: 'low',
      hudScale: 92,
      weaponBob: 'low',
      motion: 'reduced',
    },
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Heavier atmosphere and bigger HUD.',
    values: {
      sensitivity: 1.1,
      fov: 76,
      quality: 'high',
      hudScale: 108,
      weaponBob: 'high',
      motion: 'full',
    },
  },
];
export default function PlatformPage({
  section,
  embedded = false,
}: {
  section: PlatformSection;
  embedded?: boolean;
}) {
  const { data, loading, error, update, refresh } = useAccount();
  const [platform, setPlatform] = useState<Platform | null>(null),
    [failure, setFailure] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [handle, setHandle] = useState(''),
    [partyName, setPartyName] = useState('My squad');
  const [category, setCategory] = useState('bug'),
    [details, setDetails] = useState(''),
    [matchId, setMatchId] = useState('');
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  async function load() {
    try {
      setPlatform(await accountApi<Platform>(undefined, '?action=platform'));
      setFailure('');
    } catch (error) {
      setPlatform(null);
      setFailure(
        error instanceof Error
          ? error.message
          : 'Could not load this page. Please try again.',
      );
    }
  }
  useEffect(() => {
    if (data) void load();
    else setPlatform(null);
  }, [data?.player.id]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setHandle(p.get('opponent') ?? '');
    try {
      const saved = JSON.parse(
        localStorage.getItem('skillclash-controls') ?? '{}',
      );
      setPreferences({
        ...defaultPreferences,
        sensitivity: Number(saved.sensitivity) || defaultPreferences.sensitivity,
        fov: Number(saved.fov) || defaultPreferences.fov,
        quality: saved.quality === 'low' ? 'low' : 'high',
        muted: saved.muted === true,
        crosshair:
          saved.crosshair === 'dot' || saved.crosshair === 'tight'
            ? saved.crosshair
            : defaultPreferences.crosshair,
        hitmarker: saved.hitmarker !== false,
        hudScale: Number(saved.hudScale) || defaultPreferences.hudScale,
        weaponBob:
          saved.weaponBob === 'low' || saved.weaponBob === 'high'
            ? saved.weaponBob
            : defaultPreferences.weaponBob,
        announcer: saved.announcer !== false,
        motion:
          saved.motion === 'reduced' ? 'reduced' : defaultPreferences.motion,
      });
    } catch {}
  }, []);
  function saveSettings(next = preferences) {
    const safe = {
      ...next,
      sensitivity: Math.max(0.3, Math.min(2.5, next.sensitivity)),
      fov: Math.max(65, Math.min(100, next.fov)),
      hudScale: Math.max(80, Math.min(115, next.hudScale)),
    };
    setPreferences(safe);
    localStorage.setItem('skillclash-controls', JSON.stringify(safe));
    setMessage('Settings saved. They apply to your next match.');
  }
  function setting<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }
  async function act(body: Record<string, unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setFailure('');
    setMessage('');
    try {
      const response = await accountApi<AccountData & { platform: Platform }>(
        body,
      );
      update(response);
      setPlatform(response.platform);
      setMessage(success);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'That action failed. Try again.');
    } finally {
      setBusy(false);
    }
  }
  const owned = new Set(platform?.inventory.map((i) => i.sku) ?? []),
    equipped = new Set(
      platform?.inventory.filter((i) => i.equipped).map((i) => i.sku) ?? [],
    );
  const heading = titles[section];
  const Content = embedded ? 'div' : 'main';
  return (
    <div
      className={embedded ? 'party-integrated' : 'site-shell'}
      id={embedded ? 'party' : undefined}
    >
      {!embedded && <SiteHeader />}
      <Content className={embedded ? '' : 'main account-main platform-main'}>
        {!embedded && (
          <PageHeading title={heading[0]} description={heading[1]} />
        )}
        {!loading &&
          !data &&
          section !== 'settings' &&
          section !== 'shop' &&
          section !== 'inventory' && (
            <p className="account-notice">
              <a href="/signin">Sign in to save changes to your account →</a>
            </p>
          )}
        {(failure || error) && (
          <div className="account-notice error" role="alert">
            <p>{failure || error}</p>
            <button
              className="secondary"
              onClick={() => {
                void refresh();
                void load();
              }}
            >
              Retry
            </button>
            <a className="secondary" href="/signin">
              Sign in
            </a>
          </div>
        )}
        {message && (
          <div className="account-notice success" role="status">
            <Check size={18} />
            {message}
          </div>
        )}
        {section === 'party' && (
          <div className="platform-two">
            <section className="account-panel">
              <Users size={34} />
              <h2>{platform?.party?.name ?? 'Create a party'}</h2>
              {platform?.party ? (
                <>
                  <p>
                    {
                      platform.party.members.filter(
                        (m) => m.status === 'joined',
                      ).length
                    }{' '}
                    joined · Up to 6 members and invitations
                  </p>
                  {platform.party.members.map((m) => (
                    <div className="platform-list-row" key={m.id}>
                      <div>
                        <b>{m.name}</b>
                        <p>@{m.handle}</p>
                      </div>
                      <span className="table-badge">
                        {m.player_id === platform.party?.owner_id
                          ? 'Leader'
                          : m.status}
                      </span>
                    </div>
                  ))}
                  {platform.party.owner_id === data?.player.id && (
                    <form
                      className="platform-fields"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act(
                          { action: 'party_invite', handle },
                          'Party invitation sent.',
                        );
                      }}
                    >
                      <label>
                        Invite by player handle
                        <input
                          required
                          value={handle}
                          onChange={(e) =>
                            setHandle(e.target.value.replace(/^@/, ''))
                          }
                        />
                      </label>
                      <button className="primary" disabled={busy}>
                        Invite player
                      </button>
                    </form>
                  )}
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act({ action: 'party_leave' }, 'You left the party.')
                    }
                  >
                    {platform.party.owner_id === data?.player.id
                      ? 'Disband party'
                      : 'Leave party'}
                  </button>
                </>
              ) : (
                <form
                  className="platform-fields"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(
                      { action: 'party_create', name: partyName },
                      'Party created. Invite a registered friend.',
                    );
                  }}
                >
                  <label>
                    Party name
                    <input
                      minLength={2}
                      maxLength={40}
                      required
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                    />
                  </label>
                  <button className="primary" disabled={busy || !data}>
                    Create party <Users size={17} />
                  </button>
                </form>
              )}
              <p className="platform-note">
                Party membership and invitations are saved. For now, players
                must join the same open duel separately; automatic party queues
                are not available.
              </p>
            </section>
            <section className="account-panel">
              <h2>Party invitations</h2>
              {platform?.invites.length ? (
                platform.invites.map((i) => (
                  <div className="platform-list-row" key={i.id}>
                    <b>{i.name}</b>
                    <button
                      className="primary compact"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          { action: 'party_accept', id: i.id },
                          'Joined the party.',
                        )
                      }
                    >
                      Join
                    </button>
                    <button
                      className="secondary compact"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          { action: 'party_decline', id: i.id },
                          'Invitation declined.',
                        )
                      }
                    >
                      Decline
                    </button>
                  </div>
                ))
              ) : (
                <p className="platform-empty">
                  Your party invitations will appear here.
                </p>
              )}
              <a className="secondary" href="/friends">
                Find friends <ArrowRight size={16} />
              </a>
            </section>
          </div>
        )}
        {(section === 'shop' || section === 'inventory') && (
          <CosmeticShop
            inventory={section === 'inventory'}
            owned={owned}
            equipped={equipped}
            busy={busy}
            signedIn={!!data}
            act={act}
          />
        )}
        {section === 'ranked' && (
          <>
            <div className="account-notice">
              <Trophy size={23} />
              <p>
                <b>COMPETITIVE RATINGS</b>
                <br />
                These progress ratings are separate for Duel and Arena. They are
                not payment eligibility or identity verification.
              </p>
            </div>
            <div className="platform-two">
              {['duel', 'ffa'].map((mode) => {
                const row = platform?.ratings.find((r) => r.mode === mode),
                  rating = row ?? {
                    matches: 0,
                    wins: 0,
                    kills: 0,
                    deaths: 0,
                    ...ratingEstimate(0, 0),
                  };
                return (
                  <section className="account-panel rank-card" key={mode}>
                    <span className="eyebrow">
                      {mode === 'duel' ? 'DUEL' : 'ARENA'} RATING
                    </span>
                    <Trophy size={48} />
                    <h2>
                      {rating.matches < 5
                        ? 'PLACEMENT'
                        : rating.rank.toUpperCase()}
                    </h2>
                    <strong>{rating.rating}</strong>
                    <p>
                      {Math.min(5, rating.matches)} / 5 placement matches
                      completed
                    </p>
                    <progress value={Math.min(5, rating.matches)} max={5} />
                    <dl>
                      <div>
                        <dt>Wins / matches</dt>
                        <dd>
                          {rating.wins} / {rating.matches}
                        </dd>
                      </div>
                      <div>
                        <dt>Win rate</dt>
                        <dd>
                          {rating.matches
                            ? Math.round((rating.wins / rating.matches) * 100)
                            : 0}
                          %
                        </dd>
                      </div>
                      <div>
                        <dt>K / D</dt>
                        <dd>
                          {(rating.kills / Math.max(1, rating.deaths)).toFixed(
                            2,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </section>
                );
              })}
            </div>
            <section className="account-panel">
              <h2>THE RANK LADDER</h2>
              <div className="rank-ladder">
                {rankNames.map((name, i) => (
                  <div key={name}>
                    <Trophy size={20} />
                    <b>{name}</b>
                    <small>
                      {i === 0
                        ? 'Under 1,100'
                        : (900 + i * 200).toLocaleString('en-GB') + '+'}
                    </small>
                  </div>
                ))}
              </div>
              <p className="platform-note">
                Rating starts at 1,000: +25 per win, −15 per other
                completed result. Stakes do not multiply progress. Human skill
                matching needs authoritative multiplayer results.
              </p>
              <a className="primary" href="/leaderboard">
                View leaderboards <ArrowRight size={16} />
              </a>
            </section>
          </>
        )}
        {section === 'settings' && (
          <section className="settings-hub" aria-label="Game settings">
            <div className="settings-hero account-panel">
              <div>
                <span className="eyebrow">DEVICE SETTINGS</span>
                <h2>Make the arena feel right.</h2>
                <p>
                  Tune aim, view, audio and HUD. These settings save on this
                  device and apply when you enter a match.
                </p>
              </div>
              <div className="settings-readout" aria-label="Current setup">
                <span>
                  <MousePointer2 size={17} />
                  {preferences.sensitivity.toFixed(1)} sens
                </span>
                <span>
                  <Monitor size={17} />
                  {preferences.fov}° FOV
                </span>
                <span>
                  <Gauge size={17} />
                  {preferences.quality === 'high' ? 'High' : 'Performance'}
                </span>
              </div>
            </div>
            <div className="settings-presets" aria-label="Setting presets">
              {settingPresets.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      ...preset.values,
                    }))
                  }
                >
                  <b>{preset.name}</b>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
            <form
              className="settings-grid"
              onSubmit={(e) => {
                e.preventDefault();
                saveSettings();
              }}
            >
              <section className="account-panel settings-card">
                <div className="settings-card-head">
                  <MousePointer2 size={22} />
                  <div>
                    <h2>Aim</h2>
                    <p>Keep the mouse predictable and comfortable.</p>
                  </div>
                </div>
                <label className="range-row">
                  <span>
                    Mouse sensitivity
                    <b>{preferences.sensitivity.toFixed(1)}</b>
                  </span>
                  <input
                    type="range"
                    min="0.3"
                    max="2.5"
                    step="0.1"
                    value={preferences.sensitivity}
                    onChange={(e) =>
                      setting('sensitivity', Number(e.target.value))
                    }
                  />
                </label>
                <label className="range-row">
                  <span>
                    Field of view
                    <b>{preferences.fov}°</b>
                  </span>
                  <input
                    type="range"
                    min="65"
                    max="100"
                    value={preferences.fov}
                    onChange={(e) => setting('fov', Number(e.target.value))}
                  />
                </label>
                <div className="pill-choice">
                  {[
                    ['classic', 'Classic'],
                    ['tight', 'Tight'],
                    ['dot', 'Dot'],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={preferences.crosshair === value}
                      onClick={() =>
                        setting('crosshair', value as Preferences['crosshair'])
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
              <section className="account-panel settings-card">
                <div className="settings-card-head">
                  <Monitor size={22} />
                  <div>
                    <h2>Video & HUD</h2>
                    <p>Set what stays on screen while fighting.</p>
                  </div>
                </div>
                <label className="platform-label">
                  Graphics
                  <select
                    value={preferences.quality}
                    onChange={(e) =>
                      setting(
                        'quality',
                        e.target.value as Preferences['quality'],
                      )
                    }
                  >
                    <option value="high">High atmosphere</option>
                    <option value="low">Performance mode</option>
                  </select>
                </label>
                <label className="range-row">
                  <span>
                    HUD scale
                    <b>{preferences.hudScale}%</b>
                  </span>
                  <input
                    type="range"
                    min="80"
                    max="115"
                    step="5"
                    value={preferences.hudScale}
                    onChange={(e) => setting('hudScale', Number(e.target.value))}
                  />
                </label>
                <div className="toggle-list">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.hitmarker}
                      onChange={(e) => setting('hitmarker', e.target.checked)}
                    />
                    <span>
                      Hit marker
                      <small>Show confirmation when shots connect.</small>
                    </span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.motion === 'reduced'}
                      onChange={(e) =>
                        setting('motion', e.target.checked ? 'reduced' : 'full')
                      }
                    />
                    <span>
                      Reduced motion
                      <small>Calmer page and menu movement.</small>
                    </span>
                  </label>
                </div>
              </section>
              <section className="account-panel settings-card">
                <div className="settings-card-head">
                  <Volume2 size={22} />
                  <div>
                    <h2>Audio & Feel</h2>
                    <p>Control feedback without changing weapon strength.</p>
                  </div>
                </div>
                <div className="toggle-list">
                  <label>
                    <input
                      type="checkbox"
                      checked={!preferences.muted}
                      onChange={(e) => setting('muted', !e.target.checked)}
                    />
                    <span>
                      Game audio
                      <small>Weapon and movement sounds.</small>
                    </span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.announcer}
                      onChange={(e) => setting('announcer', e.target.checked)}
                    />
                    <span>
                      Match callouts
                      <small>Round start, cash-out and result cues.</small>
                    </span>
                  </label>
                </div>
                <div className="pill-choice">
                  {[
                    ['low', 'Low bob'],
                    ['medium', 'Normal'],
                    ['high', 'Heavy'],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={preferences.weaponBob === value}
                      onClick={() =>
                        setting('weaponBob', value as Preferences['weaponBob'])
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
              <section className="account-panel settings-card controls-card">
                <div className="settings-card-head">
                  <Settings2 size={22} />
                  <div>
                    <h2>Controls</h2>
                    <p>The essentials while in a match.</p>
                  </div>
                </div>
                <dl className="keybind-list">
                  <div>
                    <dt>Move</dt>
                    <dd>WASD</dd>
                  </div>
                  <div>
                    <dt>Look</dt>
                    <dd>Mouse</dd>
                  </div>
                  <div>
                    <dt>Sprint / slide</dt>
                    <dd>Shift / C</dd>
                  </div>
                  <div>
                    <dt>Jump / crouch</dt>
                    <dd>Space / Ctrl</dd>
                  </div>
                  <div>
                    <dt>Gun / knife</dt>
                    <dd>1 / 2</dd>
                  </div>
                  <div>
                    <dt>Menu</dt>
                    <dd>Esc</dd>
                  </div>
                </dl>
              </section>
              <div className="settings-actions">
                <button className="primary">
                  Save settings <Check size={17} />
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setPreferences(defaultPreferences);
                    saveSettings(defaultPreferences);
                  }}
                >
                  <RotateCcw size={16} />
                  Reset
                </button>
                <a className="secondary" href="/profile">
                  Edit profile
                </a>
              </div>
            </form>
          </section>
        )}
        {section === 'support' && (
          <div className="platform-two">
            <section className="account-panel">
              <Flag size={32} />
              <h2>Submit a report</h2>
              <form
                className="platform-fields"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(
                    { action: 'report_create', category, details, matchId },
                    'Report recorded in your account.',
                  );
                }}
              >
                <label>
                  Category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="bug">Game or page problem</option>
                    <option value="cheating">Suspicious play</option>
                    <option value="payment">Account / match result</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Related match
                  <select
                    value={matchId}
                    onChange={(e) => setMatchId(e.target.value)}
                  >
                    <option value="">No specific match</option>
                    {data?.matches.map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.mode} · {dateLabel(m.started_at)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  What happened?
                  <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={6}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                  />
                </label>
                <button className="primary" disabled={busy || !data}>
                  Save report
                </button>
              </form>
              <p className="platform-note">
                Reports are saved to your account. Response times are not
                guaranteed.
              </p>
            </section>
            <section className="account-panel">
              <h2>Your reports</h2>
              {platform?.reports.length ? (
                platform.reports.map((r) => (
                  <article className="platform-list-row" key={r.id}>
                    <div>
                      <b>{r.category.toUpperCase()}</b>
                      <p>{r.details}</p>
                      <small>{dateLabel(r.created_at)}</small>
                    </div>
                    <span className="table-badge">{r.status}</span>
                  </article>
                ))
              ) : (
                <p className="platform-empty">No reports filed.</p>
              )}
            </section>
          </div>
        )}
        {loading && section !== 'settings' && (
          <p className="platform-note">
            Connecting your saved account… You can still browse match rules and
            the catalog.
          </p>
        )}
        {!embedded && (
          <footer>
            <a href="/rules">Game rules</a>
            <a href="/privacy">Privacy</a>
            <a href="/support">Support</a>
          </footer>
        )}
      </Content>
    </div>
  );
}
