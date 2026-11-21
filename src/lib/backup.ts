import { db, saveSettings } from '../db/db';
import type { Photo, Property } from '../types';
import { blobToDataUrl, dataUrlToBlob } from './image';

interface BackupFile {
  app: 'house-checklist';
  version: 1;
  exportedAt: number;
  properties: Property[];
  photos: (Omit<Photo, 'blob' | 'thumb'> & { blob: string; thumb: string })[];
}

export async function exportBackup(): Promise<Blob> {
  const properties = await db.properties.toArray();
  const rawPhotos = await db.photos.toArray();
  const photos = await Promise.all(
    rawPhotos.map(async (p) => ({ ...p, blob: await blobToDataUrl(p.blob), thumb: await blobToDataUrl(p.thumb) })),
  );
  const data: BackupFile = { app: 'house-checklist', version: 1, exportedAt: Date.now(), properties, photos };
  await saveSettings({ lastBackupAt: Date.now() });
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function downloadOrShareBackup() {
  const blob = await exportBackup();
  const name = `집체크-백업-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '집체크 백업' });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 가져오기: 같은 id는 덮어쓰기(병합) */
export async function importBackup(file: File): Promise<{ properties: number; photos: number }> {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data.app !== 'house-checklist' || !Array.isArray(data.properties)) {
    throw new Error('올바른 백업 파일이 아닙니다.');
  }
  const photos: Photo[] = await Promise.all(
    (data.photos ?? []).map(async (p) => ({ ...p, blob: await dataUrlToBlob(p.blob), thumb: await dataUrlToBlob(p.thumb) })),
  );
  await db.transaction('rw', db.properties, db.photos, async () => {
    await db.properties.bulkPut(data.properties);
    await db.photos.bulkPut(photos);
  });
  return { properties: data.properties.length, photos: photos.length };
}
