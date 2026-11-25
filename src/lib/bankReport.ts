import { ITEM_MAP, SECTIONS, clausesFor } from '../schema/checklist';
import { scoreProperty } from './score';
import { displayName, formatManwon } from './format';
import { DEAL_LABEL, type AnswerValue, type Property } from '../types';

export interface BankReportOptions {
  depositManwon: number;
  selfAmountManwon: number;
  loanProduct: string;
  extraMemo: string;
}

const W = 1240;
const H = 1754;
const PAD = 56;
const CW = W - PAD * 2;
const FONT = `'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;

function optLabel(itemId: string, v: AnswerValue): string {
  const item = ITEM_MAP[itemId];
  if (!item || v == null || v === '') return '미확인';
  if (item.type === 'number') return item.unit === '만원' ? formatManwon(v as number) : `${v}${item.unit ?? ''}`;
  if (item.type === 'single') return item.options?.find((o) => o.v === v)?.l ?? String(v);
  if (item.type === 'multi') {
    const arr = Array.isArray(v) ? v : [String(v)];
    if (!arr.length) return '미확인';
    return arr.map((x) => item.options?.find((o) => o.v === x)?.l ?? x).join(', ');
  }
  return String(v);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'left',
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: string, maxLines: number): string[] {
  ctx.font = font;
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    if (!para.trim()) continue;
    let cur = '';
    for (const ch of para) {
      const next = cur + ch;
      if (ctx.measureText(next).width > maxW && cur) {
        out.push(cur);
        cur = ch;
        if (out.length >= maxLines) break;
      } else {
        cur = next;
      }
    }
    if (out.length < maxLines && cur) out.push(cur);
    if (out.length >= maxLines) break;
  }
  if (out.length === maxLines) {
    const last = out[maxLines - 1];
    if (last.length > 1) out[maxLines - 1] = `${last.slice(0, -1)}…`;
  }
  return out;
}

function drawSectionHeader(ctx: CanvasRenderingContext2D, title: string, y: number, sub?: string) {
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(PAD, y + 3, 6, 22);
  drawText(ctx, title, PAD + 16, y, `700 22px ${FONT}`, '#0f172a');
  if (sub) drawText(ctx, sub, W - PAD, y + 4, `500 16px ${FONT}`, '#64748b', 'right');
  return y + 36;
}

type Tone = 'ok' | 'warn' | 'danger' | 'neutral';
const TONE: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: '#ecfdf5', fg: '#047857' },
  warn: { bg: '#fffbeb', fg: '#b45309' },
  danger: { bg: '#fff1f2', fg: '#be123c' },
  neutral: { bg: '#f1f5f9', fg: '#334155' },
};

function drawBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tone: Tone) {
  ctx.font = `700 16px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const bw = tw + 22;
  ctx.fillStyle = TONE[tone].bg;
  roundRect(ctx, x, y, bw, 30, 8);
  ctx.fill();
  drawText(ctx, text, x + 11, y + 6, `700 16px ${FONT}`, TONE[tone].fg);
  return bw;
}

function drawKvRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  pairs: { label: string; value: string; tone?: Tone }[],
  rowH = 44,
) {
  const colW = CW / pairs.length;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD, y, CW, rowH);
  pairs.forEach((cell, i) => {
    const cx = PAD + i * colW;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + rowH);
      ctx.stroke();
    }
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx + 1, y + 1, 154, rowH - 2);
    ctx.beginPath();
    ctx.moveTo(cx + 155, y);
    ctx.lineTo(cx + 155, y + rowH);
    ctx.stroke();

    drawText(ctx, cell.label, cx + 14, y + 13, `600 16px ${FONT}`, '#475569');
    const valX = cx + 168;
    const maxValW = colW - 180;
    const valColor = cell.tone ? TONE[cell.tone].fg : '#0f172a';
    const font = cell.tone && cell.tone !== 'neutral' ? `700 17px ${FONT}` : `500 17px ${FONT}`;
    const line = wrapLines(ctx, cell.value || '미입력', maxValW, font, 1)[0] ?? '미입력';
    drawText(ctx, line, valX, y + 12, font, valColor);
  });
  return y + rowH;
}

