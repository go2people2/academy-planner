import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Student } from '@/types/dashboard';

export const isValidHistoryLog = (l: any) => {
  if (!l) return false;
  const hasStatus = l.status && l.status !== 'none';
  const hasAttendance = l.attendance_status && l.attendance_status !== '출석전' && l.attendance_status !== 'BEFORE';
  const hasContent = (l.classwork_text || '').trim() || 
                     (l.completed_classwork_text || '').trim() || 
                     (l.homework_text || '').trim() || 
                     (l.special_notes || '').trim() || 
                     (l.mission || '').trim();
  const hasTest = l.test_completed || (l.test_score !== undefined && l.test_score !== null && l.test_score !== '');
  
  return hasStatus || hasAttendance || hasContent || hasTest;
};

export function useTodaySheetHistory({
  student,
  selectedDate,
  limit = 3,
  masterTextbooks,
  onSave,
  onUpdateStudentInfo,
}: {
  student: Student;
  selectedDate: string;
  limit?: number;
  masterTextbooks?: any[];
  onSave?: (id: string, data: any) => Promise<boolean>;
  onUpdateStudentInfo?: (id: string, field: string, value: any) => Promise<void>;
}) {
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [showBookSearch, setShowBookSearch] = useState(false);
  const [selectedBookForDrawer, setSelectedBookForDrawer] = useState<string | null>(null);
  const [bookUnits, setBookUnits] = useState<any[]>([]);
  const [selectedDrawerUnits, setSelectedDrawerUnits] = useState<any[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [pinTargetBook, setPinTargetBook] = useState<string | null>(null);
  const [startPageInput, setStartPageInput] = useState('');
  const [endPageInput, setEndPageInput] = useState('');
  const [matchedUnitPreview, setMatchedUnitPreview] = useState<string>('');

  const ccwBookBuf = useRef(student.todaySession?.completed_classwork_text || '');
  const hwBookBuf = useRef(student.todaySession?.homework_text || '');

  const incomingCcw = student.todaySession?.completed_classwork_text || '';
  const incomingHw = student.todaySession?.homework_text || '';

  useEffect(() => {
    if (incomingCcw && !ccwBookBuf.current.includes(incomingCcw)) {
      ccwBookBuf.current = incomingCcw;
    }
  }, [incomingCcw]);

  useEffect(() => {
    if (incomingHw && !hwBookBuf.current.includes(incomingHw)) {
      hwBookBuf.current = incomingHw;
    }
  }, [incomingHw]);

  const checkLiveUnitMatch = useCallback(async (bookCode: string, pageStr: string, _dummy = '') => {
    if (!pageStr) {
      setMatchedUnitPreview('');
      return;
    }
    const pageNum = parseInt(pageStr, 10);
    const targetMaster = masterTextbooks?.find((m: any) => m.title === bookCode || m.bookcode === bookCode);
    const realCode = targetMaster?.bookcode || bookCode;

    try {
      const res = await fetch(`/api/textbooks/${realCode}`);
      if (res.ok) {
        const units = await res.json();
        const found = (units || []).find((u: any) => {
          const uStart = parseInt(u.start_page ?? u.sPage ?? u.startPage ?? '0', 10);
          const uEnd = parseInt(u.end_page ?? u.ePage ?? u.endPage ?? '9999', 10);
          return pageNum >= uStart && pageNum <= uEnd;
        });

        if (found) {
          const uName = found.unit || found.unitName || found.title;
          setMatchedUnitPreview(`${uName} (p.${pageStr})`);
        } else {
          setMatchedUnitPreview(`해당 페이지(p.${pageStr})의 단원을 찾을 수 없습니다`);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [masterTextbooks]);

  const currentRowCourseName = useMemo(() => {
    return student.isSpecialClass 
      ? (student.courseName || student.electiveCourse?.subject || '').trim() 
      : '정규';
  }, [student]);

  const pastLogs = useMemo(() => {
    return (student.allLogs || [])
      .filter((l: any) => {
        if (!l.date || l.date >= selectedDate || !isValidHistoryLog(l)) return false;
        const logCourse = (l.course_name || '정규').trim();
        
        if (student.isSpecialClass) {
          return logCourse === currentRowCourseName || (currentRowCourseName && logCourse.includes(currentRowCourseName));
        } else {
          return logCourse === '정규' || !logCourse;
        }
      })
      .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
  }, [student, selectedDate, currentRowCourseName]);

  const history = useMemo(() => pastLogs.slice(0, limit), [pastLogs, limit]);

  const translateBook = useCallback((bookName: string) => {
    if (!bookName) return '';
    if (!masterTextbooks || masterTextbooks.length === 0) return bookName;
    const trimmed = bookName.trim();
    const foundMaster = masterTextbooks.find(m => m.bookcode === trimmed || m.title === trimmed);
    if (foundMaster && foundMaster.title) {
      return foundMaster.title;
    }
    let result = trimmed;
    const sortedMaster = [...masterTextbooks].sort((a, b) => (b.bookcode?.length || 0) - (a.bookcode?.length || 0));
    sortedMaster.forEach(m => {
      if (m.bookcode && m.title) {
        const escapedCode = m.bookcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedCode, 'gi');
        result = result.replace(regex, m.title);
      }
    });
    return result;
  }, [masterTextbooks]);

  const fetchBookUnits = useCallback(async (bookCode: string) => {
    setIsLoadingUnits(true);
    const targetMaster = masterTextbooks?.find((m: any) => m.title === bookCode || m.bookcode === bookCode);
    const realCode = targetMaster?.bookcode || bookCode;
    try {
      const res = await fetch(`/api/textbooks/${realCode}`);
      if (res.ok) {
        const data = await res.json();
        setBookUnits(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch units:', e);
    } finally {
      setIsLoadingUnits(false);
    }
  }, [masterTextbooks]);

  const handleQuickAddDrawerUnits = useCallback(async (type: 'classwork' | 'homework' | 'wrong') => {
    if ((!onSave && !onUpdateStudentInfo) || selectedDrawerUnits.length === 0 || !selectedBookForDrawer) return;
    const title = translateBook(selectedBookForDrawer);
    const unitTexts = selectedDrawerUnits.map(u => {
      const pageStr = u.start_page && u.end_page ? `p.${u.start_page}~${u.end_page}` : u.start_page ? `p.${u.start_page}` : '';
      return `${u.unit || u.unitName || u.title}${pageStr ? ` (${pageStr})` : ''}`;
    }).join(', ');

    const prefix = type === 'wrong' ? '[오답고치기] ' : '';
    const textToAdd = `[${title}] ${prefix}${unitTexts}`;

    const targetKey = type === 'homework' ? 'homework_text' : 'completed_classwork_text';
    const currentText = (student.todaySession as any)?.[targetKey] || (student as any)?.[targetKey] || '';
    const newText = currentText ? `${currentText}\n${textToAdd}` : textToAdd;

    if (onSave) {
      await onSave(student.id, { [targetKey]: newText });
    } else if (onUpdateStudentInfo) {
      await onUpdateStudentInfo(student.id, targetKey, newText);
    }
    setSelectedBookForDrawer(null);
    setSelectedDrawerUnits([]);
  }, [onSave, onUpdateStudentInfo, selectedDrawerUnits, selectedBookForDrawer, student, translateBook]);

  return {
    showAddBookModal,
    setShowAddBookModal,
    selectedCategory,
    setSelectedCategory,
    bookSearchQuery,
    setBookSearchQuery,
    showBookSearch,
    setShowBookSearch,
    selectedBookForDrawer,
    setSelectedBookForDrawer,
    bookUnits,
    setBookUnits,
    selectedDrawerUnits,
    setSelectedDrawerUnits,
    isLoadingUnits,
    setIsLoadingUnits,
    pinTargetBook,
    setPinTargetBook,
    startPageInput,
    setStartPageInput,
    endPageInput,
    setEndPageInput,
    matchedUnitPreview,
    setMatchedUnitPreview,
    ccwBookBuf,
    hwBookBuf,
    checkLiveUnitMatch,
    currentRowCourseName,
    pastLogs,
    history,
    translateBook,
    fetchBookUnits,
    handleQuickAddDrawerUnits,
  };
}
