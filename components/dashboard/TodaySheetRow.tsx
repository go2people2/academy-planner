'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HomeworkItem, StudentStatus, Student, TextbookOption } from '@/types/dashboard';
import HomeworkEditor from './HomeworkEditor';
import TestAnswerModal from './TestAnswerModal';
import TestEditor from './TestEditor';
import { HistoryRows } from './TodaySheetHistory';
import { TodaySheetCell } from './TodaySheetCell';

interface TodaySheetRowProps {
  student: Student;
  masterTextbooks: TextbookOption[];
  onSave: (id: string, data: any) => Promise<boolean>;
  onUpdateStudentInfo?: (id: string, field: string, value: any) => Promise<void>;
  onViewProgress: (id: string) => void;
  colWidths: Record<string, number>;
  activeColumns: any[];
  selectedDate: string;
  isHistoryExpanded: boolean;
  onToggleHistory: (id: string) => void;
  currentUser: any;
  activeCell?: { studentId: string; columnId: string } | null;
  editingCell?: { studentId: string; columnId: string } | null;
  onActiveCellChange?: (studentId: string, colId: string) => void;
  onEditingCellChange?: (studentId: string, colId: string | null) => void;
  isSelected?: boolean;
  onSelectOne?: (studentId: string, checked: boolean) => void;
  selectedRange?: any;
  isCellInRange?: (studentId: string, colId: string) => boolean;
  onCellMouseDown?: (e: React.MouseEvent, studentId: string, colId: string) => void;
  onCellMouseEnter?: (studentId: string, colId: string) => void;
}

