import { ATTENDANCE_STATUS } from '@/lib/sessionFieldMap';
import { Student } from '@/types/dashboard';
import { scheduleValueToMinutes } from '@/lib/scheduleTime';

/**
 * 학생의 특정 요일 시작 교시/시간(hour)을 계산하는 유틸리티
 */
export const getStudentStartTime = (student: any, day: string): number => {
  // 1. 시간이동(moved_to_hour)이 존재할 경우 무조건 최우선 적용!
  if (student.todaySession?.moved_to_hour !== undefined && student.todaySession?.moved_to_hour !== null) {
    const m = scheduleValueToMinutes(student.todaySession.moved_to_hour);
    if (m !== null) return Math.floor(m / 60);
  }

  // 2. 기본 요일별 시간표 교시 적용
  const regularHours = student.day_schedules?.[day] || [];
  const isRegularClassDay = (student.class_days || []).includes(day);

  if (isRegularClassDay && regularHours.length > 0) {
    const m = scheduleValueToMinutes(regularHours[0]);
    if (m !== null) return Math.floor(m / 60);
  }

  // 2. [호환성] attendance_status에 인코딩된 시간 정보 파싱
  const status = student.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
  if (status.includes(':')) { 
    const parts = status.split(':'); 
    let val = parseInt(parts[parts.length - 1]); 
    if (!isNaN(val) && val < 24) {
      if (val < 10) val += 12;
      return val;
    }
  }

  // 3. 오늘 요일에 해당하는 선택과목/방학특강 스케줄이 있다면 최우선 적용
  const rawElective = student.book_courses?.['__elective_courses'];
  if (rawElective) {
    try {
      const courses = JSON.parse(rawElective);
      if (Array.isArray(courses)) {
        for (const c of courses) {
          if (c.days?.includes(day) && c.schedules?.[day]) {
            const sched = c.schedules[day];
            if (Array.isArray(sched) && sched.length > 0) {
              const m = scheduleValueToMinutes(sched[0]);
              if (m !== null) return Math.floor(m / 60);
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 4. 기본 정규 스케줄 사용
  if (regularHours.length === 0) return 999; 
  const parsedHours = regularHours.map((h: number) => {
    const m = scheduleValueToMinutes(h);
    return m !== null ? Math.floor(m / 60) : 999;
  });
  return Math.min(...parsedHours);
};

/**
 * 학생 정보 수정 모드 전용 최소 필터링 로직 (날짜 로직 완전 배제)
 */
export const getPureFilteredStudents = (params: {
  students: Student[];
  searchQuery: string;
  selectedTeacherId: string;
  selectedFilter: string;
  selectedDays: string[];
  isAndFilter: boolean;
}) => {
  const { students, searchQuery, selectedTeacherId, selectedFilter, selectedDays, isAndFilter } = params;
  
  return students.filter(s => {
    // 1. 퇴원생 필터 처리
    if (selectedFilter === 'Discharged') {
      return s.is_deleted === true && s.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    if (s.is_deleted) return false;

    // 2. 검색어 필터
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // 3. 담당 선생님 필터
    if (selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;

    // 4. 학년 필터
    if (selectedFilter !== 'All' && !s.grade.includes(selectedFilter)) return false;
    
    // 5. 수업 요일 필터
    if (selectedDays.length > 0) {
      const matchesDays = isAndFilter 
        ? selectedDays.every(day => s.class_days.includes(day))
        : selectedDays.some(day => s.class_days.includes(day));
      if (!matchesDays) return false;
    }

    return true;
  });
};

/**
 * 메인 대시보드 학생 목록 필터링 유틸리티
 */
export const filterStudentList = (params: {
  students: Student[];
  selectedDayKey: string;
  selectedDate: string;
  academy: any;
  searchQuery: string;
  selectedTeacherId: string;
  selectedFilter: string;
  selectedDays: string[];
  isAndFilter: boolean;
  filterTarget: 'today' | 'rest';
  selectedHour: string;
}) => {
  const { students, selectedDayKey, selectedDate, academy, searchQuery, selectedTeacherId, selectedFilter, selectedDays, isAndFilter, filterTarget, selectedHour } = params;
  
  return students.filter(s => {
    // 퇴원생 필터 처리
    if (selectedFilter === 'Discharged') {
      return s.is_deleted === true && s.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    if (s.is_deleted) return false;
    const hasTodayMakeup = (s.allLogs || []).some((l: any) => 
      (l.date || l.session_date) === selectedDate && 
      (
        l.is_pure_makeup || 
        (l.attendance_status && l.attendance_status.startsWith('보강')) ||
        (l.attendance_reason && l.attendance_reason.includes('보강')) ||
        (l.moved_to_hour !== null && l.moved_to_hour !== undefined && l.moved_to_hour > 0)
      )
    );

    const isTodaySession = s.isTodayClassDay || hasTodayMakeup;

    // 검색어 필터
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // 담당 선생님 필터
    if (selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;

    // 💡 [이중 가드] 정규 또는 특강 시간 중 단 하나라도 선택한 시간대와 맞물리면 통과시킵니다.
    if (filterTarget === 'today' && selectedHour !== 'All') {
      let matchHour = parseInt(selectedHour, 10);
      if (matchHour > 0 && matchHour < 10) matchHour += 12;
      
      const regHours = s.day_schedules?.[selectedDayKey] || [];
      const hasRegMatch = regHours.some((hVal: number) => {
        const m = scheduleValueToMinutes(hVal);
        return m !== null && Math.floor(m / 60) === matchHour;
      });

      let hasElectiveMatch = false;
      const rawElective = s.book_courses?.['__elective_courses'];
      if (rawElective) {
        try {
          const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
          if (Array.isArray(courses)) {
            for (const c of courses) {
              if (c.days?.includes(selectedDayKey) && c.schedules?.[selectedDayKey]) {
                const sched = c.schedules[selectedDayKey];
                if (Array.isArray(sched)) {
                  hasElectiveMatch = sched.some((hVal: number) => {
                    const m = scheduleValueToMinutes(hVal);
                    return m !== null && Math.floor(m / 60) === matchHour;
                  });
                  if (hasElectiveMatch) break;
                }
              }
            }
          }
        } catch (e) {}
      }

      // 💡 보강/시간이동 학생 매칭 검사 (모든 당일 세션 목록 순회)
      let hasMovedMatch = false;
      const targetSessions = (s.allLogs || []).filter((l: any) => (l.date || l.session_date) === selectedDate);

      for (const sess of targetSessions) {
        let mVal = sess?.moved_to_hour;
        if ((mVal === undefined || mVal === null || mVal <= 0) && sess?.attendance_status?.startsWith('보강:')) {
          const match = sess.attendance_status.match(/(\d{1,2}):/);
          if (match) mVal = parseInt(match[1], 10);
        }
        if (mVal !== undefined && mVal !== null && mVal > 0) {
          const m = scheduleValueToMinutes(mVal);
          if (m !== null && Math.floor(m / 60) === matchHour) {
            hasMovedMatch = true;
            break;
          }
        }
      }

      if (!hasRegMatch && !hasElectiveMatch && !hasMovedMatch) return false;
    }

    const isTodayTarget = filterTarget === 'today';
    const isRestTarget = filterTarget === 'rest';

    if (isTodayTarget && isTodaySession) {
      if (selectedFilter !== 'All' && !s.grade.includes(selectedFilter)) return false;
      if (selectedDays.length > 0 && !hasTodayMakeup) {
        const matchesDays = isAndFilter 
          ? selectedDays.every(day => s.class_days.includes(day))
          : selectedDays.some(day => s.class_days.includes(day)); 
        if (!matchesDays) return false;
      }
      return true;
    }

    if (isRestTarget && !isTodaySession) {
      if (selectedFilter !== 'All' && !s.grade.includes(selectedFilter)) return false;
      if (selectedDays.length > 0) {
        const matchesDays = isAndFilter 
          ? selectedDays.every(day => s.class_days.includes(day))
          : selectedDays.some(day => s.class_days.includes(day));
        if (!matchesDays) return false;
      }
      return true;
    }

    return false;
  });
};

/**
 * TodaySheet 시간 필터(availableHours) 드롭다운 생성 전용 헬퍼
 * 기존 getStudentStartTime()을 전혀 건드리지 않고, 학생의 모든 활성 수업 시각(정규/선택과목/보강)을 배열로 추출합니다.
 */
export const getStudentActiveHours = (student: any, dayKey: string, selectedDate?: string): number[] => {
  const hoursSet = new Set<number>();

  const normalize = (val: any): number | null => {
    const m = scheduleValueToMinutes(val);
    if (m === null) return null;
    const h = Math.floor(m / 60);
    return (h >= 0 && h <= 24) ? h : null;
  };

  // 1. 정규 수업 시간표 (당일 수업일인 경우)
  const isRegularClassDay = (student.class_days || []).includes(dayKey);
  const regularHours = student.day_schedules?.[dayKey] || [];
  if (isRegularClassDay && Array.isArray(regularHours)) {
    regularHours.forEach((hVal: any) => {
      const h = normalize(hVal);
      if (h !== null) hoursSet.add(h);
    });
  }

  // 2. 선택과목(방학특강) 시간표 (기간 및 요일 활성 조건 검사)
  const rawElective = student.book_courses?.['__elective_courses'];
  if (rawElective) {
    try {
      const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
      if (Array.isArray(courses)) {
        courses.forEach((c: any) => {
          if (!c) return;
          const hasDay = c.days && (
            Array.isArray(c.days)
              ? c.days.some((d: any) => typeof d === 'string' && d.trim() === dayKey)
              : (typeof c.days === 'string' && c.days.includes(dayKey))
          );

          const startDate = c.startDate || c.start_date;
          const endDate = c.endDate || c.end_date;
          const isBefore = (selectedDate && startDate) ? (selectedDate < startDate) : false;
          const isAfter = (selectedDate && endDate) ? (selectedDate > endDate) : false;

          if (hasDay && !isBefore && !isAfter) {
            const sched = c.schedules?.[dayKey];
            if (Array.isArray(sched)) {
              sched.forEach((hVal: any) => {
                const h = normalize(hVal);
                if (h !== null) hoursSet.add(h);
              });
            }
          }
        });
      }
    } catch (e) {}
  }

  // 3. 당일 세션 로그 (보강 / 시간이동 세션 시각)
  const targetLogs = (student.allLogs || []).filter((l: any) => selectedDate ? (l.date || l.session_date) === selectedDate : true);
  targetLogs.forEach((l: any) => {
    let mVal = l.moved_to_hour;
    if ((mVal === undefined || mVal === null || mVal <= 0) && l.attendance_status?.startsWith('보강:')) {
      const match = l.attendance_status.match(/(\d{1,2}):/);
      if (match) mVal = parseInt(match[1], 10);
    }
    const h = normalize(mVal);
    if (h !== null) hoursSet.add(h);
  });

  // 4. 단일 카드 객체 자체의 todaySession 시각 및 moved_to_hour도 추가
  if (student.todaySession) {
    const ts = student.todaySession;
    let mVal = ts.moved_to_hour;
    if ((mVal === undefined || mVal === null || mVal <= 0) && ts.attendance_status?.startsWith('보강:')) {
      const match = ts.attendance_status.match(/(\d{1,2}):/);
      if (match) mVal = parseInt(match[1], 10);
    }
    const h = normalize(mVal);
    if (h !== null) hoursSet.add(h);
  }

  return Array.from(hoursSet).sort((a, b) => a - b);
};
