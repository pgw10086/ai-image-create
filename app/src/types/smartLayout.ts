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
}

export type PromptStrategy = 'concat' | 'weighted';

export interface GenerationContext {
  scene: 'single' | 'detail' | 'crossborder' | 'brand';
  platformId?: 'amazon' | 'temu' | 'shopee' | 'tiktok' | 'aliexpress' | 'alibaba';
  platform?: 'amazon' | 'temu' | 'shopee' | 'tiktok' | 'aliexpress' | 'alibaba';
  language?: 'zh' | 'en';
  model?: string;
  imageCount?: number;
  ratioMode?: 'smart' | 'fixed';
  stylePreset?: string;
  size?: string;
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
    sequential_image_generation: 'disabled';
  };
  size: string;
}
