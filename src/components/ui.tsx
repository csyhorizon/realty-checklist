import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Item, Opt } from '../schema/checklist';
import type { AnswerValue } from '../types';
import { scoreColor } from '../lib/score';
import { Icon, type IconName } from './Icon';

export function Segment({ options, value, onChange }: { options: Opt[]; value: AnswerValue; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.v;
        const tone = on
          ? o.risk === 'danger'
            ? 'bg-rose-500 border-rose-500 text-white'
            : o.risk === 'warn'
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-slate-200 text-slate-700 active:bg-slate-100';
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(on ? null : o.v)}
            className={`min-h-11 px-4 rounded-xl border text-[15px] font-medium transition ${tone}`}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

export function Chips({
  options,
  value,
  onChange,
  exclusive,
}: {
  options: Opt[];
  value: AnswerValue;
  onChange: (v: string[]) => void;
  exclusive?: string;
}) {
  const arr = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];
  const toggle = (v: string, on: boolean) => {
    if (on) return onChange(arr.filter((x) => x !== v));
    if (exclusive && v === exclusive) return onChange([v]);
    return onChange([...arr.filter((x) => x !== exclusive), v]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = arr.includes(o.v);
        const cls = on
          ? o.risk === 'danger'
            ? 'bg-rose-50 border-rose-500 text-rose-700 font-semibold'
            : o.risk === 'warn'
              ? 'bg-amber-50 border-amber-500 text-amber-800 font-semibold'
              : 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
          : 'bg-white border-slate-200 text-slate-700';
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => toggle(o.v, on)}
            className={`min-h-11 px-4 rounded-full border text-[15px] inline-flex items-center gap-1 transition ${cls}`}
          >
            {on && <Icon name="check" size={16} />}
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

/** 입력 중엔 로컬 상태, 400ms 뒤 / blur 시 저장 */
function useDebounced<T>(initial: T, save: (v: T) => void) {
  const [val, setVal] = useState(initial);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(initial);
  useEffect(() => {
    setVal(initial);
    latest.current = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initial)]);
  const change = (v: T) => {
    setVal(v);
    latest.current = v;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(v), 400);
  };
  const flush = () => {
    window.clearTimeout(timer.current);
    save(latest.current);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { val, change, flush };
}

export function NumberField({ value, unit, onChange, placeholder }: { value: AnswerValue; unit?: string; onChange: (v: number | null) => void; placeholder?: string }) {
  const init = typeof value === 'number' ? String(value) : '';
  const { val, change, flush } = useDebounced(init, (s) => {
    const n = s.trim() === '' ? null : Number(s.replace(/,/g, ''));
    onChange(n == null || Number.isNaN(n) ? null : n);
  });
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        value={val}
        placeholder={placeholder ?? '0'}
        onChange={(e) => change(e.target.value.replace(/[^0-9.,]/g, ''))}
        onBlur={flush}
        className="w-full min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-base text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {unit && <span className="shrink-0 text-slate-500 text-sm w-10">{unit}</span>}
    </div>
  );
}

export function TextField({ value, onChange, placeholder, multiline, type = 'text' }: { value?: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; type?: string }) {
  const { val, change, flush } = useDebounced(value ?? '', onChange);
  const cls = 'w-full px-3 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500';
  return multiline ? (
    <textarea value={val} placeholder={placeholder} rows={5} onChange={(e) => change(e.target.value)} onBlur={flush} className={`${cls} py-2`} />
  ) : (
    <input type={type} value={val} placeholder={placeholder} onChange={(e) => change(e.target.value)} onBlur={flush} className={`${cls} min-h-11`} />
  );
}

export function ItemField({ item, value, onChange, action }: { item: Item; value: AnswerValue; onChange: (v: AnswerValue) => void; action?: ReactNode }) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800">{item.label}</span>
        {action}
      </div>
      {item.tip && (
        <p className="mb-2 text-xs text-slate-500 flex items-center gap-1">
          <Icon name="lightbulb" size={15} className="text-amber-500" />
          <span>{item.tip}</span>
        </p>
      )}
      {item.type === 'single' && <Segment options={item.options!} value={value} onChange={onChange} />}
      {item.type === 'multi' && <Chips options={item.options!} value={value} exclusive={item.exclusive} onChange={onChange} />}
      {item.type === 'number' && <NumberField value={value} unit={item.unit} onChange={onChange} />}
      {item.type === 'text' && <TextField value={(value as string) ?? ''} placeholder={item.placeholder} onChange={onChange} />}
    </div>
  );
}

export function ScoreBadge({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'sm' ? 'w-9 h-9 text-sm' : 'w-12 h-12 text-lg';
  return (
    <div className={`${sz} ${scoreColor(score)} rounded-2xl flex items-center justify-center font-bold shrink-0`}>
      {score == null ? '–' : Math.round(score)}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 ${className}`}>{children}</section>;
}

export function TopBar({ title, back, right }: { title: ReactNode; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100 pt-[env(safe-area-inset-top)]">
      <div className="h-14 px-2 flex items-center gap-1 max-w-xl mx-auto">
        {back ? (
          <button onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} className="w-11 h-11 flex items-center justify-center text-slate-700" aria-label="뒤로">
            <Icon name="chevron_left" size={28} />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="flex-1 font-bold text-lg truncate">{title}</h1>
        {right}
      </div>
    </header>
  );
}

export function BottomNav({ active }: { active: 'list' | 'compare' | 'settings' }) {
  const tab = (key: typeof active, to: string, icon: IconName, label: string) => (
    <Link to={to} className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs ${active === key ? 'text-blue-600 font-semibold' : 'text-slate-500'}`}>
      <Icon name={icon} size={24} filled={active === key} />
      {label}
    </Link>
  );
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="h-16 flex max-w-xl mx-auto">
        {tab('list', '/', 'home', '매물')}
        {tab('compare', '/compare', 'balance', '비교')}
        {tab('settings', '/settings', 'settings', '설정')}
      </div>
    </nav>
  );
}

export function DealBadge({ deal }: { deal: string }) {
  const map: Record<string, string> = {
    monthly: 'bg-violet-100 text-violet-700',
    jeonse: 'bg-sky-100 text-sky-700',
    semi: 'bg-teal-100 text-teal-700',
  };
  const label: Record<string, string> = { monthly: '월세', jeonse: '전세', semi: '반전세' };
  return <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${map[deal]}`}>{label[deal]}</span>;
}
