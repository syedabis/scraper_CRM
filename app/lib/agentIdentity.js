import { auth, currentUser } from '@clerk/nextjs/server';

// Who is making this request. Taken from the verified Clerk session rather than
// from the request body — an agent name is the basis of the per-person
// reporting, so it must not be something a client can simply claim to be.
//
// Works for both clients: the browser presents a session cookie, the mobile app
// presents the same session as an Authorization: Bearer token, and Clerk
// verifies either.
export async function getAgent() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.username ||
    email ||
    userId;

  return { userId, name, email };
}
