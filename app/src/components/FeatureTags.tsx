import { motion } from 'framer-motion';
import type React from 'react';
import { 
  ChevronDown, 
  Image, 
  Globe, 
  Sparkles,
  Ratio,
  ShoppingBag,
  Store,
  Video,
  TrendingUp,
  Box
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MODEL_OPTIONS,
  QUALITY_OPTIONS,
  RATIO_OPTIONS,
  hasGeminiApiKeyConfigured,
  isModelAvailable,
  modelSupportsResolutionToken,
  resolveModelId,
} from '@/lib/generationContext';

interface Platform {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
}

const platforms: Platform[] = [
  { id: 'amazon', name: 'Amazon（亚马逊）', icon: ShoppingBag, color: 'text-orange-400' },
  { id: 'temu', name: 'Temu（拼多多跨境）', icon: TrendingUp, color: 'text-orange-500' },
  { id: 'shopee', name: 'Shopee（虾皮）', icon: Store, color: 'text-orange-400' },
  { id: 'tiktok', name: 'TikTok Shop（抖音跨境）', icon: Video, color: 'text-pink-400' },
  { id: 'aliexpress', name: 'AliExpress（全球速卖通）', icon: Box, color: 'text-red-400' },
  { id: 'alibaba', name: '阿里巴巴国际站', icon: Globe, color: 'text-orange-500' },
  { id: 'lazada', name: 'Lazada', icon: Store, color: 'text-orange-400' },
  { id: 'ebay', name: 'eBay', icon: ShoppingBag, color: 'text-white/70' },
  { id: 'shein', name: 'SHEIN', icon: Sparkles, color: 'text-white/70' },
];

interface Tag {
  id: string;
  label: string;
  icon?: React.ElementType;
  hasDropdown?: boolean;
  isDropdown?: boolean;
}

const tags: Tag[] = [
  { id: 'model', label: '泰豪生图1', icon: Sparkles },
  { id: 'count', label: '6张', icon: Image },
  { id: 'platform', label: 'Amazon（亚马逊）', icon: ShoppingBag, isDropdown: true },
  { id: 'quality', label: '画质', icon: Sparkles },
  { id: 'ratio', label: '比例', icon: Ratio },
];

