export function calculatePurchaseDay(purchaseDate: string): number {
  const date = new Date(purchaseDate + 'T00:00:00Z');
  return date.getUTCDate();
}

export function calculateRenewalDate(purchaseDate: string): string {
  const date = new Date(purchaseDate + 'T00:00:00Z');
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().split('T')[0];
}

export function formatReadableDate(purchaseDate: string): string {
  const date = new Date(purchaseDate + 'T00:00:00Z');
  const month = date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const day = date.getUTCDate();

  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  const ordinal = suffix[(v - 20) % 10] || suffix[v] || suffix[0];

  return `${month} ${day}${ordinal}`;
}
