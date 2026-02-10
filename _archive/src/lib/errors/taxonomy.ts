export enum ErrorType {
  // Authentication errors
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_MFA_REQUIRED = 'AUTH_MFA_REQUIRED',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',

  // Captcha & bot detection
  CAPTCHA_DETECTED = 'CAPTCHA_DETECTED',
  BOT_DETECTION = 'BOT_DETECTION',
  RATE_LIMITED = 'RATE_LIMITED',

  // Selector & DOM errors
  SELECTOR_NOT_FOUND = 'SELECTOR_NOT_FOUND',
  SELECTOR_TIMEOUT = 'SELECTOR_TIMEOUT',
  DOM_STRUCTURE_CHANGED = 'DOM_STRUCTURE_CHANGED',

  // Network errors
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  REQUEST_FAILED = 'REQUEST_FAILED',

  // Data validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  DATA_PARSING_FAILED = 'DATA_PARSING_FAILED',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Upload/Export errors
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  EXPORT_FAILED = 'EXPORT_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  // Business logic errors
  RECORD_COUNT_MISMATCH = 'RECORD_COUNT_MISMATCH',
  DUPLICATE_DETECTED = 'DUPLICATE_DETECTED',
  TARGET_NOT_MET = 'TARGET_NOT_MET',

  // Unknown/uncategorized
  UNKNOWN = 'UNKNOWN',
}

export interface ErrorMetadata {
  errorType: ErrorType;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  escalationRequired: boolean;
}

export const ERROR_CATALOG: Record<ErrorType, ErrorMetadata> = {
  // Auth errors
  [ErrorType.AUTH_FAILED]: { errorType: ErrorType.AUTH_FAILED, retryable: false, severity: 'critical', escalationRequired: true },
  [ErrorType.AUTH_MFA_REQUIRED]: { errorType: ErrorType.AUTH_MFA_REQUIRED, retryable: false, severity: 'high', escalationRequired: true },
  [ErrorType.AUTH_SESSION_EXPIRED]: { errorType: ErrorType.AUTH_SESSION_EXPIRED, retryable: true, severity: 'medium', escalationRequired: false },
  [ErrorType.AUTH_INVALID_CREDENTIALS]: { errorType: ErrorType.AUTH_INVALID_CREDENTIALS, retryable: false, severity: 'critical', escalationRequired: true },

  // Captcha errors
  [ErrorType.CAPTCHA_DETECTED]: { errorType: ErrorType.CAPTCHA_DETECTED, retryable: true, severity: 'high', escalationRequired: true },
  [ErrorType.BOT_DETECTION]: { errorType: ErrorType.BOT_DETECTION, retryable: true, severity: 'high', escalationRequired: true },
  [ErrorType.RATE_LIMITED]: { errorType: ErrorType.RATE_LIMITED, retryable: true, severity: 'medium', escalationRequired: false },

  // Selector errors
  [ErrorType.SELECTOR_NOT_FOUND]: { errorType: ErrorType.SELECTOR_NOT_FOUND, retryable: true, severity: 'high', escalationRequired: true },
  [ErrorType.SELECTOR_TIMEOUT]: { errorType: ErrorType.SELECTOR_TIMEOUT, retryable: true, severity: 'medium', escalationRequired: false },
  [ErrorType.DOM_STRUCTURE_CHANGED]: { errorType: ErrorType.DOM_STRUCTURE_CHANGED, retryable: false, severity: 'high', escalationRequired: true },

  // Network errors
  [ErrorType.NETWORK_TIMEOUT]: { errorType: ErrorType.NETWORK_TIMEOUT, retryable: true, severity: 'medium', escalationRequired: false },
  [ErrorType.NETWORK_OFFLINE]: { errorType: ErrorType.NETWORK_OFFLINE, retryable: true, severity: 'high', escalationRequired: false },
  [ErrorType.REQUEST_FAILED]: { errorType: ErrorType.REQUEST_FAILED, retryable: true, severity: 'medium', escalationRequired: false },

  // Validation errors
  [ErrorType.VALIDATION_FAILED]: { errorType: ErrorType.VALIDATION_FAILED, retryable: false, severity: 'medium', escalationRequired: false },
  [ErrorType.DATA_PARSING_FAILED]: { errorType: ErrorType.DATA_PARSING_FAILED, retryable: false, severity: 'high', escalationRequired: true },
  [ErrorType.MISSING_REQUIRED_FIELD]: { errorType: ErrorType.MISSING_REQUIRED_FIELD, retryable: false, severity: 'medium', escalationRequired: false },

  // Upload errors
  [ErrorType.UPLOAD_FAILED]: { errorType: ErrorType.UPLOAD_FAILED, retryable: true, severity: 'high', escalationRequired: true },
  [ErrorType.EXPORT_FAILED]: { errorType: ErrorType.EXPORT_FAILED, retryable: true, severity: 'high', escalationRequired: true },
  [ErrorType.FILE_NOT_FOUND]: { errorType: ErrorType.FILE_NOT_FOUND, retryable: false, severity: 'high', escalationRequired: true },

  // Business logic
  [ErrorType.RECORD_COUNT_MISMATCH]: { errorType: ErrorType.RECORD_COUNT_MISMATCH, retryable: false, severity: 'medium', escalationRequired: false },
  [ErrorType.DUPLICATE_DETECTED]: { errorType: ErrorType.DUPLICATE_DETECTED, retryable: false, severity: 'low', escalationRequired: false },
  [ErrorType.TARGET_NOT_MET]: { errorType: ErrorType.TARGET_NOT_MET, retryable: false, severity: 'medium', escalationRequired: false },

  // Unknown
  [ErrorType.UNKNOWN]: { errorType: ErrorType.UNKNOWN, retryable: false, severity: 'high', escalationRequired: true },
};

