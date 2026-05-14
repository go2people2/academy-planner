import { NextResponse } from 'next/server';
import { fetchTestAnswers } from '@/lib/googleSheets';

/**
 * 💡 테스트 ID(고유번호)를 기반으로 정답 데이터를 반환하는 API
 * 구글 시트 'tests' 탭에서 데이터를 가져옵니다.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;

    // 💡 구글 시트에서 실제 데이터 조회
    const testData = await fetchTestAnswers(testId);

    if (!testData) {
      return NextResponse.json({ error: '존재하지 않는 테스트 번호입니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...testData
    });

  } catch (error: any) {
    console.error('❌ [Test API] Error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
