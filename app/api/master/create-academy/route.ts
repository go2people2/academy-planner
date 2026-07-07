import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 💡 안전한 서버 사이드 Admin 클라이언트 생성 (Auth 유저 생성 권한 필요)
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
    const { academyName, slug, username, password } = body;

    // 1. 파라미터 유효성 검증
    if (!academyName || !slug || !username || !password) {
      return NextResponse.json(
        { success: false, error: '모든 필수 입력 값을 기입해 주세요.' },
        { status: 400 }
      );
    }

    const cleanSlug = slug.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    // 2. 슬러그 중복 검사
    const { data: existingAc } = await supabaseAdmin
      .from('ams_academies')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (existingAc) {
      return NextResponse.json(
        { success: false, error: `슬러그 [${cleanSlug}]는 이미 사용 중입니다. 다른 슬러그를 지정해 주세요.` },
        { status: 400 }
      );
    }

    // 3. Supabase Auth 유저 생성 (이메일 기반 매핑 포맷)
    const email = `${cleanUsername}@hokma-academy.com`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth User Creation Error:', authError);
      return NextResponse.json(
        { success: false, error: `인증 서버 유저 생성 실패: ${authError.message}` },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // 4. ams_academies 학원 테이블 인서트
    const { data: academyData, error: acError } = await supabaseAdmin
      .from('ams_academies')
      .insert([
        {
          academy_name: academyName.trim(),
          slug: cleanSlug,
          theme: 'blue',
          admin_password: password,
          operation_settings: {
            holidays: [],
            test_presets: [],
            timer_presets: [12, 40, 45],
            late_threshold: 10,
            alert_threshold: 15,
            default_score_cut: 70,
            first_period_time: '16:00',
            textbook_categories: ['초5', '초6', '중1', '중2', '중3', '대수', '미적분1', '확통']
          }
        }
      ])
      .select('id')
      .single();

    if (acError) {
      console.error('Academy Insert Error:', acError);
      // 💡 롤백: 생성된 Auth 유저 삭제
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { success: false, error: `학원 정보 저장 실패: ${acError.message}` },
        { status: 400 }
      );
    }

    const academyId = academyData.id;

    // 5. ams_teachers 선생님 테이블 인서트 및 연동
    const { data: teacherData, error: tError } = await supabaseAdmin
      .from('ams_teachers')
      .insert([
        {
          academy_id: academyId,
          name: '원장선생님',
          login_id: cleanUsername,
          password: password,
          role: 'admin',
          user_id: userId,
          initials: 'M'
        }
      ])
      .select('id')
      .single();

    if (tError) {
      console.error('Teacher Insert Error:', tError);
      // 💡 롤백: 생성된 학원 정보 및 Auth 유저 삭제
      await supabaseAdmin.from('ams_academies').delete().eq('id', academyId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { success: false, error: `선생님 계정 연동 실패: ${tError.message}` },
        { status: 400 }
      );
    }

    // 💡 6. 생성된 원장선생님 Auth 계정에 app_metadata 동기화 설정 (권한 검증용)
    const { error: authMetaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        role: 'admin',
        academy_id: academyId,
        teacher_id: teacherData.id
      }
    });

    if (authMetaError) {
      console.error('Auth User app_metadata Sync Error:', authMetaError);
      // 💡 롤백: 생성된 선생님 정보, 학원 정보 및 Auth 유저 삭제
      await supabaseAdmin.from('ams_teachers').delete().eq('id', teacherData.id);
      await supabaseAdmin.from('ams_academies').delete().eq('id', academyId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { success: false, error: `선생님 권한 동기화 실패: ${authMetaError.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '학원 및 관리자 계정이 성공적으로 자동 개설되었습니다.',
      academyId,
      userId
    });

  } catch (err: any) {
    console.error('Create Academy Fatal Error:', err);
    return NextResponse.json(
      { success: false, error: `서버 오류가 발생했습니다: ${err.message}` },
      { status: 500 }
    );
  }
}
