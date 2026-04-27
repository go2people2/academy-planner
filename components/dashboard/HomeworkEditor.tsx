'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 mt-2 w-[400px] bg-[#151515] border border-white/10 rounded-2xl shadow-2xl z-50 p-5 space-y-4"
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className="text-blue-500" />
          <h4 className="font-black text-[10px] uppercase tracking-widest">Homework Editor</h4>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={14} /></button>
      </div>

      <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
        {homeworkJson.map((hw, idx) => (
          <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-blue-400 uppercase">
                {masterTextbooks.find(m => m.tabName === hw.book_name)?.title || hw.book_name}
              </span>
              <BookUnitsPicker 
                tabName={hw.book_name} 
                onPick={(range) => {
                  const newHw = [...homeworkJson];
                  newHw[idx].range = hw.range ? `${hw.range}, ${range}` : range;
                  onUpdate(newHw);
                }} 
              />
            </div>
            <input 
              type="text" 
              value={hw.range} 
              placeholder="e.g. 10-15, 20-24" 
              onChange={(e) => {
                const newHw = [...homeworkJson];
                newHw[idx].range = e.target.value;
                onUpdate(newHw);
              }}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] outline-none text-white focus:border-blue-500" 
            />
          </div>
        ))}
        
        <button 
          onClick={() => onUpdate([...homeworkJson, { type: 'custom', book_name: '기타/프린트', range: '' }])}
          className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[9px] font-bold text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-all"
        >
          + Add Extra Task
        </button>
      </div>

      <button 
        onClick={onClose} 
        className="w-full bg-blue-600 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all"
      >
        Set Assignment
      </button>
    </motion.div>
  );
}

function BookUnitsPicker({ tabName, onPick }: { tabName: string, onPick: (range: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnits = async () => {
    if (tabName === '기타/프린트') return;
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
      <button onClick={() => setIsOpen(!isOpen)} className="text-[8px] font-bold text-blue-500 hover:underline">Pick Units</button>
      {isOpen && (
        <div className="absolute right-0 top-6 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-[60] p-3 space-y-2">
          <p className="text-[8px] font-black text-gray-500 uppercase border-b border-white/5 pb-1 mb-2">Select Unit Block</p>
          <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
            {loading ? <p className="text-[8px] text-gray-500 italic">Loading...</p> : 
             units.map((u, i) => (
               <button 
                 key={i} onClick={() => { onPick(`${u[1]}-${u[2]}`); setIsOpen(false); }}
                 className="w-full text-left p-1.5 hover:bg-blue-600/20 rounded text-[9px] text-gray-300 transition-all border border-transparent hover:border-blue-500/30"
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
