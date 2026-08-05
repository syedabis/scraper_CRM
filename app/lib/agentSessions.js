// Replays the append-only shift log into finished work sessions.
//
// The log is deliberately dumb — one row per tap — so all the interpretation
// lives here. It has to survive the messy cases a real day produces: an agent
// who forgets to clock out, one who starts twice, one who is still working when
// the report is opened.

export function buildSessions(events, nowMs = Date.now()) {
  const sessions = [];
  let open = null;
  let breakStartedAt = null;

  const ordered = [...(events || [])].sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

  for (const event of ordered) {
    const at = Date.parse(event.timestamp);
    if (Number.isNaN(at)) continue;

    switch (event.event) {
      case 'session_start':
        // A second start with no end means the previous shift was never closed.
        // Bank it at this point rather than discarding the earlier work.
        if (open) {
          if (breakStartedAt !== null) {
            open.breakMs += at - breakStartedAt;
            breakStartedAt = null;
          }
          sessions.push({ ...open, endedAt: at, openEnded: true });
        }
        open = { startedAt: at, endedAt: null, breakMs: 0, breaks: 0 };
        breakStartedAt = null;
        break;

      case 'break_start':
        if (open && breakStartedAt === null) {
          breakStartedAt = at;
          open.breaks += 1;
        }
        break;

      case 'break_end':
        if (open && breakStartedAt !== null) {
          open.breakMs += at - breakStartedAt;
          breakStartedAt = null;
        }
        break;

      case 'session_end':
        if (open) {
          // Ending while still on a break closes the break too.
          if (breakStartedAt !== null) {
            open.breakMs += at - breakStartedAt;
            breakStartedAt = null;
          }
          sessions.push({ ...open, endedAt: at });
          open = null;
        }
        break;

      default:
        break;
    }
  }

  // Still clocked in — report it as running rather than dropping today's work.
  if (open) {
    if (breakStartedAt !== null) open.breakMs += nowMs - breakStartedAt;
    sessions.push({ ...open, endedAt: nowMs, inProgress: true });
  }

  return sessions.map((s) => ({
    ...s,
    workedMs: Math.max(0, s.endedAt - s.startedAt - s.breakMs),
  }));
}
