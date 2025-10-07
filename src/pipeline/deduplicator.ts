import crypto from 'crypto';
import { logger } from '@lib/logger';

export function generateDedupeKey(email: string, address: string): string {
  const normalized = `${email.toLowerCase()}|${address.toLowerCase()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function detectDuplicates(leads: Array<Record<string, any>>): Map<string, number> {
  const seenKeys = new Map<string, number>();

  for (const lead of leads) {
    const key = generateDedupeKey(lead.email || '', lead.address1 || '');
    seenKeys.set(key, (seenKeys.get(key) || 0) + 1);
  }

  return new Map([...seenKeys].filter(([_, count]) => count > 1));
}
