'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ClipboardList, Plus } from 'lucide-react';
import { HomeworkItem, TextbookOption } from '@/types/dashboard';

interface HomeworkEditorProps {
  homeworkJson: HomeworkItem[];
  masterTextbooks: TextbookOption[];
  onUpdate: (newHw: HomeworkItem[]) => void;
  onClose: () => void;
}

export default function HomeworkEditor({ 
  homeworkJson, masterTextbooks, onUpdate, onClose 
}: HomeworkEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {};
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
      <motion.div 
        drag 
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.95, x: 100, y: 50 }}
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()} 
        className="pointer-events-auto relative w-full max-w-[440px] bg-[#0a0a0a]/90 backdrop-blur-xl border border-blue-500/30 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.8),0_0_40px_rgba(59,130,246,0.15)] p-0 flex flex-col overflow-hidden"
      >
        {/* 드래그 핸들 영역 */}
        <div className="cursor-move bg-blue-600/10 p-5 flex items-center justify-between border-b border-white/10 active:bg-blue-600/20 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <ClipboardList size={14} className="text-blue-500" />
            </div>
            <div>
              <h4 className="font-black text-[12px] uppercase tracking-[0.2em] text-white">Homework Editor</h4>
              <p className="text-[8px] text-blue-400/60 font-bold uppercase tracking-wider mt-0.5">Drag anywhere to move</p>
            </div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-7 space-y-6">
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar-v">
            {homeworkJson.map((hw, idx) => (
              <div key={idx} className="bg-white/[0.03] p-5 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  {hw.type === 'custom' ? (
                    <input 
                      type="text"
                      value={hw.book_name === '기타/프린트' ? '' : hw.book_name}
                      placeholder="항목 이름 (예: 프린트)"
                      onChange={(e) => {
                        const newHw = [...homeworkJson];
                        newHw[idx].book_name = e.target.value;
                        onUpdate(newHw);
                      }}
                      className="bg-transparent border-b border-blue-500/30 text-[11px] font-black text-blue-400 uppercase outline-none focus:border-blue-500 w-1/2"
                    />
                  ) : (
                    <span className="text-[11px] font-black text-blue-400 uppercase tracking-wide">
                      {masterTextbooks.find(m => m.tabName === hw.book_name)?.title || hw.book_name}
                    </span>
                  )}
                  
                  <div className="flex items-center gap-2">
                    {hw.type !== 'custom' && (
                      <BookUnitsPicker 
                        tabName={hw.book_name} 
                        onPick={(range) => {
                          const newHw = [...homeworkJson];
                          newHw[idx].range = hw.range ? `${hw.range}, ${range}` : range;
                          onUpdate(newHw);
                        }} 
                      />
                    )}
                    <button 
                      onClick={() => onUpdate(homeworkJson.filter((_, i) => i !== idx))}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      title="항목 삭제"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <input 
                  type="text" 
                  value={hw.range} 
                  placeholder="내용 입력 (예: 10-15p)" 
                  onChange={(e) => {
                    const newHw = [...homeworkJson];
                    newHw[idx].range = e.target.value;
                    onUpdate(newHw);
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-[13px] outline-none text-white focus:border-blue-500 focus:bg-black/80 transition-all placeholder:text-gray-800 font-medium" 
                />
              </div>
            ))}
            
            <button 
              onClick={() => onUpdate([...homeworkJson, { type: 'custom', book_name: '', range: '' }])}
              className="w-full py-4 border border-dashed border-white/10 rounded-2xl text-[10px] font-bold text-gray-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-3"
            >
              <Plus size={14} /> Add Extra Task
            </button>
          </div>

          <div className="pt-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onClose(); }} 
              className="w-full bg-blue-600 py-4 rounded-2xl font-black text-[12px] uppercase tracking-[0.1em] shadow-2xl shadow-blue-600/30 hover:bg-blue-500 active:scale-[0.97] transition-all text-white"
            >
              Confirm Assignment
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function BookUnitsPicker({ tabName, onPick }: { tabName: string, onPick: (range: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnits = async () => {
    if (tabName === '기타/프린트' || !tabName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/textbooks/${tabName}`);
      const data = await res.json();
      setUnits(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen && units.length === 0) fetchUnits(); }, [isOpen]);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="text-[10px] font-bold text-blue-500 hover:underline">Pick Units</button>
      {isOpen && (
        <div className="absolute right-0 top-8 w-64 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[9999] p-4 space-y-3">
          <p className="text-[10px] font-black text-gray-500 uppercase border-b border-white/5 pb-2 mb-2 tracking-widest">Select Unit Block</p>
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5">
            {loading ? <p className="text-[10px] text-gray-500 italic">Loading...</p> : 
             units.map((u, i) => (
               <button 
                 key={i} onClick={() => { onPick(`${u[1]}-${u[2]}`); setIsOpen(false); }}
                 className="w-full text-left p-2 hover:bg-blue-600/20 rounded-lg text-[11px] text-gray-300 transition-all border border-transparent hover:border-blue-500/30"
               >
                 <span className="font-bold text-blue-400 mr-2">{u[1]}-{u[2]}P</span>
                 {u[0]}
               </button>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}
