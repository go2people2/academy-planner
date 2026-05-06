/**
 * API 키 없이 공개된 구글 시트 데이터를 가져오는 유틸리티
 */

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID_TEXTBOOK_MASTER;

export interface TextbookMaster {
  bookcode: string;
  title: string;
  grade: string;
  status: string;
  ePeriod: string; // e-period
}

/**
 * 💡 모든 형태의 CSV 파싱에 대응하는 견고한 로직
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  // 따옴표로 감싸진 경우와 쉼표만 있는 경우 모두 대응
  const lines = text.split(/\r?\n/);
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // 단순 split 대신 정규식을 사용하여 따옴표 내부 쉼표 보호
    const row = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (row) {
      rows.push(row.map(cell => cell.replace(/^"|"$/g, '').trim()));
    } else {
      // 정규식 실패 시 기본 split 시도
      rows.push(line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim()));
    }
  }
  return rows;
}

/**
 * 구글 시트를 CSV 형식으로 다운로드하여 파싱합니다.
 */
async function fetchSheetAsCsv(tabName: string) {
  try {
    if (!SHEET_ID) {
      console.error("❌ [GoogleSheets] SHEET_ID is missing!");
      return [];
    }

    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
    console.log(`🌐 [GoogleSheets] Fetching: ${tabName}`);
    
    const response = await fetch(url, { cache: 'no-store' });
    const text = await response.text();
    
    if (!response.ok) return [];

    const rows = parseCsv(text);
    return rows;
  } catch (e) {
    console.error(`❌ [GoogleSheets] Error:`, e);
    return [];
  }
}

export async function fetchTextbookMasterList(): Promise<TextbookMaster[]> {
  const rows = await fetchSheetAsCsv('master');
  if (!rows || rows.length <= 1) return [];

  // [0]bookcode, [1]book(title), [2]grade, [3]status, [4]e-period
  return rows.slice(1).map((row) => ({
    bookcode: row[0] || '',
    title: row[1] || '',
    grade: row[2] || '',
    status: row[3] || '',
    ePeriod: row[4] || '',
  })).filter(item => item.bookcode && item.status !== '비활성');
}

/**
 * 💡 유연한 unit-page 필터링 로직
 */
export async function fetchTextbookUnits(bookTitle: string) {
  const rows = await fetchSheetAsCsv('unit-page');
  if (!rows || rows.length <= 1) return [];

  const searchTitle = bookTitle.trim().toLowerCase();
  
  // 💡 교재명이 0번 또는 1번 열에 있을 수 있음을 고려하여 유연하게 필터링
  // 구조 A: [0]교재명 [1]단원명 [2]시작P [3]끝P
  // 구조 B: [0]코드 [1]교재명 [2]단원명 [3]시작P [4]끝P
  const filtered = rows.slice(1).filter(row => {
    const col0 = (row[0] || '').toLowerCase();
    const col1 = (row[1] || '').toLowerCase();
    return col0 === searchTitle || col1 === searchTitle;
  }).map(row => {
    // 💡 교재명이 0번에 있으면 [1,2,3] 사용, 1번에 있으면 [2,3,4] 사용
    const isCol0Match = (row[0] || '').toLowerCase() === searchTitle;
    const offset = isCol0Match ? 0 : 1;
    
    return {
      unit: (row[offset + 1] || '').replace(/^"|"$/g, '').trim(),
      // 💡 숫자가 아닌 문자(p, P, ., 공백 등)를 모두 제거하여 순수 숫자만 추출
      start_page: (row[offset + 2] || '0').replace(/[^0-9]/g, '').trim() || '0',
      end_page: (row[offset + 3] || '0').replace(/[^0-9]/g, '').trim() || '0'
    };
  });

  console.log(`✅ [GoogleSheets] Found ${filtered.length} units for: ${bookTitle}`);
  return filtered;
}
