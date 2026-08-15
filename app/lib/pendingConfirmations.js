// The two lead pools. They are kept deliberately separate: status categories
// and the attempt tabs only ever show the primary sheet, and "Agent leads" is
// its own list. Merging them would mix two different books of business.
export const PRIMARY_SOURCE = process.env.NEXT_PUBLIC_PRIMARY_SHEET_NAME || process.env.PRIMARY_SHEET_NAME || '';
export const AGENT_SOURCE = process.env.NEXT_PUBLIC_AGENT_SHEET_NAME || process.env.AGENT_SHEET_NAME || '';
export const LEAD_SOURCES = [PRIMARY_SOURCE, AGENT_SOURCE];

// Appended by the client after fetching, not present in the sheet. fetch-leads
// prepends the row number, so columns A-R occupy 1..18 and this sits after.
export const SOURCE_INDEX = 19;

export const sourceOf = (lead) => lead?.[SOURCE_INDEX] || PRIMARY_SOURCE;

// A row number is not unique across tabs — row 5 exists in both — so anything
// that identifies a lead has to include the sheet it came from.
export const leadKey = (lead) => (lead ? `${sourceOf(lead)}#${lead[0]}` : null);

export function filterBySource(leads, source) {
  return (leads || []).filter((lead) => sourceOf(lead) === source);
}

// Column N holds the pending-action date — the date a student promised to
// pay, was scheduled for a demo, or should be followed up by. fetch-leads
// prepends the row number, so it lands at this array index.
export const PENDING_DATE_INDEX = 14;

// These statuses require a mandatory date and get a "still pending" reminder
// until resolved. Enrolled also requires a date (the enrollment date, which
// also closes out any prior pending reminder by overwriting the column with
// "Closed (date)"), but it's a completed state, not something to keep
// reminding about, so it's deliberately left out of this list.
export const PENDING_REMINDER_STATUSES = ['Follow Up', 'Demo', 'Payment Pending (Confirmation)'];

// Old status text still sitting in the sheet from before the rename.
const STATUS_ALIASES = {
  'Payment Pending (Confirmation)': ['Confirmation'],
};

// Groups every lead whose pending date has arrived (or passed) and hasn't
// been resolved yet, by status — e.g.
// { 'Demo': [...], 'Follow Up': [...], 'Payment Pending (Confirmation)': [...] }
// Only statuses with at least one matching lead are included, so a status
// with zero pending leads simply doesn't appear.
export function getPendingActionsByStatus(leads) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const groups = {};

  PENDING_REMINDER_STATUSES.forEach((statusName) => {
    const matchNames = [statusName, ...(STATUS_ALIASES[statusName] || [])];
    const matches = (leads || []).filter((lead) => {
      const status = (lead[6] || '').trim();
      const dateValue = (lead[PENDING_DATE_INDEX] || '').trim();
      if (!matchNames.includes(status)) return false;
      if (!dateValue || dateValue.toLowerCase().startsWith('closed')) return false;
      // dateValue is a plain "YYYY-MM-DD" string — lexicographic comparison
      // is equivalent to chronological comparison for that format.
      return dateValue <= todayStr;
    });

    if (matches.length > 0) {
      groups[statusName] = matches.map((lead) => ({
        rowNumber: lead[0],
        name: lead[3] || 'Unknown',
        phone: lead[5] || '',
        date: lead[PENDING_DATE_INDEX],
      }));
    }
  });

  return groups;
}

// Slot columns G-J are fixed time-of-day windows (9-11am/11am-1pm/1-4pm/
// 4pm-9am), not attempt numbers — a lead called twice in the same window on
// different days appends a second entry into that same cell instead of
// overwriting the first, so a slot cell can hold more than one
// comma-separated "Status (timestamp)" entry. Splits only on commas outside
// parentheses, since status names like "Payment Pending (Confirmation)"
// contain their own parens.
export function splitSlotEntries(raw) {
  const str = (raw || '').toString();
  if (!str.trim()) return [];
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
  return parts.map((p) => p.trim()).filter(Boolean);
}

// Column K — fetch-leads prepends the row number, so it lands here. Backend
// keeps this as the true running total of logged calls (summed across all 4
// slots' entries), independent of which/how many of the 4 cells are filled.
const ATTEMPTS_INDEX = 11;

function getAttemptCount(lead) {
  return parseInt(lead?.[ATTEMPTS_INDEX], 10) || 0;
}

// A lead is "done" once it reaches one of these — it no longer needs any
// more attempts, regardless of how many attempts it took. Includes both the
// current status vocabulary and the old text pre-dating the rename.
const TERMINAL_STATUSES = [
  'Client Lost', 'Lost',
  'Confirmation', 'Payment Pending (Confirmation)',
  'Paid', 'Enrolled',
  'Demo',
];

// Leads exactly ready for their Nth call attempt — active (non-terminal)
// status and exactly N-1 attempts made so far (1st Attempt = nobody's
// called yet, 2nd Attempt = only the 1st call is done, etc). This is a
// precise stage match, not "N or fewer attempts so far". A lead's current
// status (Follow Up, Connected, etc.) never excludes it from a tab — it's
// placed purely by how many attempts it has made. Returns the raw lead
// rows (full row data), so callers can page through them with the same
// detail view used elsewhere.
export function filterLeadsNeedingAttempt(leads, n) {
  return filterBySource(leads, PRIMARY_SOURCE).filter((lead) => {
    const status = (lead[6] || '').trim();
    if (TERMINAL_STATUSES.includes(status)) return false;
    return getAttemptCount(lead) === n - 1;
  });
}

// Same filter, condensed to just name/phone/status — for places that only
// need a summary (e.g. a count badge), not the full row.
export function getLeadsNeedingAttempt(leads, n) {
  return filterLeadsNeedingAttempt(leads, n).map((lead) => ({
    rowNumber: lead[0],
    name: lead[3] || 'Unknown',
    phone: lead[5] || '',
    status: (lead[6] || '').trim() || 'New Lead',
  }));
}

// A lead is "done" for two different reasons, both counted here: it
// reached a final status (Lost/Enrolled/Demo/etc — regardless of how many
// attempts that took), or it's used up 4 or more attempts without ever
// reaching one (>= rather than === since a reused slot can push the true
// count past 4). Together with filterLeadsNeedingAttempt(1-4), this fully
// partitions every lead into exactly one tab.
export function filterLeadsWithCompletedAttempts(leads) {
  return filterBySource(leads, PRIMARY_SOURCE).filter((lead) => {
    const status = (lead[6] || '').trim();
    if (TERMINAL_STATUSES.includes(status)) return true;
    return getAttemptCount(lead) >= 4;
  });
}
