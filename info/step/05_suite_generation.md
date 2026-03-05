# 步骤 5：实现商品套图模版功能 (Product Suite Templates)

## 1. 技术栈规范 (Tech Stack Specifications)
*   **配置管理**: 将模版数据分离为 JSON 常量或配置文件，便于热更新。
*   **任务队列**: 使用 `Promise.all` 处理并发，或简单的 `for...of` 循环处理串行（推荐串行以避免瞬间触发 API Rate Limit）。

## 2. 数据结构定义 (Data Structures)
```typescript
export interface SuiteTemplate {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  availableShotIds?: string[]; // 模板允许选择的镜头池
  defaultShotIds?: string[];   // 模板默认镜头集
}

export interface SuiteShotDefinition {
  id: string;
  name: string;
  description?: string;
  defaultPromptSuffixZh: string;
  defaultRatioMode?: string;
  defaultImageCount?: number;
}

export interface SuiteItemResult {
  id: string;
  shotId?: string;
  name: string;
  promptBase?: string; // 中文，可编辑
  prompt: string;      // 最终提交（由上下文派生）
  ratioMode?: string;
  sizeMode?: 'resolution' | 'pixels';
  sizeResolution?: '1K' | '2K' | '4K';
  sizePx?: string;
  size?: string;
  imageCount?: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  images?: { url: string; prompt: string }[];
  error?: string;
}
```

## 3. 任务描述细节 (Detailed Tasks)

**3.1 模版数据定义（镜头池 + 默认镜头集）**
*   在 `app/src/constants/templates.ts` 中创建预设模版（如“详情页套图”“品牌视觉套图”“3C 数码”“鞋靴”）。
*   每个模板定义：`availableShotIds`（可用镜头池）+ `defaultShotIds`（默认勾选）。
*   能力卡/一键应用预设：`app/src/constants/suitePresets.ts`（将 presetId 映射到 templateId + 场景/风格/全局提示补丁）。

**3.2 镜头库与自定义镜头**
*   预置镜头库：`app/src/constants/suiteShots.ts`，作为模板与子项的来源。
*   支持“轻量自定义镜头”：在套图页弹窗创建（名称/用途/默认比例/默认张数/默认中文后缀），加入本地镜头列表并立即添加为一个子项。

**3.3 套图编辑器 UI（镜头清单编辑器）**
*   `app/src/components/SuiteGenerator/SuiteGeneratorView.tsx`：
    *   镜头类型可勾选（默认镜头集），并支持新增/删除/排序、重复添加同镜头。
    *   子项独立配置：画面比例、输出尺寸模式（分辨率档位/自定义像素）、张数。
    *   子项 prompt 分为 `promptBase`（中文可编辑）与 `prompt`（最终提交预览）。
    *   全局参数（模型/风格/平台规则/水印/是否允许文字）与全局描述在同一张卡片里。

**3.4 批量任务执行器（按子项生成，支持组图多张返回）**
*   `app/src/services/suiteGenerationService.ts`：`executeSuiteGeneration / generateSuiteItem`
    *   每个子项可通过 4.0/4.5 组图能力一次返回多张：`sequential_image_generation='auto'` + `max_images=imageCount`。
    *   参考图数量 + 生成数量 ≤ 15：超出需要自动截断（由 `computeGroupGeneration` 负责）。
    *   支持首图参考一致性：第一项先生成，后续子项把首图 URL 拼到参考图前面（最多 14 张）。
    *   支持 `watermark` 透传（若平台标准不允许水印则强制关闭）。

**3.5 套图结果展示（多图缩略图）**
*   `app/src/components/SuiteGenerator/SuiteResultView.tsx`
    *   结果按“套图任务”分组展示。
    *   子项内展示多张缩略图网格，并可逐张下载；支持打包下载（JSZip）。

## 4. 边界条件 (Edge Cases)
*   **部分失败**：如果套图中某一张生成失败，不应中断整个流程，应在 UI 上显示“重试”按钮。
*   **中断任务**：用户离开页面或点击“停止”，应尝试 Abort 未发出的请求。

## 交付物
*   套图生成功能模块。
*   至少 2 个可用的预设模版。
