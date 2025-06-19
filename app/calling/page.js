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

  const leadStatusOptions = [
    { name: 'New Leads', color: 'bg-blue-600 hover:bg-blue-700', icon: '📞' },
    { name: 'Call Received', color: 'bg-green-600 hover:bg-green-700', icon: '✅' },
    { name: 'Not Received', color: 'bg-red-600 hover:bg-red-700', icon: '❌' },
    { name: 'Call Later', color: 'bg-yellow-600 hover:bg-yellow-700', icon: '⏰' },
    { name: 'Client Lost', color: 'bg-gray-600 hover:bg-gray-700', icon: '💔' },
    { name: 'Confirmation', color: 'bg-blue-600 hover:bg-blue-700', icon: '🤝' },
    { name: 'Paid', color: 'bg-purple-600 hover:bg-purple-700', icon: '💰' }
  ];

  const fetchLeads = async (owner) => {
    if (!owner) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/fetch-leads?sheetName=${encodeURIComponent(owner)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }
      const data = await response.json();
      setLeads(data);
      // Auto-select "New Leads" when leads are fetched
      filterLeadsByStatus('New Leads', data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLeadsByStatus = (status, leadsToFilter = leads) => {
    setSelectedStatus(status);
    let filtered;
    
    if (status === 'New Leads') {
      // Filter leads with empty status (index 6)
      filtered = leadsToFilter.filter(lead => !lead[6] || lead[6].trim() === '');
    } else {
      // Filter leads with matching status
      filtered = leadsToFilter.filter(lead => lead[6] === status);
    }
    
    setFilteredLeads(filtered);
    setCurrentIndex(0);
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
      console.log('Current lead:', currentLead);
      console.log('Updating row:', rowNumber, 'with status:', status);

      const response = await fetch('/api/update-lead-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: rowNumber,
          status,
          owner: selectedOwner
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      setTooltipMessage('Status updated successfully!');
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);

      // Update local state
      const updatedLeads = leads.map(lead => {
        if (lead[0] === rowNumber) {
          return [...lead.slice(0, 6), status, ...lead.slice(7)];
        }
        return lead;
      });
      setLeads(updatedLeads);
      
      // Move to next lead if available
      const currentLeadIndex = filteredLeads.findIndex(lead => lead[0] === rowNumber);
      if (currentLeadIndex < filteredLeads.length - 1) {
        setCurrentIndex(currentLeadIndex + 1);
      }
      
      // Re-filter leads after update
      filterLeadsByStatus(selectedStatus, updatedLeads);

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
      'Paid': 'bg-purple-600 hover:bg-purple-700'
    };

    return `${baseClass} ${statusColors[status]} ${isUpdating ? 'opacity-75 cursor-wait' : ''}`;
  };

  const getCurrentStatus = () => {
    return leadStatus[currentIndex] || currentLead?.[5] || ''; // Column F (index 5) contains status
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-1 sm:px-2 lg:px-4">
      <div className="max-w-7xl mx-auto relative">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Lead Management System</h1>
          <div className="mt-4">
            <select
              value={selectedOwner}
              onChange={handleOwnerChange}
              className="w-full md:w-64 bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Lead Owner</option>
              <option value="Pretty">Pretty</option>
              <option value="Asif">Asif</option>
            </select>
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
                  {leadStatusOptions.map((option) => (
                    <button
                      key={option.name}
                      onClick={() => handleStatusSelect(option.name)}
                      className={`w-full p-3 rounded-lg text-left transition-all duration-200 text-white font-medium flex items-center space-x-3 ${
                        selectedStatus === option.name 
                          ? `${option.color} shadow-lg` 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      <span className="text-lg">{option.icon}</span>
                      <span>{option.name}</span>
                    </button>
                  ))}
                </div>
                
                {/* Lead count display */}
                <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                  <p className="text-gray-300 text-sm text-center">
                    {selectedStatus && (
                      <>
                        <span className="font-medium text-white">{filteredLeads.length}</span> leads in {selectedStatus}
                      </>
                    )}
                  </p>
                </div>
              </div>
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
                <div className="rounded-lg overflow-hidden">
                  <div className="p-3">
                    <div className="mb-6">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-700">
                            <th className="border border-gray-600 p-3 text-center text-white font-medium text-xl">Name</th>
                            <th className="border border-gray-600 p-3 text-center text-white font-medium text-xl">Phone</th>
                            <th className="border border-gray-600 p-3 text-center text-white font-medium text-xl">Email</th>
                            <th className="border border-gray-600 p-3 text-center text-white font-medium text-xl">Date & Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-600 p-3 text-white whitespace-normal break-words text-center align-middle text-xl">{currentLead?.[3] || ''}</td>
                            <td className="border border-gray-600 p-3 text-white text-center align-middle text-xl">{currentLead?.[5] || ''}</td>
                            <td className="border border-gray-600 p-3 text-white whitespace-normal break-words text-center align-middle text-xl">{currentLead?.[4] || 'Not provided'}</td>
                            <td className="border border-gray-600 p-3 text-white text-center align-middle text-xl">{currentLead?.[1] || ''} {currentLead?.[2] || ''}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-6">
                      <div className="text-center mb-4">
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

                    <div className="mt-6 flex flex-wrap gap-2 justify-center relative">
                      {showTooltip && (
                        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
                          {tooltipMessage}
                        </div>
                      )}
                      <button
                        onClick={() => handleStatusChange('Call Received')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[120px] bg-green-600 hover:bg-green-700 ${updatingStatus === 'Call Received' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Call Received'}
                      >
                        {updatingStatus === 'Call Received' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[120px] bg-red-600 hover:bg-red-700 ${updatingStatus === 'Not Received' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Not Received'}
                      >
                        {updatingStatus === 'Not Received' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[120px] bg-yellow-600 hover:bg-yellow-700 ${updatingStatus === 'Call Later' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Call Later'}
                      >
                        {updatingStatus === 'Call Later' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[120px] bg-gray-600 hover:bg-gray-700 ${updatingStatus === 'Client Lost' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Client Lost'}
                      >
                        {updatingStatus === 'Client Lost' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[120px] bg-blue-600 hover:bg-blue-700 ${updatingStatus === 'Confirmation' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Confirmation'}
                      >
                        {updatingStatus === 'Confirmation' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-white flex items-center justify-center min-w-[120px] bg-purple-600 hover:bg-purple-700 ${updatingStatus === 'Paid' ? 'opacity-75 cursor-wait' : ''}`}
                        disabled={updatingStatus === 'Paid'}
                      >
                        {updatingStatus === 'Paid' ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </div>
                        ) : (
                          'Paid'
                        )}
                      </button>
                    </div>

                    <div className="flex justify-center items-center mt-6">
                      <span className="text-gray-400">
                        {filteredLeads.length === 0 ? 'You are done with all leads!' : `Lead ${currentIndex + 1} of ${filteredLeads.length}`}
                      </span>
                    </div>
                  </div>
                </div>
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