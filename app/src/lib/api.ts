import { GoogleGenAI } from '@google/genai';
import type {
  GenerateImageParams,
  GenerateImageResponse,
  ImageGenerationRequest,
} from '../types/api';
import { APIErrorCodes } from '../types/api';
import { normalizeImageSize } from './utils';
import { createMockImageDataUri } from './mockImage';
import { TAIHAO_PRO_MODEL_ID, isTaihaoProModel } from './generationContext';

const VOLC_API_KEY = import.meta.env.VITE_VOLC_API_KEY || '';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const VOLC_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const TIMEOUT_MS = 60000;

type ImageInlineData = {
  data: string;
  mimeType: string;
};

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!GOOGLE_API_KEY) return null;
  if (geminiClient) return geminiClient;
  geminiClient = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  return geminiClient;
}

function isGeminiModel(model: string) {
  const normalized = (model ?? '').trim();
  return normalized.includes('gemini-3-pro-image-preview') || normalized === '泰豪生图1.0-pro' || isTaihaoProModel(normalized);
}

function mapSizeToAspectRatio(size?: string) {
  if (!size) return '1:1';
  const trimmed = size.trim();

  const ratioMap: Record<string, string> = {
    '2048x2048': '1:1',
    '2304x1728': '4:3',
    '1728x2304': '3:4',
    '2560x1440': '16:9',
    '1440x2560': '9:16',
    '2496x1664': '3:2',
    '1664x2496': '2:3',
    '3024x1296': '21:9',
    '1024x1024': '1:1',
    '1152x864': '4:3',
    '864x1152': '3:4',
    '1280x720': '16:9',
    '720x1280': '9:16',
    '1248x832': '3:2',
    '832x1248': '2:3',
    '1512x648': '21:9',
  };

  if (ratioMap[trimmed]) return ratioMap[trimmed];

  if (/^\d+x\d+$/i.test(trimmed)) {
    const [w, h] = trimmed.split('x').map(Number);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return '1:1';

    const candidates = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
    const target = w / h;
    let best = candidates[0];
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const [cw, ch] = candidate.split(':').map(Number);
      const diff = Math.abs(cw / ch - target);
      if (diff < bestDiff) {
        best = candidate;
        bestDiff = diff;
      }
    }
    return best;
  }

  return '1:1';
}

function mapSizeToImageSize(size?: string): '1K' | '2K' | '4K' {
  if (!size) return '2K';
  const upper = size.trim().toUpperCase();
  if (upper === '1K' || upper === '2K' || upper === '4K') return upper;

  if (!/^\d+x\d+$/i.test(upper)) return '2K';
  const [w, h] = upper.split('X').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return '2K';

  const pixels = w * h;
  if (pixels >= 7000000) return '4K';
  if (pixels >= 2500000) return '2K';
  return '1K';
}

function isNormalizedSizeToken(size?: string) {
  const normalized = (size ?? '').trim().toUpperCase();
  return normalized === '1K' || normalized === '2K' || normalized === '4K';
}

function parseDataUrl(input: string): ImageInlineData | null {
  const match = input.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) return null;
  return {
    mimeType: match[1] || 'image/png',
    data: match[2],
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== 'string') {
        reject(new Error('Failed to encode image as base64'));
        return;
      }
      const parsed = parseDataUrl(value);
      if (!parsed?.data) {
        reject(new Error('Invalid image data after base64 encoding'));
        return;
      }
      resolve(parsed.data);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

async function toInlineData(input: string, signal?: AbortSignal): Promise<ImageInlineData> {
  const dataUrlParsed = parseDataUrl(input);
  if (dataUrlParsed) return dataUrlParsed;

  const response = await fetch(input, { signal });
  if (!response.ok) {
    throw new Error(`参考图下载失败（${response.status}）`);
  }
  const blob = await response.blob();
  const data = await blobToBase64(blob);
  return {
    data,
    mimeType: blob.type || 'image/png',
  };
}

function getRequestedImageCount(params: GenerateImageParams) {
  if (params.sequential_image_generation === 'auto') {
    return Math.max(1, Math.min(15, params.sequential_image_generation_options?.max_images || 1));
  }
  return 1;
}

function toDataUri(imageData: string, mimeType = 'image/png') {
  const value = (imageData ?? '').trim();
  if (!value) return '';
  if (value.startsWith('data:')) return value;
  return `data:${mimeType};base64,${value}`;
}

