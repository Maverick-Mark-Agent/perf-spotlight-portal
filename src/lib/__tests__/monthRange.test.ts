import { describe, it, expect } from 'vitest';
import { getMonthRange } from '@/lib/monthRange';

describe('getMonthRange', () => {
  it('returns first and last day for a 31-day month', () => {
    expect(getMonthRange(2026, 5)).toEqual({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    });
  });

  it('returns first and last day for a 30-day month', () => {
    expect(getMonthRange(2026, 4)).toEqual({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
  });

  it('handles February in a non-leap year (28 days)', () => {
    expect(getMonthRange(2026, 2)).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
  });

  it('handles February in a leap year (29 days)', () => {
    expect(getMonthRange(2024, 2)).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
  });

  it('zero-pads single-digit months and days', () => {
    expect(getMonthRange(2026, 1)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
  });
});
