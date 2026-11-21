import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProperty } from '../db/db';
import { TopBar } from '../components/ui';
import type { DealType } from '../types';

const DEALS: { v: DealType; title: string; desc: string; icon: string }[] = [
  { v: 'monthly', title: '월세', desc: '보증금 + 월세 · 생활 편의 중심 점수', icon: '🗓️' },
  { v: 'jeonse', title: '전세', desc: '보증금만 · 전세가율·권리 등 안전 중심 점수', icon: '🛡️' },
  { v: 'semi', title: '반전세', desc: '높은 보증금 + 월세 · 안전과 편의 균형', icon: '⚖️' },
];

export default function NewPage() {
  const nav = useNavigate();
  const [deal, setDeal] = useState<DealType | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!deal) return;
    setBusy(true);
    const id = await createProperty(deal, name);
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
                <span className="text-3xl">{d.icon}</span>
                <span className="flex-1">
                  <span className="block text-lg font-bold">{d.title}</span>
                  <span className="block text-sm text-slate-500">{d.desc}</span>
                </span>
                <span className={`w-6 h-6 rounded-full border-2 ${deal === d.v ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`} />
              </button>
            ))}
          </div>
        </div>

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
