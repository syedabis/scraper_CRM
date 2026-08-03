'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '../components/AppShell';
import { getPendingActionsByStatus, filterLeadsNeedingAttempt, filterLeadsWithCompletedAttempts, splitSlotEntries } from '../lib/pendingConfirmations';

const ATTEMPT_ORDINALS = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };

export default function Calling() {
  const [leads, setLeads] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState('Pretty');
  const [tooltipMessage, setTooltipMessage] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState('');
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', email: '', phone: '' });
  const [updatingLead, setUpdatingLead] = useState(false);
  const [currentTimeSlot, setCurrentTimeSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [statusDate, setStatusDate] = useState('');
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [selectedAttemptNeeded, setSelectedAttemptNeeded] = useState(null);

  const STATUSES_REQUIRING_DATE = ['Enrolled', 'Payment Pending (Confirmation)', 'Demo', 'Follow Up'];

  // Old status text still sitting in the sheet from before the rename — kept
  // here so filtering/counting by the new category names still surfaces it.
  const STATUS_ALIASES = {
    'Connected': ['Call Received'],
    'No Answer': ['Not Received'],
    'Follow Up': ['Call Later', 'Awaiting Response'],
    'Registration': ['Form Filled'],
    'Payment Pending (Confirmation)': ['Confirmation'],
    'Enrolled': ['Paid'],
    'Lost': ['Client Lost'],
  };

  const leadCategories = [
    { name: 'New Leads', icon: 'group_add' },
    { name: 'Connected', icon: 'call_received' },
    { name: 'No Answer', icon: 'call_missed' },
    { name: 'Follow Up', icon: 'schedule' },
    { name: 'Registration', icon: 'assignment' },
    { name: 'Payment Pending (Confirmation)', icon: 'verified' },
    { name: 'Demo', icon: 'present_to_all' },
    { name: 'Enrolled', icon: 'payments' },
    { name: 'Lost', icon: 'person_off' },
  ];

  const statusActions = [
    { status: 'Connected', label: 'Connected', className: 'bg-[#F6992D] text-[#1f2937] hover:brightness-95 border border-transparent' },
    { status: 'No Answer', label: 'No Answer', className: 'bg-[#ED6A5A] text-white hover:brightness-110 border border-transparent' },
    { status: 'Follow Up', label: 'Follow Up', className: 'bg-[#A75A5A] text-white hover:brightness-110 border border-transparent' },
    { status: 'Registration', label: 'Registration', className: 'bg-[#4C7680] text-white hover:brightness-110 border border-transparent' },
    { status: 'Payment Pending (Confirmation)', label: 'Payment Pending (Confirmation)', className: 'bg-[#7DBA60] text-white hover:brightness-110 border border-transparent' },
    { status: 'Demo', label: 'Demo', className: 'bg-[#38A3A5] text-white hover:brightness-110 border border-transparent' },
    { status: 'Enrolled', label: 'Enrolled', className: 'bg-[#C2D11B] text-[#1f2937] hover:brightness-95 border border-transparent' },
    { status: 'Lost', label: 'Lost', className: 'bg-[#60495A] text-white hover:brightness-125 border border-transparent' },
  ];

  // Function to get current Pakistani time slot
  const getCurrentTimeSlot = () => {
    // Get current UTC time and convert to Pakistan time (UTC+5)
    const now = new Date();
    const utcTime = now.getTime();
    const pakistanOffset = 5 * 60 * 60 * 1000; // Pakistan is UTC+5
    const pakistanTime = new Date(utcTime + pakistanOffset);

    const hours = pakistanTime.getUTCHours();
    const minutes = pakistanTime.getUTCMinutes();
    const timeInMinutes = hours * 60 + minutes;

    if (timeInMinutes >= 9 * 60 && timeInMinutes <= 11 * 60) {
      return 'Slot 1 (9:00 AM - 11:00 AM)';
    } else if (timeInMinutes >= 11 * 60 + 1 && timeInMinutes <= 13 * 60) {
      return 'Slot 2 (11:00 AM - 1:00 PM)';
    } else if (timeInMinutes >= 13 * 60 + 1 && timeInMinutes <= 16 * 60) {
      return 'Slot 3 (1:00 PM - 4:00 PM)';
    } else {
      return 'Slot 4 (4:00 PM - 6:00 PM)';
    }
  };

  // Update time slot every minute
  useEffect(() => {
    const updateTimeSlot = () => {
      setCurrentTimeSlot(getCurrentTimeSlot());
    };

    updateTimeSlot(); // Set initial time slot
    const interval = setInterval(updateTimeSlot, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Always work off the "Pretty" sheet
  useEffect(() => {
    fetchLeads('Pretty').catch((error) => {
      setTooltipMessage(error.message || 'Failed to load leads');
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 4000);
    });
  }, []);

  const fetchLeads = async (owner) => {
    if (!owner) return [];
    setLoading(true);
    try {
      const response = await fetch(`/api/fetch-leads?sheetName=${encodeURIComponent(owner)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch leads');
      }
      const data = await response.json();
      setLeads(data);
      return data; // Do NOT call filterLeadsByStatus here!
    } catch (error) {
      setLeads([]);
      setFilteredLeads([]);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // New function to re-fetch leads while preserving current status and position
  const refreshLeads = async (owner) => {
    if (!owner) return;

    try {
      const response = await fetch(`/api/fetch-leads?sheetName=${encodeURIComponent(owner)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }
      const data = await response.json();
      setLeads(data);

      // Preserve current position within whichever filter was active
      const currentRowNumber = currentLead?.[0];
      if (selectedAttemptNeeded) {
        setFilteredLeads(getAttemptFilterLeads(data, selectedAttemptNeeded));
      } else {
        filterLeadsByStatus(selectedStatus, data);
      }

      // Find and set the same lead position
      if (currentRowNumber) {
        const newIndex = filteredLeads.findIndex(lead => lead[0] === currentRowNumber);
        if (newIndex !== -1) {
          setCurrentIndex(newIndex);
        }
      }
    } catch (error) {
      console.error('Error refreshing leads:', error);
    }
  };

  const filterLeadsByStatus = (status, leadsToFilter = leads) => {
    setSelectedStatus(status);
    let filtered;
    if (status === 'New Leads') {
      filtered = leadsToFilter.filter(lead => !lead[6] || lead[6].trim() === '');
    } else {
      const matchNames = [status, ...(STATUS_ALIASES[status] || [])].map((s) => s.trim().toLowerCase());
      filtered = leadsToFilter.filter(
        lead => matchNames.includes((lead[6] || '').trim().toLowerCase())
      );
    }
    setFilteredLeads(filtered);
    setCurrentIndex(0);
    return filtered;
  };

  const handleStatusSelect = (status) => {
    setSelectedAttemptNeeded(null);
    filterLeadsByStatus(status);
  };

  // n is 1-4 for the attempt tabs, or 'completed' for leads who've used all
  // 4 slots without a final status.
  const getAttemptFilterLeads = (leadsToFilter, n) =>
    n === 'completed' ? filterLeadsWithCompletedAttempts(leadsToFilter) : filterLeadsNeedingAttempt(leadsToFilter, n);

  const handleAttemptNeededSelect = (n) => {
    setSelectedStatus('');
    setSelectedAttemptNeeded(n);
    setFilteredLeads(getAttemptFilterLeads(leads, n));
    setCurrentIndex(0);
  };

  const handleEditClick = () => {
    if (!currentLead) return;
    setEditData({
      name: currentLead[3] || '',
      email: currentLead[4] || '',
      phone: currentLead[5] || ''
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!currentLead || !selectedOwner) return;

    setUpdatingLead(true);
    try {
      const response = await fetch('/api/update-lead-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: currentLead[0],
          owner: selectedOwner,
          name: editData.name,
          email: editData.email,
          phone: editData.phone
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update lead information');
      }

      setTooltipMessage('Lead information updated successfully!');
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);

      // Re-fetch leads to get the latest data
      await refreshLeads(selectedOwner);

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating lead information:', error);
      setTooltipMessage(error.message || 'Failed to update lead information');
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
    } finally {
      setUpdatingLead(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({ name: '', email: '', phone: '' });
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredLeads.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < filteredLeads.length - 1 ? prev + 1 : 0));
  };

  const currentLead = filteredLeads[currentIndex];

  const pendingActionGroups = useMemo(() => getPendingActionsByStatus(leads), [leads]);
  const pendingActionStatuses = Object.keys(pendingActionGroups);

  // "Still needed" per attempt number (1st-4th) — mirrors the Dashboard's
  // Leads by Attempts cards. Clicking one pages through the matching leads
  // using the same detail view as any other category.
  const attemptsNeededCounts = useMemo(
    () => [1, 2, 3, 4].map((n) => ({ n, count: filterLeadsNeedingAttempt(leads, n).length })),
    [leads]
  );
  const completedAttemptsCount = useMemo(() => filterLeadsWithCompletedAttempts(leads).length, [leads]);
  const allPendingItems = useMemo(
    () =>
      pendingActionStatuses.flatMap((statusName) =>
        pendingActionGroups[statusName].map((item) => ({ ...item, status: statusName }))
      ),
    [pendingActionGroups, pendingActionStatuses]
  );

  // Auto-close the pending-actions modal if everything gets resolved while
  // it's open (e.g. the last pending lead just got updated).
  useEffect(() => {
    if (showPendingModal && allPendingItems.length === 0) {
      setShowPendingModal(false);
    }
  }, [allPendingItems, showPendingModal]);

  const handleStatusChange = async (status, dateForStatus) => {
    if (!currentLead) {
      setTooltipMessage('No lead selected');
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
      return;
    }

    if (!selectedOwner) {
      setTooltipMessage('No owner selected');
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
      return;
    }

    try {
      setUpdatingStatus(status);
      const rowNumber = currentLead[0];
      const payload = {
        rowIndex: rowNumber,
        status,
        owner: selectedOwner,
        timeSlot: currentTimeSlot,
        notes: notes.trim(),
        ...(dateForStatus ? { statusDate: dateForStatus } : {}),
      };
      const response = await fetch('/api/update-lead-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      setTooltipMessage('Status updated successfully!');
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);

      // Clear notes after successful update
      setNotes('');

      // Clear the date prompt, if it was open for this status
      setPendingStatus(null);
      setStatusDate('');

      // Re-fetch leads to get the latest slot column values
      await refreshLeads(selectedOwner);

      // Small delay to ensure UI updates properly
      await new Promise(resolve => setTimeout(resolve, 500));

      // Stay on the same lead instead of moving to next
      // The current lead will be updated with fresh data

    } catch (error) {
      console.error('Error updating status:', error);
      setTooltipMessage(error.message || 'Failed to update status');
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
    } finally {
      setUpdatingStatus('');
    }
  };

  // Paid/Confirmation need a mandatory date first — open the prompt instead
  // of updating immediately for those two statuses.
  const handleStatusButtonClick = (status) => {
    if (STATUSES_REQUIRING_DATE.includes(status)) {
      setPendingStatus(status);
      setStatusDate(new Date().toISOString().slice(0, 10));
      return;
    }
    handleStatusChange(status);
  };

  const handleConfirmStatusDate = () => {
    if (!pendingStatus || !statusDate) return;
    handleStatusChange(pendingStatus, statusDate);
  };

  const handleCancelStatusDate = () => {
    setPendingStatus(null);
    setStatusDate('');
  };

  // Search function for phone numbers
  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch('/api/fetch-leads?sheetName=Pretty');
      const data = response.ok ? await response.json() : [];

      // Search through leads by phone number (index 5)
      const results = data.filter(lead => {
        const phoneNumber = lead[5] || '';
        return phoneNumber.toString().includes(query.toString());
      });

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching leads:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Function to navigate to a specific lead from search results
  const navigateToLead = async (lead) => {
    const leadRowNumber = lead[0];
    const leadStatus = lead[6] || 'New Leads';

    // Use the returned filtered array directly
    const filtered = filterLeadsByStatus(leadStatus, leads);
    const filteredIndex = filtered.findIndex(l => l[0] === leadRowNumber);
    if (filteredIndex !== -1) {
      setCurrentIndex(filteredIndex);
    } else {
      console.error('Lead not in filtered results. Status:', leadStatus, 'Row:', leadRowNumber, 'Filtered:', filtered);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const getCategoryCount = (name) => {
    if (name === 'New Leads') {
      return leads.filter(lead => !lead[6] || lead[6].trim() === '').length;
    }
    const matchNames = [name, ...(STATUS_ALIASES[name] || [])];
    return leads.filter(lead => matchNames.includes(lead[6])).length;
  };

  // Each slot cell (G-J) is a fixed time-of-day window, not an attempt
  // number — once a window has been reused, its cell holds more than one
  // comma-separated "Status (M/D/YYYY, h:mm:ss AM/PM)" entry. "Last Reached"
  // is the most recent timestamp across every entry in all 4 slots.
  const getLastReachedLabel = (lead) => {
    if (!lead) return null;
    let latest = null;
    for (const idx of [7, 8, 9, 10]) {
      const entries = splitSlotEntries(lead[idx]);
      for (const entry of entries) {
        const match = entry.match(/\((\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)\)/i);
        if (!match) continue;
        const [, month, day, year, rawHour, minute, second, ampm] = match;
        let hour = parseInt(rawHour, 10) % 12;
        if (/pm/i.test(ampm)) hour += 12;
        const ts = new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second));
        if (!latest || ts > latest) latest = ts;
      }
    }
    if (!latest) return null;
    const dd = String(latest.getDate()).padStart(2, '0');
    const mm = String(latest.getMonth() + 1).padStart(2, '0');
    const time = latest.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${dd}/${mm}/${latest.getFullYear()} ${time}`;
  };

  const renderSlotHistory = (index, slotName, timeRange) => {
    const entries = splitSlotEntries(currentLead?.[index]);
    return (
      <div className="bg-surface-container-high rounded-lg px-3 py-2" key={slotName}>
        <span className="text-label-sm">
          <span className="font-semibold text-on-surface uppercase tracking-wider">{slotName}</span>{' '}
          <span className="text-on-surface-variant/70">[{timeRange}]</span>
        </span>
        {entries.length > 0 ? (
          entries.map((entry, i) => (
            <div key={i} className="text-label-sm text-primary font-semibold truncate">
              [{entry.toUpperCase()}]
            </div>
          ))
        ) : (
          <div className="text-label-sm text-on-surface-variant">[NO CALL MADE]</div>
        )}
      </div>
    );
  };

  const search = (
    <div className="relative w-full max-w-md">
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
      <input
        className="w-full bg-surface-container-high border border-outline-variant rounded-full py-2 pl-10 pr-4 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
        placeholder="Search by phone number..."
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {searchResults.length > 0 && searchQuery && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-outline-variant rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto themed-scrollbar">
          {searchResults.map((lead, index) => (
            <button
              key={index}
              onClick={() => navigateToLead(lead)}
              className="w-full p-3 text-left hover:bg-surface-container-highest border-b border-outline-variant last:border-b-0 transition-colors"
            >
              <div className="text-on-surface text-body-md">{lead[5] || 'No Phone'}</div>
              <div className="text-primary text-label-sm">{lead[3] || 'No Name'}</div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant text-label-sm">{lead[6] || 'New Lead'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {searchQuery && !isSearching && searchResults.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-outline-variant rounded-lg shadow-lg z-50 p-3">
          <div className="text-on-surface-variant text-center text-body-md">No leads found</div>
        </div>
      )}
      {isSearching && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-outline-variant rounded-lg shadow-lg z-50 p-3">
          <div className="text-on-surface-variant text-center text-body-md">Searching...</div>
        </div>
      )}
    </div>
  );

  const sidebarFooter = (
    <div className="flex items-center gap-3 text-on-surface-variant border-t border-outline-variant px-4 py-3">
      <span className="material-symbols-outlined text-[18px]">history_toggle_off</span>
      <span className="text-label-md">{currentTimeSlot}</span>
    </div>
  );

  const sidebarExtra = (
    <div>
      <div className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-2 px-4">
        Lead Categories
      </div>
      <ul className="space-y-1">
        {leadCategories.map((category) => {
          const active = selectedStatus === category.name;
          const count = getCategoryCount(category.name);
          return (
            <li key={category.name}>
              <button
                onClick={() => handleStatusSelect(category.name)}
                className={`w-full flex items-start gap-3 rounded-lg px-4 py-2 transition-all duration-200 ${
                  active
                    ? 'bg-secondary-container text-on-secondary-container border-l-4 border-secondary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                <span className="material-symbols-outlined shrink-0">{category.icon}</span>
                <span className="text-label-md leading-tight text-left flex-1">{category.name}</span>
                <span
                  className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-label-sm ${
                    active ? 'bg-secondary text-on-secondary' : 'bg-surface-variant'
                  }`}
                >
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="text-label-sm text-on-surface-variant uppercase tracking-wider mt-6 mb-2 px-4">
        Still Needed
      </div>
      <ul className="space-y-1">
        {attemptsNeededCounts.map(({ n, count }) => {
          const active = selectedAttemptNeeded === n;
          return (
            <li key={n}>
              <button
                onClick={() => handleAttemptNeededSelect(n)}
                className={`w-full flex items-start gap-3 rounded-lg px-4 py-2 transition-all duration-200 ${
                  active
                    ? 'bg-secondary-container text-on-secondary-container border-l-4 border-secondary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                <span className="material-symbols-outlined shrink-0">call</span>
                <span className="text-label-md leading-tight text-left flex-1">{ATTEMPT_ORDINALS[n]} Attempt</span>
                <span
                  className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-label-sm ${
                    active ? 'bg-secondary text-on-secondary' : 'bg-surface-variant'
                  }`}
                >
                  {count}
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            onClick={() => handleAttemptNeededSelect('completed')}
            className={`w-full flex items-start gap-3 rounded-lg px-4 py-2 transition-all duration-200 ${
              selectedAttemptNeeded === 'completed'
                ? 'bg-secondary-container text-on-secondary-container border-l-4 border-secondary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-highest'
            }`}
          >
            <span className="material-symbols-outlined shrink-0">check_circle</span>
            <span className="text-label-md leading-tight text-left flex-1">Completed Attempts</span>
            <span
              className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-label-sm ${
                selectedAttemptNeeded === 'completed' ? 'bg-secondary text-on-secondary' : 'bg-surface-variant'
              }`}
            >
              {completedAttemptsCount}
            </span>
          </button>
        </li>
      </ul>
    </div>
  );

  return (
    <AppShell title="Cognos Sales CRM" search={search} sidebarExtra={sidebarExtra} sidebarFooter={sidebarFooter}>
      {showTooltip && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-4 py-2 rounded-lg shadow-lg z-50 border border-outline-variant">
          {tooltipMessage}
        </div>
      )}

      {pendingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-container rounded-xl border border-outline-variant p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-headline-sm font-semibold mb-1">{pendingStatus} Date</h3>
            <p className="text-body-md text-on-surface-variant mb-4">
              Enter the date for this {pendingStatus.toLowerCase()} before saving.
            </p>
            <input
              type="date"
              required
              autoFocus
              value={statusDate}
              onChange={(e) => setStatusDate(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant rounded-lg p-3 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelStatusDate}
                className="px-4 py-2 rounded-md text-label-md bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusDate}
                disabled={!statusDate || updatingStatus === pendingStatus}
                className="px-4 py-2 rounded-md text-label-md bg-secondary text-on-secondary hover:opacity-90 disabled:opacity-50"
              >
                {updatingStatus === pendingStatus ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {allPendingItems.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowPendingModal(true)}
            className="bg-error-container border border-error text-on-error-container rounded-xl px-4 py-3 flex items-center gap-3 hover:brightness-110 transition-all"
          >
            <span className="material-symbols-outlined text-error">notifications_active</span>
            <span className="text-left">
              <span className="text-body-md font-semibold block">{allPendingItems.length} student{allPendingItems.length === 1 ? '' : 's'} to look up</span>
              <span className="text-label-sm">{pendingActionStatuses.join(', ')}</span>
            </span>
          </button>
        </div>
      )}

      {showPendingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowPendingModal(false)}
        >
          <div
            className="bg-surface-container rounded-xl border border-outline-variant p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto themed-scrollbar shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-headline-sm font-semibold">Pending follow-ups ({allPendingItems.length})</h3>
              <button
                onClick={() => setShowPendingModal(false)}
                className="p-1 rounded-full hover:bg-surface-container-highest transition-colors duration-150"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="space-y-2">
              {allPendingItems.map((item) => (
                <div
                  key={item.rowNumber}
                  className="bg-surface-container-high rounded-lg p-3 flex justify-between items-center gap-3"
                >
                  <div>
                    <div className="text-body-md font-semibold text-on-surface">{item.name}</div>
                    <div className="text-label-sm text-on-surface-variant">{item.phone || 'No phone'}</div>
                  </div>
                  <div className="text-label-sm text-on-surface-variant text-right">
                    <div>{item.status}</div>
                    <div>{item.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {loading ? (
          <div className="text-center text-on-surface-variant py-16">Loading leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-surface-container rounded-xl border border-outline-variant p-12 text-center">
            <h2 className="text-headline-md font-bold text-on-surface mb-2">No leads found</h2>
            <p className="text-body-md text-on-surface-variant">
              {selectedAttemptNeeded === 'completed'
                ? 'Nobody has completed all 4 attempts without a final status right now.'
                : selectedAttemptNeeded
                ? `Nobody needs their ${ATTEMPT_ORDINALS[selectedAttemptNeeded]} attempt right now.`
                : selectedStatus === 'New Leads'
                ? 'No new leads available.'
                : selectedStatus
                ? `No leads with status "${selectedStatus}" found.`
                : 'Pick a lead category from the sidebar to get started.'}
            </p>
          </div>
        ) : (
          <>
            {/* Lead Info Header */}
            <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="col-span-1 md:col-span-5 bg-surface-container rounded-xl border border-outline-variant p-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high text-on-surface-variant text-label-md border-b border-outline-variant">
                      <th className="p-4 font-semibold">Name</th>
                      <th className="p-4 font-semibold">Phone</th>
                      <th className="p-4 font-semibold">Email</th>
                      <th className="p-4 font-semibold">Lead Received</th>
                      <th className="p-4 font-semibold text-center">Attempts</th>
                      {selectedAttemptNeeded === 4 && (
                        <th className="p-4 font-semibold">Last Reached</th>
                      )}
                      <th className="p-4 font-semibold text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={updatingLead}
                              className="px-3 py-1 rounded-md text-label-md bg-secondary text-on-secondary hover:opacity-90 disabled:opacity-50"
                            >
                              {updatingLead ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 rounded-md text-label-md bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleEditClick}
                            className="flex items-center gap-1 px-3 py-1 rounded-md text-label-md bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary ml-auto"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Edit
                          </button>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-body-md hover:bg-surface-container-highest transition-colors">
                      <td className="p-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            className="w-full bg-surface-container-high border border-outline-variant rounded-md px-2 py-1 text-on-surface outline-none focus:border-primary"
                          />
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-secondary" />
                            {currentLead?.[3] || ''}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.phone}
                            onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                            className="w-full bg-surface-container-high border border-outline-variant rounded-md px-2 py-1 text-on-surface outline-none focus:border-primary"
                          />
                        ) : (
                          currentLead?.[5] || ''
                        )}
                      </td>
                      <td className="p-4 text-on-surface-variant">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editData.email}
                            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                            className="w-full bg-surface-container-high border border-outline-variant rounded-md px-2 py-1 text-on-surface outline-none focus:border-primary"
                          />
                        ) : (
                          currentLead?.[4] || 'Not provided'
                        )}
                      </td>
                      <td className="p-4">{currentLead?.[1] || ''} {currentLead?.[2] || ''}</td>
                      <td className="p-4 text-center font-bold text-primary">{currentLead?.[11] || 0}</td>
                      {selectedAttemptNeeded === 4 && (
                        <td className="p-4 text-on-surface-variant">{getLastReachedLabel(currentLead) || '—'}</td>
                      )}
                      <td className="p-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Update Status — full width */}
            <div className="bg-surface-container rounded-xl border border-outline-variant p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-headline-sm font-semibold">Update Status</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevious}
                    className="p-1 rounded-full hover:bg-surface-container-highest transition-colors duration-150"
                    aria-label="Previous lead"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px] block">chevron_left</span>
                  </button>
                  <span className="text-label-sm text-on-surface-variant whitespace-nowrap px-1">
                    Lead {currentIndex + 1} of {filteredLeads.length}
                  </span>
                  <button
                    onClick={handleNext}
                    className="p-1 rounded-full hover:bg-surface-container-highest transition-colors duration-150"
                    aria-label="Next lead"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px] block">chevron_right</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {statusActions.map((action) => (
                  <button
                    key={action.status}
                    onClick={() => handleStatusButtonClick(action.status)}
                    disabled={updatingStatus === action.status}
                    className={`py-2 px-3 rounded-lg text-label-md transition-colors text-center shadow-sm ${action.className} ${
                      updatingStatus === action.status ? 'opacity-60 cursor-wait' : ''
                    }`}
                  >
                    {updatingStatus === action.status ? 'Updating...' : action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes + Call History — below Update Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface-container rounded-xl border border-outline-variant p-6 flex flex-col gap-4">
                <label className="text-headline-sm font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">edit_note</span>
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg p-3 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none outline-none"
                  placeholder="Enter any notes about this call or lead..."
                  rows="2"
                />
              </div>

              <div className="bg-surface-container rounded-xl border border-outline-variant p-6 flex flex-col gap-3">
                <h3 className="text-headline-sm font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">history</span>
                  Call History
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {renderSlotHistory(7, 'Slot 1', '9:00 AM - 11:00 AM')}
                  {renderSlotHistory(8, 'Slot 2', '11:00 AM - 1:00 PM')}
                  {renderSlotHistory(9, 'Slot 3', '1:00 PM - 4:00 PM')}
                  {renderSlotHistory(10, 'Slot 4', '4:00 PM - 6:00 PM')}
                </div>
                {currentLead?.[12] && (
                  <div className="bg-surface-container-high rounded-lg p-3">
                    <h4 className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Saved Notes</h4>
                    <p className="text-body-md text-on-surface whitespace-pre-wrap">{currentLead[12]}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sales Pitch */}
            <div className="flex flex-col gap-4">
              <div className="bg-inverse-surface text-inverse-on-surface rounded-xl p-8 shadow-md border border-outline-variant h-full leading-relaxed text-body-lg">
                <p className="mb-4">Assalam o Alaikum!</p>
                <p className="mb-4">
                  Aap ne WhatsApp par humse contact kiya tha regarding our{' '}
                  <strong className="font-bold text-on-primary-container">Data Science Bootcamp</strong>. Kya aap is
                  bootcamp ke baare mein aur janna chahenge?
                </p>
                <p className="mb-2">Toh let me explain — yeh <strong className="font-bold">4-month ka complete bootcamp</strong> hai:</p>
                <ul className="space-y-2 mb-6 ml-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">◆</span>
                    <span>1st Month – Python programming: from basics to data handling</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">◆</span>
                    <span>2nd Month – Machine Learning: algorithms, model building</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">◆</span>
                    <span>3rd Month – Deep Learning: neural networks, CNNs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">◆</span>
                    <span>
                      4th Month – Generative AI: jisme aap apna <strong className="font-bold text-on-primary-container">khud ka chatbot</strong> build
                      kar saktay hain using advanced GenAI tools
                    </span>
                  </li>
                </ul>
                <p className="mb-4 flex items-start gap-2">
                  <span className="text-xl">✨</span>
                  <span>
                    <strong className="font-bold">Assignments har week diye jate hain</strong> aur unka{' '}
                    <strong className="font-bold">feedback within 1 hour</strong> mil jata hai — taake aap fast pace pe
                    improve kar sakein.
                  </span>
                </p>
                <p className="mb-4">
                  Mujhe aapke background ke baare mein thoda batayein, taake main aapko aur ache se guide kar sakun.
                  Aapka current field kya hai?
                </p>
                <p className="mb-4 flex items-start gap-2">
                  <span className="text-secondary mt-1">✔</span>
                  <span>
                    Agar aap <strong className="font-bold text-on-secondary-container">80% ya us se zyada score</strong>{' '}
                    karte hain in assignments mein, toh aapko <strong className="font-bold">remote internship</strong>{' '}
                    milti hai — jisse aapka <strong className="font-bold">professional experience</strong> build hota
                    hai.
                  </span>
                </p>
                <p className="mb-6 flex items-start gap-2">
                  <span className="text-xl">📝</span>
                  <span>
                    Plus, hum aapki <strong className="font-bold">LinkedIn aur Resume optimization</strong> mein bhi
                    help karte hain taake job market ke liye aap ready ho jayein.
                  </span>
                </p>
                <p className="mb-4">Kya aapko yeh information helpful lagi? Ya koi aur sawal hain aapke mind mein?</p>
                <p className="mb-4">
                  If you&apos;re interested, just let me know — I&apos;ll share the{' '}
                  <strong className="font-bold">registration link and next steps</strong> with you.
                </p>
                <p className="flex items-center gap-2">
                  <strong className="font-bold text-error-container">Limited seats hain</strong>, so don&apos;t miss this
                  opportunity! 🚀
                </p>
              </div>
            </div>

          </>
        )}
      </div>
    </AppShell>
  );
}
