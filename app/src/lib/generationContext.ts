import type { GenerationContext } from '@/store/appStore';
import { calculateOptimalSize } from '@/lib/utils';

export type ModelOption = {
  id: string;
  label: string;
  supportsGroupGeneration: boolean;
};

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'doubao-seedream-4-5-251128', label: '泰豪生图1.0', supportsGroupGeneration: true },
  { id: 'doubao-seedream-4.5', label: 'Seedream 4.5', supportsGroupGeneration: true },
  { id: 'doubao-seedream-4.0', label: 'Seedream 4.0', supportsGroupGeneration: true },
  { id: 'doubao-seedream-3.0-t2i', label: 'Seedream 3.0（文生图）', supportsGroupGeneration: false },
  { id: 'doubao-seededit-3.0-i2i', label: 'SeedEdit 3.0（图生图）', supportsGroupGeneration: false },
];

export const RATIO_OPTIONS: Array<{ id: string; label: string }> = [
  { id: '智能比例', label: '智能比例' },
  { id: '1:1', label: '1:1' },
  { id: '4:3', label: '4:3' },
  { id: '3:4', label: '3:4' },
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '3:2', label: '3:2' },
  { id: '2:3', label: '2:3' },
  { id: '21:9', label: '21:9' },
  { id: '1K', label: '1K' },
  { id: '2K', label: '2K' },
  { id: '4K', label: '4K' },
];

export const STYLE_PRESETS: Array<{ id: string; label: string; prompt: string }> = [
  { id: 'none', label: '无', prompt: '' },
  { id: 'studio', label: '棚拍质感', prompt: 'Premium studio product photography, softbox lighting, crisp details.' },
  { id: 'minimal', label: '极简留白', prompt: 'Minimal composition, clean background, lots of negative space.' },
  { id: 'lifestyle', label: '生活方式场景', prompt: 'Lifestyle scene, natural lighting, authentic environment.' },
  { id: 'flatlay', label: '平铺俯拍', prompt: 'Top-down flat lay composition, organized props, clean styling.' },
  { id: 'cinematic', label: '电影感', prompt: 'Cinematic lighting, shallow depth of field, dramatic contrast.' },
  { id: 'pastel', label: '柔和马卡龙', prompt: 'Soft pastel palette, gentle lighting, smooth gradients.' },
];

function sceneHint(scene?: string) {
  if (scene === 'detail') return 'Commercial product detail image. Clean composition with adequate negative space for potential copy.';
  if (scene === 'crossborder') return 'Cross-border e-commerce product photo. Clear subject, professional studio lighting.';
  if (scene === 'brand') return 'Brand key visual. Consistent lighting, premium studio look, cohesive palette.';
  return 'Single product hero shot. Professional studio lighting, sharp focus.';
}

function platformHint(platformId?: string) {
  if (platformId === 'amazon') {
    return 'Amazon compliant. Pure white background, product centered, realistic shadows, no extra text.';
  }
  if (!platformId) return '';
  return `Platform: ${platformId}.`;
}

function languageHint(language?: GenerationContext['language']) {
  if (language === 'en') return 'Use English descriptions.';
  if (language === 'zh') return '使用中文描述。';
  return '';
}

function allowTextHint(allowText: boolean, language?: GenerationContext['language']) {
  if (!allowText) return '';
  if (language === 'zh') return '包含清晰可读的中文文案，字形规范，避免乱码。';
  return 'Include clear readable English copy text; avoid garbled letters.';
}

function styleHint(stylePreset?: string) {
  const raw = (stylePreset ?? '').trim();
  if (!raw) return '';
  const matched = STYLE_PRESETS.find((s) => s.label === raw || s.id === raw);
  if (matched) return matched.prompt;
  return raw;
}

export function resolveModelId(model: string) {
  const trimmed = (model ?? '').trim();
  const opt = MODEL_OPTIONS.find((m) => m.id === trimmed || m.label === trimmed);
  if (opt) return opt.id;
  if (trimmed === '泰豪生图1.0') return 'doubao-seedream-4-5-251128';
  return trimmed || 'doubao-seedream-4-5-251128';
}

export function modelSupportsGroupGeneration(modelId: string) {
  const opt = MODEL_OPTIONS.find((m) => m.id === modelId);
  if (opt) return opt.supportsGroupGeneration;
  const m = (modelId ?? '').toLowerCase();
  return m.includes('seedream-4.5') || m.includes('seedream-4.0') || m.includes('seedream-4-5');
}

