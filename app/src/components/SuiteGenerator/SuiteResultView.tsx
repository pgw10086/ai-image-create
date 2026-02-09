import { motion } from 'framer-motion';
import JSZip from 'jszip';
import { Clock, Download, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/appStore';
import type { GenerationTask } from '@/store/appStore';
import type { SuiteGenerationResult, SuiteItemResult } from '@/types/suite';
import { generateSuiteItem } from '@/services/suiteGenerationService';

function sanitizeFilename(name: string) {
  return (name || 'image').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'image';
}

function guessExt(url: string) {
  try {
    const u = new URL(url);
    const pathname = u.pathname || '';
    const match = pathname.match(/\.(jpg|jpeg|png|webp)$/i);
    if (match?.[1]) return `.${match[1].toLowerCase()}`;
  } catch {}
  return '.jpg';
}

function downloadByLink(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function SuiteResultView() {
  const { tasks, updateTaskStatus, deductCredits } = useAppStore();

  const suiteTasks = tasks.filter((t) => t.type === 'suite' && t.status === 'success' && t.result?.suite) as Array<
    GenerationTask & { result: { suite: SuiteGenerationResult } }
  >;

  const handleDownloadAll = async (suiteTask: GenerationTask & { result: { suite: SuiteGenerationResult } }) => {
    const suite = suiteTask.result.suite;
    const images = suite.items.flatMap((it, itemIdx) => {
      const list = (it.images ?? []).filter((img) => img?.url);
      return list.map((img, imgIdx) => ({
        itemIdx,
        imgIdx,
        name: it.name,
        url: img.url,
      }));
    });

    if (images.length === 0) {
      toast.error('没有可下载的图片');
      return;
    }

    const zip = new JSZip();
    try {
      await Promise.all(
        images.map(async (img) => {
          const resp = await fetch(img.url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          const filename = `${String(img.itemIdx + 1).padStart(2, '0')}_${String(img.imgIdx + 1).padStart(2, '0')}_${sanitizeFilename(img.name)}${guessExt(img.url)}`;
          zip.file(filename, blob);
        })
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      downloadByLink(url, `${sanitizeFilename(suite.templateName)}.zip`);
      URL.revokeObjectURL(url);
      toast.success('打包下载中...');
    } catch (err: any) {
      toast.error('打包下载失败，改为逐张下载');
      images.forEach((img) => downloadByLink(img.url, `${sanitizeFilename(img.name)}${guessExt(img.url)}`));
    }
  };

  const handleRetry = async (
    suiteTask: GenerationTask & { result: { suite: SuiteGenerationResult } },
    item: SuiteItemResult
  ) => {
    const suite = suiteTask.result.suite;

    if (!deductCredits(10)) {
      toast.error('算力不足，请充值');
      return;
    }

    try {
      const isFirst = suite.items[0]?.id === item.id;
      const refImages =
        !isFirst && suite.useFirstImageAsReference && suite.firstImageUrl
          ? [suite.firstImageUrl, ...suite.referenceImages].slice(0, 14)
          : suite.referenceImages;

      const { images } = await generateSuiteItem({
        prompt: item.prompt,
        referenceImages: refImages,
        model: suite.model,
        size: item.size,
        imageCount: item.imageCount,
        watermark: suite.watermark,
      });

      const nextSuite: SuiteGenerationResult = {
        ...suite,
        items: suite.items.map((it) =>
          it.id === item.id ? { ...it, status: 'success', images, error: undefined } : it
        ),
        firstImageUrl: suite.firstImageUrl || (isFirst ? images[0]?.url : suite.firstImageUrl),
      };

      updateTaskStatus(suiteTask.id, 'success', { suite: nextSuite });
      toast.success('重试成功');
    } catch (err: any) {
      deductCredits(-10);
      const nextSuite: SuiteGenerationResult = {
        ...suite,
        items: suite.items.map((it) =>
          it.id === item.id ? { ...it, status: 'failed', error: err?.message || '生成失败，请重试' } : it
        ),
      };
      updateTaskStatus(suiteTask.id, 'success', { suite: nextSuite });
      toast.error(err?.message || '生成失败，请重试');
    }
  };

  if (suiteTasks.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 text-sm font-medium border border-violet-500/30">
            套图结果
          </span>
          <span className="text-white/50 text-sm">共 {suiteTasks.length} 组</span>
        </div>
      </div>

      <div className="space-y-4">
        {suiteTasks.map((suiteTask) => {
          const suite = suiteTask.result.suite;
          const successCount = suite.items.filter((i) => i.status === 'success').length;

          return (
            <div key={suiteTask.id} className="rounded-2xl border border-white/10 bg-card/60 p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="text-white/90 font-medium truncate">{suite.templateName || '套图任务'}</div>
                    <div className="flex items-center gap-1 text-white/50 text-xs">
                      <Clock className="w-3 h-3" />
                      {new Date(suiteTask.createdAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="text-white/50 text-xs">
                      {successCount}/{suite.items.length} 成功
                    </div>
                  </div>
                  {suite.globalPrompt && (
                    <div className="mt-1 text-xs text-white/50 truncate">全局描述：{suite.globalPrompt}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleDownloadAll(suiteTask)}>
                    <Download className="w-4 h-4" />
                    全部下载
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {suite.items.map((it) => (
                  <div key={it.id} className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                    <div className="bg-black/40 relative">
                      {it.images && it.images.length > 0 ? (
                        <div className="grid grid-cols-2 gap-px">
                          {it.images.slice(0, 4).map((img, idx) => (
                            <button
                              key={`${it.id}-${idx}`}
                              type="button"
                              className="aspect-square bg-black/30 overflow-hidden"
                              onClick={() =>
                                downloadByLink(img.url, `${sanitizeFilename(it.name)}_${String(idx + 1).padStart(2, '0')}${guessExt(img.url)}`)
                              }
                            >
                              <img src={img.url} alt={it.name} className="w-full h-full object-cover" />
                            </button>
                          ))}
                          {it.images.length < 4 &&
                            Array.from({ length: 4 - it.images.length }).map((_, i) => (
                              <div key={`${it.id}-pad-${i}`} className="aspect-square bg-black/20" />
                            ))}
                        </div>
                      ) : (
                        <div className="aspect-square w-full flex items-center justify-center text-xs text-white/40">
                          {it.status === 'failed' ? '失败' : '未生成'}
                        </div>
                      )}

                      {it.images && it.images.length > 1 && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] bg-black/60 text-white/80 border border-white/10">
                          {it.images.length} 张
                        </div>
                      )}

                      {it.images && it.images.length > 4 && (
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] bg-black/60 text-white/80 border border-white/10">
                          +{it.images.length - 4}
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex items-center justify-between gap-2">
                      <div className="text-xs text-white/80 truncate min-w-0">{it.name}</div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {it.images?.[0]?.url && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() =>
                              downloadByLink(
                                it.images![0]!.url,
                                `${sanitizeFilename(it.name)}${guessExt(it.images![0]!.url)}`
                              )
                            }
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        {it.status === 'failed' && (
                          <Button type="button" variant="outline" size="icon-sm" onClick={() => handleRetry(suiteTask, it)}>
                            <RefreshCcw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {it.error && <div className="px-2 pb-2 text-[11px] text-red-400 truncate">{it.error}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
