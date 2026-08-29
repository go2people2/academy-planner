import { useState, useEffect, useRef, useCallback } from 'react';
import { HomeworkItem, TextbookOption } from '@/types/dashboard';
import { supabase } from '@/lib/supabase';
import { openMediaPdf, AcademyInfoMediaParam } from '@/lib/mediaUrl';
import { parseBookCourseValue } from '@/lib/utils';

/**
 * 💡 [교재 병합] 기존 저장된 항목(입력 내용 포함)을 우선 보존하고,
 * 학생에게 배정된 교재(assigned_books) 중 누락된 교재를 빈 항목으로 자동 병합
 * (정규/특강/선택과목 및 -keep/-done 필터 규칙 완벽 보존)
 */
const mergeBooksForEditor = (existingJson: HomeworkItem[] | undefined, student: any): HomeworkItem[] => {
  const current = existingJson || [];
  const merged = [...current];
  if (!student) return merged;

  const assigned: string[] = student.assigned_books || [];
  const currentRowTargetTag = student.isSpecialClass
    ? `선택:${student.courseName || student.electiveCourse?.subject || ''}`
    : '정규';

  assigned.forEach(bookName => {
    const courseVal = String(student.book_courses?.[bookName] || '');
    if (courseVal.includes('-keep') || courseVal.includes('-done')) return;

    const { targetTag } = parseBookCourseValue(courseVal);

    const isMatch = (targetTag === '공통') ||
                    (!student.isSpecialClass && (targetTag === '정규' || !targetTag.startsWith('선택:'))) ||
                    (student.isSpecialClass && (targetTag === currentRowTargetTag));

    if (isMatch && !current.some(b => b.book_name === bookName)) {
      merged.push({ type: 'book', book_name: bookName, range: '', units: [] });
    }
  });

  return merged;
};

/**
 * 💡 [교재 정렬] masterTextbooks에서 정식 제목을 우선 조회하여 가나다/알파벳순으로 정렬
 * 1순위: masterTextbooks.find(...)?.title
 * 2순위: item.title
 * 3순위: item.book_name
 */
const getBookTitle = (item: HomeworkItem, masterList: TextbookOption[] = []): string => {
  const name = item.book_name || '';
  const textbook = masterList.find(m => m.bookcode === name) ||
                  masterList.find(m => m.bookcode.toLowerCase().startsWith(name.toLowerCase())) ||
                  masterList.find(m => name.toLowerCase().startsWith(m.bookcode.toLowerCase()));
  return (textbook?.title || (item as any).title || name || '').trim();
};

