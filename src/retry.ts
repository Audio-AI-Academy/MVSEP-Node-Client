/**
 * Retry Logic with Exponential Backoff
 */

import { RateLimitError, NetworkError, TimeoutError } from './errors';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const RETRYABLE_ERROR_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return true;
  }

  // Rate limit errors
  if (error instanceof RateLimitError) {
    return true;
  }

  // HTTP status codes
  if (error.status && RETRYABLE_STATUS_CODES.includes(error.status)) {
    return true;
  }

  // Node.js error codes
  if (error.code && RETRYABLE_ERROR_CODES.includes(error.code)) {
    return true;
  }

  return false;
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(attempt: number, baseDelay: number): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 32000);
}

/**
 * Parse Retry-After header value
 */
export function parseRetryAfter(retryAfter: string | null | undefined): number {
  if (!retryAfter) {
    return 0;
  }

  // Try parsing as seconds
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return 0;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  isRetryable: (error: any) => boolean = isRetryableError
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry if not retryable or if this was the last attempt
      if (!isRetryable(error) || attempt === config.maxRetries) {
        throw error;
      }

      // Calculate delay
      let delay: number;
      
      if (error instanceof RateLimitError && error.retryAfter) {
        delay = error.retryAfter;
      } else if (error.headers?.['retry-after']) {
        delay = parseRetryAfter(error.headers['retry-after']);
      } else {
        delay = calculateBackoff(attempt, config.retryDelay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Execute request with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error = new TimeoutError(`Request timed out after ${timeoutMs}ms`)
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(timeoutError), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}