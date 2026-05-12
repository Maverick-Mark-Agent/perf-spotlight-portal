// Auto-reply scheduling — send 24/7, no business-hours window.
// Apply a minimum human-like delay + small jitter so replies don't land
// within seconds of the lead's message.
//
// All math goes through Intl.DateTimeFormat with `timeZone:`. No deps.

const JITTER_MAX_MS = 90_000;  // 0–90s random offset on the final scheduled_for

interface LocalParts {
  year: number;
  month: number;     // 1–12
  day: number;       // 1–31
  hour: number;      // 0–23
  minute: number;
  second: number;
  dayOfWeek: number; // 0=Sun, 1=Mon, …, 6=Sat
}

const DOW_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Return the local-time breakdown of a UTC Date in the given IANA timezone.
 */
export function getLocalParts(date: Date, timezone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  // Some runtimes emit "24" for midnight when hour12=false — normalize.
  const hourStr = m.hour === '24' ? '00' : m.hour;
  return {
    year: parseInt(m.year, 10),
    month: parseInt(m.month, 10),
    day: parseInt(m.day, 10),
    hour: parseInt(hourStr, 10),
    minute: parseInt(m.minute, 10),
    second: parseInt(m.second, 10),
    dayOfWeek: DOW_MAP[m.weekday],
  };
}

/**
 * Offset of `timezone` from UTC at the given instant, in minutes east of UTC.
 * (e.g. America/Chicago in CDT returns -300.)
 */
function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  const p = getLocalParts(date, timezone);
  const localAsUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((localAsUtcMs - date.getTime()) / 60_000);
}

/**
 * Build the UTC Date whose local representation in `timezone` equals
 * the given local Y/M/D h:m. Refines once to handle DST transitions.
 *
 * NOTE: At a "spring-forward" hour the requested local time doesn't exist
 * (e.g. 2:30 AM on the day clocks jump 2→3). In that case we return the
 * next valid instant (the result will appear as 3:30 AM local). At a
 * "fall-back" hour the local time is ambiguous; we resolve to the earlier
 * instant, which is fine for "next 7am" semantics.
 */
export function makeZonedDate(
  timezone: string,
  year: number,
  month: number,  // 1–12
  day: number,    // 1–31
  hour: number,   // 0–23
  minute: number = 0,
): Date {
  // Treat the desired local time as if it were UTC to get a starting guess.
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Apply the tz offset at that approximate instant.
  let candidate = new Date(desiredAsUtc - getTimezoneOffsetMinutes(timezone, new Date(desiredAsUtc)) * 60_000);
  // One refinement pass — handles DST boundaries.
  const refinedOffset = getTimezoneOffsetMinutes(timezone, candidate);
  candidate = new Date(desiredAsUtc - refinedOffset * 60_000);
  return candidate;
}

/**
 * Add N days to a (year,month,day) tuple, returning a fresh tuple in the
 * same calendar (Gregorian). Avoids any tz drift since it operates purely
 * on calendar arithmetic via Date in UTC.
 */
function addDays(year: number, month: number, day: number, days: number): { year: number; month: number; day: number } {
  const t = Date.UTC(year, month - 1, day);
  const d = new Date(t + days * 86_400_000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * Returns true if the given UTC instant falls within Mon–Fri 07:00–18:59
 * local in `timezone`.
 */
export function isWithinSendWindow(date: Date, timezone: string): boolean {
  const p = getLocalParts(date, timezone);
  if (p.dayOfWeek < 1 || p.dayOfWeek > 5) return false;
  if (p.hour < WINDOW_START_HOUR) return false;
  if (p.hour >= WINDOW_END_HOUR) return false;
  return true;
}

/**
 * Compute the UTC instant when an auto-reply should be sent.
 *
 *   1. Apply the human-delay floor:  target = now + minDelayMinutes
 *   2. If `target` is in-window in workspace local time → return target + jitter.
 *   3. Otherwise, snap to the next 7:00 AM local on the next Mon–Fri day,
 *      then add jitter.
 *
 * The function is pure: same inputs → same output (modulo the jitter,
 * which the caller can disable by passing seed=0 if needed for tests).
 *
 * @param timezone IANA timezone, e.g. 'America/Chicago'. Required.
 * @param minDelayMinutes Floor delay (default 10). Use the workspace's
 *                        client_registry.auto_reply_min_delay_minutes.
 * @param now Reference instant; defaults to the current time.
 * @param applyJitter Set false in tests for deterministic output.
 */
export function computeNextSendTime(
  _timezone: string,
  minDelayMinutes: number = 10,
  now: Date = new Date(),
  applyJitter: boolean = true,
): Date {
  let scheduledUtc = new Date(now.getTime() + minDelayMinutes * 60_000);
  if (applyJitter) {
    scheduledUtc = new Date(scheduledUtc.getTime() + Math.floor(Math.random() * JITTER_MAX_MS));
  }
  return scheduledUtc;
}
