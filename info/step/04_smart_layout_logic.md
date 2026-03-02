# 步骤 4：实现智能布局画布 - 合成与生成 (Smart Layout Canvas - Generation)

## 1. 技术栈规范 (Tech Stack Specifications)
*   **图像处理**: 使用 `HTML5 Canvas API` 或 `OffscreenCanvas` 进行图片合成。
*   **格式转换**: 必须能够将 Canvas 导出为符合 API 要求的 Base64 字符串（`image/png` 或 `image/jpeg`）。

## 2. 数据结构定义 (Data Structures)
```typescript
// 顶部参数条映射后的全局上下文（示例字段，按项目实际精简/扩展）
export interface GenerationContext {
  scene: 'single' | 'detail' | 'crossborder' | 'brand';
  platform?: 'amazon' | 'temu' | 'shopee' | 'tiktok' | 'aliexpress' | 'alibaba';
  language?: 'zh' | 'en';
  model?: string;
  imageCount?: number; // 智能布局支持多图输出；模型不支持组图时前端分次调用补齐
  ratioMode?: 'smart' | 'fixed';
  stylePreset?: string;
}

export interface RegionPrompt {
  regionNo: number; // Region 序号（从 1 开始），用于 Prompt 可读性与引用
  id: string; // zone id
  type: 'background' | 'prop' | 'main';
  zIndex: number;
  locationHint: string; // e.g. Center-Left
  bbox: { x: number; y: number; w: number; h: number }; // px (x/y/w/h)
  prompt: string; // merged zone prompt + autoCaption + context suffix
  hasReferenceImage: boolean;
}

export interface DepthTreeNode {
  id: string;
  zIndex: number;
  overlaps: string[]; // ids that this node overlaps/covers
}

// 合成请求参数
export interface LayoutCompositionRequest {
  zones: LayoutZone[]; // 来自步骤 3 定义的 Zone 列表
  canvasSize: { width: number; height: number }; // 用户手动定义：影响坐标体系与布局草图尺寸
  renderMode: 'collage' | 'segmentation'; // 贴图布局图 | 纯色布局图
  context?: GenerationContext; // 用于 Prompt/size/model 的映射
}

// Prompt 组装策略
export type PromptStrategy = 'concat' | 'weighted'; // 简单拼接 | 加权拼接（预留）

// 合成输出（供 API 调用）
export interface LayoutCompositionResult {
  layoutSketchBase64: string; // image/png base64
  referenceImages: string[];  // zones 中提取的参考图（会做去重与数量截断）
  combinedPrompt: string;
  globalPrompt: string;
  regionPrompts: RegionPrompt[];
  depthTree: DepthTreeNode[];
  // 供最终 API 调用使用的参数（由 context 推导）
  generateParams: {
    prompt: string;
    image: string[];
    size?: string;
    model?: string;
    guidance_scale?: number;
    sequential_image_generation?: 'auto' | 'disabled';
    sequential_image_generation_options?: { max_images?: number };
  };
}
```

## 3. 任务描述细节 (Detailed Tasks)

**3.1 前端合成 (Client-side Compositing)**
*   实现 `composeLayoutForGeneration(request: LayoutCompositionRequest): Promise<LayoutCompositionResult>`。
*   **渲染逻辑**：
    *   创建一个离屏 Canvas（与 `canvasSize` 等大）。
    *   遍历 `zones`（按 `zIndex` 从小到大）：
        *   若 `renderMode === 'collage'` 且 Zone 绑定了参考图（`refImageId` 或兼容字段 `refImage`）：绘制图片到指定坐标和宽高（保持宽高比，contain）。
        *   其他情况：绘制纯色块（优先使用 `sketchColor`，若不存在则回退 Step 3 的 `semanticColor`）。\n          注意：不要在合成图中绘制边框线条与大段文字（模型容易把边框当成画面元素）。如需调试，单独提供“开发调试叠层”，不要进入最终提交给 API 的 `layoutSketch`。\n          说明：当同类型存在多个区域时，`sketchColor` 必须具有足够区分度，以便模型区分不同 Region。
    *   导出为 Base64 字符串。
