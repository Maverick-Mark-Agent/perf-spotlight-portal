/**
 * Centralized Timezone Utilities for CST/CDT (America/Chicago)
 *
 * This module handles all timezone conversions from UTC (stored in database)
 * to Central Time (displayed to users). Automatically handles DST transitions.
 *
 * Key Design Decisions:
 * - Store: UTC in database (industry standard, portable)
 * - Display: CST/CDT to users (America/Chicago timezone)
 * - DST: Automatic via Intl.DateTimeFormat (no manual offset calculation)
 */

export const CST_TIMEZONE = 'America/Chicago';

/**
 * Convert UTC ISO string to CST Date object
 * Automatically handles DST (CST in winter, CDT in summer)
 *
 * @param utcDateString - ISO 8601 UTC timestamp (e.g., "2025-11-04T01:01:18+00:00")
 * @returns Date object adjusted to CST/CDT
 *
 * @example
 * utcToCst("2025-11-04T01:01:18Z") // Nov 3, 7:01 PM CST (UTC-6)
 * utcToCst("2025-07-16T00:01:18Z") // July 15, 7:01 PM CDT (UTC-5)
 */
export function utcToCst(utcDateString: string): Date {
  // Create date from UTC string
  const utcDate = new Date(utcDateString);

  // Convert to CST using browser's timezone support
  const cstString = utcDate.toLocaleString('en-US', {
    timeZone: CST_TIMEZONE,
  });

  return new Date(cstString);
}

/**
 * Get CST date string (YYYY-MM-DD) from UTC timestamp
 * Used for grouping leads by day in Central Time
 *
 * @param utcDateString - ISO 8601 UTC timestamp
 * @returns Date string in YYYY-MM-DD format (CST date)
 *
 * @example
 * getCstDateString("2025-11-04T01:01:18Z") // "2025-11-03" (still Nov 3 in CST)
 * getCstDateString("2025-11-04T06:00:00Z") // "2025-11-04" (midnight CST)
 */
export function getCstDateString(utcDateString: string | null | undefined): string {
  if (!utcDateString) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date(utcDateString));
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;

  return `${year}-${month}-${day}`;
}

/**
 * Format UTC timestamp for display with date and time in CST
 *
 * @param utcDateString - ISO 8601 UTC timestamp
 * @returns Formatted string like "Nov 3, 2025, 7:01 PM"
 *
 * @example
 * formatCstDateTime("2025-11-04T01:01:18Z") // "Nov 3, 2025, 7:01 PM"
 */
export function formatCstDateTime(utcDateString: string | null | undefined): string {
  if (!utcDateString) {
    return 'N/A';
  }

  return new Date(utcDateString).toLocaleString('en-US', {
    timeZone: CST_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format UTC timestamp for display with just the date in CST
 *
 * @param utcDateString - ISO 8601 UTC timestamp
 * @returns Formatted string like "Nov 3, 2025"
 *
 * @example
 * formatCstDate("2025-11-04T01:01:18Z") // "Nov 3, 2025"
 */
export function formatCstDate(utcDateString: string | null | undefined): string {
  if (!utcDateString) {
    return 'N/A';
  }

  return new Date(utcDateString).toLocaleDateString('en-US', {
    timeZone: CST_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format UTC timestamp as readable date (long format)
 *
 * @param utcDateString - ISO 8601 UTC timestamp
 * @returns Formatted string like "November 3, 2025"
 *
 * @example
 * formatCstLongDate("2025-11-04T01:01:18Z") // "November 3, 2025"
 */
export function formatCstLongDate(utcDateString: string | null | undefined): string {
  if (!utcDateString) {
    return 'N/A';
  }

  return new Date(utcDateString).toLocaleDateString('en-US', {
    timeZone: CST_TIMEZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get current date/time info in CST
 * Replacement for getCurrentDateInfo() that was using UTC
 *
 * @returns Object with CST date components
 *
 * @example
 * const { dateString, year, month, day } = getCurrentCstInfo();
 * // dateString: "2025-11-03"
 * // year: 2025, month: 11, day: 3
 */
export function getCurrentCstInfo() {
  const now = new Date();

  // Get CST components using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
  const day = parseInt(parts.find((p) => p.type === 'day')!.value, 10);

  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    date: now, // Keep as Date object
    dateString, // YYYY-MM-DD in CST
    year,
    month,
    day,
    todayStr: dateString, // Alias for compatibility
  };
}

/**
 * Calculate day of month from purchase date in CST
 *
 * @param purchaseDate - UTC timestamp or date string
 * @returns Day of month (1-31) in CST
 *
 * @example
 * calculatePurchaseDay("2025-11-04T01:01:18Z") // 3 (Nov 3 in CST)
 */
export function calculatePurchaseDay(purchaseDate: string): number {
  const cstDateStr = getCstDateString(purchaseDate);
  return parseInt(cstDateStr.split('-')[2], 10);
}

/**
 * Calculate month from purchase date in CST
 *
 * @param purchaseDate - UTC timestamp or date string
 * @returns Month number (1-12) in CST
 *
 * @example
 * calculatePurchaseMonth("2025-11-04T01:01:18Z") // 11 (November in CST)
 */
export function calculatePurchaseMonth(purchaseDate: string): number {
  const cstDateStr = getCstDateString(purchaseDate);
  return parseInt(cstDateStr.split('-')[1], 10);
}

/**
 * Calculate year from purchase date in CST
 *
 * @param purchaseDate - UTC timestamp or date string
 * @returns Year in CST
 *
 * @example
 * calculatePurchaseYear("2025-11-04T01:01:18Z") // 2025
 */
export function calculatePurchaseYear(purchaseDate: string): number {
  const cstDateStr = getCstDateString(purchaseDate);
  return parseInt(cstDateStr.split('-')[0], 10);
}

/**
 * Check if a DST transition affects the given date range
 * Useful for debugging timezone issues
 *
 * @param startUtc - Start UTC timestamp
 * @param endUtc - End UTC timestamp
 * @returns Object with DST transition info
 */
export function checkDstTransition(startUtc: string, endUtc: string) {
  const start = new Date(startUtc);
  const end = new Date(endUtc);

  // Get UTC offset for both dates
  const startOffset = new Date(
    start.toLocaleString('en-US', { timeZone: CST_TIMEZONE })
  ).getTimezoneOffset();
  const endOffset = new Date(
    end.toLocaleString('en-US', { timeZone: CST_TIMEZONE })
  ).getTimezoneOffset();

  return {
    hasDstTransition: startOffset !== endOffset,
    startOffset,
    endOffset,
    offsetChange: endOffset - startOffset,
  };
}
