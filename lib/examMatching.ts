/**
 * 학교별 시험 일정 매칭, D-Day 계산 및 잔여 정규수업 횟수 산출 공용 순수 함수
 * 학생 포털(Student Portal)과 관리자 대시보드(ExamDdayOverview)가 단일 로직을 공유합니다.
 */

export interface ExamSchedule {
  id: string;
  academy_id: string;
  school_name: string;
  grade: string;
  exam_name: string;
  target_date: string;
  end_date: string | null;
  created_at?: string;
}

export type SchoolStage = 'elementary' | 'middle' | 'high' | 'other';

export type ExamPreparationStatus =
  | 'ongoing'       // 시험 진행 중
  | 'no_schedule'   // 시험 일정 미등록
  | 'urgent'        // 최우선: D-7 이내이면서 잔여 정규수업 4회 이하
  | 'd7'            // D-7 이내
  | 'lack_classes'  // 잔여 수업 부족: 잔여 정규수업 4회 이하
  | 'd14'           // D-14 이내
  | 'normal';       // 여유

export interface DDayResult {
  dDayDiff: number;
  isOngoing: boolean;
  dDayLabel: string;
}

/**
 * 1. 학교명 정규화 (공백 제거 및 접미사 통일)
 */
export const normalizeSchool = (name?: string | null): string => {
  return (name || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/고등학교$/, '고')
    .replace(/중학교$/, '중')
    .replace(/초등학교$/, '초')
    .replace(/학교$/, '')
    .replace(/여자중$/, '여중')
    .replace(/여자고$/, '여고');
};

/**
 * 2. 학년 정규화 및 학년 숫자(1~3) 추출
 */
export const getStudentGradeNumber = (grade?: string | null): string | null => {
  const match = String(grade || '').match(/[1-3]/);
  return match ? match[0] : null;
};

export const normalizeGrade = (grade?: string | null): string => {
  return String(grade || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/학년$/, '');
};

/**
 * 3. 초/중/고 학제 구분
 */
export const getSchoolStage = (school?: string | null, grade?: string | null): SchoolStage => {
  const s = String(school || '');
  const g = String(grade || '');
  if (g.includes('초') || s.includes('초')) return 'elementary';
  if (g.includes('고') || s.includes('고')) return 'high';
  if (g.includes('중') || s.includes('중')) return 'middle';
  return 'other';
};

/**
 * 4. 학생에게 가장 적합한 시험 일정 매칭
 * (학생 포털 useStudentPortal.ts의 검증된 규칙 100% 동일 구현)
 */
export const matchStudentExam = (
  student: { school?: string | null; grade?: string | null },
  examSchedules: ExamSchedule[],
  currentPeriod?: string | null,
  selectedDate?: string | null
): ExamSchedule | null => {
  if (!student || !examSchedules || examSchedules.length === 0) return null;
  const todayStr = selectedDate || new Date().toISOString().split('T')[0];
  const studentSchool = normalizeSchool(student.school);
  const studentGradeNumber = getStudentGradeNumber(student.grade);
  const normalizedStudentGrade = normalizeGrade(student.grade);

  if (!studentSchool) return null;

  // 1) 시험 종료일(또는 시작일)이 오늘 이후인 일정만
  const upcomingSchedules = examSchedules.filter(ex => (ex.end_date || ex.target_date) >= todayStr);

  // 2) 현재 학기 시험 기간 코드 필터링
  const currentPeriodSchedules = currentPeriod
    ? upcomingSchedules.filter(ex => {
        if (ex.exam_name && ex.exam_name.startsWith(currentPeriod)) return true;
        const periodType = currentPeriod.split('-').slice(1).join('-');
        const legacyNames: Record<string, string[]> = {
          '1-MID': ['1학기 중간', '1학기 중간고사'],
          '1-FINAL': ['1학기 기말', '1학기 기말고사'],
          '2-MID': ['2학기 중간', '2학기 중간고사'],
          '2-FINAL': ['2학기 기말', '2학기 기말고사']
        };
        if (ex.exam_name && (legacyNames[periodType] || []).includes(ex.exam_name)) return true;
        return false;
      })
    : upcomingSchedules;

  // 3) 학교 및 학년 매칭
  const matchedList = currentPeriodSchedules.filter(ex => {
    const exSchool = normalizeSchool(ex.school_name);
    const isSchoolMatch =
      exSchool === studentSchool ||
      exSchool.replace(/여자중$/, '여중') === studentSchool.replace(/여자중$/, '여중') ||
      exSchool.replace(/여중$/, '여자중') === studentSchool.replace(/여중$/, '여자중');
    if (!isSchoolMatch) return false;

    const scheduleGradeRaw = String(ex.grade || '').trim();
    if (!scheduleGradeRaw) return false;

    // 신규 형식: "1,2,3" 또는 "2,3" 또는 "3"
    const scheduleGrades = scheduleGradeRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (studentGradeNumber && scheduleGrades.includes(studentGradeNumber)) {
      return true;
    }

    // 레거시 형식 호환: "중3", "고2", "3"
    const legacyNormalized = normalizeGrade(scheduleGradeRaw);
    if (legacyNormalized && legacyNormalized === normalizedStudentGrade) {
      return true;
    }

    return false;
  });

  if (matchedList.length === 0) return null;

  // 4) 복수 매칭 시 우선순위:
  //    1. 시험 시작일이 더 빠른 순
  //    2. 같은 시작일이면 종료일이 더 이른 순
  //    3. 그래도 같으면 생성일(created_at)이 더 최근인 순
  matchedList.sort((a, b) => {
    const aStart = a.target_date;
    const bStart = b.target_date;
    if (aStart !== bStart) return aStart.localeCompare(bStart);

    const aEnd = a.end_date || a.target_date;
    const bEnd = b.end_date || b.target_date;
    if (aEnd !== bEnd) return aEnd.localeCompare(bEnd);

    const aCreated = a.created_at || '';
    const bCreated = b.created_at || '';
    return bCreated.localeCompare(aCreated);
  });

  return matchedList[0];
};

