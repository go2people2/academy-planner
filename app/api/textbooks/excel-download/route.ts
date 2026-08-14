import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { fetchRawSheetRows } from '@/lib/googleSheets';

export async function GET() {
  try {
    // 1. Google Sheet 원본 데이터 수집
    const masterRows = await fetchRawSheetRows('master');
    const unitPageRows = await fetchRawSheetRows('unit-page');

    // 2. master 시트 데이터 정제 (7개 컬럼 원본 헤더)
    const masterHeader = ['bookcode', 'book', 'grade', 'status', 'e-period', 'odap_name', 'unit-page'];
    const masterDataRows: (string | number)[][] = [masterHeader];

    if (masterRows && masterRows.length > 1) {
      masterRows.slice(1).forEach(row => {
        const bookcode = (row[0] || '').trim();
        if (!bookcode) return;
        masterDataRows.push([
          bookcode,
          (row[1] || '').trim(),
          (row[2] || '').trim(),
          (row[3] || '').trim(),
          (row[4] || '').trim(),
          (row[5] || '').trim(),
          (row[6] || '').trim()
        ]);
      });
    }

    // 3. unit-page 시트 데이터 정제 (5개 컬럼 원본 헤더)
    const unitPageHeader = ['bookcode', 'book', 'unit', 'start-page', 'end-page'];
    const unitPageDataRows: (string | number)[][] = [unitPageHeader];

    if (unitPageRows && unitPageRows.length > 1) {
      unitPageRows.slice(1).forEach(row => {
        const bookcode = (row[0] || '').trim();
        if (!bookcode) return;
        const rawStart = (row[3] || '0').replace(/[^0-9]/g, '').trim();
        const rawEnd = (row[4] || '0').replace(/[^0-9]/g, '').trim();
        const startPg = parseInt(rawStart, 10);
        const endPg = parseInt(rawEnd, 10);

        unitPageDataRows.push([
          bookcode,
          (row[1] || '').trim(),
          (row[2] || '').trim(),
          isNaN(startPg) ? 0 : startPg,
          isNaN(endPg) ? 0 : endPg
        ]);
      });
    }

    // 4. XLSX 워크북 생성
    const wb = XLSX.utils.book_new();
    const wsMaster = XLSX.utils.aoa_to_sheet(masterDataRows);
    const wsUnitPage = XLSX.utils.aoa_to_sheet(unitPageDataRows);

    XLSX.utils.book_append_sheet(wb, wsMaster, 'master');
    XLSX.utils.book_append_sheet(wb, wsUnitPage, 'unit-page');

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 5. 한국 시간 (Asia/Seoul) 기준 YYYY-MM-DD 파일명 포맷
    const now = new Date();
    const kstFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const dateStr = kstFormatter.format(now); // YYYY-MM-DD
    const filename = `AMS_교재카탈로그_${dateStr}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
      }
    });
  } catch (error) {
    // 민감 정보 노출 방지 일반 안내 메시지
    console.error('[Excel Download API Error]', error);
    return NextResponse.json(
      { error: '교재 카탈로그 Excel 다운로드에 실패했습니다. 구글 시트 연결을 확인하고 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
