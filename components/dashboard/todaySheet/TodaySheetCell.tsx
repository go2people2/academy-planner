'use client';

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, History as HistoryIcon, TrendingUp, X, Percent, ArrowLeft, Hash, FileText, ClipboardCheck, ClipboardList, Wand2, Loader2, Send, CheckCircle, MessageSquare, Clock, Circle, AlertCircle, AlertTriangle, ExternalLink
} from 'lucide-react';
import { Student, TextbookOption, StudentStatus } from '@/types/dashboard';
import { getDayOfWeek } from '@/lib/utils';
import { ATTENDANCE_STATUS } from '@/lib/sessionFieldMap';
import { ScoreCell } from './cells/ScoreCell';
import { SimpleTextCell } from './cells/SimpleTextCell';

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
  statusMap: Record<string, any>;
  snippets?: string[];
  snippetTrigger?: string;
  isFirstInTimeSection?: boolean;
  timeSectionLabel?: string;
  testPresets?: any[];
  
  // Refs
  testRef: React.RefObject<HTMLTextAreaElement | null>;
  cwRef: React.RefObject<HTMLTextAreaElement | null>;
  ccwRef: React.RefObject<HTMLTextAreaElement | null>; // 💡 추가
  hwRef: React.RefObject<HTMLTextAreaElement | null>;
  nqRef: React.RefObject<HTMLTextAreaElement | null>;
  missionRef: React.RefObject<HTMLTextAreaElement | null>;
  notesRef: React.RefObject<HTMLTextAreaElement | null>;
  tdRef: (el: HTMLTableCellElement | null) => void;
  scoreInputRef?: (el: HTMLInputElement | null) => void;

  // Handlers
  onSelectOne?: (studentId: string, checked: boolean, shiftKey?: boolean) => void;
  onToggleHistory: (id: string) => void;
  onViewProgress: (id: string) => void;
  onViewDetail?: (id: string) => void;
  handleCellInteraction: (e: React.MouseEvent, colId: string, type: 'click' | 'dblclick') => void;
  handleKeyDown: (e: React.KeyboardEvent, colId: string) => void;
  onCellMouseDown: (e: React.MouseEvent, studentId: string, colId: string) => void;
  onCellMouseEnter: (studentId: string, colId: string) => void;
  
  // Field Specific Handlers
  onAttendanceClick: (e: React.MouseEvent) => void;
  onTestScoreTypeToggle: () => void;
  onFeedbackToggle: () => void;
  isFeedbackOpen: boolean;
  onSelectFeedback: (level: 'perfect' | 'good' | 'neutral' | 'poor' | 'bad' | 'none') => void;
  onCloseFeedback: () => void;
  
  // Modal Triggers
  onOpenCwEditor: (e: React.MouseEvent) => void;
  onOpenCcwEditor: (e: React.MouseEvent) => void; // 💡 추가
  onOpenHwEditor: (e: React.MouseEvent) => void;
  onOpenNqEditor: (e: React.MouseEvent) => void;
  onOpenTestEditor: (e: React.MouseEvent) => void;
  onOpenTestModal: (e: React.MouseEvent) => void;
  onOpenPdf: (e: React.MouseEvent) => void;
  onExecuteTest: (e: React.MouseEvent) => void;
  onSetNextQuizCut: (val: number) => void;
  onSetTodayTestCut: (val: number) => void; // 💡 추가
  onSetNextQuizTrial: (num: number) => void;
  onSave: (data?: any, directValue?: any) => void;
  onInputChange?: (field: string, value: string) => void;
  rowIndex?: number;
  onApplyTestPreset?: (preset: any, colId: 'test_id' | 'next_quiz') => void;
}

