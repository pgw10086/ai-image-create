import { generateImage } from '@/lib/api';
import type { SuiteGenerationResult, SuiteItemResult, SuiteTemplate } from '@/types/suite';

function joinPrompt(base: string, suffix: string) {
  const b = (base ?? '').trim();
  const s = (suffix ?? '').trim();
  if (!b) return s.replace(/^[,，]\s*/, '').trim();
  if (!s) return b;
  if (s.startsWith(',') || s.startsWith('，')) return `${b}${s}`;
  return `${b}, ${s}`;
}

function toImageParam(images: string[]) {
  if (images.length === 0) return undefined;
  if (images.length === 1) return images[0];
  return images;
}

export async function generateSuiteItem(params: {
  prompt: string;
  referenceImages: string[];
  model: string;
  size?: string;
  signal?: AbortSignal;
}) {
  const response = await generateImage({
    prompt: params.prompt,
    image: toImageParam(params.referenceImages),
    model: params.model as any,
    size: params.size,
    signal: params.signal,
  } as any);

  if (response.data && response.data.length > 0 && response.data[0].url) {
    const images = response.data
      .filter((d: any) => d?.url)
      .map((d: any) => ({ url: d.url, prompt: params.prompt }));
    return { images };
  }

  const errorMsg = response.error?.message || response.message || '生成失败，请重试';
  throw new Error(errorMsg);
}

export async function executeSuiteGeneration(params: {
  template: SuiteTemplate;
  globalPrompt: string;
  referenceImages: string[];
  model: string;
  size?: string;
  useFirstImageAsReference: boolean;
  concurrency?: number;
  promptsByItemId?: Record<string, string>;
  signal?: AbortSignal;
  deductCredits?: (amount: number) => boolean;
  refundCredits?: (amount: number) => void;
  onItemUpdate?: (itemId: string, patch: Partial<SuiteItemResult>) => void;
}) {
  const concurrency = Math.max(1, Math.min(4, params.concurrency ?? 2));
  const promptsByItemId = params.promptsByItemId ?? {};

  const items: SuiteItemResult[] = params.template.items.map((it) => ({
    id: it.id,
    name: it.name,
    prompt: promptsByItemId[it.id] ?? joinPrompt(params.globalPrompt, it.promptSuffix),
    status: 'pending',
  }));

  const update = (itemId: string, patch: Partial<SuiteItemResult>) => {
    const idx = items.findIndex((x) => x.id === itemId);
    if (idx >= 0) items[idx] = { ...items[idx], ...patch };
    params.onItemUpdate?.(itemId, patch);
  };

  let firstImageUrl: string | undefined;

  const runOne = async (itemId: string, refImages: string[]) => {
    if (params.signal?.aborted) return;

    update(itemId, { status: 'processing', error: undefined });

    if (params.deductCredits && !params.deductCredits(10)) {
      update(itemId, { status: 'failed', error: '算力不足，请充值' });
      return;
    }

    try {
      const item = items.find((x) => x.id === itemId);
      if (!item) return;

      const { images } = await generateSuiteItem({
        prompt: item.prompt,
        referenceImages: refImages,
        model: params.model,
        size: params.size,
        signal: params.signal,
      });

      if (!firstImageUrl && images[0]?.url) firstImageUrl = images[0].url;
      update(itemId, { status: 'success', images });
    } catch (err: any) {
      update(itemId, { status: 'failed', error: err?.message || '生成失败，请重试' });
      params.refundCredits?.(10);
    }
  };

  if (items[0]) {
    await runOne(items[0].id, params.referenceImages);
  }

  const rest = items.slice(1).map((x) => x.id);
  let cursor = 0;

  const worker = async () => {
    while (cursor < rest.length && !params.signal?.aborted) {
      const idx = cursor;
      cursor += 1;
      const itemId = rest[idx];
      const refImages =
        params.useFirstImageAsReference && firstImageUrl
          ? [firstImageUrl, ...params.referenceImages].slice(0, 14)
          : params.referenceImages;
      await runOne(itemId, refImages);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, rest.length) }, () => worker()));

  const result: SuiteGenerationResult = {
    templateId: params.template.id,
    templateName: params.template.name,
    globalPrompt: params.globalPrompt,
    model: params.model,
    size: params.size,
    referenceImages: params.referenceImages,
    useFirstImageAsReference: params.useFirstImageAsReference,
    firstImageUrl,
    items,
  };

  return result;
}

