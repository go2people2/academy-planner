'use client';

import { motion } from 'framer-motion';
import { X, BookOpen, RefreshCw, Trash2, Plus, UserPlus } from 'lucide-react';
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

export default function StudentDetailDrawer({
  student, availableTextbooks, isRefreshingBooks, onRefreshBooks, onUpdateInfo, onAddToToday, onClose
}: StudentDetailDrawerProps) {
  return (
    <motion.div 
      initial={{ x: '100%' }} 
      animate={{ x: 0 }} 
      exit={{ x: '100%' }} 
      transition={{ type: 'spring', damping: 28, stiffness: 220 }} 
      className="fixed inset-y-0 right-0 w-[420px] bg-[#0a0a0a]/95 backdrop-blur-3xl border-l border-white/10 shadow-2xl z-50 overflow-y-auto p-10 flex flex-col"
    >
      <button onClick={onClose} className="absolute left-6 top-6 p-2.5 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"><X size={18} /></button>
      
      <div className="text-center mb-8 flex-shrink-0">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-black mx-auto mb-4 shadow-xl shadow-blue-600/20">{student.name[0]}</div>
        <h3 className="text-2xl font-black text-white">{student.name}</h3>
        <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-widest">{student.grade} · {student.class}</p>
        
        {/* 💡 오늘 수업 호출 버튼 */}
        {!student.todaySession && (
          <button 
            onClick={() => onAddToToday(student.id)}
            className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-lg shadow-emerald-600/5"
          >
            <UserPlus size={14} /> 오늘 수업 명단에 추가
          </button>
        )}
      </div>
      
      <div className="flex-1 space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><BookOpen size={14} /> Assigned Textbooks</h5>
            <button onClick={onRefreshBooks} className="text-gray-500 hover:text-white transition-all"><RefreshCw size={12} className={isRefreshingBooks ? 'animate-spin' : ''} /></button>
          </div>
          
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-2">
            {student.assigned_books.map((bookTab, i) => (
              <div key={i} className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 group/book">
                <span className="text-xs font-bold text-gray-200">
                  {availableTextbooks.find(m => m.tabName === bookTab)?.title || bookTab}
                </span>
                <button 
                  onClick={() => onUpdateInfo(student.id, 'assigned_books', student.assigned_books.filter(b => b !== bookTab))} 
                  className="text-gray-600 hover:text-red-500 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            
            <div className="pt-4 border-t border-white/5 flex gap-2">
              <select 
                id="textbook-select" 
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white outline-none focus:border-blue-500/50 appearance-none disabled:opacity-50"
                disabled={isRefreshingBooks || availableTextbooks.length === 0}
              >
                <option value="">Select Textbook...</option>
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
                className="bg-blue-600 p-2 rounded-xl text-white hover:bg-blue-500"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
