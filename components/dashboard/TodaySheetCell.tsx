'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, History as HistoryIcon, TrendingUp, X, Percent, ArrowLeft, Hash, FileText, ClipboardCheck, ClipboardList, Wand2, Loader2, Send, CheckCircle
} from 'lucide-react';
import { Student, TextbookOption, StudentStatus } from '@/types/dashboard';
import { getDayOfWeek } from '@/lib/utils';

interface TodaySheetCellProps {
  col: any;
  styles: React.CSSProperties;
  student: Student;
  formData: any;
  isEditing: boolean;
  isActive: boolean;
  isInRange: boolean;
  isSelected?: boolean;
  isCompleted: boolean;
  saveStatus: 'idle' | 'success' | 'error';
  isSaving: boolean;
  isHistoryExpanded: boolean;
  displayDateShort: string;
  statusMap: Record<string, { label: string, color: string }>;
  
  // Refs
  testRef: React.RefObject<HTMLTextAreaElement | null>;
  cwRef: React.RefObject<HTMLTextAreaElement | null>;
  hwRef: React.RefObject<HTMLTextAreaElement | null>;
  nqRef: React.RefObject<HTMLTextAreaElement | null>;
  missionRef: React.RefObject<HTMLTextAreaElement | null>;
  notesRef: React.RefObject<HTMLTextAreaElement | null>;
  tdRef: (el: HTMLTableCellElement | null) => void;
  scoreInputRef: (el: HTMLInputElement | null) => void;

  // Handlers
  onSelectOne?: (studentId: string, checked: boolean) => void;
  onToggleHistory: (id: string) => void;
  onViewProgress: (id: string) => void;
  handleCellInteraction: (e: React.MouseEvent, colId: string, type: 'click' | 'dblclick') => void;
  handleKeyDown: (e: React.KeyboardEvent, colId: string) => void;
  onCellMouseDown: (e: React.MouseEvent, studentId: string, colId: string) => void;
  onCellMouseEnter: (studentId: string, colId: string) => void;
  
  // Field Specific Handlers
  onAttendanceClick: (e: React.MouseEvent) => void;
  onTestScoreTypeToggle: () => void;
  onFeedbackToggle: () => void;
  isFeedbackOpen: boolean;
  onSelectFeedback: (status: StudentStatus) => void;
  onCloseFeedback: () => void;
  
  // Modal Triggers
  onOpenCwEditor: (e: React.MouseEvent) => void;
  onOpenHwEditor: (e: React.MouseEvent) => void;
  onOpenNqEditor: (e: React.MouseEvent) => void;
  onOpenTestEditor: (e: React.MouseEvent) => void;
  onOpenTestModal: (e: React.MouseEvent) => void;
  onOpenPdf: (e: React.MouseEvent) => void;
  onExecuteTest: (e: React.MouseEvent) => void;
  onSetNextQuizCut: (val: number) => void;
  onSetNextQuizTrial: (num: number) => void;
  onSave: () => void;
}