export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();

  // Auth errors
  if (message.includes('authentication') || message.includes('login') || message.includes('401')) {
    return ErrorType.AUTH_FAILED;
  }
  if (message.includes('mfa') || message.includes('2fa') || message.includes('two-factor')) {
    return ErrorType.AUTH_MFA_REQUIRED;
  }
  if (message.includes('session expired') || message.includes('session timeout')) {
    return ErrorType.AUTH_SESSION_EXPIRED;
  }

  // Captcha
  if (message.includes('captcha') || message.includes('recaptcha') || message.includes('hcaptcha')) {
    return ErrorType.CAPTCHA_DETECTED;
  }
  if (message.includes('bot') || message.includes('automated')) {
    return ErrorType.BOT_DETECTION;
  }
  if (message.includes('rate limit') || message.includes('429')) {
    return ErrorType.RATE_LIMITED;
  }

  // Selector
  if (message.includes('selector') || message.includes('element not found')) {
    return ErrorType.SELECTOR_NOT_FOUND;
  }
  if (message.includes('timeout') && message.includes('waiting')) {
    return ErrorType.SELECTOR_TIMEOUT;
  }

  // Network
  if (message.includes('network') || message.includes('econnrefused')) {
    return ErrorType.NETWORK_OFFLINE;
  }
  if (message.includes('timeout')) {
    return ErrorType.NETWORK_TIMEOUT;
  }

  // Validation
  if (message.includes('validation')) {
    return ErrorType.VALIDATION_FAILED;
  }
  if (message.includes('parse') || message.includes('json') || message.includes('csv')) {
    return ErrorType.DATA_PARSING_FAILED;
  }

  return ErrorType.UNKNOWN;
}

export function shouldRetry(errorType: ErrorType): boolean {
  return ERROR_CATALOG[errorType].retryable;
}

export function requiresEscalation(errorType: ErrorType): boolean {
  return ERROR_CATALOG[errorType].escalationRequired;
}
