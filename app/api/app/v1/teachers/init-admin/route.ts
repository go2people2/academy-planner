import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

// 💡 디바이스/호스트 토큰 서명 및 만료 검증 헬퍼
function verifyDeviceToken(token: string): { valid: boolean; payload?: any } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };
    const [header, body, signature] = parts;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'hokma-secret-key';
    const expectedSignature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSignature) return { valid: false };

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Bearer 호스트 토큰 추출 및 서명 검증
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '호스트 인증 토큰이 누락되었습니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenCheck = verifyDeviceToken(token);
    if (!tokenCheck.valid || !tokenCheck.payload) {
      return NextResponse.json(
        { success: false, error: '유효하지 않거나 만료된 호스트 토큰입니다.' },
        { status: 401 }
      );
    }

    const { device_id, academy_id: amsAcademyId, slug } = tokenCheck.payload;

    if (!device_id || !amsAcademyId || !slug) {
      return NextResponse.json(
        { success: false, error: '호스트 토큰 페이로드가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 2. 호스트 기기 상태 검증 (차단 기기 방어)
    const { data: device, error: devErr } = await supabaseAdmin
      .from('academy_devices')
      .select('id, status, academy_id')
      .eq('id', device_id)
      .maybeSingle();

    if (devErr || !device || device.status === 'revoked') {
      return NextResponse.json(
        { success: false, error_code: 'DEVICE_REVOKED', error: '등록이 해제된 호스트입니다.' },
        { status: 401 }
      );
    }

    // 3. 오답노트 모듈 이용 권한 검증
    const { data: mod } = await supabaseAdmin
      .from('academy_modules')
      .select('status')
      .eq('academy_id', amsAcademyId)
      .eq('module_code', 'hokmanote')
      .maybeSingle();

    if (mod && ['inactive', 'suspended'].includes(mod.status)) {
      return NextResponse.json(
        { success: false, error_code: 'MODULE_SUSPENDED', error: '오답노트 모듈 이용 권한이 정지되었거나 비활성 상태입니다.' },
        { status: 403 }
      );
    }

    // 4. 요청 Body 파싱 및 유효성 검증
    const body = await req.json();
    const { name, username, password } = body;

    const cleanName = strVal(name).trim() || '원장선생님';
    const cleanUsername = strVal(username).trim().toLowerCase();
    const rawPassword = strVal(password);

    if (!cleanUsername || cleanUsername.length < 3) {
      return NextResponse.json(
        { success: false, error: '원장 아이디는 최소 3자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    if (!rawPassword || rawPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 최소 6자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 5. 기존 원장(admin) 계정 존재 여부 확인
    // (기존 admin이 있는 경우 중복 생성하지 않고 기존 계정 정보를 반환하여 재로그인 지원)
    const { data: existingAdmin, error: adminQueryErr } = await supabaseAdmin
      .from('ams_teachers')
      .select('id, name, login_id, user_id, academy_id')
      .eq('academy_id', amsAcademyId)
      .eq('role', 'admin')
      .maybeSingle();

    if (adminQueryErr) {
      console.error('[init-admin] Failed to query existing admin:', adminQueryErr);
      return NextResponse.json(
        { success: false, error: '기존 계정 조회 중 데이터베이스 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (existingAdmin) {
      // 1) 아이디 일치 검증
      if (existingAdmin.login_id.toLowerCase() !== cleanUsername) {
        return NextResponse.json(
          {
            success: false,
            error: `해당 학원에는 다른 아이디(${existingAdmin.login_id})로 원장 계정이 이미 등록되어 있습니다. 기존 아이디로 입력해 주세요.`,
            existing_username: existingAdmin.login_id,
          },
          { status: 409 }
        );
      }

      // 2) 비밀번호 검증 (Supabase Auth signInWithPassword)
      const adminEmail = `${cleanUsername}@hokma-academy.com`;
      const { data: signInData, error: signInErr } = await supabaseAdmin.auth.signInWithPassword({
        email: adminEmail,
        password: rawPassword,
      });

      if (signInErr || !signInData.user) {
        return NextResponse.json(
          {
            success: false,
            error: '기존에 등록된 원장 계정의 비밀번호와 일치하지 않습니다. 올바른 비밀번호를 입력해 주세요.',
            code: 'INVALID_CREDENTIALS',
          },
          { status: 401 }
        );
      }

      // 비밀번호 검증 성공: 인증된 원장 정보 반환
      return NextResponse.json({
        success: true,
        already_exists: true,
        verified: true,
        teacher_id: existingAdmin.id,
        username: existingAdmin.login_id,
        name: existingAdmin.name,
        message: '기존 원장 계정 인증이 확인되었습니다. 로컬 관리자 연결을 완료합니다.',
      });
    }

    // 6. Supabase Auth 유저 생성 (이메일: "${cleanUsername}@hokma-academy.com")
    const email = `${cleanUsername}@hokma-academy.com`;
    let userId: string | null = null;

    // 혹시 Auth에 이미 동일한 이메일 유저가 있는지 확인
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
    const matchedUser = existingAuthUsers?.users?.find(u => u.email === email);

    if (matchedUser) {
      userId = matchedUser.id;
      // 비밀번호 갱신
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: rawPassword,
      });
    } else {
      const { data: authData, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: rawPassword,
        email_confirm: true,
      });

      if (createAuthErr || !authData.user) {
        console.error('[init-admin] Auth User Creation Error:', createAuthErr);
        return NextResponse.json(
          { success: false, error: `인증 서버 사용자 생성 실패: ${createAuthErr?.message || '알 수 없는 오류'}` },
          { status: 400 }
        );
      }
      userId = authData.user.id;
    }

    // 7. ams_teachers 테이블에 원장 레코드 생성
    const { data: newTeacher, error: tErr } = await supabaseAdmin
      .from('ams_teachers')
      .insert([
        {
          academy_id: amsAcademyId,
          name: cleanName,
          login_id: cleanUsername,
          password: rawPassword,
          role: 'admin',
          user_id: userId,
          initials: 'M',
        },
      ])
      .select('id, name, login_id')
      .single();

    if (tErr || !newTeacher) {
      console.error('[init-admin] Teacher Insert Error:', tErr);
      return NextResponse.json(
        { success: false, error: `원장 프로필 등록 실패: ${tErr?.message || '알 수 없는 오류'}` },
        { status: 500 }
      );
    }

    // 8. Auth 유저 app_metadata 동기화 (권한 검증용)
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        role: 'admin',
        academy_id: amsAcademyId,
        teacher_id: newTeacher.id,
      },
    });

    // ⚠️ 철칙 준수: academy_modules의 ams 상태는 절대 건드리지 않음 (inactive 유지)

    return NextResponse.json({
      success: true,
      already_exists: false,
      teacher_id: newTeacher.id,
      username: newTeacher.login_id,
      name: newTeacher.name,
      message: '원장 계정이 성공적으로 등록되었습니다.',
    });
  } catch (err: any) {
    console.error('[init-admin] Fatal Exception:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function strVal(v: any): string {
  return typeof v === 'string' ? v : '';
}
