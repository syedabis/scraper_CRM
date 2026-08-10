'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

// The browser half of the phone → web handoff. The phone publishes which lead
// it is calling; this hook surfaces it so the calling page can open that lead,
// and hands back a way to say "outcome recorded" once the agent saves.
//
// Nothing about a customer travels over this channel — only a pointer of the
// form "Pretty#517". See supabase/live_handoff.sql.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Both keys absent is the normal state before anyone sets Supabase up, and the
// portal has to keep working exactly as before in that case rather than
// throwing on load.
export const liveHandoffConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

function toHandoff(row) {
  if (!row || !row.lead_key) return null;
  return {
    leadKey: row.lead_key,
    leadRow: row.lead_row,
    leadSource: row.lead_source,
    phase: row.phase,
    handoffId: row.handoff_id,
    // Measured on the phone; the browser writes it to the sheet as part of the
    // save so talk time and the call-logs row survive a web-side outcome.
    durationSeconds: Number(row.duration_seconds) || 0,
    outcome: row.call_outcome || null,
    updatedAt: row.updated_at,
  };
}

export function useLiveHandoff() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  // Clerk's user id is the same string on the phone and in this browser for
  // the same person, which is what makes the two devices find each other
  // without any pairing step.
  const agentId = user?.id || null;

  const [handoff, setHandoff] = useState(null);
  const [connected, setConnected] = useState(false);

  // Clerk returns a new getToken on every render. Reading it through a ref
  // keeps the Supabase client from being rebuilt — and a rebuilt client would
  // tear down and re-open the websocket on each render.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const clientRef = useRef(null);
  if (liveHandoffConfigured && !clientRef.current) {
    clientRef.current = createClient(SUPABASE_URL, SUPABASE_KEY, {
      // Supabase verifies this Clerk token against Clerk's published keys and
      // exposes its claims to the row-level policies, so an agent can only
      // ever read or write their own row. No Supabase login is involved.
      accessToken: async () => {
        try {
          return (await getTokenRef.current?.()) ?? null;
        } catch {
          return null;
        }
      },
    });
  }

  useEffect(() => {
    const supabase = clientRef.current;
    if (!supabase || !agentId || !isSignedIn) return undefined;

    let cancelled = false;

    // Catch up before listening. The phone may have published this lead before
    // the agent opened the portal, and a websocket only delivers what happens
    // from now on — without this the first call of the shift would be missed.
    supabase
      .from('live_handoff')
      .select('*')
      .eq('agent_id', agentId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setHandoff(toHandoff(data));
      });

    const channel = supabase
      .channel(`live_handoff:${agentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_handoff',
          // Belt and braces: the policies already make other agents' rows
          // invisible, this just avoids waking the tab for them.
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          if (cancelled) return;
          const next = toHandoff(payload.new);
          if (next) setHandoff(next);
        }
      )
      .subscribe((status) => {
        if (!cancelled) setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      cancelled = true;
      setConnected(false);
      supabase.removeChannel(channel);
    };
  }, [agentId, isSignedIn]);

  // Tells the phone the outcome is in the sheet and it may dial the next lead.
  //
  // Scoped to the handoff it was called for: if the agent saved late and the
  // phone has already moved on to another lead, this matches nothing and does
  // nothing, rather than making the phone skip the call it is now on.
  const publishSaved = useCallback(
    async (handoffId) => {
      const supabase = clientRef.current;
      if (!supabase || !agentId || !handoffId) return;
      try {
        await supabase
          .from('live_handoff')
          .update({ phase: 'saved' })
          .eq('agent_id', agentId)
          .eq('handoff_id', handoffId);
      } catch {
        // The status is already safely in the sheet by this point. Failing to
        // notify the phone costs one manual tap, so it must never surface as
        // an error on a save that actually succeeded.
      }
    },
    [agentId]
  );

  return {
    // False when Supabase env vars are missing — callers render nothing.
    available: liveHandoffConfigured,
    connected,
    handoff,
    publishSaved,
  };
}
