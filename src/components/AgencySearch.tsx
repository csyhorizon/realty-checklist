import { useState } from 'react';
import { updateProperty } from '../db/db';
import { getCurrentLocation } from '../lib/geo';
import { hasKakaoKey, searchAgencies, searchNearbyAgencies, type AgencyPlace } from '../lib/kakao';
import type { Property } from '../types';
import { Icon } from './Icon';

export function AgencySearch({ p }: { p: Property }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<AgencyPlace[] | null>(null);
  const [err, setErr] = useState<string>();

  if (!hasKakaoKey()) {
    return (
      <p className="text-xs text-slate-400 pt-1 pb-2">
        카카오 JS 키(<code className="bg-slate-100 px-1 rounded">VITE_KAKAO_JS_KEY</code>)를 설정하면 중개소 검색을 쓸 수 있어요.
      </p>
    );
  }

  const runSearch = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setErr(undefined);
    try {
      const list = await searchAgencies(query, p.location ? { lat: p.location.lat, lng: p.location.lng } : undefined);
      setResults(list);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runNearby = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      const loc = p.location ?? (await getCurrentLocation());
      const list = await searchNearbyAgencies(loc.lat, loc.lng);
      setResults(list);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = async (place: AgencyPlace) => {
    await updateProperty(p.id, {
      agencyName: place.name,
      agencyPhone: place.phone || '',
    });
    setResults(null);
    setQuery('');
  };

  return (
    <div className="pt-1 pb-3 space-y-2 border-b border-slate-100">
      <div className="flex gap-1.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="중개소 검색 (예: 역삼동 행복)"
          className="flex-1 min-w-0 min-h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={busy || !query.trim()}
          className="min-h-11 px-3.5 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-40 inline-flex items-center gap-1 shrink-0"
        >
          <Icon name="search" size={18} />
          <span>검색</span>
        </button>
        <button
          type="button"
          onClick={runNearby}
          disabled={busy}
          title="주변 1km 중개소 찾기"
          className="min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold disabled:opacity-40 inline-flex items-center gap-1 shrink-0"
        >
          <Icon name="my_location" size={17} className="text-blue-600" />
          <span>주변</span>
        </button>
      </div>

      {busy && <p className="text-xs text-slate-500">중개소를 찾는 중…</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}

      {results && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 text-xs text-slate-500">
            <span>{results.length ? `검색 결과 ${results.length}건 (눌러서 자동 입력)` : '검색 결과가 없어요'}</span>
            <button type="button" onClick={() => setResults(null)} className="text-slate-600 font-semibold px-1">
              닫기
            </button>
          </div>
          {results.length > 0 && (
            <ul className="max-h-60 overflow-y-auto divide-y divide-slate-200 bg-white">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="w-full text-left px-3 py-2.5 active:bg-blue-50 hover:bg-slate-50"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-800 truncate">{r.name}</span>
                      {r.distance != null && <span className="text-xs text-blue-600 shrink-0">{r.distance}m</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{r.address || '주소 없음'}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{r.phone || '전화번호 정보 없음'}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