export function modelSupportsResolutionToken(modelId: string, token: '1K' | '2K' | '4K') {
  const m = (modelId ?? '').toLowerCase();
  if (token === '1K') return m.includes('seedream-4.0');
  if (token === '2K' || token === '4K') return m.includes('seedream-4.0') || m.includes('seedream-4.5') || m.includes('seedream-4-5');
  return false;
}

function pickClosestSizeByRatio(options: string[], aspectRatio: number) {
  const parsed = options
    .map((s) => {
      const [w, h] = s.split('x').map(Number);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
      return { s, w, h, r: w / h, area: w * h };
    })
    .filter(Boolean) as Array<{ s: string; w: number; h: number; r: number; area: number }>;

  if (parsed.length === 0) return options[0] ?? '1024x1024';
  let best = parsed[0];
  let bestScore = Math.abs(best.r - aspectRatio);
  for (const c of parsed) {
    const score = Math.abs(c.r - aspectRatio);
    if (score < bestScore) {
      best = c;
      bestScore = score;
      continue;
    }
    if (score === bestScore && c.area < best.area) {
      best = c;
    }
  }
  return best.s;
}

function pickSeedEditAdaptiveSize(aspectRatio: number) {
  const presets: Array<{ w: number; h: number }> = [
    { w: 512, h: 1536 },
    { w: 544, h: 1536 },
    { w: 576, h: 1536 },
    { w: 608, h: 1536 },
    { w: 640, h: 1536 },
    { w: 640, h: 1376 },
    { w: 672, h: 1312 },
    { w: 704, h: 1280 },
    { w: 736, h: 1312 },
    { w: 768, h: 1280 },
    { w: 768, h: 1216 },
    { w: 800, h: 1216 },
    { w: 832, h: 1248 },
    { w: 832, h: 1184 },
    { w: 832, h: 1152 },
    { w: 864, h: 1152 },
    { w: 896, h: 1152 },
    { w: 896, h: 1088 },
    { w: 928, h: 1088 },
    { w: 960, h: 1088 },
    { w: 992, h: 1088 },
    { w: 1024, h: 1088 },
    { w: 1024, h: 1056 },
    { w: 1024, h: 1024 },
    { w: 1056, h: 992 },
    { w: 1088, h: 992 },
    { w: 1120, h: 960 },
    { w: 1152, h: 928 },
    { w: 1152, h: 896 },
    { w: 1152, h: 864 },
    { w: 1184, h: 832 },
    { w: 1216, h: 832 },
    { w: 1248, h: 832 },
    { w: 1248, h: 800 },
    { w: 1248, h: 768 },
    { w: 1280, h: 768 },
    { w: 1280, h: 736 },
    { w: 1280, h: 704 },
    { w: 1312, h: 736 },
    { w: 1312, h: 704 },
    { w: 1312, h: 672 },
    { w: 1344, h: 672 },
    { w: 1376, h: 672 },
    { w: 1408, h: 672 },
    { w: 1408, h: 640 },
    { w: 1440, h: 640 },
    { w: 1472, h: 640 },
    { w: 1504, h: 640 },
    { w: 1536, h: 640 },
    { w: 1536, h: 608 },
    { w: 1536, h: 576 },
    { w: 1536, h: 544 },
    { w: 1536, h: 512 },
  ];

  let best = presets[0];
  let bestScore = Math.abs(best.w / best.h - aspectRatio);
  for (const p of presets) {
    const score = Math.abs(p.w / p.h - aspectRatio);
    if (score < bestScore) {
      best = p;
      bestScore = score;
      continue;
    }
    if (score === bestScore) {
      break;
    }
  }
  return `${best.w}x${best.h}`;
}

export function resolveSizeFromCanvasForModel(params: { canvasWidth: number; canvasHeight: number; modelId: string }) {
  const w = Math.max(1, Math.round(params.canvasWidth));
  const h = Math.max(1, Math.round(params.canvasHeight));
  const aspectRatio = w / h;
  const modelId = (params.modelId ?? '').trim();
  const m = modelId.toLowerCase();

  if (m.includes('seededit-3.0-i2i')) {
    const size = pickSeedEditAdaptiveSize(aspectRatio);
    return { size, hint: `Adaptive output size. Input sketch size: ${size}.` };
  }

  if (m.includes('seedream-3.0-t2i')) {
    const options = [
      '1024x1024',
      '1152x864',
      '864x1152',
      '1280x720',
      '720x1280',
      '1248x832',
      '832x1248',
      '1512x648',
    ];
    const size = pickClosestSizeByRatio(options, aspectRatio);
    return { size, hint: `Output size: ${size}. Aspect ratio based on canvas.` };
  }

  if (m.includes('seedream-4.0')) {
    const size = calculateOptimalSize(w, h, 921600);
    return { size, hint: `Output size: ${size}. Aspect ratio based on canvas.` };
  }

  if (m.includes('seedream-4.5') || m.includes('seedream-4-5')) {
    const size = calculateOptimalSize(w, h, 3686400);
    return { size, hint: `Output size: ${size}. Aspect ratio based on canvas.` };
  }

  const size = calculateOptimalSize(w, h, 3686400);
  return { size, hint: `Output size: ${size}. Aspect ratio based on canvas.` };
}

