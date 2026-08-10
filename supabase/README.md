# Live phone → web handoff — setup

The agent calls from the phone. The lead opens by itself in **that same agent's**
web portal. They type the status and notes on the web. The phone hears "saved"
and dials the next number.

Until the two env vars below are set, **nothing changes** — no switch on the
phone, no banner in the portal, no websocket. Everything works exactly as it
does today.

---

## What is stored, and what is not

One row per agent, holding a pointer and a number:

| agent_id | lead_key | phase | duration_seconds |
|---|---|---|---|
| `user_2ab…` | `Pretty#517` | `awaiting` | `93` |

That is the whole record. **No customer name, phone, email, status or notes
ever leaves Google Sheets.** Both devices already have the full lead list
loaded, so a row pointer is all they need to agree on which lead is on screen.
Notes in particular are typed on the web and written straight to the sheet —
they never touch Supabase.

Duration is there because the phone is the only device that can measure it, and
the sheet needs it for talk time and Agent Tracking.

---

## One-time setup (about 15 minutes)

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Region: **Asia-Pacific → Mumbai (ap-south-1)** if offered, otherwise
   **Singapore (ap-southeast-1)**. Mumbai is the closest to Karachi.
3. Free plan. No card needed.

Security options on that same screen:

| Option | Set it to | Why |
|---|---|---|
| Enable Data API | **On** | Required — `supabase-js` talks to it. Nothing works without it. |
| Automatically expose new tables | **Off** | Supabase's own recommendation. `live_handoff.sql` grants access to its one table explicitly, so it does not rely on this. |
| Enable automatic RLS | **On** | A free safety net. The SQL turns RLS on for this table itself, but this stops a future table being created without it. |

### 2. Create the table

Open **SQL Editor → New query**, paste the whole of
[`live_handoff.sql`](./live_handoff.sql), and run it.

It is safe to re-run at any time.

### 3. Connect Clerk to Supabase

This is what makes each agent see only their own row.

1. In **Clerk dashboard** → search for **Supabase** → open **Connect with
   Supabase** → choose your Clerk instance → it gives you a **Clerk domain**
   (looks like `your-app.clerk.accounts.dev`)
2. In **Supabase dashboard** → **Authentication → Sign In / Providers →
   Third Party Auth** → **Add provider → Clerk** → paste that domain

Do **not** use the older "Clerk integration" that asks for your JWT secret —
Supabase has deprecated it.

### 4. Get the two keys

**Supabase → Project Settings → Data API**:

- **Project URL** — `https://xxxxx.supabase.co`
- **anon / publishable key** — the long `sb_publishable_…` string

The anon key is meant to be public. Row-level security is what protects the
data, not the key.

### 5. Set the env vars

**Portal** — in Vercel → Project → Settings → Environment Variables (and in
`.env.local` for local dev):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
```

Redeploy after adding them.

**Mobile** — in `Sales-Mobile-Datacrumbs/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
```

### 6. Rebuild the APK

`EXPO_PUBLIC_*` values are baked in at build time, so the phone needs a new
build to pick them up:

```bash
cd Sales-Mobile-Datacrumbs
npm run apk
```

---

## How an agent uses it

1. Sign in to the portal on the laptop, open **Calling**. The header shows
   **Phone linked**.
2. On the phone, open the calling screen and switch **Update status on the web**
   on. It is remembered on that phone.
3. Call as normal — Start for auto-dialling, or tap the number.
4. The lead opens in the portal by itself, with an amber banner while the call
   is live and a green one once it ends.
5. Type the status and notes in the portal and save. The phone moves to the next
   lead on its own.

**The phone's own status buttons never go away.** If the laptop is closed, the
internet drops, or the agent simply prefers the phone, they save there and the
queue carries on. The phone waits indefinitely for the web — it never times out
— because there is always that way out.

Agents who work from the phone alone just leave the switch off. It is off by
default for everyone.

---

## Cost

| | Free plan gives | 10 agents use about |
|---|---|---|
| Realtime connections | 200 | 20 |
| Realtime messages | 2,000,000 / month | 26,000 |
| Database size | 500 MB | a few KB |

Well inside the free plan, and it adds **no Vercel function calls at all** —
the phone and browser talk to Supabase directly over a websocket rather than
polling the portal.

One thing to know: **free Supabase projects pause after a full week with no
activity.** Daily use keeps it awake; weekends are only two days. After a long
holiday someone unpauses it from the dashboard, and agents can keep working
from the phone in the meantime.

---

## Checking it works

- **Portal header says "Phone offline"** — the browser could not open the
  websocket. Check the two env vars are set in Vercel and that you redeployed.
- **Switch missing on the phone** — the APK was built before the env vars were
  added. Rebuild.
- **Nothing opens in the portal** — confirm both devices are signed in as the
  *same* Clerk user, then check **Supabase → Table Editor → live_handoff** for a
  row appearing when the agent dials.
- **Row appears but the browser ignores it** — step 3 (Clerk → Supabase) is
  usually the missing piece.
