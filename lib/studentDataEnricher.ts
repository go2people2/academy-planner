import { getTodayStr, getDayOfWeek, getInitial } from './utils';
import { ATTENDANCE_STATUS, normalizeAttendanceStatus } from './sessionFieldMap';
import { Student, SessionLog, StudentStatus, Task } from '@/types/dashboard';

// 1. 교재 코드를 실제 이름으로 변환하는 유틸리티
export const translateBookCodes = (text: string, availableTextbooks: any[]) => {
  if (!text || !availableTextbooks || availableTextbooks.length === 0) return text;
  let result = text;
  const sortedMaster = [...availableTextbooks].sort((a, b) => (b.bookcode?.length || 0) - (a.bookcode?.length || 0));
  sortedMaster.forEach(m => {
    if (m.bookcode && m.title) {
      const escapedCode = m.bookcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedCode, 'gi');
      result = result.replace(regex, m.title);
    }
  });
  return result;
};

// 2. 예정 테스트 정보 파싱 헬퍼
export const parseHomeworkTo = (homeworkToRaw: any) => {
  let text = '', cut = 0, trial = 1, json = [];
  let hasHwTo = false;
  try {
    if (homeworkToRaw?.startsWith('{')) {
      const parsed = JSON.parse(homeworkToRaw);
      text = parsed.text || ''; cut = parsed.cut || 0; trial = parsed.trial || 1; json = parsed.json || [];
      if (text) hasHwTo = true;
    } else if (homeworkToRaw) {
      hasHwTo = true; text = homeworkToRaw;
    }
  } catch (e) {}
  return { text, cut, trial, json, hasHwTo };
};

// 3. 테스트 결과 정보 파싱 헬퍼
export const parseTestResult = (testResultRaw: any, testStatus: string) => {
  let isTestCompleted = undefined;
  let tCut = 0;
  let missionSnapshot = '';
  let todoAchievement = 0;
  let sType: 'score' | 'count' = 'score';
  let tTotal = 0;
  let hasTestResult = false;
  let hwCheckedToday = false;
  let hwPassedToday = false;
  try {
    if (testResultRaw?.startsWith('{')) {
      const res = JSON.parse(testResultRaw);
      isTestCompleted = res.completed === true ? true : (res.completed === false ? false : undefined);
      tCut = res.cut || 0;
      missionSnapshot = res.mission || '';
      todoAchievement = res.todo_achievement || 0;
      sType = res.score_type || 'score';
      tTotal = res.total_count || 0;
      hwCheckedToday = res.hw_checked_today === true;
      hwPassedToday = res.hw_passed_today === true;
      if (isTestCompleted !== undefined || testStatus || missionSnapshot || todoAchievement > 0) hasTestResult = true;
    }
  } catch (e) {}
  return { isTestCompleted, tCut, missionSnapshot, todoAchievement, sType, tTotal, hasTestResult, hwCheckedToday, hwPassedToday };
};

