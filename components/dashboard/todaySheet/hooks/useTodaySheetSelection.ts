'use client';

import { useState, useCallback } from 'react';

interface UseTodaySheetSelectionParams {
  filteredStudents: any[];
  onRemoveFromToday?: (studentId: string, reason?: string, mode?: 'delete' | 'cancel') => void;
}

export function useTodaySheetSelection({
  filteredStudents,
  onRemoveFromToday
}: UseTodaySheetSelectionParams) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [selectCycleMode, setSelectCycleMode] = useState<'none' | 'all' | 'elective' | 'regular'>('none');

  // 💡 단일 체크박스 선택/해제 (Shift 키 누르고 선택 시 연속 선택 지원)
  const handleSelectOne = useCallback((id: string, checked: boolean, shiftKey: boolean = false) => {
    const currentIdx = filteredStudents.findIndex((s: any) => s.id === id);

    if (shiftKey && lastSelectedIdx !== null && currentIdx !== -1) {
      const start = Math.min(lastSelectedIdx, currentIdx);
      const end = Math.max(lastSelectedIdx, currentIdx);
      const rangeIds = filteredStudents.slice(start, end + 1).map((s: any) => s.id);

      setSelectedIds(prev => {
        const set = new Set(prev);
        rangeIds.forEach(rId => {
          if (checked) set.add(rId);
          else set.delete(rId);
        });
        return Array.from(set);
      });
    } else {
      setSelectedIds(prev => {
        if (checked) {
          return prev.includes(id) ? prev : [...prev, id];
        } else {
          return prev.filter(item => item !== id);
        }
      });
    }

    setLastSelectedIdx(currentIdx !== -1 ? currentIdx : null);
  }, [filteredStudents, lastSelectedIdx]);

  // 💡 [순환형 토글] 전체 ➔ 선택과목만 ➔ 정규만 ➔ 전체 해제 (4단계 순환)
  const handleCycleSelectAll = useCallback(() => {
    if (filteredStudents.length === 0) return;

    if (selectCycleMode === 'none') {
      // 1단계: 전체 선택
      const allIds = filteredStudents.map((s: any) => s.id);
      setSelectedIds(allIds);
      setSelectCycleMode('all');
    } else if (selectCycleMode === 'all') {
      // 2단계: 선택과목(특강)만 선택
      const electiveIds = filteredStudents
        .filter((s: any) => s.isSpecialClass || String(s.id).includes('_special_'))
        .map((s: any) => s.id);
      setSelectedIds(electiveIds);
      setSelectCycleMode('elective');
    } else if (selectCycleMode === 'elective') {
      // 3단계: 정규 수업만 선택
      const regularIds = filteredStudents
        .filter((s: any) => !s.isSpecialClass && !String(s.id).includes('_special_'))
        .map((s: any) => s.id);
      setSelectedIds(regularIds);
      setSelectCycleMode('regular');
    } else {
      // 4단계: 전체 해제
      setSelectedIds([]);
      setSelectCycleMode('none');
    }
  }, [filteredStudents, selectCycleMode]);

  // 💡 기존 호환용 전체 선택/해제
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const allIds = filteredStudents.map((s: any) => s.id);
      setSelectedIds(allIds);
      setSelectCycleMode('all');
    } else {
      setSelectedIds([]);
      setSelectCycleMode('none');
    }
  }, [filteredStudents]);

  // 💡 선택한 학생 오늘 시트에서 숨기기/제외 일괄 처리
  const handleRemoveSelectedStudents = useCallback(() => {
    if (selectedIds.length === 0 || !onRemoveFromToday) return;

    selectedIds.forEach(id => {
      onRemoveFromToday(id, '숨김', 'cancel');
    });

    setSelectedIds([]);
    setLastSelectedIdx(null);
  }, [selectedIds, onRemoveFromToday]);

  const isAllSelected = filteredStudents.length > 0 && selectedIds.length >= filteredStudents.length;

  return {
    selectedIds,
    setSelectedIds,
    handleSelectOne,
    handleSelectAll,
    handleCycleSelectAll,
    selectCycleMode,
    handleRemoveSelectedStudents,
    isAllSelected
  };
}
