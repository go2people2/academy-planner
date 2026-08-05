'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Loader2, Settings2, Check, 
  Calendar as CalendarIcon, History as HistoryIcon, 
  LayoutGrid, Table as TableIcon, Share2, Percent, RotateCcw,
  Download, FileSpreadsheet, FileText as FileTextIcon, Copy,
  SortAsc, Clock as ClockIcon, X, Wand2, TrendingUp, ClipboardList, FileText, Zap,
  Maximize2, Minimize2, ArrowLeft, ArrowRight, AlertTriangle, ArrowUp, ArrowDown, Eye, EyeOff, Printer, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Megaphone
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TodaySheetRow } from './TodaySheetRow';
import { HistoryRows } from './TodaySheetHistory';
import ReportPreview from './ReportPreview';
import PrintPreviewModal from './todaySheet/PrintPreviewModal';
import StudentReportCardPrintModal from './todaySheet/StudentReportCardPrintModal';
import { TagBatchInputModal } from './todaySheet/TagBatchInputModal';
import HokmaJournalPrintModal from './todaySheet/HokmaJournalPrintModal';
import { getDayOfWeek, getTodayStr } from '@/lib/utils';
import { calculateAggregatedHw, selectBaseSession, determineTodaySession } from '@/lib/studentDataEnricher';
import { ChecklistTab } from './todaySheet/ChecklistTab';
import { ATTENDANCE_STATUS, normalizeAttendanceStatus, mapColumnToProp } from '@/lib/sessionFieldMap';
import { syncTodaySheetDom } from '@/lib/todaySheetDomSync';
import { useTodaySheetShortcuts } from './hooks/useTodaySheetShortcuts';
import { useCoopCollaboration } from '@/hooks/useCoopCollaboration';
import { useTodaySheetExport } from '@/hooks/useTodaySheetExport';
import { useTodaySheetImport } from '@/hooks/useTodaySheetImport';

import { ColumnConfig, DEFAULT_COLUMNS } from './todaySheet/types';
import { TodaySheetHeader } from './todaySheet/TodaySheetHeader';
import { useTodaySheetUndoRedo } from './todaySheet/hooks/useTodaySheetUndoRedo';
import { useTodaySheetRows } from './todaySheet/hooks/useTodaySheetRows';
import { useTodaySheetSelection } from './todaySheet/hooks/useTodaySheetSelection';
import { extractRealStudentId } from '@/lib/rowIdentity';
import { TodaySheetModals } from './todaySheet/TodaySheetModals';




// --- Main Component ---

