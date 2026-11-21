import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ITEMS, SECTIONS, itemsFor, type Item } from '../schema/checklist';
import { costScores, scoreProperty, type ScoreResult } from '../lib/score';
import { useSettings } from '../lib/hooks';
import { formatManwon } from '../lib/format';
import { BottomNav, DealBadge, ScoreBadge, TopBar } from '../components/ui';
import { CoverImage } from '../components/PhotoBox';
import { openNaverMap } from '../lib/geo';
import type { AnswerValue, Property } from '../types';

interface Row {
  key: string;
  label: string;
  group: string;
  cells: string[];
  scores: (number | null)[]; // 높을수록 좋음 (하이라이트용)
}

function answerText(item: Item, v: AnswerValue): string {
  if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return '–';
  if (item.type === 'number') return item.unit === '만원' ? formatManwon(v as number) : `${v}${item.unit ?? ''}`;
  if (item.type === 'single') return item.options?.find((o) => o.v === v)?.l ?? String(v);
  if (item.type === 'multi') return (v as string[]).map((x) => item.options?.find((o) => o.v === x)?.l ?? x).join(', ');
  return String(v);
}

function itemCellScore(item: Item, v: AnswerValue): number | null {
  if (item.scoreFn) return item.scoreFn(v);
  if (item.type === 'single') return item.options?.find((o) => o.v === v)?.s ?? null;
  return null;
}

function buildRows(list: { p: Property; s: ScoreResult }[], cost: (number | null)[]): Row[] {
  const rows: Row[] = [];
  const pct = (n: number | null) => (n == null ? '–' : `${n.toFixed(0)}%`);
  rows.push({ key: 'total', group: '점수', label: '종합 점수', cells: list.map(({ s }) => (s.total == null ? '–' : String(Math.round(s.total)))), scores: list.map(({ s }) => s.total) });
  rows.push({ key: 'cost', group: '점수', label: '비용 점수', cells: cost.map((c) => (c == null ? '–' : String(Math.round(c)))), scores: cost });
  rows.push({ key: 'rating', group: '점수', label: '내 별점', cells: list.map(({ p }) => (p.rating ? '★'.repeat(p.rating) : '–')), scores: list.map(({ p }) => p.rating ?? null) });
  for (const sec of SECTIONS) {
    rows.push({
      key: `sec_${sec.id}`,
      group: '점수',
      label: `${sec.icon} ${sec.label}`,
      cells: list.map(({ s }) => (s.sections[sec.id] == null ? '–' : String(Math.round(s.sections[sec.id]!)))),
      scores: list.map(({ s }) => s.sections[sec.id]),
    });
  }
  rows.push({
    key: 'flags',
    group: '점수',
    label: '위험/주의',
    cells: list.map(({ s }) => {
      const d = s.flags.filter((f) => f.level === 'danger').length;
      const w = s.flags.filter((f) => f.level === 'warn').length;
      return d + w === 0 ? '없음' : `${d ? `⛔${d} ` : ''}${w ? `⚠️${w}` : ''}`;
    }),
    scores: list.map(({ s }) => -(s.flags.filter((f) => f.level === 'danger').length * 10 + s.flags.length)),
  });

  const em = list.map(({ s }) => s.metrics.monthlyEquiv);
  rows.push({ key: 'equiv', group: '비용·안전', label: '환산월세', cells: em.map((v) => (v == null ? '–' : `${formatManwon(v)}`)), scores: em.map((v) => (v == null ? null : -v)) });
  const jr = list.map(({ s }) => s.metrics.jeonseRatio);
  rows.push({ key: 'jr', group: '비용·안전', label: '전세가율', cells: jr.map(pct), scores: jr.map((v) => (v == null ? null : -v)) });
  const dr = list.map(({ s }) => s.metrics.debtRatio);
  rows.push({ key: 'dr', group: '비용·안전', label: '부채비율', cells: dr.map(pct), scores: dr.map((v) => (v == null ? null : -v)) });

  const lowerBetter = new Set(['deposit', 'rent', 'fee', 'lienAmount']);
  const higherBetter = new Set(['area']);
  for (const sec of SECTIONS) {
    const ids = new Set(list.flatMap(({ p }) => itemsFor(p.dealType, sec.id).map((i) => i.id)));
    for (const item of ITEMS.filter((i) => ids.has(i.id))) {
      const vals = list.map(({ p }) => p.answers[item.id]);
      rows.push({
        key: item.id,
        group: `${sec.icon} ${sec.label}`,
        label: item.label,
        cells: vals.map((v) => answerText(item, v)),
        scores: vals.map((v) =>
          typeof v === 'number' && lowerBetter.has(item.id)
            ? -v
            : typeof v === 'number' && higherBetter.has(item.id)
              ? v
              : itemCellScore(item, v),
        ),
      });
    }
  }
  return rows;
}

