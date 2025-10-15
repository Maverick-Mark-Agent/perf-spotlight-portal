/**
 * FLEXIBLE CSV PARSER
 *
 * This module handles ANY CSV format by intelligently mapping columns
 * to the database schema and storing unmapped fields in extra_fields JSONB.
 */

export interface ColumnMapping {
  // Standard fields we try to extract
  first_name?: string;
  last_name?: string;
  email?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  mailing_address?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  home_value_estimate?: number;
  purchase_date?: string;
  phone?: string;

  // Extra fields that don't map to standard columns
  extra_fields: Record<string, any>;

  // Metadata
  csv_column_mapping: Record<string, string>;
}

/**
 * Intelligent column name matching
 * Returns the best match from available headers
 */
function findColumn(headers: string[], possibleNames: string[]): string | null {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  for (const name of possibleNames) {
    const lowerName = name.toLowerCase();
    const exactMatch = lowerHeaders.indexOf(lowerName);
    if (exactMatch !== -1) {
      return headers[exactMatch];
    }
  }

  // Try partial matches
  for (const name of possibleNames) {
    const lowerName = name.toLowerCase();
    const partialMatch = lowerHeaders.findIndex(h => h.includes(lowerName) || lowerName.includes(h));
    if (partialMatch !== -1) {
      return headers[partialMatch];
    }
  }

  return null;
}

/**
 * Parse home value from various formats
 * Handles: $1,250,000 | 1250000 | $850,000.50 | etc.
 */
