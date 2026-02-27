import { useEffect, useMemo, useRef, useState } from 'react';
import { SEMANTIC_COLORS } from '@/types/smartLayout';
import type {
  CopyVariableKey,
  LayoutZone,
  ProductTemplateIntentV1,
  ProductTemplateImageType,
  ProductTemplateInfoDensity,
  ProductTemplatePlatformId,
  ProductTemplateSizePreset,
  ProductTemplateStylePreset,
  SmartLayoutCopyVariables,
  SmartLayoutSettings,
} from '@/types/smartLayout';
import { SmartCanvas } from './smart-layout/SmartCanvas';
import type { SmartCanvasHandle } from './smart-layout/SmartCanvas';
import { ConfigPanel } from './smart-layout/ConfigPanel';
import { PreviewDialog } from './smart-layout/PreviewDialog';
import { CopyVariablesPanel } from './smart-layout/CopyVariablesPanel';
import { ProgressOverlay } from './smart-layout/ProgressOverlay';
import { generateLayoutSketch, composeLayoutForGeneration } from '@/services/smartLayoutService';
import { generateImage, generateSmartLayoutTemplateFromProductImage, parseSmartLayoutTemplateFromImage } from '@/lib/api';
import type { GenerateImageResponse } from '@/types/api';
import {
  hasGeminiApiKeyConfigured,
  isTaihaoProModel,
  computeGroupGeneration,
  resolveModelId,
  resolveSizeFromCanvasForModel,
  resolveSizeFromRatioMode,
} from '@/lib/generationContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Wand2, RotateCcw, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, SlidersHorizontal, Info, Save, FolderOpen, Upload, Download, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { enrichZonesForPrompt } from '@/lib/smartLayoutUtils';
import { polishFreeGenerationPrompt, suggestSmartLayoutCopyVariables } from '@/lib/bigmodel';
import { useAppStore } from '@/store/appStore';
import { getPlatformStandardById } from '@/constants/platformStandards';
import {
  createSmartLayoutTemplateExportPayload,
  deleteSmartLayoutTemplate,
  downloadJsonFile,
  importSmartLayoutTemplatesFromJson,
    loadSmartLayoutHistory,
  loadSmartLayoutTemplates,
  loadSmartLayoutDraft,
  saveSmartLayoutDraft,
    saveSmartLayoutHistory,
  clearSmartLayoutDraft,
  upsertSmartLayoutTemplate,
} from '@/lib/smartLayoutPersistence';
import type { SmartLayoutTemplateV1 } from '@/types/smartLayout';
import type { SmartLayoutHistoryRecord } from '@/lib/smartLayoutPersistence';

type ResultSlot = {
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
  url?: string;
  draftUrl?: string;
  phase?: 'draft' | 'refine' | 'final';
  error?: string;
};

type ResultHistoryEntry = {
  id: string;
  createdAt: number;
  slots: ResultSlot[];
  requestedImageCount: number;
};

type MainCandidate = {
  bboxNormalized: { x: number; y: number; w: number; h: number };
  confidence: number;
  reason: string;
  product?: string;
};

