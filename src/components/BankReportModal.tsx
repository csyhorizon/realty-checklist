import { useEffect, useState } from 'react';
import { renderBankReportPng } from '../lib/bankReport';
import { displayName, formatManwon } from '../lib/format';
import type { Property } from '../types';
import { Icon } from './Icon';

const PRESETS = [10, 20, 30, 40, 50];

export function BankReportModal({
  p,
  baseRate,
  onClose,
}: {
  p: Property;
  baseRate: number;
  onClose: () => void;
}) {
  const initDeposit = typeof p.answers.deposit === 'number' ? p.answers.deposit : 0;
  const [deposit, setDeposit] = useState(initDeposit);
  const [selfAmount, setSelfAmount] = useState(Math.round((initDeposit * 20) / 100)); // 버팀목 기준 자기자금 최소 20%
  const [loanProduct, setLoanProduct] = useState(
    p.dealType === 'monthly' ? '보증금 대출 상담용' : 'HUG 버팀목 전세자금대출',
  );
  const [extraMemo, setExtraMemo] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [busy, setBusy] = useState(false);

  const clampedSelf = Math.min(deposit, Math.max(0, selfAmount));
  const loanAmount = Math.max(0, deposit - clampedSelf);
  const selfPct = deposit > 0 ? Math.round((clampedSelf / deposit) * 1000) / 10 : 0;
  const loanPct = deposit > 0 ? Math.round((100 - selfPct) * 10) / 10 : 0;

  const setByPct = (pct: number) => {
    const pClamped = Math.min(100, Math.max(0, pct));
    setSelfAmount(Math.round((deposit * pClamped) / 100));
  };

  useEffect(() => {
    let alive = true;
    let createdUrl: string | undefined;
    const t = window.setTimeout(async () => {
      setBusy(true);
      try {
        const b = await renderBankReportPng(p, baseRate, {
          depositManwon: deposit,
          selfAmountManwon: clampedSelf,
          loanProduct,
          extraMemo,
        });
        if (!alive) return;
        createdUrl = URL.createObjectURL(b);
        setBlob(b);
        setPreviewUrl(createdUrl);
      } finally {
        if (alive) setBusy(false);
      }
    }, 150);
    return () => {
      alive = false;
      window.clearTimeout(t);
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [p, baseRate, deposit, clampedSelf, loanProduct, extraMemo]);

  const filename = `${displayName(p).replace(/[\\/:*?"<>|]/g, '_')}-대출검토-${new Date().toISOString().slice(0, 10)}.png`;

  const savePng = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const sharePng = async () => {
    if (!blob) return;
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${displayName(p)} 대출 검토 메모` });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    savePng();
  };

  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex flex-col justify-end sm:justify-center sm:p-4">
      <div className="bg-white w-full max-w-xl mx-auto rounded-t-3xl sm:rounded-3xl max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Icon name="account_balance" size={20} className="text-blue-600" />
            <span>은행 제출용 PNG 출력</span>
          </h2>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-500" aria-label="닫기">
            <Icon name="close" size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">총 보증금 (만원)</label>
              <input
                type="number"
                inputMode="numeric"
                value={deposit || ''}
                placeholder="15000"
                onChange={(e) => {
                  const next = Math.max(0, Number(e.target.value) || 0);
                  const ratio = deposit > 0 ? clampedSelf / deposit : 0.2;
                  setDeposit(next);
                  setSelfAmount(Math.round(next * ratio));
                }}
                className="w-full min-h-11 px-3 rounded-xl border border-slate-200 text-base text-right font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">자기자금 비율 (%)</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={selfPct}
                onChange={(e) => setByPct(Number(e.target.value) || 0)}
                className="w-full min-h-11 px-3 rounded-xl border border-slate-200 text-base text-right font-semibold"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setByPct(pct)}
                className={`h-9 px-3 rounded-full text-xs font-semibold border ${
                  Math.abs(selfPct - pct) < 0.05 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                자기자금 {pct}%{pct === 20 ? ' (버팀목 기본)' : ''}
              </button>
            ))}
          </div>

          {deposit > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs text-blue-700">본인 자금 ({selfPct}%)</p>
                <p className="font-bold text-base text-blue-900 mt-0.5">{formatManwon(clampedSelf)}원</p>
                <label className="block text-[11px] text-blue-600 mt-1">
                  직접 수정(만원):
                  <input
                    type="number"
                    inputMode="numeric"
                    value={clampedSelf}
                    onChange={(e) => setSelfAmount(Math.min(deposit, Math.max(0, Number(e.target.value) || 0)))}
                    className="ml-1 w-20 px-1.5 py-0.5 rounded border border-blue-200 bg-white text-right text-slate-800"
                  />
                </label>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                <p className="text-xs text-emerald-700">대출 신청 예정액 ({loanPct}%)</p>
                <p className="font-bold text-base text-emerald-900 mt-0.5">{formatManwon(loanAmount)}원</p>
                <p className="text-[11px] text-emerald-700 mt-1">보증금 - 본인 자금</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">대출 구분 (문서 상단 표시)</label>
              <input
                type="text"
                value={loanProduct}
                onChange={(e) => setLoanProduct(e.target.value)}
                className="w-full min-h-10 px-3 rounded-xl border border-slate-200 text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">은행 제출용 추가 메모 (선택)</label>
              <textarea
                rows={2}
                value={extraMemo}
                onChange={(e) => setExtraMemo(e.target.value)}
                placeholder="예) 임대인 대출·보증보험 특약 동의 확인 완료, 등기부등본 깨끗함"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-base"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center justify-between">
              <span>1장 미리보기 (A4 비율 PNG)</span>
              {busy && <span>생성 중…</span>}
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-100 overflow-hidden">
              {previewUrl && <img src={previewUrl} alt="은행 제출용 메모 미리보기" className="w-full h-auto block" />}
            </div>
          </div>
        </div>

        <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-slate-100 flex gap-2 bg-white">
          <button
            type="button"
            disabled={!blob}
            onClick={savePng}
            className="flex-1 min-h-12 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Icon name="download" size={20} />
            <span>PNG 저장</span>
          </button>
          {canShareFiles && (
            <button
              type="button"
              disabled={!blob}
              onClick={sharePng}
              className="min-h-12 px-4 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Icon name="share" size={19} />
              <span>공유</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
