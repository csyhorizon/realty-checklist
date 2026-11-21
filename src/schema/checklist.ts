import type { AnswerValue, DealType } from '../types';

export type SectionId = 'safety' | 'location' | 'room' | 'bath' | 'options';
export type Risk = 'warn' | 'danger';

export interface Opt {
  v: string;
  l: string;
  s?: number; // 0~1 점수
  risk?: Risk;
}

export interface Item {
  id: string;
  section: SectionId;
  label: string;
  type: 'single' | 'multi' | 'number' | 'text';
  options?: Opt[];
  unit?: string;
  tip?: string;
  placeholder?: string;
  deals?: DealType[]; // 없으면 전체
  showIf?: (a: Record<string, AnswerValue>) => boolean;
  /** number / multi 항목의 사용자 정의 점수 (0~1, null=채점 제외) */
  scoreFn?: (v: AnswerValue) => number | null;
}

export const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'safety', label: '가격·권리', icon: '🛡️' },
  { id: 'location', label: '위치·건물', icon: '🏢' },
  { id: 'room', label: '방·주방', icon: '🛏️' },
  { id: 'bath', label: '화장실', icon: '🚿' },
  { id: 'options', label: '옵션', icon: '🧺' },
];

/** 거래유형별 섹션 가중치 (합 100) */
export const WEIGHTS: Record<DealType, Record<SectionId, number>> = {
  monthly: { safety: 20, location: 25, room: 30, bath: 15, options: 10 },
  jeonse: { safety: 40, location: 20, room: 22, bath: 10, options: 8 },
  semi: { safety: 30, location: 20, room: 25, bath: 15, options: 10 },
};

const cond3 = (good: string, mid: string, bad: string): Opt[] => [
  { v: 'good', l: good, s: 1 },
  { v: 'mid', l: mid, s: 0.6 },
  { v: 'bad', l: bad, s: 0.2 },
];
const yesNo = (noScore = 0.3, noRisk?: Risk): Opt[] => [
  { v: 'yes', l: '있음', s: 1 },
  { v: 'no', l: '없음', s: noScore, risk: noRisk },
];
const ratio = (selected: AnswerValue, full: number) =>
  Array.isArray(selected) ? Math.min(1, selected.filter((x) => x !== 'etc').length / full) : null;

