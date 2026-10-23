import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, authenticateDeviceRequest } from '../authHelper';

/**
 * 💡 GET /api/app/v1/wrong-answers/archive
 * 지정 일수(기본 30일)가 지난 완료 오답 목록 조회 (백업 CSV용)
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 기기 토큰 검증 및 academy_id 추출 (학원 격리 보장)
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    // 2. 기준 일수(days) 파싱 (기본값 30일, 최소 1일)
    const { searchParams } = new URL(req.url);
    const parsedDays = parseInt(searchParams.get('days') || '30', 10);
    const days = isNaN(parsedDays) || parsedDays < 1 ? 30 : parsedDays;

    const thresholdMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const thresholdIso = new Date(thresholdMs).toISOString();

    // 3. 본인 학원의 30일 지난 완료(status='completed') 오답 조회
    const { data, count, error } = await supabaseAdmin
      .from('wrong_answer_submissions_v3')
      .select('*', { count: 'exact' })
      .eq('academy_id', academyId)
      .eq('status', 'completed')
      .lt('created_at', thresholdIso)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to query wrong_answer_submissions_v3 archive:', error);
      return NextResponse.json(
        { success: false, error: '아카이브 대상 오답 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: count ?? (data?.length || 0),
      submissions: data || [],
    });
  } catch (err: any) {
    console.error('Exception in wrong-answers archive GET route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 💡 DELETE /api/app/v1/wrong-answers/archive
 * 지정 일수(기본 30일)가 지난 완료 오답 일괄 영구 삭제
 */
export async function DELETE(req: NextRequest) {
  try {
    // 1. 기기 토큰 검증 및 academy_id 추출 (학원 격리 보장)
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    // 2. 기준 일수(days) 파싱 (기본값 30일, 최소 1일)
    const { searchParams } = new URL(req.url);
    const parsedDays = parseInt(searchParams.get('days') || '30', 10);
    const days = isNaN(parsedDays) || parsedDays < 1 ? 30 : parsedDays;

    const thresholdMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const thresholdIso = new Date(thresholdMs).toISOString();

    // 3. 본인 학원의 30일 지난 완료(status='completed') 오답 일괄 삭제
    const { data, error } = await supabaseAdmin
      .from('wrong_answer_submissions_v3')
      .delete()
      .eq('academy_id', academyId)
      .eq('status', 'completed')
      .lt('created_at', thresholdIso)
      .select('id');

    if (error) {
      console.error('Failed to delete wrong_answer_submissions_v3 archive:', error);
      return NextResponse.json(
        { success: false, error: '아카이브 오답 삭제 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted_count: data?.length || 0,
    });
  } catch (err: any) {
    console.error('Exception in wrong-answers archive DELETE route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
