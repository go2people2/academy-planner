'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Loader2, Settings2, Check, 
  Calendar as CalendarIcon, History as HistoryIcon, 
  LayoutGrid, Table as TableIcon, Share2, Percent, RotateCcw,
  Download, FileSpreadsheet, FileText as FileTextIcon, Copy,
  SortAsc, Clock as ClockIcon, X, Wand2, TrendingUp, ClipboardList, FileText, Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TodaySheetRow } from './TodaySheetRow';
import { HistoryRows } from './TodaySheetHistory';
import ReportPreview from './ReportPreview';
import { getDayOfWeek, getTodayStr } from '@/lib/utils';

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
  { id: 'attendance', label: '출결', minWidth: 80, canHide: false },
  { id: 'test_id', label: '오늘TEST', minWidth: 140, canHide: true },
  { id: 'test_score', label: '점수', minWidth: 60, canHide: true },
  { id: 'next_quiz', label: '다음TEST', minWidth: 200, canHide: true },
  { id: 'review', label: '과제확인', minWidth: 180, canHide: true },
  { id: 'classwork', label: '오늘진도', minWidth: 220, canHide: false },
  { id: 'assign', label: '오늘숙제', minWidth: 220, canHide: false },
  { id: 'mission', label: '학생미션', minWidth: 220, canHide: false },
  { id: 'notes', label: '특이사항', minWidth: 160, canHide: true },
  { id: 'action', label: '저장', minWidth: 60, isSticky: true, canHide: false }
];

// --- Sub-components ---

