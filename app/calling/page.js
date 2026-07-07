'use client';

import { useState, useEffect } from 'react';
import AppShell from '../components/AppShell';

export default function Calling() {
  const [leads, setLeads] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState('');
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

  const leadCategories = [
    { name: 'New Leads', icon: 'group_add' },
    { name: 'Call Received', icon: 'call_received' },
    { name: 'Not Received', icon: 'call_missed' },
    { name: 'Call Later', icon: 'schedule' },
    { name: 'Client Lost', icon: 'person_off' },
    { name: 'Confirmation', icon: 'verified' },
    { name: 'Paid', icon: 'payments' },
    { name: 'Demo', icon: 'present_to_all' },
    { name: 'Form Filled', icon: 'assignment' },
    { name: 'Group Lead', icon: 'groups' },
    { name: 'Awaiting Response', icon: 'hourglass_top' },
  ];

  const statusActions = [
    { status: 'Call Received', label: 'Call Received', className: 'bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-on-secondary border border-secondary' },
    { status: 'Not Received', label: 'Not Received', className: 'bg-error-container text-on-error-container hover:bg-error hover:text-on-error border border-transparent' },
    { status: 'Call Later', label: 'Please Call Later', className: 'bg-tertiary-container text-on-tertiary-container hover:bg-tertiary hover:text-on-tertiary border border-transparent' },
    { status: 'Client Lost', label: 'Client Lost', className: 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright border border-transparent' },
    { status: 'Confirmation', label: 'Confirmation', className: 'bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary border border-transparent' },
    { status: 'Paid', label: 'Paid', className: 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright border border-transparent' },
    { status: 'Demo', label: 'Demo', className: 'bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary border border-transparent' },
    { status: 'Form Filled', label: 'Form Filled', className: 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright border border-transparent' },
    { status: 'Group Lead', label: 'Group Lead', className: 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright border border-transparent' },
    { status: 'Awaiting Response', label: 'Awaiting Response', className: 'bg-tertiary-container text-on-tertiary-container hover:bg-tertiary hover:text-on-tertiary border border-transparent' },
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

      // Preserve current status filter and find the same lead
      const currentRowNumber = currentLead?.[0];
      filterLeadsByStatus(selectedStatus, data);

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
      filtered = leadsToFilter.filter(
        lead => (lead[6] || '').trim().toLowerCase() === status.trim().toLowerCase()
      );
    }
    setFilteredLeads(filtered);
    setCurrentIndex(0);
    return filtered;
  };

  const handleOwnerChange = (e) => {
    const owner = e.target.value;
    setSelectedOwner(owner);
    if (owner) {
      fetchLeads(owner).catch((error) => {
        setTooltipMessage(error.message || `Failed to load leads for ${owner}`);
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 4000);
      });
    } else {
      setLeads([]);
      setFilteredLeads([]);
      setSelectedStatus('');
    }
  };

  const handleStatusSelect = (status) => {
    filterLeadsByStatus(status);
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

  const handleStatusChange = async (status) => {
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
        notes: notes.trim()
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
      const [prettyResponse, kainatResponse] = await Promise.all([
        fetch('/api/fetch-leads?sheetName=Pretty'),
        fetch('/api/fetch-leads?sheetName=Kainat')
      ]);

      const prettyData = prettyResponse.ok ? await prettyResponse.json() : [];
      const kainatData = kainatResponse.ok ? await kainatResponse.json() : [];

      // Add owner information to each lead
      const prettyLeads = prettyData.map(lead => [...lead, 'Pretty']);
      const kainatLeads = kainatData.map(lead => [...lead, 'Kainat']);

      const allLeads = [...prettyLeads, ...kainatLeads];

      // Search through all leads by phone number (index 5)
      const results = allLeads.filter(lead => {
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
    const leadOwner = lead[lead.length - 1];
    const leadRowNumber = lead[0];
    const leadStatus = lead[6] || 'New Leads';

    let leadsData = leads;
    if (leadOwner !== selectedOwner) {
      setSelectedOwner(leadOwner);
      leadsData = await fetchLeads(leadOwner);
    }

    // Use the returned filtered array directly
    const filtered = filterLeadsByStatus(leadStatus, leadsData);
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
    return leads.filter(lead => lead[6] === name).length;
  };

  const renderSlotHistory = (index, slotName, timeRange) => {
    const value = currentLead?.[index];
    let status = null;
    let timestamp = '';
    if (value) {
      const splitIndex = value.indexOf('(');
      status = splitIndex !== -1 ? value.slice(0, splitIndex).trim() : value;
      timestamp = splitIndex !== -1 ? value.slice(splitIndex) : '';
    }
    return (
      <div className="bg-surface-container-high rounded-lg p-3 flex flex-col gap-1" key={slotName}>
        <div className="flex flex-col">
          <span className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">{slotName}</span>
          <span className="text-label-sm text-on-surface-variant/70">{timeRange}</span>
        </div>
        {value ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-primary text-body-md truncate">{status}</span>
            {timestamp && <span className="text-on-surface-variant text-label-sm truncate">{timestamp}</span>}
          </div>
        ) : (
          <span className="text-on-surface-variant text-label-sm">No call made</span>
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
                <span className="text-secondary text-label-sm font-medium">{lead[lead.length - 1]}</span>
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

  const ownerSelect = (
    <select
      value={selectedOwner}
      onChange={handleOwnerChange}
      className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-1.5 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
    >
      <option value="">Select Lead Owner</option>
      <option value="Pretty">Pretty</option>
      <option value="Kainat">Kainat</option>
    </select>
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
                className={`w-full flex items-center gap-3 rounded-lg px-4 py-2 transition-all duration-200 ${
                  active
                    ? 'bg-secondary-container text-on-secondary-container border-l-4 border-secondary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                <span className="material-symbols-outlined">{category.icon}</span>
                <span className="text-label-md">{category.name}</span>
                <span
                  className={`ml-auto px-2 py-0.5 rounded-full text-label-sm ${
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

    </div>
  );

  return (
    <AppShell title="Lead Management System" search={search} ownerSelect={ownerSelect} sidebarExtra={sidebarExtra}>
      {showTooltip && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-4 py-2 rounded-lg shadow-lg z-50 border border-outline-variant">
          {tooltipMessage}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {loading ? (
          <div className="text-center text-on-surface-variant py-16">Loading leads...</div>
        ) : !selectedOwner ? (
          <div className="bg-surface-container rounded-xl border border-outline-variant p-12 text-center">
            <h2 className="text-headline-md font-bold text-on-surface mb-2">Select a lead owner</h2>
            <p className="text-body-md text-on-surface-variant">
              Choose a lead owner from the top right to start working through their leads.
            </p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-surface-container rounded-xl border border-outline-variant p-12 text-center">
            <h2 className="text-headline-md font-bold text-on-surface mb-2">No leads found</h2>
            <p className="text-body-md text-on-surface-variant">
              {selectedStatus === 'New Leads'
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
                      <td className="p-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Update Status + Notes/Time Slot */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Update Status */}
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
                <div className="grid grid-cols-2 gap-2">
                  {statusActions.map((action) => (
                    <button
                      key={action.status}
                      onClick={() => handleStatusChange(action.status)}
                      disabled={updatingStatus === action.status}
                      className={`py-2 px-3 rounded-lg text-label-md transition-colors text-center shadow-sm ${action.className} ${
                        updatingStatus === action.status ? 'opacity-60 cursor-wait' : ''
                      }`}
                    >
                      {updatingStatus === action.status ? 'Updating...' : action.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant border-t border-outline-variant pt-3 mt-auto">
                  <span className="material-symbols-outlined text-[18px]">history_toggle_off</span>
                  <span className="text-label-md">{currentTimeSlot}</span>
                </div>
              </div>

              {/* Notes + Time Slot */}
              <div className="flex flex-col gap-6 h-full">
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
                    rows="4"
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
            </div>

            {/* Sales Pitch */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-headline-md font-bold">Sales Pitch Script</h3>
              </div>
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
