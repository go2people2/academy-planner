import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createStudentToken } from '@/lib/studentSession';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, phoneLast4, selectedStudentId } = body;

    if (!slug || !phoneLast4 || typeof phoneLast4 !== 'string') {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    const cleanInput = phoneLast4.trim();
    if (cleanInput.length < 4 || cleanInput.length > 5) {
      return NextResponse.json({ error: '번호 4~5자리를 입력해 주세요.' }, { status: 400 });
    }

    // 1. 학원 조회
    const rawSlug = String(slug || '').trim();
    let targetSlug = rawSlug.toLowerCase();
    try {
      targetSlug = decodeURIComponent(rawSlug).trim().toLowerCase();
    } catch (e) {}

    if (!targetSlug) {
      return NextResponse.json({ error: '학원 식별 정보가 누락되었습니다.' }, { status: 400 });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.info('[student-login-academy-debug]', {
        requestHost: req.headers.get('host') ?? null,
        requestSlugPresent: Boolean(slug),
        requestSlugLength: typeof slug === 'string' ? slug.length : -1,
        requestSlugNormalized: targetSlug,
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      });
    }

    const { data: academy, error: acErr } = await supabaseAdmin
      .from('ams_academies')
      .select('id, slug, operation_settings')
      .eq('slug', targetSlug)
      .maybeSingle();

    if (process.env.NODE_ENV !== 'production') {
      console.info('[student-login-academy-result]', {
        academyFound: Boolean(academy),
        academyErrorCode: acErr?.code ?? null,
      });
    }

    if (acErr || !academy) {
      return NextResponse.json({ error: '학원 정보 연결을 확인해 주세요.' }, { status: 404 });
    }

    // 3. 학생 후보군 조회
    const { data: rawStudents, error: sErr } = await supabaseAdmin
      .from('ams_students')
      .select('id, name, school, grade, phone, login_suffix, class_days, book_courses, academy_id, is_deleted')
      .eq('academy_id', academy.id);

    if (sErr) throw sErr;

    const allActiveStudents = (rawStudents || []).filter(s => s.is_deleted !== true);

    const inputLen = cleanInput.length;
    let matchedStudents: any[] = [];

    if (inputLen === 5) {
      const base4 = cleanInput.slice(0, 4);
      const suffix = cleanInput.slice(4);

      matchedStudents = (allActiveStudents || []).filter(s => {
        const sCleanPhone = String(s.phone || '').replace(/[^0-9]/g, '');
        const sSuffix = s.login_suffix !== null && s.login_suffix !== undefined ? String(s.login_suffix).trim() : '';
        return sCleanPhone.endsWith(base4) && sSuffix === suffix;
      });
    } else {
      matchedStudents = (allActiveStudents || []).filter(s => {
        const sCleanPhone = String(s.phone || '').replace(/[^0-9]/g, '');
        const hasNoSuffix = !s.login_suffix || String(s.login_suffix).trim() === '';
        return sCleanPhone.endsWith(cleanInput) && hasNoSuffix;
      });
    }

    if (matchedStudents.length === 0) {
      return NextResponse.json({ error: '입력한 번호와 일치하는 학생을 찾지 못했습니다. 학원 선택 또는 추가 번호를 확인해 주세요.' }, { status: 404 });
    }

    // 4. 단일 학생 확정 또는 후보 선택
    let targetStudent: any = null;

    if (matchedStudents.length > 1) {
      if (!selectedStudentId) {
        const candidates = matchedStudents.map(s => ({
          id: s.id,
          name: s.name,
          school: s.school,
          grade: s.grade,
          class_days: s.class_days,
          book_courses: s.book_courses
        }));
        return NextResponse.json({
          status: 'multiple_candidates',
          candidates
        });
      }

      targetStudent = matchedStudents.find(s => s.id === selectedStudentId);
      if (!targetStudent) {
        return NextResponse.json({ error: '유효하지 않은 학생 선택입니다.' }, { status: 403 });
      }
    } else {
      targetStudent = matchedStudents[0];
    }

    // 5. 토큰 발급 및 쿠키 설정
    const studentToken = createStudentToken(targetStudent.id, academy.id, targetStudent.name);
    const allowInsecure = process.env.ALLOW_INSECURE_STUDENT_COOKIE === 'true' || process.env.NODE_ENV !== 'production';
    const isSecure = !allowInsecure;

    const response = NextResponse.json({
      success: true,
      student: targetStudent
    });

    response.cookies.set({
      name: 'ams_student_session',
      value: studentToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      path: '/',
      maxAge: 12 * 60 * 60
    });

    return response;
  } catch (err: any) {
    console.error('[Student Login API Error]', err);
    return NextResponse.json({ error: err.message || '서버 오류' }, { status: 500 });
  }
}
