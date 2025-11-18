import {
  calculatePurchaseDay as getCstDay,
  getCstDateString,
  formatCstLongDate
} from '@/lib/timezoneUtils';

const CST_TIMEZONE = 'America/Chicago';

export function calculatePurchaseDay(purchaseDate: string): number {
  return getCstDay(purchaseDate);
}

export function calculateRenewalDate(purchaseDate: string): string {
  // Get the date in CST, then add 1 year
  const cstDateStr = getCstDateString(purchaseDate);
  const date = new Date(cstDateStr + 'T00:00:00');
  date.setFullYear(date.getFullYear() + 1);

  // Return in YYYY-MM-DD format
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatReadableDate(purchaseDate: string): string {
  // Convert to CST and format
  const date = new Date(purchaseDate);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CST_TIMEZONE,
    month: 'long',
    day: 'numeric'
  });

  const parts = formatter.formatToParts(date);
  const month = parts.find(p => p.type === 'month')!.value;
  const dayNum = parseInt(parts.find(p => p.type === 'day')!.value, 10);

  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = dayNum % 100;
  const ordinal = suffix[(v - 20) % 10] || suffix[v] || suffix[0];

  return `${month} ${dayNum}${ordinal}`;
}
