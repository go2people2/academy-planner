'use client';

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, History as HistoryIcon, TrendingUp, X, Percent, ArrowLeft, Hash, FileText, ClipboardCheck, ClipboardList, Wand2, Loader2, Send, CheckCircle, MessageSquare, Clock, Circle, AlertCircle, AlertTriangle, ExternalLink, User, Lock, Trash2, Unlock, Edit3
} from 'lucide-react';
import { Student, TextbookOption, StudentStatus } from '@/types/dashboard';
import { getDayOfWeek, getCoursePrefix } from '@/lib/utils';
import { ATTENDANCE_STATUS } from '@/lib/sessionFieldMap';
import { ScoreCell } from './ScoreCellLight';
import { SimpleTextCell } from './SimpleTextCellLight';

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
  defaultScoreCut?: number;
  defaultCountCut?: number;
  
  // Refs
  testRef: React.RefObject<HTMLTextAreaElement | null>;
  cwRef: React.RefObject<HTMLTextAreaElement | null>;
  ccwRef: React.RefObject<HTMLTextAreaElement | null>; // 💡 추가
  hwRef: React.RefObject<HTMLTextAreaElement | null>;
  nqRef: React.RefObject<HTMLTextAreaElement | null>;
  missionRef: React.RefObject<HTMLTextAreaElement | null>;
  notesRef: React.RefObject<HTMLTextAreaElement | null>;
  managementNotesRef: React.RefObject<HTMLTextAreaElement | null>;
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
  onSelectFeedback: (level: 'gradeA' | 'gradeB' | 'gradeC' | 'gradeD' | 'gradeE' | 'gradeF' | 'none') => void;
  onCloseFeedback: () => void;
  
  // Modal Triggers
  onOpenCwEditor: (e?: React.MouseEvent) => void;
  onOpenCcwEditor: (e?: React.MouseEvent) => void; // 💡 추가
  onOpenHwEditor: (e?: React.MouseEvent) => void;
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
  onUpdateStudentInfo?: (id: string, field: string, value: any) => Promise<void>;
  cooperatingCells?: Record<string, { colId: string, clientId: string, timestamp: number }>; // 📝 [추가] 실시간 협업 편집 중인 셀 맵
  onRemoveFromToday?: (id: string, reason: string, mode?: 'delete' | 'cancel') => Promise<void>;
  toolsOrder?: string[];
  isToolsEditMode?: boolean;
  showAllTools?: boolean;
  onReorderTools?: (draggedId: string, targetId: string) => void;
}

