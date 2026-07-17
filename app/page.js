"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AppShell from './components/AppShell';

const CONVERTED_STATUSES = ['Confirmation', 'Paid', 'Demo'];
const TERMINAL_STATUSES = ['Client Lost', 'Confirmation', 'Paid', 'Demo'];
const ATTEMPT_BUCKETS = ['1', '2', '3', '4+'];
const ATTEMPT_MILESTONES = [1, 2, 3, 4];
const DAY_MS = 24 * 60 * 60 * 1000;

// "Still needed" milestones for the Leads by Attempts cards: how many in-range
// leads haven't yet reached N attempts and don't already have a terminal status
// (so a lead that closed out — lost/confirmed/paid/demo'd — stops counting
// against every later milestone, not just the ones it already passed).
const ATTEMPTS_NEEDED_META = {
  1: { label: '1st Attempt', accent: 'primary' },
  2: { label: '2nd Attempt', accent: 'secondary' },
  3: { label: '3rd Attempt', accent: 'info' },
  4: { label: '4th Attempt', accent: 'tertiary' },
};

const INSTALLMENT_BATCHES = ['ep-40', 'ep-41', 'ep-42'];
const INSTALLMENT_BATCH_META = {
  'ep-40': { label: 'EP-40', accent: 'primary' },
  'ep-41': { label: 'EP-41', accent: 'secondary' },
  'ep-42': { label: 'EP-42', accent: 'info' },
};

const INSTALLMENT_ORDINALS = ['1st', '2nd', '3rd', '4th'];
const INSTALLMENT_ORDINAL_LABELS = {
  '1st': '1st Installment',
  '2nd': '2nd Installment',
  '3rd': '3rd Installment',
  '4th': '4th Installment',
};

function emptyInstallmentCounts() {
  return { paid: 0, notPaying: 0, pending: 0 };
}

function emptyBatchCounts() {
  return {
    ...emptyInstallmentCounts(),
    byOrdinal: INSTALLMENT_ORDINALS.reduce((acc, key) => {
      acc[key] = emptyInstallmentCounts();
      return acc;
    }, {}),
  };
}

const ICON_SOLID_CLASSES = {
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-secondary text-on-secondary',
  info: 'bg-info text-on-info',
  tertiary: 'bg-tertiary text-on-tertiary',
};

const TEXT_ACCENT_CLASSES = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  info: 'text-info',
  tertiary: 'text-tertiary',
};

const BAR_SOLID_CLASSES = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  info: 'bg-info',
  tertiary: 'bg-tertiary',
};

