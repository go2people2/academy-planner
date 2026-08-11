'use client';

import { User, Calendar as CalendarIcon, FileText, LogOut, Globe, ExternalLink, RefreshCw } from 'lucide-react';

interface StudentHeaderProps {
  student: any;
  teachers: any[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  validClassDates?: { date: string; label: string }[];
  onInvalidDateSelect?: (attemptedDate: string) => void;
  matchedExam: any;
  getRemainingClasses: (targetDate: string) => number | null;
  handleLogout: () => void;
  getInitial: (name: string) => string;
  academy?: any;
  selectedCourse?: string;
  setSelectedCourse?: (course: string) => void;
}

export default function StudentHeader({
  student,
  teachers,
  selectedDate,
  setSelectedDate,
  validClassDates = [],
  onInvalidDateSelect,
  matchedExam,
  getRemainingClasses,
  handleLogout,
  getInitial,
  academy,
  selectedCourse = '정규',
  setSelectedCourse,
}: StudentHeaderProps) {
  const formatExternalLink = (url: string) => {
    if (!url) return '';
    let formatted = url.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    return formatted;
  };

  const availableCourses = (() => {
    const list: string[] = ['정규'];
    const rawElective = student?.book_courses?.['__elective_courses'] || student?.book_courses?.["'__elective_courses'"];
    if (rawElective) {
      try {
        const parsed = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
        if (Array.isArray(parsed)) {
          parsed.forEach((c: any) => {
            const subj = c.subject?.trim() || '특강';
            if (!list.includes(subj)) list.push(subj);
          });
        }
      } catch (e) {}
    }
    return list;
  })();

  const handleCycleCourse = () => {
    if (availableCourses.length <= 1 || !setSelectedCourse) return;
    const currentIndex = availableCourses.indexOf(selectedCourse || '정규');
    const nextIndex = (currentIndex + 1) % availableCourses.length;
    const nextCourse = availableCourses[nextIndex];
    setSelectedCourse(nextCourse);
  };

  return (
    <header className="px-4 md:px-8 h-[60px] flex items-center justify-between bg-[#0a0a0a] border-b border-white/5 shrink-0 z-20 shadow-xl">
      <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
        {(() => {
          const teacher = teachers.find(t => t.id === student.teacher_id);
          const initial = teacher ? (teacher.initials || getInitial(teacher.name)) : '?';
          const days = student.class_days 
            ? [...student.class_days].sort((a, b) => {
                const order = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
              }).join('')
            : '무';
          const rawClass = student.class_name || '일반반';
          const simplifiedClass = rawClass.split('-')[0].trim();

          // 학년 테마 결정
          const grade = student.grade || '';
          const isMiddle = grade.startsWith('중');
          const isElementary = grade.startsWith('초');
          const isHigh = grade.startsWith('고');

          const badgeBg = isElementary
            ? 'from-emerald-600 to-green-700 border-emerald-500/40 shadow-emerald-900/40'
            : isHigh
            ? 'from-amber-500 to-yellow-600 border-amber-400/40 shadow-amber-900/40'
            : 'from-blue-600 to-indigo-600 border-blue-500/40 shadow-blue-900/40'; // 중등 기본

          // 지점명 축약 (2글자까지)
          const branchShort = simplifiedClass.length > 3 ? simplifiedClass.slice(0, 2) : simplifiedClass;

          // 선택과목인 경우 해당 선택과목 표시이름 및 요일 추출
          let courseDays = days;
          let courseDisplayName = selectedCourse;
          if (selectedCourse && selectedCourse !== '정규') {
            const rawElective = student.book_courses?.['__elective_courses'];
            if (rawElective) {
              try {
                const parsed = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
                if (Array.isArray(parsed)) {
                  const targetCourse = parsed.find((c: any) => c.subject?.trim() === selectedCourse);
                  if (targetCourse) {
                    if (targetCourse.className?.trim()) {
                      courseDisplayName = targetCourse.className.trim();
                    } else if (targetCourse.subject?.trim()) {
                      courseDisplayName = targetCourse.subject.trim();
                    }
                    if (Array.isArray(targetCourse.days)) {
                      courseDays = [...targetCourse.days].sort((a, b) => {
                        const order = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                        return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
                      }).join('');
                    }
                  }
                }
              } catch (e) {}
            }
          }

          const headerTitle = selectedCourse && selectedCourse !== '정규'
            ? `${courseDisplayName}-${student.name}-${initial}-${courseDays}`
            : `${student.name}-${initial}-${days}`;

          return (
            <>
              <div className={`w-8 h-8 md:w-9 md:h-9 bg-gradient-to-br ${badgeBg} rounded-[4px] flex items-center justify-center shadow-lg shrink-0`}>
                <span className="text-[14px] md:text-[15px] font-black text-white leading-none">{grade}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0 truncate">
                <p className="text-lg md:text-xl font-black text-white truncate tracking-tight leading-none min-w-0">
                  {headerTitle}
                </p>
              </div>
            </>
          );
        })()}

        {/* 데스크톱 전용: 날짜 선택기 + 시험 디데이 */}
        <div className="hidden lg:flex items-center gap-3 shrink-0 ml-auto">
          <div 
            onClick={(e) => {
              const input = e.currentTarget.querySelector('input');
              if (input && 'showPicker' in input) {
                try { (input as any).showPicker(); } catch (err) { console.error(err); }
              }
            }}
            className="flex items-center gap-3 bg-blue-600/10 border border-blue-500/30 px-4 h-[42px] rounded-[2px] shadow-lg shrink-0 cursor-pointer hover:bg-blue-600/20 transition-all group relative"
          >
            <CalendarIcon className="text-blue-500 group-hover:scale-110 transition-transform" size={18} />
            <div className="text-right">
              <p className="text-[14px] font-black text-white leading-none tracking-tight">
                {new Date(selectedDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                <span className="text-amber-400 ml-1.5">
                  ({new Date(selectedDate).toLocaleDateString('ko-KR', { weekday: 'short' })})
                </span>
              </p>
            </div>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => {
                const newDate = e.target.value;
                if (!newDate) return;
                if (validClassDates.length > 0 && !validClassDates.some(d => d.date === newDate)) {
                  if (onInvalidDateSelect) onInvalidDateSelect(newDate);
                } else {
                  setSelectedDate(newDate);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark] z-10"
            />
          </div>

          <div className={`flex items-center gap-3 border px-4 h-[42px] rounded-[2px] shadow-lg transition-all shrink-0 ${matchedExam ? 'bg-rose-600/10 border-rose-500/30' : 'bg-white/5 border-white/20'}`}>
            <FileText className={matchedExam ? 'text-rose-500' : 'text-gray-500'} size={18} />
            <div className="flex items-center justify-end h-full">
              {matchedExam ? (
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-black text-white tracking-tight whitespace-nowrap">
                    {new Date(matchedExam.target_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </span>
                  <div className="w-[1px] h-3 bg-white/10" />
                  <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest whitespace-nowrap">
                    잔여 <span className="text-[14px] ml-0.5">{getRemainingClasses(matchedExam.target_date)}</span>회
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">No Exam</span>
                  <div className="w-[1px] h-2 bg-white/5" />
                  <span className="text-[10px] font-bold text-gray-600 uppercase">일정 없음</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 md:gap-3 ml-2">
        {/* 지점명 */}
        <span className="text-[11px] font-bold text-blue-300 whitespace-nowrap lg:hidden">{student.class_name ? student.class_name.split('-')[0].trim() : '일반반'}</span>
        {/* 모바일 미니 날짜 선택기 (lg 미만에서만 노출) */}
        <div 
          onClick={(e) => {
            const input = e.currentTarget.querySelector('input');
            if (input && 'showPicker' in input) {
              try { (input as any).showPicker(); } catch (err) { console.error(err); }
            }
          }}
          className="flex lg:hidden items-center gap-2 bg-blue-600/10 border border-blue-500/30 px-3 h-[34px] rounded-[3px] cursor-pointer relative shrink-0"
        >
          <CalendarIcon className="text-blue-500 shrink-0" size={14} />
          <span className="text-[11px] font-black text-white whitespace-nowrap">
            {new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            <span className="text-amber-400 ml-1">
              ({new Date(selectedDate).toLocaleDateString('ko-KR', { weekday: 'short' })})
            </span>
          </span>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => {
              const newDate = e.target.value;
              if (!newDate) return;
              if (validClassDates.length > 0 && !validClassDates.some(d => d.date === newDate)) {
                if (onInvalidDateSelect) onInvalidDateSelect(newDate);
              } else {
                setSelectedDate(newDate);
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark] z-10"
          />
        </div>

        {/* 학원 홈페이지 바로가기 */}
        {academy?.operation_settings?.homepage_url && (
          <a 
            href={formatExternalLink(academy.operation_settings.homepage_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-[4px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-white transition-all font-black uppercase tracking-widest text-[10px] border border-blue-500/20 shrink-0"
          >
            <Globe size={14} />
            <span className="hidden sm:inline">{academy.operation_settings.homepage_title || "홈페이지"}</span>
          </a>
        )}

        {/* 네이버 카페 바로가기 */}
        {academy?.operation_settings?.naver_cafe_url && (
          <a 
            href={formatExternalLink(academy.operation_settings.naver_cafe_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-[4px] bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 hover:text-white transition-all font-black uppercase tracking-widest text-[10px] border border-emerald-500/20 shrink-0"
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">{academy.operation_settings.naver_cafe_title || "네이버 카페"}</span>
          </a>
        )}

        <button 
          onClick={handleLogout} 
          className="flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-2.5 rounded-[4px] bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all font-black uppercase tracking-widest text-[10px] border border-rose-500/20 shrink-0"
        >
          <LogOut size={16} /> <span className="hidden lg:inline">Log Out</span>
        </button>
      </div>
    </header>
  );
}