export const ITEMS: Item[] = [
  // ───────── 1. 가격·권리 ─────────
  { id: 'deposit', section: 'safety', label: '보증금', type: 'number', unit: '만원' },
  { id: 'rent', section: 'safety', label: '월세', type: 'number', unit: '만원', deals: ['monthly', 'semi'] },
  { id: 'fee', section: 'safety', label: '관리비', type: 'number', unit: '만원' },
  {
    id: 'feeIncludes', section: 'safety', label: '관리비 포함 내역', type: 'multi',
    options: [
      { v: 'water', l: '수도' }, { v: 'internet', l: '인터넷' }, { v: 'elec', l: '전기' },
      { v: 'gas', l: '가스' }, { v: 'tv', l: 'TV' }, { v: 'common', l: '공용' }, { v: 'etc', l: '기타' },
    ],
  },
  {
    id: 'adjust', section: 'safety', label: '보증금 조정', type: 'single',
    options: [{ v: 'no', l: '불가' }, { v: 'yes', l: '가능' }],
  },
  {
    id: 'adjustNote', section: 'safety', label: '조정 후 조건', type: 'text',
    placeholder: '예) 보증금 1000 / 월세 55', showIf: (a) => a.adjust === 'yes',
  },
  {
    id: 'marketPrice', section: 'safety', label: '매매 시세', type: 'number', unit: '만원',
    tip: 'KB시세·국토부 실거래가 참고. 입력하면 전세가율/부채비율 자동 계산',
  },
  {
    id: 'loan', section: 'safety', label: '버팀목 대출', type: 'single', deals: ['jeonse', 'semi'],
    options: [{ v: 'yes', l: '가능', s: 1 }, { v: 'no', l: '불가', s: 0, risk: 'warn' }, { v: 'unk', l: '모름' }],
  },
  {
    id: 'insurance', section: 'safety', label: '전세보증보험', type: 'single',
    options: [{ v: 'yes', l: '가입 가능', s: 1 }, { v: 'no', l: '불가', s: 0, risk: 'warn' }, { v: 'unk', l: '모름' }],
  },
  {
    id: 'violation', section: 'safety', label: '위반건축물 여부', type: 'single',
    tip: '건축물대장 확인. 위반건축물·근생은 대출 불가',
    options: [{ v: 'ok', l: '정상(주택)', s: 1 }, { v: 'bad', l: '위반·근생', s: 0, risk: 'danger' }],
  },
  {
    id: 'landlord', section: 'safety', label: '임대인 유형', type: 'single',
    tip: '법인·신탁은 우선순위 낮출 것',
    options: [
      { v: 'person', l: '개인', s: 1 },
      { v: 'corp', l: '법인', s: 0.4, risk: 'warn' },
      { v: 'trust', l: '신탁', s: 0.2, risk: 'warn' },
    ],
  },
  {
    id: 'lien', section: 'safety', label: '융자·선순위 보증금', type: 'single',
    tip: '등기부등본 을구 확인. 없는 매물 우선',
    options: [{ v: 'no', l: '없음', s: 1 }, { v: 'yes', l: '있음', s: 0.3, risk: 'warn' }],
  },
  {
    id: 'lienAmount', section: 'safety', label: '채권액·선순위 합계', type: 'number', unit: '만원',
    showIf: (a) => a.lien === 'yes',
  },

  // ───────── 2. 위치·건물 ─────────
  { id: 'floor', section: 'location', label: '해당 층', type: 'number', unit: '층' },
  { id: 'totalFloors', section: 'location', label: '건물 총 층수', type: 'number', unit: '층' },
  {
    id: 'houseType', section: 'location', label: '집 유형', type: 'single',
    options: [
      { v: 'semiBase', l: '반지하', s: 0.1, risk: 'warn' }, { v: 'ground', l: '지상층', s: 1 },
      { v: 'rooftop', l: '옥탑방', s: 0.3 }, { v: 'duplex', l: '복층', s: 0.8 },
      { v: 'f1', l: '1층', s: 0.5 }, { v: 'f15', l: '1.5층', s: 0.4 }, { v: 'etc', l: '기타', s: 0.5 },
    ],
  },
  {
    id: 'stationMin', section: 'location', label: '역까지 거리', type: 'number', unit: '분',
    scoreFn: (v) => {
      if (typeof v !== 'number') return null;
      if (v <= 5) return 1;
      if (v <= 10) return 0.8;
      if (v <= 15) return 0.5;
      if (v <= 20) return 0.3;
      return 0.1;
    },
  },
  {
    id: 'stationBy', section: 'location', label: '이동 수단', type: 'single',
    options: [{ v: 'walk', l: '도보' }, { v: 'bus', l: '버스' }],
  },
  {
    id: 'facilities', section: 'location', label: '건물 편의', type: 'multi',
    options: [
      { v: 'elevator', l: '엘리베이터' }, { v: 'office', l: '관리실' }, { v: 'parcel', l: '무인택배함' },
      { v: 'storage', l: '지하창고' }, { v: 'cctv', l: 'CCTV' }, { v: 'parking', l: '주차' }, { v: 'etc', l: '기타' },
    ],
    scoreFn: (v) => ratio(v, 4),
  },
  {
    id: 'bike', section: 'location', label: '자전거 주차', type: 'single',
    options: [
      { v: 'indoor', l: '실내 가능', s: 1 }, { v: 'outCctv', l: '외부(CCTV 有)', s: 0.8 },
      { v: 'out', l: '외부(CCTV 無)', s: 0.4 }, { v: 'none', l: '불가능', s: 0 },
    ],
  },
  { id: 'trash', section: 'location', label: '분리수거장 위치', type: 'text', placeholder: '예) 1층 주차장 옆' },

  // ───────── 3. 방·주방 ─────────
  { id: 'area', section: 'room', label: '평수', type: 'number', unit: '평' },
  { id: 'roomSize', section: 'room', label: '체감 넓이', type: 'single', options: cond3('넓음', '보통', '좁음') },
  {
    id: 'layout', section: 'room', label: '구조', type: 'single',
    options: [{ v: 'good', l: '배치 편리', s: 1 }, { v: 'bad', l: '배치 불편', s: 0.3 }],
  },
  {
    id: 'sunlight', section: 'room', label: '채광(방향)', type: 'single',
    options: [
      { v: 'S', l: '남향', s: 1 }, { v: 'SE', l: '남동', s: 0.9 }, { v: 'SW', l: '남서', s: 0.85 },
      { v: 'E', l: '동향', s: 0.7 }, { v: 'W', l: '서향', s: 0.6 }, { v: 'N', l: '북향', s: 0.3 },
      { v: 'none', l: '채광 없음', s: 0, risk: 'warn' },
    ],
  },
  {
    id: 'soundproof', section: 'room', label: '방음', type: 'single', tip: '벽을 두드려 보세요',
    options: [{ v: 'good', l: '정상', s: 1 }, { v: 'bad', l: '부실', s: 0.2 }],
  },
  {
    id: 'ventilation', section: 'room', label: '환기', type: 'single',
    options: [{ v: 'good', l: '가능', s: 1 }, { v: 'mid', l: '제한', s: 0.5 }, { v: 'bad', l: '불가', s: 0 }],
  },
  {
    id: 'humidity', section: 'room', label: '습도', type: 'single',
    options: [{ v: 'good', l: '쾌적함', s: 1 }, { v: 'bad', l: '습기 있음', s: 0.2 }],
  },
  {
    id: 'mold', section: 'room', label: '곰팡이', type: 'single', tip: '발견 시 사진 찍어두기',
    options: [
      { v: 'none', l: '없음', s: 1 }, { v: 'wall', l: '벽면', s: 0, risk: 'warn' },
      { v: 'window', l: '창틀', s: 0.3, risk: 'warn' },
    ],
  },
  { id: 'storage', section: 'room', label: '수납장', type: 'single', options: cond3('청결', '보통', '교체 필요') },
  { id: 'floorState', section: 'room', label: '바닥', type: 'single', options: cond3('청결', '보통', '교체 필요') },
  { id: 'wallpaper', section: 'room', label: '벽지', type: 'single', options: cond3('청결', '보통', '교체 필요') },
  {
    id: 'counter', section: 'room', label: '주방 상판', type: 'single',
    options: [{ v: 'good', l: '단단함', s: 1 }, { v: 'bad', l: '철판형', s: 0.5 }],
  },
  {
    id: 'hood', section: 'room', label: '후드', type: 'single',
    options: [{ v: 'new', l: '최신', s: 1 }, { v: 'old', l: '구형', s: 0.5 }, { v: 'none', l: '없음', s: 0 }],
  },

  // ───────── 4. 화장실 ─────────
  { id: 'bathSize', section: 'bath', label: '넓이', type: 'single', options: cond3('넓음', '보통', '좁음') },
  { id: 'bathWindow', section: 'bath', label: '창문', type: 'single', options: yesNo(0.4) },
  { id: 'bathVent', section: 'bath', label: '환기구', type: 'single', options: yesNo(0.2) },
  { id: 'waterproof', section: 'bath', label: '방수턱', type: 'single', options: yesNo(0.4) },
  {
    id: 'pressure', section: 'bath', label: '수압', type: 'single', tip: '세면대·변기 동시에 물 내려서 확인',
    options: [
      { v: 'good', l: '강함', s: 1 }, { v: 'mid', l: '보통', s: 0.6 },
      { v: 'bad', l: '약함', s: 0.1, risk: 'warn' },
    ],
  },
  {
    id: 'hotwater', section: 'bath', label: '보일러/온수', type: 'single',
    options: [
      { v: 'good', l: '온수 정상', s: 1 }, { v: 'slow', l: '시간 필요', s: 0.5 },
      { v: 'shared', l: '공용(특정 시간)', s: 0.3 }, { v: 'bad', l: '미흡', s: 0, risk: 'warn' },
    ],
  },

  // ───────── 5. 옵션 ─────────
  {
    id: 'appliances', section: 'options', label: '옵션', type: 'multi',
    options: [
      { v: 'washer', l: '세탁기' }, { v: 'aircon', l: '에어컨' }, { v: 'fridge', l: '냉장고' },
      { v: 'gas', l: '가스레인지' }, { v: 'induction', l: '인덕션' }, { v: 'microwave', l: '전자레인지' },
      { v: 'bed', l: '침대' }, { v: 'closet', l: '옷장' }, { v: 'desk', l: '책상' }, { v: 'etc', l: '기타' },
    ],
    scoreFn: (v) => ratio(v, 6),
  },
];

export const CONTRACT_CLAUSES: { id: string; text: string; deals?: DealType[] }[] = [
  { id: 'c1', text: '전세자금대출(HUG 버팀목) 및 보증보험 가입에 동의·협조한다.', deals: ['jeonse', 'semi'] },
  { id: 'c1m', text: '임차인의 보증보험 가입에 동의·협조한다.', deals: ['monthly'] },
  { id: 'c2', text: '임대인은 미납 국세·지방세 열람에 동의하며, 체납이 없음을 확인한다.' },
  { id: 'c3', text: '버팀목 대출이 불가할 경우 가계약금을 전액 환불한다.', deals: ['jeonse', 'semi'] },
  { id: 'c4', text: '잔금일 익일까지 선순위 권리를 제한한다. (추가 근저당 등 설정 금지)' },
  { id: 'c5', text: '임대차 계약 체결 후 등기부등본 변동 시 임차인은 계약을 해제할 수 있다.' },
];

export const itemsFor = (deal: DealType, section?: SectionId) =>
  ITEMS.filter((i) => (!i.deals || i.deals.includes(deal)) && (!section || i.section === section));

export const clausesFor = (deal: DealType) => CONTRACT_CLAUSES.filter((c) => !c.deals || c.deals.includes(deal));

export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
