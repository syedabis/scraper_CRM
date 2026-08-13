# Cognos Sales CRM (DataCrumbs Sales Portal)

Sales CRM for DataCrumbs' bootcamp sales team. Agents call leads, log outcomes,
track installment payments, and get performance/attendance reporting. There is
no app database — **Google Sheets is the source of truth** for almost
everything; a small Supabase table exists only as a live "pointer" channel
between the phone app and this portal (see Live Handoff below).

## Architecture

```
Web portal (this repo, Next.js 15 App Router, Vercel)
  → reads/writes Google Sheets directly from API routes (googleapis, service account)
  → reads/writes one Supabase table (live_handoff) for phone↔web call handoff
  → proxies receipt generation to a separate FastAPI service (payslips-bootcamp1/)

Mobile app (separate repo, "Sales-Mobile-Datacrumbs", Expo/React Native — not in this repo)
  → reads/writes the SAME Google Sheet directly (same lead rows, same call-logs/
    agent-sessions tabs) and the same Supabase live_handoff table
  → this is how a phone call and this portal can show the same lead at the same time

payslips-bootcamp1/ (FastAPI, Python, deployed separately to Heroku via its own Procfile)
  → generates the actual PDF receipt and emails it (ReportLab + SendGrid/SMTP)
  → called by app/api/generate-receipt/route.js over HTTP with an API key
```

Nothing here uses a traditional app database. Two Google Sheets are the real
backend:
- **Leads sheet** (`GOOGLE_SHEET_ID`) — tabs `Preety` (primary lead pool) and
  `Agent Leads` (a second, separate pool — see "Two lead pools" below), plus
  two append-only log tabs (`call-logs`, `agent-sessions`) the code creates on
  first use if they don't exist yet.
- **Installment sheet** (`INSTALLMENT_SHEET_ID`) — tabs `ep-40`, `ep-41`,
  `ep-42` (batch cohorts), payment status per student.

Plus one Supabase Postgres table (`live_handoff`, see `supabase/`) and one
external payment-log Google Sheet (`PAYMENT_LOG_SHEET_ID`) for receipts.

## Auth

Clerk (`middleware.js` protects every route except `/sign-in`, `/sign-up`,
`/forgot-password`). `app/lib/agentIdentity.js`'s `getAgent()` reads the
verified Clerk session (not the request body) to identify who is calling —
same session works from both the browser (cookie) and the mobile app
(Authorization: Bearer token).

## Design system

Two token systems coexist in `app/globals.css`, both dark-only:
- **Material-ish tokens** (`--color-primary`, `--color-surface-container*`,
  `--color-on-*`) — used by Calling, Admin, Data Entry, Agent Tracking. All
  green-accented (`--color-primary: #5ce46d`) as of the neon-green reskin.
- **Brand/glass tokens** (`--color-brand-purple/green/orange/blue`,
  `.glass-card`, `.kpi-*`) — used by the Dashboard's KPI cards and charts
  only. Currently still distinct purple/orange/blue per KPI card (a colleague
  reintroduced that variety after an earlier session had made everything
  monochrome green — worth checking which is current before assuming).
- Chart.js canvases can't read CSS variables, so `app/page.js` keeps raw hex
  JS constants (`C_PURPLE` etc.) that must be kept in sync with the CSS tokens
  by hand.
- `statusActions` colors in `app/calling/page.js` (the "Update Status"
  buttons — Connected/No Answer/Follow Up/etc.) are a hardcoded palette the
  user has explicitly asked not to be changed as part of general theming.

## Two lead pools

`PRIMARY_SOURCE` (read from `process.env.PRIMARY_SHEET_NAME`, currently `Preety`) and
`AGENT_SOURCE` (read from `process.env.AGENT_SHEET_NAME`, currently `Agent Leads`)
(`app/lib/pendingConfirmations.js`). Kept deliberately separate — status
categories and the "Still Needed" attempt tabs only ever look at `Pretty`.
Every lead row fetched client-side gets tagged with which sheet it came from
at `SOURCE_INDEX` (19, appended client-side, not a real sheet column) because
a row *number* is not unique across tabs — row 5 exists in both. `leadKey(lead)`
(`"<source>#<row>"`) is the only safe way to identify a lead across the app.

## Sheet column layout (leads tabs — `Pretty` / `Agent leads`)

`fetch-leads` prepends the row number as index 0, so every consumer's index
is "sheet column position + 1":

