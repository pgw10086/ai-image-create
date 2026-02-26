const BIGMODEL_API_KEY = import.meta.env.VITE_BIGMODEL_API_KEY || '';
const BIGMODEL_API_URL =
  import.meta.env.VITE_BIGMODEL_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const TIMEOUT_MS = 60000;

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type BigModelChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function extractJsonCandidate(input: string) {
  const start = input.indexOf('{');
  const end = input.lastIndexOf('}');
  if (start >= 0 && end > start) return input.slice(start, end + 1);
  return input;
}

function parseJsonObject<T>(input: string): T {
  const candidate = extractJsonCandidate(input.trim());
  return JSON.parse(candidate) as T;
}

async function fetchJson(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const json = (await response.json().catch(() => ({}))) as any;
    if (!response.ok) {
      const message = json?.error?.message || response.statusText || 'Request failed';
      throw new Error(message);
    }
    return json;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type OptimizeZonePromptInput = {
  id: string;
  type: 'background' | 'prop' | 'main';
  prompt: string;
};

export async function optimizeSmartLayoutZonePrompts(input: {
  zones: OptimizeZonePromptInput[];
  language?: 'zh' | 'en';
}): Promise<Array<{ id: string; prompt: string }>> {
  if (!BIGMODEL_API_KEY) {
    throw new Error('未配置 VITE_BIGMODEL_API_KEY');
  }

  const zones = input.zones.map((z) => ({
    id: z.id,
    type: z.type,
    prompt: (z.prompt || '').trim(),
  }));

  const system = [
    '你是电商商品图生成的提示词优化助手。',
    '任务：对用户提供的每个区域提示词 prompt 做“可控、可执行、不过度发挥”的优化，提升生成稳定性与可读性。',
    '要求：',
    '- 保持每条 prompt 的语言不变（中文保持中文，英文保持英文）。',
    '- 保留占位符变量（例如 {PRODUCT}），不要替换、删除或展开成具体商品。',
    '- 不要添加坐标、bbox、zIndex、颜色等布局元信息。',
    '- 不要新增“边框/编号/文字/水印”等会引入画面污染的要求。',
    '- 优化应更具体，但尽量短（建议 1~2 句，逗号分隔即可）。',
    '输出：仅输出一个 JSON 对象，结构为 {"zones":[{"id":"...","prompt":"..."}]}，不要输出其它文字。',
  ].join('\n');

  const payload = {
    language: input.language || 'zh',
    zones,
  };

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(payload) },
  ];

  const response = (await fetchJson(
    BIGMODEL_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BIGMODEL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'glm-5',
        messages,
        temperature: 0.2,
        stream: false,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    },
    TIMEOUT_MS
  )) as BigModelChatResponse;

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    const message = response.error?.message || '模型未返回内容';
    throw new Error(message);
  }

  const parsed = parseJsonObject<{ zones?: Array<{ id?: string; prompt?: string }> }>(content);
  const list = Array.isArray(parsed.zones) ? parsed.zones : [];
  return list
    .map((z) => ({ id: (z.id || '').trim(), prompt: (z.prompt || '').trim() }))
    .filter((z) => z.id && z.prompt);
}

export async function polishFreeGenerationPrompt(input: {
  prompt: string;
  language?: 'zh' | 'en';
}): Promise<string> {
  if (!BIGMODEL_API_KEY) {
    throw new Error('未配置 VITE_BIGMODEL_API_KEY');
  }

  const rawPrompt = (input.prompt || '').trim();
  if (!rawPrompt) {
    throw new Error('提示词为空，无法润色');
  }

  const system = [
    '你是电商商品图生成提示词润色助手。',
    '任务：在不改变用户核心意图的前提下，把输入润色为更清晰、可执行、稳定出图的提示词。',
    '要求：',
    '- 保持原语言（中文输入输出中文，英文输入输出英文）。',
    '- 不编造不存在的产品信息，不新增品牌、价格、人名等虚构细节。',
    '- 允许补充必要的画面结构、材质、光线、镜头、背景约束，但要简洁。',
    '- 禁止输出代码块、解释、前后缀说明。',
    '输出：仅输出 JSON 对象 {"prompt":"..."}。',
  ].join('\n');

  const response = (await fetchJson(
    BIGMODEL_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BIGMODEL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'glm-5',
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: JSON.stringify({
              language: input.language || 'zh',
              prompt: rawPrompt,
            }),
          },
        ] as ChatMessage[],
        temperature: 0.2,
        stream: false,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    },
    TIMEOUT_MS
  )) as BigModelChatResponse;

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    const message = response.error?.message || '模型未返回内容';
    throw new Error(message);
  }

  const parsed = parseJsonObject<{ prompt?: string }>(content);
  const polishedPrompt = (parsed.prompt || '').trim();
  if (!polishedPrompt) {
    throw new Error('模型未返回可用润色结果');
  }
  return polishedPrompt;
}