export const TodaySheetCell = React.memo(function TodaySheetCell({ 
  col, styles, student, formData, isEditing, isActive, isInRange, isSelected, 
  isCompleted, saveStatus, isSaving, isHistoryExpanded, displayDateShort, statusMap, 
  testRef, cwRef, ccwRef, hwRef, nqRef, missionRef, notesRef, managementNotesRef, tdRef, scoreInputRef,
  onSelectOne, onToggleHistory, onViewProgress, onViewDetail, handleCellInteraction, handleKeyDown, 
  onCellMouseDown, onCellMouseEnter, onAttendanceClick, onTestScoreTypeToggle, 
  onFeedbackToggle, isFeedbackOpen, onSelectFeedback, onCloseFeedback, 
  onOpenCwEditor, onOpenCcwEditor, onOpenHwEditor, onOpenNqEditor, onOpenTestEditor, onOpenTestModal,
  onOpenPdf, onExecuteTest, onSetNextQuizCut, onSetTodayTestCut, onSetNextQuizTrial, onSave,
  onInputChange,
  rowIndex,
  snippets,
  snippetTrigger,
  isFirstInTimeSection,
  timeSectionLabel,
  onApplyTestPreset,
  onUpdateStudentInfo,
  cooperatingCells, // 📝 [추가] 실시간 협업 셀 맵
  onRemoveFromToday,
  toolsOrder,
  isToolsEditMode = false,
  showAllTools = false,
  onReorderTools,
  defaultScoreCut = 80,
  defaultCountCut = 2
}: TodaySheetCellProps) {
  
  const wasAlreadyActive = useRef(false);
  const colId = col.id;

  // 💡 [추가] 관리 주의점(management_notes) 퀵 팝업 에디터 상태
  const [isNotePopupOpen, setIsNotePopupOpen] = useState(false);
  const [noteText, setNoteText] = useState(student.management_notes || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // 🧲 [추가] 도구 드래그앤드롭 이벤트 핸들러
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    (window as any)._draggedToolId = id;
  };

  const handleDragEnter = (e: React.DragEvent, targetId: string) => {
    const draggedId = (window as any)._draggedToolId;
    if (draggedId && draggedId !== targetId) {
      onReorderTools?.(draggedId, targetId);
    }
  };

  const renderToolItem = (toolId: string) => {
    const isDraggable = isToolsEditMode && showAllTools;
    const dragHandlers = isDraggable ? {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, toolId),
      onDragEnter: (e: React.DragEvent) => handleDragEnter(e, toolId),
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDragEnd: () => { delete (window as any)._draggedToolId; },
      onMouseDown: (e: React.MouseEvent) => e.stopPropagation()
    } : {
      onMouseDown: (e: React.MouseEvent) => e.stopPropagation()
    };

    const itemClass = `w-[21px] h-[21px] rounded transition-all shrink-0 flex items-center justify-center cursor-pointer ${
      isToolsEditMode 
        ? 'border border-dashed border-amber-500/40 bg-amber-500/5 hover:border-amber-500 cursor-grab active:cursor-grabbing hover:bg-amber-500/10' 
        : 'opacity-70 hover:opacity-100 hover:scale-110 active:scale-95'
    }`;

    switch (toolId) {
      case 'profile':
        if (!onViewDetail) return null;
        return (
          <div 
            key="profile"
            onClick={(e) => { e.stopPropagation(); onViewDetail(student.id); }}
            className={`${itemClass} bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 shadow-sm`}
            title="학생 프로필 서랍 열기"
            {...dragHandlers}
          >
            <User size={13.5} strokeWidth={2.5} />
          </div>
        );
      case 'history':
        return (
          <div 
            key="history"
            onClick={(e) => { e.stopPropagation(); onToggleHistory(student.id); }} 
            className={`${itemClass} ${
              isHistoryExpanded 
                ? 'bg-white text-gray-900 border border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' 
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:text-gray-900 shadow-sm'
            }`} 
            title="이전 기록 보기"
            {...dragHandlers}
          >
            <HistoryIcon size={13.5} strokeWidth={2.5} />
          </div>
        );
      case 'progress':
        if (!onViewProgress) return null;
        return (
          <div 
            key="progress"
            onClick={(e) => { e.stopPropagation(); onViewProgress(student.id); }} 
            className={`${itemClass} bg-indigo-50 text-indigo-700 border border-indigo-300 hover:bg-indigo-100 hover:text-indigo-800 shadow-sm`}
            title="진도표 바로가기"
            {...dragHandlers}
          >
            <TrendingUp size={13.5} strokeWidth={2.5} />
          </div>
        );
      case 'tag':
        return (
          <div 
            key="tag"
            onClick={(e) => {
              e.stopPropagation();
              const currentTag = student.level_tag || '';
              let nextTag = '';
              if (currentTag === '') nextTag = '가';
              else if (currentTag === '가') nextTag = '나';
              else if (currentTag === '나') nextTag = '다';
              else if (currentTag === '다') nextTag = '라';
              else nextTag = '';
              
              if (onUpdateStudentInfo) {
                onUpdateStudentInfo(student.id, 'level_tag', nextTag);
              } else {
                onSave({ level_tag: nextTag });
              }
            }}
            className={`w-[21px] h-[21px] shrink-0 flex items-center justify-center rounded-[4px] cursor-pointer text-[12px] select-none transition-all ${
              isToolsEditMode 
                ? 'border border-dashed border-amber-500/60 bg-amber-500/10 cursor-grab active:cursor-grabbing hover:border-amber-500 text-amber-800 font-bold'
                : `opacity-70 hover:opacity-100 hover:scale-110 active:scale-95 ${
                    student.level_tag === '가' ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-300 shadow-sm" :
                    student.level_tag === '나' ? "bg-blue-50 text-blue-700 font-bold border border-blue-300 shadow-sm" :
                    student.level_tag === '다' ? "bg-amber-50 text-amber-700 font-bold border border-amber-300 shadow-sm" :
                    student.level_tag === '라' ? "bg-rose-50 text-rose-700 font-bold border border-rose-300 shadow-sm" :
                    "bg-white text-[#37352f] font-bold hover:bg-[#edece9]/50 border border-gray-300 shadow-sm"
                  }`
            }`}
            title="클릭하여 태그(가/나/다/라) 변경"
            {...dragHandlers}
          >
            {student.level_tag || '+'}
          </div>
        );
      case 'portal':
        return (
          <div 
            key="portal"
            onClick={(e) => {
              e.stopPropagation();
              const slug = window.location.pathname.split('/')[1];
              window.open(`/${slug}/student?id=${student.id}`, '_blank');
            }}
            className={`${itemClass} bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-100 hover:text-sky-800 shadow-sm`}
            title="학생 페이지 보기"
            {...dragHandlers}
          >
            <ExternalLink size={13.5} strokeWidth={2.5} />
          </div>
        );
      case 'reset':
        return (() => {
          const isSubmittedOrApproved = ['pending', 'approved'].includes(student.todaySession?.approval_status || '');
          const resetItemClass = `w-[21px] h-[21px] rounded-[4px] transition-all shrink-0 flex items-center justify-center cursor-pointer ${
            isToolsEditMode 
              ? 'cursor-grab active:cursor-grabbing hover:scale-110' 
              : 'opacity-75 hover:opacity-100 hover:scale-110 active:scale-95'
          }`;
          return (
            <div 
              key="reset"
              onClick={(e) => {
                e.stopPropagation();
                if (!isSubmittedOrApproved) return;
                if (confirm("이 학생의 제출 상태를 초기화하시겠습니까? (학생이 다시 내용을 수정하고 제출할 수 있습니다.)")) {
                  onSave({ approval_status: 'none' });
                }
              }}
              className={`${resetItemClass} ${
                isSubmittedOrApproved 
                  ? "bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 hover:text-rose-800 cursor-pointer shadow-sm" 
                  : "bg-gray-100/80 text-gray-400 border border-gray-300 opacity-70 cursor-not-allowed"
              }`}
              title={isSubmittedOrApproved ? "학생 제출 리셋 (다시 수정 가능하게 하기)" : "제출 또는 승인 전 상태입니다"}
              {...dragHandlers}
            >
              {isSubmittedOrApproved ? (
                <Unlock size={13.5} strokeWidth={2.5} />
              ) : (
                <Lock size={13.5} strokeWidth={2.5} />
              )}
            </div>
          );
        })();
      case 'delete':
        const isDeleteDraggable = isToolsEditMode && showAllTools;
        return (
          <div 
            key="delete"
            draggable={isDeleteDraggable}
            onDragStart={isDeleteDraggable ? (e) => handleDragStart(e, 'delete') : undefined}
            onDragEnter={isDeleteDraggable ? (e) => handleDragEnter(e, 'delete') : undefined}
            onDragOver={isDeleteDraggable ? (e) => e.preventDefault() : undefined}
            onDragEnd={isDeleteDraggable ? () => { delete (window as any)._draggedToolId; } : undefined}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemoveFromToday?.(student.id, '수업 취소', 'delete');
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            className={`${itemClass} bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 hover:text-rose-800 shadow-sm flex items-center justify-center font-black cursor-pointer`}
            title="Reset & Remove (기록 리셋 / 보강 제외)"
          >
            <span className="text-[10px] tracking-tighter leading-none">R</span>
          </div>
        );
      case 'separator':
        if (!isToolsEditMode) {
          return (
            <div 
              key="separator" 
              onMouseDown={(e) => e.stopPropagation()}
              className="h-5 w-[1px] bg-gray-300 mx-1 self-center shrink-0" 
              title="상시 노출 경계선"
            />
          );
        }
        const isSeparatorDraggable = showAllTools;
        return (
          <div 
            key="separator"
            draggable={isSeparatorDraggable}
            onDragStart={(e) => {
              if (!isSeparatorDraggable) { e.preventDefault(); return; }
              handleDragStart(e, 'separator');
            }}
            onDragEnter={(e) => {
              if (!isSeparatorDraggable) return;
              handleDragEnter(e, 'separator');
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => { delete (window as any)._draggedToolId; }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`w-2.5 h-6 flex items-center justify-center rounded transition-colors shrink-0 select-none mx-0.5 ${
              isSeparatorDraggable 
                ? 'cursor-grab active:cursor-grabbing hover:bg-amber-500/10' 
                : 'cursor-not-allowed opacity-40'
            }`}
            title={isSeparatorDraggable ? "경계선 (드래그하여 상시 노출 개수 조절)" : "도구를 펼쳐야 경계선을 조절할 수 있습니다"}
          >
            <div className={`w-[2px] h-4 bg-amber-500 rounded ${isSeparatorDraggable ? 'animate-pulse' : ''}`} />
          </div>
        );
      default:
        return null;
    }
  };

  const handleOpenNotesPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleCellInteraction(e, 'management_notes', 'click');
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      alert('주의사항 내용을 입력해 주세요.');
      return;
    }
    setIsSavingNote(true);
    try {
      if (onUpdateStudentInfo) {
        await onUpdateStudentInfo(student.id, 'management_notes', noteText.trim());
        setIsNotePopupOpen(false);
      }
    } catch (err) {
      console.error(err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSavingNote(false);
    }
  };

  // 💡 여백 최소화: 무조건 상하 2px (최대 밀집도)
  const getDynamicPadding = (text?: string) => 'pt-[2px] pb-[2px] px-1.5';

  const currentText = colId === 'test_id' ? formData.test_id :
                    colId === 'classwork' ? formData.classwork_text :
                    colId === 'completed_classwork' ? formData.completed_classwork_text :
                    colId === 'assign' ? formData.homework_text :
                    colId === 'next_quiz' ? formData.next_quiz_text :
                    colId === 'mission' ? formData.mission :
                    colId === 'management_notes' ? formData.management_notes :
                    colId === 'notes' ? formData.special_notes : '';

  const dynamicPadding = getDynamicPadding(currentText);

  // 🔒 [추가] 학생이 모바일로 제출하여 승인 대기 상태인지 검사
  const isSubmitted = ['pending', 'submitted'].includes(student.todaySession?.approval_status || '');
  // 보호 대상 컬럼 (진도, 완료된 진도, 과제)
  const isProtectedCol = ['completed_classwork', 'assign'].includes(colId);
  const isLockActive = isSubmitted && isProtectedCol;

  // 📝 [추가] 다른 기기에서 실시간 편집 중인지 판별
  const coopData = cooperatingCells?.[`${student.id}_${colId}`];
  const isCooperating = !!coopData;

  const handleLockedCellDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    alert("아직 승인되지 않은 학생 제출본이 있습니다. 우측 알림창이나 툴박스에서 승인 버튼을 누르시면 학생이 쓴 내용이 일지에 자동으로 입력되며, 입력이 완료된 후에 직접 내용을 확인하고 수정하실 수 있습니다.");
  };

  // 💡 [최적화] 텍스트가 변경되거나 편집 모드 진입 시 즉시 높이 조절 및 포커스 지연 제거
  React.useLayoutEffect(() => {
    const refs = [testRef, cwRef, ccwRef, hwRef, nqRef, missionRef, notesRef, managementNotesRef];
    refs.forEach(ref => {
      if (ref?.current && (isEditing || isActive)) {
        ref.current.style.height = 'auto';
        ref.current.style.height = `${ref.current.scrollHeight}px`;
        // 💡 편집 모드일 때만 즉시 포커스 (속도 향상 핵심)
        if (isEditing) ref.current.focus();
      }
    });
  }, [isEditing, isActive, currentText]);

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
  const textColClass = colId === 'mission' ? 'text-amber-700 font-bold' : 'text-[#37352f] font-medium';
  const commonTextStyle = `w-full text-[12px] leading-[14px] text-left ${textColClass} ${dynamicPadding} m-0 border-0 outline-none box-border appearance-none scrollbar-hide`;
  const renderHighlightedText = (text: string, columnId: string) => {
    if (!text) return '-';
    
    const isTestField = columnId === 'test_id' || columnId === 'next_quiz';
    const isTaskField = columnId === 'classwork' || columnId === 'completed_classwork' || columnId === 'assign' || columnId === 'mission' || columnId === 'notes' || columnId === 'management_notes';
    
    if (!isTestField && !isTaskField) return text;
    
    return text.split('\n').map((line, i) => {
      const isLast = i === text.split('\n').length - 1;
      
      if (isTestField) {
        if (!line.trim().startsWith('-')) return <React.Fragment key={i}>{line}{!isLast && '\n'}</React.Fragment>;
        
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) return <React.Fragment key={i}>{line}{!isLast && '\n'}</React.Fragment>;
        
        const beforeColon = line.substring(0, colonIdx + 1);
        const afterColon = line.substring(colonIdx + 1);
        
        const commaIdx = afterColon.indexOf(',,');
        const scorePart = commaIdx !== -1 ? afterColon.substring(0, commaIdx) : afterColon;
        const memoPart = commaIdx !== -1 ? afterColon.substring(commaIdx + 1) : '';
        
        const highlightScore = (str: string) => {
          if (!str.includes('/')) return <span className="text-emerald-600 font-bold">{str}</span>;
          
          const parts = str.split('/');
          return (
            <span className="font-semibold">
              <span className="text-emerald-600 font-bold">{parts[0]}</span>
              {parts.length > 1 && (
                <>
                  <span className="text-gray-400 mx-0.5">/</span>
                  <span className="text-blue-600 font-bold">{parts[1]}</span>
                </>
              )}
              {parts.length > 2 && (
                <>
                  <span className="text-gray-400 mx-0.5">/</span>
                  <span className="text-rose-600 font-bold">{parts[2]}</span>
                </>
              )}
              {parts.slice(3).map((p, idx) => (
                <React.Fragment key={idx}>
                  <span className="text-gray-400 mx-0.5">/</span>
                  <span className="text-gray-700 font-semibold">{p}</span>
                </React.Fragment>
              ))}
            </span>
          );
        };

        return (
          <React.Fragment key={i}>
            <span>{beforeColon}</span>
            {highlightScore(scorePart)}
            <span className="text-gray-500 italic">{memoPart}</span>
            {!isLast && '\n'}
          </React.Fragment>
        );
      }
      
      if (isTaskField) {
        // - 또는 * 기호로 시작하는지 감지
        const match = line.match(/^(\s*[-*+•]\s*)(.*)$/);
        
        if (!match) {
          // 불릿 없는 일반 줄도 ,, 메모 분리 적용
          const plainCommaIdx = line.indexOf(',,');
          if (plainCommaIdx === -1) return <React.Fragment key={i}>{line}{!isLast && '\n'}</React.Fragment>;
          const plainContent = line.substring(0, plainCommaIdx);
          const plainMemo = line.substring(plainCommaIdx + 2);
          return (
            <React.Fragment key={i}>
              <span>{plainContent}</span>
              <span className="text-amber-600/90 font-semibold italic ml-0.5">{plainMemo}</span>
              {!isLast && '\n'}
            </React.Fragment>
          );
        }
        
        const bulletStr = match[1];
        const rest = match[2];
        const commaIdx = rest.indexOf(',,');
        
        if (commaIdx === -1) {
          return (
            <React.Fragment key={i}>
              <span className="text-blue-600 font-bold">{bulletStr}</span>
              <span>{rest}</span>
              {!isLast && '\n'}
            </React.Fragment>
          );
        } else {
          const contentStr = rest.substring(0, commaIdx);
          const memoStr = rest.substring(commaIdx + 2);
          return (
            <React.Fragment key={i}>
              <span className="text-blue-600 font-bold">{bulletStr}</span>
              <span className="font-medium text-[#37352f]/90">{contentStr}</span>
              <span className="text-amber-600/90 font-semibold italic ml-0.5">{memoStr}</span>
              {!isLast && '\n'}
            </React.Fragment>
          );
        }
      }
    });
  };

  return (
    <td 
      ref={tdRef}
      style={styles} 
      tabIndex={0}
      data-col-id={colId}
      className={`border-r border-white/12 relative group/td outline-none align-top ${
        isFirstInTimeSection ? 'border-t-[3px] border-t-blue-500/60 shadow-[inset_0_1px_0_rgba(59,130,246,0.2)]' : ''
      } ${isActive ? 'ring-2 ring-inset ring-blue-500 z-30' : isInRange ? 'ring-1 ring-inset ring-blue-500/50' : ''} ${
        isLockActive ? 'bg-amber-50/50 border border-dashed border-amber-300/60 cursor-not-allowed' : ''
      } ${
        isCooperating ? 'ring-2 ring-inset ring-pink-400 z-30 cursor-not-allowed bg-pink-50/[0.04]' : ''
      }`}
      onMouseDown={(e) => {
        if (isCooperating) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        // 💡 마우스 다운 시점의 활성화 상태를 기록
        wasAlreadyActive.current = isActive;
        onCellMouseDown(e, student.id, colId);
      }}
      onMouseEnter={() => {
        if (isCooperating) return;
        onCellMouseEnter(student.id, colId);
      }}
      onClick={(e) => {
        if (isCooperating) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (wasAlreadyActive.current) {
          // 💡 이미 선택된 상태였던 셀을 천천히 다시 누른 것이 맞다면 편집 모드로 승격
          handleCellInteraction(e, colId, 'dblclick');
        } else {
          handleCellInteraction(e, colId, 'click');
        }
        wasAlreadyActive.current = false; // 리셋
      }}
      onDoubleClick={(e) => {
        if (isLockActive) {
          handleLockedCellDoubleClick(e);
        } else if (isCooperating) {
          e.stopPropagation();
          const confirmForceEdit = window.confirm("다른 조교가 이미 편집 중인 셀입니다. 강제로 편집 권한을 가져오시겠습니까?");
          if (confirmForceEdit) {
            handleCellInteraction(e, colId, 'dblclick');
          }
        } else {
          handleCellInteraction(e, colId, 'dblclick');
        }
      }}
      onKeyDown={(e) => {
        const navigationKeys = [
          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
          'Tab', 'Escape', 'Shift', 'Control', 'Alt', 'Meta',
          'Backspace', 'Delete'
        ];
        if (isLockActive && !navigationKeys.includes(e.key)) {
          e.preventDefault();
          if (e.key === 'Enter') {
            handleLockedCellDoubleClick(e as any);
          }
        } else if (isCooperating && !navigationKeys.includes(e.key)) {
          e.preventDefault();
          if (e.key === 'Enter') {
            e.stopPropagation();
            const confirmForceEdit = window.confirm("다른 조교가 이미 편집 중인 셀입니다. 강제로 편집 권한을 가져오시겠습니까?");
            if (confirmForceEdit) {
              handleCellInteraction(e as any, colId, 'dblclick');
            }
          }
        } else {
          handleKeyDown(e, colId);
        }
      }}
    >
      {!isEditing && !isActive && !['select', 'action', 'attendance', 'name', 'tools', 'review'].includes(colId) && (
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
                  className="hidden group-hover/select:flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-600/10 text-[9px] font-normal text-gray-400 hover:text-blue-400 transition-colors"
                >
                  {(rowIndex ?? 0) + 1}
                </button>
              </>
            )}
          </div>
        )}

        {colId === 'date' && (
          <div className="flex flex-col gap-0.5 items-center justify-center py-1 w-full min-h-[22px]">
            <span className="font-normal text-gray-500 text-[10px] tabular-nums">{displayDateShort}</span>
          </div>
        )}

        {colId === 'tools' && isFirstInTimeSection && timeSectionLabel && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] pointer-events-none select-none">
            <span className="px-1.5 py-0.5 rounded bg-blue-600/95 backdrop-blur-sm text-[8.5px] font-normal text-white tracking-widest uppercase shadow-[0_4px_12px_rgba(37,99,235,0.6)] border border-blue-400/40 whitespace-nowrap">
              {timeSectionLabel}
            </span>
          </div>
        )}

        {colId === 'name' && (
          <div className="flex items-center justify-start gap-2 px-1.5 py-1 w-full min-h-[22px] relative group/namecell">
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">

                {(() => {
                  const teacherInitial = student.teacher_initial || '?';
                  if (student.isSpecialClass) {
                    const elective = student.electiveCourse;
                    const daysArr = Array.isArray(elective?.days)
                      ? elective.days
                      : (Array.isArray(elective?.class_days) ? elective.class_days : []);

                    const sortedElectiveDays = daysArr
                      .map((d: any) => String(d).replace('요일', '').trim())
                      .sort((a: string, b: string) => {
                        const order: Record<string, number> = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                        return (order[a] || 0) - (order[b] || 0);
                      })
                      .join('');

                    const daysStr = sortedElectiveDays || (student.class_days || []).join('').replace(/요일/g, '') || '무';
                    return (
                      <span className="text-[13px] font-medium text-[#37352f] truncate transition-colors">
                        <span className="text-amber-800">특강-</span>
                        {student.name}-{teacherInitial}-{daysStr}
                      </span>
                    );
                  } else {
                    const sortedDays = (student.class_days || []).slice().sort((a: string, b: string) => {
                      const order: Record<string, number> = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                      return (order[a] || 0) - (order[b] || 0);
                    }).join('');
                    return (
                      <span className="text-[13px] font-medium text-[#37352f] truncate transition-colors">
                        {student.name}-{teacherInitial}-{sortedDays || '무'}
                      </span>
                    );
                  }
                })()}
              </div>
              <div className="flex items-center gap-1 text-[9px] font-normal uppercase tracking-tighter truncate">
                <span className="text-pink-600 font-bold">{student.school}</span>
                <span className="text-gray-600">·</span>
                <span className={
                  (student.grade || '').includes('초') ? 'text-emerald-600 font-bold' :
                  (student.grade || '').includes('중') ? 'text-blue-600 font-bold' :
                  (student.grade || '').includes('고') ? 'text-amber-600 font-bold' :
                  'text-gray-500'
                }>{student.grade}</span>
              </div>
            </div>
          </div>
        )}

        {colId === 'tools' && (
          <div className="flex items-center justify-center gap-1 px-1 py-1 w-full min-h-[22px] relative group/tools">
            {/* 우측 상단: 학생 주의사항 (노란색 스티커 마우스오버 툴팁) */}
            <div className="absolute top-0 right-0">
              <div 
                className="group/note relative cursor-pointer z-[60]"
                onClick={(e) => handleOpenNotesPopup(e)}
                onMouseEnter={(e) => {
                  if (student.management_notes) {
                    handleOpenTooltip(e, 'note');
                  }
                }}
                onMouseLeave={() => setActiveTooltip(null)}
                tabIndex={0}
              >
                <div className={`w-0 h-0 border-t-[16px] border-l-[16px] border-l-transparent transition-all ${
                  student.management_notes 
                    ? 'border-t-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]' 
                    : 'border-t-white/10 hover:border-t-amber-500/40'
                }`} />
                
                {/* 마우스 오버 말풍선 (주의사항 컬럼이 닫혀있어도 확인 가능) */}
                {activeTooltip === 'note' && student.management_notes && createPortal(
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
                      className="w-80 p-5 bg-amber-50 text-amber-950 text-[13px] font-normal rounded-lg shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-2 border-amber-200 ring-4 ring-black/20 pointer-events-none"
                    >
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200">
                        <AlertTriangle size={14} className="text-amber-600 animate-bounce" />
                        <span className="text-[10px] uppercase tracking-widest text-amber-600 font-normal">Student Management Alert</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-[14px]">"{student.management_notes}"</p>
                    </motion.div>
                  </AnimatePresence>,
                  document.body
                )}
              </div>
            </div>

            {/* 좌측 상단: 건의사항 (파란색) */}
            {student.suggestions && student.suggestions.length > 0 && (
              <div className="absolute top-0 left-0">
                <div 
                  className="group/suggestion relative cursor-pointer z-[60]"
                  onMouseEnter={(e) => handleOpenTooltip(e, 'suggestion')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onFocus={(e) => handleOpenTooltip(e, 'suggestion')}
                  onBlur={() => setActiveTooltip(null)}
                  tabIndex={0}
                >
                  <div className="w-0 h-0 border-t-[14px] border-t-blue-500 border-r-[14px] border-r-transparent shadow-md" />
                  
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
                        className="w-80 p-4 bg-blue-50 text-blue-950 text-[13px] font-normal rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-2 border-blue-200 pointer-events-none"
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
              </div>
            )}

            {/* 💡 정렬된 도구 아이템 렌더링 */}
            {(() => {
              const order = toolsOrder || ['profile', 'history', 'progress', 'separator', 'tag', 'portal', 'reset', 'delete'];
              const isExpanded = showAllTools;
              
              const itemsToRender: React.ReactNode[] = [];
              
              for (const toolId of order) {
                if (!isExpanded && toolId === 'separator') {
                  break;
                }
                const item = renderToolItem(toolId);
                if (item) itemsToRender.push(item);
              }
              
              return itemsToRender;
            })()}
          </div>
        )}

        {colId === 'attendance' && (() => {
          const hasExplicitStatus = formData.attendance_status && [
            ATTENDANCE_STATUS.PRESENT, 
            ATTENDANCE_STATUS.ABSENT, 
            ATTENDANCE_STATUS.LATE, 
            ATTENDANCE_STATUS.EXCLUDED, 
            ATTENDANCE_STATUS.CANCELED
          ].includes(formData.attendance_status as any);
          
          const isSupplement = (formData.attendance_status === '보강') || 
            (!hasExplicitStatus && formData.moved_to_hour !== null && formData.moved_to_hour !== undefined);
          const statusText = isSupplement ? '보강' : (formData.attendance_status || ATTENDANCE_STATUS.BEFORE);
          
          return (
            <div onClick={onAttendanceClick} className={`absolute inset-0 w-full h-full flex items-center justify-between px-3 text-[11px] cursor-pointer select-none transition-colors hover:bg-[#edece9]/30 z-30 ${
              isSupplement ? 'text-blue-600 font-semibold' :
              statusText === ATTENDANCE_STATUS.BEFORE ? 'text-[#37352f]/65 font-normal' :
              statusText.startsWith(ATTENDANCE_STATUS.PRESENT) ? 'text-emerald-600 font-semibold' : 
              statusText.startsWith(ATTENDANCE_STATUS.ABSENT) ? 'text-rose-600 font-bold' : 
              'text-amber-600 font-bold'
            }`}>
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span>{statusText}</span>
                {formData.moved_to_hour && (
                  <span className="text-[9.5px] font-bold bg-blue-50 text-blue-650 px-1 rounded border border-blue-200 shrink-0">
                    {formData.moved_to_hour}시
                  </span>
                )}
              </div>

              {/* 💡 [원장님 기획 완벽 구현] 라이트 모드 동적 결석 또는 지각 사유 📝 연필 단추 및 스마트 프리펜드 */}
              {(statusText.startsWith(ATTENDANCE_STATUS.ABSENT) || statusText.startsWith(ATTENDANCE_STATUS.LATE)) && (
                (() => {
                  const isAbsent = statusText.startsWith(ATTENDANCE_STATUS.ABSENT);
                  const labelType = isAbsent ? '결석' : '지각';
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // 💥 클릭 시 출결이 다른 상태로 돌아가는 전파 차단!
                        const currentReason = formData.attendance_reason || student.todaySession?.attendance_reason || '';
                        const newReason = prompt(`[${student.name}] 학생의 ${labelType} 사유를 입력해 주세요:`, currentReason);
                        if (newReason !== null) {
                          const cleanReason = newReason.trim();
                          
                          if (isAbsent) {
                            // 결석일 때는 수행진도 자리에 프리펜드 치환 진행
                            const autoProgressText = cleanReason ? `결석 (${cleanReason})` : '결석';
                            const currentProgress = (formData.completed_classwork_text || student.todaySession?.completed_classwork_text || '').trim();
                            
                            let finalProgressText = '';
                            if (!currentProgress) {
                              finalProgressText = autoProgressText;
                            } else {
                              const lines = currentProgress.split('\n');
                              if (lines[0].startsWith('결석')) {
                                lines[0] = autoProgressText;
                                finalProgressText = lines.join('\n');
                              } else {
                                finalProgressText = `${autoProgressText}\n${currentProgress}`;
                              }
                            }
                            
                            onSave({ 
                              attendance_reason: cleanReason,
                              completed_classwork_text: finalProgressText
                            });
                          } else {
                            // 지각일 때는 수행진도를 전혀 터치하지 않고, 오직 출결 사유 필드만 저장!
                            onSave({ 
                              attendance_reason: cleanReason
                            });
                          }
                        }
                      }}
                      className={`p-1 rounded transition-all flex items-center justify-center shrink-0 shadow-sm ml-1 border ${
                        isAbsent 
                          ? 'bg-red-50 hover:bg-red-100 text-rose-500 border border-red-200' 
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200'
                      }`}
                      title={
                        formData.attendance_reason 
                          ? `${labelType} 사유: ${formData.attendance_reason} (클릭하여 수정)` 
                          : `클릭하여 ${labelType} 사유 입력`
                      }
                    >
                      <Edit3 size={11} strokeWidth={2.5} />
                    </button>
                  );
                })()
              )}
            </div>
          );
        })()}

        {colId === 'review' && (
          <div className="relative w-full h-full flex items-start justify-between bg-blue-50/40 border-l-2 border-l-blue-300 py-1 px-2 gap-2">
            <div className="flex-1 text-left min-w-0">
              {student.lastSession?.homework_text ? (
                <div className="text-[12px] font-medium text-blue-900 leading-[1.15] italic whitespace-pre-wrap break-all">
                  {student.lastSession.homework_text.split(/\n\s*\n/).map((para: string, i: number, arr: string[]) => (
                    <span key={i} className={`block ${i !== arr.length - 1 ? 'mb-1.5' : ''}`}>
                      {i === 0 && <span className="text-blue-600 text-[14px] font-bold mr-1 align-top leading-[1.15]">"</span>}
                      {para.split(/(\([월화수목금토일]\))/g).map((part, j) => 
                        part.match(/^\([월화수목금토일]\)$/) ? <span key={j} className="text-amber-600 font-bold">{part}</span> : part
                      )}
                      {i === arr.length - 1 && <span className="text-blue-600 text-[14px] font-bold ml-1 align-bottom leading-[1.15]">"</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="italic opacity-30 text-gray-500 font-medium text-[11px] px-2">기존 숙제 없음</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {student.lastSession?.homework_text && (() => {
                const attStatus = student.todaySession?.attendance_status || '';
                const isPresent = ['출석', '지각'].some(st => attStatus.startsWith(st));
                // 💡 [수정] 정규 수업일 판단: 내부 formData.isTodayClassDay(요일 기반)를 확실히 신뢰
                const isRegularClass = formData.isTodayClassDay === true;
                
                // 💡 [수정] 정규 수업일에 '보강'으로 표시되어도 이는 단순 '시간 이동'이므로 보충(Supplement)이 아님
                const isSupplement = attStatus.startsWith('보강') && !isRegularClass;
                
                const hasAttendance = isPresent || isSupplement || attStatus !== '';
                if (!hasAttendance) return null;

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
                      className={`relative z-30 shrink-0 px-2 py-0.5 rounded text-[9.5px] font-normal tracking-tighter border transition-colors ${
                        isChecked
                          ? 'bg-blue-500/20 text-blue-700 border-blue-500/40 hover:bg-blue-500/30'
                          : 'bg-[#f8f8f7] text-[#37352f]/60 border-[#edece9] hover:bg-[#efeeee] hover:text-[#37352f]'
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
                      className="absolute right-full top-0 mr-2 flex gap-1 bg-white p-1 rounded-md border border-[#edece9] shadow-2xl z-[100]">
                      {(['gradeA', 'gradeB', 'gradeC', 'gradeD', 'gradeE', 'gradeF'] as const).map((k) => (
                        <button key={k} onClick={(e) => { e.stopPropagation(); onSelectFeedback(k); }} className={`w-7 h-7 rounded-[2px] flex items-center justify-center text-[10px] font-normal transition-all hover:scale-110 ${statusMap[k].color} shadow-md`}>{statusMap[k].label}</button>
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
        {(['mission', 'notes', 'management_notes'].includes(colId)) && (
          <SimpleTextCell 
            ref={colId === 'mission' ? missionRef : colId === 'notes' ? notesRef : managementNotesRef}
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
            
            {/* 🔒 [추가] 실시간 승인 대기 보호 셀 시각 뱃지 */}
            {isLockActive && !isEditing && !isActive && (
              <div className="absolute right-1 top-1 z-30 flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-300/50 px-1 py-[1px] rounded-[3px] text-[9px] font-medium animate-pulse select-none">
                <Lock size={8} className="stroke-[2.5]" />
                승인대기
              </div>
            )}



            {/* 💡 [수정] isActive일 때도 textarea를 유지하여 줄바꿈 시 내용 가려짐 방지 */}
            {(isEditing || isActive) && (
              <textarea 
                ref={colId === 'test_id' ? testRef : colId === 'classwork' ? cwRef : colId === 'completed_classwork' ? ccwRef : colId === 'assign' ? hwRef : nqRef} 
                defaultValue={currentText || ''} 
                data-student-id={student.id}
                data-col-id={colId}
                onFocus={(e) => {
                  // 💡 포커스를 얻는 순간 (천천히 클릭하여 입력 모드 진입 포함) 락 브로드캐스트 활성화
                  handleCellInteraction(e as any, colId, 'dblclick');
                }}
                onKeyDown={(e) => {
                  if (((e.ctrlKey || e.metaKey) && e.key === '/') || (e.altKey && e.key === 'Enter')) {
                    e.preventDefault();
                    if (colId === 'classwork') onOpenCwEditor?.();
                    else if (colId === 'completed_classwork') onOpenCcwEditor?.();
                    else if (colId === 'assign') onOpenHwEditor?.();
                    return;
                  }
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
            
            {/* 💡 편집 중이 아닐 때만 뷰 모드 텍스트 노출 (하이라이팅 적용) */}
            {!isEditing && !isActive && (
              <div className={`${commonTextStyle} whitespace-pre-wrap min-h-[22px] flex flex-col items-start justify-start w-full`}>
                <div className="w-full">
                  {currentText ? renderHighlightedText(currentText, colId) : (
                    isLockActive ? (
                      <span className="text-amber-600/50 text-[11px] font-normal italic select-none">
                        ⏳ 승인을 누르면 내용이 입력됩니다
                      </span>
                    ) : isCooperating ? (
                      <span className="text-pink-600/50 text-[11px] font-normal italic select-none">
                        📝 다른 기기에서 입력하고 있습니다
                      </span>
                    ) : '-'
                  )}
                </div>
              </div>
            )}
            
            <div className="absolute right-1 top-1 flex items-center gap-1 opacity-30 group-hover/cell:opacity-100 focus-within:opacity-100 transition-all duration-200 z-30">
              {(colId === 'classwork' || colId === 'completed_classwork' || colId === 'assign') && (
                <button onClick={colId === 'classwork' ? onOpenCwEditor : colId === 'completed_classwork' ? onOpenCcwEditor : onOpenHwEditor} className="w-5 h-5 rounded-[4px] bg-blue-50 text-blue-650 border border-blue-200 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><Wand2 size={12} strokeWidth={2.5} /></button>
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
            defaultScoreCut={defaultScoreCut}
            defaultCountCut={defaultCountCut}
          />
        )}
      </div>
      )}
    </td>
  );
});
