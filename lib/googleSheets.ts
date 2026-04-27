/**
 * API 키 없이 공개된 구글 시트 데이터를 가져오는 유틸리티
 */

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

export interface TextbookMaster {
  title: string;
  grade: string;
  course: string;
  tabName: string;
  status: string;
}

/**
 * 구글 시트를 CSV 형식으로 다운로드하여 파싱합니다.
 * (API 키가 필요 없는 가장 간편한 방식)
 */
async function fetchSheetAsCsv(tabName: string) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeShadowURIComponent(tabName)}`;
    const response = await fetch(url);
    const text = await response.text();
    
    // CSV 파싱 (단순 쉼표 분리, 따옴표 처리)
    return text.split('\n').map(row => 
      row.split('","').map(cell => cell.replace(/"/g, ''))
    );
  } catch (e) {
    console.error(`Error fetching tab ${tabName}:`, e);
    return [];
  }
}

// 부모 컴포넌트 호환용 인코딩 함수
function encodeShadowURIComponent(str: string) {
  return encodeURIComponent(str);
}

export async function fetchTextbookMasterList(): Promise<TextbookMaster[]> {
  if (!SHEET_ID) return [];

  const rows = await fetchSheetAsCsv('Master');
  if (rows.length <= 1) return [];

  // 첫 번째 행(헤더) 제외
  return rows.slice(1).map((row) => ({
    title: row[0] || '',
    grade: row[1] || '',
    course: row[2] || '',
    tabName: row[3] || '',
    status: row[4] || '',
  })).filter(item => item.title && item.status !== '비활성');
}

export async function fetchTextbookUnits(tabName: string) {
  if (!SHEET_ID) return [];
  const rows = await fetchSheetAsCsv(tabName);
  return rows.slice(1); // 헤더 제외 데이터만
}
