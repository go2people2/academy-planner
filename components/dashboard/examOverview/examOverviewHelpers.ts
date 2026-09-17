import { EnrichedExamStudent, ExamSortOption, KpiCounts } from './types';

/**
 * 상단 5대 핵심 KPI 집계 (기본 대상: 중·고등부 재원생)
 */
export function calculateExamKpiCounts(enrichedStudents: EnrichedExamStudent[]): KpiCounts {
  const targetStudents = enrichedStudents.filter(
    s => s.schoolStage === 'middle' || s.schoolStage === 'high'
  );

  let ongoing = 0;
  let d7 = 0;
  let d14 = 0;
  let lackClasses = 0;
  let noSchedule = 0;

  targetStudents.forEach(s => {
    if (s.isOngoing) {
      ongoing++;
    } else if (!s.matchedExam) {
      noSchedule++;
    } else {
      if (s.dDayDiff >= 0 && s.dDayDiff <= 7) {
        d7++;
      } else if (s.dDayDiff > 7 && s.dDayDiff <= 14) {
        d14++;
      }
      if (s.remainingClasses !== null && s.remainingClasses >= 0 && s.remainingClasses <= 4) {
        lackClasses++;
      }
    }
  });

  return {
    totalTarget: targetStudents.length,
    ongoing,
    d7,
    d14,
    lackClasses,
    noSchedule
  };
}

/**
 * 학생 목록 정렬 비교 함수
 */
export function compareExamStudents(
  a: EnrichedExamStudent,
  b: EnrichedExamStudent,
  sortOption: ExamSortOption
): number {
  if (sortOption === 'classes') {
    if (a.isOngoing && !b.isOngoing) return -1;
    if (!a.isOngoing && b.isOngoing) return 1;
    const aRem = a.remainingClasses ?? 999;
    const bRem = b.remainingClasses ?? 999;
    if (aRem !== bRem) return aRem - bRem;
    return a.dDayDiff - b.dDayDiff;
  }

  if (sortOption === 'name') {
    return a.name.localeCompare(b.name, 'ko');
  }

  if (sortOption === 'school') {
    const schoolComp = a.school.localeCompare(b.school, 'ko');
    if (schoolComp !== 0) return schoolComp;
    return a.name.localeCompare(b.name, 'ko');
  }

  // 기본값: D-Day 임박순
  // 1순위: 시험 진행 중
  if (a.isOngoing && !b.isOngoing) return -1;
  if (!a.isOngoing && b.isOngoing) return 1;

  // 2순위: D-Day 오름차순 (시험일이 가까운 순)
  if (a.dDayDiff !== b.dDayDiff) return a.dDayDiff - b.dDayDiff;

  // 3순위: 같은 D-Day면 잔여 수업 횟수 적은 순
  const aRem = a.remainingClasses ?? 999;
  const bRem = b.remainingClasses ?? 999;
  if (aRem !== bRem) return aRem - bRem;

  // 4순위: 학생 이름 가나다순
  return a.name.localeCompare(b.name, 'ko');
}
