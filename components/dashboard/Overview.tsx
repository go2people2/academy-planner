'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronRight, UserPlus, Check, MousePointer2, MinusCircle } from 'lucide-react';
import { Student } from '@/types/dashboard';
import AddStudentModal from './AddStudentModal';

interface OverviewProps {
  todayStudents: Student[];
  filteredAllStudents: Student[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  todayKey: string;
  isBatchMode: boolean;
  setIsBatchMode: (val: boolean) => void;
  onBatchAdd: (ids: string[]) => Promise<void>;
  onRemoveFromToday: (id: string) => Promise<void>;
  onAddNewStudent: (data: any) => Promise<void>; // 새 학생 추가 함수 추가
}

export default function Overview({ 
  todayStudents, filteredAllStudents, selectedStudentId, onSelectStudent, todayKey,
  isBatchMode, setIsBatchMode, onBatchAdd, onRemoveFromToday, onAddNewStudent
}: OverviewProps) {
  
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const otherStudents = filteredAllStudents.filter(
    s => !todayStudents.some(ts => ts.id === s.id)
  );

  const toggleSelection = (id: string) => {
    setSelectedForBatch(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleApplyBatch = async () => {
    if (selectedForBatch.length > 0) await onBatchAdd(selectedForBatch);
    setSelectedForBatch([]);
    setIsBatchMode(false);
  };

  return (
    <div className="p-2 space-y-6 relative">
      {/* 1. 상단: 오늘의 명단 */}
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
          {todayStudents.map((s) => (
            <StudentRowItem 
              key={s.id} 
              student={s} 
              isSelected={selectedStudentId === s.id && !isBatchMode} 
              isBatchMode={isBatchMode}
              onClick={() => isBatchMode ? onRemoveFromToday(s.id) : onSelectStudent(s.id)} 
            />
          ))}
          {todayStudents.length === 0 && (
            <div className="p-6 rounded-xl bg-white/[0.02] border border-dashed border-white/5 text-center text-gray-600 font-bold uppercase tracking-widest text-[9px]">No classes scheduled</div>
          )}
        </div>
      </section>

      {/* 2. 하단: 전체 학생 */}
      <section className="space-y-2 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <Users size={14} /> 
            All Students
          </h3>

          <div className="flex gap-2">
            {!isBatchMode && (
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-500/20"
              >
                <UserPlus size={10} /> 신규 학생 등록
              </button>
            )}
            
            {isBatchMode && (
              <button 
                onClick={() => { setIsBatchMode(false); setSelectedForBatch([]); }}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase bg-white/5 text-gray-500 hover:text-white transition-all"
              >
                Cancel
              </button>
            )}
            <button 
              onClick={() => isBatchMode ? handleApplyBatch() : setIsBatchMode(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                isBatchMode 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'
              }`}
            >
              {isBatchMode ? <><Check size={10} /> {selectedForBatch.length} Confirm</> : <><Users size={10} /> 오늘 수업 추가</>}
            </button>
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

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16 gap-1.5">
          {otherStudents.map((s) => {
            const isChecked = selectedForBatch.includes(s.id);
            return (
              <CompactStudentItem 
                key={s.id} 
                student={s} 
                isSelected={selectedStudentId === s.id && !isBatchMode} 
                isChecked={isChecked}
                isBatchMode={isBatchMode}
                onClick={() => isBatchMode ? toggleSelection(s.id) : onSelectStudent(s.id)} 
              />
            );
          })}
        </div>
      </section>

      {/* 신규 학생 등록 모달 */}
      <AnimatePresence>
        {isAddModalOpen && (
          <AddStudentModal 
            onClose={() => setIsAddModalOpen(false)} 
            onSave={onAddNewStudent} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StudentRowItem({ student, isSelected, isBatchMode, onClick }: { student: Student, isSelected: boolean, isBatchMode: boolean, onClick: () => void }) {
  const daysFormatted = student.class_days?.join(',') || '';
  
  return (
    <motion.div 
      layout 
      onClick={onClick} 
      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all duration-300 group ${
        isSelected ? 'bg-blue-600 border-blue-400 shadow-lg' : 
        isBatchMode ? 'hover:border-red-500/50 hover:bg-red-500/5' : 'bg-[#0f0f0f] border-white/5 hover:border-white/10 hover:bg-[#151515]'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex items-baseline gap-2 overflow-hidden">
          <h4 className={`text-[13px] font-black tracking-tight shrink-0 ${isSelected ? 'text-white' : isBatchMode ? 'group-hover:text-red-400' : 'text-gray-100'}`}>
            {student.name}
          </h4>
          <span className={`text-[10px] font-bold truncate ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
            {student.grade} · {student.class} · {daysFormatted}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        {isBatchMode ? (
          <MinusCircle size={14} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        ) : (
          <>
            <div className="flex gap-0.5">
              {student.history.map((status, i) => (
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

function CompactStudentItem({ student, isSelected, isChecked, isBatchMode, onClick }: { student: Student, isSelected: boolean, isChecked: boolean, isBatchMode: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick} 
      className={`p-1.5 rounded-lg border cursor-pointer transition-all relative group ${
        isSelected 
          ? 'bg-blue-600 border-blue-400 shadow-md' 
          : isChecked
            ? 'bg-blue-600 border-blue-400 scale-95'
            : isBatchMode
              ? 'bg-white/[0.03] border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10'
              : 'bg-[#0f0f0f] border-white/5 hover:border-white/10'
      }`}
    >
      {isChecked && (
        <div className="absolute -top-1 -right-1 z-10 bg-white text-blue-600 p-0.5 rounded-full shadow-lg border-2 border-blue-600">
          <Check size={6} strokeWidth={4} />
        </div>
      )}

      <div className="flex flex-col items-center gap-1">
        <div className={`w-6 h-6 rounded flex items-center justify-center font-black text-[10px] transition-colors ${
          isSelected || isChecked ? 'bg-white text-blue-600' : 'bg-white/5 text-gray-500 group-hover:text-blue-400'
        }`}>
          {student.name[0]}
        </div>
        <p className={`text-center text-[9px] font-bold truncate w-full ${
          isSelected || isChecked ? 'text-white' : 'text-gray-400 group-hover:text-white'
        }`}>
          {student.name}
        </p>
      </div>
    </div>
  );
}
