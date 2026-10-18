import { NextRequest } from 'next/server';
import crypto from 'crypto';

export interface HostAuthSuccess {
  ok: true;
  status: 200;
  academyId: string;
  deviceId: string;
  slug: string;
}

export interface HostAuthFailure {
  ok: false;
  status: number;
  error: string;
  errorCode: string;
}

export type HostAuthResult = HostAuthSuccess | HostAuthFailure;

/**
 * 💡 디바이스/호스트 JWT 토큰 서명 및 만료 검증
 */
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

/**
 * 💡 호스트 요청 인증 및 모듈 활성 상태 검증 공통 유틸
 * - Bearer 토큰 검증
 * - academy_devices 상태 확인 (차단 여부)
 * - academy_modules hokmanote 활성 확인 (ams 모듈이 inactive여도 허용)
 */
export async function verifyHostRequest(
  req: NextRequest,
  supabaseAdmin: any
): Promise<HostAuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: '호스트 인증 토큰이 누락되었습니다.',
      errorCode: 'UNAUTHORIZED',
    };
  }

  const token = authHeader.substring(7);
  const tokenCheck = verifyDeviceToken(token);
  if (!tokenCheck.valid || !tokenCheck.payload) {
    return {
      ok: false,
      status: 401,
      error: '유효하지 않거나 만료된 호스트 토큰입니다.',
      errorCode: 'INVALID_TOKEN',
    };
  }

  const { device_id, academy_id, slug } = tokenCheck.payload;
  if (!device_id || !academy_id) {
    return {
      ok: false,
      status: 401,
      error: '호스트 토큰 페이로드가 올바르지 않습니다.',
      errorCode: 'INVALID_PAYLOAD',
    };
  }

  // 1. 기기 상태 검증 (차단 기기 방어)
  const { data: device, error: devErr } = await supabaseAdmin
    .from('academy_devices')
    .select('id, status, academy_id')
    .eq('id', device_id)
    .maybeSingle();

  if (devErr || !device || device.status === 'revoked') {
    return {
      ok: false,
      status: 401,
      error: '등록이 해제된 기기/호스트입니다.',
      errorCode: 'DEVICE_REVOKED',
    };
  }

  // 2. 오답노트 모듈 이용 권한 검증 (ams는 inactive여도 허용)
  const { data: mod } = await supabaseAdmin
    .from('academy_modules')
    .select('status')
    .eq('academy_id', academy_id)
    .eq('module_code', 'hokmanote')
    .maybeSingle();

  if (mod && ['inactive', 'suspended'].includes(mod.status)) {
    return {
      ok: false,
      status: 403,
      error: '오답노트 모듈 이용 권한이 정지되었거나 비활성 상태입니다.',
      errorCode: 'MODULE_SUSPENDED',
    };
  }

  return {
    ok: true,
    status: 200,
    academyId: academy_id,
    deviceId: device_id,
    slug: slug || '',
  };
}
