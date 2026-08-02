'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, TrendingUp, ClipboardList, Loader2, Check, ArrowLeft, X, ArrowRight
} from 'lucide-react';
import { TextbookOption } from '@/types/dashboard';
import { parseBookCourseValue } from '@/lib/utils';

interface TextbookSystemProps {
  student: any;
  availableTextbooks: TextbookOption[];
  allLogs: any[];
  localCompletedClasswork: string;
  setLocalCompletedClasswork: (v: string) => void;
  localHomework: string;
  setLocalHomework: (v: string) => void;
  todayPlan: string;
  handleManualSave: (field: 'classwork' | 'completed_classwork' | 'homework' | 'special_notes', value: string) => Promise<void>;
  isSaving: boolean;
  onBookSelect?: (isActive: boolean) => void;
  approvalStatus?: 'none' | 'submitted' | 'approved';
  selectedDate: string;
  selectedCourse?: string;
  onUpdateAssignedBooks?: (newBooks: string[]) => Promise<void>;
  academy?: any;
  initialBookCode?: string;
}

export default function TextbookSystem({
  student,
  availableTextbooks,
  allLogs,
  localCompletedClasswork,
  setLocalCompletedClasswork,
  localHomework,
  setLocalHomework,
  todayPlan,
  handleManualSave,
  isSaving,
  onBookSelect,
  approvalStatus = 'none',
  selectedDate,
  selectedCourse = '정규',
  onUpdateAssignedBooks,
  academy,
  initialBookCode
}: TextbookSystemProps) {
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

  // 💡 모바일 스와이프 제스처를 위한 상태
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // 💡 장수 계산 팝업 애니메이션을 위한 상태
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ sheets: 0, pages: 0 });

  // 💡 미배정 교재 리스트 필터링
  const unassignedBooks = useMemo(() => {
    const assigned = student?.assigned_books || [];
    return (availableTextbooks || []).filter(b => !assigned.includes(b.bookcode) && b.status !== '비활성');
  }, [availableTextbooks, student?.assigned_books]);

  // 💡 학원 설정의 대분류 목록 가져오기 (없으면 기본값)
  const bookCategories = useMemo(() => {
    const customCats = academy?.operation_settings?.textbook_categories;
    if (Array.isArray(customCats) && customCats.length > 0) {
      return ['전체', ...customCats];
    }
    return ['전체', '초5', '초6', '중1', '중2', '중3', '공수1', '공수2', '대수', '미적분1', '미적분2', '확통', '기하'];
  }, [academy]);

  // 💡 선택된 대분류 칩 필터에 맞게 필터링된 미배정 교재 리스트
  const filteredUnassignedBooks = useMemo(() => {
    if (!selectedCategory || selectedCategory === '전체') return unassignedBooks;
    const query = selectedCategory.toLowerCase();
    return unassignedBooks.filter(b => 
      b.title.toLowerCase().includes(query) || 
      (b.grade || '').toLowerCase().includes(query)
    );
  }, [unassignedBooks, selectedCategory]);

  // 💡 initialBookCode가 설정되어 들어오면 즉시 단원 목록 가져오기
  useEffect(() => {
    if (initialBookCode) {
      const foundBook = (availableTextbooks || []).find(b => b.bookcode === initialBookCode) || { bookcode: initialBookCode, title: initialBookCode };
      setActiveBook(foundBook);
      fetchUnits(initialBookCode);
    }
  }, [initialBookCode, availableTextbooks]);

  // 💡 activeBook 상태가 null이 될 때 부모 컴포넌트에 닫힘 상태 전송
  useEffect(() => {
    if (activeBook === null && onBookSelect) {
      onBookSelect(false);
    }
  }, [activeBook, onBookSelect]);

  useEffect(() => {
    if (selectedPages.length > 1 && (activeUnit || isMergedViewActive)) {
      setToastMessage({
        sheets: selectedPages.length / 2,
        pages: selectedPages.length
      });
      setShowToast(true);
      
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 1500); // 1.5초 후 자연스럽게 사라짐

      return () => clearTimeout(timer);
    } else {
      // 💡 상세페이지를 나가거나 선택이 풀렸을 때 애니메이션 강제 종료
      setShowToast(false);
    }
  }, [selectedPages, activeUnit, isMergedViewActive]); 

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEndAction = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && selectedUnits.length > 0 && !isMergedViewActive && !activeUnit) {
      // 화면을 왼쪽으로 쓱 밀면 상세(쪽수) 페이지로 진입!
      setIsMergedViewActive(true);
      setSelectedPages([]);
    } else if (isRightSwipe && (isMergedViewActive || activeUnit)) {
      // 상세 화면에서 오른쪽으로 쓱 밀면 뒤로가기(단원목록)!
      setIsMergedViewActive(false);
      setActiveUnit(null);
      setSelectedPages([]);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const teacherToken = localStorage.getItem('ams_user');
      if (teacherToken) setIsTeacher(true);
    }
  }, []);

  // 💡 데이터 추출 및 병합 로직 (각 페이지별 상태: classwork, wrong, homework)
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

    // 💡 방금 추가한 텍스트 값 즉시 반영 (낙관적 업데이트)
    processText(localCompletedClasswork, 'classwork');
    processText(localHomework, 'homework');

    return map;
  }, [activeBook, allLogs, localCompletedClasswork, localHomework]);

  const mergedPageRange = useMemo(() => {
    if (selectedUnits.length === 0) return null;
    const sorted = [...selectedUnits].sort((a, b) => parseInt(a.start_page) - parseInt(b.start_page));
    const start = parseInt(sorted[0].start_page);
    const end = parseInt(sorted[sorted.length - 1].end_page);
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return { start, end, pages };
  }, [selectedUnits]);

  // 💡 단축키 로직 통합
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedUnits([]); setLastClickedUnitIdx(null); setSelectedPages([]);
        if (isMergedViewActive || activeUnit) { setIsMergedViewActive(false); setActiveUnit(null); }
        else if (activeBook) { setActiveBook(null); }
        return;
      }
      if (e.ctrlKey && e.key === '[') {
        e.preventDefault();
        if (activeUnit || isMergedViewActive) { 
          setActiveUnit(null); setIsMergedViewActive(false); 
          setSelectedUnits([]); setLastClickedUnitIdx(null); setSelectedPages([]); 
        } 
        else if (activeBook) { setActiveBook(null); }
      }
      if (e.ctrlKey && e.key === ']') {
        e.preventDefault();
        if (activeBook && !activeUnit && !isMergedViewActive && selectedUnits.length > 0) { setIsMergedViewActive(true); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBook, activeUnit, isMergedViewActive, selectedUnits]);

  const fetchUnits = async (bookCode: string) => {
    setIsLoadingUnits(true);
    try {
      const res = await fetch(`/api/textbooks/${bookCode}`);
      if (res.ok) { setUnits(await res.json() || []); }
    } catch (e) { console.error(e); } finally { setIsLoadingUnits(false); }
  };

  const handleUnitToggle = (e: React.MouseEvent, u: any, idx: number) => {
    e.stopPropagation();
    
    // 1. Shift 범위 선택
    if (e.shiftKey && lastClickedUnitIdx !== null && selectedUnits.length > 0) {
      const start = Math.min(lastClickedUnitIdx, idx);
      const end = Math.max(lastClickedUnitIdx, idx);
      const rangeUnits = units.slice(start, end + 1);
      setSelectedUnits(prev => {
        const next = [...prev];
        rangeUnits.forEach(ru => { if (!next.some(s => s.unit === ru.unit)) next.push(ru); });
        return next;
      });
    } else {
      const isSelected = selectedUnits.some(selected => selected.unit === u.unit);
      if (isSelected) {
        // 이미 선택된 단원을 다시 누르면 선택 취소
        setSelectedUnits(prev => prev.filter(selected => selected.unit !== u.unit));
      } else {
        // 처음 누르면 선택 추가
        setSelectedUnits(prev => [...prev, u]);
      }
    }
    setLastClickedUnitIdx(idx);
  };

  // 💡 개별 선택 취소 로직
  const handleUnitUnselect = (e: React.MouseEvent, unitName: string) => {
    e.stopPropagation();
    setSelectedUnits(prev => {
      const next = prev.filter(s => s.unit !== unitName);
      if (next.length === 0) setLastClickedUnitIdx(null);
      return next;
    });
  };

  const handlePageClick = (p: number) => {
    if (selectionRange.start === null) { 
      setSelectionRange({ start: p, end: null }); setSelectedPages([p]); 
    } else {
      const start = selectionRange.start; const end = p;
      const min = Math.min(start, end); const max = Math.max(start, end);
      const newRange: number[] = []; for (let i = min; i <= max; i++) newRange.push(i);
      setSelectedPages(prev => Array.from(new Set([...prev, ...newRange])).sort((a, b) => a - b));
      setSelectionRange({ start: null, end: null });
    }
  };

  const handleRecordLearning = async (type: 'classwork' | 'homework' | 'wrong' | 'cancel', customPages?: number[]) => {
    const pagesToUse = customPages || selectedPages;
    if (pagesToUse.length === 0 || !activeBook || !student) return;
    const ranges: string[] = []; let start = pagesToUse[0];
    for (let i = 1; i <= pagesToUse.length; i++) { 
      if (pagesToUse[i] !== pagesToUse[i - 1] + 1) { 
        const end = pagesToUse[i - 1]; 
        ranges.push(start === end ? `p${start}` : `p${start}~${end}`); 
        start = pagesToUse[i]; 
      } 
    }
    const rangeText = ranges.join(', ');
    const displayTitle = activeBook.title;
    const targetUnits = units.filter(u => { 
      const uStart = parseInt(u.start_page); const uEnd = parseInt(u.end_page); 
      return pagesToUse.some(p => p >= uStart && p <= uEnd); 
    }).sort((a, b) => parseInt(a.start_page) - parseInt(b.start_page));
    
    let unitText = "";
    if (targetUnits.length > 1) {
      const first = targetUnits[0].unit; const last = targetUnits[targetUnits.length - 1].unit;
      const firstNum = first.match(/\d+/)?.[0]; const lastNum = last.match(/\d+/)?.[0]; const suffix = first.replace(/\d+/g, '').trim(); 
      if (firstNum && lastNum && suffix && last.includes(suffix)) unitText = `${firstNum}~${lastNum}${suffix}`; else unitText = `${first}~${last}`;
    } else if (targetUnits.length === 1) unitText = targetUnits[0].unit; else unitText = activeUnit?.unit || '';

    if (type === 'cancel') {
      const isMatch = (line: string) => line.includes(displayTitle) && (!unitText || line.includes(unitText));
      
      const newHomework = localHomework.split('\n').filter(line => !isMatch(line)).join('\n');
      if (newHomework !== localHomework) {
        setLocalHomework(newHomework);
        await handleManualSave('homework', newHomework);
      }
      
      const newClasswork = localCompletedClasswork.split('\n').filter(line => !isMatch(line)).join('\n');
      if (newClasswork !== localCompletedClasswork) {
        setLocalCompletedClasswork(newClasswork);
        await handleManualSave('completed_classwork', newClasswork);
      }
      
      setSelectedPages([]);
      return;
    }

    const fullText = `${type === 'wrong' ? '[오답] ' : ''}${displayTitle} ${unitText ? `${unitText} ` : ''}${rangeText}`;
    const targetField = type === 'homework' ? 'homework' : 'completed_classwork';
    const currentText = targetField === 'homework' ? localHomework : localCompletedClasswork;
    const trimmedCurrent = currentText ? currentText.trim() : "";
    const newText = trimmedCurrent ? `${trimmedCurrent}\n${fullText}` : fullText;
    
    if (targetField === 'homework') setLocalHomework(newText); else setLocalCompletedClasswork(newText);
    await handleManualSave(targetField, newText); 
    setSelectedPages([]);
    setSelectedUnits([]); 
    setLastClickedUnitIdx(null); 
    setIsMergedViewActive(false); 
    setActiveUnit(null); 
    setActiveBook(null);
  };

  const handleQuickAddUnits = async (type: 'classwork' | 'homework' | 'wrong' | 'cancel') => {
    if (selectedUnits.length === 0) return;
    const allPages: number[] = [];
    selectedUnits.forEach(u => { 
      const s = parseInt(u.start_page); const e = parseInt(u.end_page); 
      for (let i = s; i <= e; i++) allPages.push(i); 
    });
    const uniquePages = Array.from(new Set(allPages)).sort((a, b) => a - b);
    await handleRecordLearning(type, uniquePages);
    setSelectedUnits([]); setLastClickedUnitIdx(null); setIsMergedViewActive(false); setActiveUnit(null);
  };

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* 상단 교재 선택 바 */}
      <div className="relative bg-white/[0.03] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto py-3 px-4 scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {(student.assigned_books || []).filter((code: string) => {
          const rawVal = student.book_courses?.[code] || '';
          const { isKeep, targetTag } = parseBookCourseValue(rawVal);
          if (isKeep) return false;
          
          if (selectedCourse === '정규') {
            // 정규수업 모드: targetTag가 '정규'이거나 '공통'인 교재만 노출
            return !targetTag || targetTag === '정규' || targetTag === '공통';
          } else {
            // 선택과목 모드: targetTag가 해당 선택과목명이거나(예: '선택:방학특강' or '방학특강') '공통'인 교재 노출
            if (!targetTag || targetTag === '공통') return true;
            const cleanTag = targetTag.replace(/^선택:\s*/, '').trim();
            const cleanCourse = selectedCourse.replace(/^선택:\s*/, '').trim();
            return cleanTag === cleanCourse || targetTag.includes(cleanCourse);
          }
        }).map((code: string) => {
          const book = availableTextbooks.find(b => b.bookcode === code); if (!book) return null;
          const isActive = activeBook?.bookcode === code;
          return (
            <motion.button 
              key={code} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} 
              onClick={() => { 
                if (activeBook?.bookcode === code) { 
                  setActiveBook(null); setActiveUnit(null); setSelectedUnits([]); setLastClickedUnitIdx(null); setIsMergedViewActive(false);
                } else { 
                  setActiveBook(book); fetchUnits(code); setActiveUnit(null); setSelectedUnits([]); setLastClickedUnitIdx(null); setIsMergedViewActive(false);
                } 
              }} 
              className={`flex items-center gap-2 border rounded-[4px] px-3 py-1.5 transition-all shrink-0 ${isActive ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-white/10 border-white/20 text-white hover:border-emerald-500/50 hover:bg-emerald-500/10'}`}
            >
              <BookOpen size={12} className={isActive ? 'text-white' : 'text-emerald-500'} />
              <span className="text-[11px] font-black whitespace-nowrap">{book.title}</span>
            </motion.button>
          );
        })}

        {/* ➕ 교재 추가 버튼 */}
        {onUpdateAssignedBooks && (
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} 
            onClick={() => { setShowAddBookModal(true); setSelectedCategory('전체'); }} 
            className="flex items-center gap-1.5 border border-dashed rounded-[4px] px-3 py-1.5 transition-all shrink-0 bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400/40 text-[11px] font-black"
          >
            + 교재 추가
          </motion.button>
        )}
        </div>{/* inner scroll div */}
      </div>{/* outer relative div */}


      <div className="relative flex-1 overflow-hidden">
        {/* 텍스트 영역 2단 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-white/5 bg-black/20">
          <div className="p-4 md:p-6 space-y-3 flex flex-col">
            <div className="flex items-center gap-2 px-1"><TrendingUp className="text-emerald-500" size={18} /><span className="text-[14px] md:text-[16px] font-black text-emerald-500 tracking-tight">학원에서 한 공부</span></div>
            <textarea value={localCompletedClasswork || ''} onChange={(e) => setLocalCompletedClasswork(e.target.value)} onBlur={() => handleManualSave('completed_classwork', localCompletedClasswork)} readOnly={approvalStatus !== 'none'} placeholder="오늘 학원에서 공부한 내용을 적어주세요." rows={Math.max(1, (localCompletedClasswork || '').split('\n').length)} className={`w-full bg-transparent border-0 outline-none text-sm text-white font-bold leading-relaxed resize-none scrollbar-hide placeholder:text-white/10 ${approvalStatus !== 'none' ? 'opacity-50 cursor-not-allowed' : ''}`} />
            <div className="flex justify-between items-center pt-2 border-t border-white/[0.03] mt-auto"><span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Auto-sync Active</span>{isSaving && <Loader2 size={10} className="animate-spin text-emerald-500" />}</div>
          </div>
          <div className="p-4 md:p-6 space-y-3 flex flex-col">
            <div className="flex items-center gap-2 px-1"><ClipboardList className="text-blue-500" size={18} /><span className="text-[14px] md:text-[16px] font-black text-blue-500 tracking-tight">집에서 할 공부 (숙제)</span></div>
            <textarea value={localHomework} onChange={(e) => setLocalHomework(e.target.value)} onBlur={() => handleManualSave('homework', localHomework)} readOnly={approvalStatus !== 'none'} placeholder="다음 수업까지 집에서 해올 숙제를 적어주세요." rows={Math.max(1, localHomework.split('\n').length)} className={`w-full bg-transparent border-0 outline-none text-sm text-white font-bold leading-relaxed resize-none scrollbar-hide placeholder:text-white/10 ${approvalStatus !== 'none' ? 'opacity-50 cursor-not-allowed' : ''}`} />
            <div className="flex justify-between items-center pt-2 border-t border-white/[0.03] mt-auto"><span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Real-time Cloud Sync</span>{isSaving && <Loader2 size={10} className="animate-spin text-blue-500" />}</div>
          </div>
        </div>



        {/* 오버레이: 단원 및 페이지 선택 */}
        <AnimatePresence>
          {activeBook && (
            <>
              {/* 💡 뒷배경을 그대로 보면서 실시간 입력을 확인하도록 투명하게 처리된 오버레이 */}
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => { setActiveBook(null); setSelectedUnits([]); setLastClickedUnitIdx(null); }}
                className="fixed inset-0 z-50 bg-transparent"
              />
              
              {/* 💡 우측 전체화면에서 튀어나오는 슬라이드 드로어 */}
              <motion.div 
                initial={{ x: '100%' }} 
                animate={{ x: 0 }} 
                exit={{ x: '100%' }} 
                transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
                className="fixed top-0 right-0 bottom-0 z-[60] w-full sm:w-[500px] md:w-[600px] bg-[#0a0a0a] border-l border-emerald-500/20 shadow-[-20px_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
                onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndAction}
              >
              {/* 💡 장수 계산 팝업 애니메이션 (스크롤과 독립적으로 최상단 고정) */}
              <AnimatePresence mode="wait">
                {showToast && (
                  <motion.div
                    key={toastMessage.pages}
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.2, filter: 'blur(10px)' }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="absolute top-[25%] left-0 right-0 pointer-events-none flex flex-col items-center justify-center z-[100]"
                  >
                    <div className="bg-black/80 backdrop-blur-xl px-12 py-8 rounded-[2.5rem] border border-white/10 shadow-[0_20px_60px_rgba(16,185,129,0.2)] flex flex-col items-center justify-center transform -translate-y-1/2">
                      <p className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-300 to-blue-500 tracking-tighter drop-shadow-2xl">
                        {toastMessage.sheets}장
                      </p>
                      <p className="text-[14px] font-bold text-white/50 mt-3 tracking-widest uppercase bg-white/5 px-4 py-1 rounded-full">
                        총 {toastMessage.pages}쪽
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-3 md:p-4 space-y-3 flex-1 flex flex-col overflow-hidden">
                {!activeUnit && !isMergedViewActive ? (
                  <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
                    <div className="flex flex-col gap-2 px-1 shrink-0">
                      <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          {selectedUnits.length > 0 ? (
                            <span className="text-[12px] font-black text-blue-400">옵션을 선택해주세요 👇</span>
                          ) : (
                            <span className="text-[12px] font-black text-blue-400">▶ 단원을 선택해주세요</span>
                          )}
                        </div>
                      </div>
                      
                      {/* 💡 한 행에 정렬된 큼직한 3개 기능 버튼 (쪽수고르기, 숙제취소, 닫기) */}
                      <div className="flex gap-2 w-full pt-1">
                        <button 
                          onClick={() => { setIsMergedViewActive(true); setSelectedPages([]); }} 
                          disabled={selectedUnits.length === 0}
                          className="flex-1 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400 hover:text-white disabled:opacity-30 disabled:grayscale border border-emerald-500/20 text-[13px] md:text-[14px] font-black rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md shrink-0"
                        >
                          <BookOpen size={15} /> 쪽수고르기
                        </button>
                        <button 
                          onClick={() => handleQuickAddUnits('cancel')} 
                          disabled={selectedUnits.length === 0 || approvalStatus !== 'none'} 
                          className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-white disabled:opacity-20 disabled:grayscale text-[13px] md:text-[14px] font-black rounded-lg border border-red-500/20 transition-all flex items-center justify-center gap-1.5 shadow-md shrink-0"
                        >
                          <X size={15} /> 숙제 취소
                        </button>
                        <button 
                          onClick={() => { setActiveBook(null); setSelectedUnits([]); setLastClickedUnitIdx(null); }} 
                          className="flex-1 py-2.5 bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 hover:text-white border border-blue-500/20 hover:border-blue-400/40 transition-colors rounded-lg flex items-center justify-center gap-1.5 shadow-md text-[13px] md:text-[14px] font-black shrink-0"
                        >
                          <X size={15} /> 닫기
                        </button>
                      </div>

                      {/* 💡 학원에서 공부 / 오답고치기 / 집에서 할 숙제 기본 버튼 (높이 상향) */}
                      <div className="flex flex-col gap-2 pb-2">
                        <div className="flex gap-2">
                          <button onClick={() => handleQuickAddUnits('classwork')} disabled={selectedUnits.length === 0 || approvalStatus !== 'none'} className="flex-1 py-3 bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-20 disabled:grayscale text-white text-[14px] md:text-[15px] font-black rounded-lg transition-all shadow-lg border border-emerald-500/20">학원에서 공부</button>
                          <button onClick={() => handleQuickAddUnits('wrong')} disabled={selectedUnits.length === 0 || approvalStatus !== 'none'} className="flex-1 py-3 bg-amber-600/90 hover:bg-amber-500 disabled:opacity-20 disabled:grayscale text-white text-[14px] md:text-[15px] font-black rounded-lg transition-all shadow-lg border border-amber-500/20">오답고치기</button>
                          <button onClick={() => handleQuickAddUnits('homework')} disabled={selectedUnits.length === 0 || approvalStatus !== 'none'} className="flex-1 py-3 bg-blue-600/90 hover:bg-blue-500 disabled:opacity-20 disabled:grayscale text-white text-[14px] md:text-[15px] font-black rounded-lg transition-all shadow-lg border border-blue-500/20">집에서 할 숙제</button>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-24 flex-1 overflow-y-auto custom-scrollbar-v pr-1">
                      {units.map((u, i) => {
                        const isSelected = selectedUnits.some(s => s.unit === u.unit);
                        const unitStart = parseInt(u.start_page);
                        const unitEnd = parseInt(u.end_page);
                        const sparkline = [];
                        for (let p = unitStart; p <= unitEnd; p++) {
                          const status = pageStatusMap.get(p);
                          sparkline.push(
                            <div 
                              key={p} 
                              className={`h-full flex-1 ${
                                status === 'wrong' ? 'bg-amber-500' :
                                status === 'homework' ? 'bg-blue-500' :
                                status === 'classwork' ? 'bg-emerald-500' :
                                'bg-transparent'
                              }`} 
                            />
                          );
                        }

                        return (
                          <button 
                            key={i} 
                            onClick={(e) => approvalStatus === 'none' && handleUnitToggle(e, u, i)}
                            className={`w-full flex items-center justify-between px-4 py-3.5 bg-white/[0.05] border-2 rounded-lg transition-all transform active:scale-[0.98] group relative overflow-hidden shrink-0 min-h-[56px] ${
                              isSelected 
                                ? 'bg-blue-600/30 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.15)]' 
                                : 'border-white/10 hover:border-emerald-500/50'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                              {isSelected && (
                                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg animate-in zoom-in">
                                  <Check size={12} strokeWidth={4} />
                                </div>
                              )}
                              <div className="text-left flex-1 min-w-0">
                                <span className={`text-[14px] font-black block truncate ${isSelected ? 'text-white' : 'text-white/90'}`}>{u.unit}</span>
                                <div className="mt-1.5 flex w-[85%] h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
                                  {sparkline}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[13px] md:text-[14px] font-black tabular-nums px-2 py-0.5 rounded transition-colors ${
                                isSelected ? 'bg-blue-500 text-white' : 'bg-emerald-500/10 text-emerald-400'
                              }`}>p{u.start_page}~{u.end_page}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 flex-1 flex flex-col overflow-hidden relative">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 border-b border-white/5 shrink-0 -mx-2 px-2">
                      {units.map((u, i) => {
                        const isActive = activeUnit?.unit === u.unit; const isSelected = selectedUnits.some(s => s.unit === u.unit);
                        return (<button key={i} onClick={(e) => approvalStatus === 'none' && handleUnitToggle(e, u, i)} className={`relative px-4 py-2 rounded-[4px] text-[11px] font-black whitespace-nowrap transition-all border ${isActive || isSelected ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/20' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'}`}>{u.unit}{selectedPages.some(p => p >= parseInt(u.start_page) && p <= parseInt(u.end_page)) && !isActive && !isSelected && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.8)]" />}</button>);
                      })}
                    </div>
                    <div className="flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setActiveUnit(null); setIsMergedViewActive(false); setSelectedUnits([]); setLastClickedUnitIdx(null); setSelectedPages([]); }} className="p-1.5 bg-white/10 rounded-full text-white hover:bg-emerald-500 transition-all shadow-lg border border-white/10"><ArrowLeft size={14}/></button>
                        <div className="text-left"><h3 className="text-[15px] font-black text-white">{selectedUnits.length > 1 ? (() => { const sorted = [...selectedUnits].sort((a,b) => parseInt(a.start_page) - parseInt(b.start_page)); return `${sorted[0].unit.match(/\d+/)?.[0]}~${sorted[sorted.length-1].unit.match(/\d+/)?.[0]}${sorted[0].unit.replace(/\d+/g, '').trim()}`; })() : (activeUnit?.unit || selectedUnits[0]?.unit)}</h3><p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{activeBook.title}</p></div>
                      </div>
                      <button onClick={() => setSelectedPages([])} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-[11px] font-black rounded uppercase border border-white/10">Clear All</button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar-v py-1">
                      <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                        {(() => {
                          const range = mergedPageRange || (activeUnit ? { start: parseInt(activeUnit.start_page), end: parseInt(activeUnit.end_page), pages: [] } : null); if (!range) return null;
                          const pagesToRender = range.pages.length > 0 ? range.pages : (() => { const p = []; for (let i = range.start; i <= range.end; i++) p.push(i); return p; })();
                          return pagesToRender.map(p => {
                            const isSel = selectedPages.includes(p); const solStatus = pageStatusMap.get(p);
                            const isSol = !!solStatus;
                            const solColor = solStatus === 'wrong' ? 'text-amber-500 bg-amber-500/20 border-amber-500/40' : solStatus === 'homework' ? 'text-blue-500 bg-blue-500/20 border-blue-500/40' : 'text-emerald-500 bg-emerald-500/20 border-emerald-500/40';
                            return (<button key={p} onClick={() => approvalStatus === 'none' && handlePageClick(p)} className={`aspect-square rounded-md flex items-center justify-center text-[12px] font-black tabular-nums transition-all border relative ${isSel ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)] scale-105' : isSol ? solColor : 'bg-white/10 border-white/20 text-white hover:bg-emerald-500/30'}`}>{p}{isSol && !isSel && <div className="absolute top-0.5 right-0.5 opacity-50"><Check size={7} strokeWidth={4} /></div>}</button>);
                          });
                        })()}
                      </div>
                    </div>
                    <div className="pt-4 border-t border-white/10 flex flex-col gap-3 mt-auto shrink-0">
                      <div className="p-3 bg-white/10 rounded-md border border-white/10">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 block">Selected Pages</span>
                        <p className="text-[15px] font-black text-white truncate">{selectedPages.length > 0 ? (() => { const ranges: string[] = []; let s = selectedPages[0]; for (let i = 1; i <= selectedPages.length; i++) { if (selectedPages[i] !== selectedPages[i - 1] + 1) { const e = selectedPages[i - 1]; ranges.push(s === e ? `${s}` : `${s}~${e}`); s = selectedPages[i]; } } return `p${ranges.join(', p')}`; })() : '페이지를 선택하세요'}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button onClick={() => handleRecordLearning('classwork')} disabled={(selectedPages.length === 0 && selectedUnits.length === 0) || isSaving || approvalStatus !== 'none'} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:grayscale text-white font-black rounded-md transition-all text-[10px] uppercase shadow-lg shadow-emerald-900/20">+ 처음풀기</button>
                          <button onClick={() => handleRecordLearning('wrong')} disabled={(selectedPages.length === 0 && selectedUnits.length === 0) || isSaving || approvalStatus !== 'none'} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:grayscale text-white font-black rounded-md transition-all text-[10px] uppercase shadow-lg shadow-amber-900/20">+ 오답고치기</button>
                          <button onClick={() => handleRecordLearning('homework')} disabled={(selectedPages.length === 0 && selectedUnits.length === 0) || isSaving || approvalStatus !== 'none'} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:grayscale text-white font-black rounded-md transition-all text-[10px] uppercase shadow-lg shadow-blue-900/20">+ 숙제추가</button>
                        </div>
                        <div className="flex justify-end">
                          <button onClick={() => handleRecordLearning('cancel')} disabled={(selectedPages.length === 0 && selectedUnits.length === 0) || isSaving || approvalStatus !== 'none'} className="py-1 px-4 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:grayscale text-[10px] font-black rounded border border-red-500/20 transition-colors">기록 지우기 (취소)</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </div>

      {/* 💡 교재 추가 모달 */}
      <AnimatePresence>
        {showAddBookModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 배경 블러 어둡게 */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddBookModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            {/* 모달 박스 */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#0f0f0f] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[80vh]"
            >
              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-[14px] md:text-[16px] font-black text-emerald-400">📚 추가할 교재 선택</h3>
                <button 
                  onClick={() => setShowAddBookModal(false)} 
                  className="p-1.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* 🏷️ 가로 스크롤 대분류 칩 */}
              <div className="px-4 py-2.5 bg-white/[0.01] border-b border-white/5 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {bookCategories.map((cat) => {
                    const isActive = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-[4px] text-[11px] font-black whitespace-nowrap transition-all border shrink-0 ${
                          isActive
                            ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 리스트 본문 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar-v text-left">
                {filteredUnassignedBooks.length === 0 ? (
                  <div className="text-center py-8 text-white/40 text-[12px] font-bold">
                    {selectedCategory !== '전체' ? '분류 결과와 일치하는 교재가 없습니다.' : '추가할 수 있는 교재가 없습니다.'}
                  </div>
                ) : (
                  filteredUnassignedBooks.map((book) => (
                    <button
                      key={book.bookcode}
                      onClick={async () => {
                        const nextBooks = [...(student.assigned_books || []), book.bookcode];
                        if (onUpdateAssignedBooks) {
                          await onUpdateAssignedBooks(nextBooks);
                        }
                        setShowAddBookModal(false);
                      }}
                      className="w-full flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-xl hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                        <div>
                          <span className="text-[13px] md:text-[14px] font-black text-white block">{book.title}</span>
                          <span className="text-[10px] text-white/40 font-bold block mt-0.5">{book.grade || '공통'}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                        즉시 추가
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
