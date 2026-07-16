'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, CheckCircle2, Video, ClipboardCheck, RotateCcw, Flag, Trophy
} from 'lucide-react';
import { Student } from '@/types/dashboard';
import { useBookProgress } from '@/hooks/useBookProgress';

interface BookProgressRowProps {
  student: Student;
  bookCode: string;
  textbook: any;
  onSaveLegacy?: (studentId: string, bookCode: string, unitName: string) => Promise<boolean>;
}

export default function BookProgressRow({ student, bookCode, textbook, onSaveLegacy }: BookProgressRowProps) {
  const {
    units,
    isLoading,
    isSavingLegacy,
    stepStates,
    toggleStep,
    handleFlagClick,
    bookPageStatus,
    completedUnitNames,
    getMissingRanges,
    handleSupplement,
  } = useBookProgress({ student, bookCode, textbook, onSaveLegacy });

  const targetGradeRaw = student.book_courses?.[bookCode] || student.course || 'C';
  const isKeep = String(targetGradeRaw).endsWith('-keep');
  const targetGrade = isKeep ? String(targetGradeRaw).replace('-keep', '') : targetGradeRaw;

  return (
    <div className={`space-y-2 transition-opacity ${isKeep ? 'opacity-70' : ''}`}>
      {/* 교재 제목 바 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded flex items-center justify-center border transition-colors ${isKeep ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-600/20 text-blue-500 border-blue-500/20'}`}>
            <BookOpen size={14} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-[13px] font-black text-white">{textbook?.title || bookCode}</h3>
              {isKeep && <span className="bg-amber-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter shadow-lg shadow-amber-500/10">KEEP</span>}
            </div>
            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Target Grade: {targetGrade}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[12px] font-black text-white tabular-nums">
            {units.length > 0 ? Math.round((completedUnitNames.size / units.length) * 100) : 0}%
          </span>
          <span className="text-[7px] font-bold text-gray-600 uppercase ml-1.5">Done</span>
        </div>
      </div>

      {/* 단원 리스트 */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar-h -mx-0.5 px-0.5">
        {isLoading ? (
          [...Array(6)].map((_, i) => <div key={i} className="min-w-[170px] h-20 bg-white/[0.02] animate-pulse rounded-[4px]" />)
        ) : (
          units.map((u, idx) => {
            const isCompleted = completedUnitNames.has(u.unit);
            const startP = parseInt(u.start_page || '0');
            const endP = parseInt(u.end_page || '0');
            const totalInUnit = Math.max(1, endP - startP + 1);
            
            // 스마트 상태별 페이지 수 계산
            let wrongCount = 0; let classworkCount = 0; let homeworkCount = 0;
            for (let i = startP; i <= endP; i++) {
              const status = bookPageStatus.get(i);
              if (status === 'wrong') wrongCount++;
              else if (status === 'classwork') classworkCount++;
              else if (status === 'homework') homeworkCount++;
            }
            
            const totalCovered = wrongCount + classworkCount + homeworkCount;
            const progressRatio = Math.min(1, totalCovered / totalInUnit);

            return (
              <motion.div 
                key={idx}
                className={`min-w-[170px] p-3 rounded-[4px] border transition-all relative overflow-hidden shrink-0 ${isCompleted ? 'bg-amber-500/5 border-amber-500/20' : 'bg-[#0f0f0f] border-white/5'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="space-y-0.5">
                    <h4 className={`text-[10px] font-black tracking-tight truncate w-24 ${isCompleted ? 'text-amber-500' : 'text-gray-300'}`} title={u.unit}>{u.unit}</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isCompleted ? (
                      <CheckCircle2 size={12} className="text-amber-500 shrink-0" />
                    ) : (
                      <button 
                        onClick={() => handleFlagClick(idx)}
                        disabled={!!isSavingLegacy}
                        className="text-gray-600 hover:text-blue-500 transition-colors p-0.5"
                        title="이 단원까지 일괄 완료 처리 (Flag)"
                      >
                        {isSavingLegacy === u.unit ? (
                          <RotateCcw size={10} className="animate-spin" />
                        ) : (
                          <Flag size={10} />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-[11px] font-black text-white tabular-nums">{Math.round((isCompleted ? 1 : progressRatio) * 100)}%</span>
                  <span className="text-[7px] font-bold text-gray-600 tabular-nums uppercase">p.{startP} ~ {endP}</span>
                </div>

                {/* 누락 페이지 탐지 표시 */}
                {!isCompleted && progressRatio < 1 && totalCovered > 0 && (
                  <div className="mb-2 px-1 py-0.5 bg-red-500/10 border border-red-500/20 rounded-[2px] flex items-center justify-between group/missing">
                    <span className="text-[7px] font-black text-red-400 uppercase tracking-tighter">
                      Gap: p.{getMissingRanges(startP, endP).join(', ')}
                    </span>
                    <button 
                      onClick={() => handleSupplement(u.unit, getMissingRanges(startP, endP).join(', '))}
                      className="text-[6px] font-black bg-red-500 text-white px-1 rounded-[1px] opacity-0 group-hover/missing:opacity-100 transition-opacity"
                    >
                      FILL
                    </button>
                  </div>
                )}

                {/* 스마트 멀티 컬러 프로그레스 바 */}
                <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden flex mb-3 border border-white/[0.03]">
                  {isCompleted ? (
                    <div className="h-full bg-amber-500 w-full" />
                  ) : (
                    <>
                      <div style={{ width: `${(classworkCount / totalInUnit) * 100}%` }} className="h-full bg-emerald-500 transition-all duration-700" />
                      <div style={{ width: `${(wrongCount / totalInUnit) * 100}%` }} className="h-full bg-amber-500 transition-all duration-700 shadow-[inset_-1px_0_0_rgba(0,0,0,0.2)]" />
                      <div style={{ width: `${(homeworkCount / totalInUnit) * 100}%` }} className="h-full bg-blue-500 transition-all duration-700 shadow-[inset_-1px_0_0_rgba(0,0,0,0.2)]" />
                    </>
                  )}
                </div>

                {/* 하단 4개 체크리스트 박스 */}
                <div className="grid grid-cols-4 gap-1 h-5">
                  {[
                    { id: 'video', icon: <Video size={8} />, label: '강의 시청' },
                    { id: 'test', icon: <ClipboardCheck size={8} />, label: '단원 평가' },
                    { id: 'retry', icon: <RotateCcw size={8} />, label: '오답 풀이' },
                    { id: 'final', icon: <Trophy size={8} />, label: '최종 마무리' }
                  ].map((step, sIdx) => {
                    const isStepDone = stepStates[u.unit]?.[sIdx] || (isCompleted && sIdx < 4);
                    return (
                      <button 
                        key={step.id} title={step.label}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          toggleStep(u.unit, sIdx); 
                          if (sIdx === 3 && !isStepDone) {
                            handleFlagClick(idx); 
                          }
                        }}
                        className={`rounded-[2px] border border-white/5 flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                          isStepDone 
                            ? (sIdx === 3 
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30')
                            : 'bg-white/[0.02] text-gray-700 hover:text-gray-400 hover:bg-white/5'
                        }`}
                      >
                        {step.icon}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
