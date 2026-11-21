import { ITEMS, SECTIONS, WEIGHTS, type Item, type Risk, type SectionId, itemsFor } from '../schema/checklist';
import type { AnswerValue, Property } from '../types';

export interface Flag {
  level: Risk;
  text: string;
}

export interface Metrics {
  jeonseRatio: number | null; // 전세가율 %
  debtRatio: number | null; // 부채비율 %
  hugOk: boolean | null; // HUG 90% 기준 충족 여부
  monthlyEquiv: number | null; // 환산월세 (만원)
}

export interface ScoreResult {
  total: number | null; // 0~100
  rawTotal: number | null; // 상한 적용 전
  sections: Record<SectionId, number | null>;
  answered: number;
  totalItems: number;
  flags: Flag[];
  capped: boolean;
  metrics: Metrics;
}

const num = (v: AnswerValue) => (typeof v === 'number' && !Number.isNaN(v) ? v : null);

/** 법정 전월세 전환율 = 기준금리 + 2%p (주택임대차보호법 시행령 제9조) */
export const conversionRate = (baseRate: number) => baseRate + 2;

export function computeMetrics(p: Property, baseRate: number): Metrics {
  const a = p.answers;
  const deposit = num(a.deposit) ?? 0;
  const rent = p.dealType === 'jeonse' ? 0 : num(a.rent) ?? 0;
  const fee = num(a.fee) ?? 0;
  const market = num(a.marketPrice);
  const lien = a.lien === 'yes' ? num(a.lienAmount) ?? 0 : 0;

  const hasPrice = num(a.deposit) != null || num(a.rent) != null;
  const monthlyEquiv = hasPrice ? rent + fee + (deposit * (conversionRate(baseRate) / 100)) / 12 : null;

  let jeonseRatio: number | null = null;
  let debtRatio: number | null = null;
  let hugOk: boolean | null = null;
  if (market && market > 0 && deposit > 0) {
    jeonseRatio = (deposit / market) * 100;
    debtRatio = ((deposit + lien) / market) * 100;
    hugOk = deposit + lien <= market * 0.9;
  }
  return { jeonseRatio, debtRatio, hugOk, monthlyEquiv };
}

function itemScore(item: Item, v: AnswerValue): number | null {
  if (v == null || v === '' || (Array.isArray(v) && v.length === 0 && item.type !== 'multi')) return null;
  if (item.scoreFn) return item.scoreFn(v);
  if (item.type === 'single' && item.options) {
    const o = item.options.find((x) => x.v === v);
    return o?.s ?? null;
  }
  return null;
}

function isAnswered(v: AnswerValue) {
  if (v == null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

const ratioScore = (r: number, steps: [number, number][]) => {
  for (const [limit, s] of steps) if (r <= limit) return s;
  return 0;
};

export function scoreProperty(p: Property, baseRate: number): ScoreResult {
  const a = p.answers;
  const metrics = computeMetrics(p, baseRate);
  const flags: Flag[] = [];
  const buckets: Record<SectionId, number[]> = { safety: [], location: [], room: [], bath: [], options: [] };

  const items = itemsFor(p.dealType).filter((i) => !i.showIf || i.showIf(a));
  let answered = 0;
  for (const item of items) {
    const v = a[item.id];
    if (isAnswered(v)) answered++;
    const s = itemScore(item, v);
    if (s != null) buckets[item.section].push(s);
    if (item.type === 'single' && item.options) {
      const o = item.options.find((x) => x.v === v);
      if (o?.risk) flags.push({ level: o.risk, text: `${item.label}: ${o.l}` });
    }
  }

  // 전세 안전 지표 (보증금 규모가 큰 전세/반전세에서 반영, 월세는 입력 시에만)
  let fatal = false;
  if (metrics.jeonseRatio != null) {
    buckets.safety.push(ratioScore(metrics.jeonseRatio, [[60, 1], [70, 0.8], [80, 0.4]]));
    if (metrics.jeonseRatio > 80) {
      flags.push({ level: 'danger', text: `전세가율 ${metrics.jeonseRatio.toFixed(0)}% (80% 초과, 깡통전세 우려)` });
      fatal = true;
    } else if (metrics.jeonseRatio > 70) {
      flags.push({ level: 'warn', text: `전세가율 ${metrics.jeonseRatio.toFixed(0)}% (70~80% 주의)` });
    }
  }
  if (metrics.debtRatio != null) {
    buckets.safety.push(ratioScore(metrics.debtRatio, [[70, 1], [80, 0.4]]));
    if (metrics.debtRatio > 80) {
      flags.push({ level: 'danger', text: `부채비율 ${metrics.debtRatio.toFixed(0)}% (80% 초과)` });
      fatal = true;
    } else if (metrics.debtRatio > 70) {
      flags.push({ level: 'warn', text: `부채비율 ${metrics.debtRatio.toFixed(0)}% (70~80% 주의)` });
    }
  }
  if (metrics.hugOk === false && p.dealType !== 'monthly') {
    flags.push({ level: 'warn', text: 'HUG 보증보험 기준(시세의 90%) 초과 가능성' });
  }
  if (a.violation === 'bad') fatal = true;

  const sections = {} as Record<SectionId, number | null>;
  const w = WEIGHTS[p.dealType];
  let sum = 0;
  let wsum = 0;
  for (const s of SECTIONS) {
    const arr = buckets[s.id];
    const val = arr.length ? (arr.reduce((x, y) => x + y, 0) / arr.length) * 100 : null;
    sections[s.id] = val;
    if (val != null) {
      sum += val * w[s.id];
      wsum += w[s.id];
    }
  }
  const rawTotal = wsum ? sum / wsum : null;
  const capped = fatal && rawTotal != null && rawTotal > 40;
  const total = rawTotal == null ? null : capped ? 40 : rawTotal;

  flags.sort((x, y) => (x.level === y.level ? 0 : x.level === 'danger' ? -1 : 1));
  return { total, rawTotal, sections, answered, totalItems: items.length, flags, capped, metrics };
}

/** 비교 화면용: 환산월세 낮을수록 100점 (최소-최대 정규화) */
export function costScores(values: (number | null)[]): (number | null)[] {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return values.map(() => null);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return values.map((v) => (v == null ? null : max === min ? 100 : ((max - v) / (max - min)) * 100));
}

export const scoreColor = (s: number | null) =>
  s == null ? 'bg-slate-200 text-slate-500' : s >= 75 ? 'bg-emerald-500 text-white' : s >= 50 ? 'bg-amber-400 text-white' : 'bg-rose-500 text-white';

export const sectionProgress = (p: Property, section: SectionId) => {
  const items = itemsFor(p.dealType, section).filter((i) => !i.showIf || i.showIf(p.answers));
  return { done: items.filter((i) => isAnswered(p.answers[i.id])).length, total: items.length };
};

export { ITEMS };
