import { motion } from 'framer-motion';
import { Plus, Sparkles, Send, X, Loader2, Eye } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import type { GenerationTask } from '@/store/appStore';
import { generateImage } from '@/lib/api';
import {
  buildPromptWithContext,
  computeGroupGeneration,
  hasGeminiApiKeyConfigured,
  isTaihaoProModel,
  resolveModelId,
  resolveSizeFromRatioMode,
} from '@/lib/generationContext';
import { useImageUploadPicker } from '@/hooks/useImageUploadPicker';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

const examplePrompts = [
  '无线耳机，主动降噪，地铁上使用',
  '智能手表，运动监测，户外跑步',
  '护肤套装，保湿补水，浴室场景',
  '运动鞋，透气轻便，健身房场景',
  '咖啡机，意式浓缩，厨房台面',
];

export function InputArea() {
  const { 
    inputValue, 
    setInputValue, 
    uploadedImages, 
    removeUploadedImage,
    addTask,
    updateTaskStatus,
    tasks,
    generationContext,
    activeTags,
  } = useAppStore();
  
  const [isFocused, setIsFocused] = useState(false);
  const {
    fileInputRef,
    handleFileUpload,
    openPicker,
    isDragActive,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
  } = useImageUploadPicker();

  const isGenerating = tasks.some(t => t.status === 'processing');

  const handleGenerate = async () => {
    if (!inputValue.trim() && uploadedImages.length === 0) {
      toast.error('请输入创作内容或上传产品图');
      return;
    }

    const modelId = resolveModelId(generationContext.model);
    if (isTaihaoProModel(modelId) && !hasGeminiApiKeyConfigured()) {
      toast.error('未配置 VITE_GOOGLE_API_KEY，无法使用泰豪生图1.0-pro');
      return;
    }
    const ratioModeRaw = (generationContext.ratioMode ?? '').trim();
    const ratioMode = ratioModeRaw === '智能比例' || ratioModeRaw.includes(':') ? ratioModeRaw : '智能比例';
    const qualityMode = generationContext.qualityMode === '4K' ? '4K' : '2K';
    const { size, hint: sizeHint } = resolveSizeFromRatioMode({ ratioMode, qualityMode, modelId });
    const allowText = activeTags.includes('text');
    const basePrompt = (inputValue.trim() || 'product photography, professional e-commerce style').trim();
    const prompt = buildPromptWithContext({
      basePrompt,
      context: generationContext,
      allowText,
      sizeHint,
    });

    const referenceCount = uploadedImages.length;
    const group = computeGroupGeneration({
      requestedCount: generationContext.imageCount,
      referenceCount,
      modelId,
    });

    if (generationContext.imageCount > 1 && group.sequential_image_generation !== 'auto') {
      toast.message('当前模型不支持组图，将按单图生成');
    }

    // Create new task
    const newTask: GenerationTask = {
        id: Date.now().toString(),
        type: 'single',
        status: 'processing',
        createdAt: Date.now(),
        input: {
            prompt,
            referenceImages: uploadedImages.map(img => img.url),
            model: modelId
        }
    };
    
    addTask(newTask);
    
    try {
      const response = await generateImage({
        prompt,
        image: newTask.input.referenceImages.length > 0 
          ? (newTask.input.referenceImages.length === 1 ? newTask.input.referenceImages[0] : newTask.input.referenceImages) 
          : undefined,
        model: modelId as any,
        size,
        sequential_image_generation: group.sequential_image_generation,
        sequential_image_generation_options: group.sequential_image_generation === 'auto' ? { max_images: group.maxImages } : undefined,
      });
      
      if (response.data && response.data.length > 0 && response.data[0].url) {
        updateTaskStatus(newTask.id, 'success', {
            images: response.data.map((d: any) => ({ 
                url: d.url, 
                prompt: prompt 
            }))
        });
        toast.success('图片生成成功！');
        setInputValue('');
      } else {
        const errorMsg = response.error?.message || response.message || '生成失败，请重试';
        updateTaskStatus(newTask.id, 'failed', errorMsg);
        toast.error(errorMsg);      }
    } catch (error) {
      updateTaskStatus(newTask.id, 'failed', '生成过程中出现错误');
      toast.error('生成过程中出现错误');    }
  };

  const handleAIWrite = () => {
    const randomPrompt = examplePrompts[Math.floor(Math.random() * examplePrompts.length)];
    setInputValue(randomPrompt);
    toast.success('已生成创意描述');
  };

  const handleViewExample = () => {
    const randomPrompt = examplePrompts[Math.floor(Math.random() * examplePrompts.length)];
    setInputValue(randomPrompt);
    toast.info('已加载示例，点击发送即可生成');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mt-4"
    >
      {/* Uploaded Images Preview */}
      {uploadedImages.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {uploadedImages.map((img) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/20"
            >
              <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
              <button
                onClick={() => removeUploadedImage(img.id)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:bg-black/80"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        className={`relative flex items-end gap-3 p-3 rounded-2xl bg-card/80 border transition-all duration-300 ${
          isFocused
            ? 'border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.15)]'
            : 'border-white/10'
        } ${isDragActive ? 'border-violet-400/70 bg-violet-500/10' : ''}`}
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          multiple
          className="hidden"
        />

        {/* Product Image Upload Button */}
        <motion.button
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(139, 92, 246, 0.2)' }}
          whileTap={{ scale: 0.98 }}
          onClick={openPicker}
          className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-violet-600/10 border border-violet-500/30 text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">产品图</span>
        </motion.button>

        {/* Input Field */}
        <div className="flex-1 min-w-0">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="请输入产品名、卖点和场景；如：无线耳机，主动降噪，地铁上使用\n支持多行描述，按 Ctrl/Cmd + Enter 发送"
            className="min-h-14 max-h-40 bg-transparent border-0 shadow-none px-0 py-2 text-white placeholder:text-white/40 text-base leading-6 resize-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
        </div>

        {/* View Example Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleViewExample}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
        >
          <Eye className="w-4 h-4" />
          <span className="text-sm">查看示例</span>
        </motion.button>

        {/* AI Write Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAIWrite}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-violet-600/25 transition-shadow flex-shrink-0 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI 帮我写</span>
        </motion.button>

        {/* Send Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white hover:bg-violet-500 transition-colors flex-shrink-0 disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
