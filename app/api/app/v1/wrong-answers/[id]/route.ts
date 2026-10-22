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

async function authenticateAndResolveAcademy(req: NextRequest): Promise<
  | { success: true; targetAcademyId: string; amsAcademyId: string; isV3: boolean }
  | { success: false; response: NextResponse }
> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
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
      success: false,
      response: NextResponse.json(
        { success: false, error: '유효하지 않거나 만료된 기기 토큰입니다.' },
        { status: 401 }
      ),
    };
  }

  const { device_id, academy_id: amsAcademyId, slug } = tokenCheck.payload;
  if (!device_id || !slug) {
    return {
      success: false,
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
      success: false,
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
      success: false,
      response: NextResponse.json(
        { success: false, error_code: 'MODULE_SUSPENDED', error: '오답노트 모듈 이용 권한이 정지되었거나 비활성 상태입니다.' },
        { status: 403 }
      ),
    };
  }

  // 버전 판별 (v3 기본 지원 및 v2 하위호환)
  const { searchParams } = new URL(req.url);
  const versionParam = (searchParams.get('version') || searchParams.get('v') || 'v3').toLowerCase();
  const isV3 = versionParam === 'v3' || versionParam === '3';

  if (isV3) {
    return { success: true, targetAcademyId: amsAcademyId, amsAcademyId, isV3: true };
  }

  // v2: 오답노트 학원 ID 매핑
  const { data: waAcademy, error: waAcErr } = await supabaseAdmin
    .from('academies')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (waAcErr || !waAcademy) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: '해당 학원의 오답노트 지점 정보를 찾을 수 없습니다.' },
        { status: 404 }
      ),
    };
  }

  return { success: true, targetAcademyId: waAcademy.id, amsAcademyId, isV3: false };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await authenticateAndResolveAcademy(req);
    if (!authResult.success) {
      return authResult.response;
    }
    const { targetAcademyId, isV3 } = authResult;

    const resolvedParams = await params;
    const submissionId = resolvedParams.id?.trim();
    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: '오답 ID가 지정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    if (isV3) {
      // v3: metadata에 completed_at 기록 및 status='completed' 갱신
      const { data: existing } = await supabaseAdmin
        .from('wrong_answer_submissions_v3')
        .select('id, metadata')
        .eq('id', submissionId)
        .eq('academy_id', targetAcademyId)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json(
          { success: false, error: '해당 학원의 오답 제출 건을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const meta = (existing.metadata && typeof existing.metadata === 'object') ? { ...existing.metadata } : {};
      meta.completed_at = nowIso;

      const { data, error } = await supabaseAdmin
        .from('wrong_answer_submissions_v3')
        .update({
          status: 'completed',
          metadata: meta,
        })
        .eq('id', submissionId)
        .eq('academy_id', targetAcademyId)
        .select('id');

      if (error) {
        console.error('Failed to complete wrong_answer_submissions_v3:', error);
        return NextResponse.json(
          { success: false, error: '오답 완료 처리 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '처리 완료되었습니다.',
        id: data[0].id,
      });
    }

    // v2 완료 처리
    const { data, error } = await supabaseAdmin
      .from('wrong_answer_submissions')
      .update({
        status: 'completed',
        completed_at: nowIso,
      })
      .eq('id', submissionId)
      .eq('academy_id', targetAcademyId)
      .select('id');

    if (error) {
      console.error('Failed to complete wrong_answer_submission:', error);
      return NextResponse.json(
        { success: false, error: '오답 완료 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: '해당 학원의 오답 제출 건을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '처리 완료되었습니다.',
      id: data[0].id,
    });
  } catch (err: any) {
    console.error('Exception in wrong-answers PATCH route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await authenticateAndResolveAcademy(req);
    if (!authResult.success) {
      return authResult.response;
    }
    const { targetAcademyId, isV3 } = authResult;

    const resolvedParams = await params;
    const submissionId = resolvedParams.id?.trim();
    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: '오답 ID가 지정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const tableName = isV3 ? 'wrong_answer_submissions_v3' : 'wrong_answer_submissions';
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .delete()
      .eq('id', submissionId)
      .eq('academy_id', targetAcademyId)
      .select('id');

    if (error) {
      console.error(`Failed to delete from ${tableName}:`, error);
      return NextResponse.json(
        { success: false, error: '오답 삭제 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: '해당 학원의 오답 제출 건을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '영구 삭제되었습니다.',
      id: data[0].id,
    });
  } catch (err: any) {
    console.error('Exception in wrong-answers DELETE route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
