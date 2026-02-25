import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onStop: () => void;
  onGenerateVariants: (styles: string[]) => void;
  previewImageSrc: string;
  finalImageSrc: string;
  referenceImages: string[];
  globalPrompt: string;
  onGlobalPromptChange: (value: string) => void;
  finalPrompt: string;
  onFinalPromptChange: (value: string) => void;
  isGenerating: boolean;
}

export function PreviewDialog({
  open,
  onOpenChange,
  onConfirm,
  onStop,
  onGenerateVariants,
  previewImageSrc,
  finalImageSrc,
  referenceImages,
  globalPrompt,
  onGlobalPromptChange,
  finalPrompt,
  onFinalPromptChange,
  isGenerating,
}: PreviewDialogProps) {
  const [imageMode, setImageMode] = useState<'final' | 'preview'>('final');
  const [variantStyles, setVariantStyles] = useState<string[]>(['', '', '']);
  const [showGlobalPrompt, setShowGlobalPrompt] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  useEffect(() => {
    if (open) {
      setImageMode('final');
      setVariantStyles(['', '', '']);
      setShowGlobalPrompt(false);
      setShowSystemPrompt(false);
    }
  }, [open]);

  const selectedImageSrc = imageMode === 'final' ? finalImageSrc : previewImageSrc;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col bg-[#14141a] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>确认生成预览</DialogTitle>
          <DialogDescription>
            请确认合成的布局草图和提示词是否符合预期。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="flex gap-4 flex-1 min-h-0">
            <div className="flex-1 border border-white/10 rounded-md bg-white/5 flex items-center justify-center p-2 overflow-hidden">
              <div className="w-full h-full flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">
                    {imageMode === 'final' ? '最终提交草图' : '预览草图'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={imageMode === 'final' ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-8 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => setImageMode('final')}
                      disabled={isGenerating}
                    >
                      最终
                    </Button>
                    <Button
                      type="button"
                      variant={imageMode === 'preview' ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-8 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => setImageMode('preview')}
                      disabled={isGenerating}
                    >
                      预览
                    </Button>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center overflow-hidden">
                  <img
                    src={selectedImageSrc}
                    alt="Layout Sketch"
                    className="max-w-full max-h-full object-contain shadow-sm"
                  />
                </div>
                {referenceImages.length > 0 && (
                  <div className="border-t border-white/10 pt-2">
                    <div className="text-xs text-white/60 mb-2">参考图（图2 起）</div>
                    <ScrollArea className="w-full">
                      <div className="flex gap-2 pb-2">
                        {referenceImages.map((src, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            <div className="w-16 h-16 rounded-md overflow-hidden border border-white/10 bg-white/5">
                              <img src={src} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                            </div>
                            <div className="text-[10px] text-white/60">图{idx + 2}</div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>

            <div className="w-1/3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/70">
                  全局提示词（高级）
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setShowGlobalPrompt((prev) => !prev)}
                  disabled={isGenerating}
                >
                  {showGlobalPrompt ? '折叠' : '展开'}
                </Button>
              </div>
              {showGlobalPrompt ? (
                <Textarea
                  value={globalPrompt}
                  onChange={(e) => onGlobalPromptChange(e.target.value)}
                  className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  placeholder="请输入全局提示词"
                />
              ) : null}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/70">
                  系统提示词（高级）
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setShowSystemPrompt((prev) => !prev)}
                  disabled={isGenerating}
                >
                  {showSystemPrompt ? '折叠' : '展开'}
                </Button>
              </div>
              {showSystemPrompt ? (
                <ScrollArea className="flex-1 border border-white/10 rounded-md p-2 bg-white/5">
                  <Textarea
                    value={finalPrompt}
                    onChange={(e) => onFinalPromptChange(e.target.value)}
                    className="min-h-[260px] bg-transparent border-0 text-white placeholder:text-white/40 resize-none focus-visible:ring-0"
                    placeholder="请输入最终提交的提示词"
                  />
                </ScrollArea>
              ) : null}

              <div className="pt-2 border-t border-white/10">
                <div className="text-sm font-medium text-white/70">风格变体（同一素材不同风格）</div>
                <div className="mt-2 space-y-2">
                  {variantStyles.map((v, idx) => (
                    <Input
                      key={idx}
                      value={v}
                      onChange={(e) => setVariantStyles((prev) => prev.map((x, i) => (i === idx ? e.target.value : x)))}
                      className="h-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                      placeholder={`风格 ${idx + 1}（例如：极简白底 / 复古胶片 / 赛博霓虹）`}
                      disabled={isGenerating}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full h-9 border-white/10 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-40"
                  disabled={isGenerating || variantStyles.every((s) => !s.trim())}
                  onClick={() => onGenerateVariants(variantStyles.map((s) => s.trim()).filter(Boolean))}
                >
                  生成风格变体
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            取消
          </Button>
          {isGenerating ? (
            <Button variant="outline" onClick={onStop}>
              停止
            </Button>
          ) : null}
          <Button onClick={onConfirm} disabled={isGenerating}>
            {isGenerating ? '生成中...' : '确认生成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
