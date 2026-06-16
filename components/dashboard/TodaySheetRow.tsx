'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Clock } from 'lucide-react';
import { Student, TextbookOption } from '@/types/dashboard';
import HomeworkEditor from './HomeworkEditor';
import TestAnswerModal from './TestAnswerModal';
import TestEditor from './TestEditor';
import { HistoryRows } from './TodaySheetHistory';
import { TodaySheetCell } from './todaySheet/TodaySheetCell';
import { useTodaySheetRowLogic } from './hooks/useTodaySheetRowLogic';

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
  academyInfo?: any;
  activeCell?: { studentId: string; columnId: string } | null;
  editingCell?: { studentId: string; columnId: string } | null;
  onActiveCellChange?: (studentId: string, colId: string) => void;
  onEditingCellChange?: (studentId: string, colId: string | null) => void;
  isSelected?: boolean;
  onSelectOne?: (studentId: string, checked: boolean, shiftKey?: boolean) => void;
  selectedRange?: any;
  isCellInRange?: (studentId: string, colId: string) => boolean;
  onCellMouseDown?: (e: React.MouseEvent, studentId: string, colId: string) => void;
  onCellMouseEnter?: (studentId: string, colId: string) => void;
  rowIndex?: number;
  isFirstInTimeSection?: boolean;
  timeSectionLabel?: string;
  isScrolled?: boolean;
}

/**
 * 💡 [리팩토링] TodaySheetRow: 로직을 커스텀 훅으로 분리하고 UI만 담당하도록 개선
 */
