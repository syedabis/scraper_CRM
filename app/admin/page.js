"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import React from "react";

export default function AdminPanel() {
  const router = useRouter();
  const [allLeads, setAllLeads] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch all leads for admin mode
  const fetchAllLeads = useCallback(async () => {
    setAdminLoading(true);
    try {
      const prettyResponse = await fetch("/api/fetch-leads?sheetName=Pretty");
      const asifResponse = await fetch("/api/fetch-leads?sheetName=Asif");
      const prettyData = prettyResponse.ok ? await prettyResponse.json() : [];
      const asifData = asifResponse.ok ? await asifResponse.json() : [];
      const prettyLeadsWithOwner = prettyData.map((lead) => [...lead, "Pretty"]);
      const asifLeadsWithOwner = asifData.map((lead) => [...lead, "Asif"]);
      setAllLeads([...prettyLeadsWithOwner, ...asifLeadsWithOwner]);
    } catch (error) {
      setAllLeads([]);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  // Fetch on first load
  React.useEffect(() => {
    fetchAllLeads();
  }, [fetchAllLeads]);

  const agentStats = (agent) => {
    const agentLeads = allLeads.filter((lead) => lead[lead.length - 1] === agent);
    const totalLeads = agentLeads.length;
    const newLeads = agentLeads.filter((lead) => !lead[6] || lead[6].trim() === "").length;
    const callReceived = agentLeads.filter((lead) => lead[6] === "Call Received").length;
    const notReceived = agentLeads.filter((lead) => lead[6] === "Not Received").length;
    const callLater = agentLeads.filter((lead) => lead[6] === "Call Later").length;
    const paid = agentLeads.filter((lead) => lead[6] === "Paid").length;
    const demo = agentLeads.filter((lead) => lead[6] === "Demo").length;
    const formFilled = agentLeads.filter((lead) => lead[6] === "Form Filled").length;
    const clientLost = agentLeads.filter((lead) => lead[6] === "Client Lost").length;
    const confirmation = agentLeads.filter((lead) => lead[6] === "Confirmation").length;
    const conversionRate = totalLeads > 0 ? Math.round((paid / totalLeads) * 100) : 0;
    return {
      totalLeads,
      newLeads,
      callReceived,
      notReceived,
      callLater,
      paid,
      demo,
      formFilled,
      clientLost,
      confirmation,
      conversionRate,
    };
  };

  const getDateStats = (agent) => {
    const agentLeads = allLeads.filter((lead) => lead[lead.length - 1] === agent);
    
    // Debug: Log some sample data to understand the structure
    if (agentLeads.length > 0) {
      console.log(`Sample data for ${agent}:`, {
        leadDate: agentLeads[0][1], // Column A
        slot1: agentLeads[0][7],    // Slot 1
        slot2: agentLeads[0][8],    // Slot 2
        slot3: agentLeads[0][9],    // Slot 3
        slot4: agentLeads[0][10],   // Slot 4
        selectedDate: selectedDate
      });
    }
    
    // Convert selected date to different formats for matching
    const selectedDateParts = selectedDate.split('-');
    const year = selectedDateParts[0];
    const month = selectedDateParts[1];
    const day = selectedDateParts[2];
    
    // For call dates, build both padded and non-padded formats
    const pad = (n) => n.length === 1 ? '0' + n : n;
    const monthNoPad = String(Number(month));
    const dayNoPad = String(Number(day));
    const callDateFormats = [
      `${month}/${day}/${year}`,
      `${monthNoPad}/${dayNoPad}/${year}`,
      `${pad(month)}/${pad(day)}/${year}`,
      `${year}-${month}-${day}`
    ];
    
    console.log('Date formats to match:', callDateFormats);
    
    // Filter leads added on selected date (Column A = lead[1]) - uses DD/MM/YYYY format
    const leadsAddedOnDate = agentLeads.filter((lead) => {
      const leadDate = lead[1]; // Column A contains the date when lead was added
      if (!leadDate) return false;
      const leadDateStr = leadDate.toString();
      // For lead dates, prioritize DD/MM/YYYY format
      const leadDateFormats = [`${day}/${month}/${year}`, `${year}-${month}-${day}`];
      const matches = leadDateFormats.some(format => leadDateStr.includes(format));
      if (matches) {
        console.log(`Found lead added on ${selectedDate}:`, leadDateStr);
      }
      return matches;
    });
    
    // Count total calls made (each matching slot) on selected date
    let callsMadeCount = 0;
    agentLeads.forEach((lead) => {
      const slots = [lead[7] || '', lead[8] || '', lead[9] || '', lead[10] || ''];
      slots.forEach(slot => {
        if (!slot || slot.trim() === '') return;
        const dateMatch = slot.match(/\(([^,]+)/);
        if (dateMatch) {
          const extractedDate = dateMatch[1].trim();
          if (callDateFormats.some(format => extractedDate === format)) {
            callsMadeCount++;
          }
        }
      });
    });
    
    console.log(`${agent} - New leads: ${leadsAddedOnDate.length}, Calls: ${callsMadeCount}`);
    
    return {
      newLeadsAdded: leadsAddedOnDate.length,
      callsMade: callsMadeCount,
    };
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-1 sm:px-2 lg:px-4 relative flex items-center justify-center">
      <div className="max-w-7xl mx-auto relative w-full">
        <div className="flex items-center justify-between mb-8">
          {/* Home Button */}
          <div className="flex-shrink-0">
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105"
            >
              <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="font-medium text-blue-400">Home</span>
            </button>
          </div>
          
          {/* Admin Panel Title */}
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          </div>
          
          {/* Refresh Button */}
          <div className="flex-shrink-0">
            <button
              onClick={fetchAllLeads}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-br from-green-700 to-green-900 border border-green-700 rounded-lg shadow-lg hover:shadow-green-500/20 transition-all duration-300 hover:scale-105"
              disabled={adminLoading}
            >
              <svg className={`w-5 h-5 mr-2 text-green-400 ${adminLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="font-medium text-green-400">{adminLoading ? "Refreshing..." : "Refresh Analytics"}</span>
            </button>
          </div>
        </div>

        {/* Date Selector */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-4 bg-gray-800 rounded-lg p-4">
            <label htmlFor="date-selector" className="text-white font-medium">
              Select Date:
            </label>
            <input
              id="date-selector"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Date-specific Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
          {['Pretty', 'Asif'].map((agent) => {
            const dateStats = getDateStats(agent);
            return (
              <div key={`${agent}-date`} className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4 text-center">{agent}&apos;s Activity on {selectedDate}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-lg text-center">
                      <div className="text-white text-2xl font-bold">{dateStats.newLeadsAdded}</div>
                      <div className="text-blue-100 text-sm">New Leads Added</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-600 to-green-700 p-4 rounded-lg text-center">
                      <div className="text-white text-2xl font-bold">{dateStats.callsMade}</div>
                      <div className="text-green-100 text-sm">Calls Made</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {['Pretty', 'Asif'].map((agent) => {
            const stats = agentStats(agent);
            return (
              <div key={agent} className="bg-gray-800 rounded-lg p-6 shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4 text-center">{agent}&apos;s Overall Statistics</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-lg text-center">
                      <div className="text-white text-2xl font-bold">{stats.totalLeads}</div>
                      <div className="text-blue-100 text-sm">Total Leads</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-600 to-green-700 p-4 rounded-lg text-center">
                      <div className="text-white text-2xl font-bold">{stats.paid}</div>
                      <div className="text-green-100 text-sm">Paid Leads</div>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-gray-300">New Leads:</span><span className="text-blue-300 font-bold">{stats.newLeads}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Call Received:</span><span className="text-green-300 font-bold">{stats.callReceived}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Not Received:</span><span className="text-red-300 font-bold">{stats.notReceived}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Call Later:</span><span className="text-yellow-300 font-bold">{stats.callLater}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Client Lost:</span><span className="text-gray-300 font-bold">{stats.clientLost}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Confirmation:</span><span className="text-blue-300 font-bold">{stats.confirmation}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Demo:</span><span className="text-indigo-300 font-bold">{stats.demo}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Form Filled:</span><span className="text-teal-300 font-bold">{stats.formFilled}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Conversion Rate:</span><span className="text-purple-300 font-bold">{stats.conversionRate}%</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 