// 4. 개별 DB 로그를 SessionLog 형식으로 변환
export const buildSessionLog = (l: any, textbooks: any[]): SessionLog => {
  const nq = parseHomeworkTo(l.homework_to);
  const tr = parseTestResult(l.test_result, l.test_status);

  return {
    id: l.id, date: l.session_date, course_name: l.course_name || '정규', status: (l.status || 'none') as StudentStatus,
    attendance_status: normalizeAttendanceStatus(l.attendance_status), 
    special_notes: translateBookCodes(l.special_notes || '', textbooks),
    classwork_text: translateBookCodes(l.classwork_text || '', textbooks), classwork_json: l.classwork_json || [],
    completed_classwork_text: translateBookCodes(l.completed_classwork_text || '', textbooks), 
    completed_classwork_json: l.completed_classwork_json || [],
    homework_text: translateBookCodes(l.homework_text || '', textbooks), homework_json: l.homework_json || [],
    next_quiz_text: translateBookCodes(nq.text, textbooks), next_quiz_json: nq.json, next_quiz_cut: nq.text ? nq.cut : (nq.hasHwTo ? nq.cut : 0), next_quiz_trial: nq.text ? nq.trial : (nq.hasHwTo ? nq.trial : 1),
    test_id: translateBookCodes(l.test_status || '', textbooks), test_score: l.test_score, 
    test_score_type: tr.sType,
    test_total_count: tr.tTotal,
    test_cut: tr.tCut, 
    test_completed: tr.isTestCompleted, 
    mission: translateBookCodes(tr.missionSnapshot, textbooks),
    todo_achievement: tr.todoAchievement,
    report_sent_at: l.report_sent_at,
    timer_started_at: l.timer_started_at,
    timer_duration: l.timer_duration,
    test_answers: l.test_answers || null,
    moved_to_hour: (() => {
      if (l.moved_to_hour !== undefined && l.moved_to_hour !== null) return l.moved_to_hour;
      const status = l.attendance_status || '';
      if (status.includes(':')) {
        const parts = status.split(':');
        const val = parseInt(parts[parts.length - 1]);
        if (!isNaN(val) && val < 24) return val;
      }
      return null;
    })(),
    hasHwTo: nq.hasHwTo, hasTestResult: tr.hasTestResult,
    hw_checked_today: tr.hwCheckedToday,
    hw_passed_today: tr.hwPassedToday,
    approval_status: l.approval_status || 'none',
    test_result: l.test_result || null,
    attendance_reason: l.attendance_reason || null,
    management_notes: translateBookCodes(l.management_notes || '', textbooks)
  };
};

// 5. 과거 숙제 내역 취합 유틸리티
export const calculateAggregatedHw = (pastLogs: SessionLog[], academy: any, student?: any) => {
  let aggregatedHw = "";
  if (pastLogs.length === 0) return "";

  for (const log of pastLogs) {
    const dayName = getDayOfWeek(log.date);
    const isRegularClass = student?.class_days?.map((d: string) => d.trim()).includes(dayName);

    if (log.homework_text && log.homework_text.trim() !== '' && log.homework_text.trim() !== '결석') {
      const dateStr = log.date ? log.date.slice(5).replace('-', '.') : '';
      const makeupLabel = (!isRegularClass || log.attendance_status?.startsWith('보강')) ? ' [보강]' : '';
      const line = `${dateStr}(${dayName})${makeupLabel}\n${log.homework_text}`;
      aggregatedHw = aggregatedHw ? `${line}\n\n${aggregatedHw}` : line;
    }

    // 이미 검사 완료(hw_checked_today)로 체크된 날짜를 만나면 그 이전 과거는 탐색 종료
    if (log.hw_checked_today === true) {
      break;
    }
  }
  return aggregatedHw;
};

