import type { SuiteShotDefinition } from '@/types/suite';

export const SUITE_SHOTS: SuiteShotDefinition[] = [
  {
    id: 'front',
    name: '正视主图',
    description: '主体居中、纯净背景，适合电商主图与封面。',
    defaultPromptSuffixZh:
      '正视角度，主体居中，棚拍质感，柔和打光，清晰细节，干净背景，真实阴影，画面简洁，突出主体。',
    defaultRatioMode: '1:1',
    defaultImageCount: 2,
  },
  {
    id: 'side',
    name: '侧视图',
    description: '强调侧面结构与轮廓，适合展示厚度/接口/侧面细节。',
    defaultPromptSuffixZh:
      '侧视角度，突出产品侧面结构与轮廓，棚拍质感，清晰细节，干净背景，真实阴影，画面简洁。',
    defaultRatioMode: '1:1',
    defaultImageCount: 2,
  },
  {
    id: 'angle45',
    name: '45° 角度',
    description: '更立体、更有动感，常用于展示造型与质感。',
    defaultPromptSuffixZh:
      '45度斜侧视角，立体感强，突出造型与材质质感，棚拍质感，清晰细节，干净背景，真实阴影。',
    defaultRatioMode: '1:1',
    defaultImageCount: 2,
  },
  {
    id: 'detail',
    name: '细节特写',
    description: '突出材质纹理、做工、按钮/缝线等局部信息。',
    defaultPromptSuffixZh:
      '细节特写，微距视角，突出材质纹理与工艺细节，清晰锐利，棚拍质感，干净背景，避免过度虚化遮挡关键细节。',
    defaultRatioMode: '4:3',
    defaultImageCount: 2,
  },
  {
    id: 'scene',
    name: '使用场景',
    description: '生活方式场景，自然光，更贴近真实使用。',
    defaultPromptSuffixZh:
      '使用场景，生活方式场景，自然光，真实环境，浅景深，产品被自然使用，画面干净，突出主体。',
    defaultRatioMode: '4:3',
    defaultImageCount: 2,
  },
  {
    id: 'on-foot',
    name: '上脚场景',
    description: '适用于鞋靴，强调上脚效果与穿搭氛围。',
    defaultPromptSuffixZh:
      '上脚场景，街头或室内自然光，真实穿搭，突出鞋靴轮廓与材质，浅景深，画面干净，避免遮挡主体。',
    defaultRatioMode: '4:3',
    defaultImageCount: 2,
  },
  {
    id: 'in-hand',
    name: '手持展示',
    description: '增强尺度感与使用感，适合小家电/3C。',
    defaultPromptSuffixZh:
      '手持展示，强调尺度与握持方式，肤色自然，光线柔和，背景简洁，突出主体与关键细节，避免夸张姿势。',
    defaultRatioMode: '4:3',
    defaultImageCount: 2,
  },
];

export function getSuiteShotById(shotId: string) {
  return SUITE_SHOTS.find((s) => s.id === shotId);
}

