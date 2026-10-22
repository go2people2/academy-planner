import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const supabaseAdmin = createClient(
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
export function verifyDeviceToken(token: string): { valid: boolean; payload?: any } {
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

// 💡 기기 토큰 인증 및 학원 격리 확인 공통 헬퍼
export async function authenticateDeviceRequest(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false as const,
      response: NextResponse.json(
        { success: false, error: '인증 토큰이 누락되었습니다.' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.substring(7);
  const tokenCheck = verifyDeviceToken(token);
  if (!tokenCheck.valid || !tokenCheck.payload) {
    return {
      success: false as const,
      response: NextResponse.json(
        { success: false, error: '유효하지 않거나 만료된 기기 토큰입니다.' },
        { status: 401 }
      ),
    };
  }

  const { device_id, academy_id: amsAcademyId } = tokenCheck.payload;
  if (!device_id || !amsAcademyId) {
    return {
      success: false as const,
      response: NextResponse.json(
        { success: false, error: '기기 토큰 페이로드가 올바르지 않습니다.' },
        { status: 401 }
      ),
    };
  }

  // 기기 활성 검증
  const { data: device, error: devErr } = await supabaseAdmin
    .from('academy_devices')
    .select('id, status')
    .eq('id', device_id)
    .maybeSingle();

  if (devErr || !device || device.status === 'revoked') {
    return {
      success: false as const,
      response: NextResponse.json(
        { success: false, error_code: 'DEVICE_REVOKED', error: '등록이 해제된 기기입니다.' },
        { status: 401 }
      ),
    };
  }

  // 모듈 활성 검증
  const { data: mod } = await supabaseAdmin
    .from('academy_modules')
    .select('status')
    .eq('academy_id', amsAcademyId)
    .eq('module_code', 'hokmanote')
    .maybeSingle();

  if (mod && ['inactive', 'suspended'].includes(mod.status)) {
    return {
      success: false as const,
      response: NextResponse.json(
        { success: false, error_code: 'MODULE_SUSPENDED', error: '오답노트 모듈 이용 권한이 정지되었거나 비활성 상태입니다.' },
        { status: 403 }
      ),
    };
  }

  return { success: true as const, academyId: amsAcademyId as string };
}
