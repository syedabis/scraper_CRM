"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useId } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { UserButton } from '@clerk/nextjs';
import AppShell from './components/AppShell';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip);

// ── Template reskin palette (canvas can't read CSS vars) ──────────────────────
const C_PURPLE = '#a855f7';
const C_GREEN = '#10b981';
const C_ORANGE = '#f97316';
const C_BLUE = '#3b82f6';
const C_MUTED = '#8b949e';
const C_GRID = 'rgba(255,255,255,0.04)';

const CHART_TOOLTIP = {
  backgroundColor: 'rgba(14, 17, 30, 0.92)',
  titleColor: C_MUTED,
  bodyColor: '#ffffff',
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
  padding: 10,
  boxPadding: 4,
  usePointStyle: true,
  titleFont: { size: 10, weight: 'normal' },
  bodyFont: { size: 11, weight: 'bold' },
};

// Vertical fade gradient for area/sparkline fills.
function vGradient(context, hex, topAlpha = '55') {
  const { ctx, chartArea } = context.chart;
  if (!chartArea) return `${hex}00`;
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, hex + topAlpha);
  g.addColorStop(1, `${hex}00`);
  return g;
}

// Neon glow: wrap each line dataset draw with a coloured canvas shadow.
const neonLinePlugin = {
  id: 'neonLine',
  beforeDatasetDraw(chart, args) {
    if (args.meta.type !== 'line') return;
    const color = chart.data.datasets[args.index]?.borderColor;
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = typeof color === 'string' ? color : 'rgba(168,85,247,0.9)';
    ctx.shadowBlur = 14;
  },
  afterDatasetDraw(chart, args) {
    if (args.meta.type !== 'line') return;
    chart.ctx.restore();
  },
};

// Neon glow for bar datasets — colour follows each bar's fill.
const neonBarPlugin = {
  id: 'neonBar',
  beforeDatasetDraw(chart, args) {
    if (args.meta.type !== 'bar') return;
    const color = chart.data.datasets[args.index]?.backgroundColor;
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = typeof color === 'string' ? color : 'rgba(168,85,247,0.9)';
    ctx.shadowBlur = 12;
  },
  afterDatasetDraw(chart, args) {
    if (args.meta.type !== 'bar') return;
    chart.ctx.restore();
  },
};

const CONVERTED_STATUSES = ['Confirmation', 'Paid', 'Demo'];
const TERMINAL_STATUSES = ['Client Lost', 'Confirmation', 'Paid', 'Demo'];
const ATTEMPT_BUCKETS = ['1', '2', '3', '4+'];
const ATTEMPT_MILESTONES = [1, 2, 3, 4];
// Column R holds Slot 1-4 pre-joined into one comma-separated summary
// ("Status (date), Status (date), ..."). Used only for the Leads by
// Attempts card, which needs the real chronological order of the calls —
// slot columns are just fixed time-of-day windows, not attempt numbers.
const ATTEMPT_SLOTS_SUMMARY_INDEX = 18;
const DAY_MS = 24 * 60 * 60 * 1000;

const ATTEMPTS_NEEDED_META = {
  1: { label: '1st Attempt' },
  2: { label: '2nd Attempt' },
  3: { label: '3rd Attempt' },
  4: { label: '4th Attempt' },
};

// Per-column accents for the Leads by Attempts cards.
const ATTEMPT_COL_META = {
  1: { iconBg: 'bg-brand-purple/10 text-brand-purple border border-brand-purple/20', icon: 'groups' },
  2: { iconBg: 'bg-brand-green/10 text-brand-green border border-brand-green/20', icon: 'how_to_reg' },
  3: { iconBg: 'bg-brand-orange/10 text-brand-orange border border-brand-orange/20', icon: 'group' },
  4: { iconBg: 'bg-brand-blue/10 text-brand-blue border border-brand-blue/20', icon: 'headset_mic' },
};

// KPI accent map: floor-glow class, spark colour, icon chip classes.
const KPI_META = {
  purple: { floor: 'kpi-purple', color: C_PURPLE, iconBg: 'bg-brand-purple/10 text-brand-purple border border-brand-purple/20' },
  green: { floor: 'kpi-green', color: C_GREEN, iconBg: 'bg-brand-green/10 text-brand-green border border-brand-green/20' },
  orange: { floor: 'kpi-orange', color: C_ORANGE, iconBg: 'bg-brand-orange/10 text-brand-orange border border-brand-orange/20' },
  blue: { floor: 'kpi-blue', color: C_BLUE, iconBg: 'bg-brand-blue/10 text-brand-blue border border-brand-blue/20' },
};

