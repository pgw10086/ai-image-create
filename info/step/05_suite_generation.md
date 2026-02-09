# 步骤 5：实现商品套图模版功能 (Product Suite Templates)

## 1. 技术栈规范 (Tech Stack Specifications)
*   **配置管理**: 将模版数据分离为 JSON 常量或配置文件，便于热更新。
*   **任务队列**: 使用 `Promise.all` 处理并发，或简单的 `for...of` 循环处理串行（推荐串行以避免瞬间触发 API Rate Limit）。

## 2. 数据结构定义 (Data Structures)
```typescript
export interface SuiteTemplate {
  id: string;
  name: string; // e.g. "鞋靴全能套图"
  description: string;
  coverImage: string;
  items: {
    id: string;
    name: string; // e.g. "侧视图"
    promptSuffix: string; // e.g. ", side view, dynamic angle"
    referenceWeight: number; // 0-1, 用于指导图生图的权重
  }[];
}
```

## 3. 任务描述细节 (Detailed Tasks)

**3.1 模版数据定义**
*   在 `src/constants/templates.ts` 中创建预设模版。
*   **示例数据**：创建一个“3C 数码”模版，包含“正视图”、“侧视图”、“使用场景”三个子任务。

**3.2 模版选择 UI**
*   实现 `src/components/SuiteGenerator/TemplateSelector.tsx`。
*   **交互**：Grid 布局展示模版卡片，点击选中 -> 进入配置页。

**3.3 批量任务执行器**
*   实现 `executeSuiteGeneration` 函数。
*   **核心逻辑**：
    *   **Prompt 构造**：`FinalPrompt = UserInput + TemplateItem.promptSuffix`。
    *   **首图参考模式（Advanced）**：
        1.  先生成列表中的第一张图（通常为主图）。
        2.  等待生成成功，获取 URL。
        3.  将该 URL 作为后续任务的 `referenceImage`，以保证物体一致性。
    *   **并发控制**：默认限制并发数为 2，防止浏览器卡顿或 API 报错。

**3.4 套图结果展示**
*   设计一个新的结果视图组件 `SuiteResultView`。
*   **分组展示**：以“套图任务”为单位，展示一组图片。
*   **操作**：提供“全部下载”按钮（使用 `JSZip` 打包下载）。

## 4. 边界条件 (Edge Cases)
*   **部分失败**：如果套图中某一张生成失败，不应中断整个流程，应在 UI 上显示“重试”按钮。
*   **中断任务**：用户离开页面或点击“停止”，应尝试 Abort 未发出的请求。

## 交付物
*   套图生成功能模块。
*   至少 2 个可用的预设模版。
