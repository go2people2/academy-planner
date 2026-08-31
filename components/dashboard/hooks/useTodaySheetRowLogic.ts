import { useState, useEffect, useRef, useCallback } from 'react';
import { HomeworkItem, StudentStatus, Student, TextbookOption, SessionLog } from '@/types/dashboard';
import { getDayOfWeek, parseBookCourseValue } from '@/lib/utils';
import { ATTENDANCE_STATUS, normalizeAttendanceStatus } from '@/lib/sessionFieldMap';
import { scheduleValueToMinutes, scheduleValueToTimeInput } from '@/lib/scheduleTime';

interface UseTodaySheetRowLogicProps {
  student: Student;
  masterTextbooks: any[];
  onSave: (id: string, data: any) => Promise<boolean>;
  onUpdateStudentInfo?: (id: string, fieldOrUpdates: any, value?: any) => Promise<any>;
  selectedDate: string;
  activeCell?: { studentId: string; columnId: string } | null;
  editingCell?: { studentId: string; columnId: string } | null;
  currentUser: any;
}

export function useTodaySheetRowLogic({
  student, masterTextbooks, onSave, onUpdateStudentInfo, selectedDate, activeCell, editingCell, currentUser
}: UseTodaySheetRowLogicProps) {
  // 1. States
  const [isHwEditorOpen, setIsHwEditorOpen] = useState(false);
  const [isCwEditorOpen, setIsCwEditorOpen] = useState(false);
  const [isCcwEditorOpen, setIsCcwEditorOpen] = useState(false);
  const [isNqEditorOpen, setIsNqEditorOpen] = useState(false);
  const [isTestEditorOpen, setIsTestEditorOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSupplementTimePickerOpen, setIsSupplementTimePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [rowDate, setRowDate] = useState(selectedDate);

  // 2. Refs
  const testRef = useRef<HTMLTextAreaElement>(null);
  const cwRef = useRef<HTMLTextAreaElement>(null);
  const ccwRef = useRef<HTMLTextAreaElement>(null);
  const hwRef = useRef<HTMLTextAreaElement>(null);
  const nqRef = useRef<HTMLTextAreaElement>(null);
  const missionRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const managementNotesRef = useRef<HTMLTextAreaElement>(null);
  const tdRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  // 3. Utils
  const translateBookCodes = useCallback((text: string) => {
    if (!text || !masterTextbooks || masterTextbooks.length === 0) return text;
    let result = text;
    const sortedMaster = [...masterTextbooks].sort((a, b) => (b.bookcode?.length || 0) - (a.bookcode?.length || 0));
    sortedMaster.forEach(m => {
      if (m.bookcode && m.title) {
        const escapedCode = m.bookcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedCode, 'gi');
        result = result.replace(regex, m.title);
      }
    });
    return result;
  }, [masterTextbooks]);

  const getInitialFormData = useCallback((date: string) => {
    const isToday = date === selectedDate;
    const isSpecial = student.isSpecialClass;
    const isMakeupRow =
      student.isMakeupRow || (student as any).__courseType === 'makeup';

    const targetCourse = (
      isSpecial
        ? (student.courseName || student.electiveCourse?.subject || '특강')
        : (student.todaySession?.course_name || '정규')
    ).trim();

    const normalizeMovedHour = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;

      const parsed = parseInt(String(value), 10);
      if (Number.isNaN(parsed)) return null;

      return parsed >= 100 ? Math.floor(parsed / 100) : parsed;
    };

    const rowSessionId = student.todaySession?.id;
    const hasPersistedSessionId = Boolean(
      rowSessionId && !String(rowSessionId).startsWith('temp')
    );

    const targetMovedHour = normalizeMovedHour(
      student.todaySession?.moved_to_hour
    );

    const isSessionMatching = (s: any) => {
      if (!s) return false;

      // DB 세션 id가 있으면, 현재 행은 그 id의 세션만 사용한다.
      if (hasPersistedSessionId) {
        return s.id === rowSessionId;
      }

      const sDate = s.date || s.session_date;
      if (sDate !== date) return false;

      const sCourse = (s.course_name || '정규').trim();

      if (isMakeupRow) {
        return (
          s.is_pure_makeup === true &&
          sCourse === targetCourse &&
          normalizeMovedHour(s.moved_to_hour) === targetMovedHour
        );
      }

      if (isSpecial) {
        return sCourse === targetCourse && s.is_pure_makeup !== true;
      }

      return (
        (!s.course_name || sCourse === '정규') &&
        s.is_pure_makeup !== true
      );
    };

    const session = isSessionMatching(student.todaySession)
      ? student.todaySession
      : (student.allLogs || []).find((log: any) => isSessionMatching(log));

    const mergeBooks = (existingJson: any[] | undefined) => {
      const assigned = student.assigned_books || [];
      const current = existingJson || [];
      const merged = [...current];
      const currentRowTargetTag = student.isSpecialClass
        ? `선택:${student.courseName || student.electiveCourse?.subject || ''}`
        : '정규';

      assigned.forEach(bookName => {
        const courseVal = String(student.book_courses?.[bookName] || '');
        if (courseVal.includes('-keep') || courseVal.includes('-done')) return;

        const { targetTag } = parseBookCourseValue(courseVal);

        const isMatch = (targetTag === '공통') ||
                        (!student.isSpecialClass && (targetTag === '정규' || !targetTag.startsWith('선택:'))) ||
                        (student.isSpecialClass && (targetTag === currentRowTargetTag));

        if (isMatch && !current.some(b => b.book_name === bookName)) {
          merged.push({ type: 'book', book_name: bookName, range: '', units: [] });
        }
      });
      return merged;
    };

    const dayName = getDayOfWeek(date);
    const isTodayClassDay = student.isSpecialClass
      ? (
          Array.isArray(student.electiveCourse?.days)
            ? student.electiveCourse.days.some((d: any) => typeof d === 'string' && d.trim() === dayName)
            : (typeof student.electiveCourse?.days === 'string' && student.electiveCourse.days.includes(dayName))
        )
      : student.class_days?.map(d => d.trim()).includes(dayName);



    // 💡 [안정화] session.next_quiz_text 가 없더라도 homework_to JSON 데이터가 있으면 역파싱하여 복원합니다.
    let resolvedNextQuizText = session?.next_quiz_text || '';
    let resolvedNextQuizJson = session?.next_quiz_json || [];
    let resolvedNextQuizCut = session?.next_quiz_cut || 0;
    let resolvedNextQuizTrial = session?.next_quiz_trial || 1;

    if (!resolvedNextQuizText && session?.homework_to) {
      try {
        const raw = session.homework_to;
        if (typeof raw === 'string' && raw.startsWith('{')) {
          const parsed = JSON.parse(raw);
          resolvedNextQuizText = parsed.text || '';
          resolvedNextQuizJson = parsed.json || [];
          resolvedNextQuizCut = parsed.cut || 0;
          resolvedNextQuizTrial = parsed.trial || 1;
        } else if (raw && typeof raw === 'string') {
          resolvedNextQuizText = raw;
        }
      } catch (e) {}
    }

    // 💡 [안정화] session.test_completed 등이 없더라도 test_result JSON 데이터가 있으면 역파싱하여 복원합니다.
    let resolvedTestCompleted = session?.test_completed;
    let resolvedTestCut = session?.test_cut || 0;
    let resolvedTodoAchievement = session?.todo_achievement || 0;
    let resolvedMission = session?.mission || '';
    let resolvedHwChecked = session?.hw_checked_today ?? false;
    let resolvedHwPassed = session?.hw_passed_today ?? false;
    let resolvedTestScoreType = session?.test_score_type || 'score';
    let resolvedTestTotalCount = session?.test_total_count || 0;

    if (session?.test_result) {
      try {
        const raw = session.test_result;
        if (typeof raw === 'string' && raw.startsWith('{')) {
          const parsed = JSON.parse(raw);
          if (resolvedTestCompleted === undefined && parsed.completed !== undefined) {
            resolvedTestCompleted = parsed.completed === true;
          }
          if (!resolvedTestCut && parsed.cut) resolvedTestCut = parsed.cut;
          if (!resolvedTodoAchievement && parsed.todo_achievement) resolvedTodoAchievement = parsed.todo_achievement;
          // 💡 [학생미션 자동채우기 완전 금지] 옛날 JSON의 mission 역승계 전면 차단
          if (parsed.hw_checked_today !== undefined) resolvedHwChecked = parsed.hw_checked_today === true;
          if (parsed.hw_passed_today !== undefined) resolvedHwPassed = parsed.hw_passed_today === true;
          if (parsed.score_type) resolvedTestScoreType = parsed.score_type;
          if (parsed.total_count) resolvedTestTotalCount = parsed.total_count;
        }
      } catch (e) {}
    }

    const sessionNotes = session?.management_notes;

    // 💡 [단순명확 원칙] 학생미션(mission)은 과거/기존 JSON 기록을 절대 당겨오지 않고 '당일 직저' 입력된 session.mission 만 사용!
    const initialMission = session?.mission || '';

    // 💡 [단순명확 원칙] 주의점(management_notes)은 당일 세션 기록(session.management_notes)만 사용 (마스터 주의점 자동 fallback 금지)
    const initialNotes = sessionNotes || '';

    return {
      attendance_status: normalizeAttendanceStatus(session?.attendance_status),
      status: session?.status || 'none',
      special_notes: translateBookCodes(session?.special_notes || ''),
      classwork_text: translateBookCodes(session?.classwork_text || ''),
      classwork_json: mergeBooks(session?.classwork_json),
      completed_classwork_text: translateBookCodes(session?.completed_classwork_text || ''),
      completed_classwork_json: mergeBooks(session?.completed_classwork_json),
      homework_text: translateBookCodes(session?.homework_text || ''),
      homework_json: mergeBooks(session?.homework_json),
      next_quiz_text: translateBookCodes(resolvedNextQuizText || ''),
      next_quiz_json: mergeBooks(resolvedNextQuizJson),
      next_quiz_cut: resolvedNextQuizText ? resolvedNextQuizCut : 0,
      next_quiz_trial: resolvedNextQuizText ? resolvedNextQuizTrial : 1,
      test_id: translateBookCodes(session?.test_id || ''),
      test_score: session?.test_score || '',
      test_score_type: resolvedTestScoreType,
      test_cut: resolvedTestCut,
      test_total_count: resolvedTestTotalCount,
      test_completed: resolvedTestCompleted,
      hw_checked_today: resolvedHwChecked,
      hw_passed_today: resolvedHwPassed,
      mission: translateBookCodes(initialMission),
      management_notes: translateBookCodes(initialNotes),
      moved_to_hour: session?.moved_to_hour,
      is_pure_makeup: isMakeupRow ? true : false,
      isTodayClassDay
    };
  }, [student.allLogs, student.assigned_books, student.todaySession, student.management_notes, student.class_days, selectedDate, translateBookCodes]);

  const [formData, setFormData] = useState<any>(() => getInitialFormData(selectedDate));

  // 4. Sync Effects
  const prevSessionRef = useRef(student.todaySession);

  useEffect(() => {
    const isDateChanged = rowDate !== selectedDate;

    if (isDateChanged) {
      const newData = getInitialFormData(selectedDate);
      setFormData(newData);
      setRowDate(selectedDate);
      prevSessionRef.current = student.todaySession;
      return;
    }

    // student.todaySession 이 부모로부터 변경되어 내려온 경우 실시간 동기화
    const isSessionPropsChanged = prevSessionRef.current !== student.todaySession ||
      prevSessionRef.current?.moved_to_hour !== student.todaySession?.moved_to_hour ||
      prevSessionRef.current?.attendance_status !== student.todaySession?.attendance_status;

    if (isSessionPropsChanged) {
      const isUserTyping = editingCell?.studentId === student.id || (student.originalId && editingCell?.studentId === student.originalId);
      const hasLocalPending = Object.keys(pendingUpdatesRef.current).length > 0 || isSavingRef.current;

      // 💡 [DAILY_SHEET_AUTOFILL_RULES.md] 사용자가 직접 입력 중이거나 로컬 저장 진행 중인 경우 덮어쓰기 방지
      // 외부에서 내려온 확정 업데이트(Delete, Paste 등)는 비편집 셀에 즉시 반영
      if (!isUserTyping && !hasLocalPending) {
        const newData = getInitialFormData(selectedDate);
        setFormData(newData);
        prevSessionRef.current = student.todaySession;
      }
    }
  }, [selectedDate, student.todaySession, student.id, isSaving, editingCell?.studentId, getInitialFormData, rowDate]);

  // 💡 [추가] Tab/Enter 저장 직후 발생하는 Blur를 명시적으로 무시하는 플래그
  const skipBlurRef = useRef(false);
  const recentlySavedRef = useRef(false);
  const isSavingRef = useRef(false);
  const pendingUpdatesRef = useRef<Record<string, any>>({});

  // 5. Handlers
  // 💡 [하이브리드 계약] handleSave(updatesOrField, valueOrOptions?, maybeOptions?)
  const handleSave = useCallback(async (updatesOrField: Record<string, any> | string, valueOrOptions?: any, maybeOptions?: any): Promise<boolean> => {
    // 0. 계약 분석 및 데이터 정규화
    let finalUpdates: Record<string, any> = {};
    let options: { isBlur?: boolean } = {};

    if (typeof updatesOrField === 'string') {
      // ✅ [공용 계약 유지] onSave(colId, value, options?)
      const fieldMap: any = { attendance: 'attendance_status', attendance_status: 'attendance_status', test_id: 'test_id', classwork: 'classwork_text', completed_classwork: 'completed_classwork_text', assign: 'homework_text', next_quiz: 'next_quiz_text', mission: 'mission', notes: 'special_notes', management_notes: 'management_notes', test_score: 'test_score', test_total_count: 'test_total_count' };
      const dbKey = fieldMap[updatesOrField] || updatesOrField;
      finalUpdates = { [dbKey]: valueOrOptions };
      options = maybeOptions || {};
    } else {
      // ✅ [ScoreCell 전용 정규화] onSave({ fields }, options?)
      finalUpdates = { ...updatesOrField };
      options = valueOrOptions || {};
    }

    const isBlurCall = options?.isBlur === true;

    // 1. 중복 저장 방지 (Tab/Enter 직후 따라오는 Blur 1회 무시)
    if (isBlurCall && skipBlurRef.current) {
      skipBlurRef.current = false;
      return false;
    }

    // 💡 [대기열 큐 보호] 이전 저장이 진행 중일 때 들어온 새 blur/입력값은 버리지 않고 누적 대기
    if (isSavingRef.current) {
      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...finalUpdates };
      setFormData((prev: any) => ({ ...prev, ...finalUpdates }));
      return true;
    }

    recentlySavedRef.current = true;

    // 2. DOM 병합 배제 (Refs 수집을 걷어내고 오직 전달된 업데이트 정보만 단독 저장)
    const mergedUpdates = { ...finalUpdates };

    // 💡 [정교화] 범위(range)나 유닛(units)이 비어있는 가짜/빈 교재 항목 필터링 제거
    const sanitizeBookJson = (jsonArr: any[] | undefined) => {
      if (!jsonArr) return [];
      return jsonArr.filter(item => {
        if (item.type !== 'book') return true;
        const hasRange = (item.range || '').trim();
        const hasUnits = item.units && item.units.length > 0;
        return hasRange || hasUnits;
      });
    };

    if ('classwork_json' in mergedUpdates) mergedUpdates.classwork_json = sanitizeBookJson(mergedUpdates.classwork_json);
    if ('completed_classwork_json' in mergedUpdates) mergedUpdates.completed_classwork_json = sanitizeBookJson(mergedUpdates.completed_classwork_json);
    if ('homework_json' in mergedUpdates) mergedUpdates.homework_json = sanitizeBookJson(mergedUpdates.homework_json);
    if ('next_quiz_json' in mergedUpdates) mergedUpdates.next_quiz_json = sanitizeBookJson(mergedUpdates.next_quiz_json);

    const finalData = { ...formData, ...mergedUpdates };
    const initial = getInitialFormData(rowDate);

    // 💡 [개선] 출결 상태는 오직 출결 관련 액션에서만 저장되도록 보호
    // 명시적으로 mergedUpdates에 attendance_status가 포함된 경우에만 payload에 포함
    const isAttendanceUpdate = 'attendance_status' in mergedUpdates;
    const isExplicitMovedHourUpdate = 'moved_to_hour' in mergedUpdates;

    const savePayload: any = { ...mergedUpdates };

    // 일반 필드 저장 시 attendance_status가 payload에 포함되지 않도록 제거
    if (!isAttendanceUpdate) {
      delete savePayload.attendance_status;
    }

    const hasChange = isExplicitMovedHourUpdate || Object.keys(mergedUpdates).some(key => {
      const fVal = (finalData as any)[key];
      const iVal = (initial as any)[key];
      if (typeof fVal === 'boolean' || typeof iVal === 'boolean') return fVal !== iVal;
      return String(fVal || '') !== String(iVal || '');
    });
    if (!hasChange) return false;

    // 3. 저장 실행 및 플래그 설정
    isSavingRef.current = true;
    setIsSaving(true);
    if (!isBlurCall) skipBlurRef.current = true; // 키보드 저장 시 플래그 활성화

    setFormData(finalData);

    // 💡 [원장님 특별 피드백 반영 - 실시간 DOM 밸류 수동 동기화]
    if ('completed_classwork_text' in mergedUpdates && ccwRef.current) {
      ccwRef.current.value = mergedUpdates.completed_classwork_text || '';
    }
    if ('special_notes' in mergedUpdates && notesRef.current) {
      notesRef.current.value = mergedUpdates.special_notes || '';
    }
    if ('classwork_text' in mergedUpdates && cwRef.current) {
      cwRef.current.value = mergedUpdates.classwork_text || '';
    }
    if ('homework_text' in mergedUpdates && hwRef.current) {
      hwRef.current.value = mergedUpdates.homework_text || '';
    }
    if ('next_quiz_text' in mergedUpdates && nqRef.current) {
      nqRef.current.value = mergedUpdates.next_quiz_text || '';
    }
    if ('test_id' in mergedUpdates && testRef.current) {
      testRef.current.value = mergedUpdates.test_id || '';
    }
    if ('mission' in mergedUpdates && missionRef.current) {
      missionRef.current.value = mergedUpdates.mission || '';
    }
    if ('management_notes' in mergedUpdates && managementNotesRef.current) {
      managementNotesRef.current.value = mergedUpdates.management_notes || '';
    }

    const payloadKeys = Object.keys(savePayload);
    const saveType = isAttendanceUpdate ? 'ATTENDANCE' : 'GENERAL_INFO';
    console.debug(`[SAVE][${saveType}] student: ${student.name}, fields:`, payloadKeys);

    let success = false;
    try {
      success = await onSave(student.id, savePayload);
    } catch (err) {
      console.error('Failed to save student data:', err);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);

      // 💡 [대기열 후속 처리] 저장 중 누적된 변경사항이 있다면 즉시 후속 저장 실행
      if (Object.keys(pendingUpdatesRef.current).length > 0) {
        const queuedUpdates = { ...pendingUpdatesRef.current };
        pendingUpdatesRef.current = {};
        handleSave(queuedUpdates);
      }
    }

    setTimeout(() => {
      recentlySavedRef.current = false;
      if (prevSessionRef.current !== student.todaySession) {
        const isUserTyping = editingCell?.studentId === student.id || (student.originalId && editingCell?.studentId === student.originalId);
        if (!isUserTyping && Object.keys(pendingUpdatesRef.current).length === 0 && !isSavingRef.current) {
          const newData = getInitialFormData(rowDate);
          setFormData(newData);
          prevSessionRef.current = student.todaySession;
        }
      }
    }, 1500);
    setSaveStatus(success ? 'success' : 'error');
    setTimeout(() => setSaveStatus('idle'), 2000);
    return success;
  }, [formData, rowDate, student.id, onSave, onUpdateStudentInfo, getInitialFormData]);

  const handleAttendanceToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    const currentStatus = formData.attendance_status;
    let nextStatus: string;

    let timeSuffix = '';
    if (currentStatus && currentStatus.includes(':')) {
      timeSuffix = currentStatus.substring(currentStatus.indexOf(':'));
    }

    if (currentStatus && currentStatus.startsWith(ATTENDANCE_STATUS.PRESENT)) {
      nextStatus = ATTENDANCE_STATUS.ABSENT + timeSuffix; // 출석 ➡️ 결석
    } else if (currentStatus && currentStatus.startsWith(ATTENDANCE_STATUS.ABSENT)) {
      nextStatus = ATTENDANCE_STATUS.LATE + timeSuffix;   // 결석 ➡️ 지각
    } else if (currentStatus && currentStatus.startsWith(ATTENDANCE_STATUS.LATE)) {
      nextStatus = ATTENDANCE_STATUS.EARLY_LEAVE + timeSuffix; // 지각 ➡️ 조퇴
    } else if (currentStatus && currentStatus.startsWith(ATTENDANCE_STATUS.EARLY_LEAVE)) {
      nextStatus = ATTENDANCE_STATUS.BEFORE + timeSuffix; // 조퇴 ➡️ 수업전 (모든 행 동일)
    } else {
      nextStatus = ATTENDANCE_STATUS.PRESENT + timeSuffix; // 보강, 수업전, 기타 빈 상태 ➡️ 출석으로 첫 순환 개시
    }

    const isMakeup = student.isMakeupRow || (student as any).__courseType === 'makeup' || String(student.id || '').includes('_makeup_') || formData.is_pure_makeup === true;

    const extraUpdate: any = {
      attendance_status: nextStatus,
      is_pure_makeup: isMakeup ? true : false,
    };

    setFormData((prev: any) => ({ ...prev, ...extraUpdate }));
    handleSave(extraUpdate);
  };

  const handleSupplementTimeSelect = async (timeVal: number | null) => {
    const day = getDayOfWeek(rowDate);
    const isMakeup = student.isMakeupRow || (student as any).__courseType === 'makeup' || String(student.id || '').includes('_makeup_') || formData.is_pure_makeup === true;

    // 💡 [과목명 보존] 선택과목 행이면 student.courseName 또는 electiveCourse.subject를 무조건 최우선 사용
    const courseName = student.isSpecialClass
      ? (student.courseName || (student as any).electiveCourse?.subject || (student as any).__courseSubject || '특강')
      : (student.todaySession?.course_name || student.courseName || '정규');

    const previousMovedToHour = student.todaySession?.moved_to_hour !== undefined && student.todaySession?.moved_to_hour !== null
      ? student.todaySession.moved_to_hour
      : (formData.moved_to_hour !== undefined && formData.moved_to_hour !== null ? formData.moved_to_hour : null);

    // timeVal이 null이면 명시적 원래 시간 복귀 요청
    if (timeVal === null) {
      const currentStatus = formData.attendance_status || '';
      const finalStatus = (currentStatus === '보강' || currentStatus.startsWith('보강:'))
        ? ATTENDANCE_STATUS.BEFORE
        : currentStatus;

      const payload: any = {
        course_name: courseName,
        moved_to_hour: null,
        from_moved_to_hour: previousMovedToHour,
        attendance_status: finalStatus,
        attendance_reason: null,
        is_pure_makeup: false,
      };
      if (student.todaySession?.id && student.todaySession.id !== 'temp') payload.id = student.todaySession.id;

      setFormData((prev: any) => ({
        ...prev,
        moved_to_hour: null,
        attendance_status: finalStatus,
        attendance_reason: null,
        is_pure_makeup: false,
      }));
      await onSave(student.id, payload);
      setIsSupplementTimePickerOpen(false);
      return;
    }

    const clickMinutes = scheduleValueToMinutes(timeVal);

    // 💡 [원래 시간표 수업 판별] 정규 다중 시간 및 선택과목(특강) 시간표 완벽 일치 판정
    const isOriginalScheduledHour = !isMakeup && (() => {
      if (clickMinutes === null) return false;

      // 1. 선택과목인 경우: __elective_courses에서 과목, 요일, 시간 일치 검사
      if (student.isSpecialClass || (student as any).__courseType === 'elective') {
        const rawElective = student.book_courses?.['__elective_courses'];
        if (!rawElective) return false;
        try {
          const parsed = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
          if (!Array.isArray(parsed)) return false;
          const currentSubject = student.courseName || (student as any).electiveCourse?.subject || (student as any).__courseSubject;
          return parsed.some((c: any) => {
            if (!c) return false;
            const cSub = c.subject || c.course_name || c.name;
            if (currentSubject && cSub !== currentSubject) return false;
            const days = c.days;
            const matchesDay = days && (
              Array.isArray(days)
                ? days.some((d: any) => typeof d === 'string' && d.trim() === day)
                : (typeof days === 'string' && days.includes(day))
            );
            if (!matchesDay) return false;

            const electiveHours = (c.schedules && Array.isArray(c.schedules[day]) && c.schedules[day].length > 0)
              ? c.schedules[day].map((h: any) => scheduleValueToMinutes(h))
              : (Array.isArray(c.hours) && c.hours.length > 0 ? c.hours.map((h: any) => scheduleValueToMinutes(h)) : (c.time ? [scheduleValueToMinutes(c.time)] : []));

            return electiveHours.some((em: number | null) => em !== null && em === clickMinutes);
          });
        } catch (e) {
          return false;
        }
      }

      // 2. 정규 수업인 경우: day_schedules[day]의 시작 시간과 일치 검사
      const regSched = student.day_schedules?.[day];
      const regularStartMin = (Array.isArray(regSched) && regSched.length > 0) ? scheduleValueToMinutes(regSched[0]) : null;
      return regularStartMin !== null && regularStartMin === clickMinutes;
    })();

    if (isOriginalScheduledHour) {
      const currentStatus = formData.attendance_status || '';
      const finalStatus = (currentStatus === '보강' || currentStatus.startsWith('보강:'))
        ? ATTENDANCE_STATUS.BEFORE
        : currentStatus;

      const payload: any = {
        course_name: courseName,
        moved_to_hour: null,
        from_moved_to_hour: previousMovedToHour,
        attendance_status: finalStatus,
        attendance_reason: null,
        is_pure_makeup: false,
      };
      if (student.todaySession?.id && student.todaySession.id !== 'temp') payload.id = student.todaySession.id;

      setFormData((prev: any) => ({
        ...prev,
        moved_to_hour: null,
        attendance_status: finalStatus,
        attendance_reason: null,
        is_pure_makeup: false,
      }));
      await onSave(student.id, payload);
    } else {
      const timeStr = scheduleValueToTimeInput(timeVal) || '17:00';
      const newAttStatus = isMakeup
        ? `보강:${timeStr}`
        : (formData.attendance_status || ATTENDANCE_STATUS.BEFORE);

      const payload: any = {
        course_name: courseName,
        moved_to_hour: timeVal,
        from_moved_to_hour: previousMovedToHour,
        attendance_status: newAttStatus,
        attendance_reason: '시간 변경',
        is_pure_makeup: isMakeup ? true : false,
      };
      if (student.todaySession?.id && student.todaySession.id !== 'temp') payload.id = student.todaySession.id;

      setFormData((prev: any) => ({ ...prev, ...payload }));
      await onSave(student.id, payload);
    }

    setIsSupplementTimePickerOpen(false);
  };

  const selectFeedback = (level: 'gradeA' | 'gradeB' | 'gradeC' | 'gradeD' | 'gradeE' | 'gradeF' | 'none') => {
    const presets = currentUser?.homework_presets || {
      'gradeA': '숙제를 아주 완벽하게 잘 해왔습니다. *^^*',
      'gradeB': '숙제를 잘 수행했습니다.',
      'gradeC': '숙제 수행이 보통입니다.',
      'gradeD': '숙제가 미흡한 부분이 있습니다.',
      'gradeE': '숙제를 거의 해오지 않았습니다.',
      'gradeF': ''
    };
    let currentNotes = formData.special_notes || '';
    const newComment = presets[level] || '';

    if (level === 'none') {
      let updatedNotes = currentNotes;
      Object.values(presets).forEach(p => {
        if (p && updatedNotes.includes(String(p))) updatedNotes = updatedNotes.replace(String(p), '').trim();
      });
      setFormData((prev: any) => ({ ...prev, special_notes: updatedNotes }));
      if (notesRef.current) notesRef.current.value = updatedNotes;
      handleSave('notes', updatedNotes);
      setIsFeedbackOpen(false);
      return;
    }

    let updatedNotes = currentNotes;
    Object.values(presets).forEach(p => {
      if (p && updatedNotes.includes(String(p))) updatedNotes = updatedNotes.replace(String(p), newComment).trim();
    });

    if (updatedNotes === currentNotes) updatedNotes = currentNotes ? `${currentNotes}\n${newComment}`.trim() : newComment;

    setFormData((prev: any) => ({ ...prev, special_notes: updatedNotes }));
    if (notesRef.current) notesRef.current.value = updatedNotes;
    handleSave('notes', updatedNotes);
    setIsFeedbackOpen(false);
  };

  const syncTextFromData = (newJson: HomeworkItem[], field: 'classwork' | 'homework' | 'next_quiz' | 'completed_classwork') => {
    const textKey = `${field}_text` as keyof typeof formData;
    const existingText: string = formData[textKey] || '';

    // 💡 JSON 항목에서 새로 생성된 최신 라인들
    const newLines = newJson
      .filter(item => item.range)
      .map(item => {
        const book = masterTextbooks.find(m => m.bookcode === item.book_name);
        const cleanRange = (item.range.startsWith('p') || item.range.includes(' p')) ? item.range : `p${item.range}`;
        return `${book?.title || item.book_name} ${cleanRange}`;
      });

    // 💡 현재 에디터가 관리 대상인 교재 제목 목록 (빈 교재명에 의한 오동작 방지 가드 포함)
    const managedBookTitles = newJson
      .map(item => {
        const book = masterTextbooks.find(m => m.bookcode === item.book_name);
        return (book?.title || item.book_name || '').trim();
      })
      .filter(title => title.length > 0);

    // 💡 기존 텍스트 중 현재 편집 대상인 교재명으로 시작하는 오래된 행은 삭제
    const existingLines = existingText ? existingText.split('\n') : [];
    const nonManagedLines = existingLines.filter(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return false;
      return !managedBookTitles.some(title => trimmedLine.startsWith(title));
    });

    // 💡 남은 수동 입력 라인들과 최신 교재 정보를 일괄 병합
    const mergedText = [...nonManagedLines, ...newLines].join('\n');

    const update = { [`${field}_json`]: newJson, [`${field}_text`]: mergedText };
    setFormData((prev: any) => ({ ...prev, ...update }));
    const refs: any = { classwork: cwRef, homework: hwRef, next_quiz: nqRef, completed_classwork: ccwRef };
    if (refs[field]?.current) refs[field].current.value = mergedText;
    handleSave(update);
  };


  return {
    states: {
      isHwEditorOpen, setIsHwEditorOpen, isCwEditorOpen, setIsCwEditorOpen, isCcwEditorOpen, setIsCcwEditorOpen,
      isNqEditorOpen, setIsNqEditorOpen, isTestEditorOpen, setIsTestEditorOpen, isTestModalOpen, setIsTestModalOpen,
      isFeedbackOpen, setIsFeedbackOpen, isSupplementTimePickerOpen, setIsSupplementTimePickerOpen,
      isSaving, saveStatus, formData, setFormData, rowDate
    },
    refs: { testRef, cwRef, ccwRef, hwRef, nqRef, missionRef, notesRef, managementNotesRef, tdRefs },
    handlers: {
      handleSave, handleAttendanceToggle, handleSupplementTimeSelect, selectFeedback, syncTextFromData
    }
  };
}
