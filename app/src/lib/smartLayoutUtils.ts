import type { LayoutZone, LocationHint } from '@/types/smartLayout';

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function hslToHex(h: number, s: number, l: number) {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) => {
    const n = Math.round((v + m) * 255);
    return n.toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function pickSketchColor(type: LayoutZone['type'], index: number) {
  if (type === 'background') {
    const grays = [
      { h: 210, s: 10, l: 96 },
      { h: 30, s: 12, l: 86 },
      { h: 210, s: 14, l: 74 },
      { h: 30, s: 14, l: 60 },
      { h: 210, s: 12, l: 46 },
      { h: 30, s: 10, l: 32 },
    ];
    const p = grays[index % grays.length];
    return hslToHex(p.h, p.s, p.l);
  }

  if (type === 'prop') {
    const hues = [140, 165, 110, 190, 85, 215, 60, 240, 35, 260];
    const h = hues[index % hues.length];
    const l = index % 2 === 0 ? 56 : 42;
    return hslToHex(h, 88, l);
  }

  const hues = [0, 330, 20, 300, 45, 270, 70, 350, 10, 315];
  const h = hues[index % hues.length];
  const l = index % 2 === 0 ? 58 : 43;
  return hslToHex(h, 88, l);
}

function assignSketchColors(zones: LayoutZone[]) {
  const byType: Record<LayoutZone['type'], LayoutZone[]> = { background: [], prop: [], main: [] };
  for (const z of zones) byType[z.type].push(z);

  const updates = new Map<string, string>();
  (Object.keys(byType) as Array<LayoutZone['type']>).forEach((type) => {
    const sorted = byType[type].slice().sort((a, b) => a.zIndex - b.zIndex);
    sorted.forEach((z, idx) => {
      updates.set(z.id, pickSketchColor(type, idx));
    });
  });

  return zones.map(z => ({ ...z, sketchColor: updates.get(z.id) ?? z.semanticColor }));
}

export function computeBboxNormalized(
  zone: Pick<LayoutZone, 'x' | 'y' | 'width' | 'height'>,
  canvasSize: { width: number; height: number }
) {
  const x = canvasSize.width > 0 ? zone.x / canvasSize.width : 0;
  const y = canvasSize.height > 0 ? zone.y / canvasSize.height : 0;
  const w = canvasSize.width > 0 ? zone.width / canvasSize.width : 0;
  const h = canvasSize.height > 0 ? zone.height / canvasSize.height : 0;
  return {
    x: clamp01(x),
    y: clamp01(y),
    w: clamp01(w),
    h: clamp01(h),
  };
}

export function computeLocationHint(
  zone: Pick<LayoutZone, 'x' | 'y' | 'width' | 'height'>,
  canvasSize: { width: number; height: number }
): LocationHint {
  const centerX = zone.x + zone.width / 2;
  const centerY = zone.y + zone.height / 2;
  const nx = canvasSize.width > 0 ? clamp01(centerX / canvasSize.width) : 0.5;
  const ny = canvasSize.height > 0 ? clamp01(centerY / canvasSize.height) : 0.5;

  const col: 'Left' | 'Center' | 'Right' = nx < 1 / 3 ? 'Left' : nx < 2 / 3 ? 'Center' : 'Right';
  const row: 'Top' | 'Center' | 'Bottom' = ny < 1 / 3 ? 'Top' : ny < 2 / 3 ? 'Center' : 'Bottom';

  return `${row}-${col}` as LocationHint;
}

export function enrichZonesForPrompt(
  zones: LayoutZone[],
  canvasSize: { width: number; height: number }
): LayoutZone[] {
  const withSketchColor = assignSketchColors(zones);
  return withSketchColor.map((z) => ({
    ...z,
    bboxNormalized: computeBboxNormalized(z, canvasSize),
    locationHint: computeLocationHint(z, canvasSize),
  }));
}
