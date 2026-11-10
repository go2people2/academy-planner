import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyHostRequest } from '@/lib/server/hostAuth';
import { dischargeStudent } from '@/lib/concurrency/studentDischarge';

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
    // 1. 호스트 토큰 인증 (기기 및 오답노트 모듈 권한 검증)
    const auth = await verifyHostRequest(req, supabaseAdmin);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error_code: auth.errorCode, error: auth.error },
        { status: auth.status }
      );
    }

    const academyId = auth.academyId;

    // 2. 요청 본문 파싱 및 검증
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_PAYLOAD', error: '요청 본문이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const studentId = body.student_id;
    if (typeof studentId !== 'string' || !UUID_REGEX.test(studentId)) {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_UUID_FORMAT', error: '올바른 형식의 student_id (UUID)가 필요합니다.' },
        { status: 400 }
      );
    }

    // 3. 학원 관리자(admin) 인증·권한 검증
    const adminTeacherId = body.admin_teacher_id;
    if (!adminTeacherId || typeof adminTeacherId !== 'string' || !UUID_REGEX.test(adminTeacherId)) {
      return NextResponse.json(
        {
          success: false,
          error_code: 'ADMIN_TEACHER_ID_REQUIRED',
          error: '퇴원 처리를 승인한 관리자 ID(admin_teacher_id)가 필요합니다.',
        },
        { status: 400 }
      );
    }

    const { data: adminTeacher, error: adminErr } = await supabaseAdmin
      .from('ams_teachers')
      .select('id, academy_id, role, is_deleted')
      .eq('id', adminTeacherId)
      .eq('academy_id', academyId)
      .eq('role', 'admin')
      .eq('is_deleted', false)
      .maybeSingle();

    if (adminErr) {
      console.error('[students/discharge] Admin query error:', adminErr);
      return NextResponse.json(
        { success: false, error: '관리자 권한 확인 중 데이터베이스 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!adminTeacher) {
      return NextResponse.json(
        {
          success: false,
          error_code: 'ADMIN_PERMISSION_REQUIRED',
          error: '해당 학원의 활성 관리자(원장) 계정만 학생 퇴원을 처리할 수 있습니다.',
        },
        { status: 403 }
      );
    }

    // 4. 퇴원 처리 실행 (단독 및 병행 학원 공통 허용, 멱등성 및 원자적 DB RPC 보장)
    const result = await dischargeStudent(academyId, studentId, body.reason, supabaseAdmin);

    if (!result.success) {
      const status = result.error_code === 'STUDENT_NOT_FOUND' ? 404 : 500;
      return NextResponse.json(
        { success: false, error_code: result.error_code, error: result.error },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      student_id: result.student_id,
      last_teacher_id: result.last_teacher_id,
    });
  } catch (err: any) {
    console.error('[students/discharge] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
