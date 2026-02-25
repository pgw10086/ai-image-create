import type { SuiteTemplate } from '@/types/suite';
import { createMockImageDataUri } from '@/lib/mockImage';

export const suiteTemplates: SuiteTemplate[] = [
  {
    id: 'suite-jewelry-rack-storage',
    name: '首饰置物架套图模板',
    description: '覆盖白底主图、尺寸标注、产品场景、模特场景、品类展示、礼赠场景与功能卖点分解，适合首饰收纳类商品页。',
    coverImage:
      createMockImageDataUri({ title: '首饰置物架套图模板', subtitle: '家居收纳模板', width: 1200, height: 675 }),
    availableShotIds: [
      'jewelry-rack-white-product',
      'jewelry-rack-size-annotated',
      'jewelry-rack-product-scene',
      'jewelry-rack-model-scene',
      'jewelry-rack-category-showcase',
      'jewelry-rack-gift-scene-collage',
      'jewelry-rack-feature-breakdown',
    ],
    defaultShotIds: [
      'jewelry-rack-white-product',
      'jewelry-rack-size-annotated',
      'jewelry-rack-product-scene',
      'jewelry-rack-model-scene',
      'jewelry-rack-category-showcase',
      'jewelry-rack-gift-scene-collage',
      'jewelry-rack-feature-breakdown',
    ],
  },
  {
    id: 'suite-bow-lace-girls',
    name: '蝴蝶结套图模板',
    description: '围绕黑色蕾丝蝴蝶结：标准产品图 + 模特效果图 + 尺寸参考图 + 尺寸标注图 + 假发参考图。',
    coverImage:
      createMockImageDataUri({ title: '蝴蝶结套图模板', subtitle: '饰品配件模板', width: 1200, height: 675 }),
    availableShotIds: ['bow-standard-product', 'bow-model-portrait', 'bow-size-reference', 'bow-size-annotated', 'bow-wig-reference'],
    defaultShotIds: ['bow-standard-product', 'bow-model-portrait', 'bow-size-reference', 'bow-size-annotated', 'bow-wig-reference'],
  },
  {
    id: 'suite-amazon-main-compliance',
    name: '亚马逊合规主图组',
    description: '围绕 Amazon 主图规则：白底主图 + 角度图 + 细节图 + 包装清单。',
    coverImage:
      createMockImageDataUri({ title: '亚马逊合规主图组', subtitle: '海外电商模板', width: 1200, height: 675 }),
    availableShotIds: ['front', 'angle45', 'detail', 'scale-reference', 'what-in-box'],
    defaultShotIds: ['front', 'angle45', 'detail', 'what-in-box'],
  },
  {
    id: 'suite-amazon-conversion-7pack',
    name: '亚马逊转化七图',
    description: '按高转化详情逻辑组织：主图、卖点、对比、场景、步骤、清单、细节。',
    coverImage:
      createMockImageDataUri({ title: '亚马逊转化七图', subtitle: '海外电商模板', width: 1200, height: 675 }),
    availableShotIds: [
      'front',
      'feature-callout',
      'comparison',
      'scene',
      'usage-step',
      'what-in-box',
      'material-closeup',
      'scale-reference',
    ],
    defaultShotIds: ['front', 'feature-callout', 'comparison', 'scene', 'usage-step', 'what-in-box', 'material-closeup'],
  },
  {
    id: 'suite-detail-page',
    name: '详情页套图',
    description: '适合电商详情页：主图 + 多角度 + 细节特写 + 场景图。',
    coverImage:
      createMockImageDataUri({ title: '详情页套图', subtitle: '套图模版', width: 1200, height: 675 }),
    availableShotIds: ['front', 'angle45', 'side', 'detail', 'scene', 'in-hand'],
    defaultShotIds: ['front', 'angle45', 'detail', 'scene'],
  },
  {
    id: 'suite-amazon-infographic',
    name: '信息图卖点套图',
    description: '适合功能型产品：卖点拆解 + 参数模块 + 对比图，便于详情承接。',
    coverImage:
      createMockImageDataUri({ title: '信息图卖点套图', subtitle: '海外电商模板', width: 1200, height: 675 }),
    availableShotIds: ['front', 'feature-callout', 'comparison', 'usage-step', 'detail', 'scene'],
    defaultShotIds: ['feature-callout', 'comparison', 'usage-step', 'detail'],
  },
  {
    id: 'suite-lifestyle-conversion',
    name: '生活方式转化组',
    description: '以场景种草为主：真实使用、手持尺度、前后变化、细节质感。',
    coverImage:
      createMockImageDataUri({ title: '生活方式转化组', subtitle: '海外电商模板', width: 1200, height: 675 }),
    availableShotIds: ['scene', 'in-hand', 'scale-reference', 'before-after', 'detail', 'angle45'],
    defaultShotIds: ['scene', 'in-hand', 'before-after', 'detail'],
  },
  {
    id: 'suite-brand-kv',
    name: '品牌视觉套图',
    description: '适合品牌统一风格：质感主图 + KV 场景 + 材质细节。',
    coverImage:
      createMockImageDataUri({ title: '品牌视觉套图', subtitle: '套图模版', width: 1200, height: 675 }),
    availableShotIds: ['front', 'angle45', 'detail', 'scene'],
    defaultShotIds: ['angle45', 'scene', 'detail'],
  },
  {
    id: 'suite-multi-variant',
    name: '多规格多颜色组',
    description: '适合同款多 SKU：主图 + 颜色矩阵 + 对比 + 场景，降低选款成本。',
    coverImage:
      createMockImageDataUri({ title: '多规格多颜色组', subtitle: '海外电商模板', width: 1200, height: 675 }),
    availableShotIds: ['front', 'color-variants', 'comparison', 'scale-reference', 'scene', 'detail'],
    defaultShotIds: ['front', 'color-variants', 'comparison', 'scene'],
  },
];
