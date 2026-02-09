export type SuitePresetId = 'detail' | 'brand';

export type SuitePreset = {
  id: SuitePresetId;
  name: string;
  templateId: string;
  scene: 'detail' | 'brand';
  stylePreset?: string;
  promptAddonZh: string;
  defaultGlobalPrompt?: string;
};

export const SUITE_PRESETS: SuitePreset[] = [
  {
    id: 'detail',
    name: '详情页',
    templateId: 'suite-detail-page',
    scene: 'detail',
    stylePreset: '极简留白',
    promptAddonZh: '电商详情图风格，构图干净，信息层级清晰，留白便于后续加文案，避免牛皮癣堆叠。',
    defaultGlobalPrompt: '商品摄影，电商详情页系列图，突出卖点与细节',
  },
  {
    id: 'brand',
    name: '品牌模型',
    templateId: 'suite-brand-kv',
    scene: 'brand',
    stylePreset: '电影感',
    promptAddonZh: '品牌视觉统一，统一光色与质感，画面高级克制，氛围感强，突出品牌调性与主体。',
    defaultGlobalPrompt: '品牌视觉商品摄影系列，统一风格与调性',
  },
];

export function getSuitePresetById(id: SuitePresetId) {
  return SUITE_PRESETS.find((p) => p.id === id);
}

