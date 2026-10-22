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

export async function GET(req: NextRequest) {
  try {
    // 1. Bearer 기기 토큰 추출 및 서명 검증
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '인증 토큰이 누락되었습니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenCheck = verifyDeviceToken(token);
    if (!tokenCheck.valid || !tokenCheck.payload) {
      return NextResponse.json(
        { success: false, error: '유효하지 않거나 만료된 기기 토큰입니다.' },
        { status: 401 }
      );
    }

    const { device_id, academy_id: amsAcademyId, slug } = tokenCheck.payload;

    if (!device_id || !slug) {
      return NextResponse.json(
        { success: false, error: '기기 토큰 페이로드가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 2. 기기 등록 상태 및 모듈 활성 여부 검증
    const { data: device, error: devErr } = await supabaseAdmin
      .from('academy_devices')
      .select('id, status')
      .eq('id', device_id)
      .maybeSingle();

    if (devErr || !device || device.status === 'revoked') {
      return NextResponse.json(
        { success: false, error_code: 'DEVICE_REVOKED', error: '등록이 해제된 기기입니다.' },
        { status: 401 }
      );
    }

    const { data: mod } = await supabaseAdmin
      .from('academy_modules')
      .select('status')
      .eq('academy_id', amsAcademyId)
      .eq('module_code', 'hokmanote')
      .maybeSingle();

    if (mod && ['inactive', 'suspended'].includes(mod.status)) {
      return NextResponse.json(
        { success: false, error_code: 'MODULE_SUSPENDED', error: '오답노트 모듈 이용 권한이 정지되었거나 비활성 상태입니다.' },
        { status: 403 }
      );
    }

    // 3. 버전 감지 (v3 기본 지원 및 v2 하위호환)
    const { searchParams } = new URL(req.url);
    const versionParam = (searchParams.get('version') || searchParams.get('v') || 'v3').toLowerCase();
    const isV3 = versionParam === 'v3' || versionParam === '3';

    let targetAcademyId = amsAcademyId;
    if (!isV3) {
      const { data: waAcademy, error: waAcErr } = await supabaseAdmin
        .from('academies')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (waAcErr || !waAcademy) {
        return NextResponse.json(
          { success: false, error: '해당 학원의 오답노트 지점 정보를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      targetAcademyId = waAcademy.id;
    }

    // 4. 쿼리 파라미터 파싱 및 유효성 검증
    const teacherId = searchParams.get('teacher_id')?.trim() || null;
    const statusParam = (searchParams.get('status') || 'pending').trim().toLowerCase();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    // status 파라미터 검증
    const validStatuses = ['pending', 'completed', 'all'];
    if (!validStatuses.includes(statusParam)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 status 값입니다. ('pending', 'completed', 'all' 중 하나여야 합니다)" },
        { status: 400 }
      );
    }

    // 5. teacher_id 제공 시 해당 학원 소속 교사인지 검증 (v2 전용)
    if (!isV3 && teacherId) {
      const { data: teacher, error: teacherErr } = await supabaseAdmin
        .from('teachers')
        .select('id')
        .eq('id', teacherId)
        .eq('academy_id', targetAcademyId)
        .maybeSingle();

      if (teacherErr || !teacher) {
        return NextResponse.json(
          { success: false, error: '해당 학원에 소속되지 않은 교사 ID이거나 유효하지 않습니다.' },
          { status: 403 }
        );
      }
    }

    // 6. 학원 격리 기반 오답 수신함 조회 (v3 / v2 분기)
    const tableName = isV3 ? 'wrong_answer_submissions_v3' : 'wrong_answer_submissions';
    const selectCols = isV3
      ? 'id, academy_id, student_id, student_name, bookcode, book_name, chapter_codes, problem_codes, problems_detail, memo, status, metadata, created_at'
      : 'id, student_id, student_name, teacher_id, book_name, chapter_name, problem_numbers, memo, status, completed_at, created_at';

    let query = supabaseAdmin
      .from(tableName)
      .select(selectCols, { count: 'exact' })
      .eq('academy_id', targetAcademyId);

    if (!isV3 && teacherId) {
      query = query.eq('teacher_id', teacherId);
    }

    if (statusParam !== 'all') {
      query = query.eq('status', statusParam);
    }

    const { data: submissions, count, error: queryErr } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryErr) {
      console.error(`Failed to fetch ${tableName}:`, queryErr);
      return NextResponse.json(
        { success: false, error: '오답 수신함 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: submissions || [],
      total: count ?? (submissions?.length || 0),
      limit,
      offset,
    });
  } catch (err: any) {
    console.error('Exception in wrong-answers route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
