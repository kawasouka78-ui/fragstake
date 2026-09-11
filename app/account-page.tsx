'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
const Link = 'a';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  MessageSquare,
  Check,
  Copy,
  Crosshair,
  History,
  Plus,
  Search,
  ShieldCheck,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  X,
  RefreshCw,
  Clock,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import PlatformPage from './platform-page';
import SocialChat from './social-chat';
import HistoryStats from './history-stats';
import SiteHeader, { PlayerAvatar } from './site-header';
import { PageHeading, EmptyState } from './page-ui';
import {
  useAccount,
  accountApi,
  euro,
  dateLabel,
  type AccountData,
  type Summary,
} from './account-context';
import { getMap } from '@/lib/fps/maps';
import type { Player, MatchRow } from '@/db/service';
import { signOutFirebase } from '@/lib/firebase-client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

type Section = 'wallet' | 'friends' | 'leaderboard' | 'history' | 'profile';
type Person = Pick<
  Player,
  'id' | 'name' | 'handle' | 'bio' | 'color' | 'created_at' | 'last_seen'
> & {
  friendship_id?: string;
  friendship_status?: string;
  sender_id?: string;
  receiver_id?: string;
  status?: string;
};
type Ranked = Person & {
  matches: number;
  kills: number;
  deaths: number;
  wins: number;
  points: number;
  net: number;
  streak: number;
  kd: number;
};
const labels = {
  wallet: [
    'YOUR BALANCE',
    'WALLET',
    'Every match. Every credit. All in one place.',
  ],
  friends: ['YOUR PEOPLE', 'Social', 'Friends and parties, all in one place.'],
  leaderboard: [
    'PLAYER RANKINGS',
    'LEADERBOARD',
    'See how completed player matches stack up.',
  ],
  history: [
    'YOUR RECORD',
    'HISTORY & STATS',
    'The wins, the lessons, and every round in between.',
  ],
  profile: [
    'PLAYER IDENTITY',
    'Profile',
    'Your public name and player details.',
  ],
};
const modeName = (mode: string, team?: string) =>
  mode === 'practice'
    ? 'Practice'
    : mode === 'ffa'
      ? 'Cash FFA'
      : `${team || '1v1'} duel`;
const kd = (kills: number, deaths: number) =>
  deaths ? (kills / deaths).toFixed(2) : kills ? `${kills}.00` : '0.00';
