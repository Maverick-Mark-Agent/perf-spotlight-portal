# Phase 9: Lead Pipeline (Validation, Normalization, Deduplication)

**Milestone:** Data Pipeline
**Estimated Effort:** 6-8 hours
**Dependencies:** Phase 1 (Schema), Phase 5 (Logging)
**Blocks:** Phase 11, 12 (PT1/PT2 workflows)

---

## Overview

Build data pipeline for validating, normalizing, and deduplicating leads. Transform raw Cole data into clean, validated records ready for upload.

---

## Tasks

### Task 1: Create Normalizer

**File to create:** `src/pipeline/normalizer.ts`

**Content:**
```typescript
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
```

**Acceptance:**
- [ ] Normalizer functions created
- [ ] Handles names, emails, phones, ZIPs, home values

---

### Task 2: Create Validator

**File to create:** `src/pipeline/validator.ts`

**Content:**
```typescript
import { ValidationError } from '@lib/errors';
import { logger } from '@lib/logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateZip(zip: string): ValidationResult {
  const errors: string[] = [];

  if (!zip) {
    errors.push('ZIP code is required');
  } else if (!/^\\d{5}$/.test(zip)) {
    errors.push('ZIP must be 5 digits');
  }

  return { valid: errors.length === 0, errors };
}

export function validatePhone(phone: string): ValidationResult {
  const errors: string[] = [];

  const digits = phone.replace(/[^0-9]/g, '');

  if (digits.length !== 10) {
    errors.push('Phone must be 10 digits');
  }

  return { valid: errors.length === 0, errors };
}

export function validateDate(dateString: string): ValidationResult {
  const errors: string[] = [];

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    errors.push('Invalid date format');
  }

  return { valid: errors.length === 0, errors };
}

export function validateLead(lead: Record<string, any>): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!lead.firstName) errors.push('First name is required');
  if (!lead.lastName) errors.push('Last name is required');
  if (!lead.address1) errors.push('Address is required');
  if (!lead.city) errors.push('City is required');
  if (!lead.state) errors.push('State is required');

  // Email
  const emailResult = validateEmail(lead.email);
  errors.push(...emailResult.errors);

  // ZIP
  const zipResult = validateZip(lead.zip);
  errors.push(...zipResult.errors);

  // Purchase date
  if (lead.purchaseDate) {
    const dateResult = validateDate(lead.purchaseDate);
    errors.push(...dateResult.errors);
  }

  return { valid: errors.length === 0, errors };
}
```

**Acceptance:**
- [ ] Validation functions created
- [ ] Email, phone, ZIP, date validation

---

### Task 3: Create Deduplicator

**File to create:** `src/pipeline/deduplicator.ts`

**Content:**
```typescript
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
```

**Acceptance:**
- [ ] Dedupe key generation
- [ ] Duplicate detection

---

### Task 4: Create Transformer

**File to create:** `src/pipeline/transformer.ts`

**Content:**
```typescript
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
```

**Acceptance:**
- [ ] Purchase day calculation
- [ ] Renewal date calculation
- [ ] Readable date formatting

---

## Definition of Done

- [ ] Normalizer module complete
- [ ] Validator module complete
- [ ] Deduplicator module complete
- [ ] Transformer module complete
- [ ] All functions tested
- [ ] No TypeScript errors

---

## Next Phase

**Phase 10:** Testing Framework & Fixtures
