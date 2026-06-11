'use client';

import { useEffect } from 'react';
import { mapColumnToProp, COLUMN_TO_FIELD_MAP } from '@/lib/sessionFieldMap';
import { syncTodaySheetDom } from '@/lib/todaySheetDomSync';
import { useTodaySheetClipboard } from './useTodaySheetClipboard';

interface UseTodaySheetShortcutsProps {
  activeCell: { studentId: string; columnId: string } | null;
  setActiveCell: (cell: { studentId: string; columnId: string } | null) => void;
  editingCell: { studentId: string; columnId: string } | null;
  setEditingCell: (cell: { studentId: string; columnId: string } | null) => void;
  students: any[];
  setStudents: (update: any) => void;
  filteredStudents: any[];
  activeColumns: any[];
  selectedRange: any;
  setSelectedRange: (range: any) => void;
  selectedDate: string;
  performUndo: () => void;
  handleBatchSaveWithUndo: (updates: any[]) => Promise<void>;
  handleSetSwitch: (setId: string) => void;
  setIsDragging: (isDragging: boolean) => void;
  selectedIds: string[];
  onSave: (studentId: string, data: any) => Promise<any>;
}

/**
 * 💡 TodaySheet의 키보드 단축키 및 인터랙션을 관리하는 메인 훅
 */
export function useTodaySheetShortcuts(props: UseTodaySheetShortcutsProps) {
  const {
    activeCell, setActiveCell, editingCell, setEditingCell,
    students, setStudents,
    filteredStudents, activeColumns, selectedRange, setSelectedRange,
    performUndo, handleBatchSaveWithUndo, handleSetSwitch, setIsDragging, selectedIds
  } = props;

  // 1. 클립보드 로직 분리 (handleCopy, handlePaste)
  const { handleCopy, handlePaste } = useTodaySheetClipboard(props);

  // 2. 전역 키보드 및 마우스 이벤트 바인딩
  useEffect(() => {
    const handleMouseUpGlobal = () => {
      console.log('Drag End state:', { selectedRange, activeCell });
      setIsDragging(false);
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('table')) setSelectedRange(null);
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const target = document.activeElement as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName);
      
      // Alt + Q, W, E, R (Set Switch)
      if (e.altKey && ['q','w','e','r','Q','W','E','R'].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, string> = { q:'1', w:'2', e:'3', r:'4', Q:'1', W:'2', E:'3', R:'4' };
        handleSetSwitch(map[e.key]);
        return;
      }

      // Cmd+Z / Ctrl+Z (Undo)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (!isInput || (target as HTMLInputElement).selectionStart === (target as HTMLInputElement).selectionEnd) {
          e.preventDefault(); performUndo(); return;
        }
      }

      if (!activeCell) return;
      const rIdx = filteredStudents.findIndex(s => s.id === activeCell.studentId);
      const cIdx = activeColumns.findIndex(c => c.id === activeCell.columnId);
      if (rIdx === -1 || cIdx === -1) return;

      let nR = rIdx, nC = cIdx;
      
      // 방향키 네비게이션 (입력 중이 아닐 때)
      if (!isInput) {
        if (e.key === 'ArrowDown') nR++; 
        else if (e.key === 'ArrowUp') nR--; 
        else if (e.key === 'ArrowRight') nC++; 
        else if (e.key === 'ArrowLeft') nC--;
      }

      // Enter / Tab 네비게이션
      if ((e.key === 'Enter' && !e.shiftKey && !e.altKey) || e.key === 'Tab') {
        if (e.key === 'Enter' && !isInput) return;
        e.preventDefault(); 
        setSelectedRange(null);
        if (e.key === 'Enter') nR++; 
        else if (e.shiftKey) nC--; else nC++;
      }

      // 💡 [추가] 선택 모드에서 즉시 타이핑 시 기존 내용 덮어쓰며 편집 시작 (엑셀 방식)
      const isCharacterKey = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (!isInput && isCharacterKey && activeCell && !editingCell) {
        const readOnlyCols = ['select', 'name', 'action', 'attendance', 'review', 'date'];
        if (!readOnlyCols.includes(activeCell.columnId)) {
          e.preventDefault();
          const colId = activeCell.columnId;
          const prop = mapColumnToProp(colId);
          const initialChar = e.key;

          // 1. 로컬 학생 데이터 즉시 덮어쓰기
          setStudents((prev: any[]) => prev.map(s => {
            if (s.id === activeCell.studentId) {
              if (colId === 'mission') {
                return { ...s, recent_mission: initialChar };
              } else {
                return {
                  ...s,
                  todaySession: {
                    ...(s.todaySession || {}),
                    [prop]: initialChar
                  }
                };
              }
            }
            return s;
          }));

          // 2. 편집 모드로 강제 전환
          setEditingCell(activeCell);
        }
      }

      // 셀 이동 처리
      if (nR !== rIdx || nC !== cIdx) {
        nR = Math.max(0, Math.min(filteredStudents.length - 1, nR));
        nC = Math.max(0, Math.min(activeColumns.length - 1, nC));
        const nS = filteredStudents[nR], nCol = activeColumns[nC];
        if (nS && nCol) {
          setActiveCell({ studentId: nS.id, columnId: nCol.id });
          if (e.key === 'Enter' || e.key === 'Tab') {
            setTimeout(() => setEditingCell({ studentId: nS.id, columnId: nCol.id }), 50);
          } else if (e.key.startsWith('Arrow')) {
            setEditingCell(null);
          }
        }
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        setEditingCell(null);
      }

      // Backspace / Delete (다중 셀 삭제)
      if (!isInput && (e.key === 'Backspace' || e.key === 'Delete') && selectedRange) {
        e.preventDefault();
        const sI = filteredStudents.findIndex(s => s.id === selectedRange.startStudentId);
        const eI = filteredStudents.findIndex(s => s.id === selectedRange.endStudentId);
        const sC = activeColumns.findIndex(c => c.id === selectedRange.startColId);
        const eC = activeColumns.findIndex(c => c.id === selectedRange.endColId);
        
        if (sI !== -1 && eI !== -1 && sC !== -1 && eC !== -1) {
          const rMin = Math.min(sI, eI), rMax = Math.max(sI, eI);
          const cMin = Math.min(sC, eC), cMax = Math.max(sC, eC);
          const updates: any[] = [];

          // 💡 [수정] 삭제 대상 컬럼 ID들 미리 추출 (전수 순회 방지용)
          const targetColIds: string[] = [];
          for (let c = cMin; c <= cMax; c++) {
            const colId = activeColumns[c].id;
            if (COLUMN_TO_FIELD_MAP[colId]) targetColIds.push(colId);
          }

          for (let r = rMin; r <= rMax; r++) {
            const st = filteredStudents[r], sess = st.todaySession || {}, nD: any = {};
            let chg = false;
            targetColIds.forEach(colId => {
              const prop = mapColumnToProp(colId);
              nD[prop] = ''; chg = true;
            });
            if (chg) updates.push({ studentId: st.id, newData: nD, prevData: { ...sess } });
          }
          
          if (updates.length > 0) { 
            syncTodaySheetDom(updates, targetColIds, true); 
            handleBatchSaveWithUndo(updates); 
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
  }, [
    activeCell, setActiveCell, editingCell, setEditingCell, filteredStudents, activeColumns, 
    selectedRange, setSelectedRange, performUndo, handleBatchSaveWithUndo, handleSetSwitch, 
    handleCopy, handlePaste, setIsDragging, selectedIds
  ]);
}
