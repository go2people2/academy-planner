import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyHostRequest } from '@/lib/server/hostAuth';

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StudentSyncPayload {
  id: string;
  name?: string;
  grade?: string | null;
  teacher_id?: string | null;
}

interface SyncResult {
  id: string;
  status: 'created' | 'updated';
}

interface SyncError {
  id: string;
  error_code: string;
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. 호스트 토큰 및 오답노트 모듈 이용 권한 검증
    const auth = await verifyHostRequest(req, supabaseAdmin);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error_code: auth.errorCode, error: auth.error },
        { status: auth.status }
      );
    }

    const academyId = auth.academyId;

    // 2. 요청 Body 파싱 및 배열 유효성 확인
    const body = await req.json();
    if (!body || !Array.isArray(body.students)) {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_PAYLOAD', error: 'students 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    const students: StudentSyncPayload[] = body.students;
    const results: SyncResult[] = [];
    const errors: SyncError[] = [];

    if (students.length === 0) {
      return NextResponse.json({
        success: true,
        synced_count: 0,
        failed_count: 0,
        results: [],
        errors: [],
      });
    }

    // 3. 요청에 포함된 교사 ID 목록 사전 유효성 조회 (해당 학원 소속 검증)
    const validTeacherIds = await prefetchValidTeachers(students, academyId);

    // 4. 요청에 포함된 기존 학생 정보 일괄 사전 조회
    const existingStudentsMap = await prefetchExistingStudents(students);

    // 5. 각 학생 데이터 동기화 처리
    for (const item of students) {
      const studentId = item.id;

      // 5-1. UUID 형식 검증
      if (!studentId || !UUID_REGEX.test(studentId)) {
        errors.push({
          id: studentId || 'unknown',
          error_code: 'INVALID_ID',
          message: '유효한 UUID 형식의 학생 ID가 필요합니다.',
        });
        continue;
      }

      // 5-2. 담당 교사 유효성 검증
      if (item.teacher_id !== undefined && item.teacher_id !== null) {
        if (!UUID_REGEX.test(item.teacher_id) || !validTeacherIds.has(item.teacher_id)) {
          errors.push({
            id: studentId,
            error_code: 'INVALID_TEACHER',
            message: '지정한 담당 교사를 찾을 수 없거나 다른 학원 소속입니다.',
          });
          continue;
        }
      }

      const existing = existingStudentsMap.get(studentId);

      if (existing) {
        // [기존 학생 처리]
        // 5-3. 타 학원 소속 여부 확인
        if (existing.academy_id !== academyId) {
          errors.push({
            id: studentId,
            error_code: 'ACADEMY_MISMATCH',
            message: '다른 학원에 등록된 학생 ID입니다.',
          });
          continue;
        }

        // 5-4. 퇴원/삭제 학생 여부 확인
        if (existing.is_deleted) {
          errors.push({
            id: studentId,
            error_code: 'STUDENT_DELETED',
            message: '퇴원/삭제 처리된 학생은 업로드로 수정하거나 복원할 수 없습니다.',
          });
          continue;
        }

        // 5-5. 부분 갱신 (name, grade, teacher_id만 허용)
        const updatePayload: Record<string, any> = {};

        if (item.name !== undefined) {
          const trimmedName = String(item.name).trim();
          if (!trimmedName) {
            errors.push({
              id: studentId,
              error_code: 'INVALID_NAME',
              message: '학생 이름은 공백일 수 없습니다.',
            });
            continue;
          }
          if (trimmedName !== existing.name) {
            updatePayload.name = trimmedName;
          }
        }

        if (item.grade !== undefined) {
          const cleanGrade = item.grade === null ? null : String(item.grade).trim() || null;
          if (cleanGrade !== existing.grade) {
            updatePayload.grade = cleanGrade;
          }
        }

        if (item.teacher_id !== undefined) {
          const cleanTeacher = item.teacher_id || null;
          if (cleanTeacher !== existing.teacher_id) {
            updatePayload.teacher_id = cleanTeacher;
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          const { error: updErr } = await supabaseAdmin
            .from('ams_students')
            .update(updatePayload)
            .eq('id', studentId)
            .eq('academy_id', academyId);

          if (updErr) {
            console.error(`[students/sync] Update error for ${studentId}:`, updErr);
            errors.push({
              id: studentId,
              error_code: 'UPDATE_FAILED',
              message: '학생 정보 갱신 중 데이터베이스 오류가 발생했습니다.',
            });
            continue;
          }
        }

        results.push({ id: studentId, status: 'updated' });
      } else {
        // [신규 학생 생성]
        const cleanName = item.name !== undefined ? String(item.name).trim() : '';
        if (!cleanName) {
          errors.push({
            id: studentId,
            error_code: 'INVALID_NAME',
            message: '신규 학생의 이름은 필수이며 공백일 수 없습니다.',
          });
          continue;
        }

        const cleanGrade = item.grade !== undefined && item.grade !== null ? String(item.grade).trim() || null : null;
        const cleanTeacherId = item.teacher_id || null;

        const insertPayload = {
          id: studentId,
          academy_id: academyId,
          name: cleanName,
          grade: cleanGrade,
          teacher_id: cleanTeacherId,
          course: null,
          class_name: null,
          class_days: [],
          day_schedules: {},
          assigned_books: [],
          is_deleted: false,
          registration_date: new Date().toISOString().split('T')[0],
        };

        const { error: insErr } = await supabaseAdmin
          .from('ams_students')
          .insert([insertPayload]);

        if (insErr) {
          // 동시 요청 등으로 인한 중복 삽입 시도 재확인
          if (insErr.code === '23505') {
            const { data: recheck } = await supabaseAdmin
              .from('ams_students')
              .select('id, academy_id')
              .eq('id', studentId)
              .maybeSingle();

            if (recheck && recheck.academy_id === academyId) {
              results.push({ id: studentId, status: 'updated' });
              continue;
            }
          }

          console.error(`[students/sync] Insert error for ${studentId}:`, insErr);
          errors.push({
            id: studentId,
            error_code: 'INSERT_FAILED',
            message: '신규 학생 등록 중 데이터베이스 오류가 발생했습니다.',
          });
          continue;
        }

        results.push({ id: studentId, status: 'created' });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      synced_count: results.length,
      failed_count: errors.length,
      results,
      errors,
    });
  } catch (err: any) {
    console.error('[students/sync] Fatal Exception:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/** 💡 교사 ID 유효성 일괄 확인 */
async function prefetchValidTeachers(students: StudentSyncPayload[], academyId: string): Promise<Set<string>> {
  const teacherIds = Array.from(
    new Set(
      students
        .map(s => s.teacher_id)
        .filter((tid): tid is string => typeof tid === 'string' && UUID_REGEX.test(tid))
    )
  );

  if (teacherIds.length === 0) return new Set();

  const { data } = await supabaseAdmin
    .from('ams_teachers')
    .select('id')
    .eq('academy_id', academyId)
    .in('id', teacherIds);

  return new Set((data || []).map((t: any) => t.id));
}

/** 💡 기존 학생 정보 일괄 확인 */
async function prefetchExistingStudents(students: StudentSyncPayload[]): Promise<Map<string, any>> {
  const studentIds = Array.from(
    new Set(
      students
        .map(s => s.id)
        .filter((sid): sid is string => typeof sid === 'string' && UUID_REGEX.test(sid))
    )
  );

  if (studentIds.length === 0) return new Map();

  const { data } = await supabaseAdmin
    .from('ams_students')
    .select('id, academy_id, is_deleted, name, grade, teacher_id')
    .in('id', studentIds);

  const map = new Map<string, any>();
  (data || []).forEach((s: any) => map.set(s.id, s));
  return map;
}
