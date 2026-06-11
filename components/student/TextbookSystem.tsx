'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, TrendingUp, ClipboardList, Loader2, Check, ArrowLeft, X 
} from 'lucide-react';
import { TextbookOption } from '@/types/dashboard';

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
  isSaving
}: TextbookSystemProps) {
  const [activeBook, setActiveBook] = useState<any>(null);
  const [activeUnit, setActiveUnit] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<any[]>([]); 
  const [isMergedViewActive, setIsMergedViewActive] = useState(false); 
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [selectionRange, setSelectionRange] = useState<{ start: number | null, end: number | null }>({ start: null, end: null });
  const [lastClickedUnitIdx, setLastClickedUnitIdx] = useState<number | null>(null);

  // 💡 데이터 추출 및 병합 로직
  const solvedPages = useMemo(() => {
    if (!activeBook || !allLogs) return new Set<number>();
    const pages = new Set<number>();
    allLogs.forEach(log => {
      const classwork = log.classwork_json || [];
      const homework = log.homework_json || [];
      const allJson = [...classwork, ...homework];
      allJson.forEach((h: any) => {
        if (h.book_name === activeBook.bookcode && h.range) {
          const segments = h.range.split(',').map((s: string) => s.trim());
          segments.forEach((seg: string) => {
            const matches = seg.match(/p(\d+)\s*[~-]\s*p?(\d+)/i) || seg.match(/p(\d+)/i);
            if (matches) {
              const s = parseInt(matches[1]); const e = matches[2] ? parseInt(matches[2]) : s;
              if (!isNaN(s) && !isNaN(e)) { 
                for (let i = Math.min(s, e); i <= Math.max(s, e); i++) pages.add(i);
              }
            }
          });
        }
      });
    });
    return pages;
  }, [activeBook, allLogs]);

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
      // 💡 원장님 제안: 이미 선택된 단원을 누르면 상세 페이지로 진입
      if (isSelected) {
        setActiveUnit(u);
        setIsMergedViewActive(false);
      } 
      // 💡 처음 누르면 파란색으로 '담기' (강조)
      else {
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

  const handleRecordLearning = async (type: 'classwork' | 'homework' | 'wrong', customPages?: number[]) => {
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
    const displayTitle = activeBook.title.replace(/^\[.*?\]\s*/, '');
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

    const fullText = `${type === 'wrong' ? '[오답] ' : ''}${displayTitle} ${unitText ? `${unitText} ` : ''}${rangeText}`;
    const targetField = type === 'homework' ? 'homework' : 'classwork';
    const currentText = targetField === 'homework' ? localHomework : localCompletedClasswork;
    const newText = currentText ? `${currentText}\n${fullText}` : fullText;
    
    if (targetField === 'homework') setLocalHomework(newText); else setLocalCompletedClasswork(newText);
    await handleManualSave(targetField === 'classwork' ? 'completed_classwork' : 'homework', newText); 
    setSelectedPages([]);
  };

  const handleQuickAddUnits = async (type: 'classwork' | 'homework' | 'wrong') => {
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
      <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar py-3 px-6 bg-white/[0.03] border-b border-white/5 shrink-0">
        {(student.assigned_books || []).filter((code: string) => !String(student.book_courses?.[code]).endsWith('-keep')).map((code: string) => {
          const book = availableTextbooks.find(b => b.bookcode === code); if (!book) return null;
          const isActive = activeBook?.bookcode === code;
          return (
            <motion.button 
              key={code} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} 
              onClick={() => { 
                if (activeBook?.bookcode === code) { 
                  setActiveBook(null); setActiveUnit(null); setSelectedUnits([]); setLastClickedUnitIdx(null); 
                } else { 
                  setActiveBook(book); fetchUnits(code); setActiveUnit(null); setSelectedUnits([]); setLastClickedUnitIdx(null); 
                } 
              }} 
              className={`flex items-center gap-2 border rounded-[4px] px-3 py-1.5 transition-all shrink-0 ${isActive ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-white/10 border-white/20 text-white hover:border-emerald-500/50 hover:bg-emerald-500/10'}`}
            >
              <BookOpen size={12} className={isActive ? 'text-white' : 'text-emerald-500'} />
              <span className="text-[11px] font-black whitespace-nowrap">{book.title}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="relative flex-1 min-h-[260px] overflow-hidden">
        {/* 텍스트 영역 2단 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-white/5 bg-black/20">
          <div className="p-6 space-y-4 flex flex-col min-h-[300px]">
            <div className="flex items-center gap-2 px-1"><TrendingUp className="text-emerald-500" size={16} /><span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">수행진도 (Completed)</span></div>
            <textarea value={localCompletedClasswork || ''} onChange={(e) => setLocalCompletedClasswork(e.target.value)} onBlur={() => handleManualSave('completed_classwork', localCompletedClasswork)} placeholder="오늘 수행한 진도를 적어주세요." rows={Math.max(10, (localCompletedClasswork || '').split('\n').length)} className="w-full bg-transparent border-0 outline-none text-sm text-white font-bold leading-relaxed resize-none scrollbar-hide placeholder:text-white/10" />
            <div className="flex justify-between items-center pt-2 border-t border-white/[0.03] mt-auto"><span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Auto-sync Active</span>{isSaving && <Loader2 size={10} className="animate-spin text-emerald-500" />}</div>
          </div>
          <div className="p-6 space-y-4 flex flex-col min-h-[300px]">
            <div className="flex items-center gap-2 px-1"><ClipboardList className="text-blue-500" size={16} /><span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">부여된 숙제 (Homework)</span></div>
            <textarea value={localHomework} onChange={(e) => setLocalHomework(e.target.value)} onBlur={() => handleManualSave('homework', localHomework)} placeholder="다음 수업까지의 숙제를 적어주세요." rows={Math.max(10, localHomework.split('\n').length)} className="w-full bg-transparent border-0 outline-none text-sm text-white font-bold leading-relaxed resize-none scrollbar-hide placeholder:text-white/10" />
            <div className="flex justify-between items-center pt-2 border-t border-white/[0.03] mt-auto"><span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Real-time Cloud Sync</span>{isSaving && <Loader2 size={10} className="animate-spin text-blue-500" />}</div>
          </div>
        </div>

        {/* 오버레이: 단원 및 페이지 선택 */}
        <AnimatePresence>
          {activeBook && (
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="absolute inset-0 z-40 bg-[#0a0a0a] border-l border-emerald-500/20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
              <div className="p-6 space-y-6 flex-1 flex flex-col overflow-y-auto custom-scrollbar-v">
                {!activeUnit && !isMergedViewActive ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-3"><span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Select Unit</span></div>
                      <button onClick={() => { setActiveBook(null); setSelectedUnits([]); setLastClickedUnitIdx(null); }} className="text-[9px] font-black text-gray-400 hover:text-white uppercase px-2 py-1 bg-white/5 rounded">Close</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-24">
                      {units.map((u, i) => {
                        const isSelected = selectedUnits.some(s => s.unit === u.unit);
                        return (
                          <button 
                            key={i} 
                            onClick={(e) => handleUnitToggle(e, u, i)}
                            className={`w-full flex items-center justify-between p-4 bg-white/[0.05] border-2 rounded-lg transition-all transform active:scale-[0.98] group relative overflow-hidden ${
                              isSelected 
                                ? 'bg-blue-600/30 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.15)]' 
                                : 'border-white/10 hover:border-emerald-500/50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              {isSelected && (
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg animate-in zoom-in">
                                  <Check size={14} strokeWidth={4} />
                                </div>
                              )}
                              <div className="text-left">
                                <span className={`text-[15px] font-black block ${isSelected ? 'text-white' : 'text-white/90'}`}>{u.unit}</span>
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5 block">
                                  {isSelected ? "Click again to view detail" : `Start from p${u.start_page}`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`text-[11px] font-black tabular-nums px-2.5 py-1 rounded-md transition-colors ${
                                isSelected ? 'bg-blue-500 text-white' : 'bg-emerald-500/10 text-emerald-400'
                              }`}>p{u.start_page}~{u.end_page}</span>

                              {/* 💡 개별 선택 취소 버튼 (선택된 상태에서만 노출) */}
                              {isSelected && (
                                <div 
                                  onClick={(e) => handleUnitUnselect(e, u.unit)}
                                  className="w-5 h-5 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                >
                                  <X size={10} strokeWidth={4} />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 flex-1 flex flex-col">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 border-b border-white/5 shrink-0 -mx-2 px-2">
                      {units.map((u, i) => {
                        const isActive = activeUnit?.unit === u.unit; const isSelected = selectedUnits.some(s => s.unit === u.unit);
                        return (<button key={i} onClick={(e) => handleUnitToggle(e, u, i)} className={`relative px-4 py-2 rounded-[4px] text-[11px] font-black whitespace-nowrap transition-all border ${isActive || isSelected ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'}`}>{u.unit}{selectedPages.some(p => p >= parseInt(u.start_page) && p <= parseInt(u.end_page)) && !isActive && !isSelected && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.8)]" />}</button>);
                      })}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setActiveUnit(null); setIsMergedViewActive(false); setSelectedUnits([]); setLastClickedUnitIdx(null); setSelectedPages([]); }} className="p-1.5 bg-white/10 rounded-full text-white hover:bg-emerald-500 transition-all shadow-lg border border-white/10"><ArrowLeft size={14}/></button>
                        <div className="text-left"><h3 className="text-[15px] font-black text-white">{selectedUnits.length > 1 ? (() => { const sorted = [...selectedUnits].sort((a,b) => parseInt(a.start_page) - parseInt(b.start_page)); return `${sorted[0].unit.match(/\d+/)?.[0]}~${sorted[sorted.length-1].unit.match(/\d+/)?.[0]}${sorted[0].unit.replace(/\d+/g, '').trim()}`; })() : (activeUnit?.unit || selectedUnits[0]?.unit)}</h3><p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{activeBook.title}</p></div>
                      </div>
                      <button onClick={() => setSelectedPages([])} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-[11px] font-black rounded uppercase border border-white/10">Clear All</button>
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                      {(() => {
                        const range = mergedPageRange || (activeUnit ? { start: parseInt(activeUnit.start_page), end: parseInt(activeUnit.end_page), pages: [] } : null); if (!range) return null;
                        const pagesToRender = range.pages.length > 0 ? range.pages : (() => { const p = []; for (let i = range.start; i <= range.end; i++) p.push(i); return p; })();
                        return pagesToRender.map(p => {
                          const isSel = selectedPages.includes(p); const isSol = solvedPages.has(p);
                          return (<button key={p} onClick={() => handlePageClick(p)} className={`aspect-square rounded-md flex items-center justify-center text-[12px] font-black tabular-nums transition-all border relative ${isSel ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)] scale-105' : isSol ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500' : 'bg-white/10 border-white/20 text-white hover:bg-emerald-500/30'}`}>{p}{isSol && !isSel && <div className="absolute top-0.5 right-0.5 opacity-50"><Check size={7} strokeWidth={4} /></div>}</button>);
                        });
                      })()}
                    </div>
                    <div className="pt-4 border-t border-white/10 flex flex-col gap-3 mt-auto">
                      <div className="p-3 bg-white/10 rounded-md border border-white/10"><span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 block">Selected Pages</span><p className="text-[15px] font-black text-white truncate">{selectedPages.length > 0 ? (() => { const ranges: string[] = []; let s = selectedPages[0]; for (let i = 1; i <= selectedPages.length; i++) { if (selectedPages[i] !== selectedPages[i - 1] + 1) { const e = selectedPages[i - 1]; ranges.push(s === e ? `${s}` : `${s}~${e}`); s = selectedPages[i]; } } return `p${ranges.join(', p')}`; })() : '페이지를 선택하세요'}</p></div>
                      <div className="flex gap-2">
                        <button onClick={() => handleRecordLearning('classwork')} disabled={(selectedPages.length === 0 && selectedUnits.length === 0) || isSaving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-black rounded-md transition-all text-[10px] uppercase shadow-lg shadow-emerald-900/20">+ 처음풀기</button>
                        <button onClick={() => handleRecordLearning('wrong')} disabled={(selectedPages.length === 0 && selectedUnits.length === 0) || isSaving} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-white font-black rounded-md transition-all text-[10px] uppercase shadow-lg shadow-amber-900/20">+ 오답고치기</button>
                        <button onClick={() => handleRecordLearning('homework')} disabled={(selectedPages.length === 0 && selectedUnits.length === 0) || isSaving} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-black rounded-md transition-all text-[10px] uppercase shadow-lg shadow-blue-900/20">+ 숙제추가</button>
                      </div>
                    </div>
                  </div>
                )}
                {/* 플로팅 바 (다중 선택 시) */}
                {!activeUnit && !isMergedViewActive && selectedUnits.length > 1 && (
                  <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="absolute bottom-6 left-6 right-6 bg-blue-600 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col lg:flex-row items-center justify-between gap-6 border border-blue-400/50 z-50">
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0 shadow-inner border border-white/10"><span className="text-xl font-black">{selectedUnits.length}</span></div>
                        <button onClick={() => { setSelectedUnits([]); setLastClickedUnitIdx(null); }} className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-blue-600 hover:bg-red-600 transition-all transform hover:scale-110 active:scale-90" title="전체 취소 (ESC)"><X size={14} strokeWidth={4} /></button>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] font-black text-blue-100 uppercase tracking-[0.2em] mb-1 block">Units Ready to Add</span>
                        <p className="text-[15px] font-black text-white leading-tight">{(() => { const sorted = [...selectedUnits].sort((a,b) => parseInt(a.start_page) - parseInt(b.start_page)); return `${sorted[0].unit.match(/\d+/)?.[0]}~${sorted[sorted.length-1].unit.match(/\d+/)?.[0]}${sorted[0].unit.replace(/\d+/g, '').trim()} (p${sorted[0].start_page}~${sorted[sorted.length-1].end_page})`; })()}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-center">
                      <button onClick={() => handleQuickAddUnits('classwork')} className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black rounded-xl border border-white/20 transition-all uppercase">처음풀기</button>
                      <button onClick={() => handleQuickAddUnits('wrong')} className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black rounded-xl border border-white/20 transition-all uppercase">오답고치기</button>
                      <button onClick={() => handleQuickAddUnits('homework')} className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black rounded-xl border border-white/20 transition-all uppercase">숙제추가</button>
                      <button onClick={() => setIsMergedViewActive(true)} className="px-4 py-3 bg-white text-blue-600 text-[10px] font-black rounded-xl shadow-xl hover:bg-blue-50 transition-all uppercase">상세페이지 가기</button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
