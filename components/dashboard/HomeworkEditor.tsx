'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ClipboardList, Plus, BookOpen, ChevronRight, RefreshCcw, Trash2 } from 'lucide-react';
import { HomeworkItem, TextbookOption } from '@/types/dashboard';

interface HomeworkEditorProps {
  title?: string;
  student?: any; // 💡 추가: 학생 정보 (Keep 교재 확인용)
  homeworkJson: HomeworkItem[];
  masterTextbooks: TextbookOption[];
  onUpdate: (newHw: HomeworkItem[]) => void;
  onToggleKeepBook?: (bookCode: string, isKeep: boolean) => void;
  onClose: () => void;
}

export default function HomeworkEditor({ 
  title = "Smart Study Editor", student, homeworkJson, masterTextbooks, onUpdate, onToggleKeepBook, onClose 
}: HomeworkEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [isKeepListOpen, setIsKeepListOpen] = useState(false);
  const [unitDataMap, setUnitDataMap] = useState<Record<string, any[]>>({});
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  
  const startRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const endRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    setMounted(true);
    fetchAllUnits();

    const handleModalKeyDown = (e: KeyboardEvent) => {
      // 💡 ESC, Alt+숫자, Ctrl+Enter 등 모달 전용 단축키는 여기서 확실히 가로챕니다.
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
          onClose();
        } else if (isCtrlEnter) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      // 💡 화살표 키나 일반 입력 키는 백그라운드 시트(`TodaySheet`)로 전파되는 것만 막고, 
      // 모달 내부의 개별 컴포넌트(`HomeworkRow`)들이 이벤트를 받을 수 있게 합니다.
      // (Capture 단계가 아닌 Bubbling 단계에서 처리되도록 전파만 차단)
      if (e.key.startsWith('Arrow') || e.key === 'Tab' || e.key === 'Enter') {
        e.stopPropagation();
      }
    };

    // 💡 capture 옵션을 제거(false)하여 자식 요소(input 등)가 먼저 이벤트를 받을 수 있게 합니다.
    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [onClose]);

  const fetchAllUnits = async () => {
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
  };

  if (!mounted) return null;

  // 💡 입력이 완료되었을 때만 부모의 데이터를 갱신 (Race Condition 방지)
  const commitPageChange = (idx: number, start: string, end: string, note?: string) => {
    const newHw = [...homeworkJson];
    const item = { ...newHw[idx] };
    const units = unitDataMap[item.book_name] || [];

    // 💡 고유 페이지 및 메모 값 저장 (정규식 오작동 원천 차단)
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
    onUpdate(newHw);
  };

  const navigateInput = (idx: number, type: 'start' | 'end', key: string) => {
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
  };

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
        className="pointer-events-auto relative w-full max-w-[680px] bg-[#0a0a0a]/95 backdrop-blur-2xl border border-blue-500/30 rounded-sm shadow-[0_40px_100px_rgba(0,0,0,0.9),0_0_50px_rgba(59,130,246,0.1)] p-0 flex flex-col overflow-hidden"
      >
        <div className="cursor-move bg-gradient-to-r from-blue-600/20 to-indigo-600/10 px-4 py-3 flex items-center justify-between border-b border-white/5 active:from-blue-600/30 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-[2px] bg-blue-600/30 flex items-center justify-center shadow-inner shadow-blue-400/20">
              <ClipboardList size={14} className="text-blue-400" />
            </div>
            <div>
              <h4 className="font-black text-[12px] uppercase tracking-[0.2em] text-white">{title}</h4>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (window.confirm('입력된 모든 페이지와 단원 정보를 초기화하시겠습니까? (교재 목록은 유지됩니다)')) {
                  const resetHw = homeworkJson.map(hw => ({ ...hw, range: '', units: [], start_page: '', end_page: '', note: '' }));
                  onUpdate(resetHw);
                }
              }}
              className="px-3 py-1.5 rounded-[2px] bg-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/30 transition-all text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-red-500/30"
            >
              <RefreshCcw size={12} /> 전체 초기화
            </button>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all hover:rotate-90 duration-300">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar-v px-1">
            {homeworkJson.map((hw, idx) => (
              <HomeworkRow 
                key={idx} 
                hw={hw} 
                idx={idx} 
                masterTextbooks={masterTextbooks}
                unitData={unitDataMap[hw.book_name] || []}
                startRef={(el: any) => startRefs.current[idx] = el}
                endRef={(el: any) => endRefs.current[idx] = el}
                onUpdate={(updated) => {
                  const newHw = [...homeworkJson];
                  newHw[idx] = updated;
                  onUpdate(newHw);
                }}
                commitPageChange={(start, end, note) => commitPageChange(idx, start, end, note)}
                onKeyDown={(key, type) => navigateInput(idx, type, key)}
                onReset={() => {
                  const newHw = [...homeworkJson];
                  newHw[idx] = { ...newHw[idx], range: '', units: [], start_page: '', end_page: '', note: '' };
                  onUpdate(newHw);
                }}
                onDuplicate={() => {
                  const newHw = [...homeworkJson];
                  newHw.splice(idx + 1, 0, { type: hw.type, book_name: hw.book_name, range: '', units: [], start_page: '', end_page: '', note: '' });
                  onUpdate(newHw);
                }}
                onDelete={() => {
                  const newHw = homeworkJson.filter((_, i) => i !== idx);
                  onUpdate(newHw);
                }}
                onToggleKeep={() => {
                  if (hw.type === 'book' && onToggleKeepBook) {
                    onToggleKeepBook(hw.book_name, true);
                    const newHw = homeworkJson.filter((_, i) => i !== idx);
                    onUpdate(newHw);
                  }
                }}
              />
            ))}
            
            <button 
              onClick={() => onUpdate([...homeworkJson, { type: 'custom', book_name: '', range: '' }])}
              className="w-full py-4 border border-dashed border-white/30 rounded-sm text-[11px] font-bold uppercase tracking-widest text-gray-300 hover:text-blue-300 hover:border-blue-500/60 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2 group"
            >
              <Plus size={14} /> 프린트 / 기타 과제 직접 추가
            </button>

            {/* 💡 원장님 요청사항: 보류(Keep) 상태인 교재를 모달에서 토글 */}
            {(() => {
              const keepBooks = student?.assigned_books?.filter((code: string) => 
                String(student.book_courses?.[code] || '').endsWith('-keep')
              ).map((code: string) => masterTextbooks.find(m => m.bookcode === code)).filter(Boolean) || [];

              if (keepBooks.length === 0) return null;

              return (
                <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-sm space-y-2">
                  <button 
                    onClick={() => setIsKeepListOpen(!isKeepListOpen)}
                    className="flex items-center gap-1.5 w-full text-[11px] text-amber-500 font-bold uppercase tracking-widest hover:text-amber-400 transition-colors"
                  >
                    <BookOpen size={10} /> 보류 중인 교재가 있습니다 ({keepBooks.length}권)
                  </button>
                  {isKeepListOpen && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {keepBooks.map((m: any) => (
                        <div key={m.bookcode} className="flex items-center bg-amber-500/10 border border-amber-500/20 rounded-[2px] pr-1">
                          <button
                            onClick={() => {
                              if (!homeworkJson.some(h => h.book_name === m.bookcode)) {
                                onUpdate([...homeworkJson, { type: 'book', book_name: m.bookcode, range: '', units: [], start_page: '', end_page: '', note: '' }]);
                              }
                            }}
                            className="px-2 py-1.5 text-amber-500 hover:text-white transition-all text-[10px] font-bold truncate max-w-[150px] flex items-center gap-1"
                            title="오늘 과제에 임시 추가"
                          >
                            <Plus size={10} /> {m.title}
                          </button>
                          <button
                            onClick={() => onToggleKeepBook && onToggleKeepBook(m.bookcode, false)}
                            className="ml-1 px-1.5 py-1 bg-black/40 hover:bg-red-500/30 text-gray-300 hover:text-red-300 text-[9px] rounded-[1px] transition-all whitespace-nowrap"
                            title="보류 해제 (활성 교재로 복구)"
                          >
                            보류 해제
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 💡 실시간 셀 미리보기 영역 (원장님 요청사항) */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-blue-300 uppercase tracking-widest flex items-center gap-1.5"><ClipboardList size={14} /> 실시간 미리보기</span>
              <span className="text-[10px] font-bold text-gray-400 italic">데일리 시트에 연동될 결과</span>
            </div>
            <div className="min-h-[40px] max-h-[80px] overflow-y-auto custom-scrollbar-v text-[13px] text-white font-black whitespace-pre-wrap leading-tight">
              {(() => {
                const lines = homeworkJson
                  .filter(h => h.range)
                  .map(h => {
                    // 💡 더욱 유연한 교재 매칭
                    const textbook = masterTextbooks.find(m => m.bookcode === h.book_name) || 
                                    masterTextbooks.find(m => m.bookcode.toLowerCase().startsWith(h.book_name.toLowerCase())) ||
                                    masterTextbooks.find(m => h.book_name.toLowerCase().startsWith(m.bookcode.toLowerCase()));
                    const fullTitle = textbook?.title || h.book_name;
                    // 💡 대괄호 앞의 대분류 제거 (예: [중2-1] 일품 -> 일품)
                    const displayTitle = fullTitle.replace(/^\[.*?\]\s*/, '');
                    return `${displayTitle} ${h.range}`;
                  });
                return lines.length > 0 ? lines.join('\n') : '입력된 내용이 없습니다. 페이지 범위를 기입해 주세요.';
              })()}
            </div>
          </div>

          <div className="pt-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onClose(); }} 
              className="w-full bg-blue-600 py-4 rounded-sm font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/40 hover:bg-blue-500 active:scale-[0.98] transition-all text-white border border-blue-400/20"
            >
              확인 및 저장 (Ctrl+Enter)
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function HomeworkRow({ 
  hw, idx, masterTextbooks, unitData, onUpdate, commitPageChange, onReset, onDelete, onDuplicate, onToggleKeep, startRef, endRef, onKeyDown 
}: { 
  hw: HomeworkItem, idx: number, masterTextbooks: TextbookOption[], unitData: any[], onUpdate: (hw: HomeworkItem) => void, commitPageChange: (start: string, end: string, note?: string) => void, onReset?: () => void, onDelete?: () => void, onDuplicate?: () => void, onToggleKeep?: () => void, startRef?: any, endRef?: any, onKeyDown?: (key: string, type: 'start' | 'end') => void
}) {
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [note, setNote] = useState('');
  const [isUnitsExpanded, setIsUnitsExpanded] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null); // 💡 추가

  // 💡 데이터가 외부에서 초기화(Reset)되었거나 변경되었을 때 내부 state도 동기화
  useEffect(() => {
    if (!hw.range) {
      setStartPage('');
      setEndPage('');
      setNote('');
      setLastClickedIndex(null); // 💡 초기화
    } else {
      setNote(hw.note || '');
      if (hw.start_page !== undefined || hw.end_page !== undefined) {
        // 💡 명시적 필드 존재 시 최우선 반영하여 정규식 혼선 방지
        setStartPage(hw.start_page || '');
        setEndPage(hw.end_page || '');
      } else {
        // 💡 하위 호환: 단원명 내 숫자 무시를 위해 문자열 끝에 있는 'p숫자' 형식에서만 페이지 번호 추출 시도
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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 p-1.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-[2px] transition-all group">
        <div className="flex-1 max-w-[220px] min-w-0 flex items-center gap-1.5 overflow-hidden">
          <BookOpen size={11} className="text-blue-500/40 shrink-0" />
          {hw.type === 'custom' ? (
            <input 
              type="text"
              value={hw.book_name}
              placeholder="기타 과제"
              onChange={(e) => onUpdate({ ...hw, book_name: e.target.value })}
              className="bg-transparent border-b border-white/30 text-[12px] font-bold text-blue-300 outline-none focus:border-blue-400 w-full placeholder:text-gray-500"
            />
          ) : (
            <span 
              onClick={() => setIsUnitsExpanded(!isUnitsExpanded)}
              className="text-[12px] font-black text-white truncate cursor-pointer hover:text-blue-300 transition-colors" 
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
            onKeyDown={(e) => handleInputKeyDown(e, 'start')}
            onBlur={handleFinalize}
            placeholder={hw.type === 'custom' ? "상세 내용" : "시작"}
            className={`${hw.type === 'custom' ? 'w-40' : 'w-16'} bg-black/40 border border-white/40 rounded-md py-1.5 text-[12px] outline-none text-white focus:border-blue-400 text-center font-bold placeholder:text-gray-300`}
          />
          <span className="text-gray-200 text-[12px] font-bold">-</span>
          <input 
            ref={endRef}
            type="text" 
            value={endPage} 
            onChange={(e) => setEndPage(e.target.value)}
            onKeyDown={(e) => handleInputKeyDown(e, 'end')}
            onBlur={handleFinalize}
            placeholder="끝"
            className="w-16 bg-black/40 border border-white/40 rounded-md py-1.5 text-[12px] outline-none text-white focus:border-blue-400 text-center font-bold placeholder:text-gray-300"
          />
        </div>

        {hw.type === 'book' && (
          <div className="flex-1 min-w-[60px] flex items-center gap-1 overflow-hidden" onClick={() => setIsUnitsExpanded(!isUnitsExpanded)}>
            <ChevronRight size={10} className="text-blue-500/50 shrink-0" />
            <p className="text-[11px] font-bold text-gray-400 truncate italic cursor-pointer">
              {hw.range || '...'}
            </p>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {hw.type === 'book' && onToggleKeep && (
            <button 
              onClick={onToggleKeep}
              className="w-12 shrink-0 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500 hover:text-white transition-all text-[10px] font-bold rounded-[2px]"
              title="목록에서 가리고 보류 상태로 변경"
            >
              보류
            </button>
          )}

          <button 
            onClick={onReset} 
            className="w-6 h-6 shrink-0 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 transition-all flex items-center justify-center bg-white/5 border border-transparent hover:border-blue-500/30"
            title="이 교재의 입력 내용 초기화"
          >
            <RefreshCcw size={14} />
          </button>

          {hw.type === 'custom' && (
            <button 
              onClick={onDelete} 
              className="w-6 h-6 shrink-0 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all flex items-center justify-center bg-white/5 border border-transparent hover:border-red-500/30"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isUnitsExpanded && hw.type === 'book' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white/[0.01] border-x border-b border-white/5 rounded-b-[2px] mx-2">
            <div className="p-3 grid grid-cols-1 gap-1">
              {unitData.map((u, i) => {
                const isSelected = hw.units?.includes(u.unit);
                const isInRange = parseInt(startPage) <= parseInt(u.end_page) && parseInt(endPage) >= parseInt(u.start_page);
                return (
                  <button key={i} onClick={(clickEvent) => {
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
                  }} className={`flex items-center justify-between px-3 py-2.5 rounded-[2px] text-[15px] font-normal transition-all ${isSelected ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'text-gray-200 hover:bg-white/10 border border-transparent'} ${isInRange && !isSelected ? 'text-emerald-300' : ''}`}>
                    <div className="flex items-center gap-2.5"><div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-blue-400' : isInRange ? 'bg-emerald-400' : 'bg-transparent border-2 border-white/30'}`} /><span className="truncate max-w-[400px]">{u.unit}</span></div>
                    <span className="text-[15px] text-white opacity-100 tabular-nums tracking-wide font-normal">p{u.start_page}~{u.end_page}</span>
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
