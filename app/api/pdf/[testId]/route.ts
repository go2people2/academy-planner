import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * 💡 로컬 서버의 특정 폴더에서 PDF 파일을 찾아 브라우저로 스트리밍하는 API
 * 사용 예: /api/pdf/1001
 */
export async function GET(
  request: Request,
  { params }: { params: { testId: string } }
) {
  try {
    const { testId } = params;

    // 💡 PDF 자료 창고 기본 경로 (환경 변수로 관리 권장)
    // 예: C:/AMS_LIBRARY/PDFs
    const LIBRARY_PATH = process.env.LOCAL_PDF_LIBRARY_PATH || 'C:/AMS_LIBRARY/PDFs';

    // 💡 재귀적으로 파일을 검색하거나 규칙에 따라 경로 생성
    // 임시로 직접 매칭 시도 (실제 운영 시에는 [유형]/[ID].pdf 등 상세 로직 필요)
    let filePath = '';
    
    // 1단계: 간단하게 ID.pdf 검색
    const directPath = path.join(LIBRARY_PATH, `${testId}.pdf`);
    if (fs.existsSync(directPath)) {
      filePath = directPath;
    } else {
      // 2단계: 하위 폴더 재귀 검색 (실제 구현 필요)
      // 현재는 파일이 없을 경우 404 반환
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 💡 파일을 읽어 버퍼로 변환
    const fileBuffer = fs.readFileSync(filePath);

    // 💡 적절한 헤더와 함께 PDF 스트리밍
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${testId}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('❌ [PDF API] Error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
