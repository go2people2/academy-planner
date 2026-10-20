import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyHostRequest } from '@/lib/server/hostAuth';

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

export async function GET(req: NextRequest) {
  try {
    // 1. 호스트 토큰 및 오답노트 모듈 이용 권한 검증 (공통 유틸 재사용)
    const auth = await verifyHostRequest(req, supabaseAdmin);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error_code: auth.errorCode, error: auth.error },
        { status: auth.status }
      );
    }

    const { academyId: amsAcademyId, slug } = auth;

    // 2. 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const loginId = searchParams.get('login_id')?.trim();
    const version = (searchParams.get('version') || searchParams.get('v'))?.toLowerCase();

    if (!loginId) {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_LOGIN_ID', error: 'login_id(로그인 아이디) 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 💡 3. v3 명시적 조회: ams_teachers 테이블에서 정확한 login_id 조회
    if (version === 'v3' || version === '3') {
      const cleanLoginId = loginId.toLowerCase();

      const { data: teacher, error: teacherErr } = await supabaseAdmin
        .from('ams_teachers')
        .select('id, name, login_id, academy_id, role, is_deleted')
        .eq('academy_id', amsAcademyId)
        .or(`login_id.eq.${loginId},login_id.eq.${cleanLoginId}`)
        .maybeSingle();

      if (teacherErr) {
        console.error('[teachers/resolve] Failed to resolve teacher from ams_teachers:', teacherErr);
        return NextResponse.json(
          { success: false, error: '교사 정보 조회 중 데이터베이스 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      // v3 미등록 시 구형 teachers UUID로 폴백하지 않고 명확한 오류 반환
      if (!teacher) {
        return NextResponse.json(
          {
            success: false,
            error_code: 'TEACHER_NOT_FOUND',
            error: '해당 학원에 등록되지 않은 교사 아이디입니다.',
          },
          { status: 404 }
        );
      }

      // 퇴사 교사는 활성 교사로 연결하지 않고 명시적으로 구분
      if (teacher.is_deleted === true) {
        return NextResponse.json(
          {
            success: false,
            error_code: 'TEACHER_RETIRED',
            error: '퇴사 처리된 교사 아이디입니다.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        teacher: {
          teacher_id: teacher.id,
          id: teacher.id,
          academy_id: teacher.academy_id,
          login_id: teacher.login_id,
          name: teacher.name,
          role: teacher.role,
        },
      });
    }

    // 💡 4. 구형 호환 로직 (version != 'v3'): academies + teachers 테이블 조회
    const { data: waAcademy, error: waAcErr } = await supabaseAdmin
      .from('academies')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (waAcErr || !waAcademy) {
      return NextResponse.json(
        { success: false, error: '해당 학원의 오답노트 지점 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const targetAcademyId = waAcademy.id;
    const targetEmail = `${slug}_${loginId}`;

    const { data: legacyTeacher, error: legacyErr } = await supabaseAdmin
      .from('teachers')
      .select('id, name')
      .eq('academy_id', targetAcademyId)
      .eq('email', targetEmail)
      .maybeSingle();

    if (legacyErr) {
      console.error('[teachers/resolve] Legacy query error:', legacyErr);
      return NextResponse.json(
        { success: false, error: '교사 정보 조회 중 서버 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!legacyTeacher) {
      return NextResponse.json(
        { success: false, error: '해당 학원에 등록되지 않은 교사 로그인 아이디입니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      teacher: {
        id: legacyTeacher.id,
        name: legacyTeacher.name,
        login_id: loginId,
      },
    });
  } catch (err: any) {
    console.error('[teachers/resolve] Fatal Exception:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
