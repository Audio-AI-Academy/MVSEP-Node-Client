# Testing Guide

This document explains the comprehensive testing setup for the MVSEP Node.js SDK.

## Overview

The SDK includes a full test suite with:
- **42 comprehensive tests** covering all API endpoints and functionality
- **100% mocked API calls** - no real requests are made during testing
- **Automated CI/CD** with GitHub Actions
- **Code coverage reporting** via Vitest

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (for development)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

### Run linter
```bash
npm run lint
```

### Build the package
```bash
npm run build
```

## Test Structure

Tests are organized by functionality in [`tests/client.test.ts`](tests/client.test.ts):

### 1. Constructor Tests (4 tests)
- Validates client initialization
- Tests error handling for missing API token
- Verifies default configuration values
- Tests custom configuration options

### 2. Authentication Tests (6 tests)
- User registration (success and validation errors)
- User login (success and invalid credentials)
- Get user information (success and unauthorized access)

### 3. Profile Management Tests (4 tests)
- Enable/disable premium features
- Enable/disable long filenames

### 4. Algorithm Tests (1 test)
- Fetch available separation algorithms

### 5. Audio Separation Tests (12 tests)
- Create separation with Buffer
- Create separation with Stream
- Handle different response formats
- Get separation status (waiting, processing, done)
- Poll until completion with progress callbacks
- Handle timeouts
- Handle errors
- Combined create and wait operations
- Fetch separation history

### 6. News & Demo Tests (2 tests)
- Fetch news articles with filters
- Fetch demo separations

### 7. Quality Checker Tests (2 tests)
- Add quality checker entries
- Delete quality checker entries

### 8. Error Handling Tests (8 tests)
- Rate limiting (with and without Retry-After header)
- Authentication errors (401/403)
- Validation errors (400/422)
- Generic API errors (500)
- Network errors
- Retry on retryable errors (503)
- No retry on non-retryable errors (400)

### 9. Custom Configuration Tests (3 tests)
- Custom base URL
- Custom headers
- Custom retry configuration

## Mocking Strategy

All tests use **Vitest's mocking capabilities** to mock the native `fetch` API:

```typescript
// Mock global fetch
global.fetch = vi.fn();

// Mock a successful response
const mockResponse = (data: any, status = 200) => {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['content-type', 'application/json']]),
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
  (global.fetch as any).mockResolvedValueOnce(response);
};
```

This ensures:
- ✅ **No real API calls** are made during tests
- ✅ Tests are **fast and reliable**
- ✅ Tests can run **offline**
- ✅ Full control over **API responses** and **error conditions**

## Continuous Integration

GitHub Actions automatically runs tests on:
- **Push** to `main` or `develop` branches
- **Pull requests** to `main` or `develop` branches

The CI workflow:
1. Tests on **Node.js 18.x, 20.x, and 22.x**
2. Runs **linter** to ensure code quality
3. Executes **all tests** with mocked API calls
4. Builds the package to verify **TypeScript compilation**
5. Generates **code coverage reports**

### Workflow Configuration

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for the complete CI setup.

## Test Configuration

### Vitest Config

The test runner is configured in [`vitest.config.ts`](vitest.config.ts):

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/**', 'dist/**', 'tests/**'],
      include: ['src/**/*.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
});
```

## Writing New Tests

When adding new SDK functionality:

1. **Add test cases** in `tests/client.test.ts`
2. **Mock all API responses** using helper functions
3. **Test success paths** and error conditions
4. **Verify retry logic** for network errors
5. **Test edge cases** (timeouts, rate limits, etc.)

### Example Test Pattern

```typescript
describe('New Feature', () => {
  it('should handle success case', async () => {
    // Mock the API response
    mockResponse({ success: true, data: {...} });
    
    // Call the method
    const result = await client.newFeatureMethod();
    
    // Assert expectations
    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle error case', async () => {
    // Mock error response
    mockErrorResponse(400, 'Bad request');
    
    // Expect rejection
    await expect(client.newFeatureMethod()).rejects.toThrow(ValidationError);
  });
});
```

## Coverage Goals

The project maintains:
- **≥ 80% line coverage**
- **≥ 80% function coverage**
- **≥ 75% branch coverage**
- **≥ 80% statement coverage**

Run `npm run test:coverage` to generate a detailed coverage report in the `coverage/` directory.

## Troubleshooting

### Tests timeout
Some tests that verify retry logic may take longer (up to 10 seconds). This is expected and tests are configured with appropriate timeout values.

### Mock issues
If you see "fetch is not defined" errors, ensure `global.fetch = vi.fn()` is set at the top of your test file.

### TypeScript errors
Run `npm run build` to check for TypeScript compilation errors before running tests.

## Best Practices

1. ✅ **Always mock external dependencies** (API calls, file system, etc.)
2. ✅ **Test both success and failure scenarios**
3. ✅ **Use descriptive test names** that explain what is being tested
4. ✅ **Keep tests isolated** - each test should be independent
5. ✅ **Clean up after tests** - use `afterEach()` to restore mocks
6. ✅ **Test edge cases** - timeouts, retries, rate limits, etc.
7. ✅ **Maintain high coverage** - aim for >80% across all metrics

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)