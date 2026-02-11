import { motion, AnimatePresence } from 'framer-motion';
import { Download, Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import type { GenerationTask } from '@/store/appStore';
import { toast } from 'sonner';

type TaskImage = { url: string; prompt: string };

type SingleSuccessTask = GenerationTask & {
  type: 'single';
  status: 'success';
  result: {
    images: TaskImage[];
  };
};

function hasImages(task: GenerationTask): task is SingleSuccessTask {
  return task.type === 'single' && task.status === 'success' && Array.isArray(task.result?.images);
}

function getStatusStyle(status: GenerationTask['status']) {
  if (status === 'success') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (status === 'processing') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (status === 'failed') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  return 'bg-white/10 text-white/70 border-white/20';
}

export function GeneratedGallery() {
  const { tasks } = useAppStore();
  const [showHistory, setShowHistory] = useState(false);

  const singleTasks = useMemo(
    () => tasks
      .filter((task) => task.type === 'single')
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt),
    [tasks]
  );

  const latestSuccessTask = useMemo(
    () => singleTasks.find(hasImages),
    [singleTasks]
  );

  const generatedImages = useMemo(
    () => {
      if (!latestSuccessTask) return [];
      return latestSuccessTask.result.images.map((image, index) => ({
        id: `${latestSuccessTask.id}-${index}-${image.url}`,
        url: image.url,
        prompt: image.prompt,
        createdAt: latestSuccessTask.createdAt,
      }));
    },
    [latestSuccessTask]
  );

  const handleDownload = (url: string, fileId: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `generated-image-${fileId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('图片下载中...');
  };

  if (singleTasks.length === 0) {
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
            最近一次 {generatedImages.length} 张
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-sm">历史 {singleTasks.length} 条</span>
          <button
            onClick={() => setShowHistory((value) => !value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition-colors"
          >
            {showHistory ? '收起历史记录' : '查看历史记录'}
          </button>
        </div>
      </div>

      {generatedImages.length > 0 ? (
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
                <img
                  src={image.url}
                  alt={`Generated ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-white/60 text-xs">
                      <Clock className="w-3 h-3" />
                      {new Date(image.createdAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDownload(image.url, `${image.createdAt}-${index + 1}`)}
                      className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>

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
      ) : (
        <div className="rounded-2xl border border-white/10 bg-card/60 px-4 py-6 text-sm text-white/60">
          暂无成功出图，可先输入提示词并点击发送生成。
        </div>
      )}

      <AnimatePresence>
        {showHistory ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-4 rounded-2xl border border-white/10 bg-card/50 p-4 space-y-3 max-h-[560px] overflow-y-auto"
          >
            {singleTasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className={`px-2 py-1 rounded-md text-xs border ${getStatusStyle(task.status)}`}>
                    {task.status === 'success' ? '成功' : task.status === 'failed' ? '失败' : task.status === 'processing' ? '处理中' : '待处理'}
                  </span>
                  <span className="text-xs text-white/55 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(task.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="mt-2">
                  <p className="text-xs text-white/50 mb-1">提示词</p>
                  <p className="text-sm text-white/85 whitespace-pre-wrap break-words leading-6 max-h-28 overflow-y-auto rounded-lg bg-black/25 border border-white/10 px-2.5 py-2">
                    {task.input.prompt}
                  </p>
                </div>

                {task.input.referenceImages.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-xs text-white/50 mb-1">参考图 ({task.input.referenceImages.length})</p>
                    <div className="grid grid-cols-6 gap-2">
                      {task.input.referenceImages.map((referenceImage, index) => (
                        <div key={`${task.id}-ref-${index}`} className="aspect-square rounded-md overflow-hidden border border-white/10 bg-card">
                          <img
                            src={referenceImage}
                            alt={`reference-${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {hasImages(task) ? (
                  <div className="mt-2">
                    <p className="text-xs text-white/50 mb-1">出图 ({task.result.images.length})</p>
                    <div className="grid grid-cols-6 gap-2">
                      {task.result.images.map((resultImage, index) => (
                        <div
                          key={`${task.id}-result-${index}`}
                          className="group relative aspect-square rounded-md overflow-hidden border border-white/10 bg-card"
                        >
                          <img src={resultImage.url} alt={`result-${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleDownload(resultImage.url, `${task.id}-${index + 1}`)}
                            className="absolute right-1 bottom-1 w-6 h-6 rounded-md bg-black/65 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {task.status === 'failed' && task.error ? (
                  <p className="mt-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-2">
                    {task.error}
                  </p>
                ) : null}
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