export const TodaySheetRow = React.memo(function TodaySheetRow({ 
  student, masterTextbooks, onSave, onUpdateStudentInfo, onViewProgress, colWidths, activeColumns, 
  selectedDate, isHistoryExpanded, onToggleHistory, currentUser, activeCell, editingCell,
  onActiveCellChange, onEditingCellChange, isSelected, onSelectOne, 
  selectedRange, isCellInRange, onCellMouseDown, onCellMouseEnter
}: TodaySheetRowProps) {
  // 1. All States
  const [isHwEditorOpen, setIsHwEditorOpen] = useState(false);
  const [isCwEditorOpen, setIsCwEditorOpen] = useState(false);
  const [isNqEditorOpen, setIsNqEditorOpen] = useState(false);
  const [isTestEditorOpen, setIsTestEditorOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [rowDate, setRowDate] = useState(selectedDate);
  const [undoStack, setUndoStack] = useState<any[]>([]); 

  // 2. All Refs (Must be declared before any logic that uses them)
  const testRef = useRef<HTMLTextAreaElement>(null);
  const cwRef = useRef<HTMLTextAreaElement>(null);
  const hwRef = useRef<HTMLTextAreaElement>(null);
  const nqRef = useRef<HTMLTextAreaElement>(null);
  const missionRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const tdRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const isComposing = useRef(false);

  // 3. Helper Functions
  const getSession = useCallback((date: string) => (student.allLogs || []).find((l: any) => l.date === date), [student.allLogs]);
  const hasSession = useMemo(() => !!getSession(rowDate), [getSession, rowDate]);

  const getInitialFormData = useCallback((date: string) => {
    const isToday = date === selectedDate;
    
    // 💡 세션 데이터의 날짜가 실제로 요청된 날짜(date)와 일치하는지 엄격히 확인
    // (날짜 변경 시 이전 데이터가 잠시 보였다 사라지는 현상 방지 핵심)
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
    
    return {
      attendance_status: session?.attendance_status || '',
      status: session?.status || 'none',
      special_notes: session?.special_notes || '',
      classwork_text: session?.classwork_text || '',
      classwork_json: mergeBooks(session?.classwork_json),
      homework_text: session?.homework_text || '',
      homework_json: mergeBooks(session?.homework_json),
      next_quiz_text: session?.next_quiz_text || '',
      next_quiz_json: mergeBooks(session?.next_quiz_json),
      next_quiz_cut: session?.next_quiz_cut || 0,
      next_quiz_trial: session?.next_quiz_trial || 1,
      test_id: session?.test_id || '',
      test_score: session?.test_score || '',
      test_score_type: session?.test_score_type || 'score',
      test_cut: session?.test_cut || 0, // 💡 추가
      test_completed: session?.test_completed, // 💡 추가: 완료/미완료/없음 3상태 지원
      mission: student.recent_mission || ''
    };
  }, [student.allLogs, student.assigned_books, student.todaySession, student.recent_mission, selectedDate]);

  // 4. Form Data State
  const [formData, setFormData] = useState<any>(() => getInitialFormData(selectedDate));
  
  // 5. Derived States (Must be after formData)
  const isAbsent = useMemo(() => formData.attendance_status?.startsWith('결석'), [formData.attendance_status]);
  const isDirty = useMemo(() => {
    const initial = getInitialFormData(rowDate);
    return (
      formData.attendance_status !== initial.attendance_status ||
      formData.status !== initial.status ||
      formData.special_notes !== initial.special_notes ||
      formData.classwork_text !== initial.classwork_text ||
      formData.homework_text !== initial.homework_text ||
      formData.next_quiz_text !== initial.next_quiz_text ||
      String(formData.next_quiz_cut) !== String(initial.next_quiz_cut) ||
      formData.next_quiz_trial !== initial.next_quiz_trial ||
      formData.test_id !== initial.test_id ||
      String(formData.test_score) !== String(initial.test_score) ||
      formData.test_score_type !== initial.test_score_type ||
      String(formData.test_cut) !== String(initial.test_cut) || // 💡 추가
      formData.test_completed !== initial.test_completed || // 💡 추가
      formData.mission !== initial.mission
    );
  }, [formData, rowDate, getInitialFormData]);

  const isCompleted = hasSession && !isDirty;

  // 6. Effects
  // 💡 외부 데이터(student.todaySession)가 변경되었을 때 로컬 상태와 동기화
  useEffect(() => {
    // 현재 이 학생의 셀을 편집 중이라면 동기화하지 않음 (입력 중인 내용 보호)
    if (isSaving || (editingCell && editingCell.studentId === student.id)) return;
    
    const newData = getInitialFormData(rowDate);
    
    // 💡 변경 사항이 있을 때만 업데이트 (무한 루프 방지)
    const hasExternalChange = Object.keys(newData).some(key => 
      String(newData[key]) !== String(formData[key])
    );

    if (hasExternalChange) {
      setFormData(newData);
      if (testRef.current) testRef.current.value = newData.test_id || '';
      if (cwRef.current) cwRef.current.value = newData.classwork_text || '';
      if (hwRef.current) hwRef.current.value = newData.homework_text || '';
      if (nqRef.current) nqRef.current.value = newData.next_quiz_text || '';
      if (missionRef.current) missionRef.current.value = newData.mission || '';
      if (notesRef.current) notesRef.current.value = newData.special_notes || '';
    }
  }, [student.todaySession, student.allLogs, student.recent_mission, rowDate, getInitialFormData, isSaving, editingCell, student.id]);

  useEffect(() => {
    if (activeCell?.studentId === student.id && activeCell?.columnId) {
      const colId = activeCell.columnId;
      let targetRef: any = null;
      if (colId === 'test_id') targetRef = testRef;
      else if (colId === 'classwork') targetRef = cwRef;
      else if (colId === 'assign') targetRef = hwRef;
      else if (colId === 'next_quiz') targetRef = nqRef;
      else if (colId === 'notes') targetRef = notesRef;
      if (targetRef?.current) { targetRef.current.focus(); } 
      else if (colId === 'test_score') {
        const input = tdRefs.current[colId]?.querySelector('input');
        if (input) input.focus();
      }
    }
  }, [activeCell, student.id]);

  // 7. Event Handlers
  const pushUndo = (currentState: any) => {
    setUndoStack(prev => [JSON.parse(JSON.stringify(currentState)), ...prev].slice(0, 20));
  };

  const performUndo = () => {
    if (undoStack.length === 0) return;
    const [lastState, ...rest] = undoStack;
    setFormData(lastState);
    setUndoStack(rest);
  };

  const handleSave = useCallback(async (extraData = {}) => {
    if (isSaving) return;
    const lazyData: any = {};
    if (testRef.current) lazyData.test_id = testRef.current.value;
    if (cwRef.current) lazyData.classwork_text = cwRef.current.value;
    if (hwRef.current) lazyData.homework_text = hwRef.current.value;
    if (nqRef.current) lazyData.next_quiz_text = nqRef.current.value;
    if (missionRef.current) lazyData.mission = missionRef.current.value;
    if (notesRef.current) lazyData.special_notes = notesRef.current.value;
    const scoreInput = tdRefs.current['test_score']?.querySelector('input');
    if (scoreInput) {
      const val = scoreInput.value;
      if (val.includes('/')) {
        const [s, t] = val.split('/').map(x => x.trim());
        lazyData.test_score = s;
        lazyData.test_total_count = parseInt(t) || 0;
        lazyData.test_score_type = 'count';
      } else {
        lazyData.test_score = val;
      }
    }

    const finalData = { ...formData, ...lazyData, ...extraData, session_date: rowDate };
    const initial = getInitialFormData(rowDate);
    const hasChanged = Object.keys(finalData).some(key => {
      if (key === 'session_date') return false;
      return String((finalData as any)[key]) !== String((initial as any)[key]);
    });
    if (!hasChanged && Object.keys(extraData).length === 0) return;

    setIsSaving(true);
    setFormData(finalData);

    // 💡 미션(Mission)은 학생 정보이므로 별도로 저장
    if (finalData.mission !== initial.mission && onUpdateStudentInfo) {
      await onUpdateStudentInfo(student.id, 'recent_mission', finalData.mission);
    }

    const success = await onSave(student.id, finalData);
    setIsSaving(false);
    if (success) { 
      setSaveStatus('success'); 
      setUndoStack([]); 
      setTimeout(() => setSaveStatus('idle'), 2000); 
    } else { 
      setSaveStatus('error'); 
      setTimeout(() => setSaveStatus('idle'), 2000); 
    }
  }, [formData, rowDate, student.id, isSaving, onSave, getInitialFormData]);

  const handleAttendanceToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeCell && !editingCell) { onActiveCellChange?.(student.id, 'attendance'); return; }
    const statuses = ['출석', '결석', '지각', '보강', '기타'];
    const currentStatus = formData.attendance_status || '출석';
    const currentBase = currentStatus.split(':')[0];
    const nextIdx = (statuses.indexOf(currentBase) + 1) % statuses.length;
    const newBase = statuses[nextIdx];
    let finalStatus = newBase;
    if (currentStatus.includes(':')) finalStatus = `${newBase}:${currentStatus.split(':').pop()}`;
    pushUndo(formData);
    let extraUpdate: any = { attendance_status: finalStatus };
    if (newBase === '결석' && !formData.homework_text && student.lastSession?.homework_text) {
      const lastDate = student.lastSession.date ? student.lastSession.date.slice(5).replace('-', '.') : '';
      const dateSuffix = lastDate ? ` (${lastDate} 출석시 숙제)` : '';
      const newHwText = `${student.lastSession.homework_text}${dateSuffix}`;
      extraUpdate.homework_text = newHwText;
      extraUpdate.homework_json = student.lastSession.homework_json || [];
      if (hwRef.current) hwRef.current.value = newHwText;
    }
    const newData = { ...formData, ...extraUpdate };
    setFormData(newData);
    handleSave(newData);
  };

  const selectFeedback = (status: StudentStatus) => {
    pushUndo(formData);
    const presets = currentUser?.homework_presets || {
      'perfect': '숙제를 아주 완벽하게 잘 해왔습니다. *^^*',
      'good': '숙제를 잘 수행했습니다.',
      'neutral': '숙제 수행이 보통입니다.',
      'poor': '숙제가 미흡한 부분이 있습니다.',
      'bad': '숙제를 거의 해오지 않았습니다.'
    };
    let currentNotes = formData.special_notes || '';
    const newComment = presets[status as keyof typeof presets] || '';
    let updatedNotes = currentNotes;
    const allPresets = Object.values(presets);
    let found = false;
    for (const p of allPresets) {
      if (p && currentNotes.includes(p)) { updatedNotes = currentNotes.replace(p, newComment).trim(); found = true; break; }
    }
    if (!found) updatedNotes = currentNotes ? `${currentNotes}\n${newComment}`.trim() : newComment;
    const newData = { ...formData, status, special_notes: updatedNotes };
    setFormData(newData);
    if (notesRef.current) notesRef.current.value = updatedNotes;
    handleSave(newData);
    setIsFeedbackOpen(false);
  };

  const syncTextFromData = (newJson: HomeworkItem[], fieldPrefix: 'classwork' | 'homework' | 'next_quiz') => {
    pushUndo(formData);
    const assignedBookTitles = newJson.map(h => {
      const bookInfo = masterTextbooks.find((m: any) => m.bookcode === h.book_name) || 
                      masterTextbooks.find((m: any) => m.bookcode.toLowerCase().startsWith(h.book_name.toLowerCase())) ||
                      masterTextbooks.find((m: any) => h.book_name.toLowerCase().startsWith(m.bookcode.toLowerCase()));
      return bookInfo?.title || h.book_name;
    });
    const currentRef = fieldPrefix === 'homework' ? hwRef : fieldPrefix === 'classwork' ? cwRef : nqRef;
    const currentText = (currentRef.current?.value !== undefined) ? currentRef.current.value : (formData as any)[`${fieldPrefix}_text`] || '';
    const manualLines = currentText.split('\n').filter((l: string) => {
      const trimmed = l.trim();
      return trimmed && !assignedBookTitles.some(title => trimmed.startsWith(title));
    });
    const bookLines = newJson.filter(h => h.range).map(h => {
      const textbook = masterTextbooks.find((m: any) => m.bookcode === h.book_name) || 
                      masterTextbooks.find((m: any) => m.bookcode.toLowerCase().startsWith(h.book_name.toLowerCase())) ||
                      masterTextbooks.find((m: any) => h.book_name.toLowerCase().startsWith(m.bookcode.toLowerCase()));
      const title = textbook?.title || h.book_name;
      return `${title} ${h.range}`;
    });
    const combinedText = [...manualLines, ...bookLines].join('\n');
    const newData = { ...formData, [`${fieldPrefix}_json`]: newJson, [`${fieldPrefix}_text`]: combinedText };
    setFormData(newData);
    if (fieldPrefix === 'classwork' && cwRef.current) cwRef.current.value = combinedText;
    else if (fieldPrefix === 'homework' && hwRef.current) hwRef.current.value = combinedText;
    else if (fieldPrefix === 'next_quiz' && nqRef.current) nqRef.current.value = combinedText;
    handleSave(newData);
  };

  const handleCellInteraction = (e: React.MouseEvent, colId: string, type: 'click' | 'dblclick') => {
    if (type === 'dblclick') { onEditingCellChange?.(student.id, colId); return; }
    if (e.shiftKey) { onActiveCellChange?.(student.id, colId); onEditingCellChange?.(student.id, null); }
    else {
      if (!['select', 'action', 'date'].includes(colId)) { onActiveCellChange?.(student.id, colId); onEditingCellChange?.(student.id, colId); }
      else { onActiveCellChange?.(student.id, colId); onEditingCellChange?.(student.id, null); }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, colId: string) => {
    if (isComposing.current) return;
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && e.key === 'z') { e.preventDefault(); performUndo(); return; }
    if (isMod && e.key === 's') { e.preventDefault(); handleSave(); return; }
    if (isMod && e.key === 'b') {
      e.preventDefault();
      if (colId === 'classwork') setIsCwEditorOpen(true);
      else if (colId === 'assign') setIsHwEditorOpen(true);
      else if (colId === 'next_quiz') setIsNqEditorOpen(true);
      else if (colId === 'test_id') setIsTestEditorOpen(true);
      return;
    }
    const isEditing = editingCell?.studentId === student.id && editingCell?.columnId === colId;
    if (!isEditing && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault();
      const fieldMap: any = { 'test_id': 'test_id', 'test_score': 'test_score', 'classwork': 'classwork_text', 'assign': 'homework_text', 'next_quiz': 'next_quiz_text', 'mission': 'mission', 'notes': 'special_notes' };
      const field = fieldMap[colId];
      if (field) {
        const updatedData = { ...formData, [field]: '' };
        setFormData(updatedData);
        if (colId === 'test_id' && testRef.current) testRef.current.value = '';
        else if (colId === 'classwork' && cwRef.current) cwRef.current.value = '';
        else if (colId === 'assign' && hwRef.current) hwRef.current.value = '';
        else if (colId === 'next_quiz' && nqRef.current) nqRef.current.value = '';
        else if (colId === 'mission' && missionRef.current) missionRef.current.value = '';
        else if (colId === 'notes' && notesRef.current) notesRef.current.value = '';
        else if (colId === 'test_score') {
          const scoreInput = tdRefs.current['test_score']?.querySelector('input');
          if (scoreInput) scoreInput.value = '';
        }
        handleSave({ [field]: '' });
      }
      return;
    }
    if (!isEditing && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!['attendance', 'action', 'select', 'date'].includes(colId)) { onEditingCellChange?.(student.id, colId); return; }
    }
    if (e.key === 'Enter' && !e.altKey) {
      if (isEditing) { if (e.nativeEvent.isComposing) return; e.preventDefault(); handleSave(); }
      else { e.preventDefault(); onEditingCellChange?.(student.id, colId); }
    }
    if (e.key === 'Tab') { if (isEditing) { handleSave(); onEditingCellChange?.(student.id, null); } }
    if (e.key === 'Escape') { if (isEditing) e.preventDefault(); onEditingCellChange?.(student.id, null); tdRefs.current[colId]?.focus(); }
  };

  const handleTestSave = (result: any) => {
    pushUndo(formData);
    const updatedData = {
      ...formData,
      test_id: result.testId || formData.test_id,
      test_score: result.scoreMode === 'score' ? String(result.calculatedScore) : String(result.correctCount),
      test_score_type: result.scoreMode,
      test_total_count: result.totalCount,
      test_answers: result.answers
    };
    setFormData(updatedData);
    if (testRef.current) testRef.current.value = updatedData.test_id;
    handleSave(updatedData);
    setIsTestModalOpen(false);
  };

  const statusMap = {
    'none': { label: '-', color: 'bg-white/5 text-gray-500' },
    'perfect': { label: 'S', color: 'bg-emerald-500 text-white' },
    'good': { label: 'A', color: 'bg-blue-500 text-white' },
    'neutral': { label: 'B', color: 'bg-white/20 text-gray-400' },
    'poor': { label: 'C', color: 'bg-amber-500 text-white' },
    'bad': { label: 'F', color: 'bg-red-500 text-white' }
  };

  // 8. Render
  return (
    <>
      <tr className={`hover:bg-white/[0.04] transition-colors group ${isAbsent ? 'bg-white/[0.02]' : ''}`}>
        {activeColumns.map((col: any) => {
          const isActive = activeCell?.studentId === student.id && activeCell?.columnId === col.id;
          const isEditing = editingCell?.studentId === student.id && editingCell?.columnId === col.id;
          const isInRange = isCellInRange?.(student.id, col.id) || false;

          const styles: React.CSSProperties = {
            position: (col.id === 'name' || col.id === 'action' || col.id === 'select') ? 'sticky' : 'relative',
            left: col.id === 'select' ? 0 : (col.id === 'name' ? (colWidths['select'] || 40) : 'auto'),
            right: col.id === 'action' ? 0 : 'auto',
            zIndex: (col.id === 'name' || col.id === 'action' || col.id === 'select') ? (isActive ? 30 : 20) : (isActive ? 15 : 1),
            width: colWidths[col.id] || col.minWidth,
            minWidth: colWidths[col.id] || col.minWidth,
            backgroundColor: (
              isInRange ? '#1e3a8a50' : 
              (col.id === 'name' || col.id === 'action' || col.id === 'select') ? (
                isAbsent ? '#111111' : // 결석 시 스티키 셀 배경 (차분한 다크 그레이)
                isCompleted ? '#080a08' : '#080808'
              ) : (
                isAbsent ? '#111111' : 'transparent' // 결석 시 일반 셀 배경
              )
            ),
            padding: 0,
            verticalAlign: 'middle'
          };

          return (
            <TodaySheetCell
              key={col.id}
              col={col}
              styles={styles}
              student={student}
              formData={formData}
              isEditing={isEditing}
              isActive={isActive}
              isInRange={isInRange}
              isSelected={isSelected}
              isCompleted={isCompleted}
              saveStatus={saveStatus}
              isSaving={isSaving}
              isHistoryExpanded={isHistoryExpanded}
              displayDateShort={rowDate.slice(5).replace('-', '.')}
              statusMap={statusMap}
              testRef={testRef}
              cwRef={cwRef}
              hwRef={hwRef}
              nqRef={nqRef}
              missionRef={missionRef}
              notesRef={notesRef}
              tdRef={el => { tdRefs.current[col.id] = el; }}
              scoreInputRef={el => {}}
              onSelectOne={onSelectOne}
              onToggleHistory={onToggleHistory}
              onViewProgress={onViewProgress}
              handleCellInteraction={handleCellInteraction}
              handleKeyDown={handleKeyDown}
              onCellMouseDown={onCellMouseDown || (() => {})}
              onCellMouseEnter={onCellMouseEnter || (() => {})}
              onAttendanceClick={handleAttendanceToggle}
              onTestScoreTypeToggle={() => {
                pushUndo(formData);
                const next = formData.test_score_type === 'score' ? 'count' : 'score';
                setFormData(prev => ({ ...prev, test_score_type: next }));
                handleSave({ test_score_type: next });
              }}
              onFeedbackToggle={() => setIsFeedbackOpen(!isFeedbackOpen)}
              isFeedbackOpen={isFeedbackOpen}
              onSelectFeedback={selectFeedback}
              onCloseFeedback={() => setIsFeedbackOpen(false)}
              onOpenCwEditor={(e) => { e.stopPropagation(); setIsCwEditorOpen(true); }}
              onOpenHwEditor={(e) => { e.stopPropagation(); setIsHwEditorOpen(true); }}
              onOpenNqEditor={(e) => { e.stopPropagation(); setIsNqEditorOpen(true); }}
              onOpenTestEditor={(e) => { e.stopPropagation(); setIsTestEditorOpen(true); }}
              onOpenTestModal={(e) => { e.stopPropagation(); setIsTestModalOpen(true); }}
              onOpenPdf={(e) => { e.stopPropagation(); window.open(`/api/pdf/${formData.test_id}`, '_blank'); }}
              onExecuteTest={(e) => {
                e.stopPropagation();
                if (!formData.next_quiz_text) return;
                pushUndo(formData);
                const trial = (!formData.next_quiz_text.startsWith('✅') && formData.next_quiz_trial > 1) ? ` (${formData.next_quiz_trial}차)` : '';
                const newData = { 
                  test_id: formData.next_quiz_text.startsWith('✅') ? formData.test_id : `${formData.next_quiz_text}${trial}`, 
                  next_quiz_text: formData.next_quiz_text.startsWith('✅') ? formData.next_quiz_text : `✅ ${formData.next_quiz_text}` 
                };
                setFormData(prev => ({ ...prev, ...newData }));
                if (testRef.current) testRef.current.value = newData.test_id;
                if (nqRef.current) nqRef.current.value = newData.next_quiz_text;
                handleSave(newData);
              }}
              onSetNextQuizCut={(val) => {
                pushUndo(formData);
                setFormData(prev => ({ ...prev, next_quiz_cut: val }));
                handleSave({ next_quiz_cut: val });
              }}
              onSetTodayTestCut={(val) => {
                pushUndo(formData);
                setFormData(prev => ({ ...prev, test_cut: val }));
                handleSave({ test_cut: val });
              }}
              onSetNextQuizTrial={(num) => {
                pushUndo(formData);
                setFormData(prev => ({ ...prev, next_quiz_trial: num }));
                handleSave({ next_quiz_trial: num });
              }}
              onSave={() => handleSave()}
            />
          );
        })}
      </tr>

      <HistoryRows student={student} activeColumns={activeColumns} colWidths={colWidths} isExpanded={isHistoryExpanded} />

      <tr style={{ display: 'none' }}>
        <td colSpan={activeColumns.length}>
          <AnimatePresence>
            {isCwEditorOpen && <HomeworkEditor title="Smart Classwork Editor" homeworkJson={formData.classwork_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'classwork')} onClose={() => setIsCwEditorOpen(false)} />}
            {isHwEditorOpen && <HomeworkEditor title="Smart Homework Editor" homeworkJson={formData.homework_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'homework')} onClose={() => setIsHwEditorOpen(false)} />}
            {isNqEditorOpen && <HomeworkEditor title="Next Quiz Range Editor" homeworkJson={formData.next_quiz_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'next_quiz')} onClose={() => setIsNqEditorOpen(false)} />}
            {isTestEditorOpen && <TestEditor testData={formData.test_id} onUpdate={(formattedText, averageScore) => { const newData = { ...formData, test_id: formattedText, test_score: averageScore !== null ? String(averageScore) : formData.test_score }; setFormData(newData); if (testRef.current) testRef.current.value = formattedText; handleSave(newData); }} onClose={() => setIsTestEditorOpen(false)} />}
            {isTestModalOpen && <TestAnswerModal testId={formData.test_id} studentName={student.name} onClose={() => setIsTestModalOpen(false)} onSave={handleTestSave} />}
          </AnimatePresence>
        </td>
      </tr>
    </>
  );
});
