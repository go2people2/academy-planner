'use client';

import { User, Calendar as CalendarIcon, FileText, LogOut } from 'lucide-react';

interface StudentHeaderProps {
  student: any;
  teachers: any[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  matchedExam: any;
  getRemainingClasses: (targetDate: string) => number | null;
  handleLogout: () => void;
  getInitial: (name: string) => string;
}

export default function StudentHeader({
  student,
  teachers,
  selectedDate,
  setSelectedDate,
  matchedExam,
  getRemainingClasses,
  handleLogout,
  getInitial
}: StudentHeaderProps) {
  return (
    <header className="px-8 py-4 flex items-center justify-between bg-[#0a0a0a] border-b border-white/5 shrink-0 z-20 shadow-xl">
      <div className="flex items-center gap-6 flex-1">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[4px] flex items-center justify-center shadow-lg shadow-blue-900/40 border border-blue-500/30">
          <User className="text-white" size={24} />
        </div>
        <div className="min-w-0 text-left">
          <div className="flex flex-col md:flex-row md:items-center mb-1 gap-4 md:gap-10">
            <div className="flex items-center gap-4">
              {(() => {
                const teacher = teachers.find(t => t.id === student.teacher_id);
                const initial = teacher ? (teacher.initials || getInitial(teacher.name)) : '?';
                const days = student.class_days?.join('') || '무';
                const rawClass = student.class_name || '일반반';
                const simplifiedClass = rawClass.split('-')[0].trim();

                return (
                  <>
                    <div className="flex items-center gap-3">
                      <h1 className="text-xl font-black text-white truncate tracking-tight">
                        {student.name}-{initial}-{days}
                      </h1>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                      <span className="text-blue-400/80">{student.grade} · {simplifiedClass}</span>
                    </div>
                  </>
                );
              })()}
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {/* 날짜 선택기 */}
              <div 
                onClick={(e) => {
                  const input = e.currentTarget.querySelector('input');
                  if (input && 'showPicker' in input) {
                    try { (input as any).showPicker(); } catch (err) { console.error(err); }
                  }
                }}
                className="flex items-center gap-3 bg-blue-600/10 border border-blue-500/30 px-4 py-2 rounded-lg shadow-lg shrink-0 cursor-pointer hover:bg-blue-600/20 transition-all group relative"
              >
                <CalendarIcon className="text-blue-500 group-hover:scale-110 transition-transform" size={18} />
                <div className="text-right">
                  <p className="text-[15px] font-black text-white leading-none tracking-tight">
                    {new Date(selectedDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                    <span className="text-amber-400 ml-1.5">
                      ({new Date(selectedDate).toLocaleDateString('ko-KR', { weekday: 'short' })})
                    </span>
                  </p>
                </div>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark] z-10"
                />
              </div>

              {/* 시험 디데이 */}
              <div className={`flex items-center gap-3 border px-4 py-2 rounded-lg shadow-lg transition-all shrink-0 ${matchedExam ? 'bg-rose-600/10 border-rose-500/30' : 'bg-white/5 border-white/20'}`}>
                <FileText className={matchedExam ? 'text-rose-500' : 'text-gray-500'} size={18} />
                <div className="text-right min-w-[110px]">
                  {matchedExam ? (
                    <>
                      <p className="text-[15px] font-black text-white leading-none tracking-tight">
                        {new Date(matchedExam.target_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                        <span className="text-rose-400 ml-1.5 uppercase text-[9px] tracking-widest font-black">Exam</span>
                      </p>
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.15em] mt-1">
                        {getRemainingClasses(matchedExam.target_date)} Classes Left
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[12px] font-black text-gray-500 leading-none uppercase tracking-widest">No Exam Set</p>
                      <p className="text-[9px] font-bold text-gray-600 mt-1 uppercase">시험 일정 없음</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <button 
        onClick={handleLogout} 
        className="flex items-center gap-2 px-4 py-2.5 rounded-[4px] bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all font-black uppercase tracking-widest text-[10px] border border-transparent hover:border-red-500/20"
      >
        <LogOut size={16} /> Log Out
      </button>
    </header>
  );
}
