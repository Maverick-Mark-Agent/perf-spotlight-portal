import { normalizeEmail, normalizePhone, normalizeZip, normalizeName, normalizeHomeValue } from '@pipeline/normalizer';
import { validateEmail, validateZip, validatePhone, validateLead } from '@pipeline/validator';
import { generateDedupeKey, detectDuplicates } from '@pipeline/deduplicator';
import { calculatePurchaseDay, formatReadableDate } from '@pipeline/transformer';

console.log('\n=== Testing Normalizer ===\n');

console.log('Email:', normalizeEmail('  TEST@Example.COM  '));
console.log('Phone:', normalizePhone('5551234567'));
console.log('ZIP:', normalizeZip('123'));
console.log('Name:', normalizeName('john doe'));
console.log('Home Value:', normalizeHomeValue('$450,000'));

console.log('\n=== Testing Validator ===\n');

console.log('Valid Email:', validateEmail('test@example.com'));
console.log('Invalid Email:', validateEmail('notanemail'));
console.log('Valid ZIP:', validateZip('12345'));
console.log('Invalid ZIP:', validateZip('123'));

const testLead = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  address1: '123 Main St',
  city: 'New York',
  state: 'NY',
  zip: '10001',
};

console.log('Valid Lead:', validateLead(testLead));

console.log('\n=== Testing Deduplicator ===\n');

const leads = [
  { email: 'john@example.com', address1: '123 Main St' },
  { email: 'john@example.com', address1: '123 Main St' }, // Duplicate
  { email: 'jane@example.com', address1: '456 Oak Ave' },
];

const duplicates = detectDuplicates(leads);
console.log('Duplicates found:', duplicates.size);

console.log('\n=== Testing Transformer ===\n');

const testDate = '2023-08-15';
console.log('Purchase Day:', calculatePurchaseDay(testDate));
console.log('Readable Date:', formatReadableDate(testDate));

console.log('\n✅ All pipeline tests complete!\n');
