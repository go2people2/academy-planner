import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 서버 전용 - service role key로 RLS 우회
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

function getTodayKST(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

function getNowKST() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return { hour: kst.getUTCHours(), minute: kst.getUTCMinutes() };
}

function getNowISO(): string {
  return new Date().toISOString();
}

function isLate(firstPeriodTime: string, lateThreshold: number): boolean {
  if (!firstPeriodTime) return false;
  const [fh, fm] = firstPeriodTime.split(':').map(Number);
  if (isNaN(fh) || isNaN(fm)) return false;
  const { hour, minute } = getNowKST();
  return hour * 60 + minute > fh * 60 + fm + lateThreshold;
}

function getDayOfWeekKST(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[kst.getUTCDay()];
}

// GET: 학원 정보 + 오늘 최근 출결 기록
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) return Response.json({ error: 'slug 필요' }, { status: 400 });

  const supabase = getSupabase();

  const { data: academy, error: acError } = await supabase
    .from('ams_academies')
    .select('id, academy_name, operation_settings')
    .eq('slug', slug.toLowerCase())
    .maybeSingle();

  if (acError || !academy) {
    return Response.json(
      { error: '학원을 찾을 수 없습니다.', debug: { slug, acError: acError?.message } },
      { status: 404 }
    );
  }

  const today = getTodayKST();

  // 오늘 등원 기록이 있는 세션 조회 (등원 + 하원 모두 포함)
  const { data: logs } = await supabase
    .from('ams_session_logs')
    .select('id, student_id, attendance_status, check_in_at, check_out_at')
    .eq('session_date', today)
    .not('check_in_at', 'is', null)
    .order('check_in_at', { ascending: false })
    .limit(200);

  let records: any[] = [];
  if (logs && logs.length > 0) {
    const ids = [...new Set(logs.map((l) => l.student_id))];
    const { data: students } = await supabase
      .from('ams_students')
      .select('id, name')
      .in('id', ids);
    const nameMap = Object.fromEntries((students || []).map((s) => [s.id, s.name]));

    // 등원 / 하원 각각 이벤트로 펼치기
    const events: { studentName: string; type: '등원' | '하원'; status?: string; time: string }[] = [];
    for (const l of logs) {
      if (l.check_in_at) {
        events.push({
          studentName: nameMap[l.student_id] || '알 수 없음',
          type: '등원',
          status: l.attendance_status,
          time: l.check_in_at,
        });
      }
      if (l.check_out_at) {
        events.push({
          studentName: nameMap[l.student_id] || '알 수 없음',
          type: '하원',
          time: l.check_out_at,
        });
      }
    }
    // 최신순 정렬 후 상위 10건
    records = events
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10);
  }

  return Response.json({
    academyName: academy.academy_name,
    operationSettings: academy.operation_settings,
    recentRecords: records,
  });
}

