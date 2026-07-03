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
    book_courses: {} as Record<string, string>
  });

  const [startTimes, setStartTimes] = useState<Record<string, string>>({});
  const [endTimes, setEndTimes] = useState<Record<string, string>>({});

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

  const handleTimeChange = (day: string, startTimeStr: string, endTimeStr: string) => {
    setStartTimes(prev => ({ ...prev, [day]: startTimeStr }));
    setEndTimes(prev => ({ ...prev, [day]: endTimeStr }));

    if (startTimeStr === '' && endTimeStr === '') {
      const newSchedules = { ...formData.day_schedules };
      delete newSchedules[day];
      const newDays = formData.class_days.filter(d => d !== day);
      setFormData(prev => ({ ...prev, day_schedules: newSchedules, class_days: newDays }));
      return;
    }

    const isStartValid = startTimeStr && startTimeStr.length === 5 && startTimeStr.includes(':');
    const isEndValid = endTimeStr && endTimeStr.length === 5 && endTimeStr.includes(':');

    const finalStartVal = isStartValid 
      ? parseInt(startTimeStr.replace(':', '')) 
      : (formData.day_schedules[day]?.[0] || 1600);
      
    const finalEndVal = isEndValid 
      ? parseInt(endTimeStr.replace(':', '')) 
      : (formData.day_schedules[day]?.[1] || 1900);

    if (!isNaN(finalStartVal) && !isNaN(finalEndVal)) {
      const newSchedules = { ...formData.day_schedules, [day]: [finalStartVal, finalEndVal] };
      
      if (isStartValid || isEndValid) {
        const newDays = formData.class_days.includes(day) ? formData.class_days : [...formData.class_days, day];
        setFormData(prev => ({ ...prev, day_schedules: newSchedules, class_days: newDays }));
      }
    }
  };

  const handleDayToggle = (day: string) => {
    const isSelected = formData.class_days.includes(day);
    if (isSelected) {
      const newDays = formData.class_days.filter(d => d !== day);
      const newSchedules = { ...formData.day_schedules };
      delete newSchedules[day];
      setFormData(prev => ({ ...prev, class_days: newDays, day_schedules: newSchedules }));
      
      setStartTimes(prev => ({ ...prev, [day]: '' }));
      setEndTimes(prev => ({ ...prev, [day]: '' }));
    } else {
      const newDays = [...formData.class_days, day];
      const newSchedules = { ...formData.day_schedules, [day]: [1600, 1900] };
      setFormData(prev => ({ ...prev, class_days: newDays, day_schedules: newSchedules }));
      
      setStartTimes(prev => ({ ...prev, [day]: '16:00' }));
      setEndTimes(prev => ({ ...prev, [day]: '19:00' }));
    }
  };

  const handleApplyTimeToAllDays = () => {
    const selectedDays = DAYS.filter(day => formData.class_days.includes(day));
    if (selectedDays.length <= 1) return;

    const firstDay = selectedDays[0];
    const baseStart = startTimes[firstDay] || '';
    const baseEnd = endTimes[firstDay] || '';

    if (!baseStart && !baseEnd) {
      alert('일괄 적용할 기준 시간이 입력되지 않았습니다.');
      return;
    }

    const newStarts = { ...startTimes };
    const newEnds = { ...endTimes };
    const newSchedules = { ...formData.day_schedules };

    selectedDays.forEach(day => {
      newStarts[day] = baseStart;
      newEnds[day] = baseEnd;
      
      const startVal = baseStart ? parseInt(baseStart.replace(':', '')) : 1600;
      const endVal = baseEnd ? parseInt(baseEnd.replace(':', '')) : 1900;
      newSchedules[day] = [startVal, endVal];
    });

    setStartTimes(newStarts);
    setEndTimes(newEnds);
    setFormData(prev => ({ ...prev, day_schedules: newSchedules }));
  };

  const toggleBookSelection = (bookcode: string) => {
    setFormData(prev => {
      const isSelected = prev.assigned_books.includes(bookcode);
      const newBooks = isSelected
        ? prev.assigned_books.filter(b => b !== bookcode)
        : [...prev.assigned_books, bookcode];
      
      const newBookCourses = { ...prev.book_courses };
      if (!isSelected) {
        const currentMonth = new Date().getMonth() + 1;
        newBookCourses[bookcode] = `${prev.course}-start-${prev.grade || '미지정'}_${currentMonth}월`;
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
    setFormData(prev => {
      const oldVal = prev.book_courses[bookcode];
      let newVal = course as string;
      if (oldVal && String(oldVal).includes('-start-')) {
        newVal = `${course}-start-${String(oldVal).split('-start-')[1]}`;
      }
      return {
        ...prev,
        book_courses: { ...prev.book_courses, [bookcode]: newVal }
      };
    });
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
              <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center justify-between px-1 w-full">
                <span className="flex items-center gap-2">
                  <Calendar size={14} /> Schedule
                </span>
                {formData.class_days.length > 1 && (
                  <button
                    type="button"
                    onClick={handleApplyTimeToAllDays}
                    className="text-[9px] font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded px-2 py-0.5 transition-all cursor-pointer normal-case"
                    title="첫 요일의 시간을 다른 모든 요일에 동일하게 적용합니다."
                  >
                    ⚡ 동일적용
                  </button>
                )}
              </h3>
              <div className="bg-white/5 border border-white/5 rounded-[4px] p-4 shadow-inner">
                {/* 요일 선택 가로 바 */}
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {DAYS.map(day => {
                    const isDaySelected = formData.class_days.includes(day);
                    return (
                      <button 
                        key={`bar-${day}`}
                        type="button"
                        onClick={() => handleDayToggle(day)} 
                        className={`text-[10px] font-black h-8 rounded-[2px] flex items-center justify-center transition-all ${
                          isDaySelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* 선택된 요일들의 시간대 설정 리스트 */}
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const selectedDays = DAYS.filter(day => formData.class_days.includes(day));
                    if (selectedDays.length === 0) {
                      return (
                        <div className="text-[10px] text-gray-500 text-center py-4 italic w-full">수업 요일을 위에서 선택해 주세요.</div>
                      );
                    }

                    // 4자리 정수(HHMM) -> "HH:MM" 텍스트 추출 헬퍼 (오후 시간 자동 보정 포함)
                    const formatTimeVal = (val: number) => {
                      if (!val || val === 999) return '';
                      if (val < 100) {
                        const hour = val <= 12 ? val + 12 : val;
                        return `${hour.toString().padStart(2, '0')}:00`;
                      }
                      let h = Math.floor(val / 100);
                      if (h <= 12) h += 12; // 12시 이하의 값은 학원 특성상 오후(PM)로 보정
                      const m = (val % 100).toString().padStart(2, '0');
                      return `${h.toString().padStart(2, '0')}:${m}`;
                    };

                    // 10분 단위 선택지 리스트 생성
                    return selectedDays.map(day => {
                      const startTime = startTimes[day] || '';
                      const endTime = endTimes[day] || '';

                      return (
                        <div key={`row-${day}`} className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-2 py-1 rounded-[4px] shrink-0">
                          {/* 활성화된 요일 표시 */}
                          <span className="text-[9px] font-black text-blue-400 bg-blue-600/10 w-5 h-5 flex items-center justify-center rounded-[2px] shrink-0">
                            {day}
                          </span>

                          {/* 시작/종료 시간 직접 입력 인풋 */}
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              value={startTime}
                              onChange={(e) => handleTimeChange(day, e.target.value, endTime)}
                              onClick={(e) => {
                                try { e.currentTarget.showPicker(); } catch (err) {}
                              }}
                              className="bg-black/40 border border-white/10 rounded-[2px] px-1 py-0.5 text-[9px] text-gray-300 outline-none focus:border-blue-500 transition-all font-bold w-[100px] cursor-pointer"
                            />
                            <span className="text-[9px] text-gray-600">~</span>
                            <input
                              type="time"
                              value={endTime}
                              onChange={(e) => handleTimeChange(day, startTime, e.target.value)}
                              onClick={(e) => {
                                try { e.currentTarget.showPicker(); } catch (err) {}
                              }}
                              className="bg-black/40 border border-white/10 rounded-[2px] px-1 py-0.5 text-[9px] text-gray-300 outline-none focus:border-blue-500 transition-all font-bold w-[100px] cursor-pointer"
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
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
