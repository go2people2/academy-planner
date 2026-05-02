'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, BookOpen, FileText, CheckCircle, Play, Settings, Loader2,
  Video, ClipboardCheck, RotateCcw, Flag
} from 'lucide-react';
import { Student, TextbookOption } from '@/types/dashboard';

interface ProgressSequencerProps {
  students: Student[];
  masterTextbooks: TextbookOption[];
  initialStudentId?: string | null;
}

export default function ProgressSequencer({ students, masterTextbooks, initialStudentId }: ProgressSequencerProps) {
  const [activeStudentId, setActiveStudentId] = useState<string | null>(initialStudentId || students[0]?.id || null);

  useEffect(() => {
    if (initialStudentId) {
      setActiveStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  const activeStudent = students.find(s => s.id === activeStudentId);

  return (
    <div className="flex h-full overflow-hidden bg-[#050505]">
      {/* Track Selector (Left) */}
      <div className="w-52 border-r border-white/10 flex flex-col h-full bg-[#0a0a0a] z-20">
        <div className="p-5 border-b border-white/10 bg-white/[0.02] font-black text-[9px] uppercase text-blue-500 tracking-widest italic flex items-center justify-between">
          <span>Tracks</span>
          <Users size={12} />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {students.map(s => (
            <div key={s.id} onClick={() => setActiveStudentId(s.id)} className={`p-4 border-b border-white/[0.05] cursor-pointer transition-all relative ${activeStudentId === s.id ? 'bg-blue-600/20' : 'hover:bg-white/[0.03]'}`}>
              {activeStudentId === s.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]" />}
              <p className={`font-black text-[11px] mb-0.5 ${activeStudentId === s.id ? 'text-white' : 'text-gray-500'}`}>{s.name}</p>
              <p className="text-[9px] text-gray-600 font-bold uppercase">{s.grade} · {s.class}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline (Right) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {activeStudent ? (
          <>
            <div className="h-14 border-b border-white/10 bg-[#0d0d0d] flex items-center px-8 justify-between z-10 shadow-xl">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-black text-[10px] uppercase tracking-wider text-white">{activeStudent.name}&apos;s Master Sequence</span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-6 relative bg-[#080808] custom-scrollbar">
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundSize: '40px 40px', backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)' }} />
              {activeStudent.assigned_books.map((bookCode, i) => (
                <ProgressTrack key={i} bookCode={bookCode} student={activeStudent} masterTextbooks={masterTextbooks} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-800 uppercase font-black tracking-[0.5em]">Select track</div>
        )}
      </div>
    </div>
  );
}

function ProgressTrack({ bookCode, student, masterTextbooks }: { bookCode: string, student: Student, masterTextbooks: TextbookOption[] }) {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const textbook = masterTextbooks.find((m:any) => m.bookcode === bookCode);

  // 💡 체크리스트 상태 관리 (임시로 localStorage 사용)
  const [stepStates, setStepStates] = useState<Record<string, boolean[]>>({});

  useEffect(() => {
    const saved = localStorage.getItem(`progress_${student.id}_${bookCode}`);
    if (saved) {
      try { setStepStates(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, [student.id, bookCode]);

  const toggleStep = (unitName: string, stepIdx: number) => {
    const newState = { ...stepStates };
    const currentSteps = newState[unitName] || [false, false, false, false];
    const updatedSteps = [...currentSteps];
    updatedSteps[stepIdx] = !updatedSteps[stepIdx];
    newState[unitName] = updatedSteps;
    setStepStates(newState);
    localStorage.setItem(`progress_${student.id}_${bookCode}`, JSON.stringify(newState));
  };

  useEffect(() => {
    setLoading(true);
    fetch('/api/textbooks/unit-page')
      .then(res => res.json())
      .then(allUnits => { 
        const filtered = allUnits.filter((u: any[]) => u[0] === bookCode);
        setUnits(filtered); 
        setLoading(false); 
      })
      .catch(e => {
        console.error('ProgressTrack fetch error:', e);
        setLoading(false);
      });
  }, [bookCode]);

  // 해당 교재의 모든 숙제 수행 페이지 추출
  const bookHistoryPages = useMemo(() => {
    const pages = new Set<number>();
    student.allLogs.forEach((log: any) => {
      // 1. JSON 데이터에서 추출 (정밀함)
      (log.homework_json || []).forEach((h: any) => {
        if (h.book_name === bookCode && h.range) {
          // 💡 단원 번호(01.)와 겹치지 않게 'p' 뒤의 숫자만 추출
          const matches = h.range.match(/p(\d+)\s*[~-]\s*p(\d+)/i) || h.range.match(/p(\d+)\s*[~-]\s*(\d+)/i);
          if (matches) {
            const s = parseInt(matches[1]);
            const e = parseInt(matches[2]);
            if (!isNaN(s) && !isNaN(e)) {
              for (let i = s; i <= e; i++) pages.add(i);
            }
          }
        }
      });

      // 2. 텍스트 데이터에서 보완 추출 (수동 입력 대비)
      if (log.homework_text) {
        const lines = log.homework_text.split('\n');
        lines.forEach((line: string) => {
          // 현재 교재명이 포함된 줄인지 확인
          if (line.includes(textbook?.title || bookCode)) {
            const matches = line.match(/p(\d+)\s*[~-]\s*p(\d+)/i) || line.match(/p(\d+)\s*[~-]\s*(\d+)/i);
            if (matches) {
              const s = parseInt(matches[1]);
              const e = parseInt(matches[2]);
              if (!isNaN(s) && !isNaN(e)) {
                for (let i = s; i <= e; i++) pages.add(i);
              }
            }
          }
        });
      }
    });
    return Array.from(pages);
  }, [student.allLogs, bookCode, textbook?.title]);


  const completedUnitNames = useMemo(() => {
    const names = new Set<string>();
    student.allLogs.forEach((log: any) => {
      (log.homework_json || []).forEach((h: any) => {
        if (h.book_name === bookCode && h.units) {
          h.units.forEach((u: string) => names.add(u));
        }
      });
    });
    return names;
  }, [student.allLogs, bookCode]);

  return (
    <div className="space-y-3 relative z-10">
      <div className="flex items-center gap-3 bg-white/[0.03] w-fit pr-6 pl-2 py-1.5 rounded-xl border border-white/5 shadow-inner">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg"><BookOpen size={14} /></div>
        <div className="flex flex-col">
          <h3 className="font-black text-[11px] text-white tracking-tight leading-none mb-0.5">{textbook?.title || bookCode}</h3>
          <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">{bookCode}</span>
        </div>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar-h px-1">
        {loading ? (
          <div className="flex gap-3">{Array.from({length: 6}).map((_, i) => <div key={i} className="min-w-[200px] h-32 rounded-2xl bg-white/[0.02] border border-white/10 animate-pulse" />)}</div>
        ) : units.length === 0 ? (
          <div className="p-8 border border-dashed border-white/5 rounded-2xl text-[9px] text-gray-700 font-bold uppercase tracking-widest italic bg-white/[0.01]">
            unit-page에 단원 정보가 없습니다. ({bookCode})
          </div>
        ) : (
          units.map((u, idx) => {
            const unitName = u[2];
            const startP = Number(u[3]); 
            const endP = Number(u[4]);
            const isDone = completedUnitNames.has(unitName);
            
            const totalInUnit = endP - startP + 1;
            const pagesInUnit = bookHistoryPages.filter(p => p >= startP && p <= endP);
            const maxPageInUnit = pagesInUnit.length > 0 ? Math.max(...pagesInUnit) : 0;
            const progressRatio = maxPageInUnit > 0 ? (maxPageInUnit - startP + 1) / totalInUnit : 0;

            return (
              <motion.div 
                key={idx} 
                whileHover={{ scale: 1.02, y: -2 }} 
                className={`min-w-[200px] h-[160px] rounded-2xl border flex flex-col relative overflow-hidden transition-all duration-300 ${
                  isDone 
                    ? 'bg-[#1a1a1a] border-blue-500/50 shadow-[0_10px_30px_rgba(37,99,235,0.1)]' 
                    : 'bg-[#0a0a0a] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex-1 flex flex-col p-4 gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <p className={`font-black text-[12px] leading-[1.3] line-clamp-2 ${isDone ? 'text-white' : 'text-gray-300'}`}>
                      {unitName}
                    </p>
                    {isDone && <CheckCircle size={12} className="text-blue-500 shrink-0 mt-0.5" />}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-black text-gray-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 uppercase">Page</span>
                    <span className="text-[10px] font-bold text-gray-400">P.{startP} ~ P.{endP}</span>
                  </div>
{/* 3행: 4등분 진도 영역 (더 가늘고 각지게) */}
<div className="grid grid-cols-4 gap-1 h-2">
  {[0, 1, 2, 3].map(i => {
    const threshold = (i + 1) * 0.25;
    const startThreshold = i * 0.25;
    let bgColor = 'bg-white/[0.02]';
    if (isDone || progressRatio >= threshold) bgColor = 'bg-blue-500/40 border-blue-400/20';
    else if (progressRatio > startThreshold) bgColor = 'bg-emerald-500/60 border-emerald-400/40 animate-pulse';
    return <div key={`r3-${i}`} className={`rounded-[1px] border border-white/5 transition-all duration-500 ${bgColor}`} />;
  })}
</div>


                  <div className="grid grid-cols-4 gap-1 h-6">
                    {[
                      { id: 'video', icon: <Video size={10} />, label: '강의 시청' },
                      { id: 'test', icon: <ClipboardCheck size={10} />, label: '단원 평가' },
                      { id: 'retry', icon: <RotateCcw size={10} />, label: '오답 풀이' },
                      { id: 'final', icon: <Flag size={10} />, label: '최종 마무리' }
                    ].map((step, sIdx) => {
                      const isStepDone = stepStates[unitName]?.[sIdx] || (isDone && sIdx < 4);
                      return (
                        <button 
                          key={step.id} title={step.label}
                          onClick={(e) => { e.stopPropagation(); toggleStep(unitName, sIdx); }}
                          className={`rounded-md border border-white/5 flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                            isStepDone 
                              ? 'bg-emerald-500/40 text-emerald-300 border-emerald-400/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                              : 'bg-white/[0.02] text-gray-700 hover:text-gray-400 hover:bg-white/5'
                          }`}
                        >
                          {step.icon}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="h-1 w-full bg-black/40 flex items-center">
                  <div className={`h-full transition-all duration-1000 ${
                    isDone ? 'w-full bg-gradient-to-r from-blue-600 to-indigo-500' : 'w-0'
                  }`} />
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
