import { useState } from 'react';
import { db, updateProperty } from '../db/db';
import { displayName } from '../lib/format';
import { getCurrentLocation, kakaoRouteUrl } from '../lib/geo';
import { hasKakaoKey, searchNearbyStations, type StationPlace } from '../lib/kakao';
import type { Property } from '../types';
import { Icon } from './Icon';

export function StationFinder({ p }: { p: Property }) {
  const [busy, setBusy] = useState(false);
  const [stations, setStations] = useState<StationPlace[] | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState<string>();

  if (!hasKakaoKey()) return null;

  const find = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      const loc = p.location ?? (await getCurrentLocation());
      if (!p.location) await updateProperty(p.id, { location: loc });
      setOrigin(loc);
      const list = await searchNearbyStations(loc.lat, loc.lng);
      setStations(list);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async (st: StationPlace) => {
    const latest = (await db.properties.get(p.id)) ?? p;
    await updateProperty(p.id, {
      answers: {
        ...latest.answers,
        stationName: st.name,
        stationMin: st.minutes,
        stationBy: st.by,
      },
    });
    setStations(null);
  };

  const distLabel = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`);

  return (
    <div className="py-3 border-b border-slate-100 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">직선거리 추정 (도보 20분 초과 시 버스)</span>
        <button
          type="button"
          onClick={find}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold disabled:opacity-50 active:bg-blue-100 shrink-0"
        >
          <Icon name="train" size={15} />
          <span>{busy ? '찾는 중…' : '위치로 역 계산'}</span>
        </button>
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      {stations && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 text-xs text-slate-500">
            <span>{stations.length ? '가까운 역 선택 (눌러서 입력)' : '반경 5km 내 지하철역이 없어요'}</span>
            <button type="button" onClick={() => setStations(null)} className="text-slate-600 font-semibold px-1">
              닫기
            </button>
          </div>
          {stations.length > 0 && (
            <ul className="divide-y divide-slate-200 bg-white">
              {stations.map((st) => (
                <li key={st.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => apply(st)}
                    className="flex-1 min-w-0 text-left px-3 py-2.5 active:bg-blue-50"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-800 truncate">{st.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">직선 {distLabel(st.distance)}</span>
                    </div>
                    <p className="text-xs mt-0.5 flex items-center gap-1 text-blue-600 font-medium">
                      <Icon name={st.by === 'walk' ? 'directions_walk' : 'directions_bus'} size={14} />
                      <span>
                        {st.by === 'walk'
                          ? `도보 약 ${st.minutes}분`
                          : `버스 약 ${st.minutes}분 (도보 약 ${st.walkMin}분)`}
                      </span>
                    </p>
                  </button>
                  {origin && (
                    <a
                      href={kakaoRouteUrl({ lat: origin.lat, lng: origin.lng, name: displayName(p) }, st, st.by)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="카카오맵 길찾기로 실제 시간 확인"
                      className="px-3 py-3 text-slate-400 hover:text-blue-600 shrink-0"
                    >
                      <Icon name="open_in_new" size={17} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
