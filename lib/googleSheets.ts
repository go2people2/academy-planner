/**
 * API 키 없이 공개된 구글 시트 데이터를 가져오는 유틸리티
 */

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID_TEXTBOOK_MASTER;

export interface TextbookMaster {
  title: string;
  grade: string;
  course: string;
  tabName: string;
  status: string;
}

/**
 * 구글 시트를 CSV 형식으로 다운로드하여 파싱합니다.
 */
async function fetchSheetAsCsv(tabName: string) {
  try {
    if (!SHEET_ID) {
      console.error("❌ [GoogleSheets] SHEET_ID is missing! Check your .env.local");
      return [];
    }

    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
    console.log(`🌐 [GoogleSheets] Fetching: ${tabName} ...`);
    
    const response = await fetch(url, { cache: 'no-store' });
    const text = await response.text();
    
    if (!response.ok) {
      console.error(`❌ [GoogleSheets] HTTP Error: ${response.status}`);
      return [];
    }

    if (text.includes('<!DOCTYPE html>') || text.includes('google-signin')) {
      console.error(`❌ [GoogleSheets] Permission Denied or Invalid Sheet ID. Make sure it's public.`);
      return [];
    }

    // 가장 단순하고 확실한 줄바꿈 분리
    const rows = text.split(/\r?\n/).map(row => {
      // 따옴표로 감싸진 셀 처리
      return row.split('","').map(cell => cell.replace(/^"|"$/g, ''));
    });

    console.log(`✅ [GoogleSheets] Successfully fetched ${rows.length} rows from ${tabName}`);
    return rows;
  } catch (e) {
    console.error(`❌ [GoogleSheets] Critical Error:`, e);
    return [];
  }
}

export async function fetchTextbookMasterList(): Promise<TextbookMaster[]> {
  const rows = await fetchSheetAsCsv('master');
  if (!rows || rows.length <= 1) {
    console.warn("⚠️ [GoogleSheets] No data found in 'master' tab.");
    return [];
  }

  return rows.slice(1).map((row) => ({
    title: row[0] || '',
    grade: row[1] || '',
    course: row[2] || '',
    tabName: row[3] || '',
    status: row[4] || '',
  })).filter(item => item.title && item.status !== '비활성');
}

export async function fetchTextbookUnits(tabName: string) {
  const rows = await fetchSheetAsCsv(tabName);
  return rows.slice(1);
}
