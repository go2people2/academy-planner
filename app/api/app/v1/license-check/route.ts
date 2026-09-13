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

// 💡 디바이스 토큰 검증 헬퍼
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
      return { valid: false }; // 만료됨
    }
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: '인증 토큰이 누락되었습니다.' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const tokenCheck = verifyDeviceToken(token);
    if (!tokenCheck.valid || !tokenCheck.payload) {
      return NextResponse.json({ success: false, error: '유효하지 않거나 만료된 토큰입니다.' }, { status: 401 });
    }

    const { device_id, academy_id } = tokenCheck.payload;

    // 1. 기기 상태 검증
    const { data: device, error: devErr } = await supabaseAdmin
      .from('academy_devices')
      .select('id, status, revoked_at')
      .eq('id', device_id)
      .maybeSingle();

    if (devErr || !device || device.status === 'revoked') {
      return NextResponse.json(
        {
          success: false,
          error_code: 'DEVICE_REVOKED',
          message: '해당 기기의 등록이 해제되었습니다. 관리자에게 새 설치 코드를 요청하세요.',
        },
        { status: 401 }
      );
    }

    // 2. 모듈 사용 권한 상태 검증
    const { data: mod } = await supabaseAdmin
      .from('academy_modules')
      .select('status, grace_until')
      .eq('academy_id', academy_id)
      .eq('module_code', 'hokmanote')
      .maybeSingle();

    const moduleStatus = mod?.status || 'active';

    // 3. 마지막 접속 시각 (last_seen_at) 갱신
    await supabaseAdmin
      .from('academy_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', device_id);

    return NextResponse.json({
      success: true,
      status: moduleStatus,
      grace_period_days: 14,
      server_time: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('License check exception:', err);
    return NextResponse.json({ success: false, error: '라이선스 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
