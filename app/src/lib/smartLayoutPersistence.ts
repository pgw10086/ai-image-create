import { v4 as uuidv4 } from 'uuid';
import type { SmartLayoutDraftV1, SmartLayoutTemplateV1 } from '@/types/smartLayout';

const TEMPLATES_KEY = 'smart_layout_templates_v1';
const DRAFT_KEY = 'smart_layout_draft_v1';
const DEFAULT_TEMPLATES_IMPORTED_KEY = 'smart_layout_default_templates_imported_v1';
const HISTORY_KEY = 'smart_layout_history_v1';

export type SmartLayoutHistoryRecord = {
  id: string;
  createdAt: number;
  slots: Array<{
    status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
    url?: string;
    error?: string;
  }>;
  requestedImageCount: number;
};

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeStringifyJson(value: unknown) {
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function loadSmartLayoutTemplates(): SmartLayoutTemplateV1[] {
  if (typeof window === 'undefined') return [];
  const parsed = safeParseJson<SmartLayoutTemplateV1[]>(
    window.localStorage.getItem(TEMPLATES_KEY)
  );
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((t) => t && t.schemaVersion === 1 && typeof t.id === 'string')
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function stripTemplateSnapshots(next: SmartLayoutTemplateV1[]) {
  return next.map((t) => ({ ...t, snapshotDataUrl: undefined }));
}

export function saveSmartLayoutTemplates(next: SmartLayoutTemplateV1[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TEMPLATES_KEY, safeStringifyJson(next));
    return { ok: true as const, strippedSnapshots: false as const, saved: next };
  } catch {
    try {
      const stripped = stripTemplateSnapshots(next);
      window.localStorage.setItem(TEMPLATES_KEY, safeStringifyJson(stripped));
      return { ok: true as const, strippedSnapshots: true as const, saved: stripped };
    } catch {
      return { ok: false as const, strippedSnapshots: true as const, saved: loadSmartLayoutTemplates() };
    }
  }
}

export function upsertSmartLayoutTemplate(input: Omit<SmartLayoutTemplateV1, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'> & { id?: string }) {
  const now = Date.now();
  const templates = loadSmartLayoutTemplates();
  const id = input.id || uuidv4();
  const exists = templates.find((t) => t.id === id);
  const next: SmartLayoutTemplateV1 = {
    schemaVersion: 1,
    id,
    name: input.name,
    createdAt: exists?.createdAt ?? now,
    updatedAt: now,
    snapshotDataUrl: input.snapshotDataUrl,
    payload: input.payload,
  };
  const merged = [next, ...templates.filter((t) => t.id !== id)].slice(0, 50);
  const persisted = saveSmartLayoutTemplates(merged);
  if (!persisted?.ok) {
    throw new Error('本地存储空间不足，无法保存模板（可尝试删除旧模板或导入时不带预览图）');
  }
  const savedNext = persisted.saved.find((t) => t.id === id) || next;
  return { template: savedNext, strippedSnapshots: persisted.strippedSnapshots };
}

export function deleteSmartLayoutTemplate(id: string) {
  const templates = loadSmartLayoutTemplates();
  const next = templates.filter((t) => t.id !== id);
  const persisted = saveSmartLayoutTemplates(next);
  return persisted?.saved ?? [];
}

export function loadSmartLayoutDraft(): SmartLayoutDraftV1 | null {
  if (typeof window === 'undefined') return null;
  const parsed = safeParseJson<SmartLayoutDraftV1>(window.localStorage.getItem(DRAFT_KEY));
  if (!parsed || parsed.schemaVersion !== 1) return null;
  if (!parsed.canvasSize || !Array.isArray(parsed.zones) || !parsed.settings) return null;
  return parsed;
}

export function saveSmartLayoutDraft(draft: Omit<SmartLayoutDraftV1, 'schemaVersion' | 'updatedAt'> & { updatedAt?: number }) {
  if (typeof window === 'undefined') return;
  const next: SmartLayoutDraftV1 = {
    schemaVersion: 1,
    updatedAt: draft.updatedAt ?? Date.now(),
    canvasSize: draft.canvasSize,
    zones: draft.zones,
    settings: draft.settings,
    generationContextSnapshot: draft.generationContextSnapshot,
  };
  try {
    window.localStorage.setItem(DRAFT_KEY, safeStringifyJson(next));
  } catch {
    return null;
  }
  return next;
}

export function clearSmartLayoutDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    return;
  }
}

export function loadSmartLayoutHistory(): SmartLayoutHistoryRecord[] {
  if (typeof window === 'undefined') return [];
  const parsed = safeParseJson<unknown>(window.localStorage.getItem(HISTORY_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry) => {
      if (!isRecord(entry)) return false;
      const id = entry.id;
      const createdAt = entry.createdAt;
      const slots = entry.slots;
      const requestedImageCount = entry.requestedImageCount;
      return (
        typeof id === 'string' &&
        typeof createdAt === 'number' &&
        Array.isArray(slots) &&
        typeof requestedImageCount === 'number'
      );
    })
    .slice(0, 20) as SmartLayoutHistoryRecord[];
}

export function saveSmartLayoutHistory(next: SmartLayoutHistoryRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, safeStringifyJson(next.slice(0, 20)));
  } catch {
    return;
  }
}

export function createSmartLayoutTemplateExportPayload(templates: SmartLayoutTemplateV1[]) {
  return {
    schemaVersion: 1 as const,
    exportedAt: Date.now(),
    templates,
  };
}