// POST: 전화번호 뒷 4자리 → 등원 or 하원 처리 (학생 / 교직원 구분)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, digits, action } = body;

  if (!slug || !digits || digits.length !== 4) {
    return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const supabase = getSupabase();
  const today = getTodayKST();
  const nowISO = getNowISO();

  // 1. 학원 정보 조회
  const { data: academy } = await supabase
    .from('ams_academies')
    .select('id, academy_name, operation_settings')
    .eq('slug', slug.toLowerCase())
    .maybeSingle();

  if (!academy) return Response.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });

  // 2. [조회 1단계] 학생 명단 조회
  const { data: students } = await supabase
    .from('ams_students')
    .select('id, name, phone, class_days')
    .eq('academy_id', academy.id)
    .eq('is_deleted', false)
    .like('phone', `%${digits}`);

  // 💡 중복 전화번호 에러 검출 (학생)
  if (students && students.length > 1) {
    return Response.json(
      { error: '번호가 동일한 학생이 여러 명입니다. 선생님께 문의해주세요.', duplicates: students.map((s) => s.name) },
      { status: 409 }
    );
  }

  const isStudentFound = students && students.length === 1;

  // 3. [조회 2단계] 학생이 없을 경우 교직원/조교 조회 (Fallback)
  let teacher = null;
  if (!isStudentFound) {
    const { data: teachers } = await supabase
      .from('ams_teachers')
      .select('id, name, phone, role')
      .eq('academy_id', academy.id)
      .like('phone', `%${digits}`);

    if (teachers && teachers.length > 1) {
      return Response.json(
        { error: '번호가 동일한 직원이 여러 명입니다. 관리자에게 문의해주세요.', duplicates: teachers.map((t) => t.name) },
        { status: 409 }
      );
    }
    if (teachers && teachers.length === 1) {
      teacher = teachers[0];
    }
  }

  // 4. 둘 다 매칭되지 않을 경우 404 리턴
  if (!isStudentFound && !teacher) {
    return Response.json({ error: '등록된 학생이나 교직원을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { hour, minute } = getNowKST();
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  // ==========================================
  // 💼 [교직원/조교 출퇴근 처리 분기]
  // ==========================================
  if (teacher) {
    // (1) 취소 액션 처리 (Undo)
    if (action === 'undo') {
      const { data: log } = await supabase
        .from('ams_teacher_logs')
        .select('id, clock_in_at, clock_out_at')
        .eq('teacher_id', teacher.id)
        .eq('work_date', today)
        .maybeSingle();

      if (!log) {
        return Response.json({ error: '오늘 기록된 출퇴근 내역이 없습니다.' }, { status: 404 });
      }

      if (log.clock_out_at) {
        // 퇴근 취소 -> clock_out_at 및 total_minutes 초기화
        const { error } = await supabase
          .from('ams_teacher_logs')
          .update({ clock_out_at: null, total_minutes: 0 })
          .eq('id', log.id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ success: true, isTeacher: true, type: '퇴근취소', teacherName: teacher.name });
      } else {
        // 출근 취소 -> 근태 행 삭제
        const { error } = await supabase
          .from('ams_teacher_logs')
          .delete()
          .eq('id', log.id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ success: true, isTeacher: true, type: '출근취소', teacherName: teacher.name });
      }
    }

    // (2) 오늘 기존 근태 로그 확인
    const { data: existingLog } = await supabase
      .from('ams_teacher_logs')
      .select('id, clock_in_at, clock_out_at')
      .eq('teacher_id', teacher.id)
      .eq('work_date', today)
      .maybeSingle();

    // 출근 처리 (기록이 없을 때)
    if (!existingLog) {
      const { error } = await supabase
        .from('ams_teacher_logs')
        .insert([{ teacher_id: teacher.id, academy_id: academy.id, work_date: today, clock_in_at: nowISO }]);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true, isTeacher: true, type: '출근', teacherName: teacher.name, time: timeStr });
    }

    // 퇴근 처리 (출근 기록만 있고 퇴근이 없을 때)
    if (!existingLog.clock_out_at) {
      const clockIn = new Date(existingLog.clock_in_at);
      const clockOut = new Date(nowISO);
      const diffMs = clockOut.getTime() - clockIn.getTime();
      const diffMins = Math.max(0, Math.floor(diffMs / 1000 / 60)); // 분 단위 정산

      const { error } = await supabase
        .from('ams_teacher_logs')
        .update({ clock_out_at: nowISO, total_minutes: diffMins })
        .eq('id', existingLog.id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true, isTeacher: true, type: '퇴근', teacherName: teacher.name, time: timeStr, duration: diffMins });
    }

    // 이미 출퇴근 완료
    return Response.json(
      { error: `${teacher.name} 조교/선생님은 이미 금일 출근 및 퇴근 처리가 완료되었습니다.` },
      { status: 409 }
    );
  }

  // ==========================================
  // 🎒 [학생 등하원 처리 분기]
  // ==========================================
  if (!students || students.length === 0) {
    return Response.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
  }
  const student = students[0];

  // (1) 학생 취소 액션 처리 (Undo)
  if (action === 'undo') {
    const { data: log } = await supabase
      .from('ams_session_logs')
      .select('id, check_in_at, check_out_at')
      .eq('student_id', student.id)
      .eq('session_date', today)
      .maybeSingle();

    if (!log) {
      return Response.json({ error: '오늘 기록된 출결 내역이 없습니다.' }, { status: 404 });
    }

    if (log.check_out_at) {
      const { error } = await supabase
        .from('ams_session_logs')
        .update({ check_out_at: null })
        .eq('id', log.id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true, type: '하원취소', studentName: student.name });
    } else if (log.check_in_at) {
      const todayDayOfWeek = getDayOfWeekKST();
      const isRegularClass = (student.class_days || []).map((d: string) => d.trim()).includes(todayDayOfWeek);
      const targetStatus = isRegularClass ? null : '보강';

      const { error } = await supabase
        .from('ams_session_logs')
        .update({ check_in_at: null, attendance_status: targetStatus })
        .eq('id', log.id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true, type: '등원취소', studentName: student.name });
    }

    return Response.json({ error: '취소할 수 있는 출결 기록이 없습니다.' }, { status: 400 });
  }

  const ops = academy.operation_settings || {};

  // (2) 오늘 기존 세션 확인
  const { data: existing } = await supabase
    .from('ams_session_logs')
    .select('id, check_in_at, check_out_at, attendance_status')
    .eq('student_id', student.id)
    .eq('session_date', today)
    .maybeSingle();

  // 등원 처리
  if (!existing || !existing.check_in_at) {
    const attendanceStatus = isLate(ops.first_period_time || '', ops.late_threshold ?? 10) ? '지각' : '출석';
    const { error } = await supabase
      .from('ams_session_logs')
      .upsert(
        [{ student_id: student.id, session_date: today, attendance_status: attendanceStatus, check_in_at: nowISO }],
        { onConflict: 'student_id,session_date' }
      );
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ success: true, type: '등원', studentName: student.name, attendanceStatus, time: timeStr });
  }

  // 하원 처리
  if (!existing.check_out_at) {
    const { error } = await supabase
      .from('ams_session_logs')
      .update({ check_out_at: nowISO })
      .eq('id', existing.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ success: true, type: '하원', studentName: student.name, time: timeStr });
  }

  // 이미 등원 + 하원 완료
  return Response.json(
    { error: `${student.name} 학생은 이미 등원/하원이 완료되었습니다.` },
    { status: 409 }
  );
}
