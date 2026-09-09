'use client';
import { useEffect, useState } from 'react';
import { Radio, ArrowRight, Users, RefreshCw } from 'lucide-react';
import type { MatchConfig } from '@/lib/game-rules';
import { maps, type MapId } from '@/lib/fps/maps';
export default function LiveMatchmaking({
  mapId,
  onJoin,
  onMapChange,
}: {
  mapId: string;
  onJoin: (config: MatchConfig) => void;
  onMapChange: (id: MapId) => void;
}) {
  const [mode, setMode] = useState<'ffa' | '1v1' | '2v2'>('ffa'),
    [status, setStatus] = useState<{
      online: boolean;
      players: number;
      region: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function refresh() {
    try {
      const r = await fetch('/api/live');
      if (!r.ok) throw new Error();
      setStatus(await r.json());
    } catch {
      setStatus({ online: false, players: 0, region: 'unavailable' });
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, []);
  async function join() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, mapId }),
      });
      const value = (await r.json()) as {
        error?: string;
        ticket: string;
        url: string;
        guest: boolean;
      };
      if (!r.ok) throw new Error(value.error);
      onJoin({
        mode: 'practice',
        mapId,
        team: mode === '2v2' ? '2v2' : '1v1',
        rate: 0,
        balance: 0,
        live: { ...value, mode },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="live-matchmaking" aria-label="Live multiplayer">
      <div className="live-heading">
        <div>
          <span className="eyebrow">
            <Radio size={14} /> HUMAN MULTIPLAYER
          </span>
          <h2>MEET YOUR NEXT RIVAL.</h2>
          <p>Free matches. Real players. Shared arena.</p>
        </div>
        <span className="live-connection">
          <i className={status?.online ? 'online' : ''} />
          {status?.online
            ? `${status.players} connected · ${status.region}`
            : status
              ? 'Server offline'
              : 'Checking server…'}
          <button
            aria-label="Refresh live server"
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} />
          </button>
        </span>
      </div>
      <label className="live-map-select">
        LIVE MAP
        <select
          aria-label="Live match map"
          value={mapId}
          onChange={(e) => onMapChange(e.target.value as MapId)}
        >
          {maps.map((map) => (
            <option value={map.id} key={map.id}>
              {map.name} · {map.width} × {map.depth} m
            </option>
          ))}
        </select>
      </label>
      <div className="live-queue-controls">
        <div className="live-formats">
          {(['ffa', '1v1', '2v2'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={mode === value}
              className={mode === value ? 'selected' : ''}
              onClick={() => setMode(value)}
            >
              <Users size={19} />
              <b>{value === 'ffa' ? '10-player FFA' : value + ' duel'}</b>
              <small>
                {value === 'ffa'
                  ? 'Starts with 2 players'
                  : 'Starts when everyone is ready'}
              </small>
            </button>
          ))}
        </div>
        <button
          className="primary"
          disabled={busy || !status?.online}
          onClick={() => void join()}
        >
          {busy ? 'CONNECTING…' : 'JOIN LIVE MATCH'}
          <ArrowRight size={17} />
        </button>
      </div>
      <p className="live-note">
        Guests can play. Sign in to save verified results and earn XP. No entry
        fee or cash prizes.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
