# 步骤 2：重构核心生成状态管理 (State Management)

## 1. 技术栈规范 (Tech Stack Specifications)
*   **状态库**: Zustand (v5+)
*   **持久化**: 使用 `persist` 中间件；优先落到 IndexedDB（自定义 `StateStorage`），避免 localStorage 配额与同步阻塞问题。
*   **容量风险（必须考虑）**：无论是 localStorage 还是 IndexedDB，大量 Base64 图片都可能造成写入失败/性能问题。Store 持久化应只保留“偏好与轻量状态”，图片类数据需设置上限并提供清理入口（素材库已提供一键清空）。

## 2. 数据结构定义 (Data Structures)
```typescript
export interface GenerationTask {
  id: string;
  type: 'single' | 'suite' | 'layout';
  status: 'pending' | 'processing' | 'success' | 'failed';
  createdAt: number;
  input: {
    prompt: string;
    referenceImages: string[]; // 统一为数组
    model: string;
  };
  result?: {
    images?: { url: string; prompt: string }[];
    suite?: SuiteGenerationResult;
  };
  error?: string;
}

export interface AppState {
  tasks: GenerationTask[];
  credits: number;
  suitePresetRequest: { presetId: 'detail' | 'brand'; requestedAt: number } | null;
  // Actions
  addTask: (task: GenerationTask) => void;
  updateTaskStatus: (id: string, status: GenerationTask['status'], result?: any) => void;
  deductCredits: (amount: number) => boolean;
  requestSuitePreset: (presetId: 'detail' | 'brand') => void;
}
```

## 3. 任务描述细节 (Detailed Tasks)

**3.1 升级 Store 结构**
*   修改 `app/src/store/appStore.ts`。
*   废弃原有的 `isGenerating` (boolean)，改为基于 `tasks` 队列的状态派生：`const isGenerating = tasks.some(t => t.status === 'processing')`。
*   **任务管理**：实现 `addTask` 和 `updateTaskStatus`，确保任务状态流转的可追溯性。

**3.1.1 套图预设请求（用于能力卡一键应用）**
*   增加 `suitePresetRequest` 与 `requestSuitePreset(presetId)`。
*   能力卡点击只负责写入“预设请求”；套图页监听并执行：切换模板、写入场景/风格、派生子项提示词。

**3.2 完善输入状态**
*   将 `uploadedImages` 从简单的图片列表升级为支持“引用权重”或“用途标记”（可选，为未来扩展预留）。
*   当前阶段确保 `uploadedImages` 能正确存储多张图片的 Base64 数据。

**3.2.1 智能布局素材库（必须）**
*   增加 `smartLayoutAssets`（素材库资源列表），用于在多个 Zone/多个风格变体之间复用同一张素材图，避免重复上传。\n    *   资源应可去重（同 dataUrl hash 为同一资源），并设置数量上限（例如最多 30 条）。\n    *   必须提供 `clearSmartLayoutAssets()` 或等价操作，并在 UI 里提供“一键清空素材库缓存”入口，用于释放本地存储空间。

**3.2.2 智能布局模板/草稿（建议从 Store 中剥离）**
*   智能布局“模板库/草稿/历史”独立于 Zustand persist（单独模块落盘），原因：\n    *   模板可能携带 `snapshotDataUrl`（预览图），体积不可控；\n    *   历史记录会不断增长且包含多图结果，需要单独做保留策略与迁移。\n*   典型 key：\n    *   `smart_layout_templates_v1`、`smart_layout_draft_v1`（localStorage）\n    *   历史记录优先 IndexedDB（并支持从旧 localStorage 迁移）\n*   写入失败需提示用户，并支持降级（例如移除预览图再保存）。

**3.3 算力逻辑解耦**
*   实现 `deductCredits(amount)`：
    *   检查余额是否充足。
    *   若充足，扣减并返回 `true`。
    *   若不足，触发一个全局事件（如 Toast 提示“余额不足”）并返回 `false`。

## 4. 边界条件 (Edge Cases)
*   **并发限制**：虽然 Store 支持多任务，但前端 UI 应限制同时只能进行一个生成任务（除非后续开启并发特性）。
*   **数据清理**：当 `tasks` 数量超过 50 条时，自动清理最旧的非收藏记录，避免持久化膨胀。

## 交付物
*   更新后的 `app/src/store/appStore.ts`。
*   迁移指南：简要说明旧组件如何适配新 Store（例如：将 `isGenerating` 替换为 `useStore(s => s.tasks.some(...))`）。
