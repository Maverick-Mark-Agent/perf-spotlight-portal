# Phase 10: Testing Framework & Fixtures

**Milestone:** Data Pipeline
**Estimated Effort:** 4-5 hours
**Dependencies:** Phase 6-9 (Connectors and pipeline)
**Blocks:** None (enables validation for all phases)

---

## Overview

Create test fixtures (sample CSVs, lead data), unit tests for connectors and pipeline, and Playwright tests for browser automation.

---

## Tasks

### Task 1: Create Test Fixtures

**File to create:** `tests/fixtures/test-leads.csv`

**Content:**
```csv
First_Name,Last_Name,Address_1,City,State,Zip,Cell_Phone_Number,Email_Address,Purchase_Date,Home_Value,Head_Household,Income,Date_of_Birth
John,Doe,123 Main St,Hoboken,NJ,07030,2015551234,john.doe@example.com,08/15/2020,$450000,Y,$85000,01/15/1980
Jane,Smith,456 Oak Ave,Jersey City,NJ,07302,2015555678,jane.smith@example.com,03/22/2019,$525000,Y,$95000,06/30/1985
Bob,Johnson,789 Pine Rd,Weehawken,NJ,07086,2015559012,bob.johnson@example.com,11/10/2021,$385000,Y,$72000,12/05/1975
```

**Acceptance:**
- [ ] Test CSV with 3-5 sample leads
- [ ] All required fields present
- [ ] Realistic data

---

### Task 2: Create Pipeline Tests

**File to create:** `tests/pipeline/pipeline.test.ts`

**Content:**
```typescript
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
    expect(calculatePurchaseDay('2020-08-15')).toBe(15);
  });

  test('formats readable dates', () => {
    expect(formatReadableDate('2020-08-15')).toBe('August 15th');
    expect(formatReadableDate('2020-08-03')).toBe('August 3rd');
  });
});
```

**Acceptance:**
- [ ] Pipeline tests pass
- [ ] Tests cover normalizer, validator, transformer

---

## Definition of Done

- [ ] Test fixtures created
- [ ] Pipeline tests pass
- [ ] Connector tests pass
- [ ] All tests documented

---

## Next Milestone

**Milestone 3: Workflow Automation** (Phases 11-15)
