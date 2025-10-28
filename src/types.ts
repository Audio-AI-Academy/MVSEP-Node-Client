/**
 * MVSEP API TypeScript Definitions
 */

import { Readable } from 'stream';

// ============================================================================
// File Upload Types
// ============================================================================

/** File input for Node.js environment */
export type FileInput = Buffer | Readable | {
  value: Buffer | Readable;
  options?: {
    filename?: string;
    contentType?: string;
  };
};

// ============================================================================
// Configuration & Client Types
// ============================================================================

export interface MVSEPConfig {
  /** API token for authentication */
  apiToken: string;
  /** Base URL for the API (default: https://mvsep.com) */
  baseURL?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Custom headers to include in requests */
  customHeaders?: Record<string, string>;
}

export interface PollingOptions {
  /** Polling interval in milliseconds (default: 5000) */
  interval?: number;
  /** Maximum polling duration in milliseconds (default: 1800000 - 30 minutes) */
  maxDuration?: number;
  /** Callback function called on each poll */
  onProgress?: (status: SeparationStatus) => void;
}

// ============================================================================
// Algorithm Types
// ============================================================================

export interface Algorithm {
  id: number;
  name: string;
  algorithm_group_id: number;
  orientation: number;
  render_id: number;
  order_id: number;
  created_at: string;
  updated_at: string;
  additional_fields: string | null;
  price_coefficient: number;
  is_active: number;
  algorithm_fields: AlgorithmField[];
  algorithm_descriptions: AlgorithmDescription[];
}

export interface AlgorithmField {
  id: number;
  name: string;
  text: string;
  algorithm_id: number;
  options: string;
  created_at: string;
  updated_at: string;
  default_key: string | null;
  server_key: string;
}

export interface AlgorithmDescription {
  id: number;
  short_description: string;
  long_description: string;
  lang: string;
  algorithm_id: number;
  created_at: string;
  updated_at: string;
}

export interface AlgorithmGroup {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// User & Authentication Types
// ============================================================================

export interface User {
  name: string;
  email: string;
  api_token: string | null;
  created_at: string;
  updated_at: string;
  premium_minutes: number;
  premium_enabled: number;
  long_filenames_enabled: number;
}

export interface RegisterParams {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: User;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Separation Types
// ============================================================================

export interface SeparationCreateParams {
  /** Audio file to separate (Buffer, Stream, or FileInput) */
  audiofile: FileInput;
  /** Algorithm ID to use for separation */
  sep_type: number | string;
  /** Optional additional parameters for the algorithm */
  [key: string]: any;
}

export interface SeparationResponse {
  success: boolean;
  status: SeparationStatusType;
  data: SeparationData | QueueData;
}

export type SeparationStatusType = 'waiting' | 'processing' | 'done' | 'error';

export interface QueueData {
  queue_count: number;
  current_order: number;
}

export interface SeparationData {
  algorithm: string;
  algorithm_description: string;
  size: string;
  output_format: string;
  tags?: AudioTags;
  input_file: FileInfo;
  files: SeparatedFile[];
  date: string;
}

export interface SeparatedFile {
  url: string;
  size: string;
  download: string;
  stem?: string;
}

export interface FileInfo {
  url: string;
  size: string;
  download: string;
}

export interface AudioTags {
  audio?: {
    dataformat: string;
    channels: number;
    sample_rate: number;
    bitrate: number;
    channelmode: string;
    bitrate_mode: string;
    lossless: boolean;
    encoder_options: string;
    compression_ratio: number;
    streams: AudioStream[];
  };
  tags?: {
    id3v1?: Record<string, any>;
    id3v2?: Record<string, any>;
  };
}

export interface AudioStream {
  dataformat: string;
  channels: number;
  sample_rate: number;
  bitrate: number;
  channelmode: string;
  bitrate_mode: string;
  lossless: boolean;
  encoder_options: string;
  compression_ratio: number;
}

export interface SeparationStatus {
  hash: string;
  status: SeparationStatusType;
  data?: SeparationData | QueueData;
  progress?: number;
}

export interface SeparationHistoryItem {
  id: number;
  hash: string;
  created_at: string;
  updated_at: string;
  job_exists: boolean;
  credits: number;
  time_left: number;
  algorithm: Algorithm;
}

export interface SeparationHistoryParams {
  start?: number;
  limit?: number;
}

// ============================================================================
// News & Demo Types
// ============================================================================

export interface News {
  id: number;
  title: string;
  lang: string;
  text: string;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface NewsParams {
  lang?: string;
  start?: number;
  limit?: number;
}

export interface Demo {
  hash: string;
  date: string;
  input_audio: string;
  algorithm: Algorithm;
}

export interface DemoParams {
  start?: number;
  limit?: number;
}

// ============================================================================
// Quality Checker Types
// ============================================================================

export interface QualityCheckerAddParams {
  zipfile: FileInput;
  algo_name: string;
  main_text: string;
  dataset_type: string;
  ensemble: string;
  password: string;
}

export interface QualityCheckerAddResponse {
  success: boolean;
  data: {
    id: number;
    link: string;
  };
}

export interface QualityCheckerDeleteParams {
  id: string | number;
  password: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  status?: string;
}

export interface ErrorResponse {
  success: false;
  message: string | Record<string, string[]>;
  code?: string;
}

// ============================================================================
// Profile Types
// ============================================================================

export interface ProfileResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Webhook Types (for future use)
// ============================================================================

export interface WebhookPayload {
  hash: string;
  status: SeparationStatusType;
  data?: SeparationData;
  timestamp: string;
}