function parseHomeValue(value: string | null | undefined): number {
  if (!value) return 0;

  // Remove $, commas, and any non-numeric characters except decimal point
  const cleaned = value.toString().replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse date from various formats
 * Handles: 12/30/2024, 2024-12-30, 12-30-2024, etc.
 */
function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  const str = dateStr.toString().trim();

  // Try MM/DD/YYYY or M/D/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try YYYY-MM-DD
  const dashMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dashMatch) {
    return str;
  }

  // Try MM-DD-YYYY
  const dashMatch2 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch2) {
    const [, month, day, year] = dashMatch2;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

/**
 * Main function to map CSV row to database schema
 */
export function mapCsvRow(row: Record<string, string>, headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    extra_fields: {},
    csv_column_mapping: {},
  };

  // Map First Name
  const firstNameCol = findColumn(headers, ['First Name', 'FirstName', 'fname', 'first']);
  if (firstNameCol && row[firstNameCol]) {
    mapping.first_name = row[firstNameCol].trim();
    mapping.csv_column_mapping['first_name'] = firstNameCol;
  }

  // Map Last Name
  const lastNameCol = findColumn(headers, ['Last Name', 'LastName', 'lname', 'last', 'surname']);
  if (lastNameCol && row[lastNameCol]) {
    mapping.last_name = row[lastNameCol].trim();
    mapping.csv_column_mapping['last_name'] = lastNameCol;
  }

  // Map Email
  const emailCol = findColumn(headers, ['Email', 'Email Address', 'EmailAddress', 'email_address', 'e-mail']);
  if (emailCol && row[emailCol]) {
    mapping.email = row[emailCol].trim().toLowerCase();
    mapping.csv_column_mapping['email'] = emailCol;
  }

  // Map Property State (critical for HNW filtering)
  const stateCol = findColumn(headers, ['ST', 'State', 'Property State', 'PropertyState', 'property_state']);
  if (stateCol && row[stateCol]) {
    mapping.property_state = row[stateCol].trim().toUpperCase();
    mapping.csv_column_mapping['property_state'] = stateCol;
  }

  // Map Property City
  const cityCol = findColumn(headers, ['City', 'Property City', 'PropertyCity', 'property_city']);
  if (cityCol && row[cityCol]) {
    mapping.property_city = row[cityCol].trim();
    mapping.csv_column_mapping['property_city'] = cityCol;
  }

  // Map Property ZIP
  const zipCol = findColumn(headers, ['ZIP', 'Zip', 'ZipCode', 'Zip Code', 'Property ZIP', 'postal_code']);
  if (zipCol && row[zipCol]) {
    mapping.property_zip = row[zipCol].trim();
    mapping.csv_column_mapping['property_zip'] = zipCol;
  }

  // Map Property Address
  const addressCol = findColumn(headers, ['Address', 'Address 1', 'Address1', 'Property Address', 'Street']);
  if (addressCol && row[addressCol]) {
    mapping.property_address = row[addressCol].trim();

    // Check for Address 2 and append if exists
    const address2Col = findColumn(headers, ['Address 2', 'Address2', 'Unit', 'Apt']);
    if (address2Col && row[address2Col]) {
      mapping.property_address += ` ${row[address2Col].trim()}`;
    }

    mapping.csv_column_mapping['property_address'] = addressCol;
  }

  // Map Home Value (check multiple possible columns)
  const homeValueCol = findColumn(headers, [
    'Home Value',
    'HomeValue',
    'Est. Home Value',
    'Home Value Estimate',
    'Estimated Value',
    'Property Value',
    'Purchase Amount', // Sometimes this is the home value
  ]);
  if (homeValueCol && row[homeValueCol]) {
    mapping.home_value_estimate = parseHomeValue(row[homeValueCol]);
    mapping.csv_column_mapping['home_value_estimate'] = homeValueCol;
  }

  // Map Purchase Date
  const purchaseDateCol = findColumn(headers, [
    'Purchase Date',
    'PurchaseDate',
    'Date of Purchase',
    'Closing Date',
    'Sale Date',
  ]);
  if (purchaseDateCol && row[purchaseDateCol]) {
    const parsed = parseDate(row[purchaseDateCol]);
    if (parsed) {
      mapping.purchase_date = parsed;
      mapping.csv_column_mapping['purchase_date'] = purchaseDateCol;
    }
  }

  // Map Phone
  const phoneCol = findColumn(headers, ['Phone', 'Phone Number', 'PhoneNumber', 'Cell Phone', 'Mobile']);
  if (phoneCol && row[phoneCol]) {
    mapping.phone = row[phoneCol].trim();
    mapping.csv_column_mapping['phone'] = phoneCol;
  }

  // Map Mailing fields (if different from property)
  const mailingAddressCol = findColumn(headers, ['Mailing Address', 'MailingAddress', 'Billing Address']);
  if (mailingAddressCol && row[mailingAddressCol]) {
    mapping.mailing_address = row[mailingAddressCol].trim();
    mapping.csv_column_mapping['mailing_address'] = mailingAddressCol;
  }

  const mailingCityCol = findColumn(headers, ['Mailing City', 'MailingCity']);
  if (mailingCityCol && row[mailingCityCol]) {
    mapping.mailing_city = row[mailingCityCol].trim();
    mapping.csv_column_mapping['mailing_city'] = mailingCityCol;
  }

  const mailingStateCol = findColumn(headers, ['Mailing State', 'MailingState']);
  if (mailingStateCol && row[mailingStateCol]) {
    mapping.mailing_state = row[mailingStateCol].trim();
    mapping.csv_column_mapping['mailing_state'] = mailingStateCol;
  }

  const mailingZipCol = findColumn(headers, ['Mailing ZIP', 'MailingZIP', 'Mailing Zip']);
  if (mailingZipCol && row[mailingZipCol]) {
    mapping.mailing_zip = row[mailingZipCol].trim();
    mapping.csv_column_mapping['mailing_zip'] = mailingZipCol;
  }

  // Store ALL unmapped columns in extra_fields
  const mappedColumns = new Set(Object.values(mapping.csv_column_mapping));

  headers.forEach(header => {
    if (!mappedColumns.has(header) && row[header]) {
      // Store with original column name
      const value = row[header].trim();
      if (value) {
        mapping.extra_fields[header] = value;
      }
    }
  });

  return mapping;
}

/**
 * Check if contact is Head of Household
 */
export function isHeadOfHousehold(firstName: string | undefined): boolean {
  if (!firstName) return false;

  const lower = firstName.toLowerCase();
  return !(
    lower.includes('&') ||
    lower.includes(' and ') ||
    lower.includes(',')
  );
}

/**
 * Check if home value meets HNW criteria
 */
export function checkHNWCriteria(homeValue: number, state: string | undefined): {
  meetsStandard: boolean;
  isHNW: boolean;
} {
  const isTexas = state?.toUpperCase() === 'TX';
  const HNW_THRESHOLD = 900000; // $900k

  if (isTexas && homeValue >= HNW_THRESHOLD) {
    return { meetsStandard: false, isHNW: true };
  }

  return { meetsStandard: homeValue < HNW_THRESHOLD && homeValue > 0, isHNW: false };
}
