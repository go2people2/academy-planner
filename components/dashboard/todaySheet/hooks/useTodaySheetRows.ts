'use client';

import { useMemo } from 'react';
import { Student } from '@/types/dashboard';
import { getDayOfWeek } from '@/lib/utils';
import { calculateAggregatedHw, selectBaseSession, determineTodaySession } from '@/lib/studentDataEnricher';
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

    let result = [...students];

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
      if (!uniqueOriginalStudents.has(realId) || !s.isSpecialClass) {
        uniqueOriginalStudents.set(realId, s);
      }
    });

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
                const logCourse = l.course_name || '정규';
                if (['특강', '방학특강', '선택과목'].includes(courseSubject)) {
                  return ['특강', '방학특강', '선택과목'].includes(logCourse);
                }
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
          const logCourse = l.course_name || '정규';
          if (['특강', '방학특강', '선택과목'].includes(courseSubject)) {
            return ['특강', '방학특강', '선택과목'].includes(logCourse);
          }
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

      // (2) 정규 수업 행 추가
      const regularLog = (s.allLogs || []).find((l: any) => 
        (l.date || l.session_date) === selectedDate && (l.course_name === '정규' || !l.course_name)
      );

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

      let shouldShowRegular = false;
      if (isRegularClassDay) {
        shouldShowRegular = true;
      } else if (regularLog) {
        shouldShowRegular = true;
      } else if (!hasAnyElective) {
        shouldShowRegular = true;
      } else if (!isElectiveDay) {
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
            if (attStatus.startsWith('결석')) return false; // 💡 결석한 수업 세션은 이월 대상에서 제외하고 그 전 수업 계속 검색

            const hw = l.homework_text ? l.homework_text.trim() : '';
            return hw !== '' && hw !== '결석'; // 💡 실제 숙제가 기록되어 있던 수업만 채택
          })
          .sort((a: any, b: any) => String(b.date || b.session_date).localeCompare(String(a.date || a.session_date)));

        const realId = s.originalId || s.id;
        const regularBaseSession = selectBaseSession(s.allLogs || [], selectedDate, academyInfo?.operation_settings?.holidays, '정규');
        const regularTodaySession = determineTodaySession(s, regularLog, regularBaseSession, isRegularClassDay, selectedDate, academyInfo);
        const rawRegularLastSession = pastRegularLogs.length > 0 ? pastRegularLogs[0] : s.lastSession;
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

        const regularLastSession = formatLastSessionHomework(rawRegularLastSession);

        expandedResult.push({
          ...s,
          id: realId,
          originalId: realId,
          isSpecialClass: false,
          courseName: '정규',
          day_schedules: {
            ...s.day_schedules,
            [dayKey]: regularHours
          },
          lastSession: regularLastSession,
          todaySession: regularTodaySession
        });
      }
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

    // 💡 4. 시간대 계산 헬퍼
    const getStartTime = (st: any) => {
      if (st.todaySession?.moved_to_hour !== undefined && st.todaySession?.moved_to_hour !== null) {
        const mVal = st.todaySession.moved_to_hour;
        let h = mVal >= 100 ? Math.floor(mVal / 100) : mVal;
        if (h <= 12) h += 12;
        return h;
      }
      const hours = st.day_schedules?.[dayKey] || [];
      if (hours.length > 0) {
        const firstVal = hours[0];
        let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
        if (h <= 12) h += 12;
        return h;
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

    // 💡 6. 시작 시간대 필터 ('15:00', '16:00' 등)
    if (selectedHour && selectedHour !== 'All') {
      const targetH = parseInt(selectedHour, 10);
      if (!isNaN(targetH)) {
        result = result.filter(st => getStartTime(st) === targetH);
      }
    }

    return result;
  }, [students, selectedDate, academyInfo, sortMode, sortDirection, selectedHour, hideAbsent, focusColumn]);

  return rows;
}
