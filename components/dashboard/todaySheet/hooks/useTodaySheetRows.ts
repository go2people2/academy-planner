'use client';

import { useMemo } from 'react';
import { Student } from '@/types/dashboard';
import { getDayOfWeek } from '@/lib/utils';
import { calculateAggregatedHw, selectBaseSession, determineTodaySession, isValidHomeworkText } from '@/lib/studentDataEnricher';
import { ATTENDANCE_STATUS, normalizeAttendanceStatus } from '@/lib/sessionFieldMap';

interface UseTodaySheetRowsParams {
  students: Student[];
  selectedDate: string;
  academyInfo?: any;
  sortMode?: 'time' | 'grade' | 'name';
  sortDirection?: 'asc' | 'desc';
  selectedHour?: string;
  hideAbsent?: 'all' | 'absent' | 'attend';
  focusColumn?: string | null;
}

export function useTodaySheetRows({
  students,
  selectedDate,
  academyInfo,
  sortMode = 'time',
  sortDirection = 'asc',
  selectedHour = 'All',
  hideAbsent = 'all',
  focusColumn = null
}: UseTodaySheetRowsParams) {

  const rows = useMemo(() => {
    if (!students || students.length === 0) return [];

    let result = [...students].filter((s: any) => {
      // 💡 [입학/등록일자 원천 차단] 신규생의 입학/등록일자(registration_date || created_at) 이전 날짜인 경우 시간표에서 완전 제외!!
      const regDateRaw = s.registration_date || s.created_at;
      if (regDateRaw) {
        const regDateStr = regDateRaw.slice(0, 10);
        if (regDateStr && regDateStr > selectedDate) {
          return false;
        }
      }
      return true;
    });

    // 1. 학년순 정렬을 위한 헬퍼
    const getGradeWeight = (gradeStr: string) => {
      if (!gradeStr) return 99;
      const cleaned = gradeStr.trim();
      let levelWeight = 0;
      let year = 0;

      if (cleaned.includes('초')) {
        levelWeight = 10;
        const match = cleaned.match(/\d/);
        year = match ? parseInt(match[0], 10) : 0;
      } else if (cleaned.includes('중')) {
        levelWeight = 20;
        const match = cleaned.match(/\d/);
        year = match ? parseInt(match[0], 10) : 0;
      } else if (cleaned.includes('고')) {
        levelWeight = 30;
        const match = cleaned.match(/\d/);
        year = match ? parseInt(match[0], 10) : 0;
      } else {
        levelWeight = 40;
      }
      return levelWeight + year;
    };

    const dayKey = getDayOfWeek(selectedDate);

    // 💡 2. 선택과목(방학특강, 확통 등) 및 정규 수업 분리 (독립 행 확장)
    const uniqueOriginalStudents = new Map<string, any>();
    result.forEach((s: any) => {
      const realId = s.originalId || s.id;
      if (!uniqueOriginalStudents.has(realId) || (!s.isSpecialClass && !s.isMakeupRow)) {
        uniqueOriginalStudents.set(realId, s);
      }
    });

    const formatLastSessionHomework = (log: any) => {
      if (!log || !log.homework_text || !log.homework_text.trim()) return log;
      const hw = log.homework_text.trim();
      if (hw === '결석') return log;

      // 이미 08.04(화) 또는 (8/4) 같은 날짜가 앞에 붙어있으면 08.04(화) 서식으로 정규화
      const oldSlashMatch = hw.match(/^\((\d{1,2})\/(\d{1,2})\)\s*(.*)/);
      const dateVal = log.date || log.session_date;

      if (oldSlashMatch) {
        const mStr = String(parseInt(oldSlashMatch[1], 10)).padStart(2, '0');
        const dStr = String(parseInt(oldSlashMatch[2], 10)).padStart(2, '0');
        const dayName = dateVal ? getDayOfWeek(dateVal) : '';
        const daySuffix = dayName ? `(${dayName})` : '';
        return {
          ...log,
          homework_text: `${mStr}.${dStr}${daySuffix}\n${oldSlashMatch[3]}`
        };
      }

      const hasStandardDate = /^\d{2}\.\d{2}\(/;
      if (hasStandardDate.test(hw)) return log;

      if (!dateVal) return log;

      const dateStr = dateVal.slice(5).replace('-', '.');
      const dayName = getDayOfWeek(dateVal);
      return {
        ...log,
        homework_text: `${dateStr}(${dayName})\n${hw}`
      };
    };

    const expandedResult: any[] = [];
    Array.from(uniqueOriginalStudents.values()).forEach((s: any) => {
      const regularHours = s.day_schedules?.[dayKey] || [];
      const rawElective = s.book_courses?.['__elective_courses'];
      const activeElectives: any[] = [];
      const seenCourseKeys = new Set<string>();

      if (rawElective) {
        try {
          let courses: any[] = [];
          if (typeof rawElective === 'string') {
            courses = JSON.parse(rawElective);
          } else if (Array.isArray(rawElective)) {
            courses = rawElective;
          }
          if (Array.isArray(courses)) {
            courses.forEach((c: any) => {
              if (!c) return;
              const cKey = c.id || c.subject?.trim() || JSON.stringify(c);
              if (seenCourseKeys.has(cKey)) return;

              const hasDay = c.days && (
                Array.isArray(c.days) 
                  ? c.days.some((d: any) => typeof d === 'string' && d.trim() === dayKey)
                  : (typeof c.days === 'string' && c.days.includes(dayKey))
              );

              // 특강 기간 검사
              const electiveStartDate = c.startDate || c.start_date;
              const electiveEndDate = c.endDate || c.end_date;
              const isBeforeStartDate = electiveStartDate ? (selectedDate < electiveStartDate) : false;
              const isAfterEndDate = electiveEndDate ? (selectedDate > electiveEndDate) : false;

              const courseSubject = c.subject?.trim() || '특강';
              const hasLogToday = (s.allLogs || []).some((l: any) => {
                if ((l.date || l.session_date) !== selectedDate) return false;
                const logCourse = (l.course_name || '정규').trim();
                return logCourse === courseSubject;
              });

              if ((hasDay || hasLogToday) && !isBeforeStartDate && !isAfterEndDate) {
                seenCourseKeys.add(cKey);
                activeElectives.push(c);
              }
            });
          }
        } catch (e) {}
      }

      // (1) 선택과목 각각 독립 행으로 추가
      activeElectives.forEach((c: any, cIdx: number) => {
        const courseSubject = c.subject?.trim() || '특강';
        const electiveLog = (s.allLogs || []).find((l: any) => {
          if ((l.date || l.session_date) !== selectedDate) return false;
          const logCourse = (l.course_name || '정규').trim();
          return logCourse === courseSubject;
        });

        const specialHours = (c.schedules && Array.isArray(c.schedules[dayKey]) && c.schedules[dayKey].length > 0)
          ? c.schedules[dayKey]
          : [1300, 1600];

        const pastElectiveLogs = (s.allLogs || [])
          .filter((l: any) => (l.date || l.session_date) < selectedDate)
          .sort((a: any, b: any) => String(b.date || b.session_date).localeCompare(String(a.date || a.session_date)));

        const electiveAggregatedHw = calculateAggregatedHw(pastElectiveLogs, academyInfo, s, courseSubject);
        const electiveBaseSession = selectBaseSession(s.allLogs || [], selectedDate, academyInfo?.operation_settings?.holidays, courseSubject);
        const electiveLastSession = electiveBaseSession ? { ...electiveBaseSession, homework_text: electiveAggregatedHw } : (electiveAggregatedHw ? { id: 'temp', homework_text: electiveAggregatedHw } as any : undefined);
        const electiveTodaySession = determineTodaySession(s, electiveLog, electiveBaseSession, true, selectedDate, academyInfo);

        const specialId = `${s.originalId || s.id}_special_${c.id || courseSubject}_${cIdx}`;
        if (!expandedResult.some(item => item.id === specialId)) {
          expandedResult.push({
            ...s,
            id: specialId,
            originalId: s.originalId || s.id,
            isSpecialClass: true,
            courseName: courseSubject,
            day_schedules: {
              ...s.day_schedules,
              [dayKey]: specialHours
            },
            electiveCourse: {
              ...c,
              subject: courseSubject
            },
            lastSession: electiveLastSession,
            todaySession: electiveTodaySession
          });
        }
      });

      const realId = s.originalId || s.id;
      const todayLogs = (s.allLogs || []).filter((l: any) => (l.date || l.session_date) === selectedDate);
      
      // 💡 [시간 이동 정밀 복원] 당일 정규 로그 중 시간이동(moved_to_hour)이 존재하는 로그를 최우선 채택
      const movedRegularLog = todayLogs.find((l: any) => (l.course_name === '정규' || !l.course_name) && l.moved_to_hour !== null && l.moved_to_hour !== undefined && l.moved_to_hour > 0);
      const regularLog = movedRegularLog || todayLogs.find((l: any) => (l.course_name === '정규' || !l.course_name));
      const rawMakeupLogs = todayLogs.filter((l: any) => l.is_pure_makeup || (l.attendance_status && l.attendance_status.startsWith('보강')) || (l.moved_to_hour !== null && l.moved_to_hour !== undefined && l.moved_to_hour > 0));

      // 💡 [중복 완벽 차단] 동일 학생/날짜/과목/시간 보강 세션만 고유하게 채택!
      const uniqueMakeupMap = new Map<string, any>();
      rawMakeupLogs.forEach((mLog: any) => {
        const key = `${mLog.student_id || realId}_${mLog.course_name || '정규'}_${mLog.moved_to_hour || mLog.id || mLog.attendance_status}`;
        uniqueMakeupMap.set(key, mLog);
      });
      const makeupLogs = Array.from(uniqueMakeupMap.values());

      const allElectiveDaysForStudent = new Set<string>();
      if (rawElective) {
        try {
          const allCourses = typeof rawElective === 'string' ? JSON.parse(rawElective) : Array.isArray(rawElective) ? rawElective : [];
          if (Array.isArray(allCourses)) {
            allCourses.forEach((c: any) => {
              if (!c) return;
              if (Array.isArray(c.days)) {
                c.days.forEach((d: any) => { if (typeof d === 'string') allElectiveDaysForStudent.add(d.trim()); });
              } else if (typeof c.days === 'string') {
                c.days.split(/[,\s]+/).forEach((d: string) => { if (d.trim()) allElectiveDaysForStudent.add(d.trim()); });
              }
            });
          }
        } catch (e) {}
      }

      const hasAnyElective = allElectiveDaysForStudent.size > 0;
      const isElectiveDay = allElectiveDaysForStudent.has(dayKey);
      const isRegularClassDay = (s.class_days || []).includes(dayKey);
      const regularBaseSession = selectBaseSession(s.allLogs || [], selectedDate, academyInfo?.operation_settings?.holidays, '정규');
      const regularTodaySession = determineTodaySession(s, regularLog, regularBaseSession, isRegularClassDay, selectedDate, academyInfo);

      let shouldShowRegular = false;
      const rawAtt = regularTodaySession?.attendance_status || '';
      const isCanceled = rawAtt.includes('수업취소') || rawAtt.includes('수업제외');

      // 💡 [시간 이동 반영] 정규 세션에 시간이동(moved_to_hour) 정보가 있으면 해당 이동 시간을 정규 시간표로 대체 (순수 보강 로그는 정규 시간 변경 제외)
      const isPureMakeup = regularTodaySession?.is_pure_makeup;
      const activeMovedHour = (!isPureMakeup && regularTodaySession?.moved_to_hour !== undefined && regularTodaySession?.moved_to_hour !== null && regularTodaySession?.moved_to_hour > 0) ? regularTodaySession.moved_to_hour : null;
      const normalizedMovedHour = (() => {
        if (activeMovedHour === null) return null;
        let h = activeMovedHour >= 100 ? Math.floor(activeMovedHour / 100) : activeMovedHour;
        if (h > 0 && h <= 12) h += 12;
        return h;
      })();
      const effectiveRegularHours = (normalizedMovedHour !== null)
        ? [normalizedMovedHour]
        : regularHours;

      // 💡 [버그 원천 차단] 보강 전용 로그인지 판정
      const isPureMakeupLog = !isRegularClassDay && regularLog && (
        (regularLog.moved_to_hour !== null && regularLog.moved_to_hour !== undefined && regularLog.moved_to_hour > 0) ||
        (regularLog.attendance_status && regularLog.attendance_status.startsWith('보강'))
      );

      if (isRegularClassDay) {
        // 1. 원래 오늘 정규 수업일인 경우에만 정규 행 배치
        shouldShowRegular = true;
      }

      if (shouldShowRegular) {
        const pastRegularLogs = (s.allLogs || [])
          .filter((l: any) => {
            const lDate = l.date || l.session_date || '';
            if (lDate >= selectedDate) return false;
            const course = l.course_name ? l.course_name.trim() : '정규';
            if (course !== '정규') return false;

            const attStatus = l.attendance_status || '';
            if (attStatus.startsWith('결석')) return false;

            const hw = l.homework_text ? l.homework_text.trim() : '';
            return isValidHomeworkText(hw);
          })
          .sort((a: any, b: any) => String(b.date || b.session_date).localeCompare(String(a.date || a.session_date)));

        const rawRegularLastSession = pastRegularLogs.length > 0 ? pastRegularLogs[0] : s.lastSession;
        const regularLastSession = formatLastSessionHomework(rawRegularLastSession);

        expandedResult.push({
          ...s,
          id: realId,
          originalId: realId,
          isSpecialClass: false,
          courseName: '정규',
          day_schedules: {
            ...s.day_schedules,
            [dayKey]: effectiveRegularHours
          },
          lastSession: regularLastSession,
          todaySession: regularTodaySession
        });
      }

      // (3) 보강 전용 독립 행 추가 (독립 등록된 보강인 경우만 별도 행 생성, 정규 수업 시간이동은 정규 행 이동으로 처리)
      makeupLogs.forEach((mLog: any) => {
        // 💡 [시간 파싱 강화] moved_to_hour 또는 attendance_status ("보강:19:00~21:00") 에서 시각 파싱
        let makeupHour = mLog.moved_to_hour;
        if (!makeupHour || makeupHour <= 0) {
          const attStatus = mLog.attendance_status || '';
          const match = attStatus.match(/(\d{1,2}):/);
          if (match) {
            makeupHour = parseInt(match[1], 10);
          }
        }
        const sessionId = mLog.id || mLog.created_at || makeupHour;
        const makeupId = `${realId}_makeup_${sessionId}`;

        const isPureMakeup = mLog.is_pure_makeup || 
          (mLog.attendance_status && mLog.attendance_status.startsWith('보강')) || 
          (mLog.attendance_reason && mLog.attendance_reason.includes('보강')) ||
          (!isRegularClassDay && mLog.attendance_status?.startsWith('보강'));
        if (isRegularClassDay && shouldShowRegular && !isPureMakeup) {
          return;
        }

        if (!expandedResult.some(item => item.id === makeupId)) {
          const pastRegularLogs = (s.allLogs || [])
            .filter((l: any) => {
              const lDate = l.date || l.session_date || '';
              if (lDate >= selectedDate) return false;
              const course = l.course_name ? l.course_name.trim() : '정규';
              return course === '정규' && !((l.attendance_status || '').startsWith('결석'));
            })
            .sort((a: any, b: any) => String(b.date || b.session_date).localeCompare(String(a.date || a.session_date)));

          const rawMakeupLastSession = pastRegularLogs.length > 0 ? pastRegularLogs[0] : s.lastSession;
          const makeupLastSession = formatLastSessionHomework(rawMakeupLastSession);

          expandedResult.push({
            ...s,
            id: makeupId,
            originalId: realId,
            isSpecialClass: mLog.course_name && mLog.course_name !== '정규',
            isMakeupRow: true,
            courseName: mLog.course_name || '정규',
            day_schedules: {
              ...s.day_schedules,
              [dayKey]: makeupHour ? [makeupHour] : (s.day_schedules?.[dayKey] || [])
            },
            lastSession: makeupLastSession,
            todaySession: mLog
          });
        }
      });
    });

    result = expandedResult;

    // 💡 3. 숨김/제외 (결석/수업취소/수업제외) 필터링
    if (hideAbsent !== 'all') {
      result = result.filter((s: any) => {
        const rawAtt = s.todaySession?.attendance_status || '';
        const isAbsent = rawAtt.includes('결석') || rawAtt.includes('수업제외') || rawAtt.includes('수업취소');
        if (hideAbsent === 'absent') {
          return isAbsent;
        }
        if (hideAbsent === 'attend') {
          return !isAbsent;
        }
        return true;
      });
    }

    if (focusColumn === 'test_id') {
      result = result.filter((s: any) => s.todaySession?.test_id || s.todaySession?.test_status);
    }

    // 💡 4. 시간대 계산 헬퍼 (1~12시는 오후 13~24시로 일관성 있게 통일)
    const normalizeHour = (val: number | string) => {
      if (!val) return 99;
      let num = typeof val === 'number' ? val : parseInt(String(val), 10);
      if (isNaN(num) || num <= 0) return 99;
      let h = num >= 100 ? Math.floor(num / 100) : num;
      if (h > 0 && h <= 12) h += 12;
      return h;
    };

    const getStartTime = (st: any) => {
      // 💡 1. 명시적 시간이동 정보(moved_to_hour) 또는 attendance_status ("보강:19:00~21:00") 파싱 시각 최우선 적용!!
      const movedHour = st.todaySession?.moved_to_hour;
      if (movedHour !== undefined && movedHour !== null && movedHour > 0) {
        return normalizeHour(movedHour);
      }
      const attStatus = st.todaySession?.attendance_status || '';
      if (attStatus.startsWith('보강:')) {
        const m = attStatus.match(/(\d{1,2}):/);
        if (m) {
          return normalizeHour(parseInt(m[1], 10));
        }
      }

      const hours = st.day_schedules?.[dayKey] || [];

      // 💡 2. 특강/선택과목 행인 경우: 자신의 특강 교시 적용
      if (st.isSpecialClass) {
        if (hours.length > 0) return normalizeHour(hours[0]);
        return 99;
      }

      // 💡 3. 정규 수업 행인 경우 원래 정규 수업 교시 적용
      if (hours.length > 0) {
        return normalizeHour(hours[0]);
      }
      return 99;
    };

    // 💡 5. 정렬 (시간순/학년순/이름순)
    result.sort((a, b) => {
      if (sortMode === 'time') {
        const tA = getStartTime(a);
        const tB = getStartTime(b);
        if (tA !== tB) {
          return sortDirection === 'asc' ? tA - tB : tB - tA;
        }
        // 💡 동일 시간대 내에서는 무조건 학생 이름 가나다순(ko)으로 정렬
        return a.name.localeCompare(b.name, 'ko');
      } else if (sortMode === 'grade') {
        const gA = getGradeWeight(a.grade);
        const gB = getGradeWeight(b.grade);
        if (gA !== gB) {
          return sortDirection === 'asc' ? gA - gB : gB - gA;
        }
        const tA = getStartTime(a);
        const tB = getStartTime(b);
        if (tA !== tB) return tA - tB;
        return a.name.localeCompare(b.name);
      } else {
        const comp = a.name.localeCompare(b.name);
        return sortDirection === 'asc' ? comp : -comp;
      }
    });

    // 💡 6. 시작 시간대 필터 ('15:00', '16:00' 등) - 정규시간 또는 보강시간 어느 하나라도 일치하면 표시
    if (selectedHour && selectedHour !== 'All') {
      const targetH = parseInt(selectedHour, 10);
      if (!isNaN(targetH)) {
        result = result.filter(st => {
          const regH = getStartTime(st);
          if (regH === targetH) return true;
          if (st.todaySession?.moved_to_hour !== undefined && st.todaySession?.moved_to_hour !== null) {
            const h = normalizeHour(st.todaySession.moved_to_hour);
            if (h === targetH) return true;
          }
          return false;
        });
      }
    }

    return result;
  }, [students, selectedDate, academyInfo, sortMode, sortDirection, selectedHour, hideAbsent, focusColumn]);

  return rows;
}
