import type {
  GenerateImageParams,
  GenerateImageResponse,
  ImageGenerationRequest,
} from '../types/api';
import { APIErrorCodes } from '../types/api';
import { normalizeImageSize } from './utils';
import { createMockImageDataUri } from './mockImage';

// Use environment variable for API Key
const API_KEY = import.meta.env.VITE_VOLC_API_KEY || '';
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const TIMEOUT_MS = 60000; // 60s timeout

/**
 * Calls the Seedream API to generate images.
 */
export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
  const {
    prompt,
    image,
    size = '2048x2048',
    model = 'doubao-seedream-4-5-251128',
    watermark = true,
    sequential_image_generation = 'disabled',
    sequential_image_generation_options,
    stream = false,
    signal,
  } = params;

  // Validate and normalize size based on model
  const normalizedSize = normalizeImageSize(size, model);

  const useMock = import.meta.env.VITE_USE_MOCK === 'true';
  if (useMock) {
    return generateMockImage({ ...params, size: normalizedSize });
  }
  if (!API_KEY) {
    return {
      code: 'missing_api_key',
      message: '未配置 VITE_VOLC_API_KEY，无法调用真实图片生成接口（已禁用 Mock）。',
    };
  }

  const requestBody: ImageGenerationRequest = {
    model,
    prompt,
    size: normalizedSize,
    sequential_image_generation,
    sequential_image_generation_options,
    stream,
    image,
    response_format: 'url',
    watermark,
  };

  try {
    const data = await fetchWithRetry(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    return data;
  } catch (error: any) {
    console.error('Generation failed:', error);
    return {
        code: error.code || APIErrorCodes.UNKNOWN,
        message: mapErrorMessage(error.message || 'Image generation failed'),
    };
  }
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 1): Promise<GenerateImageResponse> {
    let didTimeout = false;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            didTimeout = true;
            controller.abort();
        }, TIMEOUT_MS);

        const externalSignal = options.signal;
        if (externalSignal) {
            if (externalSignal.aborted) {
                controller.abort();
            } else {
                externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
            }
        }
        
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            // Handle 500 errors with retry
            if (response.status >= 500 && retries > 0) {
                console.warn(`Request failed with status ${response.status}, retrying...`);
                return fetchWithRetry(url, options, retries - 1);
            }
            
            const errorData = await response.json().catch(() => ({}));
            throw {
                code: errorData.error?.code || `HTTP_${response.status}`,
                message: errorData.error?.message || response.statusText
            };
        }

        return await response.json();
    } catch (error: any) {
        if (error.name === 'AbortError') {
             if (didTimeout) {
                throw { code: APIErrorCodes.TIMEOUT, message: 'Request timed out' };
             }
             throw { code: 'abort', message: 'Request aborted' };
        }
        throw error;
    }
}

function mapErrorMessage(originalMessage: string): string {
    const msg = originalMessage.toLowerCase();
    if (msg.includes('content_policy_violation')) return '内容包含违规信息，请修改后重试';
    if (msg.includes('rate limit')) return '请求过于频繁，请稍后再试';
    if (msg.includes('quota')) return '账户额度不足，请充值';
    if (msg.includes('timeout')) return '生成超时，请检查网络或重试';
    if (msg.includes('not found') || msg.includes('http_404') || msg.includes('404')) return '请求未找到（404）。常见原因：model/endpoint 不存在或未开通，或请求地址不正确。';
    return originalMessage;
}

// Mock implementation
async function generateMockImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
    const delay = new Promise<void>((resolve) => setTimeout(resolve, 1500));
    if (params.signal) {
        await Promise.race([
            delay,
            new Promise<void>((_, reject) => {
                if (params.signal?.aborted) reject(new DOMException('Aborted', 'AbortError'));
                params.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
                    once: true,
                });
            }),
        ]);
    } else {
        await delay;
    }
    
    const count = params.sequential_image_generation === 'auto' && params.sequential_image_generation_options?.max_images 
        ? params.sequential_image_generation_options.max_images 
        : 1;
    
    const data = [];
    for (let i = 0; i < count; i++) {
        const seed = `${(params.model ?? 'mock').slice(0, 16)}-${(params.size ?? '').toString()}-${i + 1}`;
        data.push({
            url: createMockImageDataUri({
                title: '演示模式（Mock）',
                subtitle: (params.prompt ?? '').slice(0, 40),
                size: params.size || '2048x2048',
                seed,
            }),
            size: params.size || '2048x2048'
        });
    }

    return {
        code: 'mock',
        message: !API_KEY
            ? '演示模式：未配置 VITE_VOLC_API_KEY，未请求真实 Seedream 接口。'
            : '演示模式：VITE_USE_MOCK=true，未请求真实 Seedream 接口。',
        data,
        usage: {
            generated_images: count,
            total_tokens: 100 * count
        }
    };
}
