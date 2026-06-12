'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Loader2, Settings2, Check, 
  Calendar as CalendarIcon, History as HistoryIcon, 
  LayoutGrid, Table as TableIcon, Share2, Percent, RotateCcw,
  Download, FileSpreadsheet, FileText as FileTextIcon, Copy,
  SortAsc, Clock as ClockIcon, X, Wand2, TrendingUp, ClipboardList, FileText, Zap,
  Maximize2, Minimize2, ArrowLeft, ArrowRight, AlertTriangle, ArrowUp, ArrowDown, Eye, EyeOff, Printer, ChevronDown, ChevronUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TodaySheetRow } from './TodaySheetRow';
import { HistoryRows } from './TodaySheetHistory';
import ReportPreview from './ReportPreview';
import { getDayOfWeek, getTodayStr } from '@/lib/utils';
import { ATTENDANCE_STATUS, normalizeAttendanceStatus } from '@/lib/sessionFieldMap';
import { useTodaySheetShortcuts } from './hooks/useTodaySheetShortcuts';

interface ColumnConfig {
  id: string;
  label: string;
  minWidth: number;
  isSticky?: boolean;
  canHide: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'select', label: '', minWidth: 40, isSticky: true, canHide: false },
  { id: 'date', label: '날짜', minWidth: 50, canHide: true },
  { id: 'name', label: '이름', minWidth: 120, isSticky: true, canHide: false },
  { id: 'attendance', label: '출결', minWidth: 80, canHide: true },
  { id: 'test_id', label: '오늘TEST', minWidth: 140, canHide: true },
  { id: 'test_score', label: '점수', minWidth: 60, canHide: true },
  { id: 'next_quiz', label: '다음TEST', minWidth: 200, canHide: true },
  { id: 'review', label: '과제확인', minWidth: 180, canHide: true },
  { id: 'classwork', label: '오늘 할 일(To-Do)', minWidth: 200, canHide: true },
  { id: 'completed_classwork', label: '수행진도', minWidth: 200, canHide: true },
  { id: 'assign', label: '오늘숙제', minWidth: 220, canHide: true },
  { id: 'mission', label: '학생미션', minWidth: 220, canHide: true },
  { id: 'notes', label: '특이사항', minWidth: 160, canHide: true },
  { id: 'action', label: '', minWidth: 8, isSticky: true, canHide: false }
];

// --- Sub-components ---

