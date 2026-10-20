'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '../components/AppShell';
import { fireDealWonConfetti, fireMeetingBookedEffect } from '../lib/celebrate';

const STATUS_CONFIG = [
  { name: 'All', label: 'All Businesses', icon: 'storefront', color: 'text-brand-blue' },
  { name: 'New Lead', label: 'New Leads', icon: 'fiber_new', color: 'text-emerald-400' },
  { name: 'Connected', label: 'Connected', icon: 'phone_in_talk', color: 'text-blue-400' },
  { name: 'Follow Up', label: 'Follow Up', icon: 'schedule', color: 'text-amber-400' },
  { name: 'Interested', label: 'Interested', icon: 'star', color: 'text-purple-400' },
  { name: 'Meeting Scheduled', label: 'Meeting Set', icon: 'event', color: 'text-cyan-400' },
  { name: 'Closed', label: 'Closed / Won', icon: 'check_circle', color: 'text-green-400' },
  { name: 'Not Interested', label: 'Not Interested', icon: 'cancel', color: 'text-rose-400' },
];

export default function CallingPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('focus'); // 'focus' | 'table'

  // Active restaurant editable state
  const [notes, setNotes] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Edit restaurant modal state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', city: '', state: '', full_location: '' });

  // Load leads
  const loadRestaurants = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fetch-leads');
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data);
      }
    } catch (err) {
      console.error('Failed to load restaurants', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRestaurants();
  }, []);

  // Filtered list
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const matchStatus = selectedStatus === 'All' || (r.status || 'New Lead').toLowerCase() === selectedStatus.toLowerCase();
      const matchCity = selectedCity === 'All' || (r.city || '').toLowerCase() === selectedCity.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.phone && r.phone.toLowerCase().includes(q)) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.zip_code && r.zip_code.toLowerCase().includes(q)) ||
        (r.contact_person && r.contact_person.toLowerCase().includes(q));

      return matchStatus && matchCity && matchSearch;
    });
  }, [restaurants, selectedStatus, selectedCity, searchQuery]);

  const currentRestaurant = filteredRestaurants[currentIndex] || null;

  // Sync active edit states when current restaurant changes
  useEffect(() => {
    if (currentRestaurant) {
      setNotes(currentRestaurant.notes || '');
      setContactPerson(currentRestaurant.contact_person || '');
      setCallbackDate(currentRestaurant.callback_date || '');
      setEditForm({
        name: currentRestaurant.name || '',
        phone: currentRestaurant.phone || '',
        city: currentRestaurant.city || '',
        state: currentRestaurant.state || '',
        full_location: currentRestaurant.full_location || '',
      });
    }
  }, [currentRestaurant?.id]);

  // Ensure index remains in bounds
  useEffect(() => {
    if (currentIndex >= filteredRestaurants.length && filteredRestaurants.length > 0) {
      setCurrentIndex(0);
    }
  }, [filteredRestaurants.length, currentIndex]);

  // Unique cities for filter dropdown
  const uniqueCities = useMemo(() => {
    const set = new Set();
    restaurants.forEach((r) => {
      if (r.city) set.add(r.city.trim());
    });
    return Array.from(set).sort();
  }, [restaurants]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { All: restaurants.length };
    STATUS_CONFIG.forEach((c) => {
      if (c.name !== 'All') {
        counts[c.name] = restaurants.filter((r) => (r.status || 'New Lead').toLowerCase() === c.name.toLowerCase()).length;
      }
    });
    return counts;
  }, [restaurants]);

  // Actions
  const handleUpdateStatus = async (newStatus) => {
    if (!currentRestaurant) return;
    setSavingStatus(true);
    setSaveMessage('');

    try {
      const res = await fetch('/api/update-lead-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentRestaurant.id,
          status: newStatus,
          notes,
          contactPerson,
          callbackDate,
          currentAttempts: currentRestaurant.attempts,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRestaurants((prev) =>
          prev.map((r) => (r.id === currentRestaurant.id ? { ...r, ...data.restaurant } : r))
        );
        if (newStatus === 'Closed') {
          fireDealWonConfetti();
        } else if (newStatus === 'Meeting Scheduled') {
          fireMeetingBookedEffect();
        }
        setSaveMessage(`Status updated to ${newStatus}`);
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setSaveMessage('Error saving status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!currentRestaurant) return;
    setSavingStatus(true);
    try {
      const res = await fetch('/api/update-lead-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentRestaurant.id,
          status: currentRestaurant.status || 'New Lead',
          notes,
          contactPerson,
          callbackDate,
          incrementAttempts: false,
          attempts: currentRestaurant.attempts,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRestaurants((prev) =>
          prev.map((r) => (r.id === currentRestaurant.id ? { ...r, ...data.restaurant } : r))
        );
        setSaveMessage('Notes saved successfully');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveInfoEdit = async () => {
    if (!currentRestaurant) return;
    try {
      const res = await fetch('/api/update-lead-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentRestaurant.id,
          ...editForm,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRestaurants((prev) =>
          prev.map((r) => (r.id === currentRestaurant.id ? { ...r, ...data.restaurant } : r))
        );
        setIsEditingInfo(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyPhone = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setSaveMessage('Phone number copied to clipboard');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const nextLead = () => {
    if (currentIndex < filteredRestaurants.length - 1) {
      setSlideDirection('next');
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const prevLead = () => {
    if (currentIndex > 0) {
      setSlideDirection('prev');
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Sidebar Extra Content (Categories & Territory Filter)
  const sidebarExtra = (
    <div className="flex flex-col gap-5 py-2">
      <div>
        <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2.5 px-3">
          Pipeline Stages
        </div>
        <div className="space-y-1">
          {STATUS_CONFIG.map((cat) => {
            const active = selectedStatus === cat.name;
            const count = categoryCounts[cat.name] || 0;
            return (
              <button
                key={cat.name}
                onClick={() => {
                  setSelectedStatus(cat.name);
                  setCurrentIndex(0);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-muted hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className={`material-symbols-outlined text-[17px] ${cat.color}`}>{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums ${
                    active ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-outline-variant pt-4 px-1">
        <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2 px-2">
          Territory / City
        </label>
        <select
          value={selectedCity}
          onChange={(e) => {
            setSelectedCity(e.target.value);
            setCurrentIndex(0);
          }}
          className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface outline-none cursor-pointer focus:border-primary"
        >
          <option value="All">All Cities ({restaurants.length})</option>
          {uniqueCities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // Search slot for TopNav
  const searchSlot = (
    <div className="flex items-center gap-3 w-full max-w-md">
      <div className="relative w-full">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentIndex(0);
          }}
          placeholder="Search restaurant, phone, city, or zip..."
          className="w-full bg-surface-container-high border border-outline-variant rounded-full py-1.5 pl-9 pr-4 text-xs text-on-surface placeholder:text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        )}
      </div>

      <div className="header-btn h-9 flex items-center p-1 rounded-lg shrink-0">
        <button
          onClick={() => setViewMode('focus')}
          title="Single Business Focus"
          className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-colors cursor-pointer ${
            viewMode === 'focus' ? 'bg-primary text-on-primary font-bold' : 'text-muted hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">call</span>
          Focus
        </button>
        <button
          onClick={() => setViewMode('table')}
          title="List View"
          className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-colors cursor-pointer ${
            viewMode === 'table' ? 'bg-primary text-on-primary font-bold' : 'text-muted hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">list</span>
          List
        </button>
      </div>
    </div>
  );

  return (
    <AppShell title="Restaurant Sales CRM" search={searchSlot} sidebarExtra={sidebarExtra}>
      {saveMessage && (
        <div className="fixed top-20 right-8 z-50 bg-surface-container-high/95 backdrop-blur-md border border-emerald-500/40 text-on-surface px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2.5 animate-toast">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[12px] font-black shrink-0">
            ✓
          </span>
          <span>{saveMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="glass-card p-3 h-12 flex justify-between items-center">
            <div className="skeleton-shimmer h-4 w-36 rounded-md"></div>
            <div className="skeleton-shimmer h-4 w-28 rounded-md"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="glass-card p-4 h-36 flex flex-col justify-between">
                <div className="skeleton-shimmer h-5 w-48 rounded"></div>
                <div className="skeleton-shimmer h-3.5 w-64 rounded"></div>
                <div className="skeleton-shimmer h-6 w-32 rounded"></div>
              </div>
              <div className="glass-card p-4 h-40 flex flex-col justify-between">
                <div className="skeleton-shimmer h-3.5 w-28 rounded"></div>
                <div className="skeleton-shimmer h-7 w-44 rounded"></div>
                <div className="skeleton-shimmer h-10 w-full rounded-xl"></div>
              </div>
            </div>
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="glass-card p-4 h-28 flex flex-col justify-between">
                <div className="skeleton-shimmer h-3.5 w-36 rounded"></div>
                <div className="skeleton-shimmer h-12 w-full rounded-xl"></div>
              </div>
              <div className="glass-card p-4 h-64 flex flex-col justify-between">
                <div className="skeleton-shimmer h-3.5 w-40 rounded"></div>
                <div className="skeleton-shimmer flex-1 rounded-xl my-2"></div>
                <div className="skeleton-shimmer h-8 w-24 rounded-lg self-end"></div>
              </div>
            </div>
          </div>
        </div>
      ) : filteredRestaurants.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <span className="material-symbols-outlined text-4xl text-muted mb-2">storefront</span>
          <h2 className="text-lg font-bold text-on-surface mb-1">No restaurants found</h2>
          <p className="text-xs text-muted mb-4">
            Try adjusting your search query, status category, or city filter.
          </p>
          <button
            onClick={() => {
              setSelectedStatus('All');
              setSelectedCity('All');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-90 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE DIRECTORY VIEW */
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container/50">
            <div>
              <h2 className="text-sm font-bold text-on-surface">Restaurants Directory</h2>
              <p className="text-[11px] text-muted">
                Showing {filteredRestaurants.length} entries ({selectedStatus} in {selectedCity})
              </p>
            </div>
          </div>
          <div className="overflow-x-auto themed-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container text-muted text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Business Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Attempts</th>
                  <th className="py-3 px-4">Last Called</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRestaurants.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="border-b border-outline-variant/50 hover:bg-surface-container-high/60 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-on-surface">
                      <div className="flex items-center gap-2">
                        {r.image_url ? (
                          <img src={r.image_url} alt="" className="w-6 h-6 rounded object-cover border border-outline-variant shrink-0" />
                        ) : (
                          <span className="w-6 h-6 rounded bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                            {r.name?.[0] || 'R'}
                          </span>
                        )}
                        <span className="truncate max-w-[220px]">{r.name}</span>
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
                    <td className="py-3 px-4 text-muted text-[11px] truncate max-w-[150px]">
                      {r.last_called || 'Never'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setCurrentIndex(idx);
                          setViewMode('focus');
                        }}
                        className="px-2.5 py-1 rounded bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Call
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* SINGLE BUSINESS CALLING COCKPIT (SPACE-OPTIMIZED) */
        <div className="flex flex-col gap-4">
          {/* Integrated Compact Navigation & Status Header */}
          <div className="glass-card px-4 py-2.5 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={prevLead}
                disabled={currentIndex === 0}
                className="header-btn px-2.5 py-1 text-xs font-semibold text-muted hover:text-on-surface disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                Prev
              </button>
              <span className="text-xs font-semibold text-on-surface tabular-nums px-1">
                Lead <span className="text-primary font-bold">{currentIndex + 1}</span> of{' '}
                <span className="text-muted">{filteredRestaurants.length}</span>
              </span>
              <button
                onClick={nextLead}
                disabled={currentIndex >= filteredRestaurants.length - 1}
                className="header-btn px-2.5 py-1 text-xs font-semibold text-muted hover:text-on-surface disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                Next
                <span className="material-symbols-outlined text-[15px]">chevron_right</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted font-medium">Stage:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-container text-on-primary-container border border-primary/30">
                {currentRestaurant.status || 'New Lead'}
              </span>
              <button
                onClick={() => setIsEditingInfo(!isEditingInfo)}
                className="header-btn px-2.5 py-1 text-xs text-muted hover:text-on-surface flex items-center gap-1 ml-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span>
                {isEditingInfo ? 'Close' : 'Edit'}
              </button>
            </div>
          </div>

          {/* Edit Restaurant Info Dropdown Form */}
          {isEditingInfo && (
            <div className="glass-card p-4 border-primary/30 animate-in fade-in duration-150">
              <h3 className="text-xs font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">edit_note</span>
                Edit Business Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[10px] text-muted block mb-1">Restaurant Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg p-2 text-xs text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg p-2 text-xs text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg p-2 text-xs text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-muted block mb-1">Full Location Address</label>
                  <input
                    type="text"
                    value={editForm.full_location}
                    onChange={(e) => setEditForm({ ...editForm, full_location: e.target.value })}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg p-2 text-xs text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">State</label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg p-2 text-xs text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditingInfo(false)}
                  className="px-3 py-1 text-xs rounded-lg text-muted hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveInfoEdit}
                  className="px-4 py-1 text-xs font-bold rounded-lg bg-primary text-on-primary hover:opacity-90 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* MAIN CALLING COCKPIT: TIGHT 2-COLUMN BALANCED LAYOUT WITH DIRECTIONAL SLIDE ANIMATION */}
          <div
            key={currentRestaurant.id}
            className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch ${
              slideDirection === 'next' ? 'animate-slide-next' : 'animate-slide-prev'
            }`}
          >
            {/* LEFT COLUMN: BUSINESS INFO & DIRECT DIAL (5 of 12 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              {/* Business Identity Box */}
              <div className="glass-card p-4 flex flex-col gap-3 hover-lift">
                <div className="flex items-start gap-3">
                  {currentRestaurant.image_url ? (
                    <img
                      src={currentRestaurant.image_url}
                      alt={currentRestaurant.name}
                      className="w-14 h-14 rounded-xl object-cover border border-outline-variant shrink-0 bg-surface-container"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-black text-lg border border-primary/25 shrink-0">
                      {currentRestaurant.name?.[0] || 'R'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h1 className="text-lg font-black text-on-surface tracking-tight truncate leading-tight">
                        {currentRestaurant.name}
                      </h1>
                      <span className="text-[10px] font-mono text-muted bg-surface-container px-1.5 py-0.5 rounded">
                        #{currentRestaurant.id}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted flex items-start gap-1 mt-1 leading-snug">
                      <span className="material-symbols-outlined text-[14px] text-emerald-500 shrink-0 mt-0.5">location_on</span>
                      <span className="line-clamp-2">{currentRestaurant.full_location || `${currentRestaurant.city}, ${currentRestaurant.state}`}</span>
                    </p>
                  </div>
                </div>

                {/* Quick Link Buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-outline-variant/60 flex-wrap">
                  {currentRestaurant.listing_url && (
                    <a
                      href={currentRestaurant.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="header-btn px-2.5 py-1 text-[11px] text-amber-500 hover:text-amber-600 flex items-center gap-1 font-semibold pressable-btn"
                    >
                      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                      YellowPages
                    </a>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      currentRestaurant.name + ' ' + (currentRestaurant.full_location || currentRestaurant.city)
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="header-btn px-2.5 py-1 text-[11px] text-sky-500 hover:text-sky-600 flex items-center gap-1 font-semibold pressable-btn"
                  >
                    <span className="material-symbols-outlined text-[13px]">map</span>
                    Google Maps
                  </a>
                </div>
              </div>

              {/* Integrated Direct Dial Widget */}
              <div className="glass-card p-4 flex flex-col gap-2.5 bg-gradient-to-br from-surface-container-high/60 to-surface-container hover-lift">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Direct Phone Line
                  </span>
                  <button
                    onClick={() => copyPhone(currentRestaurant.phone)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium pressable-btn"
                  >
                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                    Copy
                  </button>
                </div>

                <div className="text-xl font-mono font-black text-on-surface tracking-wide">
                  {currentRestaurant.phone || 'No Phone Available'}
                </div>

                <a
                  href={currentRestaurant.phone ? `tel:${currentRestaurant.phone.replace(/\D/g, '')}` : '#'}
                  onClick={() => handleUpdateStatus(currentRestaurant.status || 'Connected')}
                  className={`w-full py-2.5 rounded-xl font-black text-center text-xs flex items-center justify-center gap-2 shadow-md transition-all transform active:scale-95 pressable-btn ${
                    currentRestaurant.phone
                      ? 'bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white shadow-emerald-500/20 cursor-pointer animate-radar'
                      : 'bg-muted text-gray-400 opacity-50 cursor-not-allowed pointer-events-none'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">call</span>
                  CLICK TO CALL
                </a>

                <div className="flex justify-between items-center text-[10px] text-muted pt-1 border-t border-outline-variant/60">
                  <span>Calls: <strong className="text-on-surface tabular-nums">{currentRestaurant.attempts || 0}</strong></span>
                  <span className="truncate max-w-[160px] text-right">
                    {currentRestaurant.last_called ? `Last: ${currentRestaurant.last_called.split(' by ')[0]}` : 'Never contacted'}
                  </span>
                </div>
              </div>

              {/* Contact Person & Callback inputs */}
              <div className="glass-card p-3.5 flex flex-col gap-2.5 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                    Contact Person / Decision Maker
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Owner, General Manager..."
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                    Callback / Follow-Up Date
                  </label>
                  <input
                    type="date"
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: CALL OUTCOMES & INTERACTIVE NOTES (7 of 12 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              {/* Call Outcomes Box */}
              <div className="glass-card p-4 flex flex-col gap-2.5">
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider flex justify-between items-center">
                  <span>Log Call Outcome</span>
                  <span className="text-[10px] font-normal lowercase text-muted">1-click update</span>
                </div>

                {/* 2-Row Dense Outcome Action Buttons with Press Feedback */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleUpdateStatus('Connected')}
                    disabled={savingStatus}
                    className="py-2 px-2 rounded-xl font-bold text-[11px] bg-blue-500/15 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer pressable-btn hover-lift active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">phone_in_talk</span>
                    Connected
                  </button>

                  <button
                    onClick={() => handleUpdateStatus('Follow Up')}
                    disabled={savingStatus}
                    className="py-2 px-2 rounded-xl font-bold text-[11px] bg-amber-500/15 text-amber-500 hover:bg-amber-600 hover:text-white border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer pressable-btn hover-lift active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">schedule</span>
                    Follow Up
                  </button>

                  <button
                    onClick={() => handleUpdateStatus('Interested')}
                    disabled={savingStatus}
                    className="py-2 px-2 rounded-xl font-bold text-[11px] bg-purple-500/15 text-purple-500 hover:bg-purple-600 hover:text-white border border-purple-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer pressable-btn hover-lift active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">star</span>
                    Interested
                  </button>

                  <button
                    onClick={() => handleUpdateStatus('Meeting Scheduled')}
                    disabled={savingStatus}
                    className="py-2 px-2 rounded-xl font-bold text-[11px] bg-cyan-500/15 text-cyan-500 hover:bg-cyan-600 hover:text-white border border-cyan-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer pressable-btn hover-lift active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">event</span>
                    Meeting Set
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleUpdateStatus('Closed')}
                    disabled={savingStatus}
                    className="py-2 px-2 rounded-xl font-bold text-[11px] bg-emerald-500/15 text-emerald-500 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer pressable-btn hover-lift active:scale-95 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    Closed / Won
                  </button>

                  <button
                    onClick={() => handleUpdateStatus('No Answer')}
                    disabled={savingStatus}
                    className="py-2 px-2 rounded-xl font-bold text-[11px] bg-slate-500/15 text-slate-400 hover:bg-slate-600 hover:text-white border border-slate-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer pressable-btn hover-lift active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">phone_missed</span>
                    No Answer
                  </button>

                  <button
                    onClick={() => handleUpdateStatus('Not Interested')}
                    disabled={savingStatus}
                    className="py-2 px-2 rounded-xl font-bold text-[11px] bg-rose-500/15 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer pressable-btn hover-lift active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">cancel</span>
                    Not Interested
                  </button>
                </div>
              </div>

              {/* Conversation Notes Box (Fills remaining height) */}
              <div className="glass-card p-4 flex-1 flex flex-col gap-2 min-h-[260px]">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">chat</span>
                    Call Conversation Notes
                  </label>
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingStatus}
                    className="px-3 py-1 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-90 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[14px]">save</span>
                    Save Notes
                  </button>
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record discussion details: contact name, current POS/delivery setup, pain points, pricing quoted, decision timeline, follow-up commitments..."
                  className="w-full flex-1 bg-surface-container-high border border-outline-variant rounded-xl p-3 text-xs text-on-surface outline-none focus:border-primary leading-relaxed resize-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
