import { motion } from 'framer-motion';
import type React from 'react';
import { 
  ChevronDown, 
  Image, 
  FileText, 
  Globe, 
  Languages, 
  Upload, 
  Palette, 
  MoreHorizontal,
  Sparkles,
  Type,
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
  RATIO_OPTIONS,
  STYLE_PRESETS,
  hasGeminiApiKeyConfigured,
  isModelAvailable,
  modelSupportsResolutionToken,
  resolveModelId,
} from '@/lib/generationContext';
import { useImageUploadPicker } from '@/hooks/useImageUploadPicker';

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
  { id: 'crossborder', label: '跨境设计', icon: Globe, hasDropdown: true },
  { id: 'detail', label: '详情图', icon: FileText, hasDropdown: true },
  { id: 'model', label: '泰豪生图1.0', icon: Sparkles },
  { id: 'count', label: '6张', icon: Image },
  { id: 'platform', label: 'Amazon（亚马逊）', icon: ShoppingBag, isDropdown: true },
  { id: 'english', label: '英文', icon: Languages },
  { id: 'ratio', label: '智能比例', icon: Ratio },
  { id: 'more', label: '更多', icon: MoreHorizontal, hasDropdown: true },
  { id: 'style', label: '参考风格', icon: Palette },
];

const bottomTags: Tag[] = [
  { id: 'upload', label: '上传文件', icon: Upload },
  { id: 'text', label: '有文本', icon: Type },
];

