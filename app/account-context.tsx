'use client';
import { requestAccount, AccountRequestError } from '@/lib/account-client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { onFirebaseUserChange } from '@/lib/firebase-client';
import type { Player, MatchRow } from '@/db/service';
export type Summary = {
  matches: number;
  kills: number;
  deaths: number;
  wins: number;
  net: number;
  headshots?: number;
  maxStreak?: number;
};
export type Transaction = {
  id: string;
  kind: string;
  amount: number;
  label: string;
  created_at: number;
  match_id: string | null;
};
export type AccountData = {
  player: Player;
  stats: Summary;
  transactions: Transaction[];
  matches: MatchRow[];
  active: MatchRow | null;
  pending: number;
};
export type ProfilePrefs = {
  avatar: string;
  anonymous: boolean;
};
const defaultProfilePrefs: ProfilePrefs = { avatar: '', anonymous: false };
const profilePrefsKey = 'fragstake-profile-prefs';
function readProfilePrefs() {
  if (typeof localStorage === 'undefined') return defaultProfilePrefs;
  try {
    const saved = JSON.parse(localStorage.getItem(profilePrefsKey) ?? '{}');
    return {
      avatar: typeof saved.avatar === 'string' ? saved.avatar : '',
      anonymous: saved.anonymous === true,
    };
  } catch {
    return defaultProfilePrefs;
  }
}
export function accountApi<T = AccountData>(
  body?: Record<string, unknown>,
  query = '',
): Promise<T> {
  return requestAccount<T>(body, query);
}
const Context = createContext<{
  data: AccountData | null;
  loading: boolean;
  error: string;
  profilePrefs: ProfilePrefs;
  refresh: () => Promise<void>;
  saveProfilePrefs: (v: ProfilePrefs) => void;
  update: (v: AccountData) => void;
}>({
  data: null,
  loading: true,
  error: '',
  profilePrefs: defaultProfilePrefs,
  refresh: async () => {},
  saveProfilePrefs: () => {},
  update: () => {},
});
export function AccountProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AccountData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [profilePrefs, setProfilePrefs] =
      useState<ProfilePrefs>(defaultProfilePrefs);
  const saveProfilePrefs = useCallback((next: ProfilePrefs) => {
    setProfilePrefs(next);
    localStorage.setItem(profilePrefsKey, JSON.stringify(next));
  }, []);
  const refresh = useCallback(async () => {
    try {
      setData(await accountApi());
      setError('');
    } catch (e) {
      if (e instanceof AccountRequestError && e.status === 401) {
        setData(null);
        setError('');
      } else {
        setData(null);
        setError(
          e instanceof Error ? e.message : 'Account unavailable. Please retry.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setProfilePrefs(readProfilePrefs());
  }, []);
  useEffect(() => {
    const unsubscribe = onFirebaseUserChange(() => void refresh());
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 45000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [refresh]);
  return (
    <Context.Provider
      value={{
        data,
        loading,
        error,
        profilePrefs,
        refresh,
        saveProfilePrefs,
        update: setData,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAccount() {
  return useContext(Context);
}
export const euro = (cents: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );
export const dateLabel = (ms: number) =>
  new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(ms));
