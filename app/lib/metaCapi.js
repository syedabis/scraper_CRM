import crypto from 'crypto';

/**
 * Mapping of CRM Statuses to Meta Standard Events
 */
export const STATUS_TO_META_EVENT = {
  'Demo': 'Schedule',
  'Registration': 'CompleteRegistration',
  'Payment Pending (Confirmation)': 'Lead',
  'Enrolled': 'Purchase',
};

// In-memory cache to prevent duplicate CAPI calls within the same server instance
// Keys: `${eventName}_${normalizedPhone}`
const dispatchedEventCache = new Set();

/**
 * Normalizes a phone number to standard international format (E.164 without '+')
 * E.g., 03001234567 -> 923001234567
 */
export function normalizePhone(rawPhone) {
  if (!rawPhone) return null;
  let cleaned = rawPhone.toString().replace(/\D/g, '');
  if (!cleaned) return null;

  // Handle Pakistan mobile numbers
  if (cleaned.startsWith('03') && cleaned.length === 11) {
    cleaned = '92' + cleaned.substring(1);
  } else if (cleaned.startsWith('3') && cleaned.length === 10) {
    cleaned = '92' + cleaned;
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  return cleaned;
}

/**
 * Normalizes an email address (trimmed, lowercase)
 */
export function normalizeEmail(rawEmail) {
  if (!rawEmail) return null;
  const trimmed = rawEmail.toString().trim().toLowerCase();
  if (!trimmed.includes('@')) return null;
  return trimmed;
}

/**
 * Computes SHA-256 hash for Meta user data parameters
 */
export function hashSha256(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Checks if a lead was created within the Meta 7-day attribution window
 */
export function isWithinAttributionWindow(rawDate, maxDays = 7) {
  if (!rawDate) return true; // Default allow if date is unavailable
  try {
    const leadDate = new Date(rawDate);
    if (isNaN(leadDate.getTime())) return true;
    const diffMs = Date.now() - leadDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= maxDays;
  } catch {
    return true;
  }
}

/**
 * Sends a server-side conversion event to Meta Conversions API (CAPI)
 *
 * @param {Object} params
 * @param {string} params.status - New CRM status
 * @param {string} params.previousStatus - Previous CRM status (to avoid redundant sends)
 * @param {string} params.phone - Customer phone number
 * @param {string} params.email - Customer email address (optional)
 * @param {string} params.leadDate - Lead creation date (to check 7-day window)
 * @param {string} params.owner - Sheet name/owner (e.g., 'Pretty')
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export async function sendMetaCapiEvent({
  status,
  previousStatus,
  phone,
  email,
  leadDate,
  owner,
}) {
  const eventName = STATUS_TO_META_EVENT[status];

  // 1. Check if status is a tracked milestone
  if (!eventName) {
    return { success: false, reason: `Status '${status}' is not a tracked Meta milestone.` };
  }

  // 2. Prevent sending if previous status was already the same milestone
  if (previousStatus && previousStatus.trim().toLowerCase() === status.trim().toLowerCase()) {
    return { success: false, reason: `Status '${status}' was already active. Duplicate skipped.` };
  }

  // 3. Normalize customer identifiers
  const cleanPhone = normalizePhone(phone);
  const cleanEmail = normalizeEmail(email);

  if (!cleanPhone && !cleanEmail) {
    console.warn('[Meta CAPI] Skipped: No valid phone or email provided for lead.');
    return { success: false, reason: 'No valid phone or email available.' };
  }

  // 4. Verify attribution window (Meta's official offline conversion window is up to 28 days)
  // Paying students ('Enrolled') are never skipped early (up to 90 days); others allow 28 days.
  const maxDays = status === 'Enrolled' ? 90 : 28;
  if (!isWithinAttributionWindow(leadDate, maxDays)) {
    console.log(`[Meta CAPI] Skipped: Lead created on '${leadDate}' exceeds the ${maxDays}-day attribution window.`);
    return { success: false, reason: `Lead is older than ${maxDays} days.` };
  }

  // 5. In-memory deduplication check (fire-once rule)
  const dedupeKey = `${eventName}_${cleanPhone || cleanEmail}`;
  if (dispatchedEventCache.has(dedupeKey)) {
    console.log(`[Meta CAPI] Skipped: Event '${dedupeKey}' was already dispatched recently.`);
    return { success: false, reason: 'Event already dispatched in this session.' };
  }

  // 6. Check environment configuration
  const datasetId = process.env.META_DATASET_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const testEventCode = process.env.META_TEST_EVENT_CODE;

  if (!datasetId || !accessToken) {
    console.log('[Meta CAPI] Notice: META_DATASET_ID or META_CAPI_ACCESS_TOKEN is not configured in env. Skipping event dispatch.');
    return { success: false, reason: 'Meta CAPI credentials not configured.' };
  }

  // 7. Prepare user_data with SHA-256 hashes
  const userData = {};
  if (cleanPhone) {
    userData.ph = [hashSha256(cleanPhone)];
  }
  if (cleanEmail) {
    userData.em = [hashSha256(cleanEmail)];
  }

  // 8. Custom data (monetary value for Enrolled / Purchase)
  let customData = undefined;
  if (status === 'Enrolled') {
    const defaultVal = Number(process.env.META_DEFAULT_ENROLLMENT_VALUE) || 20000;
    const currency = process.env.META_DEFAULT_CURRENCY || 'PKR';
    customData = {
      currency,
      value: defaultVal,
    };
  }

  // Deterministic event_id for Meta server-side 48hr deduplication
  const eventId = `${eventName.toLowerCase()}_${cleanPhone || cleanEmail}`;

  const eventPayload = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: 'https://sales.datacrumbs.org/calling',
    event_id: eventId,
    user_data: userData,
    ...(customData ? { custom_data: customData } : {}),
  };

  const requestBody = {
    data: [eventPayload],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  try {
    const url = `https://graph.facebook.com/v20.0/${datasetId}/events?access_token=${accessToken}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[Meta CAPI] Error response from Meta Graph API:', responseData);
      return { success: false, reason: responseData?.error?.message || 'Meta API error' };
    }

    // Mark as dispatched
    dispatchedEventCache.add(dedupeKey);
    // Keep cache bounded
    if (dispatchedEventCache.size > 5000) {
      const firstEntry = dispatchedEventCache.values().next().value;
      dispatchedEventCache.delete(firstEntry);
    }

    console.log(`[Meta CAPI] Successfully sent '${eventName}' for phone ending in ...${cleanPhone?.slice(-4)}`);
    return { success: true, data: responseData };
  } catch (err) {
    console.error('[Meta CAPI] Network error while calling Meta Graph API:', err);
    return { success: false, reason: err.message };
  }
}
