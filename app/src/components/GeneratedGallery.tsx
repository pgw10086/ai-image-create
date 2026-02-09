import { motion, AnimatePresence } from 'framer-motion';
import { Download, Clock } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { toast } from 'sonner';

export function GeneratedGallery() {
  const { tasks } = useAppStore();

  const generatedImages = tasks
    .filter(t => t.status === 'success' && Array.isArray((t.result as any)?.images))
    .flatMap(t => ((t.result as any).images as any[]).map((img) => ({
      id: t.id + img.url,
      url: img.url,
      prompt: img.prompt,
      createdAt: new Date(t.createdAt)
    })));

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `generated-image-${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('图片下载中...');
  };

  // Clear functionality is removed as per new store design focused on task history management
  // const handleClear = () => { ... };

  if (generatedImages.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 text-sm font-medium border border-violet-500/30">
            生成结果
          </span>
          <span className="text-white/50 text-sm">
            共 {generatedImages.length} 张
          </span>
        </div>
        {/* Clear button removed */}
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {generatedImages.map((image, index) => (
            <motion.div
              key={image.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: index * 0.05 }}
              className="group relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-card"
            >
              {/* Image */}
              <img
                src={image.url}
                alt={`Generated ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {/* Actions */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-white/60 text-xs">
                    <Clock className="w-3 h-3" />
                    {image.createdAt.toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleDownload(image.url, index)}
                    className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Prompt Tooltip */}
              {image.prompt && (
                <div className="absolute top-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white/80 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 truncate">
                    {image.prompt}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