/**
 * 5. D-Day 및 시험 진행 상태 계산
 */
export const calculateDDay = (
  matchedExam: ExamSchedule | null,
  selectedDate?: string | null
): DDayResult => {
  if (!matchedExam || !matchedExam.target_date) {
    return { dDayDiff: 999, isOngoing: false, dDayLabel: '일정 없음' };
  }

  const todayStr = selectedDate || new Date().toISOString().split('T')[0];
  const targetDate = matchedExam.target_date;
  const endDate = matchedExam.end_date || targetDate;

  // 시험 진행 중 여부
  const isOngoing = todayStr >= targetDate && todayStr <= endDate;
  if (isOngoing) {
    return { dDayDiff: 0, isOngoing: true, dDayLabel: '진행 중' };
  }

  const todayMs = new Date(todayStr).setHours(0, 0, 0, 0);
  const targetMs = new Date(targetDate).setHours(0, 0, 0, 0);
  const dDayDiff = Math.ceil((targetMs - todayMs) / (1000 * 60 * 60 * 24));

  if (dDayDiff === 0) {
    return { dDayDiff: 0, isOngoing: false, dDayLabel: 'D-Day' };
  } else if (dDayDiff > 0) {
    return { dDayDiff, isOngoing: false, dDayLabel: `D-${dDayDiff}` };
  } else {
    return { dDayDiff, isOngoing: false, dDayLabel: '종료' };
  }
};

/**
 * 6. 등록 등원 요일(class_days) 기준 잔여 정규수업 횟수 계산
 * (정규수업만 계산하며, 오늘 제외, 내일부터 시험 시작일 전날까지만 카운트)
 */
export const getRemainingRegularClasses = (
  targetDate: string | null | undefined,
  classDays: string[] | null | undefined,
  selectedDate?: string | null
): number | null => {
  if (!targetDate || !classDays || classDays.length === 0) return null;

  const todayStr = selectedDate || new Date().toISOString().split('T')[0];
  const today = new Date(todayStr);
  const exam = new Date(targetDate);

  // 오늘 또는 시험 시작일 이후이면 잔여 0
  if (exam <= today) return 0;

  let count = 0;
  const current = new Date(today);
  current.setDate(current.getDate() + 1); // 💡 내일부터 시작 (오늘 제외)

  while (current < exam) { // 💡 시험 시작일 전날까지 (시험 시작일 당일 제외)
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][current.getDay()];
    if (classDays.includes(dayName)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

/**
 * 7. 대비 상태 판정 (우선순위 계층 적용)
 */
export const determineExamPreparationStatus = (params: {
  matchedExam: ExamSchedule | null;
  isOngoing: boolean;
  dDayDiff: number;
  remainingClasses: number | null;
}): ExamPreparationStatus => {
  const { matchedExam, isOngoing, dDayDiff, remainingClasses } = params;

  if (isOngoing) return 'ongoing';
  if (!matchedExam) return 'no_schedule';

  const isD7 = dDayDiff >= 0 && dDayDiff <= 7;
  const isLack = remainingClasses !== null && remainingClasses >= 0 && remainingClasses <= 4;
  const isD14 = dDayDiff > 7 && dDayDiff <= 14;

  // 1순위: 최우선 (D-7 이내이면서 잔여 수업 4회 이하)
  if (isD7 && isLack) return 'urgent';
  // 2순위: D-7 이내
  if (isD7) return 'd7';
  // 3순위: 잔여 수업 부족
  if (isLack) return 'lack_classes';
  // 4순위: D-14 이내
  if (isD14) return 'd14';

  return 'normal';
};
