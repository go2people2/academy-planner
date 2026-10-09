import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyMasterAuth } from '../route';
import { decryptActivationCode, isCodeEncryptionConfigured } from '@/lib/server/hokmaCodeCrypto';

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

export async function POST(req: NextRequest) {
  try {
    // 1. 마스터 권한 검증
    const authCheck = await verifyMasterAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const { code_id } = body;

    if (!code_id) {
      return NextResponse.json({ success: false, error: 'code_id 파라미터가 필요합니다.' }, { status: 400 });
    }

    // 2. 코드 데이터 조회
    const { data: codeRecord, error: fetchErr } = await supabaseAdmin
      .from('activation_codes')
      .select('id, academy_id, status, expires_at, encrypted_code, iv, auth_tag, key_version')
      .eq('id', code_id)
      .maybeSingle();

    if (fetchErr || !codeRecord) {
      return NextResponse.json({ success: false, error: '해당 설치 코드를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 3. 상태 검증: 사용 완료, 만료, 폐기된 코드는 원문 복호화/보기 제한
    const now = Date.now();
    const isExpired = new Date(codeRecord.expires_at).getTime() < now;

    if (codeRecord.status === 'used') {
      return NextResponse.json(
        { success: false, error: '이미 사용 완료된 코드는 보안을 위해 원문을 조회할 수 없습니다.' },
        { status: 400 }
      );
    }

    if (codeRecord.status === 'revoked') {
      return NextResponse.json(
        { success: false, error: '폐기된 코드는 원문을 조회할 수 없습니다.' },
        { status: 400 }
      );
    }

    if (codeRecord.status === 'expired' || isExpired) {
      return NextResponse.json(
        { success: false, error: '만료된 코드는 원문을 조회할 수 없습니다. 필요 시 새로 발급해 주세요.' },
        { status: 400 }
      );
    }

    // 4. 암호문 존재 여부 확인 (기존 암호문 없는 레코드 호환 처리)
    if (!codeRecord.encrypted_code || !codeRecord.iv || !codeRecord.auth_tag) {
      return NextResponse.json(
        {
          success: false,
          error_code: 'CANNOT_REVEAL_LEGACY_CODE',
          error: '원문 재확인 불가 — 해당 코드는 구형 방식으로 발급되어 복호화할 수 없습니다. 필요 시 [폐기 후 재발급]을 진행해 주세요.',
        },
        { status: 400 }
      );
    }

    // 5. 서버 암호화 키 설정 확인
    if (!isCodeEncryptionConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: '서버에 HOKMANOTE_CODE_ENCRYPTION_KEY 환경변수가 설정되지 않았거나 형식이 올바르지 않습니다.',
        },
        { status: 500 }
      );
    }

    // 6. 복호화 수행
    let plainCode = '';
    try {
      plainCode = decryptActivationCode(
        codeRecord.encrypted_code,
        codeRecord.iv,
        codeRecord.auth_tag,
        codeRecord.key_version || 1
      );
    } catch (decryptErr: any) {
      console.error('Decryption failed for code:', code_id, decryptErr?.message);
      return NextResponse.json(
        {
          success: false,
          error: '코드 복호화에 실패했습니다. 키 버전이 변경되었거나 데이터가 손상되었을 수 있습니다.',
        },
        { status: 500 }
      );
    }

    // 7. 성공 반환 (민감 정보 응답 캐시 차단)
    return NextResponse.json(
      {
        success: true,
        id: codeRecord.id,
        code: plainCode,
        expires_at: codeRecord.expires_at,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('Reveal activation code exception:', err);
    return NextResponse.json({ success: false, error: err.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