*   **结构化区域提示（必须输出）**：\n    *   计算 `bbox`：`x=zone.x`，`y=zone.y`，`w=zone.width`，`h=zone.height`（单位 px，取整）。\n    *   计算 `locationHint`：按 bbox 中心点落在 3x3 宫格输出（Top-Left/Center-Right 等），用于坐标 + 方位双重校验。\n    *   组装 `regionPrompts[]`：每个 Zone 一条，`prompt` 使用“用户 prompt + autoCaption（可选）+ context 后缀”的合并结果。\n    *   组装 `depthTree[]`：默认按 zIndex（大在前）生成；若 UI 提供 overlaps 显式关系（见 Step 3），以 overlaps 为准。
*   **参考图收集**：\n    *   Zone 参考图优先从 `refImageId` 解析为素材库资源（兼容旧字段 `refImage`）。\n    *   先按优先级排序：`main` > `prop` > `background`，同类型按 `zIndex` 从高到低。\n    *   对解析后的参考图进行去重：同一张图（同一 dataUrl）仅占用一个参考图槽位，但可被多个 Region 复用。\n    *   数量限制：最多 13 张“唯一参考图”（预留 1 张给 `layoutSketch`）；超出则跳过新增图片并在对应 Region 行中标注“参考图：无”。
*   **提示词可编辑（必须）**：预览弹窗需允许用户编辑：\n    *   `GLOBAL_PROMPT`（整体摄影棚/光照/镜头/风格）\n    *   最终提交的 `prompt`（完整结构化提示词，用户可二次加工）\n    生成请求必须使用用户编辑后的最终提示词。

**3.2 Prompt 组装**
*   实现 `composeLayoutPrompt(zones: LayoutZone[], context?: GenerationContext): string`。
*   **文案变量替换（新增）**：在进入 Prompt 组装前，先对 `zones[].prompt` 做变量替换。\n    *   支持变量：`{PRODUCT}/{TITLE}/{SUBTITLE}/{BULLET_1..5}/{CTA}/{BADGE}/{PRICE}`。\n    *   替换后的 prompt 用于预览面板与最终生成；模板本身仍可保留占位符以便复用。
*   **拼接规则**：
    *   提取所有非空 Prompt。
    *   按照 `[背景] -> [环境/道具] -> [主体]` 的语义顺序进行拼接（可以通过 Zone 的 `type` 字段排序）。
    *   示例：“(Background: white studio), (Prop: wooden podium), (Main: red running shoes)”。
*   **与顶部参数条的映射（必须）**：\n    *   `language='en'`：在 Prompt 中追加约束（如 “in English” 或将所有 Zone 描述输出为英文）。\n    *   `platform='amazon'`：追加平台规则提示（如白底、合规、构图建议）。\n    *   `stylePreset`：追加统一风格后缀（灯光、摄影风格、色调等）。\n    *   `scene`：决定 Prompt 模板骨架（例如详情图更偏“信息清晰、留白用于文案”的构图提示）。\n    *   `ratioMode/size`：需要在 Prompt 中显式写入输出尺寸提示（与 API `size` 双写），避免模型忽略比例要求。\n    以上规则必须以确定性的模板实现，避免依赖模型“猜”。\n*   **Region Prompter 段落（默认开启）**：最终 `combinedPrompt` 必须包含以下结构化片段（顺序固定）：\n    1) `GLOBAL_PROMPT:` 仅描述整体摄影棚、光照、镜头、风格。\n    2) `REGION_PROMPTS:` 每个区域一段，格式示例：\n       `Region 1 [Location: Center-Left (x=180px,y=280px,w=440px,h=500px)] Prompt: ...`\n    3) `DEPTH_TREE:` 描述遮挡顺序与覆盖关系，明确“谁覆盖谁”“禁止漂浮/嵌入”。\n    4) `RULES:` 强规则：不要画任何边框/编号/文字；对象必须在各自区域内；禁止漂浮；禁止嵌入。
*   **参考图优先（新增，默认开启）**：在 `GLOBAL_PROMPT` 之前增加 `REFERENCE_FIRST_POLICY:` 段落。\n    *   有对应参考图的 Region：外观（材质/配色/纹理/细节/光照）以对应参考图为真值；若文字描述与参考图冲突则忽略冲突描述。\n    *   `图1(layoutSketch)` 仅用于位置/构图，不代表风格。\n    *   `{PROJECT}` 等占位符仅用于语义辅助，不用于覆盖参考图外观。\n    *   对有参考图的 Region：区域 prompt 的 context 后缀不再注入风格类描述（stylePreset 等），避免与参考图冲突。
*   **图片编号（必须）**：最终 Prompt 必须明确多参考图的编号含义，避免模型混用素材：\n    *   `图1` 固定为 `layoutSketch`（位置/构图参考）。\n    *   `图2..` 为 `referenceImages[]`（Zone 上传素材图），并在对应 Region 行中标注“参考图：图N”。\n    *   预览弹窗应展示参考图缩略图并标注图号，供用户核对。
*   **坐标体系（必须）**：最终 Prompt 必须输出 `COORDINATE_SYSTEM:` 段落，明确 x/y/z 轴规则（x/y 为像素坐标，z 为 zIndex 深度），并要求模型严格遵循。\n    *   建议同时输出 `AnchorPx`（确定性锚点坐标）与 `Margins/Padding`（对齐/留白策略）以增强可执行性。

