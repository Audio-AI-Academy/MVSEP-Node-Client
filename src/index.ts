/**
 * @mvsep/node - Official Node.js SDK for MVSEP Audio Separation API
 *
 * @author AI Audio Academy
 * @license MIT
 */

// Main client
export { MVSEPClient } from './client';

// Types
export * from './types';

// Errors
export * from './errors';

// Utilities (for advanced usage)
export {
  retryWithBackoff,
  withTimeout,
  isRetryableError,
  calculateBackoff,
  parseRetryAfter,
  sleep
} from './retry';

// Version
export const VERSION = '1.0.0';