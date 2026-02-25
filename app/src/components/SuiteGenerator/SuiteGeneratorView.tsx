import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, Loader2, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/appStore';
import type { GenerationTask } from '@/store/appStore';
import type { SuiteTemplate } from '@/types/suite';
import type { SuiteItemResult, SuiteShotDefinition } from '@/types/suite';
import { executeSuiteGeneration, generateSuiteItem } from '@/services/suiteGenerationService';
import { TemplateSelector } from './TemplateSelector';
import {
  buildPromptWithContext,
  hasGeminiApiKeyConfigured,
  isTaihaoProModel,
  MODEL_OPTIONS, resolveModelId,
  resolveSizeFromRatioMode, STYLE_PRESETS,
} from '@/lib/generationContext';
import { useImageUploadPicker } from '@/hooks/useImageUploadPicker';
import { getSuiteShotById } from '@/constants/suiteShots';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { normalizeImageSize } from '@/lib/utils';
import { PLATFORM_STANDARDS, getPlatformStandardById } from '@/constants/platformStandards';
import { suiteTemplates } from '@/constants/templates';
import { getSuitePresetById } from '@/constants/suitePresets';

function joinPrompt(base: string, suffix: string) {
  const b = (base ?? '').trim();
  const s = (suffix ?? '').trim();
  if (!b) return s.replace(/^[,，]\s*/, '').trim();
  if (!s) return b;
  if (s.startsWith(',') || s.startsWith('，')) return `${b}${s}`;
  return `${b}, ${s}`;
}

