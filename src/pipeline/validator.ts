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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  } else if (!/^\d{5}$/.test(zip)) {
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
