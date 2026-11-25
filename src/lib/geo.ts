import type { GeoPoint } from '../types';

export function getCurrentLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('이 브라우저는 위치 기능을 지원하지 않습니다.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          savedAt: Date.now(),
        }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.'
            : err.code === err.TIMEOUT
              ? '위치를 가져오는 데 시간이 너무 오래 걸립니다. 다시 시도해 주세요.'
              : '위치를 가져올 수 없습니다.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * 좌표 → 주소 (OpenStreetMap Nominatim, API 키 불필요)
 * 예) "서울 강남구 테헤란로 123 (역삼동)"
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ko`;
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    const a: Record<string, string> = j.address ?? {};
    const region = [a.province ?? a.state, a.city, a.county, a.borough ?? a.city_district, a.town ?? a.village]
      .filter(Boolean)
      .filter((x, i, arr) => arr.indexOf(x) === i);
    const dong = a.quarter ?? a.suburb ?? a.neighbourhood;
    const street = a.road ? [a.road, a.house_number].filter(Boolean).join(' ') : dong;
    const parts = [...region, street].filter(Boolean).join(' ');
    const extra = [a.road && dong, j.name && j.name !== a.road ? j.name : null].filter(Boolean).join(', ');
    const text = parts ? (extra ? `${parts} (${extra})` : parts) : (j.display_name as string | undefined);
    return text?.trim() || null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

export const naverWebUrl = (lat: number, lng: number) =>
  `https://map.naver.com/p?c=${lng},${lat},17,0,0,0,dh`;

export const naverAppUrl = (lat: number, lng: number, name: string) =>
  `nmap://place?lat=${lat}&lng=${lng}&name=${encodeURIComponent(name)}&appname=${encodeURIComponent(location.origin)}`;

export const naverSearchUrl = (query: string) =>
  `https://map.naver.com/p/search/${encodeURIComponent(query)}`;

/** 네이버 부동산 바로가기 URL (저장된 좌표가 있으면 해당 위치 중심으로 이동) */
export function naverLandUrl(loc?: { lat: number; lng: number }): string {
  if (isMobile()) {
    return loc ? `https://m.land.naver.com/map/${loc.lat}:${loc.lng}:17` : 'https://m.land.naver.com/';
  }
  return loc ? `https://new.land.naver.com/complexes?ms=${loc.lat},${loc.lng},17` : 'https://new.land.naver.com/';
}

/** 카카오맵 도보/대중교통 길찾기 링크 */
export function kakaoRouteUrl(
  from: { lat: number; lng: number; name?: string },
  to: { lat: number; lng: number; name: string },
  by: 'walk' | 'bus',
): string {
  const mode = by === 'walk' ? 'walk' : 'traffic';
  const sName = encodeURIComponent(from.name || '매물');
  const eName = encodeURIComponent(to.name);
  return `https://map.kakao.com/link/by/${mode}/${sName},${from.lat},${from.lng}/${eName},${to.lat},${to.lng}`;
}

/** 모바일: 네이버지도 앱(마커 표시) 실행 → 앱이 없으면 웹 지도로 이동. PC: 웹 지도 새 탭 */
export function openNaverMap(lat: number, lng: number, name: string) {
  const web = naverWebUrl(lat, lng);
  if (!isMobile()) {
    window.open(web, '_blank', 'noopener');
    return;
  }
  let left = false;
  const onHide = () => {
    if (document.visibilityState === 'hidden') left = true;
  };
  document.addEventListener('visibilitychange', onHide);
  window.location.href = naverAppUrl(lat, lng, name);
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide);
    if (!left) window.location.href = web;
  }, 1500);
}
