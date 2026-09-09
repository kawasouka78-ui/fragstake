'use client';
import { useEffect, useState } from 'react';
import SiteHeader from '../site-header';
import '../live-platform.css';
export default function Moderation() {
  const [reports, setReports] = useState<any[]>([]),
    [error, setError] = useState(''),
    [note, setNote] = useState(''),
    [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(false);
  async function load(body?: object) {
    const r = await fetch(
      '/api/moderation',
      body
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : undefined,
    );
    const v = (await r.json()) as { error?: string; reports: any[] };
    if (!r.ok) throw new Error(v.error);
    setReports(v.reports);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function update(status: string) {
    setBusy(true);
    try {
      await load({ id: selected, note, status });
      setSelected('');
      setNote('');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="main">
        <div className="page-heading">
          <div>
            <span className="eyebrow">PLAYER SUPPORT</span>
            <h1>
              MODERATION QUEUE<span>.</span>
            </h1>
          </div>
        </div>
        {error && <p role="alert">{error}</p>}
        {reports.map((r) => (
          <article className="account-panel" key={r.id}>
            <span className="table-badge">{r.status}</span>
            <h2>
              {r.category} · @{r.handle}
            </h2>
            <p>{r.details}</p>
            <small>Match: {r.match_id || 'None'}</small>
            <button className="secondary" onClick={() => setSelected(r.id)}>
              Review report
            </button>
            {selected === r.id && (
              <div className="platform-fields">
                <label>
                  Review note
                  <textarea
                    minLength={5}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <div className="live-review-actions">
                  {['reviewing', 'resolved', 'dismissed'].map((status) => (
                    <button
                      key={status}
                      className="secondary"
                      disabled={busy || note.trim().length < 5}
                      onClick={() => void update(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
      </main>
    </div>
  );
}
