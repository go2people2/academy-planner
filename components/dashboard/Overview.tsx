'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronRight, UserPlus, Check, MousePointer2, MinusCircle } from 'lucide-react';
import { Student, TextbookOption } from '@/types/dashboard';
import AddStudentModal from './AddStudentModal';

interface OverviewProps {
  todayStudents: Student[];
  filteredAllStudents: Student[];
  allTodayIds?: string[]; // 💡 추가
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  todayKey: string;
  selectedFilter: string;
  isBatchMode: boolean;
  setIsBatchMode: (val: boolean) => void;
  onBatchAdd: (ids: string[], reasons: Record<string, string>) => Promise<void>;
  onRemoveFromToday: (id: string, reason: string) => Promise<void>;
  onAddNewStudent: (data: any) => Promise<void>;
  masterTextbooks: TextbookOption[];
  title?: string;
  showAddButton?: boolean;
  hideTodaySection?: boolean; // 💡 추가
}

export default function Overview({ 
  todayStudents = [], filteredAllStudents = [], allTodayIds = [], selectedStudentId, onSelectStudent, todayKey,
  selectedFilter = 'All', isBatchMode, setIsBatchMode, onBatchAdd, onRemoveFromToday, onAddNewStudent, masterTextbooks = [],
  title,
  showAddButton = false,
  hideTodaySection = false // 💡 기본값
}: OverviewProps) {
  
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // 사유 입력 모달 상태
  const [reasonModal, setReasonModal] = useState<{
    isOpen: boolean;
    type: 'add' | 'remove';
    studentIds: string[];
  }>({ isOpen: false, type: 'add', studentIds: [] });
  
  const [reasons, setReasons] = useState<Record<string, string>>({}); // 💡 개별 사유 상태

  // 💡 안전한 필터 모드 판단
  const isArchiveMode = useMemo(() => selectedFilter?.toLowerCase() === 'discharged', [selectedFilter]);

  // 💡 하단에 표시할 학생 리스트 계산
  const studentsToDisplay = useMemo(() => {
    if (isArchiveMode) {
      return filteredAllStudents || [];
    } else {
      // 💡 필터링된 todayStudents가 아니라, 고정된 allTodayIds를 사용하여 목록 간 이동 방지
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
      selectedForBatch.forEach(id => { initialReasons[id] = '보강 수업'; });
      
      setReasons(initialReasons);
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
      await onBatchAdd(reasonModal.studentIds, reasons);
      setSelectedForBatch([]);
      
      if (selectedToRemove.length > 0) {
        const initialReasons: Record<string, string> = {};
        selectedToRemove.forEach(id => { initialReasons[id] = '수업 취소'; });
        setReasons(initialReasons);
        setReasonModal({
          isOpen: true,
          type: 'remove',
          studentIds: selectedToRemove
        });
        return;
      }
    } else {
      await Promise.all(reasonModal.studentIds.map(id => onRemoveFromToday(id, reasons[id] || '수업 취소')));
      setSelectedToRemove([]);
    }
    
    setReasonModal({ ...reasonModal, isOpen: false });
    setReasons({});
    setIsBatchMode(false);
  };

  const updateIndividualReason = (id: string, text: string) => {
    setReasons(prev => ({ ...prev, [id]: text }));
  };

  const getStudentName = (id: string) => {
    return studentsToDisplay.find(s => s.id === id)?.name || todayStudents.find(s => s.id === id)?.name || 'Student';
  };

  const getDayOfWeek = (dateStr: string) => {
    try {
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? dateStr : days[date.getDay()];
    } catch {
      return dateStr || '';
    }
  };

  const currentDayName = getDayOfWeek(todayKey);

  return (
    <div className="p-2 space-y-6 relative">
      {/* 1. 상단: 오늘의 명단 (퇴원생 모드나 명시적 숨김일 때는 절대 보여주지 않음) */}
      {!isArchiveMode && !hideTodaySection && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> 
            Today ({todayKey})
            <span className="ml-1 text-[9px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5 uppercase font-bold">
              {todayStudents.length} Students
            </span>
          </h3>

          {isBatchMode && (
            <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest animate-pulse px-1">
              💡 Click to remove from today&apos;s list
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
            {todayStudents.map((s) => {
              const isChecked = selectedToRemove.includes(s.id);
              return (
                <StudentRowItem 
                  key={s.id} 
                  student={s} 
                  isSelected={selectedStudentId === s.id && !isBatchMode} 
                  isChecked={isChecked}
                  isBatchMode={isBatchMode}
                  currentDay={currentDayName}
                  onClick={() => isBatchMode ? toggleRemoveSelection(s.id) : onSelectStudent(s.id)} 
                />
              );
            })}
            {todayStudents.length === 0 && (
              <div className="p-6 rounded-xl bg-white/[0.02] border border-dashed border-white/5 text-center text-gray-600 font-bold uppercase tracking-widest text-[9px]">No classes scheduled</div>
            )}
          </div>
        </section>
      )}

      {/* 2. 하단: 리스트 영역 */}
      <section className={`space-y-2 ${todayStudents.length > 0 ? 'pt-4 border-t border-white/5' : ''}`}>
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <Users size={14} /> 
            {title ? title : (isArchiveMode ? 'Discharged Students Archive' : 'Rest of Students')}
          </h3>

          <div className="flex gap-2">
            {!isBatchMode && !isArchiveMode && showAddButton && (
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-500/20"
              >
                <UserPlus size={10} /> 신규 학생 등록
              </button>
            )}
            
            {isBatchMode && (
              <button 
                onClick={() => { setIsBatchMode(false); setSelectedForBatch([]); setSelectedToRemove([]); }}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase bg-white/5 text-gray-500 hover:text-white transition-all"
              >
                Cancel
              </button>
            )}
            
            {!isArchiveMode && !hideTodaySection && (
              <button 
                onClick={() => isBatchMode ? handleApplyBatch() : setIsBatchMode(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  isBatchMode 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'
                }`}
              >
                {isBatchMode ? (
                  <><Check size={10} /> {selectedForBatch.length + selectedToRemove.length} Confirm</>
                ) : (
                  <><Users size={10} /> 오늘 수업 변경</>
                )}
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isBatchMode && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
              className="bg-blue-600/5 border border-blue-500/10 p-2 rounded-lg flex items-center justify-center gap-2 text-blue-400 font-bold text-[9px] uppercase tracking-widest"
            >
              <MousePointer2 size={10} className="animate-pulse" /> Select students and click confirm
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
          {studentsToDisplay.map((s) => {
            const isChecked = selectedForBatch.includes(s.id);
            return (
              <StudentRowItem 
                key={s.id} 
                student={s} 
                isSelected={selectedStudentId === s.id && !isBatchMode} 
                isChecked={isChecked}
                isBatchMode={isBatchMode}
                currentDay={currentDayName}
                onClick={() => isBatchMode ? toggleSelection(s.id) : onSelectStudent(s.id)} 
              />
            );
          })}
          {studentsToDisplay.length === 0 && (
            <div className="p-10 text-center text-gray-700 text-[10px] font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-2xl w-full col-span-full">
              {isArchiveMode ? 'No discharged students found' : 'All students are in today\'s list'}
            </div>
          )}
        </div>
      </section>

      {/* 사유 입력 모달 */}
      <AnimatePresence>
        {reasonModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#1a1a1a] border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${reasonModal.type === 'add' ? 'bg-blue-500/20 text-blue-500' : 'bg-red-500/20 text-red-500'}`}>
                  {reasonModal.type === 'add' ? <Users size={20} /> : <MinusCircle size={20} />}
                </div>
                <div>
                  <h4 className="text-white font-black text-sm uppercase">{reasonModal.type === 'add' ? '오늘 수업 변경' : '오늘 수업 제외'}</h4>
                  <p className="text-[10px] text-gray-500 font-bold">{reasonModal.studentIds.length} 명의 학생 선택됨</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar-v">
                <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-1 block mb-1">학생별 사유 입력</label>
                {reasonModal.studentIds.map((id) => (
                  <div key={id} className="space-y-1 bg-white/[0.02] p-2 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[11px] font-black text-gray-300">{getStudentName(id)}</span>
                    </div>
                    <input 
                      type="text" 
                      value={reasons[id] || ''} 
                      onChange={(e) => updateIndividualReason(id, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmReason()}
                      placeholder="사유를 입력하세요"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setReasonModal({ ...reasonModal, isOpen: false })} 
                  className="flex-1 py-3 bg-white/5 text-gray-500 rounded-xl text-[10px] font-black uppercase hover:bg-white/10 transition-all"
                >
                  취소
                </button>
                <button 
                  onClick={confirmReason}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all ${
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
        )}
      </AnimatePresence>

      {/* 신규 학생 등록 모달 */}
      <AnimatePresence>
        {isAddModalOpen && (
          <AddStudentModal 
            onClose={() => setIsAddModalOpen(false)} 
            onSave={onAddNewStudent} 
            masterTextbooks={masterTextbooks}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StudentRowItem({ 
  student, isSelected, isChecked, isBatchMode, onClick, currentDay, masterTextbooks 
}: { 
  student: Student, isSelected: boolean, isChecked?: boolean, isBatchMode: boolean, onClick: () => void, currentDay?: string, masterTextbooks: TextbookOption[] 
}) {
  const isSelectionMode = isBatchMode && isChecked !== undefined;
  const isMakeup = student.todaySession?.attendance_status === '보강';

  return (
    <motion.div 
      layout 
      onClick={onClick} 
      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all duration-300 group ${
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
          {isMakeup && !isSelected && !isChecked && (
            <span className="bg-emerald-500/20 text-emerald-500 text-[8px] font-black px-1 py-0.5 rounded border border-emerald-500/20 uppercase tracking-tighter shrink-0">
              보강
            </span>
          )}
          <span className={`text-[10px] font-bold truncate ${isSelected || isChecked ? 'text-blue-100' : 'text-gray-500'}`}>
            {student.grade} · {student.class}
          </span>
        </div>

        {/* 💡 배정 교재 표시 추가 */}
        {student.assigned_books && student.assigned_books.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {student.assigned_books.map(code => {
              const bookTitle = masterTextbooks.find(m => m.bookcode === code)?.title || code;
              return (
                <span key={code} className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold truncate max-w-[100px] ${
                  isSelected || isChecked ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400 border border-white/5'
                }`}>
                  {bookTitle}
                </span>
              );
            })}
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
                <span className={`text-[8px] mr-0.5 font-bold ${isToday ? 'text-emerald-400 font-black' : 'text-gray-600'}`}>{day}</span>
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
                <div key={i} className={`w-1 h-1 rounded-full ${status === 'perfect' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : status === 'late' ? 'bg-blue-400' : 'bg-white/10'}`} />
              ))}
            </div>
            <ChevronRight size={12} className={isSelected ? 'text-white' : 'text-gray-600'} />
          </>
        )}
      </div>
    </motion.div>
  );
}
