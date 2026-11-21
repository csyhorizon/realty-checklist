import { useState } from 'react';
import { getCurrentLocation, naverSearchUrl, naverWebUrl, openNaverMap } from '../lib/geo';
import { updateProperty } from '../db/db';
import type { Property } from '../types';

export function LocationBox({ p }: { p: Property }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const save = async () => {
    if (p.location && !confirm('저장된 위치를 현재 위치로 바꿀까요?')) return;
    setBusy(true);
    setErr(undefined);
    try {
      const loc = await getCurrentLocation();
      await updateProperty(p.id, { location: loc });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {p.location ? (
        <button
          onClick={() => openNaverMap(p.location!.lat, p.location!.lng, p.nickname)}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-left active:bg-emerald-100"
        >
          <span className="text-2xl">📍</span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-emerald-800">네이버지도에서 보기</span>
            <span className="block text-xs text-emerald-700 truncate">
              {p.location.lat.toFixed(5)}, {p.location.lng.toFixed(5)} · 오차 ±{Math.round(p.location.accuracy)}m ·{' '}
              {new Date(p.location.savedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </span>
          <span className="text-emerald-700">›</span>
        </button>
      ) : (
        <p className="text-sm text-slate-500">현장에서 “현위치 저장”을 누르면 나중에 네이버지도로 바로 열 수 있어요.</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="flex-1 min-h-11 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-60 active:bg-blue-700"
        >
          {busy ? '위치 확인 중…' : p.location ? '📍 현위치로 다시 저장' : '📍 현위치 저장'}
        </button>
        {p.location && (
          <button
            onClick={() => confirm('저장된 위치를 삭제할까요?') && updateProperty(p.id, { location: undefined })}
            className="min-h-11 px-4 rounded-xl border border-slate-200 text-slate-600"
          >
            삭제
          </button>
        )}
      </div>
      <div className="flex gap-3 text-sm">
        {p.location && (
          <a href={naverWebUrl(p.location.lat, p.location.lng)} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            웹 지도로 열기
          </a>
        )}
        {p.address && (
          <a href={naverSearchUrl(p.address)} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            주소로 검색
          </a>
        )}
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
    </div>
  );
}