// 6. 오늘의 세션 데이터 결정 및 이월 로직
export const determineTodaySession = (
  student: any, todayLog: SessionLog | undefined, baseSession: SessionLog | undefined, 
  isTodayClassDay: boolean, selectedDate: string, academy: any
) => {
  // 💡 예정된 다음 테스트(next_quiz_text)를 최우선으로 지정하되, 비어있으면 지난 수업 테스트(test_id)를 재시험/이월 시험으로 자동 지정
  const activePlanText = baseSession?.next_quiz_text || 
                         (baseSession?.test_completed === false ? (baseSession?.test_id || "") : "") || 
                         baseSession?.test_id || "";
  const activePlanCut = baseSession?.next_quiz_text 
    ? (Number(baseSession.next_quiz_cut) || 0) 
    : (Number(baseSession?.test_cut) || 0);
  const activePlanTrial = baseSession?.next_quiz_text ? (Number(baseSession.next_quiz_trial) || 1) : 1;
  
  const todayMission = todayLog?.mission || "";
  const defaultScoreType = baseSession?.test_score_type || 'score';

  if (todayLog) {
    todayLog.mission = todayMission;
    
    if (!todayLog.test_score_type) todayLog.test_score_type = defaultScoreType;

    const currentTestId = (todayLog.test_id || '').trim();

    // 💡 [규칙] todayLog가 이미 존재하는 세션이면 test_id를 자동으로 채우지 않는다.
    // 사용자가 의도적으로 비웠을 수 있으므로, 자동 이월은 세션이 아예 없는 최초 생성 시(아래 else 분기)에서만 수행한다.

    if (!isTodayClassDay && !todayLog.next_quiz_text && activePlanText) {
      todayLog.next_quiz_text = activePlanText; 
      todayLog.next_quiz_cut = activePlanCut; 
      todayLog.next_quiz_trial = activePlanTrial;
    }
    return todayLog;
  }

  return { 
    id: 'temp', date: selectedDate, status: 'none', 
    attendance_status: ATTENDANCE_STATUS.BEFORE, 
    test_id: activePlanText, 
    test_cut: activePlanCut, 
    mission: '', next_quiz_text: !isTodayClassDay ? activePlanText : '', 
    next_quiz_cut: !isTodayClassDay ? activePlanCut : 0, next_quiz_trial: !isTodayClassDay ? activePlanTrial : 1, 
    test_completed: undefined,
    test_score_type: defaultScoreType
  } as any;
};

// 7. 빈 껍데기 세션 로그 판정 헬퍼
export const isValidHistoryLog = (l: any) => {
  if (!l) return false;
  const hasStatus = l.status && l.status !== 'none';
  const hasAttendance = l.attendance_status && l.attendance_status !== '출석전' && l.attendance_status !== 'BEFORE';
  const hasContent = (l.classwork_text || '').trim() || 
                     (l.completed_classwork_text || '').trim() || 
                     (l.homework_text || '').trim() || 
                     (l.mission || '').trim();
  const hasTest = l.test_completed || (l.test_score !== undefined && l.test_score !== null && l.test_score !== '');
  
  return hasStatus || hasAttendance || hasContent || hasTest;
};

// 8. 학생의 최근 5회차 학습 상태 히스토리 계산
export const calculateStudentHistory = (logs: SessionLog[], targetDate: string): StudentStatus[] => {
  const history = logs
    .filter(l => l.date < targetDate && isValidHistoryLog(l))
    .slice(0, 5)
    .map(l => l.status);
  while (history.length < 5) history.push('none');
  return history;
};

