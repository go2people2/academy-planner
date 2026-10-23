import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, authenticateDeviceRequest } from '../../wrong-answers/authHelper';

/**
 * 💡 POST /api/app/v1/catalog/sync
 * 호크마노트 v3 교재 카탈로그 동기화 RPC 프록시 (sync_problem_catalog_v3)
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 기기 토큰 검증 및 academy_id 추출 (학원 격리 보장)
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    // 2. 요청 Body 파싱 및 유효성 검증
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: '유효한 JSON 요청 본문이 필요합니다.' },
        { status: 400 }
      );
    }

    const { target_bookcodes, rows } = body || {};

    if (!Array.isArray(target_bookcodes) || target_bookcodes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'target_bookcodes는 비어 있지 않은 배열이어야 합니다.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { success: false, error: 'rows는 배열이어야 합니다.' },
        { status: 400 }
      );
    }

    // 3. Supabase RPC 실행 (토큰에서 추출한 academyId 강제 주입)
    const { data, error } = await supabaseAdmin.rpc('sync_problem_catalog_v3', {
      p_academy_id: academyId,
      p_target_bookcodes: target_bookcodes,
      p_rows: rows,
    });

    if (error) {
      console.error('Failed to execute sync_problem_catalog_v3 RPC:', error);
      return NextResponse.json(
        { success: false, error: error.message || '카탈로그 동기화 RPC 실행 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: data,
    });
  } catch (err: any) {
    console.error('Exception in catalog sync route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