export function importSmartLayoutTemplatesFromJson(raw: string) {
  const parsed = safeParseJson<unknown>(raw);
  if (!parsed) return { imported: 0, next: loadSmartLayoutTemplates() };
  const candidates: unknown[] =
    Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.templates)
        ? (parsed.templates as unknown[])
        : [parsed];
  const existing = loadSmartLayoutTemplates();
  const existingIds = new Set(existing.map((t) => t.id));
  const now = Date.now();
  const imported: SmartLayoutTemplateV1[] = [];

  for (const c of candidates) {
    if (!isRecord(c) || c.schemaVersion !== 1) continue;
    const payload = c.payload;
    if (!isRecord(payload)) continue;
    const canvasSizeRaw = payload.canvasSize;
    const settingsRaw = payload.settings;
    const zonesRaw = payload.zones;
    if (!isRecord(canvasSizeRaw) || !isRecord(settingsRaw) || !Array.isArray(zonesRaw)) continue;

    const idRaw = c.id;
    const id = typeof idRaw === 'string' && !existingIds.has(idRaw) ? idRaw : uuidv4();
    const nameRaw = c.name;
    const nameBase = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : '未命名模板';
    const template: SmartLayoutTemplateV1 = {
      schemaVersion: 1,
      id,
      name: typeof idRaw === 'string' && existingIds.has(idRaw) ? `${nameBase}（导入）` : nameBase,
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : now,
      updatedAt: now,
      snapshotDataUrl: typeof c.snapshotDataUrl === 'string' ? c.snapshotDataUrl : undefined,
      payload: {
        canvasSize: {
          width: Math.max(200, Math.round(Number(canvasSizeRaw.width) || 800)),
          height: Math.max(200, Math.round(Number(canvasSizeRaw.height) || 800)),
        },
        zones: zonesRaw as SmartLayoutTemplateV1['payload']['zones'],
        settings: settingsRaw as unknown as SmartLayoutTemplateV1['payload']['settings'],
        generationContextSnapshot: payload.generationContextSnapshot as SmartLayoutTemplateV1['payload']['generationContextSnapshot'],
      },
    };
    existingIds.add(id);
    imported.push(template);
  }

  const next = [...imported, ...existing].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 50);
  const persisted = saveSmartLayoutTemplates(next);
  return {
    imported: imported.length,
    importedTemplates: imported,
    next: persisted?.saved ?? [],
    strippedSnapshots: persisted?.strippedSnapshots ?? false,
    persisted: persisted?.ok ?? false,
  };
}

export function importDefaultSmartLayoutTemplatesFromJson(raw: string) {
  const parsed = safeParseJson<unknown>(raw);
  if (!parsed) return { imported: 0, next: loadSmartLayoutTemplates() };
  const candidates: unknown[] =
    Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.templates)
        ? (parsed.templates as unknown[])
        : [parsed];
  const existing = loadSmartLayoutTemplates();
  const existingIds = new Set(existing.map((t) => t.id));
  const now = Date.now();
  const imported: SmartLayoutTemplateV1[] = [];

  for (const c of candidates) {
    if (!isRecord(c) || c.schemaVersion !== 1) continue;
    const payload = c.payload;
    if (!isRecord(payload)) continue;
    const canvasSizeRaw = payload.canvasSize;
    const settingsRaw = payload.settings;
    const zonesRaw = payload.zones;
    if (!isRecord(canvasSizeRaw) || !isRecord(settingsRaw) || !Array.isArray(zonesRaw)) continue;

    const idRaw = c.id;
    if (typeof idRaw !== 'string' || existingIds.has(idRaw)) continue;

    const nameRaw = c.name;
    const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : '未命名模板';
    const template: SmartLayoutTemplateV1 = {
      schemaVersion: 1,
      id: idRaw,
      name,
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : now,
      updatedAt: now,
      snapshotDataUrl: typeof c.snapshotDataUrl === 'string' ? c.snapshotDataUrl : undefined,
      payload: {
        canvasSize: {
          width: Math.max(200, Math.round(Number(canvasSizeRaw.width) || 800)),
          height: Math.max(200, Math.round(Number(canvasSizeRaw.height) || 800)),
        },
        zones: zonesRaw as SmartLayoutTemplateV1['payload']['zones'],
        settings: settingsRaw as unknown as SmartLayoutTemplateV1['payload']['settings'],
        generationContextSnapshot: payload.generationContextSnapshot as SmartLayoutTemplateV1['payload']['generationContextSnapshot'],
      },
    };
    existingIds.add(idRaw);
    imported.push(template);
  }

  const next = [...imported, ...existing]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 50);
  const persisted = saveSmartLayoutTemplates(next);
  return {
    imported: imported.length,
    importedTemplates: imported,
    next: persisted?.saved ?? [],
    strippedSnapshots: persisted?.strippedSnapshots ?? false,
    persisted: persisted?.ok ?? false,
  };
}

export function ensureDefaultSmartLayoutTemplatesImported(input: { raw: string; sourceId: string }) {
  if (typeof window === 'undefined') return { imported: 0, persisted: false, already: true };
  try {
    const marker = window.localStorage.getItem(DEFAULT_TEMPLATES_IMPORTED_KEY);
    if (marker === input.sourceId && loadSmartLayoutTemplates().length > 0) return { imported: 0, persisted: true, already: true };
  } catch {
    return { imported: 0, persisted: false, already: false };
  }
  const result = importDefaultSmartLayoutTemplatesFromJson(input.raw);
  if (result.persisted && loadSmartLayoutTemplates().length > 0) {
    try {
      window.localStorage.setItem(DEFAULT_TEMPLATES_IMPORTED_KEY, input.sourceId);
    } catch {
      return { ...result, already: false };
    }
  }
  return { ...result, already: false };
}

export function downloadJsonFile(filename: string, data: unknown) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