// 9. 오늘 수업 계획의 모태가 될 과거 세션(베이스 세션) 선택
// 💡 courseName 파라미터: 정규/특강 로그를 구분하여 이월 기준을 혼용하지 않도록 방지
export const selectBaseSession = (logs: SessionLog[], targetDate: string, holidays: any[], courseName = '정규'): SessionLog | undefined => {
  const pastLogs = logs
    .filter(l => l.date < targetDate)
    .filter(l =>
      courseName === '정규'
        ? (!l.course_name || l.course_name === '정규')  // 레거시 로그(course_name 없음) 포함
        : l.course_name === courseName
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return pastLogs.find(l => {
    const isLogHoliday = (holidays || []).some((h: any) => h.date === l.date);
    const isMakeup = l.attendance_status?.startsWith(ATTENDANCE_STATUS.SUPPLEMENT);
    return (l.next_quiz_text || l.test_id || l.classwork_text || l.homework_text) && 
           ![ATTENDANCE_STATUS.ABSENT, ATTENDANCE_STATUS.CANCELED, ATTENDANCE_STATUS.EXCLUDED].includes(l.attendance_status as any) && (!isLogHoliday || isMakeup); 
  }) || pastLogs[0];
};

// 10. 오늘의 수업 여부 및 휴일 상태 판정
export const evaluateTodayStatus = (targetDate: string, classDays: string[], holidays: any[]) => {
  const isScheduledDay = classDays?.map((d: string) => d.trim()).includes(getDayOfWeek(targetDate));
  const isHoliday = (holidays || []).some((h: any) => h.date === targetDate);
  const isTodayClassDay = isScheduledDay && !isHoliday;
  return { isScheduledDay, isHoliday, isTodayClassDay };
};

// 11. 학생 담당 교사 정보 추출
export const findTeacherInfo = (teachers: any[], teacherId?: string, fallbackName?: string) => {
  const teacher = (teachers || []).find(t => t.id === teacherId);
  return {
    name: teacher?.name || '',
    initial: teacher ? (teacher.initials || getInitial(teacher.name)) : (fallbackName ? getInitial(fallbackName) : '?')
  };
};

// 12. 학생 1명의 데이터 보강 (최종 조합)
export const getEnrichedStudentData = (
  s: any, logsData: any[], selectedDate: string, 
  availableTextbooks: any[], academy: any, teachers: any[], tasksData: any[]
) => {
  const logs = (logsData || []).map(l => buildSessionLog(l, availableTextbooks));
  
  const history = calculateStudentHistory(logs, selectedDate);
  const baseSession = selectBaseSession(logs, selectedDate, academy?.operation_settings?.holidays, '정규');
  const todayLog = logs.find(l => String(l.date) === String(selectedDate) && (l.course_name === '정규' || !l.course_name));
  
  let electiveDays: string[] = [];
  const rawElective = s.book_courses?.['__elective_courses'];
  if (rawElective) {
    try {
      const parsed = JSON.parse(rawElective);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (Array.isArray(item.days)) electiveDays = [...electiveDays, ...item.days];
        });
      }
    } catch (e) {}
  }
  const allClassDays = Array.from(new Set([...(s.class_days || []), ...electiveDays]));

  const { isHoliday, isTodayClassDay: isScheduledToday } = evaluateTodayStatus(selectedDate, allClassDays, academy?.operation_settings?.holidays);
  const isMakeup = todayLog?.attendance_status?.startsWith(ATTENDANCE_STATUS.SUPPLEMENT) || 
                   (todayLog?.moved_to_hour !== undefined && todayLog?.moved_to_hour !== null && todayLog?.moved_to_hour > 0);
  const isSkipped = todayLog?.attendance_status === ATTENDANCE_STATUS.EXCLUDED;
  
  const hasValidContentInLog = todayLog && isValidHistoryLog(todayLog);
  const isTodayClassDay = (isScheduledToday || isMakeup || !!hasValidContentInLog) && !isSkipped;
  
  const pastLogs = logs
    .filter(l => l.date < selectedDate && isValidHistoryLog(l))
    .sort((a, b) => b.date.localeCompare(a.date));
  const aggregatedHw = calculateAggregatedHw(pastLogs, academy, s);
  const todaySession = determineTodaySession(s, todayLog, baseSession, isTodayClassDay, selectedDate, academy);

  const tInfo = findTeacherInfo(teachers, s.teacher_id, s.teacher_name);

  return {
    ...s, teacher_name: tInfo.name, teacher_initial: tInfo.initial,
    school: s.school || '미지정', grade: s.grade || '미지정', course: s.course || 'C', book_courses: s.book_courses || {}, class: s.class_name || '일반반',
    is_deleted: !!s.is_deleted, class_days: s.class_days || [], assigned_books: s.assigned_books || [],
    suggestions: (tasksData || []).filter(t => t.title === `[건의] ${s.name}`),
    history, isRedLight: history.includes('poor') || history.includes('bad'),
    lastSession: baseSession ? { ...baseSession, homework_text: aggregatedHw } : (aggregatedHw ? { id: 'temp', homework_text: aggregatedHw } as any : undefined), 
    todaySession, allLogs: logs,
    isTodayClassDay,
    isScheduledToday: !!isScheduledToday,
    isSkipped: !!isSkipped
  };
};
