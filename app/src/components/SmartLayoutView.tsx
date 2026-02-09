import { useEffect, useMemo, useRef, useState } from 'react';
import { SEMANTIC_COLORS } from '@/types/smartLayout';
import type { LayoutZone, SmartLayoutSettings } from '@/types/smartLayout';
import { SmartCanvas } from './smart-layout/SmartCanvas';
import type { SmartCanvasHandle } from './smart-layout/SmartCanvas';
import { ConfigPanel } from './smart-layout/ConfigPanel';
import { PreviewDialog } from './smart-layout/PreviewDialog';
import { LayoutDescriptionPanel } from './smart-layout/LayoutDescriptionPanel';
import { generateLayoutSketch, composeLayoutForGeneration } from '@/services/smartLayoutService';
import { generateImage } from '@/lib/api';
import {
  hasGeminiApiKeyConfigured,
  isTaihaoProModel,
  resolveModelId,
  resolveSizeFromCanvasForModel,
  resolveSizeFromRatioMode,
} from '@/lib/generationContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Wand2, RotateCcw, Eye, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, SlidersHorizontal, Info } from 'lucide-react';
import { toast } from 'sonner';
import { enrichZonesForPrompt } from '@/lib/smartLayoutUtils';
import { useAppStore } from '@/store/appStore';