// Lead-state funnel for the per-attempt slot breakdown.
const LEAD_STATE_ORDER = [
  { key: 'notCalled', label: 'Not Called Yet', tone: 'muted' },
  { key: 'notReceived', label: 'Not Received', tone: 'muted' },
  { key: 'callLater', label: 'Call Later', tone: 'muted' },
  { key: 'awaiting', label: 'Awaiting Response', tone: 'muted' },
  { key: 'callReceived', label: 'Call Received', tone: 'muted' },
  { key: 'formFilled', label: 'Form Filled', tone: 'muted' },
  { key: 'groupLead', label: 'Group Lead', tone: 'muted' },
  { key: 'lost', label: 'Client Lost', tone: 'error' },
  { key: 'converted', label: 'Converted', tone: 'secondary' },
];

function classifyLeadState(status) {
  if (!status) return 'notCalled';
  if (CONVERTED_STATUSES.includes(status)) return 'converted';
  switch (status) {
    case 'Client Lost':
      return 'lost';
    case 'Not Received':
      return 'notReceived';
    case 'Call Later':
      return 'callLater';
    case 'Awaiting Response':
      return 'awaiting';
    case 'Call Received':
      return 'callReceived';
    case 'Form Filled':
      return 'formFilled';
    case 'Group Lead':
      return 'groupLead';
    default:
      return 'notCalled';
  }
}

function emptyStateBreakdown() {
  return LEAD_STATE_ORDER.reduce((acc, s) => {
    acc[s.key] = 0;
    return acc;
  }, {});
}

// Each slot entry is stored as "Status (M/D/YYYY, H:MM:SS AM/PM)" — pull both
// the status and the real timestamp back out. The timestamp is what lets us
// tell real attempt order apart from slot column (time-of-day) position.
function parseSlotEntry(raw) {
  if (!raw) return null;
  const str = raw.toString().trim();
  if (!str) return null;
  const idx = str.indexOf(' (');
  const status = (idx >= 0 ? str.slice(0, idx) : str).trim();
  if (!status) return null;
  const timeMatch = str.match(/\((\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)\)/i);
  let time = null;
  if (timeMatch) {
    const [, month, day, year, rawHour, minute, second, ampm] = timeMatch;
    let hour = parseInt(rawHour, 10) % 12;
    if (/pm/i.test(ampm)) hour += 12;
    time = new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second)).getTime();
  }
  return { status, time };
}

// Column R joins the 4 slot entries with plain commas, but each entry's own
// timestamp already contains a comma, so a naive split(',') would cut entries
// in half. Only split on commas that sit outside parentheses.
function splitTopLevelCommas(str) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

const INSTALLMENT_BATCHES = ['ep-40', 'ep-41', 'ep-42'];
const BATCH_META = {
  'ep-40': { label: 'EP-40', color: C_PURPLE, border: 'border-brand-purple/30', iconBg: 'bg-brand-purple/10 text-brand-purple border border-brand-purple/20' },
  'ep-41': { label: 'EP-41', color: C_GREEN, border: 'border-brand-green/20', iconBg: 'bg-brand-green/10 text-brand-green border border-brand-green/20' },
  'ep-42': { label: 'EP-42', color: C_BLUE, border: 'border-brand-blue/20', iconBg: 'bg-brand-blue/10 text-brand-blue border border-brand-blue/20' },
};

