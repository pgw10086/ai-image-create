export const SEMANTIC_COLORS = {
  background: '#E2E8F0', // Slate-200 (Grey)
  prop: '#86EFAC',       // Green-300
  main: '#FCA5A5',       // Red-300
} as const;

export type LocationHint =
  | 'Top-Left'
  | 'Top-Center'
  | 'Top-Right'
  | 'Center-Left'
  | 'Center'
  | 'Center-Right'
  | 'Bottom-Left'
  | 'Bottom-Center'
  | 'Bottom-Right';

export interface LayoutZone {
  id: string;          // UUID
  x: number;           // 左上角 X 坐标
  y: number;           // 左上角 Y 坐标
  width: number;
  height: number;
  zIndex: number;
  type: 'background' | 'prop' | 'main'; // 区域类型
  semanticColor: string; // 自动绑定上述颜色
  sketchColor?: string; // 布局草图使用的色块颜色（用于区分同类型多个区域）
  locked?: boolean; // 锁定后不可拖拽/缩放（避免满屏层干扰操作）
  prompt?: string;     // 提示词
  refImageId?: string;
  refImage?: string;   // 兼容旧数据
  autoCaption?: string; // AI 反推的描述
  bboxNormalized?: { x: number; y: number; w: number; h: number }; // 0~1
  locationHint?: LocationHint;
  coveredZoneIds?: string[]; // 当前 Zone 覆盖了哪些 Zone（用于生成 DEPTH_TREE）
}

export interface SmartLayoutAsset {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

export interface SmartLayoutSettings {
  layoutSketchRenderMode: 'collage' | 'segmentation'; // 贴图布局图 | 纯色布局图
  showSketchPreviewWithImages: boolean; // 预览时是否展示贴图（仅影响预览，不影响生成时的真实 renderMode）
  enableRegionPrompts: boolean; // 在最终 Prompt 中输出 REGION_PROMPTS 段落（默认开启）
  enableDepthTree: boolean; // 输出 DEPTH_TREE 段落（默认开启）
  enableTwoStageGeneration: boolean; // 两阶段生成：先构图草稿再精修（默认开启）
}

export type BuiltInCopyVariableKey =
  | 'PRODUCT'
  | 'TITLE'
  | 'SUBTITLE'
  | 'CTA'
  | 'BADGE'
  | 'PRICE'
  | `BULLET_${1 | 2 | 3 | 4 | 5}`;

export type CopyVariableKey = BuiltInCopyVariableKey | (string & {});

export type SmartLayoutCopyVariables = Partial<Record<CopyVariableKey, string>>;

export type ProductTemplateImageType = 'main' | 'detail' | 'comparison' | 'size' | 'scene';
export type ProductTemplateInfoDensity = 'low' | 'medium' | 'high';
export type ProductTemplateStylePreset =
  | 'brand'
  | 'minimal'
  | 'tech'
  | 'cute'
  | 'warm'
  | 'luxury'
  | 'fresh'
  | 'retro';

export type ProductTemplatePlatformId =
  | 'amazon'
  | 'temu'
  | 'shopee'
  | 'tiktok'
  | 'aliexpress'
  | 'alibaba'
  | 'lazada'
  | 'ebay'
  | 'shein'
  | 'other';

export type ProductTemplateSizePreset =
  | '1:1'
  | '3:4'
  | '4:5'
  | '2:3'
  | '16:9'
  | '9:16'
  | 'long';

export type ProductTemplateIntentV1 = {
  schemaVersion: 1;
  imageType: ProductTemplateImageType;
  platformId?: ProductTemplatePlatformId;
  sizePreset?: ProductTemplateSizePreset;
  targetCanvasSizePx?: { width?: number; height?: number };
  infoDensity: ProductTemplateInfoDensity;
  stylePreset?: ProductTemplateStylePreset;
  copy: {
    bulletCountMax: 0 | 1 | 2 | 3 | 4 | 5;
    titleCharLimit?: number;
    allowPrice?: boolean;
    allowPromoBadge?: boolean;
  };
};

export interface SmartLayoutDraftV1 {
  schemaVersion: 1;
  updatedAt: number;
  canvasSize: { width: number; height: number };
  zones: LayoutZone[];
  settings: SmartLayoutSettings;
  copyVariables?: SmartLayoutCopyVariables;
  productTemplateIntent?: ProductTemplateIntentV1;
  generationContextSnapshot?: {
    platformId?: string;
    language?: 'zh' | 'en';
    model?: string;
    imageCount?: number;
    ratioMode?: string;
    stylePreset?: string;
    scene?: string;
  };
}

export interface SmartLayoutTemplateV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  snapshotDataUrl?: string;
  origin?: 'default' | 'user' | 'imported';
  originSourceId?: string;
  payload: {
    canvasSize: { width: number; height: number };
    zones: LayoutZone[];
    settings: SmartLayoutSettings;
    copyVariables?: SmartLayoutCopyVariables;
    productTemplateIntent?: ProductTemplateIntentV1;
    generationContextSnapshot?: SmartLayoutDraftV1['generationContextSnapshot'];
  };
}

export interface SmartCanvasProps {
  zones: LayoutZone[];
  onChange: (newZones: LayoutZone[]) => void;
  onSelect: (zoneId: string | null) => void; // null 代表取消选中
  canvasSize: { width: number; height: number };
  drawMode?: boolean;
  getRefImageSrc?: (zone: LayoutZone) => string | undefined;
}

export interface LayoutCompositionRequest {
  zones: LayoutZone[];
  canvasSize: { width: number; height: number };
  renderMode: 'collage' | 'segmentation';
  context?: GenerationContext;
  assets?: SmartLayoutAsset[];
  promptSettings?: {
    enableRegionPrompts?: boolean;
    enableDepthTree?: boolean;
  };
}

export type PromptStrategy = 'concat' | 'weighted';

export interface GenerationContext {
  scene: 'single' | 'detail' | 'crossborder' | 'brand';
  platformId?:
    | 'amazon'
    | 'temu'
    | 'shopee'
    | 'tiktok'
    | 'aliexpress'
    | 'alibaba'
    | 'lazada'
    | 'ebay'
    | 'shein';
  platform?:
    | 'amazon'
    | 'temu'
    | 'shopee'
    | 'tiktok'
    | 'aliexpress'
    | 'alibaba'
    | 'lazada'
    | 'ebay'
    | 'shein';
  language?: 'zh' | 'en';
  model?: string;
  imageCount?: number;
  ratioMode?: 'smart' | 'fixed';
  stylePreset?: string;
  size?: string;
  allowText?: boolean;
}

export interface RegionPrompt {
  regionNo: number;
  id: string;
  type: 'background' | 'prop' | 'main';
  zIndex: number;
  locationHint: string;
  bbox: { x: number; y: number; w: number; h: number };
  prompt: string;
  hasReferenceImage: boolean;
}

export interface DepthTreeNode {
  regionNo: number;
  id: string;
  zIndex: number;
  overlaps: string[];
}

export interface LayoutCompositionResult {
  layoutSketchBase64: string;
  referenceImages: string[];
  combinedPrompt: string;
  globalPrompt: string;
  regionPrompts: RegionPrompt[];
  depthTree: DepthTreeNode[];
  generateParams: {
    prompt: string;
    image: string[];
    size?: string;
    model?: string;
    guidance_scale?: number;
    sequential_image_generation: 'disabled';
  };
  size: string;
}
