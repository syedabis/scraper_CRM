/**
 * ============================================================================
 * DataCrumbs Sales CRM — Meta CAPI Hybrid Sync (Google Apps Script)
 * ============================================================================
 * 
 * INSTALLATION INSTRUCTIONS:
 * 1. Open your Google Sheet (e.g., DataCrumbs Leads Sheet).
 * 2. In the top menu, click: Extensions ➔ Apps Script.
 * 3. Delete any existing template code and paste this entire script.
 * 4. Click the Save icon (💾).
 * 5. (One-time) To enable automatic sync on edit:
 *    - In the left sidebar of Apps Script, click the Alarm clock icon ("Triggers").
 *    - Click "+ Add Trigger" at the bottom right.
 *    - Choose which function to run: "installedOnEdit"
 *    - Select event source: "From spreadsheet"
 *    - Select event type: "On edit"
 *    - Click Save and grant Google permissions.
 * ============================================================================
 */

// Production API URL of the Sales Portal
const API_BASE_URL = 'https://sales.datacrumbs.org';

// Tracked milestones that trigger Meta CAPI
const MILESTONE_EVENTS = {
  'Demo': 'Schedule',
  'Registration': 'CompleteRegistration',
  'Payment Pending (Confirmation)': 'Lead',
  'Enrolled': 'Purchase'
};

/**
 * Creates custom menu at the top of Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Meta CAPI Sync')
    .addItem('🚀 Sync All Unsynced Leads Now', 'menuSyncAllLeads')
    .addItem('ℹ️ Check Sync Status for Selected Row', 'menuCheckRowStatus')
    .addToUi();
}

/**
 * Real-time trigger that fires whenever any cell is edited
 */
function installedOnEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();

  // Only trigger for active lead sheets
  const activeTabs = ['pretty', 'agent leads'];
  if (!activeTabs.includes(sheetName.toLowerCase())) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  // Trigger on Column F (Status = 6) OR Column M (Ad Tag Dropdown = 13)
  if ((col !== 6 && col !== 13) || row < 2) return;

  // Column M (Column 13) MUST be 'A' to send to Meta CAPI
  const columnMVal = (sheet.getRange(row, 13).getValue() || '').toString().trim().toUpperCase();
  if (columnMVal !== 'A') {
    Logger.log(`Row ${row} Column M is '${columnMVal}'. Skipping Meta CAPI.`);
    return;
  }

  const currentStatus = (sheet.getRange(row, 6).getValue() || '').toString().trim();
  const eventName = MILESTONE_EVENTS[currentStatus];

  // If not a tracked milestone, do nothing
  if (!eventName) return;

  // Check Column S (Column 19) to verify if already synced
  const columnSVal = (sheet.getRange(row, 19).getValue() || '').toString();
  if (columnSVal.toLowerCase().includes(eventName.toLowerCase())) {
    Logger.log(`Row ${row} already synced for ${eventName}. Skipping.`);
    return;
  }

  // Call the Next.js API to process CAPI and stamp Column S
  try {
    const payload = {
      sheetName: sheetName,
      rowIndex: row,
      status: currentStatus
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(`${API_BASE_URL}/api/sync-sheet-capi`, options);
    const result = JSON.parse(response.getContentText());

    if (result.success && result.synced) {
      sheet.getRange(row, 19).setValue(result.columnS || `Synced: ${eventName}`);
      Logger.log(`Successfully synced row ${row} as ${eventName}`);
    }
  } catch (err) {
    Logger.log(`Error syncing row ${row}: ${err.message}`);
  }
}

/**
 * Menu action: Scans the entire sheet and syncs all unsynced milestone leads
 */
function menuSyncAllLeads() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const sheetName = sheet.getName();

  ui.showToast('Scanning sheet for unsynced milestone leads...', 'Meta CAPI', 5);

  try {
    const url = `${API_BASE_URL}/api/sync-sheet-capi?sheetName=${encodeURIComponent(sheetName)}&action=scanAndSync`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const result = JSON.parse(response.getContentText());

    if (result.success) {
      const msg = `Sync Complete!\n\n• Sheet: ${sheetName}\n• Total Checked: ${result.totalChecked}\n• Newly Synced: ${result.syncedCount}\n• Skipped (Already Synced / Other): ${result.skippedCount}`;
      ui.alert('Meta CAPI Sync Report', msg, ui.ButtonSet.OK);
    } else {
      ui.alert('Sync Failed', result.error || 'Unknown error occurred.', ui.ButtonSet.OK);
    }
  } catch (err) {
    ui.alert('Error', `Network request failed: ${err.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Menu action: Checks the sync status of the currently selected row
 */
function menuCheckRowStatus() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const row = sheet.getActiveCell().getRow();

  if (row < 2) {
    ui.alert('Please select a lead row (row 2 or below).');
    return;
  }

  const name = sheet.getRange(row, 3).getValue();
  const phone = sheet.getRange(row, 5).getValue();
  const status = sheet.getRange(row, 6).getValue();
  const colM = sheet.getRange(row, 13).getValue();
  const syncStatus = sheet.getRange(row, 19).getValue();

  const msg = `Row ${row} Details:\n\n• Name: ${name || 'N/A'}\n• Phone: ${phone || 'N/A'}\n• Status: ${status || 'N/A'}\n• Ad Tag (Col M): ${colM || 'Empty (Not sent to Meta)'}\n• Meta CAPI (Col S): ${syncStatus || 'Not Synced'}`;
  ui.alert('Lead CAPI Status', msg, ui.ButtonSet.OK);
}