/** 은행 대출 상담·제출용 1페이지(A4 비율) PNG 생성 */
export async function renderBankReportPng(p: Property, baseRate: number, opts: BankReportOptions): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const a = p.answers;
  const score = scoreProperty(p, baseRate);
  const deposit = Math.max(0, opts.depositManwon);
  const selfAmount = Math.min(deposit, Math.max(0, Math.round(opts.selfAmountManwon)));
  const loanAmount = Math.max(0, deposit - selfAmount);
  const selfPct = deposit > 0 ? Math.round((selfAmount / deposit) * 1000) / 10 : 0;
  const loanPct = deposit > 0 ? Math.round((100 - selfPct) * 10) / 10 : 0;

  const today = new Date().toISOString().slice(0, 10);
  const hasDanger = score.flags.some((f) => f.level === 'danger');

  // ── 1. 헤더 ──
  let y = 46;
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, PAD, y, CW, 104, 14);
  ctx.fill();

  drawText(ctx, '임차 매물 현황 및 전세대출 검토 메모', PAD + 26, y + 20, `700 28px ${FONT}`, '#ffffff');
  drawText(
    ctx,
    `작성일 ${today}  ·  거래유형: ${DEAL_LABEL[p.dealType]}  ·  매물명: ${displayName(p)}`,
    PAD + 26,
    y + 60,
    `500 17px ${FONT}`,
    '#cbd5e1',
  );
  const badgeText = hasDanger ? '주의 필요' : opts.loanProduct.trim() || '대출 검토용';
  ctx.font = `700 16px ${FONT}`;
  const bw = ctx.measureText(badgeText).width + 28;
  ctx.fillStyle = hasDanger ? '#e11d48' : '#2563eb';
  roundRect(ctx, W - PAD - bw - 22, y + 34, bw, 36, 10);
  ctx.fill();
  drawText(ctx, badgeText, W - PAD - 22 - bw / 2, y + 43, `700 16px ${FONT}`, '#ffffff', 'center');

  // ── 2. 매물 기본 정보 ──
  y = 172;
  y = drawSectionHeader(ctx, '1. 매물 기본 정보', y, p.location ? `GPS ${p.location.lat.toFixed(5)}, ${p.location.lng.toFixed(5)}` : undefined);

  const floorStr =
    a.floor != null || a.totalFloors != null ? `${a.floor ?? '?'}층 / 총 ${a.totalFloors ?? '?'}층` : '미확인';
  const houseStr = `${optLabel('houseType', a.houseType)}${a.area != null ? ` · ${a.area}평` : ''}`;
  const stationStr =
    a.stationMin != null
      ? `${a.stationName ? `${a.stationName} ` : ''}${a.stationBy === 'bus' ? '버스' : '도보'} 약 ${a.stationMin}분`
      : (a.stationName as string) || '미확인';
  const agencyStr = [p.agencyName, p.agencyPhone].filter(Boolean).join(' · ') || '미입력';

  y = drawKvRow(ctx, y, [{ label: '소재지 (주소)', value: p.address?.trim() || '미입력' }]);
  y = drawKvRow(ctx, y, [
    { label: '층수 / 유형', value: `${floorStr} (${houseStr})`, tone: a.houseType === 'semiBase' ? 'warn' : 'neutral' },
    { label: '가까운 역', value: stationStr },
  ]);
  y = drawKvRow(ctx, y, [
    { label: '입주 / 방문일', value: `입주 ${p.moveInDate || '미정'}  /  방문 ${p.visitedAt || '-'}` },
    { label: '중개사무소', value: agencyStr },
  ]);

  // ── 3. 보증금 및 대출 자금 계획 ──
  y += 22;
  y = drawSectionHeader(ctx, '2. 보증금 및 대출 자금 계획', y, opts.loanProduct.trim() || undefined);

  const boxGap = 16;
  const boxW = (CW - boxGap * 2) / 3;
  const boxH = 122;
  const cards = [
    {
      title: '총 임차보증금',
      val: deposit > 0 ? `${formatManwon(deposit)}원` : '미입력',
      sub:
        p.dealType === 'jeonse'
          ? `관리비 ${a.fee != null ? `${formatManwon(a.fee as number)}원` : '미입력'}`
          : `월세 ${a.rent != null ? `${formatManwon(a.rent as number)}원` : '-'} / 관리비 ${a.fee != null ? `${formatManwon(a.fee as number)}원` : '-'}`,
      bg: '#f8fafc',
      bd: '#cbd5e1',
      fg: '#0f172a',
    },
    {
      title: `본인 자금 (자기자금 ${selfPct}%)`,
      val: deposit > 0 ? `${formatManwon(selfAmount)}원` : '–',
      sub: '임차인 직접 부담금',
      bg: '#eff6ff',
      bd: '#93c5fd',
      fg: '#1d4ed8',
    },
    {
      title: `대출 신청 예정액 (${loanPct}%)`,
      val: deposit > 0 ? `${formatManwon(loanAmount)}원` : '–',
      sub: '은행 대출 예정 금액',
      bg: '#ecfdf5',
      bd: '#6ee7b7',
      fg: '#047857',
    },
  ];
  cards.forEach((c, i) => {
    const x = PAD + i * (boxW + boxGap);
    ctx.fillStyle = c.bg;
    ctx.strokeStyle = c.bd;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();
    drawText(ctx, c.title, x + 20, y + 18, `600 17px ${FONT}`, '#475569');
    drawText(ctx, c.val, x + 20, y + 48, `700 28px ${FONT}`, c.fg);
    drawText(ctx, c.sub, x + 20, y + 88, `500 15px ${FONT}`, '#64748b');
  });
  y += boxH + 10;

  // 시세·전세가율·부채비율 요약 바
  const market = typeof a.marketPrice === 'number' ? a.marketPrice : null;
  const lien = a.lien === 'yes' && typeof a.lienAmount === 'number' ? a.lienAmount : 0;
  const jr = market && deposit > 0 ? (deposit / market) * 100 : null;
  const dr = market && deposit > 0 ? ((deposit + lien) / market) * 100 : null;
  const hugOk = market && deposit > 0 ? deposit + lien <= market * 0.9 : null;
  y = drawKvRow(ctx, y, [
    { label: '참고 매매시세', value: market ? `${formatManwon(market)}원` : '미입력' },
    { label: '전세가율', value: jr != null ? `${jr.toFixed(1)}%` : '–', tone: jr != null && jr > 80 ? 'danger' : jr != null && jr > 70 ? 'warn' : 'neutral' },
    { label: '부채비율(HUG)', value: dr != null ? `${dr.toFixed(1)}% (${hugOk ? '90% 이하' : '90% 초과'})` : '–', tone: hugOk === false ? 'danger' : hugOk === true ? 'ok' : 'neutral' },
  ]);

  // ── 4. 대출 · 권리 · 안전 확인 ──
  y += 22;
  y = drawSectionHeader(ctx, '3. 대출 · 권리 · 안전 확인 (현장 및 중개사 확인)', y);

  const toneFor = (id: string, val: AnswerValue): Tone => {
    const opt = ITEM_MAP[id]?.options?.find((o) => o.v === val);
    if (opt?.risk === 'danger') return 'danger';
    if (opt?.risk === 'warn') return 'warn';
    if (opt?.s === 1) return 'ok';
    return 'neutral';
  };

  y = drawKvRow(ctx, y, [
    {
      label: '위반건축물·근생',
      value: a.violation === 'bad' ? '위반·근생 (대출 불가)' : optLabel('violation', a.violation),
      tone: toneFor('violation', a.violation),
    },
    { label: '임대인 유형', value: optLabel('landlord', a.landlord), tone: toneFor('landlord', a.landlord) },
  ]);
  y = drawKvRow(ctx, y, [
    { label: '버팀목 대출', value: p.dealType === 'monthly' ? '해당 없음 (월세)' : optLabel('loan', a.loan), tone: toneFor('loan', a.loan) },
    { label: '전세보증보험', value: optLabel('insurance', a.insurance), tone: toneFor('insurance', a.insurance) },
  ]);
  y = drawKvRow(ctx, y, [
    {
      label: '융자 · 선순위',
      value: a.lien === 'yes' ? `있음 (${a.lienAmount != null ? `${formatManwon(a.lienAmount as number)}원` : '금액 미입력'})` : optLabel('lien', a.lien),
      tone: toneFor('lien', a.lien),
    },
    {
      label: '보증금 조정',
      value: a.adjust === 'yes' ? `가능${a.adjustNote ? ` (${a.adjustNote})` : ''}` : optLabel('adjust', a.adjust),
    },
  ]);

  // ── 5. 현장 상태 요약 & 특약 확인 ──
  y += 22;
  y = drawSectionHeader(ctx, '4. 매물 상태 요약 및 계약 특약 확인', y);

  y = drawKvRow(ctx, y, [
    { label: '채광 / 방음', value: `${optLabel('sunlight', a.sunlight)} / ${optLabel('soundproof', a.soundproof)}` },
    { label: '환기 / 습도', value: `${optLabel('ventilation', a.ventilation)} / ${optLabel('humidity', a.humidity)}` },
  ]);
  y = drawKvRow(ctx, y, [
    {
      label: '곰팡이',
      value: optLabel('mold', a.mold),
      tone: Array.isArray(a.mold) ? (a.mold.some((x) => x === 'wall' || x === 'window') ? 'warn' : a.mold.includes('none') ? 'ok' : 'neutral') : 'neutral',
    },
    { label: '수압 / 온수', value: `${optLabel('pressure', a.pressure)} / ${optLabel('hotwater', a.hotwater)}` },
  ]);

  // 특약 확인 박스
  const clauses = clausesFor(p.dealType);
  const checkedClauses = Array.isArray(a.contract) ? (a.contract as string[]) : [];
  const clauseBoxY = y + 10;
  const clauseRowH = 31;
  const clauseBoxH = 18 + clauses.length * clauseRowH;
  ctx.strokeStyle = '#cbd5e1';
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, PAD, clauseBoxY, CW, clauseBoxH, 10);
  ctx.fill();
  ctx.stroke();

  let cy = clauseBoxY + 12;
  for (const c of clauses) {
    const on = checkedClauses.includes(c.id);
    drawBadge(ctx, on ? '확인됨' : '미확인', PAD + 14, cy - 2, on ? 'ok' : 'neutral');
    const line = wrapLines(ctx, c.text, CW - 120, `500 16px ${FONT}`, 1)[0];
    drawText(ctx, line, PAD + 106, cy + 4, `500 16px ${FONT}`, on ? '#0f172a' : '#64748b');
    cy += clauseRowH;
  }
  y = clauseBoxY + clauseBoxH;

  // ── 6. 현장 조사 메모 (은행 제출 참고) ──
  y += 22;
  y = drawSectionHeader(ctx, '5. 현장 조사 메모 (은행 참고용)', y);

  const memoParts: string[] = [];
  if (opts.extraMemo.trim()) memoParts.push(`[은행 제출 메모] ${opts.extraMemo.trim()}`);
  if (p.memo.trim()) memoParts.push(`[종합 메모] ${p.memo.trim()}`);
  for (const sec of SECTIONS) {
    const note = (a[`note_${sec.id}`] as string | undefined)?.trim();
    if (note) memoParts.push(`[${sec.label}] ${note}`);
  }
  if (score.flags.length > 0) {
    memoParts.push(`[위험·주의 요약] ${score.flags.map((f) => f.text).join(' / ')}`);
  }

  const footerY = H - 70;
  const memoBoxH = Math.max(120, footerY - 18 - y);
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  roundRect(ctx, PAD, y, CW, memoBoxH, 12);
  ctx.fill();
  ctx.stroke();

  if (memoParts.length === 0) {
    drawText(ctx, '입력된 현장 메모가 없습니다.', PAD + 22, y + 22, `400 17px ${FONT}`, '#94a3b8');
  } else {
    const lineH = 27;
    const maxLines = Math.max(1, Math.floor((memoBoxH - 36) / lineH));
    const lines = wrapLines(ctx, memoParts.join('\n'), CW - 44, `400 17px ${FONT}`, maxLines);
    lines.forEach((line, idx) => {
      drawText(ctx, line, PAD + 22, y + 20 + idx * lineH, `400 17px ${FONT}`, '#1e293b');
    });
  }

  // ── 7. 하단 푸터 ──
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(PAD, footerY);
  ctx.lineTo(W - PAD, footerY);
  ctx.stroke();
  drawText(
    ctx,
    '※ 본 자료는 임차인이 매물 조사 과정에서 수집한 메모이며, 대출 가능 여부는 등기부등본·건축물대장 등 공식 서류로 심사됩니다.',
    PAD,
    footerY + 14,
    `400 14px ${FONT}`,
    '#64748b',
  );
  drawText(ctx, '집보기 체크리스트', W - PAD, footerY + 14, `600 14px ${FONT}`, '#94a3b8', 'right');

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG 생성에 실패했습니다.'))), 'image/png');
  });
}
