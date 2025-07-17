'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export default function Calling() {
  const [selectedLead, setSelectedLead] = useState('');
  const [leads, setLeads] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('');
  const [leadStatus, setLeadStatus] = useState({});
  const [tooltipMessage, setTooltipMessage] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState('');
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showStatusPrompt, setShowStatusPrompt] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', email: '', phone: '' });
  const [updatingLead, setUpdatingLead] = useState(false);
  const [currentTimeSlot, setCurrentTimeSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const leadStatusOptions = [
    { name: 'New Leads', color: 'bg-blue-600 hover:bg-blue-700', icon: '📞' },
    { name: 'Call Received', color: 'bg-green-600 hover:bg-green-700', icon: '✅' },
    { name: 'Not Received', color: 'bg-red-600 hover:bg-red-700', icon: '❌' },
    { name: 'Call Later', color: 'bg-yellow-600 hover:bg-yellow-700', icon: '⏰' },
    { name: 'Client Lost', color: 'bg-amber-700 hover:bg-amber-800', icon: '💔' },
    { name: 'Confirmation', color: 'bg-blue-600 hover:bg-blue-700', icon: '🤝' },
    { name: 'Paid', color: 'bg-purple-600 hover:bg-purple-700', icon: '💰' },
    { name: 'Demo', color: 'bg-indigo-600 hover:bg-indigo-700', icon: '🎯' },
    { name: 'Form Filled', color: 'bg-teal-600 hover:bg-teal-700', icon: '📝' }
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
      if (!response.ok) throw new Error('Failed to fetch leads');
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
    console.log('Statuses in leads:', leadsToFilter.map(l => l[6]));
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
      fetchLeads(owner);
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
      console.log('Sending update-lead-status payload:', payload);
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

  const getStatusButtonClass = (status) => {
    const baseClass = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center min-w-[120px]";
    const isUpdating = updatingStatus === status;
    
    const statusColors = {
      'Call Received': 'bg-green-600 hover:bg-green-700',
      'Not Received': 'bg-red-600 hover:bg-red-700',
      'Call Later': 'bg-yellow-600 hover:bg-yellow-700',
      'Client Lost': 'bg-gray-600 hover:bg-gray-700',
      'Confirmation': 'bg-blue-600 hover:bg-blue-700',
      'Paid': 'bg-purple-600 hover:bg-purple-700',
      'Demo': 'bg-indigo-600 hover:bg-indigo-700',
      'Form Filled': 'bg-teal-600 hover:bg-teal-700'
    };

    return `${baseClass} ${statusColors[status]} ${isUpdating ? 'opacity-75 cursor-wait' : ''}`;
  };

  const getCurrentStatus = () => {
    return leadStatus[currentIndex] || currentLead?.[5] || ''; // Column F (index 5) contains status
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    if (!status) return 'bg-gray-600';
    
    const statusText = status.split(' (')[0]; // Remove timestamp part
    
    switch (statusText) {
      case 'Call Received':
        return 'bg-green-600';
      case 'Not Received':
        return 'bg-red-600';
      case 'Call Later':
        return 'bg-yellow-600';
      case 'Client Lost':
        return 'bg-gray-600';
      case 'Confirmation':
        return 'bg-blue-600';
      case 'Paid':
        return 'bg-purple-600';
      case 'Demo':
        return 'bg-indigo-600';
      case 'Form Filled':
        return 'bg-teal-600';
      default:
        return 'bg-gray-600';
    }
  };

  // Utility function to calculate number of attempts from slot data
  const calculateAttempts = (lead) => {
    let attempts = 0;
    for (let i = 7; i <= 10; i++) {
      if (lead[i] && lead[i].trim() !== '') {
        attempts++;
      }
    }
    return attempts;
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
      let allLeads = [];
      
      // If no owner is selected, fetch from both owners
      if (!selectedOwner) {
        const [prettyResponse, asifResponse] = await Promise.all([
          fetch('/api/fetch-leads?sheetName=Pretty'),
          fetch('/api/fetch-leads?sheetName=Asif')
        ]);
        
        const prettyData = prettyResponse.ok ? await prettyResponse.json() : [];
        const asifData = asifResponse.ok ? await asifResponse.json() : [];
        
        // Add owner information to each lead
        const prettyLeads = prettyData.map(lead => [...lead, 'Pretty']);
        const asifLeads = asifData.map(lead => [...lead, 'Asif']);
        
        allLeads = [...prettyLeads, ...asifLeads];
      } else {
        // If owner is selected, still search across both owners
        const [prettyResponse, asifResponse] = await Promise.all([
          fetch('/api/fetch-leads?sheetName=Pretty'),
          fetch('/api/fetch-leads?sheetName=Asif')
        ]);
        
        const prettyData = prettyResponse.ok ? await prettyResponse.json() : [];
        const asifData = asifResponse.ok ? await asifResponse.json() : [];
        
        // Add owner information to each lead
        const prettyLeads = prettyData.map(lead => [...lead, 'Pretty']);
        const asifLeads = asifData.map(lead => [...lead, 'Asif']);
        
        allLeads = [...prettyLeads, ...asifLeads];
      }
      
      // Search through all leads by phone number (index 5)
      const results = allLeads.filter(lead => {
        const phoneNumber = lead[5] || '';
        // Convert both to strings and search for partial matches
        return phoneNumber.toString().includes(query.toString());
      });

      setSearchResults(results);
      console.log('Search results:', results.map(l => ({ phone: l[5], status: l[6] })));
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
    console.log('Navigating to lead:', lead, 'Status in search result:', leadStatus);

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

  // Debug: Log the currentLead used in Call History
  if (typeof window !== 'undefined' && currentLead) {
    console.log('Call History currentLead:', currentLead);
  }

  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-1 sm:px-2 lg:px-4 relative">
      <div className="max-w-7xl mx-auto relative">
        <div className="flex items-center justify-between mb-8">
          {/* Add New Lead Button - Moved to left side */}
          <div className="flex-shrink-0">
            <button
              onClick={() => router.push('/data-entry')}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105"
            >
              <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="font-medium text-blue-400">Add New Lead</span>
            </button>
          </div>

          {/* Center Title */}
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-bold text-white">Lead Management System</h1>
          </div>

          {/* Search Bar - Right side */}
          <div className="flex-shrink-0 w-80">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by phone number..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              
              {/* Search Results Dropdown */}
              {searchResults.length > 0 && searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {searchResults.map((lead, index) => (
                    <button
                      key={index}
                      onClick={() => navigateToLead(lead)}
                      className="w-full p-3 text-left hover:bg-gray-700 border-b border-gray-700 last:border-b-0 transition-colors"
                    >
                      <div className="text-white text-medium">{lead[5] || 'No Phone'}</div>
                      <div className="text-blue-400 font-xs">{lead[3] || 'No Name'}</div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">{lead[6] || 'New Lead'}</span>
                        <span className="text-green-400 text-xs font-medium">{lead[lead.length - 1]}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* No Results */}
              {searchQuery && !isSearching && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 p-3">
                  <div className="text-gray-400 text-center">No leads found</div>
                </div>
              )}
              
              {/* Loading */}
              {isSearching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 p-3">
                  <div className="text-gray-400 text-center flex items-center justify-center">
                    <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dropdown and Time Slot - Moved below the title row */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-between">
            {/* Left side: Time slot */}
            <div className="flex items-center">
              {currentTimeSlot && (
                <div className="inline-block bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-medium shadow-md border border-blue-400/30">
                  <span className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span className="text-sm tracking-wide">{currentTimeSlot}</span>
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  </span>
                </div>
              )}
            </div>

            {/* Center: Owner selection */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <select
                value={selectedOwner}
                onChange={handleOwnerChange}
                className="w-48 bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Lead Owner</option>
                <option value="Pretty">Pretty</option>
                <option value="Asif">Asif</option>
              </select>
            </div>

            {/* Right side: Edit button */}
            {selectedOwner && currentLead && !isEditing && (
              <button
                onClick={handleEditClick}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit</span>
              </button>
            )}
            {selectedOwner && currentLead && isEditing && (
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={updatingLead}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 disabled:opacity-50"
                >
                  {updatingLead ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>
          </div>

        {loading ? (
          <div className="text-center text-gray-400">Loading leads...</div>
        ) : selectedOwner && (
          <div className="flex gap-6">
            {/* Sidebar */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
                <h2 className="text-xl font-bold text-white mb-4 text-center">Lead Categories</h2>
                <div className="space-y-2">
                  {leadStatusOptions.map((option) => {
                    // Calculate count for each status
                    let count = 0;
                    if (option.name === 'New Leads') {
                      count = leads.filter(lead => !lead[6] || lead[6].trim() === '').length;
                    } else {
                      count = leads.filter(lead => lead[6] === option.name).length;
                    }
                    
                    return (
                    <button
                      key={option.name}
                      onClick={() => handleStatusSelect(option.name)}
                        className={`w-full p-3 rounded-lg text-left transition-all duration-200 text-white font-medium flex items-center justify-between ${
                        selectedStatus === option.name 
                          ? `${option.color} shadow-lg` 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                        <div className="flex items-center space-x-3">
                      <span className="text-lg">{option.icon}</span>
                      <span>{option.name}</span>
                        </div>
                        <span className="px-2 py-1 rounded-full text-sm font-bold text-blue-300">
                          {count}
                        </span>
                    </button>
                    );
                  })}
                </div>
                
                {/* Lead count display */}
                <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                  <p className="text-gray-300 text-sm text-center">
                    <span className="font-bold text-white">Total Leads</span> : <span className="font-bold text-white">{leads.length}</span>
                  </p>
                </div>
              </div>

              {/* Time Slot History Section - Moved to sidebar */}
              {currentLead && (
                <div className="mt-4 bg-gray-800 rounded-lg p-4 shadow-lg">
                  <h2 className="text-lg font-bold text-white mb-3 text-center">Call History</h2>
                  <div className="space-y-3">
                    {/* Slot 1 - Column G (index 7) */}
                    <div className="bg-gray-700 rounded-lg p-3">
                      <h3 className="text-sm font-semibold text-white mb-1">Slot 1 (9:00 AM - 11:00 AM)</h3>
                      <div className="min-h-[40px] flex flex-col items-center justify-center w-full">
                        {currentLead?.[7] ? (() => {
                          const value = currentLead[7];
                          const splitIndex = value.indexOf('(');
                          const status = splitIndex !== -1 ? value.slice(0, splitIndex).trim() : value;
                          const timestamp = splitIndex !== -1 ? value.slice(splitIndex) : '';
                          return (
                            <>
                              <span className="font-bold text-purple-300 text-sm">{status}</span>
                              {timestamp && <span className="text-gray-300 text-xs mt-1">{timestamp}</span>}
                            </>
                          );
                        })() : (
                          <span className="text-gray-500 text-xs">No call made</span>
                        )}
                      </div>
                    </div>

                    {/* Slot 2 - Column H (index 8) */}
                    <div className="bg-gray-700 rounded-lg p-3">
                      <h3 className="text-sm font-semibold text-white mb-1">Slot 2 (11:00 AM - 1:00 PM)</h3>
                      <div className="min-h-[40px] flex flex-col items-center justify-center w-full">
                        {currentLead?.[8] ? (() => {
                          const value = currentLead[8];
                          const splitIndex = value.indexOf('(');
                          const status = splitIndex !== -1 ? value.slice(0, splitIndex).trim() : value;
                          const timestamp = splitIndex !== -1 ? value.slice(splitIndex) : '';
                          return (
                            <>
                              <span className="font-bold text-purple-400 text-sm">{status}</span>
                              {timestamp && <span className="text-gray-300 text-xs mt-1">{timestamp}</span>}
                            </>
                          );
                        })() : (
                          <span className="text-gray-500 text-xs">No call made</span>
                        )}
                      </div>
                    </div>

                    {/* Slot 3 - Column I (index 9) */}
                    <div className="bg-gray-700 rounded-lg p-3">
                      <h3 className="text-sm font-semibold text-white mb-1">Slot 3 (1:00 PM - 4:00 PM)</h3>
                      <div className="min-h-[40px] flex flex-col items-center justify-center w-full">
                        {currentLead?.[9] ? (() => {
                          const value = currentLead[9];
                          const splitIndex = value.indexOf('(');
                          const status = splitIndex !== -1 ? value.slice(0, splitIndex).trim() : value;
                          const timestamp = splitIndex !== -1 ? value.slice(splitIndex) : '';
                          return (
                            <>
                              <span className="font-bold text-purple-400 text-sm">{status}</span>
                              {timestamp && <span className="text-gray-300 text-xs mt-1">{timestamp}</span>}
                            </>
                          );
                        })() : (
                          <span className="text-gray-500 text-xs">No call made</span>
                        )}
                      </div>
                    </div>

                    {/* Slot 4 - Column J (index 10) */}
                    <div className="bg-gray-700 rounded-lg p-3">
                      <h3 className="text-sm font-semibold text-white mb-1">Slot 4 (4:00 PM - 6:00 PM)</h3>
                      <div className="min-h-[40px] flex flex-col items-center justify-center w-full">
                        {currentLead?.[10] ? (() => {
                          const value = currentLead[10];
                          const splitIndex = value.indexOf('(');
                          const status = splitIndex !== -1 ? value.slice(0, splitIndex).trim() : value;
                          const timestamp = splitIndex !== -1 ? value.slice(splitIndex) : '';
                          return (
                            <>
                              <span className="font-bold text-purple-400 text-sm">{status}</span>
                              {timestamp && <span className="text-gray-300 text-xs mt-1">{timestamp}</span>}
                            </>
                          );
                        })() : (
                          <span className="text-gray-500 text-xs">No call made</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes Display - Outside Call History Box */}
              {currentLead?.[12] && (
                <div className="mt-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4 border border-gray-600 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <h3 className="text-sm font-bold text-green-400">Notes</h3>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
                    <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                      {currentLead[12]}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Main content */}
            <div className="flex-1">
              {filteredLeads.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-8 shadow-lg text-center">
                  <h2 className="text-2xl font-bold text-white mb-4">No leads found</h2>
                  <p className="text-gray-400">
                    {selectedStatus === 'New Leads' 
                      ? 'No new leads available.' 
                      : `No leads with status "${selectedStatus}" found.`
                    }
                  </p>
                </div>
              ) : (
                <>
                  {/* Status Buttons - Now in main content area */}
                  {selectedOwner && currentLead && (
                    <div className="mb-4 flex flex-wrap gap-2 justify-center relative">
                      {showTooltip && (
                        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
                          {tooltipMessage}
                        </div>
                      )}
                      <button
                        onClick={() => handleStatusChange('Call Received')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[100px] text-sm bg-green-600 hover:bg-green-700 ${updatingStatus === 'Call Received' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Call Received'}
                      >
                        {updatingStatus === 'Call Received' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </div>
                        ) : (
                          'Call Received'
                        )}
                      </button>
                      <button
                        onClick={() => handleStatusChange('Not Received')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[100px] text-sm bg-red-600 hover:bg-red-700 ${updatingStatus === 'Not Received' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Not Received'}
                      >
                        {updatingStatus === 'Not Received' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </div>
                        ) : (
                          'Not Received'
                        )}
                      </button>
                      <button
                        onClick={() => handleStatusChange('Call Later')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[100px] text-sm bg-yellow-600 hover:bg-yellow-700 ${updatingStatus === 'Call Later' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Call Later'}
                      >
                        {updatingStatus === 'Call Later' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </div>
                        ) : (
                          'Please Call Later'
                        )}
                      </button>
                      <button
                        onClick={() => handleStatusChange('Client Lost')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[100px] text-sm bg-gray-600 hover:bg-gray-700 ${updatingStatus === 'Client Lost' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Client Lost'}
                      >
                        {updatingStatus === 'Client Lost' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </div>
                        ) : (
                          'Client Lost'
                        )}
                      </button>
                      <button
                        onClick={() => handleStatusChange('Confirmation')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[100px] text-sm bg-blue-600 hover:bg-blue-700 ${updatingStatus === 'Confirmation' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Confirmation'}
                      >
                        {updatingStatus === 'Confirmation' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </div>
                        ) : (
                          'Confirmation'
                        )}
                      </button>
                      <button
                        onClick={() => handleStatusChange('Paid')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[100px] text-sm bg-purple-600 hover:bg-purple-700 ${updatingStatus === 'Paid' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Paid'}
                      >
                        {updatingStatus === 'Paid' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </div>
                        ) : (
                          'Paid'
                        )}
                      </button>
                      <button
                        onClick={() => handleStatusChange('Demo')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[100px] text-sm bg-indigo-600 hover:bg-indigo-700 ${updatingStatus === 'Demo' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Demo'}
                      >
                        {updatingStatus === 'Demo' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </div>
                        ) : (
                          'Demo'
                        )}
                      </button>
                      <button
                        onClick={() => handleStatusChange('Form Filled')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[100px] text-sm bg-teal-600 hover:bg-teal-700 ${updatingStatus === 'Form Filled' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Form Filled'}
                      >
                        {updatingStatus === 'Form Filled' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </div>
                        ) : (
                          'Form Filled'
                        )}
                      </button>
                    </div>
                  )}

                  {/* Lead Details Table - Now below status buttons */}
                  <div className="rounded-lg overflow-hidden">
                    <div className="p-3">
                      <div className="mb-4">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-700">
                              <th className="border border-gray-600 p-3 text-center text-white font-medium text-xl">Name</th>
                              <th className="border border-gray-600 p-3 text-center text-white font-medium text-xl">Phone</th>
                              <th className="border border-gray-600 p-3 text-center text-white font-medium text-xl">Email</th>
                              <th className="border border-gray-600 p-3 text-center text-white font-medium text-xl">Lead Received</th>
                              <th className="border border-gray-600 p-3 text-center text-white font-medium text-xl">Attempts</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-gray-600 p-3 text-center align-middle">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editData.name}
                                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                                    className="w-full bg-gray-700 text-white text-xl text-center border-none outline-none rounded px-2 py-1"
                                    placeholder="Enter name"
                                  />
                                ) : (
                                  <span className="text-white whitespace-normal break-words text-xl">{currentLead?.[3] || ''}</span>
                                )}
                              </td>
                              <td className="border border-gray-600 p-3 text-center align-middle">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editData.phone}
                                    onChange={(e) => setEditData({...editData, phone: e.target.value})}
                                    className="w-full bg-gray-700 text-white text-xl text-center border-none outline-none rounded px-2 py-1"
                                    placeholder="Enter phone"
                                  />
                                ) : (
                                  <span className="text-white text-xl">{currentLead?.[5] || ''}</span>
                                )}
                              </td>
                              <td className="border border-gray-600 p-3 text-center align-middle">
                                {isEditing ? (
                                  <input
                                    type="email"
                                    value={editData.email}
                                    onChange={(e) => setEditData({...editData, email: e.target.value})}
                                    className="w-full bg-gray-700 text-white text-xl text-center border-none outline-none rounded px-2 py-1"
                                    placeholder="Enter email"
                                  />
                                ) : (
                                  <span className="text-white whitespace-normal break-words text-xl">{currentLead?.[4] || 'Not provided'}</span>
                                )}
                              </td>
                              <td className="border border-gray-600 p-3 text-center align-middle">
                                <span className="text-white text-xl">{currentLead?.[1] || ''} {currentLead?.[2] || ''}</span>
                              </td>
                              <td className="border border-gray-600 p-3 text-center align-middle">
                                <span className="text-white text-xl font-bold">
                                  {currentLead?.[11] || 0}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4">
                        <div className="text-center mb-3">
                          <h2 className="text-2xl font-bold text-white">Sales Pitch</h2>
                        </div>
                        <div className="bg-white rounded-lg p-4">
                          <p className="text-black text-xl leading-relaxed">
                            Assalam o Alaikum!<br />

                            Aap ne WhatsApp par humse contact kiya tha regarding our <strong>Data Science Bootcamp</strong>. Kya aap is bootcamp ke baare mein aur janna chahenge?<br />

                            Toh let me explain — yeh <strong>4-month ka complete bootcamp</strong> hai:<br />

                            🔹 1st Month – Python programming: from basics to data handling<br />
                            🔹 2nd Month – Machine Learning: algorithms, model building<br />
                            🔹 3rd Month – Deep Learning: neural networks, CNNs<br />
                            🔹 4th Month – Generative AI: jisme aap apna <strong>khud ka chatbot</strong> build kar saktay hain using advanced GenAI tools<br />

                            ✨ <strong>Assignments har week diye jate hain</strong> aur unka <strong>feedback within 1 hour</strong> mil jata hai — taake aap fast pace pe improve kar sakein.<br />

                            Mujhe aapke background ke baare mein thoda batayein, taake main aapko aur ache se guide kar sakun. Aapka current field kya hai?<br />

                            ✔️ Agar aap <strong>80% ya us se zyada score</strong> karte hain in assignments mein, toh aapko <strong>remote internship</strong> milti hai — jisse aapka <strong>professional experience</strong> build hota hai.<br />

                            📝 Plus, hum aapki <strong>LinkedIn aur Resume optimization</strong> mein bhi help karte hain taake job market ke liye aap ready ho jayein.<br />

                            Kya aapko yeh information helpful lagi? Ya koi aur sawal hain aapke mind mein?<br />

                            If you&apos;re interested, just let me know — I&apos;ll share the <strong>registration link and next steps</strong> with you.<br />

                            <strong>Limited seats hain</strong>, so don&apos;t miss this opportunity! 🚀
                          </p>
                        </div>
                      </div>

                      {/* Notes Input Field */}
                      <div className="mt-4 mb-3">
                        <div className="max-w-2xl mx-auto">
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Enter any notes about this call or lead..."
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            rows="3"
                          />
                        </div>
                      </div>

                      <div className="flex justify-center items-center mt-4">
                        <span className="text-gray-400">
                          {filteredLeads.length === 0 ? 'You are done with all leads!' : `Lead ${currentIndex + 1} of ${filteredLeads.length}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {!loading && filteredLeads.length > 0 && (
                <>
                  <button
                    onClick={handlePrevious}
                    className="fixed left-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors duration-150 shadow-lg"
                  >
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleNext}
                    className="fixed right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors duration-150 shadow-lg"
                  >
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 