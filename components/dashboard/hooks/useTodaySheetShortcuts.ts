'use client';

import { useEffect, useCallback } from 'react';
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
  handleBatchSave: (updates: any[]) => Promise<void>;
  handleSetSwitch: (setId: string) => void;
  setIsDragging: (isDragging: boolean) => void;
  selectedIds: string[];
  onSave: (studentId: string, data: any) => Promise<any>;
  toggleSecondRow?: () => void;
  handleUndo?: () => void;
  handleRedo?: () => void;
}

/**
 * 💡 TodaySheet의 키보드 단축키 및 인터랙션을 관리하는 메인 훅
 */
export function useTodaySheetShortcuts(props: UseTodaySheetShortcutsProps) {
  const {
    activeCell, setActiveCell, editingCell, setEditingCell,
    students, setStudents,
    filteredStudents, activeColumns, selectedRange, setSelectedRange,
    handleBatchSave, handleSetSwitch, setIsDragging, selectedIds,
    toggleSecondRow, handleUndo, handleRedo
  } = props;

  // 1. 클립보드 로직 분리 (handleCopy, handlePaste, handleCut)
  const { handleCopy, handlePaste, handleCut } = useTodaySheetClipboard(props);

  // 아래 방향 자동 채우기 (Fill Down)
  const handleFillDown = useCallback(() => {
    if (!selectedRange) return;
    const sI = filteredStudents.findIndex(s => s.id === selectedRange.startStudentId);
    const eI = filteredStudents.findIndex(s => s.id === selectedRange.endStudentId);
    const sC = activeColumns.findIndex(c => c.id === selectedRange.startColId);
    const eC = activeColumns.findIndex(c => c.id === selectedRange.endColId);
    
    if (sI === -1 || eI === -1 || sC === -1 || eC === -1) return;
    
    const rMin = Math.min(sI, eI);
    const rMax = Math.max(sI, eI);
    const cMin = Math.min(sC, eC);
    const cMax = Math.max(sC, eC);
    
    if (rMin === rMax) return; // 채울 대상 아래 행이 없는 경우 스킵
    
    const sourceStudent = filteredStudents[rMin];
    const sourceSession = sourceStudent.todaySession || {};
    const updates: any[] = [];
    const targetColIds: string[] = [];
    
    for (let c = cMin; c <= cMax; c++) {
      const colId = activeColumns[c].id;
      if (!['select', 'name', 'action', 'date', 'attendance'].includes(colId)) {
        targetColIds.push(colId);
      }
    }
    
    if (targetColIds.length === 0) return;
    
    for (let r = rMin + 1; r <= rMax; r++) {
      const targetStudent = filteredStudents[r];
      const targetSession = targetStudent.todaySession || {};
      const newData: any = {};
      let changed = false;
      
      targetColIds.forEach(colId => {
        const prop = mapColumnToProp(colId);
        let val = '';
        if (colId === 'mission') {
          val = sourceStudent.recent_mission || '';
          if ((targetStudent.recent_mission || '') !== val) {
            newData[prop] = val;
            changed = true;
          }
        } else {
          val = sourceSession[prop] || '';
          if ((targetSession[prop] || '') !== val) {
            newData[prop] = val;
            changed = true;
          }
        }
      });
      
      if (changed) {
        updates.push({
          studentId: targetStudent.id,
          newData,
          prevData: { ...targetSession }
        });
      }
    }
    
    if (updates.length > 0) {
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
      
      syncTodaySheetDom(updates, targetColIds);
      handleBatchSave(updates);
    }
  }, [filteredStudents, activeColumns, selectedRange, setStudents, handleBatchSave]);

  // 2. 전역 키보드 및 마우스 이벤트 바인딩
  useEffect(() => {
    let scrollInterval: NodeJS.Timeout | null = null;

    const stopScroll = () => {
      if (scrollInterval) clearInterval(scrollInterval);
      scrollInterval = null;
    };

    const handleMouseMoveGlobal = (e: MouseEvent) => {
      if (e.buttons === 1) { // 왼쪽 마우스 버튼 누른 상태(드래그)
        const container = document.querySelector('.today-sheet-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const margin = 60;
          let speed = 0;
          
          if (e.clientY < rect.top + margin) speed = -20;
          else if (e.clientY > rect.bottom - margin) speed = 20;

          if (speed !== 0) {
            if (!scrollInterval) {
              scrollInterval = setInterval(() => {
                container.scrollBy(0, speed);
                // 스크롤되면서 마우스 아래로 새롭게 들어온 셀을 찾아 선택 이벤트 트리거
                const elem = document.elementFromPoint(e.clientX, e.clientY);
                if (elem) {
                  const cell = elem.closest('td');
                  if (cell) {
                    const enterEvent = new MouseEvent('mouseenter', { bubbles: true });
                    cell.dispatchEvent(enterEvent);
                  }
                }
              }, 30);
            }
          } else {
            stopScroll();
          }
        }
      } else {
        stopScroll();
      }
    };

    const handleMouseUpGlobal = () => {
      stopScroll();
      setIsDragging(false);
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('table')) setSelectedRange(null);
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const target = document.activeElement as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName);
      
      // Undo / Redo 단축키 감지 (Cmd+Z, Cmd+Y, Cmd+Shift+Z)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && !e.altKey) {
        const keyLower = e.key.toLowerCase();
        
        // 1) Undo: Cmd+Z (Shift는 안 눌린 상태)
        if (keyLower === 'z' && !e.shiftKey) {
          if (isInput) {
            // 인풋 편집 중일 때는 브라우저 기본 Undo가 동작해야 하므로 통과
            return;
          }
          e.preventDefault();
          if (handleUndo) {
            handleUndo();
          }
          return;
        }

        // 2) Redo: Cmd+Y 또는 Cmd+Shift+Z
        if (keyLower === 'y' || (keyLower === 'z' && e.shiftKey)) {
          if (isInput) {
            // 인풋 편집 중일 때는 통과
            return;
          }
          e.preventDefault();
          if (handleRedo) {
            handleRedo();
          }
          return;
        }
      }

      // Alt + Q, W, E, R (Set Switch)
      if (e.altKey && ['q','w','e','r','Q','W','E','R'].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, string> = { q:'1', w:'2', e:'3', r:'4', Q:'1', W:'2', E:'3', R:'4' };
        handleSetSwitch(map[e.key]);
        return;
      }

      // Alt + T (Option + T) - 2행 상세 설정 바 토글
      const isTKey = e.key?.toLowerCase() === 't' || e.code === 'KeyT';
      if (e.altKey && isTKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (toggleSecondRow) {
          e.preventDefault();
          toggleSecondRow();
          return;
        }
      }

      // Ctrl+D / Alt+D (Fill Down)
      const isDKey = e.key?.toLowerCase() === 'd' || e.code === 'KeyD';
      const isModifierPressed = e.ctrlKey || e.altKey;
      if (isModifierPressed && isDKey && !e.shiftKey) {
        if (selectedRange) {
          e.preventDefault();
          if (isInput) {
            target.blur();
            requestAnimationFrame(() => {
              handleFillDown();
            });
          } else {
            handleFillDown();
          }
          return;
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

        // 💡 [수정] 점수 개수 모드(분수)에서 분자 -> 분모로 Tab 키 내부 이동을 할 때는 전역 탭 이동 차단
        if (e.key === 'Tab' && !e.shiftKey && activeCell?.columnId === 'test_score') {
          const studentObj = filteredStudents.find(s => s.id === activeCell.studentId);
          if (studentObj?.todaySession?.test_score_type === 'count') {
            if (target.getAttribute('data-col-id') === 'test_score' && target.tagName === 'INPUT') {
              return; // 전역 낚아채기를 스킵하여 ScoreCell 내부의 Tab 포커스 이동이 실행되도록 합니다.
            }
          }
        }

        e.preventDefault(); 

        // 💡 [수정] 강제 이동으로 인한 언마운트 전에 포커스를 먼저 해제하여 정식 onBlur 자동저장 실행
        if (isInput) {
          (target as HTMLElement).blur();
        }

        // 💡 blur에 따른 저장 프로세스가 먼저 실행될 수 있도록 브라우저 다음 프레임에서 안전하게 이동
        requestAnimationFrame(() => {
          setSelectedRange(null);
          
          let targetR = rIdx;
          let targetC = cIdx;
          if (e.key === 'Enter') targetR++; 
          else if (e.shiftKey) targetC--; else targetC++;

          targetR = Math.max(0, Math.min(filteredStudents.length - 1, targetR));
          targetC = Math.max(0, Math.min(activeColumns.length - 1, targetC));
          
          if (targetR !== rIdx || targetC !== cIdx) {
            const nS = filteredStudents[targetR];
            const nCol = activeColumns[targetC];
            if (nS && nCol) {
              setActiveCell({ studentId: nS.id, columnId: nCol.id });
              setSelectedRange({ startStudentId: nS.id, startColId: nCol.id, endStudentId: nS.id, endColId: nCol.id });
              setTimeout(() => setEditingCell({ studentId: nS.id, columnId: nCol.id }), 50);
            }
          } else {
            setEditingCell(null);
          }
        });
        return; // 후반부 동기 셀 이동 로직과의 중복 실행 방지
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
          setSelectedRange({ startStudentId: nS.id, startColId: nCol.id, endStudentId: nS.id, endColId: nCol.id });
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
            handleBatchSave(updates); 
          }
        }
      }

    };

    window.addEventListener('mousemove', handleMouseMoveGlobal);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('cut', handleCut);

    return () => {
      stopScroll();
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('cut', handleCut);
    };
  }, [
    activeCell, setActiveCell, editingCell, setEditingCell, filteredStudents, activeColumns, 
    selectedRange, setSelectedRange, handleBatchSave, handleSetSwitch, 
    handleCopy, handlePaste, handleCut, setIsDragging, selectedIds, handleFillDown, toggleSecondRow,
    handleUndo, handleRedo
  ]);
}