const PRESET_OPTIONS = [
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last15', label: 'Last 15 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'allTime', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

function emptyBucketStats() {
  return ATTEMPT_BUCKETS.reduce((acc, bucket) => {
    acc[bucket] = { total: 0, converted: 0 };
    return acc;
  }, {});
}

// Sheet dates are written as DD/MM/YYYY; date inputs give YYYY-MM-DD. Handle both.
function parseLeadDate(value) {
  if (!value) return null;
  const str = value.toString().trim();
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPresetRange(preset) {
  const today = startOfDay(new Date());
  const end = today;
  let start;
  switch (preset) {
    case 'last7':
      start = new Date(today);
      start.setDate(start.getDate() - 6);
      break;
    case 'last15':
      start = new Date(today);
      start.setDate(start.getDate() - 14);
      break;
    case 'last30':
      start = new Date(today);
      start.setDate(start.getDate() - 29);
      break;
    case 'thisMonth':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    default:
      return null;
  }
  return { start, end };
}

function getPreviousRange(range) {
  if (!range || !range.start || !range.end) return null;
  const spanMs = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - DAY_MS);
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  return { start: prevStart, end: prevEnd };
}

function formatRangeLabel(range, preset) {
  if (preset === 'allTime' || !range || !range.start || !range.end) return 'All Time';
  const opts = { month: 'short', day: 'numeric' };
  const startStr = range.start.toLocaleDateString('en-US', opts);
  const endStr = range.end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function calcDelta(current, previous) {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function niceCeil(v) {
  if (v <= 10) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const step = mag / 2;
  return Math.ceil(v / step) * step;
}

function computeStatsForRange(leads, range) {
  const relevant = range
    ? leads.filter((lead) => {
        const d = parseLeadDate(lead[1]);
        return d && d >= range.start && d <= range.end;
      })
    : leads;

  const bucketStats = emptyBucketStats();
  const attemptsNeeded = ATTEMPT_MILESTONES.reduce((acc, n) => {
    acc[n] = 0;
    return acc;
  }, {});
  let confirmations = 0;
  let paid = 0;
  let demo = 0;

  relevant.forEach((lead) => {
    const status = (lead[6] || '').trim();
    if (status === 'Confirmation') confirmations++;
    if (status === 'Paid') paid++;
    if (status === 'Demo') demo++;

    const attempts = parseInt(lead[11], 10) || 0;

    if (!TERMINAL_STATUSES.includes(status)) {
      ATTEMPT_MILESTONES.forEach((n) => {
        if (attempts < n) attemptsNeeded[n]++;
      });
    }

    if (attempts < 1) return;
    const bucket = attempts >= 4 ? '4+' : String(attempts);
    bucketStats[bucket].total++;
    if (CONVERTED_STATUSES.includes(status)) {
      bucketStats[bucket].converted++;
    }
  });

  return { totalLeads: relevant.length, confirmations, paid, demo, bucketStats, attemptsNeeded };
}

// Build an actual time series (bucketed by day / week / month over the span) so the
// chart reflects real data instead of a decorative shape.
function buildTimeSeries(leads, range) {
  const rows = leads
    .map((l) => ({ date: parseLeadDate(l[1]), status: (l[6] || '').trim() }))
    .filter((r) => r.date);
  if (!rows.length) return { points: [], niceMax: 10 };

  let start;
  let end;
  if (range && range.start && range.end) {
    start = startOfDay(range.start);
    end = startOfDay(range.end);
  } else {
    const times = rows.map((r) => r.date.getTime());
    start = startOfDay(new Date(Math.min(...times)));
    end = startOfDay(new Date(Math.max(...times)));
  }

  const spanDays = Math.max(1, Math.round((end - start) / DAY_MS));
  let unit;
  if (spanDays <= 24) unit = 'day';
  else if (spanDays <= 132) unit = 'week';
  else unit = 'month';

  const buckets = [];
  if (unit === 'month') {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      buckets.push({ start: new Date(cursor), total: 0, converted: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    const step = unit === 'week' ? 7 : 1;
    const cursor = new Date(start);
    while (cursor <= end) {
      buckets.push({ start: new Date(cursor), total: 0, converted: 0 });
      cursor.setDate(cursor.getDate() + step);
    }
  }
  if (!buckets.length) buckets.push({ start: new Date(start), total: 0, converted: 0 });

  const firstStart = buckets[0].start;
  const firstMs = firstStart.getTime();
  const idxOf = (d) => {
    if (unit === 'month') {
      return (d.getFullYear() - firstStart.getFullYear()) * 12 + (d.getMonth() - firstStart.getMonth());
    }
    const step = unit === 'week' ? 7 : 1;
    return Math.floor((startOfDay(d).getTime() - firstMs) / (step * DAY_MS));
  };

  rows.forEach((r) => {
    if (r.date < start || r.date > end) return;
    const i = idxOf(r.date);
    if (i < 0 || i >= buckets.length) return;
    buckets[i].total++;
    if (CONVERTED_STATUSES.includes(r.status)) buckets[i].converted++;
  });

  const labelFmt = (d) =>
    unit === 'month'
      ? d.toLocaleDateString('en-US', { month: 'short' })
      : `${d.getMonth() + 1}/${d.getDate()}`;

  const points = buckets.map((b) => ({ label: labelFmt(b.start), total: b.total, converted: b.converted }));
  const maxTotal = Math.max(1, ...points.map((p) => p.total));
  return { points, niceMax: niceCeil(maxTotal) };
}

// Monotone cubic (Fritsch–Carlson): smooth curve that never overshoots its data
// points, so peaks stay pinned to real values — a curve, not a wave.
function monotonePath(pts, close) {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i] || 0.0001;
    slope[i] = (ys[i + 1] - ys[i]) / dx[i];
  }
  const m = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) m[i] = 0;
    else m[i] = (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slope[i];
      const b = m[i + 1] / slope[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        const t = 3 / h;
        m[i] = t * a * slope[i];
        m[i + 1] = t * b * slope[i];
      }
    }
  }
  let d = `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const x1 = xs[i] + dx[i] / 3;
    const y1 = ys[i] + (m[i] * dx[i]) / 3;
    const x2 = xs[i + 1] - dx[i] / 3;
    const y2 = ys[i + 1] - (m[i + 1] * dx[i]) / 3;
    d += ` C${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1].toFixed(2)}`;
  }
  if (close) {
    d += ` L${xs[n - 1].toFixed(2)},100 L${xs[0].toFixed(2)},100 Z`;
  }
  return d;
}

function AnimatedNumber({ value, duration = 700 }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      fromRef.current = current;
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

function DeltaBadge({ delta, size = 'md' }) {
  if (delta === null) return null;
  const positive = delta >= 0;
  const textSize = size === 'sm' ? 'text-label-sm' : 'text-label-md';
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${textSize} ${positive ? 'text-secondary' : 'text-error'}`}>
      <span className="material-symbols-outlined text-[15px]">{positive ? 'trending_up' : 'trending_down'}</span>
      {positive ? '+' : ''}
      {delta}%
    </span>
  );
}

