import { useMemo, useState } from 'react';
import type { BuiltInCopyVariableKey, CopyVariableKey, SmartLayoutCopyVariables } from '@/types/smartLayout';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BUILT_IN_ORDER: BuiltInCopyVariableKey[] = [
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

const BUILT_IN_LABELS: Record<BuiltInCopyVariableKey, string> = {
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

const isValidCopyVariableKey = (keyRaw: string) => /^[A-Z0-9_]{2,32}$/.test((keyRaw || '').trim());

const isBuiltInKey = (key: CopyVariableKey): key is BuiltInCopyVariableKey => {
  return (BUILT_IN_ORDER as readonly string[]).includes(key);
};

export function CopyVariablesPanel(props: {
  variables: SmartLayoutCopyVariables;
  requiredKeys: CopyVariableKey[];
  onChange: (next: SmartLayoutCopyVariables) => void;
}) {
  const required = useMemo(() => new Set(props.requiredKeys), [props.requiredKeys]);
  const [newKeyInput, setNewKeyInput] = useState('');

  const visibleKeys = useMemo(() => {
    const set = new Set<CopyVariableKey>();
    for (const k of props.requiredKeys) set.add(k);
    for (const [kRaw, vRaw] of Object.entries(props.variables || {})) {
      const k = (kRaw || '').toString().trim() as CopyVariableKey;
      const v = (vRaw ?? '').toString().trim();
      if (!k) continue;
      if (v) {
        set.add(k);
        continue;
      }
      if (!isBuiltInKey(k)) set.add(k);
    }
    const builtIns = BUILT_IN_ORDER.filter((k) => set.has(k));
    const customs = Array
      .from(set)
      .filter((k) => !isBuiltInKey(k))
      .sort((a, b) => a.localeCompare(b));
    return [...builtIns, ...customs];
  }, [props.requiredKeys, props.variables]);

  const handleChange = (key: CopyVariableKey, value: string) => {
    props.onChange({ ...props.variables, [key]: value });
  };

  const clearUnused = () => {
    const next: SmartLayoutCopyVariables = { ...props.variables };
    for (const [kRaw, vRaw] of Object.entries(next)) {
      const k = (kRaw || '').toString().trim() as CopyVariableKey;
      if (!k) continue;
      if (required.has(k)) continue;
      const v = (vRaw ?? '').toString().trim();
      if (!v) delete next[k];
    }
    props.onChange(next);
  };

  const addVariable = () => {
    const key = (newKeyInput || '').trim().toUpperCase();
    if (!isValidCopyVariableKey(key)) {
      toast.error('变量名仅支持 2~32 位大写字母/数字/下划线（如 PROJECT、SKU_1）');
      return;
    }
    const exists = Object.prototype.hasOwnProperty.call(props.variables || {}, key);
    if (exists) {
      toast.error('该变量已存在');
      return;
    }
    props.onChange({ ...props.variables, [key]: '' });
    setNewKeyInput('');
  };

  const labelForKey = (key: CopyVariableKey) => {
    if (isBuiltInKey(key)) return BUILT_IN_LABELS[key];
    return key;
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white/85">文案变量</div>
          <div className="mt-1 text-xs text-white/50 leading-relaxed">
            在区域提示词中使用占位符（如 {'{TITLE}'}、{'{BULLET_1}'}、{'{PROJECT}'}），这里填写后会自动替换并用于生成。
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
        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center gap-2">
            <Input
              value={newKeyInput}
              onChange={(e) => setNewKeyInput(e.target.value)}
              className="h-9 bg-white/5 border-white/10 text-white"
              placeholder="新增变量名（如 PROJECT）"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
              onClick={addVariable}
            >
              添加
            </Button>
          </div>
          <div className="mt-2 text-[11px] text-white/45">
            变量名仅支持 2~32 位大写字母/数字/下划线；在提示词中用 {'{KEY}'} 进行引用。
          </div>
        </div>

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
                  {labelForKey(key)}
                  {isRequired ? <span className="text-rose-300"> *</span> : null}
                </Label>
                <div className="text-[10px] text-white/45">{`{${key}}`}</div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={value}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="h-9 flex-1 bg-white/5 border-white/10 text-white"
                  placeholder={isRequired ? '必填（用于替换）' : '可选'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={!value.trim()}
                  onClick={() => handleChange(key, '')}
                  className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
                  aria-label="清空"
                >
                  ×
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
