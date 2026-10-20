'use client';

// Live phone -> web handoff disabled (Supabase removed)
export const liveHandoffConfigured = false;

export function useLiveHandoff() {
  return {
    available: false,
    connected: false,
    handoff: null,
    publishSaved: () => {},
  };
}