export function FeatureTags({ variant = 'default' }: { variant?: 'default' | 'suite' }) {
  const { activeTags, toggleTag, activeTab, generationContext, updateGenerationContext, uploadedImages } = useAppStore();
  const { fileInputRef, handleFileUpload, openPicker } = useImageUploadPicker();
  const modelId = resolveModelId(generationContext.model);
  const hasGeminiApiKey = hasGeminiApiKeyConfigured();

  const selectedPlatform = platforms.find(p => p.id === generationContext.platformId) || platforms[0];

  const isTagActive = (tagId: string) => activeTags.includes(tagId);

  const visibleTags =
    variant === 'suite'
      ? tags.filter((t) => ['model', 'style', 'more'].includes(t.id))
      : tags;

  const visibleBottomTags = variant === 'suite' ? bottomTags.filter((t) => t.id === 'text') : bottomTags;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="mt-4 space-y-2"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Main Tags Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {visibleTags.map((tag, index) => {
          const isActive =
            tag.id === 'crossborder'
              ? generationContext.scene === 'crossborder'
              : tag.id === 'detail'
                ? generationContext.scene === 'detail' || !generationContext.scene
                : isTagActive(tag.id);
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
            const disabled = activeTab === 'smart_layout';
            const label = disabled ? '单图' : `${generationContext.imageCount}张`;
            const maxAllowed = Math.max(1, 15 - uploadedImages.length);
            const options = [1, 4, 6, 8, 12, 15];
            return (
              <DropdownMenu key={tag.id}>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.03 }}
                    onClick={() => {
                      if (disabled) return;
                      toggleTag(tag.id);
                    }}
                    whileHover={disabled ? undefined : { scale: 1.02 }}
                    whileTap={disabled ? undefined : { scale: 0.98 }}
                    title={disabled ? '智能布局默认单图输出' : uploadedImages.length > 0 ? `参考图 ${uploadedImages.length} 张，最多可生成 ${maxAllowed} 张` : undefined}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                      disabled
                        ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                        : (isActive
                          ? 'bg-violet-600/30 border border-violet-500/50 text-violet-200'
                          : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80')
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{label}</span>
                    <ChevronDown className="w-3 h-3" />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border min-w-[160px]" align="start">
                  {options.map((n) => {
                    const disabledOption = disabled || n > maxAllowed;
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
                        {n === generationContext.imageCount && <span className="text-violet-300">✓</span>}
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
                        const nextImageCount = m.supportsGroupGeneration ? generationContext.imageCount : 1;
                        const currentRatioMode = (generationContext.ratioMode ?? '智能比例').trim();
                        let nextRatioMode = currentRatioMode;
                        if (m.id.includes('seededit-3.0-i2i')) nextRatioMode = '智能比例';
                        if (currentRatioMode === '1K' && !modelSupportsResolutionToken(m.id, '1K')) nextRatioMode = '智能比例';
                        if (currentRatioMode === '2K' && !modelSupportsResolutionToken(m.id, '2K')) nextRatioMode = '智能比例';
                        if (currentRatioMode === '4K' && !modelSupportsResolutionToken(m.id, '4K')) nextRatioMode = '智能比例';
                        updateGenerationContext({ model: m.label, imageCount: nextImageCount, ratioMode: nextRatioMode });
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

          if (tag.id === 'english') {
            const label = generationContext.language === 'en' ? '英文' : '中文';
            return (
              <motion.button
                key={tag.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.03 }}
                onClick={() => {
                  const next = generationContext.language === 'en' ? 'zh' : 'en';
                  updateGenerationContext({ language: next });
                  toggleTag('english');
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
                <span>{label}</span>
                {tag.hasDropdown && <ChevronDown className="w-3 h-3" />}
              </motion.button>
            );
          }

          if (tag.id === 'ratio') {
            const isSeedEdit = modelId.includes('seededit-3.0-i2i');
            const optionDisabled = (ratio: string) => {
              if (isSeedEdit) return ratio !== '智能比例';
              if (modelId.includes('gemini-3-pro-image-preview') && ratio === '1K') return true;
              if (ratio === '1K') return !modelSupportsResolutionToken(modelId, '1K');
              if (ratio === '2K') return !modelSupportsResolutionToken(modelId, '2K');
              if (ratio === '4K') return !modelSupportsResolutionToken(modelId, '4K');
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
                    title={
                      activeTab === 'smart_layout'
                        ? '智能比例随画布宽高比推导输出尺寸；固定比例将显式指定 size'
                        : undefined
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-violet-600/30 border border-violet-500/50 text-violet-200'
                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{generationContext.ratioMode || tag.label}</span>
                    <ChevronDown className="w-3 h-3" />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border min-w-[160px]" align="start">
                  {RATIO_OPTIONS.map((r) => (
                    <DropdownMenuItem
                      key={r.id}
                      disabled={optionDisabled(r.id)}
                      onClick={() => {
                        if (optionDisabled(r.id)) return;
                        updateGenerationContext({ ratioMode: r.id });
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-white/5"
                    >
                      <span className="text-white/80">{r.label}</span>
                      {r.id === generationContext.ratioMode && <span className="text-violet-300">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (tag.id === 'style') {
            const current = generationContext.stylePreset ? generationContext.stylePreset : '参考风格';
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
                    <span>{current}</span>
                    <ChevronDown className="w-3 h-3" />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border min-w-[200px]" align="start">
                  {STYLE_PRESETS.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => {
                        updateGenerationContext({ stylePreset: s.id === 'none' ? undefined : s.label });
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-white/5"
                    >
                      <span className="text-white/80">{s.label}</span>
                      {((s.id === 'none' && !generationContext.stylePreset) || s.label === generationContext.stylePreset) && (
                        <span className="text-violet-300">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (tag.id === 'crossborder') {
            return (
              <motion.button
                key={tag.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.03 }}
                onClick={() => updateGenerationContext({ scene: 'crossborder' })}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-violet-600/30 border border-violet-500/50 text-violet-200'
                    : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tag.label}</span>
              </motion.button>
            );
          }

          if (tag.id === 'detail') {
            return (
              <motion.button
                key={tag.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.03 }}
                onClick={() => updateGenerationContext({ scene: 'detail' })}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-violet-600/30 border border-violet-500/50 text-violet-200'
                    : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tag.label}</span>
              </motion.button>
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
        <div className="text-xs text-amber-300/80 px-1">泰豪生图1.0-pro 已禁用：请配置 `VITE_GOOGLE_API_KEY`</div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {visibleBottomTags.map((tag, index) => {
          const isActive = isTagActive(tag.id);
          const Icon = tag.icon;

          return (
            <motion.button
              key={tag.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + index * 0.03 }}
              onClick={() => {
                if (tag.id === 'upload') {
                  toggleTag(tag.id);
                  openPicker();
                  return;
                }
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
              <span>{tag.label}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
