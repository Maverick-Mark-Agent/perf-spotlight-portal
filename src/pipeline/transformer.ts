export function calculatePurchaseDay(purchaseDate: string): number {
  const date = new Date(purchaseDate);
  return date.getDate();
}

export function calculateRenewalDate(purchaseDate: string): string {
  const date = new Date(purchaseDate);
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().split('T')[0];
}

export function formatReadableDate(purchaseDate: string): string {
  const date = new Date(purchaseDate);
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();

  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  const ordinal = suffix[(v - 20) % 10] || suffix[v] || suffix[0];

  return `${month} ${day}${ordinal}`;
}
