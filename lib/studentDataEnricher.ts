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
    management_notes: l.management_notes || ''
  };
};

// 무효 과제 문구 판정 유틸리티 (보강이라 숙제없음, 숙제없음, 결석 등 무효 문구 자동 걸러냄)
export const isValidHomeworkText = (hwText?: string | null): boolean => {
  if (!hwText) return false;
  const cleaned = hwText.trim().replace(/\s+/g, '');
  if (!cleaned) return false;

  const invalidPatterns = [
    '결석',
    '숙제없음',
    '보강이라숙제없음',
    '보강숙제없음',
    '없음',
    '보강',
    '수업취소',
    '수업제외'
  ];

  if (invalidPatterns.includes(cleaned)) return false;
  return true;
};

// 5. 과거 숙제 내역 취합 유틸리티 (중간 결석/휴업일이 있어도 가장 최근 1회의 유효 숙제만 깔끔하게 이월)
export const calculateAggregatedHw = (pastLogs: SessionLog[], academy: any, student?: any, targetCourse = '정규') => {
  if (pastLogs.length === 0) return "";

  const trimmedTarget = targetCourse?.trim() || '정규';

  // 해당 과목(정규/특강/기하/확통 등)에 정확히 1:1 일치하는 과거 로그만 필터링
  const filteredLogs = pastLogs.filter(l => {
    const rawCourse = l.course_name ? l.course_name.trim() : '';
    const logCourse = rawCourse || '정규';
    if (trimmedTarget === '정규') {
      return !rawCourse || logCourse === '정규';
    }
    return logCourse === trimmedTarget;
  });

  const logsToProcess = filteredLogs.length > 0 ? filteredLogs : pastLogs;

  // 가장 최근에 유효한 숙제가 작성되었던 1회의 과거 수업 찾기 (무효 문구는 스킵하고 그 전 수업 계속 추적)
  for (const log of logsToProcess) {
    const attStatus = log.attendance_status || '';
    const isAbsent = attStatus.startsWith('결석');
    const hw = log.homework_text ? log.homework_text.trim() : '';

    if (!isAbsent && isValidHomeworkText(hw)) {
      const dayName = getDayOfWeek(log.date);
      const dateStr = log.date ? log.date.slice(5).replace('-', '.') : '';
      return `${dateStr}(${dayName})\n${hw}`;
    }
  }
  return "";
};

