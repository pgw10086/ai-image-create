// 基础生成参数
export interface GenerateImageParams {
  prompt: string;
  image?: string | string[]; // Base64 或 URL
  size?: string; // e.g. "2048x2048"
  model?: string;
  watermark?: boolean;
  sequential_image_generation?: 'auto' | 'disabled';
  sequential_image_generation_options?: {
    max_images: number;
  };
  stream?: boolean;
  signal?: AbortSignal;
}

// API 响应结构
export interface GenerateImageResponse {
  code?: string;
  message?: string;
  data?: {
    url?: string;
    b64_json?: string;
    size?: string;
  }[];
  usage?: {
    generated_images: number;
    total_tokens: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Seedream API 请求结构 (内部使用)
export type SeedreamModel =
  | 'doubao-seedream-4-5-251128'
  | string;

export type ImageSize =
  | '2K'
  | '4K'
  | '2048x2048' // 1:1
  | '2304x1728' // 4:3
  | '1728x2304' // 3:4
  | '2560x1440' // 16:9
  | '1440x2560' // 9:16
  | '2496x1664' // 3:2
  | '1664x2496' // 2:3
  | '3024x1296' // 21:9
  | '1024x1024' // 3.0 Default
  | '1152x864'
  | '864x1152'
  | '1280x720'
  | '720x1280'
  | '1248x832'
  | '832x1248'
  | '1512x648'
  | string; 

export type SequentialImageGeneration = 'auto' | 'disabled';

export interface SequentialImageGenerationOptions {
  max_images?: number; // 1-15
}

export type ResponseFormat = 'url' | 'b64_json';

export interface OptimizePromptOptions {
  mode: 'standard' | 'fast';
}

export interface ImageGenerationRequest {
  model: SeedreamModel;
  prompt: string;
  image?: string | string[];
  size?: ImageSize;
  sequential_image_generation?: SequentialImageGeneration;
  sequential_image_generation_options?: SequentialImageGenerationOptions;
  stream?: boolean;
  watermark?: boolean;
  response_format?: ResponseFormat;
  optimize_prompt_options?: OptimizePromptOptions;
  seed?: number;
  guidance_scale?: number;
}

export const APIErrorCodes = {
  AUTH_FAILED: 'authentication_failed',
  QUOTA_EXCEEDED: 'quota_exceeded',
  CONTENT_POLICY_VIOLATION: 'content_policy_violation',
  INTERNAL_SERVER_ERROR: 'internal_server_error',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown_error',
} as const;

export type APIErrorCode = (typeof APIErrorCodes)[keyof typeof APIErrorCodes];