function normalizeSeedreamResponse(payload: any, fallbackSize?: string): GenerateImageResponse {
  const rawData = Array.isArray(payload?.data) ? payload.data : [];
  const data = rawData
    .map((item: any) => {
      if (typeof item?.url === 'string' && item.url.trim()) {
        return {
          url: item.url,
          size: item.size || fallbackSize,
        };
      }

      if (typeof item?.b64_json === 'string' && item.b64_json.trim()) {
        return {
          url: toDataUri(item.b64_json),
          size: item.size || fallbackSize,
        };
      }

      return null;
    })
    .filter(Boolean) as Array<{ url?: string; size?: string }>;

  if (data.length > 0) {
    return {
      ...payload,
      data,
    };
  }

  const embeddedError = rawData.find((item: any) => item?.error?.message)?.error;
  if (payload?.error || embeddedError) {
    const normalizedError = payload.error || embeddedError;
    return {
      ...payload,
      code: payload?.code || normalizedError?.code || APIErrorCodes.UNKNOWN,
      message: payload?.message || normalizedError?.message || '生成失败，请重试',
      error: {
        code: normalizedError?.code || APIErrorCodes.UNKNOWN,
        message: normalizedError?.message || payload?.message || '生成失败，请重试',
      },
      data: [],
    };
  }

  return {
    ...payload,
    data,
  };
}

function extractGeminiImages(payload: any, fallbackSize?: string) {
  const images: Array<{ url: string; size?: string }> = [];
  const seen = new Set<string>();

  const pushUrl = (url?: string, size?: string) => {
    const value = (url ?? '').trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    images.push({ url: value, size: size || fallbackSize });
  };

  const generatedImages = Array.isArray(payload?.generatedImages) ? payload.generatedImages : [];
  for (const item of generatedImages) {
    const image = item?.image;
    if (!image) continue;

    if (typeof image?.gcsUri === 'string' && image.gcsUri.trim()) {
      pushUrl(image.gcsUri, fallbackSize);
    }

    if (typeof image?.imageBytes === 'string' && image.imageBytes.trim()) {
      pushUrl(toDataUri(image.imageBytes, image.mimeType || 'image/png'), fallbackSize);
    }
  }

  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const inlineData = part?.inlineData || part?.inline_data;
      if (inlineData?.data) {
        pushUrl(toDataUri(inlineData.data, inlineData.mimeType || inlineData.mime_type || 'image/png'), fallbackSize);
      }

      const fileData = part?.fileData || part?.file_data;
      const fileUri = fileData?.fileUri || fileData?.file_uri;
      if (typeof fileUri === 'string' && fileUri.trim()) {
        pushUrl(fileUri, fallbackSize);
      }
    }
  }

  if (images.length === 0 && typeof payload?.data === 'string' && payload.data.trim()) {
    pushUrl(toDataUri(payload.data, 'image/png'), fallbackSize);
  }

  return images;
}

function waitForAbort(signal?: AbortSignal) {
  if (!signal) return null;
  return new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject({ code: 'abort', message: 'Request aborted' });
      return;
    }
    signal.addEventListener('abort', () => reject({ code: 'abort', message: 'Request aborted' }), { once: true });
  });
}

