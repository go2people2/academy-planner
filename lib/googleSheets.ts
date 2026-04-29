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

    const rows = text.split(/\r?\n/).map(row => {
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

  // 변경된 헤더 순서: [0]bookcode, [1]book(title), [2]grade, [3]status, [4]e-period
  return rows.slice(1).map((row) => ({
    bookcode: row[0] || '',
    title: row[1] || '',
    grade: row[2] || '',
    status: row[3] || '',
    ePeriod: row[4] || '',
  })).filter(item => item.bookcode && item.status !== '비활성');
}

export async function fetchTextbookUnits(tabName: string) {
  const rows = await fetchSheetAsCsv(tabName);
  return rows.slice(1);
}
