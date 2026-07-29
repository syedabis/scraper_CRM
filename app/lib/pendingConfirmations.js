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

// Slot columns G-J. fetch-leads prepends the row number, so they land here.
const SLOT_INDICES = [7, 8, 9, 10];

// A lead is "done" once it reaches one of these — it no longer needs any
// more attempts, regardless of how many slots are filled. Includes both the
// current status vocabulary and the old text pre-dating the rename.
const TERMINAL_STATUSES = [
  'Client Lost', 'Lost',
  'Confirmation', 'Payment Pending (Confirmation)',
  'Paid', 'Enrolled',
  'Demo',
];

function countFilledSlots(lead) {
  return SLOT_INDICES.filter((idx) => (lead[idx] || '').toString().trim() !== '').length;
}

// Leads that still need their Nth call attempt — active (non-terminal)
// status and fewer than N attempts made so far. Mirrors the Dashboard's
// "still needed" count, but also returns the actual matching leads.
export function getLeadsNeedingAttempt(leads, n) {
  return (leads || [])
    .filter((lead) => {
      const status = (lead[6] || '').trim();
      if (TERMINAL_STATUSES.includes(status)) return false;
      return countFilledSlots(lead) < n;
    })
    .map((lead) => ({
      rowNumber: lead[0],
      name: lead[3] || 'Unknown',
      phone: lead[5] || '',
      status: (lead[6] || '').trim() || 'New Lead',
    }));
}