async function withTimeoutAndAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject({ code: APIErrorCodes.TIMEOUT, message: 'Request timed out' }), TIMEOUT_MS);
  });
  const abortPromise = waitForAbort(signal);

  try {
    return await Promise.race([promise, timeoutPromise, ...(abortPromise ? [abortPromise] : [])]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function generateByGemini(params: GenerateImageParams): Promise<GenerateImageResponse> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      code: 'missing_google_api_key',
      message: '未配置 VITE_GOOGLE_API_KEY，无法调用泰豪生图1.0-pro（Gemini）。',
    };
  }

  const normalizedSize = params.size ? normalizeImageSize(params.size, params.model ?? TAIHAO_PRO_MODEL_ID) : params.size;
  const aspectRatio = isNormalizedSizeToken(normalizedSize) ? undefined : mapSizeToAspectRatio(normalizedSize);
  const imageSize = mapSizeToImageSize(normalizedSize);
  const imageInputs = params.image ? (Array.isArray(params.image) ? params.image : [params.image]) : [];
  const requestedCount = getRequestedImageCount(params);

  try {
    const imageParts = await Promise.all(
      imageInputs.slice(0, 14).map(async (img) => {
        const inlineData = await toInlineData(img, params.signal);
        return { inlineData };
      })
    );

    const baseConfig: Record<string, any> = {
      imageConfig: {
        ...(aspectRatio ? { aspectRatio } : {}),
        imageSize,
      },
      responseModalities: ['IMAGE'],
    };
    const requestPayload = {
      model: TAIHAO_PRO_MODEL_ID,
      contents: [{ role: 'user', parts: [...imageParts, { text: params.prompt }] }] as any,
      config: baseConfig,
    } as any;

    const response: any = await withTimeoutAndAbort(ai.models.generateContent(requestPayload), params.signal);

    const allImages = extractGeminiImages(response, normalizedSize);
    const finalImages = allImages.slice(0, requestedCount);

    if (finalImages.length === 0) {
      const textFallback =
        (typeof response?.text === 'string' ? response.text : '') ||
        response?.candidates?.[0]?.content?.parts?.find?.((part: any) => part?.text)?.text;
      const message = textFallback || 'Gemini 未返回图像数据';
      return {
        code: APIErrorCodes.UNKNOWN,
        message,
      };
    }

    return {
      data: finalImages,
      usage: {
        generated_images: finalImages.length,
        total_tokens: Number(response?.usageMetadata?.totalTokenCount) || 0,
      },
    };
  } catch (error: any) {
    if (error?.code === 'abort') {
      return {
        code: 'abort',
        message: '请求已取消',
      };
    }

    const status = error?.status || error?.response?.status;
    const message = error?.message || error?.toString?.() || 'Gemini generation failed';

    if (status === 401 || message.toLowerCase().includes('api key')) {
      return { code: 'authentication_failed', message: 'Gemini API Key 无效或未授权。' };
    }
    if (status === 429 || message.toLowerCase().includes('rate')) {
      return { code: 'rate_limit', message: '请求过于频繁，请稍后再试。' };
    }
    if (message.toLowerCase().includes('safety')) {
      return { code: 'content_policy_violation', message: '内容触发安全策略，请调整提示词后重试。' };
    }
    if (error?.code === APIErrorCodes.TIMEOUT || message.toLowerCase().includes('timed out')) {
      return { code: APIErrorCodes.TIMEOUT, message: '生成超时，请稍后重试。' };
    }

    return {
      code: error?.code || APIErrorCodes.UNKNOWN,
      message: mapErrorMessage(message),
    };
  }
}

async function generateBySeedream(params: GenerateImageParams): Promise<GenerateImageResponse> {
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

  const normalizedSize = normalizeImageSize(size, model);

  if (!VOLC_API_KEY) {
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
    const data = await fetchWithRetry(VOLC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VOLC_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    return normalizeSeedreamResponse(data, normalizedSize);
  } catch (error: any) {
    console.error('Generation failed:', error);
    return {
      code: error.code || APIErrorCodes.UNKNOWN,
      message: mapErrorMessage(error.message || 'Image generation failed'),
    };
  }
}

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
  const useMock = import.meta.env.VITE_USE_MOCK === 'true';
  const model = params.model || 'doubao-seedream-4-5-251128';
  const normalizedSize = params.size ? normalizeImageSize(params.size, model) : params.size;

  if (useMock) {
    return generateMockImage({ ...params, size: normalizedSize });
  }

  if (isGeminiModel(model)) {
    return generateByGemini({
      ...params,
      model: TAIHAO_PRO_MODEL_ID,
      size: normalizedSize,
      sequential_image_generation: params.sequential_image_generation,
      sequential_image_generation_options: params.sequential_image_generation_options,
    });
  }

  return generateBySeedream({
    ...params,
    size: normalizedSize,
    model,
  });
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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status >= 500 && retries > 0) {
        console.warn(`Request failed with status ${response.status}, retrying...`);
        return fetchWithRetry(url, options, retries - 1);
      }

      const errorData = await response.json().catch(() => ({}));
      throw {
        code: errorData.error?.code || `HTTP_${response.status}`,
        message: errorData.error?.message || response.statusText,
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
  if (msg.includes('api key')) return 'API Key 无效或未配置，请检查配置';
  if (msg.includes('not found') || msg.includes('http_404') || msg.includes('404')) {
    return '请求未找到（404）。常见原因：model/endpoint 不存在或未开通，或请求地址不正确。';
  }
  return originalMessage;
}

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
      size: params.size || '2048x2048',
    });
  }

  return {
    code: 'mock',
    message: !VOLC_API_KEY && !GOOGLE_API_KEY
      ? '演示模式：未配置 API Key，未请求真实接口。'
      : '演示模式：VITE_USE_MOCK=true，未请求真实接口。',
    data,
    usage: {
      generated_images: count,
      total_tokens: 100 * count,
    },
  };
}
