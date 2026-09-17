'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle2, ClipboardCheck, ChevronRight, TrendingUp, BookOpen, Target, Clock, AlertTriangle, ChevronUp, ChevronDown, Check } from 'lucide-react';

interface LearningDashboardProps {
  student: any;
  lastSession: any;
  todaySession: any;
  selectedDate: string;
  currentSelfEval?: number | null;
  handleSelfEval?: (level: number) => void;
  handleTodoAchievement: (percentage: number) => void;
  onTodoToggle?: (index: number, totalCount: number) => void;
  todayPlan: string;
  isSlim: boolean;
  setIsSlim: (val: boolean) => void;
  approvalStatus?: 'none' | 'submitted' | 'approved';
  onSyncTasks?: (checkedTasks: string[], uncheckedTasks: string[]) => void;
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
              {isExpired ? 'TEST 시간 종료' : 'TEST 진행 중'}
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
  onTodoToggle,
  todayPlan,
  isSlim,
  setIsSlim,
  approvalStatus = 'none',
  onSyncTasks
}: LearningDashboardProps) {
  const planTasks = useMemo(() => {
    let raw = todayPlan || '';
    if (raw && typeof raw === 'string' && raw.startsWith('{')) {
      return [];
    }
    return raw ? raw.split('\n').filter(l => l.trim()) : [];
  }, [todayPlan]);

  const displayOptions = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  const achievementOptions = useMemo(() => {
    const count = planTasks.length;
    if (count === 1) return [0, 100];
    if (count === 2) return [0, 50, 100];
    if (count === 3) return [0, 30, 60, 100];
    if (count === 4) return [0, 25, 50, 75, 100];
    if (count === 5) return [0, 20, 40, 60, 80, 100];
    return [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  }, [planTasks]);

  const handleTodoClick = (num: number) => {
    handleTodoAchievement(num);
    if (onSyncTasks && planTasks.length > 0) {
      let checkedCount = 0;
      for (let i = 1; i < achievementOptions.length; i++) {
        if (num >= achievementOptions[i]) {
          checkedCount = i;
        }
      }
      
      const checked: string[] = [];
      const unchecked: string[] = [];
      
      planTasks.forEach((task, i) => {
        const cleanTask = task.replace(/^[0-9]+[\.\)]\s*|^[-*#]\s*/, '').trim();
        if (i < checkedCount) {
          checked.push(cleanTask);
        } else {
          unchecked.push(cleanTask);
        }
      });
      onSyncTasks(checked, unchecked);
    }
  };

  return (
    <div className="space-y-2 md:space-y-3">
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
          <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">학습 현황</span>
        </div>
        <button 
          onClick={() => setIsSlim(!isSlim)}
          className={`w-6 h-6 flex items-center justify-center rounded-full transition-all border ${
            isSlim 
              ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/20' 
              : 'bg-gray-800 border-gray-600 text-gray-200 shadow-md hover:bg-gray-700 hover:text-white'
          }`}
        >
          {isSlim ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      <div className={isSlim ? "grid grid-cols-1 gap-1.5" : "space-y-4 md:space-y-8"}>
        {/* 1. 학생 미션 (오늘 세션의 미션 내용이 있을 때만 1:1 노출) */}
        {todaySession?.mission && (
          <motion.div 
            layout
            className={isSlim 
              ? "bg-[#0a0a0a] border border-amber-500/20 rounded-md p-1.5 flex items-center gap-3 overflow-hidden shadow-lg shadow-amber-900/10"
              : "bg-gradient-to-r from-amber-400/50 to-orange-500/50 p-0.5 rounded-xl mb-1 md:mb-2 shadow-[0_0_30px_rgba(245,158,11,0.2)]"
            }
          >
            <div className={isSlim ? "flex items-center gap-3 w-full" : "bg-[#0a0a0a] rounded-[10px] p-3 md:p-6 flex items-center gap-4 md:gap-6 border border-amber-400/10"}>
              <div className={isSlim ? "w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shrink-0 border border-amber-300/50" : "w-10 h-10 md:w-14 md:h-14 bg-amber-500 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-amber-900/40 border border-amber-300/50"}>
                <Zap className="text-black fill-black" size={isSlim ? 10 : 22} strokeWidth={3} />
              </div>
              <div className={`text-left flex-1 min-w-0 ${isSlim ? "overflow-x-auto no-scrollbar" : ""}`}>
                <p className={`${isSlim ? "text-[13px] whitespace-nowrap" : "text-[16px] md:text-[22px]"} font-black text-white tracking-tight`}>{todaySession.mission}</p>
                {!isSlim && (
                  <p className="text-[10px] md:text-[11px] font-bold text-amber-400 mt-1.5 md:mt-2.5 flex items-center gap-1.5">
                    <CheckCircle2 size={12} /> 오늘 이거 꼭 해야 해! 집중해서 완료하자.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* 2. 오늘 할 일 (할 일 내용이 있을 때만 노출) */}
        {planTasks.length > 0 && (
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
                  <p className="text-[13px] font-bold text-white whitespace-nowrap">{todayPlan ? todayPlan.trim().replace(/\n/g, ' | ') : ''}</p>
                </div>
                {todaySession?.todo_achievement > 0 && (
                  <div className="bg-emerald-600 px-2 py-0.5 rounded-[3px] text-white text-[9px] font-black shadow-lg tabular-nums shrink-0">
                    {todaySession.todo_achievement}%
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="px-3 md:px-6 py-1 bg-white/[0.03] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 md:gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="text-emerald-500" size={14} />
                      <h4 className="text-[10px] md:text-[11px] font-black text-white uppercase tracking-widest">오늘 할 일</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
                    {displayOptions.map(num => (
                        <button 
                          key={num} 
                          disabled={approvalStatus !== 'none'}
                          onClick={() => approvalStatus === 'none' && handleTodoClick(num)} 
                          className={`w-6 h-6 md:w-7 md:h-7 shrink-0 rounded-[2px] text-[11px] md:text-[13px] font-black transition-all border ${
                            (todaySession?.todo_achievement !== undefined && todaySession?.todo_achievement !== null && num <= todaySession.todo_achievement) 
                              ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' 
                              : 'bg-white/10 border-white/20 text-white hover:border-emerald-500/50'
                          } ${approvalStatus !== 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                        {(todaySession?.todo_achievement === undefined || todaySession?.todo_achievement === null) ? num : (num === todaySession?.todo_achievement ? num : '')}
                      </button>
                    ))}
                    <span className="text-[11px] font-black text-emerald-500/60 ml-1">%</span>
                  </div>
                </div>
                <div className={`space-y-1.5 ${planTasks.length > 0 ? "p-3 md:p-4" : "p-2"}`}>
                  {planTasks.map((task, i) => {
                    const cleanTask = task.replace(/^[0-9]+[\.\)]\s*|^[-*#]\s*/, '').trim();
                    const isCheckboxStyle = task !== cleanTask;
                    
                    const testResultObj = todaySession?.test_result && todaySession.test_result.startsWith('{') ? JSON.parse(todaySession.test_result) : {};
                    const checkedTodos = Array.isArray(testResultObj.checked_todos) ? testResultObj.checked_todos : null;

                    let isChecked = false;
                    if (checkedTodos !== null) {
                      isChecked = checkedTodos.includes(i);
                    } else {
                      let checkedCount = 0;
                      for (let j = 1; j < achievementOptions.length; j++) {
                        if ((todaySession?.todo_achievement || 0) >= achievementOptions[j]) {
                          checkedCount = j;
                        }
                      }
                      isChecked = i < checkedCount;
                    }

                    return (
                      <div 
                        key={i} 
                        onClick={() => {
                          if (approvalStatus !== 'none') return;
                          if (isCheckboxStyle) {
                            if (onTodoToggle) {
                              onTodoToggle(i, planTasks.length);
                            } else {
                              const nextIndex = isChecked ? i : i + 1;
                              const nextValue = achievementOptions[nextIndex] || 0;
                              handleTodoClick(nextValue);
                            }
                          }
                        }}
                        className={`flex items-start gap-2 md:gap-3 group/task transition-all ${
                          isCheckboxStyle && approvalStatus === 'none' ? 'cursor-pointer hover:bg-white/5 rounded-md p-1 -m-1' : ''
                        } ${isChecked ? 'opacity-50' : ''}`}
                      >
                        {isCheckboxStyle ? (
                          <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-all ${
                            isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-500 bg-black/20 group-hover/task:border-emerald-400'
                          }`}>
                            {isChecked && <Check size={12} className="text-white" strokeWidth={4} />}
                          </div>
                        ) : (
                          <div className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] group-hover/task:scale-125 transition-transform" />
                        )}
                        <p className={`text-[13px] md:text-[14.5px] font-bold leading-snug transition-all ${
                          isChecked ? 'text-gray-400 line-through decoration-emerald-500/50' : 'text-white'
                        }`}>
                          {cleanTask}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* 3. 과제 확인 (선생님 평가 결과 실시간 반영) */}
        {lastSession && (() => {
          const session = todaySession;
          const status = session?.status;
          let testResultObj: any = {};
          if (session?.test_result && typeof session.test_result === 'string' && session.test_result.startsWith('{')) {
            try { testResultObj = JSON.parse(session.test_result); } catch (e) {}
          }
          const hwEval = testResultObj.hw_eval;
          const hwGrade = testResultObj.hw_grade || status;

          const hwGradeInfo = (() => {
            if (hwGrade === 'gradeA' || hwEval === 10 || status === 'gradeA' || status === 'perfect') {
              return { label: 'A (10점)', desc: '완벽', bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-emerald-400', badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
            }
            if (hwGrade === 'gradeB' || hwEval === 8 || hwEval === 7 || status === 'gradeB' || status === 'good') {
              return { label: 'B (8점)', desc: '우수', bg: 'bg-blue-600', border: 'border-blue-400', text: 'text-blue-400', badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
            }
            if (hwGrade === 'gradeC' || hwEval === 5 || status === 'gradeC' || status === 'neutral') {
              return { label: 'C (5점)', desc: '보통', bg: 'bg-amber-600', border: 'border-amber-400', text: 'text-amber-400', badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
            }
            if (hwGrade === 'gradeD' || hwEval === 3 || status === 'gradeD' || status === 'poor') {
              return { label: 'D (3점)', desc: '미흡', bg: 'bg-orange-600', border: 'border-orange-400', text: 'text-orange-400', badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40' };
            }
            if (hwGrade === 'gradeE' || (hwEval === 0 && hwGrade !== 'gradeF') || status === 'gradeE' || status === 'bad') {
              return { label: 'E (0점)', desc: '부진', bg: 'bg-rose-600', border: 'border-rose-400', text: 'text-rose-400', badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
            }
            if (hwGrade === 'gradeF' || (hwEval === 0 && testResultObj.hw_grade_label?.includes('평가보류'))) {
              return { label: 'F (0점 / 평가보류)', desc: '평가보류', bg: 'bg-purple-600', border: 'border-purple-400', text: 'text-purple-400', badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
            }
            return null;
          })();

          return (
            <motion.div 
              layout
              className={isSlim 
                ? `bg-[#0a0a0a] border ${hwGradeInfo ? hwGradeInfo.border : 'border-blue-500'}/20 rounded-md p-1.5 flex items-center gap-3 overflow-hidden shadow-lg shadow-blue-900/10`
                : `${hwGradeInfo ? 'bg-white/[0.02]' : 'bg-blue-600/5'} border ${hwGradeInfo ? hwGradeInfo.border : 'border-blue-500'}/20 rounded-lg shadow-xl text-left border-l-4 ${hwGradeInfo ? hwGradeInfo.border.replace('border-', 'border-l-') : 'border-l-blue-500'} flex flex-col overflow-hidden`
              }
            >
              {isSlim ? (
                <div className="flex items-center gap-3 w-full">
                  <div className={`w-6 h-6 ${hwGradeInfo ? hwGradeInfo.bg : 'bg-blue-600'} rounded-full flex items-center justify-center shrink-0 border ${hwGradeInfo ? hwGradeInfo.border : 'border-blue-400'}/50`}>
                    <ClipboardCheck className="text-white" size={10} />
                  </div>
                  <div className="text-left flex-1 min-w-0 overflow-x-auto no-scrollbar">
                    <p className="text-[13px] font-bold text-white whitespace-nowrap">{lastSession.homework_text || '기록된 숙제가 없습니다.'}</p>
                  </div>
                  {hwGradeInfo ? (
                    <div className={`${hwGradeInfo.bg} px-2 py-0.5 rounded-[3px] text-white text-[9px] font-black shadow-lg shrink-0`}>
                      {hwGradeInfo.label}
                    </div>
                  ) : (
                    <div className="bg-white/10 px-2 py-0.5 rounded-[3px] text-gray-400 text-[9px] font-bold shrink-0">
                      검사 대기
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="px-3 md:px-6 py-1.5 bg-white/[0.03] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 md:gap-2">
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <ClipboardCheck className={hwGradeInfo ? hwGradeInfo.text : "text-blue-500"} size={14} />
                        <h4 className="text-[10px] md:text-[11px] font-black text-white uppercase tracking-widest">과제확인</h4>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-400/80 tabular-nums">
                        <span>({lastSession.session_date.slice(5).replace('-', '.')})</span>
                        <ChevronRight size={10} className="text-blue-400/50" />
                        <span className="bg-blue-600/10 px-1.5 py-0.5 rounded text-blue-400">({selectedDate.slice(5).replace('-', '.')})</span>
                      </div>
                    </div>

                    {/* 선생님 검사 결과 배지 */}
                    <div className="flex items-center gap-1">
                      {hwGradeInfo ? (
                        <div className={`px-2.5 py-0.5 rounded-[3px] border text-[10.5px] md:text-[11.5px] font-black tracking-tight shadow-md flex items-center gap-1.5 ${hwGradeInfo.badgeBg}`}>
                          <CheckCircle2 size={12} className={hwGradeInfo.text} />
                          <span>선생님 평가: <b>{hwGradeInfo.label}</b></span>
                        </div>
                      ) : (
                        <div className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-gray-400 text-[10px] font-bold flex items-center gap-1">
                          <Clock size={11} className="text-gray-400" />
                          <span>선생님 검사 대기 중</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="py-2.5 px-4 md:py-3.5 md:px-6">
                    <p className="text-[13px] md:text-[15px] font-bold text-gray-200 leading-tight italic whitespace-pre-wrap">
                      <span className="text-blue-400 text-[14px] md:text-[17px] font-black mr-1 opacity-80">"</span>
                      {lastSession.homework_text || '기록된 숙제가 없습니다.'}
                      <span className="text-blue-400 text-[14px] md:text-[17px] font-black ml-1 opacity-80">"</span>
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          );
        })()}
      </div>
    </div>
  );
}
