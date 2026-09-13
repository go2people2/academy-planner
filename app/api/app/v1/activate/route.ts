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

// 💡 In-Memory Rate Limiter (IP 및 device_uuid 기준)
interface RateLimitRecord {
  failures: number;
  blockedUntil: number;
}
const ipRateLimits = new Map<string, RateLimitRecord>();
const deviceRateLimits = new Map<string, RateLimitRecord>();

function checkRateLimit(key: string, map: Map<string, RateLimitRecord>): boolean {
  const now = Date.now();
  const record = map.get(key);
  if (!record) return true;
  if (record.blockedUntil > now) return false;
  if (record.blockedUntil <= now && record.blockedUntil > 0) {
    // 차단 시간 경과 후 리셋
    map.delete(key);
  }
  return true;
}

function recordFailure(key: string, map: Map<string, RateLimitRecord>) {
  const now = Date.now();
  const record = map.get(key) || { failures: 0, blockedUntil: 0 };
  record.failures += 1;
  if (record.failures >= 5) {
    record.blockedUntil = now + 15 * 60 * 1000; // 15분 차단
  }
  map.set(key, record);
}

function recordSuccess(key: string, map: Map<string, RateLimitRecord>) {
  map.delete(key);
}

// 💡 디바이스 토큰 생성 헬퍼
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
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown-ip';

  try {
    const body = await req.json();
    const { code, device_uuid, device_name, platform = 'macos', os_version, app_version } = body;

    if (!code || !device_uuid || !device_name) {
      return NextResponse.json(
        { success: false, error: '코드, 기기 고유 식별자(device_uuid), 기기 이름(device_name)은 필수입니다.' },
        { status: 400 }
      );
    }

    // 1. Rate Limit 검증
    if (!checkRateLimit(clientIp, ipRateLimits) || !checkRateLimit(device_uuid, deviceRateLimits)) {
      return NextResponse.json(
        { success: false, error: '요청 한도를 초과했습니다. 15분 후 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    const cleanCode = code.trim().toUpperCase();
    const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY || 'hokma-salt-secret';
    const codeHash = crypto.createHash('sha256').update(cleanCode + pepper).digest('hex');

    // 2. 새 세션용 Refresh Token 생성
    const rawRefreshToken = 'rt_' + crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 3. RPC Stored Procedure 호출 시도
    let rpcResult: any = null;
    try {
      const { data, error: rpcErr } = await supabaseAdmin.rpc('rpc_activate_device_with_code', {
        p_code_hash: codeHash,
        p_device_uuid: device_uuid,
        p_device_name: device_name.slice(0, 100),
        p_platform: platform,
        p_os_version: os_version || null,
        p_app_version: app_version || null,
        p_refresh_token_hash: refreshTokenHash,
        p_session_expires_at: sessionExpiresAt,
        p_metadata: {},
      });
      if (!rpcErr && data && data.length > 0) {
        rpcResult = data[0];
      }
    } catch {
      // RPC 미등록 시 fallback 로직으로 진입
      rpcResult = null;
    }

    // 4. RPC가 아직 DB에 없거나 실패했을 경우 Fallback 서버 트랜잭션 로직
    if (!rpcResult) {
      // 1) 코드 조회
      const { data: vCode, error: codeErr } = await supabaseAdmin
        .from('activation_codes')
        .select('*')
        .eq('code_hash', codeHash)
        .maybeSingle();

      if (codeErr || !vCode) {
        recordFailure(clientIp, ipRateLimits);
        recordFailure(device_uuid, deviceRateLimits);
        return NextResponse.json({ success: false, error: '유효하지 않거나 만료된 설치 코드입니다.' }, { status: 400 });
      }

      if (vCode.status === 'revoked' || vCode.status === 'used' || vCode.used_count >= vCode.max_uses) {
        recordFailure(clientIp, ipRateLimits);
        recordFailure(device_uuid, deviceRateLimits);
        return NextResponse.json({ success: false, error: '이미 사용되었거나 폐기된 코드입니다.' }, { status: 400 });
      }

      if (new Date(vCode.expires_at).getTime() < Date.now()) {
        await supabaseAdmin.from('activation_codes').update({ status: 'expired' }).eq('id', vCode.id);
        recordFailure(clientIp, ipRateLimits);
        return NextResponse.json({ success: false, error: '만료된 설치 코드입니다.' }, { status: 400 });
      }

      // 2) 학원 및 모듈 권한 검증
      const { data: vMod } = await supabaseAdmin
        .from('academy_modules')
        .select('*')
        .eq('academy_id', vCode.academy_id)
        .eq('module_code', vCode.module_code)
        .maybeSingle();

      if (!vMod || ['inactive', 'suspended'].includes(vMod.status)) {
        return NextResponse.json({ success: false, error: '해당 학원의 모듈 이용 권한이 활성화되지 않았습니다.' }, { status: 403 });
      }

      // 3) 기기 등록 (UPSERT)
      const { data: vDevice, error: devErr } = await supabaseAdmin
        .from('academy_devices')
        .upsert(
          {
            academy_id: vCode.academy_id,
            module_code: vCode.module_code,
            device_uuid,
            device_name: device_name.slice(0, 100),
            platform,
            os_version: os_version || null,
            app_version: app_version || null,
            status: 'active',
            revoked_at: null,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'academy_id,module_code,device_uuid' }
        )
        .select('id')
        .single();

      if (devErr || !vDevice) {
        return NextResponse.json({ success: false, error: '기기 정보 등록에 실패했습니다.' }, { status: 500 });
      }

      // 4) 세션 등록
      await supabaseAdmin.from('device_sessions').update({ revoked_at: new Date().toISOString() }).eq('device_id', vDevice.id).is('revoked_at', null);
      await supabaseAdmin.from('device_sessions').insert([{
        device_id: vDevice.id,
        refresh_token_hash: refreshTokenHash,
        expires_at: sessionExpiresAt,
      }]);

      // 5) 코드 사용 완료 처리
      await supabaseAdmin.from('activation_codes').update({
        status: 'used',
        used_count: vCode.used_count + 1,
        used_at: new Date().toISOString(),
      }).eq('id', vCode.id);

      // 6) 모듈 상태 갱신
      if (vMod.status === 'pending_setup') {
        await supabaseAdmin.from('academy_modules').update({ status: 'active' }).eq('id', vMod.id);
      }

      // 7) 학원 정보 조회
      const { data: vAcademy } = await supabaseAdmin
        .from('ams_academies')
        .select('academy_name, slug')
        .eq('id', vCode.academy_id)
        .single();

      rpcResult = {
        success: true,
        academy_id: vCode.academy_id,
        academy_name: vAcademy?.academy_name || '',
        slug: vAcademy?.slug || '',
        device_id: vDevice.id,
      };
    } else if (!rpcResult.success) {
      recordFailure(clientIp, ipRateLimits);
      recordFailure(device_uuid, deviceRateLimits);
      const errMap: Record<string, string> = {
        INVALID_CODE: '유효하지 않은 설치 코드입니다.',
        CODE_REVOKED: '관리자에 의해 폐기된 코드입니다.',
        CODE_ALREADY_USED: '이미 사용된 설치 코드입니다.',
        CODE_EXPIRED: '만료된 설치 코드입니다.',
        MODULE_NOT_AVAILABLE: '해당 학원의 모듈 이용 권한이 활성화되지 않았습니다.',
        DEVICE_LIMIT_EXCEEDED: '허용된 기기 대수를 초과했습니다. 관리자에게 문의하세요.',
      };
      return NextResponse.json(
        { success: false, error: errMap[rpcResult.error_code] || '설치 코드 인증에 실패했습니다.' },
        { status: 400 }
      );
    }

    recordSuccess(clientIp, ipRateLimits);
    recordSuccess(device_uuid, deviceRateLimits);

    // 5. 성공 응답 생성 (HokmaNote 표준 academy_config 규격)
    const accessToken = generateDeviceToken({
      device_id: rpcResult.device_id,
      academy_id: rpcResult.academy_id,
      slug: rpcResult.slug,
    });

    const offlineCacheUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    return NextResponse.json({
      success: true,
      config: {
        academy_id: rpcResult.academy_id,
        academy_name: rpcResult.academy_name,
        slug: rpcResult.slug,
        device_id: rpcResult.device_id,
        access_token: accessToken,
        refresh_token: rawRefreshToken, // ⚠️ 클라이언트에 1회 전달 (원문은 DB에 저장되지 않음)
        license: {
          status: 'active',
          grace_period_days: 14,
          offline_cache_until: offlineCacheUntil,
        },
      },
    });
  } catch (err: any) {
    console.error('App activate exception:', err);
    return NextResponse.json({ success: false, error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
