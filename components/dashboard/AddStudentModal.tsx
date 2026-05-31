'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Phone, Calendar, BookOpen, Save, Loader2, Plus, Trash2, Search, Check } from 'lucide-react';
import { TextbookOption } from '@/types/dashboard';

interface AddStudentModalProps {
  onClose: () => void;
  onSave: (studentData: any) => Promise<void>;
  masterTextbooks: TextbookOption[];
  teachers?: any[]; // 💡 추가
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function AddStudentModal({ onClose, onSave, masterTextbooks, teachers = [] }: AddStudentModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    school: '',
    grade: '초5',
    course: 'C' as 'E' | 'D' | 'C' | 'B' | 'A',
    class_name: '일반반',
    phone: '',
    teacher_id: '', // 💡 추가
    class_days: [] as string[],
    day_schedules: {} as { [key: string]: number[] },
    assigned_books: [] as string[],
    book_courses: {} as Record<string, 'E' | 'D' | 'C' | 'B' | 'A'>
  });

  const filteredBooks = useMemo(() => {
    return (masterTextbooks || []).filter(b => 
      b.title?.toLowerCase().includes(bookSearch.toLowerCase()) || 
      b.grade?.toLowerCase().includes(bookSearch.toLowerCase())
    );
  }, [masterTextbooks, bookSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    
    // 💡 전화번호 숫자만 추출 (하이픈 제거)
    const cleanedData = {
      ...formData,
      phone: formData.phone.replace(/[^0-9]/g, '')
    };

    await onSave(cleanedData);
    setIsSaving(false);
    onClose();
  };

  const handleTimeToggle = (day: string, hour: number) => {
    const currentHours = formData.day_schedules[day] || [];
    const isNormalActive = currentHours.includes(hour);
    const isWhiteActive = currentHours.includes(hour + 100);
    let newHours;
    if (!isNormalActive && !isWhiteActive) newHours = [...currentHours, hour];
    else if (isNormalActive) newHours = [...currentHours.filter(h => h !== hour), hour + 100];
    else newHours = currentHours.filter(h => h !== (hour + 100));
    const sortedHours = newHours.sort((a, b) => (a % 100) - (b % 100));
    const newSchedules = { ...formData.day_schedules, [day]: sortedHours };
    let newDays = [...formData.class_days];
    if (sortedHours.length > 0 && !newDays.includes(day)) newDays.push(day);
    else if (sortedHours.length === 0 && newDays.includes(day)) newDays = newDays.filter(d => d !== day);
    setFormData({ ...formData, day_schedules: newSchedules, class_days: newDays });
  };

  const handleDayToggle = (day: string) => {
    const isSelected = formData.class_days.includes(day);
    if (isSelected) {
      const newDays = formData.class_days.filter(d => d !== day);
      const newSchedules = { ...formData.day_schedules };
      delete newSchedules[day];
      setFormData({ ...formData, class_days: newDays, day_schedules: newSchedules });
    } else {
      const newDays = [...formData.class_days, day];
      const newSchedules = { ...formData.day_schedules, [day]: [16, 17, 18] };
      setFormData({ ...formData, class_days: newDays, day_schedules: newSchedules });
    }
  };

  const toggleBookSelection = (bookcode: string) => {
    setFormData(prev => {
      const isSelected = prev.assigned_books.includes(bookcode);
      const newBooks = isSelected
        ? prev.assigned_books.filter(b => b !== bookcode)
        : [...prev.assigned_books, bookcode];
      
      const newBookCourses = { ...prev.book_courses };
      if (!isSelected) {
        newBookCourses[bookcode] = prev.course;
      } else {
        delete newBookCourses[bookcode];
      }

      return {
        ...prev,
        assigned_books: newBooks,
        book_courses: newBookCourses
      };
    });
  };

  const updateBookCourse = (bookcode: string, course: 'E' | 'D' | 'C' | 'B' | 'A') => {
    setFormData(prev => ({
      ...prev,
      book_courses: { ...prev.book_courses, [bookcode]: course }
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0f0f0f] border border-white/10 rounded-[4px] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-[2px] flex items-center justify-center shadow-lg shadow-blue-600/20"><UserPlus className="text-white" size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Register New Student</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">학생 정보 및 교재 일괄 선택</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar-v p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1"><UserPlus size={14} /> Basic Info</h3>
              <div className="bg-white/5 border border-white/5 rounded-[4px] p-5 space-y-4 shadow-inner">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Name</label>
                  <input required type="text" placeholder="학생 이름" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm focus:border-blue-500 outline-none transition-all font-bold" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">School</label>
                  <input type="text" placeholder="학교명" value={formData.school} onChange={(e) => setFormData({...formData, school: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm focus:border-blue-500 outline-none transition-all" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Grade</label>
                    <select value={formData.grade} onChange={(e) => setFormData({...formData, grade: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer">
                      {['초5','초6','중1','중2','중3','고1','고2','고3'].map(g => <option key={g} value={g} className="bg-[#121212]">{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Course</label>
                    <select value={formData.course} onChange={(e) => setFormData({...formData, course: e.target.value as any})}
                      className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer font-black text-blue-500">
                      {[
                        { l: 'E', p: '100%' },
                        { l: 'D', p: '90%' },
                        { l: 'C', p: '80%' },
                        { l: 'B', p: '70%' },
                        { l: 'A', p: '50%' }
                      ].map(c => <option key={c.l} value={c.l} className="bg-[#121212] text-white">{c.l} ({c.p})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Class</label>
                    <input type="text" placeholder="반" value={formData.class_name} onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm focus:border-blue-500 outline-none transition-all" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Assigned Teacher</label>
                  <select 
                    value={formData.teacher_id} 
                    onChange={(e) => setFormData({...formData, teacher_id: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer font-bold text-blue-400"
                  >
                    <option value="" className="bg-[#121212]">미배정 (전체 노출)</option>
                    {teachers.map((t, idx) => <option key={t.id || idx} value={t.id} className="bg-[#121212]">{t.name} 선생님</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Phone (Password)</label>
                  <input required type="tel" placeholder="010-0000-0000" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm focus:border-blue-500 outline-none transition-all font-bold" />
                </div>
              </div>
            </div>

            <div className="space-y-6 flex flex-col h-full">
              <h3 className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center justify-between px-1">
                <span className="flex items-center gap-2"><BookOpen size={14} /> Textbooks</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-[2px]">{formData.assigned_books.length} Selected</span>
              </h3>
              <div className="bg-white/5 border border-white/5 rounded-[4px] flex flex-col overflow-hidden h-[400px] shadow-inner">
                <div className="p-3 border-b border-white/5 bg-black/20 flex items-center gap-2">
                  <Search size={14} className="text-gray-500" />
                  <input type="text" placeholder="Search textbooks..." value={bookSearch} onChange={(e) => setBookSearch(e.target.value)}
                    className="bg-transparent border-none text-xs text-white outline-none w-full" />
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar-v space-y-1">
                  {filteredBooks.filter(b => !!b.bookcode).map((book) => {
                    const isSelected = formData.assigned_books.includes(book.bookcode);
                    const bookCourse = formData.book_courses[book.bookcode] || formData.course;
                    return (
                      <div key={book.bookcode} className={`p-3 rounded-[2px] transition-all border ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30' : 'hover:bg-white/5 border-transparent'}`}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleBookSelection(book.bookcode)}>
                          <div>
                            <h4 className={`text-[11px] font-bold ${isSelected ? 'text-emerald-400' : 'text-gray-300'}`}>{book.title}</h4>
                            <p className="text-[9px] text-gray-500">{book.grade} · {book.ePeriod}</p>
                          </div>
                          {isSelected && <div className="bg-emerald-500 text-black p-0.5 rounded-full"><Check size={10} strokeWidth={4} /></div>}
                        </div>
                        
                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest">Select Course</span>
                            <div className="flex gap-1">
                              {['E','D','C','B','A'].map(c => (
                                <button 
                                  key={c}
                                  type="button"
                                  onClick={() => updateBookCourse(book.bookcode, c as any)}
                                  className={`w-6 h-5 rounded-[2px] text-[9px] font-black transition-all ${
                                    bookCourse === c ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-gray-600 hover:bg-white/10'
                                  }`}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredBooks.length === 0 && <p className="text-center text-[10px] text-gray-600 py-10 italic">검색 결과가 없습니다.</p>}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1"><Calendar size={14} /> Schedule</h3>
              <div className="bg-white/5 border border-white/5 rounded-[4px] p-4 shadow-inner">
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map(day => {
                    const activeHours = formData.day_schedules[day] || [];
                    const isDaySelected = formData.class_days.includes(day);
                    return (
                      <div key={day} className="flex flex-col items-center gap-3">
                        <button type="button" onClick={() => handleDayToggle(day)}
                          className={`text-[9px] font-black w-7 h-7 rounded-[2px] flex items-center justify-center transition-all ${isDaySelected ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'}`}>{day}</button>
                        <div className="flex flex-col gap-1 w-full">
                          {[16, 17, 18, 19, 20, 21].map((h, idx) => {
                            const isNormal = activeHours.includes(h);
                            const isWhite = activeHours.includes(h + 100);
                            const isFirstHalf = idx < 3;
                            return (
                              <button key={h} type="button" onClick={() => handleTimeToggle(day, h)}
                                className={`w-full h-3 rounded-sm transition-all ${isNormal ? (isFirstHalf ? 'bg-blue-500' : 'bg-orange-400') : isWhite ? 'bg-white' : 'bg-white/[0.03]'}`} />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-white/5 bg-white/[0.01] flex justify-end items-center gap-4 px-10">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-[2px] text-[11px] font-black uppercase text-gray-500 hover:text-white transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={isSaving || !formData.name}
            className="flex items-center gap-3 px-10 py-4 rounded-[2px] bg-blue-600 text-white text-[12px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/20 hover:bg-blue-500 transition-all disabled:opacity-50">
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Complete Registration</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
