/**
 * Comprehensive Tests for MVSEPClient
 * All API calls are mocked - no real requests are made
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MVSEPClient } from '../src/client';
import {
  ValidationError,
  AuthenticationError,
  RateLimitError,
  NetworkError,
  APIError,
  TimeoutError,
  SeparationError
} from '../src/errors';
import { Readable } from 'stream';

// Mock global fetch
global.fetch = vi.fn();

describe('MVSEPClient', () => {
  let client: MVSEPClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MVSEPClient({
      apiToken: 'test-token-123'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create mock response
  const mockResponse = (data: any, status = 200, headers: Record<string, string> = {}) => {
    const response = {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: new Map(Object.entries({
        'content-type': 'application/json',
        ...headers
      })),
      json: async () => data,
      text: async () => JSON.stringify(data)
    };
    (global.fetch as any).mockResolvedValueOnce(response);
    return response;
  };

  const mockErrorResponse = (status: number, message: string, data?: any) => {
    const errorData = data || { success: false, message };
    const response = {
      ok: false,
      status,
      statusText: 'Error',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => errorData,
      text: async () => JSON.stringify(errorData)
    };
    (global.fetch as any).mockResolvedValueOnce(response);
    return response;
  };

  describe('Constructor', () => {
    it('should create client with valid config', () => {
      expect(client).toBeInstanceOf(MVSEPClient);
    });

    it('should throw ValidationError without API token', () => {
      expect(() => {
        new MVSEPClient({} as any);
      }).toThrow(ValidationError);
      expect(() => {
        new MVSEPClient({} as any);
      }).toThrow('API token is required');
    });

    it('should use default values for optional config', () => {
      const client = new MVSEPClient({
        apiToken: 'test-token'
      });
      expect(client).toBeInstanceOf(MVSEPClient);
    });

    it('should accept custom configuration', () => {
      const client = new MVSEPClient({
        apiToken: 'test-token',
        baseURL: 'https://custom.com',
        timeout: 60000,
        maxRetries: 5,
        debug: true,
        customHeaders: { 'X-Custom': 'value' }
      });
      expect(client).toBeInstanceOf(MVSEPClient);
    });
  });

  describe('Authentication Methods', () => {
    describe('register', () => {
      it('should register a new user', async () => {
        const mockData = {
          success: true,
          message: 'User registered successfully'
        };
        mockResponse(mockData);

        const result = await client.register({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          password_confirmation: 'password123'
        });

        expect(result).toEqual(mockData);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = (global.fetch as any).mock.calls[0];
        expect(url).toContain('/api/app/register');
        expect(options.method).toBe('POST');
      });

      it('should handle registration validation errors', async () => {
        mockErrorResponse(422, 'Validation failed', {
          success: false,
          message: 'Validation failed',
          errors: { email: ['Email already exists'] }
        });

        await expect(client.register({
          name: 'Test',
          email: 'test@example.com',
          password: 'pass',
          password_confirmation: 'pass'
        })).rejects.toThrow(ValidationError);
      });
    });

    describe('login', () => {
      it('should login user and return user data', async () => {
        const mockData = {
          success: true,
          data: {
            name: 'Test User',
            email: 'test@example.com',
            api_token: 'new-token-456',
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
            premium_minutes: 0,
            premium_enabled: 0,
            long_filenames_enabled: 0
          }
        };
        mockResponse(mockData);

        const result = await client.login({
          email: 'test@example.com',
          password: 'password123'
        });

        expect(result.success).toBe(true);
        expect(result.data?.api_token).toBe('new-token-456');
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('should handle invalid credentials', async () => {
        mockErrorResponse(401, 'Invalid credentials');

        await expect(client.login({
          email: 'wrong@example.com',
          password: 'wrongpass'
        })).rejects.toThrow(AuthenticationError);
      });
    });

    describe('getUser', () => {
      it('should get current user information', async () => {
        const mockData = {
          success: true,
          data: {
            name: 'Test User',
            email: 'test@example.com',
            api_token: 'test-token-123',
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
            premium_minutes: 100,
            premium_enabled: 1,
            long_filenames_enabled: 1
          }
        };
        mockResponse(mockData);

        const user = await client.getUser();

        expect(user.name).toBe('Test User');
        expect(user.premium_enabled).toBe(1);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url] = (global.fetch as any).mock.calls[0];
        expect(url).toContain('/api/app/user');
        expect(url).toContain('api_token=test-token-123');
      });

      it('should handle unauthorized access', async () => {
        mockErrorResponse(401, 'Unauthorized');

        await expect(client.getUser()).rejects.toThrow(AuthenticationError);
      });
    });
  });

  describe('Profile Methods', () => {
    it('should enable premium', async () => {
      const mockData = { success: true, message: 'Premium enabled' };
      mockResponse(mockData);

      const result = await client.enablePremium();

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should disable premium', async () => {
      const mockData = { success: true, message: 'Premium disabled' };
      mockResponse(mockData);

      const result = await client.disablePremium();

      expect(result.success).toBe(true);
    });

    it('should enable long filenames', async () => {
      const mockData = { success: true, message: 'Long filenames enabled' };
      mockResponse(mockData);

      const result = await client.enableLongFilenames();

      expect(result.success).toBe(true);
    });

    it('should disable long filenames', async () => {
      const mockData = { success: true, message: 'Long filenames disabled' };
      mockResponse(mockData);

      const result = await client.disableLongFilenames();

      expect(result.success).toBe(true);
    });
  });

  describe('Algorithms', () => {
    it('should get available algorithms', async () => {
      const mockData = [
        {
          id: 25,
          name: 'MDX23C',
          algorithm_group_id: 1,
          orientation: 1,
          render_id: 1,
          order_id: 1,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          additional_fields: null,
          price_coefficient: 1.0,
          is_active: 1,
          algorithm_fields: [],
          algorithm_descriptions: []
        }
      ];
      mockResponse(mockData);

      const algorithms = await client.getAlgorithms();

      expect(Array.isArray(algorithms)).toBe(true);
      expect(algorithms.length).toBeGreaterThan(0);
      expect(algorithms[0].id).toBe(25);
      expect(algorithms[0].name).toBe('MDX23C');
    });
  });

  describe('Separation Methods', () => {
    describe('createSeparation', () => {
      it('should create separation with Buffer', async () => {
        const mockData = { hash: 'test-hash-123' };
        mockResponse(mockData);

        const buffer = Buffer.from('fake audio data');
        const result = await client.createSeparation({
          audiofile: buffer,
          sep_type: 25
        });

        expect(result.hash).toBe('test-hash-123');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = (global.fetch as any).mock.calls[0];
        expect(url).toContain('/api/separation/create');
        expect(options.method).toBe('POST');
      });

      it('should create separation with Stream', async () => {
        const mockData = { hash: 'test-hash-456' };
        mockResponse(mockData);

        const stream = Readable.from(['fake', 'audio', 'data']);
        const result = await client.createSeparation({
          audiofile: stream,
          sep_type: 25
        });

        expect(result.hash).toBe('test-hash-456');
      });

      it('should handle hash in nested data property', async () => {
        const mockData = { data: { hash: 'nested-hash-789' } };
        mockResponse(mockData);

        const buffer = Buffer.from('audio');
        const result = await client.createSeparation({
          audiofile: buffer,
          sep_type: 25
        });

        expect(result.hash).toBe('nested-hash-789');
      });

      it('should throw error when no hash returned', async () => {
        mockResponse({ success: true });

        const buffer = Buffer.from('audio');
        await expect(client.createSeparation({
          audiofile: buffer,
          sep_type: 25
        })).rejects.toThrow(SeparationError);
      });
    });

    describe('getSeparation', () => {
      it('should get separation status - waiting', async () => {
        const mockData = {
          success: true,
          status: 'waiting',
          data: {
            queue_count: 5,
            current_order: 2
          }
        };
        mockResponse(mockData);

        const result = await client.getSeparation('test-hash-123');

        expect(result.status).toBe('waiting');
        expect(result.data).toHaveProperty('queue_count');
        const [url] = (global.fetch as any).mock.calls[0];
        expect(url).toContain('/api/separation/get');
        expect(url).toContain('hash=test-hash-123');
      });

      it('should get separation status - done', async () => {
        const mockData = {
          success: true,
          status: 'done',
          data: {
            algorithm: 'MDX23C',
            algorithm_description: 'Description',
            size: '5.2 MB',
            output_format: 'wav',
            input_file: {
              url: 'https://example.com/input.mp3',
              size: '4.5 MB',
              download: 'https://example.com/download/input.mp3'
            },
            files: [
              {
                url: 'https://example.com/vocals.wav',
                size: '2.6 MB',
                download: 'https://example.com/download/vocals.wav',
                stem: 'vocals'
              },
              {
                url: 'https://example.com/instrumental.wav',
                size: '2.6 MB',
                download: 'https://example.com/download/instrumental.wav',
                stem: 'instrumental'
              }
            ],
            date: '2024-01-01 12:00:00'
          }
        };
        mockResponse(mockData);

        const result = await client.getSeparation('test-hash-123');

        expect(result.status).toBe('done');
        expect(result.data).toHaveProperty('files');
        expect((result.data as any).files).toHaveLength(2);
      });
    });

    describe('waitForSeparation', () => {
      it('should poll until completion', async () => {
        // First call: waiting
        mockResponse({
          success: true,
          status: 'waiting',
          data: { queue_count: 2, current_order: 1 }
        });

        // Second call: processing
        mockResponse({
          success: true,
          status: 'processing',
          data: { queue_count: 1, current_order: 1 }
        });

        // Third call: done
        mockResponse({
          success: true,
          status: 'done',
          data: {
            algorithm: 'MDX23C',
            files: [],
            date: '2024-01-01',
            size: '1MB',
            output_format: 'wav',
            algorithm_description: 'Test',
            input_file: { url: '', size: '', download: '' }
          }
        });

        const progressStates: string[] = [];
        const result = await client.waitForSeparation('test-hash', {
          interval: 10, // Short interval for testing
          onProgress: (status) => progressStates.push(status.status)
        });

        expect(result.status).toBe('done');
        expect(progressStates).toContain('waiting');
        expect(progressStates).toContain('processing');
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });

      it('should throw error on timeout', async () => {
        // Mock multiple responses to simulate long processing
        for (let i = 0; i < 10; i++) {
          mockResponse({
            success: true,
            status: 'processing',
            data: {}
          });
        }

        await expect(client.waitForSeparation('test-hash', {
          interval: 10,
          maxDuration: 50 // Very short timeout
        })).rejects.toThrow(TimeoutError);
      }, 10000); // 10 second timeout for this test

      it('should throw error on separation error status', async () => {
        mockResponse({
          success: true,
          status: 'error',
          data: {}
        });

        await expect(client.waitForSeparation('test-hash', {
          interval: 10
        })).rejects.toThrow(SeparationError);
      });
    });

    describe('createAndWaitForSeparation', () => {
      it('should create and wait for separation', async () => {
        // Create response
        mockResponse({ hash: 'test-hash-123' });

        // Wait response
        mockResponse({
          success: true,
          status: 'done',
          data: {
            algorithm: 'MDX23C',
            files: [],
            date: '2024-01-01',
            size: '1MB',
            output_format: 'wav',
            algorithm_description: 'Test',
            input_file: { url: '', size: '', download: '' }
          }
        });

        const buffer = Buffer.from('audio');
        const result = await client.createAndWaitForSeparation({
          audiofile: buffer,
          sep_type: 25
        }, {
          interval: 10
        });

        expect(result.status).toBe('done');
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    describe('getSeparationHistory', () => {
      it('should get separation history', async () => {
        const mockData = {
          success: true,
          data: [
            {
              id: 1,
              hash: 'history-hash-1',
              created_at: '2024-01-01',
              updated_at: '2024-01-01',
              job_exists: true,
              credits: 1,
              time_left: 3600,
              algorithm: {
                id: 25,
                name: 'MDX23C',
                algorithm_group_id: 1,
                orientation: 1,
                render_id: 1,
                order_id: 1,
                created_at: '2024-01-01',
                updated_at: '2024-01-01',
                additional_fields: null,
                price_coefficient: 1.0,
                is_active: 1,
                algorithm_fields: [],
                algorithm_descriptions: []
              }
            }
          ]
        };
        mockResponse(mockData);

        const history = await client.getSeparationHistory({ start: 0, limit: 10 });

        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBe(1);
        expect(history[0].hash).toBe('history-hash-1');
        const [url] = (global.fetch as any).mock.calls[0];
        expect(url).toContain('start=0');
        expect(url).toContain('limit=10');
      });

      it('should get history without parameters', async () => {
        mockResponse({ success: true, data: [] });

        const history = await client.getSeparationHistory();

        expect(Array.isArray(history)).toBe(true);
      });
    });
  });

  describe('News and Demo', () => {
    describe('getNews', () => {
      it('should get news articles', async () => {
        const mockData = [
          {
            id: 1,
            title: 'Test News',
            lang: 'en',
            text: 'News content',
            status: 1,
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          }
        ];
        mockResponse(mockData);

        const news = await client.getNews({ lang: 'en', start: 0, limit: 5 });

        expect(Array.isArray(news)).toBe(true);
        expect(news[0].title).toBe('Test News');
        const [url] = (global.fetch as any).mock.calls[0];
        expect(url).toContain('lang=en');
      });
    });

    describe('getDemo', () => {
      it('should get demo separations', async () => {
        const mockData = [
          {
            hash: 'demo-hash-1',
            date: '2024-01-01',
            input_audio: 'https://example.com/demo.mp3',
            algorithm: {
              id: 25,
              name: 'MDX23C',
              algorithm_group_id: 1,
              orientation: 1,
              render_id: 1,
              order_id: 1,
              created_at: '2024-01-01',
              updated_at: '2024-01-01',
              additional_fields: null,
              price_coefficient: 1.0,
              is_active: 1,
              algorithm_fields: [],
              algorithm_descriptions: []
            }
          }
        ];
        mockResponse(mockData);

        const demos = await client.getDemo({ start: 0, limit: 5 });

        expect(Array.isArray(demos)).toBe(true);
        expect(demos[0].hash).toBe('demo-hash-1');
      });
    });
  });

  describe('Quality Checker', () => {
    describe('addQualityCheckerEntry', () => {
      it('should add quality checker entry', async () => {
        const mockData = {
          success: true,
          data: {
            id: 1,
            link: 'https://example.com/quality/1'
          }
        };
        mockResponse(mockData);

        const buffer = Buffer.from('zip data');
        const result = await client.addQualityCheckerEntry({
          zipfile: buffer,
          algo_name: 'MDX23C',
          main_text: 'Test entry',
          dataset_type: 'test',
          ensemble: 'single',
          password: 'secret'
        });

        expect(result.success).toBe(true);
        expect(result.data.id).toBe(1);
      });
    });

    describe('deleteQualityCheckerEntry', () => {
      it('should delete quality checker entry', async () => {
        const mockData = { success: true, message: 'Deleted' };
        mockResponse(mockData);

        const result = await client.deleteQualityCheckerEntry({
          id: 1,
          password: 'secret'
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting', async () => {
      // Mock all retry attempts to fail with 429
      for (let i = 0; i < 4; i++) {
        mockErrorResponse(429, 'Rate limit exceeded', undefined);
      }

      await expect(client.getAlgorithms()).rejects.toThrow(RateLimitError);
    }, 10000);

    it('should handle rate limiting with Retry-After header', async () => {
      // Mock all retry attempts with Retry-After header
      for (let i = 0; i < 4; i++) {
        const response = {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([
            ['content-type', 'application/json'],
            ['retry-after', '1']
          ]),
          json: async () => ({ message: 'Rate limit exceeded' }),
          text: async () => JSON.stringify({ message: 'Rate limit exceeded' })
        };
        (global.fetch as any).mockResolvedValueOnce(response);
      }

      await expect(client.getAlgorithms()).rejects.toThrow(RateLimitError);
    }, 10000);

    it('should handle authentication errors', async () => {
      mockErrorResponse(401, 'Unauthorized');

      await expect(client.getUser()).rejects.toThrow(AuthenticationError);
    });

    it('should handle validation errors', async () => {
      mockErrorResponse(400, 'Bad request');

      await expect(client.getAlgorithms()).rejects.toThrow(ValidationError);
    });

    it('should handle generic API errors', async () => {
      // Mock all retry attempts to fail with 500
      for (let i = 0; i < 4; i++) {
        mockErrorResponse(500, 'Internal server error');
      }

      await expect(client.getAlgorithms()).rejects.toThrow(APIError);
    }, 10000);

    it('should handle network errors', async () => {
      // Mock all retry attempts to fail with network error
      for (let i = 0; i < 4; i++) {
        (global.fetch as any).mockRejectedValueOnce(new TypeError('Network request failed'));
      }

      await expect(client.getAlgorithms()).rejects.toThrow(NetworkError);
    }, 10000);

    it('should retry on retryable errors', async () => {
      // First two calls fail with 503
      mockErrorResponse(503, 'Service unavailable');
      mockErrorResponse(503, 'Service unavailable');
      // Third call succeeds
      mockResponse([]);

      const result = await client.getAlgorithms();

      expect(result).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should not retry on non-retryable errors', async () => {
      mockErrorResponse(400, 'Bad request');

      await expect(client.getAlgorithms()).rejects.toThrow(ValidationError);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom base URL', async () => {
      const customClient = new MVSEPClient({
        apiToken: 'test-token',
        baseURL: 'https://custom-api.com'
      });

      mockResponse([]);
      await customClient.getAlgorithms();

      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain('https://custom-api.com');
    });

    it('should include custom headers', async () => {
      const customClient = new MVSEPClient({
        apiToken: 'test-token',
        customHeaders: {
          'X-Custom-Header': 'custom-value'
        }
      });

      mockResponse([]);
      await customClient.getAlgorithms();

      const [, options] = (global.fetch as any).mock.calls[0];
      expect(options.headers['X-Custom-Header']).toBe('custom-value');
    });

    it('should respect maxRetries configuration', async () => {
      const customClient = new MVSEPClient({
        apiToken: 'test-token',
        maxRetries: 1
      });

      // Mock initial call + 1 retry
      mockErrorResponse(503, 'Service unavailable');
      mockErrorResponse(503, 'Service unavailable');

      await expect(customClient.getAlgorithms()).rejects.toThrow();
      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    }, 10000);
  });
});