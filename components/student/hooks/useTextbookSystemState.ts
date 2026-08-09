import { useState, useMemo, useEffect, useCallback } from 'react';
import { TextbookOption } from '@/types/dashboard';

export function useTextbookSystemState({
  student,
  availableTextbooks,
  allLogs,
  localCompletedClasswork,
  localHomework,
  selectedDate,
  academy,
  initialBookCode,
}: {
  student: any;
  availableTextbooks: TextbookOption[];
  allLogs: any[];
  localCompletedClasswork: string;
  localHomework: string;
  selectedDate: string;
  academy?: any;
  initialBookCode?: string;
}) {
  const [activeBook, setActiveBook] = useState<any>(() => {
    if (initialBookCode) {
      return (availableTextbooks || []).find(b => b.bookcode === initialBookCode) || { bookcode: initialBookCode, title: initialBookCode };
    }
    return null;
  });
  const [activeUnit, setActiveUnit] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<any[]>([]);
  const [isMergedViewActive, setIsMergedViewActive] = useState(false);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [selectionRange, setSelectionRange] = useState<{ start: number | null, end: number | null }>({ start: null, end: null });
  const [lastClickedUnitIdx, setLastClickedUnitIdx] = useState<number | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ sheets: 0, pages: 0 });

  const [localAssigned, setLocalAssigned] = useState<string[]>(() => student?.assigned_books || []);
  useEffect(() => {
    if (student?.assigned_books) {
      setLocalAssigned(prev => {
        const merged = Array.from(new Set([...(student.assigned_books || []), ...prev]));
        return merged;
      });
    }
  }, [student?.assigned_books]);

  const unassignedBooks = useMemo(() => {
    return (availableTextbooks || []).filter(b => !localAssigned.includes(b.bookcode) && b.status !== '비활성');
  }, [availableTextbooks, localAssigned]);

  const bookCategories = useMemo(() => {
    const customCats = academy?.operation_settings?.textbook_categories;
    if (Array.isArray(customCats) && customCats.length > 0) {
      return ['전체', ...customCats];
    }
    return ['전체', '초5', '초6', '중1', '중2', '중3', '공수1', '공수2', '대수', '미적분1', '미적분2', '확통', '기하'];
  }, [academy]);

  const filteredUnassignedBooks = useMemo(() => {
    if (!selectedCategory || selectedCategory === '전체') return unassignedBooks;
    const query = selectedCategory.toLowerCase();
    return unassignedBooks.filter(b => 
      b.title.toLowerCase().includes(query) || 
      (b.grade || '').toLowerCase().includes(query)
    );
  }, [unassignedBooks, selectedCategory]);

  const fetchUnits = useCallback(async (bookCode: string) => {
    setIsLoadingUnits(true);
    try {
      const res = await fetch(`/api/textbooks/${bookCode}`);
      if (res.ok) {
        const data = await res.json();
        setUnits(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    if (initialBookCode) {
      const foundBook = (availableTextbooks || []).find(b => b.bookcode === initialBookCode) || { bookcode: initialBookCode, title: initialBookCode };
      setActiveBook(foundBook);
      fetchUnits(initialBookCode);
    }
  }, [initialBookCode, availableTextbooks, fetchUnits]);

  useEffect(() => {
    if (selectedPages.length > 1 && (activeUnit || isMergedViewActive)) {
      setToastMessage({
        sheets: selectedPages.length / 2,
        pages: selectedPages.length
      });
      setShowToast(true);
      
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 1500);

      return () => clearTimeout(timer);
    } else {
      setShowToast(false);
    }
  }, [selectedPages, activeUnit, isMergedViewActive]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const teacherToken = localStorage.getItem('ams_user');
      if (teacherToken) setIsTeacher(true);
    }
  }, []);

  const pageStatusMap = useMemo(() => {
    if (!activeBook) return new Map<number, 'classwork' | 'wrong' | 'homework'>();
    const map = new Map<number, 'classwork' | 'wrong' | 'homework'>();
    
    const setStatus = (start: number, end: number, status: 'classwork' | 'wrong' | 'homework') => {
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        const current = map.get(i);
        if (status === 'wrong') map.set(i, 'wrong');
        else if (status === 'classwork' && current !== 'wrong') map.set(i, 'classwork');
        else if (status === 'homework' && !current) map.set(i, 'homework');
      }
    };

    const processJson = (arr: any[], type: 'classwork' | 'homework') => {
      arr.forEach(h => {
        if (h.book_name === activeBook.bookcode && h.range) {
          h.range.split(',').forEach((seg: string) => {
            const matches = seg.match(/p(\d+)\s*[~-]\s*p?(\d+)/i) || seg.match(/p(\d+)/i);
            if (matches) {
              const s = parseInt(matches[1]); const e = matches[2] ? parseInt(matches[2]) : s;
              if (!isNaN(s) && !isNaN(e)) setStatus(s, e, type);
            }
          });
        }
      });
    };

    const processText = (t: string | undefined | null, baseType: 'classwork' | 'homework') => {
      if (!t) return;
      const displayTitle = activeBook.title;
      const cleanTitle = displayTitle.replace(/\s+/g, '').toLowerCase();
      const cleanBookCode = activeBook.bookcode.replace(/\s+/g, '').toLowerCase();
      t.split('\n').forEach(line => {
        const cleanLine = line.replace(/\s+/g, '').toLowerCase();
        if (cleanLine.includes(cleanTitle) || cleanLine.includes(cleanBookCode)) {
          const isWrong = cleanLine.includes('[오답]');
          const isCancel = cleanLine.includes('[취소]');
          const status = baseType === 'classwork' ? (isWrong ? 'wrong' : 'classwork') : (isCancel ? 'cancel' : 'homework');
          const regex = /p(\d+)[~-]?p?(\d+)?/gi;
          let match;
          while ((match = regex.exec(cleanLine)) !== null) {
            const s = parseInt(match[1]); const e = match[2] ? parseInt(match[2]) : s;
            if (!isNaN(s) && !isNaN(e)) {
              for (let i = Math.min(s, e); i <= Math.max(s, e); i++) {
                const current = map.get(i);
                if (status === 'cancel') {
                  if (current === 'homework') map.delete(i);
                } else if (status === 'wrong') {
                  map.set(i, 'wrong');
                } else if (status === 'classwork' && current !== 'wrong') {
                  map.set(i, 'classwork');
                } else if (status === 'homework' && !current) {
                  map.set(i, 'homework');
                }
              }
            }
          }
        }
      });
    };

    if (allLogs) {
      allLogs.forEach(log => {
        if (log.session_date === selectedDate) return;
        processJson(log.classwork_json || [], 'classwork');
        processJson(log.homework_json || [], 'homework');
        processText(log.classwork_text, 'classwork');
        processText(log.completed_classwork_text, 'classwork');
        processText(log.homework_text, 'homework');
      });
    }

    processText(localCompletedClasswork, 'classwork');
    processText(localHomework, 'homework');

    return map;
  }, [activeBook, allLogs, selectedDate, localCompletedClasswork, localHomework]);

  return {
    activeBook,
    setActiveBook,
    activeUnit,
    setActiveUnit,
    units,
    setUnits,
    selectedUnits,
    setSelectedUnits,
    isMergedViewActive,
    setIsMergedViewActive,
    isLoadingUnits,
    setIsLoadingUnits,
    selectedPages,
    setSelectedPages,
    selectionRange,
    setSelectionRange,
    lastClickedUnitIdx,
    setLastClickedUnitIdx,
    isTeacher,
    showAddBookModal,
    setShowAddBookModal,
    selectedCategory,
    setSelectedCategory,
    touchStart,
    setTouchStart,
    touchEnd,
    setTouchEnd,
    showToast,
    toastMessage,
    localAssigned,
    setLocalAssigned,
    unassignedBooks,
    bookCategories,
    filteredUnassignedBooks,
    fetchUnits,
    pageStatusMap,
  };
}
