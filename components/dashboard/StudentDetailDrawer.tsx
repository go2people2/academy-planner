import { motion } from 'framer-motion';
import { X, BookOpen, RefreshCw, Trash2, Plus, UserPlus, User, Calendar } from 'lucide-react';
import { Student, TextbookOption } from '@/types/dashboard';

interface StudentDetailDrawerProps {
  student: Student;
  availableTextbooks: TextbookOption[];
  isRefreshingBooks: boolean;
  onRefreshBooks: () => void;
  onUpdateInfo: (studentId: string, field: string, value: any) => void;
  onAddToToday: (studentId: string) => void;
  onClose: () => void;
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function StudentDetailDrawer({
  student, availableTextbooks, isRefreshingBooks, onRefreshBooks, onUpdateInfo, onAddToToday, onClose
}: StudentDetailDrawerProps) {
  return (
    <motion.div 
      initial={{ x: '100%' }} 
      animate={{ x: 0 }} 
      exit={{ x: '100%' }} 
      transition={{ type: 'spring', damping: 28, stiffness: 220 }} 
      className="fixed inset-y-0 right-0 w-[420px] bg-[#0a0a0a]/95 backdrop-blur-3xl border-l border-white/10 shadow-2xl z-50 overflow-y-auto p-10 flex flex-col custom-scrollbar-v"
    >
      <button onClick={onClose} className="absolute left-6 top-6 p-2.5 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"><X size={18} /></button>
      
      <div className="text-center mb-8 flex-shrink-0 pt-4">
        <h3 className="text-2xl font-black text-white">{student.name}</h3>
        <p className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-widest">{student.grade} · {student.class}</p>
        
        {!student.todaySession && (
          <button 
            onClick={() => onAddToToday(student.id)}
            className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-lg shadow-emerald-600/5"
          >
            <UserPlus size={14} /> 오늘 수업 명단에 추가
          </button>
        )}
      </div>
      
      <div className="flex-1 space-y-10">
        {/* 1. 기본 정보 수정 섹션 */}
        <section className="space-y-4">
          <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
            <User size={14} /> 기본 정보 수정
          </h5>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4 shadow-inner">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">이름</label>
                <input 
                  type="text" 
                  value={student.name} 
                  onChange={(e) => onUpdateInfo(student.id, 'name', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 transition-all font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">학년</label>
                <input 
                  type="text" 
                  value={student.grade} 
                  onChange={(e) => onUpdateInfo(student.id, 'grade', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 transition-all font-bold"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-500 uppercase ml-1">반 / 담당 선생님</label>
              <input 
                type="text" 
                value={student.class} 
                onChange={(e) => onUpdateInfo(student.id, 'class_name', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 transition-all font-bold"
              />
            </div>
          </div>
        </section>

        {/* 2. 수업 요일 수정 섹션 */}
        <section className="space-y-4">
          <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={14} /> 출석 요일 설정
          </h5>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 shadow-inner">
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => {
                const isSelected = student.class_days?.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => {
                      const currentDays = student.class_days || [];
                      const newDays = isSelected 
                        ? currentDays.filter(d => d !== day)
                        : [...currentDays, day];
                      onUpdateInfo(student.id, 'class_days', newDays);
                    }}
                    className={`flex-1 min-w-[45px] py-2.5 rounded-xl text-[11px] font-black transition-all border ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                        : 'bg-black/40 border-white/5 text-gray-500 hover:border-white/20 hover:text-gray-300'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. 교재 배정 섹션 (기존 기능 유지) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><BookOpen size={14} /> 배정된 교재 목록</h5>
            <button onClick={onRefreshBooks} className="text-gray-500 hover:text-white transition-all"><RefreshCw size={12} className={isRefreshingBooks ? 'animate-spin' : ''} /></button>
          </div>
          
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3 shadow-inner">
            {student.assigned_books.map((bookTab, i) => (
              <div key={i} className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 group/book">
                <span className="text-xs font-bold text-gray-200">
                  {availableTextbooks.find(m => m.tabName === bookTab)?.title || bookTab}
                </span>
                <button 
                  onClick={() => onUpdateInfo(student.id, 'assigned_books', student.assigned_books.filter(b => b !== bookTab))} 
                  className="text-gray-600 hover:text-red-500 transition-all p-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            
            <div className="pt-4 border-t border-white/5 flex gap-2">
              <select 
                id="textbook-select" 
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none focus:border-blue-500/50 appearance-none disabled:opacity-50 font-bold"
                disabled={isRefreshingBooks || availableTextbooks.length === 0}
              >
                <option value="">교재 선택...</option>
                {availableTextbooks.map((book, i) => (
                  <option key={i} value={book.tabName}>{book.title}</option>
                ))}
              </select>
              <button 
                onClick={() => { 
                  const select = document.getElementById('textbook-select') as HTMLSelectElement; 
                  if (select.value && !student.assigned_books.includes(select.value)) { 
                    onUpdateInfo(student.id, 'assigned_books', [...student.assigned_books, select.value]); 
                    select.value = ""; 
                  } 
                }} 
                className="bg-blue-600 px-4 py-2 rounded-xl text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
