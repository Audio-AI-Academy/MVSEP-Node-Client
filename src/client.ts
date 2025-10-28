/**
 * MVSEP API Client
 * Main SDK class for interacting with the MVSEP Audio Separation API
 */

import FormData from 'form-data';
import {
  MVSEPConfig,
  Algorithm,
  User,
  LoginParams,
  RegisterParams,
  SeparationCreateParams,
  SeparationResponse,
  SeparationHistoryItem,
  SeparationHistoryParams,
  News,
  NewsParams,
  Demo,
  DemoParams,
  QualityCheckerAddParams,
  QualityCheckerAddResponse,
  QualityCheckerDeleteParams,
  APIResponse,
  ProfileResponse,
  PollingOptions
} from './types';
import {
  MVSEPError,
  APIError,
  NetworkError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  TimeoutError,
  FileUploadError,
  SeparationError
} from './errors';
import { retryWithBackoff, withTimeout, parseRetryAfter, sleep } from './retry';

const DEFAULT_BASE_URL = 'https://mvsep.com';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_POLL_INTERVAL = 5000;
const DEFAULT_POLL_MAX_DURATION = 1800000; // 30 minutes

/**
 * Main MVSEP API Client
 * 
 * @example
 * ```typescript
 * const client = new MVSEPClient({ apiToken: 'your-api-token' });
 * 
 * // Create a separation
 * const result = await client.createSeparation({
 *   audiofile: fs.createReadStream('song.mp3'),
 *   sep_type: 25
 * });
 * 
 * // Wait for completion with polling
 * const completed = await client.waitForSeparation(result.hash, {
 *   onProgress: (status) => console.log(status.status)
 * });
 * ```
 */
export class MVSEPClient {
  private readonly apiToken: string;
  private readonly baseURL: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly debug: boolean;
  private readonly customHeaders: Record<string, string>;

  constructor(config: MVSEPConfig) {
    if (!config.apiToken) {
      throw new ValidationError('API token is required');
    }

    this.apiToken = config.apiToken;
    this.baseURL = config.baseURL || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelay = config.retryDelay || DEFAULT_RETRY_DELAY;
    this.debug = config.debug || false;
    this.customHeaders = config.customHeaders || {};
  }

