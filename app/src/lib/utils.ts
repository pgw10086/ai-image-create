import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateOptimalSize(width: number, height: number, minPixels = 3686400): string {
  const MAX_PIXELS = 16777216;

  let aspectRatio = width / height;
  if (aspectRatio < 1 / 16) aspectRatio = 1 / 16;
  if (aspectRatio > 16) aspectRatio = 16;

  const candidates: Array<{ w: number; h: number }> = [
    { w: 2048, h: 2048 },
    { w: 2304, h: 1728 },
    { w: 1728, h: 2304 },
    { w: 2560, h: 1440 },
    { w: 1440, h: 2560 },
    { w: 2496, h: 1664 },
    { w: 1664, h: 2496 },
    { w: 3024, h: 1296 },
  ];

  if (minPixels <= 921600) {
    candidates.unshift(
      { w: 1024, h: 1024 },
      { w: 1152, h: 864 },
      { w: 864, h: 1152 },
      { w: 1280, h: 720 },
      { w: 720, h: 1280 },
      { w: 1248, h: 832 },
      { w: 832, h: 1248 },
      { w: 1512, h: 648 }
    );
  }

  const validCandidates = candidates.filter(c => {
    const area = c.w * c.h;
    const r = c.w / c.h;
    return area >= minPixels && area <= MAX_PIXELS && r >= 1 / 16 && r <= 16;
  });

  if (validCandidates.length === 0) {
    return '2048x2048';
  }

  let best = validCandidates[0];
  let bestScore = Math.abs(best.w / best.h - aspectRatio);
  for (const c of validCandidates) {
    const score = Math.abs(c.w / c.h - aspectRatio);
    if (score < bestScore) {
      best = c;
      bestScore = score;
      continue;
    }
    if (score === bestScore && c.w * c.h < best.w * best.h) {
      best = c;
    }
  }

  return `${best.w}x${best.h}`;
}

export function normalizeImageSize(size: string, model: string): string {
  if (['2K', '4K', '1K'].includes(size)) return size;
  
  const parts = size.split('x').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return size;
  
  const [w, h] = parts;
  
  let minPx = 0;
  if (model.includes('4.5') || model.includes('4-5')) {
      minPx = 3686400;
  } else if (model.includes('4.0')) {
      minPx = 921600;
  } else {
      return size;
  }
  
  if (w * h < minPx) {
      return calculateOptimalSize(w, h, minPx);
  }
  
  return size;
}
