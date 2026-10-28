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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 💡 1. [보안] 요청자 인증 정보 확보
    // (1) 쿠키 기반 세션 복원 시도
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    });

    let { data: { session } } = await supabaseAuth.auth.getSession();
    
    // (2) 쿠키 세션 실패 시 Authorization Bearer 헤더 검증 (Fallback)
    if (!session) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (!userErr && user) {
          session = { user } as any;
        }
      }
    }

    if (!session) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    // 💡 2. [보안] 요청자 권한(Role) 확인 (Admin 또는 Master만 허용)
    const reqRole = session.user.app_metadata?.role;
    const reqAcademyId = session.user.app_metadata?.academy_id;

    if (reqRole !== 'admin' && reqRole !== 'master') {
      return NextResponse.json({ error: '권한이 없습니다. (Forbidden)' }, { status: 403 });
    }

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

    // 마스터가 아닌 사용자는 마스터 계정을 수정할 수 없음
    if (reqRole !== 'master' && targetTeacher.role === 'master') {
      return NextResponse.json({ error: '마스터 계정의 정보는 수정할 수 없습니다.' }, { status: 403 });
    }

    // 💡 4. [보안] 페이로드 타입 검증 및 허용 필드 화이트리스트 추출
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return NextResponse.json({ error: '유효하지 않은 요청 본문입니다.' }, { status: 400 });
    }

    const safeUpdates: Record<string, any> = {};

    if ('name' in updates) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) {
        return NextResponse.json({ error: '이름은 비어 있을 수 없습니다.' }, { status: 400 });
      }
      safeUpdates.name = updates.name.trim();
    }

    if ('initials' in updates) {
      if (typeof updates.initials !== 'string') {
        return NextResponse.json({ error: '이니셜 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      safeUpdates.initials = updates.initials.trim().toUpperCase();
    }

    if ('nickname' in updates) {
      if (updates.nickname !== null && typeof updates.nickname !== 'string') {
        return NextResponse.json({ error: '닉네임 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      safeUpdates.nickname = typeof updates.nickname === 'string' ? updates.nickname.trim() : null;
    }

    if ('phone' in updates) {
      if (updates.phone !== null && typeof updates.phone !== 'string') {
        return NextResponse.json({ error: '전화번호 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      safeUpdates.phone = typeof updates.phone === 'string' ? updates.phone.trim() : null;
    }

    // 💡 5. [보안] 역할(Role) 검증 및 승격 시도 차단
    if ('role' in updates) {
      const targetRole = updates.role;
      if (!['teacher', 'admin', 'master'].includes(targetRole)) {
        return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 });
      }

      if (reqRole !== 'master') {
        if (targetRole === 'master') {
          return NextResponse.json({ error: '마스터 권한을 부여할 수 없습니다.' }, { status: 403 });
        }
      }

      safeUpdates.role = targetRole;
    }

    // 수정 가능한 안전 필드가 없는 경우 (보호 필드만 전송되었거나 빈 페이로드)
    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: '수정할 수 있는 유효한 필드가 없습니다.' }, { status: 400 });
    }

    // 💡 6. 권한(role) 변경 시 이중 동기화 및 롤백 로직 실행 (safeUpdates만 사용)
    if ('role' in safeUpdates) {
      if (targetTeacher.user_id) {
        // [동기화 1] Auth 스키마(app_metadata) 우선 갱신
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(targetTeacher.user_id, {
          app_metadata: { role: safeUpdates.role, academy_id: targetTeacher.academy_id, teacher_id: targetTeacherId }
        });

        if (authErr) {
          console.error('[API] Auth metadata update failed:', authErr.message);
          return NextResponse.json({ error: '권한 동기화 실패 (Auth Layer)' }, { status: 500 });
        }

        // [동기화 2] Public 스키마(ams_teachers) 갱신
        const { error: dbErr } = await supabaseAdmin
          .from('ams_teachers')
          .update(safeUpdates)
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
        // Auth 매핑이 안 된 계정
        const { error: dbErr } = await supabaseAdmin.from('ams_teachers').update(safeUpdates).eq('id', targetTeacherId);
        if (dbErr) return NextResponse.json({ error: 'DB 업데이트 실패' }, { status: 500 });
      }
    } else {
      // 일반 필드 수정 (safeUpdates만 사용)
      const { error: dbErr } = await supabaseAdmin.from('ams_teachers').update(safeUpdates).eq('id', targetTeacherId);
      if (dbErr) return NextResponse.json({ error: 'DB 업데이트 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Teacher update critical error:', error);
    return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const params = await context.params;
    const targetTeacherId = params.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: '서버 환경 설정 오류' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 💡 1. [보안] 요청자 인증 정보 확보
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    });

    let { data: { session } } = await supabaseAuth.auth.getSession();
    
    if (!session) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (!userErr && user) {
          session = { user } as any;
        }
      }
    }

    if (!session) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    // 💡 2. [보안] 요청자 권한(Role) 확인 (Admin 또는 Master만 허용)
    const reqRole = session.user.app_metadata?.role;
    const reqAcademyId = session.user.app_metadata?.academy_id;

    if (reqRole !== 'admin' && reqRole !== 'master') {
      return NextResponse.json({ error: '권한이 없습니다. (Forbidden)' }, { status: 403 });
    }

    // 💡 3. [보안] 대상 교사 조회 및 학원 소속(Academy Bound) 검증
    const { data: targetTeacher, error: fetchErr } = await supabaseAdmin
      .from('ams_teachers')
      .select('user_id, role, academy_id')
      .eq('id', targetTeacherId)
      .single();

    if (fetchErr || !targetTeacher) {
      return NextResponse.json({ error: '대상 교사 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Master가 아닌 Admin의 경우, 반드시 같은 학원 소속 교사만 삭제 가능하도록 제한
    if (reqRole === 'admin' && reqAcademyId !== targetTeacher.academy_id) {
      return NextResponse.json({ error: '다른 학원의 데이터는 삭제할 수 없습니다.' }, { status: 403 });
    }

    // 자기 자신을 삭제할 수는 없도록 제한
    const reqTeacherId = session.user.app_metadata?.teacher_id;
    if (reqTeacherId === targetTeacherId) {
      return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 });
    }

    // 💡 4. 담당 학생 0명 검증 및 소프트 삭제(퇴사) 처리 일원화
    const { retireTeacher } = await import('@/lib/concurrency/teacherRetire');
    const retireResult = await retireTeacher(targetTeacher.academy_id, targetTeacherId, supabaseAdmin);

    if (!retireResult.success) {
      const status = retireResult.error_code === 'TEACHER_HAS_ASSIGNED_STUDENTS' ? 409 : 400;
      return NextResponse.json({
        error: retireResult.error || '교사 퇴사 처리에 실패했습니다.',
        error_code: retireResult.error_code,
        assigned_count: retireResult.assigned_count
      }, { status });
    }

    return NextResponse.json({ success: true, status: retireResult.status });
  } catch (error: any) {
    console.error('[API] Teacher delete critical error:', error);
    return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
  }
}
