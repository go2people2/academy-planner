import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyHostRequest } from '@/lib/server/hostAuth';
import { getAcademyServiceMode } from '@/lib/serviceMode';
import { retireTeacher } from '@/lib/concurrency/teacherRetire';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    // 1. 호스트 토큰 인증
    const auth = await verifyHostRequest(req, supabaseAdmin);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error_code: auth.errorCode, error: auth.error },
        { status: auth.status }
      );
    }

    const academyId = auth.academyId;

    // 2. 학원 서비스 모드 검증 (전용 학원만 허용)
    const serviceMode = await getAcademyServiceMode(academyId, supabaseAdmin);
    if (serviceMode !== 'standalone_hokmanote') {
      return NextResponse.json(
        {
          success: false,
          error_code: 'INTEGRATED_ACADEMY_RESTRICTED',
          error: '통합 학원의 교사 퇴사 처리는 AMS 웹에서만 가능합니다.',
        },
        { status: 403 }
      );
    }

    // 3. 요청 본문 파싱 및 검증
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_PAYLOAD', error: '요청 본문이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const teacherId = body.teacher_id;
    if (typeof teacherId !== 'string' || !UUID_REGEX.test(teacherId)) {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_UUID_FORMAT', error: '올바른 형식의 teacher_id (UUID)가 필요합니다.' },
        { status: 400 }
      );
    }

    // 4. 퇴사 처리 실행
    const result = await retireTeacher(academyId, teacherId, supabaseAdmin);

    if (!result.success) {
      let status = 500;
      if (result.error_code === 'TEACHER_NOT_FOUND') status = 404;
      else if (result.error_code === 'TEACHER_HAS_ASSIGNED_STUDENTS') status = 409;
      else if (result.error_code === 'CANNOT_RETIRE_ADMIN') status = 400;

      return NextResponse.json(
        {
          success: false,
          error_code: result.error_code,
          error: result.error,
          assigned_count: result.assigned_count,
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      teacher_id: teacherId,
    });
  } catch (err: any) {
    console.error('[teachers/retire] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
