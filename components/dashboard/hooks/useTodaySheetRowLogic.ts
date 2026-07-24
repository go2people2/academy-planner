'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { HomeworkItem, StudentStatus, Student, TextbookOption, SessionLog } from '@/types/dashboard';
import { getDayOfWeek } from '@/lib/utils';
import { ATTENDANCE_STATUS, normalizeAttendanceStatus } from '@/lib/sessionFieldMap';

interface UseTodaySheetRowLogicProps {
  student: Student;
  masterTextbooks: TextbookOption[];
  onSave: (id: string, data: any) => Promise<boolean>;
  onUpdateStudentInfo?: (id: string, field: string, value: any) => Promise<void>;
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
    const session = (isToday && student.todaySession?.date === date)
      ? student.todaySession 
      : (student.allLogs || []).find((l: any) => l.date === date);

    const mergeBooks = (existingJson: any[] | undefined) => {
      const assigned = student.assigned_books || [];
      const current = existingJson || [];
      const merged = [...current];
      assigned.forEach(bookName => {
        const courseVal = String(student.book_courses?.[bookName] || '');
        if (courseVal.includes('-keep') || courseVal.includes('-done')) return;
        
        if (!current.some(b => b.book_name === bookName)) {
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

    // 💡 [과거 가장 최신 로그 역추적 수혈 유틸]
    const getPastMostRecentValue = (field: 'mission' | 'management_notes') => {
      const logs = student.allLogs || [];
      const pastLogs = logs
        .filter((l: any) => {
          const lDate = l.date || l.session_date || '';
          return lDate !== '' && lDate < date;
        })
        .sort((a: any, b: any) => {
          const dateA = a.date || a.session_date || '';
          const dateB = b.date || b.session_date || '';
          return dateB.localeCompare(dateA);
        });
      
      const foundLog = pastLogs.find((l: any) => l[field] && String(l[field]).trim() !== '');
      return foundLog ? String(foundLog[field]) : '';
    };

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
          if (!resolvedMission && parsed.mission) resolvedMission = parsed.mission;
          if (parsed.hw_checked_today !== undefined) resolvedHwChecked = parsed.hw_checked_today === true;
          if (parsed.hw_passed_today !== undefined) resolvedHwPassed = parsed.hw_passed_today === true;
          if (parsed.score_type) resolvedTestScoreType = parsed.score_type;
          if (parsed.total_count) resolvedTestTotalCount = parsed.total_count;
        }
      } catch (e) {}
    }

    const sessionMission = resolvedMission || session?.mission;
    const sessionNotes = session?.management_notes;

    const initialMission = (sessionMission !== undefined && sessionMission !== null && String(sessionMission).trim() !== '')
      ? sessionMission
      : getPastMostRecentValue('mission');

    const initialNotes = (sessionNotes !== undefined && sessionNotes !== null && String(sessionNotes).trim() !== '')
      ? sessionNotes
      : getPastMostRecentValue('management_notes');
    
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
      isTodayClassDay
    };
  }, [student.allLogs, student.assigned_books, student.todaySession, student.management_notes, student.recent_mission, student.class_days, selectedDate, translateBookCodes]);

  const [formData, setFormData] = useState<any>(() => getInitialFormData(selectedDate));

  // 4. Sync Effects
  useEffect(() => {
    const isUserTyping = editingCell?.studentId === student.id || (student.originalId && editingCell?.studentId === student.originalId);
    const isDateChanged = rowDate !== selectedDate;

    if (isDateChanged) {
      const newData = getInitialFormData(selectedDate);
      setFormData(newData);
      setRowDate(selectedDate);
      return;
    }

    const isBatchSaving = typeof window !== 'undefined' && (window as any).__ams_batch_saving === true;

    // 💡 [초정밀 타이밍 보호] 사용자가 타이핑 중이거나, 저장이 진행 중이거나, 동기 저장 직후 찰나, 혹은 전역 배치 저장 중인 경우에는 외부 옛날 데이터로 덮어쓰기를 전면 차단합니다!
    if (!isUserTyping && !isSaving && !recentlySavedRef.current && !isBatchSaving) {
      const newData = getInitialFormData(selectedDate);
      setFormData(newData);
    }
  }, [selectedDate, student.todaySession, student.id, isSaving, activeCell?.studentId, editingCell?.studentId, getInitialFormData, rowDate, student.recent_mission, student.management_notes]);

  // 💡 [추가] Tab/Enter 저장 직후 발생하는 Blur를 명시적으로 무시하는 플래그
  const skipBlurRef = useRef(false);
  const recentlySavedRef = useRef(false);

  // 5. Handlers
  // 💡 [하이브리드 계약] handleSave(updatesOrField, valueOrOptions?, maybeOptions?)
  const handleSave = useCallback(async (updatesOrField: Record<string, any> | string, valueOrOptions?: any, maybeOptions?: any) => {
    if (isSaving) return;
    recentlySavedRef.current = true;

    // 0. 계약 분석 및 데이터 정규화
    let finalUpdates: Record<string, any> = {};
    let options: { isBlur?: boolean } = {};

    if (typeof updatesOrField === 'string') {
      // ✅ [공용 계약 유지] onSave(colId, value, options?)
      const fieldMap: any = { test_id: 'test_id', classwork: 'classwork_text', completed_classwork: 'completed_classwork_text', assign: 'homework_text', next_quiz: 'next_quiz_text', mission: 'mission', notes: 'special_notes', management_notes: 'management_notes', test_score: 'test_score', test_total_count: 'test_total_count' };
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
      return;
    }

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
    
    const savePayload: any = { ...mergedUpdates };
    
    // 일반 필드 저장 시 attendance_status가 payload에 포함되지 않도록 제거
    if (!isAttendanceUpdate) {
      delete savePayload.attendance_status;
    }

    const hasChange = Object.keys(mergedUpdates).some(key => {
      const fVal = (finalData as any)[key];
      const iVal = (initial as any)[key];
      if (typeof fVal === 'boolean' || typeof iVal === 'boolean') return fVal !== iVal;
      return String(fVal || '') !== String(iVal || '');
    });
    if (!hasChange) return;

    // 3. 저장 실행 및 플래그 설정
    setIsSaving(true);
    if (!isBlurCall) skipBlurRef.current = true; // 키보드 저장 시 플래그 활성화

    setFormData(finalData);

    // 💡 [원장님 특별 피드백 반영 - 실시간 DOM 밸류 수동 동기화]
    // 비제어 컴포넌트 껍데기가 옛날 값을 고집하여 일치하지 않거나, 
    // 나중에 포커스가 스쳐 나갈 때(onBlur) 옛날 값으로 DB가 다시 오염되는 역버그를 완벽 철통 수비합니다!
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

    // 💡 [수정] 어떤 경우에도 전체 객체(finalData)를 보내지 않고, 
    // 오직 변경된 필드만 포함된 savePayload(Partial)만 전송하여 출석 필드를 보호
    const payloadKeys = Object.keys(savePayload);
    const saveType = isAttendanceUpdate ? 'ATTENDANCE' : 'GENERAL_INFO';
    console.debug(`[SAVE][${saveType}] student: ${student.name}, fields:`, payloadKeys);
    
    const success = await onSave(student.id, savePayload);
    setIsSaving(false);
    // 💡 [안정화] 저장이 완료된 후, 부모의 Props(학생 정보)가 자식 컴포넌트에 정상 도달할 때까지 
    // 로컬 상태가 옛날 데이터로 덮어씌워지는 현상을 방지하기 위해 락(recentlySavedRef) 해제 시점을 한 프레임 지연시킵니다!
    requestAnimationFrame(() => {
      recentlySavedRef.current = false;
    });
    setSaveStatus(success ? 'success' : 'error');
    setTimeout(() => setSaveStatus('idle'), 2000);
    return success;
  }, [formData, rowDate, student.id, student.recent_mission, isSaving, onSave, onUpdateStudentInfo, getInitialFormData]);

  const handleAttendanceToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const currentStatus = formData.attendance_status;
    let nextStatus: string;
    
    // 직관적이고 확실한 상태 분기 조건
    if (currentStatus === ATTENDANCE_STATUS.PRESENT) {
      nextStatus = ATTENDANCE_STATUS.ABSENT; // 출석 ➡️ 결석
    } else if (currentStatus === ATTENDANCE_STATUS.ABSENT) {
      nextStatus = ATTENDANCE_STATUS.LATE;   // 결석 ➡️ 지각
    } else if (currentStatus === ATTENDANCE_STATUS.LATE) {
      nextStatus = ATTENDANCE_STATUS.BEFORE; // 지각 ➡️ 수업전
    } else {
      nextStatus = ATTENDANCE_STATUS.PRESENT; // 보강, 수업전, 기타 빈 상태 ➡️ 출석으로 첫 순환 개시
    }
    
    console.log(`[ATTENDANCE_TOGGLE] Student: ${student.name}, current: ${currentStatus}, next: ${nextStatus}`);
    
    const extraUpdate: any = { 
      attendance_status: nextStatus
    };



    setFormData((prev: any) => ({ ...prev, ...extraUpdate }));
    handleSave(extraUpdate);
  };

  const handleSupplementTimeSelect = (hour: number) => {
    const day = getDayOfWeek(rowDate);
    const regularHours = student.day_schedules?.[day] || [];
    const isOriginalRegularHour = regularHours.some(val => {
      let h = val >= 100 ? Math.floor(val / 100) : val;
      if (h <= 12) h += 12;
      return h === hour;
    });

    const update: any = { 
      attendance_status: ATTENDANCE_STATUS.BEFORE, 
      moved_to_hour: isOriginalRegularHour ? null : hour,
      attendance_reason: isOriginalRegularHour ? null : '보강 수업'
    };

    setFormData((prev: any) => ({ ...prev, ...update }));
    handleSave(update);
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
      handleSave({ special_notes: updatedNotes });
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
    handleSave({ special_notes: updatedNotes });
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
