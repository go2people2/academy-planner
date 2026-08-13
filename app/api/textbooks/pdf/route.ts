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

// 1. JWT 토큰 검증 및 유저 정보 획득 헬퍼
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

// 2. 교사 권한 조회 헬퍼
async function getTeacherProfile(userId: string) {
  const { data: teacher, error } = await supabaseAdmin
    .from('ams_teachers')
    .select('role, academy_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !teacher) {
    return null;
  }
  return teacher;
}

// 📌 [GET] 특정 학원의 교재 PDF 링크 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { user, error: authErr } = await authenticateUser(req);
    if (authErr || !user) {
      return NextResponse.json({ error: authErr || '인증 실패' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const academyId = searchParams.get('academyId');

    if (!academyId) {
      return NextResponse.json({ error: 'academyId 파라미터가 필요합니다.' }, { status: 400 });
    }

    const teacher = await getTeacherProfile(user.id);
    if (!teacher) {
      return NextResponse.json({ error: '권한이 없습니다. (교사 정보 없음)' }, { status: 403 });
    }

    // 보안 검증: 마스터가 아니고, 타인 학원의 데이터를 조회하려는 경우 제한
    const isMaster = teacher.role === 'master';
    if (!isMaster && teacher.academy_id !== academyId) {
      return NextResponse.json({ error: '조회 권한이 없습니다.' }, { status: 403 });
    }

    const { data: pdfs, error: fetchErr } = await supabaseAdmin
      .from('ams_textbook_pdfs')
      .select('*')
      .eq('academy_id', academyId);

    if (fetchErr) {
      console.error('[API GET PDF] Fetch error:', fetchErr.message);
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, pdfs });
  } catch (err: any) {
    console.error('[API GET PDF] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 📌 [POST] 교재 PDF 구글 드라이브 링크 등록/업데이트
export async function POST(req: NextRequest) {
  try {
    const { user, error: authErr } = await authenticateUser(req);
    if (authErr || !user) {
      return NextResponse.json({ error: authErr || '인증 실패' }, { status: 401 });
    }

    const body = await req.json();
    const { academyId, bookcode, pdfUrl, answerUrl, explanationUrl, quiz1Url, quiz2Url, quiz3Url, unitPdfUrl, unitQuizzesMap, unitQuizSettingsJson } = body;

    if (!academyId || !bookcode) {
      return NextResponse.json({ error: '필수 파라미터(academyId, bookcode)가 누락되었습니다.' }, { status: 400 });
    }

    const teacher = await getTeacherProfile(user.id);
    if (!teacher) {
      return NextResponse.json({ error: '권한이 없습니다. (교사 정보 없음)' }, { status: 403 });
    }

    // 권한 검증: 마스터이거나 해당 학원의 어드민(원장)이어야 함
    const isMaster = teacher.role === 'master';
    const isAdmin = teacher.role === 'admin';
    if (!isMaster && (!isAdmin || teacher.academy_id !== academyId)) {
      return NextResponse.json({ error: '교재 링크를 등록할 권한이 없습니다.' }, { status: 403 });
    }

    // Upsert 실행 (academy_id & bookcode 유니크 복합키 기준)
    const upsertData: any = {
      academy_id: academyId,
      bookcode,
      pdf_url: pdfUrl ?? '',
      answer_url: answerUrl ?? '',
      explanation_url: explanationUrl ?? '',
      quiz1_url: quiz1Url ?? '',
      quiz2_url: quiz2Url ?? '',
      quiz3_url: quiz3Url ?? '',
      unit_pdf_url: unitPdfUrl ?? '',
      unit_quizzes_json: unitQuizzesMap ? (typeof unitQuizzesMap === 'string' ? unitQuizzesMap : JSON.stringify(unitQuizzesMap)) : null,
      unit_quiz_settings_json: unitQuizSettingsJson !== undefined ? (typeof unitQuizSettingsJson === 'string' ? unitQuizSettingsJson : JSON.stringify(unitQuizSettingsJson)) : null
    };

    let { data, error: upsertErr } = await supabaseAdmin
      .from('ams_textbook_pdfs')
      .upsert(
        upsertData,
        { onConflict: 'academy_id,bookcode' }
      )
      .select();

    if (upsertErr) {
      console.error('[API POST PDF] Upsert error:', upsertErr.message);
      // 컬럼 미존재시 fallback 시도 (quiz1_url 등 컬럼이 없는 DB 대비)
      const fallbackData = {
        academy_id: academyId,
        bookcode,
        pdf_url: pdfUrl ?? '',
        answer_url: answerUrl ?? '',
        explanation_url: explanationUrl ?? ''
      };
      const { data: fbData, error: fbErr } = await supabaseAdmin
        .from('ams_textbook_pdfs')
        .upsert(fallbackData, { onConflict: 'academy_id,bookcode' })
        .select();
      
      if (!fbErr) {
        return NextResponse.json({ 
          success: true, 
          data: fbData?.[0], 
          warning: '기본 교재 3종 PDF 링크만 저장되었습니다. (퀴즈 컬럼 미존재시 Supabase에 quiz1_url, quiz2_url, quiz3_url 컬럼을 추가해 주세요)' 
        });
      }
      return NextResponse.json({ error: `교재 링크 저장 실패: ${upsertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error('[API POST PDF] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 📌 [DELETE] 교재 PDF 구글 드라이브 링크 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { user, error: authErr } = await authenticateUser(req);
    if (authErr || !user) {
      return NextResponse.json({ error: authErr || '인증 실패' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const academyId = searchParams.get('academyId');
    const bookcode = searchParams.get('bookcode');

    if (!academyId || !bookcode) {
      return NextResponse.json({ error: '필수 파라미터(academyId, bookcode)가 누락되었습니다.' }, { status: 400 });
    }

    const teacher = await getTeacherProfile(user.id);
    if (!teacher) {
      return NextResponse.json({ error: '권한이 없습니다. (교사 정보 없음)' }, { status: 403 });
    }

    // 권한 검증: 마스터이거나 해당 학원의 어드민(원장)이어야 함
    const isMaster = teacher.role === 'master';
    const isAdmin = teacher.role === 'admin';
    if (!isMaster && (!isAdmin || teacher.academy_id !== academyId)) {
      return NextResponse.json({ error: '교재 링크를 삭제할 권한이 없습니다.' }, { status: 403 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('ams_textbook_pdfs')
      .delete()
      .eq('academy_id', academyId)
      .eq('bookcode', bookcode);

    if (deleteErr) {
      console.error('[API DELETE PDF] Delete error:', deleteErr.message);
      return NextResponse.json({ error: '교재 링크 삭제 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API DELETE PDF] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