| Index | Sheet col | Meaning |
|---|---|---|
| 0 | — | row number (prepended by fetch-leads, not a real column) |
| 1 | A | Date |
| 2 | B | Time |
| 3 | C | Name |
| 4 | D | Email |
| 5 | E | Phone |
| 6 | F | Status |
| 7–10 | G–J | Slot 1–4 — **fixed time-of-day windows** (9-11am/11am-1pm/1-4pm/4pm-9am), **not attempt order**. See gotcha below. |
| 11 | K | Number of Attempts (true running total, see gotcha) |
| 12 | L | Notes |
| 13 | M | GRP UPDATE |
| 14 | N | Confirmation/Pending date, or `Closed (date)` |
| 15–17 | O–Q | Talk-time rollup: total seconds / formatted duration / last-call timestamp |
| 18 | R | `=CONCATENATE(...)` live formula joining all 4 slots |
| 19 | — | `SOURCE_INDEX` — client-appended tag, which sheet tab this row came from |

Status vocabulary (current → old alias still recognized): New Lead, Connected
(Call Received), No Answer (Not Received), Follow Up (Call Later / Awaiting
Response), Registration (Form Filled), Payment Pending (Confirmation)
(Confirmation), Demo, Enrolled (Paid), Lost (Client Lost).

## Known gotchas

