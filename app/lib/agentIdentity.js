import { cookies, headers } from 'next/headers';
import { COOKIE_NAME, verifySessionToken } from './auth';

// Who is making this request. Verified from session cookie or Authorization Bearer header.
export async function getAgent() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = await verifySessionToken(token);
    if (session?.email) {
      const email = session.email;
      const name =
        process.env.AGENT_NAME ||
        email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        userId: email,
        name,
        email,
      };
    }
  } catch {
    // Continue to header check
  }

  try {
    const headerList = await headers();
    const authHeader = headerList.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const session = await verifySessionToken(token);
      if (session?.email) {
        const email = session.email;
        const name =
          process.env.AGENT_NAME ||
          email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        return {
          userId: email,
          name,
          email,
        };
      }
    }
  } catch {
    // Return null below
  }

  return null;
}