export function SmartLayoutView({ className }: { className?: string }) {
  const canvasRef = useRef<SmartCanvasHandle>(null);
  const { smartLayoutFocusMode, setSmartLayoutFocusMode, generationContext, updateGenerationContext, smartLayoutAssets, addSmartLayoutAsset, clearSmartLayoutAssets, activeTags } = useAppStore();
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
    } catch {
      return { width: 800, height: 800 };
    }
    return { width: 800, height: 800 };
  });
  const [canvasWidthInput, setCanvasWidthInput] = useState(String(canvasSize.width));
  const [canvasHeightInput, setCanvasHeightInput] = useState(String(canvasSize.height));
  
  useEffect(() => {
    setCanvasWidthInput(String(canvasSize.width));
    setCanvasHeightInput(String(canvasSize.height));
    try {
      localStorage.setItem('smart_layout_canvas_size', JSON.stringify(canvasSize));
    } catch {
      return;
    }
  }, [canvasSize.width, canvasSize.height]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_layout_draw_mode', String(drawMode));
    } catch {
      return;
    }
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
  const [resultSlots, setResultSlots] = useState<ResultSlot[]>([]);
  const [requestedImageCount, setRequestedImageCount] = useState(1);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultHistory, setResultHistory] = useState<ResultHistoryEntry[]>(() => {
    try {
      return loadSmartLayoutHistory();
    } catch {
      return [];
    }
  });
  const [activeResultId, setActiveResultId] = useState('current');
  const [variantResults, setVariantResults] = useState<Array<{ style: string; url: string }>>([]);
  const [variantOpen, setVariantOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const historySaveFailedRef = useRef(false);

  useEffect(() => {
    const sanitized = resultHistory.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      requestedImageCount: entry.requestedImageCount,
      slots: entry.slots.map((slot) => ({
        status: slot.status,
        url: slot.url,
        draftUrl: slot.draftUrl,
        phase: slot.phase,
        error: slot.error,
      })),
    })) as SmartLayoutHistoryRecord[];
    const ok = saveSmartLayoutHistory(sanitized);
    if (ok === false && !historySaveFailedRef.current) {
      historySaveFailedRef.current = true;
      toast.error('本地存储空间不足，历史记录未能保存（可尝试清理旧记录或减少生成张数）');
      return;
    }
    if (ok) historySaveFailedRef.current = false;
  }, [resultHistory]);

  useEffect(() => {
    if (resultSlots.length > 0) return;
    if (resultHistory.length === 0) return;
    const latest = resultHistory[0];
    if (!latest) return;
    currentRunIdRef.current = latest.id;
    setResultSlots(latest.slots);
    setRequestedImageCount(latest.requestedImageCount);
    setActiveResultId('current');
  }, [resultHistory, resultSlots.length]);

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<SmartLayoutTemplateV1[]>(() => {
    try {
      return loadSmartLayoutTemplates();
    } catch {
      return [];
    }
  });
  const [templateName, setTemplateName] = useState('');
  const [overwriteTemplateId, setOverwriteTemplateId] = useState<string>('new');
  const importInputRef = useRef<HTMLInputElement>(null);
  const parseTemplateImageInputRef = useRef<HTMLInputElement>(null);
  const parseTemplateAbortRef = useRef<AbortController | null>(null);
  const [isParsingTemplate, setIsParsingTemplate] = useState(false);
  const [parseTemplateStageIndex, setParseTemplateStageIndex] = useState(0);
  const [parseTemplateCancelRequested, setParseTemplateCancelRequested] = useState(false);
  const parseTemplateOptionsRef = useRef<{ outputLanguage: 'auto' | 'zh' | 'en'; productHint: string }>({
    outputLanguage: 'auto',
    productHint: '',
  });
  const [parseTemplateSettingsOpen, setParseTemplateSettingsOpen] = useState(false);
  const [parseTemplateOutputLanguage, setParseTemplateOutputLanguage] = useState<'auto' | 'zh' | 'en'>(() => {
    try {
      const raw = localStorage.getItem('smart_layout_parse_output_language');
      if (raw === 'zh' || raw === 'en' || raw === 'auto') return raw;
      return 'auto';
    } catch {
      return 'auto';
    }
  });
  const [parseTemplateProductHint, setParseTemplateProductHint] = useState(() => {
    try {
      return localStorage.getItem('smart_layout_parse_product_hint') || '';
    } catch {
      return '';
    }
  });

  const productTemplateImageInputRef = useRef<HTMLInputElement>(null);
  const productTemplateAbortRef = useRef<AbortController | null>(null);
  const [isGeneratingProductTemplate, setIsGeneratingProductTemplate] = useState(false);
  const [productTemplateStageIndex, setProductTemplateStageIndex] = useState(0);
  const [productTemplateCancelRequested, setProductTemplateCancelRequested] = useState(false);
  const productTemplateOptionsRef = useRef<{ outputLanguage: 'auto' | 'zh' | 'en'; productHint: string; brief: string; intent: ProductTemplateIntentV1 }>({
    outputLanguage: 'auto',
    productHint: '',
    brief: '',
    intent: {
      schemaVersion: 1,
      imageType: 'main',
      infoDensity: 'medium',
      copy: { bulletCountMax: 3 },
    },
  });
  const [productTemplateSettingsOpen, setProductTemplateSettingsOpen] = useState(false);
  const [productTemplateOutputLanguage, setProductTemplateOutputLanguage] = useState<'auto' | 'zh' | 'en'>(() => {
    try {
      const raw = localStorage.getItem('smart_layout_product_template_output_language');
      if (raw === 'zh' || raw === 'en' || raw === 'auto') return raw;
      return 'auto';
    } catch {
      return 'auto';
    }
  });
  const [productTemplateProductHint, setProductTemplateProductHint] = useState(() => {
    try {
      return localStorage.getItem('smart_layout_product_template_product_hint') || '';
    } catch {
      return '';
    }
  });
  const defaultProductTemplateIntent: ProductTemplateIntentV1 = {
    schemaVersion: 1,
    imageType: 'main',
    platformId: undefined,
    sizePreset: undefined,
    targetCanvasSizePx: undefined,
    infoDensity: 'medium',
    stylePreset: undefined,
    copy: {
      bulletCountMax: 3,
      titleCharLimit: undefined,
      allowPrice: false,
      allowPromoBadge: false,
    },
  };
  const [productTemplateIntent, setProductTemplateIntent] = useState<ProductTemplateIntentV1>(() => {
    try {
      const raw = localStorage.getItem('smart_layout_product_template_intent_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && (parsed as any).schemaVersion === 1) {
          const v = parsed as ProductTemplateIntentV1;
          return { ...defaultProductTemplateIntent, ...v, copy: { ...defaultProductTemplateIntent.copy, ...(v.copy || {}) } };
        }
      }
    } catch {
      return { ...defaultProductTemplateIntent };
    }
    return { ...defaultProductTemplateIntent };
  });

  const parseTemplateProgressStages = ['准备图片', '分析图片', '生成布局分区', '应用到画布'];
  const productTemplateProgressStages = ['准备图片', '分析商品图与描述', '生成布局分区', '应用到画布'];
  const [productTemplateBrief, setProductTemplateBrief] = useState(() => {
    try {
      return localStorage.getItem('smart_layout_product_template_brief') || '';
    } catch {
      return '';
    }
  });
  const [isProductTemplateBriefEdited, setIsProductTemplateBriefEdited] = useState(false);
  const [isPolishingProductTemplateBrief, setIsPolishingProductTemplateBrief] = useState(false);
  const [productTemplateIntentAdvancedOpen, setProductTemplateIntentAdvancedOpen] = useState(() => {
    try {
      return localStorage.getItem('smart_layout_product_template_intent_advanced_open') === 'true';
    } catch {
      return false;
    }
  });

  const [mainConfirmOpen, setMainConfirmOpen] = useState(false);
  const [mainCandidates, setMainCandidates] = useState<MainCandidate[]>([]);
  const [mainConfidence, setMainConfidence] = useState<number | null>(null);
  const [mainReason, setMainReason] = useState('');
  const [pendingParsedTemplateName, setPendingParsedTemplateName] = useState<string | null>(null);
  const [draftOfferOpen, setDraftOfferOpen] = useState(false);
  const [draftExists, setDraftExists] = useState(() => {
    try {
      return Boolean(loadSmartLayoutDraft());
    } catch {
      return false;
    }
  });
  const [pendingDraftUpdatedAt, setPendingDraftUpdatedAt] = useState<number | null>(null);

  const normalizeSettings = (input?: Partial<SmartLayoutSettings>): SmartLayoutSettings => {
    return {
      layoutSketchRenderMode: input?.layoutSketchRenderMode === 'segmentation' ? 'segmentation' : 'collage',
      showSketchPreviewWithImages: input?.showSketchPreviewWithImages !== false,
      enableRegionPrompts: input?.enableRegionPrompts !== false,
      enableDepthTree: input?.enableDepthTree !== false,
      enableTwoStageGeneration: input?.enableTwoStageGeneration === true,
    };
  };

  const [settings, setSettings] = useState<SmartLayoutSettings>(() => {
    try {
      const raw = localStorage.getItem('smart_layout_settings');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SmartLayoutSettings>;
        return normalizeSettings(parsed);
      }
    } catch {
      return normalizeSettings();
    }
    return normalizeSettings();
  });

  useEffect(() => {
    try {
      localStorage.setItem('smart_layout_settings', JSON.stringify(settings));
    } catch {
      return;
    }
  }, [settings]);

  const defaultCopyVariables: SmartLayoutCopyVariables = {
    PRODUCT: '',
    TITLE: '',
    SUBTITLE: '',
    BULLET_1: '',
    BULLET_2: '',
    BULLET_3: '',
    BULLET_4: '',
    BULLET_5: '',
    CTA: '',
    BADGE: '',
    PRICE: '',
  };

  const [copyVariables, setCopyVariables] = useState<SmartLayoutCopyVariables>(() => {
    try {
      const raw = localStorage.getItem('smart_layout_copy_variables_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') {
          return { ...defaultCopyVariables, ...(parsed as SmartLayoutCopyVariables) };
        }
      }
    } catch {
      return { ...defaultCopyVariables };
    }
    try {
      const product = localStorage.getItem('smart_layout_var_product') || '';
      return { ...defaultCopyVariables, PRODUCT: product };
    } catch {
      return { ...defaultCopyVariables };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('smart_layout_copy_variables_v1', JSON.stringify(copyVariables));
      localStorage.setItem('smart_layout_var_product', (copyVariables.PRODUCT || '').toString());
    } catch {
      return;
    }
  }, [copyVariables]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_layout_parse_output_language', parseTemplateOutputLanguage);
      localStorage.setItem('smart_layout_parse_product_hint', parseTemplateProductHint);
    } catch {
      return;
    }
  }, [parseTemplateOutputLanguage, parseTemplateProductHint]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_layout_product_template_output_language', productTemplateOutputLanguage);
      localStorage.setItem('smart_layout_product_template_product_hint', productTemplateProductHint);
      localStorage.setItem('smart_layout_product_template_brief', productTemplateBrief);
      localStorage.setItem('smart_layout_product_template_intent_v1', JSON.stringify(productTemplateIntent));
      localStorage.setItem('smart_layout_product_template_intent_advanced_open', String(productTemplateIntentAdvancedOpen));
    } catch {
      return;
    }
  }, [productTemplateOutputLanguage, productTemplateProductHint, productTemplateBrief, productTemplateIntent, productTemplateIntentAdvancedOpen]);

  const resolveBriefLanguage = (brief: string) => {
    const preferred = (productTemplateOutputLanguage || 'auto').trim();
    if (preferred === 'zh' || preferred === 'en') return preferred;
    return /[\u4e00-\u9fff]/.test(brief) ? 'zh' : 'en';
  };

  const labelProductTemplateImageType = (v: ProductTemplateImageType) => {
    if (v === 'main') return '主图（吸引点击）';
    if (v === 'detail') return '详情（解释卖点）';
    if (v === 'comparison') return '对比（建立差异）';
    if (v === 'size') return '尺寸/参数（证明规格）';
    return '场景（氛围种草）';
  };

  const labelProductTemplatePlatform = (v: ProductTemplatePlatformId) => {
    if (v === 'amazon') return 'Amazon';
    if (v === 'temu') return 'Temu';
    if (v === 'shopee') return 'Shopee';
    if (v === 'tiktok') return 'TikTok';
    if (v === 'aliexpress') return 'AliExpress';
    if (v === 'alibaba') return 'Alibaba';
    if (v === 'lazada') return 'Lazada';
    if (v === 'ebay') return 'eBay';
    if (v === 'shein') return 'SHEIN';
    return '其他';
  };

  const labelProductTemplateDensity = (v: ProductTemplateInfoDensity) => {
    if (v === 'low') return '少';
    if (v === 'high') return '多';
    return '中';
  };

  const labelProductTemplateStyle = (v: ProductTemplateStylePreset) => {
    if (v === 'brand') return '品牌';
    if (v === 'minimal') return '极简';
    if (v === 'tech') return '科技';
    if (v === 'cute') return '可爱';
    if (v === 'warm') return '温暖';
    if (v === 'luxury') return '高级';
    if (v === 'fresh') return '清新';
    return '复古';
  };

  const labelProductTemplateSizePreset = (v: ProductTemplateSizePreset) => {
    if (v === '1:1') return '1:1';
    if (v === '3:4') return '3:4';
    if (v === '4:5') return '4:5';
    if (v === '2:3') return '2:3';
    if (v === '16:9') return '16:9';
    if (v === '9:16') return '9:16';
    return '长图';
  };

  const buildProductTemplateBriefFromIntent = (intent: ProductTemplateIntentV1) => {
    const lines: string[] = [];
    const platform = intent.platformId ? labelProductTemplatePlatform(intent.platformId) : '不限平台';
    const size = intent.sizePreset ? labelProductTemplateSizePreset(intent.sizePreset) : '不限';
    const targetW = typeof intent.targetCanvasSizePx?.width === 'number' ? Math.round(intent.targetCanvasSizePx.width) : null;
    const targetH = typeof intent.targetCanvasSizePx?.height === 'number' ? Math.round(intent.targetCanvasSizePx.height) : null;
    const targetText = targetW && targetH ? `，目标像素 ${targetW}×${targetH}px` : '';
    const style = intent.stylePreset ? labelProductTemplateStyle(intent.stylePreset) : '中性';
    const density = labelProductTemplateDensity(intent.infoDensity);
    const imageType = labelProductTemplateImageType(intent.imageType);
    const bulletMax = intent.copy?.bulletCountMax ?? 3;
    const titleLimit = typeof intent.copy?.titleCharLimit === 'number' ? `${intent.copy.titleCharLimit}字以内` : '不限制字数';
    const allowPrice = intent.copy?.allowPrice ? '允许出现价格（{PRICE}）' : '禁止出现价格';
    const allowBadge = intent.copy?.allowPromoBadge ? '允许促销角标（{BADGE}）' : '禁止促销角标';

    lines.push(`1) 我想用于 ${platform}，尺寸/比例 ${size}${targetText}。`);
    lines.push(`2) 图型/目的：${imageType}。信息密度：${density}。`);
    lines.push(`3) 风格是 ${style}。`);
    lines.push(`4) 文案结构：主标题 {TITLE}（${titleLimit}），副标题 {SUBTITLE}（可选），卖点最多 ${bulletMax} 条（用 {BULLET_1}..），行动文案 {CTA}（可选）。${allowBadge}；${allowPrice}。`);
    lines.push(`5) 规则：主体使用 {PRODUCT}；禁止遮挡主体、贴边、过多装饰、夸张透视；留足安全边距，文字清晰可读。`);
    return lines.join('\n');
  };

  const composeProductTemplateFinalBrief = (intent: ProductTemplateIntentV1, briefText: string, edited: boolean) => {
    const base = buildProductTemplateBriefFromIntent(intent);
    const extra = (briefText || '').trim();
    if (!extra) return base;
    if (!edited) return extra;
    return `${base}\n\n补充说明：\n${extra}`;
  };

  const handlePolishProductTemplateBrief = async () => {
    if (isPolishingProductTemplateBrief) return;
    const raw = composeProductTemplateFinalBrief(productTemplateIntent, productTemplateBrief, true).trim();
    if (!raw) {
      toast.error('请先填写效果描述');
      return;
    }
    setIsPolishingProductTemplateBrief(true);
    try {
      const polished = await polishFreeGenerationPrompt({
        prompt: raw,
        language: resolveBriefLanguage(raw),
      });
      setProductTemplateBrief(polished);
      setIsProductTemplateBriefEdited(true);
      toast.success('已优化效果描述');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      toast.error(`优化失败：${message}`);
    } finally {
      setIsPolishingProductTemplateBrief(false);
    }
  };

  useEffect(() => {
    if (!productTemplateSettingsOpen) return;
    if (isProductTemplateBriefEdited) return;
    if ((productTemplateBrief || '').trim()) return;
    setProductTemplateBrief(buildProductTemplateBriefFromIntent(productTemplateIntent));
  }, [productTemplateSettingsOpen, productTemplateIntent, isProductTemplateBriefEdited, productTemplateBrief]);

  const assetsById = useMemo(() => new Map(smartLayoutAssets.map((a) => [a.id, a.dataUrl])), [smartLayoutAssets]);
  const getRefImageSrc = (z: LayoutZone) => (z.refImageId ? assetsById.get(z.refImageId) : z.refImage);

  const [sidePanelOpen, setSidePanelOpen] = useState(() => {
    try {
      return localStorage.getItem('smart_layout_side_panel_open') !== 'false';
    } catch {
      return true;
    }
  });
  const [sidePanelTab, setSidePanelTab] = useState<'zone' | 'copy'>('zone');

  useEffect(() => {
    try {
      localStorage.setItem('smart_layout_side_panel_open', String(sidePanelOpen));
    } catch {
      return;
    }
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

  const normalizeCanvasSize = (raw: unknown) => {
    const wRaw = (raw as { width?: unknown } | null | undefined)?.width;
    const hRaw = (raw as { height?: unknown } | null | undefined)?.height;
    const wNum = typeof wRaw === 'number' ? wRaw : Number(wRaw);
    const hNum = typeof hRaw === 'number' ? hRaw : Number(hRaw);
    const clamp = (n: number) => Math.max(200, Math.min(10000, Math.round(n)));
    const width = Number.isFinite(wNum) && wNum > 0 ? clamp(wNum) : canvasSize.width;
    const height = Number.isFinite(hNum) && hNum > 0 ? clamp(hNum) : canvasSize.height;
    return { width, height };
  };

  const applyZoneEnrichmentForCanvas = (inputZones: LayoutZone[], nextCanvasSize: { width: number; height: number }) => {
    const withColor = inputZones.map(z => ({
      ...z,
      semanticColor: z.semanticColor || SEMANTIC_COLORS[z.type],
    }));
    const clamped = clampZonesToCanvas(withColor, nextCanvasSize);
    return enrichZonesForPrompt(clamped, nextCanvasSize);
  };

  const applyZoneEnrichment = (inputZones: LayoutZone[]) => {
    return applyZoneEnrichmentForCanvas(inputZones, canvasSize);
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

  const normalizeCopyVariableKey = (keyRaw: string): CopyVariableKey | null => {
    const key = (keyRaw || '').toString().trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,32}$/.test(key)) return null;
    return key as CopyVariableKey;
  };

  const labelCopyVariableKey = (key: CopyVariableKey) => {
    if (key === 'PRODUCT') return '商品主体';
    if (key === 'TITLE') return '主标题';
    if (key === 'SUBTITLE') return '副标题';
    if (key === 'CTA') return '行动文案';
    if (key === 'BADGE') return '角标';
    if (key === 'PRICE') return '价格';
    if (key === 'BULLET_1') return '卖点 1';
    if (key === 'BULLET_2') return '卖点 2';
    if (key === 'BULLET_3') return '卖点 3';
    if (key === 'BULLET_4') return '卖点 4';
    if (key === 'BULLET_5') return '卖点 5';
    return key;
  };

  const extractCopyVariableKeysFromText = (text: string): CopyVariableKey[] => {
    const raw = (text || '').toString();
    const matches = raw.match(/\{[A-Z0-9_]+\}/g) ?? [];
    const out: CopyVariableKey[] = [];
    for (const m of matches) {
      const k = normalizeCopyVariableKey(m.slice(1, -1));
      if (k) out.push(k);
    }
    return out;
  };

  const requiredCopyKeys = useMemo(() => {
    const set = new Set<CopyVariableKey>();
    for (const z of normalizedZones) {
      const keys = extractCopyVariableKeysFromText((z.prompt || '').toString());
      for (const k of keys) set.add(k);
    }
    return Array.from(set);
  }, [normalizedZones]);

  const missingCopyKeys = useMemo(() => {
    const miss: CopyVariableKey[] = [];
    for (const k of requiredCopyKeys) {
      const v = (copyVariables?.[k] ?? '').toString().trim();
      if (!v) miss.push(k);
    }
    return miss;
  }, [requiredCopyKeys, copyVariables]);

  const resolvePromptVariables = (prompt: string) => {
    const raw = (prompt || '').toString();
    return raw.replace(/\{([A-Z0-9_]+)\}/g, (full, keyRaw) => {
      const key = normalizeCopyVariableKey(keyRaw);
      if (!key) return full;
      const value = (copyVariables?.[key] ?? '').toString().trim();
      return value ? value : full;
    });
  };

  const resolvedNormalizedZones = useMemo(
    () =>
      normalizedZones.map((z) => ({
        ...z,
        prompt: resolvePromptVariables((z.prompt || '').toString()),
      })),
    [normalizedZones, copyVariables]
  );

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
      if (missingCopyKeys.length > 0) {
        if (!sidePanelOpen) setSidePanelOpen(true);
        setSidePanelTab('copy');
        toast.error(`请先填写文案变量：${missingCopyKeys.map(labelCopyVariableKey).join('、')}`);
        return null;
      }
      const modelId = resolveModelId(generationContext.model);
      if (isTaihaoProModel(modelId) && !hasGeminiApiKeyConfigured()) {
        toast.error('未配置 VITE_GOOGLE_API_KEY，无法使用泰豪生图1.0-pro');
        return null;
      }
      const normalizePlatformId = (v: string | undefined) => {
        if (!v) return undefined;
        if (
          v === 'amazon' ||
          v === 'temu' ||
          v === 'shopee' ||
          v === 'tiktok' ||
          v === 'aliexpress' ||
          v === 'alibaba' ||
          v === 'lazada' ||
          v === 'ebay' ||
          v === 'shein'
        )
          return v;
        return undefined;
      };
      const normalizeScene = (v: string | undefined) => {
        if (!v) return 'detail' as const;
        if (v === 'single' || v === 'detail' || v === 'crossborder' || v === 'brand') return v;
        return 'detail' as const;
      };
      const platformIdNormalized = normalizePlatformId(generationContext.platformId);
      const sceneNormalized = normalizeScene(generationContext.scene);
      const std = platformIdNormalized ? getPlatformStandardById(platformIdNormalized) : undefined;
      const allowText = activeTags.includes('text') && !std?.disallowTextInImage;
      const ratioModeRaw = (generationContext.ratioMode ?? '').trim();
      const ratioMode = ratioModeRaw === '智能比例' || ratioModeRaw.includes(':') ? ratioModeRaw : '智能比例';
      const qualityMode = generationContext.qualityMode === '4K' ? '4K' : '2K';
      const fixed = ratioMode !== '智能比例';
      const fixedResolved = fixed
        ? resolveSizeFromRatioMode({ ratioMode, qualityMode, modelId })
        : { size: undefined as string | undefined, hint: '' };
      const smartResolved = !fixed
        ? resolveSizeFromRatioMode({ ratioMode: '智能比例', qualityMode, modelId })
        : { size: undefined as string | undefined, hint: '' };
      const canvasResolved = resolveSizeFromCanvasForModel({
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
        modelId,
      });
      const smartSize = canvasResolved.size || smartResolved.size;
      const smartHint = canvasResolved.hint || smartResolved.hint;
      const requestSize = fixed ? fixedResolved.size : smartSize;
      const sketchSize = fixed ? fixedResolved.size : smartSize;
      const sizeHint = fixed ? fixedResolved.hint : smartHint;

      const generation = await composeLayoutForGeneration({
        zones: resolvedNormalizedZones,
        canvasSize,
        renderMode: settings.layoutSketchRenderMode,
        assets: smartLayoutAssets,
        promptSettings: {
          enableRegionPrompts: settings.enableRegionPrompts,
          enableDepthTree: settings.enableDepthTree,
        },
        context: {
          scene: sceneNormalized,
          platformId: platformIdNormalized,
          platform: platformIdNormalized,
          language: generationContext.language,
          model: modelId,
          ratioMode: fixed ? 'fixed' : 'smart',
          size: requestSize,
          stylePreset: generationContext.stylePreset,
          allowText,
        },
      }, sketchSize);

      const previewMode = settings.showSketchPreviewWithImages ? 'collage' : 'segmentation';
      const previewSketch = await generateLayoutSketch({ zones: normalizedZones, canvasSize, assets: smartLayoutAssets }, previewMode, generation.size);

      return {
        previewSketch,
        generationSketch: generation.layoutSketchBase64,
        referenceImages: generation.referenceImages,
        globalPrompt: generation.globalPrompt,
        finalPrompt: generation.generateParams.prompt,
        size: requestSize ?? generation.size,
        model: modelId,
        sizeHint,
      };
    } catch (error: unknown) {
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

  const cancelGeneration = () => {
    abortControllerRef.current?.abort();
    setResultSlots((prev) =>
      prev.map((slot) => {
        if (slot.status === 'success' || slot.status === 'failed') return slot;
        return { ...slot, status: 'cancelled', error: slot.error || '已停止' };
      })
    );
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
          model: previewData.model,
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '未知错误';
      toast.error(`变体生成失败: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const confirmGenerate = async (data: { previewSketch: string; generationSketch: string; referenceImages: string[]; globalPrompt: string; finalPrompt: string; size: string; model: string; sizeHint?: string }) => {
    setIsGenerating(true);
    try {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const prompt = data.sizeHint ? `${data.finalPrompt}\n\nOUTPUT_SIZE_HINT:\n${data.sizeHint}` : data.finalPrompt;
      const size = data.model.includes('seededit-3.0-i2i') ? undefined : data.size;
      const requestedCount = Math.max(1, Math.min(15, Math.floor(generationContext.imageCount || 1)));
      const referenceCount = 1 + (data.referenceImages?.length || 0);
      const group = computeGroupGeneration({
        requestedCount,
        referenceCount,
        modelId: data.model,
      });
      const image = [data.generationSketch, ...data.referenceImages];
      const concurrencyLimit = 3;
      const enableTwoStage = settings.enableTwoStageGeneration;

      if (resultSlots.length > 0) {
        const prevRunId = currentRunIdRef.current;
        setResultHistory((prev) => {
          if (prevRunId && prev.some((entry) => entry.id === prevRunId)) return prev;
          const entry: ResultHistoryEntry = {
            id: `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            createdAt: Date.now(),
            slots: resultSlots,
            requestedImageCount,
          };
          return [entry, ...prev].slice(0, 20);
        });
      }

      const runId = `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      currentRunIdRef.current = runId;
      const initialSlots = Array.from({ length: requestedCount }, () => ({ status: 'pending' as const }));
      setResultHistory((prev) => {
        if (prev.some((entry) => entry.id === runId)) return prev;
        const entry: ResultHistoryEntry = {
          id: runId,
          createdAt: Date.now(),
          slots: initialSlots,
          requestedImageCount: requestedCount,
        };
        return [entry, ...prev].slice(0, 20);
      });

      setRequestedImageCount(requestedCount);
      setSelectedResultIndex(0);
      setActiveResultId('current');
      setResultSlots(initialSlots);
      setResultOpen(true);
      setPreviewOpen(false);

      const updateSlot = (index: number, patch: Partial<ResultSlot>) => {
        setResultSlots((prev) => prev.map((slot, idx) => (idx === index ? { ...slot, ...patch } : slot)));
      };

      if (enableTwoStage && requestedCount > 1) {
        toast.message('两阶段生成将自动分次生成以补齐张数');
      } else if (requestedCount > 1 && group.sequential_image_generation !== 'auto') {
        toast.message('当前模型不支持一次生成多张，将自动分次生成以补齐张数');
      } else if (requestedCount > 1 && group.maxImages < requestedCount) {
        toast.message(`由于参考图数量限制，本次最多可组图生成 ${group.maxImages} 张，将自动补齐到 ${requestedCount} 张`);
      }

      const urls: string[] = [];
      let didShowMockHint = false;
      const maybeToastMock = (response: GenerateImageResponse) => {
        if (didShowMockHint) return;
        if (response?.code === 'mock') {
          didShowMockHint = true;
          toast.message(response.message || '当前为演示模式（Mock），未请求真实接口');
        }
      };
      const pushUrl = (slotIndex: number, url?: string) => {
        if (!url) return;
        urls.push(url);
        updateSlot(slotIndex, { status: 'success', url, phase: 'final', error: undefined });
      };

      let filled = 0;

      if (!enableTwoStage && group.sequential_image_generation === 'auto' && !controller.signal.aborted) {
        try {
          const response = await generateImage({
            prompt,
            image,
            size,
            model: data.model,
            sequential_image_generation: 'auto',
            sequential_image_generation_options: { max_images: group.maxImages },
            stream: false,
            signal: controller.signal,
          });
          const nextUrls = response.data?.map((item) => item.url).filter((v): v is string => Boolean(v)) ?? [];
          maybeToastMock(response);
          for (const u of nextUrls) {
            if (filled >= requestedCount) break;
            pushUrl(filled, u);
            filled += 1;
          }
        } catch (error: unknown) {
          if (controller.signal.aborted) {
            toast.message('已取消生成');
          } else {
            const message = error instanceof Error ? error.message : '未知错误';
            toast.error(`组图生成失败：${message}`);
          }
        }
      }

      const slotIndices = Array.from({ length: requestedCount - filled }, (_, i) => i + filled);
      let cursor = 0;
      const workers = Array.from({ length: Math.min(concurrencyLimit, slotIndices.length) }, async () => {
        while (!controller.signal.aborted) {
          const next = cursor;
          cursor += 1;
          if (next >= slotIndices.length) return;
          const slotIndex = slotIndices[next];
          updateSlot(slotIndex, { status: 'processing', phase: enableTwoStage ? 'draft' : undefined, error: undefined });
          try {
            if (!enableTwoStage) {
              const response = await generateImage({
                prompt,
                image,
                size,
                model: data.model,
                sequential_image_generation: 'disabled',
                stream: false,
                signal: controller.signal,
              });
              maybeToastMock(response);
              const url = response.data?.[0]?.url;
              if (url) {
                pushUrl(slotIndex, url);
              } else {
                updateSlot(slotIndex, { status: 'failed', error: response.message || '生成失败' });
              }
              continue;
            }

            const draftResponse = await generateImage({
              prompt,
              image: [data.generationSketch],
              size,
              model: data.model,
              sequential_image_generation: 'disabled',
              stream: false,
              signal: controller.signal,
            });
            maybeToastMock(draftResponse);
            const draftUrl = draftResponse.data?.[0]?.url;
            if (!draftUrl) {
              updateSlot(slotIndex, { status: 'failed', error: draftResponse.message || '构图阶段生成失败' });
              continue;
            }
            updateSlot(slotIndex, { draftUrl, phase: 'refine' });
            if (controller.signal.aborted) {
              updateSlot(slotIndex, { status: 'cancelled', error: '已停止' });
              return;
            }

            const refineImages = data.referenceImages?.length ? [draftUrl, ...data.referenceImages] : [draftUrl];
            const refineResponse = await generateImage({
              prompt,
              image: refineImages,
              size,
              model: data.model,
              sequential_image_generation: 'disabled',
              stream: false,
              signal: controller.signal,
            });
            maybeToastMock(refineResponse);
            const finalUrl = refineResponse.data?.[0]?.url;
            if (finalUrl) {
              pushUrl(slotIndex, finalUrl);
            } else {
              updateSlot(slotIndex, { status: 'failed', phase: 'refine', error: refineResponse.message || '精修阶段生成失败' });
            }
          } catch (error: unknown) {
            if (controller.signal.aborted) {
              updateSlot(slotIndex, { status: 'cancelled', error: '已停止' });
              return;
            }
            const message = error instanceof Error ? error.message : '未知错误';
            updateSlot(slotIndex, { status: 'failed', error: message });
            toast.error(`第 ${slotIndex + 1} 张生成失败：${message}`);
            continue;
          }
        }
      });
      await Promise.all(workers);

      if (urls.length === 0) {
        if (controller.signal.aborted) return;
        throw new Error('未生成到有效图片');
      }

      if (requestedCount > 1 && urls.length < requestedCount) {
        toast.message(`已生成 ${urls.length}/${requestedCount} 张`);
      } else {
        toast.success(`生成成功！${urls.length > 1 ? `（${urls.length} 张）` : ''}`);
      }
    } catch (error: unknown) {
      console.error('Generation failed:', error);
      const message = error instanceof Error ? error.message : '未知错误';
      toast.error(`生成失败: ${message}`);
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const shouldForwardHeightClass = Boolean(className && /(^|\s)h-/.test(className));
  const rootHeightClass = shouldForwardHeightClass ? '' : 'min-h-[calc(100dvh-220px)]';
  const rootHeightStyle = shouldForwardHeightClass ? undefined : { height: canvasSize.height + 120 };
  const activeHistoryEntry = useMemo(
    () => (activeResultId === 'current' ? null : resultHistory.find((entry) => entry.id === activeResultId) ?? null),
    [activeResultId, resultHistory]
  );
  const displaySlots = activeHistoryEntry ? activeHistoryEntry.slots : resultSlots;
  const displayRequestedImageCount = activeHistoryEntry ? activeHistoryEntry.requestedImageCount : requestedImageCount;
  const resultSuccessCount = useMemo(
    () => displaySlots.filter((s) => s.status === 'success').length,
    [displaySlots]
  );
  const selectedResult = useMemo(() => {
    if (displaySlots.length === 0) return null;
    const idx = Math.max(0, Math.min(selectedResultIndex, displaySlots.length - 1));
    return displaySlots[idx] ?? null;
  }, [displaySlots, selectedResultIndex]);
  const currentResultPreviewUrl = useMemo(
    () => resultSlots.find((s) => s.url)?.url,
    [resultSlots]
  );
  const hiddenHistoryId = resultSlots.length > 0 ? currentRunIdRef.current : null;
  const visibleResultHistory = hiddenHistoryId ? resultHistory.filter((entry) => entry.id !== hiddenHistoryId) : resultHistory;

  useEffect(() => {
    const runId = currentRunIdRef.current;
    if (!runId) return;
    if (resultSlots.length === 0) return;
    setResultHistory((prev) => {
      const idx = prev.findIndex((entry) => entry.id === runId);
      if (idx < 0) return prev;
      const entry = prev[idx];
      if (entry.slots === resultSlots && entry.requestedImageCount === requestedImageCount) return prev;
      const next = [...prev];
      next[idx] = { ...entry, slots: resultSlots, requestedImageCount };
      return next;
    });
  }, [resultSlots, requestedImageCount]);

  useEffect(() => {
    setSelectedResultIndex(0);
  }, [activeResultId]);

  const refreshTemplates = () => {
    setTemplates(loadSmartLayoutTemplates());
  };

  const applyTemplate = (t: SmartLayoutTemplateV1) => {
    const nextCanvasSize = normalizeCanvasSize(t.payload.canvasSize);
    setCanvasSize(nextCanvasSize);
    setZones(applyZoneEnrichmentForCanvas(t.payload.zones || [], nextCanvasSize));
    setSettings(normalizeSettings(t.payload.settings));
    setCopyVariables({ ...defaultCopyVariables, ...((t.payload.copyVariables as SmartLayoutCopyVariables) || {}) });
    if (t.payload.productTemplateIntent && t.payload.productTemplateIntent.schemaVersion === 1) {
      const v = t.payload.productTemplateIntent as ProductTemplateIntentV1;
      setProductTemplateIntent({ ...defaultProductTemplateIntent, ...v, copy: { ...defaultProductTemplateIntent.copy, ...(v.copy || {}) } });
    }
    if (t.payload.generationContextSnapshot) {
      updateGenerationContext(t.payload.generationContextSnapshot);
    }
    setSelectedZoneId(null);
    canvasRef.current?.clearSelection();
    currentRunIdRef.current = null;
    setResultSlots([]);
    setRequestedImageCount(1);
    setSelectedResultIndex(0);
    setResultOpen(false);
    toast.success(`已应用模板：${t.name}`);
  };

  const draftCheckedRef = useRef(false);
  useEffect(() => {
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    try {
      const draft = loadSmartLayoutDraft();
      if (!draft) return;
      if (zones.length > 0) return;
      setPendingDraftUpdatedAt(draft.updatedAt);
      setDraftOfferOpen(true);
    } catch {
      return;
    }
  }, [zones.length]);

  const applyDraft = () => {
    const draft = loadSmartLayoutDraft();
    if (!draft) {
      toast.error('未找到可恢复的草稿');
      setDraftExists(false);
      setDraftOfferOpen(false);
      return;
    }
    const nextCanvasSize = normalizeCanvasSize(draft.canvasSize);
    setCanvasSize(nextCanvasSize);
    setZones(applyZoneEnrichmentForCanvas(draft.zones || [], nextCanvasSize));
    setSettings(normalizeSettings(draft.settings));
    setCopyVariables({ ...defaultCopyVariables, ...((draft.copyVariables as SmartLayoutCopyVariables) || {}) });
    if (draft.productTemplateIntent && draft.productTemplateIntent.schemaVersion === 1) {
      const v = draft.productTemplateIntent as ProductTemplateIntentV1;
      setProductTemplateIntent({ ...defaultProductTemplateIntent, ...v, copy: { ...defaultProductTemplateIntent.copy, ...(v.copy || {}) } });
    }
    if (draft.generationContextSnapshot) {
      updateGenerationContext(draft.generationContextSnapshot);
    }
    setSelectedZoneId(null);
    canvasRef.current?.clearSelection();
    currentRunIdRef.current = null;
    setResultSlots([]);
    setRequestedImageCount(1);
    setSelectedResultIndex(0);
    setResultOpen(false);
    setDraftOfferOpen(false);
    toast.success('已恢复草稿');
  };

  const handleOpenSaveTemplate = () => {
    setOverwriteTemplateId('new');
    const fallbackName = `模板 ${new Date().toLocaleString()}`;
    setTemplateName(fallbackName);
    setSaveTemplateOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (zones.length === 0) {
      toast.error('请先绘制至少一个区域');
      return;
    }
    const name = (templateName || '').trim();
    if (!name) {
      toast.error('请输入模板名称');
      return;
    }
    try {
      const max = 360;
      const ratio = canvasSize.width / Math.max(1, canvasSize.height);
      const thumbW = ratio >= 1 ? max : Math.max(120, Math.round(max * ratio));
      const thumbH = ratio >= 1 ? Math.max(120, Math.round(max / ratio)) : max;
      const snapshotDataUrl = await generateLayoutSketch(
        { zones: normalizedZones, canvasSize, assets: smartLayoutAssets },
        'segmentation',
        `${thumbW}x${thumbH}`
      );
      const { strippedSnapshots } = upsertSmartLayoutTemplate({
        id: overwriteTemplateId !== 'new' ? overwriteTemplateId : undefined,
        name,
        snapshotDataUrl,
        payload: {
          canvasSize,
          zones: normalizedZones,
          settings,
          copyVariables,
          productTemplateIntent,
          generationContextSnapshot: generationContext,
        },
      });
      refreshTemplates();
      setSaveTemplateOpen(false);
      const base = overwriteTemplateId !== 'new' ? '模板已更新' : '模板已保存';
      if (strippedSnapshots) {
        toast.message(`${base}（本地空间不足，已移除预览图以确保落盘）`);
      } else {
        toast.success(base);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      toast.error(`保存失败：${message}`);
    }
  };

  const handleExportAllTemplates = () => {
    const payload = createSmartLayoutTemplateExportPayload(loadSmartLayoutTemplates());
    downloadJsonFile(`smart-layout-templates-${Date.now()}.json`, payload);
    toast.success('已导出模板库');
  };

  const handleImportTemplates = async (file: File) => {
    try {
      const raw = await file.text();
      const { imported, importedTemplates, next, persisted, strippedSnapshots } = importSmartLayoutTemplatesFromJson(raw);
      setTemplates(next);
      if (imported <= 0) {
        toast.error('未识别到可导入的模板数据');
        return;
      }
      if (!persisted) {
        toast.error('导入解析成功，但本地存储空间不足，未能保存到模板库（可先删除旧模板或导入时不带预览图）');
        return;
      }
      const importedSorted = importedTemplates.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const firstImported = importedSorted[0];
      if (firstImported && zones.length === 0) {
        applyTemplate(firstImported);
      } else {
        setTemplatesOpen(true);
      }
      if (strippedSnapshots) {
        toast.message(`已导入 ${imported} 个模板（本地空间不足，已移除预览图以确保落盘）`);
        return;
      }
      toast.success(`已导入 ${imported} 个模板`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      toast.error(`导入失败：${message}`);
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const openSaveTemplateDialog = (name: string) => {
    setOverwriteTemplateId('new');
    setTemplateName((name || '').trim() || `模板 ${new Date().toLocaleString()}`);
    setSaveTemplateOpen(true);
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = reader.result;
        if (typeof value !== 'string' || !value.startsWith('data:')) {
          reject(new Error('读取图片失败'));
          return;
        }
        resolve(value);
      };
      reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });

  const resolveImageNaturalSize = (dataUrl: string) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const width = Number(img.naturalWidth) || 0;
        const height = Number(img.naturalHeight) || 0;
        if (width <= 0 || height <= 0) {
          reject(new Error('无法读取图片尺寸'));
          return;
        }
        resolve({ width, height });
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });

  const createId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const computeZoneBboxNormalized = (
    zone: Pick<LayoutZone, 'x' | 'y' | 'width' | 'height'>,
    size: { width: number; height: number }
  ) => {
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    const x = zone.x / w;
    const y = zone.y / h;
    const ww = zone.width / w;
    const hh = zone.height / h;
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    return { x: clamp(x), y: clamp(y), w: clamp(ww), h: clamp(hh) };
  };

  const iouNormalized = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ) => {
    const ax2 = a.x + a.w;
    const ay2 = a.y + a.h;
    const bx2 = b.x + b.w;
    const by2 = b.y + b.h;
    const ix1 = Math.max(a.x, b.x);
    const iy1 = Math.max(a.y, b.y);
    const ix2 = Math.min(ax2, bx2);
    const iy2 = Math.min(ay2, by2);
    const iw = Math.max(0, ix2 - ix1);
    const ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    const areaA = Math.max(0, a.w) * Math.max(0, a.h);
    const areaB = Math.max(0, b.w) * Math.max(0, b.h);
    const union = areaA + areaB - inter;
    if (union <= 0) return 0;
    return inter / union;
  };

  const applyMainCandidate = (candidate: MainCandidate) => {
    setZones((prev) => {
      if (prev.length === 0) return prev;
      let bestIndex = -1;
      let bestScore = 0;
      prev.forEach((z, idx) => {
        const bb = computeZoneBboxNormalized(z, canvasSize);
        const score = iouNormalized(candidate.bboxNormalized, bb);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = idx;
        }
      });

      const existingMainIndex = prev.findIndex((z) => z.type === 'main');
      const next: LayoutZone[] = prev.map((z, idx) => {
        if (idx === bestIndex) {
          return { ...z, type: 'main', semanticColor: SEMANTIC_COLORS.main, zIndex: 1 };
        }
        if (idx === existingMainIndex) {
          return { ...z, type: 'prop', semanticColor: SEMANTIC_COLORS.prop, zIndex: Math.max(2, z.zIndex) };
        }
        return z;
      }) as LayoutZone[];

      if (bestIndex < 0 || bestScore < 0.08) {
        const x = Math.round(candidate.bboxNormalized.x * canvasSize.width);
        const y = Math.round(candidate.bboxNormalized.y * canvasSize.height);
        const width = Math.round(candidate.bboxNormalized.w * canvasSize.width);
        const height = Math.round(candidate.bboxNormalized.h * canvasSize.height);
        next.push({
          id: createId(),
          x,
          y,
          width,
          height,
          zIndex: 1,
          type: 'main',
          semanticColor: SEMANTIC_COLORS.main,
          prompt: '主商品 {PRODUCT}，清晰展示，符合该区域构图。',
        } satisfies LayoutZone);
      }

      return applyZoneEnrichment(next);
    });
  };

  const handleConfirmMainCandidate = (candidate: MainCandidate) => {
    const product = (candidate.product || '').trim();
    if (product && !(copyVariables.PRODUCT || '').toString().trim()) {
      setCopyVariables((prev) => ({ ...prev, PRODUCT: product }));
    }
    applyMainCandidate(candidate);
    setMainConfirmOpen(false);
    setMainCandidates([]);
    setMainConfidence(null);
    setMainReason('');
    if (pendingParsedTemplateName) {
      openSaveTemplateDialog(pendingParsedTemplateName);
      setPendingParsedTemplateName(null);
    }
    toast.success('已更新主体区域');
  };

  const cancelParseTemplate = () => {
    const controller = parseTemplateAbortRef.current;
    if (!controller || controller.signal.aborted) return;
    setParseTemplateCancelRequested(true);
    controller.abort();
  };

  const cancelProductTemplateGeneration = () => {
    const controller = productTemplateAbortRef.current;
    if (!controller || controller.signal.aborted) return;
    setProductTemplateCancelRequested(true);
    controller.abort();
  };

  const handleParseTemplateImage = async (
    file: File,
    options?: { outputLanguage?: 'auto' | 'zh' | 'en'; productHint?: string }
  ) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }
    if (isParsingTemplate) return;

    parseTemplateAbortRef.current?.abort();
    const controller = new AbortController();
    parseTemplateAbortRef.current = controller;
    setIsParsingTemplate(true);
    setParseTemplateStageIndex(0);
    setParseTemplateCancelRequested(false);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const nextCanvasSize = await resolveImageNaturalSize(dataUrl);
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const outputLanguage = options?.outputLanguage ?? 'auto';
      const productHint = (options?.productHint || '').trim();
      if (productHint && !(copyVariables.PRODUCT || '').toString().trim()) {
        setCopyVariables((prev) => ({ ...prev, PRODUCT: productHint }));
      }
      setParseTemplateStageIndex(1);
      const parsed = await parseSmartLayoutTemplateFromImage({
        image: dataUrl,
        outputLanguage,
        productHint,
        signal: controller.signal,
      });

      setParseTemplateStageIndex(2);
      const baseZones: LayoutZone[] = parsed.zones.map((z, idx) => {
        const x = Math.round(z.bboxNormalized.x * nextCanvasSize.width);
        const y = Math.round(z.bboxNormalized.y * nextCanvasSize.height);
        const width = Math.round(z.bboxNormalized.w * nextCanvasSize.width);
        const height = Math.round(z.bboxNormalized.h * nextCanvasSize.height);
        const baseZIndex =
          typeof z.zIndex === 'number'
            ? z.zIndex
            : z.type === 'background'
              ? 0
              : z.type === 'main'
                ? 1
                : 2 + idx;
        return {
          id: createId(),
          x,
          y,
          width,
          height,
          zIndex: baseZIndex,
          type: z.type,
          semanticColor: SEMANTIC_COLORS[z.type],
          prompt: z.prompt,
        };
      });

      setParseTemplateStageIndex(3);
      setCanvasSize(nextCanvasSize);
      setZones(baseZones);
      setSelectedZoneId(null);
      canvasRef.current?.clearSelection();
      currentRunIdRef.current = null;
      setResultSlots([]);
      setRequestedImageCount(1);
      setSelectedResultIndex(0);
      setResultOpen(false);
      if (!sidePanelOpen) setSidePanelOpen(true);
      if (!(copyVariables.PRODUCT || '').toString().trim() && (parsed.product || '').trim()) {
        setCopyVariables((prev) => ({ ...prev, PRODUCT: (parsed.product || '').trim() }));
      }
      setMainCandidates((parsed.mainCandidates || []) as MainCandidate[]);
      setMainConfidence(typeof parsed.mainConfidence === 'number' ? parsed.mainConfidence : null);
      setMainReason((parsed.mainReason || '').toString());

      toast.success('解析完成，已加载到画布');
      const fallbackName = `从图片解析 ${file.name.replace(/\.[^.]+$/, '')}`.trim();
      const shouldConfirmMain =
        (parsed.mainCandidates || []).length > 0 &&
        (typeof parsed.mainConfidence !== 'number' || parsed.mainConfidence < 0.8);
      if (shouldConfirmMain) {
        setPendingParsedTemplateName(parsed.name || fallbackName);
        setMainConfirmOpen(true);
      } else {
        openSaveTemplateDialog(parsed.name || fallbackName);
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) {
        toast.message('已取消解析');
      } else {
        const message = e instanceof Error ? e.message : '未知错误';
        toast.error(`解析失败：${message}`);
      }
    } finally {
      setIsParsingTemplate(false);
      setParseTemplateStageIndex(0);
      setParseTemplateCancelRequested(false);
      parseTemplateAbortRef.current = null;
      if (parseTemplateImageInputRef.current) parseTemplateImageInputRef.current.value = '';
    }
  };

  const handleGenerateTemplateFromProductImage = async (
    file: File,
    options?: { outputLanguage?: 'auto' | 'zh' | 'en'; productHint?: string; brief?: string; intent?: ProductTemplateIntentV1 }
  ) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }
    const intent =
      options?.intent && options.intent.schemaVersion === 1
        ? { ...defaultProductTemplateIntent, ...options.intent, copy: { ...defaultProductTemplateIntent.copy, ...(options.intent.copy || {}) } }
        : productTemplateIntent;
    const briefRaw = (options?.brief || '').trim();
    const brief = briefRaw || buildProductTemplateBriefFromIntent(intent);
    if (!brief.trim()) {
      toast.error('请先填写效果描述');
      return;
    }
    if (isGeneratingProductTemplate) return;

    productTemplateAbortRef.current?.abort();
    const controller = new AbortController();
    productTemplateAbortRef.current = controller;
    setIsGeneratingProductTemplate(true);
    setProductTemplateStageIndex(0);
    setProductTemplateCancelRequested(false);

    try {
      setProductTemplateIntent(intent);
      const dataUrl = await readFileAsDataUrl(file);
      const naturalCanvasSize = await resolveImageNaturalSize(dataUrl);
      const targetWRaw = intent.targetCanvasSizePx?.width;
      const targetHRaw = intent.targetCanvasSizePx?.height;
      const clamp = (n: number) => Math.max(200, Math.min(10000, Math.round(n)));
      const hasTarget =
        typeof targetWRaw === 'number' &&
        typeof targetHRaw === 'number' &&
        Number.isFinite(targetWRaw) &&
        Number.isFinite(targetHRaw) &&
        targetWRaw > 0 &&
        targetHRaw > 0;
      const nextCanvasSize = hasTarget ? { width: clamp(targetWRaw), height: clamp(targetHRaw) } : naturalCanvasSize;
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const outputLanguage = options?.outputLanguage ?? 'auto';
      const productHint = (options?.productHint || '').trim();
      if (productHint && !(copyVariables.PRODUCT || '').toString().trim()) {
        setCopyVariables((prev) => ({ ...prev, PRODUCT: productHint }));
      }
      setProductTemplateStageIndex(1);
      const parsed = await generateSmartLayoutTemplateFromProductImage({
        image: dataUrl,
        brief,
        outputLanguage,
        productHint,
        intent,
        signal: controller.signal,
      });

      setProductTemplateStageIndex(2);
      const baseZones: LayoutZone[] = parsed.zones.map((z, idx) => {
        const x = Math.round(z.bboxNormalized.x * nextCanvasSize.width);
        const y = Math.round(z.bboxNormalized.y * nextCanvasSize.height);
        const width = Math.round(z.bboxNormalized.w * nextCanvasSize.width);
        const height = Math.round(z.bboxNormalized.h * nextCanvasSize.height);
        const baseZIndex =
          typeof z.zIndex === 'number'
            ? z.zIndex
            : z.type === 'background'
              ? 0
              : z.type === 'main'
                ? 1
                : 2 + idx;
        return {
          id: createId(),
          x,
          y,
          width,
          height,
          zIndex: baseZIndex,
          type: z.type,
          semanticColor: SEMANTIC_COLORS[z.type],
          prompt: z.prompt,
        };
      });

      setProductTemplateStageIndex(3);
      setCanvasSize(nextCanvasSize);
      setZones(baseZones);
      setSelectedZoneId(null);
      canvasRef.current?.clearSelection();
      currentRunIdRef.current = null;
      setResultSlots([]);
      setRequestedImageCount(1);
      setSelectedResultIndex(0);
      setResultOpen(false);
      if (!sidePanelOpen) setSidePanelOpen(true);
      if (!(copyVariables.PRODUCT || '').toString().trim() && (parsed.product || '').trim()) {
        setCopyVariables((prev) => ({ ...prev, PRODUCT: (parsed.product || '').trim() }));
      }
      setMainCandidates((parsed.mainCandidates || []) as MainCandidate[]);
      setMainConfidence(typeof parsed.mainConfidence === 'number' ? parsed.mainConfidence : null);
      setMainReason((parsed.mainReason || '').toString());

      const parsedCopyVariables = parsed.copyVariables && Object.keys(parsed.copyVariables).length > 0 ? parsed.copyVariables : undefined;
      if (parsedCopyVariables) {
        setCopyVariables((prev) => {
          const next: SmartLayoutCopyVariables = { ...defaultCopyVariables, ...parsedCopyVariables };
          const resolvedProduct =
            productHint ||
            (next.PRODUCT || '').toString().trim() ||
            (parsed.product || '').trim() ||
            (prev.PRODUCT || '').toString().trim();
          if (resolvedProduct) next.PRODUCT = resolvedProduct;
          const bulletMax = intent.copy?.bulletCountMax ?? 3;
          for (let i = 1; i <= 5; i += 1) {
            const key = `BULLET_${i}` as keyof SmartLayoutCopyVariables;
            if (i > bulletMax) next[key] = '';
          }
          if (intent.copy?.allowPromoBadge === false) next.BADGE = '';
          if (intent.copy?.allowPrice === false) next.PRICE = '';
          return next;
        });
        if (!sidePanelOpen) setSidePanelOpen(true);
        setSidePanelTab('copy');
        toast.message('已生成推荐文案变量');
      } else {
        try {
          const suggested = await suggestSmartLayoutCopyVariables({
            intent,
            language: resolveBriefLanguage(brief),
            product: (productHint || parsed.product || '').trim() || (copyVariables.PRODUCT || '').toString().trim(),
            brief,
          });
          setCopyVariables((prev) => {
            const next: SmartLayoutCopyVariables = { ...defaultCopyVariables };
            const bulletMax = intent.copy?.bulletCountMax ?? 3;
            const setIfPresent = (k: keyof SmartLayoutCopyVariables, v: unknown) => {
              const raw = typeof v === 'string' ? v.trim() : '';
              if (raw) next[k] = raw;
            };
            setIfPresent('TITLE', (suggested as any).TITLE);
            setIfPresent('SUBTITLE', (suggested as any).SUBTITLE);
            setIfPresent('CTA', (suggested as any).CTA);
            setIfPresent('BADGE', (suggested as any).BADGE);
            setIfPresent('PRICE', (suggested as any).PRICE);
            for (let i = 1; i <= 5; i += 1) {
              const key = `BULLET_${i}` as keyof SmartLayoutCopyVariables;
              if (i <= bulletMax) setIfPresent(key, (suggested as any)[`BULLET_${i}`]);
              else next[key] = '';
            }
            if (intent.copy?.allowPromoBadge === false) next.BADGE = '';
            if (intent.copy?.allowPrice === false) next.PRICE = '';
            const resolvedProduct =
              productHint ||
              (parsed.product || '').trim() ||
              (prev.PRODUCT || '').toString().trim();
            if (resolvedProduct) next.PRODUCT = resolvedProduct;
            return next;
          });
          if (!sidePanelOpen) setSidePanelOpen(true);
          setSidePanelTab('copy');
          toast.message('已生成推荐文案变量');
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : '';
          if (message.includes('VITE_BIGMODEL_API_KEY')) {
            toast.message('未配置文案模型 Key，未生成推荐文案变量');
          }
        }
      }

      toast.success('已生成模板，已加载到画布');
      const fallbackName = `从商品图生成 ${file.name.replace(/\.[^.]+$/, '')}`.trim();
      const shouldConfirmMain =
        (parsed.mainCandidates || []).length > 0 &&
        (typeof parsed.mainConfidence !== 'number' || parsed.mainConfidence < 0.8);
      if (shouldConfirmMain) {
        setPendingParsedTemplateName(parsed.name || fallbackName);
        setMainConfirmOpen(true);
      } else {
        openSaveTemplateDialog(parsed.name || fallbackName);
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) {
        toast.message('已取消生成');
      } else {
        const message = e instanceof Error ? e.message : '未知错误';
        toast.error(`生成失败：${message}`);
      }
    } finally {
      setIsGeneratingProductTemplate(false);
      setProductTemplateStageIndex(0);
      setProductTemplateCancelRequested(false);
      productTemplateAbortRef.current = null;
      if (productTemplateImageInputRef.current) productTemplateImageInputRef.current.value = '';
    }
  };

  const draftSaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (zones.length === 0) return;
    if (draftSaveTimerRef.current) window.clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = window.setTimeout(() => {
      saveSmartLayoutDraft({
        canvasSize,
        zones: normalizedZones,
        settings,
        copyVariables,
        productTemplateIntent,
        generationContextSnapshot: generationContext,
      });
      setDraftExists(true);
    }, 700);
    return () => {
      if (draftSaveTimerRef.current) window.clearTimeout(draftSaveTimerRef.current);
    };
  }, [zones.length, normalizedZones, canvasSize, settings, copyVariables, productTemplateIntent, generationContext]);

  return (
    <div
      className={['w-full flex flex-col gap-3', shouldForwardHeightClass ? 'h-full min-h-0' : undefined]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={["relative w-full rounded-xl border border-white/10 bg-[#0a0a0f] overflow-hidden shadow-inner", rootHeightClass, className].filter(Boolean).join(' ')}
        style={rootHeightStyle}
      >
        <ProgressOverlay
          open={isGeneratingProductTemplate}
          title="正在生成布局…"
          description={productTemplateCancelRequested ? '正在取消本次生成，请稍候…' : '正在分析商品图并生成布局分区'}
          stages={productTemplateProgressStages}
          activeStageIndex={Math.min(productTemplateStageIndex, productTemplateProgressStages.length - 1)}
          cancelLabel={productTemplateCancelRequested ? '正在取消…' : '取消'}
          cancelDisabled={productTemplateCancelRequested}
          onCancel={cancelProductTemplateGeneration}
        />
        <ProgressOverlay
          open={isParsingTemplate}
          title="正在解析模板…"
          description={parseTemplateCancelRequested ? '正在取消本次解析，请稍候…' : '正在分析图片并生成布局分区'}
          stages={parseTemplateProgressStages}
          activeStageIndex={Math.min(parseTemplateStageIndex, parseTemplateProgressStages.length - 1)}
          cancelLabel={parseTemplateCancelRequested ? '正在取消…' : '取消'}
          cancelDisabled={parseTemplateCancelRequested}
          onCancel={cancelParseTemplate}
        />
      <div className="absolute top-0 left-0 right-0 h-14 bg-[#14141a] border-b border-white/10 flex items-center justify-between px-4 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">智能布局画布</span>
          <span className="text-xs text-white/60 bg-white/5 px-2 py-1 rounded">
            {canvasSize.width} × {canvasSize.height}
          </span>
        </div>

        <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-white/10 text-white/70 hover:text-white hover:bg-white/10">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                设置
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1c1c21] border-white/10 text-white w-[340px]">
              <DropdownMenuLabel className="text-white/70">画布尺寸</DropdownMenuLabel>
              <div className="px-2 pb-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={canvasWidthInput}
                    onChange={(e) => setCanvasWidthInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyCanvasSize();
                    }}
                    className="h-8 w-[96px] bg-white/5 border-white/10 text-white"
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
                    className="h-8 w-[96px] bg-white/5 border-white/10 text-white"
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
              </div>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-white/70">渲染风格</DropdownMenuLabel>
              <div className="px-2 pb-2">
                <Select
                  value={settings.layoutSketchRenderMode}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, layoutSketchRenderMode: v as SmartLayoutSettings['layoutSketchRenderMode'] }))}
                >
                  <SelectTrigger className="h-8 w-full bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="渲染风格" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1c1c21] border-white/10 text-white">
                    <SelectItem value="collage" className="focus:bg-white/10 focus:text-white">贴图布局图</SelectItem>
                    <SelectItem value="segmentation" className="focus:bg-white/10 focus:text-white">纯色布局图</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-white/70">显示与提示</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={sidePanelOpen} onCheckedChange={(checked) => setSidePanelOpen(Boolean(checked))}>
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
              <DropdownMenuCheckboxItem
                checked={settings.enableTwoStageGeneration}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableTwoStageGeneration: Boolean(checked) }))}
              >
                两阶段生成
              </DropdownMenuCheckboxItem>

              {(resultSlots.length > 0 || visibleResultHistory.length > 0) ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-white/70">历史记录</DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={resultSlots.length === 0}
                    onSelect={(e) => {
                      e.preventDefault();
                      setActiveResultId('current');
                      setResultOpen(true);
                    }}
                  >
                    当前结果
                  </DropdownMenuItem>
                  {visibleResultHistory.length > 0 && <DropdownMenuSeparator />}
                  {visibleResultHistory.map((entry) => (
                    <DropdownMenuItem
                      key={entry.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        setActiveResultId(entry.id);
                        setResultOpen(true);
                      }}
                    >
                      {new Date(entry.createdAt).toLocaleString()}
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-white/10 text-white/70 hover:text-white hover:bg-white/10">
                <Save className="mr-2 h-4 w-4" />
                保存/复用
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1c1c21] border-white/10 text-white">
              <DropdownMenuLabel className="text-white/70">模板</DropdownMenuLabel>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenSaveTemplate(); }}>
                <Save className="h-4 w-4" />
                保存为模板
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); refreshTemplates(); setTemplatesOpen(true); }}>
                <FolderOpen className="h-4 w-4" />
                打开模板库
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-white/70">填充画布</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={isParsingTemplate || isGenerating || isGeneratingProductTemplate}
                onSelect={(e) => {
                  e.preventDefault();
                  setParseTemplateSettingsOpen(true);
                }}
              >
                <Upload className="h-4 w-4" />
                {isParsingTemplate ? '解析中...' : '从商品设计图复刻布局'}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isGeneratingProductTemplate || isGenerating || isParsingTemplate}
                onSelect={(e) => {
                  e.preventDefault();
                  setProductTemplateSettingsOpen(true);
                }}
              >
                <Wand2 className="h-4 w-4" />
                {isGeneratingProductTemplate ? '生成中...' : '根据商品原型生成布局'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-white/70">草稿</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!draftExists}
                onSelect={(e) => {
                  e.preventDefault();
                  if (!draftExists) return;
                  setPendingDraftUpdatedAt(loadSmartLayoutDraft()?.updatedAt ?? null);
                  setDraftOfferOpen(true);
                }}
              >
                <RotateCcw className="h-4 w-4" />
                恢复草稿
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!draftExists}
                onSelect={(e) => {
                  e.preventDefault();
                  if (!draftExists) return;
                  clearSmartLayoutDraft();
                  setDraftExists(false);
                  toast.success('已清除草稿');
                }}
              >
                <Trash2 className="h-4 w-4" />
                清除草稿
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-white/70">本地缓存</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  clearSmartLayoutAssets();
                  setZones((prev) => prev.map((z) => (z.refImageId ? { ...z, refImageId: undefined } : z)));
                  toast.success('已清空素材库缓存');
                }}
              >
                <Trash2 className="h-4 w-4" />
                清空素材库缓存
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-white/70">导入/导出</DropdownMenuLabel>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleExportAllTemplates(); }}>
                <Download className="h-4 w-4" />
                导出全部模板
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); importInputRef.current?.click(); }}>
                <Upload className="h-4 w-4" />
                导入模板 JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setZones([]);
              currentRunIdRef.current = null;
              setResultSlots([]);
              setRequestedImageCount(1);
              setSelectedResultIndex(0);
              setResultOpen(false);
              canvasRef.current?.clearSelection();
              clearSmartLayoutDraft();
              setDraftExists(false);
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
            disabled={isGenerating}
            className="h-8 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
          >
            预览合成图
          </Button>
          {isGenerating ? (
            <Button
              variant="outline"
              size="sm"
              onClick={cancelGeneration}
              className="h-8 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            >
              停止
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={handleGenerateDirect}
            disabled={isGenerating}
            className={[
              'h-8 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 transition-all hover:scale-105',
              isGenerating ? 'opacity-80 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {isGenerating ? <Spinner className="mr-2 h-4 w-4 text-white/80" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {isGenerating ? '生成中...' : '立即生成'}
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

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportTemplates(file);
        }}
      />

      <input
        ref={parseTemplateImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleParseTemplateImage(file, parseTemplateOptionsRef.current);
        }}
      />
      <input
        ref={productTemplateImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleGenerateTemplateFromProductImage(file, productTemplateOptionsRef.current);
        }}
      />

      <div className="absolute top-14 left-0 right-0 bottom-0 overflow-hidden bg-[#0a0a0f]">
        <div className="h-full flex overflow-hidden">
          <div className="w-14 shrink-0 bg-[#101016] border-r border-white/10 flex flex-col items-center py-3 gap-2 overflow-y-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    refreshTemplates();
                    setTemplatesOpen(true);
                  }}
                  className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <FolderOpen className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>模板库</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenSaveTemplate()}
                  className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Save className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>保存模板</TooltipContent>
            </Tooltip>

            <div className="w-8 h-px bg-white/10 my-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isParsingTemplate || isGenerating || isGeneratingProductTemplate}
                  onClick={() => setParseTemplateSettingsOpen(true)}
                  className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
                >
                  <Upload className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {isParsingTemplate ? '解析中...' : '从商品设计图复刻布局'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isGeneratingProductTemplate || isGenerating || isParsingTemplate}
                  onClick={() => setProductTemplateSettingsOpen(true)}
                  className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
                >
                  <Wand2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {isGeneratingProductTemplate ? '生成中...' : '根据商品原型生成布局'}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex-1 min-w-0 min-h-0 overflow-auto p-6">
            <div className="min-w-max min-h-max flex items-center justify-center p-2">
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
              <Tabs value={sidePanelTab} onValueChange={(v) => setSidePanelTab(v as 'zone' | 'copy')} className="h-[calc(100%-48px)]">
                <div className="px-2 pt-2">
                  <TabsList className="w-full bg-white/5">
                    <TabsTrigger value="zone" className="flex-1">区域</TabsTrigger>
                    <TabsTrigger value="copy" className="flex-1">文案</TabsTrigger>
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

                <TabsContent value="copy" className="h-[calc(100%-56px)] mt-2 px-3 pb-3 overflow-auto">
                  <CopyVariablesPanel
                    variables={copyVariables}
                    requiredKeys={requiredCopyKeys}
                    onChange={(next) => setCopyVariables(next)}
                  />
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
                    setSidePanelTab('copy');
                  }}
                  className="h-10 w-10 text-white/60 hover:text-white hover:bg-white/10"
                >
                  文
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      <div className="w-full rounded-xl border border-white/10 bg-[#111116] px-4 py-4">
        <div className="text-xs text-white/60 mb-3">生成历史记录</div>
        {visibleResultHistory.length === 0 && resultSlots.length === 0 ? (
          <div className="text-xs text-white/40">暂无历史记录</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {resultSlots.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveResultId('current');
                  setResultOpen(true);
                }}
                className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 p-3 text-left"
              >
                <div className="text-xs text-white/70 mb-2">当前结果</div>
                <div className="aspect-[4/3] rounded-md overflow-hidden border border-white/10 bg-black/20 flex items-center justify-center">
                  {currentResultPreviewUrl ? (
                    <img src={currentResultPreviewUrl} alt="当前结果预览" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[11px] text-white/50">暂无成功图</span>
                  )}
                </div>
              </button>
            )}
            {visibleResultHistory.map((entry) => {
              const previewUrl = entry.slots.find((s) => s.url)?.url;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setActiveResultId(entry.id);
                    setResultOpen(true);
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 p-3 text-left"
                >
                  <div className="text-xs text-white/70 mb-2">{new Date(entry.createdAt).toLocaleString()}</div>
                  <div className="aspect-[4/3] rounded-md overflow-hidden border border-white/10 bg-black/20 flex items-center justify-center">
                    {previewUrl ? (
                      <img src={previewUrl} alt="历史记录预览" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px] text-white/50">暂无成功图</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

       {/* Preview Dialog */}
       <PreviewDialog 
         open={previewOpen}
         onOpenChange={setPreviewOpen}
         onConfirm={handleConfirmGenerate}
         onStop={cancelGeneration}
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
             <DialogTitle>
               <div className="flex items-center gap-2">
                 <span>{activeResultId === 'current' ? '生成结果' : '历史结果'}（{resultSuccessCount}/{displayRequestedImageCount}）</span>
                 {isGenerating ? <Spinner className="size-4 text-white/60" /> : null}
               </div>
             </DialogTitle>
             <DialogDescription className="sr-only">
               查看智能布局生成的图片结果与历史记录
             </DialogDescription>
           </DialogHeader>
           {displaySlots.length > 0 ? (
             <div className="w-full">
               <div className="w-full flex items-center justify-center">
                {selectedResult?.url ? (
                   <img
                     src={selectedResult.url}
                     alt="result"
                     className="max-h-[60vh] w-auto object-contain rounded-md border border-white/10"
                   />
                ) : selectedResult?.draftUrl ? (
                  <div className="relative">
                    <img
                      src={selectedResult.draftUrl}
                      alt="draft"
                      className="max-h-[60vh] w-auto object-contain rounded-md border border-white/10"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-[11px] text-white/80">
                      构图草稿
                    </div>
                    {selectedResult.status !== 'failed' && selectedResult.status !== 'cancelled' ? (
                      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-black/60 text-[11px] text-white/80">
                        <Spinner className="size-3 text-white/70" />
                        {selectedResult.phase === 'refine' ? '精修中' : '构图中'}
                      </div>
                    ) : null}
                  </div>
                 ) : (
                   <div className="h-[320px] w-full rounded-md border border-white/10 bg-white/5 flex flex-col items-center justify-center gap-2 text-white/70">
                     {selectedResult?.status === 'failed' ? <XCircle className="h-5 w-5 text-rose-300" /> : <Spinner className="size-5 text-white/60" />}
                     <div className="text-sm">
                      {selectedResult?.status === 'failed'
                        ? '生成失败'
                        : selectedResult?.status === 'cancelled'
                          ? '已停止'
                          : selectedResult?.phase === 'refine'
                            ? '精修中...'
                            : selectedResult?.phase === 'draft'
                              ? '构图中...'
                              : '生成中...'}
                     </div>
                     {selectedResult?.error ? <div className="text-xs text-white/45 max-w-[720px] px-4 text-center break-words">{selectedResult.error}</div> : null}
                   </div>
                 )}
               </div>
              {selectedResult?.draftUrl && selectedResult?.status === 'failed' && selectedResult?.error ? (
                <div className="mt-3 text-xs text-white/45 text-center break-words">{selectedResult.error}</div>
              ) : null}
              {displaySlots.length > 1 ? (
                 <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {displaySlots.map((slot, idx) => (
                     <button
                       key={`${slot.url || slot.status}-${idx}`}
                       type="button"
                       onClick={() => {
                         setSelectedResultIndex(idx);
                       }}
                       className={[
                         'aspect-square rounded-md overflow-hidden border bg-white/5 relative',
                         idx === selectedResultIndex ? 'border-violet-400/70' : 'border-white/10 hover:border-white/30',
                       ].join(' ')}
                     >
                       <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white/70">{idx + 1}</div>
                      {slot.url ? (
                         <img src={slot.url} alt={`result-${idx + 1}`} className="w-full h-full object-cover" />
                      ) : slot.draftUrl ? (
                        <>
                          <img src={slot.draftUrl} alt={`draft-${idx + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/55 text-[10px] text-white/75">
                            草稿
                          </div>
                          {slot.status !== 'failed' && slot.status !== 'cancelled' ? (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/55 text-[10px] text-white/75">
                              {slot.phase === 'refine' ? '精修' : '构图'}
                            </div>
                          ) : null}
                        </>
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white/60">
                           {slot.status === 'failed' ? <XCircle className="h-5 w-5 text-rose-300" /> : <Spinner className="size-5 text-white/60" />}
                           <div className="text-[11px]">
                            {slot.status === 'failed'
                              ? '失败'
                              : slot.status === 'cancelled'
                                ? '已停止'
                                : slot.phase === 'refine'
                                  ? '精修中'
                                  : slot.phase === 'draft'
                                    ? '构图中'
                                    : '生成中'}
                           </div>
                         </div>
                       )}
                     </button>
                   ))}
                 </div>
              ) : null}
             </div>
           ) : (
             <div className="text-white/60 text-sm">暂无结果</div>
           )}
          {visibleResultHistory.length > 0 && (
            <div className="border-t border-white/10 px-4 py-3">
              <div className="text-xs text-white/60 mb-2">历史记录</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[{ id: 'current', label: '当前结果', slots: resultSlots }, ...visibleResultHistory.map((entry) => ({
                  id: entry.id,
                  label: new Date(entry.createdAt).toLocaleString(),
                  slots: entry.slots,
                }))].map((entry) => {
                  const previewUrl = entry.slots.find((s) => s.url)?.url;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setActiveResultId(entry.id)}
                      className={[
                        'w-24 h-16 rounded-md border overflow-hidden flex-shrink-0 bg-white/5',
                        activeResultId === entry.id ? 'border-violet-400/70' : 'border-white/10 hover:border-white/30',
                      ].join(' ')}
                    >
                      {previewUrl ? (
                        <img src={previewUrl} alt={entry.label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-white/50 px-1 text-center">
                          暂无成功图
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
         </DialogContent>
       </Dialog>

       <Dialog open={variantOpen} onOpenChange={setVariantOpen}>
         <DialogContent className="sm:max-w-[1100px] bg-[#14141a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>风格变体结果</DialogTitle>
            <DialogDescription className="sr-only">查看智能布局的风格变体结果</DialogDescription>
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

       <Dialog open={draftOfferOpen} onOpenChange={setDraftOfferOpen}>
         <DialogContent className="sm:max-w-[520px] bg-[#14141a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>检测到草稿</DialogTitle>
            <DialogDescription className="sr-only">检测到未清理的智能布局草稿</DialogDescription>
          </DialogHeader>
           <div className="text-sm text-white/70">
             {pendingDraftUpdatedAt ? `上次保存：${new Date(pendingDraftUpdatedAt).toLocaleString()}` : '存在未清理的草稿，是否恢复？'}
           </div>
           <div className="flex justify-end gap-2 mt-4">
             <Button
               variant="outline"
               onClick={() => {
                 clearSmartLayoutDraft();
                 setDraftExists(false);
                 setDraftOfferOpen(false);
                 toast.success('已放弃草稿');
               }}
               className="border-white/10 text-white/80 hover:text-white hover:bg-white/10"
             >
               放弃
             </Button>
             <Button onClick={applyDraft} className="bg-violet-600 hover:bg-violet-700 text-white">
               恢复
             </Button>
           </div>
         </DialogContent>
       </Dialog>

       <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
         <DialogContent className="sm:max-w-[560px] bg-[#14141a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>保存为模板</DialogTitle>
            <DialogDescription className="sr-only">将当前智能布局保存为模板</DialogDescription>
          </DialogHeader>
           <div className="space-y-4">
             <div>
               <div className="text-xs text-white/70 mb-2">模板名称</div>
               <Input
                 value={templateName}
                 onChange={(e) => setTemplateName(e.target.value)}
                 className="h-9 bg-white/5 border-white/10 text-white"
               />
             </div>
             <div>
               <div className="text-xs text-white/70 mb-2">保存方式</div>
               <Select value={overwriteTemplateId} onValueChange={setOverwriteTemplateId}>
                 <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white">
                   <SelectValue placeholder="选择保存方式" />
                 </SelectTrigger>
                 <SelectContent className="bg-[#1c1c21] border-white/10 text-white">
                   <SelectItem value="new" className="focus:bg-white/10 focus:text-white">保存为新模板</SelectItem>
                   {templates.length > 0 && (
                     <>
                       <SelectItem value="__sep__" disabled className="opacity-50">覆盖已有模板</SelectItem>
                       {templates.map((t) => (
                         <SelectItem key={t.id} value={t.id} className="focus:bg-white/10 focus:text-white">
                           {t.name}
                         </SelectItem>
                       ))}
                     </>
                   )}
                 </SelectContent>
               </Select>
             </div>
             <div className="flex justify-end gap-2">
               <Button variant="outline" onClick={() => setSaveTemplateOpen(false)} className="border-white/10 text-white/80 hover:text-white hover:bg-white/10">
                 取消
               </Button>
               <Button onClick={handleSaveTemplate} className="bg-violet-600 hover:bg-violet-700 text-white">
                 保存
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>

       <Dialog open={mainConfirmOpen} onOpenChange={setMainConfirmOpen}>
         <DialogContent className="sm:max-w-[680px] bg-[#14141a] border-white/10 text-white">
           <DialogHeader>
             <DialogTitle>确认主体区域</DialogTitle>
             <DialogDescription className="sr-only">选择主商品主体区域</DialogDescription>
           </DialogHeader>
           <div className="space-y-3">
             <div className="text-sm text-white/70">
               {typeof mainConfidence === 'number'
                 ? `主体识别置信度：${Math.round(mainConfidence * 100)}%`
                 : '主体识别置信度：未知'}
             </div>
             {(mainReason || '').trim() ? (
               <div className="text-xs text-white/60">原因：{mainReason}</div>
             ) : null}
             <div className="text-xs text-white/60">请选择最符合“主商品主体”的候选区域（模型最多给出 3 个）。</div>
             <div className="grid grid-cols-1 gap-2">
               {mainCandidates.map((c, idx) => (
                 <button
                   key={`cand-${idx}`}
                   type="button"
                   onClick={() => handleConfirmMainCandidate(c)}
                   className="w-full text-left rounded-md border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2"
                 >
                   <div className="flex items-center justify-between gap-3">
                     <div className="text-sm text-white/80 truncate">
                       候选 {idx + 1}
                       {c.product ? `：${c.product}` : ''}
                     </div>
                     <div className="text-xs text-white/60 shrink-0">{Math.round((c.confidence || 0) * 100)}%</div>
                   </div>
                   <div className="text-xs text-white/60 mt-1">{c.reason}</div>
                 </button>
               ))}
             </div>
             <div className="flex justify-end gap-2 pt-2">
               <Button
                 variant="outline"
                 onClick={() => {
                   setMainConfirmOpen(false);
                   setMainCandidates([]);
                   setMainConfidence(null);
                   setMainReason('');
                   if (pendingParsedTemplateName) {
                     openSaveTemplateDialog(pendingParsedTemplateName);
                     setPendingParsedTemplateName(null);
                   }
                 }}
                 className="border-white/10 text-white/80 hover:text-white hover:bg-white/10"
               >
                 暂不处理
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>

       <Dialog open={parseTemplateSettingsOpen} onOpenChange={setParseTemplateSettingsOpen}>
         <DialogContent className="sm:max-w-[520px] bg-[#14141a] border-white/10 text-white">
           <DialogHeader>
             <DialogTitle>解析模板设置</DialogTitle>
             <DialogDescription className="sr-only">上传图片解析为布局模板的设置</DialogDescription>
           </DialogHeader>
           <div className="space-y-4">
             <div>
               <div className="text-xs text-white/70 mb-2">输出提示词语言</div>
               <Select
                 value={parseTemplateOutputLanguage}
                 onValueChange={(v) => setParseTemplateOutputLanguage(v as any)}
               >
                 <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white">
                   <SelectValue placeholder="选择语言" />
                 </SelectTrigger>
                 <SelectContent className="bg-[#1c1c21] border-white/10 text-white">
                   <SelectItem value="auto" className="focus:bg-white/10 focus:text-white">自动</SelectItem>
                   <SelectItem value="zh" className="focus:bg-white/10 focus:text-white">中文</SelectItem>
                   <SelectItem value="en" className="focus:bg-white/10 focus:text-white">英文</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div>
               <div className="text-xs text-white/70 mb-2">图片中的商品主体（可选）</div>
               <Input
                 value={parseTemplateProductHint}
                 onChange={(e) => setParseTemplateProductHint(e.target.value)}
                 className="h-9 bg-white/5 border-white/10 text-white"
                 placeholder="例如：奶牛玩偶 / 积木玩具"
               />
               <div className="text-xs text-white/50 mt-2">填入后，模型会优先按该主体识别主区域并生成可复用模板。</div>
             </div>
             <div className="flex justify-end gap-2">
               <Button
                 variant="outline"
                 onClick={() => setParseTemplateSettingsOpen(false)}
                 className="border-white/10 text-white/80 hover:text-white hover:bg-white/10"
               >
                 取消
               </Button>
               <Button
                 disabled={isParsingTemplate || isGenerating}
                 onClick={() => {
                   parseTemplateOptionsRef.current = {
                     outputLanguage: parseTemplateOutputLanguage,
                     productHint: parseTemplateProductHint,
                   };
                   setParseTemplateSettingsOpen(false);
                   parseTemplateImageInputRef.current?.click();
                 }}
                 className="bg-violet-600 hover:bg-violet-700 text-white"
               >
                 选择图片并解析
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>

      <Dialog open={productTemplateSettingsOpen} onOpenChange={setProductTemplateSettingsOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto bg-[#14141a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>商品图生成模板</DialogTitle>
            <DialogDescription className="sr-only">上传商品图与效果描述生成布局模板</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Accordion
              type="single"
              collapsible
              value={productTemplateIntentAdvancedOpen ? 'intent' : undefined}
              onValueChange={(v) => setProductTemplateIntentAdvancedOpen(v === 'intent')}
              className="rounded-lg border border-white/10 bg-white/5"
            >
              <AccordionItem value="intent" className="border-0">
                <AccordionTrigger className="py-3 px-3 hover:no-underline">
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-white/75 shrink-0">高级意图</div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {[
                          labelProductTemplateImageType(productTemplateIntent.imageType).split('（')[0],
                          productTemplateIntent.platformId ? labelProductTemplatePlatform(productTemplateIntent.platformId) : '不限平台',
                          productTemplateIntent.sizePreset ? labelProductTemplateSizePreset(productTemplateIntent.sizePreset) : '不限比例',
                          `密度${labelProductTemplateDensity(productTemplateIntent.infoDensity)}`,
                          productTemplateIntent.stylePreset ? labelProductTemplateStyle(productTemplateIntent.stylePreset) : '中性',
                          `卖点≤${productTemplateIntent.copy?.bulletCountMax ?? 3}`,
                        ].map((t) => (
                          <Badge key={t} variant="secondary" className="bg-white/10 text-white/75 border border-white/10">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-white/45">可展开配置，用于更稳定生成模板，并让 AI 优化更贴合目标。</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="text-xs text-white/70">意图卡</div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setProductTemplateBrief(buildProductTemplateBriefFromIntent(productTemplateIntent));
                          setIsProductTemplateBriefEdited(false);
                        }}
                        className="h-7 border-white/10 text-white/80 hover:text-white hover:bg-white/10"
                      >
                        写入描述
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const built = buildProductTemplateBriefFromIntent(productTemplateIntent);
                          setProductTemplateBrief((prev) => {
                            const raw = (prev || '').trim();
                            return raw ? `${raw}\n\n${built}` : built;
                          });
                          setIsProductTemplateBriefEdited(true);
                        }}
                        className="h-7 border-white/10 text-white/80 hover:text-white hover:bg-white/10"
                      >
                        追加
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-md border border-white/10 bg-[#14141a] px-3 py-2">
                      <div className="text-xs text-white/60 mb-2">图型</div>
                      <ToggleGroup
                        type="single"
                        value={productTemplateIntent.imageType}
                        onValueChange={(v) => {
                          if (!v) return;
                          setProductTemplateIntent((prev) => ({ ...prev, imageType: v as ProductTemplateImageType }));
                        }}
                        variant="outline"
                        size="sm"
                        spacing={0}
                        className="flex flex-wrap"
                      >
                        <ToggleGroupItem value="main">主图</ToggleGroupItem>
                        <ToggleGroupItem value="detail">详情</ToggleGroupItem>
                        <ToggleGroupItem value="comparison">对比</ToggleGroupItem>
                        <ToggleGroupItem value="size">尺寸</ToggleGroupItem>
                        <ToggleGroupItem value="scene">场景</ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    <div className="rounded-md border border-white/10 bg-[#14141a] px-3 py-2">
                      <div className="text-xs text-white/60 mb-2">平台与尺寸</div>
                      <div className="space-y-2">
                        <ToggleGroup
                          type="single"
                          value={productTemplateIntent.platformId || 'none'}
                          onValueChange={(v) => {
                            if (!v) return;
                            if (v === 'none') {
                              setProductTemplateIntent((prev) => ({ ...prev, platformId: undefined }));
                              return;
                            }
                            setProductTemplateIntent((prev) => ({ ...prev, platformId: v as ProductTemplatePlatformId }));
                          }}
                          variant="outline"
                          size="sm"
                          spacing={0}
                          className="flex flex-wrap"
                        >
                          <ToggleGroupItem value="amazon">Amazon</ToggleGroupItem>
                          <ToggleGroupItem value="temu">Temu</ToggleGroupItem>
                          <ToggleGroupItem value="tiktok">TikTok</ToggleGroupItem>
                          <ToggleGroupItem value="shopee">Shopee</ToggleGroupItem>
                          <ToggleGroupItem value="none">不限</ToggleGroupItem>
                        </ToggleGroup>
                        <ToggleGroup
                          type="single"
                          value={productTemplateIntent.sizePreset || 'none'}
                          onValueChange={(v) => {
                            if (!v) return;
                            if (v === 'none') {
                              setProductTemplateIntent((prev) => ({ ...prev, sizePreset: undefined }));
                              return;
                            }
                            setProductTemplateIntent((prev) => ({ ...prev, sizePreset: v as ProductTemplateSizePreset }));
                          }}
                          variant="outline"
                          size="sm"
                          spacing={0}
                          className="flex flex-wrap"
                        >
                          <ToggleGroupItem value="none">不限</ToggleGroupItem>
                          <ToggleGroupItem value="1:1">1:1</ToggleGroupItem>
                          <ToggleGroupItem value="3:4">3:4</ToggleGroupItem>
                          <ToggleGroupItem value="4:5">4:5</ToggleGroupItem>
                          <ToggleGroupItem value="16:9">16:9</ToggleGroupItem>
                          <ToggleGroupItem value="9:16">9:16</ToggleGroupItem>
                          <ToggleGroupItem value="long">长图</ToggleGroupItem>
                        </ToggleGroup>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <div className="text-[11px] text-white/50">目标宽(px)</div>
                            <Input
                              value={
                                typeof productTemplateIntent.targetCanvasSizePx?.width === 'number'
                                  ? String(productTemplateIntent.targetCanvasSizePx.width)
                                  : ''
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                const n = Number(raw);
                                setProductTemplateIntent((prev) => {
                                  const nextSize = { ...(prev.targetCanvasSizePx || {}) } as { width?: number; height?: number };
                                  if (!raw.trim()) {
                                    delete nextSize.width;
                                  } else if (Number.isFinite(n) && n > 0) {
                                    nextSize.width = Math.round(n);
                                  } else {
                                    nextSize.width = undefined;
                                  }
                                  const keep = typeof nextSize.width === 'number' || typeof nextSize.height === 'number';
                                  return { ...prev, targetCanvasSizePx: keep ? nextSize : undefined };
                                });
                              }}
                              className="h-8 bg-white/5 border-white/10 text-white"
                              inputMode="numeric"
                              placeholder="留空"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] text-white/50">目标高(px)</div>
                            <Input
                              value={
                                typeof productTemplateIntent.targetCanvasSizePx?.height === 'number'
                                  ? String(productTemplateIntent.targetCanvasSizePx.height)
                                  : ''
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                const n = Number(raw);
                                setProductTemplateIntent((prev) => {
                                  const nextSize = { ...(prev.targetCanvasSizePx || {}) } as { width?: number; height?: number };
                                  if (!raw.trim()) {
                                    delete nextSize.height;
                                  } else if (Number.isFinite(n) && n > 0) {
                                    nextSize.height = Math.round(n);
                                  } else {
                                    nextSize.height = undefined;
                                  }
                                  const keep = typeof nextSize.width === 'number' || typeof nextSize.height === 'number';
                                  return { ...prev, targetCanvasSizePx: keep ? nextSize : undefined };
                                });
                              }}
                              className="h-8 bg-white/5 border-white/10 text-white"
                              inputMode="numeric"
                              placeholder="留空"
                            />
                          </div>
                        </div>
                        <div className="text-[11px] text-white/45">留空则使用上传商品图的自然宽高。</div>
                      </div>
                    </div>

                    <div className="rounded-md border border-white/10 bg-[#14141a] px-3 py-2">
                      <div className="text-xs text-white/60 mb-2">信息密度</div>
                      <ToggleGroup
                        type="single"
                        value={productTemplateIntent.infoDensity}
                        onValueChange={(v) => {
                          if (!v) return;
                          setProductTemplateIntent((prev) => ({ ...prev, infoDensity: v as ProductTemplateInfoDensity }));
                        }}
                        variant="outline"
                        size="sm"
                        spacing={0}
                        className="flex flex-wrap"
                      >
                        <ToggleGroupItem value="low">少</ToggleGroupItem>
                        <ToggleGroupItem value="medium">中</ToggleGroupItem>
                        <ToggleGroupItem value="high">多</ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    <div className="rounded-md border border-white/10 bg-[#14141a] px-3 py-2">
                      <div className="text-xs text-white/60 mb-2">风格</div>
                      <ToggleGroup
                        type="single"
                        value={productTemplateIntent.stylePreset || 'none'}
                        onValueChange={(v) => {
                          if (!v) return;
                          if (v === 'none') {
                            setProductTemplateIntent((prev) => ({ ...prev, stylePreset: undefined }));
                            return;
                          }
                          setProductTemplateIntent((prev) => ({ ...prev, stylePreset: v as ProductTemplateStylePreset }));
                        }}
                        variant="outline"
                        size="sm"
                        spacing={0}
                        className="flex flex-wrap"
                      >
                        <ToggleGroupItem value="none">中性</ToggleGroupItem>
                        <ToggleGroupItem value="brand">品牌</ToggleGroupItem>
                        <ToggleGroupItem value="minimal">极简</ToggleGroupItem>
                        <ToggleGroupItem value="tech">科技</ToggleGroupItem>
                        <ToggleGroupItem value="cute">可爱</ToggleGroupItem>
                        <ToggleGroupItem value="luxury">高级</ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    <div className="rounded-md border border-white/10 bg-[#14141a] px-3 py-2">
                      <div className="text-xs text-white/60 mb-2">文案与卖点</div>
                      <div className="space-y-3">
                        <div>
                          <div className="text-[11px] text-white/50 mb-2">卖点上限</div>
                          <ToggleGroup
                            type="single"
                            value={String(productTemplateIntent.copy?.bulletCountMax ?? 3)}
                            onValueChange={(v) => {
                              if (!v) return;
                              const next = Math.max(0, Math.min(5, Number(v) || 0)) as 0 | 1 | 2 | 3 | 4 | 5;
                              setProductTemplateIntent((prev) => ({ ...prev, copy: { ...(prev.copy || {}), bulletCountMax: next } }));
                            }}
                            variant="outline"
                            size="sm"
                            spacing={0}
                            className="flex flex-wrap"
                          >
                            <ToggleGroupItem value="0">0</ToggleGroupItem>
                            <ToggleGroupItem value="1">1</ToggleGroupItem>
                            <ToggleGroupItem value="2">2</ToggleGroupItem>
                            <ToggleGroupItem value="3">3</ToggleGroupItem>
                            <ToggleGroupItem value="4">4</ToggleGroupItem>
                            <ToggleGroupItem value="5">5</ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                        <div>
                          <div className="text-[11px] text-white/50 mb-2">标题字数上限</div>
                          <ToggleGroup
                            type="single"
                            value={String(productTemplateIntent.copy?.titleCharLimit ?? 0)}
                            onValueChange={(v) => {
                              if (!v) return;
                              const n = Number(v) || 0;
                              setProductTemplateIntent((prev) => ({ ...prev, copy: { ...(prev.copy || {}), titleCharLimit: n > 0 ? n : undefined } }));
                            }}
                            variant="outline"
                            size="sm"
                            spacing={0}
                            className="flex flex-wrap"
                          >
                            <ToggleGroupItem value="0">不限</ToggleGroupItem>
                            <ToggleGroupItem value="10">10</ToggleGroupItem>
                            <ToggleGroupItem value="15">15</ToggleGroupItem>
                            <ToggleGroupItem value="20">20</ToggleGroupItem>
                            <ToggleGroupItem value="30">30</ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2">
                            <div className="text-[11px] text-white/70">允许角标</div>
                            <Switch
                              checked={Boolean(productTemplateIntent.copy?.allowPromoBadge)}
                              onCheckedChange={(checked) =>
                                setProductTemplateIntent((prev) => ({ ...prev, copy: { ...(prev.copy || {}), allowPromoBadge: Boolean(checked) } }))
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2">
                            <div className="text-[11px] text-white/70">允许价格</div>
                            <Switch
                              checked={Boolean(productTemplateIntent.copy?.allowPrice)}
                              onCheckedChange={(checked) =>
                                setProductTemplateIntent((prev) => ({ ...prev, copy: { ...(prev.copy || {}), allowPrice: Boolean(checked) } }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs text-white/70">效果描述（必填）</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating || isParsingTemplate || isGeneratingProductTemplate || isPolishingProductTemplateBrief}
                  onClick={handlePolishProductTemplateBrief}
                  className="h-7 border-white/10 text-white/80 hover:text-white hover:bg-white/10"
                >
                  {isPolishingProductTemplateBrief ? <Spinner className="mr-2 h-3.5 w-3.5 text-white/80" /> : null}
                  AI 优化提示词
                </Button>
              </div>
              <Textarea
                value={productTemplateBrief}
                onChange={(e) => {
                  setIsProductTemplateBriefEdited(true);
                  setProductTemplateBrief(e.target.value);
                }}
                className="min-h-24 bg-white/5 border-white/10 text-white"
                placeholder="例如：跨境主图风格，左主右文案，强对比背景，3个卖点标签，整体高级科技感；标题文字为：BUY 1 GET 1"
              />
              <div className="text-xs text-white/50 mt-2">描述越清晰，区域划分与文案区建议越稳定。</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/70 mb-2">输出提示词语言</div>
                <Select
                  value={productTemplateOutputLanguage}
                  onValueChange={(v) => setProductTemplateOutputLanguage(v as any)}
                >
                  <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="选择语言" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1c1c21] border-white/10 text-white">
                    <SelectItem value="auto" className="focus:bg-white/10 focus:text-white">自动</SelectItem>
                    <SelectItem value="zh" className="focus:bg-white/10 focus:text-white">中文</SelectItem>
                    <SelectItem value="en" className="focus:bg-white/10 focus:text-white">英文</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs text-white/70 mb-2">商品主体（可选）</div>
                <Input
                  value={productTemplateProductHint}
                  onChange={(e) => setProductTemplateProductHint(e.target.value)}
                  className="h-9 bg-white/5 border-white/10 text-white"
                  placeholder="例如：电热水壶 / 蓝牙耳机"
                />
                <div className="text-xs text-white/50 mt-2">填入后会优先作为 {'{PRODUCT}'} 默认值与主体识别提示。</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setProductTemplateSettingsOpen(false)}
                className="border-white/10 text-white/80 hover:text-white hover:bg-white/10"
              >
                取消
              </Button>
              <Button
                disabled={isGeneratingProductTemplate || isGenerating || isParsingTemplate}
                onClick={() => {
                  const finalBrief = composeProductTemplateFinalBrief(productTemplateIntent, productTemplateBrief, isProductTemplateBriefEdited);
                  productTemplateOptionsRef.current = {
                    outputLanguage: productTemplateOutputLanguage,
                    productHint: productTemplateProductHint,
                    brief: finalBrief,
                    intent: productTemplateIntent,
                  };
                  setProductTemplateSettingsOpen(false);
                  productTemplateImageInputRef.current?.click();
                }}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                选择商品图并生成
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="sm:max-w-[980px] max-h-[85vh] overflow-y-auto bg-[#14141a] border-white/10 text-white">
           <DialogHeader>
             <DialogTitle>模板库</DialogTitle>
             <DialogDescription className="sr-only">查看与管理智能布局模板</DialogDescription>
           </DialogHeader>
           <div className="flex items-center justify-between gap-2">
             <div className="text-xs text-white/60">共 {templates.length} 个</div>
             <div className="flex items-center gap-2">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={handleOpenSaveTemplate}
                 className="border-white/10 text-white/80 hover:text-white hover:bg-white/10"
               >
                 <Save className="mr-2 h-4 w-4" />
                 保存当前为模板
               </Button>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={handleExportAllTemplates}
                 className="border-white/10 text-white/80 hover:text-white hover:bg-white/10"
               >
                 <Download className="mr-2 h-4 w-4" />
                 导出全部
               </Button>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => importInputRef.current?.click()}
                 className="border-white/10 text-white/80 hover:text-white hover:bg-white/10"
               >
                 <Upload className="mr-2 h-4 w-4" />
                 导入
               </Button>
             </div>
           </div>
           {templates.length === 0 ? (
             <div className="text-sm text-white/60 py-10 text-center">暂无模板</div>
           ) : (
             <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {templates.map((t) => (
                 <div key={t.id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                   <div className="h-[140px] bg-black/20 flex items-center justify-center">
                     {t.snapshotDataUrl ? (
                       <img src={t.snapshotDataUrl} alt={t.name} className="h-full w-full object-contain" />
                     ) : (
                       <div className="text-xs text-white/40">无预览</div>
                     )}
                   </div>
                   <div className="p-3">
                     <div className="text-sm text-white/80 truncate">{t.name}</div>
                     <div className="mt-1 text-[11px] text-white/50">
                       更新于 {new Date(t.updatedAt || t.createdAt).toLocaleString()}
                     </div>
                     <div className="mt-3 flex items-center justify-between gap-2">
                       <Button
                         size="sm"
                         onClick={() => applyTemplate(t)}
                         className="bg-violet-600 hover:bg-violet-700 text-white"
                       >
                         应用
                       </Button>
                       <div className="flex items-center gap-2">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => {
                             downloadJsonFile(`smart-layout-template-${t.id}.json`, t);
                             toast.success('已导出模板');
                           }}
                           className="border-white/10 text-white/80 hover:text-white hover:bg-white/10"
                         >
                           导出
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => {
                             deleteSmartLayoutTemplate(t.id);
                             refreshTemplates();
                             toast.success('已删除模板');
                           }}
                           className="border-white/10 text-white/80 hover:text-white hover:bg-white/10"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </DialogContent>
       </Dialog>
    </div>
  );
}
