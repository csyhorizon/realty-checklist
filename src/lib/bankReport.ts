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
const PAD = 64;
const CW = W - PAD * 2;
const FONT = `'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`;

function optLabel(itemId: string, v: AnswerValue): string {
  const item = ITEM_MAP[itemId];
  if (!item || v == null || v === '') return '-';
  if (item.type === 'number') return item.unit === '만원' ? formatManwon(v as number) : `${v}${item.unit ?? ''}`;
  if (item.type === 'single') return item.options?.find((o) => o.v === v)?.l ?? String(v);
  if (item.type === 'multi') {
    const arr = Array.isArray(v) ? v : [String(v)];
    if (!arr.length) return '-';
    return arr.map((x) => item.options?.find((o) => o.v === x)?.l ?? x).join(', ');
  }
  return String(v);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color = '#111111',
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

function drawHeading(ctx: CanvasRenderingContext2D, title: string, y: number, rightNote?: string) {
  drawText(ctx, title, PAD, y, `700 20px ${FONT}`, '#000000');
  if (rightNote) drawText(ctx, rightNote, W - PAD, y + 3, `400 15px ${FONT}`, '#333333', 'right');
  return y + 30;
}

interface Cell {
  label: string;
  value: string;
  bold?: boolean;
}

/** 1행(1쌍 또는 2쌍) 일반 양식 표 행 */
function drawFormRow(ctx: CanvasRenderingContext2D, y: number, cells: Cell[], rowH = 42, labelW = 165) {
  const colW = CW / cells.length;
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD, y, CW, rowH);

  cells.forEach((cell, i) => {
    const cx = PAD + i * colW;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + rowH);
      ctx.stroke();
    }
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(cx + 0.5, y + 0.5, labelW - 1, rowH - 1);
    ctx.beginPath();
    ctx.moveTo(cx + labelW, y);
    ctx.lineTo(cx + labelW, y + rowH);
    ctx.stroke();

    drawText(ctx, cell.label, cx + 12, y + Math.floor((rowH - 16) / 2), `700 16px ${FONT}`, '#111111');
    const font = cell.bold ? `700 17px ${FONT}` : `400 17px ${FONT}`;
    const line = wrapLines(ctx, cell.value || '-', colW - labelW - 24, font, 1)[0] ?? '-';
    drawText(ctx, line, cx + labelW + 12, y + Math.floor((rowH - 17) / 2), font, '#000000');
  });
  return y + rowH;
}

function drawOuterBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