export function resolveSizeFromRatioMode(params: { ratioMode?: string; modelId?: string }) {
  const ratioMode = (params.ratioMode ?? '智能比例').trim();
  const modelId = (params.modelId ?? '').trim();
  const is45 = modelId.includes('4.5') || modelId.includes('4-5');
  const is40 = modelId.includes('4.0');
  const is30 = modelId.includes('3.0-t2i');
  const isEdit30 = modelId.includes('seededit-3.0-i2i');

  const map: Record<string, string> = {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '16:9': '2560x1440',
    '9:16': '1440x2560',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '21:9': '3024x1296',
  };

  const map30: Record<string, string> = {
    '1:1': '1024x1024',
    '4:3': '1152x864',
    '3:4': '864x1152',
    '16:9': '1280x720',
    '9:16': '720x1280',
    '3:2': '1248x832',
    '2:3': '832x1248',
    '21:9': '1512x648',
  };

  if (ratioMode === '1K' || ratioMode === '2K' || ratioMode === '4K') {
    if (isEdit30) return { size: undefined, hint: 'Use adaptive output size (image-to-image).' };
    if (is30) {
      const size = ratioMode === '4K' ? '2048x2048' : ratioMode === '2K' ? '2048x2048' : '1024x1024';
      return { size, hint: `Output size: ${size}.` };
    }
    if (ratioMode === '1K') {
      if (is40) return { size: '1K', hint: 'Resolution: 1K.' };
      return { size: '2K', hint: 'Resolution: 2K.' };
    }
    if (ratioMode === '4K') {
      if (is45 || is40) return { size: '4K', hint: 'Resolution: 4K.' };
      return { size: '2048x2048', hint: 'Output size: 2048x2048.' };
    }
    if (is45 || is40) return { size: '2K', hint: 'Resolution: 2K.' };
    return { size: '2048x2048', hint: 'Output size: 2048x2048.' };
  }

  if (ratioMode === '智能比例') {
    const size = isEdit30 ? undefined : is30 ? '1024x1024' : is40 || is45 ? '2K' : undefined;
    return { size, hint: 'Choose the best aspect ratio automatically for e-commerce.' };
  }

  if (isEdit30) return { size: undefined, hint: 'Use adaptive output size (image-to-image).' };

  if (is30) {
    const size = map30[ratioMode];
    if (size) return { size, hint: `Output size: ${size}. Aspect ratio ${ratioMode}.` };
  }

  const size = map[ratioMode];
  if (size) return { size, hint: `Output size: ${size}. Aspect ratio ${ratioMode}.` };

  if (is45 || is40) return { size: '2048x2048', hint: 'Output size: 2048x2048. Aspect ratio 1:1.' };
  return { size: undefined, hint: '' };
}

export function computeGroupGeneration(params: {
  requestedCount: number;
  referenceCount: number;
  modelId: string;
}) {
  const requestedCount = Math.max(1, Math.min(15, Math.floor(params.requestedCount || 1)));
  const maxByRule = Math.max(1, 15 - Math.max(0, params.referenceCount || 0));
  const maxImages = Math.min(requestedCount, maxByRule);

  if (requestedCount <= 1) {
    return { sequential_image_generation: 'disabled' as const, maxImages: 1 };
  }

  if (!modelSupportsGroupGeneration(params.modelId)) {
    return { sequential_image_generation: 'disabled' as const, maxImages: 1 };
  }

  return { sequential_image_generation: 'auto' as const, maxImages };
}

export function buildPromptWithContext(params: {
  basePrompt: string;
  context: GenerationContext;
  allowText: boolean;
  sizeHint?: string;
}) {
  const base = (params.basePrompt ?? '').trim();
  const parts = [
    base,
    sceneHint(params.context.scene),
    platformHint(params.context.platformId),
    styleHint(params.context.stylePreset),
    languageHint(params.context.language),
    allowTextHint(params.allowText, params.context.language),
    params.sizeHint ?? '',
  ].filter(Boolean);

  return parts.join(' ');
}
