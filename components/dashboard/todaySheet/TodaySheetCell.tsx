'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, History as HistoryIcon, TrendingUp, X, Percent, ArrowLeft, Hash, FileText, ClipboardCheck, ClipboardList, Wand2, Loader2, ArrowLeftRight, CheckCircle, MessageSquare, Clock, Circle, AlertCircle, AlertTriangle, ExternalLink, User, Lock, Trash2, Unlock, Edit3, RefreshCw, Settings2
} from 'lucide-react';
import { Student, TextbookOption, StudentStatus, AbsenceLinkContext } from '@/types/dashboard';
import { getDayOfWeek, getCoursePrefix, parseBookCourseValue, getTodayStr } from '@/lib/utils';
import { isValidHomeworkText } from '@/lib/studentDataEnricher';
import { ATTENDANCE_STATUS } from '@/lib/sessionFieldMap';
import { ScoreCell } from './cells/ScoreCell';
import { SimpleTextCell } from './cells/SimpleTextCell';
import { FeedbackKeyboardPopup } from './FeedbackKeyboardPopup';
import TextbookSystem from '@/components/student/TextbookSystem';
import { CellTextHighlighter } from './CellTextHighlighter';
import { CellTooltip } from './CellTooltip';
import { useTodaySheetCellEditor } from '../hooks/useTodaySheetCellEditor';
import { useModalEsc } from '@/hooks/useModalEsc';

export const resolveTargetSession = (student?: any, hour?: number | null, courseName?: string) => {
  if (!student) return undefined;
  if (Array.isArray(student.todaySessions) && student.todaySessions.length > 0) {
    if (hour !== undefined && hour !== null) {
      const matchByHour = student.todaySessions.find((s: any) => s.moved_to_hour === hour);
      if (matchByHour) return matchByHour;
    }
    if (courseName) {
      const matchByCourse = student.todaySessions.find((s: any) => s.course_name === courseName);
      if (matchByCourse) return matchByCourse;
    }
    return student.todaySessions[0];
  }
  return student.todaySession;
};

export interface TodaySheetCellProps {
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
  isLight?: boolean;

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
  registerFlushDraft?: (fn: (() => void) | null) => void;
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
  onSave: (data?: any, directValue?: any, options?: any) => Promise<boolean>;
  onInputChange?: (field: string, value: string) => void;
  rowIndex?: number;
  onApplyTestPreset?: (preset: any, colId: 'test_id' | 'next_quiz') => void;
  onUpdateStudentInfo?: (id: string, fieldOrUpdates: any, value?: any) => Promise<any>;
  masterTextbooks?: any[];
  cooperatingCells?: Record<string, { colId: string, clientId: string, timestamp: number, lockVersion?: number }>; // 📝 [추가] 실시간 협업 편집 중인 셀 맵
  myClientId?: string;
  onForceTakeover?: (studentId: string, colId: string) => void;
  onRemoveFromToday?: (
    id: string,
    reason: string,
    mode?: 'delete' | 'cancel',
    sessionMeta?: {
      courseName?: string;
      sessionId?: string;
      movedToHour?: number | null;
      isMakeup?: boolean;
    }
  ) => Promise<void>;
  toolsOrder?: string[];
  isToolsEditMode?: boolean;
  showAllTools?: boolean;
  onReorderTools?: (draggedId: string, targetId: string) => void;
  isOtherClassSection?: boolean;
  onTimePickerClick?: (e: React.MouseEvent) => void;
  onSnapshotModalClick?: (student: Student, session: any) => void;
  selectedDate?: string;
  onNavigateTab?: (mode: string | AbsenceLinkContext) => void;
  onRefreshAbsenceSession?: (context: {
    studentId: string;
    sessionDate: string;
    courseName: string;
    movedToHour: number | null;
  }) => Promise<boolean>;
}

