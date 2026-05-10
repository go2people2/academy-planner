'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ClipboardList, Plus, BookOpen, ChevronRight, RefreshCcw } from 'lucide-react';
import { HomeworkItem, TextbookOption } from '@/types/dashboard';

interface HomeworkEditorProps {
  title?: string;
  homeworkJson: HomeworkItem[];
  masterTextbooks: TextbookOption[];
  onUpdate: (newHw: HomeworkItem[]) => void;
  onClose: () => void;
}

export default function HomeworkEditor({ 
  title = "Smart Study Editor", homeworkJson, masterTextbooks, onUpdate, onClose 
}: HomeworkEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [unitDataMap, setUnitDataMap] = useState<Record<string, any[]>>({});
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchAllUnits();
  }, []);

  const fetchAllUnits = async () => {
    setIsLoadingUnits(true);
    try {
      const res = await fetch('/api/textbooks/unit-page');
      if (res.ok) {
        const allUnits = await res.json();
        const mapped: Record<string, any[]> = {};
        // 💡 API가 반환하는 객체 배열 형태 처리
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

  const handlePageChange = (idx: number, start: string, end: string) => {
    const newHw = [...homeworkJson];
    const item = newHw[idx];
    const units = unitDataMap[item.book_name] || [];

    const sNum = parseInt(start);
    const eNum = parseInt(end);

    if (!isNaN(sNum) && !isNaN(eNum)) {
      if (units.length === 0 && !isLoadingUnits) {
        item.range = `p${start}~${end}`; // 💡 p45~60 형태로 축소
        item.units = [];
      } else {
        const matchedUnits = units.filter(u => {
          const uStart = parseInt(u.start_page);
          const uEnd = parseInt(u.end_page);
          return (uStart <= eNum && uEnd >= sNum);
        });

        const uniqueUnitNames = Array.from(new Set(matchedUnits.map(u => u.unit))).join(', ');
        item.range = uniqueUnitNames ? `${uniqueUnitNames} p${start}~${end}` : `p${start}~${end}`;
        item.units = Array.from(new Set(matchedUnits.map(u => u.unit)));
      }
    } else {
      item.range = `p${start}${end ? '~' + end : ''}`;
    }

    onUpdate(newHw);
  };
  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
      <motion.div 
        drag 
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.95, x: 100, y: 50 }}
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()} 
        className="pointer-events-auto relative w-full max-w-[480px] bg-[#0a0a0a]/95 backdrop-blur-2xl border border-blue-500/30 rounded-sm shadow-[0_40px_100px_rgba(0,0,0,0.9),0_0_50px_rgba(59,130,246,0.1)] p-0 flex flex-col overflow-hidden"
      >
        <div className="cursor-move bg-gradient-to-r from-blue-600/20 to-indigo-600/10 p-6 flex items-center justify-between border-b border-white/5 active:from-blue-600/30 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-[2px] bg-blue-600/30 flex items-center justify-center shadow-inner shadow-blue-400/20">
              <ClipboardList size={16} className="text-blue-400" />
            </div>
            <div>
              <h4 className="font-black text-[13px] uppercase tracking-[0.2em] text-white">{title}</h4>
              <p className="text-[9px] text-blue-400/60 font-bold uppercase tracking-wider mt-0.5">Automated Unit Discovery Enabled</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (window.confirm('입력된 모든 페이지와 단원 정보를 초기화하시겠습니까? (교재 목록은 유지됩니다)')) {
                  const resetHw = homeworkJson.map(hw => ({
                    ...hw,
                    range: '',
                    units: []
                  }));
                  onUpdate(resetHw);
                }
              }}
              className="px-3 py-1.5 rounded-[2px] bg-red-500/10 text-red-500/60 hover:text-red-500 hover:bg-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-red-500/10"
              title="입력 내용 초기화"
            >
              <RefreshCcw size={12} /> Reset
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onClose(); }} 
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all hover:rotate-90 duration-300"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-3 custom-scrollbar-v px-1">
            {homeworkJson.map((hw, idx) => (
              <HomeworkRow 
                key={idx} 
                hw={hw} 
                idx={idx} 
                masterTextbooks={masterTextbooks}
                unitData={unitDataMap[hw.book_name] || []}
                onUpdate={(updated) => {
                  const newHw = [...homeworkJson];
                  newHw[idx] = updated;
                  onUpdate(newHw);
                }}
                onPageChange={(start, end) => handlePageChange(idx, start, end)}
                onDelete={() => onUpdate(homeworkJson.filter((_, i) => i !== idx))}
              />
            ))}
            
            <button 
              onClick={() => onUpdate([...homeworkJson, { type: 'custom', book_name: '', range: '' }])}
              className="w-full py-5 border border-dashed border-white/10 rounded-sm text-[11px] font-black uppercase tracking-widest text-gray-600 hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-3 group"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" /> Add Custom Print/Task
            </button>
          </div>

          <div className="pt-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onClose(); }} 
              className="w-full bg-blue-600 py-5 rounded-sm font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/40 hover:bg-blue-500 active:scale-[0.98] transition-all text-white border border-blue-400/20"
            >
              Confirm and Save
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function HomeworkRow({ 
  hw, idx, masterTextbooks, unitData, onUpdate, onPageChange, onDelete 
}: { 
  hw: HomeworkItem, idx: number, masterTextbooks: TextbookOption[], unitData: any[], onUpdate: (hw: HomeworkItem) => void, onPageChange: (start: string, end: string) => void, onDelete: () => void 
}) {
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');

  useEffect(() => {
    // 💡 p45~60 또는 p45 ~ p60 모두 대응 가능한 정규식
    const match = hw.range.match(/p(\d+)\s*[~-]\s*p?(\d+)/i);
    if (match) {
      setStartPage(match[1]);
      setEndPage(match[2]);
    }
  }, []);

  const handleStartChange = (val: string) => {
    setStartPage(val);
    onPageChange(val, endPage);
  };

  const handleEndChange = (val: string) => {
    setEndPage(val);
    onPageChange(startPage, val);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-[2px] transition-all group">
      <div className="w-[120px] shrink-0 flex items-center gap-1.5 overflow-hidden">
        <BookOpen size={12} className="text-blue-500/40 shrink-0" />
        {hw.type === 'custom' ? (
          <input 
            type="text"
            value={hw.book_name}
            placeholder="기타 과제"
            onChange={(e) => onUpdate({ ...hw, book_name: e.target.value })}
            className="bg-transparent border-b border-white/10 text-[10px] font-bold text-blue-400 outline-none focus:border-blue-500 w-full"
          />
        ) : (
          <span className="text-[10px] font-black text-gray-200 truncate" title={masterTextbooks.find(m => m.bookcode === hw.book_name)?.title || hw.book_name}>
            {masterTextbooks.find(m => m.bookcode === hw.book_name)?.title || hw.book_name}
          </span>
        )}
      </div>

      {hw.type === 'book' ? (
        <div className="flex items-center gap-1 shrink-0">
          <input 
            type="text" 
            value={startPage} 
            onChange={(e) => handleStartChange(e.target.value)}
            placeholder="Start"
            className="w-10 bg-black/40 border border-white/5 rounded-md py-1 text-[11px] outline-none text-white focus:border-blue-500 text-center font-bold"
          />
          <span className="text-gray-700 text-[10px]">-</span>
          <input 
            type="text" 
            value={endPage} 
            onChange={(e) => handleEndChange(e.target.value)}
            placeholder="End"
            className="w-10 bg-black/40 border border-white/5 rounded-md py-1 text-[11px] outline-none text-white focus:border-blue-500 text-center font-bold"
          />
        </div>
      ) : (
        <input 
          type="text" 
          value={hw.range} 
          placeholder="상세 내용" 
          onChange={(e) => onUpdate({ ...hw, range: e.target.value })}
          className="flex-1 bg-black/40 border border-white/5 rounded-md px-2 py-1 text-[10px] outline-none text-white focus:border-blue-500" 
        />
      )}

      {hw.type === 'book' && (
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
          <ChevronRight size={10} className="text-blue-500/50 shrink-0" />
          <p className="text-[9px] font-bold text-gray-500 truncate italic">
            {hw.range || '페이지를 입력하세요'}
          </p>
        </div>
      )}

      <button 
        onClick={onDelete}
        className="w-6 h-6 shrink-0 rounded-lg text-gray-700 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center"
      >
        <X size={12} />
      </button>
    </div>
  );
}
