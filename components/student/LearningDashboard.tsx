'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle2, ClipboardCheck, ChevronRight, TrendingUp, BookOpen, Target, Clock, AlertTriangle } from 'lucide-react';

interface LearningDashboardProps {
  student: any;
  lastSession: any;
  todaySession: any;
  selectedDate: string;
  currentSelfEval: number | null;
  handleSelfEval: (level: number) => void;
  handleTodoAchievement: (percentage: number) => void;
  todayPlan: string;
}

function StudentTimer({ startedAt, duration }: { startedAt: number, duration: number }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, duration * 60 - elapsed);
      setTimeLeft(remaining);
      setIsExpired(remaining <= 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startedAt, duration]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = Math.min(100, ( ( (duration * 60) - timeLeft ) / (duration * 60) ) * 100);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }} 
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl border-2 transition-all shadow-2xl ${isExpired ? 'bg-red-600/20 border-red-500 shadow-red-900/20' : 'bg-indigo-600/10 border-indigo-500/50 shadow-indigo-900/20'}`}
    >
      <div className="absolute bottom-0 left-0 h-1.5 transition-all duration-1000 bg-indigo-500 z-10" style={{ width: `${100 - progress}%` }} />
      {isExpired && <div className="absolute inset-0 bg-red-600/10 animate-pulse pointer-events-none" />}
      
      <div className="p-4 flex items-center justify-between gap-6 relative z-20">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${isExpired ? 'bg-red-600 shadow-red-500/30' : 'bg-indigo-600 shadow-indigo-500/30'}`}>
            {isExpired ? <AlertTriangle className="text-white" size={20} /> : <Clock className="text-white" size={20} />}
          </div>
          <div className="text-left">
            <h4 className={`text-[10px] font-black uppercase tracking-widest ${isExpired ? 'text-red-400' : 'text-indigo-400'}`}>
              {isExpired ? 'Time Expired' : 'Test in Progress'}
            </h4>
            <p className="text-[12px] font-bold text-white/70">
              {isExpired ? '시험 시간이 종료되었습니다.' : '선생님이 설정한 시험 시간이 흐르고 있습니다.'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-black tabular-nums leading-none tracking-tighter ${isExpired ? 'text-red-500' : 'text-white'}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function LearningDashboard({
  student,
  lastSession,
  todaySession,
  selectedDate,
  currentSelfEval,
  handleSelfEval,
  handleTodoAchievement,
  todayPlan
}: LearningDashboardProps) {
  const [isSlim, setIsSlim] = useState(false); // 💡 슬림 모드 상태 추가

  return (
    <div className="space-y-3">
      {/* 💡 타이머 섹션 (선생님이 설정했을 때만 노출) */}
      {todaySession?.timer_started_at && todaySession?.timer_duration && (
        <div className="mb-6">
          <StudentTimer startedAt={todaySession.timer_started_at} duration={todaySession.timer_duration} />
        </div>
      )}

      {/* 💡 대시보드 컨트롤 헤더: 여백 축소 */}
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="flex items-center gap-2">
          <Target className="text-gray-600" size={12} />
          <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Dashboard View</span>
        </div>
        <button 
          onClick={() => setIsSlim(!isSlim)}
          className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter transition-all border ${
            isSlim 
              ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/20' 
              : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'
          }`}
        >
          {isSlim ? 'Expand Cards' : 'Minimize Info'}
        </button>
      </div>

      <div className={isSlim ? "grid grid-cols-1 gap-1.5" : "space-y-8"}>
        {/* 1. 학생 미션 */}
        {student?.recent_mission ? (
          <motion.div 
            layout
            className={isSlim 
              ? "bg-[#0a0a0a] border border-amber-500/20 rounded-md p-1.5 flex items-center gap-3 overflow-hidden shadow-lg shadow-amber-900/10"
              : "bg-gradient-to-r from-amber-400/50 to-orange-500/50 p-0.5 rounded-xl mb-2 shadow-[0_0_30px_rgba(245,158,11,0.2)]"
            }
          >
            <div className={isSlim ? "flex items-center gap-3 w-full" : "bg-[#0a0a0a] rounded-[10px] p-6 flex items-center gap-6 border border-amber-400/10"}>
              <div className={isSlim ? "w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shrink-0 border border-amber-300/50" : "w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-amber-900/40 border border-amber-300/50"}>
                <Zap className="text-black fill-black" size={isSlim ? 10 : 28} strokeWidth={3} />
              </div>
              <div className={`text-left flex-1 min-w-0 ${isSlim ? "overflow-x-auto no-scrollbar" : ""}`}>
                <p className={`${isSlim ? "text-[13px] whitespace-nowrap" : "text-[22px]"} font-black text-white tracking-tight`}>{student.recent_mission}</p>
                {!isSlim && (
                  <p className="text-[11px] font-bold text-amber-400 mt-2.5 flex items-center gap-1.5">
                    <CheckCircle2 size={12} /> 최근에 이거 꼭 해야 해! 집중해서 완료하자.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          !isSlim && (
            <div className="relative py-2 group">
              <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-amber-500"></div></div>
              <div className="relative flex justify-center"><span className="bg-[#080808] px-6 text-[12px] font-black text-amber-500 uppercase tracking-[0.4em] border-2 border-amber-500 rounded-full py-1">학생미션</span></div>
            </div>
          )
        )}

        {/* 2. 과제 확인 */}
        {lastSession && (
          <motion.div 
            layout
            className={isSlim 
              ? "bg-[#0a0a0a] border border-blue-500/20 rounded-md p-1.5 flex items-center gap-3 overflow-hidden shadow-lg shadow-blue-900/10"
              : "bg-blue-600/5 border border-blue-500/20 rounded-lg shadow-xl text-left border-l-4 border-l-blue-500 flex flex-col overflow-hidden"
            }
          >
            {isSlim ? (
              <div className="flex items-center gap-3 w-full">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0 border border-blue-400/50">
                  <ClipboardCheck className="text-white" size={10} />
                </div>
                <div className="text-left flex-1 min-w-0 overflow-x-auto no-scrollbar">
                  <p className="text-[13px] font-bold text-blue-200 whitespace-nowrap">{lastSession.homework_text || '기록된 숙제가 없습니다.'}</p>
                </div>
                {currentSelfEval && (
                  <div className="bg-blue-600 px-2 py-0.5 rounded-[3px] text-white text-[9px] font-black shadow-lg shrink-0">
                    Lvl {currentSelfEval}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="px-6 py-1 bg-white/[0.03] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <ClipboardCheck className="text-blue-500" size={14} />
                      <h4 className="text-[11px] font-black text-white uppercase tracking-widest">과제확인</h4>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-400 tabular-nums">
                      <span>({lastSession.session_date.slice(5).replace('-', '.')})</span>
                      <ChevronRight size={10} className="text-blue-500/50" />
                      <span className="bg-blue-500/10 px-1.5 py-0.5 rounded text-blue-300">({selectedDate.slice(5).replace('-', '.')})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <button 
                        key={num} 
                        onClick={() => handleSelfEval(num)} 
                        className={`w-7 h-7 shrink-0 rounded-[2px] text-[13px] font-black transition-all border ${
                          (currentSelfEval !== null && num <= currentSelfEval) 
                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg' 
                            : 'bg-white/10 border-white/20 text-white hover:border-blue-500/50'
                        }`}
                      >
                        {currentSelfEval === null ? num : (num === currentSelfEval ? num : '')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-[18px] font-bold text-blue-200 leading-tight italic whitespace-pre-wrap">
                    <span className="text-blue-400 text-2xl font-black mr-1 opacity-80">"</span>
                    {lastSession.homework_text || '기록된 숙제가 없습니다.'}
                    <span className="text-blue-400 text-2xl font-black ml-1 opacity-80">"</span>
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* 3. 오늘 할 일 */}
        <motion.div 
          layout
          className={isSlim 
            ? "bg-[#0a0a0a] border border-emerald-500/20 rounded-md p-1.5 flex items-center gap-3 overflow-hidden shadow-lg shadow-emerald-900/10"
            : "bg-emerald-600/5 border border-emerald-500/20 rounded-lg shadow-xl text-left border-l-4 border-l-emerald-500 flex flex-col overflow-hidden"
          }
        >
          {isSlim ? (
            <div className="flex items-center gap-3 w-full">
              <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center shrink-0 border border-emerald-400/50">
                <TrendingUp className="text-white" size={10} />
              </div>
              <div className="text-left flex-1 min-w-0 overflow-x-auto no-scrollbar">
                <p className="text-[13px] font-bold text-white whitespace-nowrap">{todayPlan ? todayPlan.trim().replace(/\n/g, ' | ') : '오늘 학원에서 할일이 입력될 예정입니다.'}</p>
              </div>
              {todaySession?.todo_achievement > 0 && (
                <div className="bg-emerald-600 px-2 py-0.5 rounded-[3px] text-white text-[9px] font-black shadow-lg tabular-nums shrink-0">
                  {todaySession.todo_achievement}%
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="px-6 py-0.5 bg-white/[0.03] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-emerald-500" size={16} />
                  <h4 className="text-[12px] font-black text-white uppercase tracking-widest">오늘 할 일 (To-Do)</h4>
                </div>
                <div className="flex-1 flex items-center justify-end gap-0.5 overflow-x-auto no-scrollbar pr-2">
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(num => (
                    <button 
                      key={num} 
                      onClick={() => handleTodoAchievement(num)} 
                      className={`w-7 h-7 shrink-0 rounded-[2px] text-[13px] font-black transition-all border ${
                        (todaySession?.todo_achievement && num <= todaySession.todo_achievement) 
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' 
                          : 'bg-white/10 border-white/20 text-white hover:border-emerald-500/50'
                      }`}
                    >
                      {(!todaySession?.todo_achievement) ? num : (num === todaySession?.todo_achievement ? num : '')}
                    </button>
                  ))}
                  <span className="text-[11px] font-black text-emerald-500/60 ml-1">%</span>
                </div>
              </div>
              <div className="p-4 space-y-1.5">
                {todayPlan ? (
                  todayPlan.split('\n').filter(l => l.trim()).map((task, i) => (
                    <div key={i} className="flex items-start gap-3 group/task">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] group-hover/task:scale-125 transition-transform" />
                      <p className="text-[14.5px] font-bold text-white leading-tight">{task}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center opacity-30">
                    <CheckCircle2 size={24} className="text-emerald-500 mb-2" />
                    <p className="text-[12px] font-bold text-white italic">
                      {new Date(selectedDate) < new Date(new Date().setHours(0,0,0,0)) 
                        ? '이 날짜에는 기록된 학습 정보가 없습니다.' 
                        : '오늘 학원에서 할일이 입력될 예정입니다.'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
