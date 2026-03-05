import type {
  LayoutCompositionRequest,
  LayoutCompositionResult,
  GenerationContext,
  RegionPrompt,
  DepthTreeNode,
  LayoutZone,
} from '@/types/smartLayout';
import { calculateOptimalSize } from '@/lib/utils';
import type { GenerationContext as StoreGenerationContext } from '@/store/appStore';
import { buildPromptWithContext } from '@/lib/generationContext';

function parseSize(sizeStr?: string) {
  if (!sizeStr) return null;
  const [w, h] = sizeStr.split('x').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { width: w, height: h };
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / img.width, height / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = x + (width - drawW) / 2;
  const drawY = y + (height - drawH) / 2;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

function fillSemanticBlock(ctx: CanvasRenderingContext2D, zone: LayoutZone) {
  ctx.fillStyle = zone.sketchColor || zone.semanticColor;
  ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
}

function roundInt(n: number) {
  return Math.round(n);
}

function getLocationHint(bboxNormalized: { x: number; y: number; w: number; h: number }) {
  const cx = bboxNormalized.x + bboxNormalized.w / 2;
  const cy = bboxNormalized.y + bboxNormalized.h / 2;
  const col = cx < 1 / 3 ? 'Left' : cx < 2 / 3 ? 'Center' : 'Right';
  const row = cy < 1 / 3 ? 'Top' : cy < 2 / 3 ? 'Center' : 'Bottom';
  return `${row}-${col}`;
}

function getLocationHintFromPx(bboxPx: { x: number; y: number; w: number; h: number }, canvasW: number, canvasH: number) {
  const bboxNormalized = {
    x: canvasW > 0 ? bboxPx.x / canvasW : 0,
    y: canvasH > 0 ? bboxPx.y / canvasH : 0,
    w: canvasW > 0 ? bboxPx.w / canvasW : 0,
    h: canvasH > 0 ? bboxPx.h / canvasH : 0,
  };
  return getLocationHint(bboxNormalized);
}
 

function rectsIntersect(a: LayoutZone, b: LayoutZone) {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const xOverlap = Math.min(ax2, bx2) - Math.max(a.x, b.x);
  const yOverlap = Math.min(ay2, by2) - Math.max(a.y, b.y);
  return xOverlap > 0 && yOverlap > 0;
}

function buildDepthTree(zones: LayoutZone[]): DepthTreeNode[] {
  const sorted = [...zones].sort((a, b) => b.zIndex - a.zIndex);
  const idToRegionNo = new Map<string, number>(
    [...sorted].sort((a, b) => a.zIndex - b.zIndex).map((z, idx) => [z.id, idx + 1])
  );

  return sorted.map((z) => ({
    regionNo: idToRegionNo.get(z.id) ?? 0,
    id: z.id,
    zIndex: z.zIndex,
    overlaps: sorted
      .filter(other => other.id !== z.id && z.zIndex > other.zIndex && rectsIntersect(z, other))
      .map(other => other.id),
  }));
}

function toStoreContext(context?: GenerationContext): StoreGenerationContext {
  return {
    platformId: ((context?.platformId ?? context?.platform ?? 'amazon') as string).trim() || 'amazon',
    language: context?.language === 'zh' ? 'zh' : 'en',
    model: (context?.model ?? '').trim(),
    imageCount: 1,
    ratioMode: '智能比例',
    qualityMode: '2K',
    stylePreset: context?.stylePreset,
    scene: context?.scene,
  };
}

function buildGlobalPrompt(context?: GenerationContext) {
  const storeContext = toStoreContext(context);
  const allowText = Boolean(context?.allowText);
  return buildPromptWithContext({
    basePrompt: '',
    context: storeContext,
    allowText,
    includeSceneHint: true,
    includePlatformHint: true,
    includeStyleHint: true,
    includeLanguageHint: true,
    includeAllowTextHint: true,
  });
}

function mergeRegionPrompt(zone: LayoutZone, context?: GenerationContext) {
  const parts = [zone.prompt?.trim(), zone.autoCaption?.trim()].filter(Boolean) as string[];
  let merged = parts.join(', ');
  if (!merged) {
    if (context?.language === 'zh') {
      merged = zone.type === 'background' ? '背景' : zone.type === 'prop' ? '道具' : '主体';
    } else {
      merged = zone.type === 'background' ? 'background' : zone.type === 'prop' ? 'prop' : 'main subject';
    }
  }
  return merged;
}

function getTypeZh(type: LayoutZone['type']) {
  return type === 'background' ? '背景' : type === 'prop' ? '道具' : '主体';
}

function getPlaneEn(type: LayoutZone['type']) {
  return type === 'background' ? 'BackgroundPlane' : type === 'prop' ? 'PropPlane' : 'MainPlane';
}

function normalizeLocationHint(locationHint: string) {
  if (locationHint === 'Center') return { row: 'Center', col: 'Center' } as const;
  const [rowRaw, colRaw] = locationHint.split('-');
  const row = rowRaw === 'Top' || rowRaw === 'Center' || rowRaw === 'Bottom' ? rowRaw : 'Center';
  const col = colRaw === 'Left' || colRaw === 'Center' || colRaw === 'Right' ? colRaw : 'Center';
  return { row, col } as const;
}

function anchorRatio(row: 'Top' | 'Center' | 'Bottom', col: 'Left' | 'Center' | 'Right') {
  const rx = col === 'Left' ? 0.2 : col === 'Center' ? 0.5 : 0.8;
  const ry = row === 'Top' ? 0.2 : row === 'Center' ? 0.5 : 0.8;
  return { rx, ry };
}

function computeAnchorPx(bbox: { x: number; y: number; w: number; h: number }, locationHint: string) {
  const { row, col } = normalizeLocationHint(locationHint);
  const { rx, ry } = anchorRatio(row, col);
  return {
    ax: roundInt(bbox.x + bbox.w * rx),
    ay: roundInt(bbox.y + bbox.h * ry),
    row,
    col,
  };
}

function computePaddingPx(bbox: { w: number; h: number }) {
  const minSide = Math.max(1, Math.min(bbox.w, bbox.h));
  return Math.max(8, Math.round(minSide * 0.04));
}

function getColorZh(type: LayoutZone['type'], sketchColor: string) {
  const normalized = sketchColor.toUpperCase();
  if (type === 'background') return normalized === '#FFFFFF' ? '白色' : '浅灰色';
  if (type === 'prop') return '绿色';
  return '红色';
}

function buildCoordinateSystemLines(canvasW: number, canvasH: number) {
  return [
    `CanvasSize: ${canvasW}px x ${canvasH}px`,
    'AxisX: x in pixels; origin at top-left; x increases to the right.',
    'AxisY: y in pixels; origin at top-left; y increases downward.',
    'AxisZ: z is zIndex (layer depth); larger zIndex is closer to camera and may occlude smaller zIndex.',
    'RegionBBox: (x,y,w,h) are pixels; x/y are top-left of the region.',
    'AnchorPx: per region, a deterministic anchor point inside bbox.',
    'AnchorRatios: Left=0.2, Center=0.5, Right=0.8; Top=0.2, Center=0.5, Bottom=0.8 (relative to bbox).',
    'HardRule: All objects must be placed by this coordinate system; do not reinterpret axes.',
  ];
}

function buildChecklistLines(params: { allowText: boolean; enableDepthTree: boolean }) {
  const lines = ['Checklist: verify each region object stays inside its bbox.'];
  if (params.enableDepthTree) {
    lines.push('Checklist: verify occlusion matches DEPTH_TREE (overlap => cover).');
  }
  lines.push(params.allowText ? 'Checklist: verify no borders/boxes/numbers/labels are drawn.' : 'Checklist: verify no borders/boxes/numbers/labels/text are drawn.');
  return lines;
}

export async function generateLayoutSketch(
  request: Pick<LayoutCompositionRequest, 'zones' | 'canvasSize' | 'assets'>,
  renderMode: LayoutCompositionRequest['renderMode'],
  targetSizeStr?: string
): Promise<string> {
  const { zones, canvasSize } = request;
  const assetsById = new Map((request.assets || []).map((a) => [a.id, a.dataUrl]));

  const parsed = parseSize(targetSizeStr);
  const finalWidth = parsed?.width ?? canvasSize.width;
  const finalHeight = parsed?.height ?? canvasSize.height;
  const scaleX = finalWidth / canvasSize.width;
  const scaleY = finalHeight / canvasSize.height;

  const canvas = document.createElement('canvas');
  canvas.width = finalWidth;
  canvas.height = finalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sortedZones = [...zones].sort((a, b) => a.zIndex - b.zIndex);

  for (const zone of sortedZones) {
    const scaledZone: LayoutZone = {
      ...zone,
      x: zone.x * scaleX,
      y: zone.y * scaleY,
      width: zone.width * scaleX,
      height: zone.height * scaleY,
    };

    const refImageSrc = scaledZone.refImageId ? assetsById.get(scaledZone.refImageId) : scaledZone.refImage;
    if (renderMode === 'collage' && refImageSrc) {
      try {
        const img = await loadImage(refImageSrc);
        drawImageContain(ctx, img, scaledZone.x, scaledZone.y, scaledZone.width, scaledZone.height);
        continue;
      } catch (e) {
        console.warn('Failed to load ref image, fallback to semantic block:', e);
      }
    }

    fillSemanticBlock(ctx, scaledZone);
  }

  return canvas.toDataURL('image/png');
}

export function composeLayoutPrompt(zones: LayoutZone[], context?: GenerationContext): string {
  const inferredW = Math.max(1, ...zones.map(z => z.x + z.width));
  const inferredH = Math.max(1, ...zones.map(z => z.y + z.height));
  const canvasW = inferredW;
  const canvasH = inferredH;
  const globalPrompt = buildGlobalPrompt(context);
  const coordinateLines = buildCoordinateSystemLines(canvasW, canvasH);

  const regionPrompts = zones
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((z, idx) => {
      const bboxPx = {
        x: roundInt(z.x),
        y: roundInt(z.y),
        w: roundInt(z.width),
        h: roundInt(z.height),
      };
      const locationHint = getLocationHintFromPx(bboxPx, canvasW, canvasH);
      const anchor = computeAnchorPx(bboxPx, locationHint);
      const edgeSlack = computePaddingPx(bboxPx);
      const margins = {
        l: bboxPx.x,
        t: bboxPx.y,
        r: Math.max(0, roundInt(canvasW - (bboxPx.x + bboxPx.w))),
        b: Math.max(0, roundInt(canvasH - (bboxPx.y + bboxPx.h))),
      };
      const prompt = mergeRegionPrompt(z, context);
      const regionNo = idx + 1;
      const sketchColor = z.sketchColor || z.semanticColor || '';
      const alignRules =
        z.type === 'background'
          ? `Placement: fill the entire bbox as a continuous background plane. Keep edges clean.`
          : z.type === 'prop'
            ? `Placement: scale prop to fill bbox as much as possible; keep bottom supported (no floating). Prop may touch bbox edges. Align prop base on or very near bbox bottom (y≈${bboxPx.y + bboxPx.h}px).`
            : `Placement: scale main subject to fill bbox as much as possible; center around AnchorPx. Subject may touch bbox edges and may be cropped by bbox edges to achieve full-frame fill. Minimize empty space inside bbox.`;

      return `Region ${regionNo} [Plane: ${getPlaneEn(z.type)} | Location: ${locationHint} | BBox: (x=${bboxPx.x}px,y=${bboxPx.y}px,w=${bboxPx.w}px,h=${bboxPx.h}px) | AnchorPx: (ax=${anchor.ax}px,ay=${anchor.ay}px) | EdgeSlack: <=${edgeSlack}px | Margins: (l=${margins.l}px,t=${margins.t}px,r=${margins.r}px,b=${margins.b}px) | Depth: zIndex=${z.zIndex} | color=${sketchColor}] Prompt: ${prompt}. ${alignRules}`;
    });

  const regionOrder = zones.slice().sort((a, b) => a.zIndex - b.zIndex);
  const idToRegionNo = new Map<string, number>(regionOrder.map((z, idx) => [z.id, idx + 1]));

  const depthTree = buildDepthTree(zones)
    .map(n => `Node ${idToRegionNo.get(n.id) ?? n.regionNo} zIndex=${n.zIndex} overlaps=[${n.overlaps.map(id => idToRegionNo.get(id)).filter(Boolean).join(',')}]`);

  const allowText = Boolean(context?.allowText);
  const rules = [
    allowText ? 'Do not draw borders, boxes, numbers, or labels.' : 'Do not draw borders, boxes, numbers, labels, or any text.',
    'All objects must stay strictly inside their assigned regions; they may touch region edges.',
    'Respect occlusion and depth order; no floating objects.',
    ...buildChecklistLines({ allowText, enableDepthTree: true }),
  ];

  return [
    'GLOBAL_PROMPT:',
    globalPrompt || '',
    '',
    'COORDINATE_SYSTEM:',
    ...coordinateLines,
    '',
    'REGION_PROMPTS:',
    ...regionPrompts,
    '',
    'DEPTH_TREE:',
    ...depthTree,
    '',
    'RULES:',
    ...rules,
  ].join('\n').trim();
}

export async function composeLayoutForGeneration(
  request: LayoutCompositionRequest,
  targetSizeStr?: string
): Promise<LayoutCompositionResult> {
  const assetsById = new Map((request.assets || []).map((a) => [a.id, a.dataUrl]));
  const minPixels =
    request.context?.model?.includes('4.0') ? 921600 : 3686400;
  const sizeFromContext =
    request.context?.ratioMode === 'fixed' ? request.context?.size : undefined;
  const size = targetSizeStr ?? sizeFromContext ?? calculateOptimalSize(request.canvasSize.width, request.canvasSize.height, minPixels);
  const layoutSketchBase64 = await generateLayoutSketch(
    { zones: request.zones, canvasSize: request.canvasSize, assets: request.assets },
    request.renderMode,
    size
  );

  const regionOrder = request.zones.slice().sort((a, b) => a.zIndex - b.zIndex);
  const idToRegionNo = new Map<string, number>(regionOrder.map((z, idx) => [z.id, idx + 1]));

  const rank: Record<LayoutZone['type'], number> = { main: 0, prop: 1, background: 2 };
  const referenceCandidates = request.zones
    .map((z) => {
      const refImage = z.refImageId ? assetsById.get(z.refImageId) : z.refImage;
      return { ...z, refImage };
    })
    .filter(z => Boolean(z.refImage))
    .sort((a, b) => {
      const byType = rank[a.type] - rank[b.type];
      if (byType !== 0) return byType;
      return b.zIndex - a.zIndex;
    });

  const regionNoToImageNo = new Map<number, number>();
  const refImageToImageNo = new Map<string, number>();
  const referenceItems: Array<{ refImage: string; imageNo: number; type: LayoutZone['type'] }> = [];

  for (const z of referenceCandidates) {
    const regionNo = idToRegionNo.get(z.id) ?? 0;
    const refImage = z.refImage!;
    const existing = refImageToImageNo.get(refImage);
    if (existing) {
      regionNoToImageNo.set(regionNo, existing);
      continue;
    }
    if (referenceItems.length >= 13) {
      continue;
    }
    const imageNo = referenceItems.length + 2;
    refImageToImageNo.set(refImage, imageNo);
    regionNoToImageNo.set(regionNo, imageNo);
    referenceItems.push({ refImage, imageNo, type: z.type });
  }

  const referenceImages = referenceItems.map(i => i.refImage);

  const canvasW = request.canvasSize.width;
  const canvasH = request.canvasSize.height;
  const allowText = Boolean(request.context?.allowText);
  const enableRegionPrompts = request.promptSettings?.enableRegionPrompts !== false;
  const enableDepthTree = request.promptSettings?.enableDepthTree !== false;
  const globalPrompt = buildGlobalPrompt(request.context);
  const coordinateLines = buildCoordinateSystemLines(canvasW, canvasH);
  const regionPrompts: RegionPrompt[] = regionOrder
    .slice()
    .map((z) => {
      const regionNo = idToRegionNo.get(z.id) ?? 0;
      const hasReferenceImage = regionNoToImageNo.has(regionNo);
      const bbox = {
        x: roundInt(z.x),
        y: roundInt(z.y),
        w: roundInt(z.width),
        h: roundInt(z.height),
      };
      return {
        regionNo,
        id: z.id,
        type: z.type,
        zIndex: z.zIndex,
        locationHint: getLocationHintFromPx(bbox, canvasW, canvasH),
        bbox,
        prompt: mergeRegionPrompt(z, request.context),
        hasReferenceImage,
      };
    });

  const depthTree = buildDepthTree(request.zones).map(n => ({
    ...n,
    regionNo: idToRegionNo.get(n.id) ?? n.regionNo,
  }));

  const depthLines = depthTree.map(n => `Node ${n.regionNo} zIndex=${n.zIndex} overlaps=[${n.overlaps.map(id => idToRegionNo.get(id)).filter(Boolean).join(',')}]`);
  const imageNoToRegions = new Map<number, number[]>();
  for (const [regionNo, imageNo] of regionNoToImageNo.entries()) {
    const list = imageNoToRegions.get(imageNo) || [];
    list.push(regionNo);
    imageNoToRegions.set(imageNo, list);
  }
  for (const [imageNo, list] of imageNoToRegions.entries()) {
    imageNoToRegions.set(imageNo, list.slice().sort((a, b) => a - b));
  }
  const imageRefLines = [
    '图1：layoutSketch（位置/构图）',
    ...referenceItems.map(i => `图${i.imageNo}：参考图（${getTypeZh(i.type)}），外观真值，用于 Region ${imageNoToRegions.get(i.imageNo)?.join(',') || ''}`.trim()),
  ];

  const regionLines = regionPrompts.map(r => {
    const zone = request.zones.find(z => z.id === r.id);
    const sketchColor = zone?.sketchColor || zone?.semanticColor || '';
    const colorZh = getColorZh(r.type, sketchColor);
    const imageNo = regionNoToImageNo.get(r.regionNo);
    const refText = imageNo ? `参考图：图${imageNo}（外观真值）` : '参考图：无';
    const anchor = computeAnchorPx(r.bbox, r.locationHint);
    const edgeSlack = computePaddingPx(r.bbox);
    const margins = {
      l: r.bbox.x,
      t: r.bbox.y,
      r: Math.max(0, roundInt(canvasW - (r.bbox.x + r.bbox.w))),
      b: Math.max(0, roundInt(canvasH - (r.bbox.y + r.bbox.h))),
    };
    const alignRules =
      r.type === 'background'
        ? `Placement: fill the entire bbox as a continuous background plane. Keep edges clean.`
        : r.type === 'prop'
          ? `Placement: scale prop to fill bbox as much as possible; keep bottom supported (no floating). Prop may touch bbox edges. Align prop base on or very near bbox bottom (y≈${r.bbox.y + r.bbox.h}px).`
          : `Placement: scale main subject to fill bbox as much as possible; center around AnchorPx. Subject may touch bbox edges and may be cropped by bbox edges to achieve full-frame fill. Minimize empty space inside bbox.`;

    return `Region ${r.regionNo} [Plane: ${getPlaneEn(r.type)} | Location: ${r.locationHint} | BBox: (x=${r.bbox.x}px,y=${r.bbox.y}px,w=${r.bbox.w}px,h=${r.bbox.h}px) | AnchorPx: (ax=${anchor.ax}px,ay=${anchor.ay}px) | EdgeSlack: <=${edgeSlack}px | Margins: (l=${margins.l}px,t=${margins.t}px,r=${margins.r}px,b=${margins.b}px) | Depth: zIndex=${r.zIndex} | 图1中${colorZh}${getTypeZh(r.type)}区域 | ${refText} | color=${sketchColor}] Prompt: ${r.prompt}。${alignRules}`;
  });

  const referenceBoundLines = regionPrompts
    .filter(r => Boolean(regionNoToImageNo.get(r.regionNo)))
    .map(r => {
      const imageNo = regionNoToImageNo.get(r.regionNo);
      if (!imageNo) return '';
      return request.context?.language === 'zh'
        ? `- Region ${r.regionNo}：外观严格参考 图${imageNo}（材质/配色/纹理/细节/光照/镜头）。`
        : `- Region ${r.regionNo}: match Image ${imageNo} exactly for appearance.`;
    })
    .filter(Boolean);

  const referenceFirstPolicyLines =
    request.context?.language === 'zh'
      ? ([
        'REFERENCE_FIRST_POLICY:',
        '1) 图2.. 是外观真值参考（材质/配色/纹理/细节/光照/镜头），必须严格参考。',
        '2) 若任何文字提示与参考图冲突，忽略冲突文字，以参考图为准。',
        '3) 图1（layoutSketch）仅用于位置/构图，不定义风格/颜色/材质。',
        '4) {PROJECT} 等占位符仅用于语义辅助，不用于覆盖参考图外观。',
        ...referenceBoundLines,
      ] as string[])
      : ([
        'REFERENCE_FIRST_POLICY:',
        '1) Image 2.. are authoritative references for appearance (materials/colors/textures/details/lighting/camera). Follow them exactly.',
        '2) If any text instruction conflicts with a reference image, ignore the conflicting text and follow the image.',
        '3) Image 1 (layoutSketch) is for placement/composition only; it does NOT define style or colors.',
        '4) Placeholders like {PROJECT} are semantic aids only; do not use them to override the reference image appearance.',
        ...referenceBoundLines,
      ] as string[]);

  const combinedPrompt = [
    ...referenceFirstPolicyLines,
    '',
    'GLOBAL_PROMPT:',
    globalPrompt || '',
    '',
    'IMAGE_REFERENCES:',
    ...imageRefLines,
    '',
    'COORDINATE_SYSTEM:',
    ...coordinateLines,
    ...(enableRegionPrompts ? ['', 'REGION_PROMPTS:', ...regionLines] : []),
    ...(enableDepthTree ? ['', 'DEPTH_TREE:', 'Rule: If Node A overlaps Node B, A must visually cover B where they intersect.', ...depthLines] : []),
    '',
    'RULES:',
    ...[
      allowText ? 'Do not draw borders, boxes, numbers, or labels.' : 'Do not draw borders, boxes, numbers, labels, or any text.',
      'All objects must stay strictly inside their assigned regions; they may touch region edges.',
      ...(enableDepthTree ? ['Respect occlusion and depth order; no floating objects.'] : ['No floating objects.']),
      ...buildChecklistLines({ allowText, enableDepthTree }),
    ],
  ].join('\n').trim();

  const generateParams: LayoutCompositionResult['generateParams'] = {
    prompt: combinedPrompt,
    image: [layoutSketchBase64, ...referenceImages],
    size,
    model: request.context?.model,
    guidance_scale: referenceImages.length > 0 ? 3 : undefined,
    sequential_image_generation: 'disabled',
  };

  return { layoutSketchBase64, referenceImages, combinedPrompt, globalPrompt, regionPrompts, depthTree, generateParams, size };
}
