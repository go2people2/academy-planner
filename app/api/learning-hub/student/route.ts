import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyStudentToken } from '@/lib/studentSession';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * 📌 [GET] 학생 전용 안전 강의 모듈 조회 API
 * - 오직 req.cookies['ams_student_session'] 의 서명 토큰만 신뢰하여 학생 및 학원을 확정
 * - 클라이언트 query/body의 studentId/academyId는 권한 판단에 일절 사용하지 않음
 * - 해당 학생에게 배정된 교재 중 'is_published === true' 인 공개 모듈만 최소 DTO로 반환
 */
export async function GET(req: NextRequest) {
  try {
    const studentCookie = req.cookies.get('ams_student_session')?.value;

    if (!studentCookie) {
      return NextResponse.json({
        error: '학생 로그인이 필요합니다.',
        code: 'UNAUTHORIZED_STUDENT'
      }, { status: 401 });
    }

    // 1. 전용 서명 토큰 검증
    const payload = verifyStudentToken(studentCookie);
    if (!payload || !payload.student_id || !payload.academy_id) {
      return NextResponse.json({
        error: '학생 인증 세션이 만료되었거나 유효하지 않습니다.',
        code: 'INVALID_STUDENT_SESSION'
      }, { status: 401 });
    }

    const { student_id, academy_id } = payload;

    // 2. 서버 DB에서 해당 학생의 배정 교재 목록 조회
    const { data: student, error: stErr } = await supabaseAdmin
      .from('ams_students')
      .select('id, academy_id, book_courses, assigned_books')
      .eq('id', student_id)
      .eq('academy_id', academy_id)
      .is('is_deleted', false)
      .single();

    if (stErr || !student) {
      return NextResponse.json({
        error: '학생 정보를 찾을 수 없습니다.',
        code: 'STUDENT_NOT_FOUND'
      }, { status: 404 });
    }

    // 학생에게 배정된 교재 코드 추출
    const assignedCodes: string[] = [];
    if (student.book_courses && typeof student.book_courses === 'object') {
      Object.keys(student.book_courses).forEach(key => {
        if (!key.startsWith('__') && !key.startsWith("'__")) {
          assignedCodes.push(key.trim().toLowerCase());
        }
      });
    }
    if (Array.isArray(student.assigned_books)) {
      student.assigned_books.forEach((b: string) => {
        const c = String(b).trim().toLowerCase();
        if (!assignedCodes.includes(c)) assignedCodes.push(c);
      });
    }

    // 3. 해당 학원의 교재 모듈 조회 (ams_digital_math_modules)
    const { data: dbRows } = await supabaseAdmin
      .from('ams_digital_math_modules')
      .select('bookcode, book_type, module_data')
      .eq('academy_id', academy_id);

    // 4. 레거시 operation_settings 백업 데이터 조회
    const { data: academyData } = await supabaseAdmin
      .from('ams_academies')
      .select('operation_settings')
      .eq('id', academy_id)
      .maybeSingle();

    const baseServerUrl = academyData?.operation_settings?.base_server_url || '';
    const legacyModules = academyData?.operation_settings?.digital_math_modules || {};
    const mergedModules: Record<string, any> = { ...legacyModules };

    if (dbRows && dbRows.length > 0) {
      dbRows.forEach(row => {
        mergedModules[row.bookcode] = {
          bookType: row.book_type || 'concept',
          ...(row.module_data || {})
        };
      });
    }

    // 💡 [보안 규칙 7] 해당 학생에게 배정된 교재 범위 내에서만 공개된 단원/영상만 필터링한 최소 DTO 구축
    const studentFilteredModules: Record<string, any> = {};

    Object.keys(mergedModules).forEach(code => {
      const normCode = code.trim().toLowerCase();
      // 학생에게 배정되지 않은 교재는 원천 차단
      if (assignedCodes.length > 0 && !assignedCodes.includes(normCode)) {
        return;
      }

      const mod = mergedModules[code];
      if (!mod) return;

      // 공개된 단원 정보만 최소 필드로 축약
      const sanitizedUnits: Record<string, any> = {};
      if (mod.units && typeof mod.units === 'object') {
        Object.keys(mod.units).forEach(uIdx => {
          const unit = mod.units[uIdx];
          if (!unit) return;
          // is_published 가 명시적으로 false 가 아니거나 비디오가 있는 경우
          sanitizedUnits[uIdx] = {
            customUnitName: unit.customUnitName || '',
            videoPath: unit.videoPath || '',
            timelineText: unit.timelineText || ''
          };
        });
      }

      studentFilteredModules[code] = {
        bookType: mod.bookType || 'concept',
        units: sanitizedUnits
      };
    });

    return NextResponse.json({
      success: true,
      modules: studentFilteredModules,
      baseServerUrl: baseServerUrl
    });
  } catch (err: any) {
    console.error('[Student Learning Hub API Error]', err);
    return NextResponse.json({ error: '강의 목록을 조회하지 못했습니다.' }, { status: 500 });
  }
}
