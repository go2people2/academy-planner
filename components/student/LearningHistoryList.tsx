'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus } from 'lucide-react';
import { getCombinedTestText, RenderTestText } from './TestStatusSection';

const cleanNextQuiz = (text: string) => {
  if (!text) return '';
  return text.split('\n')
    .map(line => line.trim().startsWith('-') ? line.trim().substring(1).trim() : line.trim())
    .filter(Boolean)
    .join('\n');
};

interface LearningHistoryListProps {
  allLogs: any[];
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  teacherPresets?: any;
  opSettings?: any;
}

export default function LearningHistoryList({ allLogs, isHistoryOpen, setIsHistoryOpen, teacherPresets, opSettings }: LearningHistoryListProps) {
  return (
    <div className="space-y-6">
      <button 
        onClick={() => setIsHistoryOpen(!isHistoryOpen)} 
        className="w-full flex items-center justify-between px-1 group cursor-pointer border-t border-white/5 pt-6"
      >
        <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
          <Clock size={16} className={isHistoryOpen ? 'text-blue-500' : 'text-gray-400'} /> 
          학습 기록 이력
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
                  
                  // 💡 집에서 할 공부는 오직 homework_text만 참조 (과제와 다음 테스트의 분리)
                  const assignedHomework = log.homework_text || '';
                  
                  // 💡 다음 테스트 명칭 추출 (next_quiz_text 우선, homework_to는 폴백으로 처리)
                  let nextQuizText = log.next_quiz_text || '';
                  if (!nextQuizText && log.homework_to) {
                    try {
                      if (log.homework_to.startsWith('{')) {
                        nextQuizText = JSON.parse(log.homework_to).text || '';
                      } else {
                        nextQuizText = log.homework_to;
                      }
                    } catch (e) {
                      nextQuizText = log.homework_to;
                    }
                  }
                  
                  let hwEval: number | null = null;
                  let testType = 'score';
                  let testTotalCount = 0;
                  try { 
                    if (log.test_result?.startsWith('{')) {
                      const res = JSON.parse(log.test_result);
                      if (res.hw_eval !== undefined && res.hw_eval !== null) hwEval = res.hw_eval;
                      testType = res.type || 'score';
                      testTotalCount = res.total_count || 0;
                    } 
                  } catch (e) {}

                  if (hwEval === null) {
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
                  }

                  return (
                    <div key={i} className="flex gap-5 items-start">
                      {/* 💡 날짜 */}
                      <div className="w-[42px] shrink-0 text-right pt-2">
                        <p className="text-[11px] font-black text-white tabular-nums tracking-tighter">
                          {displayDate}
                        </p>
                      </div>

                      <div className="relative flex-1">
                        {/* 💡 타임라인 불렛 포인트 */}
                        {(() => {
                          const isExcluded = ['수업제외', '수업취소'].includes(log.attendance_status);
                          return (
                            <>
                              <div className={`absolute left-[-15px] top-[14px] w-2 h-2 rounded-full border border-[#0a0a0a] z-10 ${isExcluded ? 'bg-rose-500/80 border-rose-500/40' : i === 0 ? 'bg-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.8)]' : 'bg-gray-400'}`} />
                              
                              {/* 💡 정돈된 다단 레이아웃 내용 박스 */}
                              <div className="bg-[#121212]/80 border border-white/20 p-3 rounded-[4px] hover:border-blue-500/50 transition-colors shadow-2xl block overflow-hidden">
                                {isExcluded ? (
                                  <div className="space-y-1.5 text-left">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                        {log.attendance_status}
                                      </span>
                                    </div>
                                    <p className="text-[12px] font-bold text-gray-400 leading-snug">
                                      이 날은 공식 등록된 <span className="text-rose-400 font-extrabold">{log.attendance_status}</span>일입니다. (수업이 진행되지 않았습니다.)
                                    </p>
                                    {log.attendance_reason && (
                                      <p className="text-[11px] text-gray-500 italic bg-white/[0.02] p-1.5 rounded border border-white/5 mt-1">
                                        💬 제외 사유: {log.attendance_reason}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    {/* 오른쪽: 진도확인 & 과제확인 2개의 Bar (float-right 지정하여 오른쪽 배치 유지) */}
                                    <div className="float-right shrink-0 flex flex-col items-end gap-2 mt-0.5 ml-4 mb-2">
                                      {todoAchievement > 0 && (
                                        <div className="flex items-center gap-2">
                                          <div className="flex gap-[1px] w-[60px]">
                                            {[...Array(10)].map((_, j) => (
                                              <div key={j} className={`flex-1 h-[6px] ${j < Math.round(todoAchievement / 10) ? 'bg-emerald-400' : 'bg-emerald-900/50'}`} />
                                            ))}
                                          </div>
                                          <span className="text-[10px] font-black text-emerald-400 tabular-nums leading-none w-[42px] text-right">진도 {todoAchievement}%</span>
                                        </div>
                                      )}
                                      {hwEval !== null && hwEval > 0 && (
                                        <div className="flex items-center gap-2">
                                          <div className="flex gap-[1px] w-[60px]">
                                            {[...Array(10)].map((_, j) => (
                                              <div key={j} className={`flex-1 h-[6px] ${j < hwEval ? 'bg-blue-400' : 'bg-blue-900/50'}`} />
                                            ))}
                                          </div>
                                          <span className="text-[10px] font-black text-blue-400 tabular-nums leading-none w-[42px] text-right">과제 {hwEval}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* ① 왼쪽 & 전체: 컨텐츠 영역 */}
                                    <div className="space-y-2.5 min-w-0">
                                      {/* 1. 학원에서 한 공부 */}
                                      {log.completed_classwork_text && (
                                        <div className="space-y-0.5">
                                          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded uppercase tracking-wider">학원 공부</span>
                                          <p className="text-[12px] font-bold text-gray-200 leading-snug whitespace-pre-wrap pl-0.5">{log.completed_classwork_text}</p>
                                        </div>
                                      )}

                                      {/* 2. 집에서 할 공부 */}
                                      {assignedHomework && (
                                        <div className="space-y-0.5 pt-1.5 border-t border-white/5">
                                          <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded uppercase tracking-wider">집에서 할 공부 (과제)</span>
                                          <p className="text-[12px] font-medium text-blue-200 leading-snug italic whitespace-pre-wrap pl-0.5">
                                            <span className="text-blue-500/50 text-[12px] font-black mr-1">"</span>
                                            {assignedHomework}
                                            <span className="text-blue-500/50 text-[12px] font-black ml-1">"</span>
                                          </p>
                                        </div>
                                      )}

                                      {/* 3. 오늘 테스트 & 다음 테스트 (인라인 흐름으로 수정하여 제목 아래 넓은 가로폭 완전 활용) */}
                                      {((log.test_score !== null && log.test_score !== undefined) || log.test_status || nextQuizText) && (
                                        <div className="space-y-1.5 pt-1.5 border-t border-white/5 text-[11px]">
                                          {/* 오늘 테스트 */}
                                          {(() => {
                                            const combinedText = getCombinedTestText(log.test_status, log.test_score);
                                            if (!combinedText) return null;
                                            return (
                                              <div className="pl-0.5 text-[11px] leading-relaxed text-left">
                                                <span className="text-rose-500/80 font-bold mr-1.5 inline-block">📝 오늘TEST:</span>
                                                <RenderTestText text={combinedText} className="inline text-[11px]" />
                                              </div>
                                            );
                                          })()}

                                          {/* 다음 테스트 */}
                                          {nextQuizText && (
                                            <div className="pl-0.5 text-[11px] leading-relaxed text-left mt-1">
                                              <span className="text-indigo-400 font-bold mr-1.5 inline-block">🔮 다음TEST:</span>
                                              <RenderTestText text={nextQuizText} className="inline text-[11px]" />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </>
                          );
                        })()}
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
