import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
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
    // 1. 호스트 토큰 및 오답노트 모듈 권한 검증
    const auth = await verifyHostRequest(req, supabaseAdmin);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error_code: auth.errorCode, error: auth.error },
        { status: auth.status }
      );
    }

    const academyId = auth.academyId;

    // 2. 해당 학원의 전체 교사 목록 조회 (비밀번호 제외)
    const { data, error } = await supabaseAdmin
      .from('ams_teachers')
      .select('id, academy_id, name, login_id, role, created_at')
      .eq('academy_id', academyId)
      .order('name', { ascending: true });

    if (error) {
      console.error('[teachers] Failed to fetch teachers:', error);
      return NextResponse.json(
        { success: false, error: '교사 목록 조회 중 데이터베이스 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: (data || []).length,
      teachers: data || [],
    });
  } catch (err: any) {
    console.error('[teachers] GET Fatal Exception:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. 호스트 토큰 및 오답노트 모듈 권한 검증
    const auth = await verifyHostRequest(req, supabaseAdmin);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error_code: auth.errorCode, error: auth.error },
        { status: auth.status }
      );
    }

    const academyId = auth.academyId;

    // 2. 요청 Body 파싱 및 유효성 검사
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_PAYLOAD', error: '요청 본문이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const rawLoginId = typeof body.login_id === 'string' ? body.login_id : '';
    const rawName = typeof body.name === 'string' ? body.name : '';

    const cleanLoginId = rawLoginId.trim().toLowerCase();
    const cleanName = rawName.trim();

    if (!cleanLoginId || cleanLoginId.length < 3) {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_LOGIN_ID', error: '교사 로그인 아이디는 최소 3자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    if (!cleanName) {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_NAME', error: '교사 이름은 공백일 수 없습니다.' },
        { status: 400 }
      );
    }

    // 3. 전역 중복 사전 조회 (전체 ams_teachers 대상)
    const existingTeacher = await findTeacherByNormalizedLoginId(cleanLoginId);

    if (existingTeacher) {
      // 3-1. 같은 학원 소속인 경우: 기존 교사 정보 반환 (멱등성 보장, 기존 값 보존)
      if (existingTeacher.academy_id === academyId) {
        return NextResponse.json({
          success: true,
          created: false,
          teacher: {
            teacher_id: existingTeacher.id,
            id: existingTeacher.id,
            academy_id: existingTeacher.academy_id,
            login_id: existingTeacher.login_id,
            name: existingTeacher.name,
            role: existingTeacher.role,
          },
        });
      }

      // 3-2. 다른 학원에서 이미 사용 중인 경우: 409 반환
      return NextResponse.json(
        {
          success: false,
          error_code: 'LOGIN_ID_IN_USE',
          error: '다른 학원에서 이미 사용 중인 아이디입니다.',
        },
        { status: 409 }
      );
    }

    // 4. 신규 교사 등록 (role='teacher' 강제, 난수 더미 패스워드 채번)
    const newTeacherId = crypto.randomUUID();
    const dummyPassword = crypto.randomBytes(16).toString('hex');
    const initials = cleanName.charAt(0).toUpperCase() || 'T';

    const insertPayload = {
      id: newTeacherId,
      academy_id: academyId,
      name: cleanName,
      login_id: cleanLoginId,
      password: dummyPassword,
      role: 'teacher',
      initials: initials,
    };

    const { error: insErr } = await supabaseAdmin
      .from('ams_teachers')
      .insert([insertPayload]);

    if (insErr) {
      // 동시 요청으로 인한 유니크 충돌(23505) 재확인
      if (insErr.code === '23505') {
        const rechecked = await findTeacherByNormalizedLoginId(cleanLoginId);
        if (rechecked) {
          if (rechecked.academy_id === academyId) {
            return NextResponse.json({
              success: true,
              created: false,
              teacher: {
                teacher_id: rechecked.id,
                id: rechecked.id,
                academy_id: rechecked.academy_id,
                login_id: rechecked.login_id,
                name: rechecked.name,
                role: rechecked.role,
              },
            });
          }
          return NextResponse.json(
            {
              success: false,
              error_code: 'LOGIN_ID_IN_USE',
              error: '다른 학원에서 이미 사용 중인 아이디입니다.',
            },
            { status: 409 }
          );
        }
      }

      console.error('[teachers] Failed to insert new teacher:', insErr);
      return NextResponse.json(
        { success: false, error: '교사 등록 중 데이터베이스 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        created: true,
        teacher: {
          teacher_id: newTeacherId,
          id: newTeacherId,
          academy_id: academyId,
          login_id: cleanLoginId,
          name: cleanName,
          role: 'teacher',
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[teachers] Fatal Exception:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/** 💡 정규화된 login_id로 전역 교사 레코드 단건 조회 */
async function findTeacherByNormalizedLoginId(cleanLoginId: string): Promise<any | null> {
  const { data, error } = await supabaseAdmin
    .from('ams_teachers')
    .select('id, academy_id, name, login_id, role')
    .ilike('login_id', cleanLoginId)
    .maybeSingle();

  if (error) {
    console.error('[teachers] findTeacherByNormalizedLoginId error:', error);
    return null;
  }
  return data;
}
