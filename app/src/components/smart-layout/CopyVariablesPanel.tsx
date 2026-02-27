import { useMemo } from 'react';
import type { CopyVariableKey, SmartLayoutCopyVariables } from '@/types/smartLayout';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const ORDERED_KEYS: CopyVariableKey[] = [
  'PRODUCT',
  'TITLE',
  'SUBTITLE',
  'BULLET_1',
  'BULLET_2',
  'BULLET_3',
  'BULLET_4',
  'BULLET_5',
  'CTA',
  'BADGE',
  'PRICE',
];

const LABELS: Record<CopyVariableKey, string> = {
  PRODUCT: '商品主体',
  TITLE: '主标题',
  SUBTITLE: '副标题',
  BULLET_1: '卖点 1',
  BULLET_2: '卖点 2',
  BULLET_3: '卖点 3',
  BULLET_4: '卖点 4',
  BULLET_5: '卖点 5',
  CTA: '行动文案',
  BADGE: '角标',
  PRICE: '价格',
};

export function CopyVariablesPanel(props: {
  variables: SmartLayoutCopyVariables;
  requiredKeys: CopyVariableKey[];
  onChange: (next: SmartLayoutCopyVariables) => void;
}) {
  const required = useMemo(() => new Set(props.requiredKeys), [props.requiredKeys]);
  const visibleKeys = useMemo(() => {
    const set = new Set<CopyVariableKey>();
    for (const k of props.requiredKeys) set.add(k);
    for (const k of ORDERED_KEYS) {
      const v = (props.variables[k] ?? '').toString().trim();
      if (v) set.add(k);
    }
    return ORDERED_KEYS.filter((k) => set.has(k));
  }, [props.requiredKeys, props.variables]);

  const handleChange = (key: CopyVariableKey, value: string) => {
    props.onChange({ ...props.variables, [key]: value });
  };

  const clearUnused = () => {
    const next: SmartLayoutCopyVariables = { ...props.variables };
    for (const k of ORDERED_KEYS) {
      if (required.has(k)) continue;
      delete next[k];
    }
    props.onChange(next);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white/85">文案变量</div>
          <div className="mt-1 text-xs text-white/50 leading-relaxed">
            在区域提示词中使用占位符（如 {'{TITLE}'}、{'{BULLET_1}'}），这里填写后会自动替换并用于生成。
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
          onClick={clearUnused}
        >
          清理未用
        </Button>
      </div>

      <div className="space-y-3">
        {visibleKeys.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/60">
            当前画布未使用文案占位符。请在区域提示词中加入如 {'{TITLE}'}、{'{BULLET_1}'} 的占位符后再在此处填写。
          </div>
        ) : null}
        {visibleKeys.map((key) => {
          const isRequired = required.has(key);
          const value = (props.variables[key] ?? '').toString();
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-white/80">
                  {LABELS[key]}
                  {isRequired ? <span className="text-rose-300"> *</span> : null}
                </Label>
                <div className="text-[10px] text-white/45">{`{${key}}`}</div>
              </div>
              <Input
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="h-9 bg-white/5 border-white/10 text-white"
                placeholder={isRequired ? '必填（用于替换）' : '可选'}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
