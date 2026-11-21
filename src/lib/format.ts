/** 만원 단위 → "1억 2,000만" */
export function formatManwon(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '-';
  const n = Math.round(v);
  if (n === 0) return '0';
  const eok = Math.floor(n / 10000);
  const man = n % 10000;
  if (eok > 0) return man ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`;
  return `${man.toLocaleString()}만`;
}

/** 별칭이 비어 있으면 주소 → 날짜 순으로 표시용 이름 생성 (저장값은 건드리지 않음) */
export function displayName(p: { nickname: string; address?: string; createdAt: number }): string {
  return p.nickname.trim() || p.address?.trim() || `이름 없는 매물 (${formatDate(p.createdAt)})`;
}

export const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

export function priceSummary(dealType: string, deposit?: unknown, rent?: unknown): string {
  const d = typeof deposit === 'number' ? deposit : null;
  const r = typeof rent === 'number' ? rent : null;
  if (dealType === 'jeonse') return d != null ? `전세 ${formatManwon(d)}` : '가격 미입력';
  if (d == null && r == null) return '가격 미입력';
  return `${formatManwon(d)} / ${r != null ? r.toLocaleString() : '-'}`;
}
