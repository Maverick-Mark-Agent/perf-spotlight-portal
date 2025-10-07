# Phase 5: Error Handling & Logging Framework

**Milestone:** Foundation
**Estimated Effort:** 4-5 hours
**Dependencies:** Phase 1 (agent_errors table), Phase 2 (dependencies)
**Blocks:** Phases 6-20 (all automation uses logging)

---

## Overview

Build structured logging and error tracking infrastructure that writes to console (JSON format) and persists errors to the `agent_errors` table. Implement retry logic with exponential backoff and error classification taxonomy.

---

## Scope

### In Scope
- Structured JSON logger with log levels
- Error tracker that writes to `agent_errors` table
- Retry logic with exponential backoff
- Error taxonomy (AUTH, CAPTCHA, SELECTOR_MISS, etc.)
- Log formatting and filtering

### Out of Scope
- External logging services (Datadog, Sentry) - future enhancement
- Log aggregation - handled by console/file output
- Real-time alerting - Phase 19 (Slack)

---

## Tasks

### Task 1: Create Structured Logger

**File to create:** `src/lib/logger.ts`

**Content:**
```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private minLevel: LogLevel;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...context,
    };

    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatLog('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(this.formatLog('error', message, context));
    }
  }

  child(defaultContext: LogContext): Logger {
    const childLogger = new Logger();
    const originalLog = childLogger.formatLog.bind(childLogger);

    childLogger.formatLog = (level, message, context) => {
      return originalLog(level, message, { ...defaultContext, ...context });
    };

    return childLogger;
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

export const logger = new Logger();
```

**Acceptance:**
- [ ] Logger outputs structured JSON
- [ ] Supports debug, info, warn, error levels
- [ ] Respects LOG_LEVEL environment variable
- [ ] Can create child loggers with context
- [ ] Timestamp included in every log

---

### Task 2: Create Error Taxonomy

**File to create:** `src/lib/errors/taxonomy.ts`

**Content:**
```typescript
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
```

**Acceptance:**
- [ ] Error types enum defined
- [ ] Error catalog with metadata (retryable, severity, escalation)
- [ ] Error classification function
- [ ] Helper functions for retry and escalation logic

---

### Task 3: Create Error Tracker

**File to create:** `src/lib/errors/tracker.ts`

**Content:**
```typescript
import { createClient } from '@supabase/supabase-js';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import { ErrorType, classifyError } from './taxonomy';

const supabase = createClient(secrets.supabaseUrl, secrets.supabaseServiceRoleKey);

export interface ErrorContext {
  runId?: string;
  step: string;
  errorType?: ErrorType;
  url?: string;
  selector?: string;
  screenshotPath?: string;
  tracePath?: string;
  context?: Record<string, any>;
}

export class ErrorTracker {
  async trackError(error: Error, context: ErrorContext): Promise<void> {
    const errorType = context.errorType || classifyError(error);

    logger.error('Tracking error', {
      step: context.step,
      errorType,
      message: error.message,
    });

    try {
      const { error: dbError } = await supabase.from('agent_errors').insert({
        run_id: context.runId || null,
        step: context.step,
        error_type: errorType,
        message: error.message,
        stack_trace: error.stack || null,
        screenshot_url: context.screenshotPath || null,
        trace_url: context.tracePath || null,
        context: context.context || null,
        retry_count: 0,
        resolved: false,
      });

      if (dbError) {
        logger.error('Failed to persist error to database', { error: dbError });
      } else {
        logger.info('Error tracked successfully', { errorType, step: context.step });
      }
    } catch (trackError) {
      logger.error('Error tracker failed', { error: trackError });
    }
  }

  async incrementRetryCount(errorId: number): Promise<void> {
    const { error } = await supabase
      .from('agent_errors')
      .update({ retry_count: supabase.rpc('increment', { x: 1, field: 'retry_count' }) })
      .eq('id', errorId);

    if (error) {
      logger.error('Failed to increment retry count', { errorId, error });
    }
  }

  async markResolved(errorId: number): Promise<void> {
    const { error } = await supabase
      .from('agent_errors')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', errorId);

    if (error) {
      logger.error('Failed to mark error as resolved', { errorId, error });
    } else {
      logger.info('Error marked as resolved', { errorId });
    }
  }

  async getUnresolvedErrors(runId?: string): Promise<any[]> {
    let query = supabase
      .from('agent_errors')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (runId) {
      query = query.eq('run_id', runId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch unresolved errors', { error });
      return [];
    }

    return data || [];
  }
}

export const errorTracker = new ErrorTracker();
```