function TodaySheetHeader({ colWidths, activeColumns, onMouseDown, onBatchQuizCut, onSelectAll, isAllSelected, onFocusColumn, focusColumn }: any) {
  return (
    <tr className="bg-black border-b border-white/20 select-none">
      {activeColumns.map((col: any) => {
        const isStickyHorizontally = col.id === 'name' || col.id === 'action' || col.id === 'select';
        const canFocus = ['test_id', 'next_quiz', 'classwork', 'completed_classwork', 'assign', 'mission', 'notes'].includes(col.id);
        const isAction = col.id === 'action';
        const isSelect = col.id === 'select';
        
        const styles: React.CSSProperties = {
          width: colWidths[col.id] || col.minWidth,
          minWidth: colWidths[col.id] || col.minWidth,
          position: 'sticky',
          top: 0,
          left: col.id === 'select' ? 0 : (col.id === 'name' ? (colWidths['select'] || 40) - 1 : 'auto'),
          right: col.id === 'action' ? 0 : 'auto',
          zIndex: isStickyHorizontally ? 50 : 40,
          backgroundColor: '#000000',
        };
        return (
          <th 
            key={col.id} 
            style={styles} 
            className={`py-3 ${isAction ? 'px-0' : 'px-3'} text-[12px] font-black uppercase tracking-widest text-gray-400 text-center border-r border-white/12 shadow-[0_1px_0_rgba(255,255,255,0.1)]`}
          >
            {!isAction && (
              <div className="flex items-center justify-center group relative gap-1.5 w-full">
                {isSelect ? (
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-blue-600 cursor-pointer"
                  />
                ) : (
                <>
                  <div className={`flex items-center gap-1.5 ${col.id === 'review' ? 'italic' : ''}`}>
                    {col.id === 'review' ? (
                      <>
                        <span className="text-blue-500/80 font-black mr-0.5">"</span>
                        <span className="text-blue-200">{col.label}</span>
                        <span className="text-blue-500/80 font-black ml-0.5">"</span>
                      </>
                    ) : (
                      col.label
                    )}
                    {canFocus && !focusColumn && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onFocusColumn(col.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all text-blue-400"
                        title="넓게 보기"
                      >
                        <Maximize2 size={10} />
                      </button>
                    )}
                  </div>
                  {col.id === 'next_quiz' && onBatchQuizCut && (
                    <div className="relative group/batch" title="모든 학생 커트라인 일괄 설정">
                      <select 
                        onChange={(e) => onBatchQuizCut(parseInt(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        defaultValue=""
                      >
                        <option value="" disabled>전체 설정</option>
                        {[...Array(11)].map((_, i) => <option key={i} value={i} className="bg-[#121212]">{i}개</option>)}
                      </select>
                      <div className="flex items-center gap-1 bg-indigo-500/20 hover:bg-indigo-500 hover:text-white px-1.5 py-0.5 rounded-[2px] border border-indigo-500/30 transition-all cursor-pointer">
                        <span className="text-[7px] font-black tracking-tighter">SET ALL</span>
                        <Percent size={8} strokeWidth={4} />
                      </div>
                    </div>
                  )}
                </>
              )}

                {col.id !== 'action' && (
                  <div 
                    onMouseDown={(e) => onMouseDown(e, col.id)}
                    className="absolute right-[-12px] w-1.5 h-5 cursor-col-resize hover:bg-blue-500/50 rounded transition-colors opacity-0 group-hover:opacity-100" 
                  />
                )}
              </div>
            )}
          </th>
        );
      })}
    </tr>
  );
}

// --- Main Component ---

export default function TodaySheet({
  students, setStudents, masterTextbooks, onSave, onUpdateStudentInfo, selectedDate, onDateChange, onViewProgress, onSelectStudent, academyInfo, currentUser,
  sortMode = 'time', onSortModeChange,
  sortDirection = 'asc', onSortDirectionChange,
  onOpenBriefing, // 💡 추가
  selectedFilter, setSelectedFilter,
  selectedTeacherId, setSelectedTeacherId,
  selectedDays, setSelectedDays,
  isAndFilter, setIsAndFilter,
  teachers = [],
  isFullScreen = false,
  onToggleFullScreen
}: any) {

  // 1. States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hiddenStudentIds, setHiddenStudentIds] = useState<string[]>([]);
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
  const [expandedHistory, setExpandedHistory] = useState<Record<string, number>>({});
  const [isSendingReport, setIsSendingReport] = useState<string | null>(null);
  const [isReportVisible, setIsReportVisible] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{ studentId: string, columnId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ studentId: string, columnId: string } | null>(null);
  const [focusColumn, setFocusColumn] = useState<string | null>(null); // 💡 컬럼 포커스 모드 상태 추가

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
    return DEFAULT_COLUMNS.filter(col => !col.canHide || visibleColumns.includes(col.id));
  }, [visibleColumns]);

  // 💡 포커스 모드용 컬럼 너비 계산
  const focusColWidths = useMemo(() => {
    const base = { ...colWidths };
    base['action'] = 8; // 💡 저장 컬럼 너비를 8px로 강제 고정
    if (focusColumn) {
      // 포커스된 컬럼은 화면의 상당 부분을 차지하도록 확장
      base[focusColumn] = 800;
      if (focusColumn === 'test_id') base['test_score'] = 100;
      base['name'] = 140;
      base['attendance'] = 80;
    }
    return base;
  }, [colWidths, focusColumn]);

  const totalWidth = useMemo(() => {
    if (focusColumn) return '100%'; // 포커스 모드에서는 테이블 너비를 100%로 설정
    return activeColumns.reduce((acc, col) => acc + (colWidths[col.id] || col.minWidth), 0);
  }, [activeColumns, colWidths, focusColumn]);

  // 💡 포커스 모드일 때 학생 필터링 및 전체 정렬 로직 적용
  const filteredStudents = useMemo(() => {
    let result = [...students];
    
    // 숨김 처리된 학생 필터링
    if (hiddenStudentIds.length > 0) {
      result = result.filter((s: any) => !hiddenStudentIds.includes(s.id));
    }
    
    if (focusColumn === 'test_id') {
      result = result.filter((s: any) => s.todaySession?.test_id || s.todaySession?.test_status);
    }

    const getGradeWeight = (grade: string): number => {
      if (!grade) return 999;
      const cleaned = grade.replace(/\s+/g, '');
      let levelWeight = 0;
      let year = 0;
      if (cleaned.includes('초')) {
        levelWeight = 10;
        const match = cleaned.match(/\d/);
        year = match ? parseInt(match[0], 10) : 0;
      } else if (cleaned.includes('중')) {
        levelWeight = 20;
        const match = cleaned.match(/\d/);
        year = match ? parseInt(match[0], 10) : 0;
      } else if (cleaned.includes('고')) {
        levelWeight = 30;
        const match = cleaned.match(/\d/);
        year = match ? parseInt(match[0], 10) : 0;
      } else {
        levelWeight = 40;
      }
      return levelWeight + year;
    };

    const dayKey = getDayOfWeek(selectedDate);
    const getStartTime = (st: any) => {
      // 1. 시간 이동 필드 우선 사용
      if (st.todaySession?.moved_to_hour !== undefined && st.todaySession?.moved_to_hour !== null) {
        return st.todaySession.moved_to_hour;
      }
      
      const stat = st.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
      if (stat.includes(':')) { 
        const parts = stat.split(':'); 
        const val = parseInt(parts[parts.length - 1]); 
        if (!isNaN(val) && val < 24) return val; 
      }
      const hours = st.day_schedules?.[dayKey] || [];
      return hours.length > 0 ? Math.min(...hours.map((h: number) => h % 100)) : 999;
    };

    return result.sort((a, b) => {
      let comparison = 0;
      if (sortMode === 'grade') {
        const gradeA = getGradeWeight(a.grade);
        const gradeB = getGradeWeight(b.grade);
        if (gradeA !== gradeB) {
          comparison = gradeA - gradeB;
          return sortDirection === 'asc' ? comparison : -comparison;
        }
      } else if (sortMode === 'time') {
        const timeA = getStartTime(a);
        const timeB = getStartTime(b);
        if (timeA !== timeB) {
          comparison = timeA - timeB;
          return sortDirection === 'asc' ? comparison : -comparison;
        }
      }
      comparison = a.name.localeCompare(b.name, 'ko');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [students, focusColumn, sortMode, sortDirection, selectedDate, hiddenStudentIds]);

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
    return onSave(studentId, newData);
  }, [onSave]);

  const handleBatchSave = useCallback(async (updates: { studentId: string, newData: any, prevData: any }[]) => {
    if (updates.length === 0) return;
    
    // 💡 [낙관적 업데이트] DB 저장 전에 로컬 상태를 즉시 업데이트하여 UI 반응성 확보
    setStudents((prev: any[]) => prev.map(s => {
      const update = updates.find(u => u.studentId === s.id);
      if (update) {
        const hasMission = 'mission' in update.newData;
        return {
          ...s,
          ...(hasMission ? { recent_mission: update.newData.mission } : {}),
          todaySession: {
            ...(s.todaySession || {}),
            ...update.newData
          }
        };
      }
      return s;
    }));
    
    // 💡 [수정] mission 필드와 일반 세션 로그 필드를 분기 처리하여 알맞은 API로 전송
    await Promise.all(updates.map(async (u) => {
      if ('mission' in u.newData && onUpdateStudentInfo) {
        await onUpdateStudentInfo(u.studentId, 'recent_mission', u.newData.mission);
      }
      
      const savePayload = { ...u.newData };
      delete savePayload.mission;
      
      if (Object.keys(savePayload).length > 0) {
        await onSave(u.studentId, savePayload);
      }
    }));
  }, [onSave, onUpdateStudentInfo, setStudents]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
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
        if (colId === 'mission') return 'mission';
        if (colId === 'notes') return 'special_notes';
        if (colId === 'next_quiz') return 'next_quiz_text';
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
            const invMap: any = { 'test_status': 'test_id', 'test_score': 'test_score', 'classwork_text': 'classwork', 'completed_classwork_text': 'completed_classwork', 'homework_text': 'assign', 'next_quiz_text': 'next_quiz', 'mission': 'mission', 'special_notes': 'notes' };
            Object.keys(u.newData).forEach(field => {
              // 💡 [최적화] 이전 데이터와 비교하여 실제 값이 바뀐 경우에만 DOM 조작
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

  const handleExport = (type: 'csv' | 'excel' | 'copy' | 'aca2000') => {
    let headers: string[] = []; let dataRows: any[][] = [];
    const dateClean = selectedDate.replace(/-/g, '');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[new Date(selectedDate).getDay()];
    const teacherName = currentUser?.name || '관리자';
    const customFileName = `업무일지_${dateClean}_${dayOfWeek}_${teacherName}`;

    if (type === 'aca2000') {
      headers = ['일자', '강사', '반명', '과목', '교재', '진도', '테스트', '과제', '기타'];
      dataRows = students.map((s: any) => {
        const session = s.todaySession || {}; 
        const teacher = teachers?.find((t: any) => t.id === s.teacher_id);
        const tName = teacher?.nickname || teacher?.name || '';
        const sortedDays = (s.class_days || []).slice().sort((a: string, b: string) => {
          const order: any = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
          return (order[a] || 0) - (order[b] || 0);
        }).join('');
        const teacherInitial = teacher?.initials || s.teacher_initial || '';
        const combinedName = `${s.name}-${teacherInitial}-${sortedDays}`;
        const books = (s.assigned_books || []).map((code: string) => masterTextbooks.find((m: any) => m.bookcode === code)?.title || code).filter((title: any) => !!title).join(', ');
        const testDisplay = (() => {
          if (!session.test_id) return '';
          
          // 💡 하위 호환: 이미 test_id에 괄호 점수 정보가 직접 포함된 구형 데이터인 경우 추가 결합 생략
          if (session.test_id.includes('(')) return session.test_id;
          
          if (session.test_score === undefined || session.test_score === null || session.test_score === '') return session.test_id;
          
          const scoreType = session.test_score_type || 'score';
          if (scoreType === 'score') {
            return `${session.test_id} (${session.test_score}점)`;
          } else {
            return session.test_total_count 
              ? `${session.test_id} (${session.test_score}개 / ${session.test_total_count}개)`
              : `${session.test_id} (${session.test_score}개)`;
          }
        })();
        return [selectedDate, tName, combinedName, '개별수업', books, session.completed_classwork_text || '', testDisplay, session.homework_text || '', session.special_notes || ''];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 40 }, { wch: 30 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "ACA2000_Upload"); XLSX.writeFile(wb, `${customFileName}.xls`, { bookType: 'biff8' });
    } else {
      const cols = activeColumns.filter(c => !['select', 'action'].includes(c.id));
      headers = cols.map(c => c.label);
      dataRows = students.map((s: any) => {
        const sess = s.todaySession || {};
        return cols.map(col => {
          if (col.id === 'date') return selectedDate; if (col.id === 'name') return s.name;
          if (col.id === 'attendance') {
            const status = normalizeAttendanceStatus(sess.attendance_status);
            const moved = sess.moved_to_hour;
            return moved ? `${status}(${moved}시)` : status;
          }
          if (col.id === 'test_id') return sess.test_id || '';
          if (col.id === 'test_score') return sess.test_score ? `${sess.test_score}${sess.test_score_type === 'count' ? '개' : '점'}` : '';
          if (col.id === 'next_quiz') return sess.next_quiz_text || '';
          if (col.id === 'review') return s.lastSession?.homework_text || '';
          if (col.id === 'classwork') return sess.classwork_text || '';
          if (col.id === 'assign') return sess.homework_text || '';
          if (col.id === 'mission') return s.recent_mission || '';
          if (col.id === 'notes') return sess.special_notes || '';
          return '';
        });
      });
      if (type === 'copy') { const text = [headers.join('\t'), ...dataRows.map(row => row.join('\t'))].join('\n'); navigator.clipboard.writeText(text); alert('표 전체가 클립보드에 복사되었습니다.'); } 
      else if (type === 'csv') { const content = '\uFEFF' + [headers.join(','), ...dataRows.map(row => row.map(v => `"${v}"`).join(','))].join('\n'); const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${customFileName}.csv`; link.click(); } 
      else if (type === 'excel') { const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]); ws['!cols'] = headers.map(() => ({ wch: 20 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "DailySheet"); XLSX.writeFile(wb, `${customFileName}.xlsx`); }
    }
    setIsExportOpen(false);
  };

  const handleSelectAll = useCallback((checked: boolean) => { setSelectedIds(checked ? students.map((s: any) => s.id) : []); }, [students]);
  const handleSelectOne = useCallback((id: string, checked: boolean) => { setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id)); }, []);

  const onCellMouseDown = useCallback((e: React.MouseEvent, studentId: string, colId: string) => {
    if (['select', 'action'].includes(colId)) return;
    const isShift = e.shiftKey;
    // 💡 브라우저가 blur 이벤트를 먼저 안전하게 처리하여 저장(onBlur)되도록 상태 변경을 한 프레임 지연
    requestAnimationFrame(() => {
      setSelectedRange({ startStudentId: studentId, startColId: colId, endStudentId: studentId, endColId: colId });
      setIsDragging(true);
      if (!isShift) { setActiveCell({ studentId, columnId: colId }); }
      setEditingCell(null);
    });
  }, []);

  const onCellMouseEnter = useCallback((studentId: string, colId: string) => {
    if (!isDragging || !selectedRange) return;
    setSelectedRange(prev => prev ? { ...prev, endStudentId: studentId, endColId: colId } : null);
  }, [isDragging, selectedRange]);

  const handleActiveCellChange = useCallback((studentId: string, colId: string) => { 
    setActiveCell({ studentId, columnId: colId }); 
    setEditingCell(null);
  }, []);
  const handleEditingCellChange = useCallback((studentId: string, colId: string | null) => { setEditingCell(colId ? { studentId, columnId: colId } : null); }, []);
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
    toggleSecondRow
  });

  const resizingCol = useRef<{ id: string; startX: number; startWidth: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent, colId: string) => { resizingCol.current = { id: colId, startX: e.pageX, startWidth: colWidths[colId] || 100 }; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); document.body.style.cursor = 'col-resize'; };
  const onMouseMove = (e: MouseEvent) => { if (!resizingCol.current) return; const { id, startX, startWidth } = resizingCol.current; const newWidth = Math.max(40, startWidth + (e.pageX - startX)); setColWidths(prev => ({ ...prev, [id]: newWidth })); };
  const onMouseUp = () => { if (resizingCol.current) { setColWidths(latest => { localStorage.setItem('todaySheetColWidths', JSON.stringify(latest)); return latest; }); } resizingCol.current = null; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); document.body.style.cursor = 'default'; };

  const handleSendAll = async () => { if (!confirm(`${students.length}명 일괄 발송하시겠습니까?`)) return; setIsSendingReport('all'); let count = 0; for (const s of students) { try { const res = await fetch('/api/report', { method: 'POST', body: JSON.stringify({ studentId: s.id, sessionDate: selectedDate, academyId: academyInfo.id }) }); if (res.ok) count++; } catch(e){} } alert(`${count}명 완료`); setIsSendingReport(null); };
  const handleSendIndividual = async (id: string) => { const s = students.find((st:any) => st.id === id); if (!s) return; setIsSendingReport(id); try { const res = await fetch('/api/report', { method: 'POST', body: JSON.stringify({ studentId: id, sessionDate: selectedDate, academyId: academyInfo.id }) }); if (res.ok) alert(`${s.name} 발송 완료`); } catch(e){} finally { setIsSendingReport(null); } };
  const handleBatchQuizCut = async (cut: number) => {
    const actives = students.filter((s:any) => !s.is_deleted);
    if (actives.length === 0) return;
    if (!confirm(`${actives.length}명 커트라인을 ${cut}개로 변경하시겠습니까?`)) return;
    setIsSendingReport('batch-cut');
    try {
      // 💡 [수정] 전체 세션 데이터를 보내지 않고 변경된 필드만 명시적으로 전송
      await Promise.all(actives.map((s:any) => handleSave(s.id, { next_quiz_cut: cut })));
      alert('변경 완료');
    } catch(e){} finally {
      setIsSendingReport(null);
    }
  };
  const gradeStats = useMemo(() => { const stats: Record<string, number> = {}; ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'].forEach(g => stats[g] = 0); students.forEach((s:any) => { if (stats[s.grade] !== undefined) stats[s.grade]++; }); return stats; }, [students]);

  return (
    <div className="p-3 space-y-4 relative flex flex-col h-full overflow-hidden bg-[#050505] text-center">
      <div className="flex items-center justify-between px-3 py-2 bg-black/50 border border-white/10 rounded-lg shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5 items-start">
            <div className="flex items-center gap-3">
              <h3 className="text-[13px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2.5"><TableIcon size={16} /> Daily Sheet</h3>
              {/* 💡 수동 브리핑 버튼 (더 크고 직관적인 노란 삼각형) */}
              <button 
                onClick={onOpenBriefing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500 text-black hover:bg-amber-400 transition-all animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.4)] border-2 border-amber-300/50 group"
                title="오늘의 중요 브리핑 열기"
              >
                <AlertTriangle size={14} className="fill-current" />
                <span className="text-[10px] font-black uppercase tracking-widest">Morning Briefing</span>
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

          <div onClick={(e) => { const input = e.currentTarget.querySelector('input'); if (input && 'showPicker' in input) try { (input as any).showPicker(); } catch (err) { console.error(err); } }}
            className="flex items-center gap-2 bg-black border border-white/20 rounded-[6px] px-4 py-2 text-gray-400 hover:text-white transition-all group cursor-pointer shadow-xl">
            <CalendarIcon size={16} className="group-hover:text-blue-500" />
            <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="bg-transparent text-[12px] font-black uppercase outline-none cursor-pointer [color-scheme:dark]" />
          </div>

          <button onClick={() => setIsReportVisible(!isReportVisible)} className={`flex items-center gap-2 px-5 py-2 rounded-[6px] text-[11px] font-black uppercase tracking-widest transition-all border shadow-xl ${isReportVisible ? 'bg-blue-600 border-blue-500 text-white shadow-blue-900/30' : 'bg-black border-white/20 text-gray-400 hover:text-white'}`}><LayoutGrid size={16} /> {isReportVisible ? '리포트 닫기' : '리포트 미리보기'}</button>
          
          {/* 💡 [변경] 전체 리포트 발송 버튼 (1행 안전 구역으로 이동) */}
          <button onClick={handleSendAll} disabled={!!isSendingReport} className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-[6px] text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 shadow-xl no-print">
            {isSendingReport === 'all' ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />} 전체 리포트 발송
          </button>
          
          <div className="relative">
            <button onClick={() => setIsExportOpen(!isExportOpen)} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-[6px] text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all shadow-xl"><Download size={14} /> Download</button>
            <AnimatePresence>
              {isExportOpen && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-56 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 rounded-lg shadow-2xl p-2 z-[100] overflow-hidden">
                  <div className="space-y-1">
                    <button onClick={() => handleExport('aca2000')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-indigo-400 transition-all text-left group border border-indigo-500/10 hover:border-indigo-500/30 mb-1 bg-indigo-500/5"><div className="w-8 h-8 rounded bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all"><Zap size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">ACA2000 전용</span><span className="text-[9px] text-gray-600">업로드용 맞춤 엑셀</span></div></button>
                    <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-emerald-400 transition-all text-left group"><div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all"><FileSpreadsheet size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">Excel File</span><span className="text-[9px] text-gray-600">Microsoft Excel (.xlsx)</span></div></button>
                    <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-amber-400 transition-all text-left group"><div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all"><FileTextIcon size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">CSV File</span><span className="text-[9px] text-gray-600">쉼표로 구분된 텍스트 파일</span></div></button>
                    <button onClick={() => handleExport('copy')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-all text-left group"><div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all"><Copy size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">Copy to Clipboard</span><span className="text-[9px] text-gray-600">다른 엑셀 시트에 바로 붙여넣기</span></div></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2행 접기/펼치기 토글 버튼 */}
          <button 
            onClick={toggleSecondRow} 
            className={`p-2 border rounded-[6px] transition-all shadow-xl ${showSecondRow ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
            title={showSecondRow ? "상세 설정 도구 접기" : "상세 설정 도구 펼치기"}
          >
            {showSecondRow ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-white/5 border border-white/10 rounded-[6px] text-gray-400 hover:text-white transition-all shadow-xl"><Settings2 size={18} /></button>
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
              <div className="flex bg-white/5 p-0.5 rounded-md border border-white/10">
                {['1', '2', '3', '4'].map((setId, idx) => {
                  const keys = ['Q', 'W', 'E', 'R'];
                  return (
                    <button 
                      key={setId} 
                      onClick={() => handleSetSwitch(setId)} 
                      className={`px-3 py-1.5 rounded-[4px] text-[10px] font-black transition-all ${activeSet === setId ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-gray-300'}`} 
                      title={`Alt + ${keys[idx]}`}
                    >
                      SET {setId}
                    </button>
                  );
                })}
              </div>

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
                  <div className="flex bg-white/5 rounded-[4px] p-0.5 border border-white/5">
                    {[
                      { label: 'ALL', key: 'All' }, { label: '초', key: '초' }, { label: '중', key: '중' }, { label: '고', key: '고' }
                    ].map((g) => (
                      <button 
                        key={g.key} 
                        onClick={() => setSelectedFilter(g.key)} 
                        className={`px-2.5 py-1 rounded-[3px] text-[9px] font-black uppercase transition-all ${selectedFilter === g.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
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
                            className={`w-6 h-6 rounded-[3px] text-[8px] font-black transition-all border ${isActive ? 'bg-blue-600 border-blue-500 text-white shadow-md' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    {selectedDays.length > 0 && (
                      <button 
                        onClick={() => setIsAndFilter(!isAndFilter)} 
                        className={`px-1.5 py-0.5 rounded-[3px] text-[8px] font-black uppercase border transition-all ${isAndFilter ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white'}`}
                      >
                        {isAndFilter ? 'AND' : 'OR'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 2행 오른쪽: 정렬, 선택 숨김 제어, 화면 컨트롤 */}
            <div className="flex flex-wrap items-center gap-4 ml-auto justify-end">
              {/* 정렬 방식 및 방향 필터 */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Sort</span>
                <div className="flex bg-white/5 rounded-[4px] p-0.5 border border-white/5">
                  {[
                    { label: '시간순', key: 'time' }, { label: '이름순', key: 'name' }, { label: '학년순', key: 'grade' }
                  ].map((m) => (
                    <button 
                      key={m.key} 
                      onClick={() => onSortModeChange(m.key as any)} 
                      className={`px-2.5 py-1 rounded-[3px] text-[9px] font-black uppercase transition-all ${sortMode === m.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1 rounded-[4px] bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 text-[8px] font-black"
                  title={sortDirection === 'asc' ? '오름차순 (Up)' : '내림차순 (Down)'}
                >
                  {sortDirection === 'asc' ? <ArrowUp size={10} className="text-blue-400" /> : <ArrowDown size={10} className="text-purple-400" />}
                  {sortDirection === 'asc' ? 'UP' : 'DOWN'}
                </button>
              </div>

              {(selectedIds.length > 0 || hiddenStudentIds.length > 0) && (
                <div className="flex items-center gap-1.5">
                  {selectedIds.length > 0 && (
                    <button
                      onClick={() => {
                        setHiddenStudentIds(prev => [...prev, ...selectedIds]);
                        setSelectedIds([]);
                      }}
                      className="px-2 py-1 rounded-[4px] bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white transition-all flex items-center gap-1 text-[8px] font-black animate-pulse"
                      title="선택한 학생들을 임시로 숨깁니다"
                    >
                      <EyeOff size={10} />
                      숨김 ({selectedIds.length})
                    </button>
                  )}
                  {hiddenStudentIds.length > 0 && (
                    <button
                      onClick={() => setHiddenStudentIds([])}
                      className="px-2 py-1 rounded-[4px] bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1 text-[8px] font-black"
                      title="숨겨진 학생들을 모두 다시 표시합니다"
                    >
                      <Eye size={10} />
                      해제 ({hiddenStudentIds.length})
                    </button>
                  )}
                </div>
              )}

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
                  onClick={() => window.print()} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 border border-indigo-500 text-white rounded-[4px] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg"
                >
                  <Printer size={12} /> 인쇄하기
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`bg-black border border-white/20 rounded-lg shadow-2xl custom-scrollbar-h overflow-x-auto overflow-y-auto transition-all duration-500 ${isReportVisible ? 'max-h-[35vh] shrink-0' : 'flex-1 min-h-0'} today-sheet-container`}>
        <table style={{ width: totalWidth, minWidth: '100%' }} className={`border-collapse table-fixed text-xs text-left ${isDragging ? 'select-none' : ''}`}>
          <thead><TodaySheetHeader colWidths={focusColWidths} activeColumns={activeColumns} onMouseDown={onMouseDown} onBatchQuizCut={handleBatchQuizCut} onSelectAll={handleSelectAll} isAllSelected={students.length > 0 && selectedIds.length === students.length} onFocusColumn={setFocusColumn} focusColumn={focusColumn} /></thead>
          <tbody className="divide-y divide-white/10">
            {(() => {
              const dayKey = getDayOfWeek(selectedDate);
              const [_, configM] = (academyInfo?.operation_settings?.first_period_time || "00:00").split(':').map(Number);
              const displayMinute = configM.toString().padStart(2, '0');

              return filteredStudents.map((s: any, idx: number) => {
                const getStartTime = (st: any) => {
                  if (st.todaySession?.moved_to_hour !== undefined && st.todaySession?.moved_to_hour !== null) {
                    return st.todaySession.moved_to_hour;
                  }
                  const stat = st.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
                  if (stat.includes(':')) { const parts = stat.split(':'); const val = parseInt(parts[parts.length - 1]); if (!isNaN(val) && val < 24) return val; }
                  const hours = st.day_schedules?.[dayKey] || [];
                  return hours.length > 0 ? Math.min(...hours.map((h: number) => h % 100)) : 999;
                };
                const currentStartTime = getStartTime(s);
                const prevStartTime = idx > 0 ? getStartTime(filteredStudents[idx - 1]) : null;
                const isNewSection = sortMode === 'time' && currentStartTime !== prevStartTime && !focusColumn;

                const timeSectionLabel = isNewSection 
                  ? (currentStartTime === 999 
                      ? '기타 타임' 
                      : (currentStartTime >= 12 
                          ? (currentStartTime === 12 ? `오후 12:${displayMinute}` : `오후 ${currentStartTime-12}:${displayMinute}`) 
                          : `오전 ${currentStartTime}:${displayMinute}`) + ' 수업'
                    )
                  : undefined;

                return (
                  <React.Fragment key={s.id}>
                    <TodaySheetRow
                      key={`${s.id}-${selectedDate}`}
                      student={s}
                      rowIndex={idx}
                      masterTextbooks={masterTextbooks}
                      onSave={handleSave}
                      onUpdateStudentInfo={onUpdateStudentInfo}
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
                      isSelected={selectedIds.includes(s.id)} 
                      onSelectOne={handleSelectOne} 
                      selectedRange={selectedRange} 
                      isCellInRange={isCellInRange} 
                      onCellMouseDown={onCellMouseDown} 
                      onCellMouseEnter={onCellMouseEnter} 
                      isFirstInTimeSection={isNewSection}
                      timeSectionLabel={timeSectionLabel}
                    />
                  </React.Fragment>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
