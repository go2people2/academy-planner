import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, BookOpen, RefreshCw, Trash2, Plus, UserPlus, User, Calendar, Clock, Search, Check } from 'lucide-react';
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
  const [localSchedules, setLocalSchedules] = useState<{[key: string]: number[]}>(student.day_schedules || {});
  const [localDays, setLocalDays] = useState<string[]>(student.class_days || []);
  const [localName, setLocalName] = useState(student.name);
  const [localGrade, setLocalGrade] = useState(student.grade);
  const [localClass, setLocalClass] = useState(student.class);
  const [bookSearch, setBookSearch] = useState('');

  useEffect(() => {
    setLocalSchedules(student.day_schedules || {});
    setLocalDays(student.class_days || []);
    setLocalName(student.name);
    setLocalGrade(student.grade);
    setLocalClass(student.class);
  }, [student.id, student.day_schedules, student.class_days, student.name, student.grade, student.class]);

  const filteredBooks = useMemo(() => {
    return availableTextbooks.filter(b => 
      b.title.toLowerCase().includes(bookSearch.toLowerCase()) || 
      b.grade.toLowerCase().includes(bookSearch.toLowerCase())
    );
  }, [availableTextbooks, bookSearch]);

  const handleTimeToggle = (day: string, hour: number) => {
    const currentHours = localSchedules[day] || [];
    const isNormalActive = currentHours.includes(hour);
    const isWhiteActive = currentHours.includes(hour + 100);
    let newHours;
    if (!isNormalActive && !isWhiteActive) newHours = [...currentHours, hour];
    else if (isNormalActive) newHours = [...currentHours.filter(h => h !== hour), hour + 100];
    else newHours = currentHours.filter(h => h !== (hour + 100));
    const sortedHours = newHours.sort((a, b) => (a % 100) - (b % 100));
    const newSchedules = { ...localSchedules, [day]: sortedHours };
    setLocalSchedules(newSchedules);
    if (!localDays.includes(day) && sortedHours.length > 0) {
      const newDays = [...localDays, day];
      setLocalDays(newDays);
      onUpdateInfo(student.id, 'class_days', newDays);
    }
    onUpdateInfo(student.id, 'day_schedules', newSchedules);
  };

  const handleDayToggle = (day: string) => {
    const isSelected = localDays.includes(day);
    const newDays = isSelected ? localDays.filter(d => d !== day) : [...localDays, day];
    setLocalDays(newDays);
    onUpdateInfo(student.id, 'class_days', newDays);
    if (!isSelected && (!localSchedules[day] || localSchedules[day].length === 0)) {
      const newSchedules = { ...localSchedules, [day]: [16, 17, 18] };
      setLocalSchedules(newSchedules);
      onUpdateInfo(student.id, 'day_schedules', newSchedules);
    }
  };

  const toggleBookSelection = (tabName: string) => {
    const isSelected = student.assigned_books.includes(tabName);
    const newBooks = isSelected 
      ? student.assigned_books.filter(b => b !== tabName)
      : [...student.assigned_books, tabName];
    onUpdateInfo(student.id, 'assigned_books', newBooks);
  };

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 220 }} 
      className="fixed inset-y-0 right-0 w-[450px] bg-[#0a0a0a]/95 backdrop-blur-3xl border-l border-white/10 shadow-2xl z-50 overflow-y-auto p-8 flex flex-col custom-scrollbar-v">
      <button onClick={onClose} className="absolute left-6 top-6 p-2.5 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"><X size={18} /></button>
      
      <div className="text-center mb-8 flex-shrink-0 pt-6">
        <h3 className="text-2xl font-black text-white">{localName}</h3>
        <p className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-widest">{localGrade} · {localClass}</p>
        {!student.todaySession && (
          <button onClick={() => onAddToToday(student.id)} className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-lg">
            <UserPlus size={14} /> 오늘 수업 명단에 추가
          </button>
        )}
      </div>
      
      <div className="flex-1 space-y-10">
        {/* 1. 기본 정보 */}
        <section className="space-y-4">
          <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 px-1"><User size={14} /> Basic Information</h5>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4 shadow-inner">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">이름</label>
                <input type="text" value={localName} onChange={(e) => setLocalName(e.target.value)} onBlur={() => onUpdateInfo(student.id, 'name', localName)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-all font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">학년</label>
                <input type="text" value={localGrade} onChange={(e) => setLocalGrade(e.target.value)} onBlur={() => onUpdateInfo(student.id, 'grade', localGrade)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-all font-bold" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-500 uppercase ml-1">반 / 담당 선생님</label>
              <input type="text" value={localClass} onChange={(e) => setLocalClass(e.target.value)} onBlur={() => onUpdateInfo(student.id, 'class_name', localClass)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-all font-bold" />
            </div>
          </div>
        </section>

        {/* 2. 스케줄 설정 */}
        <section className="space-y-4">
          <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 px-1"><Calendar size={14} /> Schedule Setting</h5>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 shadow-inner">
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(day => {
                const activeHours = localSchedules[day] || [];
                const isDaySelected = localDays.includes(day);
                return (
                  <div key={day} className="flex flex-col items-center gap-3">
                    <button onClick={() => handleDayToggle(day)} className={`text-[10px] font-black w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDaySelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}>{day}</button>
                    <div className="flex flex-col gap-1 w-full px-1">
                      {[16, 17, 18, 19, 20, 21].map((h, idx) => {
                        const isNormal = activeHours.includes(h);
                        const isWhite = activeHours.includes(h + 100);
                        const isFirstHalf = idx < 3;
                        return (
                          <button key={h} onClick={() => handleTimeToggle(day, h)}
                            className={`w-full h-3.5 rounded-sm transition-all duration-150 ${isNormal ? (isFirstHalf ? 'bg-blue-500' : 'bg-orange-400') : isWhite ? 'bg-white border border-gray-300' : 'bg-white/[0.03] hover:bg-white/10'}`} />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. 교재 다중 선택 (신규) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><BookOpen size={14} /> Assigned Textbooks</h5>
            <button onClick={onRefreshBooks} className="text-gray-500 hover:text-white transition-all"><RefreshCw size={12} className={isRefreshingBooks ? 'animate-spin' : ''} /></button>
          </div>
          
          <div className="bg-white/5 border border-white/5 rounded-2xl flex flex-col overflow-hidden max-h-[400px] shadow-inner">
            <div className="p-3 border-b border-white/5 bg-black/20 flex items-center gap-2">
              <Search size={14} className="text-gray-500" />
              <input type="text" placeholder="Search textbooks..." value={bookSearch} onChange={(e) => setBookSearch(e.target.value)}
                className="bg-transparent border-none text-[11px] text-white outline-none w-full" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar-v space-y-1">
              {filteredBooks.map((book) => {
                const isSelected = student.assigned_books.includes(book.tabName);
                return (
                  <div key={book.tabName} onClick={() => toggleBookSelection(book.tabName)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-blue-600/10 border-blue-500/30' : 'hover:bg-white/5 border-transparent'}`}>
                    <div>
                      <h4 className={`text-[11px] font-bold ${isSelected ? 'text-blue-400' : 'text-gray-300'}`}>{book.title}</h4>
                      <p className="text-[9px] text-gray-500">{book.grade} · {book.course}</p>
                    </div>
                    {isSelected && <div className="bg-blue-500 text-white p-0.5 rounded-full"><Check size={10} strokeWidth={4} /></div>}
                  </div>
                );
              })}
              {filteredBooks.length === 0 && <p className="text-center text-[10px] text-gray-600 py-10 italic">검색 결과가 없습니다.</p>}
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
