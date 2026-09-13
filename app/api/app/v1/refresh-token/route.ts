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

function generateDeviceToken(payload: { device_id: string; academy_id: string; slug: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + 3600, // 1시간 유효
  })).toString('base64url');
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'hokma-secret-key';
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, refresh_token } = body;

    if (!device_id || !refresh_token) {
      return NextResponse.json({ success: false, error: 'device_id 및 refresh_token이 필요합니다.' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');

    // 1. 세션 유효성 검증
    const { data: session, error: sessErr } = await supabaseAdmin
      .from('device_sessions')
      .select('id, expires_at, revoked_at')
      .eq('device_id', device_id)
      .eq('refresh_token_hash', tokenHash)
      .maybeSingle();

    if (sessErr || !session || session.revoked_at !== null) {
      return NextResponse.json(
        { success: false, error_code: 'SESSION_INVALID', message: '유효하지 않거나 폐기된 세션입니다.' },
        { status: 401 }
      );
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error_code: 'SESSION_EXPIRED', message: '세션이 만료되었습니다. 새 설치 코드로 재인증해 주세요.' },
        { status: 401 }
      );
    }

    // 2. 기기 상태 검증
    const { data: device, error: devErr } = await supabaseAdmin
      .from('academy_devices')
      .select('id, academy_id, status')
      .eq('id', device_id)
      .maybeSingle();

    if (devErr || !device || device.status === 'revoked') {
      return NextResponse.json(
        { success: false, error_code: 'DEVICE_REVOKED', message: '기기 등록이 해제되었습니다.' },
        { status: 401 }
      );
    }

    // 3. 학원 정보 조회
    const { data: academy } = await supabaseAdmin
      .from('ams_academies')
      .select('slug')
      .eq('id', device.academy_id)
      .single();

    // 4. last_used_at 갱신
    await supabaseAdmin
      .from('device_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', session.id);

    // 5. 새 Access Token 발급
    const newAccessToken = generateDeviceToken({
      device_id: device.id,
      academy_id: device.academy_id,
      slug: academy?.slug || '',
    });

    return NextResponse.json({
      success: true,
      access_token: newAccessToken,
      expires_in: 3600,
    });
  } catch (err: any) {
    console.error('Refresh token exception:', err);
    return NextResponse.json({ success: false, error: '토큰 갱신 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
