import { useState, useEffect, useMemo, useCallback } from 'react';
import { Student } from '@/types/dashboard';
import { getDayOfWeek } from '@/lib/utils';
import { ATTENDANCE_STATUS } from '@/lib/sessionFieldMap';

export function useClassroomModeState({
  students,
  onSave,
  onClose,
  selectedDate,
  academyInfo,
}: {
  students: Student[];
  onSave: (id: string, data: any) => Promise<boolean>;
  onClose: () => void;
  selectedDate: string;
  academyInfo?: any;
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'attendance' | 'timer'>('attendance');
  const [activeStudent, setActiveStudent] = useState<any | null>(null);
  const [isTimeShiftOpen, setIsTimeShiftOpen] = useState(false);
  const [collapsedHours, setCollapsedHours] = useState<Record<number, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isPm, setIsPm] = useState(true);

  const settings = useMemo(() => academyInfo?.operation_settings || {}, [academyInfo]);
  
  const timerPresets = useMemo(() => {
    const presets = settings.timer_presets || [];
    const p1 = parseInt(presets[0]) || 15;
    const p2 = parseInt(presets[1]) || 30;
    const p3 = parseInt(presets[2]) || 60;
    return [p1, p2, p3];
  }, [settings]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const baseTime = settings.first_period_time || "";
  const [baseH, baseM] = baseTime ? baseTime.split(':').map(Number) : [null, null];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getStudentHour = useCallback((student: any) => {
    const day = getDayOfWeek(selectedDate);

    if (student.__courseType === 'regular') {
      const isPureMakeup = student.todaySession?.is_pure_makeup;
      if (!isPureMakeup && student.todaySession?.moved_to_hour !== undefined && student.todaySession?.moved_to_hour !== null && student.todaySession?.moved_to_hour > 0) {
        const mVal = student.todaySession.moved_to_hour;
        let h = mVal >= 100 ? Math.floor(mVal / 100) : mVal;
        if (h > 0 && h <= 12 && h < 10) h += 12;
        return h;
      }
      const hours = student.day_schedules?.[day] || [];
      if (hours.length > 0) {
        const firstVal = hours[0];
        let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
        if (h > 0 && h <= 12 && h < 10) h += 12;
        return h;
      }
      return 999;
    }

    if (student.__courseType === 'makeup') {
      if (student.todaySession?.moved_to_hour !== undefined && student.todaySession?.moved_to_hour !== null && student.todaySession?.moved_to_hour > 0) {
        const mVal = student.todaySession.moved_to_hour;
        let h = mVal >= 100 ? Math.floor(mVal / 100) : mVal;
        if (h > 0 && h <= 12 && h < 10) h += 12;
        return h;
      }
      const status = student.todaySession?.attendance_status || '';
      if (status.includes(':')) {
        const parts = status.split(':');
        const val = parseInt(parts[parts.length - 1]);
        if (!isNaN(val) && val < 24) {
          let h = val;
          if (h > 0 && h <= 12 && h < 10) h += 12;
          return h;
        }
      }
      return 999;
    }

    if (student.__courseType === 'elective') {
      if (student.electiveCourse?.schedules?.[day]) {
        const sched = student.electiveCourse.schedules[day];
        if (Array.isArray(sched) && sched.length > 0) {
          const firstVal = sched[0];
          let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
          if (h < 10) h += 12;
          return h;
        }
      }
      let electiveMinHour = 999;
      const rawElective = student.book_courses?.['__elective_courses'];
      if (rawElective) {
        try {
          const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
          if (Array.isArray(courses)) {
            courses.forEach((c: any) => {
              if (c.days?.includes(day) && c.schedules?.[day]) {
                const sched = c.schedules[day];
                if (Array.isArray(sched) && sched.length > 0) {
                  const firstVal = sched[0];
                  let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
                  if (h < 10) h += 12;
                  if (h < electiveMinHour) {
                    electiveMinHour = h;
                  }
                }
              }
            });
          }
        } catch (e) {}
      }
      return electiveMinHour;
    }

    let regularHour = 999;
    const hours = student.day_schedules?.[day] || [];
    if (hours.length > 0) {
      const firstVal = hours[0];
      let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
      if (h < 10) h += 12;
      regularHour = h;
    }

    let electiveMinHour = 999;
    const rawElective = student.book_courses?.['__elective_courses'];
    if (rawElective) {
      try {
        const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
        if (Array.isArray(courses)) {
          courses.forEach((c: any) => {
            if (c.days?.includes(day) && c.schedules?.[day]) {
              const sched = c.schedules[day];
              if (Array.isArray(sched) && sched.length > 0) {
                const firstVal = sched[0];
                let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
                if (h < 10) h += 12;
                if (h < electiveMinHour) {
                  electiveMinHour = h;
                }
              }
            }
          });
        }
      } catch (e) {}
    }

    return Math.min(regularHour, electiveMinHour);
  }, [selectedDate]);

  const getElapsedMinutesForHour = useCallback((hour: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const targetHour = hour === 999 ? currentTime.getHours() : hour;
    targetDate.setHours(targetHour, baseM || 0, 0, 0);
    const diff = currentTime.getTime() - targetDate.getTime();
    return Math.floor(diff / (1000 * 60));
  }, [currentTime, selectedDate, baseM]);

  const localSave = useCallback(async (student: any, data: any) => {
    const isElective = student.__courseType === 'elective';
    const isMakeup = student.__courseType === 'makeup';
    const courseName = isElective 
      ? (student.__courseSubject || '특강') 
      : (isMakeup && student.courseName ? student.courseName : (student.todaySession?.course_name || '정규'));
    const realId = student.originalId || student.id;
    const movedHour = data.moved_to_hour !== undefined ? data.moved_to_hour : (student.todaySession?.moved_to_hour ?? null);
    
    const payload: any = {
      ...data,
      course_name: courseName,
      moved_to_hour: movedHour,
      ...(isMakeup || student.todaySession?.is_pure_makeup ? { is_pure_makeup: true } : {})
    };

    if (student.todaySession?.id && student.todaySession.id !== 'temp') {
      payload.id = student.todaySession.id;
    }

    return await onSave(realId, payload);
  }, [onSave]);

  return {
    currentTime,
    activeTab,
    setActiveTab,
    activeStudent,
    setActiveStudent,
    isTimeShiftOpen,
    setIsTimeShiftOpen,
    collapsedHours,
    setCollapsedHours,
    selectedIds,
    setSelectedIds,
    settings,
    timerPresets,
    isPm,
    setIsPm,
    baseH,
    baseM,
    getStudentHour,
    getElapsedMinutesForHour,
    localSave,
  };
}
