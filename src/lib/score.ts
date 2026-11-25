import { ITEMS, SECTIONS, WEIGHTS, type Item, type Risk, type SectionId, itemsFor } from '../schema/checklist';
import { formatManwon } from './format';
import type { AnswerValue, Property, Settings } from '../types';

export interface Flag {
  level: Risk;
  text: string;
}

export interface Metrics {
  jeonseRatio: number | null; // 전세가율 %
  debtRatio: number | null; // 부채비율 %
  hugOk: boolean | null; // 시세 기준 HUG 90% 충족 여부
  hug126Limit: number | null; // 공시가격 × 126% 한도 (만원)
  hug126Ok: boolean | null; // 공시가 126% 한도 충족 여부
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

/** 설정에 따른 실제 월세 환산 이율 (%) */
export const effectiveRate = (s: Pick<Settings, 'baseRate' | 'rateMode' | 'loanRate'>) =>
  s.rateMode === 'loan' ? (s.loanRate ?? 2.5) : conversionRate(s.baseRate);

export function computeMetrics(p: Property, ratePct: number): Metrics {
  const a = p.answers;
  const deposit = num(a.deposit) ?? 0;
  const rent = p.dealType === 'jeonse' ? 0 : num(a.rent) ?? 0;
  const fee = num(a.fee) ?? 0;
  const market = num(a.marketPrice);
  const official = num(a.officialPrice);
  const lien = a.lien === 'yes' ? num(a.lienAmount) ?? 0 : 0;

  const hasPrice = num(a.deposit) != null || num(a.rent) != null;
  const monthlyEquiv = hasPrice ? rent + fee + (deposit * (ratePct / 100)) / 12 : null;

  let jeonseRatio: number | null = null;
  let debtRatio: number | null = null;
  let hugOk: boolean | null = null;
  if (market && market > 0 && deposit > 0) {
    jeonseRatio = (deposit / market) * 100;
    debtRatio = ((deposit + lien) / market) * 100;
    hugOk = deposit + lien <= market * 0.9;
  }

  const hug126Limit = official && official > 0 ? official * 1.26 : null;
  const hug126Ok = hug126Limit != null && deposit > 0 ? deposit + lien <= hug126Limit : null;

  return { jeonseRatio, debtRatio, hugOk, hug126Limit, hug126Ok, monthlyEquiv };
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

export function scoreProperty(p: Property, ratePct: number): ScoreResult {
  const a = p.answers;
  const metrics = computeMetrics(p, ratePct);
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
    } else if (item.type === 'multi' && item.options) {
      const vals = Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [];
      const risky = item.options.filter((x) => vals.includes(x.v) && x.risk);
      if (risky.length > 0) {
        const level: Risk = risky.some((x) => x.risk === 'danger') ? 'danger' : 'warn';
        flags.push({ level, text: `${item.label}: ${risky.map((x) => x.l).join(', ')}` });
      }
    }
  }

  // 전세·반전세 안전 지표 (현실적인 HUG 90% 기준 반영)
  let fatal = false;
  if (p.dealType !== 'monthly') {
    if (metrics.jeonseRatio != null) {
      buckets.safety.push(ratioScore(metrics.jeonseRatio, [[70, 1], [80, 0.85], [90, 0.55]]));
      if (metrics.jeonseRatio > 90) {
        flags.push({ level: 'danger', text: `전세가율 ${metrics.jeonseRatio.toFixed(0)}% (90% 초과, HUG 보증보험 불가 우려)` });
        fatal = true;
      } else if (metrics.jeonseRatio > 80) {
        flags.push({ level: 'warn', text: `전세가율 ${metrics.jeonseRatio.toFixed(0)}% (80~90%, HUG 한도 이내 유의)` });
      }
    }
    if (metrics.debtRatio != null) {
      buckets.safety.push(ratioScore(metrics.debtRatio, [[70, 1], [80, 0.85], [90, 0.55]]));
      if (metrics.debtRatio > 90) {
        flags.push({ level: 'danger', text: `부채비율 ${metrics.debtRatio.toFixed(0)}% (90% 초과, HUG 보증보험 불가)` });
        fatal = true;
      } else if (metrics.debtRatio > 80) {
        flags.push({ level: 'warn', text: `부채비율 ${metrics.debtRatio.toFixed(0)}% (80~90%, HUG 한도 이내 유의)` });
      }
    }
    if (metrics.hug126Limit != null && metrics.hug126Ok != null) {
      const deposit = num(a.deposit) ?? 0;
      const lien = a.lien === 'yes' ? num(a.lienAmount) ?? 0 : 0;
      if (metrics.hug126Ok) {
        buckets.safety.push(deposit + lien <= metrics.hug126Limit * 0.85 ? 1 : 0.75);
      } else if (a.buildingType !== 'apt') {
        const msg = `공시가 126% 한도(${formatManwon(metrics.hug126Limit)}) 초과`;
        if (!num(a.marketPrice)) {
          flags.push({ level: 'danger', text: `${msg} — HUG 보증보험 불가 우려` });
          fatal = true;
          buckets.safety.push(0);
        } else {
          flags.push({ level: 'warn', text: `${msg} — HUG 심사 기준 확인 필요` });
          buckets.safety.push(0.3);
        }
      }
    }
  }
  if (a.violation === 'bad' || a.residentReg === 'no') fatal = true;

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
