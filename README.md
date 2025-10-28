# @mvsep/node

[![npm version](https://img.shields.io/npm/v/@mvsep/node.svg)](https://www.npmjs.com/package/@mvsep/node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node.js SDK for the [MVSEP](https://mvsep.com) AI Audio Separation API. Separate vocals, instruments, drums, bass, and more from audio tracks using state-of-the-art AI models.

## Features

- 🎵 **Multiple Separation Algorithms** - Access to 30+ high-quality separation models
- 🚀 **Easy to Use** - Simple, intuitive API with TypeScript support
- 🔄 **Automatic Polling** - Built-in job polling with progress callbacks
- 🛡️ **Robust Error Handling** - Comprehensive error types and retry logic
- 📦 **Zero Dependencies** - Uses native Node.js `fetch` API (Node 18+)
- ⚡ **Rate Limit Handling** - Automatic retry with exponential backoff
- 🔒 **Type Safe** - Full TypeScript definitions included
- 📊 **Progress Tracking** - Real-time status updates for long-running jobs

## Installation

```bash
npm install @mvsep/node
```

**Requirements:** Node.js 18.0.0 or higher

## Quick Start

```typescript
import { MVSEPClient } from '@mvsep/node';
import fs from 'fs';

// Initialize the client
const client = new MVSEPClient({
  apiToken: 'your-api-token-here'
});

// Separate audio with automatic polling
const result = await client.createAndWaitForSeparation({
  audiofile: fs.createReadStream('song.mp3'),
  sep_type: 25 // MDX23C algorithm
}, {
  onProgress: (status) => {
    console.log(`Status: ${status.status}`);
  }
});

// Download the separated stems
console.log('Separation complete!');
result.data.files.forEach(file => {
  console.log(`${file.stem}: ${file.url}`);
});
```

## Authentication

Get your API token from [mvsep.com](https://mvsep.com) after logging in:

```typescript
const client = new MVSEPClient({
  apiToken: 'your-api-token-here'
});
```

### Registration

```typescript
await client.register({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'SecurePassword123',
  password_confirmation: 'SecurePassword123'
});
```

### Login

```typescript
const response = await client.login({
  email: 'john@example.com',
  password: 'SecurePassword123'
});

console.log('API Token:', response.data.api_token);
```

## API Reference

### Configuration

```typescript
interface MVSEPConfig {
  apiToken: string;           // Required: Your API token
  baseURL?: string;          // Optional: API base URL (default: https://mvsep.com)
  timeout?: number;          // Optional: Request timeout in ms (default: 30000)
  maxRetries?: number;       // Optional: Max retry attempts (default: 3)
  retryDelay?: number;       // Optional: Initial retry delay in ms (default: 1000)
  debug?: boolean;           // Optional: Enable debug logging (default: false)
  customHeaders?: Record<string, string>; // Optional: Custom headers
}
```

### Audio Separation

#### Get Available Algorithms

```typescript
const algorithms = await client.getAlgorithms();

algorithms.forEach(algo => {
  console.log(`ID: ${algo.id}, Name: ${algo.name}`);
  console.log(`Price coefficient: ${algo.price_coefficient}`);
});
```

Popular algorithm IDs:
- `25` - MDX23C (vocals, instrumental)
- `21` - Demucs4 HT (vocals, drums, bass, other)
- `22` - Ensemble 8 models (vocals, bass, drums, other)
- `32` - Ensemble All-In (vocals, bass, drums, piano, guitar, lead/back vocals, other)

#### Create Separation Job

```typescript
import fs from 'fs';

const { hash } = await client.createSeparation({
  audiofile: fs.createReadStream('song.mp3'),
  sep_type: 25
});

console.log('Job created:', hash);
```

#### Check Separation Status

```typescript
const status = await client.getSeparation(hash);

console.log('Status:', status.status); // 'waiting', 'processing', or 'done'

if (status.status === 'done') {
  console.log('Files:', status.data.files);
}
```

#### Wait for Completion (Polling)

```typescript
const result = await client.waitForSeparation(hash, {
  interval: 5000,           // Poll every 5 seconds
  maxDuration: 1800000,     // Timeout after 30 minutes
  onProgress: (status) => {
    console.log(`Current status: ${status.status}`);
    
    if (status.data && 'queue_count' in status.data) {
      console.log(`Queue position: ${status.data.current_order}/${status.data.queue_count}`);
    }
  }
});

// Access results
result.data.files.forEach(file => {
  console.log(`Download ${file.stem}: ${file.url}`);
});
```

#### All-in-One Method

```typescript
const result = await client.createAndWaitForSeparation({
  audiofile: fs.createReadStream('song.mp3'),
  sep_type: 25
}, {
  onProgress: (status) => console.log(status.status)
});
```

#### File Upload Options

The SDK supports multiple file input formats:

```typescript
// From file stream
audiofile: fs.createReadStream('song.mp3')

// From buffer
audiofile: fs.readFileSync('song.mp3')

// With custom filename
audiofile: {
  value: fs.createReadStream('song.mp3'),
  options: {
    filename: 'my-song.mp3',
    contentType: 'audio/mpeg'
  }
}
```

### User Management

#### Get User Info

```typescript
const user = await client.getUser();

console.log('Premium:', user.premium_enabled);
console.log('Premium minutes:', user.premium_minutes);
console.log('Long filenames:', user.long_filenames_enabled);
```

#### Enable/Disable Premium

```typescript
await client.enablePremium();
await client.disablePremium();
```

#### Enable/Disable Long Filenames

```typescript
await client.enableLongFilenames();
await client.disableLongFilenames();
```

### Separation History

```typescript
const history = await client.getSeparationHistory({
  start: 0,
  limit: 10
});

history.forEach(item => {
  console.log(`${item.hash} - ${item.algorithm.name}`);
  console.log(`Credits: ${item.credits}, Status: ${item.job_exists}`);
});
```

### News & Information

```typescript
// Get latest news
const news = await client.getNews({
  lang: 'en',
  start: 0,
  limit: 5
});

// Get demo separations
const demos = await client.getDemo({
  start: 0,
  limit: 10
});
```

## Error Handling

The SDK provides comprehensive error types:

```typescript
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
} from '@mvsep/node';

try {
  const result = await client.createSeparation({
    audiofile: fs.createReadStream('song.mp3'),
    sep_type: 25
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API token');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded, retry after:', error.retryAfter);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof FileUploadError) {
    console.error('File upload failed:', error.message);
  } else if (error instanceof SeparationError) {
    console.error('Separation failed for hash:', error.hash);
  } else if (error instanceof APIError) {
    console.error(`API error ${error.status}:`, error.message);
  }
}
```

## Advanced Configuration

### Custom Retry Behavior

```typescript
const client = new MVSEPClient({
  apiToken: 'your-token',
  maxRetries: 5,              // Retry up to 5 times
  retryDelay: 2000,           // Start with 2 second delay
  timeout: 60000              // 60 second timeout
});
```

### Debug Mode

```typescript
const client = new MVSEPClient({
  apiToken: 'your-token',
  debug: true  // Enables request/response logging
});
```

### Custom Headers

```typescript
const client = new MVSEPClient({
  apiToken: 'your-token',
  customHeaders: {
    'X-Custom-Header': 'value'
  }
});
```

### Custom Base URL

```typescript
const client = new MVSEPClient({
  apiToken: 'your-token',
  baseURL: 'https://custom-mvsep-instance.com'
});
```

## Rate Limiting

The MVSEP API implements rate limiting:
- Standard users: 120 requests per minute
- Premium users: Higher limits (10 concurrent jobs)
- Non-premium: 1 concurrent job

The SDK automatically:
- Detects rate limit errors (429 status)
- Respects `Retry-After` headers
- Implements exponential backoff
- Retries failed requests automatically

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import {
  MVSEPClient,
  MVSEPConfig,
  Algorithm,
  SeparationResponse,
  SeparationStatus,
  User
} from '@mvsep/node';

const config: MVSEPConfig = {
  apiToken: 'your-token'
};

const client = new MVSEPClient(config);
```

## Examples

### Basic Vocal Separation

```typescript
import { MVSEPClient } from '@mvsep/node';
import fs from 'fs';

const client = new MVSEPClient({
  apiToken: process.env.MVSEP_API_TOKEN!
});

const result = await client.createAndWaitForSeparation({
  audiofile: fs.createReadStream('song.mp3'),
  sep_type: 25 // MDX23C
});

console.log('Vocals:', result.data.files.find(f => f.stem === 'vocals')?.url);
console.log('Instrumental:', result.data.files.find(f => f.stem === 'instrumental')?.url);
```

### Multi-Stem Separation

```typescript
const result = await client.createAndWaitForSeparation({
  audiofile: fs.createReadStream('song.mp3'),
  sep_type: 21 // Demucs4 HT (4 stems)
});

const stems = ['vocals', 'drums', 'bass', 'other'];
stems.forEach(stem => {
  const file = result.data.files.find(f => f.stem === stem);
  if (file) {
    console.log(`${stem}: ${file.url}`);
  }
});
```

### Batch Processing

```typescript
const songs = ['song1.mp3', 'song2.mp3', 'song3.mp3'];

const jobs = await Promise.all(
  songs.map(song =>
    client.createSeparation({
      audiofile: fs.createReadStream(song),
      sep_type: 25
    })
  )
);

console.log('All jobs created:', jobs.map(j => j.hash));

// Wait for all to complete
const results = await Promise.all(
  jobs.map(job =>
    client.waitForSeparation(job.hash, {
      onProgress: (status) => {
        console.log(`${job.hash}: ${status.status}`);
      }
    })
  )
);
```

### Download Separated Files

```typescript
import https from 'https';
import fs from 'fs';

async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const file = fs.createWriteStream(outputPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

const result = await client.createAndWaitForSeparation({
  audiofile: fs.createReadStream('song.mp3'),
  sep_type: 25
});

for (const file of result.data.files) {
  await downloadFile(file.url, `output_${file.stem}.mp3`);
  console.log(`Downloaded: ${file.stem}`);
}
```

## Webhooks

MVSEP supports webhooks for job completion notifications. Configure webhooks at [https://mvsep.com/webhooks](https://mvsep.com/webhooks).

## Rate Limits & Concurrency

- **Premium users**: 10 concurrent jobs
- **Non-premium users**: 1 concurrent job
- **API rate limit**: 120 requests per minute

Monitor rate limit headers:
- `X-RateLimit-Limit`: Total requests allowed
- `X-RateLimit-Remaining`: Remaining requests

## Testing

```bash
npm test
```

## Contributing

This is an SDK maintained by AI Audio Academy. Issues and pull requests are welcome.

## License

MIT License - see LICENSE file for details

## Support

- 📧 Email: support@mvsep.com
- 🌐 Website: [https://mvsep.com](https://mvsep.com)
- 📖 API Documentation: [https://mvsep.com/api](https://mvsep.com/api)
- 💬 Issues: [GitHub Issues](https://github.com/l4nos/mvsep-node-client/issues)

## Credits

- **Author**: AI Audio Academy
- **GitHub**: [AI Audio Academy](https://github.com/Audio-AI-Academy)
- **API Provider**: MVSEP - [https://mvsep.com](https://mvsep.com)

---

Made with ❤️ for the audio separation community