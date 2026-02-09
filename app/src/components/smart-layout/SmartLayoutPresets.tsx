import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Wand2, Globe2, Languages } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

interface Preset {
  id: string;
  title: string;
  description: string;
  updates: {
    platformId?: string;
    language?: 'zh' | 'en';
    stylePreset?: string;
    scene?: string;
  };
  icon: React.ElementType;
  gradient: string;
}

const PRESETS: Preset[] = [
  {
    id: 'amazon_brand_en',
    title: '品牌模型 · 亚马逊',
    description: '推荐跨境品牌风格统一输出（英文）',
    updates: { platformId: 'amazon', language: 'en', stylePreset: '品牌模型', scene: 'crossborder' },
    icon: Sparkles,
    gradient: 'from-violet-600/25 to-purple-600/10',
  },
  {
    id: 'amazon_listing_en',
    title: 'Listing 主图 · 亚马逊',
    description: '偏电商主图构图（英文）',
    updates: { platformId: 'amazon', language: 'en', stylePreset: '主图', scene: 'listing' },
    icon: Wand2,
    gradient: 'from-blue-600/25 to-cyan-600/10',
  },
  {
    id: 'tiktok_trend_en',
    title: '爆款风格 · TikTok',
    description: '更强调冲击力与氛围（英文）',
    updates: { platformId: 'tiktok', language: 'en', stylePreset: '爆款风格', scene: 'tiktok' },
    icon: Globe2,
    gradient: 'from-pink-600/25 to-fuchsia-600/10',
  },
  {
    id: 'cn_generic_zh',
    title: '中文电商通用',
    description: '偏国内电商表达（中文）',
    updates: { platformId: 'alibaba', language: 'zh', stylePreset: '中文电商', scene: 'domestic' },
    icon: Languages,
    gradient: 'from-emerald-600/25 to-teal-600/10',
  },
];

export function SmartLayoutPresets() {
  const { generationContext, updateGenerationContext } = useAppStore();

  const recommendedId = useMemo(() => {
    if (generationContext.platformId === 'amazon' && generationContext.language === 'en') return 'amazon_listing_en';
    if (generationContext.platformId === 'tiktok' && generationContext.language === 'en') return 'tiktok_trend_en';
    if (generationContext.language === 'zh') return 'cn_generic_zh';
    return 'amazon_brand_en';
  }, [generationContext.platformId, generationContext.language]);

  const visiblePresets = useMemo(() => {
    const primary = PRESETS.filter(p => p.updates.platformId === generationContext.platformId);
    const fallback = PRESETS.filter(p => p.updates.platformId !== generationContext.platformId);
    return [...primary, ...fallback];
  }, [generationContext.platformId]);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="text-white/40 text-sm">能</span>
        <span className="text-white/20">•</span>
        <span className="text-white/40 text-sm">力</span>
        <span className="text-white/20">•</span>
        <span className="text-white/40 text-sm">卡</span>
        <span className="text-white/20">•</span>
        <span className="text-white/40 text-sm">片</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {visiblePresets.map((preset, idx) => {
          const Icon = preset.icon;
          const isRecommended = preset.id === recommendedId;
          return (
            <motion.button
              key={preset.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => updateGenerationContext(preset.updates)}
              className={`relative text-left p-5 rounded-2xl bg-gradient-to-br ${preset.gradient} border border-white/10 overflow-hidden ${
                isRecommended ? 'ring-2 ring-violet-500/40' : ''
              }`}
            >
              <div className="absolute top-4 right-4">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/10 text-white/70 border border-white/10">
                  {isRecommended ? '推荐' : 'Preset'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-white/80" />
              </div>
              <h3 className="text-white font-medium text-base mb-1">{preset.title}</h3>
              <p className="text-white/50 text-sm">{preset.description}</p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