const INSTALLMENT_ORDINALS = ['1st', '2nd', '3rd', '4th'];

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
  const slotBreakdown = ATTEMPT_MILESTONES.reduce((acc, n) => {
    acc[n] = emptyStateBreakdown();
    return acc;
  }, {});
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

    // Leads by Attempts card only: column R gives all 4 slots pre-joined in
    // one string. Slot columns are just fixed time-of-day windows (9-11am,
    // 11am-1pm, 1-4pm, 4pm-9am), not attempt numbers, so pull the real
    // timestamp out of every filled entry and sort chronologically — the
    // earliest call is always "attempt 1", no matter which time-of-day slot
    // it landed in.
    const slotEntries = splitTopLevelCommas((lead[ATTEMPT_SLOTS_SUMMARY_INDEX] || '').toString())
      .map((part) => parseSlotEntry(part))
      .filter(Boolean);
    slotEntries.sort((a, b) => {
      if (a.time === null && b.time === null) return 0;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time - b.time;
    });
    slotEntries.slice(0, 4).forEach((entry, idx) => {
      slotBreakdown[idx + 1][classifyLeadState(entry.status)]++;
    });

    if (attempts < 1) return;
    const bucket = attempts >= 4 ? '4+' : String(attempts);
    bucketStats[bucket].total++;
    if (CONVERTED_STATUSES.includes(status)) {
      bucketStats[bucket].converted++;
    }
  });

  return { totalLeads: relevant.length, confirmations, paid, demo, bucketStats, attemptsNeeded, slotBreakdown };
}

// Build a real time series (bucketed by day / week / month over the span).
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

  const makeBucket = (d) => ({ start: d, total: 0, converted: 0, confirmations: 0, paid: 0, demo: 0 });
  const buckets = [];
  if (unit === 'month') {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      buckets.push(makeBucket(new Date(cursor)));
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    const step = unit === 'week' ? 7 : 1;
    const cursor = new Date(start);
    while (cursor <= end) {
      buckets.push(makeBucket(new Date(cursor)));
      cursor.setDate(cursor.getDate() + step);
    }
  }
  if (!buckets.length) buckets.push(makeBucket(new Date(start)));

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
    if (r.status === 'Confirmation') buckets[i].confirmations++;
    if (r.status === 'Paid') buckets[i].paid++;
    if (r.status === 'Demo') buckets[i].demo++;
  });

  const labelFmt = (d) =>
    unit === 'month'
      ? d.toLocaleDateString('en-US', { month: 'short' })
      : `${d.getMonth() + 1}/${d.getDate()}`;

  const points = buckets.map((b) => ({
    label: labelFmt(b.start),
    total: b.total,
    converted: b.converted,
    confirmations: b.confirmations,
    paid: b.paid,
    demo: b.demo,
  }));
  const maxTotal = Math.max(1, ...points.map((p) => p.total));
  return { points, niceMax: niceCeil(maxTotal) };
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

function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return <span className="text-dim">— </span>;
  const positive = delta >= 0;
  return (
    <span className={`font-semibold inline-flex items-center gap-0.5 ${positive ? 'text-brand-green' : 'text-brand-red'}`}>
      <span className="material-symbols-outlined text-[12px]">{positive ? 'trending_up' : 'trending_down'}</span>
      {positive ? '+' : ''}
      {delta}%
    </span>
  );
}