// 6. 오늘의 세션 데이터 결정 및 이월 로직
export const determineTodaySession = (
  student: any, todayLog: SessionLog | undefined, baseSession: SessionLog | undefined, 
  isTodayClassDay: boolean, selectedDate: string, academy: any
) => {
  // 💡 [단일 명확 규칙] 오직 지난 수업의 예정된 다음 테스트(next_quiz_text)만 승계 대상으로 지정
  const activePlanText = baseSession?.next_quiz_text || "";
  const activePlanCut = Number(baseSession?.next_quiz_cut) || 0;
  const activePlanTrial = Number(baseSession?.next_quiz_trial) || 1;
  
  const todayMission = todayLog?.mission || "";
  const defaultScoreType = baseSession?.test_score_type || 'score';

  if (todayLog) {
    todayLog.mission = todayMission;
    
    if (!todayLog.test_score_type) todayLog.test_score_type = defaultScoreType;

    // 💡 [원장님 2번 지침 100% 보장 수정]
    // 1. 당일 세션(todayLog)에 이미 test_id가 존재하고, 지운 상태(test_id === '')는 가만히 보존
    // 2. 오직 지난 수업의 '다음 테스트(activePlanText)'가 새로 작성/수정되어 원래 세션에 기록된 계획과 다를 때 1회 새로 주입!
    const savedPlanSnapshot = (todayLog as any).__saved_plan_snapshot;

    if (savedPlanSnapshot === undefined) {
      if (!todayLog.test_id && activePlanText) {
        todayLog.test_id = activePlanText;
        (todayLog as any).test_status = activePlanText;
        todayLog.test_cut = activePlanCut;
      }
      (todayLog as any).__saved_plan_snapshot = activePlanText || '';
    } else if (activePlanText !== savedPlanSnapshot) {
      // ➔ 원장님이 지난 수업으로 이동해서 다음 테스트를 새로 업데이트한 상황 감지!
      todayLog.test_id = activePlanText;
      (todayLog as any).test_status = activePlanText;
      todayLog.test_cut = activePlanCut;
      (todayLog as any).__saved_plan_snapshot = activePlanText;
    }

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
// 💡 courseName 파라미터: 정규/특강/선택과목(기하, 확통, 미적분2, 방학특강 등) 로그를 1:1로 정확히 구분
export const selectBaseSession = (logs: SessionLog[], targetDate: string, holidays: any[], courseName = '정규'): SessionLog | undefined => {
  const trimmedTarget = courseName?.trim() || '정규';

  const pastLogs = logs
    .filter(l => l.date < targetDate)
    .filter(l => {
      const rawCourse = l.course_name ? l.course_name.trim() : '';
      const logCourse = rawCourse || '정규';
      if (trimmedTarget === '정규') {
        return !rawCourse || logCourse === '정규';
      }
      return logCourse === trimmedTarget;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  // 💡 직전 과거 세션 1개만 추출 (도미노 이월 차단)
  const lastDirectLog = pastLogs[0];
  if (!lastDirectLog) return undefined;

  const isLogHoliday = (holidays || []).some((h: any) => h.date === lastDirectLog.date);
  const isMakeup = lastDirectLog.attendance_status?.startsWith(ATTENDANCE_STATUS.SUPPLEMENT);
  
  if (!isLogHoliday || isMakeup) {
    return lastDirectLog;
  }
  return lastDirectLog;
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
  const todayLogs = logs.filter((l: any) => String(l.date || l.session_date) === String(selectedDate));
  const isMakeupLog = (l: any) => l.is_pure_makeup || (l.attendance_status && l.attendance_status.startsWith('보강')) || (l.attendance_reason && l.attendance_reason.includes('보강'));
  const movedTodayLog = todayLogs.find((l: any) => (l.course_name === '정규' || !l.course_name) && !isMakeupLog(l) && l.moved_to_hour !== null && l.moved_to_hour !== undefined && l.moved_to_hour > 0);
  const regularTodayLog = movedTodayLog || todayLogs.find((l: any) => (l.course_name === '정규' || !l.course_name) && !isMakeupLog(l));
  
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
  
  const targetLogForStatus = regularTodayLog || todayLogs[0];
  const isMakeup = targetLogForStatus?.attendance_status?.startsWith(ATTENDANCE_STATUS.SUPPLEMENT) || 
                   (targetLogForStatus?.moved_to_hour !== undefined && targetLogForStatus?.moved_to_hour !== null && targetLogForStatus?.moved_to_hour > 0);
  const isSkipped = targetLogForStatus?.attendance_status === ATTENDANCE_STATUS.EXCLUDED;
  
  const isTodayClassDay = (isScheduledToday || isMakeup || todayLogs.length > 0) && !isSkipped;
  
  const pastLogs = logs
    .filter(l => l.date < selectedDate && (isValidHistoryLog(l) || (l.homework_text && l.homework_text.trim() !== '')))
    .sort((a, b) => b.date.localeCompare(a.date));
  const targetCourseName = (s as any).isSpecialClass ? ((s as any).electiveCourse?.subject || '특강') : '정규';
  const aggregatedHw = calculateAggregatedHw(pastLogs, academy, s, targetCourseName);
  
  const regularTodaySession = determineTodaySession(s, regularTodayLog, baseSession, isScheduledToday, selectedDate, academy);
  const todaySession = isScheduledToday ? regularTodaySession : determineTodaySession(s, targetLogForStatus, baseSession, isTodayClassDay, selectedDate, academy);

  const sessionMap = new Map<string, SessionLog>();
  if (isScheduledToday && regularTodaySession) {
    sessionMap.set(regularTodaySession.id || 'temp', regularTodaySession);
  }
  todayLogs.forEach(l => {
    if (l.id) sessionMap.set(l.id, l);
  });
  const allTodaySessions = Array.from(sessionMap.values());

  const tInfo = findTeacherInfo(teachers, s.teacher_id, s.teacher_name);

  return {
    ...s, teacher_name: tInfo.name, teacher_initial: tInfo.initial,
    school: s.school || '미지정', grade: s.grade || '미지정', course: s.course || 'C', book_courses: s.book_courses || {}, class: s.class_name || '일반반',
    is_deleted: !!s.is_deleted, class_days: s.class_days || [], assigned_books: s.assigned_books || [],
    suggestions: (tasksData || []).filter(t => t.title === `[건의] ${s.name}`),
    history, isRedLight: history.includes('poor') || history.includes('bad'),
    lastSession: baseSession ? { ...baseSession, homework_text: aggregatedHw } : (aggregatedHw ? { id: 'temp', homework_text: aggregatedHw } as any : undefined), 
    todaySession, todaySessions: allTodaySessions as SessionLog[], allLogs: logs,
    isTodayClassDay,
    isScheduledToday: !!isScheduledToday,
    isSkipped: !!isSkipped
  };
};
