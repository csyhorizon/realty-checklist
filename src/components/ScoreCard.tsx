import { SECTIONS, WEIGHTS } from '../schema/checklist';
import { conversionRate, effectiveRate, type ScoreResult } from '../lib/score';
import { formatManwon } from '../lib/format';
import { ScoreBadge } from './ui';
import type { DealType, Settings } from '../types';
import { Icon } from './Icon';

const ratioTone = (r: number | null, warn: number, danger: number) =>
  r == null ? 'text-slate-400' : r > danger ? 'text-rose-600' : r > warn ? 'text-amber-600' : 'text-emerald-600';

export function ScoreCard({ s, deal, settings }: { s: ScoreResult; deal: DealType; settings: Settings }) {
  const m = s.metrics;
  const rate = effectiveRate(settings);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ScoreBadge score={s.total} size="lg" />
        <div className="flex-1">
          <p className="font-bold text-lg">종합 점수</p>
          <p className="text-xs text-slate-500">
            입력 {s.answered}/{s.totalItems}개 · 섹션 가중합 방식
          </p>
          {s.capped && (
            <p className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
              <Icon name="dangerous" size={15} />
              <span>치명 위험으로 40점 상한 적용 (원점수 {Math.round(s.rawTotal!)})</span>
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {SECTIONS.map((sec) => {
          const v = s.sections[sec.id];
          return (
            <div key={sec.id} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 flex items-center gap-1.5">
                <Icon name={sec.icon} size={17} className="text-slate-500" />
                <span>{sec.label}</span>
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${v == null ? '' : v >= 75 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                  style={{ width: `${v ?? 0}%` }}
                />
              </div>
              <span className="w-8 text-right font-semibold">{v == null ? '–' : Math.round(v)}</span>
              <span className="w-9 text-right text-xs text-slate-400">{WEIGHTS[deal][sec.id]}%</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="text-[11px] text-slate-500">환산월세</p>
          <p className="font-bold">{m.monthlyEquiv == null ? '–' : `${formatManwon(m.monthlyEquiv)}`}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="text-[11px] text-slate-500">전세가율</p>
          <p className={`font-bold ${ratioTone(m.jeonseRatio, 80, 90)}`}>{m.jeonseRatio == null ? '–' : `${m.jeonseRatio.toFixed(0)}%`}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="text-[11px] text-slate-500">부채비율</p>
          <p className={`font-bold ${ratioTone(m.debtRatio, 80, 90)}`}>{m.debtRatio == null ? '–' : `${m.debtRatio.toFixed(0)}%`}</p>
        </div>
      </div>
      {m.hug126Limit != null && (
        <div className={`rounded-xl px-3 py-2 text-xs flex items-center justify-between ${m.hug126Ok === false ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          <span>HUG 공시가 126% 한도</span>
          <span className="font-bold">
            {formatManwon(m.hug126Limit)} ({m.hug126Ok === false ? '초과' : '이내'})
          </span>
        </div>
      )}
      <p className="text-[11px] text-slate-400 leading-relaxed">
        환산월세 = 월세 + 관리비 + 보증금 × {rate.toFixed(2)}% ÷ 12 (
        {settings.rateMode === 'loan'
          ? `내 예상 대출금리 ${rate.toFixed(2)}%`
          : `법정 전환율: 기준금리 ${settings.baseRate}% + 2%p = ${conversionRate(settings.baseRate).toFixed(2)}%`}
        ). 전세가율·부채비율은 매매 시세 입력 시 계산됩니다.
      </p>

      {s.flags.length > 0 && (
        <ul className="space-y-1.5">
          {s.flags.map((f, i) => (
            <li
              key={i}
              className={`text-sm px-3 py-2 rounded-lg flex items-start gap-1.5 ${f.level === 'danger' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}
            >
              <Icon name={f.level === 'danger' ? 'dangerous' : 'warning'} size={17} className="mt-0.5" />
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
