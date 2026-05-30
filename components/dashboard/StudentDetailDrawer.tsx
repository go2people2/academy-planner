import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, RefreshCw, Trash2, User, Calendar, Search, Check, AlertTriangle, UserMinus, UserCheck, ClipboardCheck, TrendingUp } from 'lucide-react';
import { Student, TextbookOption } from '@/types/dashboard';

interface StudentDetailDrawerProps {
  student: Student;
  availableTextbooks: TextbookOption[];
  teachers: any[]; 
  isRefreshingBooks: boolean;
  onRefreshBooks: () => void;
  onUpdateInfo: (studentId: string, fieldOrUpdates: string | any, value?: any) => void;
  onAddToToday: (studentId: string) => void;
  onClose: () => void;
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function StudentDetailDrawer({
  student, availableTextbooks, teachers, isRefreshingBooks, onRefreshBooks, onUpdateInfo, onAddToToday, onClose
}: StudentDetailDrawerProps) {
  const [localSchedules, setLocalSchedules] = useState<{[key: string]: number[]}>(student.day_schedules || {});
  const [localDays, setLocalDays] = useState<string[]>(student.class_days || []);
  const [localName, setLocalName] = useState(student.name);
  const [localSchool, setLocalSchool] = useState(student.school || '');
  const [localGrade, setLocalGrade] = useState(student.grade);
  const [localCourse, setLocalCourse] = useState(student.course || 'C');
  const [localBookCourses, setLocalBookCourses] = useState<Record<string, string>>(student.book_courses || {});
  const [localClass, setLocalClass] = useState(student.class);
  const [localPhone, setLocalPhone] = useState(student.phone || '');
  const [localTeacherId, setLocalTeacherId] = useState(student.teacher_id || '');
  const [localManagementNotes, setLocalManagementNotes] = useState(student.management_notes || ''); 
  const [localRecentMission, setLocalRecentMission] = useState(student.recent_mission || ''); // 💡 추가
  const [bookSearch, setBookSearch] = useState('');
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setLocalSchedules(student.day_schedules || {});
    setLocalDays(student.class_days || []);
    setLocalName(student.name);
    setLocalSchool(student.school || '');
    setLocalGrade(student.grade);
    setLocalCourse(student.course || 'C');
    setLocalBookCourses(student.book_courses || {});
    setLocalClass(student.class);
    setLocalPhone(student.phone || '');
    setLocalTeacherId(student.teacher_id || '');
    setLocalManagementNotes(student.management_notes || '');
    setLocalRecentMission(student.recent_mission || ''); // 💡 동기화
  }, [student.id, student.day_schedules, student.class_days, student.name, student.grade, student.course, student.book_courses, student.class, student.phone, student.teacher_id, student.management_notes, student.recent_mission]);

  const filteredBooks = useMemo(() => {
    return (availableTextbooks || []).filter(b => 
      b.title?.toLowerCase().includes(bookSearch.toLowerCase()) || 
      b.grade?.toLowerCase().includes(bookSearch.toLowerCase())
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

  const toggleBookSelection = (bookcode: string) => {
    const isSelected = student.assigned_books.includes(bookcode);
    if (isSelected) {
      const book = availableTextbooks.find(b => b.bookcode === bookcode);
      if (!confirm(`[${book?.title || bookcode}] 교재 배정을 취소하시겠습니까?`)) return;
    }
    const newBooks = isSelected 
      ? student.assigned_books.filter(b => b !== bookcode)
      : [...student.assigned_books, bookcode];
    onUpdateInfo(student.id, 'assigned_books', newBooks);
  };

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 220 }} 
      className="fixed inset-y-0 right-0 w-[450px] bg-[#0a0a0a]/95 backdrop-blur-3xl border-l border-white/10 shadow-2xl z-50 overflow-y-auto p-8 flex flex-col custom-scrollbar-v">
      
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Student Profile</h3>
          {student.is_deleted && <span className="bg-red-500/10 text-red-500 text-[9px] font-black px-2 py-0.5 rounded-[2px] border border-red-500/20">퇴원생</span>}
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"><X size={18} /></button>
      </div>
      
      <div className="flex-1 space-y-10">
        {/* 1. 기본 정보 */}
        <section className="bg-white/5 border border-white/5 rounded-[4px] p-4 space-y-4 shadow-inner">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4">
              <input type="text" value={localName} placeholder="Name" onChange={(e) => setLocalName(e.target.value)} onBlur={() => onUpdateInfo(student.id, 'name', localName)}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-3 text-lg font-black text-white outline-none focus:border-blue-500 transition-all" />
            </div>
            <div className="col-span-2">
              <input type="text" value={localGrade} placeholder="Grade" onChange={(e) => setLocalGrade(e.target.value)} onBlur={() => onUpdateInfo(student.id, 'grade', localGrade)}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-3 text-xs font-bold text-blue-400 text-center outline-none focus:border-blue-500 transition-all" title="Grade" />
            </div>
            <div className="col-span-3">
              <select value={localCourse} onChange={(e) => {
                const val = e.target.value as any;
                setLocalCourse(val);
                onUpdateInfo(student.id, 'course', val);
              }} className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-3 text-xs font-black text-blue-500 text-center outline-none appearance-none cursor-pointer">
                {['E','D','C','B','A'].map(c => <option key={c} value={c} className="bg-[#121212]">{c} Course</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <input type="text" value={localClass} placeholder="Class" onChange={(e) => setLocalClass(e.target.value)} onBlur={() => onUpdateInfo(student.id, 'class_name', localClass)}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-3 text-xs font-bold text-gray-400 text-center outline-none focus:border-blue-500 transition-all" />
            </div>
            <div className="col-span-12">
              <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-[2px] px-3 py-2">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest shrink-0">Manager:</span>
                <select 
                  value={localTeacherId} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalTeacherId(val);
                    onUpdateInfo(student.id, 'teacher_id', val || null);
                  }}
                  className="flex-1 bg-transparent text-[11px] font-black text-blue-400 outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#121212]">미배정 (전체 노출)</option>
                  {teachers.map((t, idx) => <option key={t.id || idx} value={t.id} className="bg-[#121212]">{t.name} 선생님</option>)}
                </select>
              </div>
            </div>
          </div>

          {student.assigned_books.length > 0 && (
            <div className="flex flex-col gap-2 py-1 border-y border-white/5 mx-1">
              <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">Book Courses (Overridable)</label>
              <div className="flex flex-wrap gap-1.5">
                {student.assigned_books.filter(code => !!code).map((code, idx) => {
                  const book = availableTextbooks.find(b => b.bookcode === code);
                  const rawCourseValue = localBookCourses[code] || localCourse;
                  const isKeep = String(rawCourseValue).endsWith('-keep');
                  const currentCourse = isKeep ? rawCourseValue.replace('-keep', '') : rawCourseValue;

                  return (
                    <div key={`${code}-${idx}`} className={`flex items-center gap-1.5 px-2 py-1 rounded-[2px] group border ${isKeep ? 'bg-amber-500/5 border-amber-500/20' : book ? 'bg-white/[0.03] border-white/5' : 'bg-red-500/10 border-red-500/20'}`}>
                      <span className={`text-[9px] font-black px-1.5 ${isKeep ? 'text-amber-500' : book ? 'text-gray-400' : 'text-red-400'}`}>
                        {book ? book.title : `(${code})`}
                        {isKeep && <span className="ml-1 text-[7px] bg-amber-500 text-black px-1 rounded-sm uppercase tracking-tighter">Keep</span>}
                      </span>
                      <select 
                        value={currentCourse}
                        onChange={(e) => {
                          const newVal = isKeep ? `${e.target.value}-keep` : e.target.value;
                          const newCourses = { ...localBookCourses, [code]: newVal };
                          setLocalBookCourses(newCourses);
                          onUpdateInfo(student.id, 'book_courses', newCourses);
                        }}
                        className={`bg-blue-600/20 text-blue-500 text-[10px] font-black rounded-[2px] px-1 py-0.5 outline-none appearance-none cursor-pointer hover:bg-blue-600 hover:text-white transition-all ${isKeep ? 'opacity-50' : ''}`}
                      >
                        {['E','D','C','B','A'].map(c => <option key={c} value={c} className="bg-[#121212]">{c}</option>)}
                      </select>
                      
                      <button 
                        onClick={() => {
                          const newVal = isKeep ? currentCourse : `${currentCourse}-keep`;
                          const newCourses = { ...localBookCourses, [code]: newVal };
                          setLocalBookCourses(newCourses);
                          onUpdateInfo(student.id, 'book_courses', newCourses);
                        }}
                        className={`text-[8px] font-black px-1.5 py-0.5 rounded-[2px] transition-all ${isKeep ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-500 hover:bg-amber-500/20 hover:text-amber-500 border border-transparent'}`}
                      >
                        KEEP
                      </button>

                      <button onClick={() => toggleBookSelection(code)} className="text-gray-600 hover:text-red-500 transition-colors ml-1"><X size={10} strokeWidth={3} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="relative group">
              <input type="text" value={localSchool} placeholder="School Name" onChange={(e) => setLocalSchool(e.target.value)} onBlur={() => onUpdateInfo(student.id, 'school', localSchool)}
                className="w-full bg-black/20 border border-white/5 rounded-[2px] px-4 py-2.5 text-xs text-gray-400 outline-none focus:border-blue-500/50 transition-all font-bold" />
            </div>
            <div className="relative group">
              <input type="tel" value={localPhone} placeholder="Phone Number" onChange={(e) => setLocalPhone(e.target.value)} onBlur={() => onUpdateInfo(student.id, 'phone', localPhone)}
                className="w-full bg-black/20 border border-white/5 rounded-[2px] px-4 py-2.5 text-xs text-gray-500 outline-none focus:border-blue-500/50 transition-all font-bold" />
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Last Consulted</span>
              <span className="text-[10px] font-bold text-gray-400">{student.last_consulted_at ? student.last_consulted_at.replace(/-/g, '.') : '기록 없음'}</span>
            </div>
            <button 
              onClick={() => {
                const now = new Date();
                const offset = now.getTimezoneOffset() * 60000;
                const localToday = new Date(now.getTime() - offset).toISOString().split('T')[0];
                onUpdateInfo(student.id, 'last_consulted_at', localToday);
              }}
              className="px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-[2px] text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/5 flex items-center gap-2"
            >
              <UserCheck size={12} /> 오늘 상담 완료
            </button>
          </div>
        </section>

        {/* 2. 스케줄 설정 */}
        <section className="space-y-4">
          <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 px-1"><Calendar size={14} /> Weekly Schedule</h5>
          <div className="bg-white/5 border border-white/5 rounded-[4px] p-4 shadow-inner">
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(day => {
                const activeHours = localSchedules[day] || [];
                const isDaySelected = localDays.includes(day);
                return (
                  <div key={day} className="flex flex-col items-center gap-3">
                    <button onClick={() => handleDayToggle(day)} className={`text-[10px] font-black w-8 h-8 rounded-[2px] flex items-center justify-center transition-all ${isDaySelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-gray-300'}`}>{day}</button>
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

        {/* 3. 교재 다중 선택 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><BookOpen size={14} /> Assigned Textbooks</h5>
            <button onClick={onRefreshBooks} className="text-gray-500 hover:text-white transition-all"><RefreshCw size={12} className={isRefreshingBooks ? 'animate-spin' : ''} /></button>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-[4px] flex flex-col overflow-hidden h-[300px] shadow-inner">
            <div className="p-3 border-b border-white/5 bg-black/20 flex items-center gap-2">
              <Search size={14} className="text-gray-500" />
              <input type="text" placeholder="Search textbooks..." value={bookSearch} onChange={(e) => setBookSearch(e.target.value)}
                className="bg-transparent border-none text-[11px] text-white outline-none w-full" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar-v space-y-1">
              {filteredBooks.filter(b => !!b.bookcode).map((book) => {
                // 💡 더욱 유연한 선택 상태 판별 (이전 코드와 새 코드가 섞여 있어도 매칭되도록)
                const isSelected = (student.assigned_books || []).some(code => 
                  code === book.bookcode || 
                  book.bookcode.toLowerCase().startsWith(code.toLowerCase()) ||
                  code.toLowerCase().startsWith(book.bookcode.toLowerCase())
                );
                return (
                  <div key={book.bookcode} onClick={() => toggleBookSelection(book.bookcode)}
                    className={`flex items-center justify-between p-2.5 rounded-[2px] cursor-pointer transition-all border ${isSelected ? 'bg-blue-600/10 border-blue-500/30' : 'hover:bg-white/5 border-transparent'}`}>
                    <div>
                      <h4 className={`text-[11px] font-bold ${isSelected ? 'text-blue-400' : 'text-gray-300'}`}>{book.title}</h4>
                      <p className="text-[9px] text-gray-500">{book.grade} · {book.ePeriod}</p>
                    </div>
                    {isSelected && <div className="bg-blue-500 text-white p-0.5 rounded-full"><Check size={10} strokeWidth={4} /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. 💡 선생님 전용 관리 메모 (포스트잇 스타일) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <ClipboardCheck size={14} /> Teacher's Management Notes
            </h5>
            <span className="text-[8px] font-bold text-gray-600 uppercase">선생님간 공유 / 학생 비노출</span>
          </div>
          
          <div className="relative group/postit">
            <div className="absolute inset-0 bg-amber-200 rounded-sm shadow-[5px_5px_15px_rgba(0,0,0,0.3)] rotate-[-1deg] transition-transform group-hover/postit:rotate-0" />
            <div className="relative bg-amber-100/90 backdrop-blur-sm p-5 min-h-[120px] rounded-sm flex flex-col shadow-inner">
              <textarea 
                value={localManagementNotes}
                maxLength={300}
                onChange={(e) => {
                  setLocalManagementNotes(e.target.value);
                  onUpdateInfo(student.id, 'management_notes', e.target.value);
                }}
                placeholder="이 학생에 대해 꼭 기억해야 할 핵심 내용을 적어주세요 (성향, 주의사항 등)..."
                className="w-full bg-transparent border-none text-[13px] font-bold text-amber-900/80 outline-none resize-none leading-relaxed placeholder:text-amber-700/30 flex-1 custom-scrollbar-v"
              />
              <div className="flex justify-between items-center mt-3 pt-2 border-t border-amber-900/10">
                <span className="text-[8px] font-black text-amber-800/40 uppercase tracking-tighter">Sticky Note</span>
                <span className={`text-[9px] font-black ${localManagementNotes.length >= 280 ? 'text-red-500' : 'text-amber-800/40'}`}>
                  {localManagementNotes.length}/300
                </span>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-amber-300/50 rounded-tl-full shadow-[-2px_-2px_5px_rgba(0,0,0,0.1)] pointer-events-none" />
          </div>
        </section>

        {/* 5. 💡 학생 노출용 미션 설정 (블루 테마) */}
        <section className="space-y-3 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between px-1">
            <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={14} /> Student Recent Mission
            </h5>
            <span className="text-[8px] font-bold text-gray-600 uppercase">학생 대시보드에 상시 노출</span>
          </div>
          
          <div className="relative group/mission">
            <div className="relative bg-blue-600/5 border border-blue-500/20 p-5 min-h-[100px] rounded-sm flex flex-col shadow-inner">
              <textarea 
                value={localRecentMission}
                onChange={(e) => {
                  setLocalRecentMission(e.target.value);
                  onUpdateInfo(student.id, 'recent_mission', e.target.value);
                }}
                placeholder="학생에게 전달할 이번 주 미션을 입력하세요..."
                className="w-full bg-transparent border-none text-[12px] font-bold text-blue-100 placeholder:text-blue-500/30 outline-none resize-none flex-1 leading-relaxed"
              />
              <div className="absolute bottom-2 right-2 opacity-20 group-hover/mission:opacity-40 transition-opacity">
                <TrendingUp size={32} className="text-blue-400" />
              </div>
            </div>
          </div>
        </section>

        {/* 6. 💡 학생 관리 (재원, 퇴원) */}
        <section className="space-y-4 pt-10 border-t border-white/5">
          <h5 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2 px-1"><AlertTriangle size={14} /> Student Management</h5>
          <div className="flex flex-col gap-2">
            {!student.is_deleted ? (
              <button 
                onClick={() => {
                  const reason = prompt(`${student.name} 학생의 퇴원 사유를 입력해주세요.`);
                  if (reason !== null) {
                    onUpdateInfo(student.id, { is_deleted: true, phone: `${student.phone || ''} (퇴원: ${reason})` });
                    onClose();
                  }
                }}
                className="flex items-center justify-center gap-2 w-full py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-[2px] text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5"
              >
                <UserMinus size={14} /> 학생 퇴원 처리 및 보관
              </button>
            ) : (
              <div className="space-y-3">
                <button onClick={() => onUpdateInfo(student.id, 'is_deleted', false)}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-[2px] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
                >
                  <UserCheck size={14} /> 재원생으로 복구
                </button>
                
                <div className="p-4 rounded-[4px] bg-red-500/5 border border-red-500/10 space-y-3">
                  <p className="text-[9px] text-gray-500 leading-relaxed font-medium">* 리포트(PDF) 출력 후 개인정보 파기가 필요한 경우 아래 버튼을 사용하세요.</p>
                  <button onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-600 text-white rounded-[2px] text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                  >
                    <Trash2 size={12} /> 프로필 영구 삭제 (개인정보 파기)
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-[#1a1a1a] border border-white/10 p-6 rounded-[4px] max-w-sm w-full shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto"><Trash2 size={24} /></div>
              <h4 className="text-white font-black">개인정보를 영구 파기할까요?</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">학생의 이름, 연락처 등 프로필 정보가 완전히 삭제됩니다.</p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-white/5 text-gray-500 rounded-[2px] text-[10px] font-black uppercase">취소</button>
                <button onClick={async () => { onUpdateInfo(student.id, 'PERMANENT_DELETE', true); setShowDeleteConfirm(false); onClose(); }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-[2px] text-[10px] font-black uppercase shadow-lg shadow-red-600/20"
                >파기 확인</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