export function SuiteGeneratorView() {
  const {
    inputValue,
    setInputValue,
    uploadedImages,
    removeUploadedImage,
    addTask,
    updateTaskStatus,
    tasks,
    generationContext,
    activeTags,
    toggleTag,
    updateGenerationContext,
    suitePresetRequest,
  } = useAppStore();

  const [selectedTemplate, setSelectedTemplate] = useState<SuiteTemplate | null>(null);
  const [useFirstImageAsReference, setUseFirstImageAsReference] = useState(true);
  const [suiteItems, setSuiteItems] = useState<SuiteItemResult[]>([]);
  const [activeSuiteTaskId, setActiveSuiteTaskId] = useState<string | null>(null);
  const [newItemShotId, setNewItemShotId] = useState<string>('front');
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [usePlatformStandard, setUsePlatformStandard] = useState(true);
  const [customShots, setCustomShots] = useState<SuiteShotDefinition[]>([]);
  const [customShotDialogOpen, setCustomShotDialogOpen] = useState(false);
  const [customShotDraft, setCustomShotDraft] = useState<{
    name: string;
    description: string;
    promptSuffixZh: string;
    ratioMode: string;
    imageCount: number;
  }>({ name: '', description: '', promptSuffixZh: '', ratioMode: '1:1', imageCount: 1 });

  const isGenerating = tasks.some((t) => t.status === 'processing');
  const abortRef = useRef<AbortController | null>(null);
  const lastPresetAtRef = useRef<number>(0);
  const {
    fileInputRef,
    handleFileUpload,
    openPicker,
    isDragActive,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
  } = useImageUploadPicker();

  const templateAvailableShotIds = useMemo(() => {
    if (!selectedTemplate) return [];
    const fromTemplate = selectedTemplate.availableShotIds ?? [];
    if (fromTemplate.length > 0) return fromTemplate;
    const fromItems = (selectedTemplate.items ?? []).map((it) => it.id).filter(Boolean);
    return fromItems;
  }, [selectedTemplate]);

  const availableShots = useMemo(() => {
    const getShot = (id: string) => customShots.find((s) => s.id === id) ?? getSuiteShotById(id);
    const base = templateAvailableShotIds
      .map((id) => getShot(id))
      .filter(Boolean)
      .map((s) => s!);
    const extra = customShots.filter((s) => !base.some((b) => b.id === s.id));
    return [...base, ...extra];
  }, [customShots, templateAvailableShotIds]);

  const selectedShotIdSet = useMemo(() => {
    return new Set(suiteItems.map((it) => it.shotId).filter(Boolean) as string[]);
  }, [suiteItems]);

  const suiteContext = useMemo(
    () => ({
      ...generationContext,
      language: 'zh' as const,
      platformId: usePlatformStandard ? generationContext.platformId : '',
    }),
    [generationContext, usePlatformStandard]
  );

  const baseGlobal = useMemo(() => {
    return (inputValue.trim() || '商品摄影，专业电商风格').trim();
  }, [inputValue]);

  const allowText = useMemo(() => activeTags.includes('text'), [activeTags]);

  const ASPECT_RATIO_OPTIONS: Array<{ id: string; label: string }> = [
    { id: '智能比例', label: '智能比例' },
    { id: '1:1', label: '1:1' },
    { id: '4:3', label: '4:3' },
    { id: '3:4', label: '3:4' },
    { id: '16:9', label: '16:9' },
    { id: '9:16', label: '9:16' },
    { id: '3:2', label: '3:2' },
    { id: '2:3', label: '2:3' },
    { id: '21:9', label: '21:9' },
  ];

  const resolveResolutionOptions = (modelId: string) => {
    const m = (modelId ?? '').toLowerCase();
    if (m.includes('seedream-4.0')) return ['1K', '2K', '4K'] as const;
    if (m.includes('seedream-4.5') || m.includes('seedream-4-5')) return ['2K', '4K'] as const;
    return [] as const;
  };

  const recommendedPixelSizesByRatio = (ratioMode: string, modelId: string) => {
    const r = (ratioMode ?? '').trim() || '智能比例';
    if (r === '智能比例') return [];
    const is30 = modelId.includes('3.0-t2i');
    const map45: Record<string, string> = {
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
    const size = (is30 ? map30 : map45)[r];
    return size ? [size] : [];
  };

  const resolveSizeFromItemConfig = (params: {
    ratioMode: string;
    sizeMode?: SuiteItemResult['sizeMode'];
    sizeResolution?: SuiteItemResult['sizeResolution'];
    sizePx?: string;
    modelId: string;
  }) => {
    const ratioMode = (params.ratioMode ?? '智能比例').trim();
    const modelId = (params.modelId ?? '').trim();
    const resolutionOptions = resolveResolutionOptions(modelId);

    const defaultResolution = (resolutionOptions[0] ?? undefined) as SuiteItemResult['sizeResolution'] | undefined;
    const defaultPixel = recommendedPixelSizesByRatio(ratioMode, modelId)[0];

    if (params.sizeMode === 'resolution') {
      const desired = params.sizeResolution ?? defaultResolution;
      if (desired && (resolutionOptions as readonly string[]).includes(desired)) return desired;
      if (defaultResolution) return defaultResolution;
    }

    const rawPx = (params.sizePx ?? '').trim() || defaultPixel;
    if (rawPx) return normalizeImageSize(rawPx, modelId);

    const { size } = resolveSizeFromRatioMode({ ratioMode, modelId });
    return size;
  };

  const computeSizeHintZh = (params: { ratioMode: string; size?: string; sizeMode?: string }) => {
    const r = (params.ratioMode ?? '').trim() || '智能比例';
    const size = (params.size ?? '').trim();
    if (!size) return r === '智能比例' ? '画面比例：智能（由模型自动选择）。' : `画面比例：${r}。`;
    if (params.sizeMode === 'resolution') return `分辨率档位：${size}；画面比例：${r}。`;
    return `输出尺寸：${size}；画面比例：${r}。`;
  };

  const composeItemPrompt = (
    params: Pick<SuiteItemResult, 'promptBase' | 'ratioMode' | 'sizeMode' | 'sizeResolution' | 'sizePx'> & {
      modelId: string;
    }
  ) => {
    const size = resolveSizeFromItemConfig({
      ratioMode: params.ratioMode ?? '智能比例',
      sizeMode: params.sizeMode,
      sizeResolution: params.sizeResolution,
      sizePx: params.sizePx,
      modelId: params.modelId,
    });
    const sizeHint = computeSizeHintZh({ ratioMode: params.ratioMode ?? '智能比例', size, sizeMode: params.sizeMode });
    return buildPromptWithContext({
      basePrompt: (params.promptBase ?? '').trim(),
      context: suiteContext,
      allowText,
      sizeHint,
      includeSceneHint: false,
      includeStyleHint: false,
      includeLanguageHint: false,
      includeAllowTextHint: false,
      blockedFragments: [
        '符合亚马逊主图风格：纯白背景（RGB 255,255,255），主体居中且占画面 85% 以上，真实阴影，不要额外文字/水印/Logo/边框，不要不存在的配件。',
        '跨境电商商品图风格，主体清晰，棚拍质感，灯光专业。',
        '品牌模型',
        '使用中文描述。',
        '包含清晰可读的中文文案，字形规范，避免乱码。',
      ],
    });
  };

  const createItemFromShot = (shotId: string, overrides?: Partial<SuiteItemResult>) => {
    const shot = customShots.find((s) => s.id === shotId) ?? getSuiteShotById(shotId);
    const modelId = resolveModelId(generationContext.model);
    const ratioMode = overrides?.ratioMode ?? shot?.defaultRatioMode ?? '智能比例';
    const defaultSizeMode: SuiteItemResult['sizeMode'] = ratioMode === '智能比例' ? 'resolution' : 'pixels';
    const sizeMode = overrides?.sizeMode ?? defaultSizeMode;
    const sizeResolution =
      overrides?.sizeResolution ?? (sizeMode === 'resolution' ? (resolveResolutionOptions(modelId)[0] as any) : undefined);
    const sizePx = overrides?.sizePx ?? (sizeMode === 'pixels' ? recommendedPixelSizesByRatio(ratioMode, modelId)[0] : undefined);
    const size = overrides?.size ?? resolveSizeFromItemConfig({ ratioMode, sizeMode, sizeResolution, sizePx, modelId });
    const imageCount = overrides?.imageCount ?? shot?.defaultImageCount ?? 1;
    const promptBase = overrides?.promptBase ?? joinPrompt(baseGlobal, shot?.defaultPromptSuffixZh ?? '');
    const prompt = composeItemPrompt({
      promptBase,
      ratioMode,
      sizeMode,
      sizeResolution,
      sizePx,
      modelId,
    });
    const id =
      overrides?.id ??
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${shotId}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    return {
      id,
      shotId,
      name: overrides?.name ?? shot?.name ?? shotId,
      promptBase,
      prompt,
      ratioMode,
      sizeMode,
      sizeResolution,
      sizePx,
      size,
      imageCount,
      status: overrides?.status ?? 'pending',
      images: overrides?.images,
      error: overrides?.error,
    } satisfies SuiteItemResult;
  };

  useEffect(() => {
    if (!selectedTemplate) return;
    if (isGenerating) return;
    const modelId = resolveModelId(generationContext.model);
    setSuiteItems((prev) =>
      prev.map((it) => {
        const ratioMode = it.ratioMode ?? '智能比例';
        const sizeMode: SuiteItemResult['sizeMode'] = it.sizeMode ?? (ratioMode === '智能比例' ? 'resolution' : 'pixels');
        const sizeResolution = it.sizeResolution;
        const sizePx = it.sizePx;
        const size = resolveSizeFromItemConfig({ ratioMode, sizeMode, sizeResolution, sizePx, modelId });
        const prompt = composeItemPrompt({
          promptBase: it.promptBase ?? '',
          ratioMode,
          sizeMode,
          sizeResolution,
          sizePx,
          modelId,
        });
        return { ...it, sizeMode, sizeResolution, sizePx, size, prompt };
      })
    );
  }, [
    allowText,
    generationContext.model,
    generationContext.platformId,
    generationContext.scene,
    generationContext.stylePreset,
    isGenerating,
    selectedTemplate,
    usePlatformStandard,
  ]);

  useEffect(() => {
    const req = suitePresetRequest;
    if (!req) return;
    if (req.requestedAt <= lastPresetAtRef.current) return;
    lastPresetAtRef.current = req.requestedAt;

    const preset = getSuitePresetById(req.presetId);
    if (!preset) return;

    const tpl = suiteTemplates.find((t) => t.id === preset.templateId);
    if (!tpl) {
      toast.error('未找到对应套图模板');
      return;
    }

    setSelectedTemplate(tpl);
    setActiveSuiteTaskId(null);
    setUsePlatformStandard(true);
    setWatermarkEnabled(false);
    updateGenerationContext({
      scene: preset.scene,
      stylePreset: preset.stylePreset ?? undefined,
    });

    const nextGlobal = (inputValue.trim() || preset.defaultGlobalPrompt || '').trim();
    if (nextGlobal && nextGlobal !== inputValue.trim()) setInputValue(nextGlobal);

    const shotIds = (tpl.defaultShotIds?.length ? tpl.defaultShotIds : tpl.availableShotIds) ?? [];
    const modelId = resolveModelId(generationContext.model);
    const initial = shotIds.map((id) => {
      const item = createItemFromShot(id, { status: 'pending', promptBase: joinPrompt(nextGlobal, (customShots.find((s) => s.id === id) ?? getSuiteShotById(id))?.defaultPromptSuffixZh ?? '') });
      const promptBase = joinPrompt(item.promptBase ?? '', preset.promptAddonZh);
      const ratioMode = item.ratioMode ?? '智能比例';
      const sizeMode = item.sizeMode;
      const sizeResolution = item.sizeResolution;
      const sizePx = item.sizePx;
      const size = resolveSizeFromItemConfig({ ratioMode, sizeMode, sizeResolution, sizePx, modelId });
      const prompt = composeItemPrompt({ promptBase, ratioMode, sizeMode, sizeResolution, sizePx, modelId });
      return { ...item, promptBase, size, prompt };
    });

    setSuiteItems(initial);
    setNewItemShotId((tpl.availableShotIds?.[0] ?? shotIds[0] ?? 'front').toString());
    toast.success(`已应用「${preset.name}」预设`);
  }, [customShots, generationContext.model, inputValue, setInputValue, suitePresetRequest, updateGenerationContext]);

  const handleResetDerived = () => {
    const modelId = resolveModelId(generationContext.model);
    setSuiteItems((prev) =>
      prev.map((it) => {
        const shot = customShots.find((s) => s.id === (it.shotId ?? '')) ?? getSuiteShotById(it.shotId ?? '');
        const ratioMode = it.ratioMode ?? '智能比例';
        const sizeMode: SuiteItemResult['sizeMode'] = it.sizeMode ?? (ratioMode === '智能比例' ? 'resolution' : 'pixels');
        const sizeResolution =
          it.sizeResolution ?? (sizeMode === 'resolution' ? (resolveResolutionOptions(modelId)[0] as any) : undefined);
        const sizePx = it.sizePx ?? (sizeMode === 'pixels' ? recommendedPixelSizesByRatio(ratioMode, modelId)[0] : undefined);
        const size = resolveSizeFromItemConfig({ ratioMode, sizeMode, sizeResolution, sizePx, modelId });
        const promptBase = joinPrompt(baseGlobal, shot?.defaultPromptSuffixZh ?? '');
        const prompt = composeItemPrompt({ promptBase, ratioMode, sizeMode, sizeResolution, sizePx, modelId });
        return { ...it, name: shot?.name ?? it.name, promptBase, prompt, ratioMode, sizeMode, sizeResolution, sizePx, size };
      })
    );
    toast.success('已重新派生子项提示词');
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    toast.message('已停止未完成任务');
  };

  const syncSuiteToTask = (taskId: string, nextItems: SuiteItemResult[], firstImageUrl?: string) => {
    if (!selectedTemplate) return;
    updateTaskStatus(taskId, 'success', {
      suite: {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        globalPrompt: baseGlobal,
        model: resolveModelId(generationContext.model),
        watermark: watermarkEnabled,
        referenceImages: uploadedImages.map((img) => img.url),
        useFirstImageAsReference,
        firstImageUrl,
        items: nextItems,
      },
    });
  };

  const handleGenerateItem = async (itemId: string, mode: 'replace' | 'append') => {
    if (!selectedTemplate) return;
    if (!activeSuiteTaskId) return;
    const item = suiteItems.find((x) => x.id === itemId);
    if (!item) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setSuiteItems((prev) =>
      prev.map((p) => (p.id === itemId ? { ...p, status: 'processing', error: undefined } : p))
    );

    try {
      const modelId = resolveModelId(generationContext.model);
      if (isTaihaoProModel(modelId) && !hasGeminiApiKeyConfigured()) {
        toast.error('未配置 VITE_GOOGLE_API_KEY，无法使用泰豪生图1.0-pro');
        return;
      }
      const baseReferenceImages = uploadedImages.map((img) => img.url);
      const firstImageUrl = suiteItems[0]?.images?.[0]?.url;
      const refImages =
        useFirstImageAsReference && firstImageUrl
          ? [firstImageUrl, ...baseReferenceImages].slice(0, 14)
          : baseReferenceImages;

      const { images } = await generateSuiteItem({
        prompt: item.prompt,
        referenceImages: refImages,
        model: modelId,
        size: item.size,
        imageCount: item.imageCount,
        watermark: watermarkEnabled,
        signal: controller.signal,
      });

      const next = suiteItems.map((p) => {
        if (p.id !== itemId) return p;
        const merged = mode === 'append' ? ([...(p.images ?? []), ...images] as any) : images;
        return { ...p, status: 'success' as const, images: merged };
      });
      setSuiteItems(next);
      syncSuiteToTask(activeSuiteTaskId, next, suiteItems[0]?.images?.[0]?.url ?? images[0]?.url);
      toast.success(mode === 'append' ? '已追加生成' : '已生成完成');
    } catch (err: any) {
      const next = suiteItems.map((p) =>
        p.id === itemId ? { ...p, status: 'failed' as const, error: err?.message || '生成失败，请重试' } : p
      );
      setSuiteItems(next);
      syncSuiteToTask(activeSuiteTaskId, next, suiteItems[0]?.images?.[0]?.url);
      toast.error(err?.message || '生成失败，请重试');
    } finally {
      abortRef.current = null;
    }
  };

  const handleStart = async () => {
    if (!selectedTemplate) {
      toast.error('请选择套图模版');
      return;
    }
    if (!inputValue.trim() && uploadedImages.length === 0) {
      toast.error('请输入全局商品描述或上传参考图');
      return;
    }
    if (suiteItems.length === 0) {
      toast.error('请先选择需要生成的镜头类型');
      return;
    }

    const taskId = Date.now().toString();
    setActiveSuiteTaskId(taskId);

    const modelId = resolveModelId(generationContext.model);
    if (isTaihaoProModel(modelId) && !hasGeminiApiKeyConfigured()) {
      toast.error('未配置 VITE_GOOGLE_API_KEY，无法使用泰豪生图1.0-pro');
      return;
    }
    const globalPrompt = baseGlobal;

    const newTask: GenerationTask = {
      id: taskId,
      type: 'suite',
      status: 'processing',
      createdAt: Date.now(),
      input: {
        prompt: globalPrompt,
        referenceImages: uploadedImages.map((img) => img.url),
        model: modelId,
      },
    };

    const initialItems: SuiteItemResult[] = suiteItems.map((it) => ({
      ...it,
      status: 'pending',
      images: undefined,
      error: undefined,
    }));

    setSuiteItems(initialItems);
    addTask(newTask);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const suiteResult = await executeSuiteGeneration({
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        globalPrompt,
        watermark: watermarkEnabled,
        items: initialItems.map((it) => ({
          id: it.id,
          shotId: it.shotId,
          name: it.name,
          promptBase: it.promptBase,
          prompt: it.prompt,
          ratioMode: it.ratioMode,
          sizeMode: it.sizeMode,
          sizeResolution: it.sizeResolution,
          sizePx: it.sizePx,
          size: it.size,
          imageCount: it.imageCount,
        })),
        referenceImages: newTask.input.referenceImages,
        model: newTask.input.model,
        useFirstImageAsReference,
        concurrency: 2,
        signal: controller.signal,
        onItemUpdate: (itemId, patch) => {
          setSuiteItems((prev) => prev.map((p) => (p.id === itemId ? { ...p, ...patch } : p)));
        },
      });

      const normalizedItems = suiteResult.items.map((it) => {
        if (controller.signal.aborted && it.status === 'pending') {
          return { ...it, status: 'failed' as const, error: '已停止' };
        }
        return it;
      });

      updateTaskStatus(taskId, 'success', { suite: { ...suiteResult, items: normalizedItems } });
      setSuiteItems(normalizedItems);

      const successCount = normalizedItems.filter((i) => i.status === 'success').length;
      if (controller.signal.aborted) {
        toast.message('已停止套图生成');
      } else if (successCount === normalizedItems.length) {
        toast.success('套图生成完成！');
      } else {
        toast.message('套图生成完成（部分失败，可重试）');
      }
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
      {!selectedTemplate ? (
        <TemplateSelector
          selectedTemplateId={null}
          onSelect={(tpl) => {
            setSelectedTemplate(tpl);
            const shotIds = (tpl.defaultShotIds?.length ? tpl.defaultShotIds : tpl.availableShotIds) ?? [];
            const initial = shotIds.map((id) => createItemFromShot(id, { status: 'pending' }));
            setSuiteItems(initial);
            setActiveSuiteTaskId(null);
            setNewItemShotId((tpl.availableShotIds?.[0] ?? shotIds[0] ?? 'front').toString());
          }}
        />
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 text-sm font-medium border border-violet-500/30">
                {selectedTemplate.name}
              </span>
              <span className="text-white/50 text-sm">{selectedTemplate.description}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedTemplate(null);
                  setSuiteItems([]);
                  setActiveSuiteTaskId(null);
                }}
                disabled={isGenerating}
              >
                返回选择
              </Button>
              <Button type="button" variant="outline" onClick={handleResetDerived} disabled={isGenerating}>
                <RotateCcw className="w-4 h-4" />
                重新派生
              </Button>
            </div>
          </div>

          {uploadedImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {uploadedImages.map((img) => (
                <div key={img.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/20">
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeUploadedImage(img.id)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:bg-black/80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            multiple
            className="hidden"
          />

          <Card
            className={`border-white/10 bg-card/60 transition-colors ${isDragActive ? 'border-violet-400/70 bg-violet-500/10' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onPaste={handlePaste}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">全局商品描述</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={openPicker}
                  disabled={isGenerating}
                >
                  <Plus className="w-4 h-4" />
                  上传参考图
                </Button>
                <div className="flex-1">
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="请输入产品名、卖点和场景；如：无线耳机，主动降噪，地铁上使用"
                    className="min-h-20"
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-white/10 p-3 bg-black/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-white/50">模型</div>
                    <Select
                      value={(generationContext.model ?? MODEL_OPTIONS[0]?.label ?? '').toString()}
                      onValueChange={(modelLabel) => {
                        if (isGenerating) return;
                        updateGenerationContext({ model: modelLabel });
                      }}
                    >
                      <SelectTrigger className="w-full" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODEL_OPTIONS.map((m) => (
                          <SelectItem key={m.id} value={m.label}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-white/50">参考风格</div>
                    <Select
                      value={(generationContext.stylePreset ?? '无').toString()}
                      onValueChange={(label) => {
                        if (isGenerating) return;
                        updateGenerationContext({ stylePreset: label === '无' ? undefined : label });
                      }}
                    >
                      <SelectTrigger className="w-full" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLE_PRESETS.map((s) => (
                          <SelectItem key={s.id} value={s.label}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-white/50">图片内文字</div>
                    <div className="flex items-center justify-between rounded-md border border-white/10 px-3 h-9 bg-black/20">
                      <div className="text-sm text-white/80">有文本</div>
                      <Switch
                        checked={activeTags.includes('text')}
                        onCheckedChange={(v) => {
                          if (isGenerating) return;
                          const std = usePlatformStandard ? getPlatformStandardById(generationContext.platformId) : undefined;
                          if (v && std?.disallowTextInImage) {
                            toast.error('所选平台标准不允许图片出现文字');
                            return;
                          }
                          toggleTag('text');
                        }}
                        disabled={isGenerating || (usePlatformStandard && Boolean(getPlatformStandardById(generationContext.platformId)?.disallowTextInImage))}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1 md:col-span-1">
                    <div className="text-xs text-white/50">上架标准（可选）</div>
                    <Select
                      value={(generationContext.platformId ?? 'amazon').toString()}
                      onValueChange={(platformId) => {
                        if (isGenerating) return;
                        updateGenerationContext({ platformId });
                        const std = getPlatformStandardById(platformId);
                        if (std?.disallowWatermark) setWatermarkEnabled(false);
                        if (std?.disallowTextInImage && activeTags.includes('text')) toggleTag('text');
                      }}
                    >
                      <SelectTrigger className="w-full" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORM_STANDARDS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-white/10 px-3 h-9 bg-black/20 md:col-span-1">
                    <div className="text-sm text-white/80">启用平台规则</div>
                    <Switch
                      checked={usePlatformStandard}
                      onCheckedChange={(v) => setUsePlatformStandard(Boolean(v))}
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-white/10 px-3 h-9 bg-black/20 md:col-span-1">
                    <div className="text-sm text-white/80">添加水印</div>
                    <Switch
                      checked={watermarkEnabled}
                      onCheckedChange={(v) => setWatermarkEnabled(Boolean(v))}
                      disabled={
                        isGenerating ||
                        (usePlatformStandard && Boolean(getPlatformStandardById(generationContext.platformId)?.disallowWatermark))
                      }
                    />
                  </div>
                </div>

                {usePlatformStandard && (
                  <div className="mt-2 text-xs text-white/50">
                    {getPlatformStandardById(generationContext.platformId)?.promptHintZh ?? '已启用平台规则提示。'}
                  </div>
                )}
                {usePlatformStandard && getPlatformStandardById(generationContext.platformId)?.disallowTextInImage && (
                  <div className="mt-1 text-xs text-amber-300">
                    该平台通常不允许图片内出现文字；建议关闭“有文本”，并在提示词中避免文案需求。
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={useFirstImageAsReference}
                    onCheckedChange={(v) => setUseFirstImageAsReference(Boolean(v))}
                    disabled={isGenerating}
                  />
                  <div>
                    <div className="text-sm text-white/80">首图参考一致性</div>
                    <div className="text-xs text-white/50">先生成第一张作为后续参考，提高主体一致性</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isGenerating ? (
                    <Button type="button" variant="destructive" onClick={handleStop}>
                      停止
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleStart}>
                      <Send className="w-4 h-4" />
                      开始生成
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">镜头类型</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableShots.map((shot) => {
                  const checked = selectedShotIdSet.has(shot.id);
                  return (
                    <button
                      key={shot.id}
                      type="button"
                      className="text-left rounded-lg border border-white/10 p-3 hover:bg-white/5 transition-colors"
                      onClick={() => {
                        if (isGenerating) return;
                        if (checked) {
                          setSuiteItems((prev) => prev.filter((it) => it.shotId !== shot.id));
                          return;
                        }
                        setSuiteItems((prev) => [...prev, createItemFromShot(shot.id, { status: 'pending' })]);
                      }}
                      disabled={isGenerating}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors ${
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input bg-background'
                          }`}
                        >
                          {checked ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-white tracking-wide">{shot.name}</div>
                          {shot.description && <div className="text-xs text-white/50 mt-1">{shot.description}</div>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 pt-3">
                <Select value={newItemShotId} onValueChange={setNewItemShotId}>
                  <SelectTrigger className="w-[220px]" size="sm">
                    <SelectValue placeholder="选择要新增的镜头类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableShots.map((shot) => (
                      <SelectItem key={shot.id} value={shot.id}>
                        {shot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating}
                  onClick={() => setSuiteItems((prev) => [...prev, createItemFromShot(newItemShotId, { status: 'pending' })])}
                >
                  <Plus className="w-4 h-4" />
                  新增一项
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating}
                  onClick={() => {
                    setCustomShotDraft({ name: '', description: '', promptSuffixZh: '', ratioMode: '1:1', imageCount: 1 });
                    setCustomShotDialogOpen(true);
                  }}
                >
                  自定义镜头
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">子项配置与结果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {suiteItems.length === 0 ? (
                <div className="text-sm text-white/50">请先在上方选择至少一个镜头类型。</div>
              ) : (
                suiteItems.map((it, idx) => {
                  const status = it.status;
                  const hasImages = (it.images?.length ?? 0) > 0;
                  return (
                    <div key={it.id} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                      <div className="flex items-start justify-between gap-3 -mx-3 -mt-3 px-3 py-2.5 bg-gradient-to-r from-violet-500/25 via-sky-500/10 to-transparent border-b border-white/10">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/30 bg-white/10 px-1.5 text-[10px] font-bold text-white/90">
                              {(idx + 1).toString().padStart(2, '0')}
                            </span>
                            <div className="text-sm md:text-[15px] font-black text-white tracking-wide">{it.name}</div>
                            {status === 'processing' && (
                              <span className="text-xs text-violet-300 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                生成中
                              </span>
                            )}
                            {status === 'failed' && <span className="text-xs text-red-400">失败</span>}
                            {status === 'success' && <span className="text-xs text-emerald-400">成功</span>}
                            {hasImages && <span className="text-xs text-white/50">共 {(it.images?.length ?? 0).toString()} 张</span>}
                          </div>
                          {it.error && <div className="mt-1 text-xs text-red-400">{it.error}</div>}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={isGenerating || idx === 0}
                            onClick={() =>
                              setSuiteItems((prev) => {
                                const next = [...prev];
                                const tmp = next[idx - 1];
                                next[idx - 1] = next[idx];
                                next[idx] = tmp;
                                return next;
                              })
                            }
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={isGenerating || idx === suiteItems.length - 1}
                            onClick={() =>
                              setSuiteItems((prev) => {
                                const next = [...prev];
                                const tmp = next[idx + 1];
                                next[idx + 1] = next[idx];
                                next[idx] = tmp;
                                return next;
                              })
                            }
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={isGenerating}
                            onClick={() => setSuiteItems((prev) => prev.filter((x) => x.id !== it.id))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <div className="text-xs text-white/50">镜头类型</div>
                          <Select
                            value={(it.shotId ?? 'front').toString()}
                            onValueChange={(shotId) => {
                              if (isGenerating) return;
                              setSuiteItems((prev) =>
                                prev.map((p) => {
                                  if (p.id !== it.id) return p;
                                  const next = createItemFromShot(shotId, {
                                    id: p.id,
                                    ratioMode: p.ratioMode,
                                    imageCount: p.imageCount,
                                    status: p.status,
                                    images: p.images,
                                    error: p.error,
                                  });
                                  return next;
                                })
                              );
                            }}
                          >
                            <SelectTrigger className="w-full" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableShots.map((shot) => (
                                <SelectItem key={shot.id} value={shot.id}>
                                  {shot.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs text-white/50">画面比例</div>
                          <Select
                            value={(it.ratioMode ?? '智能比例').toString()}
                            onValueChange={(ratioMode) => {
                              if (isGenerating) return;
                              const modelId = resolveModelId(generationContext.model);
                              setSuiteItems((prev) =>
                                prev.map((p) => {
                                  if (p.id !== it.id) return p;
                                  const sizeMode: SuiteItemResult['sizeMode'] = ratioMode === '智能比例' ? 'resolution' : 'pixels';
                                  const sizeResolution =
                                    sizeMode === 'resolution' ? (resolveResolutionOptions(modelId)[0] as any) : undefined;
                                  const sizePx =
                                    sizeMode === 'pixels' ? recommendedPixelSizesByRatio(ratioMode, modelId)[0] : undefined;
                                  const size = resolveSizeFromItemConfig({ ratioMode, sizeMode, sizeResolution, sizePx, modelId });
                                  const prompt = composeItemPrompt({
                                    promptBase: p.promptBase ?? '',
                                    ratioMode,
                                    sizeMode,
                                    sizeResolution,
                                    sizePx,
                                    modelId,
                                  });
                                  return { ...p, ratioMode, sizeMode, sizeResolution, sizePx, size, prompt };
                                })
                              );
                            }}
                          >
                            <SelectTrigger className="w-full" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASPECT_RATIO_OPTIONS.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs text-white/50">生图张数</div>
                          <Select
                            value={String(it.imageCount ?? 1)}
                            onValueChange={(v) => {
                              if (isGenerating) return;
                              const imageCount = Math.max(1, Math.min(15, Number(v) || 1));
                              setSuiteItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, imageCount } : p)));
                            }}
                          >
                            <SelectTrigger className="w-full" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 6, 8].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n} 张
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <div className="text-xs text-white/50">输出尺寸模式</div>
                          <Select
                            value={(it.sizeMode ?? (it.ratioMode === '智能比例' ? 'resolution' : 'pixels')).toString()}
                            onValueChange={(nextMode) => {
                              if (isGenerating) return;
                              const modelId = resolveModelId(generationContext.model);
                              setSuiteItems((prev) =>
                                prev.map((p) => {
                                  if (p.id !== it.id) return p;
                                  const sizeMode = nextMode as SuiteItemResult['sizeMode'];
                                  const ratioMode = p.ratioMode ?? '智能比例';
                                  const sizeResolution =
                                    sizeMode === 'resolution' ? (resolveResolutionOptions(modelId)[0] as any) : undefined;
                                  const sizePx =
                                    sizeMode === 'pixels' ? (p.sizePx ?? recommendedPixelSizesByRatio(ratioMode, modelId)[0]) : undefined;
                                  const size = resolveSizeFromItemConfig({ ratioMode, sizeMode, sizeResolution, sizePx, modelId });
                                  const prompt = composeItemPrompt({
                                    promptBase: p.promptBase ?? '',
                                    ratioMode,
                                    sizeMode,
                                    sizeResolution,
                                    sizePx,
                                    modelId,
                                  });
                                  return { ...p, sizeMode, sizeResolution, sizePx, size, prompt };
                                })
                              );
                            }}
                          >
                            <SelectTrigger className="w-full" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {resolveResolutionOptions(resolveModelId(generationContext.model)).length > 0 && (
                                <SelectItem value="resolution">分辨率档位（1K/2K/4K）</SelectItem>
                              )}
                              <SelectItem value="pixels">自定义像素（宽x高）</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <div className="text-xs text-white/50">输出尺寸</div>
                          {(it.sizeMode ?? (it.ratioMode === '智能比例' ? 'resolution' : 'pixels')) === 'resolution' ? (
                            <Select
                              value={(it.sizeResolution ?? resolveResolutionOptions(resolveModelId(generationContext.model))[0] ?? '2K').toString()}
                              onValueChange={(sizeResolution) => {
                                if (isGenerating) return;
                                const modelId = resolveModelId(generationContext.model);
                                setSuiteItems((prev) =>
                                  prev.map((p) => {
                                    if (p.id !== it.id) return p;
                                    const ratioMode = p.ratioMode ?? '智能比例';
                                    const sizeMode: SuiteItemResult['sizeMode'] = 'resolution';
                                    const size = resolveSizeFromItemConfig({
                                      ratioMode,
                                      sizeMode,
                                      sizeResolution: sizeResolution as any,
                                      sizePx: undefined,
                                      modelId,
                                    });
                                    const prompt = composeItemPrompt({
                                      promptBase: p.promptBase ?? '',
                                      ratioMode,
                                      sizeMode,
                                      sizeResolution: sizeResolution as any,
                                      sizePx: undefined,
                                      modelId,
                                    });
                                    return { ...p, sizeMode, sizeResolution: sizeResolution as any, sizePx: undefined, size, prompt };
                                  })
                                );
                              }}
                            >
                              <SelectTrigger className="w-full" size="sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {resolveResolutionOptions(resolveModelId(generationContext.model)).map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {recommendedPixelSizesByRatio(it.ratioMode ?? '智能比例', resolveModelId(generationContext.model)).length > 0 && (
                                <Select
                                  value={
                                    (it.sizePx ??
                                      recommendedPixelSizesByRatio(it.ratioMode ?? '智能比例', resolveModelId(generationContext.model))[0] ??
                                      '').toString()
                                  }
                                  onValueChange={(sizePx) => {
                                    if (isGenerating) return;
                                    const modelId = resolveModelId(generationContext.model);
                                    setSuiteItems((prev) =>
                                      prev.map((p) => {
                                        if (p.id !== it.id) return p;
                                        const ratioMode = p.ratioMode ?? '智能比例';
                                        const sizeMode: SuiteItemResult['sizeMode'] = 'pixels';
                                        const size = resolveSizeFromItemConfig({ ratioMode, sizeMode, sizePx, modelId });
                                        const prompt = composeItemPrompt({
                                          promptBase: p.promptBase ?? '',
                                          ratioMode,
                                          sizeMode,
                                          sizePx,
                                          modelId,
                                        });
                                        return { ...p, sizeMode, sizePx, sizeResolution: undefined, size, prompt };
                                      })
                                    );
                                  }}
                                >
                                  <SelectTrigger className="w-full" size="sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {recommendedPixelSizesByRatio(it.ratioMode ?? '智能比例', resolveModelId(generationContext.model)).map(
                                      (s) => (
                                        <SelectItem key={s} value={s}>
                                          推荐：{s}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                              )}

                              <div className="flex items-center gap-2">
                                <Input
                                  value={(it.sizePx ?? '').toString()}
                                  placeholder="例如 2304x1728"
                                  disabled={isGenerating}
                                  onChange={(e) => {
                                    const sizePx = e.target.value;
                                    const modelId = resolveModelId(generationContext.model);
                                    const ratioMode = it.ratioMode ?? '智能比例';
                                    const sizeMode: SuiteItemResult['sizeMode'] = 'pixels';
                                    const size = resolveSizeFromItemConfig({ ratioMode, sizeMode, sizePx, modelId });
                                    const prompt = composeItemPrompt({
                                      promptBase: it.promptBase ?? '',
                                      ratioMode,
                                      sizeMode,
                                      sizePx,
                                      modelId,
                                    });
                                    setSuiteItems((prev) =>
                                      prev.map((p) =>
                                        p.id === it.id ? { ...p, sizeMode, sizePx, sizeResolution: undefined, size, prompt } : p
                                      )
                                    );
                                  }}
                                  onBlur={() => {
                                    const raw = (it.sizePx ?? '').trim();
                                    if (!raw) return;
                                    const modelId = resolveModelId(generationContext.model);
                                    const normalized = normalizeImageSize(raw, modelId);
                                    if (normalized === raw) return;
                                    const ratioMode = it.ratioMode ?? '智能比例';
                                    const sizeMode: SuiteItemResult['sizeMode'] = 'pixels';
                                    const size = resolveSizeFromItemConfig({ ratioMode, sizeMode, sizePx: normalized, modelId });
                                    const prompt = composeItemPrompt({
                                      promptBase: it.promptBase ?? '',
                                      ratioMode,
                                      sizeMode,
                                      sizePx: normalized,
                                      modelId,
                                    });
                                    setSuiteItems((prev) =>
                                      prev.map((p) =>
                                        p.id === it.id
                                          ? { ...p, sizeMode, sizePx: normalized, sizeResolution: undefined, size, prompt }
                                          : p
                                      )
                                    );
                                  }}
                                />
                                <div className="text-xs text-white/40 flex-shrink-0">将自动修正不满足最小像素的输入</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-white/50">子项提示词（中文，可编辑）</div>
                        <Textarea
                          value={it.promptBase ?? ''}
                          onChange={(e) => {
                            const nextBase = e.target.value;
                            const modelId = resolveModelId(generationContext.model);
                            const ratioMode = it.ratioMode ?? '智能比例';
                            const sizeMode = it.sizeMode;
                            const sizeResolution = it.sizeResolution;
                            const sizePx = it.sizePx;
                            const nextPrompt = composeItemPrompt({
                              promptBase: nextBase,
                              ratioMode,
                              sizeMode,
                              sizeResolution,
                              sizePx,
                              modelId,
                            });
                            const size = resolveSizeFromItemConfig({ ratioMode, sizeMode, sizeResolution, sizePx, modelId });
                            setSuiteItems((prev) =>
                              prev.map((p) =>
                                p.id === it.id ? { ...p, promptBase: nextBase, prompt: nextPrompt, size } : p
                              )
                            );
                          }}
                          className="min-h-16"
                          disabled={isGenerating}
                        />
                        <div className="text-xs text-white/40 break-words">最终提交：{it.prompt}</div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/10 pt-3">
                        <div className="text-xs text-white/50">
                          {it.size ? `输出尺寸：${it.size}` : '输出尺寸：由模型自适应'}，张数：{it.imageCount ?? 1}
                        </div>
                        <div className="flex items-center gap-2">
                          {!isGenerating && (
                            <>
                              <Button type="button" variant="outline" size="sm" onClick={() => handleGenerateItem(it.id, 'replace')}>
                                生成该项
                              </Button>
                              {hasImages && (
                                <Button type="button" variant="outline" size="sm" onClick={() => handleGenerateItem(it.id, 'append')}>
                                  追加生成
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {hasImages && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {(it.images ?? []).map((img, imgIdx) => (
                            <div key={`${it.id}-${imgIdx}`} className="relative rounded-lg overflow-hidden border border-white/10">
                              <img src={img.url} alt={it.name} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => {
                                  setSuiteItems((prev) =>
                                    prev.map((p) => {
                                      if (p.id !== it.id) return p;
                                      const nextImages = (p.images ?? []).filter((_, i) => i !== imgIdx);
                                      const nextStatus = nextImages.length > 0 ? p.status : 'pending';
                                      const next = { ...p, images: nextImages, status: nextStatus } as SuiteItemResult;
                                      if (activeSuiteTaskId) syncSuiteToTask(activeSuiteTaskId, prev.map((x) => (x.id === it.id ? next : x)));
                                      return next;
                                    })
                                  );
                                }}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:bg-black/80"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Dialog open={customShotDialogOpen} onOpenChange={setCustomShotDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>自定义镜头</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs text-white/50">镜头名称</div>
                  <Input
                    value={customShotDraft.name}
                    onChange={(e) => setCustomShotDraft((p) => ({ ...p, name: e.target.value }))}
                    placeholder="例如：尺寸对比图 / 参数信息图 / 开箱场景"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-white/50">用途说明（可选）</div>
                  <Input
                    value={customShotDraft.description}
                    onChange={(e) => setCustomShotDraft((p) => ({ ...p, description: e.target.value }))}
                    placeholder="例如：用于展示尺寸、对比参照物、突出卖点"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-white/50">默认比例</div>
                    <Select
                      value={customShotDraft.ratioMode}
                      onValueChange={(ratioMode) => setCustomShotDraft((p) => ({ ...p, ratioMode }))}
                    >
                      <SelectTrigger className="w-full" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIO_OPTIONS.filter((x) => x.id !== '智能比例').map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-white/50">默认张数</div>
                    <Select
                      value={String(customShotDraft.imageCount)}
                      onValueChange={(v) => setCustomShotDraft((p) => ({ ...p, imageCount: Number(v) || 1 }))}
                    >
                      <SelectTrigger className="w-full" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 6, 8].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} 张
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-white/50">默认提示词后缀（中文）</div>
                  <Textarea
                    value={customShotDraft.promptSuffixZh}
                    onChange={(e) => setCustomShotDraft((p) => ({ ...p, promptSuffixZh: e.target.value }))}
                    className="min-h-20"
                    placeholder="例如：尺寸对比图，加入参照物（手掌/硬币/尺子），信息清晰，构图干净，不要密集文字堆叠。"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCustomShotDialogOpen(false)}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const name = customShotDraft.name.trim();
                    if (!name) {
                      toast.error('请输入镜头名称');
                      return;
                    }
                    const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                    const shot: SuiteShotDefinition = {
                      id,
                      name,
                      description: customShotDraft.description.trim() || undefined,
                      defaultPromptSuffixZh: customShotDraft.promptSuffixZh.trim(),
                      defaultRatioMode: customShotDraft.ratioMode,
                      defaultImageCount: Math.max(1, Math.min(15, Math.floor(customShotDraft.imageCount || 1))),
                    };
                    setCustomShots((prev) => [...prev, shot]);
                    setSuiteItems((prev) => [...prev, createItemFromShot(id, { status: 'pending' })]);
                    setNewItemShotId(id);
                    setCustomShotDialogOpen(false);
                    toast.success('已新增自定义镜头');
                  }}
                >
                  创建并添加
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </motion.div>
  );
}