/** 은행 대출 상담·제출용 1페이지 흑백 공문서 양식 PNG 생성 */
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

  // ── 문서 제목 ──
  let y = 58;
  drawText(ctx, '임차 매물 현황 및 전세대출 검토 메모', W / 2, y, `700 32px ${FONT}`, '#000000', 'center');
  y += 48;
  // 공문서 이중선
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 4);
  ctx.lineTo(W - PAD, y + 4);
  ctx.stroke();

  y += 14;
  const metaRight = [opts.loanProduct.trim(), `작성일 ${today}`].filter(Boolean).join('  |  ');
  drawText(ctx, `매물명: ${displayName(p)} (${DEAL_LABEL[p.dealType]})`, PAD, y, `600 16px ${FONT}`, '#222222');
  drawText(ctx, metaRight, W - PAD, y, `400 16px ${FONT}`, '#222222', 'right');

  // ── 1. 목적물 기본 정보 ──
  y += 38;
  y = drawHeading(
    ctx,
    '1. 임차 목적물 기본사항',
    y,
    p.location ? `위치좌표: ${p.location.lat.toFixed(5)}, ${p.location.lng.toFixed(5)}` : undefined,
  );
  const t1Start = y;
  const floorStr =
    a.floor != null || a.totalFloors != null ? `${a.floor ?? '?'}층 / 총 ${a.totalFloors ?? '?'}층` : '-';
  const houseStr = `${optLabel('houseType', a.houseType)}${a.area != null ? ` · ${a.area}평` : ''}`;
  const stationStr =
    a.stationMin != null
      ? `${a.stationName ? `${a.stationName} ` : ''}${a.stationBy === 'bus' ? '버스' : '도보'} 약 ${a.stationMin}분`
      : (a.stationName as string) || '-';
  const agencyStr = [p.agencyName, p.agencyPhone].filter(Boolean).join(' / ') || '-';

  y = drawFormRow(ctx, y, [{ label: '소재지 (주소)', value: p.address?.trim() || '-' }]);
  y = drawFormRow(ctx, y, [
    { label: '층수 / 유형', value: `${floorStr} (${houseStr})` },
    { label: '인근 지하철역', value: stationStr },
  ]);
  y = drawFormRow(ctx, y, [
    { label: '방문 / 입주예정', value: `${p.visitedAt || '-'}  /  ${p.moveInDate || '미정'}` },
    { label: '중개사무소', value: agencyStr },
  ]);
  drawOuterBox(ctx, PAD, t1Start, CW, y - t1Start);

  // ── 2. 보증금 및 자금 조달 계획 ──
  y += 26;
  y = drawHeading(ctx, '2. 보증금 및 대출 자금 계획', y, '단위: 원 (자기자금 비율 기준)');
  const t2Start = y;

  // 4열 요약표 헤더
  const cols4 = [
    { h: '총 임차보증금', v: deposit > 0 ? `${formatManwon(deposit)}원 (100%)` : '-', bold: true },
    { h: `본인 부담금 (${selfPct}%)`, v: deposit > 0 ? `${formatManwon(selfAmount)}원` : '-', bold: true },
    { h: `대출 신청 예정액 (${loanPct}%)`, v: deposit > 0 ? `${formatManwon(loanAmount)}원` : '-', bold: true },
    {
      h: p.dealType === 'jeonse' ? '월 관리비' : '월세 / 관리비',
      v:
        p.dealType === 'jeonse'
          ? a.fee != null ? `${formatManwon(a.fee as number)}원` : '-'
          : `${a.rent != null ? `${formatManwon(a.rent as number)}원` : '-'} / ${a.fee != null ? `${formatManwon(a.fee as number)}원` : '-'}`,
      bold: false,
    },
  ];
  const w4 = CW / 4;
  const hdrH = 38;
  const valH = 52;
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(PAD, y, CW, hdrH);
  ctx.strokeRect(PAD, y, CW, hdrH + valH);
  ctx.beginPath();
  ctx.moveTo(PAD, y + hdrH);
  ctx.lineTo(W - PAD, y + hdrH);
  ctx.stroke();

  cols4.forEach((c, i) => {
    const cx = PAD + i * w4;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + hdrH + valH);
      ctx.stroke();
    }
    drawText(ctx, c.h, cx + w4 / 2, y + 11, `700 15px ${FONT}`, '#111111', 'center');
    const vf = c.bold ? `700 20px ${FONT}` : `400 17px ${FONT}`;
    const line = wrapLines(ctx, c.v, w4 - 20, vf, 1)[0] ?? '-';
    drawText(ctx, line, cx + w4 / 2, y + hdrH + 16, vf, '#000000', 'center');
  });
  y += hdrH + valH;

  const market = typeof a.marketPrice === 'number' ? a.marketPrice : null;
  const lien = a.lien === 'yes' && typeof a.lienAmount === 'number' ? a.lienAmount : 0;
  const jr = market && deposit > 0 ? (deposit / market) * 100 : null;
  const dr = market && deposit > 0 ? ((deposit + lien) / market) * 100 : null;
  const hugOk = market && deposit > 0 ? deposit + lien <= market * 0.9 : null;
  y = drawFormRow(ctx, y, [
    { label: '참고 매매시세', value: market ? `${formatManwon(market)}원` : '-' },
    {
      label: '전세가율 / 부채비율',
      value:
        jr != null && dr != null
          ? `전세가율 ${jr.toFixed(1)}%  /  부채비율 ${dr.toFixed(1)}% (${hugOk ? '90% 이하' : '90% 초과 주의'})`
          : '-',
      bold: hugOk === false,
    },
  ]);
  drawOuterBox(ctx, PAD, t2Start, CW, y - t2Start);

  // ── 3. 대출·권리·안전 확인 ──
  y += 26;
  y = drawHeading(ctx, '3. 대출 요건 및 권리관계 확인', y);
  const t3Start = y;
  y = drawFormRow(ctx, y, [
    {
      label: '위반건축물·근생',
      value: a.violation === 'bad' ? '위반·근생 (대출 불가 사유)' : optLabel('violation', a.violation),
      bold: a.violation === 'bad',
    },
    { label: '임대인 유형', value: optLabel('landlord', a.landlord), bold: a.landlord === 'corp' || a.landlord === 'trust' },
  ]);
  y = drawFormRow(ctx, y, [
    { label: '버팀목 대출', value: p.dealType === 'monthly' ? '해당 없음 (월세)' : optLabel('loan', a.loan), bold: a.loan === 'no' },
    { label: '전세보증보험', value: optLabel('insurance', a.insurance), bold: a.insurance === 'no' },
  ]);
  y = drawFormRow(ctx, y, [
    {
      label: '융자 · 선순위',
      value: a.lien === 'yes' ? `있음 (${a.lienAmount != null ? `${formatManwon(a.lienAmount as number)}원` : '금액 미입력'})` : optLabel('lien', a.lien),
      bold: a.lien === 'yes',
    },
    {
      label: '보증금 조정',
      value: a.adjust === 'yes' ? `가능${a.adjustNote ? ` (${a.adjustNote})` : ''}` : optLabel('adjust', a.adjust),
    },
  ]);
  drawOuterBox(ctx, PAD, t3Start, CW, y - t3Start);

  // ── 4. 현장 상태 요약 ──
  y += 26;
  y = drawHeading(ctx, '4. 목적물 현장 상태 확인', y);
  const t4Start = y;
  y = drawFormRow(ctx, y, [
    { label: '채광 / 방음', value: `${optLabel('sunlight', a.sunlight)} / ${optLabel('soundproof', a.soundproof)}` },
    { label: '환기 / 습도', value: `${optLabel('ventilation', a.ventilation)} / ${optLabel('humidity', a.humidity)}` },
  ]);
  y = drawFormRow(ctx, y, [
    { label: '곰팡이', value: optLabel('mold', a.mold) },
    { label: '수압 / 온수', value: `${optLabel('pressure', a.pressure)} / ${optLabel('hotwater', a.hotwater)}` },
  ]);
  drawOuterBox(ctx, PAD, t4Start, CW, y - t4Start);

  // ── 5. 계약 특약 확인사항 ──
  y += 26;
  y = drawHeading(ctx, '5. 임대차 계약 특약 확인사항', y);
  const clauses = clausesFor(p.dealType);
  const checkedClauses = Array.isArray(a.contract) ? (a.contract as string[]) : [];
  const t5Start = y;
  const cHdrH = 34;
  const cRowH = 34;

  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(PAD, y, CW, cHdrH);
  ctx.strokeRect(PAD, y, CW, cHdrH + clauses.length * cRowH);
  ctx.beginPath();
  ctx.moveTo(PAD + 84, y);
  ctx.lineTo(PAD + 84, y + cHdrH + clauses.length * cRowH);
  ctx.moveTo(PAD, y + cHdrH);
  ctx.lineTo(W - PAD, y + cHdrH);
  ctx.stroke();

  drawText(ctx, '확인', PAD + 42, y + 9, `700 15px ${FONT}`, '#111111', 'center');
  drawText(ctx, '특약 항목', PAD + 98, y + 9, `700 15px ${FONT}`, '#111111');
  y += cHdrH;

  clauses.forEach((c, idx) => {
    const on = checkedClauses.includes(c.id);
    if (idx > 0) {
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(W - PAD, y);
      ctx.stroke();
    }
    // 단순 사각 체크박스
    const bx = PAD + 33;
    const by = y + 8;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, 18, 18);
    if (on) {
      ctx.beginPath();
      ctx.moveTo(bx + 3, by + 9);
      ctx.lineTo(bx + 8, by + 14);
      ctx.lineTo(bx + 15, by + 4);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    const line = wrapLines(ctx, c.text, CW - 112, `400 16px ${FONT}`, 1)[0];
    drawText(ctx, line, PAD + 98, y + 8, `400 16px ${FONT}`, '#111111');
    y += cRowH;
  });
  drawOuterBox(ctx, PAD, t5Start, CW, y - t5Start);

  // ── 6. 현장 조사 메모 ──
  y += 26;
  y = drawHeading(ctx, '6. 현장 조사 메모 및 특이사항', y);

  const memoParts: string[] = [];
  if (opts.extraMemo.trim()) memoParts.push(`· 추가 메모: ${opts.extraMemo.trim()}`);
  if (p.memo.trim()) memoParts.push(`· 종합 메모: ${p.memo.trim()}`);
  for (const sec of SECTIONS) {
    const note = (a[`note_${sec.id}`] as string | undefined)?.trim();
    if (note) memoParts.push(`· ${sec.label}: ${note}`);
  }
  if (score.flags.length > 0) {
    memoParts.push(`· 주의 확인사항: ${score.flags.map((f) => f.text).join(' / ')}`);
  }

  const footerY = H - 64;
  const memoBoxH = Math.max(110, footerY - 16 - y);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(PAD, y, CW, memoBoxH);
  drawOuterBox(ctx, PAD, y, CW, memoBoxH);

  if (memoParts.length === 0) {
    drawText(ctx, '(기록된 특이사항 없음)', PAD + 18, y + 18, `400 16px ${FONT}`, '#666666');
  } else {
    const lineH = 26;
    const maxLines = Math.max(1, Math.floor((memoBoxH - 32) / lineH));
    const lines = wrapLines(ctx, memoParts.join('\n'), CW - 36, `400 16px ${FONT}`, maxLines);
    lines.forEach((line, idx) => {
      drawText(ctx, line, PAD + 18, y + 16 + idx * lineH, `400 16px ${FONT}`, '#111111');
    });
  }

  // ── 하단 ──
  drawText(
    ctx,
    '※ 본 문서는 임차인이 매물 조사 과정에서 확인한 메모이며, 실제 대출 심사는 등기부등본·건축물대장 등 공부서류를 기준으로 진행됩니다.',
    PAD,
    footerY + 10,
    `400 14px ${FONT}`,
    '#444444',
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG 생성에 실패했습니다.'))), 'image/png');
  });
}
