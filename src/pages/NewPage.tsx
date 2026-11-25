import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { createProperty, recentAgencies } from '../db/db';
import { TopBar } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import type { DealType } from '../types';

const DEALS: { v: DealType; title: string; desc: string; icon: IconName }[] = [
  { v: 'monthly', title: '월세', desc: '보증금 + 월세 · 생활 편의 중심 점수', icon: 'calendar_month' },
  { v: 'jeonse', title: '전세', desc: '보증금만 · 전세가율·권리 등 안전 중심 점수', icon: 'verified_user' },
  { v: 'semi', title: '반전세', desc: '높은 보증금 + 월세 · 안전과 편의 균형', icon: 'balance' },
];

export default function NewPage() {
  const nav = useNavigate();
  const [deal, setDeal] = useState<DealType | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const last = useLiveQuery(async () => (await recentAgencies(1))[0] ?? null, []);
  const [useLast, setUseLast] = useState<boolean | null>(null);
  // 기본값: 마지막 중개소 등록이 12시간 이내면 켜두기 (같은 날 여러 집 도는 경우)
  const reuse = useLast ?? (!!last && Date.now() - last.at < 12 * 3600 * 1000);

  const create = async () => {
    if (!deal) return;
    setBusy(true);
    const extra = reuse && last ? { agencyName: last.name, agencyPhone: last.phone } : {};
    const id = await createProperty(deal, name, extra);
    nav(`/p/${id}`, { replace: true });
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar title="새 매물" back />
      <div className="flex-1 max-w-xl w-full mx-auto px-4 py-5 space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-1">어떤 거래인가요?</h2>
          <p className="text-sm text-slate-500 mb-4">거래유형에 맞춰 체크 항목과 점수 기준이 달라져요.</p>
          <div className="space-y-3">
            {DEALS.map((d) => (
              <button
                key={d.v}
                onClick={() => setDeal(d.v)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition ${
                  deal === d.v ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
                }`}
              >
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${deal === d.v ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                  <Icon name={d.icon} size={24} />
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold">{d.title}</span>
                  <span className="block text-sm text-slate-500">{d.desc}</span>
                </span>
                <span className={`w-6 h-6 rounded-full border-2 ${deal === d.v ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`} />
              </button>
            ))}
          </div>
        </div>

        {last && (
          <button
            type="button"
            onClick={() => setUseLast(!reuse)}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition ${
              reuse ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
            }`}
          >
            <span className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center text-white text-sm ${reuse ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
              {reuse && <Icon name="check" size={16} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold">직전 중개소 그대로 쓰기</span>
              <span className="block text-sm text-slate-500 truncate">
                {last.name || '이름 없음'} · {last.phone || '번호 없음'}
              </span>
            </span>
          </button>
        )}

        <div>
          <label className="block font-semibold mb-2">매물 별칭 (선택)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 역삼동 투룸 3층"
            className="w-full min-h-12 px-3 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-slate-100 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <button
          disabled={!deal || busy}
          onClick={create}
          className="w-full max-w-xl mx-auto block py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg disabled:bg-slate-300"
        >
          체크 시작하기
        </button>
      </div>
    </div>
  );
}
