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
