import React, { forwardRef } from 'react';
import type { LayoutZone } from '@/types/smartLayout';
import { cn } from '@/lib/utils';

function hexToRgba(hex: string, alpha: number) {
  const normalizedHex = hex.replace('#', '');
  const fullHex = normalizedHex.length === 3
    ? normalizedHex.split('').map(c => c + c).join('')
    : normalizedHex;
  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ZoneItemProps {
  zone: LayoutZone;
  isSelected: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  className?: string;
  refImageSrc?: string;
}

export const ZoneItem = forwardRef<HTMLDivElement, ZoneItemProps>(
  ({ zone, isSelected, onMouseDown, style, className, refImageSrc }, ref) => {
    const x = Math.round(zone.x);
    const y = Math.round(zone.y);
    const w = Math.round(zone.width);
    const h = Math.round(zone.height);

    return (
      <div
        ref={ref}
        id={`zone-${zone.id}`}
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          left: `${zone.x}px`,
          top: `${zone.y}px`,
          width: `${zone.width}px`,
          height: `${zone.height}px`,
          zIndex: isSelected ? 999 : zone.zIndex, // Selected item pops up or use zone.zIndex
          backgroundColor: isSelected ? undefined : hexToRgba(zone.sketchColor || zone.semanticColor, 0.35),
          ...style,
        }}
        className={cn(
          "group border-2 cursor-pointer flex flex-col items-center justify-center overflow-hidden backdrop-blur-sm transition-colors",
          isSelected 
            ? "border-violet-500 bg-violet-500/10" 
            : "border-slate-300 hover:border-slate-400",
          className
        )}
      >
        {refImageSrc ? (
           <img src={refImageSrc} alt="ref" className="w-full h-full object-cover opacity-80 pointer-events-none" />
        ) : (
           <div className="p-2 text-xs text-center text-slate-600 font-medium break-all pointer-events-none select-none">
             {zone.prompt || (zone.type === 'background' ? '背景' : zone.type === 'prop' ? '道具' : '主体')}
           </div>
        )}
        
        <div className="absolute top-0 left-0 bg-black/50 text-white text-[10px] px-1 pointer-events-none select-none">
            {zone.type === 'background' ? '背景' : zone.type === 'prop' ? '道具' : '主体'}
        </div>
        <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[10px] px-1 pointer-events-none select-none font-mono">
          {x},{y} {w}×{h}
        </div>
      </div>
    );
  }
);

ZoneItem.displayName = "ZoneItem";
