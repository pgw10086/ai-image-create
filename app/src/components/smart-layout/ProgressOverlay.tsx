import { Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';

interface ProgressOverlayProps {
  open: boolean;
  title: string;
  description?: string;
  stages: string[];
  activeStageIndex: number;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  onCancel?: () => void;
}

export function ProgressOverlay({
  open,
  title,
  description,
  stages,
  activeStageIndex,
  cancelLabel = '取消',
  cancelDisabled,
  onCancel,
}: ProgressOverlayProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] max-w-[92vw] rounded-xl border border-white/10 bg-[#14141a] p-5 shadow-xl">
        <div className="text-sm font-semibold text-white">{title}</div>
        {description ? <div className="mt-1 text-xs text-white/60">{description}</div> : null}

        <div className="mt-4 space-y-2">
          {stages.map((stage, idx) => {
            const isDone = idx < activeStageIndex;
            const isActive = idx === activeStageIndex;
            return (
              <div key={`${idx}-${stage}`} className="flex items-center gap-2 text-sm">
                <div className="w-4 h-4 flex items-center justify-center">
                  {isDone ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : isActive ? (
                    <Spinner className="h-4 w-4 text-white/80" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-white/20" />
                  )}
                </div>
                <div className={[isActive ? 'text-white' : isDone ? 'text-white/70' : 'text-white/50'].join(' ')}>{stage}</div>
              </div>
            );
          })}
        </div>

        {onCancel ? (
          <div className="mt-5 flex justify-end">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={cancelDisabled}
              className="h-8 border-white/10 text-white/80 hover:text-white hover:bg-white/10"
            >
              {cancelLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

