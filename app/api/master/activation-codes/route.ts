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
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  const isMaster = user.app_metadata?.role === 'master' || teacher?.role === 'master';
  if (!isMaster) {
    return { authorized: false, error: '마스터 권한이 필요합니다.', status: 403 };
  }
  return { authorized: true, user, teacherId: teacher?.id };
}

// 1. 설치 코드 발급 (POST)
export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyMasterAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const { academy_id, module_code = 'hokmanote' } = body;

    if (!academy_id) {
      return NextResponse.json({ success: false, error: '학원 ID가 필요합니다.' }, { status: 400 });
    }

    if (module_code !== 'hokmanote') {
      return NextResponse.json({ success: false, error: '설치 코드는 현재 HokmaNote 모듈만 지원합니다.' }, { status: 400 });
    }

    // 💡 혼동 문자(0, O, 1, I, L)를 제외한 31자 영숫자 셋
    const SAFE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY || 'hokma-salt-secret';

    function generateSingleCode(): { rawCode: string; codePrefix: string; codeHash: string } {
      const bytes = crypto.randomBytes(8);
      let part1 = '';
      let part2 = '';
      for (let i = 0; i < 4; i++) {
        part1 += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
        part2 += SAFE_CHARS[bytes[i + 4] % SAFE_CHARS.length];
      }
      const rawCode = `HN-${part1}-${part2}`;
      const codePrefix = `HN-${part1}`;
      const codeHash = crypto.createHash('sha256').update(rawCode + pepper).digest('hex');
      return { rawCode, codePrefix, codeHash };
    }

    // 미사용 중복 코드 방지 (최대 5회 재시도)
    let selectedCode: { rawCode: string; codePrefix: string; codeHash: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateSingleCode();
      const { data: existing } = await supabaseAdmin
        .from('activation_codes')
        .select('id')
        .eq('code_hash', candidate.codeHash)
        .eq('status', 'issued')
        .maybeSingle();

      if (!existing) {
        selectedCode = candidate;
        break;
      }
    }

    if (!selectedCode) {
      return NextResponse.json({ success: false, error: '설치 코드 생성 중 충돌이 발생했습니다. 다시 시도해 주세요.' }, { status: 500 });
    }

    const { rawCode, codePrefix, codeHash } = selectedCode;

    // 기본 24시간 후 만료
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('activation_codes')
      .insert([
        {
          academy_id,
          module_code,
          code_hash: codeHash,
          code_prefix: codePrefix,
          status: 'issued',
          expires_at: expiresAt,
          max_uses: 1,
          used_count: 0,
          created_by: authCheck.teacherId || null,
        }
      ])
      .select('id, expires_at, created_at')
      .single();

    if (insertErr) {
      console.error('Failed to insert activation code:', insertErr);
      const isTableMissing = insertErr.code === 'PGRST205' || insertErr.message?.includes('not find the table');
      const errMsg = isTableMissing
        ? 'Supabase DB에 activation_codes 테이블 생성이 필요합니다. sql/20260914_create_hokma_module_and_device_tables.sql을 실행해 주세요.'
        : `설치 코드 발급 실패: ${insertErr.message}`;
      return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }

    // ⚠️ 원문 코드는 이 응답에서만 단 1회 반환되며 DB에는 해시만 보관됨
    return NextResponse.json({
      success: true,
      id: inserted.id,
      code: rawCode,
      prefix: codePrefix,
      expires_at: inserted.expires_at,
    });
  } catch (err: any) {
    console.error('Activation code issue exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 2. 특정 학원의 발급된 코드 목록 조회 (GET)
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

    const { data: codes, error: codeErr } = await supabaseAdmin
      .from('activation_codes')
      .select('id, module_code, code_prefix, status, expires_at, used_at, revoked_at, created_at')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (codeErr) {
      return NextResponse.json({ success: false, error: codeErr.message }, { status: 500 });
    }

    // 만료 시간 초과 항목 상태 보정 및 마스킹된 코드 표기 (HN-XXXX-****)
    const now = Date.now();
    const formattedCodes = (codes || []).map((c) => {
      let currentStatus = c.status;
      if (currentStatus === 'issued' && new Date(c.expires_at).getTime() < now) {
        currentStatus = 'expired';
      }
      return {
        ...c,
        status: currentStatus,
        code_masked: `${c.code_prefix || 'HN-****'}-****`,
      };
    });

    return NextResponse.json({ success: true, codes: formattedCodes });
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
