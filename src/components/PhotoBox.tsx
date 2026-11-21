import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, updateProperty } from '../db/db';
import { processImage } from '../lib/image';
import { useObjectUrl } from '../lib/hooks';
import type { Photo, Property } from '../types';

function Thumb({ photo, cover, onClick }: { photo: Photo; cover: boolean; onClick: () => void }) {
  const url = useObjectUrl(photo.thumb);
  return (
    <button onClick={onClick} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
      {url && <img src={url} alt="" className="w-full h-full object-cover" />}
      {cover && <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white">대표</span>}
      {photo.caption && (
        <span className="absolute bottom-0 inset-x-0 text-[11px] text-white bg-black/50 px-1 truncate">{photo.caption}</span>
      )}
    </button>
  );
}

function Viewer({ photos, index, p, onClose, onIndex }: { photos: Photo[]; index: number; p: Property; onClose: () => void; onIndex: (i: number) => void }) {
  const photo = photos[index];
  const url = useObjectUrl(photo?.blob);
  const startX = useRef<number | null>(null);
  if (!photo) return null;
  const go = (d: number) => onIndex((index + d + photos.length) % photos.length);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-3 pt-[calc(env(safe-area-inset-top)+12px)] text-white">
        <button onClick={onClose} className="w-11 h-11 text-2xl">✕</button>
        <span className="text-sm">{index + 1} / {photos.length}</span>
        <span className="w-11" />
      </div>
      <div
        className="flex-1 flex items-center justify-center overflow-hidden"
        onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (startX.current == null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          startX.current = null;
        }}
      >
        {url && <img src={url} alt="" className="max-w-full max-h-full object-contain" />}
      </div>
      <div className="p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] space-y-2">
        <input
          defaultValue={photo.caption ?? ''}
          key={photo.id}
          placeholder="사진 메모 (예: 창틀 곰팡이)"
          onBlur={(e) => db.photos.update(photo.id, { caption: e.target.value })}
          className="w-full min-h-11 px-3 rounded-xl bg-white/10 text-white placeholder:text-white/50 text-base"
        />
        <div className="flex gap-2">
          <button onClick={() => updateProperty(p.id, { coverPhotoId: photo.id })} className="flex-1 min-h-11 rounded-xl bg-white/15 text-white">
            {p.coverPhotoId === photo.id ? '✓ 대표 사진' : '대표로 지정'}
          </button>
          <button
            onClick={async () => {
              if (!confirm('이 사진을 삭제할까요?')) return;
              await db.photos.delete(photo.id);
              if (p.coverPhotoId === photo.id) await updateProperty(p.id, { coverPhotoId: undefined });
              if (photos.length <= 1) onClose();
              else onIndex(Math.min(index, photos.length - 2));
            }}
            className="flex-1 min-h-11 rounded-xl bg-rose-500/80 text-white"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

export function PhotoBox({ p }: { p: Property }) {
  const photos = useLiveQuery(() => db.photos.where('propertyId').equals(p.id).sortBy('createdAt'), [p.id]) ?? [];
  const camRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<number | null>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      let first: string | undefined;
      for (const f of Array.from(files)) {
        const { blob, thumb } = await processImage(f);
        const id = uid();
        first ??= id;
        await db.photos.add({ id, propertyId: p.id, blob, thumb, createdAt: Date.now() });
      }
      if (!p.coverPhotoId && first) await updateProperty(p.id, { coverPhotoId: first });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
      if (camRef.current) camRef.current.value = '';
      if (albumRef.current) albumRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => camRef.current?.click()} disabled={busy} className="flex-1 min-h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-60">
          📷 촬영
        </button>
        <button onClick={() => albumRef.current?.click()} disabled={busy} className="flex-1 min-h-12 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-60">
          🖼️ 앨범
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => add(e.target.files)} />
      <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      {busy && <p className="text-sm text-slate-500">사진 저장 중…</p>}
      {photos.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">곰팡이, 수압, 창밖 뷰 등 기억할 부분을 찍어두세요.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((ph, i) => (
            <Thumb key={ph.id} photo={ph} cover={p.coverPhotoId === ph.id} onClick={() => setView(i)} />
          ))}
        </div>
      )}
      {view != null && <Viewer photos={photos} index={view} p={p} onClose={() => setView(null)} onIndex={setView} />}
    </div>
  );
}

export function CoverImage({ photoId, className = '' }: { photoId?: string; className?: string }) {
  const photo = useLiveQuery(() => (photoId ? db.photos.get(photoId) : undefined), [photoId]);
  const url = useObjectUrl(photo?.thumb);
  return (
    <div className={`bg-slate-100 flex items-center justify-center overflow-hidden ${className}`}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🏠</span>}
    </div>
  );
}
