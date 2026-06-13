'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, BookOpen, User, Calendar, TrendingUp, Search, 
  CheckCircle2, AlertCircle, ChevronLeft, Video, ClipboardCheck, RotateCcw, Flag
} from 'lucide-react';
import { Student, TextbookOption, SessionLog } from '@/types/dashboard';

interface ProgressSequencerProps {
  students: Student[];
  masterTextbooks: TextbookOption[];
  initialStudentId?: string | null;
  onSaveLegacy?: (studentId: string, bookCode: string, unitName: string) => Promise<boolean>;
}

export default function ProgressSequencer({ students, masterTextbooks, initialStudentId, onSaveLegacy }: ProgressSequencerProps) {
  const [searchQuery, setSearchQuery] = useState(''); // 💡 검색어 상태
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || (students[0]?.id || null));
  
  // 💡 검색 필터링 로직
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(s => 
      (s.name || '').toLowerCase().includes(query) || 
      (s.grade || '').toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-[4px] py-2 pl-9 pr-3 text-[11px] text-white focus:outline-none focus:border-blue-500 transition-all font-bold"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar-v p-2 space-y-1">
          {filteredStudents.map((s, idx) => (
            <button
              key={s.id || idx}
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{selectedStudent.name} 학생 진도표</h2>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">학습 진행도를 확인합니다.</p>
                </div>
                {/* 💡 스마트 프로그레스 바 범례 추가 */}
                <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase">오답완료</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[9px] font-black text-amber-500 uppercase">처음풀기</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[9px] font-black text-blue-500 uppercase">숙제부여</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedStudent.assigned_books.length > 0 ? (
              selectedStudent.assigned_books
                .filter(code => !!code) // 💡 빈 문자열(코드)은 건너뛰어 중복 키 에러 방지
                .map(bookCode => {
                // 💡 더욱 유연한 교재 매칭 (정확히 일치하지 않아도 코드 앞부분이 같으면 매칭 시도)
                const textbook = masterTextbooks.find(m => m.bookcode === bookCode) || 
                                masterTextbooks.find(m => m.bookcode.toLowerCase().startsWith(bookCode.toLowerCase())) ||
                                masterTextbooks.find(m => bookCode.toLowerCase().startsWith(m.bookcode.toLowerCase()));
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
        // 💡 학생에게 저장된 코드(bookCode)가 아닌, 마스터 리스트의 실제 코드(textbook.bookcode)로 요청
        const res = await fetch(`/api/textbooks/${textbook.bookcode}`);
        if (res.ok) {
          const data = await res.json();
          setUnits(data || []);
        }
      } catch (e) { console.error('Fetch units error:', e); } finally { setIsLoading(false); }
    }
    fetchUnits();
  }, [textbook]); // textbook.bookcode가 변경되면 다시 호출

  const handleFlagClick = async (targetUnitIdx: number) => {
    if (!onSaveLegacy || isSavingLegacy) return;
    
    const targetUnitName = units[targetUnitIdx].unit;

    if (!confirm(`[${targetUnitName}] 단원을 완료 처리하시겠습니까?\n(기존 기록이 없어도 완료바가 100% 차게 됩니다)`)) return;

    setIsSavingLegacy(targetUnitName);
    // 💡 저장 시에도 마스터 리스트의 실제 코드를 사용
    const success = await onSaveLegacy(student.id, textbook.bookcode, targetUnitName);
    setIsSavingLegacy(null);

    if (success) {
      alert(`[${targetUnitName}] 단원이 완료 처리되었습니다.`);
    }
  };

  const bookPageStatus = useMemo(() => {
    const statusMap = new Map<number, 'wrong' | 'classwork' | 'homework'>();
    const actualBookCode = textbook?.bookcode || bookCode;
    const title = textbook?.title || bookCode;

    student.allLogs.forEach((log: SessionLog) => {
      const processText = (t: string | undefined | null, baseType: 'classwork' | 'homework') => {
        if (!t) return;
        const displayTitle = (textbook?.title || bookCode).replace(/^\[.*?\]\s*/, '');
        const cleanTitle = displayTitle.replace(/\s+/g, '').toLowerCase();
        const cleanBookCode = actualBookCode.replace(/\s+/g, '').toLowerCase();
        
        t.split('\n').forEach(line => {
          const cleanLine = line.replace(/\s+/g, '').toLowerCase();
          if (cleanLine.includes(cleanTitle) || cleanLine.includes(cleanBookCode)) {
            const isWrong = cleanLine.includes('[오답]');
            const isCancel = cleanLine.includes('[취소]');
            const status = baseType === 'classwork' ? (isWrong ? 'wrong' : 'classwork') : (isCancel ? 'cancel' : 'homework');
            const regex = /p(\d+)[~-]?p?(\d+)?/gi;
            let match;
            while ((match = regex.exec(cleanLine)) !== null) {
              const s = parseInt(match[1]); const e = match[2] ? parseInt(match[2]) : s;
              if (!isNaN(s) && !isNaN(e)) {
                for (let i = Math.min(s, e); i <= Math.max(s, e); i++) {
                  const current = statusMap.get(i);
                  if (status === 'cancel') {
                    if (current === 'homework') statusMap.delete(i);
                  } else if (status === 'wrong') {
                    statusMap.set(i, 'wrong');
                  } else if (status === 'classwork' && current !== 'wrong') {
                    statusMap.set(i, 'classwork');
                  } else if (status === 'homework' && !current) {
                    statusMap.set(i, 'homework');
                  }
                }
              }
            }
          }
        });
      };

      processText(log.homework_text, 'homework');
      processText(log.classwork_text, 'classwork');
      processText(log.completed_classwork_text, 'classwork');

      // 3. JSON 데이터 (보정용)
      const combinedJson = [...(log.classwork_json || []), ...(log.homework_json || [])];
      combinedJson.forEach((h: any) => {
        if ((h.book_name === bookCode || h.book_name === actualBookCode) && h.range) {
          const type = h.type === 'wrong' ? 'wrong' : (log.classwork_json?.includes(h) ? 'classwork' : 'homework');
          const matches = h.range.match(/p(\d+)\s*[~-]\s*p?(\d+)/i) || h.range.match(/p(\d+)/i);
          if (matches) {
            const s = parseInt(matches[1]); const e = matches[2] ? parseInt(matches[2]) : s;
            if (!isNaN(s) && !isNaN(e)) {
              for (let i = Math.min(s, e); i <= Math.max(s, e); i++) {
                const current = statusMap.get(i);
                if (type === 'wrong') statusMap.set(i, 'wrong');
                else if (type === 'classwork' && current !== 'wrong') statusMap.set(i, 'classwork');
                else if (type === 'homework' && !current) statusMap.set(i, 'homework');
              }
            }
          }
        }
      });
    });
    return statusMap;
  }, [student.allLogs, bookCode, textbook]);

  const completedUnitNames = useMemo(() => {
    const names = new Set<string>();
    const actualBookCode = textbook?.bookcode || bookCode;

    student.allLogs.forEach((log: any) => {
      if (log.session_date === '1900-01-01') {
        const combinedJson = [...(log.classwork_json || []), ...(log.homework_json || [])];
        combinedJson.forEach((h: any) => {
          if ((h.book_name === bookCode || h.book_name === actualBookCode) && h.units) { h.units.forEach((u: string) => names.add(u)); }
        });
      }
    });
    return names;
  }, [student.allLogs, bookCode, textbook]);

  // 💡 누락된 페이지 범위를 계산하는 도우미 함수
  const getMissingRanges = (start: number, end: number) => {
    const missing: number[] = [];
    for (let i = start; i <= end; i++) {
      if (!bookPageStatus.has(i)) missing.push(i);
    }
    if (missing.length === 0) return [];
    
    const ranges: string[] = [];
    if (missing.length > 0) {
      let rStart = missing[0];
      let rEnd = missing[0];
      for (let i = 1; i <= missing.length; i++) {
        if (i < missing.length && missing[i] === rEnd + 1) {
          rEnd = missing[i];
        } else {
          ranges.push(rStart === rEnd ? `${rStart}` : `${rStart}~${rEnd}`);
          if (i < missing.length) {
            rStart = missing[i];
            rEnd = missing[i];
          }
        }
      }
    }
    return ranges;
  };

  const handleSupplement = (unit: string, range: string) => {
    alert(`[${unit}] 단원의 누락된 p.${range} 내용을 보충 기록해야 진도율이 100%가 됩니다.`);
  };

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
            
            // 💡 스마트 상태별 페이지 수 계산
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

                {/* 💡 누락 페이지 탐지 표시 */}
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

                {/* 💡 스마트 멀티 컬러 프로그레스 바 */}
                <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden flex mb-3 border border-white/[0.03]">
                  {isCompleted ? (
                    <div className="h-full bg-emerald-500 w-full" />
                  ) : (
                    <>
                      <div style={{ width: `${(wrongCount / totalInUnit) * 100}%` }} className="h-full bg-emerald-500 transition-all duration-700" />
                      <div style={{ width: `${(classworkCount / totalInUnit) * 100}%` }} className="h-full bg-amber-500 transition-all duration-700 shadow-[inset_-1px_0_0_rgba(0,0,0,0.2)]" />
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
                    { id: 'final', icon: <Flag size={8} />, label: '최종 마무리' }
                  ].map((step, sIdx) => {
                    const isStepDone = stepStates[u.unit]?.[sIdx] || (isCompleted && sIdx < 4);
                    return (
                      <button 
                        key={step.id} title={step.label}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          // 💡 마지막 플래그(sIdx 3) 클릭 시 서버 완료 처리(Flag)와 연동 유도 가능
                          // 여기서는 일단 요청하신 대로 UI 100% 변화에 집중
                          toggleStep(u.unit, sIdx); 
                          if (sIdx === 3 && !isStepDone) {
                            handleFlagClick(idx); // 서버에 실제 완료 기록 남기기 (원장님 요청 연동)
                          }
                        }}
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

