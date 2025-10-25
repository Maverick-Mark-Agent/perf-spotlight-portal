import { test, expect } from '@playwright/test';
import { normalizeZip, normalizeName, normalizeEmail } from '@pipeline/normalizer';
import { validateEmail, validateZip, validateLead } from '@pipeline/validator';
import { generateDedupeKey } from '@pipeline/deduplicator';
import { calculatePurchaseDay, formatReadableDate } from '@pipeline/transformer';

test.describe('Normalizer', () => {
  test('normalizes ZIP codes', () => {
    expect(normalizeZip('7034')).toBe('07034');
    expect(normalizeZip('07030')).toBe('07030');
  });

  test('normalizes names', () => {
    expect(normalizeName('JOHN DOE')).toBe('John Doe');
    expect(normalizeName('jane smith')).toBe('Jane Smith');
  });

  test('normalizes emails', () => {
    expect(normalizeEmail('JOHN@EXAMPLE.COM')).toBe('john@example.com');
  });
});

test.describe('Validator', () => {
  test('validates emails', () => {
    expect(validateEmail('john@example.com').valid).toBe(true);
    expect(validateEmail('invalid').valid).toBe(false);
  });

  test('validates ZIPs', () => {
    expect(validateZip('07034').valid).toBe(true);
    expect(validateZip('123').valid).toBe(false);
  });
});

test.describe('Transformer', () => {
  test('calculates purchase day', () => {
    expect(calculatePurchaseDay('2020-08-15')).toBe(15); // UTC conversion
  });

  test('formats readable dates', () => {
    expect(formatReadableDate('2020-08-15')).toBe('August 15th'); // UTC conversion
    expect(formatReadableDate('2020-08-03')).toBe('August 3rd'); // UTC conversion
  });
});
