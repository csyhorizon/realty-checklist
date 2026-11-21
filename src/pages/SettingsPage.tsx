import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveSettings } from '../db/db';
import { useSettings } from '../lib/hooks';
import { downloadOrShareBackup, importBackup } from '../lib/backup';
import { conversionRate } from '../lib/score';
import { BottomNav, Card, NumberField, TopBar } from '../components/ui';
import { SECTIONS, WEIGHTS } from '../schema/checklist';
import { DEAL_LABEL, type DealType } from '../types';

export default function SettingsPage() {
  const settings = useSettings();
  const counts = useLiveQuery(async () => ({ p: await db.properties.count(), ph: await db.photos.count() }), []);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted);
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)}MB 사용 중`);
    });
  }, [counts?.ph]);

  const doExport = async () => {
    setBusy(true);
    try {
      await downloadOrShareBackup();
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const r = await importBackup(f);
      alert(`가져오기 완료: 매물 ${r.properties}개, 사진 ${r.photos}장`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="pb-24">
      <TopBar title="⚙️ 설정" />
      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        <Card>
          <h3 className="font-bold mb-1">💾 데이터 백업</h3>
          <p className="text-sm text-slate-500 mb-3">
            모든 데이터는 이 브라우저에만 저장돼요. 브라우저 데이터를 지우거나 기기를 바꾸면 사라지니 주기적으로 백업하세요.
          </p>
          <p className="text-sm mb-3">
            매물 {counts?.p ?? 0}개 · 사진 {counts?.ph ?? 0}장 {usage && `· ${usage}`}
            <br />
            <span className="text-slate-500">
              마지막 백업: {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('ko-KR') : '없음'}
            </span>
          </p>
          <div className="flex gap-2">
            <button onClick={doExport} disabled={busy} className="flex-1 min-h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-60">
              내보내기 / 공유
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex-1 min-h-12 rounded-xl border border-slate-200 font-semibold disabled:opacity-60">
              가져오기
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
          </div>
          <div className="mt-3 text-sm">
            {persisted ? (
              <span className="text-emerald-600">✅ 영구 저장소 사용 중 (브라우저가 자동 삭제하지 않음)</span>
            ) : (
              <button
                onClick={async () => {
                  const ok = await navigator.storage?.persist?.();
                  setPersisted(!!ok);
                  if (!ok) alert('브라우저가 영구 저장을 허용하지 않았어요. 홈 화면에 앱을 추가하면 허용될 가능성이 높아요.');
                }}
                className="text-blue-600 underline"
              >
                영구 저장소 요청하기
              </button>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="font-bold mb-1">📈 기준금리</h3>
          <p className="text-sm text-slate-500 mb-3">
            환산월세 계산에 쓰는 법정 전월세 전환율 = 한국은행 기준금리 + 2%p. 금리가 바뀌면 수정하세요.
          </p>
          <NumberField value={settings.baseRate} unit="%" onChange={(v) => v != null && saveSettings({ baseRate: v })} />
          <p className="text-sm mt-2">
            현재 전환율: <b>{conversionRate(settings.baseRate).toFixed(2)}%</b>
          </p>
        </Card>

        <Card>
          <h3 className="font-bold mb-2">🧮 점수 계산 방식</h3>
          <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5">
            <li>각 항목 선택지에 0~1점 부여 → 섹션 평균 × 100</li>
            <li>종합 = 섹션 점수의 가중 평균 (입력한 섹션만 반영)</li>
            <li>전세가율 ≤60% 안전 · 70~80% 주의 · 80% 초과 위험</li>
            <li>부채비율(선순위+보증금)/시세 ≤70% 안전 · 80% 초과 위험</li>
            <li>위반건축물·전세가율/부채비율 80% 초과 시 최대 40점</li>
          </ul>
          <table className="w-full mt-3 text-sm text-center">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left py-1">섹션</th>
                {(['monthly', 'jeonse', 'semi'] as DealType[]).map((d) => (
                  <th key={d}>{DEAL_LABEL[d]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="text-left py-1.5">
                    {s.icon} {s.label}
                  </td>
                  {(['monthly', 'jeonse', 'semi'] as DealType[]).map((d) => (
                    <td key={d}>{WEIGHTS[d][s.id]}%</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h3 className="font-bold mb-2 text-rose-600">⚠️ 전체 삭제</h3>
          <button
            onClick={async () => {
              if (!confirm('모든 매물과 사진을 삭제할까요? 되돌릴 수 없습니다.')) return;
              if (!confirm('정말 삭제할까요? 백업을 먼저 해두는 걸 권장해요.')) return;
              await db.transaction('rw', db.properties, db.photos, async () => {
                await db.properties.clear();
                await db.photos.clear();
              });
            }}
            className="w-full min-h-11 rounded-xl border border-rose-200 text-rose-600 font-semibold"
          >
            모든 데이터 삭제
          </button>
        </Card>
        <p className="text-center text-xs text-slate-400 pb-4">집보기 체크리스트 v0.1 · 점수·특약은 참고용입니다</p>
      </div>
      <BottomNav active="settings" />
    </div>
  );
}
