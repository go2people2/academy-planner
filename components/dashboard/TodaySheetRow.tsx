'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Clock, Check, History as HistoryIcon, MoreHorizontal, Wand2, ClipboardList, LogOut, CalendarClock, RotateCcw, AlertCircle, FileText, Circle } from 'lucide-react';
import { HomeworkItem, StudentStatus, Student, TextbookOption } from '@/types/dashboard';
import HomeworkEditor from './HomeworkEditor';
import TestAnswerModal from './TestAnswerModal';
import TestEditor from './TestEditor';
import { HistoryRows } from './TodaySheetHistory';
import { TodaySheetCell } from './TodaySheetCell';
import { getDayOfWeek } from '@/lib/utils';

interface TodaySheetRowProps {
  student: Student;
  masterTextbooks: TextbookOption[];
  onSave: (id: string, data: any) => Promise<boolean>;
  onUpdateStudentInfo?: (id: string, field: string, value: any) => Promise<void>;
  onViewProgress: (id: string) => void;
  onSelectStudent?: (id: string) => void;
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
  rowIndex?: number;
}

export const TodaySheetRow = React.memo(function TodaySheetRow({ 
  student, masterTextbooks, onSave, onUpdateStudentInfo, onViewProgress, onSelectStudent, colWidths, activeColumns, 
  selectedDate, isHistoryExpanded, onToggleHistory, currentUser, activeCell, editingCell,
  onActiveCellChange, onEditingCellChange, isSelected, onSelectOne, 
  selectedRange, isCellInRange, onCellMouseDown, onCellMouseEnter,
  rowIndex
}: TodaySheetRowProps) {
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

  // 3. Helper Functions
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
      attendance_status: session?.attendance_status || '',
      status: session?.status || 'none',
      special_notes: session?.special_notes || '',
      classwork_text: session?.classwork_text || '',
      classwork_json: mergeBooks(session?.classwork_json),
      completed_classwork_text: session?.completed_classwork_text || '',
      completed_classwork_json: mergeBooks(session?.completed_classwork_json),
      homework_text: session?.homework_text || '',
      homework_json: mergeBooks(session?.homework_json),
      next_quiz_text: session?.next_quiz_text || '',
      next_quiz_json: mergeBooks(session?.next_quiz_json),
      next_quiz_cut: session?.next_quiz_cut || 0,
      next_quiz_trial: session?.next_quiz_trial || 1,
      test_id: session?.test_id || '',
      test_score: session?.test_score || '',
      test_score_type: session?.test_score_type || 'score',
      test_cut: session?.test_cut || 0,
      test_completed: session?.test_completed,
      mission: student.recent_mission || '',
      isTodayClassDay
    };
  }, [student.allLogs, student.assigned_books, student.todaySession, student.recent_mission, student.class_days, selectedDate]);

  const [formData, setFormData] = useState<any>(() => getInitialFormData(selectedDate));
  
  // 💡 [단순화 재설계] 외부 데이터 동기화 로직
  // 입력 중이거나 저장 중일 때는 절대로 외부 데이터가 덮어쓰지 못하도록 엄격히 제한
  useEffect(() => {
    const isUserEditing = activeCell?.studentId === student.id || editingCell?.studentId === student.id;
    const isDateChanged = rowDate !== selectedDate;

    if (isDateChanged) {
      const newData = getInitialFormData(selectedDate);
      setFormData(newData);
      setRowDate(selectedDate);
      return;
    }

    // 오직 편집 중이 아니고 저장 중이 아닐 때만 부모 데이터 수용
    if (!isUserEditing && !isSaving) {
      const newData = getInitialFormData(selectedDate);
      setFormData(newData);
    }
  }, [selectedDate, student.todaySession, student.id, isSaving, activeCell?.studentId, editingCell?.studentId, getInitialFormData, rowDate]);

  // 💡 [단순화 재설계] 저장 로직: 오직 엔터/Blur 시점에만 실행 (디바운스 제거됨)
  const handleSave = useCallback(async (extraData: any = {}, sourceField?: string, passedValue?: string) => {
    if (isSaving) return;

    const lazyData: any = {};
    
    // 💡 [안정화 핵심] Ref가 이미 죽었을 경우를 대비해 직접 넘겨받은 passedValue를 최우선으로 사용
    if (testRef.current) lazyData.test_id = testRef.current.value;
    if (cwRef.current) lazyData.classwork_text = cwRef.current.value;
    if (ccwRef.current) lazyData.completed_classwork_text = ccwRef.current.value;
    if (hwRef.current) lazyData.homework_text = hwRef.current.value;
    if (nqRef.current) lazyData.next_quiz_text = nqRef.current.value;
    if (missionRef.current) lazyData.mission = missionRef.current.value;
    if (notesRef.current) lazyData.special_notes = notesRef.current.value;

    // passedValue가 있고 sourceField가 매칭된다면 lazyData를 덮어씀 (Ref가 Null일 때의 보험)
    if (passedValue !== undefined && sourceField) {
      const fieldMap: any = {
        test_id: 'test_id',
        classwork: 'classwork_text',
        completed_classwork: 'completed_classwork_text',
        assign: 'homework_text',
        next_quiz: 'next_quiz_text',
        mission: 'mission',
        notes: 'special_notes',
        test_score: 'test_score'
      };
      const dbKey = fieldMap[sourceField];
      if (dbKey) lazyData[dbKey] = passedValue;
    }
    
    const scoreInput = tdRefs.current['test_score']?.querySelector('input');
    if (scoreInput) lazyData.test_score = scoreInput.value;
    // test_score 역시 passedValue가 있다면 우선함
    if (sourceField === 'test_score' && passedValue !== undefined) lazyData.test_score = passedValue;

    const finalData = { ...formData, ...lazyData, ...extraData };
    
    // 변경 사항이 없으면 중단
    const initial = getInitialFormData(rowDate);
    const hasChange = Object.keys({ ...lazyData, ...extraData }).some(key => 
      String(finalData[key] || '') !== String(initial[key] || '')
    );
    if (!hasChange && Object.keys(extraData).length === 0) return;

    setIsSaving(true);
    setFormData(finalData);

    // 학생 정보(미션 등) 업데이트가 필요한 경우
    if (finalData.mission !== student.recent_mission && onUpdateStudentInfo) {
      await onUpdateStudentInfo(student.id, 'recent_mission', finalData.mission);
    }

    const success = await onSave(student.id, finalData);
    setIsSaving(false);
    
    if (success) {
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [formData, rowDate, student.id, student.recent_mission, isSaving, onSave, onUpdateStudentInfo, getInitialFormData]);

  const handleAttendanceToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const statuses = ['', '출석', '결석', '지각', '보강', '수업취소', '수업제외'];
    const currentBase = (formData.attendance_status || '').split(':')[0] || '';
    if (currentBase === '보강' && !isSupplementTimePickerOpen) { setIsSupplementTimePickerOpen(true); return; }
    const nextStatus = statuses[(statuses.indexOf(currentBase) + 1) % statuses.length];
    if (nextStatus === '보강') { setIsSupplementTimePickerOpen(true); return; }
    
    const extraUpdate: any = { attendance_status: nextStatus };
    setFormData(prev => ({ ...prev, ...extraUpdate }));
    handleSave(extraUpdate);
  };

  const handleSupplementTimeSelect = (hour: number) => {
    const finalStatus = `보강:${hour}`;
    setFormData(prev => ({ ...prev, attendance_status: finalStatus }));
    handleSave({ attendance_status: finalStatus });
    setIsSupplementTimePickerOpen(false);
  };

  const selectFeedback = (status: StudentStatus) => {
    const presets = currentUser?.homework_presets || { 'perfect': '숙제를 아주 완벽하게 잘 해왔습니다. *^^*', 'good': '숙제를 잘 수행했습니다.', 'neutral': '숙제 수행이 보통입니다.', 'poor': '숙제가 미흡한 부분이 있습니다.', 'bad': '숙제를 거의 해오지 않았습니다.' };
    let currentNotes = formData.special_notes || '';
    const newComment = presets[status] || '';
    let updatedNotes = currentNotes;
    Object.values(presets).forEach(p => { if (p && currentNotes.includes(String(p))) updatedNotes = currentNotes.replace(String(p), newComment).trim(); });
    if (updatedNotes === currentNotes) updatedNotes = currentNotes ? `${currentNotes}\n${newComment}`.trim() : newComment;
    
    setFormData(prev => ({ ...prev, status, special_notes: updatedNotes }));
    if (notesRef.current) notesRef.current.value = updatedNotes;
    handleSave({ status, special_notes: updatedNotes });
    setIsFeedbackOpen(false);
  };

  const syncTextFromData = (newJson: HomeworkItem[], field: 'classwork' | 'homework' | 'next_quiz' | 'completed_classwork') => {
    const text = newJson.map(item => `${item.book_name} p${item.range}`).join('\n');
    const update = { [`${field}_json`]: newJson, [`${field}_text`]: text };
    setFormData(prev => ({ ...prev, ...update }));
    const refs: any = { classwork: cwRef, homework: hwRef, next_quiz: nqRef, completed_classwork: ccwRef };
    if (refs[field]?.current) refs[field].current.value = text;
    handleSave(update);
  };

  return (
    <>
      <tr className={`group/row transition-all duration-300 border-b border-white/5 ${isSelected ? 'bg-blue-600/10' : (!!(student.todaySession?.id && student.todaySession.id !== 'temp') ? 'bg-white/[0.01]' : 'bg-transparent')} hover:bg-white/[0.03]`}>
        {activeColumns.map((col) => {
          const isSticky = col.id === 'name' || col.id === 'action' || col.id === 'select';
          const isActive = activeCell?.studentId === student.id && activeCell?.columnId === col.id;
          const isEditing = editingCell?.studentId === student.id && editingCell?.columnId === col.id;
          return (
            <TodaySheetCell
              key={col.id}
              col={col}
              styles={{
                width: colWidths[col.id] || col.minWidth,
                position: isSticky ? 'sticky' : 'relative',
                left: col.id === 'select' ? 0 : (col.id === 'name' ? (colWidths['select'] || 40) - 1 : 'auto'),
                right: col.id === 'action' ? 0 : 'auto',
                zIndex: isSticky ? 30 : (col.id === 'notes' ? 25 : 10),
                backgroundColor: isSticky ? '#080808' : 'transparent',
                padding: 0,
                verticalAlign: 'middle'
              }}
              student={student}
              formData={formData}
              isEditing={isEditing}
              isActive={isActive}
              isInRange={isCellInRange?.(student.id, col.id) || false}
              isSelected={isSelected}
              isCompleted={!!(student.todaySession?.id && student.todaySession.id !== 'temp')}
              saveStatus={saveStatus}
              isSaving={isSaving}
              isHistoryExpanded={isHistoryExpanded}
              displayDateShort={rowDate.slice(5).replace('-', '.')}
              statusMap={{ perfect: '완벽', good: '우수', neutral: '보통', poor: '미흡', bad: '경고', none: '미정' }}
              testRef={testRef}
              cwRef={cwRef}
              ccwRef={ccwRef}
              hwRef={hwRef}
              nqRef={nqRef}
              missionRef={missionRef}
              notesRef={notesRef}
              tdRef={el => { tdRefs.current[col.id] = el; }}
              onSelectOne={onSelectOne}
              onToggleHistory={onToggleHistory}
              onViewProgress={onViewProgress}
              onViewDetail={onSelectStudent}
              handleCellInteraction={(e, cid, type) => { if (type === 'click') onActiveCellChange?.(student.id, cid); else onEditingCellChange?.(student.id, cid); }}
              handleKeyDown={(e, cid) => { if (e.key === 'Escape') { onEditingCellChange?.(student.id, null); tdRefs.current[cid]?.focus(); } }}
              onCellMouseDown={onCellMouseDown || (() => {})}
              onCellMouseEnter={onCellMouseEnter || (() => {})}
              onAttendanceClick={handleAttendanceToggle}
              onTestScoreTypeToggle={() => {
                const next = formData.test_score_type === 'score' ? 'count' : 'score';
                setFormData(prev => ({ ...prev, test_score_type: next }));
                handleSave({ test_score_type: next });
              }}
              onFeedbackToggle={() => setIsFeedbackOpen(!isFeedbackOpen)}
              isFeedbackOpen={isFeedbackOpen}
              onSelectFeedback={selectFeedback}
              onCloseFeedback={() => setIsFeedbackOpen(false)}
              onOpenCwEditor={(e) => { e.stopPropagation(); setIsCwEditorOpen(true); }}
              onOpenCcwEditor={(e) => { e.stopPropagation(); setIsCcwEditorOpen(true); }}
              onOpenHwEditor={(e) => { e.stopPropagation(); setIsHwEditorOpen(true); }}
              onOpenNqEditor={(e) => { e.stopPropagation(); setIsNqEditorOpen(true); }}
              onOpenTestEditor={(e) => { e.stopPropagation(); setIsTestEditorOpen(true); }}
              onOpenTestModal={(e) => { e.stopPropagation(); setIsTestModalOpen(true); }}
              onOpenPdf={(e) => { e.stopPropagation(); window.open(`/api/pdf/${formData.test_id}`, '_blank'); }}
              onExecuteTest={(e) => {
                e.stopPropagation();
                if (!formData.next_quiz_text) return;
                const trial = (!formData.next_quiz_text.startsWith('✅') && formData.next_quiz_trial > 1) ? ` (${formData.next_quiz_trial}차)` : '';
                const newData = { test_id: formData.next_quiz_text.startsWith('✅') ? formData.test_id : `${formData.next_quiz_text}${trial}`, next_quiz_text: formData.next_quiz_text.startsWith('✅') ? formData.next_quiz_text : `✅ ${formData.next_quiz_text}` };
                setFormData(prev => ({ ...prev, ...newData }));
                handleSave(newData);
              }}
              onSetNextQuizCut={(val) => { setFormData(prev => ({ ...prev, next_quiz_cut: val })); handleSave({ next_quiz_cut: val }, 'next_quiz_cut'); }}
              onSetTodayTestCut={(val) => { setFormData(prev => ({ ...prev, test_cut: val })); handleSave({ test_cut: val }, 'test_cut'); }}
              onSetNextQuizTrial={(num) => { setFormData(prev => ({ ...prev, next_quiz_trial: num })); handleSave({ next_quiz_trial: num }, 'next_quiz_trial'); }}
              onSave={(data, directValue) => {
                if (typeof data === 'string') handleSave({}, data, directValue); // colId, value
                else handleSave(data || {}, col.id, directValue); // extraData, colId, value
              }}
              onInputChange={() => {}} // 💡 자동 저장 제거
              rowIndex={rowIndex}
            />
          );
        })}
      </tr>

      <HistoryRows student={student} activeColumns={activeColumns} colWidths={colWidths} isExpanded={isHistoryExpanded} />

      <tr style={{ display: 'none' }}>
        <td colSpan={activeColumns.length}>
          <AnimatePresence>
            {isCwEditorOpen && <HomeworkEditor title="Smart Classwork Editor" homeworkJson={formData.classwork_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'classwork')} onClose={() => setIsCwEditorOpen(false)} />}
            {isCcwEditorOpen && <HomeworkEditor title="Smart Completed Classwork Editor" homeworkJson={formData.completed_classwork_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'completed_classwork')} onClose={() => setIsCcwEditorOpen(false)} />}
            {isHwEditorOpen && <HomeworkEditor title="Smart Homework Editor" homeworkJson={formData.homework_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'homework')} onClose={() => setIsHwEditorOpen(false)} />}
            {isNqEditorOpen && <HomeworkEditor title="Next Quiz Range Editor" homeworkJson={formData.next_quiz_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'next_quiz')} onClose={() => setIsNqEditorOpen(false)} />}
            {isTestEditorOpen && <TestEditor testData={formData.test_id} onUpdate={(formattedText, averageScore) => { const newData = { ...formData, test_id: formattedText, test_score: averageScore !== null ? String(averageScore) : formData.test_score }; setFormData(prev => ({ ...prev, ...newData })); handleSave(newData); }} onClose={() => setIsTestEditorOpen(false)} />}
            {isTestModalOpen && <TestAnswerModal testId={formData.test_id} studentName={student.name} onClose={() => setIsTestModalOpen(false)} onSave={(res) => { const newData = { ...formData, test_score: String(res.score || ''), test_completed: res.completed }; setFormData(prev => ({ ...prev, ...newData })); handleSave({ test_score: newData.test_score, test_completed: res.completed }); setIsTestModalOpen(false); }} />}
          </AnimatePresence>
        </td>
      </tr>

      {isSupplementTimePickerOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-[#0a0a0a] border border-blue-500/30 rounded-2xl shadow-[0_0_50px_rgba(37,99,235,0.2)] p-6 w-full max-w-sm text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 shadow-lg"><Clock size={20} /></div>
              <div className="text-left">
                <h3 className="text-lg font-black text-white leading-none">{student.name} 보강 시간</h3>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1.5">Select Session Time</p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(h => (
                <button key={h} onClick={() => handleSupplementTimeSelect(h)} className="py-3 rounded-lg bg-white/5 border border-white/10 text-xs font-black text-white hover:bg-blue-600 hover:border-blue-400 transition-all shadow-md group">
                  <span className="opacity-60 group-hover:opacity-100">{h >= 12 ? (h === 12 ? '12p' : `${h-12}p`) : `${h}a`}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setIsSupplementTimePickerOpen(false)} className="mt-6 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all flex items-center justify-center gap-2">
              <X size={14} /> 취소
            </button>
          </motion.div>
        </div>,
        document.body
      )}
    </>
  );
});
