import { ClayFormula } from './clay';

export const CLAY_FORMULAS: Record<string, ClayFormula> = {
  numericHomeValue: {
    name: 'Numeric Home Value',
    description: 'Take the Home Value from /Home_Value and convert it into just a number.',
    insertAfterColumn: 'Home_Value',
  },

  readablePurchaseDate: {
    name: 'Readable Purchase Date',
    description: 'Take the date from /Purchase_Date and give me back just the month and the day (ex: 08/03/2023 → "August 3rd").',
    insertAfterColumn: 'Purchase_Date',
  },

  purchaseDay: {
    name: 'Purchase Day',
    description: 'Take the date from /Purchase_Date and return only the day of the month (ex: 08/03/2023 → 3).',
    insertAfterColumn: 'Purchase_Date',
  },
};

export const CLAY_FILTERS = {
  headOfHousehold: {
    column: 'Head_Household',
    operator: 'not_empty' as const,
  },

  homeValueMax: (maxValue: number) => ({
    column: 'Numeric Home Value',
    operator: 'less_than' as const,
    value: maxValue,
  }),

  safeToSendEmail: {
    column: 'first safe to send email',
    operator: 'not_empty' as const,
  },
};

export const CLAY_TABLE_LIMIT = 40000;
