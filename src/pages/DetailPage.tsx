import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteProperty, recentAgencies, setAnswer, updateProperty } from '../db/db';
import { displayName } from '../lib/format';
import { SECTIONS, clausesFor, itemsFor, type SectionId } from '../schema/checklist';
import { scoreProperty, sectionProgress } from '../lib/score';
import { useSettings } from '../lib/hooks';
import { Card, DealBadge, ItemField, ScoreBadge, Segment, TextField, TopBar } from '../components/ui';
import { LocationBox } from '../components/LocationBox';
import { PhotoBox } from '../components/PhotoBox';
import { ScoreCard } from '../components/ScoreCard';
import { Icon, type IconName } from '../components/Icon';
import { DEAL_LABEL, STATUS_LABEL, type DealType, type Property, type Status } from '../types';

type Tab = 'basic' | SectionId | 'contract' | 'photos' | 'summary';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'basic', label: '기본', icon: 'info' },
  ...SECTIONS.map((s) => ({ id: s.id as Tab, label: s.label, icon: s.icon })),
  { id: 'contract', label: '특약', icon: 'description' },
  { id: 'photos', label: '사진', icon: 'photo_camera' },
  { id: 'summary', label: '종합', icon: 'trophy' },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      {children}
    </div>
  );
}

function AgencySuggestions({ p }: { p: Property }) {
  const list = useLiveQuery(() => recentAgencies(6), []) ?? [];
  const others = list.filter((a) => a.name !== (p.agencyName ?? '').trim() || a.phone !== (p.agencyPhone ?? '').trim());
  if (others.length === 0) return null;
  return (
    <div className="pt-1 pb-3">
      <p className="text-xs text-slate-500 mb-2">최근 중개소 불러오기</p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {others.map((a) => (
          <button
            key={`${a.name}|${a.phone}`}
            onClick={() => updateProperty(p.id, { agencyName: a.name, agencyPhone: a.phone })}
            className="shrink-0 text-left px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 active:bg-slate-100"
          >
            <span className="block text-sm font-semibold">{a.name || '이름 없음'}</span>
            <span className="block text-xs text-slate-500">{a.phone || '번호 없음'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BasicTab({ p }: { p: Property }) {
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-bold mb-3 flex items-center gap-1.5">
          <Icon name="location_on" size={19} className="text-blue-600" />
          <span>위치</span>
        </h3>
        <LocationBox p={p} />
      </Card>
      <Card>
        <Field label="매물 별칭">
          <TextField
            value={p.nickname}
            placeholder={p.address?.trim() || '예) 역삼동 투룸 3층 (비우면 주소로 표시)'}
            onChange={(v) => updateProperty(p.id, { nickname: v })}
          />
        </Field>
        <Field label="거래유형">
          <Segment
            options={(['monthly', 'jeonse', 'semi'] as DealType[]).map((d) => ({ v: d, l: DEAL_LABEL[d] }))}
            value={p.dealType}
            onChange={(v) => v && updateProperty(p.id, { dealType: v as DealType })}
          />
        </Field>
      </Card>
      <Card>
        <h3 className="font-bold mb-1 flex items-center gap-1.5">
          <Icon name="apartment" size={19} className="text-blue-600" />
          <span>중개소 · 일정</span>
        </h3>
        <AgencySuggestions p={p} />
        <Field label="중개사무소">
          <TextField value={p.agencyName} placeholder="○○공인중개사" onChange={(v) => updateProperty(p.id, { agencyName: v })} />
        </Field>
        <Field label="중개사 연락처">
          <div className="flex gap-2">
            <div className="flex-1">
              <TextField type="tel" value={p.agencyPhone} placeholder="010-0000-0000" onChange={(v) => updateProperty(p.id, { agencyPhone: v })} />
            </div>
            {p.agencyPhone && (
              <a href={`tel:${p.agencyPhone}`} className="min-h-11 px-4 rounded-xl bg-emerald-500 text-white flex items-center justify-center" aria-label="전화 걸기">
                <Icon name="call" size={20} />
              </a>
            )}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="방문일">
            <TextField type="date" value={p.visitedAt} onChange={(v) => updateProperty(p.id, { visitedAt: v })} />
          </Field>
          <Field label="입주 가능일">
            <TextField type="date" value={p.moveInDate} onChange={(v) => updateProperty(p.id, { moveInDate: v })} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

function SectionTab({ p, section }: { p: Property; section: SectionId }) {
  const items = itemsFor(p.dealType, section).filter((i) => !i.showIf || i.showIf(p.answers));
  return (
    <Card>
      {items.map((item) => (
        <ItemField key={item.id} item={item} value={p.answers[item.id]} onChange={(v) => setAnswer(p, item.id, v)} />
      ))}
      <div className="pt-3">
        <p className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
          <Icon name="chat_bubble" size={17} className="text-slate-500" />
          <span>메모</span>
        </p>
        <TextField
          multiline
          value={(p.answers[`note_${section}`] as string) ?? ''}
          placeholder="이 섹션에서 기억할 점"
          onChange={(v) => setAnswer(p, `note_${section}`, v)}
        />
      </div>
    </Card>
  );
}

function ContractTab({ p }: { p: Property }) {
  const clauses = clausesFor(p.dealType);
  const checked = Array.isArray(p.answers.contract) ? (p.answers.contract as string[]) : [];
  const missing = clauses.filter((c) => !checked.includes(c.id)).length;
  const copyAll = async () => {
    const text = clauses.map((c, i) => `${i + 1}. ${c.text}`).join('\n');
    await navigator.clipboard.writeText(text);
    alert('특약 문구를 복사했어요.');
  };
  return (
    <div className="space-y-3">
      <div className={`rounded-2xl p-4 ${missing ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
        <p className="font-bold flex items-center gap-1.5">
          <Icon name={missing ? 'dangerous' : 'check_circle'} size={20} />
          <span>{missing ? `미확인 특약 ${missing}개` : '모든 특약 확인 완료'}</span>
        </p>
        <p className="text-sm mt-1">최소한의 전세사기 방지 특약입니다. 넣을 수 없다면 계약하지 마세요.</p>
      </div>
      <Card>
        {clauses.map((c) => {
          const on = checked.includes(c.id);
          return (
            <label key={c.id} className="flex gap-3 py-3 border-b border-slate-100 last:border-0 cursor-pointer">
              <input
                type="checkbox"
                checked={on}
                onChange={() => setAnswer(p, 'contract', on ? checked.filter((x) => x !== c.id) : [...checked, c.id])}
                className="w-6 h-6 mt-0.5 shrink-0 accent-blue-600"
              />
              <span className={`text-[15px] ${on ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{c.text}</span>
            </label>
          );
        })}
      </Card>
      <button onClick={copyAll} className="w-full min-h-12 rounded-xl border border-slate-200 bg-white font-semibold flex items-center justify-center gap-1.5">
        <Icon name="content_copy" size={18} />
        <span>특약 문구 전체 복사</span>
      </button>
      <p className="text-xs text-slate-400">※ 참고용 문구이며 법적 효력을 보장하지 않습니다. 중개사·전문가와 확인하세요.</p>
    </div>
  );
}

function SummaryTab({ p, baseRate }: { p: Property; baseRate: number }) {
  const nav = useNavigate();
  const s = scoreProperty(p, baseRate);
  return (
    <div className="space-y-4">
      <Card>
        <ScoreCard s={s} deal={p.dealType} baseRate={baseRate} />
      </Card>
      <Card>
        <Field label="내 별점">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => updateProperty(p.id, { rating: p.rating === n ? undefined : n })} className="w-11 h-11 flex items-center justify-center" aria-label={`${n}점`}>
                <Icon name="star" size={30} filled={(p.rating ?? 0) >= n} className={(p.rating ?? 0) >= n ? 'text-amber-400' : 'text-slate-300'} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="상태">
          <Segment
            options={(Object.keys(STATUS_LABEL) as Status[]).map((k) => ({ v: k, l: STATUS_LABEL[k] }))}
            value={p.status}
            onChange={(v) => v && updateProperty(p.id, { status: v as Status })}
          />
        </Field>
        <Field label="종합 메모">
          <TextField multiline value={p.memo} placeholder="장점, 단점, 협상 포인트 등" onChange={(v) => updateProperty(p.id, { memo: v })} />
        </Field>
      </Card>
      <button
        onClick={async () => {
          if (!confirm(`"${displayName(p)}" 매물과 사진을 모두 삭제할까요?`)) return;
          await deleteProperty(p.id);
          nav('/', { replace: true });
        }}
        className="w-full min-h-12 rounded-xl text-rose-600 border border-rose-200 bg-white font-semibold"
      >
        매물 삭제
      </button>
    </div>
  );
}

export default function DetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'basic';
  const settings = useSettings();
  const p = useLiveQuery(() => db.properties.get(id!), [id]);
  const photoCount = useLiveQuery(() => db.photos.where('propertyId').equals(id!).count(), [id]) ?? 0;
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${tab}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    window.scrollTo({ top: 0 });
  }, [tab]);

  if (p === undefined) return null;
  if (p === null || !p) return <div className="p-8 text-center">매물을 찾을 수 없어요.</div>;

  const s = scoreProperty(p, settings.baseRate);
  const idx = TABS.findIndex((t) => t.id === tab);
  const go = (t: Tab) => setParams({ tab: t }, { replace: true });

  const badge = (t: Tab) => {
    if (SECTIONS.some((x) => x.id === t)) {
      const { done, total } = sectionProgress(p, t as SectionId);
      return `${done}/${total}`;
    }
    if (t === 'photos') return photoCount ? String(photoCount) : '';
    if (t === 'contract') {
      const c = clausesFor(p.dealType);
      const ch = Array.isArray(p.answers.contract) ? p.answers.contract.length : 0;
      return `${Math.min(ch, c.length)}/${c.length}`;
    }
    return '';
  };

  return (
    <div className="pb-28">
      <TopBar
        back
        title={
          <span className="flex items-center gap-2">
            <DealBadge deal={p.dealType} />
            <span className="truncate">{displayName(p)}</span>
          </span>
        }
        right={
          <button onClick={() => go('summary')} className="pr-1">
            <ScoreBadge score={s.total} size="sm" />
          </button>
        }
      />
      <div ref={tabsRef} className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-10 bg-slate-50/95 backdrop-blur border-b border-slate-200">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2 max-w-xl mx-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-tab={t.id}
              onClick={() => go(t.id)}
              className={`shrink-0 h-9 px-3 rounded-full text-sm whitespace-nowrap inline-flex items-center gap-1 ${
                tab === t.id ? 'bg-slate-900 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              <Icon name={t.icon} size={16} />
              <span>{t.label}</span>
              {badge(t.id) && <span className={`ml-0.5 text-xs ${tab === t.id ? 'text-white/70' : 'text-slate-400'}`}>{badge(t.id)}</span>}
            </button>
          ))}
        </div>
      </div>

      {s.flags.some((f) => f.level === 'danger') && tab !== 'summary' && (
        <button onClick={() => go('summary')} className="block w-full max-w-xl mx-auto mt-3 px-4">
          <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-3 py-2 text-left flex items-center gap-1.5">
            <Icon name="dangerous" size={17} />
            <span>{s.flags.find((f) => f.level === 'danger')!.text} — 계약 비권장</span>
          </div>
        </button>
      )}

      <main className="max-w-xl mx-auto px-4 pt-3">
        {tab === 'basic' && <BasicTab p={p} />}
        {SECTIONS.some((x) => x.id === tab) && <SectionTab p={p} section={tab as SectionId} />}
        {tab === 'contract' && <ContractTab p={p} />}
        {tab === 'photos' && (
          <Card>
            <PhotoBox p={p} />
          </Card>
        )}
        {tab === 'summary' && <SummaryTab p={p} baseRate={settings.baseRate} />}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="h-16 flex items-center gap-2 px-4 max-w-xl mx-auto">
          <button disabled={idx <= 0} onClick={() => go(TABS[idx - 1].id)} className="h-11 px-3.5 rounded-xl border border-slate-200 disabled:opacity-30 inline-flex items-center gap-0.5">
            <Icon name="chevron_left" size={20} />
            <span>이전</span>
          </button>
          <button onClick={() => go('photos')} className="h-11 w-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center" aria-label="사진">
            <Icon name="photo_camera" size={22} />
          </button>
          <button
            onClick={() => (idx < TABS.length - 1 ? go(TABS[idx + 1].id) : history.back())}
            className="flex-1 h-11 rounded-xl bg-blue-600 text-white font-semibold"
          >
            {idx < TABS.length - 1 ? `다음: ${TABS[idx + 1].label}` : '완료'}
          </button>
        </div>
      </div>
    </div>
  );
}