export const TodaySheetCell = React.memo(function TodaySheetCell({
  col, styles, student, formData, isEditing, isActive, isInRange, isSelected,
  isCompleted, saveStatus, isSaving, isHistoryExpanded, displayDateShort, statusMap,
  testRef, cwRef, ccwRef, hwRef, nqRef, missionRef, notesRef, managementNotesRef, tdRef, scoreInputRef,
  onSelectOne, onToggleHistory, onViewProgress, onViewDetail, handleCellInteraction, handleKeyDown,
  onCellMouseDown, registerFlushDraft, onCellMouseEnter, onAttendanceClick, onTestScoreTypeToggle,
  onFeedbackToggle, isFeedbackOpen, onSelectFeedback, onCloseFeedback,
  onOpenCwEditor, onOpenCcwEditor, onOpenHwEditor, onOpenNqEditor, onOpenTestEditor, onOpenTestModal,
  onOpenPdf, onExecuteTest, onSetNextQuizCut, onSetTodayTestCut, onSetNextQuizTrial, onSave,
  onInputChange,
  rowIndex,
  snippets,
  snippetTrigger,
  isFirstInTimeSection,
  timeSectionLabel,
  testPresets,
  onApplyTestPreset,
  onUpdateStudentInfo,
  masterTextbooks,
  defaultScoreCut = 80,
  defaultCountCut = 2,
  selectedDate,
  cooperatingCells,
  myClientId,
  onForceTakeover,
  onRemoveFromToday,
  toolsOrder,
  isToolsEditMode = false,
  showAllTools = false,
  onReorderTools,
  isOtherClassSection,
  onTimePickerClick,
  onSnapshotModalClick,
  isLight = false,
  onNavigateTab,
  onRefreshAbsenceSession
}: TodaySheetCellProps) {

  const wasAlreadyActive = useRef(false);
  const colId = col.id;

  // 💡 [추가] 관리 주의점(management_notes) 퀵 팝업 에디터 상태
  const [isNotePopupOpen, setIsNotePopupOpen] = useState(false);
  const [noteText, setNoteText] = useState(student.management_notes || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // 💡 [추가] 결석 사유 및 후속 보강 확인 팝오버 상태
  const [isAbsencePopupOpen, setIsAbsencePopupOpen] = useState(false);
  const [absenceReasonInput, setAbsenceReasonInput] = useState('');
  const [isSavingAbsenceReason, setIsSavingAbsenceReason] = useState(false);
  const [absenceRefreshError, setAbsenceRefreshError] = useState(false);

  // 💡 [공통 Esc 키 닫기]
  useModalEsc({
    isOpen: isAbsencePopupOpen,
    onClose: () => setIsAbsencePopupOpen(false),
    isSaving: isSavingAbsenceReason
  });

  useModalEsc({
    isOpen: isNotePopupOpen,
    onClose: () => setIsNotePopupOpen(false),
    isSaving: isSavingNote
  });

  // 💡 [추가] 교재 클릭 시 단원/페이지 드로어 모달 상태
  const [selectedBookForDrawer, setSelectedBookForDrawer] = useState<string | null>(null);

  // 💡 [교재 저장 버퍼] TextbookSystem에 전달할 ccw/hw 최신값을 독립 ref로 관리
  const ccwBookBuf = useRef(formData?.completed_classwork_text ?? student.todaySession?.completed_classwork_text ?? '');
  const hwBookBuf = useRef(formData?.homework_text ?? student.todaySession?.homework_text ?? '');

  // 부모 state 동기화: 부모 값이 갱신되었을 때, 현재 버퍼보다 신규 내용(더 긴 텍스트 또는 포함 관계)이 있으면 반영하되 이전 입력값을 지우지 않음
  const incomingCcw = formData?.completed_classwork_text ?? student.todaySession?.completed_classwork_text ?? '';
  const incomingHw = formData?.homework_text ?? student.todaySession?.homework_text ?? '';

  useEffect(() => {
    ccwBookBuf.current = incomingCcw;
  }, [incomingCcw]);

  useEffect(() => {
    hwBookBuf.current = incomingHw;
  }, [incomingHw]);

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

    const itemClass = `w-[21px] h-[21px] rounded-[4px] transition-all shrink-0 flex items-center justify-center cursor-pointer ${
      isToolsEditMode
        ? 'border border-dashed border-amber-500 bg-amber-500/10 cursor-grab active:cursor-grabbing hover:border-amber-500'
        : 'opacity-75 hover:opacity-100 hover:scale-110 active:scale-95'
    }`;

    switch (toolId) {
      case 'profile':
        if (!onViewDetail) return null;
        return (
          <div
            key="profile"
            onClick={(e) => { e.stopPropagation(); onViewDetail(student.id); }}
            className={`${itemClass} ${isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-600 hover:text-white shadow-sm' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/40 hover:text-emerald-200 shadow-sm'}`}
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
                ? (isLight ? 'bg-blue-600 text-white border border-blue-600 shadow-md' : 'bg-white text-gray-900 border border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]')
                : (isLight ? 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:text-black shadow-sm' : 'bg-white/20 text-gray-300 border border-white/10 hover:bg-white/30 hover:text-white shadow-sm')
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
            className={`${itemClass} ${isLight ? 'bg-indigo-50 text-indigo-700 border border-indigo-300 hover:bg-indigo-600 hover:text-white shadow-sm' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/40 hover:text-indigo-200 shadow-sm'}`}
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
                ? (isLight ? 'border border-dashed border-amber-500 bg-amber-50 cursor-grab active:cursor-grabbing text-amber-800 font-bold' : 'border border-dashed border-amber-500/60 bg-amber-500/10 cursor-grab active:cursor-grabbing hover:border-amber-500 text-amber-300 font-black')
                : `opacity-90 hover:opacity-100 hover:scale-110 active:scale-95 ${
                    student.level_tag === '가' ? (isLight ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-300" : "bg-emerald-500/20 text-emerald-300 font-black border border-emerald-400/80") :
                    student.level_tag === '나' ? (isLight ? "bg-blue-50 text-blue-800 font-bold border border-blue-300" : "bg-blue-500/20 text-blue-300 font-black border border-blue-400/80") :
                    student.level_tag === '다' ? (isLight ? "bg-amber-50 text-amber-800 font-bold border border-amber-300" : "bg-amber-500/20 text-amber-300 font-black border border-amber-400/80") :
                    student.level_tag === '라' ? (isLight ? "bg-red-50 text-red-800 font-bold border border-red-300" : "bg-red-500/20 text-red-300 font-black border border-red-400/80") :
                    (isLight ? "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-dashed border-gray-300" : "bg-white/5 text-gray-400 hover:bg-white/10 border border-dashed border-white/10")
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
            className={`${itemClass} ${isLight ? 'bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-600 hover:text-white shadow-sm' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/40 hover:text-sky-200 shadow-sm'}`}
            title="학생 페이지 보기"
            {...dragHandlers}
          >
            <ExternalLink size={13.5} strokeWidth={2.5} />
          </div>
        );
      case 'timeshift':
        return (
          <div
            key="timeshift"
            onClick={(e) => {
              e.stopPropagation();
              onTimePickerClick?.(e);
            }}
            className={`${itemClass} ${isLight ? 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-600 hover:text-white shadow-sm' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/40 hover:text-purple-200 shadow-sm'}`}
            title="수업시간 / 교시 이동"
            {...dragHandlers}
          >
            <ArrowLeftRight size={12.5} strokeWidth={2.5} />
          </div>
        );
      case 'snapshot':
        const targetCellDate = selectedDate || formData?.session_date || formData?.date || student.todaySession?.session_date || student.todaySession?.date || '';
        const isPastDate = !!(targetCellDate && targetCellDate < getTodayStr());
        const hasPersistedLog = !!(student.todaySession?.id && student.todaySession.id !== 'temp' && !String(student.todaySession.id).startsWith('temp:'));
        const isSnapshotEditable = isPastDate && hasPersistedLog;

        const snapshotTitle = !isPastDate
          ? "스냅샷 수정은 과거 수업 기록에서만 가능합니다"
          : (!hasPersistedLog
            ? "저장된 일지가 없어 스냅샷을 수정할 수 없습니다"
            : "과거 수업 정보 및 스냅샷 수정");

        return (
          <div
            key="snapshot"
            onClick={(e) => {
              e.stopPropagation();
              if (!isSnapshotEditable) return;
              onSnapshotModalClick?.(student, student.todaySession);
            }}
            className={`${itemClass} ${
              isSnapshotEditable
                ? (isLight ? 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-600 hover:text-white shadow-sm' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/40 hover:text-blue-200 shadow-sm')
                : (isLight ? 'bg-gray-100 text-gray-300 border border-gray-200 opacity-40 cursor-not-allowed' : 'bg-white/5 text-gray-500 border border-white/10 opacity-40 cursor-not-allowed')
            }`}
            title={snapshotTitle}
            {...dragHandlers}
          >
            <Settings2 size={13} strokeWidth={2.5} />
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
                  ? (isLight ? "bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-600 hover:text-white cursor-pointer shadow-sm animate-pulse" : "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/40 hover:text-rose-200 cursor-pointer shadow-sm animate-pulse")
                  : (isLight ? "bg-gray-100 text-gray-400 border border-gray-200 opacity-70 cursor-not-allowed" : "bg-white/10 text-gray-400 border border-white/20 opacity-70 cursor-not-allowed")
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
            }}
            onClick={async (e) => {
              e.stopPropagation();
              e.preventDefault();

              // 💡 [단일 세션 정밀 식별 메타데이터 추출]
              const sAny = student as any;
              const courseName = student.courseName ||
                (sAny?.isSpecialClass ? (sAny?.electiveCourse?.subject || student.electiveCourse?.subject) : undefined) ||
                formData?.course_name ||
                student.todaySession?.course_name ||
                '정규';

              const sessionId = (student.todaySession?.id && student.todaySession.id !== 'temp' && !String(student.todaySession.id).startsWith('temp:'))
                ? student.todaySession.id
                : (formData?.id && formData.id !== 'temp' && !String(formData.id).startsWith('temp:') ? formData.id : undefined);

              const movedToHour = formData?.moved_to_hour !== undefined
                ? formData.moved_to_hour
                : (student.todaySession?.moved_to_hour !== undefined ? student.todaySession.moved_to_hour : null);

              const isMakeup = sAny?.isMakeupRow === true ||
                (sAny?.__courseType === 'makeup') ||
                String(student?.id || '').includes('_makeup_') ||
                formData?.is_pure_makeup === true ||
                String(formData?.attendance_status || '').startsWith('보강');

              // 💡 [Overview와 동일한 검증된 백엔드 DELETE 및 allLogs 재계산 엔진 호출]
              await onRemoveFromToday?.(student.id, '수업 취소', 'delete', {
                courseName,
                sessionId,
                movedToHour,
                isMakeup
              });
            }}
            className={`${itemClass} ${isLight ? 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-600 hover:text-white shadow-sm' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/40 hover:text-rose-200 shadow-sm'} flex items-center justify-center font-black cursor-pointer`}
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
              className={`h-5 w-[1px] mx-1 self-center shrink-0 ${isLight ? 'bg-gray-300' : 'bg-white/20'}`}
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
                ? 'cursor-grab active:cursor-grabbing hover:bg-amber-500/20'
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

  // 📝 [추가] 다른 기기에서 실시간 편집 중인지 판별 (내 기기인 경우는 제외)
  const coopData = cooperatingCells?.[`${student.id}_${colId}`];
  const isCooperating = Boolean(coopData && (!myClientId || coopData.clientId !== myClientId));

  const handleLockedCellDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    alert("아직 승인되지 않은 학생 제출본이 있습니다. 우측 알림창이나 툴박스에서 승인 버튼을 누르시면 학생이 쓴 내용이 일지에 자동으로 입력되며, 입력이 완료된 후에 직접 내용을 확인하고 수정하실 수 있습니다.");
  };

  const draftValuesRef = useRef<Record<string, string>>({});

  // 💡 [핵심] onSave의 최신 참조를 ref로 유지 (flush 클로저가 stale closure를 참조하지 않도록)
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // 💡 [핵심] 부모(TodaySheet)에 현재 편집 셀의 draft flush 함수를 등록
  // 다른 셀 mousedown에서 editingCell=null 보다 먼저 호출되어
  // textarea 언마운트 전에 최신 입력값을 handleSave/pending queue에 전달
  const flushIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isEditing && registerFlushDraft) {
      const flushKey = `${student.id}_${colId}`;
      flushIdRef.current = flushKey;

      const flushFn = () => {
        const draftVal = draftValuesRef.current[colId];
        if (draftVal !== undefined) {
          delete draftValuesRef.current[colId];
          // 💡 isBlur 없이 호출 → handleSave 내부에서 skipBlurRef=true 설정
          // → 뒤따르는 onBlur 중복 저장 방지
          onSaveRef.current(colId, draftVal);
        }
      };
      registerFlushDraft(flushFn);

      return () => {
        // 💡 언마운트 시 동일 인스턴스인 경우에만 해제 (다른 셀의 등록을 지우지 않음)
        if (flushIdRef.current === flushKey) {
          registerFlushDraft(null);
          flushIdRef.current = null;
        }
      };
    }
  }, [isEditing, colId, student.id, registerFlushDraft]);

  // 💡 [편집 모드 진입 1회 포커스] isEditing이 true로 새로 진입할 때만 1회 포커스 부여
  const prevIsEditingRef = useRef(isEditing);
  useEffect(() => {
    if (isEditing && !prevIsEditingRef.current) {
      const targetRef = colId === 'test_id' ? testRef : colId === 'classwork' ? cwRef : colId === 'completed_classwork' ? ccwRef : colId === 'assign' ? hwRef : colId === 'next_quiz' ? nqRef : null;
      if (targetRef?.current && document.activeElement !== targetRef.current) {
        targetRef.current.focus();
      }
    }
    prevIsEditingRef.current = isEditing;
  }, [isEditing, colId]);

  // 💡 [최적화] 텍스트가 변경되거나 편집 모드 진입 시 즉시 높이 조절 및 DOM value 동기화 (사용자 입력 draft 보호)
  React.useLayoutEffect(() => {
    const targetRef = colId === 'test_id' ? testRef : colId === 'classwork' ? cwRef : colId === 'completed_classwork' ? ccwRef : colId === 'assign' ? hwRef : colId === 'next_quiz' ? nqRef : null;
    if (targetRef?.current) {
      const isFocused = document.activeElement === targetRef.current;
      if (!isFocused && !isEditing && draftValuesRef.current[colId] === undefined) {
        targetRef.current.value = currentText || '';
      }
      targetRef.current.style.height = 'auto';
      targetRef.current.style.height = `${targetRef.current.scrollHeight}px`;
    }
  }, [isEditing, isActive, currentText, colId]);

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

  const { processLocalInput } = useTodaySheetCellEditor({
    snippets,
    snippetTrigger,
  });

  const handleLocalInput = (
    e: React.FormEvent<HTMLTextAreaElement | HTMLInputElement>,
    field: string
  ) => {
    const { value } = processLocalInput(e.currentTarget);
    draftValuesRef.current[field] = value;
    onInputChange?.(field, value);
  };

  // 💡 폰트 사이즈와 높이를 픽셀 단위로 강제 (들썩임 방지 핵심)
  const textColClass = colId === 'assign'
    ? (isLight ? 'text-[#0f172a] font-normal' : 'text-blue-200 font-normal')
    : colId === 'classwork' || colId === 'completed_classwork'
    ? (isLight ? 'text-[#0f172a] font-normal' : 'text-blue-100 font-normal')
    : colId === 'mission'
    ? (isLight ? 'text-amber-900 font-normal' : 'text-amber-200/90 font-normal')
    : (isLight ? 'text-[#1e293b] font-normal' : 'text-white font-normal');
  const commonTextStyle = `w-full text-[12px] leading-[14px] text-left ${textColClass} ${dynamicPadding} m-0 border-0 outline-none box-border appearance-none scrollbar-hide`;


  return (
    <td
      ref={tdRef}
      style={styles}
      tabIndex={0}
      data-col-id={colId}
      className={`relative group/td outline-none align-top ${isLight ? 'border-r border-[#e3e2e0] text-[#37352f]' : 'border-r border-white/12 text-white'} ${
        isFirstInTimeSection ? 'border-t-[3px] border-t-blue-500/60 shadow-[inset_0_1px_0_rgba(59,130,246,0.2)]' : ''
      } ${isActive ? 'ring-2 ring-inset ring-blue-500 z-30' : isInRange ? 'ring-1 ring-inset ring-blue-500/50' : ''} ${
        isLockActive ? 'bg-amber-500/[0.04] border border-dashed border-amber-500/20 cursor-not-allowed' : ''
      } ${
        isCooperating ? 'ring-2 ring-inset ring-pink-500/80 z-30 cursor-not-allowed bg-pink-500/[0.02]' : ''
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
        handleCellInteraction(e, colId, 'click');
      }}
      onDoubleClick={(e) => {
        if (isLockActive) {
          handleLockedCellDoubleClick(e);
        } else if (isCooperating) {
          e.stopPropagation();
          const confirmForceEdit = window.confirm("다른 조교가 이미 편집 중인 셀입니다. 강제로 편집 권한을 가져오시겠습니까?");
          if (confirmForceEdit) {
            if (onForceTakeover) {
              onForceTakeover(student.id, colId);
            } else {
              handleCellInteraction(e, colId, 'dblclick');
            }
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
              if (onForceTakeover) {
                onForceTakeover(student.id, colId);
              } else {
                handleCellInteraction(e as any, colId, 'dblclick');
              }
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
                  const snapshot = student.todaySession?.session_snapshot;
                  const isPast = selectedDate && selectedDate < getTodayStr();

                  // 💡 순수 보강 세션 여부 정밀 판정 (보강 행은 정규 요일 fallback 절대 금지)
                  const isPureMakeupRow =
                    (student as any).isMakeupRow === true ||
                    (student as any).__courseType === 'makeup' ||
                    formData?.is_pure_makeup === true ||
                    student.todaySession?.is_pure_makeup === true ||
                    snapshot?.sessionType === 'makeup' ||
                    snapshot?.isPureMakeup === true ||
                    String(formData?.attendance_status || '').startsWith('보강') ||
                    String(student.todaySession?.attendance_status || '').startsWith('보강');

                  // 💡 요일 정렬 헬퍼
                  const sortDaysStr = (days: any[]) => {
                    if (!Array.isArray(days) || days.length === 0) return '';
                    return days
                      .map((d: any) => String(d).replace('요일', '').trim())
                      .sort((a: string, b: string) => {
                        const order: Record<string, number> = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                        return (order[a] || 0) - (order[b] || 0);
                      })
                      .join('');
                  };

                  const getDerivedDays = () => {
                    const classDays = Array.isArray(student.class_days) && student.class_days.length > 0
                      ? student.class_days
                      : [];
                    if (classDays.length > 0) return classDays;

                    return Object.entries(student.day_schedules || {})
                      .filter(([, hours]) => Array.isArray(hours) && (hours as any[]).length > 0)
                      .map(([day]) => day.replace('요일', '').trim())
                      .filter(Boolean);
                  };

                  if (student.isSpecialClass) {
                    const elective = student.electiveCourse;
                    let daysStr = '';

                    if (isPast) {
                      if (snapshot && Array.isArray(snapshot.scheduledDays) && snapshot.scheduledDays.length > 0) {
                        daysStr = sortDaysStr(snapshot.scheduledDays);
                      } else {
                        const daysArr = Array.isArray(elective?.days)
                          ? elective.days
                          : (Array.isArray(elective?.class_days) ? elective.class_days : []);
                        daysStr = sortDaysStr(daysArr) || sortDaysStr(getDerivedDays());
                      }
                    } else {
                      const daysArr = Array.isArray(elective?.days)
                        ? elective.days
                        : (Array.isArray(elective?.class_days) ? elective.class_days : []);
                      daysStr = sortDaysStr(daysArr) || sortDaysStr(getDerivedDays());
                    }

                    const prefix = getCoursePrefix(student.isSpecialClass, student.electiveCourse);
                    return (
                      <span className={`text-[13px] font-medium truncate transition-colors ${isLight ? 'text-[#37352f]' : 'text-white'}`}>
                        <span className={isLight ? "text-amber-600 mr-0.5" : "text-amber-500 mr-0.5"}>{prefix}</span>
                        {student.name}-{teacherInitial}-{daysStr || '무'}
                      </span>
                    );
                  } else {
                    let daysStr = '';
                    if (isPast) {
                      if (snapshot && Array.isArray(snapshot.scheduledDays) && snapshot.scheduledDays.length > 0) {
                        daysStr = sortDaysStr(snapshot.scheduledDays);
                      } else {
                        daysStr = sortDaysStr(getDerivedDays());
                      }
                    } else {
                      daysStr = sortDaysStr(getDerivedDays());
                    }

                    return (
                      <span className={`text-[13px] font-medium truncate transition-colors ${isLight ? 'text-[#37352f]' : 'text-white'}`}>
                        {student.name}-{teacherInitial}-{daysStr || '무'}
                      </span>
                    );
                  }
                })()}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-normal uppercase tracking-tighter truncate">
                <span className={isLight ? "text-pink-600 font-medium" : "text-pink-300"}>{student.school}</span>
                <span className={isLight ? "text-gray-400 font-medium" : "text-gray-600"}>·</span>
                <span className={
                  isLight ? (
                    (student.grade || '').includes('초') ? 'text-emerald-700 font-medium' :
                    (student.grade || '').includes('중') ? 'text-blue-700 font-medium' :
                    (student.grade || '').includes('고') ? 'text-amber-700 font-medium' :
                    'text-gray-600 font-medium'
                  ) : (
                    (student.grade || '').includes('초') ? 'text-emerald-400' :
                    (student.grade || '').includes('중') ? 'text-blue-400' :
                    (student.grade || '').includes('고') ? 'text-amber-400' :
                    'text-gray-500'
                  )
                }>{student.grade}</span>
              </div>
            </div>
          </div>
        )}

        {colId === 'tools' && (
          <div className="flex items-center justify-center gap-1 px-1 py-1 w-full min-w-0 max-w-full overflow-hidden min-h-[22px] relative group/tools">
            {/* 우측 상단: 학생 주의사항 (노란색 스티커 마우스오버 툴팁) */}
            <div className="absolute top-0 right-0">
              <div
                className="group/note relative cursor-pointer z-[60]"
                onClick={(e) => handleOpenNotesPopup(e)}
                onMouseEnter={(e) => {
                  if (formData.management_notes) {
                    handleOpenTooltip(e, 'note');
                  }
                }}
                onMouseLeave={() => setActiveTooltip(null)}
                tabIndex={0}
              >
                <div className={`w-0 h-0 border-t-[16px] border-l-[16px] border-l-transparent transition-all ${
                  formData.management_notes
                    ? 'border-t-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                    : 'border-t-white/10 hover:border-t-amber-500/40'
                }`} />
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
                </div>
              </div>
            )}

            {/* 💡 [리팩토링] Portal 툴팁 전용 컴포넌트 */}
            <CellTooltip
              activeTooltip={activeTooltip}
              tooltipCoords={tooltipCoords}
              managementNotes={formData.management_notes}
              suggestions={student.suggestions}
            />

            {/* 💡 정렬된 도구 아이템 렌더링 */}
            {(() => {
              const order = toolsOrder || ['timeshift', 'profile', 'history', 'progress', 'separator', 'tag', 'portal', 'reset', 'delete'];
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
          const rawStatus = formData.attendance_status || '';
          const cleanStatus = rawStatus.includes(':') ? rawStatus.split(':')[0] : rawStatus;

          const hasRealAttendance = cleanStatus && [
            ATTENDANCE_STATUS.PRESENT,
            ATTENDANCE_STATUS.ABSENT,
            ATTENDANCE_STATUS.LATE,
            ATTENDANCE_STATUS.EARLY_LEAVE,
            ATTENDANCE_STATUS.EXCLUDED,
            ATTENDANCE_STATUS.CANCELED
          ].includes(cleanStatus as any);

          const isScheduledToday = student?.isScheduledToday ?? true;
          const normalizeH = (val: any): number | null => {
            if (val === null || val === undefined || val === '') return null;
            const num = parseInt(String(val), 10);
            if (isNaN(num)) return null;
            let h = num >= 100 ? Math.floor(num / 100) : num;
            if (h > 0 && h < 10) h += 12;
            return h;
          };

          const isPureMakeupRow =
            student.isMakeupRow === true ||
            student.todaySession?.is_pure_makeup === true;

          const hasMovedHour =
            formData.moved_to_hour !== null &&
            formData.moved_to_hour !== undefined &&
            formData.moved_to_hour > 0;

          const isMovedHour = hasMovedHour && !isPureMakeupRow;

          const statusText = hasRealAttendance ? cleanStatus : ATTENDANCE_STATUS.BEFORE;

          return (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                if (e.shiftKey) {
                  onTimePickerClick?.(e);
                } else {
                  onAttendanceClick(e);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onTimePickerClick?.(e);
              }}
              className={`absolute inset-0 w-full h-full flex items-center justify-between px-3 text-[11px] cursor-pointer select-none transition-colors hover:bg-white/[0.05] z-30 ${
              statusText === ATTENDANCE_STATUS.BEFORE
                ? (isLight ? 'text-gray-500 font-medium' : 'text-gray-600')
                : statusText.startsWith(ATTENDANCE_STATUS.PRESENT)
                  ? (isLight ? 'text-emerald-700 font-medium' : 'text-emerald-400 font-semibold')
                  : statusText.startsWith(ATTENDANCE_STATUS.ABSENT)
                    ? (isLight ? 'text-red-600 font-medium' : 'text-red-400 font-bold')
                    : statusText.startsWith(ATTENDANCE_STATUS.LATE)
                      ? (isLight ? 'text-amber-700 font-medium' : 'text-amber-400 font-bold')
                      : statusText.startsWith(ATTENDANCE_STATUS.EARLY_LEAVE)
                        ? (isLight ? 'text-orange-600 font-bold' : 'text-orange-400 font-bold')
                        : (isLight ? 'text-gray-500 font-medium' : 'text-gray-400')
            }`}>
              <div className="flex flex-col items-start justify-center min-w-0 flex-1 gap-0.5 py-0.5">
                <span className="text-[11px] font-bold leading-tight">{statusText}</span>
                {(isPureMakeupRow || isMovedHour) && (
                  <span className={`text-[10px] font-extrabold leading-none px-1 py-0.5 rounded ${
                    isPureMakeupRow
                      ? (isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400')
                      : (isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300')
                  }`}>
                    {isPureMakeupRow ? '보강' : '이동'}
                  </span>
                )}
              </div>

              {/* 💡 [출결 사유 관리] '결석'(팝오버/보강연동) 및 '조퇴'(사유 입력)만 버튼 노출 (지각은 출결 상태만 기록) */}
              {(statusText.startsWith(ATTENDANCE_STATUS.ABSENT) || statusText.startsWith(ATTENDANCE_STATUS.EARLY_LEAVE)) && (
                (() => {
                  const isAbsent = statusText.startsWith(ATTENDANCE_STATUS.ABSENT);
                  const isEarlyLeave = statusText.startsWith(ATTENDANCE_STATUS.EARLY_LEAVE);
                  const labelType = isAbsent ? '결석' : '조퇴';

                  const currentProgress = (formData.completed_classwork_text || student.todaySession?.completed_classwork_text || '').trim();
                  const earlyLeaveLinePattern = /^조퇴\s*(?:\([^)]*\))?\s*$/;
                  let initialReason = '';
                  if (isEarlyLeave) {
                    const lines: string[] = currentProgress ? currentProgress.split('\n') : [];
                    const earlyLine = lines.find((line: string) => earlyLeaveLinePattern.test(line));
                    if (earlyLine) {
                      const match = earlyLine.match(/^조퇴\s*(?:\(\s*(.*)\s*\))?\s*$/);
                      if (match && match[1]) initialReason = match[1].trim();
                    }
                  } else {
                    initialReason = formData.attendance_reason || student.todaySession?.attendance_reason || '';
                  }

                  const isValidSessionLogId = (value: unknown): boolean => {
                    const normalized = String(value ?? '').trim();
                    return /^[1-9]\d*$/.test(normalized);
                  };

                  const normalizeMovedHour = (value: unknown): number | null => {
                    if (value === null || value === undefined || value === '') return null;
                    const numeric = parseInt(String(value), 10);
                    if (Number.isNaN(numeric)) return null;
                    return numeric >= 100 ? Math.floor(numeric / 100) : numeric;
                  };

                  const isSpecial = student.isSpecialClass;
                  const isPureMakeup = student.isMakeupRow || (student as any).__courseType === 'makeup' || student.todaySession?.is_pure_makeup === true;
                  const currentRowCourse = (isSpecial ? (student.courseName || student.electiveCourse?.subject || '특강') : (student.todaySession?.course_name || '정규')).trim();
                  const currentRowDate = selectedDate || student.todaySession?.session_date || student.todaySession?.date || '';
                  const rawSessionId = student.todaySession?.id;
                  const currentMovedToHour = student.todaySession?.moved_to_hour;
                  const currentNormHour = normalizeMovedHour(currentMovedToHour);

                  const matchingAbsenceLog = (student.allLogs || []).find((log: any) => {
                    const isDbAbsent = String(log.attendance_status || '').trim().startsWith('결석');
                    const logNormHour = normalizeMovedHour(log.moved_to_hour);
                    const logDate = log.session_date || log.date || '';
                    const logCourse = (log.course_name || '정규').trim();

                    return (
                      isValidSessionLogId(log.id) &&
                      log.is_pure_makeup !== true &&
                      isDbAbsent &&
                      logDate === currentRowDate &&
                      logCourse === currentRowCourse &&
                      logNormHour === currentNormHour
                    );
                  });

                  const persistedAbsenceSessionId = isValidSessionLogId(rawSessionId)
                    ? String(rawSessionId)
                    : (matchingAbsenceLog?.id ? String(matchingAbsenceLog.id) : null);

                  const linkedMakeups = (isAbsent && persistedAbsenceSessionId && student.allLogs)
                    ? student.allLogs.filter((l: any) => {
                        return (
                          l.is_pure_makeup === true &&
                          String(l.absence_session_id ?? '') === String(persistedAbsenceSessionId ?? '')
                        );
                      }).sort((a: any, b: any) => (a.session_date || a.date || '').localeCompare(b.session_date || b.date || ''))
                    : [];

                  const hasLinkedMakeup = linkedMakeups.length > 0;
                  const earliestLinkedMakeup = hasLinkedMakeup ? linkedMakeups[0] : null;

                  const handleSaveAbsence = async () => {
                    const currentAttendanceStatus = formData.attendance_status || student.todaySession?.attendance_status || '';
                    if (!String(currentAttendanceStatus).startsWith('결석')) {
                      alert('결석 상태인 수업에서만 결석 사유와 보강을 연결할 수 있습니다.');
                      return;
                    }

                    setIsSavingAbsenceReason(true);
                    setAbsenceRefreshError(false);
                    try {
                      const cleanReason = absenceReasonInput.trim();
                      const autoProgressText = cleanReason ? `결석 (${cleanReason})` : '결석';
                      let finalProgressText = '';
                      if (!currentProgress) {
                        finalProgressText = autoProgressText;
                      } else {
                        const lines: string[] = currentProgress.split('\n');
                        if (lines[0].startsWith('결석')) {
                          lines[0] = autoProgressText;
                          finalProgressText = lines.join('\n');
                        } else {
                          finalProgressText = `${autoProgressText}\n${currentProgress}`;
                        }
                      }

                      const absencePayload = {
                        attendance_reason: cleanReason,
                        completed_classwork_text: finalProgressText,
                        ...(String(currentAttendanceStatus).startsWith('결석') ? { attendance_status: currentAttendanceStatus } : {})
                      };

                      const saveSuccess = await onSave(absencePayload);
                      if (!saveSuccess) {
                        return;
                      }

                      if (onRefreshAbsenceSession) {
                        try {
                          const refreshed = await onRefreshAbsenceSession({
                            studentId: student.originalId || student.id,
                            sessionDate: currentRowDate,
                            courseName: currentRowCourse,
                            movedToHour: currentNormHour
                          });
                          if (!refreshed) {
                            setAbsenceRefreshError(true);
                          }
                        } catch (refreshErr) {
                          setAbsenceRefreshError(true);
                        }
                      }
                    } catch (e) {
                      console.error('Failed to save absence reason');
                    } finally {
                      setIsSavingAbsenceReason(false);
                    }
                  };

                  return (
                    <div
                      className="inline-flex items-center gap-1 shrink-0 ml-1 relative"
                      {...(persistedAbsenceSessionId ? { 'data-absence-session-id': persistedAbsenceSessionId } : {})}
                    >
                      {isAbsent && !isPureMakeup && persistedAbsenceSessionId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAbsenceReasonInput(initialReason);
                            setIsAbsencePopupOpen(prev => !prev);
                          }}
                          className={`w-2 h-2 rounded-full transition-all shrink-0 cursor-pointer ${
                            hasLinkedMakeup ? 'bg-emerald-500 ring-2 ring-emerald-500/30' : (isLight ? 'bg-zinc-400 hover:bg-zinc-500' : 'bg-zinc-500 hover:bg-zinc-400')
                          }`}
                          title={hasLinkedMakeup ? `연결된 보강 일정 있음 (${linkedMakeups.length}건)` : '연결된 보강 일정 없음'}
                          aria-label={hasLinkedMakeup ? `연결된 보강 일정 있음 (${linkedMakeups.length}건)` : '연결된 보강 일정 없음'}
                        />
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAbsent) {
                            setAbsenceReasonInput(initialReason);
                            setIsAbsencePopupOpen(prev => !prev);
                            return;
                          }

                          const newReason = prompt(`[${student.name}] 학생의 ${labelType} 사유를 입력해 주세요:`, initialReason);
                          if (newReason !== null) {
                            const cleanReason = newReason.trim();
                            if (isEarlyLeave) {
                              const autoProgressText = cleanReason ? `조퇴(${cleanReason})` : '조퇴';
                              let finalProgressText = '';
                              if (!currentProgress) {
                                finalProgressText = autoProgressText;
                              } else {
                                const lines: string[] = currentProgress.split('\n');
                                const existingIdx = lines.findIndex((line: string) => earlyLeaveLinePattern.test(line));
                                if (existingIdx !== -1) {
                                  lines[existingIdx] = autoProgressText;
                                  finalProgressText = lines.join('\n');
                                } else {
                                  finalProgressText = `${currentProgress}\n${autoProgressText}`;
                                }
                              }

                              onSave({
                                completed_classwork_text: finalProgressText
                              });
                            } else {
                              onSave({
                                attendance_reason: cleanReason
                              });
                            }
                          }
                        }}
                        className={`p-1 rounded transition-all flex items-center justify-center shrink-0 shadow-sm border ${
                          isAbsent
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                            : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/20'
                        }`}
                        title={
                          initialReason
                            ? `${labelType} 사유: ${initialReason} (클릭하여 수정)`
                            : `클릭하여 ${labelType} 사유 입력`
                        }
                        aria-label={`${labelType} 사유 관리`}
                      >
                        <Edit3 size={11} strokeWidth={2.5} />
                      </button>

                      {/* 💡 결석 사유 및 후속 보강 확인 팝오버 (100% 불투명 배경 및 createPortal 최상위 레이어) */}
                      {typeof window !== 'undefined' && createPortal(
                        <AnimatePresence>
                          {isAbsencePopupOpen && (
                            <div
                              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
                              onClick={(e) => { e.stopPropagation(); setIsAbsencePopupOpen(false); }}
                            >
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={{ duration: 0.12 }}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-[340px] rounded-xl shadow-2xl p-4.5 border text-left flex flex-col gap-3.5 ${
                                  isLight
                                    ? 'bg-[#ffffff] border-slate-300 text-slate-900 shadow-slate-900/20'
                                    : 'bg-[#18181b] border-zinc-700 text-zinc-100 shadow-black/80'
                                }`}
                                style={{ backgroundColor: isLight ? '#ffffff' : '#18181b' }}
                              >
                                {/* 팝오버 헤더 */}
                                <div className={`flex items-center justify-between border-b pb-2.5 ${
                                  isLight ? 'border-slate-200' : 'border-zinc-800'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-black text-rose-500">결석 사유 / 보강 관리</span>
                                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                      isLight ? 'bg-slate-100 text-slate-600' : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                      {currentRowCourse}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setIsAbsencePopupOpen(false)}
                                    className={`p-1 rounded transition-colors ${
                                      isLight
                                        ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                                        : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                                    }`}
                                    aria-label="닫기"
                                  >
                                    <X size={15} />
                                  </button>
                                </div>

                                {/* 결석 사유 입력 섹션 */}
                                <div className="space-y-1.5">
                                  <label className={`text-[11px] font-bold block ${
                                    isLight ? 'text-slate-600' : 'text-zinc-400'
                                  }`}>
                                    결석 사유 입력
                                  </label>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={absenceReasonInput}
                                      onChange={(e) => setAbsenceReasonInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleSaveAbsence();
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault();
                                          setIsAbsencePopupOpen(false);
                                        }
                                      }}
                                      placeholder="예: 감기 몸살, 가족 여행 등"
                                      autoFocus
                                      className={`flex-1 text-[12px] px-3 py-2 rounded-lg border outline-none font-medium transition-all ${
                                        isLight
                                          ? 'bg-slate-50 border-slate-300 focus:border-blue-500 focus:bg-white text-slate-900 placeholder:text-slate-400'
                                          : 'bg-zinc-900 border-zinc-700 focus:border-blue-500 focus:bg-zinc-950 text-zinc-100 placeholder:text-zinc-500'
                                      }`}
                                      style={{ backgroundColor: isLight ? '#f8fafc' : '#18181b' }}
                                    />
                                    <button
                                      type="button"
                                      disabled={isSavingAbsenceReason}
                                      onClick={handleSaveAbsence}
                                      className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black transition-colors shrink-0 disabled:opacity-50 shadow-sm cursor-pointer"
                                    >
                                      {isSavingAbsenceReason ? '저장중' : '저장'}
                                    </button>
                                  </div>
                                </div>

                                {/* 후속 보강 안내 섹션 */}
                                <div
                                  className={`p-3 rounded-lg border flex flex-col gap-2.5 ${
                                    isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#202024] border-zinc-700 text-zinc-100'
                                  }`}
                                  style={{ backgroundColor: isLight ? '#f8fafc' : '#202024' }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasLinkedMakeup ? 'bg-emerald-500 ring-2 ring-emerald-500/30' : (isLight ? 'bg-slate-400' : 'bg-zinc-500')}`} />
                                      <span className={`text-[12px] font-black ${hasLinkedMakeup ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-slate-700' : 'text-zinc-300')}`}>
                                        {hasLinkedMakeup ? `연결된 보강 일정 ${linkedMakeups.length}건` : '연결된 보강 일정 없음'}
                                      </span>
                                    </div>
                                  </div>

                                  {hasLinkedMakeup && earliestLinkedMakeup && (
                                    <div className={`text-[11px] font-medium pl-4 py-1 rounded ${
                                      isLight ? 'bg-slate-100/80 text-slate-600' : 'bg-zinc-900/80 text-zinc-400'
                                    }`}>
                                      보강 일정: <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>{earliestLinkedMakeup.session_date || earliestLinkedMakeup.date}</span>
                                      {earliestLinkedMakeup.attendance_status?.startsWith('보강:') && (
                                        <span className="ml-1 text-blue-500 font-bold">{earliestLinkedMakeup.attendance_status.replace('보강:', '')}</span>
                                      )}
                                      <span className="ml-1 opacity-75">· {earliestLinkedMakeup.course_name || '정규'}</span>
                                    </div>
                                  )}

                                  {/* 미저장 결석인 경우 안내 및 버튼 분기 */}
                                  {!persistedAbsenceSessionId ? (
                                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold text-center">
                                      {absenceRefreshError
                                        ? '결석 기록은 저장됐지만 보강 연결 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'
                                        : '결석 기록을 먼저 저장한 뒤 보강을 연결할 수 있습니다.'}
                                    </div>
                                  ) : (
                                    <div className="pt-0.5 flex items-center justify-between">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (onNavigateTab) {
                                            (window as any)._pendingAbsenceRestore = {
                                              studentId: student.originalId || student.id,
                                              courseName: currentRowCourse,
                                              absenceSessionId: persistedAbsenceSessionId,
                                              date: currentRowDate
                                            };
                                            // onNavigateTab 호출 시 결석 연동 preset 전달
                                            onNavigateTab({
                                              source: 'absence-popup',
                                              studentId: student.originalId || student.id,
                                              absenceSessionId: persistedAbsenceSessionId,
                                              absenceDate: currentRowDate,
                                              courseName: currentRowCourse,
                                              returnDate: selectedDate || currentRowDate
                                            } as any);
                                          }
                                        }}
                                        className={`w-full py-2 px-3 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                                          hasLinkedMakeup
                                            ? (isLight ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-sm' : 'bg-zinc-800 border-zinc-600 text-zinc-100 hover:bg-zinc-700 shadow-sm')
                                            : (isLight ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm' : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border-emerald-700/60 shadow-sm')
                                        }`}
                                      >
                                        {hasLinkedMakeup ? '보강 탭에서 확인' : '보강 잡기'}
                                        <ExternalLink size={12} />
                                      </button>
                                    </div>
                                  )}

                                  {!hasLinkedMakeup && persistedAbsenceSessionId && (
                                    <p className={`text-[10px] text-center font-normal ${
                                      isLight ? 'text-slate-500' : 'text-zinc-400'
                                    }`}>
                                      ※ 보강 날짜와 시간은 보강 탭에서 설정합니다.
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            </div>
                          )}
                        </AnimatePresence>,
                        document.body
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          );
        })()}

        {colId === 'review' && (
          <div className={`relative w-full h-full flex items-start justify-between py-1 px-2 gap-2 ${isLight ? 'bg-blue-50/50' : 'bg-blue-600/[0.03]'}`}>
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="flex-1 text-left min-w-0 select-text cursor-text"
            >
              {isValidHomeworkText(student.lastSession?.homework_text) ? (
                <div className={`text-[12px] leading-[1.15] whitespace-pre-wrap break-all ${isLight ? 'text-[#002147] font-normal italic' : 'text-blue-100 font-normal italic'}`}>
                  {(student.lastSession?.homework_text || '').split(/\n\s*\n/).map((para: string, i: number, arr: string[]) => (
                    <span key={i} className={`block ${i !== arr.length - 1 ? 'mb-1.5' : ''}`}>
                      {i === 0 && <span className={isLight ? 'text-blue-700 text-[14px] font-medium mr-1 align-top leading-[1.15]' : 'text-blue-500/80 text-[14px] font-normal mr-1 align-top leading-[1.15]'}>"</span>}
                      {para.split(/(\([월화수목금토일]\))/g).map((part, j) =>
                        part.match(/^\([월화수목금토일]\)$/) ? <span key={j} className={isLight ? 'text-amber-800 font-medium not-italic px-0.5' : 'text-yellow-400 font-medium not-italic px-0.5'}>{part}</span> : part
                      )}
                      {i === arr.length - 1 && <span className={isLight ? 'text-blue-700 text-[14px] font-medium ml-1 align-bottom leading-[1.15]' : 'text-blue-500/80 text-[14px] font-normal ml-1 align-bottom leading-[1.15]'}>"</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <span className={`italic font-medium text-[11px] px-2 ${isLight ? 'text-gray-400 opacity-60' : 'text-gray-500 opacity-30'}`}>기존 숙제 없음</span>
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
                      className={`relative z-30 shrink-0 px-2 py-0.5 rounded text-[9.5px] font-medium tracking-tight border transition-colors ${
                        isChecked
                          ? (isLight ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200' : 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30')
                          : (isLight ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700 hover:text-gray-200')
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
                      ? (isLight ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-indigo-500/30 text-indigo-200 border-indigo-500/50')
                      : (isLight ? 'bg-indigo-50/80 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30 hover:text-white hover:border-indigo-500/50')
                  }`}
                  title="특이사항에 과제 피드백 추가"
                >
                  <MessageSquare size={12} />
                </button>
                <FeedbackKeyboardPopup
                  isOpen={isFeedbackOpen}
                  statusMap={statusMap}
                  onSelectFeedback={onSelectFeedback}
                  onCloseFeedback={onCloseFeedback}
                  isLight={isLight}
                />
              </div>
            </div>
          </div>
        )}

        {/* 💡 [리팩토링] 단순 텍스트 셀 분리 (mission, notes) */}
        {colId === 'book_progress' && (
          <div className="w-full h-full p-1.5 flex flex-col gap-1 overflow-y-auto custom-scrollbar-v text-left">
            {(() => {
              const currentSubject = (student.courseName || student.electiveCourse?.subject || '').trim();
              const currentRowTargetTag = student.isSpecialClass ? `선택:${currentSubject}` : '정규';
              const realAssignedBooks = student.assigned_books || [];

              // 💡 1. 오직 현재 학생에게 진짜 배정된(assigned_books) 교재만 추출 (rpm-m3-1 등 과거 미배정 찌꺼기 제거)
              const assignedBooks = realAssignedBooks.filter(k => {
                if (!k || k.startsWith('__')) return false; // __elective_courses 등 시스템 키 제외
                const rawVal = String((student.book_courses || {})[k] || '');
                const { isKeep, targetTag } = parseBookCourseValue(rawVal);
                if (rawVal.includes('-removed') || rawVal.includes('-done') || isKeep) return false;

                // 정규 / 공통 / 선택과목 행별 100% 매칭
                if (student.isSpecialClass) {
                  return targetTag === currentRowTargetTag || (currentSubject && targetTag.includes(currentSubject)) || targetTag === '공통';
                } else {
                  return targetTag === '정규' || targetTag === '공통' || !targetTag.startsWith('선택:');
                }
              });

              const progressMap = student.book_progress || {};

              // 배정된 현재 교재가 아예 없는 경우
              if (assignedBooks.length === 0 && Object.keys(progressMap).length === 0) {
                return <span className="text-[10px] text-gray-500 italic select-none">-</span>;
              }

              return assignedBooks.map((bookKey, bIdx) => {
                const bookTitle = masterTextbooks?.find((m: any) => m.bookcode?.toLowerCase() === bookKey.toLowerCase() || m.title === bookKey)?.title || bookKey;
                const rawVal = String((student.book_courses || {})[bookKey] || '');
                const { targetTag } = parseBookCourseValue(rawVal);
                const isElectiveBook = targetTag.startsWith('선택:');

                // 해당 교재의 현재 진도 값 (영문 키 / 한글 키 / 번역 키 / 대소문자 호환)
                const lowerBookKey = bookKey.toLowerCase();
                const lowerBookTitle = bookTitle.toLowerCase();
                let val = progressMap[bookKey] || progressMap[bookTitle] || '';

                if (!val) {
                  for (const k of Object.keys(progressMap)) {
                    const lk = k.toLowerCase();
                    if (lk === lowerBookKey || lk === lowerBookTitle || lk.includes(lowerBookKey) || lowerBookKey.includes(lk)) {
                      val = progressMap[k];
                      break;
                    }
                  }
                }

                // 💡 [추가] 교재 진도 세팅 경과일 계산 (7일 이상: 주황 경고, 14일 이상: 빨간 펄스 경고)
                const updatedMap = (student as any).book_progress_updated_at || {};
                const updatedIso = updatedMap[bookTitle] || updatedMap[bookKey];
                let updatedDate: Date | null = updatedIso ? new Date(updatedIso) : null;

                if (!updatedDate && val) {
                  const logs = (student.allLogs || []).slice().sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
                  const foundLog = logs.find((l: any) => {
                    const text = `${l.completed_classwork_text || ''}\n${l.homework_text || ''}`;
                    return text.includes(bookKey) || text.includes(bookTitle);
                  });
                  if (foundLog?.date) {
                    updatedDate = new Date(foundLog.date);
                  }
                }

                let daysElapsed = 0;
                if (updatedDate && !isNaN(updatedDate.getTime())) {
                  daysElapsed = Math.floor((Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));
                }

                const valParts = val ? val.split('|').map(s => s.trim()).filter(Boolean) : [];

                return (
                  <div key={bIdx}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBookForDrawer(bookKey);
                    }}
                    className={`group relative px-2 py-1 rounded-md text-[10px] flex items-center justify-between gap-1.5 truncate border transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                      val && daysElapsed >= 14
                        ? (isLight ? 'bg-rose-50 border-rose-300 shadow-sm animate-pulse' : 'bg-rose-500/10 border-rose-500/70 shadow-[0_0_8px_rgba(244,63,94,0.3)] animate-pulse')
                        : val && daysElapsed >= 7
                          ? (isLight ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-amber-500/10 border-amber-500/70')
                          : isElectiveBook
                            ? (isLight ? 'bg-amber-50/90 border-amber-200/90 shadow-sm' : 'bg-amber-500/10 border-amber-500/30')
                            : (isLight ? 'bg-emerald-50/90 border-emerald-200/90 shadow-sm' : 'bg-emerald-500/10 border-emerald-500/20')
                    }`}>
                    {valParts.length > 1 ? (
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1 py-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`text-[8.5px] font-bold px-1 rounded shrink-0 ${
                            isElectiveBook
                              ? (isLight ? 'bg-amber-500 text-white' : 'bg-amber-500 text-black')
                              : targetTag === '공통'
                                ? 'bg-blue-600 text-white'
                                : 'bg-emerald-600 text-white'
                          }`}>
                            {targetTag.replace('선택:', '')}
                          </span>
                          <span className={`font-black shrink-0 ${
                            isElectiveBook
                              ? (isLight ? 'text-amber-900' : 'text-amber-300')
                              : (isLight ? 'text-emerald-900' : 'text-emerald-400')
                          }`}>
                            {bookTitle}
                          </span>
                          {val && daysElapsed >= 14 && (
                            <span className="text-[8px] font-bold px-1 rounded bg-rose-600 text-white shrink-0">14일+ 정체</span>
                          )}
                          {val && daysElapsed >= 7 && daysElapsed < 14 && (
                            <span className="text-[8px] font-bold px-1 rounded bg-amber-500 text-black shrink-0">7일+ 정체</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 pl-0.5">
                          {valParts.map((part, pIdx) => (
                            <div key={pIdx} className={`text-[9.5px] font-semibold truncate flex items-center gap-1 ${
                              isLight ? 'text-[#2c2b29]' : 'text-gray-200'
                            }`}>
                              <span className={`text-[8.5px] font-bold shrink-0 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>{pIdx === 0 ? '①' : '②'}</span>
                              <span className="truncate">{part}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
                        {/* 💡 [정규] / [공통] / [과목명] 선명한 뱃지 표기 */}
                        <span className={`text-[8.5px] font-bold px-1 rounded shrink-0 ${
                          isElectiveBook
                            ? (isLight ? 'bg-amber-500 text-white' : 'bg-amber-500 text-black')
                            : targetTag === '공통'
                              ? 'bg-blue-600 text-white'
                              : 'bg-emerald-600 text-white'
                        }`}>
                          {targetTag.replace('선택:', '')}
                        </span>

                        <span className={`font-black shrink-0 ${
                          isElectiveBook
                            ? (isLight ? 'text-amber-900' : 'text-amber-300')
                            : (isLight ? 'text-emerald-900' : 'text-emerald-400')
                        }`}>
                          {bookTitle}
                        </span>
                        <span className={`truncate text-[9.5px] font-bold ${
                          val
                            ? (isLight ? 'text-[#2c2b29]' : 'text-gray-300')
                            : 'text-gray-400 italic font-normal'
                        }`}>
                          {val || ''}
                        </span>
                        {val && daysElapsed >= 14 && (
                          <span className="text-[8px] font-bold px-1 rounded bg-rose-600 text-white shrink-0">14일+ 정체</span>
                        )}
                        {val && daysElapsed >= 7 && daysElapsed < 14 && (
                          <span className="text-[8px] font-bold px-1 rounded bg-amber-500 text-black shrink-0">7일+ 정체</span>
                        )}
                      </div>
                    )}
                    {onUpdateStudentInfo && (
                      <div className="flex items-center gap-1 shrink-0">
                        {/* ⚡ 수행진도/숙제 문장에서 최신 페이지/단원 자동 파싱 업데이트 버튼 */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const sAny = student as any;

                            // 💡 1차: 오늘 일지 문장
                            const todayText = `${student.todaySession?.completed_classwork_text || ''}\n${student.todaySession?.homework_text || ''}\n${sAny.completed_classwork_text || ''}\n${sAny.homework_text || ''}`;

                            // 💡 2차: 지난 과거 일지 문장들 (최근 날짜순)
                            const pastLogs = (student.allLogs || []).slice().sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
                            const pastTexts = pastLogs.map((l: any) => `${l.completed_classwork_text || ''}\n${l.homework_text || ''}`);

                            const candidateTexts = [todayText, ...pastTexts];

                            const targetMaster = masterTextbooks?.find((m: any) => m.title === bookTitle || m.bookcode === bookKey);
                            const realCode = targetMaster?.bookcode || bookKey;

                            let parsedResult = '';

                            try {
                              const res = await fetch(`/api/textbooks/${realCode}`);
                              if (res.ok) {
                                const units = (await res.json()) || [];

                                // 💡 교재의 실제 최소 페이지 ~ 최대 페이지 범위 계산 (범위 밖의 문제번호 415 등은 무시)
                                let minBookPage = 1;
                                let maxBookPage = 0;
                                units.forEach((u: any) => {
                                  const uStart = parseInt(u.start_page ?? u.sPage ?? u.startPage ?? '0', 10);
                                  const uEnd = parseInt(u.end_page ?? u.ePage ?? u.endPage ?? '0', 10);
                                  if (uStart > 0 && (minBookPage === 1 || uStart < minBookPage)) minBookPage = uStart;
                                  if (uEnd > maxBookPage) maxBookPage = uEnd;
                                });
                                if (maxBookPage === 0) maxBookPage = 500; // 기본 안전 상한선

                                // 오늘 일지부터 과거 일지 순으로 훑어가며 가장 먼저 발견되는 최신 페이지/단원 파싱
                                for (const text of candidateTexts) {
                                  if (!text.trim()) continue;

                                  // 1. p.80, 80p, 80페이지 등 숫자 패턴 파싱
                                  const pageMatches = Array.from(text.matchAll(/(?:p\.?|페이지\s*|\b)(\d{1,4})\s*(?:p|페이지|\b)/gi));
                                  // 💡 교재 실제 페이지 범위(minBookPage ~ maxBookPage) 안에 들어오는 수치만 필터링!
                                  const foundPages = pageMatches
                                    .map(m => parseInt(m[1], 10))
                                    .filter(p => p >= minBookPage && p <= maxBookPage);

                                  if (foundPages.length > 0) {
                                    const lastP = foundPages[foundPages.length - 1];
                                    const foundUnit = units.find((u: any) => {
                                      const uStart = parseInt(u.start_page ?? u.sPage ?? u.startPage ?? '0', 10);
                                      const uEnd = parseInt(u.end_page ?? u.ePage ?? u.endPage ?? '9999', 10);
                                      return lastP >= uStart && lastP <= uEnd;
                                    });

                                    if (foundUnit) {
                                      const uName = foundUnit.unit || foundUnit.unitName || foundUnit.title;
                                      parsedResult = `${uName} (p.${lastP})`;
                                    } else {
                                      parsedResult = `p.${lastP}`;
                                    }
                                    break; // 발견 시 즉시 탈출
                                  } else {
                                    // 2. 숫자가 없다면 단원명 직접 언급 파싱
                                    const matchedUnit = units.slice().reverse().find((u: any) => {
                                      const uName = u.unit || u.unitName || u.title;
                                      return uName && text.includes(uName);
                                    });
                                    if (matchedUnit) {
                                      parsedResult = matchedUnit.unit || matchedUnit.unitName || matchedUnit.title;
                                      break; // 발견 시 즉시 탈출
                                    }
                                  }
                                }
                              }
                            } catch (err) {
                              console.error(err);
                            }

                            if (parsedResult) {
                              const cleanProgress: Record<string, string> = { ...(student.book_progress || {}) };
                              delete cleanProgress[bookKey];
                              delete cleanProgress[bookKey.toLowerCase()];
                              delete cleanProgress[bookTitle];

                              let finalVal = parsedResult;
                              if (targetTag === '공통' && val.includes('|')) {
                                const parts = val.split('|').map(s => s.trim());
                                if (student.isSpecialClass) {
                                  parts[1] = parsedResult;
                                } else {
                                  parts[0] = parsedResult;
                                }
                                finalVal = parts.join(' | ');
                              } else if (targetTag === '공통' && val) {
                                if (student.isSpecialClass) {
                                  finalVal = `${val} | ${parsedResult}`;
                                } else {
                                  finalVal = `${parsedResult} | ${val}`;
                                }
                              }

                              cleanProgress[bookTitle] = finalVal;

                              const cleanUpdated = { ...((student as any).book_progress_updated_at || {}) };
                              cleanUpdated[bookTitle] = new Date().toISOString();
                              cleanUpdated[bookKey] = new Date().toISOString();

                              // 💡 진도 변경 이력 기록 자동 누적
                              const todayStr = new Date().toISOString().slice(0, 10);
                              const existingHist = Array.isArray((student as any).book_progress_history) ? [...(student as any).book_progress_history] : [];
                              existingHist.unshift({
                                id: Date.now().toString(),
                                date: todayStr,
                                book: bookTitle,
                                progress: finalVal,
                                createdAt: new Date().toISOString()
                              });

                              // 💡 [단일 배치 저장] 3번 나누어 호출하던 것을 1회 객체로 묶어 즉시 저장
                              await onUpdateStudentInfo(student.id, {
                                book_progress: cleanProgress,
                                book_progress_updated_at: cleanUpdated,
                                book_progress_history: existingHist
                              });
                            } else {
                              alert(`오늘 및 지난 일지 기록에서 [${bookTitle}] 교재의 페이지나 단원을 찾지 못했습니다.`);
                            }
                          }}
                          title="오늘 수행진도/숙제 문장에서 최신 진도 자동 추출 업데이트"
                          className="p-0.5 rounded text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 transition-colors"
                        >
                          <RefreshCw size={11} />
                        </button>

                        {val && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const nextProg = { ...(student.book_progress || {}) };
                              delete nextProg[bookKey];
                              delete nextProg[bookTitle];
                              await onUpdateStudentInfo(student.id, 'book_progress', nextProg);
                            }}
                            title="이 진도 내용 초기화"
                            className="p-0.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {/* 💡 교재 클릭 시 단원/쪽수 팝업 드로어 모달 */}
            {selectedBookForDrawer && typeof window !== 'undefined' && createPortal(
              <TextbookSystem
                student={student}
                availableTextbooks={masterTextbooks || []}
                allLogs={student.allLogs || []}
                initialBookCode={selectedBookForDrawer}
                localCompletedClasswork={ccwBookBuf.current}
                setLocalCompletedClasswork={(val) => {
                  const nextVal = typeof val === 'function' ? (val as any)(ccwBookBuf.current) : val;
                  ccwBookBuf.current = nextVal;
                }}
                localHomework={hwBookBuf.current}
                setLocalHomework={(val) => {
                  const nextVal = typeof val === 'function' ? (val as any)(hwBookBuf.current) : val;
                  hwBookBuf.current = nextVal;
                }}
                todayPlan={formData?.classwork_text ?? student.todaySession?.classwork_text ?? ''}
                handleManualSave={async (field, val) => {
                  // val에 넘어온 최신 누적 텍스트를 버퍼에 즉시 저장하고 DB 전송
                  const saveValueMap: any = {
                    completed_classwork: typeof val === 'string' && val ? val : ccwBookBuf.current,
                    homework: typeof val === 'string' && val ? val : hwBookBuf.current,
                  };
                  if (field === 'completed_classwork' && typeof val === 'string' && val) {
                    ccwBookBuf.current = val;
                  }
                  if (field === 'homework' && typeof val === 'string' && val) {
                    hwBookBuf.current = val;
                  }
                  const keyMap: any = {
                    completed_classwork: 'completed_classwork',
                    homework: 'assign',
                    classwork: 'classwork',
                    special_notes: 'notes'
                  };
                  const targetKey = keyMap[field] || field;
                  const saveValue = field in saveValueMap ? saveValueMap[field] : val;
                  if (onSave) {
                    await onSave(targetKey, saveValue);
                  }
                }}
                isSaving={false}
                onBookSelect={(isActive) => {
                  if (!isActive) setSelectedBookForDrawer(null);
                }}
                selectedDate={displayDateShort || new Date().toISOString().slice(0, 10)}
              />,
              document.body
            )}
          </div>
        )}

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
            {isLockActive && !isEditing && (
              <div className="absolute right-1 top-1 z-30 flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-[1px] rounded-[3px] text-[9px] font-medium animate-pulse select-none">
                <Lock size={8} className="stroke-[2.5]" />
                승인대기
              </div>
            )}

            {/* 💡 [수정] 오직 isEditing 일 때만 textarea 렌더링 (단일 클릭 선택 모드 보존) */}
            {isEditing && (
               <textarea
                 ref={colId === 'test_id' ? testRef : colId === 'classwork' ? cwRef : colId === 'completed_classwork' ? ccwRef : colId === 'assign' ? hwRef : nqRef}
                 defaultValue={currentText || ''}
                 data-student-id={student.id}
                 data-col-id={colId}
                 readOnly={isLockActive}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
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
                    if ((e.nativeEvent as any)?.isComposing) return;
                    const currentVal = (e.currentTarget as HTMLTextAreaElement).value;
                    const saveVal = currentVal !== undefined ? currentVal : (draftValuesRef.current[colId] ?? '');
                    delete draftValuesRef.current[colId];
                    onSave(colId, saveVal, { skipNextBlur: true });
                  }
                  handleKeyDown(e, colId);
                }}
                onBlur={(e) => {
                  const currentVal = (e.currentTarget as HTMLTextAreaElement).value;
                  const saveVal = currentVal !== undefined ? currentVal : (draftValuesRef.current[colId] ?? '');
                  delete draftValuesRef.current[colId];
                  onSave(colId, saveVal, { isBlur: true });
                }}
                placeholder="-"
                className={`${commonTextStyle} bg-transparent resize-none overflow-y-hidden block relative z-20`}
                onInput={(e) => handleLocalInput(e, colId)}
                onChange={(e) => {
                  draftValuesRef.current[colId] = (e.currentTarget as HTMLTextAreaElement).value;
                }}
              />
            )}

            {/* 💡 편집 중이 아닐 때만 뷰 모드 텍스트 노출 (하이라이팅 적용) */}
            {!isEditing && (
              <div 
                className={`${commonTextStyle} whitespace-pre-wrap min-h-[22px] flex flex-col items-start justify-start w-full cursor-default select-none`}
              >
                <div className="w-full">
                  {currentText ? <CellTextHighlighter text={currentText} columnId={colId} isLight={isLight} /> : (
                    isLockActive ? (
                      <span className="text-amber-500/40 text-[11px] font-normal italic select-none">
                        ⏳ 승인을 누르면 내용이 입력됩니다
                      </span>
                    ) : isCooperating ? (
                      <span className="text-pink-500/40 text-[11px] font-normal italic select-none">
                        📝 다른 기기에서 입력하고 있습니다
                      </span>
                    ) : '-'
                  )}
                </div>
              </div>
            )}

            <div className="absolute right-1 top-1 flex items-center gap-1 opacity-30 group-hover/cell:opacity-100 focus-within:opacity-100 transition-all duration-200 z-30">
              {(colId === 'classwork' || colId === 'completed_classwork' || colId === 'assign') && (
                <button onClick={colId === 'classwork' ? onOpenCwEditor : colId === 'completed_classwork' ? onOpenCcwEditor : onOpenHwEditor} className="w-5 h-5 rounded-[1px] bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><Wand2 size={10} /></button>
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
            isLight={isLight}
          />
        )}
      </div>
      )}
    </td>
  );
});

export default TodaySheetCell;
