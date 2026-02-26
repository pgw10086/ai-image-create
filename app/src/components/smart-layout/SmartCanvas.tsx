import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Moveable from 'react-moveable';
import { v4 as uuidv4 } from 'uuid';
import { SEMANTIC_COLORS } from '@/types/smartLayout';
import type { LayoutZone, SmartCanvasProps } from '@/types/smartLayout';
import { ZoneItem } from './ZoneItem';

export interface SmartCanvasHandle {
  clearSelection: () => void;
}

export const SmartCanvas = forwardRef<SmartCanvasHandle, SmartCanvasProps>(({
  zones,
  onChange,
  onSelect,
  canvasSize,
  drawMode = false,
  getRefImageSrc,
}, ref) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{x: number, y: number} | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);

  useImperativeHandle(ref, () => ({
    clearSelection: () => {
      setSelectedZoneId(null);
      onSelect(null);
    },
  }), [onSelect]);

  const getRelativePos = (e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const isFullCanvasBackground = (zone: LayoutZone) => {
    if (zone.type !== 'background') return false;
    const eps = 2;
    return (
      zone.x <= eps &&
      zone.y <= eps &&
      zone.width >= canvasSize.width - eps &&
      zone.height >= canvasSize.height - eps
    );
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const forceDraw = drawMode || e.shiftKey;
    if (!forceDraw && target.closest('.moveable-control-box')) return;
    if (!forceDraw) {
      const zoneEl = target.closest('[id^="zone-"]') as HTMLElement | null;
      if (zoneEl) {
        const id = zoneEl.id.replace('zone-', '');
        const zone = zones.find((z) => z.id === id);
        if (!zone || !isFullCanvasBackground(zone)) return;
      }
    }

    const { x, y } = getRelativePos(e);
    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
    
    setSelectedZoneId(null);
    onSelect(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return;
    const { x, y } = getRelativePos(e);
    
    const constrainedX = Math.max(0, Math.min(x, canvasSize.width));
    const constrainedY = Math.max(0, Math.min(y, canvasSize.height));
    
    setDrawCurrent({ x: constrainedX, y: constrainedY });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent) return;

    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);

    if (width >= 20 && height >= 20) {
      const newZone: LayoutZone = {
        id: uuidv4(),
        x,
        y,
        width,
        height,
        zIndex: zones.length + 1,
        type: 'prop', // Default type
        semanticColor: SEMANTIC_COLORS.prop,
        prompt: '',
      };
      
      onChange([...zones, newZone]);
      setSelectedZoneId(newZone.id);
      onSelect(newZone.id);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedZoneId) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') return;

        onChange(zones.filter(z => z.id !== selectedZoneId));
        setSelectedZoneId(null);
        onSelect(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedZoneId, zones, onChange, onSelect]);

  useEffect(() => {
    if (drawMode && selectedZoneId) {
      setSelectedZoneId(null);
      onSelect(null);
    }
  }, [drawMode, selectedZoneId, onSelect]);

  useEffect(() => {
    setTimeout(() => {
      moveableRef.current?.updateRect();
    }, 0);
  }, [selectedZoneId, zones]);

  const selectedTarget = useMemo(() => {
    return selectedZoneId ? document.getElementById(`zone-${selectedZoneId}`) : null;
  }, [selectedZoneId, zones]); // Add zones dependency to re-query if DOM re-renders

  return (
    <div className="relative z-0 bg-transparent">
      <div 
        ref={containerRef}
        className="relative bg-white shadow-lg"
        style={{ 
          width: canvasSize.width, 
          height: canvasSize.height,
          backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
        onMouseDownCapture={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
           if (isDrawing) {
             setIsDrawing(false);
             setDrawStart(null);
             setDrawCurrent(null);
           }
        }}
      >
        {zones.map((zone) => (
          <ZoneItem
            key={zone.id}
            zone={zone}
            isSelected={selectedZoneId === zone.id}
            refImageSrc={getRefImageSrc?.(zone) ?? zone.refImage}
            onMouseDown={(e) => {
              if (drawMode || e.shiftKey) {
                return;
              }
              if (isFullCanvasBackground(zone)) {
                return;
              }
              e.stopPropagation();
              setSelectedZoneId(zone.id);
              onSelect(zone.id);
            }}
          />
        ))}

        {isDrawing && drawStart && drawCurrent && (
          <div
            className="absolute border-2 border-blue-400 border-dashed bg-blue-100/30 pointer-events-none"
            style={{
              left: Math.min(drawStart.x, drawCurrent.x),
              top: Math.min(drawStart.y, drawCurrent.y),
              width: Math.abs(drawCurrent.x - drawStart.x),
              height: Math.abs(drawCurrent.y - drawStart.y),
              zIndex: 9999
            }}
          />
        )}

        <Moveable
          ref={moveableRef}
          target={drawMode ? null : selectedTarget}
          draggable={Boolean(selectedTarget) && !drawMode && !zones.find(z => z.id === selectedZoneId)?.locked}
          resizable={Boolean(selectedTarget) && !drawMode && !zones.find(z => z.id === selectedZoneId)?.locked}
          keepRatio={false}
          snappable={true}
          bounds={{ left: 0, top: 0, right: canvasSize.width, bottom: canvasSize.height }}
          
          onDrag={({ target, left, top }) => {
            target.style.left = `${left}px`;
            target.style.top = `${top}px`;
          }}
          onDragEnd={({ target, isDrag }) => {
             if (isDrag) {
                const id = target.id.replace('zone-', '');
                const zone = zones.find(z => z.id === id);
                if (zone) {
                    const newX = parseFloat(target.style.left);
                    const newY = parseFloat(target.style.top);
                    onChange(zones.map(z => z.id === id ? { ...z, x: newX, y: newY } : z));
                }
             }
          }}
          
          onResizeStart={e => {
             e.setOrigin(["%", "%"]);
             const target = e.target;
             const x = parseFloat(target.style.left) || 0;
             const y = parseFloat(target.style.top) || 0;
             e.dragStart && e.dragStart.set([x, y]);
          }}
          onResize={({ target, width, height, drag }) => {
            target.style.width = `${width}px`;
            target.style.height = `${height}px`;
            target.style.left = `${drag.beforeTranslate[0]}px`;
            target.style.top = `${drag.beforeTranslate[1]}px`;
          }}
          onResizeEnd={({ target, isDrag }) => {
             if (isDrag) {
                const id = target.id.replace('zone-', '');
                const newWidth = parseFloat(target.style.width);
                const newHeight = parseFloat(target.style.height);
                const newX = parseFloat(target.style.left);
                const newY = parseFloat(target.style.top);

                onChange(zones.map(z => z.id === id ? { 
                    ...z, 
                    width: newWidth, 
                    height: newHeight, 
                    x: newX, 
                    y: newY 
                } : z));
             }
          }}
        />
      </div>
    </div>
  );
});

SmartCanvas.displayName = 'SmartCanvas';
