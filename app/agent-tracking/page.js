'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';

// Matches the mobile app's formatting exactly. Dropping the seconds below an
// hour made a 2m 11s session read as "2m" here while the phone said "2m 11s",
// which looks like the two disagree when they don't.
function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours === 0 && minutes === 0) return `${seconds}s`;
  if (hours === 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

const formatSeconds = (seconds) => formatDuration((seconds || 0) * 1000);

const karachiToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

function shiftDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(iso) {
  return `${iso.slice(0, 7)}-01`;
}

function formatClock(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'Asia/Karachi',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDay(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  });
}

function weekdayOf(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
  });
}

function Stat({ label, value, accent }) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-lg px-4 py-3">
      <div className={`text-xl font-bold leading-none mb-1 ${accent || 'text-white'}`}>{value}</div>
      <div className="text-[10px] text-dim font-medium uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function AgentTracking() {
  const today = karachiToday();
  const [range, setRange] = useState({ from: shiftDays(today, -6), to: today });
  const [data, setData] = useState({ agents: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const presets = useMemo(
    () => [
      { label: 'Today', from: today, to: today },
      { label: 'Yesterday', from: shiftDays(today, -1), to: shiftDays(today, -1) },
      { label: 'Last 7 days', from: shiftDays(today, -6), to: today },
      { label: 'This month', from: startOfMonth(today), to: today },
      { label: 'Last 30 days', from: shiftDays(today, -29), to: today },
    ],
    [today]
  );

  const load = useCallback(async ({ from, to }) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/agent-tracking?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load agent tracking');
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message);
      setData({ agents: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const activePreset = presets.find((p) => p.from === range.from && p.to === range.to)?.label;

  const controls = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <div className="header-btn h-10 flex items-center px-3 gap-1.5 text-xs text-gray-300">
        <span className="material-symbols-outlined text-[15px] text-dim">calendar_today</span>
        <input
          type="date"
          value={range.from}
          max={range.to}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          className="bg-transparent outline-none [color-scheme:dark]"
        />
        <span className="text-dim">–</span>
        <input
          type="date"
          value={range.to}
          min={range.from}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          className="bg-transparent outline-none [color-scheme:dark]"
        />
      </div>
      <button
        onClick={() => load(range)}
        disabled={loading}
        title="Refresh"
        className="header-btn w-10 h-10 flex items-center justify-center text-muted hover:text-white disabled:opacity-50"
      >
        <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
          refresh
        </span>
      </button>
    </div>
  );

  return (
    <AppShell title="Agent Tracking" search={controls}>
      <div className="flex flex-col gap-5 text-[13px]">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Agent Tracking</h1>
            <p className="text-dim text-[11px]">
              Work sessions from the mobile app, with the calls made inside each one.
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setRange({ from: p.from, to: p.to })}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                  activePreset === p.label
                    ? 'bg-brand-green/15 text-brand-green border-brand-green/40'
                    : 'bg-black/20 text-muted border-white/10 hover:text-white hover:border-white/20'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="glass-card border-brand-red/30 text-brand-red p-4 text-center text-xs">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted py-16">Loading…</div>
        ) : data.agents.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <h2 className="text-lg font-semibold text-white mb-2">
              Nothing recorded in this period
            </h2>
            <p className="text-muted text-xs">
              Sessions appear once an agent taps Start on the mobile app and makes calls.
            </p>
          </div>
        ) : (
          data.agents.map((a) => (
            <div key={a.email || a.agent} className="glass-card p-5 flex flex-col gap-4">
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">{a.agent}</h3>
                  <p className="text-[11px] text-dim">{a.email}</p>
                </div>
                {a.totals.untrackedCalls > 0 && (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-brand-orange/10 text-brand-orange border border-brand-orange/25">
                    {a.totals.untrackedCalls} call{a.totals.untrackedCalls === 1 ? '' : 's'} outside
                    any session
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Stat label="Days worked" value={a.totals.daysWorked} />
                <Stat
                  label="Worked (excl. breaks)"
                  value={formatDuration(a.totals.workedMs)}
                  accent="text-brand-green"
                />
                <Stat
                  label="On break"
                  value={formatDuration(a.totals.breakMs)}
                  accent="text-brand-orange"
                />
                <Stat label="Calls made" value={a.totals.calls} />
                <Stat label="Leads covered" value={a.totals.leads} />
                <Stat
                  label="Talk time"
                  value={formatSeconds(a.totals.talkSeconds)}
                  accent="text-brand-blue"
                />
              </div>

              {a.sessions.length === 0 ? (
                <p className="text-[11px] text-dim">
                  No session recorded — these calls were made without clocking in.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[680px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-dim border-b border-white/10">
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 pr-4 font-medium">Started</th>
                        <th className="py-2 pr-4 font-medium">Ended</th>
                        <th className="py-2 pr-4 font-medium">Worked</th>
                        <th className="py-2 pr-4 font-medium">Break</th>
                        <th className="py-2 pr-4 font-medium text-right">Calls</th>
                        <th className="py-2 pr-4 font-medium text-right">Leads</th>
                        <th className="py-2 font-medium text-right">Talk time</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {a.sessions.map((s, i) => {
                        // Only label the first session of each day, so several
                        // shifts in one day read as one block.
                        const newDay = i === 0 || a.sessions[i - 1].date !== s.date;
                        return (
                          <tr
                            key={`${s.startedAt}-${i}`}
                            className={`border-b border-white/5 last:border-0 ${
                              newDay && i !== 0 ? 'border-t border-t-white/10' : ''
                            }`}
                          >
                            <td className="py-2.5 pr-4 whitespace-nowrap">
                              {newDay ? (
                                <span className="font-semibold text-white">
                                  {formatDay(s.date)}{' '}
                                  <span className="text-dim font-normal">{weekdayOf(s.date)}</span>
                                </span>
                              ) : (
                                <span className="text-dim">↳ same day</span>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 tabular-nums whitespace-nowrap">
                              {formatClock(s.startedAt)}
                              {s.openEnded && (
                                <span className="ml-2 text-[10px] text-brand-orange">
                                  never ended
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 tabular-nums whitespace-nowrap">
                              {s.inProgress ? (
                                <span className="text-brand-green">running</span>
                              ) : (
                                formatClock(s.endedAt)
                              )}
                            </td>
                            <td className="py-2.5 pr-4 tabular-nums">
                              {formatDuration(s.workedMs)}
                            </td>
                            <td className="py-2.5 pr-4 tabular-nums">
                              {s.breakMs > 0 ? `${formatDuration(s.breakMs)} (${s.breaks})` : '—'}
                            </td>
                            <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-white">
                              {s.calls}
                            </td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{s.leads}</td>
                            <td className="py-2.5 text-right tabular-nums">
                              {formatSeconds(s.talkSeconds)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