const sortHomeworkItems = (list: HomeworkItem[], masterList: TextbookOption[] = []): HomeworkItem[] => {
  return [...(list || [])].sort((a, b) => {
    const titleA = getBookTitle(a, masterList);
    const titleB = getBookTitle(b, masterList);
    const cmp = titleA.localeCompare(titleB, 'ko', { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return (a.book_name || '').localeCompare(b.book_name || '', 'ko', { numeric: true, sensitivity: 'base' });
  });
};

export function useHomeworkEditorState({
  student,
  homeworkJson,
  onClose,
  academyInfo,
  masterTextbooks = [],
}: {
  student?: any;
  homeworkJson: HomeworkItem[];
  onClose: (finalJson?: HomeworkItem[]) => void;
  academyInfo?: AcademyInfoMediaParam;
  masterTextbooks?: TextbookOption[];
}) {
  const [mounted, setMounted] = useState(false);
  const [unitDataMap, setUnitDataMap] = useState<Record<string, any[]>>({});
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [activeEditorItem, setActiveEditorItem] = useState<{ itemId: string; bookName: string } | null>(null);

  // 💡 [모달 표시용 목록] 저장된 기록 + 학생 배정 교재를 병합한 뒤 가나다/알파벳순으로 정렬
  const [items, setItems] = useState<HomeworkItem[]>(() => {
    const merged = mergeBooksForEditor(homeworkJson, student);
    const withIds = merged.map((item, idx) => ({
      ...item,
      id: item.id || `hw-${idx}-${item.book_name}-${Math.random().toString(36).substring(2, 7)}`
    }));
    return sortHomeworkItems(withIds, masterTextbooks);
  });
  const itemsRef = useRef<HomeworkItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // 💡 [+ 범위 추가] 현재 선택된 교재 그룹의 마지막 항목 바로 뒤에 새 빈 범위 행 삽입
  const addNewRange = useCallback(() => {
    if (!activeEditorItem || !activeEditorItem.bookName) {
      alert('먼저 범위를 추가할 교재 행의 시작/끝 페이지 칸을 선택해 주세요.');
      return;
    }

    const targetBookName = activeEditorItem.bookName;
    const currentList = itemsRef.current;
    
    // 같은 book_name을 가진 항목 중 마지막 항목의 인덱스 찾기
    let lastIndex = -1;
    for (let i = currentList.length - 1; i >= 0; i--) {
      if (currentList[i].book_name === targetBookName) {
        lastIndex = i;
        break;
      }
    }

    if (lastIndex === -1) {
      alert('먼저 범위를 추가할 교재 행의 시작/끝 페이지 칸을 선택해 주세요.');
      return;
    }

    const newId = `hw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: HomeworkItem = {
      id: newId,
      type: 'book',
      book_name: targetBookName,
      range: '',
      units: [],
      start_page: '',
      end_page: '',
      note: '',
    };

    const next = [...currentList];
    const insertIndex = lastIndex + 1;
    next.splice(insertIndex, 0, newItem);
    setItems(next);
    setActiveEditorItem({ itemId: newId, bookName: targetBookName });

    // 새 행의 시작 페이지 인풋으로 자동 포커스
    setTimeout(() => {
      startRefs.current[insertIndex]?.focus();
      startRefs.current[insertIndex]?.select();
    }, 50);
  }, [activeEditorItem]);

  const startRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const endRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const fetchAllUnits = useCallback(async () => {
    setIsLoadingUnits(true);
    try {
      const res = await fetch('/api/textbooks/unit-page');
      if (res.ok) {
        const allUnits = await res.json();
        const mapped: Record<string, any[]> = {};
        allUnits.forEach((u: any) => {
          const code = u.bookcode; 
          if (!mapped[code]) mapped[code] = [];
          mapped[code].push(u);
        });
        setUnitDataMap(mapped);
      }
    } catch (e) {
      console.error('Failed to fetch unit-page:', e);
    } finally {
      setIsLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchAllUnits();

    const handleModalKeyDown = (e: KeyboardEvent) => {
      const isAltNumber = e.altKey && !isNaN(parseInt(e.key));
      const isEscape = e.key === 'Escape';
      const isCtrlEnter = e.key === 'Enter' && (e.ctrlKey || e.metaKey);

      if (isAltNumber || isEscape || isCtrlEnter) {
        e.stopPropagation();
        if (isAltNumber) {
          const idx = parseInt(e.key) - 1;
          if (startRefs.current[idx]) {
            e.preventDefault();
            startRefs.current[idx]?.focus();
            startRefs.current[idx]?.select();
          }
        } else if (isEscape) {
          e.preventDefault();
          onClose(itemsRef.current);
        } else if (isCtrlEnter) {
          e.preventDefault();
          onClose(itemsRef.current);
        }
        return;
      }

      if (e.key.startsWith('Arrow') || e.key === 'Tab' || e.key === 'Enter') {
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [onClose, fetchAllUnits]);

  const commitPageChange = useCallback((idx: number, start: string, end: string, note?: string) => {
    const newHw = [...itemsRef.current];
    const item = { ...newHw[idx] };
    const units = unitDataMap[item.book_name] || [];

    item.start_page = start;
    item.end_page = end;
    if (note !== undefined) {
      item.note = note;
    }

    const sNum = parseInt(start.replace(/\D/g, ''));
    const eNum = parseInt(end.replace(/\D/g, ''));

    const isStartValid = !isNaN(sNum);
    const isEndValid = !isNaN(eNum);

    const activeNote = item.note ? ` ${item.note}` : '';

    if (isStartValid || isEndValid) {
      const searchStart = isStartValid ? sNum : eNum;
      const searchEnd = isEndValid ? eNum : sNum;

      const matchedUnits = units.filter(u => {
        const uStart = parseInt(String(u.start_page).replace(/\D/g, ''));
        const uEnd = parseInt(String(u.end_page).replace(/\D/g, ''));
        return (uStart <= searchEnd && uEnd >= searchStart);
      });

      const uniqueUnitNames = Array.from(new Set(matchedUnits.map(u => u.unit)));
      const unitText = uniqueUnitNames.join(', ');
      
      let rangeText = "";
      if (isStartValid && isEndValid) {
        rangeText = (sNum === eNum) ? `p${sNum}` : `p${sNum}~${eNum}`;
      } else if (isStartValid) {
        rangeText = `p${sNum}`;
      } else {
        rangeText = `p${eNum}`;
      }

      item.range = unitText ? `${unitText} ${rangeText}${activeNote}` : `${rangeText}${activeNote}`;
      item.units = uniqueUnitNames;
    } else {
      const startText = start ? (isNaN(Number(start)) ? start : `p${start}`) : '';
      const endText = end ? `~${end}` : '';
      item.range = `${startText}${endText}${activeNote}`;
      item.units = [];
    }

    newHw[idx] = item;
    setItems(newHw);
  }, [unitDataMap]);

  const navigateInput = useCallback((idx: number, type: 'start' | 'end', key: string) => {
    if (key === 'ArrowRight' && type === 'start') {
      endRefs.current[idx]?.focus();
      endRefs.current[idx]?.select();
    } else if (key === 'ArrowLeft' && type === 'end') {
      startRefs.current[idx]?.focus();
      startRefs.current[idx]?.select();
    } else if (key === 'ArrowDown') {
      const targetIdx = idx + 1;
      if (type === 'start' && startRefs.current[targetIdx]) { startRefs.current[targetIdx]?.focus(); startRefs.current[targetIdx]?.select(); }
      else if (type === 'end' && endRefs.current[targetIdx]) { endRefs.current[targetIdx]?.focus(); endRefs.current[targetIdx]?.select(); }
    } else if (key === 'ArrowUp') {
      const targetIdx = idx - 1;
      if (type === 'start' && startRefs.current[targetIdx]) { startRefs.current[targetIdx]?.focus(); startRefs.current[targetIdx]?.select(); }
      else if (type === 'end' && endRefs.current[targetIdx]) { endRefs.current[targetIdx]?.focus(); endRefs.current[targetIdx]?.select(); }
    }
  }, []);

  return {
    mounted,
    unitDataMap,
    isLoadingUnits,
    items,
    setItems,
    itemsRef,
    startRefs,
    endRefs,
    commitPageChange,
    navigateInput,
    activeEditorItem,
    setActiveEditorItem,
    addNewRange,
  };
}