export const TodaySheetCell = React.memo(function TodaySheetCell({ 
  col, styles, student, formData, isEditing, isActive, isInRange, isSelected, 
  isCompleted, saveStatus, isSaving, isHistoryExpanded, displayDateShort, statusMap, 
  testRef, cwRef, hwRef, nqRef, missionRef, notesRef, tdRef, scoreInputRef, 
  onSelectOne, onToggleHistory, onViewProgress, handleCellInteraction, handleKeyDown, 
  onCellMouseDown, onCellMouseEnter, onAttendanceClick, onTestScoreTypeToggle, 
  onFeedbackToggle, isFeedbackOpen, onSelectFeedback, onCloseFeedback, 
  onOpenCwEditor, onOpenHwEditor, onOpenNqEditor, onOpenTestEditor, onOpenTestModal, 
  onOpenPdf, onExecuteTest, onSetNextQuizCut, onSetNextQuizTrial, onSave 
}: TodaySheetCellProps) {
  
  const colId = col.id;

  // 💡 56px 높이 고정을 위한 정밀 수학적 계산 (Line-height: 18px 기준)
  const getDynamicPadding = (text: string) => {
    const lineCount = (text?.match(/\n/g) || []).length + 1;
    if (lineCount <= 1) return 'pt-[19px] pb-[19px]'; // 18 + 38 = 56px
    if (lineCount === 2) return 'pt-[10px] pb-[10px]'; // 36 + 20 = 56px
    if (lineCount === 3) return 'pt-[1px] pb-[1px]';   // 54 + 2 = 56px
    return 'pt-[1px] pb-[1px]';                        // 4줄 이상 확장
  };

  const currentText = colId === 'test_id' ? formData.test_id :
                    colId === 'classwork' ? formData.classwork_text :
                    colId === 'assign' ? formData.homework_text :
                    colId === 'next_quiz' ? formData.next_quiz_text :
                    colId === 'mission' ? formData.mission :
                    colId === 'notes' ? formData.special_notes : '';

  const dynamicPadding = getDynamicPadding(currentText);

  // 💡 텍스트가 변경되거나 편집 모드 진입 시 높이 자동 조절
  React.useEffect(() => {
    const refs = [testRef, cwRef, hwRef, nqRef, missionRef, notesRef];
    refs.forEach(ref => {
      if (ref.current && (isEditing || isActive)) {
        ref.current.style.height = 'auto';
        ref.current.style.height = `${ref.current.scrollHeight}px`;
      }
    });
  }, [isEditing, isActive, currentText, testRef, cwRef, hwRef, nqRef, missionRef, notesRef]);

  // 💡 폰트 사이즈와 높이를 픽셀 단위로 강제 (들썩임 방지 핵심)
  const commonTextStyle = `w-full text-[12px] leading-[18px] text-left text-white font-black px-4 ${dynamicPadding} m-0 border-0 outline-none box-border appearance-none scrollbar-hide`;

  return (
    <td 
      ref={tdRef}
      style={styles} 
      tabIndex={0}
      className={`border-r border-white/15 relative group/td outline-none align-top ${isActive ? 'ring-2 ring-inset ring-blue-500 z-30' : isInRange ? 'ring-1 ring-inset ring-blue-500/50' : ''}`}
      onMouseDown={(e) => onCellMouseDown(e, student.id, colId)}
      onMouseEnter={() => onCellMouseEnter(student.id, colId)}
      onClick={(e) => handleCellInteraction(e, colId, 'click')}
      onDoubleClick={(e) => handleCellInteraction(e, colId, 'dblclick')}
      onKeyDown={(e) => handleKeyDown(e, colId)}
    >
      {!isEditing && !['select', 'action', 'attendance'].includes(colId) && (
        <div className="absolute inset-0 z-20 cursor-default" />
      )}

      <div className={`flex items-start min-h-[56px] h-full w-full ${['select', 'action', 'date'].includes(colId) ? 'justify-center' : 'justify-start'}`}>
        
        {colId === 'select' && (
          <div className="flex items-center justify-center w-full h-[56px] relative z-30">
            <input type="checkbox" checked={isSelected} onChange={(e) => onSelectOne?.(student.id, e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-blue-600 cursor-pointer" />
          </div>
        )}

        {colId === 'date' && (
          <div className="flex flex-col gap-1.5 items-center justify-center py-2.5 w-full h-[56px]">
            <span className="font-black text-gray-500 text-[10px] tabular-nums">{displayDateShort}</span>
            <button onClick={(e) => { e.stopPropagation(); onToggleHistory(student.id); }} className={`w-6 h-6 rounded-[2px] flex items-center justify-center transition-all ${isHistoryExpanded ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}><HistoryIcon size={12} /></button>
          </div>
        )}

        {colId === 'name' && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 w-full h-[56px] relative group/namecell">
            <div className="flex flex-col min-w-0 overflow-hidden items-start text-left">
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-[14px] tracking-tight truncate">{student.name}</span>
                {isCompleted && <Check size={12} className="text-emerald-500 stroke-[3px]" />}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter truncate">{student.grade}</span>
                {/* 💡 실시간 시간표 진단 라벨 */}
                {(() => {
                  const dayKey = getDayOfWeek(displayDateShort.includes('.') ? `${new Date().getFullYear()}-${displayDateShort.replace('.', '-')}` : new Date().toISOString().split('T')[0]);
                  const status = formData.attendance_status || '';
                  let detectedTime = '';
                  
                  if (status.includes(':')) {
                    detectedTime = `${status.split(':').pop()}시 (수동)`;
                  } else {
                    const hours = student.day_schedules?.[dayKey] || [];
                    if (hours.length > 0) {
                      const minH = Math.min(...hours.map((h: any) => h % 100));
                      detectedTime = `${minH}시 (정규)`;
                    } else {
                      detectedTime = '시간표없음';
                    }
                  }
                  return <span className="text-[8px] font-black text-blue-500/60 bg-blue-500/10 px-1.5 py-0.5 rounded-sm border border-blue-500/20 tabular-nums">[{dayKey}] {detectedTime}</span>;
                })()}
              </div>
            </div>
            {onViewProgress && (
              <button onClick={(e) => { e.stopPropagation(); onViewProgress(student.id); }} className="p-2 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm shrink-0" title="진도표 바로가기"><TrendingUp size={12} /></button>
            )}
          </div>
        )}

        {colId === 'attendance' && (
          <div onClick={onAttendanceClick} className={`absolute inset-0 w-full h-full flex items-center justify-start px-4 text-[11px] font-black cursor-pointer select-none transition-colors hover:bg-white/[0.05] z-30 ${formData.attendance_status?.startsWith('출석') ? 'text-emerald-400' : formData.attendance_status?.startsWith('결석') ? 'text-red-400' : 'text-amber-400'}`}>
            {formData.attendance_status?.split(':')[0] || '출석'}
          </div>
        )}

        {colId === 'review' && (
          <div className="relative w-full h-full flex items-start justify-start py-2.5 px-4">
            <div className="text-[12px] leading-[18px] text-gray-200 font-black whitespace-pre-wrap">
              {student.lastSession?.homework_text || <span className="italic opacity-50 text-gray-600 font-medium">기존 숙제 없음</span>}
            </div>
          </div>
        )}

        {(['test_id', 'classwork', 'assign', 'next_quiz', 'mission', 'notes'].includes(colId)) && (
          <div className="relative w-full h-full flex items-start justify-start group/cell">
            {(isEditing || isActive) && (
              <textarea 
                ref={colId === 'test_id' ? testRef : colId === 'classwork' ? cwRef : colId === 'assign' ? hwRef : colId === 'next_quiz' ? nqRef : colId === 'mission' ? missionRef : notesRef} 
                defaultValue={currentText || ''} 
                autoFocus={isEditing} 
                onKeyDown={(e) => handleKeyDown(e, colId)} 
                onBlur={onSave} 
                placeholder="-" 
                className={`${commonTextStyle} bg-transparent resize-none overflow-y-hidden block ${!isEditing ? 'opacity-0 pointer-events-none absolute inset-0' : 'relative z-10'}`} 
                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }} 
              />
            )}
            
            {!isEditing && (
              <div className={`${commonTextStyle} whitespace-pre-wrap min-h-[56px] flex flex-col items-start justify-start`}>
                <div className="w-full">{currentText || '-'}</div>
                {colId === 'next_quiz' && formData.next_quiz_cut > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                    Cut: {formData.next_quiz_cut}개
                  </div>
                )}
              </div>
            )}
            
            <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity z-30">
              {colId === 'test_id' && (
                <>
                  {formData.test_id && <button onClick={onOpenPdf} className="w-5 h-5 rounded-[1px] bg-red-600/30 text-red-400 border border-red-500/40 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><FileText size={10} /></button>}
                  <button onClick={onOpenTestEditor} className="w-5 h-5 rounded-[1px] bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><Wand2 size={10} /></button>
                  <button onClick={onOpenTestModal} className="w-5 h-5 rounded-[1px] bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><ClipboardList size={10} /></button>
                </>
              )}
              {colId === 'next_quiz' && (
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); onExecuteTest(e); }} className="w-5 h-5 rounded-[1px] bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm" title="오늘 테스트로 이동"><TrendingUp size={10} /></button>
                  <button onClick={onOpenNqEditor} className="w-5 h-5 rounded-[1px] bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><Wand2 size={10} /></button>
                  <div className="relative group/cut">
                    <select 
                      value={formData.next_quiz_cut || 0} 
                      onChange={(e) => onSetNextQuizCut(parseInt(e.target.value))} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    >
                      {[...Array(11)].map((_, i) => <option key={i} value={i} className="bg-[#121212]">{i}개</option>)}
                    </select>
                    <div className="w-5 h-5 rounded-[1px] bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center">
                      <span className="text-[10px] font-black">{formData.next_quiz_cut || 0}</span>
                    </div>
                  </div>
                </div>
              )}
              {(colId === 'classwork' || colId === 'assign') && (
                <button onClick={colId === 'classwork' ? onOpenCwEditor : onOpenHwEditor} className="w-5 h-5 rounded-[1px] bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><Wand2 size={10} /></button>
              )}
            </div>
          </div>
        )}

        {colId === 'test_score' && (
          <div className="relative w-full h-full flex items-center justify-start group/score">
            {(isEditing || isActive) && (
              <input ref={scoreInputRef} type="text" defaultValue={formData.test_score || ''} autoFocus={isEditing} onKeyDown={(e) => handleKeyDown(e, colId)} onBlur={onSave} placeholder="-" className="w-full h-[56px] bg-transparent border-0 outline-none px-4 text-[14px] text-left text-emerald-400 font-black pr-4 m-0" />
            )}
            {!isEditing && (
              <div className="px-4 text-[14px] text-left text-emerald-400 font-black pr-4 w-full h-[56px] flex items-center justify-start">
                {formData.test_score ? (formData.test_score_type === 'score' ? `${formData.test_score}%` : `${formData.test_score}/${formData.test_total_count || '?'}`) : '-'}
              </div>
            )}
            <div className="absolute right-1 flex flex-col gap-0.5 z-30">
              <button onClick={(e) => { e.stopPropagation(); onTestScoreTypeToggle(); }} className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${formData.test_score_type === 'score' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-400'}`}>{formData.test_score_type === 'score' ? <Percent size={8} strokeWidth={4} /> : <Hash size={8} strokeWidth={4} />}</button>
              <span className="text-[7px] font-black text-gray-600/50 text-center uppercase">{formData.test_score_type === 'score' ? '%' : 'ea'}</span>
            </div>
          </div>
        )}

        {colId === 'action' && (
          <div className="px-3 py-2 w-full h-[56px] flex items-center justify-center">
            <button onClick={(e) => { e.stopPropagation(); onSave(); }} disabled={isSaving || (isCompleted && saveStatus === 'idle')} className={`w-full h-10 rounded-[4px] flex items-center justify-center transition-all shadow-lg z-30 ${isSaving ? 'bg-blue-600/50 cursor-wait' : saveStatus === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/40' : saveStatus === 'error' ? 'bg-red-500 text-white shadow-red-500/40' : (isCompleted) ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40' : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-900/40'}`}>
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : (saveStatus === 'success' || isCompleted) ? <Check size={18} className="stroke-[4px]" /> : saveStatus === 'error' ? <CheckCircle size={16} /> : <Send size={16} />}
            </button>
          </div>
        )}
      </div>
    </td>
  );
});