function TodaySheetHeader({ colWidths, activeColumns, onMouseDown, onBatchQuizCut, onSelectAll, isAllSelected }: any) {
  return (
    <tr className="bg-black border-b border-white/20 select-none">
      {activeColumns.map((col: any) => {
        const isStickyHorizontally = col.id === 'name' || col.id === 'action' || col.id === 'select';
        const styles: React.CSSProperties = {
          width: colWidths[col.id] || col.minWidth,
          minWidth: colWidths[col.id] || col.minWidth,
          position: 'sticky',
          top: 0,
          left: col.id === 'select' ? 0 : (col.id === 'name' ? (colWidths['select'] || 40) : 'auto'),
          right: col.id === 'action' ? 0 : 'auto',
          zIndex: isStickyHorizontally ? 50 : 40,
          backgroundColor: '#000000',
        };
        return (
          <th key={col.id} style={styles} className="py-3 px-3 text-[11px] font-black uppercase tracking-widest text-gray-400 text-left border-r border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.1)]">
            <div className={`flex items-center group relative gap-1.5 ${col.id === 'select' || col.id === 'action' ? 'justify-center' : 'justify-start'}`}>
              {col.id === 'select' ? (
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-blue-600 cursor-pointer"
                />
              ) : (
                <>
                  {col.label}
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

              <div 
                onMouseDown={(e) => onMouseDown(e, col.id)}
                className="absolute right-[-12px] w-1.5 h-5 cursor-col-resize hover:bg-blue-500/50 rounded transition-colors opacity-0 group-hover:opacity-100" 
              />
            </div>
          </th>
        );
      })}
    </tr>
  );
}

// --- Main Component ---

export default function TodaySheet({ 
  students, masterTextbooks, onSave, onUpdateStudentInfo, selectedDate, onDateChange, onViewProgress, academyInfo, currentUser,
  sortMode = 'time', onSortModeChange
}: any) {
  // 1. States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
    const defaultCols = DEFAULT_COLUMNS.map(c => c.id);
    return {
      '1': ['select', 'name', 'review', 'classwork', 'assign', 'mission', 'action'],
      '2': ['select', 'name', 'test_id', 'test_score', 'notes', 'action'],
      '3': ['select', 'name', 'next_quiz', 'action'],
      '4': defaultCols
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
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [activeCell, setActiveCell] = useState<{ studentId: string, columnId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ studentId: string, columnId: string } | null>(null);

  // 2. Memos
  const visibleColumns = useMemo(() => {
    return presets[activeSet] || DEFAULT_COLUMNS.map(c => c.id);
  }, [presets, activeSet]);

  const activeColumns = useMemo(() => {
    return DEFAULT_COLUMNS.filter(col => !col.canHide || visibleColumns.includes(col.id));
  }, [visibleColumns]);

  const totalWidth = useMemo(() => activeColumns.reduce((acc, col) => acc + (colWidths[col.id] || col.minWidth), 0), [activeColumns, colWidths]);

  // 3. Callbacks
  const isCellInRange = useCallback((studentId: string, colId: string) => {
    if (!selectedRange) return false;
    const sIdx = students.findIndex((s:any) => s.id === selectedRange.startStudentId);
    const eIdx = students.findIndex((s:any) => s.id === selectedRange.endStudentId);
    const cIdx = students.findIndex((s:any) => s.id === studentId);
    const sColIdx = activeColumns.findIndex(col => col.id === selectedRange.startColId);
    const eColIdx = activeColumns.findIndex(col => col.id === selectedRange.endColId);
    const currentColIdx = activeColumns.findIndex(col => col.id === colId);
    if (sIdx === -1 || eIdx === -1 || sColIdx === -1 || eColIdx === -1) return false;
    const rMin = Math.min(sIdx, eIdx); const rMax = Math.max(sIdx, eIdx);
    const cMin = Math.min(sColIdx, eColIdx); const cMax = Math.max(sColIdx, eColIdx);
    return cIdx >= rMin && cIdx <= rMax && currentColIdx >= cMin && currentColIdx <= cMax;
  }, [selectedRange, students, activeColumns]);

  const handleSaveWithUndo = useCallback(async (studentId: string, newData: any) => {
    const student = students.find((s: any) => s.id === studentId);
    if (student) {
      const prevData = { ...(student.todaySession || {}) };
      setUndoStack(prev => [{ type: 'single', studentId, studentName: student.name, prevData, timestamp: Date.now() }, ...prev].slice(0, 20));
    }
    return onSave(studentId, newData);
  }, [students, onSave]);

  const handleBatchSaveWithUndo = useCallback(async (updates: { studentId: string, newData: any, prevData: any }[]) => {
    if (updates.length === 0) return;
    setUndoStack(prev => [{ type: 'batch', updates: updates.map(u => ({ studentId: u.studentId, prevData: u.prevData })), timestamp: Date.now() }, ...prev].slice(0, 20));
    await Promise.all(updates.map(u => onSave(u.studentId, u.newData)));
  }, [onSave]);

  const performUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const lastAction = undoStack[0];
    if (lastAction.type === 'batch') { await Promise.all(lastAction.updates.map((u: any) => onSave(u.studentId, u.prevData))); }
    else { await onSave(lastAction.studentId, lastAction.prevData); }
    setUndoStack(prev => prev.slice(1));
  }, [undoStack, onSave]);

  const handleCopy = useCallback((e: ClipboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    let hasSelection = false;
    if (isInput) {
      const input = target as HTMLInputElement | HTMLTextAreaElement;
      hasSelection = input.selectionStart !== input.selectionEnd;
    } else {
      const selection = window.getSelection();
      hasSelection = !!(selection && selection.toString().length > 0);
    }
    if (hasSelection || !selectedRange) return;
    e.preventDefault();
    const sIdx = students.findIndex((s:any) => s.id === selectedRange.startStudentId);
    const eIdx = students.findIndex((s:any) => s.id === selectedRange.endStudentId);
    const sColIdx = activeColumns.findIndex(c => c.id === selectedRange.startColId);
    const eColIdx = activeColumns.findIndex(c => c.id === selectedRange.endColId);
    if (sIdx === -1 || eIdx === -1 || sColIdx === -1 || eColIdx === -1) return;
    const rStart = Math.min(sIdx, eIdx); const rEnd = Math.max(sIdx, eIdx);
    const cStart = Math.min(sColIdx, eColIdx); const cEnd = Math.max(sColIdx, eColIdx);
    const rows: string[] = [];
    for (let r = rStart; r <= rEnd; r++) {
      const st = students[r]; const session = st.todaySession || {}; const rowData: string[] = [];
      for (let c = cStart; c <= cEnd; c++) {
        const col = activeColumns[c]; let val = '';
        if (col.id === 'name') val = st.name;
        else if (col.id === 'date') val = selectedDate;
        else if (col.id === 'attendance') val = session.attendance_status || '출석';
        else if (col.id === 'test_id') val = session.test_id || '';
        else if (col.id === 'test_score') val = session.test_score || '';
        else if (col.id === 'classwork') val = session.classwork_text || '';
        else if (col.id === 'assign') val = session.homework_text || '';
        else if (col.id === 'mission') val = st.recent_mission || '';
        else if (col.id === 'notes') val = session.special_notes || '';
        else if (col.id === 'next_quiz') val = session.next_quiz_text || '';
        else if (col.id === 'review') val = st.lastSession?.homework_text || '';
        const sVal = String(val || '');
        if (sVal.includes('\n') || sVal.includes('\t') || sVal.includes('"')) { rowData.push(`"${sVal.replace(/"/g, '""')}"`); } 
        else { rowData.push(sVal); }
      }
      rows.push(rowData.join('\t'));
    }
    const finalData = rows.join('\n');
    if (e.clipboardData) { e.clipboardData.setData('text/plain', finalData); } 
    else { navigator.clipboard.writeText(finalData); }
  }, [selectedRange, students, activeColumns, selectedDate]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!activeCell) return;
    const target = e.target as HTMLElement;
    const isInputTarget = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
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

      // 💡 편집 중(입력창 활성 상태)일 때는 브라우저의 기본 붙여넣기 동작을 허용하여 
      // 한 셀 내에 모든 내용이 들어가도록 합니다. (쪼개짐 방지)
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
      if (updates.length > 0) { await handleBatchSaveWithUndo(updates); setEditingCell(null); }
    } catch (err) { console.error('Paste error:', err); }
  }, [activeCell, editingCell, activeColumns, selectedIds, students, handleBatchSaveWithUndo]);

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
        const session = s.todaySession || {}; const teacher = academyInfo?.teachers?.find((t: any) => t.id === s.teacher_id);
        const tName = teacher?.name || ''; const classParts = (s.class || '').split('-');
        const initial = classParts.length > 1 ? classParts[classParts.length - 1].trim() : s.course;
        const sortedDays = (s.class_days || []).slice().sort((a: string, b: string) => {
          const order: any = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
          return (order[a] || 0) - (order[b] || 0);
        }).join('');
        const combinedName = `${s.name}-${initial}-${sortedDays}`;
        const books = (s.assigned_books || []).map((code: string) => masterTextbooks.find(m => m.bookcode === code)?.title || code).filter(title => !!title).join(', ');
        return [selectedDate, tName, combinedName, '개별수업', books, session.classwork_text || '', session.test_id || '', session.homework_text || '', session.special_notes || ''];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 40 }, { wch: 30 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "ACA2000_Upload"); XLSX.writeFile(wb, `${customFileName}.xlsx`);
    } else {
      const cols = activeColumns.filter(c => !['select', 'action'].includes(c.id));
      headers = cols.map(c => c.label);
      dataRows = students.map((s: any) => {
        const sess = s.todaySession || {};
        return cols.map(col => {
          if (col.id === 'date') return selectedDate; if (col.id === 'name') return s.name;
          if (col.id === 'attendance') return sess.attendance_status || '출석';
          if (col.id === 'test_id') return sess.test_id || '';
          if (col.id === 'test_score') return sess.test_score ? `${sess.test_score}${sess.test_score_type === 'count' ? '개' : '%'}` : '';
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
    setSelectedRange({ startStudentId: studentId, startColId: colId, endStudentId: studentId, endColId: colId });
    setIsDragging(true);
    if (!e.shiftKey) { setActiveCell({ studentId, columnId: colId }); }
  }, []);

  const onCellMouseEnter = useCallback((studentId: string, colId: string) => {
    if (!isDragging || !selectedRange) return;
    setSelectedRange(prev => prev ? { ...prev, endStudentId: studentId, endColId: colId } : null);
  }, [isDragging, selectedRange]);

  const handleActiveCellChange = useCallback((studentId: string, colId: string) => { setActiveCell({ studentId, columnId: colId }); }, []);
  const handleEditingCellChange = useCallback((studentId: string, colId: string | null) => { setEditingCell(colId ? { studentId, columnId: colId } : null); }, []);
  const toggleHistory = useCallback((studentId: string) => { setExpandedHistory(prev => ({ ...prev, [studentId]: prev[studentId] ? 0 : 3 })); }, []);

  // 4. Global Events
  useEffect(() => {
    const handleMouseUpGlobal = () => setIsDragging(false);
    const handleClickOutside = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('table')) { setSelectedRange(null); } };
    
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');

      // CMD+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        let hasSel = false;
        if (inInput) { const input = target as HTMLInputElement | HTMLTextAreaElement; hasSel = input.selectionStart !== input.selectionEnd; }
        if (!hasSel) { e.preventDefault(); performUndo(); return; }
      }

      if (!activeCell) return;
      const rIdx = students.findIndex(s => s.id === activeCell.studentId);
      const cIdx = activeColumns.findIndex(c => c.id === activeCell.columnId);
      if (rIdx === -1 || cIdx === -1) return;

      let nR = rIdx; let nC = cIdx;
      if (!isInput) {
        if (e.key === 'ArrowDown') nR++; else if (e.key === 'ArrowUp') nR--;
        else if (e.key === 'ArrowRight') nC++; else if (e.key === 'ArrowLeft') nC--;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
        if (!isInput) return; e.preventDefault(); nR++; setSelectedRange(null);
      } else if (e.key === 'Tab') {
        e.preventDefault(); setSelectedRange(null); if (e.shiftKey) nC--; else nC++;
      }

      if (nR !== rIdx || nC !== cIdx) {
        nR = Math.max(0, Math.min(students.length - 1, nR)); nC = Math.max(0, Math.min(activeColumns.length - 1, nC));
        const nS = students[nR]; const nCol = activeColumns[nC];
        if (nS && nCol) {
          setActiveCell({ studentId: nS.id, columnId: nCol.id });
          if (e.key === 'Enter' || e.key === 'Tab') { setTimeout(() => setEditingCell({ studentId: nS.id, columnId: nCol.id }), 50); } 
          else if (e.key.startsWith('Arrow')) { setEditingCell(null); }
        }
      } else if (e.key === 'Enter' || e.key === 'Tab') { setEditingCell(null); }

      if (!isInput && (e.key === 'Backspace' || e.key === 'Delete')) {
        if (selectedRange) {
          e.preventDefault();
          const sI = students.findIndex((s:any) => s.id === selectedRange.startStudentId);
          const eI = students.findIndex((s:any) => s.id === selectedRange.endStudentId);
          const sC = activeColumns.findIndex(c => c.id === selectedRange.startColId);
          const eC = activeColumns.findIndex(c => c.id === selectedRange.endColId);
          if (sI !== -1 && eI !== -1 && sC !== -1 && eC !== -1) {
            const rMin = Math.min(sI, eI); const rMax = Math.max(sI, eI);
            const cMin = Math.min(sC, eC); const cMax = Math.max(sC, eC);
            const updates: any[] = [];
            const fieldMap: any = { 'test_id': 'test_id', 'test_score': 'test_score', 'classwork': 'classwork_text', 'assign': 'homework_text', 'next_quiz': 'next_quiz_text', 'mission': 'mission', 'notes': 'special_notes' };
            for (let r = rMin; r <= rMax; r++) {
              const st = students[r]; const sess = st.todaySession || {}; const nD = { ...sess }; let chg = false;
              for (let c = cMin; c <= cMax; c++) { const cid = activeColumns[c].id; const f = fieldMap[cid]; if (f) { nD[f] = ''; chg = true; } }
              if (chg) updates.push({ studentId: st.id, newData: nD, prevData: { ...sess } });
            }
            if (updates.length > 0) handleBatchSaveWithUndo(updates);
          }
        }
      }
    };

    window.addEventListener('mouseup', handleMouseUpGlobal);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
    };
  }, [isDragging, selectedRange, students, activeColumns, selectedIds, undoStack, activeCell, editingCell, performUndo, handleCopy, handlePaste]);

  const resizingCol = useRef<{ id: string; startX: number; startWidth: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent, colId: string) => { resizingCol.current = { id: colId, startX: e.pageX, startWidth: colWidths[colId] || 100 }; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); document.body.style.cursor = 'col-resize'; };
  const onMouseMove = (e: MouseEvent) => { if (!resizingCol.current) return; const { id, startX, startWidth } = resizingCol.current; const newWidth = Math.max(40, startWidth + (e.pageX - startX)); setColWidths(prev => ({ ...prev, [id]: newWidth })); };
  const onMouseUp = () => { if (resizingCol.current) { setColWidths(latest => { localStorage.setItem('todaySheetColWidths', JSON.stringify(latest)); return latest; }); } resizingCol.current = null; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); document.body.style.cursor = 'default'; };
  const handleSetSwitch = (setId: string) => { setActiveSet(setId); localStorage.setItem(`todaySheetActiveSet_${currentUser?.id || 'default'}`, setId); };
  const toggleColumn = (colId: string) => { const newCols = visibleColumns.includes(colId) ? visibleColumns.filter(c => c !== colId) : [...visibleColumns, colId]; const newPresets = { ...presets, [activeSet]: newCols }; setPresets(newPresets); localStorage.setItem(`todaySheetPresets_${currentUser?.id || 'default'}`, JSON.stringify(newPresets)); };
  const handleSendAll = async () => { if (!confirm(`${students.length}명 일괄 발송하시겠습니까?`)) return; setIsSendingReport('all'); let count = 0; for (const s of students) { try { const res = await fetch('/api/report', { method: 'POST', body: JSON.stringify({ studentId: s.id, sessionDate: selectedDate, academyId: academyInfo.id }) }); if (res.ok) count++; } catch(e){} } alert(`${count}명 완료`); setIsSendingReport(null); };
  const handleSendIndividual = async (id: string) => { const s = students.find((st:any) => st.id === id); if (!s) return; setIsSendingReport(id); try { const res = await fetch('/api/report', { method: 'POST', body: JSON.stringify({ studentId: id, sessionDate: selectedDate, academyId: academyInfo.id }) }); if (res.ok) alert(`${s.name} 발송 완료`); } catch(e){} finally { setIsSendingReport(null); } };
  const handleBatchQuizCut = async (cut: number) => { const actives = students.filter((s:any) => !s.is_deleted); if (actives.length === 0) return; if (!confirm(`${actives.length}명 커트라인을 ${cut}개로 변경하시겠습니까?`)) return; setIsSendingReport('batch-cut'); try { await Promise.all(actives.map((s:any) => handleSaveWithUndo(s.id, { ...s.todaySession, next_quiz_cut: cut }))); alert('변경 완료'); } catch(e){} finally { setIsSendingReport(null); } };
  const gradeStats = useMemo(() => { const stats: Record<string, number> = {}; ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'].forEach(g => stats[g] = 0); students.forEach((s:any) => { if (stats[s.grade] !== undefined) stats[s.grade]++; }); return stats; }, [students]);

  return (
    <div className="p-3 space-y-4 relative flex flex-col h-full overflow-hidden bg-[#050505] text-center">
      <div className="flex items-center justify-between px-3 py-2 bg-black/50 border border-white/10 rounded-lg shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5 items-start">
            <h3 className="text-[13px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2.5"><TableIcon size={16} /> Daily Sheet</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter mr-1">{students.length} Total</span>
              {Object.entries(gradeStats).filter(([_, count]) => count > 0).map(([grade, count], idx) => {
                const colorClass = grade.includes('초') ? 'text-emerald-500/80' : grade.includes('고') ? 'text-amber-500/80' : 'text-blue-500/80';
                return <div key={grade || idx} className="flex items-center gap-1 bg-white/[0.03] border border-white/5 px-1.5 py-0.5 rounded-[2px]"><span className="text-[8px] font-bold text-gray-600 uppercase">{grade}</span><span className={`text-[8px] font-black ${colorClass}`}>{count}</span></div>;
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div onClick={(e) => { const input = e.currentTarget.querySelector('input'); if (input && 'showPicker' in input) try { (input as any).showPicker(); } catch (err) { console.error(err); } }}
            className="flex items-center gap-2 bg-black border border-white/20 rounded-[6px] px-4 py-2 text-gray-400 hover:text-white transition-all group cursor-pointer shadow-xl">
            <CalendarIcon size={16} className="group-hover:text-blue-500" />
            <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="bg-transparent text-[12px] font-black uppercase outline-none cursor-pointer [color-scheme:dark]" />
          </div>

          {undoStack.length > 0 && (
            <button onClick={performUndo} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-[6px] text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-blue-600/20 transition-all shadow-xl" title="Cmd+Z">
              <RotateCcw size={14} className="text-blue-500" /> 실행 취소 <span className="bg-white/10 px-1.5 py-0.5 rounded text-[8px] ml-1">{undoStack.length}</span>
            </button>
          )}

          <button onClick={() => onSortModeChange(sortMode === 'time' ? 'name' : 'time')} className={`flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-[6px] text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${sortMode === 'time' ? 'text-blue-400' : 'text-emerald-400'} hover:text-white hover:bg-white/10`}>
            {sortMode === 'time' ? <ClockIcon size={14} /> : <SortAsc size={14} />} {sortMode === 'time' ? '시간순' : '이름순'}
          </button>

          <button onClick={() => setIsReportVisible(!isReportVisible)} className={`flex items-center gap-2 px-5 py-2 rounded-[6px] text-[11px] font-black uppercase tracking-widest transition-all border shadow-xl ${isReportVisible ? 'bg-blue-600 border-blue-500 text-white shadow-blue-900/30' : 'bg-black border-white/20 text-gray-400 hover:text-white'}`}><LayoutGrid size={16} /> {isReportVisible ? '리포트 닫기' : '리포트 미리보기'}</button>
          
          <div className="relative">
            <button onClick={() => setIsExportOpen(!isExportOpen)} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-[6px] text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all shadow-xl"><Download size={14} /> Download</button>
            <AnimatePresence>
              {isExportOpen && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-56 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 rounded-lg shadow-2xl p-2 z-[100] overflow-hidden">
                  <div className="space-y-1">
                    <button onClick={() => handleExport('aca2000')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-indigo-400 transition-all text-left group border border-indigo-500/10 hover:border-indigo-500/30 mb-1 bg-indigo-500/5">
                      <div className="w-8 h-8 rounded bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                        <Zap size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-black">ACA2000 전용</span>
                        <span className="text-[9px] text-gray-600">업로드용 맞춤 엑셀</span>
                      </div>
                    </button>
                    <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-emerald-400 transition-all text-left group">
                      <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all"><FileSpreadsheet size={16} /></div>
                      <div className="flex flex-col"><span className="text-[12px] font-black">Excel File</span><span className="text-[9px] text-gray-600">Microsoft Excel (.xlsx)</span></div>
                    </button>
                    <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-amber-400 transition-all text-left group">
                      <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all"><FileTextIcon size={16} /></div>
                      <div className="flex flex-col"><span className="text-[12px] font-black">CSV File</span><span className="text-[9px] text-gray-600">쉼표로 구분된 텍스트 파일</span></div>
                    </button>
                    <button onClick={() => handleExport('copy')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-all text-left group">
                      <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all"><Copy size={16} /></div>
                      <div className="flex flex-col"><span className="text-[12px] font-black">Copy to Clipboard</span><span className="text-[9px] text-gray-600">다른 엑셀 시트에 바로 붙여넣기</span></div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-white/5 border border-white/10 rounded-[6px] text-gray-400 hover:text-white transition-all shadow-xl"><Settings2 size={18} /></button>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex bg-white/5 p-0.5 rounded-md border border-white/10">
          {['1', '2', '3', '4'].map(setId => (
            <button key={setId} onClick={() => handleSetSwitch(setId)} className={`px-4 py-1.5 rounded-[4px] text-[10px] font-black transition-all ${activeSet === setId ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-gray-300'}`}>SET {setId}</button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleSendAll} disabled={!!isSendingReport} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-[4px] text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 shadow-lg">{isSendingReport === 'all' ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />} 전체 리포트 발송</button>
        </div>
      </div>

      <div className={`bg-black border border-white/20 rounded-lg shadow-2xl custom-scrollbar-h overflow-x-auto overflow-y-auto transition-all duration-500 ${isReportVisible ? 'max-h-[35vh] shrink-0' : 'flex-1 min-h-0'} today-sheet-container`}>
        <table style={{ width: totalWidth, minWidth: '100%' }} className={`border-collapse table-fixed text-xs text-left ${isDragging ? 'select-none' : ''}`}>
          <thead><TodaySheetHeader colWidths={colWidths} activeColumns={activeColumns} onMouseDown={onMouseDown} onBatchQuizCut={handleBatchQuizCut} onSelectAll={handleSelectAll} isAllSelected={students.length > 0 && selectedIds.length === students.length} /></thead>
          <tbody className="divide-y divide-white/10">
            {(() => {
              const dayKey = getDayOfWeek(selectedDate);
              const [_, configM] = (academyInfo?.operation_settings?.first_period_time || "00:00").split(':').map(Number);
              const displayMinute = configM.toString().padStart(2, '0');

              return students.map((s: any, idx: number) => {
                const getStartTime = (st: any) => {
                  const stat = st.todaySession?.attendance_status || '';
                  if (stat.includes(':')) {
                    const parts = stat.split(':');
                    const val = parseInt(parts[parts.length - 1]);
                    if (!isNaN(val) && val < 24) return val;
                  }
                  const hours = st.day_schedules?.[dayKey] || [];
                  const rawHour = hours.length > 0 ? Math.min(...hours.map((h: number) => h % 100)) : 999;
                  return rawHour;
                };
                const currentStartTime = getStartTime(s);
                const prevStartTime = idx > 0 ? getStartTime(students[idx - 1]) : null;
                const isNewSection = sortMode === 'time' && currentStartTime !== prevStartTime;

                return (
                  <React.Fragment key={`${s.id}-${idx}`}>
                    {isNewSection && (
                      <tr className="bg-blue-600/5"><td colSpan={activeColumns.length} className="px-4 py-2 border-b border-blue-500/30"><div className="flex items-center gap-3"><span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] whitespace-nowrap">{currentStartTime === 999 ? '기타 타임' : (currentStartTime >= 12 ? (currentStartTime === 12 ? `오후 12:${displayMinute}` : `오후 ${currentStartTime-12}:${displayMinute}`) : `오전 ${currentStartTime}:${displayMinute}`) + ' 수업'}</span><div className="flex-1 h-px bg-gradient-to-r from-blue-500/30 to-transparent" /></div></td></tr>
                    )}
                    <TodaySheetRow 
                      student={s} 
                      masterTextbooks={masterTextbooks} 
                      onSave={handleSaveWithUndo} 
                      onUpdateStudentInfo={onUpdateStudentInfo}
                      onViewProgress={onViewProgress} 
                      colWidths={colWidths} 
                      activeColumns={activeColumns} 
                      selectedDate={selectedDate} 
                      isHistoryExpanded={!!expandedHistory[s.id]} 
                      onToggleHistory={toggleHistory} 
                      currentUser={currentUser} 
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
