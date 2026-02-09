# 步骤 1：构建基础 API 服务层 (Backend/Service)

## 1. 技术栈规范 (Tech Stack Specifications)
*   **运行环境**: Vite + React 19 + TypeScript
*   **网络请求**: 使用浏览器原生 `fetch`（不引入 axios）
*   **类型安全**: 所有 API 入参/出参必须有 TypeScript 类型
*   **环境变量**: 仅通过 `import.meta.env` 读取，禁止硬编码或写入仓库

## 2. 参考文档
*   API Curl 示例（字段样例）：`c:\codes\shop\info\模型curl调用.md`
*   API 详细字段说明（取值范围/限制）：`c:\codes\shop\info\图片生成 API（Seedream 4.0-4.5 API）.md`

## 3. 环境变量约定
*   `VITE_VOLC_API_KEY`: 火山方舟 API Key（前端仅读取，不允许硬编码到仓库）
*   `VITE_USE_MOCK`: 可选，`true/false`，用于演示模式（强制不请求真实接口）

### 3.1 本地开发配置方式（必须）
*   在 `app/` 目录下创建 `app/.env.local`（该文件已在 `.gitignore` 中忽略，不会提交到仓库）。
*   示例（不要把真实 Key 写入仓库文档/代码，只写到你本机的 `.env.local`）：\n    *   `VITE_VOLC_API_KEY=你的_API_KEY`\n    *   `VITE_USE_MOCK=false`
*   若未配置 `VITE_VOLC_API_KEY` 且未显式开启 `VITE_USE_MOCK=true`，前端会直接报错并阻止请求，避免误以为已调用真实模型。

## 4. 数据结构定义 (Data Structures)
请严格遵循以下 TypeScript 接口生成代码：

```typescript
// 图片生成请求（与 UI 侧参数尽量一致）
export interface GenerateImageParams {
  prompt: string;
  image?: string | string[]; // Base64 或 URL；多图参考传数组
  size?: string; // 例："2K" | "4K" | "2048x2048"
  model?: string; // Model ID 或 Endpoint ID
  sequential_image_generation?: 'auto' | 'disabled'; // 套图编排不依赖该字段
  sequential_image_generation_options?: {
    max_images: number;
  };
  response_format?: 'url' | 'b64_json';
  stream?: boolean;
  watermark?: boolean;
}

// 图片生成响应（只保留项目用到的字段）
export interface GenerateImageResponse {
  model?: string;
  created?: number;
  data?: Array<
    | { url: string; size?: string }
    | { b64_json: string; size?: string }
    | { error: { code: string; message: string } }
  >;
  usage?: {
    generated_images: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: { code: string; message: string };
}
```

## 5. 模块 API 设计 (Module API)
*   建议导出一个稳定的服务函数：
    *   `generateImage(params: GenerateImageParams): Promise<GenerateImageResponse>`
*   该函数只负责：参数映射、鉴权注入、请求发送、错误归一化；不负责 UI Toast/状态管理。

## 6. 任务描述细节 (Detailed Tasks)

**6.1 创建类型定义文件**
*   在 `src/types/api.ts` 中定义上述接口（或在现有类型文件中按项目约定落位）。
*   增加一个错误码映射表（将 API 的 `error.code` 映射为更友好的中文提示），例如：鉴权失败、限流、内容安全、内部错误。

**6.2 封装 API 调用函数**
*   在 `src/lib/api.ts` 中实现 `generateImage`。
*   请求地址：`POST https://ark.cn-beijing.volces.com/api/v3/images/generations`（如需可再抽成环境变量）
*   Header：\n  `Content-Type: application/json`\n  `Authorization: Bearer ${VITE_VOLC_API_KEY}`
*   默认参数建议：\n  `response_format: 'url'`\n  `stream: false`\n  `watermark: true`\n  `sequential_image_generation: 'disabled'`
*   **Mock 模式**：当 `VITE_USE_MOCK === 'true'` 或 `VITE_VOLC_API_KEY` 不存在时，返回模拟数据（含 1~N 张固定图片 URL），并用 `setTimeout` 模拟延迟。

**6.3 错误处理与归一化**
*   统一捕获 HTTP 错误状态码。
*   将 API 结构化错误转换为统一的异常/返回值（例如：`throw new Error(normalizedMessage)` 或在 response 中填充 `error` 字段）。
*   需要在日志中保留错误码，但禁止打印 API Key。

## 7. 边界条件 (Edge Cases)
*   **参考图数量**：多图参考最多 14 张（包含 layoutSketch 也算 1 张）。
*   **图片大小限制**：单张图片不超过 10MB；宽高比与分辨率限制遵循 API 文档。
*   **超时处理**：设置 60s 超时限制（可用 `AbortController`）。
*   **重试策略**：仅对 500 系列错误重试 1 次；对 401/403 不重试。

## 交付物
*   `src/types/api.ts`: 完整的 API 类型定义。
*   `src/lib/api.ts`: 封装好的 API 调用模块。