- **Slot columns are time-of-day, not attempt number.** A lead called twice
  in the same window (e.g. 9-11am) on two different days used to silently
  **overwrite** the earlier call's record and undercount `Number of
  Attempts`, which left leads permanently stuck in the wrong "Still Needed"
  tab. Fixed: a reused slot now **appends** a new comma-separated entry
  instead of overwriting (`splitSlotEntries()` in `pendingConfirmations.js`
  parses these, respecting parens in status names like "Payment Pending
  (Confirmation)"), and `Number of Attempts` is the true total entry count
  across all 4 slots, not "how many of the 4 cells are non-empty". Both
  `app/api/update-lead-status/route.js` (web, manual) and
  `app/api/log-call/route.js` (used when a live phone handoff is active)
  implement this the same way.
- **`filterLeadsWithCompletedAttempts` uses `>= 4`, not `=== 4`** — a reused
  slot can push the true attempt count past 4, and there's no 5th tab for it
  to go to.
- **Receipt generation Drive upload (fixed, keep the fix in mind):** service
  accounts created after a certain date get 0 storage quota, and a file
  uploaded into a My Drive folder is owned by (and billed to) the *uploader*,
  not the folder owner — so `drive.files.create` 403'd for every receipt.
  Fixed by splitting the single Google auth client in `generate-receipt/
  route.js` into two: Sheets logging still uses the main service account,
  but Drive uploads use separate `DRIVE_GOOGLE_CLIENT_EMAIL` /
  `DRIVE_GOOGLE_PRIVATE_KEY` credentials pointing at an older account that
  still has quota (falls back to the main credentials if unset). This is a
  stopgap — the durable fix is a Shared Drive or moving screenshots off
  Drive.
- **Two different "search" implementations existed** — the Calling page's
  search now matches name *or* phone (digits-only comparison for phone so
  formatting differences don't block a match) against the already-loaded
  lead list; it used to be phone-only and re-fetched on every keystroke.
- **Installment sheet header layout is not identical across tabs** — `ep-42`
  only has 3 installment columns (no "4th"), the "Emails" column index varies
  per tab, some tabs lead with an "Enrollment Number" column before Customer
  Name (shifting Name/Phone to indices 1/2 instead of 0/1), and one tab's
  header cell is flat-out corrupted (`EP-34`'s name column header is just
  `"f"`). Never hardcode column positions for the installment sheet; locate
  every column by header text with a positional fallback for Name (→0) and
  Phone (→1) (see `fetch-installments/route.js`'s `classifyInstallment`/
  `ordinalOf` and `fetch-paid-students/route.js`'s `locateColumns`).
- **The installment spreadsheet has 30+ tabs, most hidden, and only some are
  real batch cohorts** — the rest are unrelated scratch sheets that happen to
  live in the same file (old lead dumps, a store-name list, a "Cursor
  Subscriptions" tab, summary rollups) or stale duplicate copies of a real
  batch (e.g. "Copy of EP-36" — identical rows to `EP-36`). `fetch-paid-
  students/route.js`'s `BATCH_TABS` is a hand-verified allowlist of the real
  ones — don't switch it to "every hidden tab" without re-checking each one's
  header row first, or duplicates/garbage rows will silently reappear.
  `fetch-installments/route.js` (the Dashboard's Pending Installments /
  Installments by Batch cards) still only covers `ep-40`/`ep-41`/`ep-42` —
  it was never extended to the full `BATCH_TABS` list, so its totals will not
  reconcile with Paid Students' totals. Worth aligning the two at some point.
- **`git pack-refs` staleness**: if `git pull`/`fetch` fails with "incorrect
  old value provided" on `refs/remotes/origin/main`, it's a stale
  `packed-refs` entry racing the loose ref (common after an interrupted
  fetch). Fix: `git pack-refs --all --prune`, then pull again — no data is
  at risk, it only rewrites the ref index.
- **Never build while `npm run dev` is running** — it corrupts `.next`
  (happened twice before). Check for a running `next dev --turbopack`
  process first.
- `_status-migration-backup.json` (repo root) is a local-only safety dump
  from a past status-vocabulary migration — never stage/commit it.
  `index.html` (repo root) is a one-off design reference file, also never
  committed as a real page.

## Live Handoff (phone → web)

Optional, off until `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set (portal behaves exactly as before if
unset — see `app/lib/useLiveHandoff.js`'s `liveHandoffConfigured`). When
configured: the agent calls from the phone; the same lead opens automatically
in *that agent's* browser tab; the agent types status/notes on the web; the
phone sees "saved" and dials the next number. Only a pointer
(`{agent_id, lead_key: "Pretty#517", phase, duration_seconds}`) ever touches
Supabase — no customer data leaves Google Sheets. Isolation is via Clerk: the
`agent_id` is the same Clerk user id on both devices, and Postgres row-level
security (in `supabase/live_handoff.sql`) restricts each row to its owner.
Full setup steps in `supabase/README.md`. Free Supabase projects **pause
after a week of no activity** — someone has to unpause from the dashboard
after a long break.

## Agent Tracking / call logging

`call-logs` and `agent-sessions` are append-only tabs (`app/lib/callLogs.js`
defines their headers, auto-created on first use). One row per call, one row
per clock-in/break/clock-out tap — nothing is ever overwritten, so a crashed
app can't lose or corrupt history. `app/lib/agentSessions.js`'s
`buildSessions()` replays the raw tap log into actual shifts (handles
forgotten clock-outs, still-open sessions, double-starts). `/api/log-call`
does three things atomically-ish in one batch update: appends the call-logs
row, updates the lead's status/slot/attempts/notes columns, and refreshes the
O/P/Q talk-time rollup — so a request that dies partway can't leave a lead
with a new status but a stale total.

## File map

```
app/
├── layout.js                      Root layout — ClerkProvider, Geist font, Material Symbols
├── globals.css                    Both token systems (Material + brand/glass), see "Design system"
├── page.js                        Dashboard — KPI cards, Leads Overview / Conversion by
│                                   Attempts charts (Chart.js), Leads by Attempts breakdown
│                                   (parses column R chronologically — see gotcha above),
│                                   Pending Installments donut, Installments by Batch
├── middleware.js                  Clerk route protection
│
├── components/
│   ├── AppShell.js                Page chrome: ambient bg, Sidebar, TopNav, scroll container.
│   │                              `collapsibleSidebar` prop = Dashboard-only collapse behavior
│   ├── Sidebar.js                 Primary nav (Dashboard/Calling/Data Entry/Send Invoice/
│   │                              Paid Students/Agent Tracking/Admin). Pages that need a
│   │                              different sidebar (Calling's categories, Data Entry) pass
│   │                              `sidebarExtra` instead
│   └── TopNav.js                  Fixed header bar — page title + a `search` slot each page fills
│
├── calling/page.js                *** the big one *** single-lead-at-a-time calling workspace.
│                                   Sidebar: status categories + "Still Needed" 1st-4th-attempt
│                                   tabs + Completed Attempts, all filtered to PRIMARY_SOURCE only.
│                                   Update Status buttons (statusActions — do not recolor).
│                                   Posts to /api/log-call when a live phone handoff is active,
│                                   /api/update-lead-status otherwise. Search by name/phone.
│                                   Call History panel shows every entry per reused slot.
│                                   "Last Reached" column (4th-Attempt tab only) — most recent
│                                   timestamp across all slot entries.
├── admin/page.js                  Per-agent stats + a date-picker "activity on this day" view
├── data-entry/page.js             New-lead intake form (phone validation, duplicate check)
├── send-invoice/page.js           Payment screenshot + amount → POSTs to /api/generate-receipt
├── paid-students/page.js          Every student with ≥1 paid installment, across all verified
│                                   batch tabs (see gotcha below). Search by name/phone/email +
│                                   batch filter, table shows Name/Phone/Email/Installments Paid
│                                   ("2/4")/Batch. In-table scroll (max-h-[65vh]), defaults to
│                                   showing 50 rows with a Show 50/100/200/All selector — never
│                                   grows the page. Reads /api/fetch-paid-students
├── agent-tracking/page.js         Shift/session + call-volume reporting per agent, date-range
│                                   picker with presets, built on buildSessions()
│
├── sign-in/[[...sign-in]]/page.js )
├── sign-up/[[...sign-up]]/page.js ) Clerk auth flows — light-card style, distinct from the
├── forgot-password/page.js        ) rest of the app's dark theme
│
├── lib/
│   ├── pendingConfirmations.js    Lead-source constants (PRIMARY_SOURCE/AGENT_SOURCE/leadKey),
│   │                              splitSlotEntries() (the slot-append parser), attempt-count/
│   │                              tab-partition logic, pending-reminder-by-date grouping
│   ├── agentIdentity.js           getAgent() — verified Clerk identity for API routes
│   ├── agentSessions.js           buildSessions() — replays raw clock events into shifts
│   ├── callLogs.js                Shared Sheets plumbing for call-logs/agent-sessions tabs:
│   │                              ensureTab(), Pakistan-timezone timestamp helpers
│   └── useLiveHandoff.js          Client hook: Supabase Realtime subscription for the phone→web
│                                  pointer, token refresh, tab-visibility reconnect
│
└── api/
    ├── fetch-leads/route.js           GET — reads a leads tab, prepends row numbers, drops
    │                                  blank formula-only rows
    ├── update-lead-status/route.js    POST — manual (web-only) status update: append-to-slot,
    │                                  recompute true attempt count, write status/notes/date
    ├── log-call/route.js              POST — used when a live handoff call just ended: same
    │                                  slot/attempts/status logic as above, PLUS appends a
    │                                  call-logs row and updates the O/P/Q talk-time rollup
    ├── update-lead-info/route.js      POST — edit name/email/phone on an existing lead
    ├── submit-lead/route.js           POST — new lead intake, with duplicate-phone check and
    │                                  auto-generated "prospect_N" name when none given
    ├── fetch-installments/route.js    GET — aggregated paid/pending/not-paying counts per
    │                                  batch + per-ordinal, across all 3 installment tabs
    ├── fetch-paid-students/route.js   GET — every student with ≥1 paid installment, flattened
    │                                  across all verified batch tabs (BATCH_TABS — 18 tabs, not
    │                                  just ep-40/41/42, see gotcha below), for the Paid Students
    │                                  page. Locates columns by header text like fetch-installments
    ├── generate-receipt/route.js      POST — uploads payment screenshot to Drive (separate
    │                                  auth, see gotcha), logs to the payment-log sheet, proxies
    │                                  to the external FastAPI receipt service
    ├── agent-session/route.js         POST/GET — append a clock-in/break/clock-out event;
    │                                  GET returns today's events for the signed-in agent
    ├── agent-tracking/route.js        GET — the report Agent Tracking page and (with
    │                                  ?self=true) the mobile app both read; builds sessions +
    │                                  merges in call stats per agent
    └── fetch-call-logs/route.js       GET — per-call detail, filterable by lead row/agent/date

payslips-bootcamp1/                FastAPI receipt-generation microservice (separate deploy,
                                    own Procfile/runtime.txt — Heroku). ReportLab PDF fill +
                                    SendGrid/SMTP email. POST /generate-receipt (API-key
                                    protected) is what app/api/generate-receipt proxies to.

supabase/
├── README.md                      Full live-handoff setup walkthrough (Supabase project,
│                                   Clerk↔Supabase third-party auth, env vars, APK rebuild)
└── live_handoff.sql               The one table (see "Live Handoff" above) + its RLS policies
```

## Env vars in play

`GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` (leads+call-logs Sheets service
account), `GOOGLE_SHEET_ID` (leads spreadsheet), `INSTALLMENT_SHEET_ID`,
`PAYMENT_LOG_SHEET_ID`, `DRIVE_GOOGLE_CLIENT_EMAIL` / `DRIVE_GOOGLE_PRIVATE_KEY`
(Drive-quota workaround, optional — falls back to the main Google creds),
`DRIVE_PAYMENT_SCREENSHOTS_FOLDER_ID`, `RECEIPT_BACKEND_URL` /
`RECEIPT_API_KEY` (the payslips-bootcamp1 service), `NEXT_PUBLIC_SUPABASE_URL`
/ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional, live handoff),
`PRIMARY_SHEET_NAME` / `NEXT_PUBLIC_PRIMARY_SHEET_NAME` (Google Sheet tab name
for the primary lead pool — currently `Preety`; `NEXT_PUBLIC_` variant needed
for client-side pages), `AGENT_SHEET_NAME` / `NEXT_PUBLIC_AGENT_SHEET_NAME`
(tab name for the agent lead pool — currently `Agent Leads`). **If a sheet tab
is ever renamed, update only these env vars in Vercel + `.env.local` — no code
changes required.** All read from `.env.local` locally — never print or commit this file.

## Deploy

- **Portal**: Vercel (`.vercel/` present). Push to `main` deploys.
- **payslips-bootcamp1**: separate Heroku app, its own `Procfile`/`runtime.txt`.
- Never run `npm run build` locally while `npm run dev` is active.