export const TodaySheetCell = React.memo(function TodaySheetCell({ 
  col, styles, student, formData, isEditing, isActive, isInRange, isSelected, 
  isCompleted, saveStatus, isSaving, isHistoryExpanded, displayDateShort, statusMap, 
  testRef, cwRef, ccwRef, hwRef, nqRef, missionRef, notesRef, tdRef, scoreInputRef, // 💡 ccwRef 추가
  onSelectOne, onToggleHistory, onViewProgress, onViewDetail, handleCellInteraction, handleKeyDown, 
  onCellMouseDown, onCellMouseEnter, onAttendanceClick, onTestScoreTypeToggle, 
  onFeedbackToggle, isFeedbackOpen, onSelectFeedback, onCloseFeedback, 
  onOpenCwEditor, onOpenCcwEditor, onOpenHwEditor, onOpenNqEditor, onOpenTestEditor, onOpenTestModal, // 💡 onOpenCcwEditor 추가
  onOpenPdf, onExecuteTest, onSetNextQuizCut, onSetTodayTestCut, onSetNextQuizTrial, onSave,
  onInputChange,
  rowIndex,
  snippets,
  snippetTrigger,
  isFirstInTimeSection,
  timeSectionLabel,
  testPresets,
  onApplyTestPreset
}: TodaySheetCellProps) {
  
  const colId = col.id;

  // 💡 여백 최소화: 무조건 상하 2px (최대 밀집도)
  const getDynamicPadding = () => 'pt-[2px] pb-[2px] px-1.5';

  const currentText = colId === 'test_id' ? formData.test_id :
                    colId === 'classwork' ? formData.classwork_text :
                    colId === 'completed_classwork' ? formData.completed_classwork_text : // 💡 추가
                    colId === 'assign' ? formData.homework_text :
                    colId === 'next_quiz' ? formData.next_quiz_text :
                    colId === 'mission' ? formData.mission :
                    colId === 'notes' ? formData.special_notes : '';

  const dynamicPadding = getDynamicPadding(currentText);

  // 💡 [최적화] 텍스트가 변경되거나 편집 모드 진입 시 즉시 높이 조절 및 포커스 지연 제거
  React.useLayoutEffect(() => {
    const refs = [testRef, cwRef, ccwRef, hwRef, nqRef, missionRef, notesRef];
    refs.forEach(ref => {
      if (ref.current && (isEditing || isActive)) {
        ref.current.style.height = 'auto';
        ref.current.style.height = `${ref.current.scrollHeight}px`;
        // 💡 편집 모드일 때만 즉시 포커스 (속도 향상 핵심)
        if (isEditing) ref.current.focus();
      }
    });
  }, [isEditing, isActive, currentText]);

  // 💡 커트라인 픽커 전용 상태
  const [isCutPickerOpen, setIsCutPickerOpen] = useState(false);
  const [pickerCoords, setPickerCoords] = useState({ top: 0, left: 0 });

  // 💡 [추가] 포탈형 툴팁 상태
  const [activeTooltip, setActiveTooltip] = useState<'note' | 'suggestion' | null>(null);
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0, right: 0, bottom: 0 });

  const handleOpenTooltip = (e: React.MouseEvent | React.FocusEvent, type: 'note' | 'suggestion') => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipCoords({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
    setActiveTooltip(type);
  };

  // 💡 [추가] 툴팁 열린 상태에서 스크롤/리사이즈 시 자동 닫기 (위치 어긋남 방지)
  React.useEffect(() => {
    if (!activeTooltip) return;
    const handleClose = () => setActiveTooltip(null);
    window.addEventListener('scroll', handleClose, true); // 테이블 스크롤 감지를 위해 capture 사용
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [activeTooltip]);

  const handleOpenCutPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPickerCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
    setIsCutPickerOpen(true);
  };

  const handleLocalInput = (e: React.FormEvent<HTMLTextAreaElement | HTMLInputElement>, field: string) => {
    const target = e.target as any;
    let val = target.value;

    // 💡 단축어 트리거 치환 감지 (textarea 에서만 동작)
    if (e.target instanceof HTMLTextAreaElement && snippets && snippetTrigger && snippetTrigger !== 'none') {
      const escapedTrigger = snippetTrigger.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      
      // 맥북 한글 상태에서 백틱 입력 시 ₩로 입력되는 현상 대응
      let triggerRegexStr = escapedTrigger;
      if (snippetTrigger === '`') {
        triggerRegexStr = '[`₩]';
      }
      
      const regex = new RegExp(`${triggerRegexStr}([1-9]|10|0)$`);
      const match = val.match(regex);

      if (match) {
        const matchedStr = match[0];
        const numStr = match[1];
        let idx = parseInt(numStr) - 1;
        if (numStr === '0' || numStr === '10') idx = 9;

        const snip = snippets[idx];
        if (snip) {
          const startPos = target.selectionStart - matchedStr.length;
          const endPos = target.selectionStart;
          const before = val.substring(0, startPos);
          const after = val.substring(endPos);
          const newVal = before + snip + after;

          val = newVal;
          target.value = newVal;

          const newCursorPos = startPos + snip.length;
          requestAnimationFrame(() => {
            target.selectionStart = newCursorPos;
            target.selectionEnd = newCursorPos;
          });
        }
      }
    }

    if (onInputChange) onInputChange(field, val);
    
    if (e.target instanceof HTMLTextAreaElement) {
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
    }
  };

  // 💡 폰트 사이즈와 높이를 픽셀 단위로 강제 (들썩임 방지 핵심)
  const textColClass = colId === 'mission' ? 'text-amber-200/90 font-bold' : 'text-white font-extrabold';
  const commonTextStyle = `w-full text-[12px] leading-[14px] text-left ${textColClass} ${dynamicPadding} m-0 border-0 outline-none box-border appearance-none scrollbar-hide`;

  return (
    <td 
      ref={tdRef}
      style={styles} 
      tabIndex={0}
      data-col-id={colId}
      className={`border-r border-white/12 relative group/td outline-none align-top ${
        isFirstInTimeSection ? 'border-t-[3px] border-t-blue-500/60 shadow-[inset_0_1px_0_rgba(59,130,246,0.2)]' : ''
      } ${isActive ? 'ring-2 ring-inset ring-blue-500 z-30' : isInRange ? 'ring-1 ring-inset ring-blue-500/50' : ''}`}
      onMouseDown={(e) => onCellMouseDown(e, student.id, colId)}
      onMouseEnter={() => onCellMouseEnter(student.id, colId)}
      onClick={(e) => handleCellInteraction(e, colId, 'click')}
      onDoubleClick={(e) => handleCellInteraction(e, colId, 'dblclick')}
      onKeyDown={(e) => handleKeyDown(e, colId)}
    >
      {!isEditing && !['select', 'action', 'attendance', 'name', 'review'].includes(colId) && (
        <div className="absolute inset-0 z-20 cursor-default" />
      )}

      {colId === 'action' ? (
        <button 
          type="button"
          onClick={(e) => { 
            e.stopPropagation(); 
            onSave(colId); 
          }} 
          disabled={isSaving}
          className={`absolute inset-0 w-full h-full transition-all duration-300 outline-none border-0 p-0 m-0 z-30 cursor-pointer ${
            isSaving ? 'bg-blue-500 animate-pulse cursor-wait' : 
            saveStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 
            isCompleted ? 'bg-emerald-500/30 hover:bg-emerald-500/50' : 
            saveStatus === 'error' ? 'bg-rose-500 animate-bounce shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 
            'bg-white/10 hover:bg-blue-600/50'
          }`}
          title={
            isSaving ? '저장 중...' : 
            saveStatus === 'success' ? '저장 성공' : 
            isCompleted ? '저장 완료됨' : 
            saveStatus === 'error' ? '저장 실패 (클릭하여 재시도)' : 
            '저장되지 않음 (클릭하여 수동 저장)'
          }
        />
      ) : (
        <div className={`flex items-start min-h-[22px] h-full w-full ${['select', 'action', 'date'].includes(colId) ? 'justify-center' : 'justify-start'}`}>
        
        {colId === 'select' && (
          <div className="flex items-center justify-center w-full min-h-[22px] py-1 relative z-30 group/select select-none">
            {isSelected ? (
              <div className="flex items-center justify-center">
                <input 
                  type="checkbox" 
                  checked={isSelected} 
                  onChange={(e) => onSelectOne?.(student.id, e.target.checked, (e.nativeEvent as any).shiftKey)} 
                  className="w-4 h-4 rounded border-white/20 bg-blue-600 checked:bg-blue-600 cursor-pointer" 
                />
              </div>
            ) : (
              <>
                <div className="group-hover/select:hidden flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={isSelected} 
                    onChange={(e) => onSelectOne?.(student.id, e.target.checked, (e.nativeEvent as any).shiftKey)} 
                    className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-blue-600 cursor-pointer" 
                  />
                </div>
                <button 
                  onClick={() => onSelectOne?.(student.id, !isSelected)}
                  className="hidden group-hover/select:flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-600/10 text-[9px] font-black text-gray-400 hover:text-blue-400 transition-colors"
                >
                  {(rowIndex ?? 0) + 1}
                </button>
              </>
            )}
          </div>
        )}

        {colId === 'date' && (
          <div className="flex flex-col gap-0.5 items-center justify-center py-1 w-full min-h-[22px]">
            <span className="font-black text-gray-500 text-[10px] tabular-nums">{displayDateShort}</span>
            <button onClick={(e) => { e.stopPropagation(); onToggleHistory(student.id); }} className={`w-6 h-6 rounded-[2px] flex items-center justify-center transition-all ${isHistoryExpanded ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}><HistoryIcon size={12} /></button>
          </div>
        )}

        {colId === 'name' && (
          <div className="flex items-center justify-between gap-2 px-1.5 py-1 w-full min-h-[22px] relative group/namecell">
            {isFirstInTimeSection && timeSectionLabel && (
              <div className="absolute -top-[4px] right-4 z-[45] pointer-events-none select-none">
                <span className="px-1.5 py-0.5 rounded bg-blue-600/95 backdrop-blur-sm text-[8.5px] font-black text-white tracking-widest uppercase shadow-[0_2px_8px_rgba(37,99,235,0.4)] border border-blue-400/40">
                  {timeSectionLabel}
                </span>
              </div>
            )}
            <div className="absolute top-0 right-0 flex flex-row-reverse items-start gap-1">
              {student.management_notes && (
                <div 
                  className="group/note relative cursor-pointer z-[60]"
                  onClick={(e) => { e.stopPropagation(); onViewDetail?.(student.id); }}
                  onMouseEnter={(e) => handleOpenTooltip(e, 'note')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onFocus={(e) => handleOpenTooltip(e, 'note')}
                  onBlur={() => setActiveTooltip(null)}
                  tabIndex={0}
                >
                  <div className="w-0 h-0 border-t-[24px] border-t-amber-500 border-l-[24px] border-l-transparent shadow-lg drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  
                  {activeTooltip === 'note' && createPortal(
                    <AnimatePresence mode="wait">
                      <motion.div 
                        initial={{ opacity: 0, y: tooltipCoords.top < 350 ? 10 : -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{ 
                          position: 'fixed',
                          top: tooltipCoords.top < 350 ? tooltipCoords.bottom + 8 : 'auto',
                          bottom: tooltipCoords.top < 350 ? 'auto' : (window.innerHeight - tooltipCoords.top) + 8,
                          left: Math.max(16, Math.min(tooltipCoords.right - 320, window.innerWidth - 336)),
                          zIndex: 9999
                        }}
                        className="w-80 p-5 bg-amber-50 text-amber-950 text-[13px] font-black rounded-lg shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-2 border-amber-200 ring-4 ring-black/20 pointer-events-none"
                      >
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200">
                          <AlertTriangle size={14} className="text-amber-600 animate-bounce" />
                          <span className="text-[10px] uppercase tracking-widest text-amber-600 font-black">Student Management Alert</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed text-[14px]">"{student.management_notes}"</p>
                      </motion.div>
                    </AnimatePresence>,
                    document.body
                  )}
                </div>
              )}
              {student.suggestions && student.suggestions.length > 0 && (
                <div 
                  className="group/suggestion relative cursor-pointer"
                  onMouseEnter={(e) => handleOpenTooltip(e, 'suggestion')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onFocus={(e) => handleOpenTooltip(e, 'suggestion')}
                  onBlur={() => setActiveTooltip(null)}
                  tabIndex={0}
                >
                  <div className="w-0 h-0 border-t-[22px] border-t-blue-500 border-l-[22px] border-l-transparent shadow-md" />
                  
                  {activeTooltip === 'suggestion' && createPortal(
                    <AnimatePresence mode="wait">
                      <motion.div 
                        initial={{ opacity: 0, y: tooltipCoords.top < 350 ? 10 : -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{ 
                          position: 'fixed',
                          top: tooltipCoords.top < 350 ? tooltipCoords.bottom + 8 : 'auto',
                          bottom: tooltipCoords.top < 350 ? 'auto' : (window.innerHeight - tooltipCoords.top) + 8,
                          left: Math.max(16, Math.min(tooltipCoords.right - 320, window.innerWidth - 336)),
                          zIndex: 9999
                        }}
                        className="w-80 p-4 bg-blue-50 text-blue-950 text-[13px] font-black rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-2 border-blue-200 pointer-events-none"
                      >
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-200/50">
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-[10px] uppercase tracking-widest text-blue-600">Student Suggestion</span>
                        </div>
                        <div className="space-y-3">
                          {student.suggestions.map((sug: any, idx: number) => (
                            <p key={idx} className="whitespace-pre-wrap leading-relaxed">{sug.content}</p>
                          ))}
                        </div>
                      </motion.div>
                    </AnimatePresence>,
                    document.body
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[13px] font-extrabold text-white truncate group-hover/namecell:text-blue-400 transition-colors">
                  {student.name}-{student.teacher_initial || '?'}-{student.class_days 
                    ? [...student.class_days].sort((a, b) => {
                        const order = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                        return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
                      }).join('')
                    : '무'}
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const slug = window.location.pathname.split('/')[1];
                    window.open(`/${slug}/student?id=${student.id}`, '_blank');
                  }}
                  className="p-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-[2px] shrink-0"
                  title="학생 페이지 보기"
                >
                  <ExternalLink size={10} strokeWidth={3} />
                </button>
                {['pending', 'approved'].includes(student.todaySession?.approval_status || '') && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("이 학생의 제출 상태를 초기화하시겠습니까? (학생이 다시 내용을 수정하고 제출할 수 있습니다.)")) {
                        onSave({ approval_status: 'none' });
                      }
                    }}
                    className="p-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded-[2px] shrink-0"
                    title="학생 제출 리셋 (다시 수정 가능하게 하기)"
                  >
                    <HistoryIcon size={10} strokeWidth={3} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-tighter truncate text-gray-500">
                {student.school} · {student.grade}
              </div>
            </div>
            {onViewProgress && (
              <button onClick={(e) => { e.stopPropagation(); onViewProgress(student.id); }} className="p-2 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm shrink-0" title="진도표 바로가기"><TrendingUp size={12} /></button>
            )}
          </div>
        )}

        {colId === 'attendance' && (
          <div onClick={onAttendanceClick} className={`absolute inset-0 w-full h-full flex items-center justify-start px-4 text-[11px] font-black cursor-pointer select-none transition-colors hover:bg-white/[0.05] z-30 ${
            formData.attendance_status === ATTENDANCE_STATUS.BEFORE ? 'text-gray-600' :
            formData.attendance_status.startsWith(ATTENDANCE_STATUS.PRESENT) ? 'text-emerald-400' : 
            formData.attendance_status.startsWith(ATTENDANCE_STATUS.ABSENT) ? 'text-red-400' : 
            'text-amber-400'
          }`}>
            <div className="flex items-center gap-1">
              <span>{formData.attendance_status}</span>
              {formData.moved_to_hour && (
                <span className="text-[9px] opacity-60 bg-white/10 px-1 rounded">
                  {formData.moved_to_hour}시
                </span>
              )}
            </div>
          </div>
        )}

        {colId === 'review' && (
          <div className="relative w-full h-full flex items-start justify-between bg-blue-600/[0.03] py-1 px-2 gap-2">
            <div className="flex-1 text-left min-w-0">
              {student.lastSession?.homework_text ? (
                <p className="text-[12px] font-bold text-blue-200 leading-tight italic whitespace-pre-wrap">
                  <span className="text-blue-500/80 text-[16px] font-black mr-1">"</span>
                  {student.lastSession.homework_text}
                  <span className="text-blue-500/80 text-[16px] font-black ml-1">"</span>
                </p>
              ) : (
                <span className="italic opacity-30 text-gray-500 font-medium text-[11px] px-2">기존 숙제 없음</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {student.lastSession?.homework_text && (() => {
                const attStatus = student.todaySession?.attendance_status || '';
                const isPresent = ['출석', '지각'].some(st => attStatus.startsWith(st));
                const isSupplement = attStatus.startsWith('보강');
                const hasAttendance = isPresent || isSupplement || attStatus !== '';
                if (!hasAttendance) return null;

                const isRegularClass = student.isTodayClassDay === true;

                if (isRegularClass && !isSupplement) {
                  return null;
                } else {
                  const isChecked = student.todaySession?.hw_checked_today === true;
                  return (
                    <button
                      type="button"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onSave({ hw_checked_today: !isChecked });
                      }}
                      className={`relative z-30 shrink-0 px-2 py-0.5 rounded text-[9.5px] font-black tracking-tighter border transition-colors ${
                        isChecked
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                          : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700 hover:text-gray-200'
                      }`}
                    >
                      {isChecked ? '✅ 오늘검사' : '🔳 검사하기'}
                    </button>
                  );
                }
              })()}

              <div className="relative z-30">
                <button 
                  onClick={(e) => { e.stopPropagation(); onFeedbackToggle(); }} 
                  className={`w-5 h-5 rounded-[3px] flex items-center justify-center transition-all border ${
                    isFeedbackOpen 
                      ? 'bg-indigo-500/30 text-indigo-200 border-indigo-500/50' 
                      : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30 hover:text-white hover:border-indigo-500/50'
                  }`}
                  title="특이사항에 과제 피드백 추가"
                >
                  <MessageSquare size={12} />
                </button>
                <AnimatePresence>
                  {isFeedbackOpen && (
                    <motion.div initial={{ opacity: 0, x: 10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.9 }}
                      className="absolute right-full top-0 mr-2 flex gap-1 bg-[#1a1a1a] p-1 rounded-md border border-white/10 shadow-2xl z-[100]">
                      {(['perfect', 'good', 'neutral', 'poor', 'bad', 'none'] as const).map((k) => (
                        <button key={k} onClick={(e) => { e.stopPropagation(); onSelectFeedback(k); }} className={`w-7 h-7 rounded-[2px] flex items-center justify-center text-[10px] font-black transition-all hover:scale-110 ${statusMap[k as keyof typeof statusMap].color} shadow-md`}>{statusMap[k as keyof typeof statusMap].label}</button>
                      ))}
                      <button onClick={(e) => { e.stopPropagation(); onCloseFeedback(); }} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white"><X size={14} /></button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* 💡 [리팩토링] 단순 텍스트 셀 분리 (mission, notes) */}
        {(['mission', 'notes'].includes(colId)) && (
          <SimpleTextCell 
            ref={colId === 'mission' ? missionRef : notesRef}
            student={student}
            colId={colId}
            currentText={currentText}
            isEditing={isEditing}
            isActive={isActive}
            onSave={onSave}
            handleKeyDown={handleKeyDown}
            handleLocalInput={handleLocalInput}
            handleCellInteraction={handleCellInteraction}
            commonTextStyle={commonTextStyle}
            snippets={snippets}
            snippetTrigger={snippetTrigger}
          />
        )}

        {(['test_id', 'classwork', 'completed_classwork', 'assign', 'next_quiz'].includes(colId)) && (
          <div className="relative w-full h-full flex items-start justify-start group/cell">
            {/* 💡 칩카드 UI가 제거되었습니다. 선생님이 직접 텍스트로 테스트를 기록합니다. */}
            
            {/* 💡 [수정] isActive일 때도 textarea를 유지하여 줄바꿈 시 내용 가려짐 방지 */}
            {(isEditing || isActive) && (
              <textarea 
                ref={colId === 'test_id' ? testRef : colId === 'classwork' ? cwRef : colId === 'completed_classwork' ? ccwRef : colId === 'assign' ? hwRef : nqRef} 
                defaultValue={currentText || ''} 
                data-student-id={student.id}
                data-col-id={colId}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    onSave(colId, (e.target as HTMLTextAreaElement).value);
                  }
                  handleKeyDown(e, colId);
                }} 
                onBlur={(e) => onSave(colId, e.target.value)} 
                placeholder="-" 
                className={`${commonTextStyle} bg-transparent resize-none overflow-y-hidden block relative z-20`} 
                onInput={(e) => handleLocalInput(e, colId)} 
              />
            )}
            
            {/* 💡 편집 중이 아닐 때만 뷰 모드 텍스트 노출 */}
            {!isEditing && !isActive && (
              <div className={`${commonTextStyle} whitespace-pre-wrap min-h-[22px] flex flex-col items-start justify-start`}>
                <div className="w-full">{currentText || '-'}</div>
                {colId === 'test_id' && formData.test_cut > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                    Cut: {formData.test_cut}개
                  </div>
                )}
                {colId === 'next_quiz' && formData.next_quiz_cut > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                    Cut: {formData.next_quiz_cut}개
                  </div>
                )}
              </div>
            )}
            
            <div className="absolute right-1 top-1 flex items-center gap-1 opacity-30 group-hover/cell:opacity-100 focus-within:opacity-100 transition-all duration-200 z-30">
              {colId === 'test_id' && (
                <>
                  {/* 💡 오늘 테스트 커트라인 픽커 버튼 */}
                  <div onClick={handleOpenCutPicker} className="relative cursor-pointer group/cut">
                    <div className="w-5 h-5 rounded-[1px] bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 group-hover/cut:bg-emerald-600 group-hover/cut:text-white transition-all shadow-sm flex items-center justify-center">
                      <span className="text-[10px] font-black">{formData.test_cut || 0}</span>
                    </div>
                  </div>

                </>
              )}
              {colId === 'next_quiz' && (
                <div className="flex items-center gap-1">
                  {/* 💡 다음 테스트 커스텀 커트라인 픽커 버튼 */}
                  <div onClick={handleOpenCutPicker} className="relative cursor-pointer group/cut">
                    <div className="w-5 h-5 rounded-[1px] bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 group-hover/cut:bg-emerald-600 group-hover/cut:text-white transition-all shadow-sm flex items-center justify-center">
                      <span className="text-[10px] font-black">{formData.next_quiz_cut || 0}</span>
                    </div>
                  </div>
                </div>
              )}
              {(colId === 'classwork' || colId === 'completed_classwork' || colId === 'assign') && (
                <button onClick={colId === 'classwork' ? onOpenCwEditor : colId === 'completed_classwork' ? onOpenCcwEditor : onOpenHwEditor} className="w-5 h-5 rounded-[1px] bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><Wand2 size={10} /></button>
              )}

              {/* 💡 [공용] 포탈로 띄우는 정사각형 픽커 */}
              {isCutPickerOpen && createPortal(
                <>
                  <div className="fixed inset-0 z-[1000]" onClick={() => setIsCutPickerOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    style={{ top: pickerCoords.top + 5, left: Math.min(pickerCoords.left, window.innerWidth - 180) }}
                    className="fixed z-[1001] bg-[#121212] border border-emerald-500/30 rounded-lg shadow-2xl p-4 w-44 space-y-4"
                  >
                    <div className="grid grid-cols-5 gap-1.5">
                      {[0, 1, 2, 3, 4].map(num => (
                        <button 
                          key={num} 
                          onClick={() => { 
                            if (colId === 'test_id') onSetTodayTestCut(num);
                            else onSetNextQuizCut(num);
                            setIsCutPickerOpen(false); 
                          }}
                          className={`aspect-square rounded-md flex items-center justify-center text-[12px] font-black transition-all border ${Number(colId === 'test_id' ? formData.test_cut : formData.next_quiz_cut) === num ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-white hover:bg-emerald-500/30'}`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">커트라인 직접 입력</label>
                      <input 
                        type="number"
                        autoFocus
                        placeholder="직접 입력"
                        defaultValue={colId === 'test_id' ? formData.test_cut : formData.next_quiz_cut}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            const finalVal = isNaN(val) ? 0 : val;
                            if (colId === 'test_id') onSetTodayTestCut(finalVal);
                            else onSetNextQuizCut(finalVal);
                            setIsCutPickerOpen(false);
                          }
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-500 [color-scheme:dark]"
                      />
                    </div>
                  </motion.div>
                </>,
                document.body
              )}
            </div>
          </div>
        )}

        {/* 💡 [리팩토링] 점수 입력 셀 분리 */}
        {colId === 'test_score' && (
          <ScoreCell 
            student={student}
            colId={colId}
            formData={formData}
            isEditing={isEditing}
            isActive={isActive}
            scoreInputRef={scoreInputRef}
            onSave={onSave}
            handleKeyDown={handleKeyDown}
            handleLocalInput={handleLocalInput}
            handleCellInteraction={handleCellInteraction}
            onTestScoreTypeToggle={onTestScoreTypeToggle}
          />
        )}
      </div>
      )}
    </td>
  );
});
