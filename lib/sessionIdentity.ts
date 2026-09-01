import { SessionIdentity } from '@/types/sessionContract';
import { extractRealStudentId } from './rowIdentity';

/**
 * 💡 sessionId가 임시 클라이언트 생성 ID가 아닌 실제 DB ID인지 판별하는 순수 함수
 *
 * @param sessionId - 검사할 세션 ID 문자열
 */
export function isValidDbSessionId(sessionId?: string | null): boolean {
  if (!sessionId) return false;
  const str = String(sessionId).trim();
  if (str === '' || str === 'temp' || str.startsWith('temp:')) {
    return false;
  }
  return true;
}

/**
 * 💡 학생 객체 및 렌더링 컨텍스트로부터 SessionIdentity를 생성하는 순수 함수
 *
 * @param params.academyId - 테넌트 ID
 * @param params.student - TodaySheet 학생 행 객체 (Student 또는 파생 Row)
 * @param params.sessionDate - 세션 날짜 (YYYY-MM-DD)
 * @param params.sessionData - 해당 행의 세션 데이터 (todaySession 또는 allLogs 항목)
 */
export function createSessionIdentity(params: {
  academyId: string;
  student: any;
  sessionDate: string;
  sessionData?: any;
}): SessionIdentity {
  const { academyId, student, sessionDate, sessionData } = params;

  const rawStudentId = student?.id ? String(student.id) : '';
  const realStudentId = student?.originalId
    ? String(student.originalId)
    : extractRealStudentId(rawStudentId);

  const rawCourseName =
    sessionData?.course_name ||
    student?.courseName ||
    (student?.isSpecialClass ? student?.electiveCourse?.subject : undefined) ||
    '정규';
  const cleanCourseName = String(rawCourseName).trim() || '정규';

  const isPureMakeup = Boolean(
    sessionData?.is_pure_makeup === true ||
    student?.isMakeupRow === true ||
    student?.__courseType === 'makeup' ||
    rawStudentId.includes('_makeup_')
  );

  let movedToHour: number | null = null;
  if (sessionData?.moved_to_hour !== undefined && sessionData?.moved_to_hour !== null) {
    const parsed = parseInt(String(sessionData.moved_to_hour), 10);
    movedToHour = isNaN(parsed) ? null : parsed;
  } else if (student?.moved_to_hour !== undefined && student?.moved_to_hour !== null) {
    const parsed = parseInt(String(student.moved_to_hour), 10);
    movedToHour = isNaN(parsed) ? null : parsed;
  }

  const rawSessionId = sessionData?.id || (student?.todaySession?.id);
  const sessionId = isValidDbSessionId(rawSessionId) ? String(rawSessionId) : undefined;

  return {
    academyId: String(academyId || ''),
    studentId: realStudentId,
    sessionDate: String(sessionDate || '').trim(),
    courseName: cleanCourseName,
    isPureMakeup,
    movedToHour,
    ...(sessionId ? { sessionId } : {})
  };
}

/**
 * 💡 두 SessionIdentity가 동일한 수업 세션을 가리키는지 비교하는 순수 함수
 *
 * @param a - 비교 대상 A
 * @param b - 비교 대상 B
 */
export function isMatchingIdentity(a: SessionIdentity, b: SessionIdentity): boolean {
  if (!a || !b) return false;

  // 1. 실제 DB sessionId가 양쪽에 유효하게 존재하면 최우선 단일 ID 비교
  if (isValidDbSessionId(a.sessionId) && isValidDbSessionId(b.sessionId)) {
    return String(a.sessionId) === String(b.sessionId);
  }

  // 2. 복합 비즈니스 식별 규칙 대조
  const isAcademyMatch = String(a.academyId || '') === String(b.academyId || '');
  const isStudentMatch = String(a.studentId) === String(b.studentId);
  const isDateMatch = String(a.sessionDate).replace(/\./g, '-') === String(b.sessionDate).replace(/\./g, '-');
  const isCourseMatch =
    (String(a.courseName || '정규').trim().toLowerCase()) ===
    (String(b.courseName || '정규').trim().toLowerCase());
  const isMakeupMatch = Boolean(a.isPureMakeup) === Boolean(b.isPureMakeup);
  const isHourMatch = (a.movedToHour ?? null) === (b.movedToHour ?? null);

  return isAcademyMatch && isStudentMatch && isDateMatch && isCourseMatch && isMakeupMatch && isHourMatch;
}

/**
 * 💡 allLogs 배열에서 SessionIdentity와 일치하는 단일 로그를 탐색하는 순수 함수
 *
 * @param logs - 세션 로그 배열
 * @param identity - 탐색할 세션 식별자
 */
export function findMatchingLog(logs: any[], identity: SessionIdentity): any | undefined {
  if (!Array.isArray(logs) || logs.length === 0 || !identity) return undefined;

  // 1순위: DB sessionId 매칭
  if (isValidDbSessionId(identity.sessionId)) {
    const directMatch = logs.find(l => isValidDbSessionId(l.id) && String(l.id) === String(identity.sessionId));
    if (directMatch) return directMatch;
  }

  // 2순위: 복합 비즈니스 식별 규칙 매칭
  const targetDate = String(identity.sessionDate).replace(/\./g, '-');
  const targetCourse = String(identity.courseName || '정규').trim().toLowerCase();

  return logs.find(l => {
    const lDate = String(l.date || l.session_date || '').replace(/\./g, '-');
    if (lDate !== targetDate) return false;

    const lCourse = String(l.course_name || '정규').trim().toLowerCase();
    if (lCourse !== targetCourse) return false;

    const lIsMakeup = Boolean(l.is_pure_makeup === true || String(l.attendance_status || '').startsWith('보강'));
    if (lIsMakeup !== Boolean(identity.isPureMakeup)) return false;

    const lMoved = l.moved_to_hour !== undefined && l.moved_to_hour !== null ? parseInt(String(l.moved_to_hour), 10) : null;
    const targetMoved = identity.movedToHour !== null ? identity.movedToHour : null;
    if (lMoved !== targetMoved) return false;

    return true;
  });
}
