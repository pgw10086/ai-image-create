import React, { useMemo, useState } from 'react';
import type { LayoutZone, SmartLayoutSettings } from '@/types/smartLayout';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { optimizeSmartLayoutZonePrompts } from '@/lib/bigmodel';

interface LayoutDescriptionPanelProps {
  zones: LayoutZone[];
  previewZones?: LayoutZone[];
  settings: SmartLayoutSettings;
  className?: string;
  onUpdateZonePrompts?: (updates: Array<{ id: string; prompt: string }>) => void;
}

function formatRegionLine(z: LayoutZone) {
  const typeLabel = z.type === 'background' ? '背景' : z.type === 'prop' ? '道具' : '主体';
  const bbox = z.bboxNormalized
    ? `bbox=(${z.bboxNormalized.x.toFixed(3)}, ${z.bboxNormalized.y.toFixed(3)}, ${z.bboxNormalized.w.toFixed(3)}, ${z.bboxNormalized.h.toFixed(3)})`
    : '';
  const loc = z.locationHint ? `loc=${z.locationHint}` : '';
  const meta = [bbox, loc].filter(Boolean).join(' ');
  const prompt = (z.prompt || '').trim();
  return `- [${typeLabel} z=${z.zIndex}] ${meta} ${prompt ? `:: ${prompt}` : ''}`.trim();
}

function buildDepthTree(zones: LayoutZone[]) {
  const sorted = [...zones].sort((a, b) => a.zIndex - b.zIndex);
  return sorted
    .map(z => {
      const covers = (z.coveredZoneIds || [])
        .map(id => {
          const target = zones.find(zz => zz.id === id);
          if (!target) return id;
          const label = target.type === 'background' ? '背景' : target.type === 'prop' ? '道具' : '主体';
          return `${label}(z=${target.zIndex})`;
        })
        .join(', ');
      const label = z.type === 'background' ? '背景' : z.type === 'prop' ? '道具' : '主体';
      return `- ${label}(z=${z.zIndex}) 覆盖 => [${covers || '无'}]`;
    })
    .join('\n');
}

export const LayoutDescriptionPanel: React.FC<LayoutDescriptionPanelProps> = ({
  zones,
  previewZones,
  settings,
  className,
  onUpdateZonePrompts,
}) => {
  const [copied, setCopied] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<Record<string, string> | null>(null);
  const viewZones = previewZones ?? zones;

  const text = useMemo(() => {
    const lines: string[] = [];
    lines.push(`GLOBAL_PROMPT: (由上层参数条与业务逻辑组装，Step 4 负责生成)`);
    if (settings.enableRegionPrompts) {
      lines.push('');
      lines.push('REGION_PROMPTS:');
      viewZones.forEach(z => lines.push(formatRegionLine(z)));
    }
    if (settings.enableDepthTree) {
      lines.push('');
      lines.push('DEPTH_TREE:');
      lines.push(buildDepthTree(viewZones));
    }
    lines.push('');
    lines.push('规则声明: 不要在最终图片里绘制边框/编号/文字；对象必须严格放在各自区域内。');
    return lines.join('\n');
  }, [viewZones, settings.enableRegionPrompts, settings.enableDepthTree]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const hasChinese = (input: string) => /[\u4e00-\u9fff]/.test(input);

  const detectLanguage = () => {
    let zh = 0;
    let en = 0;
    for (const z of viewZones) {
      const p = (z.prompt || '').trim();
      if (!p) continue;
      if (hasChinese(p)) zh += 1;
      else en += 1;
    }
    return zh >= en ? ('zh' as const) : ('en' as const);
  };

  const handleOptimize = async () => {
    if (optimizing) return;
    const candidates = zones
      .map((z) => ({ id: z.id, type: z.type, prompt: (z.prompt || '').trim() }))
      .filter((z) => Boolean(z.prompt));
    if (candidates.length === 0) {
      toast.error('没有可优化的提示词（请先在区域里填写提示词）');
      return;
    }
    if (!onUpdateZonePrompts) {
      toast.error('当前页面无法应用优化结果');
      return;
    }
    setOptimizing(true);
    try {
      const snapshot: Record<string, string> = {};
      for (const z of zones) snapshot[z.id] = (z.prompt || '').toString();
      setUndoSnapshot(snapshot);
      const updates = await optimizeSmartLayoutZonePrompts({
        zones: candidates,
        language: detectLanguage(),
      });
      if (updates.length === 0) {
        toast.error('未生成可用的优化结果');
        return;
      }
      onUpdateZonePrompts(updates);
      toast.success(`已优化 ${updates.length} 条提示词`);
    } catch (e: any) {
      const message = e instanceof Error ? e.message : '优化失败';
      toast.error(`优化失败: ${message}`);
    } finally {
      setOptimizing(false);
    }
  };

  const handleUndo = () => {
    if (!undoSnapshot || !onUpdateZonePrompts) return;
    const updates = zones
      .map((z) => ({ id: z.id, prompt: undoSnapshot[z.id] ?? (z.prompt || '').toString() }))
      .filter((u) => typeof u.prompt === 'string');
    onUpdateZonePrompts(updates);
    setUndoSnapshot(null);
    toast.success('已撤销本次优化');
  };

  return (
    <div className={["rounded-xl border border-white/10 bg-[#14141a]", className].filter(Boolean).join(' ')}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm text-white/80">布局描述（给模型看的）</span>
        <div className="flex items-center gap-2">
          {undoSnapshot ? (
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50"
              onClick={handleUndo}
              disabled={optimizing}
            >
              撤销
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50"
            onClick={handleOptimize}
            disabled={optimizing}
          >
            {optimizing ? '优化中...' : '优化提示词'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50"
            onClick={handleCopy}
            disabled={optimizing}
          >
            {copied ? '已复制' : '复制内容'}
          </Button>
        </div>
      </div>
      <Accordion type="single" collapsible defaultValue="desc">
        <AccordionItem value="desc" className="border-b-0">
          <AccordionTrigger className="px-4">展开/收起描述</AccordionTrigger>
          <AccordionContent className="px-4">
            <div className="max-h-[260px] overflow-auto rounded-md border border-white/10 bg-black/20 p-3">
              <pre className="text-xs whitespace-pre-wrap text-white/80">{text}</pre>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
