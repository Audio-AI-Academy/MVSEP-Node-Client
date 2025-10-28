/**
 * Custom Error Classes for MVSEP SDK
 */

/**
 * Base error class for all MVSEP SDK errors
 */
export class MVSEPError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'MVSEPError';
    Object.setPrototypeOf(this, MVSEPError.prototype);
  }
}

/**
 * API-specific errors with HTTP status information
 */
export class APIError extends MVSEPError {
  constructor(
    public status: number,
    public statusText: string,
    message: string,
    public response?: any,
    public headers?: Record<string, string>
  ) {
    super(message);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Network-related errors (timeouts, connection issues, etc.)
 */
export class NetworkError extends MVSEPError {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Authentication and authorization errors
 */
export class AuthenticationError extends MVSEPError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Rate limit exceeded errors
 */
export class RateLimitError extends APIError {
  constructor(
    status: number,
    statusText: string,
    message: string,
    response?: any,
    public retryAfter?: number
  ) {
    super(status, statusText, message, response);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Validation errors for request parameters
 */
export class ValidationError extends MVSEPError {
  constructor(message: string, public errors?: any[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Timeout errors for long-running operations
 */
export class TimeoutError extends MVSEPError {
  constructor(message: string = 'Operation timed out') {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Errors during file upload or processing
 */
export class FileUploadError extends MVSEPError {
  constructor(message: string) {
    super(message, 'FILE_UPLOAD_ERROR');
    this.name = 'FileUploadError';
    Object.setPrototypeOf(this, FileUploadError.prototype);
  }
}

/**
 * Errors during separation job polling
 */
export class SeparationError extends MVSEPError {
  constructor(message: string, public hash?: string) {
    super(message, 'SEPARATION_ERROR');
    this.name = 'SeparationError';
    Object.setPrototypeOf(this, SeparationError.prototype);
  }
}