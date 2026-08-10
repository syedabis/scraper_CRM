-- Live phone → web handoff.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is guarded.
--
-- WHAT THIS STORES, AND WHAT IT DELIBERATELY DOES NOT
--
-- One row per agent, holding a *pointer* to the lead they are working right
-- now — the sheet name and the row number, e.g. "Pretty#517". No customer
-- name, phone, email, status or notes ever reaches this database. Google
-- Sheets stays the only place lead data lives; both devices already have the
-- full list loaded, so the pointer is all either of them needs to agree on
-- which lead is on screen.
--
-- ISOLATION
--
-- agent_id is the Clerk user id (the "sub" claim of the session token), which
-- is identical on the phone and in the browser for the same signed-in person.
-- The policies below let an agent touch only their own row, and because
-- Realtime re-checks these same policies per subscriber, agent A's phone
-- physically cannot receive agent B's events.

create table if not exists public.live_handoff (
  -- Clerk user id. Primary key, so an agent can only ever have one live row —
  -- an upsert from a second device replaces rather than accumulates.
  agent_id    text primary key,

  -- Only so a human reading the table can tell whose row this is. Nothing
  -- reads it programmatically.
  agent_email text,

  -- "<sheet>#<row>", e.g. "Pretty#517". Composite because row numbers repeat
  -- across tabs — row 5 exists in both Pretty and Agent leads.
  lead_key    text,
  lead_row    integer,
  lead_source text,

  -- calling  → phone has dialled; the web should open this lead
  -- awaiting → call ended; the phone is waiting for an outcome to be saved
  -- saved    → the outcome was recorded; the phone may move to the next lead
  -- idle     → nothing live (session ended, or handoff switched off)
  phase       text not null default 'idle',

  -- How long the call lasted, read off the phone's own call log. Carried here
  -- so the browser can write it to the sheet in the same save as the status —
  -- otherwise every call handled on the web would land with zero talk time and
  -- no call-logs row, quietly emptying the Agent Tracking figures.
  --
  -- A number of seconds and a word like "answered": no customer detail, and
  -- notes in particular never travel over this channel.
  duration_seconds integer not null default 0,
  call_outcome     text,

  -- New value per handoff. Two calls to the same lead in a row would otherwise
  -- be indistinguishable — the phone would see phase flip back to "saved" with
  -- every field unchanged and could not tell the new save from the old one.
  handoff_id  text,

  updated_at  timestamptz not null default now(),

  constraint live_handoff_phase_check
    check (phase in ('idle', 'calling', 'awaiting', 'saved'))
);

-- Stamped server-side. A phone with a wrong clock would otherwise be able to
-- write a timestamp that makes a stale row look newer than a fresh one.
create or replace function public.live_handoff_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists live_handoff_touch on public.live_handoff;
create trigger live_handoff_touch
  before insert or update on public.live_handoff
  for each row execute function public.live_handoff_touch();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.live_handoff enable row level security;

grant select, insert, update on public.live_handoff to authenticated;

-- auth.jwt() ->> 'sub' is the Clerk user id, verified from the signed session
-- token. It cannot be spoofed by the client: Supabase validates the signature
-- against Clerk's published keys before any policy runs.
drop policy if exists "agents read their own row" on public.live_handoff;
create policy "agents read their own row"
  on public.live_handoff for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = agent_id);

drop policy if exists "agents create their own row" on public.live_handoff;
create policy "agents create their own row"
  on public.live_handoff for insert
  to authenticated
  with check ((select auth.jwt() ->> 'sub') = agent_id);

-- Both USING and WITH CHECK: the first stops an agent updating somebody else's
-- row, the second stops them rewriting agent_id to hand their row to another.
drop policy if exists "agents update their own row" on public.live_handoff;
create policy "agents update their own row"
  on public.live_handoff for update
  to authenticated
  using ((select auth.jwt() ->> 'sub') = agent_id)
  with check ((select auth.jwt() ->> 'sub') = agent_id);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Without this the table exists but no change events are ever broadcast, and
-- both devices would sit waiting forever with no visible error.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_handoff'
  ) then
    alter publication supabase_realtime add table public.live_handoff;
  end if;
end;
$$;

-- UPDATE events only carry the columns that changed unless the row is
-- published in full. The phone needs lead_key and handoff_id on every event to
-- know which handoff a "saved" refers to, so send the whole row.
alter table public.live_handoff replica identity full;
