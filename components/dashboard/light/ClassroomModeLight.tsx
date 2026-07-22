'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Check, Clock, AlertCircle, 
  User, UserCheck, UserPlus, Zap, Copy,
  ArrowLeft, LogOut, MoreHorizontal, CalendarClock, RotateCcw,
  Plus
} from 'lucide-react';
import { Student } from '@/types/dashboard';
import { getTodayStr, getDayOfWeek } from '@/lib/utils';
import { ATTENDANCE_STATUS } from '@/lib/sessionFieldMap';
import { useClassroomTimers } from '../useClassroomTimers';

interface ClassroomModeProps {
  students: Student[];
  onSave: (id: string, data: any) => Promise<boolean>;
  onClose: () => void;
  selectedDate: string;
  academyInfo?: any;
  selectedTeacherId?: string;
}

const TIMER_THEMES = [
  { text: 'text-indigo-650', bg: 'bg-indigo-50', border: 'border-indigo-200', ring: 'ring-indigo-500/20', glow: 'shadow-indigo-500/5' },
  { text: 'text-emerald-650', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-500/20', glow: 'shadow-emerald-500/5' },
  { text: 'text-rose-650', bg: 'bg-rose-50', border: 'border-rose-200', ring: 'ring-rose-500/20', glow: 'shadow-rose-500/5' },
  { text: 'text-cyan-655', bg: 'bg-cyan-50', border: 'border-cyan-200', ring: 'ring-cyan-500/20', glow: 'shadow-cyan-500/5' },
  { text: 'text-amber-650', bg: 'bg-amber-50', border: 'border-amber-200', ring: 'ring-amber-500/20', glow: 'shadow-amber-500/5' },
  { text: 'text-purple-650', bg: 'bg-purple-50', border: 'border-purple-200', ring: 'ring-purple-500/20', glow: 'shadow-purple-500/5' },
];

const getTimerTheme = (index: number) => TIMER_THEMES[index % TIMER_THEMES.length];

export default function ClassroomModeLight({ students, onSave, onClose, selectedDate, academyInfo, selectedTeacherId }: ClassroomModeProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'attendance' | 'timer'>('attendance');
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [isTimeShiftOpen, setIsTimeShiftOpen] = useState(false);
  const [collapsedHours, setCollapsedHours] = useState<Record<number, boolean>>({});

  const settings = useMemo(() => academyInfo?.operation_settings || {}, [academyInfo]);
  
  const timerPresets = useMemo(() => {
    const presets = settings.timer_presets || [];
    const p1 = parseInt(presets[0]) || 15;
    const p2 = parseInt(presets[1]) || 30;
    const p3 = parseInt(presets[2]) || 60;
    return [p1, p2, p3];
  }, [settings]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    activeTimers,
    studentTimerMap,
    selectedDuration,
    setSelectedDuration,
    customDurationInput,
    setCustomDurationInput,
    handleStartTimer,
    handleAssignToTimer,
    handleStopTimer,
  } = useClassroomTimers(students, onSave, timerPresets);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const baseTime = settings.first_period_time || "";
  const [baseH, baseM] = baseTime ? baseTime.split(':').map(Number) : [null, null];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getStudentHour = (student: Student) => {
    if (student.todaySession?.moved_to_hour !== undefined && student.todaySession?.moved_to_hour !== null) {
      return student.todaySession.moved_to_hour;
    }

    const status = student.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
    if (status.includes(':')) {
      const parts = status.split(':');
      const val = parseInt(parts[parts.length - 1]);
      if (!isNaN(val) && val < 24) return val;
    }

    const day = getDayOfWeek(selectedDate);
    const hours = student.day_schedules?.[day] || [];
    if (hours.length > 0) {
      const firstVal = hours[0];
      let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
      if (h <= 12) h += 12;
      return h;
    }
    return 999; 
  };

  const getElapsedMinutesForHour = (hour: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const targetHour = hour === 999 ? currentTime.getHours() : hour;
    targetDate.setHours(targetHour, baseM || 0, 0, 0);
    const diff = currentTime.getTime() - targetDate.getTime();
    return Math.floor(diff / (1000 * 60));
  };

  const handleFinishHour = async (hour: number) => {
    const studentsToMark = allTodayStudents.filter(s => {
      const sHour = getStudentHour(s);
      const status = s.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
      return sHour === hour && (status === ATTENDANCE_STATUS.BEFORE || status === ATTENDANCE_STATUS.SUPPLEMENT);
    });
    if (studentsToMark.length === 0) return;
    const confirmMsg = `${hour === 999 ? '보강/기타' : (hour >= 12 ? (hour === 12 ? '오후 12' : `오후 ${hour-12}`) : `오전 ${hour}`)}시 수업 미출석 학생 ${studentsToMark.length}명을 결석 처리하시겠습니까?`;
    if (confirm(confirmMsg)) {
      for (const s of studentsToMark) {
        await onSave(s.id, { attendance_status: ATTENDANCE_STATUS.ABSENT });
      }
      setCollapsedHours(prev => ({ ...prev, [hour]: true }));
    }
  };

  const handleResetHour = async (hour: number) => {
    const studentsToReset = allTodayStudents.filter(s => getStudentHour(s) === hour);
    if (studentsToReset.length === 0) return;
    const confirmMsg = `${hour === 999 ? '보강/기타' : (hour >= 12 ? (hour === 12 ? '오후 12' : `오후 ${hour-12}`) : `오전 ${hour}`)}시 수업 모든 학생(${studentsToReset.length}명)의 출결 상태를 초기화하시겠습니까?`;
    if (confirm(confirmMsg)) { for (const s of studentsToReset) { await onSave(s.id, { attendance_status: ATTENDANCE_STATUS.BEFORE }); } }
  };

  const allTodayStudents = useMemo(() => {
    return students.filter(s => {
      if (s.is_deleted) return false;
      const session = s.todaySession;
      if (session) {
        const sDate = session.date || session.session_date;
        if (sDate && sDate !== selectedDate) return false;
      }
      
      const status = session?.attendance_status || ATTENDANCE_STATUS.BEFORE;
      const day = getDayOfWeek(selectedDate);
      const hours = s.day_schedules?.[day] || [];
      const hasRegularSession = hours.length > 0;
      
      // 오늘 선택과목/방학특강 일정이 존재하는지 여부 확인 (안전한 타입 체크 적용)
      let hasElectiveSession = false;
      const rawElective = s.book_courses?.['__elective_courses'];
      if (rawElective) {
        try {
          const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
          if (Array.isArray(courses)) {
            hasElectiveSession = courses.some((c: any) => 
              c.days?.includes(day) && c.schedules?.[day] && Array.isArray(c.schedules[day]) && c.schedules[day].length > 0
            );
          }
        } catch (e) {}
      }
      
      const isMakeup = status.startsWith(ATTENDANCE_STATUS.SUPPLEMENT) || (session?.moved_to_hour !== undefined && session?.moved_to_hour !== null);
      const hasTodaySessionLog = !!session; // 오늘자 일지(세션)가 개설된 상태라면 오늘 출석 대상자이므로 합류시킵니다.
      
      if (status.startsWith(ATTENDANCE_STATUS.EXCLUDED)) return false;

      const isTarget = hasRegularSession || hasElectiveSession || isMakeup || hasTodaySessionLog;
      if (!isTarget) return false;

      if (selectedTeacherId && selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;
      const studentHour = getStudentHour(s);
      if (baseH !== null && studentHour !== 999 && studentHour < baseH && !isMakeup) return false;
      return true;
    }).sort((a, b) => {
      if (activeTab === 'timer') {
        const timerA = studentTimerMap[a.id] || 9999999999999;
        const timerB = studentTimerMap[b.id] || 9999999999999;
        if (timerA !== timerB) return timerA - timerB;
      }
      const timeA = getStudentHour(a);
      const timeB = getStudentHour(b);
      if (timeA !== timeB) return timeA - timeB;
      return a.name.localeCompare(b.name, 'ko');
    });
  }, [students, selectedTeacherId, studentTimerMap, activeTab, baseH, selectedDate]);

  const stats = useMemo(() => {
    return {
      total: allTodayStudents.length,
      attended: allTodayStudents.filter(s => s.todaySession?.attendance_status?.startsWith(ATTENDANCE_STATUS.PRESENT)).length,
      late: allTodayStudents.filter(s => s.todaySession?.attendance_status?.startsWith(ATTENDANCE_STATUS.LATE)).length,
      absent: allTodayStudents.filter(s => s.todaySession?.attendance_status?.startsWith(ATTENDANCE_STATUS.ABSENT)).length,
      pending: allTodayStudents.filter(s => {
        const stat = s.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
        const h = getStudentHour(s);
        const studentElapsed = getElapsedMinutesForHour(h);
        const isDetermined = [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.ABSENT].some(st => stat.startsWith(st));
        const hasMovedHour = s.todaySession?.moved_to_hour !== undefined && s.todaySession?.moved_to_hour !== null;
        const isSupplementWait = stat === ATTENDANCE_STATUS.SUPPLEMENT && !hasMovedHour;
        return !isDetermined && !isSupplementWait && studentElapsed >= (settings.alert_threshold || 15);
      }).length,
      upcoming: allTodayStudents.filter(s => {
        const stat = s.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
        const h = getStudentHour(s);
        const studentElapsed = getElapsedMinutesForHour(h);
        return studentElapsed < 0 && stat === ATTENDANCE_STATUS.BEFORE;
      }).length
    };
  }, [allTodayStudents, currentTime, settings.alert_threshold]);

  const handleCardClick = async (student: Student) => {
    const status = student.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
    
    const isPendingMakeup = status.startsWith(ATTENDANCE_STATUS.SUPPLEMENT);
    if (status === ATTENDANCE_STATUS.BEFORE || isPendingMakeup) {
      await onSave(student.id, { attendance_status: ATTENDANCE_STATUS.PRESENT });
      return;
    }
 
    if (activeStudentId === student.id) { 
      setActiveStudentId(null); 
      return; 
    }
    setActiveStudentId(student.id);
    setIsTimeShiftOpen(false);
  };
 
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
 
  const handleQuickAction = async (studentId: string, status: string | null) => {
    let finalStatus = status || ATTENDANCE_STATUS.BEFORE;
    
    if (finalStatus === ATTENDANCE_STATUS.BEFORE) {
      const sObj = students.find(s => s.id === studentId);
      const mHour = sObj?.todaySession?.moved_to_hour;

      if (mHour !== undefined && mHour !== null) {
        const day = getDayOfWeek(selectedDate);
        const regularHours = sObj?.day_schedules?.[day] || [];
        const isOriginalRegularHour = regularHours.some(val => {
          let h = val >= 100 ? Math.floor(val / 100) : val;
          if (h <= 12) h += 12;
          return h === mHour;
        });

        if (isOriginalRegularHour) {
          await onSave(studentId, { 
            attendance_status: ATTENDANCE_STATUS.BEFORE, 
            moved_to_hour: null,
            attendance_reason: null
          });
          setActiveStudentId(null);
          setIsTimeShiftOpen(false);
          return;
        } else {
          finalStatus = `${ATTENDANCE_STATUS.SUPPLEMENT}:${String(mHour).padStart(2, '0')}:00`;
        }
      }
    }
    
    await onSave(studentId, { attendance_status: finalStatus });
    setActiveStudentId(null);
    setIsTimeShiftOpen(false);
  };

  const handleTimeShift = async (studentId: string, hour: number) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const day = getDayOfWeek(selectedDate);
    const regularHours = student.day_schedules?.[day] || [];
    const isOriginalRegularHour = regularHours.some(val => {
      let h = val >= 100 ? Math.floor(val / 100) : val;
      if (h <= 12) h += 12;
      return h === hour;
    });

    if (isOriginalRegularHour) {
      const currentStatus = student.todaySession?.attendance_status || '';
      const finalStatus = (currentStatus === '보강' || currentStatus.startsWith('보강:')) 
        ? ATTENDANCE_STATUS.BEFORE 
        : currentStatus;
      await onSave(studentId, { 
        moved_to_hour: null, 
        attendance_status: finalStatus,
        attendance_reason: null
      });
    } else {
      await onSave(studentId, { moved_to_hour: hour });
    }
    setActiveStudentId(null);
    setIsTimeShiftOpen(false);
  };

  const copyToClipboard = () => {
    const currentHour = currentTime.getHours();
    const absents = allTodayStudents.filter(s => {
      const stat = s.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
      const h = getStudentHour(s);
      const isAttended = stat.startsWith(ATTENDANCE_STATUS.PRESENT) || stat.startsWith(ATTENDANCE_STATUS.LATE) || stat.startsWith(ATTENDANCE_STATUS.ABSENT);
      return (h === 999 || h <= currentHour) && !isAttended;
    });
    const msg = absents.length === 0 ? "현재 타임에 미등원 학생이 없습니다." : `${absents.map(s => s.name).join(', ')} 학생이 아직 등원 전입니다. 연락부탁드립니다.`;
    navigator.clipboard.writeText(msg);
    alert('데스크 전달 메시지가 복사되었습니다.');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-[#fbfbfa] flex flex-col p-6 overflow-hidden text-center">
      <div className="flex items-center justify-between mb-6 gap-6 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0c73e8] rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"><Zap className="text-white" size={24} /></div>
            <div className="hidden sm:block">
              <h2 className="text-xl font-black text-[#37352f] uppercase tracking-tight leading-none">LIVE</h2>
              <div className="flex items-center gap-1.5 mt-1 text-[#0c73e8] font-bold text-[10px]"><Clock size={10} /> {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
          <div className="flex bg-[#edece9]/50 p-1 rounded-xl border border-[#edece9]">
            <button onClick={() => setActiveTab('attendance')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'attendance' ? 'bg-[#edece9] text-[#37352f] shadow-sm' : 'text-[#37352f]/60 hover:text-[#37352f]'}`}><UserCheck size={14} /> <span>출석체크</span></button>
            <button onClick={() => setActiveTab('timer')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'timer' ? 'bg-[#5e5ce6] text-white shadow-sm' : 'text-[#37352f]/60 hover:text-[#37352f]'}`}><Clock size={14} /> <span>테스트 타이머</span></button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={copyToClipboard} className="flex items-center gap-2 px-6 py-3 bg-white border border-[#edece9] text-[#37352f] hover:bg-[#edece9]/50 transition-all font-black text-sm uppercase whitespace-nowrap"><Copy size={18} /> <span className="hidden md:inline">미등원 명단 복사</span></button>
          <button onClick={onClose} className="p-3 bg-white border border-[#edece9] text-[#37352f]/70 hover:bg-[#edece9]/50 transition-all"><X size={24} /></button>
        </div>
      </div>

      <AnimatePresence>
        {activeTab === 'timer' && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: -20, opacity: 0 }} 
            className="mb-8 flex flex-col items-center gap-4 shrink-0"
          >
            {/* ⏱️ 단일 타이머 컨트롤러 제어기 */}
            <div className="flex bg-white border border-[#edece9] rounded-2xl p-3 shadow-md items-center gap-4 max-w-full overflow-x-auto">
              <div className="flex items-center gap-2 pr-3 border-r border-[#edece9]">
                <Clock className="text-[#0c73e8]" size={18} />
                <span className="text-[10px] font-black text-[#37352f] uppercase tracking-wider">시간 설정</span>
              </div>
              
              {/* 프리셋 시간 선택 */}
              <div className="flex items-center gap-1 bg-[#edece9]/30 p-1 rounded-xl border border-[#edece9]">
                {timerPresets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setSelectedDuration(preset);
                      setCustomDurationInput('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      selectedDuration === preset && customDurationInput === ''
                        ? 'bg-[#5e5ce6] text-white shadow-sm'
                        : 'text-[#37352f]/60 hover:text-[#37352f]'
                    }`}
                  >
                    {preset}분
                  </button>
                ))}
              </div>

              {/* 자유 시간 직접 입력 */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#edece9]">
                <input
                  type="number"
                  min="1"
                  placeholder="자유 입력"
                  value={customDurationInput}
                  onChange={(e) => {
                    setCustomDurationInput(e.target.value);
                  }}
                  className="w-16 bg-transparent text-[#37352f] text-xs font-bold focus:outline-none border-b border-transparent focus:border-blue-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] font-black text-[#37352f]/50 uppercase">분</span>
              </div>

              {/* 스타트 버튼 */}
              <button
                onClick={() => handleStartTimer(selectedIds, () => setSelectedIds([]))}
                disabled={selectedIds.length === 0}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  selectedIds.length > 0
                    ? 'bg-[#5e5ce6] text-white hover:bg-[#4a49c6] shadow-md active:scale-95'
                    : 'bg-[#edece9]/50 text-[#37352f]/45 cursor-not-allowed'
                }`}
              >
                {selectedIds.length > 0 ? `START (${selectedIds.length}명)` : 'START (학생 선택)'}
              </button>

              {selectedIds.length > 0 && (
                <div className="pl-3 border-l border-[#edece9] flex items-center gap-2">
                  <button onClick={() => setSelectedIds([])} className="text-[#37352f]/60 hover:text-[#37352f] transition-colors" title="선택 해제">
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* 💡 복사되어 동적으로 생성된 타이머 목록 */}
            {activeTimers.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 max-w-7xl px-4 py-2 bg-white border border-[#edece9] rounded-2xl">
                {activeTimers.map((timer, idx) => {
                  const elapsed = Math.floor((currentTime.getTime() - timer.startTime) / 1000);
                  const remaining = Math.max(0, timer.duration * 60 - elapsed);
                  const isTimerExpired = remaining <= 0;
                  const theme = getTimerTheme(idx);
                  
                  const minutes = Math.floor(remaining / 60);
                  const seconds = remaining % 60;
                  
                  return (
                    <div 
                      key={timer.id} 
                      className={`flex items-center gap-4 px-4 py-2.5 rounded-xl border transition-all ${
                        isTimerExpired 
                          ? 'bg-red-50 border-red-400 shadow-md shadow-red-50 animate-pulse' 
                          : `${theme.bg}/10 ${theme.border}/40 shadow-sm`
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className={`text-[8px] font-black uppercase tracking-widest ${isTimerExpired ? 'text-red-500' : theme.text}`}>
                          TIMER #{idx + 1} ({timer.duration}m)
                        </span>
                        <div className="text-base font-black text-[#37352f] tabular-nums leading-none mt-1">
                          {isTimerExpired ? 'EXPIRED' : `${minutes}:${seconds.toString().padStart(2, '0')}`}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#edece9]/50 rounded-lg border border-[#edece9]">
                        <span className="text-[10px] font-black text-[#37352f]">{timer.studentIds.length}명</span>
                      </div>
 
                      <div className="flex items-center gap-1">
                        {selectedIds.length > 0 && (
                          <button
                            onClick={() => handleAssignToTimer(timer.id, selectedIds, () => setSelectedIds([]))}
                            className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all shadow-md"
                            title="선택된 학생을 이 타이머에 배정"
                          >
                            <UserPlus size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => handleStopTimer(timer.id)}
                          className="p-1.5 bg-white border border-[#edece9] hover:border-red-300 hover:bg-red-50 text-[#37352f]/60 hover:text-red-650 rounded-lg transition-all"
                          title="타이머 종료 및 삭제"
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto custom-scrollbar-v pr-2 pb-20 px-4">
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-3">
          {allTodayStudents.map((s, idx) => {
            const status = s.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
            const currentHour = currentTime.getHours();
            const studentHour = getStudentHour(s);
            const studentElapsed = getElapsedMinutesForHour(studentHour);
            
            const assignedTimerId = studentTimerMap[s.id];
            const prevStudent = idx > 0 ? allTodayStudents[idx - 1] : null;
            const prevStudentHour = prevStudent ? getStudentHour(prevStudent) : null;
            
            let showHourDivider = studentHour !== prevStudentHour;
            let showTimerDivider = false;
            if (activeTab === 'timer') {
              const prevAssignedTimerId = prevStudent ? studentTimerMap[prevStudent.id] : null;
              showTimerDivider = !!(assignedTimerId && assignedTimerId !== prevAssignedTimerId);
              showHourDivider = !!(!assignedTimerId && (prevAssignedTimerId || studentHour !== prevStudentHour));
            }

            const isPureAttend = status.startsWith(ATTENDANCE_STATUS.PRESENT), isLate = status.startsWith(ATTENDANCE_STATUS.LATE), isAbsent = status.startsWith(ATTENDANCE_STATUS.ABSENT);
            const isAnyMarked = isPureAttend || isLate || isAbsent;
            const isMakeupActive = (status.startsWith(ATTENDANCE_STATUS.SUPPLEMENT) || (s.todaySession?.moved_to_hour !== undefined && s.todaySession?.moved_to_hour !== null)) && !isAnyMarked;
            const isBeforeClass = status === ATTENDANCE_STATUS.BEFORE;
            const isSupplementPending = status === ATTENDANCE_STATUS.SUPPLEMENT && !(s.todaySession?.moved_to_hour !== undefined && s.todaySession?.moved_to_hour !== null);
            const isTimePassed = studentHour !== 999 && studentHour <= currentHour;
            const isLateWarning = isTimePassed && !isAnyMarked && !isSupplementPending && studentElapsed >= (settings.late_threshold || 10);
            const isCriticalWarning = isTimePassed && !isAnyMarked && !isSupplementPending && studentElapsed >= (settings.alert_threshold || 15);
            
            const activeTimerIdx = activeTimers.findIndex(t => t.id === assignedTimerId);
            const sharedTimer = activeTimerIdx !== -1 ? activeTimers[activeTimerIdx] : null;
            let remainingSec = 0, progress = 0, isTimerExpired = false;
            if (sharedTimer) {
              const elapsed = Math.floor((currentTime.getTime() - sharedTimer.startTime) / 1000);
              const total = sharedTimer.duration * 60;
              remainingSec = Math.max(0, total - elapsed);
              progress = Math.min(100, (elapsed / total) * 100);
              isTimerExpired = remainingSec <= 0;
            }
            const displayMinute = (baseM || 0).toString().padStart(2, '0');
            const isActive = activeStudentId === s.id;

            return (
              <React.Fragment key={s.id || idx}>
                {showTimerDivider && assignedTimerId && (
                  (() => {
                    const timerIdx = activeTimers.findIndex(t => t.id === assignedTimerId);
                    const timerObj = activeTimers[timerIdx];
                    if (!timerObj) return null;
                    const theme = getTimerTheme(timerIdx);
                    return (
                      <div className="col-span-full mt-8 mb-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center gap-2 ${theme.bg} ${theme.border} ${theme.text}`}>
                            <Clock size={12} /> Timer #{timerIdx + 1} Group
                          </div>
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            {timerObj.duration}분 설정 세션
                          </div>
                        </div>
                        <div className={`flex-1 h-px bg-gradient-to-r ${theme.bg}/30 to-transparent`} />
                      </div>
                    );
                  })()
                )}
                {showHourDivider && (
                  <div className="col-span-full mt-8 mb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setCollapsedHours(prev => ({ ...prev, [studentHour]: !prev[studentHour] }))}
                        className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] shadow-lg transition-all ${collapsedHours[studentHour] ? 'bg-[#edece9]/50 border-[#edece9] text-[#37352f]/40' : (studentHour === 999 ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : studentHour < currentHour ? 'bg-[#edece9]/30 border-[#edece9] text-[#37352f]/50' : studentHour === currentHour ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-blue-50 border-blue-200 text-blue-600')}`}
                      >
                        {studentHour === 999 ? '보강 / 기타 수업' : (studentHour >= 12 ? (studentHour === 12 ? `오후 12:${displayMinute}` : `오후 ${studentHour-12}:${displayMinute}`) : `오전 ${studentHour}:${displayMinute}`) + ' 수업'}
                        <span className="ml-2 opacity-50">{collapsedHours[studentHour] ? '▼' : '▲'}</span>
                      </button>
                      {studentHour !== 999 && !collapsedHours[studentHour] && (
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${selectedDate !== getTodayStr() ? (selectedDate > getTodayStr() ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-100 border-gray-300 text-gray-550') : (studentElapsed < (settings.late_threshold || 10) ? 'bg-emerald-50 border-emerald-200 text-emerald-650' : studentElapsed < (settings.alert_threshold || 15) ? 'bg-amber-50 border-amber-200 text-amber-650' : 'bg-red-50 border-red-200 text-red-650')}`}>
                            {selectedDate === getTodayStr() ? (studentElapsed < 0 ? `${Math.abs(studentElapsed)}분 전` : `${studentElapsed}분 경과`) : (selectedDate > getTodayStr() ? '수업 예정' : '수업 종료')}
                          </span>
                          <div className="flex items-center gap-1 ml-2">
                            <button onClick={() => handleResetHour(studentHour)} className="flex items-center gap-1.5 px-3 py-0.5 bg-white border border-[#edece9] rounded text-[10px] font-black text-[#37352f]/70 hover:bg-[#edece9]/50 transition-all uppercase tracking-widest"><RotateCcw size={10} /> 전체 초기화</button>
                            <button onClick={() => handleFinishHour(studentHour)} className="flex items-center gap-1.5 px-3 py-0.5 bg-red-50 border border-red-200 rounded text-[10px] font-black text-red-600 hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest">마감하기</button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#edece9] to-transparent" />
                  </div>
                )}
                <AnimatePresence>
                  {!collapsedHours[studentHour] && (
                    <motion.div 
                      layout 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.95, height: 0, overflow: 'hidden' }}
                      transition={{ duration: 0.2 }}
                      onClick={() => activeTab === 'attendance' ? handleCardClick(s) : handleToggleSelect(s.id)}
                      className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center gap-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                        activeTab === 'timer' 
                          ? (selectedIds.includes(s.id) 
                            ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50' 
                            : isTimerExpired 
                            ? 'border-red-500 bg-red-50 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse' 
                            : sharedTimer 
                            ? (() => {
                                const theme = getTimerTheme(activeTimerIdx);
                                return `${theme.border} ${theme.bg}/5`;
                              })()
                            : 'border-[#d3d1cb] bg-white') 
                          : (isPureAttend 
                            ? 'opacity-65 grayscale-[0.2] scale-[0.98] border-[#e3e2e0] bg-[#edece9]/20 text-[#37352f]/60' 
                            : isMakeupActive 
                            ? 'bg-blue-50 border-blue-400 shadow-md shadow-blue-50' 
                            : isAbsent 
                            ? 'bg-red-50 border-red-400 shadow-md shadow-red-50' 
                            : isLate 
                            ? 'bg-amber-50 border-amber-400 shadow-md shadow-amber-50' 
                            : isCriticalWarning 
                            ? 'bg-red-50 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse' 
                            : isLateWarning 
                            ? 'bg-amber-50 border-amber-300' 
                            : isSupplementPending 
                            ? 'bg-indigo-50/30 border-indigo-300 border-dashed' 
                            : 'bg-white border-[#d3d1cb] hover:border-blue-400 hover:bg-blue-50/40 shadow-sm')
                      }`}
                    >
                      {activeTab === 'timer' ? (
                        <>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                            <svg className="w-24 h-24 rotate-[-90deg]">
                              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-gray-200" />
                              {sharedTimer && (
                                <motion.circle 
                                  cx="48" 
                                  cy="48" 
                                  r="40" 
                                  stroke="currentColor" 
                                  strokeWidth="4" 
                                  fill="transparent" 
                                  strokeDasharray="251.2" 
                                  initial={{ strokeDashoffset: 251.2 }} 
                                  animate={{ strokeDashoffset: 251.2 * (progress / 100) }} 
                                  className={`${isTimerExpired ? 'text-red-500' : getTimerTheme(activeTimerIdx).text}`} 
                                />
                              )}
                            </svg>
                          </div>
                          {sharedTimer && !isTimerExpired && (
                            <div 
                              className={`absolute bottom-0 left-0 h-1 z-0 transition-all duration-1000 ${getTimerTheme(activeTimerIdx).bg}`} 
                              style={{ width: `${100 - progress}%` }} 
                            />
                          )}
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 z-10">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(s.id)} 
                              onChange={() => {}} 
                              className="w-3 h-3 rounded-sm border-[#edece9] bg-white checked:bg-blue-500 cursor-pointer" 
                            />
                          </div>
                          <div className="text-center px-1 relative z-10">
                            <h3 className="text-2xl font-black tracking-tighter leading-none text-[#37352f] drop-shadow-sm">{s.name}</h3>
                            <p 
                              className={`mt-2 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                sharedTimer 
                                  ? (() => {
                                      const theme = getTimerTheme(activeTimerIdx);
                                      return `${theme.border} ${theme.text}`;
                                    })()
                                  : s.grade.includes('초') 
                                  ? 'text-emerald-600 border-emerald-250 bg-emerald-50' 
                                  : s.grade.includes('고') 
                                  ? 'text-amber-600 border-amber-250 bg-amber-50' 
                                  : 'text-blue-600 border-blue-250 bg-blue-50'
                              }`}
                            >
                              {sharedTimer ? `Timer #${activeTimerIdx + 1}` : s.grade}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-45"><div className={`w-1 h-1 rounded-full ${studentHour === 999 ? 'bg-indigo-500' : (studentHour < currentHour ? 'bg-gray-400' : studentHour === currentHour ? 'bg-emerald-500' : 'bg-blue-550')}`} /><span className="text-[6px] font-black uppercase text-gray-500">{studentHour === 999 ? 'SUP' : (studentHour >= 12 ? (studentHour === 12 ? '12p' : `${studentHour-12}p`) : `${studentHour}a`)}</span></div>
                          <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1"><div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isPureAttend ? 'bg-[#edece9] text-[#37352f]' : isMakeupActive ? 'bg-blue-500 text-white' : isAbsent ? 'bg-red-500 text-white' : isLate ? 'bg-amber-500 text-black' : isCriticalWarning ? 'bg-red-500 text-white' : isLateWarning ? 'bg-amber-555 text-white' : isSupplementPending ? 'bg-indigo-100 text-indigo-650 border border-indigo-200' : 'bg-blue-600 text-white'}`}>{isPureAttend ? <Check size={10} strokeWidth={4} /> : isAbsent ? <LogOut size={10} /> : isLate ? <Clock size={10} strokeWidth={3} /> : isMakeupActive ? <CalendarClock size={10} /> : isSupplementPending ? <Plus size={10} strokeWidth={4} /> : <User size={10} />}</div><button onClick={(e) => { e.stopPropagation(); setActiveStudentId(s.id); setIsTimeShiftOpen(false); }} className="p-1 hover:bg-[#edece9]/55 rounded transition-colors text-gray-400 hover:text-[#37352f]"><MoreHorizontal size={12} /></button></div>
                          <div className="text-center px-1"><h3 className={`text-2xl font-black tracking-tighter leading-none ${isPureAttend ? 'text-[#37352f]/45 font-normal' : 'text-[#37352f]'}`}>{s.name}</h3><div className="mt-2 flex flex-col items-center gap-1">
                            {(() => { const isES = s.grade.includes('초'); const isHS = s.grade.includes('고'); const colorClass = isES ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : isHS ? 'text-amber-600 border-amber-250 bg-amber-50' : 'text-blue-600 border-blue-205 bg-blue-50'; return <p className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${isPureAttend ? 'text-[#37352f]/40 border-[#edece9] bg-white opacity-50' : colorClass}`}>{s.grade}</p>; })()}
 
                          </div></div>
                          {isAnyMarked && <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter ${isAbsent ? 'bg-red-500 text-white' : isLate ? 'bg-amber-500 text-black' : isMakeupActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{isMakeupActive ? (s.todaySession?.moved_to_hour !== undefined && s.todaySession?.moved_to_hour !== null ? `${s.todaySession?.moved_to_hour}시` : (s.isScheduledToday ? '이동' : '보강')) : (status.startsWith(ATTENDANCE_STATUS.PRESENT) ? '출석' : status.startsWith(ATTENDANCE_STATUS.LATE) ? '지각' : status.startsWith(ATTENDANCE_STATUS.ABSENT) ? '결석' : status)}</div>}
                          {isBeforeClass && <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter bg-blue-50 text-blue-600 border border-blue-200">수업전</div>}
                          {!isAnyMarked && !isSupplementPending && isLateWarning && <div className={`absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter ${isCriticalWarning ? 'bg-red-550 text-white animate-pulse' : 'bg-amber-50 border border-amber-300 text-amber-700'}`}><AlertCircle size={8} /> {isCriticalWarning ? '미등원' : '지각위험'}</div>}
                        </>
                      )}
                      <AnimatePresence>
                        {isActive && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/95 border border-[#edece9] backdrop-blur-md z-20 flex flex-col items-center justify-center p-1" onClick={(e) => e.stopPropagation()}>
                            {!isTimeShiftOpen ? (
                              <div className="flex flex-col gap-1 w-full h-full p-0.5">
                                <div className="grid grid-cols-2 gap-1 flex-1 min-h-0">
                                  <button onClick={() => handleQuickAction(s.id, ATTENDANCE_STATUS.BEFORE)} className="flex flex-col items-center justify-center bg-white border border-[#edece9] rounded hover:bg-[#edece9]/50 transition-all group p-1"><RotateCcw size={16} className="text-[#37352f]/60 group-hover:text-[#37352f]" /><span className="text-[10px] font-black uppercase mt-1 text-[#37352f]/70">초기화</span></button>
                                  <button onClick={() => handleQuickAction(s.id, ATTENDANCE_STATUS.LATE)} className="flex flex-col items-center justify-center bg-amber-50 border border-amber-200 rounded hover:bg-[#edece9]/50 transition-all group p-1"><Clock size={16} className="text-amber-600 group-hover:text-amber-700" /><span className="text-[10px] font-black uppercase mt-1 text-amber-700">지각</span></button>
                                  <button onClick={() => handleQuickAction(s.id, ATTENDANCE_STATUS.ABSENT)} className="flex flex-col items-center justify-center bg-red-50 border border-red-200 rounded hover:bg-[#edece9]/50 transition-all group p-1"><X size={16} className="text-red-500 group-hover:text-red-650" /><span className="text-[10px] font-black uppercase mt-1 text-red-600">결석</span></button>
                                  <button onClick={() => setIsTimeShiftOpen(true)} className="flex flex-col items-center justify-center bg-blue-50 border border-blue-200 rounded hover:bg-[#edece9]/50 transition-all group p-1"><CalendarClock size={16} className="text-blue-600 group-hover:text-blue-700" /><span className="text-[10px] font-black uppercase mt-1 text-blue-600">시간 이동</span></button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col w-full h-full p-1">
                                <button onClick={() => setIsTimeShiftOpen(false)} className="flex items-center gap-1 text-[7px] font-black text-gray-500 hover:text-[#37352f] mb-1 uppercase"><ArrowLeft size={6} /> 뒤로</button>
                                <div className="grid grid-cols-4 gap-0.5 overflow-y-auto pr-1 custom-scrollbar-v flex-1">
                                  {[13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(h => (<button key={h} onClick={() => handleTimeShift(s.id, h)} className="py-1 rounded bg-white border border-[#edece9] text-[8px] font-black hover:bg-blue-600 hover:text-white transition-all">{h >= 12 ? (h === 12 ? '12p' : `${h-12}p`) : `${h}a`}</button>))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-8 py-3 bg-white/95 backdrop-blur-md border border-[#d3d1cb] rounded-full flex items-center justify-center gap-6 z-30 shadow-lg shadow-gray-250/50 shrink-0">
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">전체</span><span className="text-xl font-black text-[#37352f]">{stats.total}</span></div>
        <div className="w-px h-6 bg-[#edece9]" />
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">출석</span><span className="text-xl font-black text-emerald-600">{stats.attended}</span></div>
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">지각</span><span className="text-xl font-black text-amber-600">{stats.late}</span></div>
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">결석</span><span className="text-xl font-black text-red-600">{stats.absent}</span></div>
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter opacity-70">확인 필요</span><span className="text-xl font-black text-amber-600 animate-pulse">{stats.pending}</span></div>
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">예정</span><span className="text-xl font-black text-blue-600 opacity-80">{stats.upcoming}</span></div>
      </div>
    </motion.div>
  );
}
