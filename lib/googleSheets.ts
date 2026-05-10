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
  const lines = text.split(/\r?\n/);
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const row: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"' && inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    rows.push(row.map(cell => cell.replace(/^"|"$/g, '').trim()));
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
 * 💡 모든 교재의 단원 데이터를 가져옵니다. (에디터 등에서 사용)
 */
export async function fetchAllTextbookUnits() {
  const rows = await fetchSheetAsCsv('unit-page');
  if (!rows || rows.length <= 1) return [];

  return rows.slice(1).filter(row => row[0]).map(row => ({
    bookcode: (row[0] || '').trim().toLowerCase(),
    unit: (row[2] || '').replace(/^"|"$/g, '').trim(),
    start_page: (row[3] || '0').replace(/[^0-9]/g, '').trim() || '0',
    end_page: (row[4] || '0').replace(/[^0-9]/g, '').trim() || '0'
  }));
}

/**
 * 💡 유연한 unit-page 필터링 로직 (Bookcode 기준 정밀 매칭)
 */
export async function fetchTextbookUnits(bookCode: string) {
  const rows = await fetchSheetAsCsv('unit-page');
  if (!rows || rows.length <= 1) return [];

  const targetCode = bookCode.trim().toLowerCase();
  
  // 💡 [0]번 열의 bookcode와 정확히 일치하는 행만 추출
  const filtered = rows.slice(1).filter(row => {
    const rowCode = (row[0] || '').trim().toLowerCase();
    return rowCode === targetCode;
  }).map(row => {
    return {
      unit: (row[2] || '').replace(/^"|"$/g, '').trim(), // [2]번 열이 단원명
      start_page: (row[3] || '0').replace(/[^0-9]/g, '').trim() || '0', // [3]번 열이 시작P
      end_page: (row[4] || '0').replace(/[^0-9]/g, '').trim() || '0'    // [4]번 열이 끝P
    };
  });

  console.log(`✅ [GoogleSheets] Found ${filtered.length} units for bookcode: ${bookCode}`);
  return filtered;
}
