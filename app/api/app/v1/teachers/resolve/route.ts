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

// 💡 디바이스 토큰 서명 및 만료 검증 헬퍼
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

export async function GET(req: NextRequest) {
  try {
    // 1. Bearer 기기 토큰 추출 및 서명 검증
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '인증 토큰이 누락되었습니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenCheck = verifyDeviceToken(token);
    if (!tokenCheck.valid || !tokenCheck.payload) {
      return NextResponse.json(
        { success: false, error: '유효하지 않거나 만료된 기기 토큰입니다.' },
        { status: 401 }
      );
    }

    const { device_id, academy_id: amsAcademyId, slug } = tokenCheck.payload;

    if (!device_id || !slug) {
      return NextResponse.json(
        { success: false, error: '기기 토큰 페이로드가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 2. 기기 등록 상태 및 모듈 활성 상태 검증
    const { data: device, error: devErr } = await supabaseAdmin
      .from('academy_devices')
      .select('id, status')
      .eq('id', device_id)
      .maybeSingle();

    if (devErr || !device || device.status === 'revoked') {
      return NextResponse.json(
        { success: false, error_code: 'DEVICE_REVOKED', error: '등록이 해제된 기기입니다.' },
        { status: 401 }
      );
    }

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

    // 3. 토큰의 검증된 slug로 오답노트 학원(academies) ID 확정 (학원 격리)
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

    // 4. login_id 쿼리 파라미터 확인 (대소문자 유지, 앞뒤 공백만 제거)
    const { searchParams } = new URL(req.url);
    const loginId = searchParams.get('login_id')?.trim();

    if (!loginId) {
      return NextResponse.json(
        { success: false, error: 'login_id(로그인 아이디) 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 5. 검증된 학원 slug와 결합하여 기존 teachers.email 컬럼 조회
    const targetEmail = `${slug}_${loginId}`;

    const { data: teacher, error: teacherErr } = await supabaseAdmin
      .from('teachers')
      .select('id, name')
      .eq('academy_id', targetAcademyId)
      .eq('email', targetEmail)
      .maybeSingle();

    if (teacherErr) {
      console.error('Failed to resolve teacher by login_id:', teacherErr);
      return NextResponse.json(
        { success: false, error: '교사 정보 조회 중 서버 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: '해당 학원에 등록되지 않은 교사 로그인 아이디입니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        login_id: loginId,
      },
    });
  } catch (err: any) {
    console.error('Exception in teachers resolve route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