function LeadsAreaChart({ points, niceMax }) {
  const [hover, setHover] = useState(null);
  const plotRef = useRef(null);

  if (points.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-on-surface-variant text-body-md">
        Not enough data in this range to plot a trend.
      </div>
    );
  }

  const n = points.length;
  const xPct = (i) => (i / (n - 1)) * 100;
  const yPct = (v) => (1 - v / niceMax) * 100;
  const toXY = (key) => points.map((p, i) => ({ x: xPct(i), y: yPct(p[key]) }));

  const totalXY = toXY('total');
  const convertedXY = toXY('converted');

  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(niceMax * f));
  const labelStep = Math.max(1, Math.ceil(n / 8));

  const handleMove = (e) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
    setHover(idx);
  };

  const hoverPoint = hover !== null ? points[hover] : null;
  const hoverX = hover !== null ? xPct(hover) : 0;
  const tooltipTranslate = hoverX > 65 ? '-100%' : hoverX < 15 ? '0%' : '-50%';

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between h-64 w-7 text-right text-label-sm text-on-surface-variant">
        {yTicks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div
          ref={plotRef}
          className="relative h-64 cursor-crosshair"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {yTicks.map((_, i) => (
              <div key={i} className="border-t border-dashed border-outline-variant/40" />
            ))}
          </div>

          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="areaTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="areaConverted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity="0.30" />
                <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="animate-fade-in" d={monotonePath(totalXY, true)} fill="url(#areaTotal)" />
            <path className="animate-fade-in" d={monotonePath(convertedXY, true)} fill="url(#areaConverted)" />
            <path
              className="animate-draw-line"
              pathLength="1"
              d={monotonePath(totalXY, false)}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              className="animate-draw-line"
              pathLength="1"
              d={monotonePath(convertedXY, false)}
              fill="none"
              stroke="var(--color-secondary)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          {hover !== null && (
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute top-0 bottom-0 w-px bg-outline/70"
                style={{ left: `${hoverX}%` }}
              />
              <div
                className="absolute w-3 h-3 rounded-full bg-primary ring-2 ring-surface-container transition-all duration-150"
                style={{ left: `${hoverX}%`, top: `${yPct(hoverPoint.total)}%`, transform: 'translate(-50%,-50%)' }}
              />
              <div
                className="absolute w-3 h-3 rounded-full bg-secondary ring-2 ring-surface-container transition-all duration-150"
                style={{ left: `${hoverX}%`, top: `${yPct(hoverPoint.converted)}%`, transform: 'translate(-50%,-50%)' }}
              />
              <div
                className="absolute top-1 bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 shadow-lg text-left"
                style={{ left: `${hoverX}%`, transform: `translateX(${tooltipTranslate})` }}
              >
                <div className="text-label-sm text-on-surface-variant mb-1 whitespace-nowrap">{hoverPoint.label}</div>
                <div className="flex items-center gap-2 text-label-md text-on-surface whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Total: {hoverPoint.total}
                </div>
                <div className="flex items-center gap-2 text-label-md text-on-surface whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-secondary" /> Converted: {hoverPoint.converted}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex mt-2 text-label-sm text-on-surface-variant">
          {points.map((p, i) => (
            <span key={i} className="flex-1 text-center truncate">
              {i % labelStep === 0 || i === n - 1 ? p.label : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allLeads, setAllLeads] = useState([]);
  const [installmentStats, setInstallmentStats] = useState({
    pending: 0,
    paid: 0,
    notPaying: 0,
    byBatch: INSTALLMENT_BATCHES.reduce((acc, key) => {
      acc[key] = emptyBatchCounts();
      return acc;
    }, {}),
  });
  const [preset, setPreset] = useState('last15');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [prettyRes, kainatRes, installmentsRes] = await Promise.all([
        fetch('/api/fetch-leads?sheetName=Pretty'),
        fetch('/api/fetch-leads?sheetName=Kainat'),
        fetch('/api/fetch-installments'),
      ]);

      const prettyLeads = prettyRes.ok ? await prettyRes.json() : [];
      const kainatLeads = kainatRes.ok ? await kainatRes.json() : [];
      setAllLeads([...prettyLeads, ...kainatLeads]);

      if (installmentsRes.ok) {
        setInstallmentStats(await installmentsRes.json());
      }
    } catch (err) {
      console.error('Error loading dashboard analytics:', err);
      setError('Failed to load some analytics. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeRange = useMemo(() => {
    if (preset === 'custom') {
      const start = customRange.start ? parseLeadDate(customRange.start) : null;
      const end = customRange.end ? parseLeadDate(customRange.end) : null;
      if (!start && !end) return null;
      return { start: start || new Date(0), end: end || startOfDay(new Date()) };
    }
    return getPresetRange(preset);
  }, [preset, customRange]);

  const previousRange = useMemo(() => getPreviousRange(activeRange), [activeRange]);

  const stats = useMemo(() => computeStatsForRange(allLeads, activeRange), [allLeads, activeRange]);
  const previousStats = useMemo(
    () => (previousRange ? computeStatsForRange(allLeads, previousRange) : null),
    [allLeads, previousRange]
  );
  const timeSeries = useMemo(() => buildTimeSeries(allLeads, activeRange), [allLeads, activeRange]);

  const heroDelta = previousStats ? calcDelta(stats.totalLeads, previousStats.totalLeads) : null;

  const maxBucketTotal = Math.max(1, ...ATTEMPT_BUCKETS.map((b) => stats.bucketStats[b].total));
  const niceMaxBars = Math.max(10, Math.ceil(maxBucketTotal / 10) * 10);
  const barTicks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(niceMaxBars * f));

  const rangeLabel = formatRangeLabel(activeRange, preset);
  const chartKey = `${rangeLabel}:${timeSeries.points.length}:${timeSeries.points.reduce((s, p) => s + p.total, 0)}`;

  const topCards = [
    { label: 'Total Leads', value: stats.totalLeads, delta: heroDelta, icon: 'group', accent: 'primary' },
    {
      label: 'Confirmations',
      value: stats.confirmations,
      delta: previousStats ? calcDelta(stats.confirmations, previousStats.confirmations) : null,
      icon: 'verified',
      accent: 'secondary',
    },
    {
      label: 'Paid',
      value: stats.paid,
      delta: previousStats ? calcDelta(stats.paid, previousStats.paid) : null,
      icon: 'payments',
      accent: 'tertiary',
    },
    {
      label: 'Demo',
      value: stats.demo,
      delta: previousStats ? calcDelta(stats.demo, previousStats.demo) : null,
      icon: 'co_present',
      accent: 'info',
    },
  ];

  return (
    <AppShell title="Dashboard">
      <div className="flex flex-col gap-6">
        {/* Banner + date range control */}
        <div className="bg-surface-container rounded-xl border border-outline-variant p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-headline-md font-bold text-on-surface">DataCrumbs Sales Portal</h1>
            <p className="text-body-md text-on-surface-variant mt-1">Internal Sales Management System</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">calendar_today</span>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="bg-transparent text-body-md text-on-surface outline-none pr-1"
              >
                {PRESET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-surface-container-high">
                    {opt.label}
                  </option>
                ))}
              </select>
              {preset === 'custom' ? (
                <>
                  <input
                    type="date"
                    value={customRange.start}
                    onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
                    className="bg-transparent text-body-md text-on-surface outline-none [color-scheme:dark]"
                  />
                  <span className="text-on-surface-variant">–</span>
                  <input
                    type="date"
                    value={customRange.end}
                    onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
                    className="bg-transparent text-body-md text-on-surface outline-none [color-scheme:dark]"
                  />
                </>
              ) : (
                <span className="text-label-sm text-on-surface-variant ml-1 whitespace-nowrap">{rangeLabel}</span>
              )}
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh data"
              className="p-2.5 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-error-container/20 text-error border border-error/30 rounded-lg p-4 text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-on-surface-variant py-16">Loading analytics...</div>
        ) : (
          <>
            {/* Top KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {topCards.map((card, i) => (
                <div
                  key={card.label}
                  className="animate-fade-up bg-surface-container rounded-xl border border-outline-variant p-5 transition-transform hover:-translate-y-1"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-label-md text-on-surface-variant uppercase tracking-wide truncate">
                        {card.label}
                      </div>
                      <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
                        <span className="text-headline-md font-bold text-on-surface">
                          <AnimatedNumber value={card.value} />
                        </span>
                        <DeltaBadge delta={card.delta} size="sm" />
                      </div>
                    </div>
                    <span className={`w-11 h-11 shrink-0 rounded-lg flex items-center justify-center ${ICON_SOLID_CLASSES[card.accent]}`}>
                      <span className="material-symbols-outlined text-[22px]">{card.icon}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Main chart row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Leads overview area chart */}
              <div
                className="animate-fade-up lg:col-span-2 bg-gradient-to-br from-primary-container/10 to-surface-container rounded-xl border border-outline-variant p-6"
                style={{ animationDelay: '120ms' }}
              >
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-headline-sm font-semibold text-on-surface">Leads Overview</h3>
                  <span className="text-label-sm text-on-surface-variant">{rangeLabel}</span>
                </div>
                {heroDelta !== null ? (
                  <p className="text-label-md mb-5">
                    <span className={heroDelta >= 0 ? 'text-secondary font-semibold' : 'text-error font-semibold'}>
                      {heroDelta >= 0 ? '+' : ''}
                      {heroDelta}%
                    </span>{' '}
                    <span className="text-on-surface-variant">vs previous period</span>
                  </p>
                ) : (
                  <p className="text-label-md text-on-surface-variant mb-5">Leads over time</p>
                )}
                <LeadsAreaChart key={chartKey} points={timeSeries.points} niceMax={timeSeries.niceMax} />
                <div className="flex items-center gap-6 mt-4 pl-10">
                  <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                    <span className="w-3 h-3 rounded-full bg-primary" /> Total Leads
                  </span>
                  <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                    <span className="w-3 h-3 rounded-full bg-secondary" /> Converted
                  </span>
                </div>
              </div>

              {/* Conversion by attempts */}
              <div
                className="animate-fade-up bg-surface-container rounded-xl border border-outline-variant p-6 flex flex-col"
                style={{ animationDelay: '190ms' }}
              >
                <h3 className="text-headline-sm font-semibold text-on-surface mb-5">Conversion by Attempts</h3>
                <div className="flex-1 flex gap-2 min-h-56">
                  <div className="flex flex-col justify-between w-6 text-right text-label-sm text-on-surface-variant">
                    {barTicks.map((t, i) => (
                      <span key={i}>{t}</span>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="relative flex-1">
                      <div className="absolute inset-0 flex flex-col justify-between">
                        {barTicks.map((_, i) => (
                          <div key={i} className="border-t border-dashed border-outline-variant/40" />
                        ))}
                      </div>
                      <div className="relative grid grid-cols-4 items-end gap-4 h-full">
                        {ATTEMPT_BUCKETS.map((bucket, bi) => {
                          const { total, converted } = stats.bucketStats[bucket];
                          return (
                            <div key={bucket} className="flex items-end justify-center gap-2 h-full">
                              <div className="flex-1 max-w-14 flex flex-col items-center justify-end h-full">
                                {total > 0 && <span className="text-label-sm text-on-surface-variant mb-1">{total}</span>}
                                <div
                                  className="w-full bg-primary rounded-t animate-grow-up"
                                  style={{ height: `${Math.round((total / niceMaxBars) * 100)}%`, animationDelay: `${bi * 80}ms` }}
                                />
                              </div>
                              <div className="flex-1 max-w-14 flex flex-col items-center justify-end h-full">
                                {converted > 0 && <span className="text-label-sm text-secondary mb-1">{converted}</span>}
                                <div
                                  className="w-full bg-secondary rounded-t animate-grow-up"
                                  style={{ height: `${Math.round((converted / niceMaxBars) * 100)}%`, animationDelay: `${bi * 80 + 40}ms` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-2 text-label-sm text-on-surface-variant text-center">
                      {ATTEMPT_BUCKETS.map((bucket) => (
                        <span key={bucket}>{bucket}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                    <span className="w-3 h-3 rounded-full bg-primary" /> Total
                  </span>
                  <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                    <span className="w-3 h-3 rounded-full bg-secondary" /> Converted (Demo, Paid, Confirmation)
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom row: leads by attempts + pending installments */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div
                className="animate-fade-up lg:col-span-2 bg-surface-container rounded-xl border border-outline-variant p-6"
                style={{ animationDelay: '240ms' }}
              >
                <div className="flex items-baseline justify-between mb-5">
                  <h3 className="text-headline-sm font-semibold text-on-surface">Leads by Attempts</h3>
                  <span className="text-label-sm text-on-surface-variant">still needed</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {ATTEMPT_MILESTONES.map((n) => {
                    const meta = ATTEMPTS_NEEDED_META[n];
                    const count = stats.attemptsNeeded[n];
                    const pct = stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0;
                    return (
                      <div key={n} className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${ICON_SOLID_CLASSES[meta.accent]}`}>
                            <span className="material-symbols-outlined text-[18px]">groups</span>
                          </span>
                          <div className="min-w-0">
                            <div className={`text-headline-sm font-bold ${TEXT_ACCENT_CLASSES[meta.accent]}`}>
                              <AnimatedNumber value={count} />
                            </div>
                            <div className="text-label-sm text-on-surface-variant truncate">{meta.label}</div>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                          <div
                            className={`h-full rounded-full ${BAR_SOLID_CLASSES[meta.accent]} transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-label-sm text-on-surface-variant">{pct}% of total leads</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="animate-fade-up bg-surface-container rounded-xl border border-outline-variant p-6 flex flex-col"
                style={{ animationDelay: '310ms' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-headline-sm font-semibold text-on-surface">Pending Installments</h3>
                  <span className="w-10 h-10 rounded-lg bg-tertiary text-on-tertiary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">schedule</span>
                  </span>
                </div>
                <div className="text-headline-lg font-bold text-tertiary">
                  <AnimatedNumber value={installmentStats.pending} />
                </div>
                <div className="text-body-md text-on-surface-variant mt-1">awaiting payment</div>
                <div className="mt-auto pt-4 flex gap-6 border-t border-outline-variant">
                  <div>
                    <div className="text-body-lg font-semibold text-secondary">
                      <AnimatedNumber value={installmentStats.paid} />
                    </div>
                    <div className="text-label-sm text-on-surface-variant">Paid</div>
                  </div>
                  <div>
                    <div className="text-body-lg font-semibold text-error">
                      <AnimatedNumber value={installmentStats.notPaying} />
                    </div>
                    <div className="text-label-sm text-on-surface-variant">Not Paying</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Installments by batch */}
            <div>
              <h3 className="text-headline-sm font-semibold text-on-surface mb-4 px-1">Installments by Batch</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {INSTALLMENT_BATCHES.map((key, i) => {
                  const meta = INSTALLMENT_BATCH_META[key];
                  const counts = installmentStats.byBatch?.[key] || emptyBatchCounts();
                  return (
                    <div
                      key={key}
                      className="animate-fade-up bg-surface-container rounded-xl border border-outline-variant p-7"
                      style={{ animationDelay: `${370 + i * 70}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <span className="text-label-md text-on-surface-variant uppercase tracking-wide">
                          {meta.label}
                        </span>
                        <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${ICON_SOLID_CLASSES[meta.accent]}`}>
                          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                        </span>
                      </div>
                      <div className={`text-headline-lg font-bold ${TEXT_ACCENT_CLASSES[meta.accent]}`}>
                        <AnimatedNumber value={counts.paid} />
                      </div>
                      <div className="text-label-sm text-on-surface-variant mt-1">paid</div>

                      <div className="mt-5 pt-5 border-t border-outline-variant flex flex-col gap-4">
                        {INSTALLMENT_ORDINALS.map((ord) => {
                          const o = counts.byOrdinal?.[ord] || emptyInstallmentCounts();
                          const started = o.paid + o.notPaying + o.pending > 0;
                          return (
                            <div key={ord} className="flex items-center justify-between gap-3">
                              <span className="text-label-sm text-on-surface-variant shrink-0">
                                {INSTALLMENT_ORDINAL_LABELS[ord]}
                              </span>
                              {started ? (
                                <div className="flex items-center gap-5">
                                  <span className="flex items-baseline gap-1.5">
                                    <span className="text-body-lg font-semibold text-error">
                                      <AnimatedNumber value={o.notPaying} />
                                    </span>
                                    <span className="text-label-sm text-on-surface-variant">Not Paying</span>
                                  </span>
                                  <span className="flex items-baseline gap-1.5">
                                    <span className="text-body-lg font-semibold text-on-surface-variant">
                                      <AnimatedNumber value={o.pending} />
                                    </span>
                                    <span className="text-label-sm text-on-surface-variant">Will Pay</span>
                                  </span>
                                </div>
                              ) : (
                                <span className="flex items-baseline gap-1.5">
                                  <span className="text-body-lg font-semibold text-on-surface-variant/50">0</span>
                                  <span className="text-label-sm text-on-surface-variant/50">Not Started</span>
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
