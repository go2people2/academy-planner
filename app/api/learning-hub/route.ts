import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: '인증 토큰이 누락되었습니다.' };
  }

  const token = authHeader.split(' ')[1];
  const tempClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } }
  );

  const { data: { user }, error: authErr } = await tempClient.auth.getUser(token);
  if (authErr || !user) {
    return { user: null, error: '유효하지 않은 세션입니다.' };
  }

  return { user, error: null };
}

// 📌 [GET] 전용 테이블 ams_digital_math_modules 기반 모듈 데이터 조회
export async function GET(req: NextRequest) {
  try {
    const { user, error: authErr } = await authenticateUser(req);
    if (authErr || !user) {
      return NextResponse.json({ error: authErr || '인증 실패' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const academyId = searchParams.get('academyId');
    const bookcode = searchParams.get('bookcode');

    if (!academyId) {
      return NextResponse.json({ error: 'academyId 파라미터가 필요합니다.' }, { status: 400 });
    }

    // 1. 신규 전용 Supabase 테이블(ams_digital_math_modules)에서 조회
    let query = supabaseAdmin
      .from('ams_digital_math_modules')
      .select('*')
      .eq('academy_id', academyId);

    if (bookcode) {
      query = query.eq('bookcode', bookcode);
    }

    const { data: dbRows, error: dbErr } = await query;

    // 2. 레거시 operation_settings 백업 데이터 조회를 통한 하이브리드 통합
    const { data: academyData } = await supabaseAdmin
      .from('ams_academies')
      .select('operation_settings')
      .eq('id', academyId)
      .maybeSingle();

    const legacyModules = academyData?.operation_settings?.digital_math_modules || {};
    const mergedModules: Record<string, any> = { ...legacyModules };

    if (!dbErr && dbRows && dbRows.length > 0) {
      dbRows.forEach(row => {
        mergedModules[row.bookcode] = {
          bookType: row.book_type || 'concept',
          ...(row.module_data || {}),
          updatedAt: row.updated_at
        };
      });
    }

    if (bookcode) {
      return NextResponse.json({ success: true, module: mergedModules[bookcode] || null });
    }

    return NextResponse.json({ success: true, modules: mergedModules });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 📌 [POST] 전용 테이블 ams_digital_math_modules 에 교재 학습장 업서트(Upsert)
export async function POST(req: NextRequest) {
  try {
    const { user, error: authErr } = await authenticateUser(req);
    if (authErr || !user) {
      return NextResponse.json({ error: authErr || '인증 실패' }, { status: 401 });
    }

    const body = await req.json();
    const { academyId, bookcode, moduleData } = body;

    if (!academyId || !bookcode || !moduleData) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const bookType = moduleData.bookType || 'concept';

    // 1. 신규 전용 테이블(ams_digital_math_modules)에 Upsert 저장
    const { data: upsertData, error: upsertErr } = await supabaseAdmin
      .from('ams_digital_math_modules')
      .upsert({
        academy_id: academyId,
        bookcode: bookcode,
        book_type: bookType,
        module_data: moduleData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'academy_id,bookcode' })
      .select()
      .maybeSingle();

    if (upsertErr) {
      console.warn('전용 테이블 저장 실패, 백업 스토리지로 보관 진행:', upsertErr.message);
    }

    // 2. 2중 안심을 위해 기존 operation_settings 백업 스토리지에도 보관
    const { data: academyData } = await supabaseAdmin
      .from('ams_academies')
      .select('operation_settings')
      .eq('id', academyId)
      .maybeSingle();

    const currentOpSettings = academyData?.operation_settings || {};
    const currentModules = currentOpSettings.digital_math_modules || {};

    const updatedModules = {
      ...currentModules,
      [bookcode]: {
        ...moduleData,
        bookType: bookType,
        updatedAt: new Date().toISOString()
      }
    };

    await supabaseAdmin
      .from('ams_academies')
      .update({
        operation_settings: {
          ...currentOpSettings,
          digital_math_modules: updatedModules
        }
      })
      .eq('id', academyId);

    const resultModule = upsertData ? {
      bookType: upsertData.book_type,
      ...(upsertData.module_data || {}),
      updatedAt: upsertData.updated_at
    } : updatedModules[bookcode];

    return NextResponse.json({ success: true, module: resultModule });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
