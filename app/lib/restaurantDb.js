import fs from 'fs';
import path from 'path';

const CSV_PATH = path.join(process.cwd(), 'restaurants.csv');

// Standard CRM columns to append if missing
const CRM_FIELDS = ['status', 'notes', 'attempts', 'last_called', 'contact_person', 'callback_date'];

/**
 * Robust RFC 4180 CSV parser
 */
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // Skip escaped quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        // Ignore carriage return
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 0 && currentRow.some((f) => f.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Format a field for CSV (quote if it contains commas, quotes, or newlines)
 */
function escapeCSVField(val) {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format rows back to CSV text
 */
function serializeCSV(headers, rows) {
  const headerLine = headers.map(escapeCSVField).join(',');
  const lines = rows.map((row) => headers.map((h) => escapeCSVField(row[h] || '')).join(','));
  return [headerLine, ...lines].join('\n') + '\n';
}

/**
 * Reads all restaurants from restaurants.csv, ensuring CRM fields exist
 */
export function getAllRestaurants() {
  if (!fs.existsSync(CSV_PATH)) {
    return [];
  }

  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(content);
  if (rows.length < 2) return [];

  const rawHeaders = rows[0].map((h) => h.trim());
  let headers = [...rawHeaders];

  // Ensure CRM fields are in headers
  let needsRewrite = false;
  for (const field of CRM_FIELDS) {
    if (!headers.includes(field)) {
      headers.push(field);
      needsRewrite = true;
    }
  }

  const items = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const item = {};

    rawHeaders.forEach((h, idx) => {
      item[h] = row[idx] !== undefined ? row[idx] : '';
    });

    // Default values for CRM fields
    item.status = item.status && item.status.trim() ? item.status : 'New Lead';
    item.notes = item.notes || '';
    item.attempts = item.attempts ? parseInt(item.attempts, 10) || 0 : 0;
    item.last_called = item.last_called || '';
    item.contact_person = item.contact_person || '';
    item.callback_date = item.callback_date || '';

    // Clean up city/state for consistency
    if (item.city) item.city = item.city.trim();
    if (item.state) item.state = item.state.trim();

    items.push(item);
  }

  if (needsRewrite) {
    saveAllRestaurants(items, headers);
  }

  return items;
}

/**
 * Save all restaurants back to restaurants.csv
 */
export function saveAllRestaurants(items, customHeaders = null) {
  let headers = customHeaders;
  if (!headers || headers.length === 0) {
    if (items.length > 0) {
      headers = Object.keys(items[0]);
    } else {
      headers = [
        'id', 'name', 'phone', 'city', 'state', 'zip_code', 'country',
        'full_location', 'latitude', 'longitude', 'listing_url', 'image_url',
        ...CRM_FIELDS,
      ];
    }
  }

  // Ensure CRM fields exist in header order
  for (const field of CRM_FIELDS) {
    if (!headers.includes(field)) {
      headers.push(field);
    }
  }

  const csvOutput = serializeCSV(headers, items);
  fs.writeFileSync(CSV_PATH, csvOutput, 'utf-8');
}

/**
 * Update a single restaurant by ID
 */
export function updateRestaurant(id, updates) {
  const items = getAllRestaurants();
  const idStr = String(id).trim();
  const index = items.findIndex((r) => String(r.id).trim() === idStr);

  if (index === -1) {
    return null;
  }

  const existing = items[index];

  // If status is being updated, or note is added, increment attempt count if specified
  const updatedItem = {
    ...existing,
    ...updates,
    id: existing.id, // prevent changing ID
  };

  if (updates.attempts !== undefined) {
    updatedItem.attempts = Number(updates.attempts) || 0;
  }

  items[index] = updatedItem;
  saveAllRestaurants(items);
  return updatedItem;
}

/**
 * Add a new restaurant
 */
export function addRestaurant(data) {
  const items = getAllRestaurants();
  const newId = String(Date.now().toString().slice(-6));

  const newRestaurant = {
    id: newId,
    name: (data.name || '').trim(),
    phone: (data.phone || '').trim(),
    city: (data.city || '').trim(),
    state: (data.state || '').trim(),
    zip_code: (data.zip_code || '').trim(),
    country: (data.country || 'United States').trim(),
    full_location: data.full_location || `${data.city || ''}, ${data.state || ''} ${data.zip_code || ''}, United States`.trim(),
    latitude: data.latitude || '',
    longitude: data.longitude || '',
    listing_url: data.listing_url || '',
    image_url: data.image_url || '',
    status: data.status || 'New Lead',
    notes: data.notes || '',
    attempts: Number(data.attempts) || 0,
    last_called: data.last_called || '',
    contact_person: data.contact_person || '',
    callback_date: data.callback_date || '',
  };

  items.unshift(newRestaurant);
  saveAllRestaurants(items);
  return newRestaurant;
}

/**
 * Compute aggregated stats for the dashboard
 */
export function getRestaurantStats() {
  const items = getAllRestaurants();
  const total = items.length;

  const statusCounts = {
    'New Lead': 0,
    'Connected': 0,
    'Follow Up': 0,
    'Interested': 0,
    'Meeting Scheduled': 0,
    'Closed': 0,
    'Not Interested': 0,
  };

  const cityCounts = {};
  const stateCounts = {};
  let totalAttempts = 0;

  for (const item of items) {
    const s = item.status || 'New Lead';
    statusCounts[s] = (statusCounts[s] || 0) + 1;

    totalAttempts += Number(item.attempts) || 0;

    const city = item.city || 'Unknown';
    cityCounts[city] = (cityCounts[city] || 0) + 1;

    const state = item.state || 'Unknown';
    stateCounts[state] = (stateCounts[state] || 0) + 1;
  }

  const contacted = total - (statusCounts['New Lead'] || 0);
  const contactedRate = total > 0 ? Math.round((contacted / total) * 100) : 0;
  const interested = (statusCounts['Interested'] || 0) + (statusCounts['Meeting Scheduled'] || 0);
  const closed = statusCounts['Closed'] || 0;
  const conversionRate = contacted > 0 ? Math.round((closed / contacted) * 100) : 0;

  return {
    total,
    contacted,
    contactedRate,
    interested,
    closed,
    conversionRate,
    totalAttempts,
    statusCounts,
    cityCounts,
    stateCounts,
    restaurants: items,
  };
}