export const TodaySheetRow = React.memo(function TodaySheetRow(props: TodaySheetRowProps) {
  const {
    student, masterTextbooks, onViewProgress, onSelectStudent, colWidths, activeColumns, 
    selectedDate, isHistoryExpanded, onToggleHistory, activeCell, editingCell,
    onActiveCellChange, onEditingCellChange, isSelected, onSelectOne, 
    selectedRange, isCellInRange, onCellMouseDown, onCellMouseEnter,
    rowIndex, currentUser, academyInfo, isFirstInTimeSection, timeSectionLabel
  } = props;

  // 💡 단축어 및 트리거 기호 추출
  const isMasterAdmin = currentUser?.id === 'admin';
  const currentPresets = isMasterAdmin 
    ? (academyInfo?.operation_settings?.default_homework_presets || {}) 
    : (currentUser?.homework_presets || {});
  
  const snippets = React.useMemo(() => {
    const arr = currentPresets.snippets || [];
    const result = [...arr];
    while (result.length < 10) {
      result.push('');
    }
    return result.slice(0, 10);
  }, [currentPresets.snippets]);

  const snippetTrigger = currentPresets.snippet_trigger || ';';

  // 1. 커스텀 훅 호출 (모든 상태와 핸들러 포함)
  const { states, refs, handlers } = useTodaySheetRowLogic({
    student, masterTextbooks, onSave: props.onSave, onUpdateStudentInfo: props.onUpdateStudentInfo, 
    selectedDate, activeCell, editingCell, currentUser: props.currentUser
  });

  const {
    isHwEditorOpen, setIsHwEditorOpen, isCwEditorOpen, setIsCwEditorOpen, isCcwEditorOpen, setIsCcwEditorOpen,
    isNqEditorOpen, setIsNqEditorOpen, isTestEditorOpen, setIsTestEditorOpen, isTestModalOpen, setIsTestModalOpen,
    isFeedbackOpen, setIsFeedbackOpen, isSupplementTimePickerOpen, setIsSupplementTimePickerOpen,
    isSaving, saveStatus, formData, rowDate
  } = states;
  const {
    handleSave, handleAttendanceToggle, handleSupplementTimeSelect, selectFeedback, syncTextFromData
  } = handlers;

  // 💡 action 컬럼을 제외한 실질적인 마지막 데이터 컬럼 판별
  const lastDataColumnId = React.useMemo(() => {
    const dataCols = activeColumns.filter((c: any) => c.id !== 'action');
    return dataCols.length > 0 ? dataCols[dataCols.length - 1].id : null;
  }, [activeColumns]);

  // 💡 교재 Keep 처리 핸들러
  const handleToggleKeepBook = async (bookCode: string, isKeep: boolean) => {
    if (!props.onUpdateStudentInfo || !student) return;
    const newBookCourses = { ...(student.book_courses || {}) };
    const currentVal = newBookCourses[bookCode] || '';
    if (isKeep) {
      if (!currentVal.endsWith('-keep')) {
        newBookCourses[bookCode] = currentVal ? `${currentVal}-keep` : '-keep';
      }
    } else {
      newBookCourses[bookCode] = currentVal.replace('-keep', '');
    }
    await props.onUpdateStudentInfo(student.id, 'book_courses', newBookCourses);
  };

  return (
    <>
      <tr className={`group/row transition-all duration-300 border-b border-white/10 ${
        isSelected 
          ? 'bg-[#0f172a] hover:bg-[#1e293b]' // 투명도 없는 진한 남색
          : (rowIndex !== undefined && rowIndex % 2 !== 0)
            ? 'bg-[#1c1c1e] hover:bg-[#2a2a2d]' // 홀수 행
            : 'bg-black hover:bg-[#111111]' // 짝수 행
      }`}>
        {activeColumns.map((col) => {
          const isSticky = col.id === 'name' || col.id === 'tools' || col.id === 'action' || col.id === 'select';
          const isLastDataCol = col.id === lastDataColumnId;

          let leftOffset: string | number = 'auto';
          if (col.id === 'select') leftOffset = 0;
          else if (col.id === 'name') leftOffset = (colWidths['select'] || 40) - 1;
          else if (col.id === 'tools') leftOffset = (colWidths['select'] || 40) + (colWidths['name'] || 120) - 2;

          return (
            <TodaySheetCell
              key={col.id}
              col={col}
              snippets={snippets}
              snippetTrigger={snippetTrigger}
              isFirstInTimeSection={isFirstInTimeSection}
              timeSectionLabel={timeSectionLabel}
              testPresets={academyInfo?.operation_settings?.test_presets || []}
              styles={{
                width: isLastDataCol ? 'auto' : (colWidths[col.id] || col.minWidth),
                minWidth: colWidths[col.id] || col.minWidth,
                position: isSticky ? 'sticky' : 'relative',
                left: leftOffset,
                right: col.id === 'action' ? 0 : 'auto',
                zIndex: isSticky ? (rowIndex === 0 && !props.isScrolled && (col.id === 'name' || col.id === 'tools') ? 60 : 30) : (col.id === 'notes' ? 25 : 10),
                backgroundColor: isSticky ? 'inherit' : 'transparent',
                padding: 0,
                verticalAlign: 'middle'
              }}
              student={student}
              formData={formData}
              isEditing={editingCell?.studentId === student.id && editingCell?.columnId === col.id}
              isActive={activeCell?.studentId === student.id && activeCell?.columnId === col.id}
              isInRange={isCellInRange?.(student.id, col.id) || false}
              isSelected={isSelected}
              isCompleted={!!(student.todaySession?.id && student.todaySession.id !== 'temp')}
              saveStatus={saveStatus}
              isSaving={isSaving}
              isHistoryExpanded={isHistoryExpanded}
              displayDateShort={rowDate.slice(5).replace('-', '.')}
              statusMap={{
                'none': { label: '↺', color: 'bg-gray-800 text-gray-300 hover:bg-gray-700' },
                'perfect': { label: 'S', color: 'bg-emerald-500 text-white' },
                'good': { label: 'A', color: 'bg-blue-500 text-white' },
                'neutral': { label: 'B', color: 'bg-white/20 text-gray-400' },
                'poor': { label: 'C', color: 'bg-amber-500 text-white' },
                'bad': { label: 'F', color: 'bg-red-500 text-white' }
              }}
              {...refs}
              tdRef={el => { refs.tdRefs.current[col.id] = el; }}
              onSelectOne={onSelectOne}
              onToggleHistory={onToggleHistory}
              onViewProgress={onViewProgress}
              onViewDetail={onSelectStudent}
              onApplyTestPreset={(preset: any, cid: 'test_id' | 'next_quiz') => {
                states.setFormData((prev: any) => {
                  const updates: any = {};
                  if (cid === 'test_id') {
                    const existing = prev.test_id ? prev.test_id.trim() : '';
                    updates.test_id = existing ? `${existing} ${preset.name}` : preset.name;
                    updates.test_cut = preset.default_cut || 0;
                    updates.test_score_type = preset.type;
                    if (preset.type === 'count') {
                      updates.test_total_count = preset.max || 0;
                    }
                  } else if (cid === 'next_quiz') {
                    const existing = prev.next_quiz_text ? prev.next_quiz_text.trim() : '';
                    updates.next_quiz_text = existing ? `${existing} ${preset.name}` : preset.name;
                    updates.next_quiz_cut = preset.default_cut || 0;
                  }
                  
                  // 로컬 상태 즉시 업데이트 및 서버 저장 요청
                  handleSave(updates);
                  return { ...prev, ...updates };
                });
                
                onEditingCellChange?.(student.id, null);
                if (refs.tdRefs.current[cid]) {
                  refs.tdRefs.current[cid]?.focus();
                }
              }}
              handleCellInteraction={(e, cid, type) => { if (type === 'click') onActiveCellChange?.(student.id, cid); else onEditingCellChange?.(student.id, cid); }}
              handleKeyDown={(e, cid) => { if (e.key === 'Escape') { onEditingCellChange?.(student.id, null); refs.tdRefs.current[cid]?.focus(); } }}
              onCellMouseDown={onCellMouseDown || (() => {})}
              onCellMouseEnter={onCellMouseEnter || (() => {})}
              onAttendanceClick={handleAttendanceToggle}
              onTestScoreTypeToggle={() => {
                const next = formData.test_score_type === 'score' ? 'count' : 'score';
                states.setFormData((prev: any) => ({ ...prev, test_score_type: next }));
                handleSave({ test_score_type: next });
              }}
              onFeedbackToggle={() => setIsFeedbackOpen(!isFeedbackOpen)}
              isFeedbackOpen={isFeedbackOpen}
              onSelectFeedback={selectFeedback}
              onCloseFeedback={() => setIsFeedbackOpen(false)}
              onOpenCwEditor={(e) => { e?.stopPropagation(); setIsCwEditorOpen(true); }}
              onOpenCcwEditor={(e) => { e?.stopPropagation(); setIsCcwEditorOpen(true); }}
              onOpenHwEditor={(e) => { e?.stopPropagation(); setIsHwEditorOpen(true); }}
              onOpenNqEditor={(e) => { e?.stopPropagation(); setIsNqEditorOpen(true); }}
              onOpenTestEditor={(e) => { e?.stopPropagation(); setIsTestEditorOpen(true); }}
              onOpenTestModal={(e) => { e?.stopPropagation(); setIsTestModalOpen(true); }}
              onOpenPdf={(e) => { e?.stopPropagation(); window.open(`/api/pdf/${formData.test_id}`, '_blank'); }}
              onExecuteTest={(e) => {
                e.stopPropagation();
                if (!formData.next_quiz_text) return;
                const trial = (!formData.next_quiz_text.startsWith('✅') && formData.next_quiz_trial > 1) ? ` (${formData.next_quiz_trial}차)` : '';
                const newData = { test_id: formData.next_quiz_text.startsWith('✅') ? formData.test_id : `${formData.next_quiz_text}${trial}`, next_quiz_text: formData.next_quiz_text.startsWith('✅') ? formData.next_quiz_text : `✅ ${formData.next_quiz_text}` };
                states.setFormData((prev: any) => ({ ...prev, ...newData }));
                handleSave(newData);
              }}
              onSetNextQuizCut={(val) => { states.setFormData((prev: any) => ({ ...prev, next_quiz_cut: val })); handleSave({ next_quiz_cut: val }, 'next_quiz_cut'); }}
              onSetTodayTestCut={(val) => { states.setFormData((prev: any) => ({ ...prev, test_cut: val })); handleSave({ test_cut: val }, 'test_cut'); }}
              onSetNextQuizTrial={(num) => { states.setFormData((prev: any) => ({ ...prev, next_quiz_trial: num })); handleSave({ next_quiz_trial: num }, 'next_quiz_trial'); }}
              onSave={(data, directValue) => {
                if (typeof data === 'string') handleSave(data, directValue);
                else handleSave(data || {}, col.id, directValue);
              }}
              onInputChange={() => {}} 
              rowIndex={rowIndex}
            />
          );
        })}
      </tr>

      <HistoryRows student={student} activeColumns={activeColumns} colWidths={colWidths} isExpanded={isHistoryExpanded} />

      {/* Editors Container (Invisible row) */}
      <tr style={{ display: 'none' }}>
        <td colSpan={activeColumns.length}>
          <AnimatePresence>
            {isCwEditorOpen && <HomeworkEditor title="오늘 할 일 교재 입력" student={student} homeworkJson={formData.classwork_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'classwork')} onToggleKeepBook={handleToggleKeepBook} onClose={() => setIsCwEditorOpen(false)} />}
            {isCcwEditorOpen && <HomeworkEditor title="수행 진도 교재 입력" student={student} homeworkJson={formData.completed_classwork_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'completed_classwork')} onToggleKeepBook={handleToggleKeepBook} onClose={() => setIsCcwEditorOpen(false)} />}
            {isHwEditorOpen && <HomeworkEditor title="오늘 숙제 교재 입력" student={student} homeworkJson={formData.homework_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'homework')} onToggleKeepBook={handleToggleKeepBook} onClose={() => setIsHwEditorOpen(false)} />}
            {isNqEditorOpen && <HomeworkEditor title="다음 테스트 교재 입력" student={student} homeworkJson={formData.next_quiz_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'next_quiz')} onToggleKeepBook={handleToggleKeepBook} onClose={() => setIsNqEditorOpen(false)} />}
            {isTestEditorOpen && <TestEditor testData={formData.test_id} onUpdate={(formattedText, averageScore) => { const newData = { ...formData, test_id: formattedText, test_score: averageScore !== null ? String(averageScore) : formData.test_score }; states.setFormData((prev: any) => ({ ...prev, ...newData })); handleSave(newData); }} onClose={() => setIsTestEditorOpen(false)} />}
            {isTestModalOpen && <TestAnswerModal testId={formData.test_id} studentName={student.name} onClose={() => setIsTestModalOpen(false)} onSave={(res) => { const newData = { ...formData, test_score: String(res.score || ''), test_completed: res.completed }; states.setFormData((prev: any) => ({ ...prev, ...newData })); handleSave({ test_score: newData.test_score, test_completed: res.completed }); setIsTestModalOpen(false); }} />}
          </AnimatePresence>
        </td>
      </tr>

      {/* Supplement Time Picker Portal */}
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
