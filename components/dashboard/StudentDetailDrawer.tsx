import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, RefreshCw, Trash2, User, Calendar, Search, Check, AlertTriangle, UserMinus, UserCheck, ClipboardCheck, TrendingUp, Printer } from 'lucide-react';
import HokmaJournalPrintModal from './todaySheet/HokmaJournalPrintModal';
import { Student, TextbookOption } from '@/types/dashboard';
import { parseBookCourseValue, buildBookCourseValue } from '@/lib/utils';
import { useModalEsc } from '@/hooks/useModalEsc';

interface StudentDetailDrawerProps {

  student: Student;
  availableTextbooks: TextbookOption[];
  teachers: any[];
  isRefreshingBooks: boolean;
  onRefreshBooks: () => void;
  onUpdateInfo: (studentId: string, fieldOrUpdates: string | any, value?: any) => void;
  onAddToToday: (studentId: string) => void;
  onClose: () => void;
  academyInfo?: any; // 💡 학원 정보
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

import { useStudentDetailDrawer } from './hooks/useStudentDetailDrawer';

export default function StudentDetailDrawer({
  student, availableTextbooks, teachers, isRefreshingBooks, onRefreshBooks, onUpdateInfo, onAddToToday, onClose, academyInfo
}: StudentDetailDrawerProps) {
  const {
    localSchedules,
    setLocalSchedules,
    startTimes,
    setStartTimes,
    endTimes,
    setEndTimes,
    localDays,
    setLocalDays,
    isHokmaPrintOpen,
    setIsHokmaPrintOpen,
    localName,
    setLocalName,
    localSchool,
    setLocalSchool,
    localGrade,
    setLocalGrade,
    localCourse,
    setLocalCourse,
    localBookCourses,
    setLocalBookCourses,
    localClass,
    setLocalClass,
    localStudentPhone,
    setLocalStudentPhone,
    localCreatedAt,
    setLocalCreatedAt,
    localParentPhone,
    setLocalParentPhone,
    localLoginSuffix,
    setLocalLoginSuffix,
    localTeacherId,
    setLocalTeacherId,
    bookSearch,
    setBookSearch,
    isDropdownOpen,
    setIsDropdownOpen,
    dropdownRef,
    showDeleteConfirm,
    setShowDeleteConfirm,
    electiveCourses,
    setElectiveCourses,
    doneModalOpen,
    setDoneModalOpen,
    doneBookCode,
    setDoneBookCode,
    doneBookTitle,
    setDoneBookTitle,
    doneStartGrade,
    setDoneStartGrade,
    doneStartMonth,
    setDoneStartMonth,
    doneEndGrade,
    setDoneEndGrade,
    doneEndMonth,
    setDoneEndMonth,
    doneCourse,
    setDoneCourse,
    hasStartInfo,
    setHasStartInfo,
    handleSavePhone,
    handleSaveLoginSuffix,
    filteredBooks,
    handleTimeChange,
    handleDayToggle,
  } = useStudentDetailDrawer({
    student,
    availableTextbooks,
    onUpdateInfo,
    onClose,
  });

  // 💡 [Esc 닫기 공통 적용 - 드로어 자체 및 내부 서브 모달]
  useModalEsc({
    isOpen: true,
    onClose
  });

  useModalEsc({
    isOpen: showDeleteConfirm,
    onClose: () => setShowDeleteConfirm(false)
  });

  useModalEsc({
    isOpen: doneModalOpen,
    onClose: () => setDoneModalOpen(false)
  });

  const handleApplyTimeToAllDays = () => {
    const selectedDays = DAYS.filter(day => localDays.includes(day));
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
    const newSchedules = { ...localSchedules };

    selectedDays.forEach(day => {
      newStarts[day] = baseStart;
      newEnds[day] = baseEnd;

      const startVal = baseStart ? parseInt(baseStart.replace(':', '')) : 1600;
      const endVal = baseEnd ? parseInt(baseEnd.replace(':', '')) : 1900;
      newSchedules[day] = [startVal, endVal];
    });

    setStartTimes(newStarts);
    setEndTimes(newEnds);
    setLocalSchedules(newSchedules);
    onUpdateInfo(student.id, {
      day_schedules: newSchedules,
      class_days: selectedDays
    });
  };

  // 💡 선택과목 저장 헬퍼
  const saveElectiveCourses = (courses: any[]) => {
    setElectiveCourses(courses);
    const newBookCourses = {
      ...localBookCourses,
      '__elective_courses': JSON.stringify(courses)
    };
    setLocalBookCourses(newBookCourses);
    onUpdateInfo(student.id, 'book_courses', newBookCourses);
  };

  // 💡 선택과목 추가
  const handleAddElective = () => {
    const newCourse = {
      id: Math.random().toString(36).substr(2, 9),
      subject: '',
      days: [] as string[],
      schedules: {} as Record<string, number[]>,
      className: '',
      startDate: '',
      endDate: ''
    };
    saveElectiveCourses([...electiveCourses, newCourse]);
  };

  // 💡 선택과목 삭제
  const handleRemoveElective = (id: string) => {
    if (!confirm('해당 선택과목 설정을 삭제하시겠습니까?')) return;
    saveElectiveCourses(electiveCourses.filter(c => c.id !== id));
  };

  // 💡 선택과목 필드 변경 (타이핑 시에는 로컬 상태만 즉시 업데이트하여 한글 조합 보호)
  const handleElectiveFieldChangeLocal = (id: string, field: string, val: any) => {
    const updated = electiveCourses.map(c => {
      if (c.id === id) {
        return { ...c, [field]: val };
      }
      return c;
    });
    setElectiveCourses(updated);

    const newBookCourses = {
      ...localBookCourses,
      '__elective_courses': JSON.stringify(updated)
    };
    setLocalBookCourses(newBookCourses);
  };

  // 💡 선택과목 텍스트 입력 완료 후 최종 DB 저장 (onBlur 시 실행)
  const handleElectiveFieldBlur = () => {
    const newBookCourses = {
      ...localBookCourses,
      '__elective_courses': JSON.stringify(electiveCourses)
    };
    onUpdateInfo(student.id, 'book_courses', newBookCourses);
  };

  // 💡 선택과목 요일 토글
  const handleElectiveDayToggle = (id: string, day: string) => {
    const updated = electiveCourses.map(c => {
      if (c.id === id) {
        const days = c.days || [];
        const isSelected = days.includes(day);
        const newDays = isSelected ? days.filter((d: string) => d !== day) : [...days, day];
        const newScheds = { ...(c.schedules || {}) };
        if (isSelected) {
          delete newScheds[day];
        } else {
          newScheds[day] = [1900, 2200]; // 7시 ~ 10시 기본값
        }
        return { ...c, days: newDays, schedules: newScheds };
      }
      return c;
    });
    saveElectiveCourses(updated);
  };

  // 💡 선택과목 요일별 시간대 변경
  const handleElectiveTimeChange = (id: string, day: string, startStr: string, endStr: string) => {
    const updated = electiveCourses.map(c => {
      if (c.id === id) {
        const newScheds = { ...(c.schedules || {}) };
        const startVal = startStr ? parseInt(startStr.replace(':', '')) : 1900;
        const endVal = endStr ? parseInt(endStr.replace(':', '')) : 2200;
        newScheds[day] = [startVal, endVal];
        return { ...c, schedules: newScheds };
      }
      return c;
    });
    saveElectiveCourses(updated);
  };

  const toggleBookSelection = (bookcode: string) => {
    const isSelected = student.assigned_books.includes(bookcode);
    if (isSelected) {
      const book = availableTextbooks.find(b => b.bookcode === bookcode);
      if (!confirm(`[${book?.title || bookcode}] 교재 배정을 취소하시겠습니까?`)) return;

      const newBooks = student.assigned_books.filter(b => b !== bookcode);
      onUpdateInfo(student.id, 'assigned_books', newBooks);

      const newCourses = { ...localBookCourses };
      delete newCourses[bookcode];
      setLocalBookCourses(newCourses);
      onUpdateInfo(student.id, 'book_courses', newCourses);
    } else {
      const newBooks = [...student.assigned_books, bookcode];
      onUpdateInfo(student.id, 'assigned_books', newBooks);

      const currentMonth = new Date().getMonth() + 1;
      const startInfo = `${localCourse}-start-${localGrade || student.grade || '미지정'}_${currentMonth}월`;
      const newCourses = { ...localBookCourses, [bookcode]: startInfo };
      setLocalBookCourses(newCourses);
      onUpdateInfo(student.id, 'book_courses', newCourses);
    }
  };

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="fixed inset-y-0 right-0 w-[450px] bg-[#0a0a0a]/95 backdrop-blur-3xl border-l border-white/10 shadow-2xl z-50 overflow-y-auto p-8 flex flex-col custom-scrollbar-v">

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-sm font-black text-gray-300 uppercase tracking-[0.2em]">Student Profile</h3>
          {student.is_deleted && <span className="bg-red-500/10 text-red-500 text-[9px] font-black px-2 py-0.5 rounded-[2px] border border-red-500/20">퇴원생</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHokmaPrintOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600 hover:text-white rounded-[4px] text-[10px] font-black uppercase tracking-widest transition-all"
            title="이 학생의 월간 호크마 일지 인쇄"
          >
            <Printer size={12} /> 일지인쇄
          </button>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"><X size={18} /></button>
        </div>
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
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-3 text-xs font-bold text-gray-100 text-center outline-none focus:border-blue-500 transition-all" />
            </div>
            <div className="col-span-12">
              <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-[2px] px-3 py-2">
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest shrink-0">Manager:</span>
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
              <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest px-1">Book Courses (Overridable)</label>
              <div className="flex flex-wrap gap-1.5">
                {student.assigned_books.filter(code => {
                  const rawCourseValue = localBookCourses[code] || localCourse;
                  return !!code && !String(rawCourseValue).includes('-done'); // 💡 완료된 교재는 위쪽 목록에서 제외
                }).map((code, idx) => {
                  const book = availableTextbooks.find(b => b.bookcode === code);
                  const rawCourseValue = localBookCourses[code] || localCourse;
                  const parsedCourse = parseBookCourseValue(rawCourseValue);
                  const isKeep = parsedCourse.isKeep;
                  const currentCourse = parsedCourse.baseCourse;

                  const electiveList = (electiveCourses || []).map((c: any) => {
                    const name = (c?.course_name || c?.subject || c?.name || '').trim();
                    return name ? `선택:${name}` : null;
                  }).filter(Boolean) as string[];

                  const hasElectives = electiveList.length > 0;
                  const targetOptions = hasElectives
                    ? Array.from(new Set(['정규', '공통', ...electiveList]))
                    : ['정규'];



                  return (
                    <div key={`${code}-${idx}`} className={`flex items-center gap-1.5 px-2 py-1 rounded-[2px] group border ${isKeep ? 'bg-yellow-400/10 border-yellow-400/20' : book ? 'bg-white/[0.03] border-white/5' : 'bg-red-500/10 border-red-500/20'}`}>
                      <span className={`text-[9px] font-black px-1.5 ${isKeep ? 'text-yellow-400' : book ? 'text-gray-100' : 'text-red-400'}`}>
                        {book ? book.title : `(${code})`}
                        {isKeep && <span className="ml-1 text-[7px] font-black bg-yellow-400 text-black px-1 rounded-sm uppercase tracking-tighter">KEEP</span>}
                      </span>
                      <select
                        value={currentCourse}
                        onChange={(e) => {
                          const courseCode = e.target.value;
                          const newVal = buildBookCourseValue({
                            ...parsedCourse,
                            baseCourse: courseCode
                          });
                          const newCourses = { ...localBookCourses, [code]: newVal };
                          setLocalBookCourses(newCourses);
                          onUpdateInfo(student.id, 'book_courses', newCourses);
                        }}
                        className={`bg-blue-600/20 text-blue-500 text-[10px] font-black rounded-[2px] px-1 py-0.5 outline-none appearance-none cursor-pointer hover:bg-blue-600 hover:text-white transition-all ${isKeep ? 'opacity-50' : ''}`}
                        title="교재 레벨 설정"
                      >
                        {['E','D','C','B','A'].map(c => <option key={c} value={c} className="bg-[#121212]">{c}</option>)}
                      </select>

                      <select
                        value={parsedCourse.targetTag}
                        onChange={(e) => {
                          const newTarget = e.target.value;
                          const newVal = buildBookCourseValue({
                            ...parsedCourse,
                            targetTag: newTarget
                          });
                          const newCourses = { ...localBookCourses, [code]: newVal };
                          setLocalBookCourses(newCourses);
                          onUpdateInfo(student.id, 'book_courses', newCourses);
                        }}
                        className={`bg-emerald-600/20 text-emerald-400 text-[10px] font-black rounded-[2px] px-1 py-0.5 outline-none cursor-pointer hover:bg-emerald-600 hover:text-white transition-all ${isKeep ? 'opacity-50' : ''}`}
                        title="수업 구분 설정 (정규 / 선택:과목 / 공통)"
                      >
                        {targetOptions.map(opt => (
                          <option key={opt} value={opt} className="bg-[#121212] text-white">
                            {opt}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => {
                          const newVal = buildBookCourseValue({
                            ...parsedCourse,
                            isKeep: !isKeep
                          });
                          const newCourses = { ...localBookCourses, [code]: newVal };
                          setLocalBookCourses(newCourses);
                          onUpdateInfo(student.id, 'book_courses', newCourses);
                        }}
                        className={`text-[8px] font-black px-1.5 py-0.5 rounded-[2px] transition-all ${isKeep ? 'bg-yellow-400 text-black font-extrabold shadow-sm' : 'bg-white/5 text-gray-500 hover:bg-yellow-400/20 hover:text-yellow-400 border border-transparent'}`}
                        title="보류 상태로 변경 (오늘 과제에서 숨김)"
                      >
                        KEEP
                      </button>

                      <button
                        onClick={() => {
                          const book = availableTextbooks.find(b => b.bookcode === code);
                          setDoneBookCode(code);
                          setDoneBookTitle(book ? book.title : code);

                          let parsedGrade = localGrade || student.grade || '';
                          let parsedStartMonth = `${new Date().getMonth() + 1}월`;
                          let hasStart = false;

                          setDoneCourse(currentCourse);

                          if (rawCourseValue.includes('-start-')) {
                            const part = rawCourseValue.split('-start-')[1]; // "중2_2월"
                            if (part.includes('_')) {
                              const [g, m] = part.split('_');
                              parsedGrade = g;
                              parsedStartMonth = m;
                              hasStart = true;
                            }
                          }

                          setDoneStartGrade(parsedGrade);
                          setDoneStartMonth(parsedStartMonth);
                          setHasStartInfo(hasStart);
                          setDoneEndGrade(localGrade || student.grade || '');
                          setDoneEndMonth(`${new Date().getMonth() + 1}월`);
                          setDoneModalOpen(true);
                        }}
                        className="text-[8px] font-black px-1.5 py-0.5 rounded-[2px] transition-all bg-white/5 text-gray-500 hover:bg-emerald-500/20 hover:text-emerald-500 border border-transparent"
                        title="교재 완료 처리 (Book History로 이동)"
                      >
                        완료
                      </button>

                      <button onClick={() => toggleBookSelection(code)} className="text-gray-600 hover:text-red-500 transition-colors ml-1" title="완전 삭제"><X size={10} strokeWidth={3} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}



          <div className="grid grid-cols-2 gap-2">
            {/* 💡 최초 학원 등록일 (백데이팅 소급 수정 기능) */}
            <div className="relative group col-span-2">
              <label className="block text-[10px] font-black text-[#565551] uppercase tracking-widest mb-1.5 px-1">최초 학원 등록일</label>
              <input
                type="date"
                value={localCreatedAt}
                onChange={(e) => {
                  const newDateVal = e.target.value;
                  setLocalCreatedAt(newDateVal);
                  if (newDateVal) {
                    // 기입한 소급 날짜(YYYY-MM-DD)를 타임스탬프로 환산하여 즉시 저장!
                    const isoString = new Date(`${newDateVal}T00:00:00`).toISOString();
                    onUpdateInfo(student.id, 'created_at', isoString);
                  }
                }}
                className="w-full bg-black/20 border border-white/5 rounded-[2px] px-4 py-2.5 text-xs text-gray-100 placeholder:text-gray-500 outline-none focus:border-blue-500/50 transition-all font-bold"
              />
            </div>

            <div className="relative group col-span-2">
              <label className="block text-[10px] font-black text-[#565551] uppercase tracking-widest mb-1.5 px-1">학교 정보</label>
              <input type="text" value={localSchool} placeholder="학교 이름" onChange={(e) => setLocalSchool(e.target.value)} onBlur={() => onUpdateInfo(student.id, 'school', localSchool)}
                className="w-full bg-black/20 border border-white/5 rounded-[2px] px-4 py-2.5 text-xs text-gray-100 placeholder:text-gray-500 outline-none focus:border-blue-500/50 transition-all font-bold" />
            </div>
            <div className="relative group col-span-1">
              <input type="tel" value={localStudentPhone} placeholder="학생 연락처"
                onChange={(e) => setLocalStudentPhone(e.target.value)}
                onBlur={() => {
                  let cleaned = localStudentPhone.replace(/[^0-9]/g, '');
                  if (cleaned.length === 11) {
                    cleaned = cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
                  } else if (cleaned.length === 10) {
                    cleaned = cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
                  }
                  setLocalStudentPhone(cleaned);
                  handleSavePhone(cleaned, localParentPhone);
                }}
                className="w-full bg-black/20 border border-white/5 rounded-[2px] px-4 py-2.5 text-xs text-gray-100 placeholder:text-gray-500 outline-none focus:border-blue-500/50 transition-all font-bold" />
            </div>
            <div className="relative group col-span-1">
              <input type="tel" value={localParentPhone} placeholder="부모님 연락처 (카톡용)"
                onChange={(e) => setLocalParentPhone(e.target.value)}
                onBlur={() => {
                  let cleaned = localParentPhone.replace(/[^0-9]/g, '');
                  if (cleaned.length === 11) {
                    cleaned = cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
                  } else if (cleaned.length === 10) {
                    cleaned = cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
                  }
                  setLocalParentPhone(cleaned);
                  handleSavePhone(localStudentPhone, cleaned);
                }}
                className="w-full bg-black/20 border border-white/5 rounded-[2px] px-4 py-2.5 text-xs text-gray-100 placeholder:text-gray-500 outline-none focus:border-blue-500/50 transition-all font-bold" />
            </div>
            <div className="relative group col-span-2 flex items-center gap-2 bg-amber-500/5 border border-amber-500/10 rounded-[2px] p-2 mt-1">
              <span className="text-[10px] text-amber-500 font-black tracking-tight shrink-0 uppercase">Login Extra Digit <span className="text-[8px] text-amber-600/50 lowercase">(중복자용)</span> :</span>
              <input type="text" maxLength={1} value={localLoginSuffix} placeholder="없음 (보통 비워둡니다)"
                onChange={(e) => setLocalLoginSuffix(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => handleSaveLoginSuffix(localLoginSuffix)}
                className="flex-1 bg-transparent border-none text-xs text-amber-400 font-bold outline-none placeholder-amber-500/20 py-1" />
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
          <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center justify-between px-1 w-full">
            <span className="flex items-center gap-2">
              <Calendar size={14} /> Weekly Schedule
            </span>
            {localDays.length > 1 && (
              <button
                type="button"
                onClick={handleApplyTimeToAllDays}
                className="text-[9px] font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded px-2 py-0.5 transition-all cursor-pointer normal-case"
                title="첫 요일의 시간을 다른 모든 요일에 동일하게 적용합니다."
              >
                ⚡ 동일적용
              </button>
            )}
          </h5>
          <div className="bg-white/5 border border-white/5 rounded-[4px] p-4 shadow-inner">
            {/* 요일 선택 가로 바 */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {DAYS.map(day => {
                const isDaySelected = localDays.includes(day);
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
                const selectedDays = DAYS.filter(day => localDays.includes(day));
                if (selectedDays.length === 0) {
                  return (
                    <div className="text-[10px] text-gray-500 text-center py-4 italic w-full">수업 요일을 위에서 선택해 주세요.</div>
                  );
                }

                // 4자리 정수(HHMM) -> "HH:MM" 텍스트 추출 헬퍼 (오후 시간 자동 보정 포함)
                const formatTimeVal = (val: number) => {
                  if (!val || val === 999) return '';
                  if (val < 100) {
                    const hour = val < 12 ? val + 12 : val;
                    return `${hour.toString().padStart(2, '0')}:00`;
                  }
                  let h = Math.floor(val / 100);
                  if (h < 12) h += 12; // 12시 미만의 값은 학원 특성상 오후(PM)로 보정
                  const m = (val % 100).toString().padStart(2, '0');
                  return `${h.toString().padStart(2, '0')}:${m}`;
                };

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
        </section>

        {/* 2-2. 선택과목 스케줄 설정 (자유 입력 방식) */}
        <section className="space-y-4">
          <h5 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-between px-1 w-full">
            <span className="flex items-center gap-2">
              <Calendar size={14} /> Elective Courses (선택과목 시간표)
            </span>
            <button
              type="button"
              onClick={handleAddElective}
              className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded px-2.5 py-1 transition-all cursor-pointer normal-case flex items-center gap-1"
            >
              + 추가
            </button>
          </h5>

          {electiveCourses.length === 0 ? (
            <div className="bg-white/5 border border-white/5 rounded-[4px] p-4 text-[10px] text-gray-500 text-center italic shadow-inner">
              추가된 선택과목이 없습니다. 우측 상단의 '+ 추가' 버튼을 눌러주세요.
            </div>
          ) : (
            <div className="space-y-3">
              {electiveCourses.map((c, cIdx) => {
                const parseTimeStr = (val: number) => {
                  if (!val || val === 999) return '';
                  let h = Math.floor(val / 100);
                  if (h < 12) h += 12;
                  const m = (val % 100).toString().padStart(2, '0');
                  return `${h.toString().padStart(2, '0')}:${m}`;
                };

                return (
                  <div key={c.id || cIdx} className="bg-white/5 border border-white/5 rounded-[4px] p-4 space-y-3 shadow-inner relative group/card">
                    {/* 상단 헤더 & 과목 삭제 */}
                    <button
                      type="button"
                      onClick={() => handleRemoveElective(c.id)}
                      className="absolute top-3 right-3 text-gray-500 hover:text-red-500 opacity-0 group-hover/card:opacity-100 transition-opacity"
                      title="선택과목 삭제"
                    >
                      <Trash2 size={13} />
                    </button>

                    {/* 과목명 & 반명 입력 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] font-black text-gray-500 uppercase block mb-1">선택과목 명칭</label>
                        <input
                          type="text"
                          value={c.subject || ''}
                          placeholder="예: 확통, 기하, 미적분2"
                          onChange={(e) => handleElectiveFieldChangeLocal(c.id, 'subject', e.target.value)}
                          onBlur={handleElectiveFieldBlur}
                          className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500 transition-all font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-gray-500 uppercase block mb-1">아카 반명 (선택)</label>
                        <input
                          type="text"
                          value={c.className || ''}
                          placeholder="비워두면 자동 매핑"
                          onChange={(e) => handleElectiveFieldChangeLocal(c.id, 'className', e.target.value)}
                          onBlur={handleElectiveFieldBlur}
                          className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500 transition-all font-bold"
                        />
                      </div>
                    </div>

                    {/* 💡 [추가] 특강 수강 기간 지정 (시작일 ~ 종료일) */}
                    <div className="grid grid-cols-2 gap-2 bg-black/20 p-2 rounded border border-white/5">
                      <div>
                        <label className="text-[8px] font-black text-emerald-400 uppercase block mb-1">특강 시작일 (선택)</label>
                        <input
                          type="date"
                          value={c.startDate || ''}
                          onChange={(e) => handleElectiveFieldChangeLocal(c.id, 'startDate', e.target.value)}
                          onBlur={handleElectiveFieldBlur}
                          className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-1 text-[11px] text-white outline-none focus:border-emerald-500 transition-all font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-emerald-400 uppercase block mb-1">특강 종료일 (선택)</label>
                        <input
                          type="date"
                          value={c.endDate || ''}
                          onChange={(e) => handleElectiveFieldChangeLocal(c.id, 'endDate', e.target.value)}
                          onBlur={handleElectiveFieldBlur}
                          className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-1 text-[11px] text-white outline-none focus:border-emerald-500 transition-all font-bold"
                        />
                      </div>
                    </div>

                    {/* 요일 선택 */}
                    <div>
                      <label className="text-[8px] font-black text-gray-500 uppercase block mb-1">수업 요일</label>
                      <div className="grid grid-cols-7 gap-1">
                        {DAYS.map(day => {
                          const isDaySelected = (c.days || []).includes(day);
                          return (
                            <button
                              key={`elective-day-${day}`}
                              type="button"
                              onClick={() => handleElectiveDayToggle(c.id, day)}
                              className={`text-[9px] font-black h-7 rounded-[2px] flex items-center justify-center transition-all ${
                                isDaySelected ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/5 text-gray-500 hover:bg-white/10'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 요일별 시간 입력 */}
                    {(c.days || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(c.days || []).map((day: string) => {
                          const sched = c.schedules?.[day] || [1900, 2200];
                          const startTime = parseTimeStr(sched[0]);
                          const endTime = parseTimeStr(sched[1]);

                          return (
                            <div key={`elective-time-${day}`} className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-2 py-1 rounded-[4px] shrink-0">
                              <span className="text-[9px] font-black text-emerald-400 bg-emerald-600/10 w-5 h-5 flex items-center justify-center rounded-[2px] shrink-0">
                                {day}
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={startTime}
                                  onChange={(e) => handleElectiveTimeChange(c.id, day, e.target.value, endTime)}
                                  onClick={(e) => {
                                    try { e.currentTarget.showPicker(); } catch (err) {}
                                  }}
                                  className="bg-black/40 border border-white/10 rounded-[2px] px-1 py-0.5 text-[9px] text-gray-300 outline-none focus:border-emerald-500 transition-all font-bold w-[100px] cursor-pointer"
                                />
                                <span className="text-[9px] text-gray-600">~</span>
                                <input
                                  type="time"
                                  value={endTime}
                                  onChange={(e) => handleElectiveTimeChange(c.id, day, startTime, e.target.value)}
                                  onClick={(e) => {
                                    try { e.currentTarget.showPicker(); } catch (err) {}
                                  }}
                                  className="bg-black/40 border border-white/10 rounded-[2px] px-1 py-0.5 text-[9px] text-gray-300 outline-none focus:border-emerald-500 transition-all font-bold w-[100px] cursor-pointer"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. 교재 다중 선택 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><BookOpen size={14} /> Assigned Textbooks</h5>
            <button onClick={onRefreshBooks} className="text-gray-500 hover:text-white transition-all"><RefreshCw size={12} className={isRefreshingBooks ? 'animate-spin' : ''} /></button>
          </div>

          <div ref={dropdownRef} className="relative">
            <div className="bg-white/5 border border-white/5 rounded-[4px] p-3 bg-black/20 flex items-center gap-2 cursor-text" onClick={() => setIsDropdownOpen(true)}>
              <Search size={14} className="text-gray-500" />
              <input
                type="text"
                placeholder="Search and add textbooks..."
                value={bookSearch}
                onChange={(e) => {
                  setBookSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="bg-transparent border-none text-[11px] text-white outline-none w-full placeholder:text-gray-600"
              />
            </div>

            {isDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-[#121212] border border-white/10 rounded-[4px] shadow-2xl max-h-[220px] overflow-y-auto p-2 z-[60] custom-scrollbar-v space-y-1">
                {filteredBooks.filter(b => !!b.bookcode).length === 0 ? (
                  <div className="text-[10px] text-gray-500 text-center py-4">검색 결과가 없습니다.</div>
                ) : (
                  filteredBooks.filter(b => !!b.bookcode).map((book) => {
                    const isSelected = (student.assigned_books || []).includes(book.bookcode);
                    return (
                      <div
                        key={book.bookcode}
                        onClick={() => toggleBookSelection(book.bookcode)}
                        className={`flex items-center justify-between p-2 rounded-[2px] cursor-pointer transition-all border ${isSelected ? 'bg-blue-600/15 border-blue-500/30' : 'hover:bg-white/5 border-transparent'}`}
                      >
                        <div>
                          <h4 className={`text-[10px] font-bold ${isSelected ? 'text-blue-400' : 'text-gray-300'}`}>{book.title}</h4>
                          <p className="text-[8px] text-gray-500">{book.grade} · {book.ePeriod}</p>
                        </div>
                        {isSelected && <div className="bg-blue-500 text-white p-0.5 rounded-full"><Check size={8} strokeWidth={4} /></div>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
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
                    const todayStr = new Date().toISOString().split('T')[0];
                    const dischargeTag = `[퇴원일: ${todayStr}] [퇴원 사유: ${reason || '사유 미기재'}]`;
                    const updatedNotes = student.management_notes
                      ? `${student.management_notes}\n${dischargeTag}`
                      : dischargeTag;
                    onUpdateInfo(student.id, {
                      is_deleted: true,
                      management_notes: updatedNotes
                    });
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

      {/* 💡 교재 완료 이력 입력 모달 */}
      <AnimatePresence>
        {doneModalOpen && doneBookCode && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-white/10 rounded-[6px] p-6 w-full max-w-sm shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <h4 className="text-[12px] font-black text-emerald-400 uppercase tracking-wider">교재 완료 처리</h4>
                <button onClick={() => setDoneModalOpen(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">교재명</label>
                <div className="text-[11px] font-bold text-gray-300">{doneBookTitle}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">시작 학년</label>
                  <input
                    type="text"
                    value={doneStartGrade}
                    onChange={(e) => setDoneStartGrade(e.target.value)}
                    placeholder="예: 중2"
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">시작 월</label>
                  <select
                    value={doneStartMonth}
                    onChange={(e) => setDoneStartMonth(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-2 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    {Array.from({ length: 12 }, (_, i) => `${i + 1}월`).map(m => (
                      <option key={m} value={m} className="bg-[#121212]">{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">완료 학년</label>
                  <input
                    type="text"
                    value={doneEndGrade}
                    onChange={(e) => setDoneEndGrade(e.target.value)}
                    placeholder="예: 중2"
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">완료 월</label>
                  <select
                    value={doneEndMonth}
                    onChange={(e) => setDoneEndMonth(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-2 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    {Array.from({ length: 12 }, (_, i) => `${i + 1}월`).map(m => (
                      <option key={m} value={m} className="bg-[#121212]">{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex gap-2 justify-end">
                <button
                  onClick={() => setDoneModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    const newVal = `${doneCourse}-done-${doneStartGrade}_${doneStartMonth}-${doneEndGrade}_${doneEndMonth}`;
                    const newCourses = { ...localBookCourses, [doneBookCode]: newVal };
                    setLocalBookCourses(newCourses);
                    onUpdateInfo(student.id, 'book_courses', newCourses);
                    setDoneModalOpen(false);
                  }}
                  className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  완료 저장
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <HokmaJournalPrintModal
        isOpen={isHokmaPrintOpen}
        onClose={() => setIsHokmaPrintOpen(false)}
        selectedStudents={[student]}
        masterTextbooks={availableTextbooks}
        academyInfo={academyInfo}
      />
    </motion.div>
  );
}
