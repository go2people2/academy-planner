/**
 * 💡 엑셀 또는 구글 시트에서 복사한 클립보드 텍스트를 파싱하여 단원 목록으로 변환하는 순수 클라이언트 안전 유틸리티
 * (서버 전용 환경변수나 Supabase에 의존하지 않으므로 브라우저 환경에서 안전하게 실행됩니다)
 */

export interface ParsedUnitItem {
  unit_name: string;
  start_page: number;
  end_page: number;
}

/**
 * 💡 엑셀 또는 구글 시트에서 복사한 클립보드 텍스트를 파싱하여 단원 목록으로 변환합니다.
 * 지원 형식:
 * 1) 5열 (구글시트 unit-page): [bookcode, order, unit_name, start_p, end_p]
 * 2) 4열 (순번 포함): [order, unit_name, start_p, end_p]
 * 3) 3열 (표준): [unit_name, start_p, end_p]
 * 4) 2열: [unit_name, "10~25"]
 * 5) 1열: [unit_name]
 */
export function parsePastedUnits(text: string): ParsedUnitItem[] {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result: ParsedUnitItem[] = [];

  for (const line of lines) {
    const parts = line.includes('\t')
      ? line.split('\t').map((c) => c.trim().replace(/^"|"$/g, ''))
      : line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

    if (parts.length === 0 || !parts[0]) continue;

    const lowerFirst = parts[0].toLowerCase();
    if (lowerFirst.includes('bookcode') || lowerFirst.includes('단원') || lowerFirst.includes('unit')) {
      continue;
    }

    let unitName = '';
    let startPage = 0;
    let endPage = 0;

    if (parts.length >= 5) {
      unitName = parts[2] || '';
      startPage = parseInt(parts[3]?.replace(/[^0-9]/g, ''), 10) || 0;
      endPage = parseInt(parts[4]?.replace(/[^0-9]/g, ''), 10) || 0;
    } else if (parts.length === 4) {
      unitName = parts[1] || '';
      startPage = parseInt(parts[2]?.replace(/[^0-9]/g, ''), 10) || 0;
      endPage = parseInt(parts[3]?.replace(/[^0-9]/g, ''), 10) || 0;
    } else if (parts.length === 3) {
      unitName = parts[0] || '';
      startPage = parseInt(parts[1]?.replace(/[^0-9]/g, ''), 10) || 0;
      endPage = parseInt(parts[2]?.replace(/[^0-9]/g, ''), 10) || 0;
    } else if (parts.length === 2) {
      unitName = parts[0] || '';
      const pageStr = parts[1] || '';
      if (pageStr.includes('~') || pageStr.includes('-')) {
        const [s, e] = pageStr.split(/[~-]/);
        startPage = parseInt(s?.replace(/[^0-9]/g, ''), 10) || 0;
        endPage = parseInt(e?.replace(/[^0-9]/g, ''), 10) || 0;
      } else {
        startPage = parseInt(pageStr.replace(/[^0-9]/g, ''), 10) || 0;
        endPage = startPage;
      }
    } else {
      unitName = parts[0] || '';
      const last = result[result.length - 1];
      startPage = last ? last.end_page + 1 : 1;
      endPage = startPage + 10;
    }

    if (unitName) {
      if (startPage > endPage && endPage === 0) endPage = startPage;
      if (startPage > endPage) {
        const temp = startPage;
        startPage = endPage;
        endPage = temp;
      }
      result.push({ unit_name: unitName, start_page: startPage, end_page: endPage });
    }
  }

  return result;
}