**3.3 对接生成 API**
*   在 Canvas 组件工具栏添加“生成”按钮。
*   **点击交互**：
    1.  调用 `composeLayoutForGeneration` 获取 `layoutSketchBase64`、`referenceImages`、`combinedPrompt`、`generateParams`。
    3.  弹出“预览确认”弹窗（见交互流程补充）。
    4.  确认后，调用 `api.generateImage`（Image-to-Image 模式）。

*   **API 参数要求**：\n    *   `image`: `[layoutSketchBase64, ...referenceImages]`\n    *   `prompt`: `combinedPrompt`\n    *   `sequential_image_generation`: 支持 `auto`（一次返回多张）或 `disabled`（单张）\n    *   `sequential_image_generation_options.max_images`: 当为 `auto` 时传入\n    *   `stream`: `false`\n    *   **取消**：需要支持 AbortSignal 以便用户在生成中点击“停止”中断请求
\n    *   `guidance_scale`: 当存在 `referenceImages` 时可下调（降低文本支配性，提高“看图生成”的权重）
\n*   **分次生成并发（必须）**：当需要用“单次生成”补齐张数时，前端应使用并发限流（例如并发 3）同时发起请求，并维护每张图的独立状态（生成中/成功/失败/已停止），失败不阻塞后续继续尝试。

*   **后端能力分级**：\n    *   **Seedream 默认（当前）**：Region Prompter 仅作为 Prompt 文本约束；空间靠 `layoutSketch`；材质靠 `referenceImages`。\n    *   **可控后端增强（未来可选）**：当后端接入支持 Area Prompting 的生成管线时，直接把 `regionPrompts[]` 作为像素级区域控制输入（Zone A 区域仅受 Prompt A 控制），显著降低串色与串属性。\n
*   **两阶段生成（可选开关，已实现）**：用于提升强结构商品图的构图稳定性（先构图后细化）：\n    *   阶段 1（Draft）：仅用 `layoutSketch + combinedPrompt` 生成“构图草稿图”。\n    *   阶段 2（Refine）：将草稿图作为最强参考图（image[0]），再叠加原始素材图（image[1..]）生成最终图。\n    *   说明：两阶段模式下，为保证每张图都能绑定各自的草稿图，不走一次多张的 `auto` 组图返回，统一按单张并发补齐。

*   **与顶部参数条的匹配（必须）**：\n    *   `model`：由顶部“模型版本”映射到具体 model id，并写入最终请求。\n    *   `size`（S1 策略）：\n        *   `ratioMode=智能比例`：根据画布宽高比推导最合适的 `size`（并用于合成草图缩放与最终请求）。\n        *   `ratioMode=固定比例/分辨率`：直接使用用户选择映射出的 `size`（如 16:9 -> 2560x1440；4.0 支持 1K/2K/4K）。\n        *   **模型校验**：不同模型可用 `size` 不同（例如 SeedEdit 3.0-i2i 仅 adaptive），前端需禁用或在请求时自动回退。\n    *   `imageCount`：智能布局模式下与顶部“张数”一致。\n        *   模型支持组图：优先使用 `auto + max_images`。\n        *   模型不支持组图或参考图限制导致单次不足：前端分次调用单张生成接口补齐到 N（允许中途失败但继续尝试）。

**3.4 结果回填**
*   监听 API 返回结果。
*   成功后，将结果图以“图层”形式叠加在 Canvas 最上层，透明度默认为 100%，允许用户调整透明度以对比原布局。

## 4. 边界条件 (Edge Cases)
*   **图片加载失败**：在合成阶段，如果某个 Zone 的 `refImage` 加载失败，应降级为绘制色块，并记录 Warning。
*   **尺寸限制**：合成图的长宽若超过 API 限制（如 4096），需自动进行等比缩放（Downscaling）。
*   **空布局保护**：若 zones 为空，点击生成提示“请至少绘制一个区域”。
*   **纯语义模式**：当用户选择 `renderMode='segmentation'` 或所有 Zone 都没有 `refImage` 时，`referenceImages` 允许为空，但 `layoutSketchBase64` 必须存在。

## 交付物
*   完整的智能布局生成流程代码。
*   包含“合成预览”功能的交互组件。