function Empty({
  icon: Icon = Crosshair,
  title,
  children,
}: {
  icon?: typeof Crosshair;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon size={33} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Filter({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger className="account-select" aria-label={label}>
        <SelectValue>{items.find((i) => i.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
const socialHashSubscribe = (listener: () => void) => {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
};
const socialHashValue = () =>
  ['party', 'messages'].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : 'friends';
export default function AccountPage({ section }: { section: Section }) {
  const {
    data,
    loading,
    error,
    refresh,
    update,
    profilePrefs,
    saveProfilePrefs,
  } = useAccount();
  const [message, setMessage] = useState(''),
    [failure, setFailure] = useState(''),
    [busy, setBusy] = useState(false);
  const [topup, setTopup] = useState(false),
    [amount, setAmount] = useState('5000');
  const topupKey = useRef('');
  const [ledgerFilter, setLedgerFilter] = useState('all'),
    [historyMode, setHistoryMode] = useState('all'),
    [historyResult, setHistoryResult] = useState('all');
  const socialView = useSyncExternalStore(
    socialHashSubscribe,
    socialHashValue,
    () => 'friends',
  );
  const [friendTab, setFriendTab] = useState('friends'),
    [query, setQuery] = useState(''),
    [searched, setSearched] = useState(false),
    [searching, setSearching] = useState(false),
    [people, setPeople] = useState<Person[]>([]),
    [friends, setFriends] = useState<Person[]>([]),
    [friendsLoading, setFriendsLoading] = useState(true);
  const searchBox = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState<Person | null>(null),
    [showPlayer, setShowPlayer] = useState<{
      player: Person;
      stats: Summary;
    } | null>(null),
    [selectedMatch, setSelectedMatch] = useState<MatchRow | null>(null);
  const [metric, setMetric] = useState('points');
  const [leaderMode, setLeaderMode] = useState('all'),
    [period, setPeriod] = useState('all'),
    [scope, setScope] = useState('all'),
    [leaderPage, setLeaderPage] = useState(0),
    [ranks, setRanks] = useState<Ranked[]>([]),
    [leaderTotal, setLeaderTotal] = useState(0),
    [leaderLoading, setLeaderLoading] = useState(true);
  const [profile, setProfile] = useState({
    name: '',
    handle: '',
    bio: '',
    color: 'orange',
    avatar: '',
    anonymous: false,
  });
  const [currentTime, setCurrentTime] = useState(0);
  const profileLoaded = useRef(false);
  const notify = (text: string) => {
    setMessage(text);
    setFailure('');
  };
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (data && !profileLoaded.current) {
      setProfile({
        name: data.player.name,
        handle: data.player.handle,
        bio: data.player.bio,
        color: data.player.color,
        avatar: profilePrefs.avatar,
        anonymous: profilePrefs.anonymous,
      });
      profileLoaded.current = true;
    }
  }, [data, profilePrefs.avatar, profilePrefs.anonymous]);
  useEffect(() => {
    setProfile((p) => ({
      ...p,
      avatar: profilePrefs.avatar,
      anonymous: profilePrefs.anonymous,
    }));
  }, [profilePrefs.avatar, profilePrefs.anonymous]);
  async function loadFriends() {
    try {
      const r = await accountApi<{ friends: Person[] }>(
        undefined,
        '?action=friends',
      );
      setFriends(r.friends);
    } catch (e) {
      setFriends([]);
      setFailure(
        e instanceof Error ? e.message : 'Could not load your friends.',
      );
    } finally {
      setFriendsLoading(false);
    }
  }
  useEffect(() => {
    if (section !== 'friends' || !data) return;
    void loadFriends();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void loadFriends();
    }, 20000);
    return () => clearInterval(timer);
  }, [section, data?.player.id]);
  useEffect(() => {
    if (section !== 'leaderboard' || !data) return;
    let alive = true;
    setLeaderLoading(true);
    setFailure('');
    accountApi<{ players: Ranked[]; total: number }>(
      undefined,
      '?action=leaderboard&' +
        new URLSearchParams({
          mode: leaderMode,
          period,
          scope,
          metric,
          page: String(leaderPage),
        }),
    )
      .then((r) => {
        if (alive) {
          setRanks(r.players);
          setLeaderTotal(r.total);
        }
      })
      .catch((e) => {
        if (alive) setFailure(e.message);
      })
      .finally(() => {
        if (alive) setLeaderLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [
    section,
    leaderMode,
    period,
    scope,
    metric,
    leaderPage,
    data?.stats.matches,
  ]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setFailure('');
    try {
      await action();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function searchPlayers() {
    if (query.trim().length < 2) {
      setFailure('Enter at least two characters to find a player.');
      return;
    }
    setSearching(true);
    setFailure('');
    try {
      const r = await accountApi<{ players: Person[] }>(
        undefined,
        '?action=search&q=' + encodeURIComponent(query.trim()),
      );
      setPeople(r.players);
      setSearched(true);
    } catch (e) {
      setPeople([]);
      setSearched(true);
      setFailure(
        e instanceof Error ? e.message : 'Could not search players.',
      );
    } finally {
      setSearching(false);
    }
  }
  async function friendAction(action: string, p: Person) {
    await run(async () => {
      await accountApi({ action, target: p.id, id: p.friendship_id });
      await loadFriends();
      await refresh();
      if (searched) {
        const r = await accountApi<{ players: Person[] }>(
          undefined,
          '?action=search&q=' + encodeURIComponent(query),
        );
        setPeople(r.players);
      }
      setConfirmRemove(null);
      notify(
        action === 'friend_send'
          ? 'Friend request sent.'
          : action === 'friend_accept'
            ? 'Friend added.'
            : action === 'friend_remove'
              ? 'Friend removed.'
              : 'Request cleared.',
      );
    });
  }
  async function viewPlayer(handle: string) {
    await run(async () =>
      setShowPlayer(
        await accountApi(
          undefined,
          '?action=player&handle=' + encodeURIComponent(handle),
        ),
      ),
    );
  }
  const accepted = friends.filter((f) => f.status === 'accepted'),
    incoming = friends.filter(
      (f) => f.status === 'pending' && f.receiver_id === data?.player.id,
    ),
    outgoing = friends.filter(
      (f) => f.status === 'pending' && f.sender_id === data?.player.id,
    );
  const list =
    friendTab === 'friends'
      ? accepted
      : friendTab === 'requests'
        ? incoming
        : outgoing;
  const transactions =
    data?.transactions.filter(
      (t) =>
        ledgerFilter === 'all' ||
        (ledgerFilter === 'credits'
          ? ['welcome', 'topup'].includes(t.kind)
          : ['match', 'stake'].includes(t.kind)),
    ) || [];
  const ownPublicName =
    data && profilePrefs.anonymous ? 'Anonymous Player' : data?.player.name;
  function saveDisplayPrefs(next: { avatar: string; anonymous: boolean }) {
    setProfile((p) => ({ ...p, ...next }));
    saveProfilePrefs(next);
  }
  function chooseProfilePicture(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFailure('Choose an image file for your profile picture.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setFailure('Could not read that image.');
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => setFailure('Could not load that image.');
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setFailure('Could not prepare that image.');
          return;
        }
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        ctx.drawImage(
          image,
          (size - width) / 2,
          (size - height) / 2,
          width,
          height,
        );
        saveDisplayPrefs({
          avatar: canvas.toDataURL('image/jpeg', 0.82),
          anonymous: profile.anonymous,
        });
        setFailure('');
        notify('Profile picture updated.');
      };
      image.src = String(reader.result ?? '');
    };
    reader.readAsDataURL(file);
  }
  const matches =
    data?.matches.filter(
      (m) =>
        (historyMode === 'all' || m.mode === historyMode) &&
        (historyResult === 'all' ||
          (historyResult === 'wins' ? !!m.won : !m.won)),
    ) || [];
  function personCard(p: Person, source: 'list' | 'search') {
    const pending =
        source === 'search'
          ? p.friendship_status === 'pending'
          : p.status === 'pending',
      isFriend =
        source === 'search'
          ? p.friendship_status === 'accepted'
          : p.status === 'accepted',
      sent = p.sender_id === data?.player.id;
    return (
      <article className="person-card" key={p.id}>
        <button
          className="person-identity"
          onClick={() => void viewPlayer(p.handle)}
        >
          <PlayerAvatar name={p.name} color={p.color} />
          <span>
            <b>{p.name}</b>
            <small>@{p.handle}</small>
          </span>
        </button>
        <span className="presence">
          <i
            className={
              currentTime && currentTime - p.last_seen < 120000 ? 'online' : ''
            }
          />
          {currentTime && currentTime - p.last_seen < 120000
            ? 'Recently active'
            : 'Offline'}
        </span>
        <div className="person-actions">
          {isFriend ? (
            <>
              <a className="secondary compact" href="/play?mode=1v1">
                Duel lobbies
              </a>
              <button
                className="secondary compact"
                onClick={() => setConfirmRemove(p)}
              >
                Remove
              </button>
            </>
          ) : pending ? (
            sent ? (
              <button
                className="secondary compact"
                disabled={busy}
                onClick={() => void friendAction('friend_cancel', p)}
              >
                Cancel request
              </button>
            ) : (
              <>
                <button
                  className="primary compact"
                  disabled={busy}
                  onClick={() => void friendAction('friend_accept', p)}
                >
                  <Check size={15} />
                  Accept
                </button>
                <button
                  className="icon-button"
                  aria-label={'Decline ' + p.name}
                  disabled={busy}
                  onClick={() => void friendAction('friend_decline', p)}
                >
                  <X size={17} />
                </button>
              </>
            )
          ) : (
            <button
              className="primary compact"
              disabled={busy}
              onClick={() => void friendAction('friend_send', p)}
            >
              <UserPlus size={15} />
              Add friend
            </button>
          )}
        </div>
      </article>
    );
  }
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="main account-main">
        <PageHeading
          title={labels[section][1]}
          description={labels[section][2]}
        />
        {(failure || error) && (
          <div className="account-notice error" role="alert">
            <p>{failure || error}</p>
            {error && (
              <>
                <button className="secondary" onClick={() => void refresh()}>
                  Retry
                </button>
                <Link className="secondary" href="/signin">
                  Sign in
                </Link>
              </>
            )}
          </div>
        )}
        {message && (
          <div className="account-notice success" role="status">
            <Check size={18} />
            {message}
          </div>
        )}
        {loading ? (
          <div className="loading-account">
            <RefreshCw size={24} />
            <p>Loading your player account…</p>
          </div>
        ) : !data ? (
          <EmptyState
            icon={<Users size={26} />}
            title={
              section === 'friends'
                ? 'Play with your people'
                : 'Your player profile'
            }
            action={
              <a className="primary" href="/signin">
                Sign in
              </a>
            }
          >
            {section === 'friends'
              ? 'Sign in to add friends, send messages and create a party.'
              : 'Sign in to set up your name and player details.'}
          </EmptyState>
        ) : (
          <>
            {section === 'wallet' && (
              <>
                <section className="payment-readiness">
                  <h3>Real-money rollout</h3>
                  <p>
                    Worldwide access is the plan. Paid entry and withdrawals
                    will open only in approved locations, after identity checks
                    and payment-provider approval.
                  </p>
                </section>
                <div className="wallet-grid">
                  <section className="balance-card">
                    <div className="balance-card-top">
                      <span>
                        <Wallet size={19} />
                        FRAGSTAKE WALLET
                      </span>
                      <span className="status-badge">WALLET</span>
                    </div>
                    <small>AVAILABLE BALANCE</small>
                    <div className="balance-number">
                      {euro(data.player.balance)}
                    </div>
                    <div className="balance-card-bottom">
                      <span>
                        @{data.player.handle}
                        <small>Saved to your account</small>
                      </span>
                      <button
                        className="primary"
                        disabled
                      >
                        <Plus size={17} />
                        Funding locked
                      </button>
                    </div>
                  </section>
                  <section className="account-panel wallet-summary">
                    <h2>YOUR MATCH ECONOMY</h2>
                    <div>
                      <span>Net match result</span>
                      <b
                        className={
                          data.stats.net >= 0 ? 'positive' : 'negative'
                        }
                      >
                        {data.stats.net >= 0 ? '+' : ''}
                        {euro(data.stats.net)}
                      </b>
                    </div>
                    <div>
                      <span>Funds in active match</span>
                      <b>
                        {euro(
                          data.active?.mode === 'duel'
                            ? data.active.stake
                            : (data.active?.entry ?? 0),
                        )}
                      </b>
                    </div>
                    <div>
                      <span>Recorded matches</span>
                      <b>{data.stats.matches}</b>
                    </div>
                    <p>
                      <ShieldCheck size={16} />
                      Deposits and withdrawals stay locked until the payment
                      provider is connected.
                    </p>
                  </section>
                </div>
                {data.active && (
                  <div className="account-notice">
                    <div>
                      <b>
                        Unfinished{' '}
                        {modeName(data.active.mode, data.active.team)}
                      </b>
                      <p>
                        Resume this match from Play, or close it here. Reserved
                        Duel or Arena session credits are forfeited when closing
                        a played match.
                      </p>
                    </div>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          update(
                            await accountApi({
                              action: 'match_finish',
                              id: data.active!.id,
                              kills: 0,
                              deaths: 0,
                              score: 0,
                              enemyScore: 0,
                              ending: 'leave',
                            }),
                          );
                          notify('Unfinished match closed.');
                        })
                      }
                    >
                      Close unfinished match
                    </button>
                  </div>
                )}
                <section className="account-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>TRANSACTION HISTORY</h2>
                      <p>Your latest 50 wallet entries.</p>
                    </div>
                    <Tabs
                      value={ledgerFilter}
                      onValueChange={(v) => setLedgerFilter(String(v))}
                    >
                      <TabsList className="account-tabs">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="matches">Matches</TabsTrigger>
                        <TabsTrigger value="credits">Credits</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  {transactions.length ? (
                    <Table className="account-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>TRANSACTION</TableHead>
                          <TableHead>DATE</TableHead>
                          <TableHead>TYPE</TableHead>
                          <TableHead className="text-right">AMOUNT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell>
                              <span className="transaction-label">
                                <span
                                  className={
                                    'transaction-icon ' +
                                    (t.amount >= 0 ? 'in' : 'out')
                                  }
                                >
                                  {t.amount >= 0 ? (
                                    <ArrowDownLeft size={19} />
                                  ) : (
                                    <ArrowUpRight size={19} />
                                  )}
                                </span>
                                <b>{t.label}</b>
                              </span>
                            </TableCell>
                            <TableCell>{dateLabel(t.created_at)}</TableCell>
                            <TableCell>
                              <span className="table-badge">{t.kind}</span>
                            </TableCell>
                            <TableCell
                              className={
                                'text-right amount ' +
                                (t.amount >= 0 ? 'positive' : 'negative')
                              }
                            >
                              {t.amount >= 0 ? '+' : ''}
                              {euro(t.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Empty icon={Wallet} title="No transactions in this view">
                      Your wallet activity will appear here.
                    </Empty>
                  )}
                </section>
              </>
            )}
            {section === 'friends' && (
              <Tabs
                className="social-workspace"
                value={socialView}
                onValueChange={(value) => {
                  const next = String(value);
                  window.history.replaceState(
                    window.history.state,
                    '',
                    location.pathname +
                      location.search +
                      (next === 'friends' ? '' : '#' + next),
                  );
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }}
              >
                <TabsList
                  className="social-section-tabs"
                  aria-label="Social sections"
                >
                  <TabsTrigger value="friends">
                    <Users size={16} />
                    Friends<span>{accepted.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="party">
                    <Swords size={16} />
                    Party
                  </TabsTrigger>
                  <TabsTrigger value="messages">
                    <MessageSquare size={16} />
                    Messages
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="party" className="social-section">
                  <PlatformPage section="party" embedded />
                </TabsContent>
                <TabsContent value="messages" className="social-section">
                  <SocialChat />
                </TabsContent>
                <TabsContent value="friends" className="social-section">
                  <div className="friends-intro">
                    <section className="account-panel friend-search">
                      <div className="panel-heading">
                        <div>
                          <h2>FIND YOUR PEOPLE</h2>
                          <p>
                            Search registered players by handle or display name.
                          </p>
                        </div>
                        <UserPlus size={25} />
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void searchPlayers();
                        }}
                        className="search-form"
                      >
                        <Search size={19} />
                        <Input
                          ref={searchBox}
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          maxLength={32}
                          placeholder="Search players…"
                          aria-label="Search players"
                        />
                        <button className="primary" disabled={searching}>
                          {searching ? 'Searching…' : 'Find players'}
                          <ArrowRight size={17} />
                        </button>
                      </form>
                    </section>
                    <section className="account-panel friend-code">
                      <span className="eyebrow">YOUR PLAYER HANDLE</span>
                      <h2>@{data.player.handle}</h2>
                      <button
                        className="secondary"
                        onClick={() =>
                          void run(async () => {
                            await navigator.clipboard.writeText(
                              '@' + data.player.handle,
                            );
                            notify('Handle copied.');
                          })
                        }
                      >
                        <Copy size={15} />
                        Copy handle
                      </button>
                      <p>
                        Other viewers of this site can find you with this
                        handle.
                      </p>
                    </section>
                  </div>
                  {searched && (
                    <section className="account-panel">
                      <div className="panel-heading">
                        <h2>
                          SEARCH RESULTS <span>{people.length}</span>
                        </h2>
                        <button
                          className="icon-button"
                          aria-label="Clear search results"
                          onClick={() => {
                            setSearched(false);
                            setPeople([]);
                            setQuery('');
                          }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      {people.length ? (
                        <div className="people-grid">
                          {people.map((p) => personCard(p, 'search'))}
                        </div>
                      ) : (
                        <Empty icon={Search} title="No players found">
                          Try another handle. Your friend must first open the
                          site and create their account.
                        </Empty>
                      )}
                    </section>
                  )}
                  <section className="account-panel">
                    <div className="panel-heading">
                      <Tabs
                        value={friendTab}
                        onValueChange={(v) => setFriendTab(String(v))}
                      >
                        <TabsList className="account-tabs">
                          <TabsTrigger value="friends">
                            Friends <span>{accepted.length}</span>
                          </TabsTrigger>
                          <TabsTrigger value="requests">
                            Requests <span>{incoming.length}</span>
                          </TabsTrigger>
                          <TabsTrigger value="sent">
                            Sent <span>{outgoing.length}</span>
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <button
                        className="icon-button"
                        aria-label="Refresh friends"
                        disabled={friendsLoading}
                        onClick={() => {
                          setFriendsLoading(true);
                          void loadFriends();
                        }}
                      >
                        <RefreshCw size={17} />
                      </button>
                    </div>
                    {friendsLoading ? (
                      <div className="loading-account">
                        Loading your friends…
                      </div>
                    ) : list.length ? (
                      <div className="people-grid">
                        {list.map((p) => personCard(p, 'list'))}
                      </div>
                    ) : (
                      <Empty
                        icon={Users}
                        title={
                          friendTab === 'friends'
                            ? 'Your circle starts here'
                            : friendTab === 'requests'
                              ? 'No incoming requests'
                              : 'No pending invitations'
                        }
                      >
                        {friendTab === 'friends' ? (
                          <>
                            Find someone above and send your first request.{' '}
                            <button
                              className="text-button"
                              onClick={() => searchBox.current?.focus()}
                            >
                              Find a player <ArrowRight size={14} />
                            </button>
                          </>
                        ) : (
                          'New friend requests will appear here.'
                        )}
                      </Empty>
                    )}
                  </section>
                </TabsContent>
              </Tabs>
            )}
            {section === 'leaderboard' && (
              <>
                <div className="leader-banner">
                  <div>
                    <Trophy size={38} />
                    <div>
                      <span className="eyebrow">CITADEL / MATCH HISTORY</span>
                      <h2>EARN YOUR PLACE.</h2>
                      <a className="text-button" href="/ranked">
                        Your Duel & Arena ratings
                      </a>
                      <p>10 points per elimination. 100 points per win.</p>
                    </div>
                  </div>
                  <span className="ranking-note">
                    <ShieldCheck size={18} />
                    Live rankings
                    <br />
                    <small>Completed player matches</small>
                  </span>
                </div>
                <section className="account-panel">
                  <div className="panel-heading">
                    <Tabs
                      value={scope}
                      onValueChange={(v) => {
                        setScope(String(v));
                        setLeaderPage(0);
                      }}
                    >
                      <TabsList className="account-tabs">
                        <TabsTrigger value="all">All players</TabsTrigger>
                        <TabsTrigger value="friends">Friends</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="filters">
                      <Filter
                        label="Leaderboard game mode"
                        value={leaderMode}
                        onChange={(v) => {
                          setLeaderMode(v);
                          setLeaderPage(0);
                        }}
                        items={[
                          { value: 'all', label: 'All modes' },
                          { value: 'practice', label: 'Practice' },
                          { value: 'ffa', label: 'Cash FFA' },
                          { value: 'duel', label: 'Duels' },
                        ]}
                      />
                      <Filter
                        label="Rank by"
                        value={metric}
                        onChange={(v) => {
                          setMetric(v);
                          setLeaderPage(0);
                        }}
                        items={[
                          { value: 'points', label: 'Points' },
                          { value: 'net', label: 'Net earnings' },
                          { value: 'wins', label: 'Wins' },
                          { value: 'kills', label: 'Kills' },
                          { value: 'kd', label: 'K / D' },
                          { value: 'streak', label: 'Longest streak' },
                        ]}
                      />
                      <Filter
                        label="Leaderboard period"
                        value={period}
                        onChange={(v) => {
                          setPeriod(v);
                          setLeaderPage(0);
                        }}
                        items={[
                          { value: 'all', label: 'All time' },
                          { value: 'week', label: 'Last 7 days' },
                          { value: 'today', label: 'Today (UTC)' },
                        ]}
                      />
                    </div>
                  </div>
                  {leaderLoading ? (
                    <div className="loading-account">Loading the rankings…</div>
                  ) : ranks.length ? (
                    <Table className="account-table leaderboard-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>RANK</TableHead>
                          <TableHead>PLAYER</TableHead>
                          <TableHead>MATCHES</TableHead>
                          <TableHead>WINS</TableHead>
                          <TableHead>K / D</TableHead>
                          <TableHead className="text-right">
                            {metric === 'net'
                              ? 'NET €'
                              : metric.toUpperCase()}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ranks.map((p, i) => (
                          <TableRow
                            key={p.id}
                            className={
                              p.id === data.player.id ? 'your-row' : ''
                            }
                          >
                            <TableCell>
                              <span
                                className={
                                  'rank-number rank-' +
                                  (leaderPage * 25 + i + 1)
                                }
                              >
                                {leaderPage * 25 + i + 1 <= 3 ? (
                                  <Trophy size={19} />
                                ) : null}
                                {leaderPage * 25 + i + 1}
                              </span>
                            </TableCell>
                            <TableCell>
                              <button
                                className="person-identity"
                                onClick={() => void viewPlayer(p.handle)}
                              >
                                <PlayerAvatar
                                  name={p.name}
                                  color={p.color}
                                  image={
                                    p.id === data.player.id
                                      ? profilePrefs.avatar
                                      : ''
                                  }
                                  anonymous={
                                    p.id === data.player.id &&
                                    profilePrefs.anonymous
                                  }
                                />
                                <span>
                                  <b>
                                    {p.id === data.player.id
                                      ? ownPublicName
                                      : p.name}
                                    {p.id === data.player.id && <em>YOU</em>}
                                  </b>
                                  <small>@{p.handle}</small>
                                </span>
                              </button>
                            </TableCell>
                            <TableCell>{p.matches}</TableCell>
                            <TableCell>{p.wins}</TableCell>
                            <TableCell>{kd(p.kills, p.deaths)}</TableCell>
                            <TableCell className="text-right rank-points">
                              {metric === 'net'
                                ? euro(p.net)
                                : metric === 'kd'
                                  ? p.kd.toFixed(2)
                                  : Number(
                                      p[
                                        metric as
                                          | 'points'
                                          | 'kills'
                                          | 'wins'
                                          | 'streak'
                                      ],
                                    ).toLocaleString('en-GB')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Empty icon={Trophy} title="The first spot is waiting">
                      Finish a match to enter these rankings.{' '}
                      <Link href="/" className="text-button">
                        Enter the arena <ArrowRight size={14} />
                      </Link>
                    </Empty>
                  )}
                  {leaderTotal > 25 && (
                    <div className="table-pagination">
                      <span>
                        {leaderPage * 25 + 1}–
                        {Math.min((leaderPage + 1) * 25, leaderTotal)} of{' '}
                        {leaderTotal} players
                      </span>
                      <button
                        className="secondary compact"
                        disabled={leaderPage === 0}
                        onClick={() => setLeaderPage((p) => p - 1)}
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                      <button
                        className="secondary compact"
                        disabled={(leaderPage + 1) * 25 >= leaderTotal}
                        onClick={() => setLeaderPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}
            {section === 'history' && (
              <>
                <div className="stat-grid">
                  <Stat label="MATCHES PLAYED" value={data.stats.matches} />
                  <Stat label="WINS" value={data.stats.wins} />
                  <Stat
                    label="KILL / DEATH RATIO"
                    value={kd(data.stats.kills, data.stats.deaths)}
                  />
                  <Stat label="NET MATCH RESULT" value={euro(data.stats.net)} />
                </div>
                <HistoryStats data={data} />
                <section className="account-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>RECENT MATCHES</h2>
                      <p>Your latest 50 rounds, including previous maps.</p>
                    </div>
                    <div className="filters">
                      <Filter
                        label="History mode"
                        value={historyMode}
                        onChange={setHistoryMode}
                        items={[
                          { value: 'all', label: 'All modes' },
                          { value: 'practice', label: 'Practice' },
                          { value: 'ffa', label: 'Cash FFA' },
                          { value: 'duel', label: 'Duels' },
                        ]}
                      />
                      <Filter
                        label="History result"
                        value={historyResult}
                        onChange={setHistoryResult}
                        items={[
                          { value: 'all', label: 'All results' },
                          { value: 'wins', label: 'Wins' },
                          { value: 'other', label: 'Other results' },
                        ]}
                      />
                    </div>
                  </div>
                  {matches.length ? (
                    <Table className="account-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>MATCH</TableHead>
                          <TableHead>RESULT</TableHead>
                          <TableHead>K / D</TableHead>
                          <TableHead>NET CREDITS</TableHead>
                          <TableHead>DATE</TableHead>
                          <TableHead>
                            <span className="sr-only">Details</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matches.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>
                              <span className="match-mode">
                                <Crosshair size={18} />
                                <b>{modeName(m.mode, m.team)}</b>
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  'table-badge ' + (m.won ? 'win' : '')
                                }
                              >
                                {m.status === 'cancelled'
                                  ? 'Cancelled'
                                  : m.won
                                    ? 'Win'
                                    : m.reason}
                              </span>
                            </TableCell>
                            <TableCell>
                              {m.kills} / {m.deaths}
                            </TableCell>
                            <TableCell
                              className={m.delta >= 0 ? 'positive' : 'negative'}
                            >
                              {m.delta >= 0 ? '+' : ''}
                              {euro(m.delta)}
                            </TableCell>
                            <TableCell>{dateLabel(m.started_at)}</TableCell>
                            <TableCell>
                              <button
                                className="icon-button"
                                aria-label={
                                  'View ' + modeName(m.mode, m.team) + ' match'
                                }
                                onClick={() => setSelectedMatch(m)}
                              >
                                <ArrowUpRight size={18} />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Empty
                      icon={History}
                      title="Your story starts in the arena"
                    >
                      Your completed matches will appear here.{' '}
                      <Link className="text-button" href="/">
                        Play a match <ArrowRight size={14} />
                      </Link>
                    </Empty>
                  )}
                </section>
              </>
            )}
            {section === 'profile' && (
              <>
                <section className="profile-banner">
                  <PlayerAvatar
                    name={data.player.name}
                    color={data.player.color}
                    image={profilePrefs.avatar}
                    anonymous={profilePrefs.anonymous}
                    large
                  />
                  <div>
                    <span className="eyebrow">FRAGSTAKE PLAYER</span>
                    <h2>
                      {profilePrefs.anonymous
                        ? 'Anonymous Player'
                        : data.player.name}
                    </h2>
                    <p>@{data.player.handle}</p>
                  </div>
                  <span className="member-date">
                    <Clock size={15} />
                    Joined{' '}
                    {new Intl.DateTimeFormat('en-GB', {
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }).format(new Date(data.player.created_at))}
                  </span>
                </section>
                <div className="profile-grid">
                  <section className="account-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>PLAYER DETAILS</h2>
                        <p>
                          Your name and handle are visible to other players.
                        </p>
                      </div>
                    </div>
                    <form
                      className="profile-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveProfilePrefs({
                          avatar: profile.avatar,
                          anonymous: profile.anonymous,
                        });
                        void run(async () => {
                          const r = await accountApi<{ player: Player }>({
                            action: 'profile',
                            name: profile.name,
                            handle: profile.handle,
                            bio: profile.bio,
                            color: profile.color,
                          });
                          update({ ...data, player: r.player });
                          setProfile({
                            name: r.player.name,
                            handle: r.player.handle,
                            bio: r.player.bio,
                            color: r.player.color,
                            avatar: profile.avatar,
                            anonymous: profile.anonymous,
                          });
                          notify('Profile saved.');
                        });
                      }}
                    >
                      <label>
                        Profile picture
                        <span className="profile-picture-control">
                          <PlayerAvatar
                            name={profile.name || data.player.name}
                            color={profile.color}
                            image={profile.avatar}
                            anonymous={profile.anonymous}
                            large
                          />
                          <span>
                            <Input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={(e) => {
                                chooseProfilePicture(e.target.files?.[0]);
                                e.currentTarget.value = '';
                              }}
                            />
                            {profile.avatar && (
                              <button
                                type="button"
                                className="secondary compact"
                                onClick={() =>
                                  saveDisplayPrefs({
                                    avatar: '',
                                    anonymous: profile.anonymous,
                                  })
                                }
                              >
                                Remove picture
                              </button>
                            )}
                          </span>
                        </span>
                      </label>
                      <fieldset>
                        <legend>Public name</legend>
                        <RadioGroup
                          className="visibility-picker"
                          value={profile.anonymous ? 'anonymous' : 'visible'}
                          onValueChange={(v) =>
                            saveDisplayPrefs({
                              avatar: profile.avatar,
                              anonymous: v === 'anonymous',
                            })
                          }
                        >
                          <label>
                            <RadioGroupItem
                              value="visible"
                              aria-label="Show my name"
                            />
                            <span>
                              Visible
                              <small>Show your display name.</small>
                            </span>
                          </label>
                          <label>
                            <RadioGroupItem
                              value="anonymous"
                              aria-label="Make my name anonymous"
                            />
                            <span>
                              Anonymous
                              <small>Show Anonymous Player instead.</small>
                            </span>
                          </label>
                        </RadioGroup>
                      </fieldset>
                      <label>
                        Display name
                        <Input
                          required
                          minLength={2}
                          maxLength={32}
                          value={profile.name}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, name: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        Player handle
                        <Input
                          required
                          pattern="[a-zA-Z0-9_]{3,20}"
                          minLength={3}
                          maxLength={20}
                          value={profile.handle}
                          onChange={(e) =>
                            setProfile((p) => ({
                              ...p,
                              handle: e.target.value.toLowerCase(),
                            }))
                          }
                        />
                        <small>
                          3–20 letters, numbers or underscores. Handles are
                          unique.
                        </small>
                      </label>
                      <label>
                        Bio
                        <textarea
                          value={profile.bio}
                          maxLength={160}
                          rows={3}
                          placeholder="A few words about your play style…"
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, bio: e.target.value }))
                          }
                        />
                        <small>{profile.bio.length}/160</small>
                      </label>
                      <fieldset>
                        <legend>Avatar color</legend>
                        <RadioGroup
                          className="color-picker"
                          value={profile.color}
                          onValueChange={(v) =>
                            setProfile((p) => ({ ...p, color: String(v) }))
                          }
                        >
                          {['orange', 'blue', 'purple', 'green', 'pink'].map(
                            (c) => (
                              <label
                                key={c}
                                className={'color-option color-' + c}
                              >
                                <RadioGroupItem value={c} aria-label={c} />
                                <span>{c}</span>
                              </label>
                            ),
                          )}
                        </RadioGroup>
                      </fieldset>
                      <button className="primary" disabled={busy}>
                        {busy ? 'Saving…' : 'Save profile'}
                        <Check size={17} />
                      </button>
                    </form>
                  </section>
                  <div>
                    <section className="account-panel">
                      <h2>YOUR ARENA STATS</h2>
                      <div className="dialog-actions">
                        <a className="secondary compact" href="/ranked">
                          Duel & Arena ratings
                        </a>
                        <a className="secondary compact" href="/inventory">
                          Your cosmetics
                        </a>
                      </div>
                      <div className="profile-stats">
                        <Stat label="MATCHES" value={data.stats.matches} />
                        <Stat label="WINS" value={data.stats.wins} />
                        <Stat label="ELIMINATIONS" value={data.stats.kills} />
                        <Stat
                          label="K / D"
                          value={kd(data.stats.kills, data.stats.deaths)}
                        />
                      </div>
                      <Link className="secondary full" href="/history">
                        View match history
                        <ArrowRight size={16} />
                      </Link>
                    </section>
                    <section className="account-panel account-note">
                      <ShieldCheck size={23} />
                      <h3>Saved to your account</h3>
                      <p>
                        Your profile, match record and friends are linked to
                        your signed-in identity, so they follow you across
                        devices.
                      </p>
                      <button
                        className="secondary full profile-signout"
                        type="button"
                        onClick={() =>
                          void signOutFirebase().then(() =>
                            location.assign('/signin'),
                          )
                        }
                      >
                        Sign out
                        <LogOut size={16} />
                      </button>
                    </section>
                  </div>
                </div>
              </>
            )}
          </>
        )}
        <footer>
          <a href="/rules">Game rules</a>
          <a href="/privacy">Privacy</a>
          <a href="/support">Support</a>
        </footer>
      </main>
      <Dialog
        open={topup}
        onOpenChange={(open) => {
          if (!busy) setTopup(open);
        }}
      >
        <DialogContent className="sc-dialog">
          <DialogTitle>Add funds</DialogTitle>
          <DialogDescription>
            Funding is locked until payments are connected.
          </DialogDescription>
          {failure && <p className="error-text">{failure}</p>}
          <RadioGroup
            value={amount}
            onValueChange={(v) => {
              setAmount(String(v));
              topupKey.current = '';
            }}
            className="topup-choices"
          >
            {[2000, 5000, 10000].map((a) => (
              <label key={a} className={amount === String(a) ? 'selected' : ''}>
                <RadioGroupItem value={String(a)} disabled={busy} />
                <b>{euro(a)}</b>
              </label>
            ))}
          </RadioGroup>
          <p>Deposits and withdrawals are not enabled yet.</p>
          <button
            className="primary"
            disabled
          >
            Funding unavailable
            <Plus size={17} />
          </button>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirmRemove}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmRemove(null);
        }}
      >
        <AlertDialogContent className="sc-dialog">
          <AlertDialogTitle>Remove {confirmRemove?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            You can send a new friend request later.
          </AlertDialogDescription>
          {failure && <p className="error-text">{failure}</p>}
          <div className="dialog-actions">
            <AlertDialogCancel disabled={busy}>Keep friend</AlertDialogCancel>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                confirmRemove &&
                void friendAction('friend_remove', confirmRemove)
              }
            >
              {busy ? 'Removing…' : 'Remove friend'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!showPlayer}
        onOpenChange={(open) => {
          if (!open) setShowPlayer(null);
        }}
      >
        <DialogContent className="sc-dialog">
          {showPlayer && (
            <>
              <div className="profile-popup-head">
                <PlayerAvatar
                  name={showPlayer.player.name}
                  color={showPlayer.player.color}
                  large
                />
                <div>
                  <DialogTitle>{showPlayer.player.name}</DialogTitle>
                  <DialogDescription>
                    @{showPlayer.player.handle}
                  </DialogDescription>
                </div>
              </div>
              <p>
                {showPlayer.player.bio ||
                  'This player has not added a bio yet.'}
              </p>
              <div className="profile-stats">
                <Stat label="MATCHES" value={showPlayer.stats.matches} />
                <Stat label="WINS" value={showPlayer.stats.wins} />
                <Stat label="ELIMINATIONS" value={showPlayer.stats.kills} />
                <Stat
                  label="K / D"
                  value={kd(showPlayer.stats.kills, showPlayer.stats.deaths)}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selectedMatch}
        onOpenChange={(open) => {
          if (!open) setSelectedMatch(null);
        }}
      >
        <DialogContent className="sc-dialog">
          <DialogTitle>
            {selectedMatch && modeName(selectedMatch.mode, selectedMatch.team)}
          </DialogTitle>
          <DialogDescription>
            {getMap(selectedMatch?.map_id).name} · Match ·{' '}
            {selectedMatch && dateLabel(selectedMatch.started_at)}
          </DialogDescription>
          {selectedMatch && (
            <>
              <span
                className={'table-badge ' + (selectedMatch.won ? 'win' : '')}
              >
                {selectedMatch.reason}
              </span>
              <div className="profile-stats">
                <Stat label="ELIMINATIONS" value={selectedMatch.kills} />
                <Stat label="DEATHS" value={selectedMatch.deaths} />
                <Stat
                  label="TEAM SCORE"
                  value={`${selectedMatch.score} : ${selectedMatch.enemy_score}`}
                />
                <Stat label="NET CREDITS" value={euro(selectedMatch.delta)} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <b className={String(value).startsWith('-') ? 'negative' : undefined}>
        {value}
      </b>
    </div>
  );
}
