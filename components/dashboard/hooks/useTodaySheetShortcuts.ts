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
  toggleHistory?: (studentId: string) => void; // 💡 히스토리 토글 함수 추가
  handleUndo?: () => void;
  handleRedo?: () => void;
  toggleShowAllTools?: () => void; // 💡 툴박스 접기/펼치기 토글 함수 추가
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
    toggleSecondRow, toggleHistory, handleUndo, handleRedo,
    toggleShowAllTools
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
    
    // 🔒 [추가] 채워질 범위 중 승인 대기 중이고 보호 대상 컬럼이 하나라도 포함되어 있다면 전체 작업 차단 및 알럿 노출
    let hasLockedCell = false;
    for (let r = rMin + 1; r <= rMax; r++) {
      const targetStudent = filteredStudents[r];
      if (!targetStudent) continue;
      for (let c = cMin; c <= cMax; c++) {
        const colId = activeColumns[c].id;
        const isSubmitted = ['pending', 'submitted'].includes(targetStudent.todaySession?.approval_status || '');
        const isProtectedCol = ['completed_classwork', 'assign'].includes(colId);
        if (isSubmitted && isProtectedCol) {
          hasLockedCell = true;
          break;
        }
      }
      if (hasLockedCell) break;
    }

    if (hasLockedCell) {
      alert("학생이 제출한 내용이 있습니다. 승인을 한 후 수정이 가능합니다.");
      return;
    }

    // 💡 [안정화] 학생 객체 또는 세션에서 특정 컬럼의 텍스트 값 및 연관 데이터를 추출하는 함수
    const extractColumnValue = (st: any, colId: string) => {
      if (!st) return { textVal: '', extraData: {} };
      const sess = st.todaySession || {};
      const prop = mapColumnToProp(colId);

      if (colId === 'mission') {
        return { textVal: st.recent_mission || sess.mission || '', extraData: {} };
      }
      if (colId === 'management_notes') {
        return { textVal: st.management_notes || sess.management_notes || '', extraData: {} };
      }
      if (colId === 'next_quiz') {
        let nqText = sess.next_quiz_text || '';
        let nqJson = sess.next_quiz_json || [];
        let nqCut = sess.next_quiz_cut || 0;
        let nqTrial = sess.next_quiz_trial || 1;

        if (!nqText && sess.homework_to) {
          try {
            const raw = sess.homework_to;
            if (typeof raw === 'string' && raw.startsWith('{')) {
              const parsed = JSON.parse(raw);
              nqText = parsed.text || '';
              nqJson = parsed.json || [];
              nqCut = parsed.cut || 0;
              nqTrial = parsed.trial || 1;
            } else if (typeof raw === 'string') {
              nqText = raw;
            }
          } catch (e) {}
        }
        return {
          textVal: nqText,
          extraData: {
            next_quiz_json: nqJson,
            next_quiz_cut: nqCut,
            next_quiz_trial: nqTrial
          }
        };
      }

      return { textVal: sess[prop] || '', extraData: {} };
    };

    for (let r = rMin + 1; r <= rMax; r++) {
      const targetStudent = filteredStudents[r];
      const targetSession = targetStudent.todaySession || {};
      const newData: any = {};
      let changed = false;
      
      targetColIds.forEach(colId => {
        const prop = mapColumnToProp(colId);
        const sourceValInfo = extractColumnValue(sourceStudent, colId);

        newData[prop] = sourceValInfo.textVal;
        if (sourceValInfo.extraData) {
          Object.assign(newData, sourceValInfo.extraData);
        }
        changed = true;
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
      if (typeof window !== 'undefined') {
        (window as any).__ams_batch_saving = true;
      }

      setStudents((prev: any[]) => prev.map(s => {
        const update = updates.find(u => u.studentId === s.id);
        if (update) {
          const hasMission = 'mission' in update.newData;
          const hasNotes = 'management_notes' in update.newData;
          return {
            ...s,
            ...(hasMission ? { recent_mission: update.newData.mission } : {}),
            ...(hasNotes ? { management_notes: update.newData.management_notes } : {}),
            todaySession: {
              ...(s.todaySession || {}),
              ...update.newData
            }
          };
        }
        return s;
      }));
      
      syncTodaySheetDom(updates, targetColIds);
      handleBatchSave(updates).finally(() => {
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            (window as any).__ams_batch_saving = false;
          }
        }, 150);
      });
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

      // Alt + T (Option + T) - 툴박스 접기/펼치기 토글
      const isTKey = e.key?.toLowerCase() === 't' || e.code === 'KeyT';
      if (e.altKey && isTKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (toggleShowAllTools) {
          e.preventDefault();
          toggleShowAllTools();
          return;
        }
      }

      // Alt + U (Option + U) - 2행 상세 설정 바 토글
      const isUKey = e.key?.toLowerCase() === 'u' || e.code === 'KeyU';
      if (e.altKey && isUKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (toggleSecondRow) {
          e.preventDefault();
          toggleSecondRow();
          return;
        }
      }

      // Alt + H (Option + H) - 히스토리 패널 토글
      const isHKey = e.key?.toLowerCase() === 'h' || e.code === 'KeyH';
      if (e.altKey && isHKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (activeCell && toggleHistory) {
          e.preventDefault();
          toggleHistory(activeCell.studentId);
          return;
        }
      }

      // Ctrl+D / Cmd+D / Alt+D (Fill Down)
      const isDKey = e.key?.toLowerCase() === 'd' || e.code === 'KeyD';
      const isModifierPressed = e.ctrlKey || e.metaKey || e.altKey;
      if (isModifierPressed && isDKey && !e.shiftKey) {
        const isMultiRowSelection = selectedRange && selectedRange.startStudentId !== selectedRange.endStudentId;
        
        if (isMultiRowSelection) {
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
        } else if (activeCell || selectedRange) {
          // 💡 단일 셀 선택 혹은 입력창 내부 포커스 시 바로 윗행 학생의 동일 컬럼 값 복사
          e.preventDefault();
          const targetStudentId = activeCell?.studentId || selectedRange?.endStudentId;
          const colId = activeCell?.columnId || selectedRange?.endColId;
          if (!targetStudentId || !colId) return;

          const rIdx = filteredStudents.findIndex(s => s.id === targetStudentId);
          if (rIdx > 0) {
            const prevStudent = filteredStudents[rIdx - 1];
            const currentStudent = filteredStudents[rIdx];
            const prop = mapColumnToProp(colId);
            
            let prevVal = '';
            let extraData: any = {};

            if (colId === 'mission') {
              prevVal = prevStudent.recent_mission || '';
              extraData = { mission: prevVal };
            } else if (colId === 'management_notes') {
              prevVal = prevStudent.management_notes || '';
              extraData = { management_notes: prevVal };
            } else if (colId === 'next_quiz') {
              const sess = prevStudent.todaySession || {};
              prevVal = sess.next_quiz_text || '';
              let nqJson = sess.next_quiz_json || [];
              let nqCut = sess.next_quiz_cut || 0;
              let nqTrial = sess.next_quiz_trial || 1;
              if (!prevVal && sess.homework_to) {
                try {
                  const raw = sess.homework_to;
                  if (typeof raw === 'string' && raw.startsWith('{')) {
                    const parsed = JSON.parse(raw);
                    prevVal = parsed.text || '';
                    nqJson = parsed.json || [];
                    nqCut = parsed.cut || 0;
                    nqTrial = parsed.trial || 1;
                  } else if (typeof raw === 'string') {
                    prevVal = raw;
                  }
                } catch (e) {}
              }
              extraData = {
                next_quiz_text: prevVal,
                next_quiz_json: nqJson,
                next_quiz_cut: nqCut,
                next_quiz_trial: nqTrial
              };
            } else if (prop) {
              const prevSession = prevStudent.todaySession || {};
              prevVal = prevSession[prop] || '';
              extraData = { [prop]: prevVal };
            }
            
            // 현재 입력 포커스된 textarea / input 이 있을 경우 native value setter로 갱신하여 React onChange/onInput 도 완벽 연동
            if (isInput && (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) {
              try {
                const proto = target instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                valueSetter?.call(target, prevVal);
              } catch (e) {
                target.value = prevVal;
              }
              target.dispatchEvent(new Event('input', { bubbles: true }));
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }

            if (currentStudent) {
              // 입력 모드 여부와 관계없이 React State, DOM, DB 저장을 100% 완전 동기화
              const newData = extraData;
              setStudents((prev: any[]) => prev.map(s => {
                if (s.id === currentStudent.id) {
                  return {
                    ...s,
                    ...(colId === 'mission' ? { recent_mission: prevVal } : {}),
                    ...(colId === 'management_notes' ? { management_notes: prevVal } : {}),
                    todaySession: {
                      ...(s.todaySession || {}),
                      ...newData
                    }
                  };
                }
                return s;
              }));
              
              syncTodaySheetDom([{
                studentId: currentStudent.id,
                newData,
                prevData: { ...(currentStudent.todaySession || {}) }
              }], [colId]);

              handleBatchSave([{
                studentId: currentStudent.id,
                newData,
                prevData: { ...(currentStudent.todaySession || {}) }
              }]);
            }
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
          // 🔒 [추가] 승인 대기 중이고 보호 대상 컬럼이면 즉시 타이핑 덮어쓰기 방지
          const activeStudent = filteredStudents.find(s => s.id === activeCell.studentId);
          const isSubmitted = ['pending', 'submitted'].includes(activeStudent?.todaySession?.approval_status || '');
          const isProtectedCol = ['completed_classwork', 'assign'].includes(activeCell.columnId);
          if (isSubmitted && isProtectedCol) {
            e.preventDefault();
            alert("학생이 제출한 내용이 있습니다. 승인을 한 후 수정이 가능합니다.");
            return;
          }

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

      // Backspace / Delete (단일 및 다중 셀 삭제)
      if (!isInput && (e.key === 'Backspace' || e.key === 'Delete') && (selectedRange || activeCell)) {
        e.preventDefault();
        const targetRange = selectedRange || (activeCell ? {
          startStudentId: activeCell.studentId,
          endStudentId: activeCell.studentId,
          startColId: activeCell.columnId,
          endColId: activeCell.columnId
        } : null);

        if (!targetRange) return;

        const sI = filteredStudents.findIndex(s => s.id === targetRange.startStudentId);
        const eI = filteredStudents.findIndex(s => s.id === targetRange.endStudentId);
        const sC = activeColumns.findIndex(c => c.id === targetRange.startColId);
        const eC = activeColumns.findIndex(c => c.id === targetRange.endColId);
        
        if (sI !== -1 && eI !== -1 && sC !== -1 && eC !== -1) {
          const rMin = Math.min(sI, eI), rMax = Math.max(sI, eI);
          const cMin = Math.min(sC, eC), cMax = Math.max(sC, eC);

          // 🔒 [추가] 삭제 대상 범위 내에 승인 대기 중이고 보호 대상 컬럼이 하나라도 포함되어 있다면 전체 삭제를 차단하고 알럿 노출
          let hasLockedCell = false;
          for (let r = rMin; r <= rMax; r++) {
            const st = filteredStudents[r];
            if (!st) continue;
            for (let c = cMin; c <= cMax; c++) {
              const colId = activeColumns[c].id;
              const isSubmitted = ['pending', 'submitted'].includes(st.todaySession?.approval_status || '');
              const isProtectedCol = ['completed_classwork', 'assign'].includes(colId);
              if (isSubmitted && isProtectedCol) {
                hasLockedCell = true;
                break;
              }
            }
            if (hasLockedCell) break;
          }

          if (hasLockedCell) {
            alert("학생이 제출한 내용이 있습니다. 승인을 한 후 수정이 가능합니다.");
            return;
          }

          const updates: any[] = [];

          // 💡 [수정] 삭제 대상 컬럼 ID들 미리 추출
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
              if (colId === 'test_id') {
                // 💡 '오늘 테스트' 지움 시 지난 수업의 예정 테스트(next_quiz_text 또는 이전 test_id)가 있다면 즉시 자동 복구 연동
                const sess = st.todaySession || {};
                const lastSess = st.lastSession || {};
                const activePlanText = sess.next_quiz_text || 
                                       lastSess.next_quiz_text || 
                                       (lastSess.test_completed === false ? (lastSess.test_id || "") : "") || 
                                       lastSess.test_id || "";
                const activePlanCut = sess.next_quiz_text 
                  ? (Number(sess.next_quiz_cut) || 0) 
                  : (Number(lastSess.next_quiz_cut) || Number(lastSess.test_cut) || 0);

                const restoredTest = (activePlanText && activePlanText.trim() !== '없음') ? activePlanText.trim() : '';
                
                nD['test_id'] = restoredTest;
                nD['test_status'] = restoredTest;
                nD['test_cut'] = restoredTest ? activePlanCut : 0;
              } else if (colId === 'mission') {
                nD['mission'] = '';
              } else if (colId === 'management_notes') {
                nD['management_notes'] = '';
              } else if (prop) {
                nD[prop] = '';
              }
              chg = true;
            });
            if (chg) updates.push({ studentId: st.id, newData: nD, prevData: { ...sess } });
          }
          
          if (updates.length > 0) { 
            if (typeof window !== 'undefined') {
              (window as any).__ams_batch_saving = true;
            }

            // 💡 [중요] React State(students) 반영으로 삭제 상태 지연/원복 없는 100% 지속 보존
            setStudents((prev: any[]) => prev.map(s => {
              const update = updates.find(u => u.studentId === s.id);
              if (update) {
                const hasMission = 'mission' in update.newData;
                const hasNotes = 'management_notes' in update.newData;
                return {
                  ...s,
                  ...(hasMission ? { recent_mission: update.newData.mission } : {}),
                  ...(hasNotes ? { management_notes: update.newData.management_notes } : {}),
                  todaySession: {
                    ...(s.todaySession || {}),
                    ...update.newData
                  }
                };
              }
              return s;
            }));

            syncTodaySheetDom(updates, targetColIds, true); 
            handleBatchSave(updates).finally(() => {
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  (window as any).__ams_batch_saving = false;
                }
              }, 150);
            }); 
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
    handleUndo, handleRedo, toggleHistory, toggleShowAllTools
  ]);
}
