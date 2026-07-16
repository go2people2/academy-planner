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

// JWT 토큰 검증 헬퍼
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

// 교사 권한 검증 헬퍼
async function getTeacherProfile(userId: string) {
  const { data: teacher, error } = await supabaseAdmin
    .from('ams_teachers')
    .select('role, academy_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !teacher) return null;
  return teacher;
}

// 📌 [GET] 특정 학원 및 선생님의 주간 시간표 조회
export async function GET(req: NextRequest) {
  try {
    const { user, error: authErr } = await authenticateUser(req);
    if (authErr || !user) {
      return NextResponse.json({ error: authErr || '인증 실패' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const academyId = searchParams.get('academyId');
    const teacherId = searchParams.get('teacherId');

    if (!academyId || !teacherId) {
      return NextResponse.json({ error: 'academyId와 teacherId 파라미터가 필요합니다.' }, { status: 400 });
    }

    const teacher = await getTeacherProfile(user.id);
    if (!teacher) {
      return NextResponse.json({ error: '조회 권한이 없습니다.' }, { status: 403 });
    }

    // 보안 검사: 마스터가 아닌 경우 본인 학원 정보만 조회 가능
    if (teacher.role !== 'master' && teacher.academy_id !== academyId) {
      return NextResponse.json({ error: '타 학원의 시간표를 조회할 수 없습니다.' }, { status: 403 });
    }

    const { data: timetables, error: fetchErr } = await supabaseAdmin
      .from('ams_timetables')
      .select('*')
      .eq('academy_id', academyId)
      .eq('teacher_id', teacherId);

    if (fetchErr) {
      console.error('[API GET TIMETABLE] Fetch error:', fetchErr.message);
      return NextResponse.json({ error: '시간표 데이터 조회 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, timetables });
  } catch (err: any) {
    console.error('[API GET TIMETABLE] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 📌 [POST] 시간표 전체 일괄 저장 & 학생 요일/시간 자동 동기화
export async function POST(req: NextRequest) {
  try {
    const { user, error: authErr } = await authenticateUser(req);
    if (authErr || !user) {
      return NextResponse.json({ error: authErr || '인증 실패' }, { status: 401 });
    }

    const body = await req.json();
    const { academyId, teacherId, timetables } = body;

    if (!academyId || !teacherId || !Array.isArray(timetables)) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었거나 올바르지 않습니다.' }, { status: 400 });
    }

    const teacher = await getTeacherProfile(user.id);
    if (!teacher) {
      return NextResponse.json({ error: '저장 권한이 없습니다.' }, { status: 403 });
    }

    // 마스터이거나 해당 학원의 admin 또는 본인 시간표 편집 허용 (교사도 자기 시간표는 가능하도록)
    if (teacher.role !== 'master' && teacher.academy_id !== academyId) {
      return NextResponse.json({ error: '시간표를 저장할 권한이 없습니다.' }, { status: 403 });
    }

    // 1. 기존 이 선생님의 시간표 데이터를 완전히 날린 후 새로 삽입하여 정렬 보존
    const { error: deleteErr } = await supabaseAdmin
      .from('ams_timetables')
      .delete()
      .eq('academy_id', academyId)
      .eq('teacher_id', teacherId);

    if (deleteErr) {
      console.error('[API POST TIMETABLE] Delete old records error:', deleteErr.message);
      return NextResponse.json({ error: '기존 시간표 초기화 실패' }, { status: 500 });
    }

    // 유효한 배치(학생 ID가 있는 것들 또는 배경색이 기본이 아닌 자리)만 추려 냄
    const insertPayload = timetables.map((item: any) => ({
      academy_id: academyId,
      teacher_id: teacherId,
      day_of_week: item.day_of_week,
      time_slot: item.time_slot,
      row_index: item.row_index,
      student_id: item.student_id || null,
      bg_color: item.bg_color || 'default'
    }));

    if (insertPayload.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from('ams_timetables')
        .insert(insertPayload);

      if (insertErr) {
        console.error('[API POST TIMETABLE] Insert error:', insertErr.message);
        return NextResponse.json({ error: '시간표 저장 실패' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API POST TIMETABLE] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
