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
