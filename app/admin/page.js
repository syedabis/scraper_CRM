"use client";

import { useState, useCallback } from "react";
import React from "react";
import AppShell from "../components/AppShell";
import { splitSlotEntries } from "../lib/pendingConfirmations";

export default function AdminPanel() {
  const [allLeads, setAllLeads] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch all leads for admin mode
  const fetchAllLeads = useCallback(async () => {
    setAdminLoading(true);
    try {
      const prettyResponse = await fetch("/api/fetch-leads?sheetName=Pretty");
      const prettyData = prettyResponse.ok ? await prettyResponse.json() : [];
      const prettyLeadsWithOwner = prettyData.map((lead) => [...lead, "Pretty"]);
      setAllLeads(prettyLeadsWithOwner);
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
    const callReceived = agentLeads.filter((lead) => lead[6] === "Call Received" || lead[6] === "Connected").length;
    const notReceived = agentLeads.filter((lead) => lead[6] === "Not Received" || lead[6] === "No Answer").length;
    const callLater = agentLeads.filter((lead) => lead[6] === "Call Later" || lead[6] === "Awaiting Response" || lead[6] === "Follow Up").length;
    const paid = agentLeads.filter((lead) => lead[6] === "Paid" || lead[6] === "Enrolled").length;
    const demo = agentLeads.filter((lead) => lead[6] === "Demo").length;
    const formFilled = agentLeads.filter((lead) => lead[6] === "Form Filled" || lead[6] === "Registration").length;
    const clientLost = agentLeads.filter((lead) => lead[6] === "Client Lost" || lead[6] === "Lost").length;
    const confirmation = agentLeads.filter((lead) => lead[6] === "Confirmation" || lead[6] === "Payment Pending (Confirmation)").length;
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
    
    // Count total calls made (each logged entry, across all 4 slots) on
    // selected date. A slot cell can hold more than one comma-separated
    // entry once its time-of-day window has been reused, so each slot must
    // be split into its individual entries rather than treated as one call.
    let callsMadeCount = 0;
    agentLeads.forEach((lead) => {
      const slots = [lead[7] || '', lead[8] || '', lead[9] || '', lead[10] || ''];
      slots.forEach(slot => {
        splitSlotEntries(slot).forEach((entry) => {
          const dateMatch = entry.match(/\(([^,]+)/);
          if (dateMatch) {
            const extractedDate = dateMatch[1].trim();
            if (callDateFormats.some(format => extractedDate === format)) {
              callsMadeCount++;
            }
          }
        });
      });
    });
    
    console.log(`${agent} - New leads: ${leadsAddedOnDate.length}, Calls: ${callsMadeCount}`);
    
    return {
      newLeadsAdded: leadsAddedOnDate.length,
      callsMade: callsMadeCount,
    };
  };

  const refreshAction = (
    <button
      onClick={fetchAllLeads}
      disabled={adminLoading}
      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg hover:bg-primary hover:text-on-primary transition-colors text-label-md disabled:opacity-60"
    >
      <span className={`material-symbols-outlined text-[18px] ${adminLoading ? "animate-spin" : ""}`}>refresh</span>
      {adminLoading ? "Refreshing..." : "Refresh Analytics"}
    </button>
  );

  return (
    <AppShell title="Admin Panel" search={refreshAction}>
      <div className="flex flex-col gap-8">
        {/* Date Selector */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-4 bg-surface-container rounded-lg border border-outline-variant p-4">
            <label htmlFor="date-selector" className="text-on-surface font-medium text-body-md">
              Select Date:
            </label>
            <input
              id="date-selector"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Date-specific Stats */}
        <div className="max-w-md mx-auto w-full">
          {(() => {
            const dateStats = getDateStats('Pretty');
            return (
              <div className="bg-surface-container rounded-xl border border-outline-variant p-6">
                <h3 className="text-headline-sm font-semibold text-on-surface mb-4 text-center">Pretty&apos;s Activity on {selectedDate}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primary-container p-4 rounded-lg text-center">
                    <div className="text-on-primary-container text-2xl font-bold">{dateStats.newLeadsAdded}</div>
                    <div className="text-on-primary-container text-label-sm">New Leads Added</div>
                  </div>
                  <div className="bg-secondary-container p-4 rounded-lg text-center">
                    <div className="text-on-secondary-container text-2xl font-bold">{dateStats.callsMade}</div>
                    <div className="text-on-secondary-container text-label-sm">Calls Made</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Overall Statistics */}
        <div className="max-w-md mx-auto w-full">
          {(() => {
            const stats = agentStats('Pretty');
            return (
              <div className="bg-surface-container rounded-xl border border-outline-variant p-6">
                <h3 className="text-headline-sm font-semibold text-on-surface mb-4 text-center">Pretty&apos;s Overall Statistics</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-primary-container p-4 rounded-lg text-center">
                      <div className="text-on-primary-container text-2xl font-bold">{stats.totalLeads}</div>
                      <div className="text-on-primary-container text-label-sm">Total Leads</div>
                    </div>
                    <div className="bg-secondary-container p-4 rounded-lg text-center">
                      <div className="text-on-secondary-container text-2xl font-bold">{stats.paid}</div>
                      <div className="text-on-secondary-container text-label-sm">Enrolled Leads</div>
                    </div>
                  </div>
                  <div className="space-y-3 text-body-md">
                    <div className="flex justify-between"><span className="text-on-surface-variant">New Leads:</span><span className="text-primary font-bold">{stats.newLeads}</span></div>
                    <div className="flex justify-between"><span className="text-on-surface-variant">Connected:</span><span className="text-secondary font-bold">{stats.callReceived}</span></div>
                    <div className="flex justify-between"><span className="text-on-surface-variant">No Answer:</span><span className="text-error font-bold">{stats.notReceived}</span></div>
                    <div className="flex justify-between"><span className="text-on-surface-variant">Follow Up:</span><span className="text-tertiary font-bold">{stats.callLater}</span></div>
                    <div className="flex justify-between"><span className="text-on-surface-variant">Lost:</span><span className="text-on-surface font-bold">{stats.clientLost}</span></div>
                    <div className="flex justify-between"><span className="text-on-surface-variant">Payment Pending (Confirmation):</span><span className="text-primary font-bold">{stats.confirmation}</span></div>
                    <div className="flex justify-between"><span className="text-on-surface-variant">Demo:</span><span className="text-primary font-bold">{stats.demo}</span></div>
                    <div className="flex justify-between"><span className="text-on-surface-variant">Registration:</span><span className="text-secondary font-bold">{stats.formFilled}</span></div>
                    <div className="flex justify-between"><span className="text-on-surface-variant">Conversion Rate:</span><span className="text-secondary font-bold">{stats.conversionRate}%</span></div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </AppShell>
  );
}