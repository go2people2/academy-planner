import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * 💡 테스트 코드(test_code)를 기반으로 정답 데이터를 반환하는 API
 * Supabase 'ams_tests' 테이블에서 데이터를 가져옵니다.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;

    // 💡 Supabase에서 ams_tests 테이블 조회 (대소문자 구분 없이 검색)
    const { data: testData, error } = await supabase
      .from('ams_tests')
      .select('*')
      .ilike('test_code', testId.trim())
      .maybeSingle();

    if (error) throw error;

    if (!testData) {
      return NextResponse.json({ error: '존재하지 않는 테스트 번호입니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      title: testData.title,
      mcCount: testData.total_questions,
      // 💡 단순 정답 배열이 아닌, 문제별 메타데이터 전체를 전달
      // 구조: [{ ans: "1", video: "...", pdf: "...", desc: "..." }, ...]
      mcAnswers: testData.answers, 
      descCount: 0 
    });

  } catch (error: any) {
    console.error('❌ [Test API] Error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
