'use client';

import { useCallback } from 'react';
import { parseClipboardText } from '@/lib/clipboardParser';
import { mapColumnToProp, mapFieldToColumn, mapColumnToField, COLUMN_TO_FIELD_MAP } from '@/lib/sessionFieldMap';
import { syncTodaySheetDom } from '@/lib/todaySheetDomSync';
import { matchRowIdentity } from '@/lib/rowIdentity';

interface UseTodaySheetClipboardProps {
  activeCell: { studentId: string; columnId: string } | null;
  editingCell: { studentId: string; columnId: string } | null;
  setEditingCell: (cell: { studentId: string; columnId: string } | null) => void;
  students: any[];
  setStudents: (update: any) => void;
  filteredStudents: any[];
  activeColumns: any[];
  selectedRange: any;
  selectedDate: string;
  handleBatchSave: (updates: any[]) => Promise<void>;
  selectedIds: string[];
}

export function useTodaySheetClipboard({
  activeCell, editingCell, setEditingCell,
  students, setStudents, filteredStudents, activeColumns,
  selectedRange, selectedDate, handleBatchSave, selectedIds
}: UseTodaySheetClipboardProps) {

  // 1. 복사 핸들러
  const handleCopy = useCallback((e: ClipboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName);
    // INPUT/TEXTAREA 내부에서 텍스트가 선택된 경우에만 브라우저 기본 복사에 위임
    // td/div 드래그 시 브라우저가 텍스트를 자동 선택해도 selectedRange가 있으면 항상 인터셉트
    const hasSelection = isInput
      ? (target as HTMLInputElement | HTMLTextAreaElement).selectionStart !== (target as HTMLInputElement | HTMLTextAreaElement).selectionEnd
      : false;

    const targetRange = selectedRange || (activeCell ? {
      startStudentId: activeCell.studentId,
      endStudentId: activeCell.studentId,
      startColId: activeCell.columnId,
      endColId: activeCell.columnId
    } : null);

    if (hasSelection || !targetRange) return;
    
    e.preventDefault();
    const sIdx = filteredStudents.findIndex(s => s.id === targetRange.startStudentId);
    const eIdx = filteredStudents.findIndex(s => s.id === targetRange.endStudentId);
    const sColIdx = activeColumns.findIndex(c => c.id === targetRange.startColId);
    const eColIdx = activeColumns.findIndex(c => c.id === targetRange.endColId);
    
    if (sIdx === -1 || eIdx === -1 || sColIdx === -1 || eColIdx === -1) return;
    
    const rStart = Math.min(sIdx, eIdx), rEnd = Math.max(sIdx, eIdx);
    const cStart = Math.min(sColIdx, eColIdx), cEnd = Math.max(sColIdx, eColIdx);
    
    const rows: string[] = [];
    for (let r = rStart; r <= rEnd; r++) {
      const st = filteredStudents[r];
      if (!st) continue;
      const session = st.todaySession || {};
      const rowData: string[] = [];
      for (let c = cStart; c <= cEnd; c++) {
        const col = activeColumns[c];
        let val = '';
        if (col.id === 'name') val = st.name;
        else if (col.id === 'date') val = selectedDate;
        else if (col.id === 'review') val = st.lastSession?.homework_text || '';
        else if (col.id === 'mission') val = session.mission || '';
        else if (col.id === 'management_notes') val = session.management_notes || '';
        else if (col.id === 'next_quiz') {
          val = session.next_quiz_text || '';
          if (!val && session.homework_to) {
            try {
              const raw = session.homework_to;
              if (typeof raw === 'string' && raw.startsWith('{')) {
                val = JSON.parse(raw).text || '';
              } else if (typeof raw === 'string') {
                val = raw;
              }
            } catch (e) {}
          }
        }
        else val = session[mapColumnToProp(col.id)] || '';
        
        const sVal = String(val || '');
        rowData.push((sVal.includes('\n') || sVal.includes('\t') || sVal.includes('"')) ? `"${sVal.replace(/"/g, '""')}"` : sVal);
      }
      rows.push(rowData.join('\t'));
    }
    const finalData = rows.join('\n');
    if (e.clipboardData) e.clipboardData.setData('text/plain', finalData);
    if (navigator.clipboard) navigator.clipboard.writeText(finalData).catch(() => {});
  }, [selectedRange, activeCell, filteredStudents, activeColumns, selectedDate]);

  // 2. 붙여넣기 핸들러
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    // 💡 사용자가 입력창 내부에서 글자를 직접 편집 중인 경우(커서 깜박임)에는 브라우저 네이티브 붙여넣기에 완전히 맡김
    const target = e.target as HTMLElement;
    const isInputTarget = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
    if (editingCell || (isInputTarget && document.activeElement === target && (target as HTMLInputElement | HTMLTextAreaElement).selectionStart !== null)) {
      return;
    }

    if (!activeCell) return;
    const clipboardData = e.clipboardData?.getData('text/plain');
    if (!clipboardData) return;

    try {
      const dataMatrix = parseClipboardText(clipboardData);
      if (dataMatrix.length === 0) return;

      e.preventDefault();

      const updates: any[] = [];
      const pastedColIds = new Set<string>(); // 💡 실제 붙여넣기된 컬럼 ID 수집
      const startColIdx = activeColumns.findIndex(col => col.id === activeCell.columnId);

      // 💡 [안전 장치 추가] 1x1 단일 셀 일괄 붙여넣기는 오직 클릭(선택)한 셀의 학생이 좌측 체크박스 그룹(selectedIds)에 포함되어 있을 때만 실행되도록 보호합니다.
      // 이외의 경우(다른 행들이 체크되어 있더라도 이 셀만 단독 복사/붙여넣기 하려는 경우 등)에는 단일 셀 개별 붙여넣기(else 분기)로 안전하게 통제됩니다.
      if (dataMatrix.length === 1 && dataMatrix[0].length === 1 && selectedIds.length > 1 && selectedIds.includes(activeCell.studentId)) {
        const val = dataMatrix[0][0];
        const colId = activeColumns[startColIdx]?.id;
        if (colId && !['select', 'name', 'action'].includes(colId)) {
          const prop = mapColumnToProp(colId);
          pastedColIds.add(colId); // 💡 대상 컬럼 추가

          // 🔒 [추가] 붙여넣기 대상 범위 내 승인 대기 보호 셀이 있는지 검사
          let hasLockedCell = false;
          selectedIds.forEach(id => {
            const st = filteredStudents.find(s => s.id === id);
            if (st) {
              const isSubmitted = ['pending', 'submitted'].includes(st.todaySession?.approval_status || '');
              const isProtectedCol = ['completed_classwork', 'assign'].includes(colId);
              if (isSubmitted && isProtectedCol) hasLockedCell = true;
            }
          });

          if (hasLockedCell) {
            alert("학생이 제출한 내용이 있습니다. 승인을 한 후 수정이 가능합니다.");
            return;
          }

          selectedIds.forEach(id => {
            const st = filteredStudents.find(s => s.id === id);
            if (st) {
              updates.push({ studentId: id, newData: { [prop]: val }, prevData: { ...(st.todaySession || {}) } });
            }
          });
        }
      } else {
        const startStudentIdx = filteredStudents.findIndex(s => s.id === activeCell.studentId);
        if (startStudentIdx === -1 || startColIdx === -1) return;

        // 🔒 [추가] 붙여넣기 대상 범위 내 승인 대기 보호 셀이 있는지 검사
        let hasLockedCell = false;
        dataMatrix.forEach((rowValues, rowOffset) => {
          const targetRow = startStudentIdx + rowOffset;
          const currentStudent = filteredStudents[targetRow];
          if (!currentStudent) return;

          rowValues.forEach((value, colOffset) => {
            const colId = activeColumns[startColIdx + colOffset]?.id;
            if (!colId || ['select', 'name', 'action', 'date', 'attendance'].includes(colId)) return;
            const isSubmitted = ['pending', 'submitted'].includes(currentStudent.todaySession?.approval_status || '');
            const isProtectedCol = ['completed_classwork', 'assign'].includes(colId);
            if (isSubmitted && isProtectedCol) hasLockedCell = true;
          });
        });

        if (hasLockedCell) {
          alert("학생이 제출한 내용이 있습니다. 승인을 한 후 수정이 가능합니다.");
          return;
        }

        dataMatrix.forEach((rowValues, rowOffset) => {
          const targetRow = startStudentIdx + rowOffset;
          const currentStudent = filteredStudents[targetRow];
          if (!currentStudent) return;

          const session = currentStudent.todaySession || {};
          const upds: any = {};
          let changed = false;
          
          rowValues.forEach((value, colOffset) => {
            const colId = activeColumns[startColIdx + colOffset]?.id;
            if (!colId || ['select', 'name', 'action', 'date', 'attendance'].includes(colId)) return;
            
            pastedColIds.add(colId); // 💡 실제 처리 중인 컬럼 추가
            const prop = mapColumnToProp(colId);
            if (String(session[prop] || '') !== value) { upds[prop] = value; changed = true; }
          });
          if (changed) {
            const rowMovedHour = session.moved_to_hour !== undefined && session.moved_to_hour !== null ? session.moved_to_hour : ((currentStudent as any).moved_to_hour !== undefined && (currentStudent as any).moved_to_hour !== null ? (currentStudent as any).moved_to_hour : null);
            const rowCourseName = currentStudent.courseName || session.course_name || '정규';
            if (rowMovedHour !== null) upds['moved_to_hour'] = rowMovedHour;
            if (rowCourseName) upds['course_name'] = rowCourseName;
            updates.push({ studentId: currentStudent.id, newData: upds, prevData: { ...session } });
          }
        });
      }

      if (updates.length > 0) {
        if (typeof window !== 'undefined') {
          (window as any).__ams_batch_saving = true;
        }
        setStudents((prev: any[]) => prev.map(s => {
          const update = updates.find(u => matchRowIdentity(s, u.studentId));
          return update ? { ...s, todaySession: { ...(s.todaySession || {}), ...update.newData } } : s;
        }));

        syncTodaySheetDom(updates, Array.from(pastedColIds));
        setEditingCell(null);
        handleBatchSave(updates).finally(() => {
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              (window as any).__ams_batch_saving = false;
            }
          }, 150);
        });
      }
    } catch (err) { console.error('Paste error:', err); }
  }, [activeCell, editingCell, activeColumns, selectedIds, filteredStudents, handleBatchSave, setStudents, setEditingCell]);

  // 3. 잘라내기 핸들러 (선택 범위 복사 → 셀 비우기)
  const handleCut = useCallback((e: ClipboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName);
    const hasSelection = isInput
      ? (target as HTMLInputElement | HTMLTextAreaElement).selectionStart !== (target as HTMLInputElement | HTMLTextAreaElement).selectionEnd
      : !!(window.getSelection()?.toString().length);

    if (hasSelection || !selectedRange) return;

    e.preventDefault();

    const sIdx = filteredStudents.findIndex(s => s.id === selectedRange.startStudentId);
    const eIdx = filteredStudents.findIndex(s => s.id === selectedRange.endStudentId);
    const sColIdx = activeColumns.findIndex(c => c.id === selectedRange.startColId);
    const eColIdx = activeColumns.findIndex(c => c.id === selectedRange.endColId);

    if (sIdx === -1 || eIdx === -1 || sColIdx === -1 || eColIdx === -1) return;

    const rStart = Math.min(sIdx, eIdx), rEnd = Math.max(sIdx, eIdx);
    const cStart = Math.min(sColIdx, eColIdx), cEnd = Math.max(sColIdx, eColIdx);

    // 1) 클립보드에 복사
    const rows: string[] = [];
    for (let r = rStart; r <= rEnd; r++) {
      const st = filteredStudents[r];
      if (!st) continue;
      const session = st.todaySession || {};
      const rowData: string[] = [];
      for (let c = cStart; c <= cEnd; c++) {
        const col = activeColumns[c];
        let val = '';
        if (col.id === 'name') val = st.name;
        else if (col.id === 'date') val = '';
        else if (col.id === 'review') val = st.lastSession?.homework_text || '';
        else if (col.id === 'mission') val = session.mission || '';
        else val = session[mapColumnToProp(col.id)] || '';
        const sVal = String(val || '');
        rowData.push((sVal.includes('\n') || sVal.includes('\t') || sVal.includes('"')) ? `"${sVal.replace(/"/g, '""')}"` : sVal);
      }
      rows.push(rowData.join('\t'));
    }
    const finalData = rows.join('\n');
    if (e.clipboardData) e.clipboardData.setData('text/plain', finalData);
    else navigator.clipboard.writeText(finalData);

    // 2) 선택 범위 셀 비우기 (읽기전용 컬럼 제외)
    const targetColIds: string[] = [];
    for (let c = cStart; c <= cEnd; c++) {
      const colId = activeColumns[c].id;
      if (COLUMN_TO_FIELD_MAP[colId]) targetColIds.push(colId);
    }
    if (targetColIds.length === 0) return;

    // 🔒 [추가] 잘라내기 대상 범위 내 승인 대기 보호 셀이 있는지 검사
    let hasLockedCell = false;
    for (let r = rStart; r <= rEnd; r++) {
      const st = filteredStudents[r];
      if (!st) continue;
      for (let c = cStart; c <= cEnd; c++) {
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
    for (let r = rStart; r <= rEnd; r++) {
      const st = filteredStudents[r];
      if (!st) continue;
      const sess = st.todaySession || {};
      const newData: any = {};
      targetColIds.forEach(colId => {
        const prop = mapColumnToProp(colId);
        newData[prop] = '';
      });
      updates.push({ studentId: st.id, newData, prevData: { ...sess } });
    }

    if (updates.length > 0) {
      if (typeof window !== 'undefined') {
        (window as any).__ams_batch_saving = true;
      }
      setStudents((prev: any[]) => prev.map(s => {
        const update = updates.find(u => matchRowIdentity(s, u.studentId));
        return update ? { ...s, todaySession: { ...(s.todaySession || {}), ...update.newData } } : s;
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
  }, [selectedRange, filteredStudents, activeColumns, setStudents, handleBatchSave]);

  return { handleCopy, handlePaste, handleCut };
}