  /**
   * Make an HTTP request with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    if (this.debug) {
      console.log(`[MVSEP SDK] ${options.method || 'GET'} ${url}`);
    }

    const headers: Record<string, string> = {
      'User-Agent': `@mvsep/node/1.0.0 Node.js/${process.version}`,
      ...this.customHeaders,
      ...(options.headers as Record<string, string> || {})
    };

    // Don't set Content-Type for FormData (it sets its own with boundary)
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const requestOptions: RequestInit = {
      ...options,
      headers
    };

    const makeRequest = async (): Promise<T> => {
      try {
        const response: Response = await withTimeout(
          fetch(url, requestOptions),
          this.timeout
        );

        // Extract headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value: string, key: string) => {
          responseHeaders[key] = value;
        });

        // Parse response body
        const contentType = response.headers.get('content-type');
        let data: any;

        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        // Handle non-2xx responses
        if (!response.ok) {
          // Rate limiting
          if (response.status === 429) {
            const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
            throw new RateLimitError(
              response.status,
              response.statusText,
              data.message || 'Rate limit exceeded',
              data,
              retryAfter
            );
          }

          // Authentication errors
          if (response.status === 401 || response.status === 403) {
            throw new AuthenticationError(
              data.message || 'Authentication failed'
            );
          }

          // Validation errors
          if (response.status === 400 || response.status === 422) {
            throw new ValidationError(
              data.message || 'Validation failed',
              data.errors
            );
          }

          // Generic API error
          throw new APIError(
            response.status,
            response.statusText,
            data.message || `API request failed with status ${response.status}`,
            data,
            responseHeaders
          );
        }

        if (this.debug) {
          console.log(`[MVSEP SDK] Response:`, data);
        }

        return data;
      } catch (error: any) {
        if (error instanceof MVSEPError) {
          throw error;
        }

        // Network errors
        if (error.name === 'TypeError' || error.code === 'ECONNREFUSED') {
          throw new NetworkError(
            `Network request failed: ${error.message}`,
            error
          );
        }

        // Timeout errors
        if (error instanceof TimeoutError) {
          throw error;
        }

        throw new NetworkError(
          `Request failed: ${error.message}`,
          error
        );
      }
    };

    return retryWithBackoff(makeRequest, {
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
      timeout: this.timeout
    });
  }

  /**
   * Build form data for file uploads
   */
  private buildFormData(params: Record<string, any>): FormData {
    const formData = new FormData();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Buffer.isBuffer(value) || (value as any).pipe) {
        // Handle Buffer or Stream
        formData.append(key, value, { filename: 'file' });
      } else if (typeof value === 'object' && 'value' in value) {
        // Handle FileInput with options
        const fileInput = value as any;
        formData.append(key, fileInput.value, fileInput.options || {});
      } else {
        // Handle primitives
        formData.append(key, String(value));
      }
    }

    return formData;
  }

  // ============================================================================
  // Authentication & User Management
  // ============================================================================

  /**
   * Register a new user account
   * 
   * @param params - Registration parameters
   * @returns Registration response
   * 
   * @example
   * ```typescript
   * const result = await client.register({
   *   name: 'John Doe',
   *   email: 'john@example.com',
   *   password: 'SecurePass123',
   *   password_confirmation: 'SecurePass123'
   * });
   * ```
   */
  async register(params: RegisterParams): Promise<APIResponse> {
    const formData = this.buildFormData(params);
    return this.request('/api/app/register', {
      method: 'POST',
      body: formData as any
    });
  }

  /**
   * Login and retrieve user information
   * 
   * @param params - Login credentials
   * @returns User data with API token
   * 
   * @example
   * ```typescript
   * const user = await client.login({
   *   email: 'john@example.com',
   *   password: 'SecurePass123'
   * });
   * console.log(user.data.api_token);
   * ```
   */
  async login(params: LoginParams): Promise<APIResponse<User>> {
    const formData = this.buildFormData(params);
    return this.request('/api/app/login', {
      method: 'POST',
      body: formData as any
    });
  }

  /**
   * Get current user information
   * 
   * @returns User profile data
   * 
   * @example
   * ```typescript
   * const user = await client.getUser();
   * console.log(`Premium: ${user.premium_enabled}`);
   * ```
   */
  async getUser(): Promise<User> {
    const response = await this.request<APIResponse<User>>(
      `/api/app/user?api_token=${this.apiToken}`
    );
    return response.data!;
  }

  // ============================================================================
  // Profile Settings
  // ============================================================================

  /**
   * Enable premium features
   */
  async enablePremium(): Promise<ProfileResponse> {
    const formData = this.buildFormData({ api_token: this.apiToken });
    return this.request('/api/app/enable_premium', {
      method: 'POST',
      body: formData as any
    });
  }

  /**
   * Disable premium features
   */
  async disablePremium(): Promise<ProfileResponse> {
    const formData = this.buildFormData({ api_token: this.apiToken });
    return this.request('/api/app/disable_premium', {
      method: 'POST',
      body: formData as any
    });
  }

  /**
   * Enable long filenames
   */
  async enableLongFilenames(): Promise<ProfileResponse> {
    const formData = this.buildFormData({ api_token: this.apiToken });
    return this.request('/api/app/enable_long_filenames', {
      method: 'POST',
      body: formData as any
    });
  }

  /**
   * Disable long filenames
   */
  async disableLongFilenames(): Promise<ProfileResponse> {
    const formData = this.buildFormData({ api_token: this.apiToken });
    return this.request('/api/app/disable_long_filenames', {
      method: 'POST',
      body: formData as any
    });
  }

  // ============================================================================
  // Algorithms
  // ============================================================================

  /**
   * Get list of available separation algorithms
   * 
   * @returns Array of available algorithms
   * 
   * @example
   * ```typescript
   * const algorithms = await client.getAlgorithms();
   * algorithms.forEach(algo => {
   *   console.log(`${algo.id}: ${algo.name}`);
   * });
   * ```
   */
  async getAlgorithms(): Promise<Algorithm[]> {
    return this.request('/api/app/algorithms');
  }

  // ============================================================================
  // Audio Separation
  // ============================================================================

  /**
   * Create a new audio separation job
   * 
   * @param params - Separation parameters including audio file and algorithm
   * @returns Separation job hash and initial status
   * 
   * @example
   * ```typescript
   * import fs from 'fs';
   * 
   * const result = await client.createSeparation({
   *   audiofile: fs.createReadStream('song.mp3'),
   *   sep_type: 25 // MDX23C algorithm
   * });
   * console.log(`Job hash: ${result.hash}`);
   * ```
   */
  async createSeparation(params: SeparationCreateParams): Promise<{ hash: string }> {
    const formData = this.buildFormData({
      api_token: this.apiToken,
      ...params
    });

    try {
      const response = await this.request<any>('/api/separation/create', {
        method: 'POST',
        body: formData as any
      });

      // Extract hash from response
      if (response.hash) {
        return { hash: response.hash };
      } else if (response.data?.hash) {
        return { hash: response.data.hash };
      }

      throw new SeparationError('No hash returned from separation creation');
    } catch (error: any) {
      if (error instanceof MVSEPError) {
        throw error;
      }
      throw new FileUploadError(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Get the status of a separation job
   * 
   * @param hash - Job hash from createSeparation
   * @returns Current job status and data
   * 
   * @example
   * ```typescript
   * const status = await client.getSeparation('job-hash-123');
   * console.log(status.status); // 'waiting', 'processing', or 'done'
   * ```
   */
  async getSeparation(hash: string): Promise<SeparationResponse> {
    return this.request(`/api/separation/get?hash=${encodeURIComponent(hash)}`);
  }

  /**
   * Poll a separation job until completion
   * 
   * @param hash - Job hash from createSeparation
   * @param options - Polling configuration
   * @returns Final separation result
   * 
   * @example
   * ```typescript
   * const result = await client.waitForSeparation('job-hash-123', {
   *   interval: 3000,
   *   maxDuration: 600000, // 10 minutes
   *   onProgress: (status) => {
   *     console.log(`Status: ${status.status}`);
   *   }
   * });
   * 
   * // Download results
   * result.data.files.forEach(file => {
   *   console.log(`${file.stem}: ${file.url}`);
   * });
   * ```
   */
  async waitForSeparation(
    hash: string,
    options: PollingOptions = {}
  ): Promise<SeparationResponse> {
    const interval = options.interval || DEFAULT_POLL_INTERVAL;
    const maxDuration = options.maxDuration || DEFAULT_POLL_MAX_DURATION;
    const startTime = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Check timeout
      if (Date.now() - startTime > maxDuration) {
        throw new TimeoutError(
          `Separation job timed out after ${maxDuration}ms`
        );
      }

      const status = await this.getSeparation(hash);

      // Call progress callback
      if (options.onProgress) {
        options.onProgress({
          hash,
          status: status.status,
          data: status.data
        });
      }

      // Check if completed
      if (status.status === 'done') {
        return status;
      }

      // Check if error
      if (status.status === 'error') {
        throw new SeparationError(
          'Separation job failed',
          hash
        );
      }

      // Wait before next poll
      await sleep(interval);
    }
  }

  /**
   * Create separation and wait for completion (convenience method)
   * 
   * @param params - Separation parameters
   * @param pollingOptions - Polling configuration
   * @returns Completed separation result
   * 
   * @example
   * ```typescript
   * const result = await client.createAndWaitForSeparation({
   *   audiofile: fs.createReadStream('song.mp3'),
   *   sep_type: 25
   * }, {
   *   onProgress: (status) => console.log(status.status)
   * });
   * ```
   */
  async createAndWaitForSeparation(
    params: SeparationCreateParams,
    pollingOptions: PollingOptions = {}
  ): Promise<SeparationResponse> {
    const { hash } = await this.createSeparation(params);
    return this.waitForSeparation(hash, pollingOptions);
  }

  /**
   * Get separation history
   * 
   * @param params - Pagination parameters
   * @returns Array of previous separations
   * 
   * @example
   * ```typescript
   * const history = await client.getSeparationHistory({
   *   start: 0,
   *   limit: 10
   * });
   * ```
   */
  async getSeparationHistory(
    params: SeparationHistoryParams = {}
  ): Promise<SeparationHistoryItem[]> {
    const queryParams = new URLSearchParams({
      api_token: this.apiToken,
      ...(params.start !== undefined && { start: String(params.start) }),
      ...(params.limit !== undefined && { limit: String(params.limit) })
    });

    const response = await this.request<APIResponse<SeparationHistoryItem[]>>(
      `/api/app/separation_history?${queryParams}`
    );
    return response.data!;
  }

  // ============================================================================
  // News & Information
  // ============================================================================

  /**
   * Get news articles
   * 
   * @param params - Filter and pagination parameters
   * @returns Array of news articles
   */
  async getNews(params: NewsParams = {}): Promise<News[]> {
    const queryParams = new URLSearchParams({
      ...(params.lang && { lang: params.lang }),
      ...(params.start !== undefined && { start: String(params.start) }),
      ...(params.limit !== undefined && { limit: String(params.limit) })
    });

    return this.request(`/api/app/news?${queryParams}`);
  }

  /**
   * Get demo separations
   * 
   * @param params - Pagination parameters
   * @returns Array of demo separations
   */
  async getDemo(params: DemoParams = {}): Promise<Demo[]> {
    const queryParams = new URLSearchParams({
      ...(params.start !== undefined && { start: String(params.start) }),
      ...(params.limit !== undefined && { limit: String(params.limit) })
    });

    return this.request(`/api/app/demo?${queryParams}`);
  }

  // ============================================================================
  // Quality Checker
  // ============================================================================

  /**
   * Add a quality checker entry
   * 
   * @param params - Quality checker parameters
   * @returns Created entry information
   */
  async addQualityCheckerEntry(
    params: QualityCheckerAddParams
  ): Promise<QualityCheckerAddResponse> {
    const formData = this.buildFormData({
      api_token: this.apiToken,
      ...params
    });

    return this.request('/api/quality_checker/add', {
      method: 'POST',
      body: formData as any
    });
  }

  /**
   * Delete a quality checker entry
   * 
   * @param params - Delete parameters
   * @returns Deletion confirmation
   */
  async deleteQualityCheckerEntry(
    params: QualityCheckerDeleteParams
  ): Promise<APIResponse> {
    const formData = this.buildFormData(params);

    return this.request('/api/quality_checker/delete', {
      method: 'POST',
      body: formData as any
    });
  }
}