function Picker() {
  const nav = useNavigate();
  const props = useLiveQuery(() => db.properties.orderBy('createdAt').reverse().toArray(), []);
  const [sel, setSel] = useState<string[]>([]);
  if (!props) return null;
  return (
    <div className="max-w-xl mx-auto px-4 pt-4 space-y-3">
      <p className="text-sm text-slate-500">비교할 매물을 2~4개 선택하세요.</p>
      {props.length < 2 && (
        <p className="text-center py-10 text-slate-500">
          비교하려면 매물이 2개 이상 필요해요. <Link to="/new" className="text-blue-600 underline">매물 추가</Link>
        </p>
      )}
      {props.map((p) => {
        const on = sel.includes(p.id);
        return (
          <button
            key={p.id}
            onClick={() => setSel(on ? sel.filter((x) => x !== p.id) : sel.length >= 4 ? sel : [...sel, p.id])}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl bg-white border text-left ${on ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-100'}`}
          >
            <CoverImage photoId={p.coverPhotoId} className="w-12 h-12 rounded-lg shrink-0" />
            <span className="flex-1 min-w-0">
              <DealBadge deal={p.dealType} />
              <span className="block font-semibold truncate mt-0.5">{p.nickname}</span>
            </span>
            <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
              {on ? sel.indexOf(p.id) + 1 : ''}
            </span>
          </button>
        );
      })}
      <div className="fixed bottom-20 inset-x-0 px-4 z-30 pb-[env(safe-area-inset-bottom)]">
        <button
          disabled={sel.length < 2}
          onClick={() => nav(`/compare?ids=${sel.join(',')}`)}
          className="w-full max-w-xl mx-auto block py-3.5 rounded-2xl bg-blue-600 text-white font-bold shadow-lg disabled:bg-slate-300"
        >
          {sel.length < 2 ? '2개 이상 선택' : `${sel.length}개 비교하기`}
        </button>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [params] = useSearchParams();
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const settings = useSettings();
  const props = useLiveQuery(
    async (): Promise<(Property | undefined)[]> => (ids.length ? db.properties.bulkGet(ids) : []),
    [ids.join(',')],
  );
  const [diffOnly, setDiffOnly] = useState(false);

  const data = useMemo(() => {
    const list = (props ?? []).filter((p): p is Property => !!p).map((p) => ({ p, s: scoreProperty(p, settings.baseRate) }));
    const cost = costScores(list.map(({ s }) => s.metrics.monthlyEquiv));
    return { list, rows: buildRows(list, cost) };
  }, [props, settings.baseRate]);

  if (ids.length < 2) {
    return (
      <div className="pb-40">
        <TopBar title="⚖️ 비교" />
        <Picker />
        <BottomNav active="compare" />
      </div>
    );
  }

  const { list, rows } = data;
  const shown = diffOnly ? rows.filter((r) => new Set(r.cells).size > 1) : rows;
  const colW = list.length <= 2 ? 'min-w-[140px]' : 'min-w-[118px]';
  let lastGroup = '';

  return (
    <div className="pb-24">
      <TopBar
        back
        title="⚖️ 매물 비교"
        right={
          <label className="flex items-center gap-1.5 text-sm pr-2">
            <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} className="w-5 h-5" />
            차이만
          </label>
        }
      />
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 text-sm w-max min-w-full">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 w-24 min-w-24" />
              {list.map(({ p, s }) => (
                <th key={p.id} className={`${colW} p-2 align-top font-normal`}>
                  <Link to={`/p/${p.id}`} className="block">
                    <CoverImage photoId={p.coverPhotoId} className="w-full h-20 rounded-xl" />
                    <div className="flex items-center justify-between mt-2 gap-1">
                      <DealBadge deal={p.dealType} />
                      <ScoreBadge score={s.total} size="sm" />
                    </div>
                    <p className="font-bold text-left truncate mt-1">{p.nickname}</p>
                  </Link>
                  {p.location && (
                    <button onClick={() => openNaverMap(p.location!.lat, p.location!.lng, p.nickname)} className="mt-1 w-full text-xs py-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                      📍 지도
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const valid = r.scores.filter((x): x is number => x != null);
              const best = valid.length > 1 && new Set(valid).size > 1 ? Math.max(...valid) : null;
              const worst = best != null ? Math.min(...valid) : null;
              const header = r.group !== lastGroup;
              lastGroup = r.group;
              return [
                header && (
                  <tr key={`g_${r.group}`}>
                    <td colSpan={list.length + 1} className="sticky left-0 bg-slate-200/70 px-3 py-1.5 font-bold text-slate-700 text-xs">
                      {r.group}
                    </td>
                  </tr>
                ),
                <tr key={r.key}>
                  <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 border-b border-slate-200 text-slate-600 font-medium">{r.label}</td>
                  {r.cells.map((c, i) => {
                    const sc = r.scores[i];
                    const tone =
                      best != null && sc === best ? 'bg-emerald-50 text-emerald-800 font-bold' : worst != null && sc === worst ? 'text-slate-400' : '';
                    return (
                      <td key={i} className={`px-2 py-2.5 border-b border-slate-200 text-center ${tone}`}>
                        {c}
                      </td>
                    );
                  })}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="max-w-xl mx-auto px-4 mt-3 text-xs text-slate-400">
        초록색 = 해당 항목 최상. 비용 점수는 선택한 매물끼리 환산월세를 비교(최저 100점 · 최고 0점)한 값입니다.
      </p>
      <BottomNav active="compare" />
    </div>
  );
}
