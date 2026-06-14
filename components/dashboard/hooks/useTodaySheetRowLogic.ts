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
        if (!current.some(b => b.book_name === bookName)) {
          merged.push({ type: 'book', book_name: bookName, range: '', units: [] });
        }
      });
      return merged;
    };

    const dayName = getDayOfWeek(date);
    const isTodayClassDay = student.class_days?.map(d => d.trim()).includes(dayName);
    
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
      next_quiz_text: translateBookCodes(session?.next_quiz_text || ''),
      next_quiz_json: mergeBooks(session?.next_quiz_json),
      next_quiz_cut: session?.next_quiz_cut || 0,
      next_quiz_trial: session?.next_quiz_trial || 1,
      test_id: translateBookCodes(session?.test_id || ''),
      test_score: session?.test_score || '',
      test_score_type: session?.test_score_type || 'score',
      test_cut: session?.test_cut || 0,
      test_total_count: session?.test_total_count || 0,
      test_completed: session?.test_completed,
      hw_checked_today: session?.hw_checked_today ?? false,
      hw_passed_today: session?.hw_passed_today ?? false,
      mission: translateBookCodes(student.recent_mission || ''),
      moved_to_hour: session?.moved_to_hour, // 💡 추가
      isTodayClassDay
    };
  }, [student.allLogs, student.assigned_books, student.todaySession, student.recent_mission, student.class_days, selectedDate, translateBookCodes]);

  const [formData, setFormData] = useState<any>(() => getInitialFormData(selectedDate));

  // 4. Sync Effects
  useEffect(() => {
    const isUserTyping = editingCell?.studentId === student.id;
    const isDateChanged = rowDate !== selectedDate;

    if (isDateChanged) {
      const newData = getInitialFormData(selectedDate);
      setFormData(newData);
      setRowDate(selectedDate);
      return;
    }

    if (!isUserTyping && !isSaving) {
      const newData = getInitialFormData(selectedDate);
      setFormData(newData);
    }
  }, [selectedDate, student.todaySession, student.id, isSaving, activeCell?.studentId, editingCell?.studentId, getInitialFormData, rowDate]);

  // 💡 [추가] Tab/Enter 저장 직후 발생하는 Blur를 명시적으로 무시하는 플래그
  const skipBlurRef = useRef(false);

  // 5. Handlers
  // 💡 [하이브리드 계약] handleSave(updatesOrField, valueOrOptions?, maybeOptions?)
  const handleSave = useCallback(async (updatesOrField: Record<string, any> | string, valueOrOptions?: any, maybeOptions?: any) => {
    if (isSaving) return;

    // 0. 계약 분석 및 데이터 정규화
    let finalUpdates: Record<string, any> = {};
    let options: { isBlur?: boolean } = {};

    if (typeof updatesOrField === 'string') {
      // ✅ [공용 계약 유지] onSave(colId, value, options?)
      const fieldMap: any = { test_id: 'test_id', classwork: 'classwork_text', completed_classwork: 'completed_classwork_text', assign: 'homework_text', next_quiz: 'next_quiz_text', mission: 'mission', notes: 'special_notes', test_score: 'test_score', test_total_count: 'test_total_count' };
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

    // 2. DOM 데이터 수집 및 병합 (Refs + Updates)
    const lazyData: any = {};
    const fieldRefs: any = { test_id: testRef, classwork: cwRef, completed_classwork: ccwRef, assign: hwRef, next_quiz: nqRef, mission: missionRef, notes: notesRef };
    
    Object.keys(fieldRefs).forEach(key => {
      if (fieldRefs[key].current) {
        const dbKey = key === 'test_id' ? 'test_id' : (key === 'notes' ? 'special_notes' : (key === 'mission' ? 'mission' : `${key}_text`));
        if (!(dbKey in finalUpdates)) lazyData[dbKey] = fieldRefs[key].current.value;
      }
    });

    const mergedUpdates = { ...lazyData, ...finalUpdates };
    
    // 점수 필드 보정
    const scoreInput = tdRefs.current['test_score']?.querySelector('input');
    if (scoreInput && !('test_score' in mergedUpdates)) mergedUpdates.test_score = scoreInput.value;
    if (formData.test_total_count !== undefined && !('test_total_count' in mergedUpdates)) mergedUpdates.test_total_count = formData.test_total_count;

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
    if (finalData.mission !== student.recent_mission && onUpdateStudentInfo) {
      await onUpdateStudentInfo(student.id, 'recent_mission', finalData.mission);
    }

    // 💡 [수정] 어떤 경우에도 전체 객체(finalData)를 보내지 않고, 
    // 오직 변경된 필드만 포함된 savePayload(Partial)만 전송하여 출석 필드를 보호
    const payloadKeys = Object.keys(savePayload);
    const saveType = isAttendanceUpdate ? 'ATTENDANCE' : 'GENERAL_INFO';
    console.debug(`[SAVE][${saveType}] student: ${student.name}, fields:`, payloadKeys);
    
    const success = await onSave(student.id, savePayload);
    setIsSaving(false);
    setSaveStatus(success ? 'success' : 'error');
    setTimeout(() => setSaveStatus('idle'), 2000);
    return success;
  }, [formData, rowDate, student.id, student.recent_mission, isSaving, onSave, onUpdateStudentInfo, getInitialFormData]);

  const handleAttendanceToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const statuses = [
      ATTENDANCE_STATUS.BEFORE, 
      ATTENDANCE_STATUS.PRESENT, 
      ATTENDANCE_STATUS.ABSENT, 
      ATTENDANCE_STATUS.LATE, 
      ATTENDANCE_STATUS.SUPPLEMENT, 
      ATTENDANCE_STATUS.CANCELED, 
      ATTENDANCE_STATUS.EXCLUDED
    ];
    const currentBase = formData.attendance_status || ATTENDANCE_STATUS.BEFORE;
    if (currentBase === ATTENDANCE_STATUS.SUPPLEMENT && !isSupplementTimePickerOpen) { setIsSupplementTimePickerOpen(true); return; }
    const nextStatus = statuses[(statuses.indexOf(currentBase as any) + 1) % statuses.length];
    if (nextStatus === ATTENDANCE_STATUS.SUPPLEMENT) { setIsSupplementTimePickerOpen(true); return; }
    const extraUpdate = { attendance_status: nextStatus };
    setFormData((prev: any) => ({ ...prev, ...extraUpdate }));
    handleSave(extraUpdate);
  };

  const handleSupplementTimeSelect = (hour: number) => {
    // 💡 [수정] 보강 시간 지정 시 출석 상태는 '수업전'으로 되돌리고, 시간만 moved_to_hour로 분리 저장
    const update = { attendance_status: ATTENDANCE_STATUS.BEFORE, moved_to_hour: hour };
    setFormData((prev: any) => ({ ...prev, ...update }));
    handleSave(update);
    setIsSupplementTimePickerOpen(false);
  };

  const selectFeedback = (status: StudentStatus) => {
    const presets = currentUser?.homework_presets || { 'perfect': '숙제를 아주 완벽하게 잘 해왔습니다. *^^*', 'good': '숙제를 잘 수행했습니다.', 'neutral': '숙제 수행이 보통입니다.', 'poor': '숙제가 미흡한 부분이 있습니다.', 'bad': '숙제를 거의 해오지 않았습니다.' };
    let currentNotes = formData.special_notes || '';
    const newComment = presets[status] || '';
    let updatedNotes = currentNotes;
    Object.values(presets).forEach(p => { if (p && currentNotes.includes(String(p))) updatedNotes = currentNotes.replace(String(p), newComment).trim(); });
    if (updatedNotes === currentNotes) updatedNotes = currentNotes ? `${currentNotes}\n${newComment}`.trim() : newComment;
    
    setFormData((prev: any) => ({ ...prev, status, special_notes: updatedNotes }));
    if (notesRef.current) notesRef.current.value = updatedNotes;
    handleSave({ status, special_notes: updatedNotes });
    setIsFeedbackOpen(false);
  };

  const syncTextFromData = (newJson: HomeworkItem[], field: 'classwork' | 'homework' | 'next_quiz' | 'completed_classwork') => {
    const text = newJson
      .filter(item => item.range) // 💡 range가 존재하는 항목만 텍스트 일지에 반영
      .map(item => {
        const book = masterTextbooks.find(m => m.bookcode === item.book_name);
        const cleanRange = (item.range.startsWith('p') || item.range.includes(' p')) ? item.range : `p${item.range}`;
        return `${book?.title || item.book_name} ${cleanRange}`;
      }).join('\n');
    const update = { [`${field}_json`]: newJson, [`${field}_text`]: text };
    setFormData((prev: any) => ({ ...prev, ...update }));
    const refs: any = { classwork: cwRef, homework: hwRef, next_quiz: nqRef, completed_classwork: ccwRef };
    if (refs[field]?.current) refs[field].current.value = text;
    handleSave(update);
  };

  return {
    states: {
      isHwEditorOpen, setIsHwEditorOpen, isCwEditorOpen, setIsCwEditorOpen, isCcwEditorOpen, setIsCcwEditorOpen,
      isNqEditorOpen, setIsNqEditorOpen, isTestEditorOpen, setIsTestEditorOpen, isTestModalOpen, setIsTestModalOpen,
      isFeedbackOpen, setIsFeedbackOpen, isSupplementTimePickerOpen, setIsSupplementTimePickerOpen,
      isSaving, saveStatus, formData, setFormData, rowDate
    },
    refs: { testRef, cwRef, ccwRef, hwRef, nqRef, missionRef, notesRef, tdRefs },
    handlers: {
      handleSave, handleAttendanceToggle, handleSupplementTimeSelect, selectFeedback, syncTextFromData
    }
  };
}
