'use client';

import { useCallback } from 'react';
import { parseClipboardText } from '@/lib/clipboardParser';
import { mapColumnToProp, mapFieldToColumn, mapColumnToField } from '@/lib/sessionFieldMap';
import { syncTodaySheetDom } from '@/lib/todaySheetDomSync';

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
    let hasSelection = isInput 
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
        else if (col.id === 'mission') val = st.recent_mission || '';
        else val = session[mapColumnToField(col.id)] || '';
        
        const sVal = String(val || '');
        rowData.push((sVal.includes('\n') || sVal.includes('\t') || sVal.includes('"')) ? `"${sVal.replace(/"/g, '""')}"` : sVal);
      }
      rows.push(rowData.join('\t'));
    }
    const finalData = rows.join('\n');
    console.log('copy finalData', finalData);
    if (e.clipboardData) e.clipboardData.setData('text/plain', finalData);
    else navigator.clipboard.writeText(finalData);
  }, [selectedRange, filteredStudents, activeColumns, selectedDate]);

  // 2. 붙여넣기 핸들러
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!activeCell) return;
    const clipboardData = e.clipboardData?.getData('text/plain');
    if (!clipboardData) return;

    try {
      const dataMatrix = parseClipboardText(clipboardData);
      if (dataMatrix.length === 0) return;

      if (editingCell) setEditingCell(null);
      e.preventDefault();

      const updates: any[] = [];
      const pastedColIds = new Set<string>(); // 💡 실제 붙여넣기된 컬럼 ID 수집
      const startColIdx = activeColumns.findIndex(col => col.id === activeCell.columnId);

      if (dataMatrix.length === 1 && dataMatrix[0].length === 1 && selectedIds.length > 1) {
        const val = dataMatrix[0][0];
        const colId = activeColumns[startColIdx]?.id;
        if (colId && !['select', 'name', 'action'].includes(colId)) {
          const prop = mapColumnToProp(colId);
          pastedColIds.add(colId); // 💡 대상 컬럼 추가
          selectedIds.forEach(id => {
            const st = filteredStudents.find(s => s.id === id);
            if (st) updates.push({ studentId: id, newData: { [prop]: val }, prevData: { ...(st.todaySession || {}) } });
          });
        }
      } else {
        const startStudentIdx = filteredStudents.findIndex(s => s.id === activeCell.studentId);
        if (startStudentIdx === -1 || startColIdx === -1) return;

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
          if (changed) updates.push({ studentId: currentStudent.id, newData: upds, prevData: { ...session } });
        });
      }

      if (updates.length > 0) {
        setStudents((prev: any[]) => prev.map(s => {
          const update = updates.find(u => u.studentId === s.id);
          return update ? { ...s, todaySession: { ...(s.todaySession || {}), ...update.newData } } : s;
        }));

        syncTodaySheetDom(updates, Array.from(pastedColIds));
        setEditingCell(null);
        await handleBatchSave(updates);
      }
    } catch (err) { console.error('Paste error:', err); }
  }, [activeCell, editingCell, activeColumns, selectedIds, filteredStudents, handleBatchSave, setStudents, setEditingCell]);

  return { handleCopy, handlePaste };
}