export function SmartLayoutView({ className }: { className?: string }) {
  const canvasRef = useRef<SmartCanvasHandle>(null);
  const { smartLayoutFocusMode, setSmartLayoutFocusMode, generationContext, smartLayoutAssets, addSmartLayoutAsset } = useAppStore();
  const [zones, setZones] = useState<LayoutZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(() => {
    try {
      return localStorage.getItem('smart_layout_draw_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [canvasSize, setCanvasSize] = useState(() => {
    try {
      const raw = localStorage.getItem('smart_layout_canvas_size');
      if (raw) {
        const parsed = JSON.parse(raw) as { width?: number; height?: number };
        const width = Math.max(200, Math.round(parsed.width || 800));
        const height = Math.max(200, Math.round(parsed.height || 800));
        return { width, height };
      }
    } catch {}
    return { width: 800, height: 800 };
  });
  const [canvasWidthInput, setCanvasWidthInput] = useState(String(canvasSize.width));
  const [canvasHeightInput, setCanvasHeightInput] = useState(String(canvasSize.height));
  
  useEffect(() => {
    setCanvasWidthInput(String(canvasSize.width));
    setCanvasHeightInput(String(canvasSize.height));
    try {
      localStorage.setItem('smart_layout_canvas_size', JSON.stringify(canvasSize));
    } catch {}
  }, [canvasSize.width, canvasSize.height]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_layout_draw_mode', String(drawMode));
    } catch {}
  }, [drawMode]);
  
  // Generation State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    previewSketch: string;
    generationSketch: string;
    referenceImages: string[];
    globalPrompt: string;
    finalPrompt: string;
    size: string;
    model: string;
    sizeHint?: string;
  }>({
    previewSketch: '',
    generationSketch: '',
    referenceImages: [],
    globalPrompt: '',
    finalPrompt: '',
    size: '2048x2048',
    model: 'doubao-seedream-4-5-251128',
  });
  const [isFinalPromptEdited, setIsFinalPromptEdited] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [variantResults, setVariantResults] = useState<Array<{ style: string; url: string }>>([]);
  const [variantOpen, setVariantOpen] = useState(false);

  const [settings, setSettings] = useState<SmartLayoutSettings>(() => {
    try {
      const raw = localStorage.getItem('smart_layout_settings');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SmartLayoutSettings>;
        return {
          layoutSketchRenderMode: parsed.layoutSketchRenderMode === 'segmentation' ? 'segmentation' : 'collage',
          showSketchPreviewWithImages: parsed.showSketchPreviewWithImages !== false,
          enableRegionPrompts: parsed.enableRegionPrompts !== false,
          enableDepthTree: parsed.enableDepthTree !== false,
        };
      }
    } catch {}
    return { layoutSketchRenderMode: 'collage', showSketchPreviewWithImages: true, enableRegionPrompts: true, enableDepthTree: true };
  });

  useEffect(() => {
    try {
      localStorage.setItem('smart_layout_settings', JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const assetsById = useMemo(() => new Map(smartLayoutAssets.map((a) => [a.id, a.dataUrl])), [smartLayoutAssets]);
  const getRefImageSrc = (z: LayoutZone) => (z.refImageId ? assetsById.get(z.refImageId) : z.refImage);

  const [sidePanelOpen, setSidePanelOpen] = useState(() => {
    try {
      return localStorage.getItem('smart_layout_side_panel_open') !== 'false';
    } catch {
      return true;
    }
  });
  const [sidePanelTab, setSidePanelTab] = useState<'zone' | 'desc'>('zone');

  useEffect(() => {
    try {
      localStorage.setItem('smart_layout_side_panel_open', String(sidePanelOpen));
    } catch {}
  }, [sidePanelOpen]);

  useEffect(() => {
    if (smartLayoutFocusMode) setSidePanelOpen(false);
  }, [smartLayoutFocusMode]);

  const selectedZone = zones.find(z => z.id === selectedZoneId) || null;

  const clampZonesToCanvas = (inputZones: LayoutZone[], nextCanvasSize: { width: number; height: number }) => {
    const minSize = 20;
    return inputZones.map(z => {
      const w = Math.max(minSize, Math.min(z.width, nextCanvasSize.width));
      const h = Math.max(minSize, Math.min(z.height, nextCanvasSize.height));
      const x = Math.max(0, Math.min(z.x, nextCanvasSize.width - w));
      const y = Math.max(0, Math.min(z.y, nextCanvasSize.height - h));
      return { ...z, x, y, width: w, height: h };
    });
  };

  const applyZoneEnrichment = (inputZones: LayoutZone[]) => {
    const withColor = inputZones.map(z => ({
      ...z,
      semanticColor: z.semanticColor || SEMANTIC_COLORS[z.type],
    }));
    const clamped = clampZonesToCanvas(withColor, canvasSize);
    return enrichZonesForPrompt(clamped, canvasSize);
  };

  const handleZoneUpdate = (updatedZone: LayoutZone) => {
    setZones(prev => applyZoneEnrichment(prev.map(z => z.id === updatedZone.id ? updatedZone : z)));
  };

  const autoGenerateDepthTree = () => {
    setZones(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const byId = new Map(sorted.map(z => [z.id, z]));
      return sorted.map(z => {
        const covered = sorted
          .filter(other => other.id !== z.id && (z.zIndex > other.zIndex))
          .map(other => other.id);
        return { ...byId.get(z.id)!, coveredZoneIds: covered };
      });
    });
  };

  const handleDeleteZone = () => {
    if (selectedZoneId) {
      setZones(prev => prev.filter(z => z.id !== selectedZoneId));
      setSelectedZoneId(null);
      canvasRef.current?.clearSelection();
    }
  };

  const normalizedZones = useMemo(() => applyZoneEnrichment(zones), [zones, canvasSize.width, canvasSize.height]);

  useEffect(() => {
    setZones(prev => applyZoneEnrichment(prev));
  }, [canvasSize.width, canvasSize.height]);

  const applyCanvasSize = () => {
    const w = Math.max(200, Math.min(10000, Math.round(Number(canvasWidthInput) || canvasSize.width)));
    const h = Math.max(200, Math.min(10000, Math.round(Number(canvasHeightInput) || canvasSize.height)));
    setCanvasSize({ width: w, height: h });
    setZones(prev => applyZoneEnrichment(prev));
  };

  const preparePreviewData = async () => {
    if (zones.length === 0) {
      toast.error('请先绘制至少一个区域');
      return null;
    }

    try {
      const modelId = resolveModelId(generationContext.model);
      if (isTaihaoProModel(modelId) && !hasGeminiApiKeyConfigured()) {
        toast.error('未配置 VITE_GOOGLE_API_KEY，无法使用泰豪生图1.0-pro');
        return null;
      }
      const ratioMode = (generationContext.ratioMode ?? '智能比例').trim();
      const fixed = ratioMode !== '智能比例';
      const fixedResolved = fixed ? resolveSizeFromRatioMode({ ratioMode, modelId }) : { size: undefined as string | undefined, hint: '' };
      const canvasResolved = resolveSizeFromCanvasForModel({
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
        modelId,
      });
      const targetSize = fixed ? fixedResolved.size : canvasResolved.size;
      const sizeHint = fixed ? fixedResolved.hint : canvasResolved.hint;

      const generation = await composeLayoutForGeneration({
        zones: normalizedZones,
        canvasSize,
        renderMode: settings.layoutSketchRenderMode,
        assets: smartLayoutAssets,
        context: {
          scene: (generationContext.scene as any) || 'detail',
          platformId: generationContext.platformId as any,
          platform: generationContext.platformId as any,
          language: generationContext.language,
          model: modelId,
          ratioMode: fixed ? 'fixed' : 'smart',
          size: targetSize,
          stylePreset: generationContext.stylePreset,
        },
      }, targetSize);

      const previewMode = settings.showSketchPreviewWithImages ? 'collage' : 'segmentation';
      const previewSketch = await generateLayoutSketch({ zones: normalizedZones, canvasSize, assets: smartLayoutAssets }, previewMode, generation.size);

      return {
        previewSketch,
        generationSketch: generation.layoutSketchBase64,
        referenceImages: generation.referenceImages,
        globalPrompt: generation.globalPrompt,
        finalPrompt: generation.generateParams.prompt,
        size: generation.size,
        model: modelId,
        sizeHint,
      };
    } catch (error) {
      console.error('Failed to prepare generation:', error);
      toast.error('生成预览失败');
      return null;
    }
  };

  const handlePreviewClick = async () => {
    const data = await preparePreviewData();
    if (!data) return;
    setIsFinalPromptEdited(false);
    setPreviewData(data);
    setPreviewOpen(true);
  };

  const handleGenerateDirect = async () => {
    const data = await preparePreviewData();
    if (!data) return;
    setIsFinalPromptEdited(false);
    setPreviewData(data);
    await confirmGenerate(data);
  };

  const handleConfirmGenerate = async () => {
    await confirmGenerate(previewData);
  };

  const GLOBAL_BLOCK_RE =
    /^GLOBAL_PROMPT:\s*[\s\S]*?(?=\n\nIMAGE_REFERENCES:|\nIMAGE_REFERENCES:|\n\nCOORDINATE_SYSTEM:|\nCOORDINATE_SYSTEM:|\n\nREGION_PROMPTS:|\nREGION_PROMPTS:|$)/m;

  const upsertGlobalPrompt = (prompt: string, nextGlobalPrompt: string) => {
    if (!prompt.trim()) return `GLOBAL_PROMPT:\n${nextGlobalPrompt}`.trim();
    if (GLOBAL_BLOCK_RE.test(prompt)) {
      return prompt.replace(GLOBAL_BLOCK_RE, `GLOBAL_PROMPT:\n${nextGlobalPrompt}`);
    }
    return `GLOBAL_PROMPT:\n${nextGlobalPrompt}\n\n${prompt}`.trim();
  };

  const handleGenerateVariants = async (styles: string[]) => {
    if (styles.length === 0) return;
    setIsGenerating(true);
    try {
      const results: Array<{ style: string; url: string }> = [];
      for (const style of styles) {
        const nextGlobal = style ? `${previewData.globalPrompt} Style variant: ${style}.` : previewData.globalPrompt;
        const basePrompt = upsertGlobalPrompt(previewData.finalPrompt || '', nextGlobal);
        const prompt = previewData.sizeHint ? `${basePrompt}\n\nOUTPUT_SIZE_HINT:\n${previewData.sizeHint}` : basePrompt;
        const size = previewData.model.includes('seededit-3.0-i2i') ? undefined : previewData.size;
        const response = await generateImage({
          prompt,
          image: [previewData.generationSketch, ...previewData.referenceImages],
          size,
          model: previewData.model as any,
          sequential_image_generation: 'disabled',
          stream: false,
        });
        const url = response.data?.[0]?.url;
        if (url) {
          results.push({ style, url });
        } else {
          toast.error(`变体生成失败：${style || '未命名风格'}`);
        }
      }
      if (results.length > 0) {
        setVariantResults(results);
        setVariantOpen(true);
        toast.success(`已生成 ${results.length} 张变体`);
      }
    } catch (error: any) {
      toast.error(`变体生成失败: ${error?.message || '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const confirmGenerate = async (data: { previewSketch: string; generationSketch: string; referenceImages: string[]; globalPrompt: string; finalPrompt: string; size: string; model: string; sizeHint?: string }) => {
    setIsGenerating(true);
    try {
      const prompt = data.sizeHint ? `${data.finalPrompt}\n\nOUTPUT_SIZE_HINT:\n${data.sizeHint}` : data.finalPrompt;
      const size = data.model.includes('seededit-3.0-i2i') ? undefined : data.size;
      const response = await generateImage({
        prompt,
        image: [data.generationSketch, ...data.referenceImages],
        size,
        model: data.model as any,
        sequential_image_generation: 'disabled',
        stream: false,
      });

      if (response.data && response.data.length > 0) {
        setResultImage(response.data[0].url ?? null);
        setResultOpen(true);
        setPreviewOpen(false);
        if (response.code === 'mock') {
          toast.message(response.message || '当前为演示模式（Mock），未请求真实接口');
        }
        toast.success('生成成功！');
      } else {
        throw new Error(response.message || 'No image data returned');
      }
    } catch (error: any) {
      console.error('Generation failed:', error);
      toast.error(`生成失败: ${error.message || '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const rootHeightClass = className && /(^|\s)h-/.test(className) ? '' : 'h-[calc(100dvh-220px)]';

  return (
    <div className={["relative w-full rounded-xl border border-white/10 bg-[#0a0a0f] overflow-hidden shadow-inner", rootHeightClass, className].filter(Boolean).join(' ')}>
      <div className="absolute top-0 left-0 right-0 h-14 bg-[#14141a] border-b border-white/10 flex items-center justify-between px-4 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">智能布局画布</span>
          <span className="text-xs text-white/60 bg-white/5 px-2 py-1 rounded">
            {canvasSize.width} × {canvasSize.height}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">画框模式</span>
            <Switch checked={drawMode} onCheckedChange={setDrawMode} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>按住 Shift 可强制画框</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={canvasWidthInput}
              onChange={(e) => setCanvasWidthInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCanvasSize();
              }}
              className="h-8 w-[84px] bg-white/5 border-white/10 text-white"
              inputMode="numeric"
              placeholder="W"
            />
            <span className="text-xs text-white/40">×</span>
            <Input
              value={canvasHeightInput}
              onChange={(e) => setCanvasHeightInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCanvasSize();
              }}
              className="h-8 w-[84px] bg-white/5 border-white/10 text-white"
              inputMode="numeric"
              placeholder="H"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={applyCanvasSize}
              className="h-8 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            >
              应用
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={settings.layoutSketchRenderMode}
              onValueChange={(v) => setSettings(prev => ({ ...prev, layoutSketchRenderMode: v as SmartLayoutSettings['layoutSketchRenderMode'] }))}
            >
              <SelectTrigger className="h-8 w-[140px] bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="渲染风格" />
              </SelectTrigger>
              <SelectContent className="bg-[#1c1c21] border-white/10 text-white">
                <SelectItem value="collage" className="focus:bg-white/10 focus:text-white">贴图布局图</SelectItem>
                <SelectItem value="segmentation" className="focus:bg-white/10 focus:text-white">纯色布局图</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-white/10 text-white/70 hover:text-white hover:bg-white/10">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  高级
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#1c1c21] border-white/10 text-white">
                <DropdownMenuLabel className="text-white/70">显示与提示</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={sidePanelOpen}
                  onCheckedChange={(checked) => setSidePanelOpen(Boolean(checked))}
                >
                  右侧面板
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={settings.showSketchPreviewWithImages}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showSketchPreviewWithImages: Boolean(checked) }))}
                >
                  预览贴图
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-white/70">生成结构</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={settings.enableRegionPrompts}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableRegionPrompts: Boolean(checked) }))}
                >
                  REGION 提示
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={settings.enableDepthTree}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableDepthTree: Boolean(checked) }))}
                >
                  DEPTH 树
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {resultImage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResultOpen(true)}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <Eye className="mr-2 h-4 w-4" />
              查看结果
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setZones([]);
              setResultImage(null);
              setResultOpen(false);
              canvasRef.current?.clearSelection();
            }}
            className="text-white/60 hover:text-red-400 hover:bg-white/10"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            清空画布
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewClick}
            className="h-8 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
          >
            预览合成图
          </Button>
          <Button
            size="sm"
            onClick={handleGenerateDirect}
            className="h-8 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 transition-all hover:scale-105"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            立即生成
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSmartLayoutFocusMode(!smartLayoutFocusMode)}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
          >
            {smartLayoutFocusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="absolute top-14 left-0 right-0 bottom-0 flex overflow-hidden bg-[#0a0a0f]">
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          <SmartCanvas
            ref={canvasRef}
            zones={zones}
            onChange={(nextZones) => setZones(applyZoneEnrichment(nextZones))}
            onSelect={(id) => {
              setSelectedZoneId(id);
              if (!sidePanelOpen) setSidePanelOpen(true);
              setSidePanelTab('zone');
            }}
            canvasSize={canvasSize}
            drawMode={drawMode}
            getRefImageSrc={getRefImageSrc}
          />
        </div>

        <div
          className={[
            'h-full bg-[#14141a] border-l border-white/10',
            sidePanelOpen ? 'w-[360px]' : 'w-12',
          ].join(' ')}
        >
          <div className="h-12 px-2 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2 overflow-hidden">
              {sidePanelOpen && <span className="text-sm font-medium text-white/80 truncate">面板</span>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidePanelOpen((v) => !v)}
              className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
            >
              {sidePanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>

          {sidePanelOpen ? (
            <Tabs value={sidePanelTab} onValueChange={(v) => setSidePanelTab(v as 'zone' | 'desc')} className="h-[calc(100%-48px)]">
              <div className="px-2 pt-2">
                <TabsList className="w-full bg-white/5">
                  <TabsTrigger value="zone" className="flex-1">区域</TabsTrigger>
                  <TabsTrigger value="desc" className="flex-1">布局描述</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="zone" className="h-[calc(100%-56px)] mt-2 px-0">
                {selectedZone ? (
                  <ConfigPanel
                    layout="inline"
                    className="bg-transparent"
                    zone={selectedZone}
                    onChange={handleZoneUpdate}
                    canvasSize={canvasSize}
                    assets={smartLayoutAssets}
                    onAddAsset={addSmartLayoutAsset}
                    onClose={() => {
                      setSelectedZoneId(null);
                      canvasRef.current?.clearSelection();
                    }}
                    onDelete={handleDeleteZone}
                    allZones={zones}
                    onAutoGenerateDepthTree={autoGenerateDepthTree}
                  />
                ) : (
                  <div className="p-4">
                    <div className="text-sm text-white/70">未选中区域</div>
                    <div className="mt-3 space-y-2">
                      {zones.length === 0 ? (
                        <div className="text-xs text-white/50">在画布上拖拽绘制区域</div>
                      ) : (
                        [...zones]
                          .sort((a, b) => a.zIndex - b.zIndex)
                          .map((z) => (
                            <button
                              key={z.id}
                              type="button"
                              onClick={() => setSelectedZoneId(z.id)}
                              className="w-full text-left rounded-md border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs text-white/80 truncate">
                                  {(z.prompt || '').trim() ? (z.prompt || '').trim() : (z.type === 'background' ? '背景' : z.type === 'prop' ? '道具' : '主体')}
                                </span>
                                <span className="text-[10px] text-white/50 shrink-0">z={z.zIndex}</span>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="desc" className="h-[calc(100%-56px)] mt-2 px-3 pb-3 overflow-auto">
                <LayoutDescriptionPanel zones={normalizedZones} settings={settings} className="border-0 bg-transparent" />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="h-[calc(100%-48px)] flex flex-col items-center gap-2 pt-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSidePanelOpen(true);
                  setSidePanelTab('zone');
                }}
                className="h-10 w-10 text-white/60 hover:text-white hover:bg-white/10"
              >
                区
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSidePanelOpen(true);
                  setSidePanelTab('desc');
                }}
                className="h-10 w-10 text-white/60 hover:text-white hover:bg-white/10"
              >
                描
              </Button>
            </div>
          )}
        </div>
      </div>

       {/* Preview Dialog */}
       <PreviewDialog 
         open={previewOpen}
         onOpenChange={setPreviewOpen}
         onConfirm={handleConfirmGenerate}
         onGenerateVariants={handleGenerateVariants}
         previewImageSrc={previewData.previewSketch}
         finalImageSrc={previewData.generationSketch}
         referenceImages={previewData.referenceImages}
         globalPrompt={previewData.globalPrompt}
         onGlobalPromptChange={(value) => {
           setPreviewData(prev => {
             if (!isFinalPromptEdited) {
               const current = prev.finalPrompt || '';
               const next = current.replace(
                GLOBAL_BLOCK_RE,
                 `GLOBAL_PROMPT:\n${value}`
               );
               return { ...prev, globalPrompt: value, finalPrompt: next };
             }
             return { ...prev, globalPrompt: value };
           });
         }}
         finalPrompt={previewData.finalPrompt}
         onFinalPromptChange={(value) => {
           setIsFinalPromptEdited(true);
           setPreviewData(prev => ({ ...prev, finalPrompt: value }));
         }}
         isGenerating={isGenerating}
       />

       <Dialog open={resultOpen} onOpenChange={setResultOpen}>
         <DialogContent className="sm:max-w-[900px] bg-[#14141a] border-white/10 text-white">
           <DialogHeader>
             <DialogTitle>生成结果</DialogTitle>
           </DialogHeader>
           {resultImage ? (
             <div className="w-full flex items-center justify-center">
               <img src={resultImage} alt="result" className="max-h-[70vh] w-auto object-contain rounded-md border border-white/10" />
             </div>
           ) : (
             <div className="text-white/60 text-sm">暂无结果</div>
           )}
         </DialogContent>
       </Dialog>

       <Dialog open={variantOpen} onOpenChange={setVariantOpen}>
         <DialogContent className="sm:max-w-[1100px] bg-[#14141a] border-white/10 text-white">
           <DialogHeader>
             <DialogTitle>风格变体结果</DialogTitle>
           </DialogHeader>
           {variantResults.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {variantResults.map((r, idx) => (
                 <div key={`${r.url}-${idx}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                   <div className="text-xs text-white/70 truncate">{r.style || `变体 ${idx + 1}`}</div>
                   <div className="mt-2 w-full flex items-center justify-center">
                     <img src={r.url} alt={r.style || `variant-${idx + 1}`} className="max-h-[55vh] w-auto object-contain rounded-md border border-white/10" />
                   </div>
                 </div>
               ))}
             </div>
           ) : (
             <div className="text-white/60 text-sm">暂无结果</div>
           )}
         </DialogContent>
       </Dialog>
    </div>
  );
}
