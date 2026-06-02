'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus } from 'lucide-react';

interface LearningHistoryListProps {
  allLogs: any[];
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
}

export default function LearningHistoryList({ allLogs, isHistoryOpen, setIsHistoryOpen }: LearningHistoryListProps) {
  return (
    <div className="space-y-6">
      <button 
        onClick={() => setIsHistoryOpen(!isHistoryOpen)} 
        className="w-full flex items-center justify-between px-1 group cursor-pointer border-t border-white/5 pt-6"
      >
        <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
          <Clock size={16} className={isHistoryOpen ? 'text-blue-500' : 'text-gray-400'} /> 
          Learning History
        </h3>
        <motion.div animate={{ rotate: isHistoryOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <Plus size={16} className={isHistoryOpen ? 'text-blue-500' : 'text-gray-400'} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isHistoryOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="overflow-hidden"
          >
            <div className="relative pl-6 space-y-8 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-white/20 text-left max-h-[600px] overflow-y-auto pr-2 custom-scrollbar-v">
              {allLogs.length === 0 ? (
                <p className="text-xs text-white italic px-4 font-bold text-left">학습 기록을 불러오고 있습니다...</p>
              ) : (
                allLogs.map((log, i) => (
                  <div key={i} className="relative pl-8 text-left">
                    <div className={`absolute left-[-22px] top-1.5 w-3 h-3 rounded-full border-[3px] border-[#0a0a0a] ${i === 0 ? 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]' : 'bg-gray-700'}`} />
                    <div className="bg-[#121212] border border-white/10 p-6 rounded-[4px] space-y-5 hover:border-white/30 transition-colors shadow-sm">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                        <p className="text-[11px] font-black text-white uppercase tracking-widest">{log.session_date.replace(/-/g, '.')}</p>
                        {log.test_score !== null && log.test_score !== undefined && (
                          <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-[2px] border border-blue-500/30">
                            Score: {log.test_score}%
                          </span>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-[10px] font-black text-emerald-500 uppercase mb-1.5 flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-emerald-500" /> Classwork
                          </h4>
                          <p className="text-[13px] font-bold text-white leading-relaxed whitespace-pre-wrap">{log.classwork_text || '-'}</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black text-blue-500 uppercase mb-1.5 flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-blue-500" /> Homework
                          </h4>
                          <p className="text-[13px] font-bold text-white leading-relaxed whitespace-pre-wrap">{log.homework_text || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
