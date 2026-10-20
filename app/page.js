'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import AppShell from './components/AppShell';
import { useTheme } from './components/ThemeProvider';
import CountUp from './components/CountUp';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function Dashboard() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [stats, setStats] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [territoryOrientation, setTerritoryOrientation] = useState('vertical');

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, leadsRes] = await Promise.all([
        fetch('/api/fetch-leads?stats=true'),
        fetch('/api/fetch-leads'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setRestaurants(leadsData);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const total = stats?.total || restaurants.length || 0;
  const contacted = stats?.contacted || 0;
  const contactedRate = stats?.contactedRate || 0;
  const interested = stats?.interested || 0;
  const closed = stats?.closed || 0;
  const conversionRate = stats?.conversionRate || 0;

  // Pipeline Stages Chart Data with clean 2-line wrapped labels to prevent rotation
  const stages = [
    { label: ['New', 'Lead'], full: 'New Lead', key: 'New Lead', color: '#10b981' },
    { label: 'Connected', full: 'Connected', key: 'Connected', color: '#3b82f6' },
    { label: ['Follow', 'Up'], full: 'Follow Up', key: 'Follow Up', color: '#f59e0b' },
    { label: 'Interested', full: 'Interested', key: 'Interested', color: '#a855f7' },
    { label: ['Meeting', 'Set'], full: 'Meeting Set', key: 'Meeting Scheduled', color: '#06b6d4' },
    { label: ['Closed', 'Won'], full: 'Closed / Won', key: 'Closed', color: '#22c55e' },
    { label: ['Not', 'Interested'], full: 'Not Interested', key: 'Not Interested', color: '#f43f5e' },
  ];

  const pipelineChartData = {
    labels: stages.map((s) => s.label),
    datasets: [
      {
        label: 'Restaurants',
        data: stages.map((s) => stats?.statusCounts?.[s.key] || 0),
        backgroundColor: stages.map((s) => s.color),
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  // Formatters for city territory labels
  const formatCityVertical = (cityName) => {
    if (!cityName) return '';
    const titleCase = cityName
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const words = titleCase.split(' ');
    if (words.length === 2) {
      return [words[0], words[1]];
    }
    if (words.length > 2) {
      return [words.slice(0, 2).join(' '), words.slice(2).join(' ')];
    }
    return titleCase;
  };

  const formatCitySingleLine = (cityName) => {
    if (!cityName) return '';
    return cityName
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Top Cities Chart Data
  const cityEntries = Object.entries(stats?.cityCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const citiesChartData = {
    labels: cityEntries.map(([city]) =>
      territoryOrientation === 'horizontal' ? formatCitySingleLine(city) : formatCityVertical(city)
    ),
    datasets: [
      {
        label: 'Businesses in Territory',
        data: cityEntries.map(([, count]) => count),
        backgroundColor: 'rgba(92, 228, 109, 0.75)',
        hoverBackgroundColor: '#5ce46d',
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 6, bottom: 8, left: 4, right: 4 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          title: (items) => {
            if (!items || !items.length) return '';
            const raw = items[0].label;
            return Array.isArray(raw) ? raw.join(' ') : raw;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: isLight ? '#475569' : '#94a3b8',
          font: { size: 11, weight: '600' },
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          padding: 8,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(148, 163, 184, 0.1)' },
        ticks: {
          color: isLight ? '#475569' : '#94a3b8',
          font: { size: 11 },
          precision: 0,
        },
      },
    },
  };

  const territoryOptions = {
    ...chartOptions,
    indexAxis: territoryOrientation === 'horizontal' ? 'y' : 'x',
    scales: territoryOrientation === 'horizontal'
      ? {
          x: {
            beginAtZero: true,
            grid: { color: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(148, 163, 184, 0.1)' },
            ticks: {
              color: isLight ? '#475569' : '#94a3b8',
              font: { size: 11 },
              precision: 0,
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              color: isLight ? '#475569' : '#94a3b8',
              font: { size: 11, weight: '600' },
              autoSkip: false,
            },
          },
        }
      : chartOptions.scales,
  };

  const headerControls = (
    <button
      onClick={loadData}
      disabled={loading}
      title="Refresh analytics"
      className="header-btn w-9 h-9 flex items-center justify-center text-muted hover:text-on-surface disabled:opacity-50 cursor-pointer"
    >
      <span className={`material-symbols-outlined text-[17px] ${loading ? 'animate-spin' : ''}`}>
        refresh
      </span>
    </button>
  );

  return (
    <AppShell title="Restaurant Sales CRM" search={headerControls}>
      <div className="flex flex-col gap-6">
        {/* WELCOME BANNER & QUICK STATS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-on-surface tracking-tight">
              Restaurant Pipeline Overview
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Live outreach metrics and sales conversions from <span className="font-semibold text-primary">restaurants.csv</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/calling"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">phone_in_talk</span>
              Open Calling Workspace
            </Link>
          </div>
        </div>

        {/* SKELETON SHIMMER LOADER WHILE FETCHING */}
        {loading ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card p-5 h-32 flex flex-col justify-between">
                  <div className="skeleton-shimmer h-3.5 w-28 rounded"></div>
                  <div className="skeleton-shimmer h-9 w-20 rounded-lg"></div>
                  <div className="skeleton-shimmer h-3 w-36 rounded"></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="glass-card p-5 h-72 flex flex-col gap-4">
                <div className="skeleton-shimmer h-4 w-44 rounded"></div>
                <div className="skeleton-shimmer flex-1 rounded-xl"></div>
              </div>
              <div className="glass-card p-5 h-72 flex flex-col gap-4">
                <div className="skeleton-shimmer h-4 w-44 rounded"></div>
                <div className="skeleton-shimmer flex-1 rounded-xl"></div>
              </div>
            </div>
            <div className="glass-card p-5 h-64 flex flex-col gap-4">
              <div className="skeleton-shimmer h-4 w-52 rounded"></div>
              <div className="skeleton-shimmer flex-1 rounded-xl"></div>
            </div>
          </div>
        ) : (
          <>
            {/* ROW 1: 4 KEY PERFORMANCE TILES */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tile 1: Total Pipeline */}
              <div className="glass-card p-5 flex flex-col justify-between h-32 border-l-4 border-l-brand-blue hover-lift">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Total Restaurants
                    </span>
                    <span className="text-3xl font-black text-on-surface tabular-nums">
                      <CountUp value={total} />
                    </span>
                  </div>
                  <span className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">storefront</span>
                  </span>
                </div>
                <div className="text-[11px] text-muted flex items-center gap-1">
                  <span className="text-blue-400 font-bold">100%</span> active database
                </div>
              </div>

              {/* Tile 2: Contacted Rate */}
              <div className="glass-card p-5 flex flex-col justify-between h-32 border-l-4 border-l-brand-orange hover-lift">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Contacted Rate
                    </span>
                    <span className="text-3xl font-black text-on-surface tabular-nums">
                      <CountUp value={contactedRate} suffix="%" />
                    </span>
                  </div>
                  <span className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">call</span>
                  </span>
                </div>
                <div className="text-[11px] text-muted flex items-center gap-1">
                  <span className="text-amber-400 font-bold"><CountUp value={contacted} /></span> of {total} called
                </div>
              </div>

              {/* Tile 3: Interested Leads */}
              <div className="glass-card p-5 flex flex-col justify-between h-32 border-l-4 border-l-brand-purple hover-lift">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Interested / Warm
                    </span>
                    <span className="text-3xl font-black text-on-surface tabular-nums">
                      <CountUp value={interested} />
                    </span>
                  </div>
                  <span className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">star</span>
                  </span>
                </div>
                <div className="text-[11px] text-muted flex items-center gap-1">
                  <span className="text-purple-400 font-bold">Priority</span> leads to close
                </div>
              </div>

              {/* Tile 4: Closed / Onboarded */}
              <div className="glass-card p-5 flex flex-col justify-between h-32 border-l-4 border-l-brand-green hover-lift">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Closed / Won
                    </span>
                    <span className="text-3xl font-black text-on-surface tabular-nums">
                      <CountUp value={closed} />
                    </span>
                  </div>
                  <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  </span>
                </div>
                <div className="text-[11px] text-muted flex items-center gap-1">
                  <span className="text-emerald-400 font-bold"><CountUp value={conversionRate} suffix="%" /></span> conversion of contacted
                </div>
              </div>
            </div>

        {/* ROW 2: CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Pipeline Stage Distribution */}
          <div className="glass-card p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-on-surface">Pipeline Stage Distribution</h2>
                <p className="text-[11px] text-muted">Count of businesses by current outreach stage</p>
              </div>
            </div>
            <div className="h-64 w-full">
              <Bar data={pipelineChartData} options={chartOptions} />
            </div>
          </div>

          {/* Top Territories / Cities */}
          <div className="glass-card p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-on-surface">Top Restaurant Territories</h2>
                <p className="text-[11px] text-muted">Geographic concentration by city</p>
              </div>
              <div className="flex items-center gap-1 bg-surface-container rounded-lg p-1 border border-outline-variant">
                <button
                  onClick={() => setTerritoryOrientation('vertical')}
                  title="Vertical Columns"
                  className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                    territoryOrientation === 'vertical'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-muted hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">bar_chart</span>
                  Columns
                </button>
                <button
                  onClick={() => setTerritoryOrientation('horizontal')}
                  title="Horizontal Leaderboard"
                  className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                    territoryOrientation === 'horizontal'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-muted hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px] rotate-90">bar_chart</span>
                  Bars
                </button>
              </div>
            </div>
            <div className="h-64 w-full">
              <Bar data={citiesChartData} options={territoryOptions} />
            </div>
          </div>
        </div>

        {/* ROW 3: RECENT RESTAURANTS DIRECTORY */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container/40">
            <div>
              <h2 className="text-sm font-bold text-on-surface">Active Restaurant Leads</h2>
              <p className="text-[11px] text-muted">Quick preview of entries ready for sales contact</p>
            </div>
            <Link
              href="/calling"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              View in Calling Workspace
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </Link>
          </div>

          <div className="overflow-x-auto themed-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container text-muted text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Restaurant</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4 text-center">Attempts</th>
                  <th className="py-3 px-4">Notes Preview</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.slice(0, 10).map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-outline-variant/40 hover:bg-surface-container-high/60 transition-colors"
                    >
                    <td className="py-3 px-4 font-bold text-on-surface">
                      <div className="flex items-center gap-2">
                        {r.image_url ? (
                          <img src={r.image_url} alt="" className="w-6 h-6 rounded object-cover border border-outline-variant shrink-0" />
                        ) : (
                          <span className="w-6 h-6 rounded bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                            {r.name?.[0] || 'R'}
                          </span>
                        )}
                        <span className="truncate max-w-[200px]">{r.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <a href={`tel:${r.phone}`} className="text-primary hover:underline font-mono">
                        {r.phone || '—'}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-muted">
                      {r.city ? `${r.city}, ${r.state || ''}` : r.full_location || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container-high text-on-surface border border-outline-variant">
                        {r.status || 'New Lead'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center tabular-nums font-bold">
                      {r.attempts || 0}
                    </td>
                    <td className="py-3 px-4 text-muted truncate max-w-[200px]">
                      {r.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href="/calling"
                        className="px-2.5 py-1 rounded bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary text-[11px] font-bold transition-colors inline-block"
                      >
                        Call
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>
    </AppShell>
  );
}
