import { logger } from '@lib/logger';

export function normalizeString(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim();
}

export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';

  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalizeZip(zip: string | null | undefined): string {
  if (!zip) return '';

  const cleaned = zip.replace(/[^0-9]/g, '');

  // Pad to 5 digits
  return cleaned.padStart(5, '0');
}

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';

  const digits = phone.replace(/[^0-9]/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return digits;
}

export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function normalizeHomeValue(value: string | number | null | undefined): number {
  if (!value) return 0;

  if (typeof value === 'number') return value;

  const cleaned = value.replace(/[$,]/g, '');
  return parseFloat(cleaned) || 0;
}