// KPI mini trend sparkline.
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return <div className="h-10 w-full" />;
  const chartData = {
    labels: data.map((_, i) => i),
    datasets: [
      {
        data,
        borderColor: color,
        borderWidth: 1.5,
        tension: 0.4,
        fill: true,
        backgroundColor: (ctx) => vGradient(ctx, color, '55'),
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeOutQuart' },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false, min: 0 } },
    layout: { padding: { top: 2, bottom: 2 } },
  };
  return (
    <div className="h-10 w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}

// Leads Overview — purple area + green line, smooth through zero-lead days.
function LeadsLineChart({ points, niceMax }) {
  if (points.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-label-md">
        Not enough data in this range to plot a trend.
      </div>
    );
  }

  const data = {
    labels: points.map((p) => p.label),
    datasets: [
      {
        label: 'Total Leads',
        data: points.map((p) => p.total),
        borderColor: C_PURPLE,
        borderWidth: 2,
        backgroundColor: (ctx) => vGradient(ctx, C_PURPLE, '66'),
        fill: true,
        tension: 0.4,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: C_PURPLE,
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
      },
      {
        label: 'Converted',
        data: points.map((p) => p.converted),
        borderColor: C_GREEN,
        borderWidth: 2,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: C_GREEN,
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 900, easing: 'easeOutQuart' },
    animations: {
      y: {
        from: (ctx) =>
          ctx.type === 'data' && ctx.mode === 'default' ? ctx.chart.scales.y.getPixelForValue(0) : undefined,
      },
    },
    plugins: { legend: { display: false }, tooltip: CHART_TOOLTIP },
    scales: {
      x: {
        grid: { color: C_GRID },
        ticks: { color: C_MUTED, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        border: { display: false },
      },
      y: {
        min: 0,
        suggestedMax: niceMax,
        grid: { color: C_GRID },
        ticks: { color: C_MUTED, font: { size: 10 }, padding: 8, stepSize: Math.max(1, Math.round(niceMax / 5)) },
        border: { display: false },
      },
    },
  };

  return (
    <div className="h-full w-full">
      <Line data={data} options={options} plugins={[neonLinePlugin]} />
    </div>
  );
}

// Conversion by Attempts — thin purple/green grouped bars.
function AttemptsBarChart({ bucketStats }) {
  const data = {
    labels: ATTEMPT_BUCKETS,
    datasets: [
      {
        label: 'Total',
        data: ATTEMPT_BUCKETS.map((b) => bucketStats[b].total),
        backgroundColor: C_PURPLE,
        borderRadius: { topLeft: 3, topRight: 3 },
        maxBarThickness: 16,
      },
      {
        label: 'Converted',
        data: ATTEMPT_BUCKETS.map((b) => bucketStats[b].converted),
        backgroundColor: C_GREEN,
        borderRadius: { topLeft: 3, topRight: 3 },
        maxBarThickness: 16,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeOutQuart' },
    plugins: { legend: { display: false }, tooltip: CHART_TOOLTIP },
    scales: {
      x: { grid: { display: false }, ticks: { color: C_MUTED, font: { size: 10 } }, border: { display: false } },
      y: {
        min: 0,
        grid: { color: C_GRID },
        ticks: { color: C_MUTED, font: { size: 10 }, padding: 8, precision: 0 },
        border: { display: false },
      },
    },
  };

  return (
    <div className="h-full w-full">
      <Bar data={data} options={options} plugins={[neonBarPlugin]} />
    </div>
  );
}

// Small conversion donut for each attempt column — SVG with a blurred glow copy,
// same neon treatment as the pending ring.
function MiniDonut({ value, color = C_GREEN }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const R = 15;
  const C = 2 * Math.PI * R;
  const dash = `${((v / 100) * C).toFixed(2)} ${C.toFixed(2)}`;
  const uid = useId();
  const blurId = `md-blur-${uid}`;
  return (
    <div className="relative w-9 h-9 shrink-0">
      {/* Blurred glow copy */}
      <svg className="absolute inset-0 w-full h-full opacity-80" viewBox="0 0 40 40" style={{ overflow: 'visible' }}>
        <defs>
          <filter id={blurId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={dash}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
          filter={`url(#${blurId})`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      {/* Sharp ring */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={dash}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
    </div>
  );
}

// Pending Installments ring — SVG so the neon glow (a blurred copy behind the
// sharp ring) hugs only the bar, never the card. Follows pending-installement.html.
function PendingRing({ paid, notPaying, pending }) {
  const total = paid + notPaying + pending;
  const R = 50;
  const C = 2 * Math.PI * R; // 314.159
  const fraction = total > 0 ? Math.min(1, paid / total) : 0;
  const dash = `${(fraction * C).toFixed(2)} ${C.toFixed(2)}`;
  const stops = (
    <>
      <stop offset="0%" stopColor="#ff9d5c" />
      <stop offset="35%" stopColor="#ec4899" />
      <stop offset="70%" stopColor="#8b5cf6" />
      <stop offset="100%" stopColor="#3b82f6" />
    </>
  );

  return (
    <div className="relative w-44 h-44">
      {/* Blurred glow copy */}
      <svg className="absolute inset-0 w-full h-full opacity-70" viewBox="0 0 120 120" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="pendGlow" x1="1" y1="0" x2="0" y2="1">{stops}</linearGradient>
          <filter id="pendBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="url(#pendGlow)"
          strokeWidth="10"
          strokeDasharray={dash}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          filter="url(#pendBlur)"
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>

      {/* Sharp ring */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 120 120" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="pendRing" x1="1" y1="0" x2="0" y2="1">{stops}</linearGradient>
        </defs>
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="url(#pendRing)"
          strokeWidth="10"
          strokeDasharray={dash}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[30px] font-bold text-white leading-none tracking-tight mb-1">
          <AnimatedNumber value={pending} />
        </div>
        <div className="text-[#9ca3af] text-[11px] font-medium tracking-wide">Total Pending</div>
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
      const [prettyRes, installmentsRes] = await Promise.all([
        fetch('/api/fetch-leads?sheetName=Pretty'),
        fetch('/api/fetch-installments'),
      ]);

      const prettyLeads = prettyRes.ok ? await prettyRes.json() : [];
      setAllLeads(prettyLeads);

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

  const rangeLabel = formatRangeLabel(activeRange, preset);
  const chartKey = `${rangeLabel}:${timeSeries.points.length}:${timeSeries.points.reduce((s, p) => s + p.total, 0)}`;

  // Conversion rate within each attempt bucket (converted ÷ leads at that attempt).
  const attemptConversionRates = ATTEMPT_BUCKETS.map((bucket, i) => {
    const { total, converted } = stats.bucketStats[bucket];
    return {
      label: ['1st', '2nd', '3rd', '4th'][i],
      rate: total > 0 ? Math.round((converted / total) * 100) : 0,
    };
  });

  const topCards = [
    { label: 'Total Leads', value: stats.totalLeads, delta: heroDelta, icon: 'group', accent: 'purple', series: timeSeries.points.map((p) => p.total) },
    {
      label: 'Confirmations',
      value: stats.confirmations,
      delta: previousStats ? calcDelta(stats.confirmations, previousStats.confirmations) : null,
      icon: 'verified',
      accent: 'green',
      series: timeSeries.points.map((p) => p.confirmations),
    },
    {
      label: 'Paid',
      value: stats.paid,
      delta: previousStats ? calcDelta(stats.paid, previousStats.paid) : null,
      icon: 'payments',
      accent: 'orange',
      series: timeSeries.points.map((p) => p.paid),
    },
    {
      label: 'Demo',
      value: stats.demo,
      delta: previousStats ? calcDelta(stats.demo, previousStats.demo) : null,
      icon: 'co_present',
      accent: 'blue',
      series: timeSeries.points.map((p) => p.demo),
    },
  ];

  return (
    <AppShell title="Dashboard" hideTopNav>
      <div className="flex flex-col gap-5 text-[13px]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <p className="text-muted text-[11px] mb-1">Welcome back 👋</p>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-0.5">DataCrumbs Sales Portal</h1>
            <p className="text-dim text-[11px]">Internal Sales Management System</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="header-btn flex items-center px-3.5 py-2 text-xs text-gray-300">
              <span className="material-symbols-outlined text-[15px] mr-2 text-dim">calendar_today</span>
              <span className="font-medium">{rangeLabel}</span>
            </div>

            {preset === 'custom' && (
              <div className="header-btn flex items-center px-3 py-1.5 gap-1.5 text-xs text-gray-300">
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
                  className="bg-transparent outline-none [color-scheme:dark]"
                />
                <span className="text-dim">–</span>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
                  className="bg-transparent outline-none [color-scheme:dark]"
                />
              </div>
            )}

            <div className="header-btn flex items-center pl-3 pr-2 text-xs text-gray-300">
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="bg-transparent py-2 outline-none cursor-pointer"
              >
                {PRESET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#0e111e] text-gray-200">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh data"
              className="header-btn w-9 h-9 flex items-center justify-center text-muted hover:text-white disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>

            <div className="ml-1 flex items-center">
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </div>

        {error && (
          <div className="glass-card border-brand-red/30 text-brand-red p-4 text-center text-xs">{error}</div>
        )}

        {loading ? (
          <div className="text-center text-muted py-16">Loading analytics…</div>
        ) : (
          <>
            {/* ROW 1 — KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {topCards.map((card, i) => {
                const meta = KPI_META[card.accent];
                return (
                  <div
                    key={card.label}
                    className={`glass-card kpi-card ${meta.floor} p-4 h-[128px] flex flex-col justify-between animate-fade-up`}
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div className="kpi-content flex items-start gap-3">
                      <span className={`icon-neon w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${meta.iconBg}`}>
                        <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted font-medium mb-0.5 truncate">{card.label}</p>
                        <h2 className="text-2xl font-bold text-white leading-none mb-1.5">
                          <AnimatedNumber value={card.value} />
                        </h2>
                        <p className="text-[9px] text-dim flex items-center gap-1 flex-wrap">
                          <DeltaBadge delta={card.delta} /> vs previous period
                        </p>
                      </div>
                    </div>
                    <div className="relative z-10">
                      <Sparkline key={chartKey} data={card.series} color={meta.color} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ROW 2 — main charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Leads Overview */}
              <div className="glass-card lg:col-span-2 p-5 flex flex-col h-[340px] animate-fade-up" style={{ animationDelay: '120ms' }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">Leads Overview</h3>
                    {heroDelta !== null ? (
                      <p className="text-[10px] text-dim flex items-center gap-1">
                        <DeltaBadge delta={heroDelta} /> vs previous period
                      </p>
                    ) : (
                      <p className="text-[10px] text-dim">Leads over time</p>
                    )}
                  </div>
                  <div className="header-btn px-2.5 py-1 text-[10px] text-gray-400">{rangeLabel}</div>
                </div>

                <div className="flex-1 min-h-0 relative">
                  <LeadsLineChart key={chartKey} points={timeSeries.points} niceMax={timeSeries.niceMax} />
                </div>

                <div className="flex justify-center gap-5 mt-2 text-[10px] text-muted font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple shadow-[0_0_6px_#a855f7]" /> Total Leads
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-green shadow-[0_0_6px_#10b981]" /> Converted
                  </span>
                </div>
              </div>

              {/* Conversion by Attempts */}
              <div className="glass-card p-5 flex flex-col h-[340px] animate-fade-up" style={{ animationDelay: '190ms' }}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-semibold text-white">Conversion by Attempts</h3>
                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-0.5 text-[9px] text-muted">
                    {attemptConversionRates.map((r) => (
                      <div key={r.label}>
                        {r.label} <span className="text-brand-green ml-0.5 font-semibold">{r.rate}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-h-0 relative">
                  <AttemptsBarChart key={chartKey} bucketStats={stats.bucketStats} />
                </div>

                <div className="flex justify-center gap-3 mt-2 text-[9px] text-muted font-medium flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-[2px] bg-brand-purple shadow-[0_0_6px_#a855f7]" /> Total
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-[2px] bg-brand-green shadow-[0_0_6px_#10b981]" /> Converted (Demo, Paid, Confirmations)
                  </span>
                </div>
              </div>
            </div>

            {/* ROW 3 — Leads by Attempts + Pending Installments */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              <div className="glass-card lg:col-span-3 p-5 flex flex-col animate-fade-up" style={{ animationDelay: '240ms' }}>
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-sm font-semibold text-white">Leads by Attempts</h3>
                  <span className="text-[10px] text-dim">still needed · per-attempt outcomes</span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1 auto-rows-fr">
                  {ATTEMPT_MILESTONES.map((n) => {
                    const meta = ATTEMPT_COL_META[n];
                    const slotStates = stats.slotBreakdown[n];
                    const slotTotal = Object.values(slotStates).reduce((a, b) => a + b, 0);
                    const convRate = slotTotal > 0 ? Math.round((slotStates.converted / slotTotal) * 100) : 0;
                    return (
                      <div
                        key={n}
                        className="bg-black/20 border border-white/5 rounded-xl p-3.5 flex flex-col hover:border-white/10 transition-colors"
                      >
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-center gap-2.5 mb-4">
                            <span className={`icon-neon w-8 h-8 shrink-0 rounded-md flex items-center justify-center ${meta.iconBg}`}>
                              <span className="material-symbols-outlined text-[16px]">{meta.icon}</span>
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-lg font-bold text-white leading-none">
                                <AnimatedNumber value={stats.attemptsNeeded[n]} />
                              </h4>
                              <p className="text-[10px] text-dim mt-0.5 truncate">{ATTEMPTS_NEEDED_META[n].label} · still needed</p>
                            </div>
                          </div>
                          <ul className="flex-1 flex flex-col justify-between text-[11px] font-medium text-muted">
                            {LEAD_STATE_ORDER.filter((s) => s.key !== 'notCalled').map((s) => {
                              const c = slotStates[s.key];
                              const p = stats.totalLeads > 0 ? Math.round((c / stats.totalLeads) * 100) : 0;
                              const isNotReceived = s.key === 'notReceived';
                              const valColor =
                                s.tone === 'error' ? 'text-brand-red font-bold' : s.tone === 'secondary' ? 'text-brand-green font-bold' : 'text-gray-300';
                              return (
                                <li key={s.key} className="flex justify-between gap-1">
                                  <span className={`truncate ${isNotReceived ? 'font-bold text-white' : ''}`}>{s.label}</span>
                                  <span className={`whitespace-nowrap ${isNotReceived ? 'font-bold text-white' : valColor}`}>
                                    {c} · {p}%
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2.5">
                          <MiniDonut key={`${chartKey}:${n}`} value={convRate} color={C_GREEN} />
                          <div className="text-[11px] leading-tight">
                            <span className="font-bold text-white block">{convRate}%</span>
                            <span className="text-dim">Converted</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pending Installments — follows pending-installement.html */}
              <div className="glass-card p-6 flex flex-col relative overflow-hidden animate-fade-up" style={{ animationDelay: '310ms' }}>
                <div className="relative z-10 flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-white text-[17px] font-semibold tracking-wide mb-3">Pending Installments</h3>
                    <div className="text-[40px] font-bold text-[#ff9c5a] leading-none mb-1 tracking-tight">
                      <AnimatedNumber value={installmentStats.pending} />
                    </div>
                    <div className="text-[#9ca3af] text-[13px]">awaiting payment</div>
                  </div>
                  <span className="icon-neon w-11 h-11 shrink-0 rounded-[12px] bg-brand-orange/10 text-brand-orange border border-brand-orange/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                  </span>
                </div>

                <div className="relative z-10 flex-1 flex items-center justify-center py-2">
                  <PendingRing
                    paid={installmentStats.paid}
                    notPaying={installmentStats.notPaying}
                    pending={installmentStats.pending}
                  />
                </div>

                <div className="relative z-10 grid grid-cols-2 border-t border-white/5 pt-5 mt-6">
                  <div className="absolute left-1/2 top-[22px] bottom-1 w-px bg-white/5" />
                  <div className="pr-4">
                    <div className="text-[#00df89] text-[24px] font-bold leading-none mb-1.5">
                      <AnimatedNumber value={installmentStats.paid} />
                    </div>
                    <div className="text-[#9ca3af] text-[12px] font-medium tracking-wide">Paid</div>
                  </div>
                  <div className="pl-6">
                    <div className="text-[#ff3b5c] text-[24px] font-bold leading-none mb-1.5">
                      <AnimatedNumber value={installmentStats.notPaying} />
                    </div>
                    <div className="text-[#9ca3af] text-[12px] font-medium tracking-wide">Not Paying</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 4 — Installments by Batch */}
            <div id="installments-by-batch" className="glass-card p-5 animate-fade-up" style={{ animationDelay: '370ms' }}>
              <h3 className="text-sm font-semibold text-white mb-4">Installments by Batch</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {INSTALLMENT_BATCHES.map((key) => {
                  const meta = BATCH_META[key];
                  const counts = installmentStats.byBatch?.[key] || emptyBatchCounts();
                  const total = counts.paid + counts.notPaying + counts.pending;
                  const pct = total > 0 ? Math.round((counts.paid / total) * 100) : 0;
                  return (
                    <div key={key} className={`bg-black/20 border ${meta.border} rounded-xl p-4`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 shrink-0 rounded-md flex items-center justify-center ${meta.iconBg}`}>
                            <span className="material-symbols-outlined text-[15px]">inventory_2</span>
                          </span>
                          <div>
                            <h4 className="text-[11px] font-bold text-muted leading-tight mb-0.5">{meta.label}</h4>
                            <div className="flex items-end gap-1">
                              <span className="text-lg font-bold text-white leading-none">
                                <AnimatedNumber value={counts.paid} />
                              </span>
                              <span className="text-[9px] text-dim pb-px">paid</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted font-medium">{pct}%</div>
                      </div>

                      <div className="progress-track mb-4">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: meta.color, color: meta.color }} />
                      </div>

                      <div className="flex flex-col gap-2 text-[10px]">
                        {INSTALLMENT_ORDINALS.map((ord) => {
                          const o = counts.byOrdinal?.[ord] || emptyInstallmentCounts();
                          return (
                            <div key={ord} className="flex items-center justify-between">
                              <span className="text-dim">{ord}</span>
                              <span className="font-medium text-muted whitespace-nowrap">
                                <span className="text-gray-300">{o.notPaying}</span> Not Paying
                                <span className="mx-1.5 text-white/20">·</span>
                                <span className="text-gray-300">{o.pending}</span> Will Pay
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <footer className="text-center text-[10px] text-dim mt-1 mb-2 font-medium">
              © {new Date().getFullYear()} DataCrumbs Sales CRM. All rights reserved.
            </footer>
          </>
        )}
      </div>
    </AppShell>
  );
}
