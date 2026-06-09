import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PATCH(request: Request, context: any) {
  try {
    const params = await context.params;
    const targetTeacherId = params.id;
    const updates = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: '서버 환경 설정 오류' }, { status: 500 });
    }

    // 💡 1. [보안] 요청자 인증 정보 확보 (Cookies 기반 Supabase SSR Client)
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    });

    const { data: { session } } = await supabaseAuth.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    // 💡 2. [보안] 요청자 권한(Role) 확인 (Admin 또는 Master만 허용)
    const reqRole = session.user.app_metadata?.role;
    const reqAcademyId = session.user.app_metadata?.academy_id;

    if (reqRole !== 'admin' && reqRole !== 'master') {
      return NextResponse.json({ error: '권한이 없습니다. (Forbidden)' }, { status: 403 });
    }

    // 관리자 권한용 Service Role Client 생성
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 💡 3. [보안] 대상 교사 조회 및 학원 소속(Academy Bound) 검증
    const { data: targetTeacher, error: fetchErr } = await supabaseAdmin
      .from('ams_teachers')
      .select('user_id, role, academy_id')
      .eq('id', targetTeacherId)
      .single();

    if (fetchErr || !targetTeacher) {
      return NextResponse.json({ error: '대상 교사 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Master가 아닌 Admin의 경우, 반드시 같은 학원 소속 교사만 수정 가능하도록 제한
    if (reqRole === 'admin' && reqAcademyId !== targetTeacher.academy_id) {
      return NextResponse.json({ error: '다른 학원의 데이터는 수정할 수 없습니다.' }, { status: 403 });
    }

    // 💡 4. 권한(role) 변경 시 이중 동기화 및 롤백 로직 실행
    if ('role' in updates) {
      if (targetTeacher.user_id) {
        // [동기화 1] Auth 스키마(app_metadata) 우선 갱신
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(targetTeacher.user_id, {
          app_metadata: { role: updates.role, academy_id: targetTeacher.academy_id, teacher_id: targetTeacherId }
        });

        if (authErr) {
          console.error('[API] Auth metadata update failed:', authErr.message);
          return NextResponse.json({ error: '권한 동기화 실패 (Auth Layer)' }, { status: 500 });
        }

        // [동기화 2] Public 스키마(ams_teachers) 갱신
        const { error: dbErr } = await supabaseAdmin
          .from('ams_teachers')
          .update(updates)
          .eq('id', targetTeacherId);

        // [롤백] Public 갱신 실패 시 Auth 스키마 원복
        if (dbErr) {
          console.error('[API] Public schema update failed. Rolling back Auth metadata...', dbErr.message);
          await supabaseAdmin.auth.admin.updateUserById(targetTeacher.user_id, {
            app_metadata: { role: targetTeacher.role, academy_id: targetTeacher.academy_id, teacher_id: targetTeacherId }
          });
          return NextResponse.json({ error: '권한 업데이트 실패 및 롤백됨' }, { status: 500 });
        }
      } else {
        // Auth 매핑이 안 된 계정 (임시)
        const { error: dbErr } = await supabaseAdmin.from('ams_teachers').update(updates).eq('id', targetTeacherId);
        if (dbErr) return NextResponse.json({ error: 'DB 업데이트 실패' }, { status: 500 });
      }
    } else {
      // 일반 필드(이름 등) 수정
      const { error: dbErr } = await supabaseAdmin.from('ams_teachers').update(updates).eq('id', targetTeacherId);
      if (dbErr) return NextResponse.json({ error: 'DB 업데이트 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Teacher update critical error:', error);
    return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
  }
}
