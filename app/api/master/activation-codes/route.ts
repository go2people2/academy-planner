import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generateHokmaActivationCode,
  hashHokmaActivationCode,
  encryptActivationCode,
  isCodeEncryptionConfigured,
} from '@/lib/server/hokmaCodeCrypto';

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

// 마스터 권한 검증 헬퍼 (익스포트하여 reveal 라우트에서도 재사용)
export async function verifyMasterAuth(req: NextRequest) {
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
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  const isMaster = user.app_metadata?.role === 'master' || teacher?.role === 'master';
  if (!isMaster) {
    return { authorized: false, error: '마스터 권한이 필요합니다.', status: 403 };
  }
  return { authorized: true, user, teacherId: teacher?.id };
}

// 1. 설치 코드 발급 또는 재발급 (POST)
export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyMasterAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const {
      academy_id,
      module_code = 'hokmanote',
      force_reissue = false,
      expected_active_code_id = null,
    } = body;

    if (!academy_id) {
      return NextResponse.json({ success: false, error: '학원 ID가 필요합니다.' }, { status: 400 });
    }

    if (module_code !== 'hokmanote') {
      return NextResponse.json({ success: false, error: '설치 코드는 현재 HokmaNote 모듈만 지원합니다.' }, { status: 400 });
    }

    // 💡 필수 Pepper(서비스 롤 키) 환경변수 사전 검증
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          success: false,
          error_code: 'SERVICE_ROLE_KEY_NOT_CONFIGURED',
          error: '서버에 필수 환경변수(SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.',
        },
        { status: 500 }
      );
    }

    // 💡 암호화 키 설정 사전 검증
    if (!isCodeEncryptionConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error_code: 'ENCRYPTION_KEY_NOT_CONFIGURED',
          error: '서버에 HOKMANOTE_CODE_ENCRYPTION_KEY 환경변수가 설정되지 않았거나 형식이 올바르지 않습니다. 서버 환경변수를 먼저 설정해 주세요.',
        },
        { status: 500 }
      );
    }

    // 💡 무편향 16자리 안전 코드 생성 (최대 5회 중복 충돌 재시도)
    let selectedCode: { rawCode: string; codePrefix: string; codeHash: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateHokmaActivationCode();
      const codeHash = hashHokmaActivationCode(candidate.rawCode);

      const { data: existing } = await supabaseAdmin
        .from('activation_codes')
        .select('id')
        .eq('code_hash', codeHash)
        .maybeSingle();

      if (!existing) {
        selectedCode = { ...candidate, codeHash };
        break;
      }
    }

    if (!selectedCode) {
      return NextResponse.json(
        { success: false, error: '설치 코드 생성 중 해시 충돌이 발생했습니다. 다시 시도해 주세요.' },
        { status: 500 }
      );
    }

    const { rawCode, codePrefix, codeHash } = selectedCode;

    // 💡 AES-256-GCM 암호화 수행
    const encrypted = encryptActivationCode(rawCode);

    // 기본 24시간 후 만료
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // 💡 원자적 발급: Stored Procedure (RPC) 호출 우선 시도
    let codeId: string | null = null;
    let createdAt: string = new Date().toISOString();

    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('rpc_issue_activation_code', {
      p_academy_id: academy_id,
      p_module_code: module_code,
      p_code_hash: codeHash,
      p_code_prefix: codePrefix,
      p_encrypted_code: encrypted.encryptedCode,
      p_iv: encrypted.iv,
      p_auth_tag: encrypted.authTag,
      p_key_version: encrypted.keyVersion,
      p_expires_at: expiresAt,
      p_created_by: authCheck.teacherId || null,
      p_force_reissue: Boolean(force_reissue),
      p_expected_active_code_id: expected_active_code_id || null,
    });

    if (rpcErr) {
      console.error('RPC rpc_issue_activation_code execution error:', rpcErr);
      const isFunctionMissing = rpcErr.code === '42883' || rpcErr.message?.includes('function rpc_issue_activation_code');
      if (isFunctionMissing) {
        return NextResponse.json(
          {
            success: false,
            error_code: 'DATABASE_MIGRATION_REQUIRED',
            error: '서버 DB 마이그레이션이 필요합니다. rpc_issue_activation_code 함수가 설치되지 않았습니다. 관리자에게 문의해 주세요.',
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `설치 코드 발급 처리 중 데이터베이스 오류가 발생했습니다: ${rpcErr.message}`,
        },
        { status: 500 }
      );
    }

    const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const isSuccess = Boolean(result?.out_success ?? result?.success);
    const errorCode = result?.out_error_code ?? result?.error_code;
    const existingCodeId = result?.out_existing_code_id ?? result?.existing_code_id;
    const newCodeId = result?.out_code_id ?? result?.code_id;
    const newExpiresAt = result?.out_expires_at ?? result?.expires_at ?? expiresAt;
    const newCreatedAt = result?.out_created_at ?? result?.created_at ?? createdAt;

    if (!isSuccess) {
      if (errorCode === 'ACTIVE_CODE_ALREADY_EXISTS') {
        return NextResponse.json(
          {
            success: false,
            error_code: 'ACTIVE_CODE_ALREADY_EXISTS',
            error: '이미 사용 가능한 설치 코드가 존재합니다. 기존 코드를 확인하거나 [기존 코드 폐기 후 재발급]을 진행해 주세요.',
            existing_code_id: existingCodeId,
          },
          { status: 409 }
        );
      }
      if (errorCode === 'ACTIVE_CODE_CHANGED') {
        return NextResponse.json(
          {
            success: false,
            error_code: 'ACTIVE_CODE_CHANGED',
            error: '다른 관리자에 의해 설치 코드가 이미 재발급되었습니다. 화면을 새로고침하여 최신 코드를 확인해 주세요.',
            existing_code_id: existingCodeId,
          },
          { status: 409 }
        );
      }
      if (errorCode === 'ACTIVE_CODE_NOT_FOUND') {
        return NextResponse.json(
          {
            success: false,
            error_code: 'ACTIVE_CODE_NOT_FOUND',
            error: '재발급 대상 코드가 더 이상 유효하지 않거나 이미 만료되었습니다. 화면을 새로고침하여 확인해 주세요.',
          },
          { status: 409 }
        );
      }
      if (errorCode === 'REISSUE_EXPECTED_ID_REQUIRED') {
        return NextResponse.json(
          {
            success: false,
            error_code: 'REISSUE_EXPECTED_ID_REQUIRED',
            error: '재발급 대상 설치 코드 식별자가 필요합니다. 화면을 새로고침 후 다시 시도해 주세요.',
          },
          { status: 400 }
        );
      }
      throw new Error(errorCode || '설치 코드 발급 실패');
    }
    codeId = newCodeId;
    createdAt = newCreatedAt;

    // 💡 발급 성공 시 단 1회 원문 코드를 반환 (Cache-Control 적용)
    return NextResponse.json(
      {
        success: true,
        id: codeId,
        code: rawCode,
        prefix: codePrefix,
        expires_at: newExpiresAt,
        created_at: createdAt,
        can_reveal: true,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('Activation code issue exception:', err);
    return NextResponse.json({ success: false, error: err.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 2. 특정 학원의 발급된 코드 목록 조회 (GET) - 💡 plain_code 일괄 반환 절대 금지
export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyMasterAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const academyId = searchParams.get('academy_id');
    if (!academyId) {
      return NextResponse.json({ success: false, error: 'academy_id 쿼리 파라미터가 필요합니다.' }, { status: 400 });
    }

    // 💡 암호문 원문(encrypted_code, iv, auth_tag) 자체는 UI로 노출하지 않고
    // 복호화 가능 여부(can_reveal)만 판정하기 위해 서버에서만 컬럼을 조회함
    const { data: codes, error: codeErr } = await supabaseAdmin
      .from('activation_codes')
      .select('id, module_code, code_prefix, encrypted_code, status, expires_at, used_at, revoked_at, created_at')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (codeErr) {
      return NextResponse.json({ success: false, error: codeErr.message }, { status: 500 });
    }

    const now = Date.now();
    const formattedCodes = (codes || []).map((c) => {
      let currentStatus = c.status;
      const isTimeExpired = new Date(c.expires_at).getTime() < now;
      if (currentStatus === 'issued' && isTimeExpired) {
        currentStatus = 'expired';
      }

      // 암호화된 코드가 DB에 저장되어 있고, 현재 유효한 상태(issued & 미만료)인 경우에만 복호화 가능
      const hasEncryptedData = Boolean(c.encrypted_code);
      const canReveal = currentStatus === 'issued' && !isTimeExpired && hasEncryptedData;

      // 💡 암호문, IV, AuthTag 필드는 제거하고 안전한 메타데이터만 전송
      return {
        id: c.id,
        module_code: c.module_code,
        code_prefix: c.code_prefix,
        code_masked: `${c.code_prefix || 'HN-****'}-****-****-****`,
        status: currentStatus,
        expires_at: c.expires_at,
        used_at: c.used_at,
        revoked_at: c.revoked_at,
        created_at: c.created_at,
        can_reveal: canReveal,
        has_encrypted_code: hasEncryptedData,
      };
    });

    // 💡 설치 링크 설정 여부 및 안전한 전달
    const installUrl = process.env.HOKMANOTE_INSTALL_URL || '';
    const isInstallUrlConfigured = Boolean(installUrl.trim());

    return NextResponse.json(
      {
        success: true,
        codes: formattedCodes,
        install_url_configured: isInstallUrlConfigured,
        install_url: installUrl,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 3. 코드 수동 폐기 (DELETE)
export async function DELETE(req: NextRequest) {
  try {
    const authCheck = await verifyMasterAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const { code_id } = body;
    if (!code_id) {
      return NextResponse.json({ success: false, error: 'code_id 파라미터가 필요합니다.' }, { status: 400 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('activation_codes')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('id', code_id)
      .eq('status', 'issued');

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '설치 코드가 폐기되었습니다.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
