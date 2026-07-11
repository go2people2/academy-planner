import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// 💡 안전한 서버 사이드 Admin 클라이언트 생성 (Auth 유저 삭제 권한 필요)
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { academyId, confirmSlug } = body;

    // 💡 [안전장치 2] 철저한 UUID 및 빈 값 유효성 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!academyId || !uuidRegex.test(academyId) || !confirmSlug) {
      return NextResponse.json(
        { success: false, error: '유효한 학원 ID와 확인용 슬러그가 필요합니다.' },
        { status: 400 }
      );
    }

    // 💡 1. 요청자 마스터 권한(master) 검증
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    let { data: { session } } = await supabaseAuth.auth.getSession();

    // 쿠키 세션 실패 시 Authorization Bearer 헤더 검증 (API Direct Call 대응)
    if (!session) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (!userErr && user) {
          session = { user } as any;
        }
      }
    }

    if (!session) {
      return NextResponse.json({ success: false, error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const reqRole = session.user.app_metadata?.role;
    if (reqRole !== 'master') {
      return NextResponse.json({ success: false, error: '권한이 없는 요청입니다. (Master Only)' }, { status: 403 });
    }

    // 💡 2. [안전장치 1 적용] 학원 ID와 입력한 확인용 슬러그가 일치하는지 실제 DB 대조
    const { data: targetAcademy, error: acFindErr } = await supabaseAdmin
      .from('ams_academies')
      .select('id, slug, academy_name')
      .eq('id', academyId)
      .maybeSingle();

    if (acFindErr || !targetAcademy) {
      return NextResponse.json({ success: false, error: '삭제할 학원 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 입력한 슬러그와 실제 DB의 슬러그가 정확히 일치하는지 최종 대조
    if (targetAcademy.slug !== confirmSlug.trim().toLowerCase()) {
      return NextResponse.json({ 
        success: false, 
        error: `보안 불일치: 입력하신 슬러그 [${confirmSlug}]가 실제 학원 슬러그 [${targetAcademy.slug}]와 일치하지 않습니다.` 
      }, { status: 400 });
    }

    console.log(`⚠️ [SECURITY] 마스터에 의해 학원 삭제 절차 돌입: ${targetAcademy.academy_name} (${targetAcademy.slug})`);

    // 💡 3. [안전장치 3 적용] 오직 해당 학원 소속 교사의 Auth 계정만 솎아내어 삭제
    const { data: teachers, error: tErr } = await supabaseAdmin
      .from('ams_teachers')
      .select('id, user_id')
      .eq('academy_id', academyId);

    if (tErr) {
      return NextResponse.json({ success: false, error: `소속 교사 조회 실패: ${tErr.message}` }, { status: 500 });
    }

    for (const teacher of (teachers || [])) {
      if (teacher.user_id) {
        const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(teacher.user_id);
        if (deleteAuthErr) {
          console.warn(`[WARNING] Auth User (${teacher.user_id}) 삭제 실패:`, deleteAuthErr.message);
        }
      }
    }

    // 💡 4. [안전장치 3 적용] 연쇄 하위 데이터 중 '해당 학원 전용 데이터'만 정확하게 삭제 (공용 테이블 미포함)
    await supabaseAdmin.from('ams_student_management_logs').delete().eq('academy_id', academyId);
    await supabaseAdmin.from('ams_session_logs').delete().eq('academy_id', academyId);
    await supabaseAdmin.from('ams_students').delete().eq('academy_id', academyId);
    await supabaseAdmin.from('ams_teachers').delete().eq('academy_id', academyId);

    // 💡 5. 학원 본체 최종 삭제
    const { error: acErr } = await supabaseAdmin.from('ams_academies').delete().eq('id', academyId);
    if (acErr) {
      return NextResponse.json({ success: false, error: `학원 최종 삭제 실패: ${acErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `[${targetAcademy.academy_name}] 학원 및 하위 데이터(Auth 계정 포함)가 안전하게 영구 삭제되었습니다.`
    });

  } catch (err: any) {
    console.error('Delete Academy Fatal Error:', err);
    return NextResponse.json({ success: false, error: `서버 오류가 발생했습니다: ${err.message}` }, { status: 500 });
  }
}
