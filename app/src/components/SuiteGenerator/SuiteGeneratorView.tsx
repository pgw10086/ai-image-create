import { motion } from 'framer-motion';
import { Loader2, Plus, RotateCcw, Send, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/appStore';
import type { GenerationTask } from '@/store/appStore';
import type { SuiteTemplate } from '@/types/suite';
import type { SuiteItemResult } from '@/types/suite';
import { executeSuiteGeneration, generateSuiteItem } from '@/services/suiteGenerationService';
import { TemplateSelector } from './TemplateSelector';
import { buildPromptWithContext, resolveModelId, resolveSizeFromRatioMode } from '@/lib/generationContext';
import { useImageUploadPicker } from '@/hooks/useImageUploadPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

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
    deductCredits,
    generationContext,
    activeTags,
  } = useAppStore();

  const [selectedTemplate, setSelectedTemplate] = useState<SuiteTemplate | null>(null);
  const [useFirstImageAsReference, setUseFirstImageAsReference] = useState(true);
  const [itemPromptOverrides, setItemPromptOverrides] = useState<Record<string, string>>({});
  const [suiteItems, setSuiteItems] = useState<SuiteItemResult[] | null>(null);
  const [activeSuiteTaskId, setActiveSuiteTaskId] = useState<string | null>(null);

  const isGenerating = tasks.some((t) => t.status === 'processing');
  const abortRef = useRef<AbortController | null>(null);
  const { fileInputRef, handleFileUpload, openPicker } = useImageUploadPicker();

  const derivedItems = useMemo(() => {
    if (!selectedTemplate) return [];
    const modelId = resolveModelId(generationContext.model);
    const { hint: sizeHint } = resolveSizeFromRatioMode({ ratioMode: generationContext.ratioMode, modelId });
    const allowText = activeTags.includes('text');
    const baseGlobal = (inputValue.trim() || 'product photography, professional e-commerce style').trim();
    return selectedTemplate.items.map((it) => {
      const promptBase = itemPromptOverrides[it.id] ?? joinPrompt(baseGlobal, it.promptSuffix);
      const prompt = buildPromptWithContext({
        basePrompt: promptBase,
        context: generationContext,
        allowText,
        sizeHint,
      });
      return { id: it.id, name: it.name, prompt };
    });
  }, [activeTags, generationContext, inputValue, itemPromptOverrides, selectedTemplate]);

  const handleResetPrompts = () => {
    setItemPromptOverrides({});
    toast.success('已重置派生 Prompt');
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
        globalPrompt: (inputValue.trim() || 'product photography, professional e-commerce style').trim(),
        model: resolveModelId(generationContext.model),
        referenceImages: uploadedImages.map((img) => img.url),
        useFirstImageAsReference,
        firstImageUrl,
        items: nextItems,
      },
    });
  };

  const handleRetryItem = async (itemId: string) => {
    if (!selectedTemplate) return;
    if (!activeSuiteTaskId) return;
    if (!suiteItems) return;

    const item = suiteItems.find((x) => x.id === itemId);
    if (!item) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setSuiteItems((prev) =>
      prev ? prev.map((p) => (p.id === itemId ? { ...p, status: 'processing', error: undefined } : p)) : prev
    );

    if (!deductCredits(10)) {
      setSuiteItems((prev) =>
        prev ? prev.map((p) => (p.id === itemId ? { ...p, status: 'failed' as const, error: '算力不足，请充值' } : p)) : prev
      );
      abortRef.current = null;
      return;
    }

    try {
      const modelId = resolveModelId(generationContext.model);
      const { size } = resolveSizeFromRatioMode({ ratioMode: generationContext.ratioMode, modelId });
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
        size,
        signal: controller.signal,
      });

      const next = (suiteItems ?? []).map((p) => (p.id === itemId ? { ...p, status: 'success' as const, images } : p));
      setSuiteItems(next);
      syncSuiteToTask(activeSuiteTaskId, next, suiteItems[0]?.images?.[0]?.url ?? images[0]?.url);
      toast.success('已重试成功');
    } catch (err: any) {
      deductCredits(-10);
      const next = (suiteItems ?? []).map((p) =>
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

    const taskId = Date.now().toString();
    setActiveSuiteTaskId(taskId);

    const modelId = resolveModelId(generationContext.model);
    const { size, hint: sizeHint } = resolveSizeFromRatioMode({ ratioMode: generationContext.ratioMode, modelId });
    const allowText = activeTags.includes('text');
    const baseGlobal = (inputValue.trim() || 'product photography, professional e-commerce style').trim();
    const globalPrompt = buildPromptWithContext({
      basePrompt: baseGlobal,
      context: generationContext,
      allowText,
      sizeHint,
    });

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

    const initialItems: SuiteItemResult[] = selectedTemplate.items.map((it) => ({
      id: it.id,
      name: it.name,
      prompt: derivedItems.find((d) => d.id === it.id)?.prompt ?? joinPrompt(globalPrompt, it.promptSuffix),
      status: 'pending',
    }));

    setSuiteItems(initialItems);
    addTask(newTask);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const suiteResult = await executeSuiteGeneration({
        template: selectedTemplate,
        globalPrompt,
        referenceImages: newTask.input.referenceImages,
        model: newTask.input.model,
        size,
        useFirstImageAsReference,
        concurrency: 2,
        promptsByItemId: derivedItems.reduce((acc, it) => ({ ...acc, [it.id]: it.prompt }), {}),
        signal: controller.signal,
        deductCredits,
        refundCredits: (amount) => deductCredits(-amount),
        onItemUpdate: (itemId, patch) => {
          setSuiteItems((prev) => {
            if (!prev) return prev;
            return prev.map((p) => (p.id === itemId ? { ...p, ...patch } : p));
          });
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
            setSuiteItems(null);
            setItemPromptOverrides({});
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
              <Button type="button" variant="outline" onClick={() => setSelectedTemplate(null)} disabled={isGenerating}>
                返回选择
              </Button>
              <Button type="button" variant="outline" onClick={handleResetPrompts} disabled={isGenerating}>
                <RotateCcw className="w-4 h-4" />
                重置派生
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

          <Card className="border-white/10 bg-card/60">
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
              <CardTitle className="text-base">子项 Prompt 预览与微调</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {derivedItems.map((it) => (
                <div key={it.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-white/80">{it.name}</div>
                    <div className="flex items-center gap-2">
                      {suiteItems?.find((s) => s.id === it.id)?.status === 'failed' && (
                        <>
                          <span className="text-xs text-red-400">失败</span>
                          {!isGenerating && (
                            <Button type="button" variant="outline" size="sm" onClick={() => handleRetryItem(it.id)}>
                              重试
                            </Button>
                          )}
                        </>
                      )}
                      {suiteItems?.find((s) => s.id === it.id)?.status === 'success' && (
                        <span className="text-xs text-emerald-400">成功</span>
                      )}
                      {suiteItems?.find((s) => s.id === it.id)?.status === 'processing' && (
                        <span className="text-xs text-violet-300 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          生成中
                        </span>
                      )}
                    </div>
                  </div>
                  <Textarea
                    value={itemPromptOverrides[it.id] ?? it.prompt}
                    onChange={(e) => setItemPromptOverrides((prev) => ({ ...prev, [it.id]: e.target.value }))}
                    className="min-h-16"
                    disabled={isGenerating}
                  />
                  {suiteItems?.find((s) => s.id === it.id)?.error && (
                    <div className="mt-2 text-xs text-red-400">{suiteItems?.find((s) => s.id === it.id)?.error}</div>
                  )}
                  {suiteItems?.find((s) => s.id === it.id)?.images?.[0]?.url && (
                    <div className="mt-3">
                      <img
                        src={suiteItems.find((s) => s.id === it.id)?.images?.[0]?.url}
                        alt={it.name}
                        className="w-full max-w-[420px] rounded-xl border border-white/10"
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