**Acceptance:**
- [ ] ErrorTracker class created
- [ ] Writes errors to `agent_errors` table
- [ ] Includes screenshot and trace URLs
- [ ] Can increment retry count
- [ ] Can mark errors as resolved
- [ ] Can query unresolved errors

---

### Task 4: Create Retry Utility

**File to create:** `src/lib/retry.ts`

**Content:**
```typescript
import { logger } from './logger';
import { ErrorType, shouldRetry as shouldRetryByType } from './errors/taxonomy';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void | Promise<void>;
  shouldRetry?: (error: Error) => boolean;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    onRetry = () => {},
    shouldRetry = () => true,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      const isLastAttempt = attempt === maxRetries + 1;
      const shouldContinue = shouldRetry(lastError);

      logger.warn('Operation failed', {
        attempt,
        maxRetries,
        error: lastError.message,
        willRetry: !isLastAttempt && shouldContinue,
      });

      if (isLastAttempt || !shouldContinue) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );

      logger.info('Retrying after delay', { delay, attempt });

      await onRetry(attempt, lastError);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}

export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retry(fn, {
    ...options,
    initialDelayMs: (options.initialDelayMs || 1000) * (0.5 + Math.random()),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Acceptance:**
- [ ] Retry function with exponential backoff
- [ ] Configurable max retries and delays
- [ ] Supports custom retry logic (shouldRetry)
- [ ] Jitter variant to avoid thundering herd
- [ ] Logs each retry attempt

---

### Task 5: Create Custom Error Classes

**File to create:** `src/lib/errors/custom-errors.ts`

**Content:**
```typescript
import { ErrorType } from './taxonomy';

export class AgentError extends Error {
  constructor(
    message: string,
    public errorType: ErrorType,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class AuthenticationError extends AgentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.AUTH_FAILED, context);
    this.name = 'AuthenticationError';
  }
}

export class SelectorNotFoundError extends AgentError {
  constructor(selector: string, step: string, context?: Record<string, any>) {
    super(`Selector not found: ${selector} at step: ${step}`, ErrorType.SELECTOR_NOT_FOUND, {
      ...context,
      selector,
      step,
    });
    this.name = 'SelectorNotFoundError';
  }
}

export class ValidationError extends AgentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.VALIDATION_FAILED, context);
    this.name = 'ValidationError';
  }
}

export class UploadError extends AgentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.UPLOAD_FAILED, context);
    this.name = 'UploadError';
  }
}

export class RateLimitError extends AgentError {
  constructor(message: string, retryAfterMs?: number) {
    super(message, ErrorType.RATE_LIMITED, { retryAfterMs });
    this.name = 'RateLimitError';
  }
}
```

**Acceptance:**
- [ ] Custom error classes extend AgentError
- [ ] Each error has associated ErrorType
- [ ] Context object for additional metadata
- [ ] Useful for specific error handling

---

### Task 6: Create Error Index

**File to create:** `src/lib/errors/index.ts`

**Content:**
```typescript
export * from './taxonomy';
export * from './tracker';
export * from './custom-errors';
```

**Acceptance:**
- [ ] All error modules exported from single entry point
- [ ] Clean imports: `import { ErrorType, errorTracker } from '@lib/errors'`

---

### Task 7: Create Logger Test Script

**File to create:** `tests/lib/logger-test.ts`

**Content:**
```typescript
import { logger } from '@lib/logger';
import { errorTracker } from '@lib/errors';
import { retry } from '@lib/retry';

