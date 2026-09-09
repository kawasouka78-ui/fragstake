'use client';
import { useCallback, useEffect, useState } from 'react';
type Status = { online: boolean; players: number; region: string };
export function useLiveStatus(enabled: boolean) {
  const [status, setStatus] = useState<Status | null>(null),
    [checking, setChecking] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setChecking(true);
    try {
      const response = await fetch('/api/live', {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(4000)])
          : AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error();
      const value = (await response.json()) as Status;
      if (!signal?.aborted) setStatus(value);
    } catch {
      if (!signal?.aborted)
        setStatus({ online: false, players: 0, region: 'unavailable' });
    } finally {
      if (!signal?.aborted) setChecking(false);
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = setInterval(() => {
      if (!document.hidden) void refresh(controller.signal);
    }, 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [enabled, refresh]);
  return { status, checking, refresh: () => refresh() };
}
