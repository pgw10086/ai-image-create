function escapeXml(input: string) {
  return (input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseSize(size?: string) {
  if (!size) return null;
  const m = size.trim().match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { width: w, height: h };
}

export function createMockImageDataUri(params: {
  title: string;
  subtitle?: string;
  size?: string;
  width?: number;
  height?: number;
  seed?: string;
}) {
  const parsed = parseSize(params.size);
  const width = Math.max(64, Math.round(params.width ?? parsed?.width ?? 1200));
  const height = Math.max(64, Math.round(params.height ?? parsed?.height ?? 900));
  const title = escapeXml(params.title);
  const subtitle = escapeXml(params.subtitle ?? '');
  const sizeLabel = escapeXml(params.size ?? '');
  const seed = escapeXml(params.seed ?? '');

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="#0b1220"/>`,
    `<stop offset="1" stop-color="#2a1b4b"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="100%" height="100%" fill="url(#bg)"/>`,
    `<rect x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.08)}" width="${Math.round(width * 0.88)}" height="${Math.round(height * 0.84)}" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)"/>`,
    `<text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.92)" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="${Math.round(Math.min(width, height) * 0.06)}">${title}</text>`,
    subtitle
      ? `<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.70)" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="${Math.round(Math.min(width, height) * 0.035)}">${subtitle}</text>`
      : '',
    `<text x="50%" y="66%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace" font-size="${Math.round(Math.min(width, height) * 0.03)}">${sizeLabel}</text>`,
    seed
      ? `<text x="50%" y="74%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace" font-size="${Math.round(Math.min(width, height) * 0.022)}">${seed}</text>`
      : '',
    `</svg>`,
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

