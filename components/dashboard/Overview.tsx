'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronRight, UserPlus, Check, MousePointer2, MinusCircle, Calendar, TrendingUp, StickyNote, Target, ExternalLink, Search, X } from 'lucide-react';
import { Student, TextbookOption } from '@/types/dashboard';
import { getDayOfWeek, getTodayStr } from '@/lib/utils';
import AddStudentModal from './AddStudentModal';

interface OverviewProps {
  todayStudents: Student[];
  filteredAllStudents: Student[];
  allTodayIds?: string[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  onViewProgress?: (id: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  todayKey: string;
  selectedFilter: string;
  isBatchMode: boolean;
  setIsBatchMode: (val: boolean) => void;
  onBatchAdd: (ids: string[], reasons: Record<string, string>, makeupHours: Record<string, number>) => Promise<void>;
  onRemoveFromToday: (id: string, reason: string) => Promise<void>;
  onAddNewStudent: (data: any) => Promise<void>;
  masterTextbooks: TextbookOption[];
  teachers?: any[]; 
  title?: string;
  showAddButton?: boolean;
  hideTodaySection?: boolean;
  consultationCycle?: number;
  onStartClass?: () => void;
  academyInfo?: any;
  searchQuery?: string; // 💡 추가
  onSearchChange?: (val: string) => void; // 💡 추가
}

export default function Overview({ 
  todayStudents = [], filteredAllStudents = [], allTodayIds = [], selectedStudentId, onSelectStudent, 
  onViewProgress,
  selectedDate, onDateChange,
  todayKey,
  selectedFilter = 'All', isBatchMode, setIsBatchMode, onBatchAdd, onRemoveFromToday, onAddNewStudent, masterTextbooks = [],
  teachers = [],
  title,
  showAddButton = false,
  hideTodaySection = false,
  consultationCycle = 21,
  onStartClass,
  academyInfo,
  searchQuery = '', // 💡 추가
  onSearchChange // 💡 추가
}: OverviewProps) {
  
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const [reasonModal, setReasonModal] = useState<{
    isOpen: boolean;
    type: 'add' | 'remove';
    studentIds: string[];
  }>({ isOpen: false, type: 'add', studentIds: [] });

  // 모달 ESC 키 닫기 이벤트
  useEffect(() => {
    if (reasonModal.isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setReasonModal(prev => ({ ...prev, isOpen: false }));
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [reasonModal.isOpen]);
  
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [makeupHours, setMakeupHours] = useState<Record<string, number>>({});

  const isArchiveMode = useMemo(() => selectedFilter?.toLowerCase() === 'discharged', [selectedFilter]);

  const studentsToDisplay = useMemo(() => {
    if (isArchiveMode) {
      return filteredAllStudents || [];
    } else {
      return (filteredAllStudents || []).filter(s => !allTodayIds.includes(s.id));
    }
  }, [filteredAllStudents, allTodayIds, isArchiveMode]);

  const toggleSelection = (id: string) => {
    setSelectedForBatch(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleRemoveSelection = (id: string) => {
    setSelectedToRemove(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleApplyBatch = () => {
    if (selectedForBatch.length > 0) {
      const initialReasons: Record<string, string> = {};
      const initialHours: Record<string, number> = {};
      
      const settings = academyInfo?.operation_settings || {};
      const baseTime = settings.first_period_time || "";
      const baseHour = baseTime ? parseInt(baseTime.split(':')[0]) : 15;

      selectedForBatch.forEach(id => { 
        initialReasons[id] = '보강 수업'; 
        
        const s = studentsToDisplay.find(student => student.id === id);
        const activeHours = s?.day_schedules?.[todayKey] || [];
        let defaultHour = baseHour;
        if (activeHours.length > 0) {
          defaultHour = Math.min(...activeHours.map((h: number) => h % 100));
        }
        initialHours[id] = defaultHour;
      });
      
      setReasons(initialReasons);
      setMakeupHours(initialHours);
      setReasonModal({
        isOpen: true,
        type: 'add',
        studentIds: selectedForBatch
      });
      return;
    }

    if (selectedToRemove.length > 0) {
      const initialReasons: Record<string, string> = {};
      selectedToRemove.forEach(id => { initialReasons[id] = '수업 취소'; });
      
      setReasons(initialReasons);
      setReasonModal({
        isOpen: true,
        type: 'remove',
        studentIds: selectedToRemove
      });
    }
  };

  const confirmReason = async () => {
    if (reasonModal.type === 'add') {
      await onBatchAdd(reasonModal.studentIds, reasons, makeupHours);
      setSelectedForBatch([]);
    } else {
      await Promise.all(reasonModal.studentIds.map(id => onRemoveFromToday(id, reasons[id] || '수업 취소')));
      setSelectedToRemove([]);
    }
    
    setReasonModal({ ...reasonModal, isOpen: false });
    setReasons({});
    setMakeupHours({});
    setIsBatchMode(false);
  };

  const updateIndividualReason = (id: string, text: string) => {
    setReasons(prev => ({ ...prev, [id]: text }));
  };

  const updateIndividualHour = (id: string, hour: number) => {
    setMakeupHours(prev => ({ ...prev, [id]: hour }));
  };

  const getStudentName = (id: string) => {
    return studentsToDisplay.find(s => s.id === id)?.name || todayStudents.find(s => s.id === id)?.name || 'Student';
  };

  // 💡 학년별 학생 수 통계 복구
  const getGradeStats = (studentList: Student[]) => {
    const stats: Record<string, number> = {};
    const grades = ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
    grades.forEach(g => stats[g] = 0);
    studentList.forEach(s => {
      const g = s.grade || '';
      if (stats[g] !== undefined) stats[g]++;
    });
    return Object.entries(stats).filter(([_, count]) => count > 0);
  };

  const todayGradeStats = useMemo(() => getGradeStats(todayStudents), [todayStudents]);
  const otherGradeStats = useMemo(() => getGradeStats(studentsToDisplay), [studentsToDisplay]);

  return (
    <div className="p-2 space-y-6 relative">
      {!isArchiveMode && !hideTodaySection && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> 
                  {todayKey === getDayOfWeek(getTodayStr()) ? "Today's Schedule" : `${todayKey}요일 Schedule`}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 bg-white/5 px-2 py-1 rounded-[2px] border border-white/10 uppercase font-black tracking-tight">
                    <span className="text-amber-400">{todayStudents.length}</span> Students
                  </span>
                  {todayGradeStats.map(([grade, count], idx) => {
                    const isES = grade.includes('초');
                    const isMS = grade.includes('중');
                    const isHS = grade.includes('고');
                    const colorClass = isES ? 'text-emerald-400' : isHS ? 'text-amber-400' : 'text-blue-400';
                    return (
                      <div key={grade || idx} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 px-2 py-1 rounded-[2px] shadow-sm">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{grade}</span>
                        <span className={`text-[10px] font-black ${colorClass}`}>{count}</span>
                      </div>
                    );
                  })}
                </div>

              </div>

              <div className="flex items-center gap-2">
                <div 
                  onClick={(e) => {
                    const input = e.currentTarget.querySelector('input');
                    if (input && 'showPicker' in input) {
                      try { (input as any).showPicker(); } catch (err) { console.error(err); }
                    }
                  }}
                  className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-[2px] px-3 py-1 text-gray-400 hover:text-white transition-all group/date relative cursor-pointer"
                >
                  <Calendar size={12} className="group-hover/date:text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                    {selectedDate.replace(/-/g, '.')}
                  </span>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark] z-10"
                  />
                </div>
              </div>
            </div>

            {isBatchMode && (
              <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest animate-pulse px-1">
                💡 Click to remove from today&apos;s list
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
            {todayStudents.map((s, idx) => {
              const isChecked = selectedToRemove.includes(s.id);
              return (
                <StudentRowItem
                  key={s.id || idx}
                  student={s}
                  isSelected={selectedStudentId === s.id && !isBatchMode}
                  isChecked={isChecked}
                  isBatchMode={isBatchMode}
                  currentDay={todayKey}
                  masterTextbooks={masterTextbooks}
                  onViewProgress={onViewProgress}
                  consultationCycle={consultationCycle}
                  onClick={() => isBatchMode ? toggleRemoveSelection(s.id) : onSelectStudent(s.id)}
                  academyInfo={academyInfo}
                />
              );
            })}
            {todayStudents.length === 0 && (
              <div className="p-6 rounded-[2px] bg-white/[0.02] border border-dashed border-white/5 text-center text-gray-600 font-bold uppercase tracking-widest text-[9px]">No classes scheduled</div>
            )}
          </div>
        </section>
      )}

      <section className={`space-y-2 ${todayStudents.length > 0 ? 'pt-4 border-t border-white/5' : ''}`}>
        <div className={`sticky top-[-8px] z-40 bg-[#050505]/95 backdrop-blur-sm pb-4 pt-2 -mx-2 px-3 border-b border-white/5`}>
          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                <Users size={14} /> 
                {title ? title : (isArchiveMode ? 'Discharged Students Archive' : 'Rest of Students')}
              </h3>
              {!isArchiveMode && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-gray-500 bg-white/5 px-2 py-1 rounded-[2px] border border-white/10 uppercase font-black tracking-tight">
                    <span className="text-amber-400">{studentsToDisplay.length}</span> Students
                  </span>
                  {otherGradeStats.map(([grade, count], idx) => {
                    const isES = grade.includes('초');
                    const isMS = grade.includes('중');
                    const isHS = grade.includes('고');
                    const colorClass = isES ? 'text-emerald-500/60' : isHS ? 'text-amber-500/60' : 'text-blue-500/60';
                    return (
                      <div key={grade || idx} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/10 px-2 py-1 rounded-[2px] shadow-sm">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{grade}</span>
                        <span className={`text-[10px] font-black ${colorClass}`}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!isBatchMode && !isArchiveMode && showAddButton && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-[9px] font-black uppercase tracking-widest bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-500/20"
                >
                  <UserPlus size={10} /> 신규 학생 등록
                </button>
              )}
              
              {isBatchMode && (
                <button 
                  onClick={() => { setIsBatchMode(false); setSelectedForBatch([]); setSelectedToRemove([]); }}
                  className="px-3 py-1.5 rounded-[2px] text-[9px] font-black uppercase bg-white/5 text-gray-500 hover:text-white transition-all"
                >
                  Cancel
                </button>
              )}
              
              {!isArchiveMode && !hideTodaySection && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => isBatchMode ? handleApplyBatch() : setIsBatchMode(true)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                      isBatchMode 
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 border border-blue-400 animate-pulse' 
                        : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] border border-blue-500/30 shadow-md shadow-blue-900/40'
                    }`}
                  >
                    {isBatchMode ? (
                      <><Check size={10} /> {selectedForBatch.length + selectedToRemove.length} Confirm</>
                    ) : (
                      <><Users size={10} /> 오늘 수업 변경</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 💡 [추가] 학생 정보 수정 모드('전체 학생 정보 관리')에서만 노출되는 검색창 */}
          {hideTodaySection && onSearchChange && (
            <div className="mt-4 relative group max-w-md px-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" size={14} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="찾으실 학생 이름을 입력하세요..."
                className="w-full bg-white/[0.03] border border-white/10 rounded-[2px] py-2.5 pl-10 pr-10 text-xs text-white placeholder:text-gray-700 focus:bg-white/[0.06] focus:border-blue-500/50 outline-none transition-all font-bold"
              />
              {searchQuery && (
                <button 
                  onClick={() => onSearchChange('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {isBatchMode && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
              className="bg-blue-600/5 border border-blue-500/10 p-2 rounded-[2px] flex items-center justify-center gap-2 text-blue-400 font-bold text-[9px] uppercase tracking-widest"
            >
              <MousePointer2 size={10} className="animate-pulse" /> Select students and click confirm
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
          {studentsToDisplay.map((s, idx) => {
            const isChecked = selectedForBatch.includes(s.id);
            return (
              <StudentRowItem 
                key={s.id || idx} 
                student={s} 
                isSelected={selectedStudentId === s.id && !isBatchMode} 
                isChecked={isChecked}
                isBatchMode={isBatchMode}
                currentDay={todayKey}
                masterTextbooks={masterTextbooks}
                onViewProgress={onViewProgress}
                consultationCycle={consultationCycle}
                onClick={() => isBatchMode ? toggleSelection(s.id) : onSelectStudent(s.id)} 
              />
            );
          })}
          {studentsToDisplay.length === 0 && (
            <div className="p-10 text-center text-gray-700 text-[10px] font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-sm w-full col-span-full">
              {isArchiveMode ? 'No discharged students found' : 'All students are in today\'s list'}
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {reasonModal.isOpen && (() => {
          const configM = (academyInfo?.operation_settings?.first_period_time || "00:00").split(':')[1] || "00";
          const displayMinute = configM.toString().padStart(2, '0');
          const hourOptions = Array.from({ length: 13 }, (_, i) => i + 10); // 10시 ~ 22시
          
          const handleBatchHourChange = (hour: number) => {
            const updated = { ...makeupHours };
            reasonModal.studentIds.forEach(id => {
              updated[id] = hour;
            });
            setMakeupHours(updated);
          };

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="bg-[#1a1a1a] border border-white/10 p-6 rounded-sm max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${reasonModal.type === 'add' ? 'bg-blue-500/20 text-blue-500' : 'bg-red-500/20 text-red-500'}`}>
                    {reasonModal.type === 'add' ? <Users size={20} /> : <MinusCircle size={20} />}
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase">{reasonModal.type === 'add' ? '오늘 수업 변경' : '오늘 수업 제외'}</h4>
                    <p className="text-[10px] text-gray-500 font-bold">{reasonModal.studentIds.length} 명의 학생 선택됨</p>
                  </div>
                </div>

                {reasonModal.type === 'add' && (
                  <div className="bg-blue-600/10 border border-blue-500/20 p-3 rounded-[2px] space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-blue-400 tracking-widest block">보강 시간 일괄 지정</label>
                    <select 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) handleBatchHourChange(parseInt(val));
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded-[2px] px-3 py-2 text-[11px] font-black text-amber-500 outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="">교시를 선택하세요 (일괄 적용)</option>
                      {hourOptions.map(h => (
                        <option key={h} value={h} className="bg-[#121212]">
                          {h >= 12 
                            ? (h === 12 ? `오후 12시 ${displayMinute}분` : `오후 ${h - 12}시 ${displayMinute}분`)
                            : `오전 ${h}시 ${displayMinute}분`
                          }
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar-v">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-1 block mb-1">학생별 사유 및 시간 입력</label>
                  {reasonModal.studentIds.map((id) => (
                    <div key={id} className="space-y-2 bg-white/[0.02] p-3 rounded-[2px] border border-white/5">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[11px] font-black text-gray-300">{getStudentName(id)}</span>
                      </div>
                      
                      <div className={reasonModal.type === 'add' ? "grid grid-cols-2 gap-2" : "w-full"}>
                        <div className="space-y-1">
                          {reasonModal.type === 'add' && <label className="text-[8px] font-bold uppercase text-gray-600 tracking-widest px-0.5 block">보강 사유</label>}
                          <input 
                            type="text" 
                            value={reasons[id] || ''} 
                            onChange={(e) => updateIndividualReason(id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && confirmReason()}
                            placeholder="사유를 입력하세요"
                            className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                        
                        {reasonModal.type === 'add' && (
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold uppercase text-gray-600 tracking-widest px-0.5 block">보강 시간</label>
                            <select 
                              value={makeupHours[id] || 15}
                              onChange={(e) => updateIndividualHour(id, parseInt(e.target.value))}
                              className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2 text-[11px] font-bold text-amber-500 outline-none focus:border-blue-500 transition-all cursor-pointer"
                            >
                              {hourOptions.map(h => (
                                <option key={h} value={h} className="bg-[#121212]">
                                  {h >= 12 
                                    ? (h === 12 ? `오후 12:${displayMinute}` : `오후 ${h - 12}:${displayMinute}`)
                                    : `오전 ${h}:${displayMinute}`
                                  }
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setReasonModal({ ...reasonModal, isOpen: false })} 
                    className="flex-1 py-3 bg-white/5 text-gray-500 rounded-[2px] text-[10px] font-black uppercase hover:bg-white/10 transition-all"
                  >
                    취소
                  </button>
                  <button 
                    onClick={confirmReason}
                    className={`flex-1 py-3 rounded-[2px] text-[10px] font-black uppercase shadow-lg transition-all ${
                      reasonModal.type === 'add' 
                        ? 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500' 
                        : 'bg-red-600 text-white shadow-red-600/20 hover:bg-red-500'
                    }`}
                  >
                    확인
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {isAddModalOpen && (
          <AddStudentModal
            onClose={() => setIsAddModalOpen(false)}
            onSave={onAddNewStudent}
            masterTextbooks={masterTextbooks}
            teachers={teachers}
          />
        )}      </AnimatePresence>
    </div>
  );
}

function StudentRowItem({ 
  student, isSelected, isChecked, isBatchMode, onClick, onViewProgress, currentDay, masterTextbooks, consultationCycle = 21, academyInfo
}: { 
  student: Student, isSelected: boolean, isChecked?: boolean, isBatchMode: boolean, onClick: () => void, onViewProgress?: (id: string) => void, currentDay?: string, masterTextbooks: TextbookOption[], consultationCycle?: number, academyInfo?: any
}) {
  const isSelectionMode = isBatchMode && isChecked !== undefined;
  const isMakeup = student.todaySession?.attendance_status?.startsWith('보강');
  
  const settings = academyInfo?.operation_settings || {};
  const baseTime = settings.first_period_time || "";
  const baseHour = baseTime ? parseInt(baseTime.split(':')[0]) : 99; // 최후의 보루

  // 💡 정기 상담 알림 로직 (단계별 색상)
  const consultationStatus = useMemo(() => {
    if (!student.last_consulted_at) return { needs: true, color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/20' };
    
    const lastDate = new Date(student.last_consulted_at);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 35) return { needs: true, color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/20' }; // 5주 이상: 빨강
    if (diffDays >= 28) return { needs: true, color: 'text-amber-500', bg: 'bg-amber-500/20', border: 'border-amber-500/20' }; // 4주 이상: 노랑
    if (diffDays >= 21) return { needs: true, color: 'text-emerald-500', bg: 'bg-emerald-500/20', border: 'border-emerald-500/20' }; // 3주 이상: 초록
    
    return { needs: false };
  }, [student.last_consulted_at]);

  return (
    <motion.div 
      layout 
      onClick={onClick} 
      className={`flex items-center justify-between p-2.5 rounded-[2px] border cursor-pointer transition-all duration-300 group ${
        isSelected || isChecked ? 'bg-blue-600 border-blue-400 shadow-lg' : 
        isBatchMode 
          ? isSelectionMode 
            ? 'hover:border-blue-500/50 hover:bg-blue-500/5 bg-[#0f0f0f] border-white/5' 
            : 'hover:border-red-500/50 hover:bg-red-500/5 bg-[#0f0f0f] border-white/5'
          : isMakeup 
            ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10'
            : 'bg-[#0f0f0f] border-white/5 hover:border-white/10 hover:bg-[#151515]'
      }`}
    >
      <div className="flex flex-col gap-1 overflow-hidden flex-1">
        <div className="flex items-center gap-2 overflow-hidden">
          <h4 className={`text-[13px] font-black tracking-tight shrink-0 ${isSelected || isChecked ? 'text-white' : isBatchMode ? (isSelectionMode ? 'group-hover:text-blue-400' : 'group-hover:text-red-400') : 'text-gray-100'}`}>
            {student.name}
          </h4>
          {consultationStatus.needs && !isBatchMode && (
            <span className={`${consultationStatus.bg} ${consultationStatus.color} ${consultationStatus.border} text-[8px] font-black px-1 py-0.5 rounded border uppercase tracking-tighter shrink-0 animate-pulse`}>
              상담
            </span>
          )}
          {!isBatchMode && onViewProgress && (
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProgress(student.id);
                }}
                className="p-1 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm shadow-blue-900/20"
                title="진도표 바로가기"
              >
                <TrendingUp size={10} />
              </button>
              {/* 💡 학생 포털 바로가기 추가 */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const slug = window.location.pathname.split('/')[1];
                  window.open(`/${slug}/student?id=${student.id}`, '_blank');
                }}
                className="p-1 rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all shadow-sm shadow-indigo-900/20"
                title="학생 페이지 보기"
              >
                <ExternalLink size={10} strokeWidth={3} />
              </button>
            </div>
          )}
          {isMakeup && !isSelected && !isChecked && (
            <span className="bg-emerald-500/20 text-emerald-500 text-[8px] font-black px-1 py-0.5 rounded border border-emerald-500/20 uppercase tracking-tighter shrink-0">
              보강
            </span>
          )}
          <span className={`text-[10px] font-bold truncate ${isSelected || isChecked ? 'text-blue-100' : 'text-gray-400'}`}>
            {student.grade} · {student.course} · {student.class}
          </span>

          {/* 💡 주의사항 및 미션 인디케이터 (Hover 시 내용 노출) */}
          <div className="flex items-center gap-1.5 ml-1">
            {student.management_notes && (
              <div className="relative group/tooltip">
                <StickyNote size={12} className="text-amber-500 opacity-60 group-hover/tooltip:opacity-100 transition-opacity" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-amber-100 text-amber-900 text-[10px] font-bold rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 border border-amber-200">
                  <div className="flex items-center gap-1 mb-1 border-b border-amber-900/10 pb-1 text-[8px] uppercase tracking-tighter opacity-60"><StickyNote size={8} /> Teacher's Note</div>
                  <div className="whitespace-pre-wrap leading-tight">{student.management_notes}</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-amber-100" />
                </div>
              </div>
            )}
            {student.recent_mission && (
              <div className="relative group/tooltip">
                <Target size={12} className="text-blue-500 opacity-60 group-hover/tooltip:opacity-100 transition-opacity" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-blue-600 text-white text-[10px] font-bold rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 border border-blue-400/30">
                  <div className="flex items-center gap-1 mb-1 border-b border-white/20 pb-1 text-[8px] uppercase tracking-tighter opacity-60"><Target size={8} /> Current Mission</div>
                  <div className="whitespace-pre-wrap leading-tight">{student.recent_mission}</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-blue-600" />
                </div>
              </div>
            )}
          </div>
        </div>

        {student.assigned_books && student.assigned_books.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            {student.assigned_books.filter(code => {
              const bookCourse = student.book_courses?.[code];
              return !!code && !String(bookCourse).endsWith('-keep');
            }).map((code, idx) => {
              const book = masterTextbooks.find(m => m.bookcode === code);
              if (!book) return null;
              return (
                <span key={`${code}-${idx}`} className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold truncate max-w-[100px] ${
                  isSelected || isChecked ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400 border border-white/5'
                }`}>
                  {book.title}
                </span>
              );
            })}
            {/* 💡 Keep 중인 교재 수 표시 (초소형 1K, 2K... 형태) */}
            {(() => {
              const keepCount = student.assigned_books.filter(code => String(student.book_courses?.[code]).endsWith('-keep')).length;
              if (keepCount === 0) return null;
              return (
                <span className={`text-[7px] font-black px-1 py-0.5 rounded-[2px] tracking-tighter uppercase border ${
                  isSelected || isChecked ? 'bg-white/20 text-white border-white/20' : 'text-gray-600 border-white/5 bg-white/[0.02]'
                }`}>
                  {keepCount}K
                </span>
              );
            })()}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-0.5">
          {(student.class_days || []).slice().sort((a, b) => {
            const order = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
            return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
          }).map(day => {
            const activeHours = student.day_schedules?.[day] || [];
            const isToday = day === currentDay;
            
            return (
              <div key={day} className={`flex items-center gap-0.5 px-1 py-0.5 rounded-md ${isToday ? 'bg-white/10 ring-1 ring-white/10' : ''}`}>
                <span className={`text-[8px] mr-0.5 font-bold ${isToday ? 'text-emerald-400 font-black' : 'text-gray-500'}`}>{day}</span>
                <div className="flex gap-0.5">
                  {activeHours.map(h => {
                    const isWhite = h >= 100;
                    const actualHour = isWhite ? h - 100 : h;
                    
                    return (
                      <div 
                        key={h} 
                        className={`w-0.5 h-2 rounded-sm transition-colors ${
                          isWhite 
                            ? 'bg-white border border-gray-400/20' 
                            : (actualHour < 19 ? 'bg-blue-500/80' : 'bg-orange-400/80')
                        }`} 
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {isBatchMode ? (
          isSelectionMode ? (
            isChecked ? (
              <div className="bg-white text-blue-600 p-0.5 rounded-full shadow-lg">
                <Check size={10} strokeWidth={4} />
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/20 group-hover:border-blue-500/50 transition-colors" />
            )
          ) : (
            <MinusCircle size={14} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          )
        ) : (
          <>
            <div className="flex gap-0.5">
              {(student.history || []).map((status, i) => (
                <div key={i} className={`w-1 h-1 rounded-full ${(status as any) === 'perfect' ? 'bg-emerald-500' : (status as any) === 'good' ? 'bg-emerald-400' : (status as any) === 'warning' || (status as any) === 'neutral' ? 'bg-amber-500' : (status as any) === 'poor' || (status as any) === 'late' ? 'bg-orange-500' : (status as any) === 'bad' ? 'bg-red-500' : 'bg-white/10'}`} />
              ))}
            </div>
            <ChevronRight size={12} className={isSelected ? 'text-white' : 'text-gray-600'} />
          </>
        )}
      </div>
    </motion.div>
  );
}
