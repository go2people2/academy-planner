'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus } from 'lucide-react';

interface LearningHistoryListProps {
  allLogs: any[];
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  teacherPresets?: any;
}

export default function LearningHistoryList({ allLogs, isHistoryOpen, setIsHistoryOpen, teacherPresets }: LearningHistoryListProps) {
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
            <div className="relative space-y-2 before:content-[''] before:absolute before:left-[52px] before:top-2 before:bottom-2 before:w-px before:bg-white/20 text-left max-h-[500px] overflow-y-auto pr-2 custom-scrollbar-v">
              {allLogs.length === 0 ? (
                <p className="text-xs text-gray-600 italic px-4 text-left">학습 기록이 없습니다.</p>
              ) : (
                allLogs.map((log, i) => {
                  const displayDate = log.session_date.slice(5).replace('-', '.'); // MM.DD
                  
                  let todoAchievement = 0;
                  try { if (log.test_result?.startsWith('{')) todoAchievement = JSON.parse(log.test_result).todo_achievement || 0; } catch (e) {}
                  
                  let hwEval: number | null = null;
                  const notes = log.special_notes || '';
                  const match = notes.match(/\[숙제이행: (\d+)단계\]/);
                  if (match) {
                    hwEval = parseInt(match[1]);
                  } else if (teacherPresets) {
                    if (teacherPresets.perfect && notes.includes(teacherPresets.perfect)) hwEval = 10;
                    else if (teacherPresets.good && notes.includes(teacherPresets.good)) hwEval = 8;
                    else if (teacherPresets.neutral && notes.includes(teacherPresets.neutral)) hwEval = 6;
                    else if (teacherPresets.poor && notes.includes(teacherPresets.poor)) hwEval = 4;
                    else if (teacherPresets.bad && notes.includes(teacherPresets.bad)) hwEval = 2;
                  }

                  return (
                    <div key={i} className="flex gap-5 items-start">
                      {/* 💡 날짜를 완전한 흰색으로 강조 */}
                      <div className="w-[42px] shrink-0 text-right pt-2">
                        <p className="text-[11px] font-black text-white tabular-nums tracking-tighter">
                          {displayDate}
                        </p>
                      </div>

                      <div className="relative flex-1">
                        {/* 💡 타임라인 불렛 포인트 (최대 밝기) */}
                        <div className={`absolute left-[-15px] top-[14px] w-2 h-2 rounded-full border border-[#0a0a0a] z-10 ${i === 0 ? 'bg-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.8)]' : 'bg-gray-400'}`} />
                        
                        {/* 💡 제목이 제거된 컴팩트한 내용 박스 (테두리 최대 밝기) */}
                        <div className="bg-[#121212]/80 border border-white/30 p-3 rounded-[4px] hover:border-blue-500/50 transition-colors space-y-1 shadow-2xl">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {/* 💡 Classwork 제목 제거 */}
                              <p className="text-[12px] font-bold text-gray-200 leading-snug whitespace-pre-wrap">{log.classwork_text || '-'}</p>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
                              {todoAchievement > 0 && (
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 tabular-nums">To-Do {todoAchievement}%</span>
                              )}
                              {hwEval !== null && (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border tabular-nums ${
                                  hwEval >= 8 ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                                  hwEval >= 6 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                  hwEval >= 4 ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                                  'text-rose-400 bg-rose-500/10 border-rose-500/20'
                                }`}>
                                  HW Lvl {hwEval}
                                </span>
                              )}
                              {log.test_score !== null && log.test_score !== undefined && (
                                <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 tabular-nums">SCORE {log.test_score}%</span>
                              )}
                            </div>
                          </div>

                          {/* 💡 Homework 제목 제거 및 따옴표/기울임꼴 적용 (줄간격 극소화) */}
                          {log.homework_text && (
                            <div className="pt-1 border-t border-white/5">
                              <p className="text-[12px] font-medium text-blue-200 leading-tight italic whitespace-pre-wrap">
                                <span className="text-blue-500/80 text-[12px] font-black mr-1">"</span>
                                {log.homework_text}
                                <span className="text-blue-500/80 text-[12px] font-black ml-1">"</span>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
