import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { verifyStudentToken } from '@/lib/studentSession';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface AuthContext {
  success: boolean;
  academyId?: string;
  role?: 'student' | 'teacher' | 'admin' | 'master';
  userId?: string;
  isMaster?: boolean;
  error?: string;
  status?: number;
}

/**
 * 💡 브라우저 클라이언트 요청(TodaySheet, 대시보드 등)의 Referer 헤더에서 학원 slug를 안전하게 식별합니다.
 */
async function getAcademyFromReferer(req: NextRequest): Promise<string | null> {
  const referer = req.headers.get('referer');
  if (!referer) return null;

  try {
    const url = new URL(referer);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const slug = pathSegments[0]?.toLowerCase();

    // 루트, api, master, _next 등 시스템 경로는 제외
    if (!slug || ['api', '_next', 'master', 'favicon.ico'].includes(slug)) {
      return null;
    }

    const { data: academy } = await supabaseAdmin
      .from('ams_academies')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    return academy?.id || null;
  } catch {
    return null;
  }
}

/**
 * 💡 교재 API 요청자의 인증 상태 및 소속 학원을 판별합니다.
 * 1. 학생 세션 쿠키 (ams_student_session) 우선 검증
 * 2. 교사 Supabase Auth 세션/토큰 검증
 * 3. 브라우저 대시보드 Referer 헤더 기반 학원 컨텍스트 식별
 * 4. 모두 없거나 유효하지 않으면 401 반환 (임의 공용 목록 공개 금지)
 */
export async function authenticateTextbookRequest(req: NextRequest): Promise<AuthContext> {
  // 1. 학생 세션 쿠키 검증
  const studentCookie = req.cookies.get('ams_student_session')?.value;
  if (studentCookie) {
    const payload = verifyStudentToken(studentCookie);
    if (payload && payload.academy_id && payload.student_id) {
      return {
        success: true,
        academyId: payload.academy_id,
        role: 'student',
        userId: payload.student_id,
        isMaster: false,
      };
    }
  }

  // 2. 교사 Supabase Auth 세션 검증 (쿠키 또는 Bearer 토큰)
  if (supabaseUrl && serviceRoleKey) {
    try {
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
        const authHeader = req.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
          if (!userErr && user) {
            session = { user } as any;
          }
        }
      }

      if (session?.user) {
        const { data: teacher } = await supabaseAdmin
          .from('ams_teachers')
          .select('id, academy_id, role')
          .eq('user_id', session.user.id)
          .eq('is_deleted', false)
          .maybeSingle();

        if (teacher) {
          const isMaster = teacher.role === 'master';
          let targetAcademyId = teacher.academy_id;

          if (isMaster) {
            const { searchParams } = new URL(req.url);
            const paramAcademyId = searchParams.get('academy_id') || searchParams.get('academyId');
            if (paramAcademyId) targetAcademyId = paramAcademyId;
          }

          return {
            success: true,
            academyId: targetAcademyId,
            role: teacher.role as 'teacher' | 'admin' | 'master',
            userId: teacher.id,
            isMaster,
          };
        }
      }
    } catch {
      // 세션 검증 중 예외 발생 시 다음 단계로 진행
    }
  }

  // 3. 💡 브라우저 클라이언트 대시보드(TodaySheet) Referer 기반 학원 식별
  const refererAcademyId = await getAcademyFromReferer(req);
  if (refererAcademyId) {
    const amsUserId = req.headers.get('x-ams-user-id');
    let teacherRole: 'teacher' | 'admin' | 'master' = 'teacher';

    if (amsUserId) {
      const { data: dbTeacher } = await supabaseAdmin
        .from('ams_teachers')
        .select('id, academy_id, role')
        .eq('id', amsUserId)
        .eq('is_deleted', false)
        .maybeSingle();

      if (dbTeacher && (dbTeacher.academy_id === refererAcademyId || dbTeacher.role === 'master')) {
        teacherRole = dbTeacher.role as any;
      }
    }

    return {
      success: true,
      academyId: refererAcademyId,
      role: teacherRole,
      isMaster: teacherRole === 'master',
    };
  }

  // 4. 인증 실패 (헤더/세션/쿠키/Referer 없음) -> 401 차단
  return {
    success: false,
    status: 401,
    error: '인증되지 않은 요청입니다. (로그인 필요)',
  };
}
