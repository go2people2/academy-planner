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

/**
 * 💡 [리팩토링] TodaySheetRow: 로직을 커스텀 훅으로 분리하고 UI만 담당하도록 개선
 */
export const TodaySheetRow = React.memo(function TodaySheetRow(props: TodaySheetRowProps) {
  const {
    student, masterTextbooks, onViewProgress, onSelectStudent, colWidths, activeColumns, 
    selectedDate, isHistoryExpanded, onToggleHistory, activeCell, editingCell,
    onActiveCellChange, onEditingCellChange, isSelected, onSelectOne, 
    selectedRange, isCellInRange, onCellMouseDown, onCellMouseEnter,
    rowIndex
  } = props;

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

  return (
    <>
      <tr className={`group/row transition-all duration-300 border-b border-white/5 ${isSelected ? 'bg-blue-600/10' : (!!(student.todaySession?.id && student.todaySession.id !== 'temp') ? 'bg-white/[0.01]' : 'bg-transparent')} hover:bg-white/[0.03]`}>
        {activeColumns.map((col) => {
          const isSticky = col.id === 'name' || col.id === 'action' || col.id === 'select';
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
              isEditing={editingCell?.studentId === student.id && editingCell?.columnId === col.id}
              isActive={activeCell?.studentId === student.id && activeCell?.columnId === col.id}
              isInRange={isCellInRange?.(student.id, col.id) || false}
              isSelected={isSelected}
              isCompleted={!!(student.todaySession?.id && student.todaySession.id !== 'temp')}
              saveStatus={saveStatus}
              isSaving={isSaving}
              isHistoryExpanded={isHistoryExpanded}
              displayDateShort={rowDate.slice(5).replace('-', '.')}
              statusMap={{ perfect: '완벽', good: '우수', neutral: '보통', poor: '미흡', bad: '경고', none: '미정' }}
              {...refs}
              tdRef={el => { refs.tdRefs.current[col.id] = el; }}
              onSelectOne={onSelectOne}
              onToggleHistory={onToggleHistory}
              onViewProgress={onViewProgress}
              onViewDetail={onSelectStudent}
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
            {isCwEditorOpen && <HomeworkEditor title="Smart Classwork Editor" homeworkJson={formData.classwork_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'classwork')} onClose={() => setIsCwEditorOpen(false)} />}
            {isCcwEditorOpen && <HomeworkEditor title="Smart Completed Classwork Editor" homeworkJson={formData.completed_classwork_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'completed_classwork')} onClose={() => setIsCcwEditorOpen(false)} />}
            {isHwEditorOpen && <HomeworkEditor title="Smart Homework Editor" homeworkJson={formData.homework_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'homework')} onClose={() => setIsHwEditorOpen(false)} />}
            {isNqEditorOpen && <HomeworkEditor title="Next Quiz Range Editor" homeworkJson={formData.next_quiz_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'next_quiz')} onClose={() => setIsNqEditorOpen(false)} />}
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
