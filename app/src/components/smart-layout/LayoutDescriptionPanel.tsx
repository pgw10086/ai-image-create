import React, { useMemo, useState } from 'react';
import type { LayoutZone, SmartLayoutSettings } from '@/types/smartLayout';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

interface LayoutDescriptionPanelProps {
  zones: LayoutZone[];
  settings: SmartLayoutSettings;
  className?: string;
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

export const LayoutDescriptionPanel: React.FC<LayoutDescriptionPanelProps> = ({ zones, settings, className }) => {
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    const lines: string[] = [];
    lines.push(`GLOBAL_PROMPT: (由上层参数条与业务逻辑组装，Step 4 负责生成)`); // 留空指引
    if (settings.enableRegionPrompts) {
      lines.push('');
      lines.push('REGION_PROMPTS:');
      zones.forEach(z => lines.push(formatRegionLine(z)));
    }
    if (settings.enableDepthTree) {
      lines.push('');
      lines.push('DEPTH_TREE:');
      lines.push(buildDepthTree(zones));
    }
    lines.push('');
    lines.push('规则声明: 不要在最终图片里绘制边框/编号/文字；对象必须严格放在各自区域内。');
    return lines.join('\n');
  }, [zones, settings.enableRegionPrompts, settings.enableDepthTree]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className={["rounded-xl border border-white/10 bg-[#14141a]", className].filter(Boolean).join(' ')}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm text-white/80">布局描述（给模型看的）</span>
        <Button
          variant="outline"
          size="sm"
          className="border-white/10 text-white/70 hover:text-white hover:bg-white/10"
          onClick={handleCopy}
        >
          {copied ? '已复制' : '复制内容'}
        </Button>
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