export default function TodaySheet({
  students, allStudents, setStudents, masterTextbooks, onSave, onBatchSave, onUpdateStudentInfo, onRemoveFromToday, selectedDate, onDateChange, onViewProgress, onSelectStudent, academyInfo, currentUser,
  sortMode = 'time', onSortModeChange,
  sortDirection = 'asc', onSortDirectionChange,
  onOpenBriefing, // 💡 추가
  selectedFilter, setSelectedFilter,
  selectedTeacherId, setSelectedTeacherId,
  selectedDays, setSelectedDays,
  isAndFilter, setIsAndFilter,
  teachers = [],
  isFullScreen = false,
  onToggleFullScreen,
  selectedHour = 'All' // 💡 시작 시간대 필터 추가
}: any) {

  // Undo/Redo hook
  const {
    undoStackRef,
    redoStackRef,
    pushToUndoStack,
    handleUndo,
    handleRedo,
  } = useTodaySheetUndoRedo({
    setStudents,
    onSave,
    onUpdateStudentInfo,
  });


  // 1. States
  const [showAllTools, setShowAllTools] = useState(false); // 💡 [추가] 7개 도구 일괄 접기/펼치기 상태
  const [isToolsEditMode, setIsToolsEditMode] = useState(false); // 💡 도구 편집 모드 상태
  const [toolsOrder, setToolsOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_tools_order');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return ['profile', 'history', 'progress', 'separator', 'tag', 'portal', 'reset', 'delete'];
  });

  const handleReorderTools = useCallback((draggedId: string, targetId: string) => {
    setToolsOrder(prev => {
      const newOrder = [...prev];
      const draggedIdx = newOrder.indexOf(draggedId);
      const targetIdx = newOrder.indexOf(targetId);
      if (draggedIdx !== -1 && targetIdx !== -1) {
        newOrder.splice(draggedIdx, 1);
        newOrder.splice(targetIdx, 0, draggedId);
        localStorage.setItem('ams_tools_order', JSON.stringify(newOrder));
      }
      return newOrder;
    });
  }, []);

  const [activeTab, setActiveTab] = useState<'daily' | 'checklist'>('daily');
  const [historyLimit, setHistoryLimit] = useState(3);
  
  useEffect(() => {
    const saved = localStorage.getItem('ams_history_limit');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) setHistoryLimit(parsed);
    }
  }, []);

  const [hiddenStudentIds, setHiddenStudentIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<{
    startStudentId: string, 
    startColId: string, 
    endStudentId: string, 
    endColId: string
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const defaultWidths = Object.fromEntries(DEFAULT_COLUMNS.map(col => [col.id, col.minWidth]));
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('todaySheetColWidths');
      if (saved) { try { const parsed = JSON.parse(saved); return { ...defaultWidths, ...parsed }; } catch (e) { console.error(e); } }
    }
    return defaultWidths;
  });

  const [presets, setPresets] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`todaySheetPresets_${currentUser?.id || 'default'}`);
      if (saved) return JSON.parse(saved);
    }
    return {
      '1': ['select', 'name', 'review', 'classwork', 'completed_classwork', 'assign', 'mission', 'action'],
      '2': ['select', 'name', 'test_id', 'test_score', 'notes', 'action'],
      '3': ['select', 'name', 'next_quiz', 'action'],
      '4': DEFAULT_COLUMNS.map(c => c.id)
    };
  });

  const [activeSet, setActiveSet] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`todaySheetActiveSet_${currentUser?.id || 'default'}`) || '1';
    return '1';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // 모달 ESC 닫기 공통 처리 (Column Settings)
  useEffect(() => {
    if (isSettingsOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsSettingsOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSettingsOpen]);

  const [isScrolled, setIsScrolled] = useState(false);

  // 스크롤 감지 (z-index 동적 조절용)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 5);
  }, []);

  const [activeCell, setActiveCell] = useState<{ studentId: string, columnId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ studentId: string, columnId: string } | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, number>>({});
  const [isSendingReport, setIsSendingReport] = useState<string | null>(null);
  const [isReportVisible, setIsReportVisible] = useState(false);

  // 💡 [추가] 다른 조교 기기로부터 저장 이벤트 수신 시, 로컬 상태 및 DOM을 즉시 갱신하는 핸들러
  const handleRemoteCellSave = useCallback((studentId: string, colId: string, value: string) => {
    const isEditingThis = editingCell?.studentId === studentId && editingCell?.columnId === colId;
    if (isEditingThis) return; // 내가 편집 중이면 덮어쓰기 무시

    const prop = mapColumnToProp(colId);
    if (!prop) return;

    // 1. 로컬 상태 업데이트
    setStudents((prev: any[]) => prev.map(s => {
      if (s.id === studentId) {
        if (colId === 'mission') {
          return { ...s, recent_mission: value };
        }
        if (colId === 'notes') {
          return {
            ...s,
            todaySession: {
              ...(s.todaySession || {}),
              special_notes: value
            }
          };
        }
        return {
          ...s,
          todaySession: {
            ...(s.todaySession || {}),
            [prop]: value
          }
        };
      }
      return s;
    }));

    // 2. DOM에 직접 값 주입 (화면 딜레이 방지)
    syncTodaySheetDom([{ studentId, newData: { [prop]: value } }], [colId]);
  }, [editingCell, setStudents]);

  // 📝 [리팩토링] 다중 기기 실시간 편집 및 협업 상태 분리 훅 호출
  const { cooperatingCells, sendCoopEvent, sendSaveEvent, myClientId } = useCoopCollaboration(academyInfo?.id, handleRemoteCellSave);

  // 💡 [추가 1] 내가 편집 중일 때 락이 15초 가비지 컬렉터에 의해 풀리지 않도록 5초 주기 하트비트 전송
  useEffect(() => {
    if (!editingCell || !academyInfo?.id) return;
    const interval = setInterval(() => {
      sendCoopEvent('focus_in', editingCell.studentId, editingCell.columnId);
    }, 5000);
    return () => clearInterval(interval);
  }, [editingCell, academyInfo?.id, sendCoopEvent]);

  // 💡 [추가 2] 다른 선생님이 이 셀을 작업 중인지 감시 (무한 팝업 방지 및 포커스 완전 해제)
  const lastCoopAlertKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editingCell || !myClientId) return;
    const key = `${editingCell.studentId}_${editingCell.columnId}`;
    const coop = cooperatingCells[key];
    if (coop && coop.clientId !== myClientId) {
      if (lastCoopAlertKeyRef.current !== key) {
        lastCoopAlertKeyRef.current = key;
        alert("다른 선생님이 이 셀을 작업 중입니다.");
      }
      setEditingCell(null);
      setActiveCell(null);
    } else {
      if (lastCoopAlertKeyRef.current === key && !coop) {
        lastCoopAlertKeyRef.current = null;
      }
    }
  }, [cooperatingCells, editingCell, myClientId, setActiveCell]);

  // 📝 편집 셀 상태 변경 및 브로드캐스트 전송 일괄 래퍼 함수
  const updateEditingCell = useCallback((next: { studentId: string, columnId: string } | null) => {
    setEditingCell((prev) => {
      if (prev) {
        sendCoopEvent('focus_out', prev.studentId, prev.columnId);
      }
      if (next) {
        sendCoopEvent('focus_in', next.studentId, next.columnId);
      }
      return next;
    });
  }, [sendCoopEvent]);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [focusColumn, setFocusColumn] = useState<string | null>(null); // 💡 컬럼 포커스 모드 상태 추가
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false); // 💡 인쇄 미리보기 모달 상태 추가
  const [isCardPrintOpen, setIsCardPrintOpen] = useState(false); // 💡 학생별 안내장 인쇄 모달 상태 추가
  const [isHokmaPrintOpen, setIsHokmaPrintOpen] = useState(false); // 💡 호크마 일지 인쇄 모달 상태 추가
  const checklistRef = React.useRef<any>(null); // 💡 체크리스트 ref 추가
  const [isTagBatchMode, setIsTagBatchMode] = useState(false); // 💡 태그별 일괄입력 모달 상태 추가

  const [hideAbsent, setHideAbsent] = useState<'all' | 'absent' | 'attend'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`todaySheetHideAbsentCycle_${currentUser?.id || 'default'}`);
      return (saved as any) || 'all';
    }
    return 'all';
  });

  const toggleHideAbsent = useCallback(() => {
    setHideAbsent(prev => {
      let next: 'all' | 'absent' | 'attend' = 'all';
      if (prev === 'all') next = 'absent';
      else if (prev === 'absent') next = 'attend';
      else next = 'all';
      localStorage.setItem(`todaySheetHideAbsentCycle_${currentUser?.id || 'default'}`, next);
      return next;
    });
  }, [currentUser?.id]);

  const [showSecondRow, setShowSecondRow] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`todaySheetShowSecondRow_${currentUser?.id || 'default'}`);
      return saved === 'false' ? false : true;
    }
    return true;
  });

  const toggleSecondRow = useCallback(() => {
    setShowSecondRow(prev => {
      const next = !prev;
      localStorage.setItem(`todaySheetShowSecondRow_${currentUser?.id || 'default'}`, String(next));
      return next;
    });
  }, [currentUser?.id]);

  // 2. Memos
  // 💡 [추가] 드래그앤드롭 컬럼 순서 저장용 상태 (새로 추가된 컬럼 자동 보완)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const defaultIds = DEFAULT_COLUMNS.map(c => c.id);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_today_sheet_column_order');
      if (saved) {
        try {
          const parsed: string[] = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const missing = defaultIds.filter(id => !parsed.includes(id));
            if (missing.length > 0) {
              const actionIdx = parsed.indexOf('action');
              const merged = [...parsed];
              if (actionIdx !== -1) {
                merged.splice(actionIdx, 0, ...missing);
              } else {
                merged.push(...missing);
              }
              localStorage.setItem('ams_today_sheet_column_order', JSON.stringify(merged));
              return merged;
            }
            return parsed;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return defaultIds;
  });

  const handleColumnReorder = useCallback((draggedId: string, targetId: string) => {
    const protectedCols = ['select', 'name', 'tools', 'action'];
    if (protectedCols.includes(draggedId) || protectedCols.includes(targetId)) return;
    if (draggedId === targetId) return;

    setColumnOrder(prev => {
      let next = [...prev];
      if (!next.includes(draggedId)) next.push(draggedId);
      if (!next.includes(targetId)) next.push(targetId);

      const draggedIdx = next.indexOf(draggedId);
      const targetIdx = next.indexOf(targetId);
      if (draggedIdx === -1 || targetIdx === -1) return prev;

      next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, draggedId);
      
      localStorage.setItem('ams_today_sheet_column_order', JSON.stringify(next));
      return next;
    });
  }, []);

  const visibleColumns = useMemo(() => {
    if (focusColumn) {
      // 💡 포커스 모드일 때: 이름, 출결, 선택한 컬럼(+테스트 점수), 저장 버튼만 노출
      const base = ['select', 'name', 'attendance'];
      const focused = [focusColumn];
      if (focusColumn === 'test_id') focused.push('test_score');
      return [...base, ...focused, 'action'];
    }
    return presets[activeSet] || DEFAULT_COLUMNS.map(c => c.id);
  }, [presets, activeSet, focusColumn]);

  const activeColumns = useMemo(() => {
    const active = DEFAULT_COLUMNS.filter(col => !col.canHide || visibleColumns.includes(col.id));
    return [...active].sort((a, b) => {
      const idxA = columnOrder.indexOf(a.id);
      const idxB = columnOrder.indexOf(b.id);
      const orderA = idxA !== -1 ? idxA : DEFAULT_COLUMNS.findIndex(c => c.id === a.id) + 100;
      const orderB = idxB !== -1 ? idxB : DEFAULT_COLUMNS.findIndex(c => c.id === b.id) + 100;
      return orderA - orderB;
    });
  }, [visibleColumns, columnOrder]);

  // 💡 [리팩토링 Step 1] 정규/특강 행 확장 및 필터링 커스텀 훅으로 격리
  const baseStudents = useMemo(() => {
    let result = students.filter((s: any) => !s.isSpecialClass && !s.originalId);
    if (hiddenStudentIds.length > 0) {
      result = result.filter((s: any) => !hiddenStudentIds.includes(s.id));
    }
    return result;
  }, [students, hiddenStudentIds]);

  const filteredStudents = useTodaySheetRows({
    students: baseStudents,
    selectedDate,
    academyInfo,
    sortMode,
    sortDirection,
    selectedHour,
    hideAbsent,
    focusColumn
  });

  const {
    selectedIds,
    setSelectedIds,
    handleSelectOne,
    handleSelectAll,
    handleCycleSelectAll,
    selectCycleMode,
    handleRemoveSelectedStudents
  } = useTodaySheetSelection({
    filteredStudents,
    onRemoveFromToday
  });

  // 💡 포커스 모드용 컬럼 너비 계산
  const focusColWidths = useMemo(() => {
    const base = { ...colWidths };
    base['action'] = 8; // 💡 저장 컬럼 너비를 8px로 강제 고정
    
    // 💡 7개 도구 접고 펼칠 때 셀 폭 동적 반응형 조정
    base['tools'] = showAllTools ? 206 : 110;

    if (focusColumn) {
      // 포커스된 컬럼은 화면의 상당 부분을 차지하도록 확장
      base[focusColumn] = 800;
      if (focusColumn === 'test_id') base['test_score'] = 100;
      base['name'] = 140;
      base['attendance'] = 80;
    }
    return base;
  }, [colWidths, focusColumn, showAllTools]);

  const totalWidth = useMemo(() => {
    if (focusColumn) return '100%'; // 포커스 모드에서는 테이블 너비를 100%로 설정
    return activeColumns.reduce((acc, col) => acc + (focusColWidths[col.id] || col.minWidth), 0);
  }, [activeColumns, focusColWidths, focusColumn]);

  // 3. Callbacks
  const isCellInRange = useCallback((studentId: string, colId: string) => {
    if (!selectedRange) return false;
    const sIdx = filteredStudents.findIndex((s:any) => s.id === selectedRange.startStudentId);
    const eIdx = filteredStudents.findIndex((s:any) => s.id === selectedRange.endStudentId);
    const cIdx = filteredStudents.findIndex((s:any) => s.id === studentId);
    const sColIdx = activeColumns.findIndex(col => col.id === selectedRange.startColId);
    const eColIdx = activeColumns.findIndex(col => col.id === selectedRange.endColId);
    const currentColIdx = activeColumns.findIndex(col => col.id === colId);
    if (sIdx === -1 || eIdx === -1 || sColIdx === -1 || eColIdx === -1) return false;
    const rMin = Math.min(sIdx, eIdx); const rMax = Math.max(sIdx, eIdx);
    const cMin = Math.min(sColIdx, eColIdx); const cMax = Math.max(sColIdx, eColIdx);
    return cIdx >= rMin && cIdx <= rMax && currentColIdx >= cMin && currentColIdx <= cMax;
  }, [selectedRange, filteredStudents, activeColumns]);

  const handleSave = useCallback(async (studentId: string, newData: any) => {
    const rowStudent = filteredStudents.find((s: any) => s.id === studentId);
    const realId = rowStudent?.originalId || studentId.replace(/_special.*$/, '');
    const courseName = rowStudent?.courseName || '정규';

    const student = students.find((s: any) => s.id === realId);
    // 💡 [버그 완치] 특강 행일 때는 정규 수업 세션(student?.todaySession)을 절대 함부로 도용하지 않습니다!
    // 오직 해당 행의 고유 세션(rowStudent?.todaySession)만을 철저히 고수하여 크로스 오버를 완벽 차단합니다.
    const session: any = rowStudent?.todaySession || {};
    
    const prevData: any = {};
    const filteredNewData: any = {};
    
    const keys = Object.keys(newData);
    keys.forEach(key => {
      if (key === 'mission') {
        prevData[key] = student?.recent_mission || '';
        filteredNewData[key] = newData[key] || '';
      } else if (key === 'management_notes') {
        prevData[key] = student?.management_notes || '';
        filteredNewData[key] = newData[key] || '';
      } else {
        prevData[key] = session[key] || '';
        filteredNewData[key] = newData[key] || '';
      }
    });

    pushToUndoStack([{
      studentId,
      newData: filteredNewData,
      prevData
    }]);

    // 💡 [낙관적 업데이트] 상태 즉시 변경
    setStudents((prev: any[]) => (prev || []).map(s => {
      const isTargetStudent = s.id === realId || s.id === studentId || s.originalId === realId;
      if (!isTargetStudent) return s;

      const hasMission = 'mission' in newData;
      const hasNotes = 'management_notes' in newData;

      // allLogs는 항상 course_name 기준으로 업데이트 (정규/특강 무관)
      let updatedAllLogs = s.allLogs || [];
      const logIdx = updatedAllLogs.findIndex((l: any) =>
        (l.date || l.session_date) === selectedDate &&
        (l.course_name === courseName || (courseName === '정규' && (!l.course_name || l.course_name === '정규')))
      );

      const newSess = {
        ...(logIdx !== -1 ? updatedAllLogs[logIdx] : {}),
        ...newData,
        course_name: courseName
      };

      if (logIdx !== -1) {
        updatedAllLogs = updatedAllLogs.map((l: any, i: number) => i === logIdx ? { ...l, ...newSess } : l);
      } else {
        updatedAllLogs = [{ ...newSess, date: selectedDate }, ...updatedAllLogs];
      }

      // todaySession은 정규 수업 저장 시에만 반영 (특강 세션은 allLogs로만 관리)
      const isRegularCourse = courseName === '정규' || !courseName;

      return {
        ...s,
        ...(hasMission ? { recent_mission: newData.mission } : {}),
        ...(hasNotes ? { management_notes: newData.management_notes } : {}),
        ...(isRegularCourse ? { todaySession: newSess } : {}),
        allLogs: updatedAllLogs
      };
    }));

    // 💡 이제 학생미션(mission)과 관리주의점(management_notes)도 분기 우회하지 않고,
    // 온전히 하나의 일지 저장 API(onSave)를 타고 ams_session_logs 테이블에 안전하게 하루하루 박제 보존됩니다!
    const savePayload = { ...newData, course_name: courseName };

    if (Object.keys(savePayload).length > 1 || 'mission' in savePayload || 'management_notes' in savePayload) {
      const success = await onSave(realId, savePayload);
      if (success && sendSaveEvent) {
        const invMap: any = { 
          'test_status': 'test_id', 
          'test_score': 'test_score', 
          'classwork_text': 'classwork', 
          'completed_classwork_text': 'completed_classwork', 
          'homework_text': 'assign', 
          'next_quiz_text': 'next_quiz', 
          'mission': 'mission', 
          'special_notes': 'notes', 
          'management_notes': 'management_notes' 
        };
        Object.keys(savePayload).forEach(key => {
          if (key === 'course_name') return;
          const colId = invMap[key] || key;
          sendSaveEvent(studentId, colId, savePayload[key]);
        });
      }
      return success;
    }
    return true;
  }, [onSave, onUpdateStudentInfo, students, filteredStudents, pushToUndoStack, setStudents, sendSaveEvent]);

  const handleBatchSave = useCallback(async (updates: { studentId: string, newData: any, prevData: any }[], targetDate?: string) => {
    if (updates.length === 0) return;

    const saveDate = targetDate || selectedDate;
    pushToUndoStack(updates);

    // 💡 낙관적 업데이트: 화면에 즉시 반영
    setStudents((prev: any[]) => (prev || []).map((s: any) => {
      const match = updates.find(u => {
        const realId = u.studentId.replace(/_special.*$/, '');
        return String(s.id) === String(realId) || String(s.id) === String(u.studentId) || (s.originalId && String(s.originalId) === String(realId));
      });
      if (!match) return s;
      
      const hasMission = 'mission' in match.newData;
      const hasNotes = 'management_notes' in match.newData;
      const rowStudent = filteredStudents.find((fs: any) => String(fs.id) === String(match.studentId));
      const courseName = rowStudent?.courseName || '정규';
      
      let updatedAllLogs = s.allLogs || [];
      const logIdx = updatedAllLogs.findIndex((l: any) =>
        (l.date || l.session_date) === saveDate &&
        (l.course_name === courseName || (courseName === '정규' && (!l.course_name || l.course_name === '정규')))
      );

      const newSess = {
        ...(logIdx !== -1 ? updatedAllLogs[logIdx] : {}),
        ...match.newData,
        course_name: courseName,
        date: saveDate,
        session_date: saveDate
      };

      if (logIdx !== -1) {
        updatedAllLogs = updatedAllLogs.map((l: any, i: number) => i === logIdx ? { ...l, ...newSess } : l);
      } else {
        updatedAllLogs = [{ ...newSess, date: saveDate, session_date: saveDate }, ...updatedAllLogs];
      }

      const isMatchingRow = String(s.id) === String(match.studentId);
      const isRegularCourse = courseName === '정규' || !courseName;

      return {
        ...s,
        ...(hasMission ? { recent_mission: match.newData.mission } : {}),
        ...(hasNotes ? { management_notes: match.newData.management_notes } : {}),
        ...(isRegularCourse || isMatchingRow ? { todaySession: newSess } : {}),
        allLogs: updatedAllLogs
      };
    }));

    await Promise.all(updates.map(async (u) => {
      const rowStudent = filteredStudents.find((s: any) => String(s.id) === String(u.studentId));
      const realId = rowStudent?.originalId || u.studentId.replace(/_special.*$/, '');
      const courseName = rowStudent?.courseName || '정규';

      const savePayload = { ...u.newData, course_name: courseName, session_date: saveDate };
      
      const success = await onSave(realId, savePayload);
      if (success && sendSaveEvent) {
        const invMap: any = { 
          'test_status': 'test_id', 
          'test_score': 'test_score', 
          'classwork_text': 'classwork', 
          'completed_classwork_text': 'completed_classwork', 
          'homework_text': 'assign', 
          'special_notes': 'notes' 
        };
        Object.keys(u.newData).forEach(key => {
          const colId = invMap[key] || key;
          sendSaveEvent(u.studentId, colId, u.newData[key]);
        });
      }
    }));
  }, [onSave, onUpdateStudentInfo, filteredStudents, selectedDate, pushToUndoStack, sendSaveEvent, setStudents]);

  const handleCopy = useCallback((e: ClipboardEvent) => {
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    if (isInputFocused && editingCell) return;

    if (!activeCell && (!selectedRange || !selectedRange.startStudentId)) return;

    const mapField = (colId: string) => {
      if (colId === 'attendance') return 'attendance_status';
      if (colId === 'test_id') return 'test_id';
      if (colId === 'test_score') return 'test_score';
      if (colId === 'assign') return 'homework_text';
      if (colId === 'classwork') return 'classwork_text';
      if (colId === 'completed_classwork') return 'completed_classwork_text';
      if (colId === 'mission') return 'mission';
      if (colId === 'notes') return 'special_notes';
      if (colId === 'next_quiz') return 'next_quiz_text';
      if (colId === 'management_notes') return 'management_notes';
      return colId;
    };

    let rowsToCopy: string[][] = [];

    if (selectedRange && selectedRange.startStudentId && selectedRange.endStudentId) {
      const startStudentIdx = students.findIndex((s: any) => s.id === selectedRange.startStudentId);
      const endStudentIdx = students.findIndex((s: any) => s.id === selectedRange.endStudentId);
      const startColIdx = activeColumns.findIndex(col => col.id === selectedRange.startColId);
      const endColIdx = activeColumns.findIndex(col => col.id === selectedRange.endColId);

      if (startStudentIdx !== -1 && endStudentIdx !== -1 && startColIdx !== -1 && endColIdx !== -1) {
        const minRow = Math.min(startStudentIdx, endStudentIdx);
        const maxRow = Math.max(startStudentIdx, endStudentIdx);
        const minCol = Math.min(startColIdx, endColIdx);
        const maxCol = Math.max(startColIdx, endColIdx);

        for (let r = minRow; r <= maxRow; r++) {
          const student = students[r];
          if (!student) continue;
          const session = student.todaySession || {};
          const rowVals: string[] = [];

          for (let c = minCol; c <= maxCol; c++) {
            const col = activeColumns[c];
            if (!col) continue;
            if (col.id === 'name') {
              rowVals.push(student.name || '');
            } else if (col.id === 'select' || col.id === 'action') {
              rowVals.push('');
            } else {
              const field = mapField(col.id);
              rowVals.push(String(session[field] || ''));
            }
          }
          rowsToCopy.push(rowVals);
        }
      }
    } else if (activeCell) {
      const student = students.find((s: any) => s.id === activeCell.studentId);
      if (student) {
        const session = student.todaySession || {};
        const field = mapField(activeCell.columnId);
        const val = String(session[field] || '');
        rowsToCopy.push([val]);
      }
    }

    if (rowsToCopy.length > 0) {
      e.preventDefault();
      const tsvText = rowsToCopy.map(r => r.join('\t')).join('\n');
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', tsvText);
      }
    }
  }, [activeCell, selectedRange, students, activeColumns, editingCell]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    if (isInputFocused && editingCell) return;

    if (!activeCell) return;
    const clipboardData = e.clipboardData?.getData('text/plain');
    if (!clipboardData) return;
    try {
      const dataMatrix: string[][] = []; let currentRow: string[] = []; let currentCell = ''; let inQuotes = false;
      for (let i = 0; i < clipboardData.length; i++) {
        const char = clipboardData[i]; const nextChar = clipboardData[i + 1];
        if (char === '"') { if (inQuotes && nextChar === '"') { currentCell += '"'; i++; } else { inQuotes = !inQuotes; } } 
        else if (char === '\t' && !inQuotes) { currentRow.push(currentCell); currentCell = ''; }
        else if ((char === '\r' && nextChar === '\n' || char === '\n') && !inQuotes) { currentRow.push(currentCell); dataMatrix.push(currentRow); currentRow = []; currentCell = ''; if (char === '\r') i++; } 
        else { currentCell += char; }
      }
      if (currentCell !== '' || currentRow.length > 0) { currentRow.push(currentCell); dataMatrix.push(currentRow); }
      if (dataMatrix.length > 1 && dataMatrix[dataMatrix.length - 1].length === 1 && dataMatrix[dataMatrix.length - 1][0] === '') dataMatrix.pop();
      const isSingle = dataMatrix.length === 1 && dataMatrix[0].length === 1;
      const isEditing = !!editingCell;
      if (isEditing) return;
      e.preventDefault();
      const updates: any[] = [];
      const startColIdx = activeColumns.findIndex(col => col.id === activeCell.columnId);
      const mapField = (colId: string) => {
        if (colId === 'attendance') return 'attendance_status';
        if (colId === 'test_id') return 'test_id';
        if (colId === 'test_score') return 'test_score';
        if (colId === 'assign') return 'homework_text';
        if (colId === 'classwork') return 'classwork_text';
        if (colId === 'completed_classwork') return 'completed_classwork_text';
        if (colId === 'mission') return 'mission';
        if (colId === 'notes') return 'special_notes';
        if (colId === 'next_quiz') return 'next_quiz_text';
        if (colId === 'management_notes') return 'management_notes';
        return colId;
      };
      if (isSingle && selectedIds.length > 1) {
        const val = dataMatrix[0][0]; const col = activeColumns[startColIdx];
        if (col && !['select', 'name', 'action'].includes(col.id)) {
          const field = mapField(col.id);
          selectedIds.forEach(id => {
            const st = students.find((s: any) => s.id === id); if (!st) return;
            const session = st.todaySession || {};
            updates.push({ studentId: id, newData: { ...session, [field]: val }, prevData: { ...session } });
          });
        }
      } else {
        const startStudentIdx = students.findIndex((s: any) => s.id === activeCell.studentId);
        if (startStudentIdx === -1 || startColIdx === -1) return;
        dataMatrix.forEach((rowValues, rowOffset) => {
          const currentStudent = students[startStudentIdx + rowOffset]; if (!currentStudent) return;
          const session = currentStudent.todaySession || {}; const upds: any = { ...session }; let changed = false;
          rowValues.forEach((value, colOffset) => {
            const col = activeColumns[startColIdx + colOffset]; if (!col || ['select', 'name', 'action', 'date'].includes(col.id)) return;
            if (col.id === 'attendance') return;
            const field = mapField(col.id);
            if (String(session[field] || '') !== value) { upds[field] = value; changed = true; }
          });
          if (changed) updates.push({ studentId: currentStudent.id, newData: upds, prevData: { ...session } });
        });
      }
      if (updates.length > 0) { 
        // 💡 [낙관적 업데이트] 붙여넣기 데이터를 즉시 state에 반영
        setStudents((prev: any[]) => prev.map(s => {
          const update = updates.find(u => u.studentId === s.id);
          if (update) {
            return {
              ...s,
              todaySession: {
                ...(s.todaySession || {}),
                ...update.newData
              }
            };
          }
          return s;
        }));

        await handleBatchSave(updates); 
        setEditingCell(null); 

        // 💡 [최종 최적화] 브라우저의 다음 프레임에서 즉시 DOM 업데이트 (반응성 우선)
        requestAnimationFrame(() => {
          updates.forEach(u => {
            const invMap: any = { 'test_status': 'test_id', 'test_score': 'test_score', 'classwork_text': 'classwork', 'completed_classwork_text': 'completed_classwork', 'homework_text': 'assign', 'next_quiz_text': 'next_quiz', 'mission': 'mission', 'special_notes': 'notes', 'management_notes': 'management_notes' };
            Object.keys(u.newData).forEach(field => {
              if (String(u.newData[field] || '') === String(u.prevData?.[field] || '')) return;

              const colId = invMap[field];
              if (!colId) return;
              const selector = `[data-student-id="${u.studentId}"][data-col-id="${colId}"]`;
              const el = document.querySelector(selector) as HTMLTextAreaElement | HTMLInputElement;
              if (el) el.value = u.newData[field] || '';
            });
          });
        });
      }
    } catch (err) { console.error('Paste error:', err); }
  }, [activeCell, editingCell, activeColumns, selectedIds, students, handleBatchSave]);

  // 💡 [수동 이월] 주의점(management_notes) 칼럼 헤더 🪄 버튼 클릭 시 비어있는 셀에 최신 메모 채우기
  const handleAutofillManagementNotes = useCallback(async () => {
    const emptyTargets: any[] = [];
    filteredStudents.forEach((st: any) => {
      const currentNote = st.todaySession?.management_notes || (st.courseName === '특강' ? '' : st.management_notes) || '';
      if (!currentNote || String(currentNote).trim() === '') {
        // 과거 logs 중 가장 최근 작성된 메모 찾기
        const pastLogs = (st.allLogs || [])
          .filter((l: any) => l.management_notes && String(l.management_notes).trim() !== '' && (l.date || l.session_date || '') < selectedDate)
          .sort((a: any, b: any) => String(b.date || b.session_date || '').localeCompare(String(a.date || a.session_date || '')));
        
        const latestPastNote = pastLogs.length > 0 ? String(pastLogs[0].management_notes) : (st.management_notes || '');
        if (latestPastNote && String(latestPastNote).trim() !== '') {
          emptyTargets.push({
            studentId: st.id, // 행 고유 ID (예: 'id' 또는 'id_special_...')
            latestNote: latestPastNote
          });
        }
      }
    });

    if (emptyTargets.length === 0) {
      alert('비어있는 주의점 항목 중 이월할 과거 메모가 있는 학생이 없습니다.');
      return;
    }

    // 1. 부모 Local State(setStudents) 선반영
    setStudents((prev: any[]) => prev.map(s => {
      const target = emptyTargets.find(t => t.studentId === s.id);
      if (target) {
        return {
          ...s,
          todaySession: { ...(s.todaySession || {}), management_notes: target.latestNote }
        };
      }
      return s;
    }));

    // 2. DB 및 백엔드 batchSave 반영 & Cmd+Z Undo 스택 등록 (변경된 management_notes 필드만 단일 객체로 구성)
    const updates = emptyTargets.map(t => ({
      studentId: t.studentId,
      newData: { management_notes: t.latestNote },
      prevData: { management_notes: '' }
    }));

    await handleBatchSave(updates);

    // 3. DOM Sync
    requestAnimationFrame(() => {
      emptyTargets.forEach(t => {
        const selector = `[data-student-id="${t.studentId}"][data-col-id="management_notes"]`;
        const el = document.querySelector(selector) as HTMLTextAreaElement | HTMLInputElement;
        if (el) el.value = t.latestNote;
      });
    });
  }, [filteredStudents, selectedDate, setStudents, handleBatchSave]);

  // 📝 [리팩토링] 엑셀 및 ACA2000 가공/다운로드 전용 분리 훅 호출
  // 💡 filteredStudents: 정규/특강 행이 이미 분리된 배열 → 아카2000 export 시 각각 별도 행 출력
  const { handleExport } = useTodaySheetExport({
    students: filteredStudents,
    teachers,
    currentUser,
    academyInfo,
    selectedDate,
    masterTextbooks,
    activeColumns,
    setIsExportOpen,
  });

  // 📝 [리팩토링] 아카2000 일지 엑셀 데이터 파일 복원/가져오기 전용 분리 훅 호출
  const { handleImportExcel } = useTodaySheetImport({
    students: filteredStudents,
    allStudents: allStudents || students,
    onBatchSave: handleBatchSave,
    selectedDate,
    onDateChange
  });



  const onCellMouseDown = useCallback((e: React.MouseEvent, studentId: string, colId: string) => {
    if (['select', 'action'].includes(colId)) return;
    const isShift = e.shiftKey;
    setSelectedRange({ startStudentId: studentId, startColId: colId, endStudentId: studentId, endColId: colId });
    setIsDragging(true);
    requestAnimationFrame(() => {
      if (!isShift) { setActiveCell({ studentId, columnId: colId }); }
      updateEditingCell(null);
    });
  }, [updateEditingCell]);

  const onCellMouseEnter = useCallback((studentId: string, colId: string) => {
    if (!isDragging || !selectedRange) return;
    setSelectedRange(prev => prev ? { ...prev, endStudentId: studentId, endColId: colId } : null);
  }, [isDragging, selectedRange]);

  const handleActiveCellChange = useCallback((studentId: string, colId: string) => { 
    requestAnimationFrame(() => {
      setActiveCell({ studentId, columnId: colId }); 
      updateEditingCell(null);
    });
  }, [updateEditingCell]);
  const handleEditingCellChange = useCallback((studentId: string, colId: string | null) => { 
    requestAnimationFrame(() => {
      updateEditingCell(colId ? { studentId, columnId: colId } : null); 
    });
  }, [updateEditingCell]);
  const toggleHistory = useCallback((studentId: string) => { setExpandedHistory(prev => ({ ...prev, [studentId]: prev[studentId] ? 0 : 3 })); }, []);

  const handleSetSwitch = useCallback((setId: string) => { 
    setActiveSet(setId); 
    localStorage.setItem(`todaySheetActiveSet_${currentUser?.id || 'default'}`, setId); 
  }, [currentUser?.id]);

  const toggleColumn = useCallback((colId: string) => { 
    const newCols = visibleColumns.includes(colId) ? visibleColumns.filter(c => c !== colId) : [...visibleColumns, colId]; 
    const newPresets = { ...presets, [activeSet]: newCols }; 
    setPresets(newPresets); 
    localStorage.setItem(`todaySheetPresets_${currentUser?.id || 'default'}`, JSON.stringify(newPresets)); 
  }, [visibleColumns, presets, activeSet, currentUser?.id]);

  // 4. Custom Hooks (Shortcuts & Events)
  useTodaySheetShortcuts({
    activeCell, setActiveCell,
    editingCell, setEditingCell,
    students, setStudents,
    filteredStudents,
    activeColumns,
    selectedRange, setSelectedRange,
    selectedDate,
    handleBatchSave,
    handleSetSwitch,
    setIsDragging,
    selectedIds,
    onSave,
    toggleSecondRow,
    toggleHistory,
    handleUndo,
    handleRedo,
    toggleShowAllTools: () => {
      setShowAllTools(prev => {
        const next = !prev;
        if (!next) setIsToolsEditMode(false);
        return next;
      });
    }
  });

  const resizingCol = useRef<{ id: string; startX: number; startWidth: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent, colId: string) => { resizingCol.current = { id: colId, startX: e.pageX, startWidth: colWidths[colId] || 100 }; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); document.body.style.cursor = 'col-resize'; };
  const onMouseMove = (e: MouseEvent) => { if (!resizingCol.current) return; const { id, startX, startWidth } = resizingCol.current; const newWidth = Math.max(40, startWidth + (e.pageX - startX)); setColWidths(prev => ({ ...prev, [id]: newWidth })); };
  const onMouseUp = () => { if (resizingCol.current) { setColWidths(latest => { localStorage.setItem('todaySheetColWidths', JSON.stringify(latest)); return latest; }); } resizingCol.current = null; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); document.body.style.cursor = 'default'; };

  // 💡 더블클릭 자동 열폭 맞춤 핸들러 추가 (DOM 데이터 파싱 방식)
  const handleDoubleClickResize = useCallback((colId: string) => {
    const cells = document.querySelectorAll(`[data-col-id="${colId}"]`);
    if (cells.length === 0) return;

    const calcTextWidth = (text: string) => {
      if (!text) return 0;
      let width = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        if (char > 127) width += 12; // 한글
        else width += 7.2; // 영문, 숫자, 공백 등
      }
      return width;
    };

    let maxContentWidth = 60;

    cells.forEach((cell: any) => {
      let val = '';
      
      // 셀 내부에 textarea나 input이 있다면 그 value를 가져오고, 없으면 innerText를 사용
      const inputEl = cell.querySelector('textarea, input');
      if (inputEl) {
        val = inputEl.value || '';
      } else {
        val = cell.innerText || '';
      }

      // 줄바꿈이 있는 텍스트는 가장 긴 라인을 기준으로 계산
      const lines = val.split('\n');
      lines.forEach((line: string) => {
        const w = calcTextWidth(line.trim()) + 28; // 셀 패딩 및 여백 확보
        if (w > maxContentWidth) maxContentWidth = w;
      });
    });

    const col = activeColumns.find((c: any) => c.id === colId);
    const finalWidth = Math.min(450, Math.max(col?.minWidth || 60, maxContentWidth));
    setColWidths(prev => {
      const next = { ...prev, [colId]: finalWidth };
      localStorage.setItem('todaySheetColWidths', JSON.stringify(next));
      return next;
    });
  }, [activeColumns]);

  const handleSendAll = async () => { if (!confirm(`${students.length}명 일괄 발송하시겠습니까?`)) return; setIsSendingReport('all'); let count = 0; for (const s of students) { try { const res = await fetch('/api/report', { method: 'POST', body: JSON.stringify({ studentId: s.id, sessionDate: selectedDate, academyId: academyInfo.id }) }); if (res.ok) count++; } catch(e){} } alert(`${count}명 완료`); setIsSendingReport(null); };
  const handleSendIndividual = async (id: string) => { const s = students.find((st:any) => st.id === id); if (!s) return; setIsSendingReport(id); try { const res = await fetch('/api/report', { method: 'POST', body: JSON.stringify({ studentId: id, sessionDate: selectedDate, academyId: academyInfo.id }) }); if (res.ok) alert(`${s.name} 발송 완료`); } catch(e){} finally { setIsSendingReport(null); } };

  const gradeStats = useMemo(() => { const stats: Record<string, number> = {}; ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'].forEach(g => stats[g] = 0); students.forEach((s:any) => { if (stats[s.grade] !== undefined) stats[s.grade]++; }); return stats; }, [students]);

  return (
    <div className="p-3 space-y-4 relative flex flex-col h-full overflow-hidden bg-[#050505] text-center">
      <div className="flex items-center justify-between px-3 py-2 bg-black/50 border border-white/10 rounded-lg shrink-0 no-print">
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5 items-start">
            <div className="flex items-center gap-3">
              <h3 className="text-[13px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2.5"><TableIcon size={16} /> Daily Sheet</h3>
              <div className="flex items-center bg-zinc-950 p-0.5 rounded-[4px] border border-zinc-800 shadow-inner">
                <button
                  onClick={() => setActiveTab('daily')}
                  className={`px-2.5 py-1 rounded-[3px] text-[10px] font-black tracking-tight transition-all cursor-pointer ${
                    activeTab === 'daily' 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
                >
                  📝 일지 작성
                </button>
                <button
                  onClick={() => setActiveTab('checklist')}
                  className={`px-2.5 py-1 rounded-[3px] text-[10px] font-black tracking-tight transition-all cursor-pointer ${
                    activeTab === 'checklist' 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
                >
                  📋 체크리스트
                </button>
              </div>
              <button
                onClick={onOpenBriefing}
                title="오늘의 브리핑 열기"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-[4px] text-[10px] font-black tracking-tight transition-all cursor-pointer shadow-md shadow-amber-950/20 ml-2"
              >
                <Megaphone size={11} className="text-amber-355" />
                오늘의 브리핑
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter mr-1">{students.length} Total</span>
              {Object.entries(gradeStats).filter(([_, count]) => count > 0).map(([grade, count], idx) => {
                const colorClass = grade.includes('초') ? 'text-emerald-500/80' : grade.includes('고') ? 'text-amber-500/80' : 'text-blue-500/80';
                return <div key={grade || idx} className="flex items-center gap-1 bg-white/[0.03] border border-white/5 px-1.5 py-0.5 rounded-[2px]"><span className="text-[8px] font-bold text-gray-600 uppercase">{grade}</span><span className={`text-[8px] font-black ${colorClass}`}>{count}</span></div>;
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 no-print">
          {focusColumn && (
            <div className="flex items-center gap-2 bg-blue-600/20 border border-blue-500/40 px-3 py-1.5 rounded-md animate-pulse">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Focus Mode: {DEFAULT_COLUMNS.find(c => c.id === focusColumn)?.label}</span>
              <button onClick={() => setFocusColumn(null)} className="p-1 hover:bg-blue-500/30 rounded text-blue-400 transition-all"><X size={14} /></button>
            </div>
          )}

          {(() => {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const seoulTime = new Date(utc + (9 * 3600000));
            const todayStr = `${seoulTime.getFullYear()}-${String(seoulTime.getMonth() + 1).padStart(2, '0')}-${String(seoulTime.getDate()).padStart(2, '0')}`;
            const isNotToday = selectedDate !== todayStr;
            
            const [y, m, d] = selectedDate.split('-');
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const selectedDayStr = (y && m && d) ? `(${dayNames[new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay()]})` : '';

            const displayDate = (y && m && d) ? `${y.slice(2)}.${m}.${d}` : selectedDate;

            return (
              <div className="flex items-center gap-1.5">
                {/* 💡 [추가] 오늘 날짜 퀵 복귀 Today 버튼 */}
                <button
                  onClick={() => isNotToday && onDateChange(todayStr)}
                  disabled={!isNotToday}
                  className={`px-2.5 py-1.5 text-[10.5px] font-black uppercase tracking-wider rounded-[6px] transition-all border shadow-xl ${
                    isNotToday
                      ? 'bg-blue-950/60 border-blue-500/40 text-blue-300 hover:bg-blue-600 hover:text-white cursor-pointer'
                      : 'bg-[#121212] border-white/5 text-gray-655 cursor-not-allowed opacity-30'
                  }`}
                  title="오늘 날짜로 복귀"
                >
                  Today
                </button>

                <div onClick={(e) => { const input = e.currentTarget.querySelector('input'); if (input && 'showPicker' in input) try { (input as any).showPicker(); } catch (err) { console.error(err); } }}
                  className={`flex items-center gap-1 border rounded-[6px] px-2 py-1.5 transition-all group cursor-pointer shadow-xl relative ${
                    isNotToday 
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 hover:bg-rose-900/30' 
                      : 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-900/40'
                  }`}>
                  <CalendarIcon size={13} className={isNotToday ? 'text-rose-400 animate-pulse' : 'text-amber-400 group-hover:text-amber-300'} />
                  <span className={`text-[11.5px] font-black tracking-tight shrink-0 select-none ${isNotToday ? 'text-rose-300' : 'text-amber-300'}`}>
                    {displayDate}
                  </span>
                  <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="absolute opacity-0 w-0 h-0 pointer-events-none" />
                  {isNotToday ? (
                    <div className="ml-0.5 px-1 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded-sm whitespace-nowrap shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                      {selectedDayStr}
                    </div>
                  ) : (
                    <div className="ml-0.5 px-1 py-0.5 bg-amber-500 text-black text-[9px] font-black rounded-sm whitespace-nowrap shadow-[0_0_8px_rgba(245,158,11,0.25)]">
                      {selectedDayStr}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <button onClick={() => setIsReportVisible(!isReportVisible)} className={`flex items-center gap-2 px-5 py-2 rounded-[6px] text-[11px] font-black uppercase tracking-widest transition-all border shadow-xl ${isReportVisible ? 'bg-blue-600 border-blue-500 text-white shadow-blue-900/30' : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-850'}`}><LayoutGrid size={16} /> {isReportVisible ? '리포트 닫기' : '리포트 미리보기'}</button>
          
          {/* 💡 [변경] 전체 리포트 발송 버튼 (1행 안전 구역으로 이동) */}
          <button onClick={handleSendAll} disabled={!!isSendingReport} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-[6px] text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 shadow-xl no-print">
            {isSendingReport === 'all' ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />} 전체 리포트 발송
          </button>
          
          <div className="relative">
            <input 
              type="file" 
              id="excel-aca-import-input" 
              accept=".xlsx, .xls" 
              onChange={handleImportExcel} 
              className="hidden" 
            />
            <button onClick={() => setIsExportOpen(!isExportOpen)} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-[6px] text-[10px] font-black uppercase tracking-widest text-zinc-200 hover:text-white hover:bg-zinc-800 transition-all shadow-xl"><Download size={14} /> Download</button>
            <AnimatePresence>
              {isExportOpen && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-56 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 rounded-lg shadow-2xl p-2 z-[100] overflow-hidden">
                  <div className="space-y-1">
                    <button onClick={() => handleExport('aca2000')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-indigo-400 transition-all text-left group border border-indigo-500/10 hover:border-indigo-500/30 mb-1 bg-indigo-500/5"><div className="w-8 h-8 rounded bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all"><Zap size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">ACA2000 전용</span><span className="text-[9px] text-gray-600">업로드용 맞춤 엑셀</span></div></button>
                    <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-emerald-400 transition-all text-left group"><div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all"><FileSpreadsheet size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">Excel File</span><span className="text-[9px] text-gray-600">Microsoft Excel (.xlsx)</span></div></button>
                    <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-amber-400 transition-all text-left group"><div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all"><FileTextIcon size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">CSV File</span><span className="text-[9px] text-gray-600">쉼표로 구분된 텍스트 파일</span></div></button>
                    <button onClick={() => handleExport('copy')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-all text-left group"><div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all"><Copy size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">Copy to Clipboard</span><span className="text-[9px] text-gray-600">다른 엑셀 시트에 바로 붙여넣기</span></div></button>
                    
                    <div className="border-t border-white/5 my-1.5" />
                    
                    <button 
                      onClick={() => {
                        setIsExportOpen(false);
                        setTimeout(() => {
                          const inputEl = document.getElementById('excel-aca-import-input') as HTMLInputElement;
                          if (inputEl) {
                            inputEl.value = '';
                            inputEl.click();
                          }
                        }, 50);
                      }} 
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-purple-400 transition-all text-left group border border-purple-500/10 hover:border-purple-500/30 bg-purple-500/5"
                    >
                      <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-black">엑셀 일지 가져오기 (Import)</span>
                        <span className="text-[9px] text-purple-400/80 font-bold">아카2000 엑셀 업로드 복원</span>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2행 접기/펼치기 토글 버튼 */}
          <button 
            onClick={toggleSecondRow} 
            className={`p-2 border rounded-[6px] transition-all shadow-xl ${showSecondRow ? 'bg-blue-650/20 border-blue-500/40 text-blue-350' : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'}`}
            title={showSecondRow ? "상세 설정 도구 접기" : "상세 설정 도구 펼치기"}
          >
            {showSecondRow ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-zinc-900 border border-zinc-800 rounded-[6px] text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all shadow-xl"><Settings2 size={18} /></button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showSecondRow && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 bg-[#0a0a0a]/60 border border-white/5 rounded-lg shrink-0 text-left no-print overflow-hidden"
          >
            {/* 2행 왼쪽: 세트 선택 스위치 & 전체화면 모드 필터들 */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Set</span>
                <div className="flex bg-zinc-950 p-0.5 rounded-md border border-zinc-800">
                  {['1', '2', '3', '4'].map((setId, idx) => {
                    const keys = ['Q', 'W', 'E', 'R'];
                    return (
                      <button 
                        key={setId} 
                        onClick={() => handleSetSwitch(setId)} 
                        className={`w-7 py-1 rounded-[4px] text-[11px] font-black transition-all ${activeSet === setId ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`} 
                        title={`Alt + ${keys[idx]}`}
                      >
                        {setId}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={() => setIsTagBatchMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-350 border border-indigo-500/30 hover:bg-indigo-650 hover:text-white rounded-[4px] text-[10px] font-black transition-all ml-2 shadow-sm"
                title="태그별 일괄입력 모드 열기"
              >
                <Wand2 size={12} />
                태그입력
              </button>

              <button
                onClick={toggleHideAbsent}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-[4px] text-[10px] font-black transition-all ml-1 shadow-sm ${
                  hideAbsent === 'absent'
                    ? 'bg-rose-500/20 text-rose-355 border-rose-500/30 hover:bg-rose-500/40 hover:text-white shadow-md'
                    : hideAbsent === 'attend'
                    ? 'bg-emerald-500/20 text-emerald-355 border-emerald-500/30 hover:bg-emerald-500/40 hover:text-white shadow-md'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white shadow-sm'
                }`}
                title={
                  hideAbsent === 'all' ? '전체 학생 표시 중 (클릭 시 결석생만 표시)' :
                  hideAbsent === 'absent' ? '결석생만 표시 중 (클릭 시 출석생만 표시)' :
                  '출석생(지각 포함)만 표시 중 (클릭 시 전체 표시)'
                }
              >
                {hideAbsent === 'all' && '전체'}
                {hideAbsent === 'absent' && '결석'}
                {hideAbsent === 'attend' && '출석'}
              </button>





              {isFullScreen && (
                <>
                  <div className="h-4 w-px bg-white/10" />

                  {/* 담당 선생님 필터 (라벨 제거) */}
                  <select 
                    value={selectedTeacherId} 
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="bg-black border border-white/10 rounded-[4px] px-2.5 py-1.5 text-[10px] font-bold text-white outline-none focus:border-blue-500 [color-scheme:dark]"
                  >
                    <option value="All">전체 선생님</option>
                    {teachers.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.initials || '?'})</option>
                    ))}
                  </select>

                  <div className="h-4 w-px bg-white/10" />

                  {/* 학년 필터 (라벨 제거 & 초/중/고 축소) */}
                  <div className="flex bg-zinc-950 rounded-[4px] p-0.5 border border-zinc-800">
                    {[
                      { label: 'ALL', key: 'All' }, { label: '초', key: '초' }, { label: '중', key: '중' }, { label: '고', key: '고' }
                    ].map((g) => (
                      <button 
                        key={g.key} 
                        onClick={() => setSelectedFilter(g.key)} 
                        className={`px-2.5 py-1 rounded-[3px] text-[9px] font-black uppercase transition-all ${selectedFilter === g.key ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>

                  <div className="h-4 w-px bg-white/10" />

                  {/* 요일 필터 (라벨 제거) */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-[3px]">
                      {['월', '화', '수', '목', '금', '토', '일'].map((day) => {
                        const isActive = selectedDays.includes(day);
                        return (
                          <button 
                            key={day} 
                            onClick={() => {
                              if (selectedDays.includes(day)) {
                                setSelectedDays(selectedDays.filter((d: string) => d !== day));
                              } else {
                                setSelectedDays([...selectedDays, day]);
                              }
                            }} 
                            className={`w-6 h-6 rounded-[3px] text-[8px] font-black transition-all border ${isActive ? 'bg-blue-600 border-blue-500 text-white shadow-md' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    {selectedDays.length > 0 && (
                      <button 
                        onClick={() => setIsAndFilter(!isAndFilter)} 
                        className={`px-1.5 py-0.5 rounded-[3px] text-[8px] font-black uppercase border transition-all ${isAndFilter ? 'bg-indigo-650/20 border-indigo-500/40 text-indigo-405 shadow-sm' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                      >
                        {isAndFilter ? 'AND' : 'OR'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 2행 오른쪽: 정렬, 선택 숨김 제어, 화면 컨트롤 */}
            <div className="flex flex-nowrap items-center gap-3 ml-auto justify-end shrink-0">
              {/* 선택 학생 숨김 / 전체 해제 버튼 (이력 왼쪽 배치) */}
              {(selectedIds.length > 0 || hiddenStudentIds.length > 0) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedIds.length > 0 && (
                    <button
                      onClick={() => {
                        setHiddenStudentIds(prev => [
                          ...prev,
                          ...selectedIds.map((id: string) => extractRealStudentId(id))
                        ]);
                        setSelectedIds([]);
                      }}
                      className="px-2 py-1 rounded-[4px] bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white transition-all flex items-center gap-1 text-[8px] font-black animate-pulse cursor-pointer"
                      title="선택한 학생들을 임시로 숨깁니다"
                    >
                      <EyeOff size={10} />
                      숨김 ({selectedIds.length})
                    </button>
                  )}
                  {hiddenStudentIds.length > 0 && (
                    <button
                      onClick={() => setHiddenStudentIds([])}
                      className="px-2 py-1 rounded-[4px] bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-650 hover:text-white transition-all flex items-center gap-1 text-[8px] font-black shadow-sm cursor-pointer"
                      title="숨겨진 학생들을 모두 다시 표시합니다"
                    >
                      <Eye size={10} />
                      해제 ({hiddenStudentIds.length})
                    </button>
                  )}
                  <div className="h-4 w-px bg-white/10" />
                </div>
              )}

              {/* 이전 기록 개수 설정 */}
              <div className="flex items-center gap-1.5 bg-white/5 rounded-[4px] px-2 py-0.5 border border-white/5">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mr-1">이력</span>
                <select
                  value={historyLimit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setHistoryLimit(val);
                    localStorage.setItem('ams_history_limit', String(val));
                  }}
                  className="bg-transparent border-0 text-[10px] font-black text-white outline-none cursor-pointer focus:ring-0 py-0.5"
                >
                  <option value={1} className="bg-[#050505] text-white">1개</option>
                  <option value={2} className="bg-[#050505] text-white">2개</option>
                  <option value={3} className="bg-[#050505] text-white">3개</option>
                  <option value={5} className="bg-[#050505] text-white">5개</option>
                  <option value={10} className="bg-[#050505] text-white">10개</option>
                  <option value={20} className="bg-[#050505] text-white">20개</option>
                </select>
              </div>

              <div className="h-4 w-px bg-white/10" />

              {/* 순환형 정렬(Sort) 스마트 버튼 + UP/DOWN 방향 유지 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-gray-550 uppercase tracking-widest">Sort</span>
                <button
                  onClick={() => {
                    const modes: ('time' | 'name' | 'grade' | 'school')[] = ['time', 'name', 'grade', 'school'];
                    const nextIdx = (modes.indexOf(sortMode) + 1) % modes.length;
                    onSortModeChange(modes[nextIdx]);
                  }}
                  className="px-2.5 py-1 rounded-[4px] bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600 hover:text-white transition-all text-[9.5px] font-black uppercase shadow-sm cursor-pointer flex items-center gap-1"
                  title="클릭 시: 시간순 -> 이름순 -> 학년순 -> 학교순 순환 정렬"
                >
                  {sortMode === 'time' && '⏰ 시간순'}
                  {sortMode === 'name' && '🔤 이름순'}
                  {sortMode === 'grade' && '🎓 학년순'}
                  {sortMode === 'school' && '🏫 학교순'}
                </button>

                <button 
                  onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1 rounded-[4px] bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-850 transition-all flex items-center gap-1 text-[8px] font-black shadow-sm"
                  title={sortDirection === 'asc' ? '오름차순 (Up)' : '내림차순 (Down)'}
                >
                  {sortDirection === 'asc' ? <ArrowUp size={10} className="text-blue-400" /> : <ArrowDown size={10} className="text-purple-400" />}
                  {sortDirection === 'asc' ? 'UP' : 'DOWN'}
                </button>
              </div>

              <div className="h-4 w-px bg-white/10" />

              {/* 화면 컨트롤 (원래 크기로 복원, 전체화면, 인쇄하기) */}
              <div className="flex items-center gap-1.5">
                {focusColumn && (
                  <button 
                    onClick={() => setFocusColumn(null)} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-[4px] text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all animate-pulse mr-1"
                  >
                    <ArrowLeft size={12} /> 원래 크기로
                  </button>
                )}
                <button 
                  onClick={onToggleFullScreen} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 rounded-[4px] text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                >
                  {isFullScreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  {isFullScreen ? '원래화면' : '전체화면'}
                </button>
                <button 
                  onClick={() => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                    setTimeout(() => setIsCardPrintOpen(true), 150);
                  }} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 border border-emerald-500 text-white rounded-[4px] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg mr-1.5"
                >
                  <Printer size={12} /> 안내장
                </button>
                <button 
                  onClick={() => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                    setTimeout(() => setIsHokmaPrintOpen(true), 150);
                  }} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 border border-amber-500 text-white rounded-[4px] text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 transition-all shadow-lg mr-1.5"
                >
                  <Printer size={12} /> 개별일지
                </button>
                <button 
                  onClick={() => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                    setTimeout(() => {
                      if (activeTab === 'checklist') {
                        checklistRef.current?.openPrintPreview();
                      } else {
                        setIsPrintPreviewOpen(true);
                      }
                    }, 150);
                  }} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 border border-indigo-500 text-white rounded-[4px] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg"
                >
                  <Printer size={12} /> 인쇄하기
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'checklist' ? (
        <ChecklistTab ref={checklistRef} students={filteredStudents} academyInfo={academyInfo} />
      ) : (
        <div 
          className={`bg-black border border-white/20 rounded-lg shadow-2xl custom-scrollbar-h overflow-x-auto overflow-y-auto transition-all duration-500 ${isReportVisible ? 'max-h-[35vh] shrink-0' : 'flex-1 min-h-0'} today-sheet-container no-print`}
          onScroll={handleScroll}
        >
        <table style={{ width: totalWidth, minWidth: '100%' }} className={`border-collapse table-fixed text-xs text-left ${isDragging ? 'select-none' : ''}`}>
          <thead><TodaySheetHeader colWidths={focusColWidths} activeColumns={activeColumns} onMouseDown={onMouseDown} onDoubleClick={handleDoubleClickResize} onSelectAll={handleSelectAll} onCycleSelectAll={handleCycleSelectAll} selectCycleMode={selectCycleMode} isAllSelected={filteredStudents.length > 0 && selectedIds.length === filteredStudents.length} onFocusColumn={setFocusColumn} focusColumn={focusColumn} onColumnReorder={handleColumnReorder} showAllTools={showAllTools} setShowAllTools={setShowAllTools} isToolsEditMode={isToolsEditMode} setIsToolsEditMode={setIsToolsEditMode} onAutofillManagementNotes={handleAutofillManagementNotes} /></thead>
          <tbody className="divide-y divide-white/10">
            {(() => {
              const dayKey = getDayOfWeek(selectedDate);
              const [_, configM] = (academyInfo?.operation_settings?.first_period_time || "00:00").split(':').map(Number);
              const displayMinute = configM.toString().padStart(2, '0');

              return filteredStudents.map((s: any, idx: number) => {
                const getStartTime = (st: any) => {
                  // 1. 시간 이동 필드(moved_to_hour) 우선 사용
                  if (st.todaySession?.moved_to_hour !== undefined && st.todaySession?.moved_to_hour !== null) {
                    const mVal = st.todaySession.moved_to_hour;
                    let h = mVal >= 100 ? Math.floor(mVal / 100) : mVal;
                    let m = mVal >= 100 ? (mVal % 100) : 0;
                    if (h < 10) h += 12;
                    return h * 100 + m;
                  }

                  // 2. 출결 상태 내 기입된 시각 파싱
                  const stat = st.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
                  if (stat.includes(':')) { 
                    const match = stat.match(/(\d{1,2}):/);
                    if (match) {
                      let val = parseInt(match[1], 10);
                      if (!isNaN(val) && val < 24) {
                        if (val < 8) val += 12;
                        return val * 100;
                      }
                    }
                  }

                  // 3. 현재 행의 스케줄 적용 (특강/정규 개별 적용)
                  let timeVal = 99900;
                  const hours = st.day_schedules?.[dayKey] || [];
                  if (hours.length > 0) {
                    const firstVal = hours[0];
                    let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
                    let m = firstVal >= 100 ? (firstVal % 100) : 0;
                    if (h < 10) h += 12;
                    timeVal = h * 100 + m;
                  }

                  return timeVal;
                };
                const currentStartTime = getStartTime(s);
                const prevStartTime = idx > 0 ? getStartTime(filteredStudents[idx - 1]) : null;
                const isNewSection = sortMode === 'time' && currentStartTime !== prevStartTime && !focusColumn;

                const currentHour = currentStartTime !== 99900 ? Math.floor(currentStartTime / 100) : 999;
                const currentMin = currentStartTime !== 99900 ? (currentStartTime % 100) : 0;
                const formattedMin = currentMin.toString().padStart(2, '0');

                const timeSectionLabel = isNewSection 
                  ? (currentHour === 999 
                      ? '기타 수업'
                      : (currentHour >= 12 
                          ? (currentHour === 12 ? `오후 12:${formattedMin}` : `오후 ${currentHour-12}:${formattedMin}`) 
                          : `오전 ${currentHour}:${formattedMin}`) + ' 수업'
                    )
                  : undefined;

                return (
                  <React.Fragment key={`${s.id}_row_${idx}`}>
                    <TodaySheetRow
                      key={`${s.id}-${selectedDate}`}
                      student={s}
                      cooperatingCells={cooperatingCells}
                      rowIndex={idx}
                      masterTextbooks={masterTextbooks}
                      onSave={handleSave}
                      onUpdateStudentInfo={onUpdateStudentInfo}
                      onRemoveFromToday={onRemoveFromToday}
                      onViewProgress={onViewProgress}
                      onSelectStudent={onSelectStudent}
                      colWidths={focusColWidths}
                      activeColumns={activeColumns}
                      selectedDate={selectedDate} 
                      isHistoryExpanded={!!expandedHistory[s.id]} 
                      onToggleHistory={toggleHistory} 
                      currentUser={currentUser} 
                      academyInfo={academyInfo}
                      activeCell={activeCell}
                      editingCell={editingCell}
                      onActiveCellChange={handleActiveCellChange}
                      onEditingCellChange={handleEditingCellChange}
                      isSelected={selectedIds.some((id: any) => String(id) === String(s.id))} 
                      onSelectOne={handleSelectOne} 
                      selectedRange={selectedRange} 
                      isCellInRange={isCellInRange} 
                      onCellMouseDown={onCellMouseDown} 
                      onCellMouseEnter={onCellMouseEnter} 
                      isFirstInTimeSection={isNewSection}
                      timeSectionLabel={timeSectionLabel}
                      isOtherClassSection={currentHour === 999}
                      historyLimit={historyLimit}
                      isScrolled={isScrolled}
                      showAllTools={showAllTools}
                      isToolsEditMode={isToolsEditMode}
                      toolsOrder={toolsOrder}
                      onReorderTools={handleReorderTools}
                    />
                  </React.Fragment>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Settings2 size={16} /> Column Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar-v space-y-1">
              {DEFAULT_COLUMNS.filter(c => c.canHide).map(col => (
                <div key={col.id} onClick={() => toggleColumn(col.id)} className={`flex items-center justify-between px-3 py-2.5 rounded-md transition-all cursor-pointer group ${visibleColumns.includes(col.id) ? 'bg-blue-600/20' : 'hover:bg-white/5'}`}><span className={`text-[12px] font-bold ${visibleColumns.includes(col.id) ? 'text-blue-400' : 'text-gray-500'}`}>{col.label}</span>{visibleColumns.includes(col.id) && <Check size={16} className="text-blue-500" />}</div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>{isReportVisible && <ReportPreview students={students} selectedDate={selectedDate} academyInfo={academyInfo} isSendingReport={isSendingReport} handleSendIndividual={handleSendIndividual} />}</AnimatePresence>
      {/* 💡 [리팩토링 Step 3] 하단 인쇄/출력 팝업 모달 서브 컴포넌트로 격리 */}
      <TodaySheetModals
        isPrintPreviewOpen={isPrintPreviewOpen}
        setIsPrintPreviewOpen={setIsPrintPreviewOpen}
        isCardPrintOpen={isCardPrintOpen}
        setIsCardPrintOpen={setIsCardPrintOpen}
        isHokmaPrintOpen={isHokmaPrintOpen}
        setIsHokmaPrintOpen={setIsHokmaPrintOpen}
        isTagModalOpen={isTagBatchMode}
        setIsTagModalOpen={setIsTagBatchMode}
        filteredStudents={filteredStudents}
        selectedDate={selectedDate}
        academyInfo={academyInfo}
        teachers={teachers}
        masterTextbooks={masterTextbooks}
        currentUser={currentUser}
        onBatchSave={handleBatchSave}
        activeColumns={activeColumns}
        columnWidths={colWidths}
      />
    </div>
  );
}
