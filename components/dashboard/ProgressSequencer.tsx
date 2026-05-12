'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, BookOpen, User, Calendar, TrendingUp, Search, 
  CheckCircle2, AlertCircle, ChevronLeft, Video, ClipboardCheck, RotateCcw, Flag
} from 'lucide-react';
import { Student, TextbookOption } from '@/types/dashboard';

interface ProgressSequencerProps {
  students: Student[];
  masterTextbooks: TextbookOption[];
  initialStudentId?: string | null;
  onSaveLegacy?: (studentId: string, bookCode: string, unitName: string) => Promise<boolean>;
}

export default function ProgressSequencer({ students, masterTextbooks, initialStudentId, onSaveLegacy }: ProgressSequencerProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || (students[0]?.id || null));
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

  if (!selectedStudentId || students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4">
        <AlertCircle size={48} className="opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">No students available</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#050505] overflow-hidden">
      {/* 1. 왼쪽: 학생 목록 */}
      <div className="w-64 border-r border-white/5 flex flex-col bg-black/20">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <User size={14} /> Student Progress
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={12} />
            <input 
              type="text" 
              placeholder="학생 검색..."
              className="w-full bg-white/5 border border-white/10 rounded-[4px] py-2 pl-9 pr-3 text-[11px] text-white focus:outline-none focus:border-blue-500 transition-all font-bold"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar-v p-2 space-y-1">
          {students.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStudentId(s.id)}
              className={`w-full flex items-center justify-between p-3 rounded-[2px] transition-all group ${selectedStudentId === s.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
            >
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[13px] font-black truncate w-full text-left">{s.name}</span>
                <span className={`text-[8px] font-bold uppercase tracking-tighter ${selectedStudentId === s.id ? 'text-blue-100' : 'text-gray-600'}`}>{s.grade} · {s.course}</span>
              </div>
              <ChevronRight size={14} className={`transition-transform ${selectedStudentId === s.id ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* 2. 오른쪽: 전체 교재 목록 */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#080808]">
        {selectedStudent ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar-v p-5 space-y-8">
            <div className="space-y-0.5 mb-6">
              <h2 className="text-xl font-black text-white uppercase tracking-tight">{selectedStudent.name} 학생 진도표</h2>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">학습 진행도를 확인합니다.</p>
            </div>

            {selectedStudent.assigned_books.length > 0 ? (
              selectedStudent.assigned_books.map(bookCode => {
                const textbook = masterTextbooks.find(m => m.bookcode === bookCode);
                return (
                  <BookProgressRow 
                    key={bookCode}
                    student={selectedStudent}
                    bookCode={bookCode}
                    textbook={textbook}
                    onSaveLegacy={onSaveLegacy}
                  />
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-700 gap-2">
                <BookOpen size={48} className="opacity-10 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">배정된 교재가 없습니다</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">학생을 선택해주세요</div>
        )}
      </div>
    </div>
  );
}

function BookProgressRow({ student, bookCode, textbook, onSaveLegacy }: { student: Student, bookCode: string, textbook: any, onSaveLegacy?: any }) {
  const [units, setUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingLegacy, setIsSavingLegacy] = useState<string | null>(null);
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
    async function fetchUnits() {
      if (!textbook) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/textbooks/${bookCode}`);
        if (res.ok) {
          const data = await res.json();
          setUnits(data || []);
        }
      } catch (e) { console.error('Fetch units error:', e); } finally { setIsLoading(false); }
    }
    fetchUnits();
  }, [bookCode, textbook]);

  const handleFlagClick = async (targetUnitIdx: number) => {
    if (!onSaveLegacy || isSavingLegacy) return;
    
    const targetUnitName = units[targetUnitIdx].unit;

    if (!confirm(`[${targetUnitName}] 단원을 완료 처리하시겠습니까?\n(기존 기록이 없어도 완료바가 100% 차게 됩니다)`)) return;

    setIsSavingLegacy(targetUnitName);
    const success = await onSaveLegacy(student.id, bookCode, targetUnitName);
    setIsSavingLegacy(null);

    if (success) {
      alert(`[${targetUnitName}] 단원이 완료 처리되었습니다.`);
    }
  };

  const bookHistoryPages = useMemo(() => {
    const pages = new Set<number>();
    student.allLogs.forEach((log: any) => {
      const combinedJson = [...(log.classwork_json || []), ...(log.homework_json || [])];
      combinedJson.forEach((h: any) => {
        if (h.book_name === bookCode && h.range) {
          const matches = h.range.match(/p(\d+)\s*[~-]\s*p(\d+)/i) || h.range.match(/p(\d+)\s*[~-]\s*(\d+)/i);
          if (matches) {
            const s = parseInt(matches[1]);
            const e = parseInt(matches[2]);
            if (!isNaN(s) && !isNaN(e)) { for (let i = s; i <= e; i++) pages.add(i); }
          }
        }
      });
      const combinedText = `${log.classwork_text || ''}\n${log.homework_text || ''}`;
      if (combinedText.trim()) {
        const lines = combinedText.split('\n');
        lines.forEach((line: string) => {
          if (line.includes(textbook?.title || bookCode)) {
            const matches = line.match(/p(\d+)\s*[~-]\s*p(\d+)/i) || line.match(/p(\d+)\s*[~-]\s*(\d+)/i);
            if (matches) {
              const s = parseInt(matches[1]);
              const e = parseInt(matches[2]);
              if (!isNaN(s) && !isNaN(e)) { for (let i = s; i <= e; i++) pages.add(i); }
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
      const combinedJson = [...(log.classwork_json || []), ...(log.homework_json || [])];
      combinedJson.forEach((h: any) => {
        if (h.book_name === bookCode && h.units) { h.units.forEach((u: string) => names.add(u)); }
      });
    });
    return names;
  }, [student.allLogs, bookCode]);

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
            const pagesInUnit = bookHistoryPages.filter(p => p >= startP && p <= endP);
            const progressRatio = Math.min(1, pagesInUnit.length / totalInUnit);

            return (
              <motion.div 
                key={idx}
                className={`min-w-[170px] p-3 rounded-[4px] border transition-all relative overflow-hidden shrink-0 ${isCompleted ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#0f0f0f] border-white/5'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="space-y-0.5">
                    <h4 className={`text-[10px] font-black tracking-tight truncate w-24 ${isCompleted ? 'text-emerald-400' : 'text-gray-300'}`} title={u.unit}>{u.unit}</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isCompleted ? (
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
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
                  <span className="text-[11px] font-black text-white tabular-nums">{Math.round(progressRatio * 100)}%</span>
                  <span className="text-[7px] font-bold text-gray-600 tabular-nums uppercase">p.{startP} ~ {endP}</span>
                </div>

                {/* 10단계 정밀 눈금 */}
                <div className="h-1 flex gap-[1px] mb-2">
                  {[...Array(10)].map((_, i) => {
                    const threshold = (i + 1) * 10;
                    const currentProgress = Math.round(progressRatio * 100);
                    const isActive = isCompleted || currentProgress >= threshold;
                    return (
                      <div 
                        key={i} 
                        className={`flex-1 rounded-[0.5px] transition-all duration-500 ${
                          isActive 
                            ? (isCompleted ? 'bg-emerald-500' : 'bg-blue-600') 
                            : 'bg-white/[0.05]'
                        }`} 
                      />
                    );
                  })}
                </div>

                {/* 하단 4개 체크리스트 박스 복원 */}
                <div className="grid grid-cols-4 gap-1 h-5">
                  {[
                    { id: 'video', icon: <Video size={8} />, label: '강의 시청' },
                    { id: 'test', icon: <ClipboardCheck size={8} />, label: '단원 평가' },
                    { id: 'retry', icon: <RotateCcw size={8} />, label: '오답 풀이' },
                    { id: 'final', icon: <Flag size={8} />, label: '최종 마무리' }
                  ].map((step, sIdx) => {
                    const isStepDone = stepStates[u.unit]?.[sIdx] || (isCompleted && sIdx < 4);
                    return (
                      <button 
                        key={step.id} title={step.label}
                        onClick={(e) => { e.stopPropagation(); toggleStep(u.unit, sIdx); }}
                        className={`rounded-[2px] border border-white/5 flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                          isStepDone 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
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
