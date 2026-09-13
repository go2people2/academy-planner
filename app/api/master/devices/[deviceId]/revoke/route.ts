import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

// 마스터 권한 검증 헬퍼
async function verifyMasterAuth(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: '인증 토큰이 누락되었습니다.', status: 401 };
  }
  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return { authorized: false, error: '유효하지 않은 세션입니다.', status: 401 };
  }

  const { data: teacher } = await supabaseAdmin
    .from('ams_teachers')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const isMaster = user.app_metadata?.role === 'master' || teacher?.role === 'master';
  if (!isMaster) {
    return { authorized: false, error: '마스터 권한이 필요합니다.', status: 403 };
  }
  return { authorized: true, user };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ deviceId: string }> }
) {
  try {
    const authCheck = await verifyMasterAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const { deviceId } = await context.params;
    if (!deviceId) {
      return NextResponse.json({ success: false, error: 'deviceId가 누락되었습니다.' }, { status: 400 });
    }

    let reason = '운영자 수동 해제';
    try {
      const body = await req.json();
      if (body.reason) reason = body.reason;
    } catch {
      // body empty fallback
    }

    const nowIso = new Date().toISOString();

    // 1. academy_devices 상태를 'revoked'로 변경
    const { error: devErr } = await supabaseAdmin
      .from('academy_devices')
      .update({
        status: 'revoked',
        revoked_at: nowIso,
      })
      .eq('id', deviceId);

    if (devErr) {
      console.error('Failed to revoke device:', devErr);
      const isTableMissing = devErr.code === 'PGRST205' || devErr.message?.includes('not find the table');
      const errMsg = isTableMissing
        ? 'Supabase DB에 academy_devices 테이블 생성이 필요합니다. sql/20260914_create_hokma_module_and_device_tables.sql을 실행해 주세요.'
        : devErr.message;
      return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }

    // 2. 관련 모든 유효 device_sessions 즉시 폐기
    await supabaseAdmin
      .from('device_sessions')
      .update({
        revoked_at: nowIso,
        revoke_reason: reason,
      })
      .eq('device_id', deviceId)
      .is('revoked_at', null);

    return NextResponse.json({
      success: true,
      message: '기기 등록이 성공적으로 해제되었습니다.',
      revoked_at: nowIso,
    });
  } catch (err: any) {
    console.error('Device revoke exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
