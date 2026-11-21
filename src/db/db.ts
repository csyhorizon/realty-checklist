import Dexie, { type Table } from 'dexie';
import type { DealType, Photo, Property, Settings } from '../types';

class AppDB extends Dexie {
  properties!: Table<Property, string>;
  photos!: Table<Photo, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('house-checklist');
    this.version(1).stores({
      properties: 'id, dealType, status, favorite, createdAt, updatedAt',
      photos: 'id, propertyId, createdAt',
      settings: 'id',
    });
  }
}

export const db = new AppDB();

export const DEFAULT_SETTINGS: Settings = { id: 'app', baseRate: 3.0 };

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings();
  await db.settings.put({ ...cur, ...patch, id: 'app' });
}

export async function createProperty(
  dealType: DealType,
  nickname: string,
  extra: Partial<Pick<Property, 'agencyName' | 'agencyPhone'>> = {},
): Promise<string> {
  const now = Date.now();
  const id = uid();
  await db.properties.add({
    id,
    dealType,
    nickname: nickname.trim(),
    ...extra,
    answers: {},
    memo: '',
    status: 'reviewing',
    favorite: false,
    visitedAt: new Date(now).toISOString().slice(0, 10),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateProperty(id: string, patch: Partial<Property>) {
  await db.properties.update(id, { ...patch, updatedAt: Date.now() });
}

export async function setAnswer(p: Property, key: string, value: Property['answers'][string]) {
  await updateProperty(p.id, { answers: { ...p.answers, [key]: value } });
}

/** 최근 매물들의 중개소 정보 (중복 제거, 최신순) */
export async function recentAgencies(limit = 5): Promise<{ name: string; phone: string; at: number }[]> {
  const list = await db.properties.orderBy('createdAt').reverse().limit(50).toArray();
  const seen = new Set<string>();
  const out: { name: string; phone: string; at: number }[] = [];
  for (const p of list) {
    const name = p.agencyName?.trim() ?? '';
    const phone = p.agencyPhone?.trim() ?? '';
    if (!name && !phone) continue;
    const key = `${name}|${phone}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, phone, at: p.createdAt });
    if (out.length >= limit) break;
  }
  return out;
}

export async function deleteProperty(id: string) {
  await db.transaction('rw', db.properties, db.photos, async () => {
    await db.photos.where('propertyId').equals(id).delete();
    await db.properties.delete(id);
  });
}
