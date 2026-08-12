'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ClipboardList, Plus, BookOpen, ChevronRight, RefreshCcw, Trash2, Eye, FileText, Zap, HelpCircle, Loader2 } from 'lucide-react';
import { HomeworkItem, TextbookOption } from '@/types/dashboard';
import { supabase } from '@/lib/supabase';

interface HomeworkEditorProps {
  title?: string;
  student?: any; // 💡 추가: 학생 정보 (Keep 교재 확인용)
  homeworkJson: HomeworkItem[];
  masterTextbooks: TextbookOption[];
  onUpdate: (newHw: HomeworkItem[]) => void;
  onToggleKeepBook?: (bookCode: string, isKeep: boolean) => void;
  onClose: (finalJson?: HomeworkItem[]) => void;
  academyInfo?: any;
  isLight?: boolean; // 💡 추가: 라이트 모드 테마 지원
}

import { useHomeworkEditorState } from './hooks/useHomeworkEditorState';

export default function HomeworkEditor({ 
  title = "Smart Study Editor", student, homeworkJson, masterTextbooks, onUpdate, onToggleKeepBook, onClose, academyInfo, isLight = false 
}: HomeworkEditorProps) {
  const {
    mounted,
    unitDataMap,
    isLoadingUnits,
    pdfLinks,
    activePdfUrl,
    setActivePdfUrl,
    items,
    setItems,
    itemsRef,
    startRefs,
    endRefs,
    commitPageChange,
    navigateInput,
    openFastPdf,
  } = useHomeworkEditorState({
    student,
    homeworkJson,
    onClose,
    academyInfo,
  });

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-start pl-[5vw] md:pl-[10vw]">
      <motion.div 
        id="homework-editor-portal"
        drag 
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.95, x: -50, y: 0 }}
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()} 
        className={`pointer-events-auto relative w-full max-w-[680px] border rounded-sm p-0 flex flex-col overflow-hidden ${
          isLight 
            ? 'bg-white border-blue-200 shadow-xl shadow-blue-900/5 text-gray-800' 
            : 'bg-[#0a0a0a]/95 backdrop-blur-2xl border-blue-500/30 shadow-[0_40px_100px_rgba(0,0,0,0.9),0_0_50px_rgba(59,130,246,0.1)] text-white'
        }`}
      >
        <div className={`relative cursor-move px-4 py-3 flex items-center justify-between border-b active:from-blue-600/30 transition-all ${
          isLight 
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50/50 border-gray-200' 
            : 'bg-gradient-to-r from-blue-600/20 to-indigo-600/10 border-white/5'
        }`}>
          <div className="flex items-center gap-3 relative z-10">
            <div className={`w-7 h-7 rounded-[2px] flex items-center justify-center shadow-inner ${
              isLight ? 'bg-blue-100/50 shadow-blue-200/50' : 'bg-blue-600/30 shadow-blue-400/20'
            }`}>
              <ClipboardList size={14} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
            </div>
            <div>
              <h4 className={`font-black text-[12px] uppercase tracking-[0.2em] ${
                isLight ? 'text-gray-600' : 'text-white/80'
              }`}>{title}</h4>
            </div>
          </div>

          {student && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-baseline gap-2 pointer-events-none z-10">
              <span className={`text-[17px] font-black tracking-wide ${isLight ? 'text-gray-850' : 'text-white'}`}>{student.name}</span>
              <span className={`text-[11px] font-medium px-1.5 py-0.5 border rounded-sm shadow-sm ${
                isLight 
                  ? 'bg-blue-50 border-blue-100 text-blue-700' 
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-200/80'
              }`}>{student.school} {student.grade}</span>
            </div>
          )}

          <div className="flex items-center gap-2 relative z-10">
            <button 
              onClick={() => {
                if (window.confirm('입력된 모든 페이지와 단원 정보를 초기화하시겠습니까? (교재 목록은 유지됩니다)')) {
                  const resetHw = items.map(hw => ({ ...hw, range: '', units: [], start_page: '', end_page: '', note: '' }));
                  setItems(resetHw);
                }
              }}
              className="px-3 py-1.5 rounded-[2px] bg-red-500/15 text-red-500 hover:text-red-600 hover:bg-red-500/25 transition-all text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-red-500/25"
            >
              <RefreshCcw size={12} /> 전체 초기화
            </button>
            <button onClick={(e) => { e.stopPropagation(); onClose(items); }} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all hover:rotate-90 duration-300">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar-v px-1">
            {items.map((hw, idx) => (
              <HomeworkRow 
                key={idx} 
                hw={hw} 
                idx={idx} 
                masterTextbooks={masterTextbooks}
                unitData={unitDataMap[hw.book_name] || []}
                startRef={(el: any) => startRefs.current[idx] = el}
                endRef={(el: any) => endRefs.current[idx] = el}
                pdfLinks={pdfLinks}
                isLight={isLight}
                onOpenPdf={(url) => openFastPdf(url)}
                onUpdate={(updated) => {
                  const newHw = [...items];
                  newHw[idx] = updated;
                  setItems(newHw);
                }}
                commitPageChange={(start, end, note) => commitPageChange(idx, start, end, note)}
                onKeyDown={(key, type) => navigateInput(idx, type, key)}
                onReset={() => {
                  const newHw = [...items];
                  newHw[idx] = { ...newHw[idx], range: '', units: [], start_page: '', end_page: '', note: '' };
                  setItems(newHw);
                }}
                onDuplicate={() => {
                  const newHw = [...items];
                  newHw.splice(idx + 1, 0, { type: hw.type, book_name: hw.book_name, range: '', units: [], start_page: '', end_page: '', note: '' });
                  setItems(newHw);
                }}
                onDelete={() => {
                  setItems(items.filter((_, i) => i !== idx));
                }}
              />
            ))}
          </div>

          {/* 💡 실시간 셀 미리보기 영역 */}
          <div className={`border rounded-sm p-4 space-y-2 ${
            isLight ? 'bg-blue-50/50 border-blue-200' : 'bg-blue-500/10 border border-blue-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                isLight ? 'text-blue-700' : 'text-blue-300'
              }`}><ClipboardList size={14} /> 실시간 미리보기</span>
              <span className="text-[10px] font-bold text-gray-400 italic">데일리 시트에 연동될 결과</span>
            </div>
            <div className={`min-h-[40px] max-h-[80px] overflow-y-auto custom-scrollbar-v text-[13px] font-black whitespace-pre-wrap leading-tight ${
              isLight ? 'text-blue-950' : 'text-white'
            }`}>
              {(() => {
                const lines = items
                  .filter(h => h.range)
                  .map(h => {
                    const textbook = masterTextbooks.find(m => m.bookcode === h.book_name) || 
                                    masterTextbooks.find(m => m.bookcode.toLowerCase().startsWith(h.book_name.toLowerCase())) ||
                                    masterTextbooks.find(m => h.book_name.toLowerCase().startsWith(m.bookcode.toLowerCase()));
                    const fullTitle = textbook?.title || h.book_name;
                    return `${fullTitle} ${h.range}`;
                  });
                return lines.length > 0 ? lines.join('\n') : '입력된 내용이 없습니다. 페이지 범위를 기입해 주세요.';
              })()}
            </div>
          </div>

          <div className="pt-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onClose(items); }} 
              className={`w-full py-4 rounded-sm font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl active:scale-[0.98] transition-all border ${
                isLight 
                  ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700 shadow-blue-600/20' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400/20 shadow-blue-600/40'
              }`}
            >
              확인 및 저장 (Ctrl+Enter)
            </button>
          </div>
        </div>
      </motion.div>

      {/* 📖 인앱 PDF 뷰어 레이어 (구글 드라이브 연동) */}
      <AnimatePresence>
        {activePdfUrl && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm pointer-events-auto no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-5xl h-[88vh] border rounded-lg overflow-hidden flex flex-col shadow-2xl ${
                isLight ? 'bg-white border-gray-250' : 'bg-[#121212] border-white/10'
              }`}
            >
              <div className={`px-4 py-3 flex items-center justify-between border-b ${
                isLight ? 'bg-gray-50 border-gray-250 text-gray-800' : 'bg-[#1e1e1e] border-white/5 text-white/80'
              }`}>
                <span className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <FileText size={14} className="text-blue-500" />
                  교재 PDF 뷰어 (구글 드라이브)
                </span>
                <button 
                  onClick={() => setActivePdfUrl(null)} 
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-red-500 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 bg-black relative">
                <iframe 
                  src={activePdfUrl} 
                  className="w-full h-full border-none" 
                  allow="autoplay"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}

function HomeworkRow({ 
  hw, idx, masterTextbooks, unitData, onUpdate, commitPageChange, onReset, onDelete, onDuplicate, startRef, endRef, onKeyDown, pdfLinks = {}, isLight = false, onOpenPdf 
}: { 
  hw: HomeworkItem, idx: number, masterTextbooks: TextbookOption[], unitData: any[], onUpdate: (hw: HomeworkItem) => void, commitPageChange: (start: string, end: string, note?: string) => void, onReset?: () => void, onDelete?: () => void, onDuplicate?: () => void, startRef?: any, endRef?: any, onKeyDown?: (key: string, type: 'start' | 'end') => void, pdfLinks?: Record<string, any>, isLight?: boolean, onOpenPdf?: (url: string) => void
}) {
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [note, setNote] = useState('');
  const [isUnitsExpanded, setIsUnitsExpanded] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  // 💡 사용자가 입력 중일 때 외부 prop 변경이 내부 state를 덮어쓰지 못하도록 차단
  const isFocused = useRef(false);

  // 💡 데이터가 외부에서 초기화(Reset)되었거나 변경되었을 때 내부 state도 동기화
  // isFocused가 true이면(입력 중) 외부 변경을 무시하여 깜빡임 방지
  useEffect(() => {
    if (isFocused.current) return;

    if (!hw.range) {
      setStartPage('');
      setEndPage('');
      setNote('');
      setLastClickedIndex(null);
    } else {
      setNote(hw.note || '');
      if (hw.start_page !== undefined || hw.end_page !== undefined) {
        setStartPage(hw.start_page || '');
        setEndPage(hw.end_page || '');
      } else {
        const pagePartMatch = hw.range.match(/p\d+(?:~\d+)?\s*$/i);
        if (pagePartMatch) {
          const pagePart = pagePartMatch[0];
          const numbers = pagePart.match(/\d+/g);
          if (numbers && numbers.length >= 2) {
            setStartPage(numbers[0]);
            setEndPage(numbers[1]);
          } else if (numbers && numbers.length === 1) {
            setStartPage(numbers[0]);
            setEndPage('');
          }
        } else {
          const numbers = hw.range.match(/\d+/g);
          if (numbers && numbers.length >= 2) {
            setStartPage(numbers[numbers.length - 2]);
            setEndPage(numbers[numbers.length - 1]);
          } else if (numbers && numbers.length === 1) {
            setStartPage(numbers[0]);
            setEndPage('');
          }
        }
      }
    }
  }, [hw.range, hw.start_page, hw.end_page, hw.note]);

  // 💡 엔터나 탭 입력 시 부모에게 최종 값을 전달
  const handleFinalize = () => {
    commitPageChange(startPage, endPage, note);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, type: 'start' | 'end') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinalize();
      // 💡 엔터 시 로직: Start -> End로 포커스 이동, End면 아래 교재로 이동
      if (type === 'start') {
        onKeyDown?.('ArrowRight', 'start');
      } else {
        onKeyDown?.('ArrowDown', 'end');
      }
    }
    if (e.key.startsWith('Arrow')) {
      onKeyDown?.(e.key, type);
    }
  };

  const bookLinks = pdfLinks[hw.book_name];
  const pdfUrl = typeof bookLinks === 'string' ? bookLinks : bookLinks?.pdfUrl;
  const answerUrl = typeof bookLinks === 'object' ? bookLinks?.answerUrl : undefined;
  const explanationUrl = typeof bookLinks === 'object' ? bookLinks?.explanationUrl : undefined;

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-1.5 p-1.5 border rounded-[2px] transition-all group ${
        isLight 
          ? 'bg-gray-50/50 hover:bg-gray-100/50 border-gray-250' 
          : 'bg-white/[0.02] hover:bg-white/[0.05] border border-white/5'
      }`}>
        <div className="flex-1 max-w-[220px] min-w-0 flex items-center gap-1.5 overflow-hidden">
          <BookOpen size={11} className="text-blue-500/40 shrink-0" />
          {hw.type === 'custom' ? (
            <input 
              type="text"
              value={hw.book_name}
              placeholder="기타 과제"
              onChange={(e) => onUpdate({ ...hw, book_name: e.target.value })}
              className={`bg-transparent border-b text-[12px] font-bold outline-none w-full placeholder:text-gray-400 ${
                isLight 
                  ? 'border-gray-300 text-blue-600 focus:border-blue-500' 
                  : 'bg-transparent border-white/30 text-blue-300 focus:border-blue-400'
              }`}
            />
          ) : (
            <span 
              onClick={() => setIsUnitsExpanded(!isUnitsExpanded)}
              className={`text-[12px] font-black truncate cursor-pointer hover:text-blue-600 transition-colors ${
                isLight ? 'text-gray-800 font-bold' : 'text-white font-black'
              }`} 
            >
              {masterTextbooks.find(m => m.bookcode === hw.book_name)?.title || hw.book_name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 relative group/input">
          <div className="absolute -top-4 left-0 text-[9px] font-black text-blue-400 opacity-50 group-hover/input:opacity-100 transition-opacity uppercase tracking-tighter">단축키 Alt+{idx+1}</div>
          <input 
            ref={startRef}
            type="text" 
            value={startPage} 
            onChange={(e) => setStartPage(e.target.value)}
            onFocus={() => { isFocused.current = true; }}
            onKeyDown={(e) => handleInputKeyDown(e, 'start')}
            onBlur={() => { isFocused.current = false; handleFinalize(); }}
            placeholder={hw.type === 'custom' ? "상세 내용" : "시작"}
            className={`${hw.type === 'custom' ? 'w-40' : 'w-16'} border rounded-md py-1.5 text-[12px] outline-none text-center font-bold placeholder:text-gray-400 ${
              isLight 
                ? 'bg-white border-gray-250 text-gray-800 focus:border-blue-500 focus:bg-blue-50/10' 
                : 'bg-black/40 border-white/40 text-white focus:border-blue-400 focus:bg-black/20'
            }`}
          />
          <span className={`text-[12px] font-bold ${isLight ? 'text-gray-400' : 'text-gray-200'}`}>-</span>
          <input 
            ref={endRef}
            type="text" 
            value={endPage} 
            onChange={(e) => setEndPage(e.target.value)}
            onFocus={() => { isFocused.current = true; }}
            onKeyDown={(e) => handleInputKeyDown(e, 'end')}
            onBlur={() => { isFocused.current = false; handleFinalize(); }}
            placeholder="끝"
            className={`w-16 border rounded-md py-1.5 text-[12px] outline-none text-center font-bold placeholder:text-gray-400 ${
              isLight 
                ? 'bg-white border-gray-250 text-gray-800 focus:border-blue-500 focus:bg-blue-50/10' 
                : 'bg-black/40 border-white/40 text-white focus:border-blue-400 focus:bg-black/20'
            }`}
          />
        </div>

        {hw.type === 'book' && (
          <div className="flex-1 min-w-[60px] flex items-center gap-1 overflow-hidden" onClick={() => setIsUnitsExpanded(!isUnitsExpanded)}>
            <ChevronRight size={10} className="text-blue-500/50 shrink-0" />
            <p className={`text-[11px] font-bold truncate italic cursor-pointer ${
              isLight ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {hw.range || '...'}
            </p>
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto shrink-0">
          {/* 1. 📖 교재 본문 PDF */}
          {hw.type === 'book' && pdfUrl && (
            <button 
              type="button"
              onClick={() => onOpenPdf?.(pdfUrl)} 
              className={`px-1.5 h-6 shrink-0 rounded-[3px] text-[10px] font-bold transition-all flex items-center gap-1 border ${
                isLight 
                  ? 'text-indigo-600 hover:bg-indigo-50 border-indigo-200 hover:border-indigo-400' 
                  : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 border-indigo-500/30'
              }`}
              title="교재 본문 PDF 보기"
            >
              <FileText size={11} />
              <span>본문</span>
            </button>
          )}

          {/* 2. ⚡ 빠른 답 PDF */}
          {hw.type === 'book' && answerUrl && (
            <button 
              type="button"
              onClick={() => onOpenPdf?.(answerUrl)} 
              className={`px-1.5 h-6 shrink-0 rounded-[3px] text-[10px] font-bold transition-all flex items-center gap-1 border ${
                isLight 
                  ? 'text-amber-600 hover:bg-amber-50 border-amber-200 hover:border-amber-400' 
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 border-amber-500/30'
              }`}
              title="빠른 답 PDF 보기"
            >
              <Zap size={11} />
              <span>빠른답</span>
            </button>
          )}

          {/* 3. 📝 정답 및 해설 PDF */}
          {hw.type === 'book' && explanationUrl && (
            <button 
              type="button"
              onClick={() => onOpenPdf?.(explanationUrl)} 
              className={`px-1.5 h-6 shrink-0 rounded-[3px] text-[10px] font-bold transition-all flex items-center gap-1 border ${
                isLight 
                  ? 'text-emerald-600 hover:bg-emerald-50 border-emerald-200 hover:border-emerald-400' 
                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30'
              }`}
              title="정답 및 해설 PDF 보기"
            >
              <HelpCircle size={11} />
              <span>해설</span>
            </button>
          )}

          <button 
            onClick={onReset} 
            className={`w-6 h-6 shrink-0 rounded-lg transition-all flex items-center justify-center border ${
              isLight 
                ? 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 border-gray-250 hover:border-blue-300' 
                : 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 bg-white/5 border-transparent hover:border-blue-500/30'
            }`}
            title="이 교재의 입력 내용 초기화"
          >
            <RefreshCcw size={14} />
          </button>

          {hw.type === 'custom' && (
            <button 
              onClick={onDelete} 
              className={`w-6 h-6 shrink-0 rounded-lg transition-all flex items-center justify-center border ${
                isLight 
                  ? 'text-red-500 hover:bg-red-50 border-red-200' 
                  : 'text-red-400 hover:text-red-300 hover:bg-red-500/20 bg-white/5 border-transparent hover:border-red-500/30'
              }`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isUnitsExpanded && hw.type === 'book' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className={`overflow-hidden border-x border-b rounded-b-[2px] mx-2 ${
              isLight ? 'bg-gray-50/50 border-gray-200' : 'bg-white/[0.01] border-white/5'
            }`}
          >
            <div className="p-3 grid grid-cols-1 gap-1">
              {unitData.map((u, i) => {
                const isSelected = hw.units?.includes(u.unit);
                const isInRange = parseInt(startPage) <= parseInt(u.end_page) && parseInt(endPage) >= parseInt(u.start_page);
                return (
                  <button 
                    key={i} 
                    onClick={(clickEvent) => {
                      const currentUnits = hw.units || [];
                      let newUnits: string[] = [];

                      if (clickEvent.shiftKey && lastClickedIndex !== null) {
                        const startIdx = Math.min(lastClickedIndex, i);
                        const endIdx = Math.max(lastClickedIndex, i);
                        const rangeUnits = unitData.slice(startIdx, endIdx + 1).map(x => x.unit);
                        const targetState = !currentUnits.includes(u.unit);

                        if (targetState) {
                          newUnits = Array.from(new Set([...currentUnits, ...rangeUnits]));
                        } else {
                          newUnits = currentUnits.filter(x => !rangeUnits.includes(x));
                        }
                      } else {
                        newUnits = currentUnits.includes(u.unit)
                          ? currentUnits.filter(x => x !== u.unit)
                          : [...currentUnits, u.unit];
                      }

                      setLastClickedIndex(i);
                      
                      // 💡 선택된 단원들의 전체 페이지 범위 산출 (최솟값 ~ 최댓값)
                      let s = "";
                      let e = "";
                      if (newUnits.length > 0) {
                        const selectedData = unitData.filter(x => newUnits.includes(x.unit));
                        const startPages = selectedData.map(x => parseInt(String(x.start_page).replace(/\D/g, ''))).filter(n => !isNaN(n));
                        const endPages = selectedData.map(x => parseInt(String(x.end_page).replace(/\D/g, ''))).filter(n => !isNaN(n));
                        
                        if (startPages.length > 0) {
                          s = String(Math.min(...startPages));
                        }
                        if (endPages.length > 0) {
                          e = String(Math.max(...endPages));
                        }
                      }

                      setStartPage(s);
                      setEndPage(e);
                      
                      const unitText = unitData.filter(x => newUnits.includes(x.unit)).map(x => x.unit).join(', ');
                      const activeNote = hw.note ? ` ${hw.note}` : '';
                      
                      let rangeText = "";
                      if (s && e) {
                        rangeText = (s === e) ? `p${s}` : `p${s}~${e}`;
                      } else if (s) {
                        rangeText = `p${s}`;
                      } else if (e) {
                        rangeText = `p${e}`;
                      }

                      onUpdate({ 
                        ...hw, 
                        units: newUnits, 
                        range: unitText ? `${unitText} ${rangeText}${activeNote}` : `${rangeText}${activeNote}`,
                        start_page: s,
                        end_page: e,
                        note: hw.note
                      });
                    }} 
                    className={`flex items-center justify-between px-3 py-2.5 rounded-[2px] text-[14px] transition-all ${
                      isSelected 
                        ? isLight 
                          ? 'bg-blue-100/70 text-blue-900 border border-blue-300 font-bold'
                          : 'bg-blue-600/30 text-blue-300 border border-blue-500/40' 
                        : isLight
                          ? 'text-gray-800 hover:bg-gray-150/80 border border-transparent'
                          : 'text-gray-200 hover:bg-white/10 border border-transparent'
                    } ${
                      isInRange && !isSelected 
                        ? isLight
                          ? 'text-emerald-700 bg-emerald-50/50'
                          : 'text-emerald-300' 
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${
                        isSelected 
                          ? isLight ? 'bg-blue-600' : 'bg-blue-400' 
                          : isInRange 
                            ? isLight ? 'bg-emerald-600' : 'bg-emerald-400' 
                            : isLight ? 'border border-gray-400' : 'border-2 border-white/30'
                      }`} />
                      <span className="truncate max-w-[400px] font-semibold">{u.unit}</span>
                    </div>
                    <span className={`text-[13px] tabular-nums tracking-wide ${
                      isLight ? 'text-gray-600 font-bold' : 'text-white opacity-100 font-normal'
                    }`}>
                      p{u.start_page}~{u.end_page}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
