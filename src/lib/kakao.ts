export interface AgencyPlace {
  id: string;
  name: string;
  phone: string;
  address: string;
  distance?: number;
}

export interface StationPlace {
  id: string;
  name: string;
  distance: number; // 직선거리 (m)
  lat: number;
  lng: number;
  walkMin: number;
  busMin: number;
  by: 'walk' | 'bus';
  minutes: number;
}

interface KakaoPlaceRaw {
  id: string;
  place_name: string;
  phone: string;
  road_address_name: string;
  address_name: string;
  x?: string;
  y?: string;
  distance?: string;
}

interface KakaoPlacesService {
  keywordSearch(
    keyword: string,
    cb: (data: KakaoPlaceRaw[], status: string) => void,
    opts?: Record<string, unknown>,
  ): void;
  categorySearch(
    code: string,
    cb: (data: KakaoPlaceRaw[], status: string) => void,
    opts?: Record<string, unknown>,
  ): void;
}

interface KakaoNS {
  maps: {
    load(cb: () => void): void;
    LatLng: new (lat: number, lng: number) => unknown;
    services: {
      Status: { OK: string; ZERO_RESULT: string };
      SortBy: { ACCURACY: unknown; DISTANCE: unknown };
      Places: new () => KakaoPlacesService;
    };
  };
}

const getKey = () => (import.meta.env.VITE_KAKAO_JS_KEY as string | undefined)?.trim() ?? '';

export const hasKakaoKey = () => getKey().length > 0;

let sdkPromise: Promise<KakaoNS> | null = null;

function loadKakao(): Promise<KakaoNS> {
  const w = window as unknown as { kakao?: KakaoNS };
  if (w.kakao?.maps?.services) return Promise.resolve(w.kakao);
  if (sdkPromise) return sdkPromise;

  const key = getKey();
  if (!key) return Promise.reject(new Error('카카오 JavaScript 키(VITE_KAKAO_JS_KEY)가 설정되지 않았습니다.'));

  sdkPromise = new Promise<KakaoNS>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      if (!w.kakao?.maps?.load) {
        sdkPromise = null;
        reject(new Error('카카오 지도 SDK를 불러오지 못했습니다. 키와 도메인 등록을 확인해 주세요.'));
        return;
      }
      w.kakao.maps.load(() => resolve(w.kakao!));
    };
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('카카오 지도 SDK 로드에 실패했습니다. 네트워크나 도메인 등록 상태를 확인해 주세요.'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

const mapPlaces = (data: KakaoPlaceRaw[]): AgencyPlace[] =>
  data.map((d) => ({
    id: d.id,
    name: d.place_name,
    phone: d.phone || '',
    address: d.road_address_name || d.address_name || '',
    distance: d.distance ? Number(d.distance) : undefined,
  }));

function runKeyword(kakao: KakaoNS, query: string, opts: Record<string, unknown>): Promise<AgencyPlace[]> {
  return new Promise((resolve, reject) => {
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(
      query,
      (data, status) => {
        if (status === kakao.maps.services.Status.OK) resolve(mapPlaces(data));
        else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve([]);
        else reject(new Error('중개소 검색 중 오류가 발생했습니다.'));
      },
      opts,
    );
  });
}

/** 키워드로 부동산 중개업소(AG2) 검색 */
export async function searchAgencies(query: string, near?: { lat: number; lng: number }): Promise<AgencyPlace[]> {
  const q = query.trim();
  if (!q) return [];
  const kakao = await loadKakao();
  const baseOpts: Record<string, unknown> = {
    size: 15,
    ...(near ? { location: new kakao.maps.LatLng(near.lat, near.lng) } : {}),
  };
  const ag2 = await runKeyword(kakao, q, { ...baseOpts, category_group_code: 'AG2' });
  if (ag2.length > 0 || !/부동산|중개/.test(q)) return ag2;
  // 사용자가 이미 '부동산/중개'를 붙여 검색했는데 AG2로 안 잡히는 경우 일반 검색으로 한 번 더 조회
  return runKeyword(kakao, q, baseOpts);
}

/** 직선거리(m) 기반 역까지 도보/버스 소요 시간 추정 (도보 20분 초과 시 버스 기준) */
export function estimateStationAccess(distanceMeters: number) {
  const walkMin = Math.max(1, Math.round((distanceMeters * 1.25) / 67));
  const busMin = Math.max(5, Math.round((distanceMeters * 1.3) / 300 + 5));
  const by: 'walk' | 'bus' = walkMin > 20 ? 'bus' : 'walk';
  return { walkMin, busMin, by, minutes: by === 'walk' ? walkMin : busMin };
}

/** 좌표 기준 반경 5km 이내 지하철역 거리순 검색 */
export async function searchNearbyStations(lat: number, lng: number): Promise<StationPlace[]> {
  const kakao = await loadKakao();
  return new Promise((resolve, reject) => {
    const ps = new kakao.maps.services.Places();
    ps.categorySearch(
      'SW8',
      (data, status) => {
        if (status === kakao.maps.services.Status.OK) {
          resolve(
            data.map((d) => {
              const distance = Number(d.distance || 0);
              return {
                id: d.id,
                name: d.place_name,
                distance,
                lat: Number(d.y),
                lng: Number(d.x),
                ...estimateStationAccess(distance),
              };
            }),
          );
        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
          resolve([]);
        } else {
          reject(new Error('가까운 역 검색 중 오류가 발생했습니다.'));
        }
      },
      {
        location: new kakao.maps.LatLng(lat, lng),
        radius: 5000,
        sort: kakao.maps.services.SortBy.DISTANCE,
        size: 5,
      },
    );
  });
}

/** 좌표 기준 반경 1km 이내 중개업소 거리순 검색 */
export async function searchNearbyAgencies(lat: number, lng: number): Promise<AgencyPlace[]> {
  const kakao = await loadKakao();
  return new Promise((resolve, reject) => {
    const ps = new kakao.maps.services.Places();
    ps.categorySearch(
      'AG2',
      (data, status) => {
        if (status === kakao.maps.services.Status.OK) resolve(mapPlaces(data));
        else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve([]);
        else reject(new Error('주변 중개소 검색 중 오류가 발생했습니다.'));
      },
      {
        location: new kakao.maps.LatLng(lat, lng),
        radius: 1000,
        sort: kakao.maps.services.SortBy.DISTANCE,
        size: 15,
      },
    );
  });
}
