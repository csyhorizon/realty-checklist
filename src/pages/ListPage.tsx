import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, updateProperty } from '../db/db';
import { scoreProperty } from '../lib/score';
import { useSettings } from '../lib/hooks';
import { displayName, formatDate, priceSummary, formatManwon } from '../lib/format';
import { BottomNav, DealBadge, ScoreBadge, TopBar } from '../components/ui';
import { CoverImage } from '../components/PhotoBox';
import { Icon } from '../components/Icon';
import { STATUS_LABEL, type DealType, type Status } from '../types';

type Sort = 'recent' | 'score' | 'cost';

export default function ListPage() {
  const nav = useNavigate();
  const settings = useSettings();
  const props = useLiveQuery(() => db.properties.toArray(), []);
  const [sort, setSort] = useState<Sort>('recent');
  const [deal, setDeal] = useState<DealType | 'all'>('all');
  const [hideRejected, setHideRejected] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const rows = useMemo(() => {
    if (!props) return [];
    const list = props
      .filter((p) => deal === 'all' || p.dealType === deal)
      .filter((p) => !hideRejected || p.status !== 'rejected')
      .map((p) => ({ p, s: scoreProperty(p, settings.baseRate) }));
    list.sort((a, b) => {
      if (a.p.favorite !== b.p.favorite) return a.p.favorite ? -1 : 1;
      if (sort === 'score') return (b.s.total ?? -1) - (a.s.total ?? -1);
      if (sort === 'cost') return (a.s.metrics.monthlyEquiv ?? Infinity) - (b.s.metrics.monthlyEquiv ?? Infinity);
      return b.p.createdAt - a.p.createdAt;
    });
    return list;
  }, [props, sort, deal, hideRejected, settings.baseRate]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));

  return (
    <div className="pb-36">
      <TopBar
        title={
          <span className="flex items-center gap-2">
            <Icon name="home_work" size={22} className="text-blue-600" />
            <span>집보기 체크리스트</span>
          </span>
        }
        right={
          props && props.length > 1 ? (
            <button
              onClick={() => {
                setSelecting(!selecting);
                setSelected([]);
              }}
              className="px-3 h-9 rounded-lg text-sm font-semibold text-blue-600"
            >
              {selecting ? '취소' : '비교 선택'}
            </button>
          ) : null
        }
      />

      <div className="max-w-xl mx-auto px-4 pt-3 space-y-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {(['all', 'monthly', 'jeonse', 'semi'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDeal(d)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm border ${deal === d ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}
            >
              {{ all: '전체', monthly: '월세', jeonse: '전세', semi: '반전세' }[d]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm">
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 px-2 rounded-lg border border-slate-200 bg-white text-base">
            <option value="recent">최신순</option>
            <option value="score">점수순</option>
            <option value="cost">환산월세 낮은순</option>
          </select>
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" checked={hideRejected} onChange={(e) => setHideRejected(e.target.checked)} className="w-5 h-5" />
            탈락 숨기기
          </label>
        </div>

        {props && props.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <Icon name="home_work" size={56} className="text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">아직 등록된 매물이 없어요</p>
            <p className="text-sm mt-1">아래 + 버튼으로 첫 매물을 추가하세요</p>
          </div>
        )}

        <ul className="space-y-3">
          {rows.map(({ p, s }) => {
            const sel = selected.includes(p.id);
            const danger = s.flags.some((f) => f.level === 'danger');
            const warns = s.flags.filter((f) => f.level === 'warn').length;
            return (
              <li key={p.id}>
                <div
                  onClick={() => (selecting ? toggle(p.id) : nav(`/p/${p.id}`))}
                  className={`flex gap-3 p-3 rounded-2xl bg-white border shadow-sm cursor-pointer active:bg-slate-50 ${
                    sel ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-100'
                  } ${p.status === 'rejected' ? 'opacity-50' : ''}`}
                >
                  <CoverImage photoId={p.coverPhotoId} className="w-20 h-20 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <DealBadge deal={p.dealType} />
                      {p.status !== 'reviewing' && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{STATUS_LABEL[p.status as Status]}</span>}
                      {p.location && <Icon name="location_on" size={15} filled className="text-emerald-600" />}
                    </div>
                    <p className="font-bold truncate mt-1">{displayName(p)}</p>
                    <p className="text-sm text-slate-600 truncate">{priceSummary(p.dealType, p.answers.deposit, p.answers.rent)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(p.createdAt)}
                      {s.metrics.monthlyEquiv != null && ` · 환산 ${formatManwon(s.metrics.monthlyEquiv)}/월`}
                    </p>
                    {(danger || warns > 0) && (
                      <p className="text-xs mt-1 flex items-center gap-2">
                        {danger && (
                          <span className="text-rose-600 font-semibold inline-flex items-center gap-0.5">
                            <Icon name="dangerous" size={14} />
                            <span>계약 비권장</span>
                          </span>
                        )}
                        {warns > 0 && (
                          <span className="text-amber-600 inline-flex items-center gap-0.5">
                            <Icon name="warning" size={14} />
                            <span>주의 {warns}</span>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-center justify-between">
                    {selecting ? (
                      <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                        {sel ? selected.indexOf(p.id) + 1 : ''}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateProperty(p.id, { favorite: !p.favorite });
                        }}
                        className="w-9 h-9 flex items-center justify-center"
                        aria-label="즐겨찾기"
                      >
                        <Icon name="star" size={22} filled={p.favorite} className={p.favorite ? 'text-amber-400' : 'text-slate-300'} />
                      </button>
                    )}
                    <ScoreBadge score={s.total} size="sm" />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {selecting ? (
        <div className="fixed bottom-20 inset-x-0 z-30 px-4 pb-[env(safe-area-inset-bottom)]">
          <button
            disabled={selected.length < 2}
            onClick={() => nav(`/compare?ids=${selected.join(',')}`)}
            className="w-full max-w-xl mx-auto block h-13 py-3.5 rounded-2xl bg-blue-600 text-white font-bold shadow-lg disabled:bg-slate-300"
          >
            {selected.length < 2 ? '2~4개 매물을 선택하세요' : `${selected.length}개 비교하기`}
          </button>
        </div>
      ) : (
        <Link
          to="/new"
          className="fixed z-30 right-5 bottom-[calc(env(safe-area-inset-bottom)+88px)] w-[60px] h-[60px] rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl active:scale-95 transition"
          aria-label="새 매물"
        >
          <Icon name="add" size={28} />
        </Link>
      )}
      <BottomNav active="list" />
    </div>
  );
}