export function FeatureTags({ variant: _variant = 'default' }: { variant?: 'default' | 'suite' }) {
  const { activeTags, toggleTag, activeTab, generationContext, updateGenerationContext, uploadedImages } = useAppStore();
  const modelId = resolveModelId(generationContext.model);
  const hasGeminiApiKey = hasGeminiApiKeyConfigured();

  const selectedPlatform = platforms.find(p => p.id === generationContext.platformId) || platforms[0];

  const isTagActive = (tagId: string) => activeTags.includes(tagId);

  const visibleTags = tags.filter((t) => ['model', 'count', 'platform', 'quality', 'ratio'].includes(t.id));
  const ratioOptions = RATIO_OPTIONS.filter((r) => r.id === '智能比例' || r.id.includes(':'));
  const currentRatioMode = ratioOptions.some((r) => r.id === generationContext.ratioMode)
    ? generationContext.ratioMode
    : '智能比例';
  const currentQualityMode = generationContext.qualityMode === '4K' ? '4K' : '2K';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="mt-4 space-y-2"
    >
      {/* Main Tags Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {visibleTags.map((tag, index) => {
          const isActive = isTagActive(tag.id);
          const Icon = tag.icon;

          // Platform Dropdown
          if (tag.isDropdown) {
            return (
              <DropdownMenu key={tag.id}>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.03 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-violet-600/30 border border-violet-500/50 text-violet-200'
                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    <selectedPlatform.icon className={`w-3.5 h-3.5 ${selectedPlatform.color}`} />
                    <span>{selectedPlatform.name}</span>
                    <ChevronDown className="w-3 h-3" />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="bg-card border-border min-w-[200px]"
                  align="start"
                >
                  {platforms.map((platform) => (
                    <DropdownMenuItem
                      key={platform.id}
                      onClick={() => updateGenerationContext({ platformId: platform.id })}
                      className="flex items-center gap-2 cursor-pointer hover:bg-white/5"
                    >
                      <platform.icon className={`w-4 h-4 ${platform.color}`} />
                      <span className="text-white/80">{platform.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (tag.id === 'count') {
            const isSmartLayout = activeTab === 'smart_layout';
            const currentCount = Math.max(1, Math.floor(generationContext.imageCount || 1));
            const label = `${currentCount}张`;
            const maxAllowed = isSmartLayout ? 15 : Math.max(1, 15 - uploadedImages.length);
            const options = Array.from({ length: 15 }, (_, idx) => idx + 1);
            return (
              <DropdownMenu key={tag.id}>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.03 }}
                    onClick={() => {
                      toggleTag(tag.id);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    title={
                      isSmartLayout
                        ? '智能布局多图：若模型不支持组图将自动分次生成；参考图过多会降低单次组图上限'
                        : uploadedImages.length > 0
                          ? `参考图 ${uploadedImages.length} 张，最多可生成 ${maxAllowed} 张`
                          : undefined
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-violet-600/30 border border-violet-500/50 text-violet-200'
                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{label}</span>
                    <ChevronDown className="w-3 h-3" />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border min-w-[160px]" align="start">
                  {options.map((n) => {
                    const disabledOption = n > maxAllowed;
                    return (
                      <DropdownMenuItem
                        key={n}
                        disabled={disabledOption}
                        onClick={() => {
                          if (disabledOption) return;
                          updateGenerationContext({ imageCount: n });
                        }}
                        className="flex items-center justify-between cursor-pointer hover:bg-white/5"
                      >
                        <span className="text-white/80">{n === 1 ? '单图' : `${n}张`}</span>
                        {n === currentCount && <span className="text-violet-300">✓</span>}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (tag.id === 'model') {
            return (
              <DropdownMenu key={tag.id}>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.03 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-violet-600/30 border border-violet-500/50 text-violet-200'
                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{generationContext.model || tag.label}</span>
                    <ChevronDown className="w-3 h-3" />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border min-w-[220px]" align="start">
                  {MODEL_OPTIONS.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      disabled={!isModelAvailable(m.id)}
                      onClick={() => {
                        if (!isModelAvailable(m.id)) return;
                        const nextImageCount = Math.max(1, Math.floor(generationContext.imageCount || 1));
                        const nextRatioMode = ratioOptions.some((r) => r.id === generationContext.ratioMode)
                          ? generationContext.ratioMode
                          : '智能比例';
                        const nextQualityMode =
                          generationContext.qualityMode === '4K' && modelSupportsResolutionToken(m.id, '4K') ? '4K' : '2K';
                        updateGenerationContext({
                          model: m.label,
                          imageCount: nextImageCount,
                          ratioMode: nextRatioMode,
                          qualityMode: nextQualityMode,
                        });
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-white/5"
                    >
                      <span className={!isModelAvailable(m.id) ? 'text-white/40' : 'text-white/80'}>
                        {m.label}{!isModelAvailable(m.id) ? '（需配置 VITE_GOOGLE_API_KEY）' : ''}
                      </span>
                      {m.label === generationContext.model && <span className="text-violet-300">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (tag.id === 'quality') {
            const optionDisabled = (quality: '2K' | '4K') => {
              if (quality === '4K') return !modelSupportsResolutionToken(modelId, '4K');
              return false;
            };

            return (
              <DropdownMenu key={tag.id}>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.03 }}
                    onClick={() => {
                      toggleTag(tag.id);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-violet-600/30 border border-violet-500/50 text-violet-200'
                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{currentQualityMode}</span>
                    <ChevronDown className="w-3 h-3" />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border min-w-[140px]" align="start">
                  {QUALITY_OPTIONS.map((q) => (
                    <DropdownMenuItem
                      key={q.id}
                      disabled={optionDisabled(q.id)}
                      onClick={() => {
                        if (optionDisabled(q.id)) return;
                        updateGenerationContext({ qualityMode: q.id });
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-white/5"
                    >
                      <span className={optionDisabled(q.id) ? 'text-white/40' : 'text-white/80'}>{q.label}</span>
                      {q.id === currentQualityMode && <span className="text-violet-300">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (tag.id === 'ratio') {
            return (
              <DropdownMenu key={tag.id}>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.03 }}
                    onClick={() => {
                      toggleTag(tag.id);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    title={activeTab === 'smart_layout' ? '固定输出比例' : undefined}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-violet-600/30 border border-violet-500/50 text-violet-200'
                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{currentRatioMode || tag.label}</span>
                    <ChevronDown className="w-3 h-3" />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border min-w-[160px]" align="start">
                  {ratioOptions.map((r) => (
                    <DropdownMenuItem
                      key={r.id}
                      onClick={() => {
                        updateGenerationContext({ ratioMode: r.id });
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-white/5"
                    >
                      <span className="text-white/80">{r.label}</span>
                      {r.id === currentRatioMode && <span className="text-violet-300">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <motion.button
              key={tag.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.03 }}
              onClick={() => toggleTag(tag.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-violet-600/30 border border-violet-500/50 text-violet-200'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>
                {tag.label}
              </span>
              {tag.hasDropdown && <ChevronDown className="w-3 h-3" />}
            </motion.button>
          );
        })}
      </div>

      {/* Bottom Tags Row */}
      {!hasGeminiApiKey && (
        <div className="text-xs text-amber-300/80 px-1">泰豪生图模型已禁用：请配置 `VITE_GOOGLE_API_KEY`</div>
      )}
    </motion.div>
  );
}
