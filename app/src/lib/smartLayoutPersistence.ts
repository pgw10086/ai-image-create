import { v4 as uuidv4 } from 'uuid';
import type { SmartLayoutDraftV1, SmartLayoutTemplateV1 } from '@/types/smartLayout';

const TEMPLATES_KEY = 'smart_layout_templates_v1';
const DRAFT_KEY = 'smart_layout_draft_v1';
const DEFAULT_TEMPLATES_IMPORTED_KEY = 'smart_layout_default_templates_imported_v1';
const HISTORY_KEY = 'smart_layout_history_v1';
const HISTORY_DB_NAME = 'smart_layout_history_db_v1';
const HISTORY_DB_VERSION = 1;
const HISTORY_STORE = 'history';

export const SMART_LAYOUT_HISTORY_RETENTION_LIMIT = 50;

export type SmartLayoutHistoryRecord = {
  id: string;
  createdAt: number;
  slots: Array<{
    status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
    url?: string;
    draftUrl?: string;
    phase?: 'draft' | 'refine' | 'final';
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

function isHistoryStatus(
  value: unknown
): value is SmartLayoutHistoryRecord['slots'][number]['status'] {
  return value === 'pending' || value === 'processing' || value === 'success' || value === 'failed' || value === 'cancelled';
}

function isHistoryPhase(
  value: unknown
): value is NonNullable<SmartLayoutHistoryRecord['slots'][number]['phase']> {
  return value === 'draft' || value === 'refine' || value === 'final';
}

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function waitTransaction(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openHistoryDb() {
  if (typeof window === 'undefined') return Promise.resolve(null as IDBDatabase | null);
  if (!('indexedDB' in window)) return Promise.resolve(null as IDBDatabase | null);
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(HISTORY_DB_NAME, HISTORY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(HISTORY_STORE)) return;
      const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
      store.createIndex('createdAt', 'createdAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function stripHistoryDraftUrls(next: SmartLayoutHistoryRecord[]): SmartLayoutHistoryRecord[] {
  return next.map((entry) => ({
    ...entry,
    slots: entry.slots.map((slot) => ({ ...slot, draftUrl: undefined })),
  }));
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

export type UpsertSmartLayoutTemplateInput = {
  id?: string;
  name: string;
  snapshotDataUrl?: string;
  payload: SmartLayoutTemplateV1['payload'];
};

export function upsertSmartLayoutTemplate(input: UpsertSmartLayoutTemplateInput) {
  const now = Date.now();
  const templates = loadSmartLayoutTemplates();
  const id = input.id || uuidv4();
  const exists = templates.find((t) => t.id === id);
  const origin: SmartLayoutTemplateV1['origin'] = 'user';
  const next: SmartLayoutTemplateV1 = {
    schemaVersion: 1,
    id,
    name: input.name,
    createdAt: exists?.createdAt ?? now,
    updatedAt: now,
    snapshotDataUrl: input.snapshotDataUrl,
    origin,
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
    copyVariables: draft.copyVariables,
    productTemplateIntent: draft.productTemplateIntent,
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

export function loadSmartLayoutHistory(limit = SMART_LAYOUT_HISTORY_RETENTION_LIMIT): SmartLayoutHistoryRecord[] {
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
    .map((entry) => {
      const slots = Array.isArray(entry.slots) ? (entry.slots as unknown[]) : [];
      const normalizedSlots: SmartLayoutHistoryRecord['slots'] = [];
      for (const slot of slots) {
        if (!isRecord(slot)) continue;
        const url = typeof slot.url === 'string' ? slot.url : undefined;
        const draftUrl = typeof slot.draftUrl === 'string' ? slot.draftUrl : undefined;
        const error = typeof slot.error === 'string' ? slot.error : undefined;
        const phase = isHistoryPhase(slot.phase) ? slot.phase : undefined;
        const status = isHistoryStatus(slot.status) ? slot.status : undefined;
        if (url) {
          normalizedSlots.push({ status: 'success', url, draftUrl, phase, error });
          continue;
        }
        if (error && status !== 'cancelled') {
          normalizedSlots.push({ status: 'failed', url, draftUrl, phase, error });
          continue;
        }
        normalizedSlots.push({
          status: status ?? 'processing',
          url,
          draftUrl,
          phase,
          error,
        });
      }
      return {
        id: entry.id as string,
        createdAt: entry.createdAt as number,
        requestedImageCount: entry.requestedImageCount as number,
        slots: normalizedSlots,
      };
    })
    .slice(0, limit);
}

export function saveSmartLayoutHistory(next: SmartLayoutHistoryRecord[], limit = SMART_LAYOUT_HISTORY_RETENTION_LIMIT) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, safeStringifyJson(next.slice(0, limit)));
  } catch {
    return false;
  }
  return true;
}

export async function loadSmartLayoutHistoryFromIndexedDb(limit = SMART_LAYOUT_HISTORY_RETENTION_LIMIT): Promise<SmartLayoutHistoryRecord[]> {
  const db = await openHistoryDb();
  if (!db) return loadSmartLayoutHistory(limit);

  try {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_STORE);
    const index = store.index('createdAt');
    const results: SmartLayoutHistoryRecord[] = [];
    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor(null, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || results.length >= limit) {
          resolve();
          return;
        }
        const value = cursor.value as unknown;
        if (isRecord(value)) {
          const id = value.id;
          const createdAt = value.createdAt;
          const slots = value.slots;
          const requestedImageCount = value.requestedImageCount;
          if (typeof id === 'string' && typeof createdAt === 'number' && Array.isArray(slots) && typeof requestedImageCount === 'number') {
            const slotList = Array.isArray(slots) ? (slots as unknown[]) : [];
            const normalizedSlots: SmartLayoutHistoryRecord['slots'] = [];
            for (const slot of slotList) {
              if (!isRecord(slot)) continue;
              const url = typeof slot.url === 'string' ? slot.url : undefined;
              const error = typeof slot.error === 'string' ? slot.error : undefined;
              const phase = isHistoryPhase(slot.phase) ? slot.phase : undefined;
              const status = isHistoryStatus(slot.status) ? slot.status : undefined;
              if (url) {
                normalizedSlots.push({ status: 'success', url, draftUrl: undefined, phase, error });
                continue;
              }
              if (error && status !== 'cancelled') {
                normalizedSlots.push({ status: 'failed', url, draftUrl: undefined, phase, error });
                continue;
              }
              normalizedSlots.push({
                status: status ?? 'processing',
                url,
                draftUrl: undefined,
                phase,
                error,
              });
            }
            results.push({
              id,
              createdAt,
              requestedImageCount,
              slots: normalizedSlots,
            });
          }
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
    await waitTransaction(tx);
    return results;
  } finally {
    db.close();
  }
}

export async function saveSmartLayoutHistoryToIndexedDb(next: SmartLayoutHistoryRecord[], limit = SMART_LAYOUT_HISTORY_RETENTION_LIMIT) {
  const db = await openHistoryDb();
  if (!db) return saveSmartLayoutHistory(next, limit);

  try {
    const sanitized = stripHistoryDraftUrls(next).slice(0, limit);
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    for (const entry of sanitized) {
      store.put(entry);
    }
    await new Promise<void>((resolve, reject) => {
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev');
      let kept = 0;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        kept += 1;
        if (kept > limit) {
          store.delete(cursor.primaryKey);
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
    await waitTransaction(tx);
    return true;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

export async function migrateSmartLayoutHistoryToIndexedDb(limit = SMART_LAYOUT_HISTORY_RETENTION_LIMIT) {
  const db = await openHistoryDb();
  if (!db) return { migrated: 0, usedIndexedDb: false as const };

  try {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_STORE);
    const count = await new Promise<number>((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await waitTransaction(tx);
    if (count > 0) return { migrated: 0, usedIndexedDb: true as const };

    const fromLocal = loadSmartLayoutHistory(limit);
    if (fromLocal.length === 0) return { migrated: 0, usedIndexedDb: true as const };
    const ok = await saveSmartLayoutHistoryToIndexedDb(fromLocal, limit);
    if (ok) {
      try {
        window.localStorage.removeItem(HISTORY_KEY);
      } catch {
        return { migrated: fromLocal.length, usedIndexedDb: true as const };
      }
      return { migrated: fromLocal.length, usedIndexedDb: true as const };
    }
    return { migrated: 0, usedIndexedDb: true as const };
  } finally {
    db.close();
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
      origin: 'imported',
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

export function importDefaultSmartLayoutTemplatesFromJson(raw: string, sourceId: string) {
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
  const byId = new Map(existing.map((t) => [t.id, t] as const));
  const indexById = new Map(existing.map((t, idx) => [t.id, idx] as const));
  const nextExisting = existing.slice();
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
    if (typeof idRaw !== 'string') continue;

    const nameRaw = c.name;
    const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : '未命名模板';
    const candidatePayload: SmartLayoutTemplateV1['payload'] = {
      canvasSize: {
        width: Math.max(200, Math.round(Number(canvasSizeRaw.width) || 800)),
        height: Math.max(200, Math.round(Number(canvasSizeRaw.height) || 800)),
      },
      zones: zonesRaw as SmartLayoutTemplateV1['payload']['zones'],
      settings: settingsRaw as unknown as SmartLayoutTemplateV1['payload']['settings'],
      generationContextSnapshot: payload.generationContextSnapshot as SmartLayoutTemplateV1['payload']['generationContextSnapshot'],
    };
    const candidateComparable = stableStringify({ name, payload: candidatePayload });

    if (existingIds.has(idRaw)) {
      const exists = byId.get(idRaw);
      const idx = indexById.get(idRaw);
      const existsComparable = exists ? stableStringify({ name: exists.name, payload: exists.payload }) : '';
      const same = !!exists && existsComparable === candidateComparable;

      if (exists && exists.origin === 'default') {
        if (!same || exists.originSourceId !== sourceId) {
          const patched: SmartLayoutTemplateV1 = {
            ...exists,
            name,
            payload: candidatePayload,
            snapshotDataUrl: typeof c.snapshotDataUrl === 'string' ? c.snapshotDataUrl : undefined,
            updatedAt: now,
            origin: 'default',
            originSourceId: sourceId,
          };
          if (typeof idx === 'number') nextExisting[idx] = patched;
          byId.set(idRaw, patched);
        }
        continue;
      }

      if (exists && !exists.origin && same) {
        const patched: SmartLayoutTemplateV1 = {
          ...exists,
          origin: 'default',
          originSourceId: sourceId,
        };
        if (typeof idx === 'number') nextExisting[idx] = patched;
        byId.set(idRaw, patched);
        continue;
      }

      if (same) continue;

      const newId = uuidv4();
      imported.push({
        schemaVersion: 1,
        id: newId,
        name: `${name}（内置更新）`,
        createdAt: now,
        updatedAt: now,
        snapshotDataUrl: typeof c.snapshotDataUrl === 'string' ? c.snapshotDataUrl : undefined,
        origin: 'default',
        originSourceId: sourceId,
        payload: candidatePayload,
      });
      existingIds.add(newId);
      continue;
    }

    existingIds.add(idRaw);
    imported.push({
      schemaVersion: 1,
      id: idRaw,
      name,
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : now,
      updatedAt: now,
      snapshotDataUrl: typeof c.snapshotDataUrl === 'string' ? c.snapshotDataUrl : undefined,
      origin: 'default',
      originSourceId: sourceId,
      payload: candidatePayload,
    });
  }

  const next = [...imported, ...nextExisting]
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
  const result = importDefaultSmartLayoutTemplatesFromJson(input.raw, input.sourceId);
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
