// Lightweight session auth without external dependencies
// Compatible with both Node.js runtime and Next.js Edge runtime

const COOKIE_NAME = 'crm_session';

function getSecret() {
  const email = (process.env.EMAIL || 'admin').trim().replace(/^["']|["']$/g, '');
  const pass = (process.env.PASSWORD || 'secret').trim().replace(/^["']|["']$/g, '');
  return `${email}:${pass}:crm-secret-salt`;
}

function getExpectedCredentials() {
  const email = (process.env.EMAIL || process.env.ADMIN_EMAIL || process.env.AUTH_EMAIL || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  const password = (process.env.PASSWORD || process.env.ADMIN_PASSWORD || process.env.AUTH_PASSWORD || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  return { email, password };
}

// Convert string to Uint8Array
function strToBuf(str) {
  return new TextEncoder().encode(str);
}

// Base64url encoding
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

// Sign payload using HMAC-SHA256 via Web Crypto API
async function sign(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    strToBuf(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, strToBuf(message));
  const hashArray = Array.from(new Uint8Array(signature));
  const binaryString = String.fromCharCode(...hashArray);
  return base64UrlEncode(binaryString);
}

export async function createSessionToken(email) {
  const secret = getSecret();
  const payload = JSON.stringify({
    email,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  const encodedPayload = base64UrlEncode(payload);
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const secret = getSecret();
  const expectedSignature = await sign(encodedPayload, secret);

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, getExpectedCredentials };
