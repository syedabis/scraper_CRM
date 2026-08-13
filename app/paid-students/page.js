'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';

const SHOW_OPTIONS = [50, 100, 200, 'all'];

export default function PaidStudents() {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [showCount, setShowCount] = useState(50);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/fetch-paid-students');
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load paid students');
        }
        const data = await response.json();
        setStudents(data.students || []);
        setBatches(data.batches || []);
      } catch (err) {
        setError(err.message || 'Failed to load paid students');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const trimmed = searchQuery.trim();
    const queryLower = trimmed.toLowerCase();
    const queryDigits = trimmed.replace(/\D/g, '');

    return students.filter((s) => {
      if (selectedBatch && s.batch !== selectedBatch) return false;
      if (!trimmed) return true;
      const nameMatch = s.name.toLowerCase().includes(queryLower);
      const emailMatch = s.email.toLowerCase().includes(queryLower);
      const phoneDigits = s.phone.replace(/\D/g, '');
      const phoneMatch = queryDigits.length > 0 && phoneDigits.includes(queryDigits);
      return nameMatch || emailMatch || phoneMatch;
    });
  }, [students, searchQuery, selectedBatch]);

  const visible = showCount === 'all' ? filtered : filtered.slice(0, showCount);

  const search = (
    <div className="relative w-full max-w-md">
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
        search
      </span>
      <input
        className="w-full bg-surface-container-high border border-outline-variant rounded-full py-2 pl-10 pr-4 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
        placeholder="Search by name, phone, or email..."
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );

  return (
    <AppShell title="Paid Students" search={search}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label htmlFor="batch-filter" className="text-label-md text-on-surface-variant">
            Batch
          </label>
          <select
            id="batch-filter"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="show-count" className="text-label-md text-on-surface-variant">
            Show
          </label>
          <select
            id="show-count"
            value={showCount}
            onChange={(e) => setShowCount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {SHOW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 'all' ? 'All' : n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl border border-outline-variant p-1">
        {loading ? (
          <div className="p-12 text-center text-on-surface-variant text-body-md">Loading paid students…</div>
        ) : error ? (
          <div className="p-12 text-center text-error text-body-md">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant text-body-md">
            {searchQuery || selectedBatch ? 'No paid students match your filters.' : 'No paid students found yet.'}
          </div>
        ) : (
          <div className="overflow-auto themed-scrollbar max-h-[65vh]">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface-container-high text-on-surface-variant text-label-md border-b border-outline-variant">
                  <th className="p-4 font-semibold">Name</th>
                  <th className="p-4 font-semibold">Phone</th>
                  <th className="p-4 font-semibold">Email</th>
                  <th className="p-4 font-semibold text-center">Installments Paid</th>
                  <th className="p-4 font-semibold">Batch</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s, i) => (
                  <tr
                    key={`${s.batch}-${s.phone}-${i}`}
                    className="text-body-md border-b border-outline-variant last:border-0 hover:bg-surface-container-highest transition-colors"
                  >
                    <td className="p-4 text-on-surface">{s.name}</td>
                    <td className="p-4 text-on-surface-variant">{s.phone || '—'}</td>
                    <td className="p-4 text-on-surface-variant">{s.email || '—'}</td>
                    <td className="p-4 text-center font-bold text-primary">
                      {s.installmentsPaid}/{s.totalInstallments}
                    </td>
                    <td className="p-4 text-on-surface-variant">{s.batch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && !error && (
        <p className="mt-3 text-label-sm text-on-surface-variant">
          Showing {visible.length} of {filtered.length} paid student{filtered.length === 1 ? '' : 's'}
          {selectedBatch ? ` in ${selectedBatch}` : ''}
          {searchQuery ? ` matching "${searchQuery}"` : ''}
        </p>
      )}
    </AppShell>
  );
}