async function testLogger() {
  console.log('\n=== Testing Logger ===\n');

  logger.debug('This is a debug message', { user: 'test' });
  logger.info('This is an info message', { status: 'running' });
  logger.warn('This is a warning', { threshold: 0.8 });
  logger.error('This is an error', { code: 'TEST_ERROR' });

  console.log('\n=== Testing Child Logger ===\n');

  const childLogger = logger.child({ runId: '12345', client: 'TestClient' });
  childLogger.info('Child logger message');

  console.log('\n✅ Logger tests complete\n');
}

async function testRetry() {
  console.log('\n=== Testing Retry Logic ===\n');

  let attempts = 0;
  const failingFunction = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Temporary failure');
    }
    return 'Success!';
  };

  try {
    const result = await retry(failingFunction, {
      maxRetries: 3,
      initialDelayMs: 100,
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt}: ${error.message}`);
      },
    });

    console.log(`✅ Retry succeeded: ${result}\n`);
  } catch (error) {
    console.error(`❌ Retry failed: ${error}\n`);
  }
}

async function testErrorTracker() {
  console.log('\n=== Testing Error Tracker ===\n');

  try {
    throw new Error('Test error for tracking');
  } catch (error) {
    await errorTracker.trackError(error as Error, {
      step: 'test_step',
      context: { testData: 'example' },
    });

    console.log('✅ Error tracked to database\n');
  }

  const unresolvedErrors = await errorTracker.getUnresolvedErrors();
  console.log(`Found ${unresolvedErrors.length} unresolved errors\n`);
}

async function runTests() {
  await testLogger();
  await testRetry();
  await testErrorTracker();

  console.log('✅ All tests complete!\n');
}

runTests().catch(console.error);
```

**Acceptance:**
- [ ] Test script runs without errors
- [ ] Logger outputs JSON
- [ ] Retry logic works correctly
- [ ] Error tracker writes to database

---

## Definition of Done

- [ ] Structured logger created with JSON output
- [ ] Error taxonomy defined (20+ error types)
- [ ] Error tracker writes to `agent_errors` table
- [ ] Retry utility with exponential backoff
- [ ] Custom error classes (AuthenticationError, SelectorNotFoundError, etc.)
- [ ] All errors include context, severity, retry metadata
- [ ] Test script validates all components
- [ ] No TypeScript errors
- [ ] Logger respects LOG_LEVEL environment variable

---

## Validation Commands

```bash
# Run logger tests
tsx tests/lib/logger-test.ts

# Type check
npm run validate:types

# Verify agent_errors table exists
psql $DATABASE_URL -c "SELECT COUNT(*) FROM agent_errors;"

# Test with different log levels
LOG_LEVEL=debug tsx tests/lib/logger-test.ts
LOG_LEVEL=error tsx tests/lib/logger-test.ts
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Logs too verbose (performance impact) | Use LOG_LEVEL=warn in production, debug only locally |
| Error tracker fails (doesn't block execution) | Wrap in try/catch, log locally if DB write fails |
| Retry logic causes infinite loops | Hard limit on maxRetries, timeout per attempt |
| Sensitive data in logs | Sanitize credentials, PII before logging |

---

## Files Created

- `src/lib/logger.ts`
- `src/lib/errors/taxonomy.ts`
- `src/lib/errors/tracker.ts`
- `src/lib/errors/custom-errors.ts`
- `src/lib/errors/index.ts`
- `src/lib/retry.ts`
- `tests/lib/logger-test.ts`

---

## Next Milestone

**Milestone 2: Data Pipeline** (Phases 6-10)
- Requires Foundation complete (Phases 1-5)
- Will build Cole, Clay, Bison connectors
- Will implement lead validation and normalization
