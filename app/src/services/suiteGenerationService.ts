import { generateImage } from '@/lib/api';
import type { SuiteGenerationResult, SuiteItemResult, SuiteTemplate } from '@/types/suite';
import { computeGroupGeneration } from '@/lib/generationContext';

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
  imageCount?: number;
  watermark?: boolean;
  signal?: AbortSignal;
}) {
  const group = computeGroupGeneration({
    requestedCount: params.imageCount ?? 1,
    referenceCount: params.referenceImages.length,
    modelId: params.model,
  });
  const response = await generateImage({
    prompt: params.prompt,
    image: toImageParam(params.referenceImages),
    model: params.model as any,
    size: params.size,
    watermark: params.watermark,
    sequential_image_generation: group.sequential_image_generation,
    sequential_image_generation_options:
      group.sequential_image_generation === 'auto' ? { max_images: group.maxImages } : undefined,
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
  template?: SuiteTemplate;
  templateId: string;
  templateName: string;
  globalPrompt: string;
  watermark?: boolean;
  referenceImages: string[];
  model: string;
  useFirstImageAsReference: boolean;
  concurrency?: number;
  items: Array<
    Omit<SuiteItemResult, 'status' | 'images' | 'error'> & {
      status?: SuiteItemResult['status'];
      images?: SuiteItemResult['images'];
      error?: SuiteItemResult['error'];
    }
  >;
  signal?: AbortSignal;
  onItemUpdate?: (itemId: string, patch: Partial<SuiteItemResult>) => void;
}) {
  const concurrency = Math.max(1, Math.min(4, params.concurrency ?? 2));

  const items: SuiteItemResult[] =
    params.items.length > 0
      ? params.items.map((it) => ({
          ...it,
          status: 'pending',
          images: undefined,
          error: undefined,
        }))
      : (params.template?.items ?? []).map((it) => ({
          id: it.id,
          name: it.name,
          prompt: joinPrompt(params.globalPrompt, it.promptSuffix),
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

    try {
      const item = items.find((x) => x.id === itemId);
      if (!item) return;

      const { images } = await generateSuiteItem({
        prompt: item.prompt,
        referenceImages: refImages,
        model: params.model,
        size: item.size,
        imageCount: item.imageCount,
        watermark: params.watermark,
        signal: params.signal,
      });

      if (!firstImageUrl && images[0]?.url) firstImageUrl = images[0].url;
      update(itemId, { status: 'success', images });
    } catch (err: any) {
      update(itemId, { status: 'failed', error: err?.message || '生成失败，请重试' });
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
    templateId: params.templateId,
    templateName: params.templateName,
    globalPrompt: params.globalPrompt,
    model: params.model,
    watermark: params.watermark,
    referenceImages: params.referenceImages,
    useFirstImageAsReference: params.useFirstImageAsReference,
    firstImageUrl,
    items,
  };

  return result;
}

