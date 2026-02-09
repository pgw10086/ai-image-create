export type PlatformStandard = {
  id: string;
  name: string;
  description: string;
  promptHintZh: string;
  disallowTextInImage?: boolean;
  disallowWatermark?: boolean;
  recommendedMainAspectRatio?: string;
};

export const PLATFORM_STANDARDS: PlatformStandard[] = [
  {
    id: 'amazon',
    name: 'Amazon（亚马逊）',
    description: '主图要求严格：白底、无文字/水印/边框，主体占比高。',
    promptHintZh:
      '符合亚马逊主图风格：纯白背景（RGB 255,255,255），主体居中且占画面 85% 以上，真实阴影，不要额外文字/水印/Logo/边框，不要不存在的配件。',
    disallowTextInImage: true,
    disallowWatermark: true,
    recommendedMainAspectRatio: '1:1',
  },
  {
    id: 'temu',
    name: 'Temu',
    description: '审核严格：主图 1:1，严禁中文与牛皮癣贴纸。',
    promptHintZh:
      '符合 Temu 主图风格：1:1 方图，背景尽量纯白或干净实景，严禁中文字符，禁止促销贴纸/边框/大面积文字，实物清晰，色彩真实。',
    disallowTextInImage: true,
    disallowWatermark: true,
    recommendedMainAspectRatio: '1:1',
  },
  {
    id: 'tiktok',
    name: 'TikTok Shop',
    description: '移动端优先：主图多为 1:1；营销图支持 3:4/9:16。',
    promptHintZh:
      '符合 TikTok Shop 风格：移动端友好构图，主图建议 1:1 且背景干净；营销/详情图可用 3:4 或 9:16 竖屏比例，画面自然真实，突出主体。',
    disallowWatermark: true,
  },
  {
    id: 'shopee',
    name: 'Shopee',
    description: '推荐白底或干净背景；部分活动可接受轻量促销元素。',
    promptHintZh:
      '符合 Shopee 风格：主体清晰，背景建议白底或干净背景，画面整洁不过度堆叠信息，避免明显水印与大面积遮挡。',
    disallowWatermark: true,
    recommendedMainAspectRatio: '1:1',
  },
  {
    id: 'lazada',
    name: 'Lazada',
    description: '东南亚平台：推荐清晰白底主图，信息克制。',
    promptHintZh:
      '符合 Lazada 风格：主体清晰，背景建议白底或干净背景，构图简洁，避免边框水印和大段文字遮挡。',
    disallowWatermark: true,
    recommendedMainAspectRatio: '1:1',
  },
  {
    id: 'aliexpress',
    name: 'AliExpress（速卖通）',
    description: '趋向亚马逊化：主图建议白底，减少文字遮挡。',
    promptHintZh:
      '符合 AliExpress 风格：主图建议白底或干净背景，主体清晰，减少文字遮挡与花哨装饰，避免水印与边框。',
    disallowWatermark: true,
    recommendedMainAspectRatio: '1:1',
  },
  {
    id: 'ebay',
    name: 'eBay',
    description: '非常严格：禁止任何文字、边框、Logo 水印。',
    promptHintZh:
      '符合 eBay 规范：禁止任何文字、边框、Logo 与水印；背景简洁，主体清晰真实，不要占位符或无关元素。',
    disallowTextInImage: true,
    disallowWatermark: true,
    recommendedMainAspectRatio: '1:1',
  },
  {
    id: 'shein',
    name: 'SHEIN',
    description: '强调审美与统一风格；服装类通常不露出人脸。',
    promptHintZh:
      '符合 SHEIN 风格：高清、统一视觉风格，背景干净（白/浅灰/干净实景）；服装类避免出现人脸（可用截头或无头构图），避免水印与非品牌 Logo。',
    disallowWatermark: true,
  },
];

export function getPlatformStandardById(id: string) {
  const key = (id ?? '').trim();
  return PLATFORM_STANDARDS.find((p) => p.id === key);
}

