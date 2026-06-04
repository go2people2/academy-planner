'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Check, Clock, AlertCircle, MessageSquare, 
  User, UserCheck, UserPlus, Zap, Bell, Copy,
  ArrowLeft, LogOut, MoreHorizontal, CalendarClock, RotateCcw,
  StickyNote, Target, Plus
} from 'lucide-react';
import { Student } from '@/types/dashboard';
import { getTodayStr, getDayOfWeek } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface ClassroomModeProps {
  students: Student[];
  onSave: (id: string, data: any) => Promise<boolean>;
  onClose: () => void;
  selectedDate: string;
  academyInfo?: any;
  selectedTeacherId?: string;
}

export default function ClassroomMode({ students, onSave, onClose, selectedDate, academyInfo, selectedTeacherId }: ClassroomModeProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'attendance' | 'timer'>('attendance');
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [isTimeShiftOpen, setIsTimeShiftOpen] = useState(false);

  const settings = useMemo(() => academyInfo?.operation_settings || {}, [academyInfo]);
  
  // 💡 설정된 3가지 시험 시간 추출 (기본값 설정 로직)
  const timerPresets = useMemo(() => {
    const p1 = parseInt(settings.timer_duration_1) || 15;
    const p2 = parseInt(settings.timer_duration_2) || 30;
    const p3 = parseInt(settings.timer_duration_3) || 60;
    return [p1, p2, p3];
  }, [settings]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [collapsedHours, setCollapsedHours] = useState<Record<number, boolean>>({}); // 💡 접힌 교시 상태 추가
  const [globalTimers, setGlobalTimers] = useState<Record<number, { startTime: number | null, duration: number }>>({
    1: { startTime: null, duration: timerPresets[0] },
    2: { startTime: null, duration: timerPresets[0] },
    3: { startTime: null, duration: timerPresets[0] }
  });

  // 💡 설정값이 변경되었을 때 실행되지 않은 타이머의 기본값 동기화
  useEffect(() => {
    setGlobalTimers(prev => {
      const next = { ...prev };
      [1, 2, 3].forEach(slot => {
        if (!next[slot].startTime) next[slot].duration = timerPresets[0];
      });
      return next;
    });
  }, [timerPresets]);

  const [studentTimerMap, setStudentTimerMap] = useState<Record<string, number>>({});

  // 💡 [수정] 컴포넌트 마운트 시 기존 타이머 상태 복구 로직 (시작 시간 순 정렬로 안정화)
  useEffect(() => {
    const uniqueTimersMap = new Map<number, number>();
    students.forEach(s => {
      if (s.todaySession?.timer_started_at && s.todaySession?.timer_duration) {
        uniqueTimersMap.set(s.todaySession.timer_started_at, s.todaySession.timer_duration);
      }
    });
    if (uniqueTimersMap.size === 0) return;
    const sortedStartTimes = Array.from(uniqueTimersMap.keys()).sort((a, b) => a - b);
    const recoveredTimers: Record<number, { startTime: number, duration: number }> = {};
    const newMapping: Record<string, number> = {};
    sortedStartTimes.forEach((startTime, idx) => {
      const slot = idx + 1;
      if (slot <= 3) {
        recoveredTimers[slot] = { startTime, duration: uniqueTimersMap.get(startTime)! };
        students.forEach(s => { if (s.todaySession?.timer_started_at === startTime) newMapping[s.id] = slot; });
      }
    });
    setGlobalTimers(prev => ({ ...prev, ...recoveredTimers }));
    setStudentTimerMap(newMapping);
  }, [students]);

  // 💡 실시간 시계 업데이트 (1초마다)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timerColors: Record<number, { text: string, bg: string, border: string, ring: string, glow: string }> = {
    1: { text: 'text-indigo-400', bg: 'bg-indigo-600', border: 'border-indigo-500', ring: 'ring-indigo-500/30', glow: 'shadow-indigo-500/20' },
    2: { text: 'text-emerald-400', bg: 'bg-emerald-600', border: 'border-emerald-500', ring: 'ring-emerald-500/30', glow: 'shadow-emerald-500/20' },
    3: { text: 'text-rose-400', bg: 'bg-rose-600', border: 'border-rose-500', ring: 'ring-rose-500/30', glow: 'shadow-rose-500/20' }
  };

  const baseTime = settings.first_period_time || "";
  const [baseH, baseM] = baseTime ? baseTime.split(':').map(Number) : [null, null];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 💡 학생의 수업 시간(시) 추출 함수 (정밀화)
  const getStudentHour = (student: Student) => {
    const day = getDayOfWeek(selectedDate);
    const status = student.todaySession?.attendance_status || '';
    if (status.includes(':')) {
      const parts = status.split(':');
      const val = parseInt(parts[parts.length - 1]);
      if (!isNaN(val) && val < 24) return val;
    }
    const hours = student.day_schedules?.[day] || [];
    if (hours.length > 0) return Math.min(...hours.map(h => h >= 100 ? h - 100 : h));
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

  const handleStartGlobalTimer = async (slot: number) => {
    const now = Date.now();
    const duration = globalTimers[slot].duration;
    setGlobalTimers(prev => ({ ...prev, [slot]: { ...prev[slot], startTime: now } }));
    if (selectedIds.length > 0) {
      const newMapping = { ...studentTimerMap };
      selectedIds.forEach(id => { newMapping[id] = slot; });
      setStudentTimerMap(newMapping);
      await Promise.all(selectedIds.map(id => onSave(id, { timer_started_at: now, timer_duration: duration })));
      setSelectedIds([]);
    }
  };

  const handleAssignToRunningTimer = async (slot: number) => {
    if (selectedIds.length === 0) return;
    const timer = globalTimers[slot];
    if (!timer.startTime) return;
    const newMapping = { ...studentTimerMap };
    selectedIds.forEach(id => { newMapping[id] = slot; });
    setStudentTimerMap(newMapping);
    await Promise.all(selectedIds.map(id => onSave(id, { timer_started_at: timer.startTime, timer_duration: timer.duration })));
    setSelectedIds([]);
  };

  const handleStopGlobalTimer = async (slot: number) => {
    setGlobalTimers(prev => ({ ...prev, [slot]: { ...prev[slot], startTime: null } }));
    const newMapping = { ...studentTimerMap };
    const studentsToClear = Object.keys(newMapping).filter(id => newMapping[id] === slot);
    await Promise.all(studentsToClear.map(id => onSave(id, { timer_started_at: null, timer_duration: null })));
    studentsToClear.forEach(id => delete newMapping[id]);
    setStudentTimerMap(newMapping);
  };

  const handleFinishHour = async (hour: number) => {
    const studentsToMark = allTodayStudents.filter(s => {
      const sHour = getStudentHour(s);
      const status = s.todaySession?.attendance_status || '';
      return sHour === hour && (status === '' || status === '보강');
    });
    if (studentsToMark.length === 0) return;
    const confirmMsg = `${hour === 999 ? '보강/기타' : (hour >= 12 ? (hour === 12 ? '오후 12' : `오후 ${hour-12}`) : `오전 ${hour}`)}시 수업 미출석 학생 ${studentsToMark.length}명을 결석 처리하시겠습니까?`;
    if (confirm(confirmMsg)) {
      for (const s of studentsToMark) {
        const isSupplement = s.todaySession?.attendance_status === '보강';
        await onSave(s.id, { attendance_status: isSupplement ? `결석:보강` : `결석:${hour}` });
      }
      setCollapsedHours(prev => ({ ...prev, [hour]: true }));
    }
  };

  const handleResetHour = async (hour: number) => {
    const studentsToReset = allTodayStudents.filter(s => getStudentHour(s) === hour);
    if (studentsToReset.length === 0) return;
    const confirmMsg = `${hour === 999 ? '보강/기타' : (hour >= 12 ? (hour === 12 ? '오후 12' : `오후 ${hour-12}`) : `오전 ${hour}`)}시 수업 모든 학생(${studentsToReset.length}명)의 출결 상태를 초기화하시겠습니까?`;
    if (confirm(confirmMsg)) { for (const s of studentsToReset) { await onSave(s.id, { attendance_status: null }); } }
  };

  const allTodayStudents = useMemo(() => {
    return students.filter(s => {
      if (s.is_deleted) return false;
      const session = s.todaySession;
      if (session) {
        const sDate = session.date || session.session_date;
        if (sDate && sDate !== selectedDate) return false;
      }
      const status = session?.attendance_status || '';
      const day = getDayOfWeek(selectedDate);
      const hours = s.day_schedules?.[day] || [];
      const hasRegularSession = hours.length > 0;
      const isRealPresence = status !== '' && status !== 'none';
      if (!((hasRegularSession || isRealPresence) && status !== '수업제외')) return false;
      if (selectedTeacherId && selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;
      const studentHour = getStudentHour(s);
      if (baseH !== null && studentHour !== 999 && studentHour < baseH) return false;
      return true;
    }).sort((a, b) => {
      if (activeTab === 'timer') {
        const timerA = studentTimerMap[a.id] || 999;
        const timerB = studentTimerMap[b.id] || 999;
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
      attended: allTodayStudents.filter(s => s.todaySession?.attendance_status?.startsWith('출석')).length,
      late: allTodayStudents.filter(s => s.todaySession?.attendance_status?.startsWith('지각')).length,
      absent: allTodayStudents.filter(s => s.todaySession?.attendance_status?.startsWith('결석')).length,
      pending: allTodayStudents.filter(s => {
        const stat = s.todaySession?.attendance_status || '';
        const h = getStudentHour(s);
        const studentElapsed = getElapsedMinutesForHour(h);
        const isProcessFinished = stat.startsWith('출석') || stat.startsWith('지각') || stat.startsWith('결석') || (stat.includes(':') && !stat.endsWith(':보강'));
        return !isProcessFinished && stat !== '보강' && studentElapsed >= (settings.alert_threshold || 15);
      }).length,
      upcoming: allTodayStudents.filter(s => {
        const stat = s.todaySession?.attendance_status || '';
        const h = getStudentHour(s);
        const studentElapsed = getElapsedMinutesForHour(h);
        return studentElapsed < 0 && stat === '';
      }).length
    };
  }, [allTodayStudents, currentTime, settings.alert_threshold]);

  const handleCardClick = async (student: Student) => {
    if (activeStudentId === student.id) { setActiveStudentId(null); return; }
    setActiveStudentId(student.id);
    setIsTimeShiftOpen(false);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleQuickAction = async (studentId: string, status: string | null) => {
    const student = students.find(s => s.id === studentId);
    const currentStatus = student?.todaySession?.attendance_status || '';
    let finalStatus = status;
    if (status && currentStatus.includes(':')) {
      const parts = currentStatus.split(':');
      finalStatus = `${status}:${parts[parts.length - 1]}`;
    }
    await onSave(studentId, { attendance_status: finalStatus });
    setActiveStudentId(null);
    setIsTimeShiftOpen(false);
  };

  const handleTimeShift = async (studentId: string, hour: number) => {
    await onSave(studentId, { attendance_status: `보강:${hour}` });
    setActiveStudentId(null);
    setIsTimeShiftOpen(false);
  };

  const copyToClipboard = () => {
    const currentHour = currentTime.getHours();
    const absents = allTodayStudents.filter(s => {
      const stat = s.todaySession?.attendance_status || '';
      const h = getStudentHour(s);
      const isAttended = stat.startsWith('출석') || stat.startsWith('지각') || stat.startsWith('결석');
      return (h === 999 || h <= currentHour) && !isAttended;
    });
    const msg = absents.length === 0 ? "현재 타임에 미등원 학생이 없습니다." : `${absents.map(s => s.name).join(', ')} 학생이 아직 등원 전입니다. 연락부탁드립니다.`;
    navigator.clipboard.writeText(msg);
    alert('데스크 전달 메시지가 복사되었습니다.');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-[#050505] flex flex-col p-6 overflow-hidden text-center">
      <div className="flex items-center justify-between mb-6 gap-6 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30"><Zap className="text-white" size={24} /></div>
            <div className="hidden sm:block">
              <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">LIVE</h2>
              <div className="flex items-center gap-1.5 mt-1 text-blue-400 font-bold text-[10px]"><Clock size={10} /> {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button onClick={() => setActiveTab('attendance')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'attendance' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}><UserCheck size={14} /> <span>출석체크</span></button>
            <button onClick={() => setActiveTab('timer')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'timer' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}><Clock size={14} /> <span>테스트 타이머</span></button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={copyToClipboard} className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all font-black text-sm uppercase whitespace-nowrap"><Copy size={18} /> <span className="hidden md:inline">미등원 명단 복사</span></button>
          <button onClick={onClose} className="p-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-all"><X size={24} /></button>
        </div>
      </div>

      <AnimatePresence>
        {activeTab === 'timer' && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="mb-8 flex items-center justify-center gap-4 shrink-0">
            <div className="flex bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl items-center gap-4">
              {[1, 2, 3].map((slot) => {
                const timer = globalTimers[slot];
                const isRunning = !!timer.startTime;
                const colors = timerColors[slot];
                return (
                  <div key={slot} className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${isRunning ? `${colors.bg}/20 ${colors.border}/50 shadow-lg ${colors.glow}` : 'bg-white/5 border-white/5'}`}>
                    <div className="flex flex-col text-left">
                      <span className={`text-[8px] font-black uppercase tracking-widest ${isRunning ? colors.text : 'text-gray-600'}`}>Slot {slot}</span>
                      <div className="flex items-center gap-2">
                        {isRunning ? (
                          <div className="text-lg font-black text-white tabular-nums leading-none">
                            {(() => {
                              const elapsed = Math.floor((currentTime.getTime() - (timer.startTime || 0)) / 1000);
                              const remaining = Math.max(0, timer.duration * 60 - elapsed);
                              return `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;
                            })()}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 p-0.5 bg-white/5 rounded-lg border border-white/10">
                            {timerPresets.map((preset) => (
                              <button
                                key={preset}
                                onClick={() => setGlobalTimers(prev => ({ ...prev, [slot]: { ...prev[slot], duration: preset } }))}
                                className={`px-2 py-1 rounded text-[11px] font-black transition-all ${
                                  timer.duration === preset 
                                    ? 'bg-blue-600 text-white shadow-lg' 
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-tighter pr-1">m</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                      {!isRunning ? (
                        <button onClick={() => handleStartGlobalTimer(slot)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedIds.length > 0 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
                          {selectedIds.length > 0 ? `START (${selectedIds.length}명)` : 'START'}
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          {selectedIds.length > 0 && <button onClick={() => handleAssignToRunningTimer(slot)} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all shadow-lg"><UserPlus size={14} /></button>}
                          <button onClick={() => handleStopGlobalTimer(slot)} className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all shadow-lg"><RotateCcw size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {selectedIds.length > 0 && (
                <div className="px-4 border-l border-white/10 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black">{selectedIds.length}</div>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Selected</span>
                  <button onClick={() => setSelectedIds([])} className="text-gray-600 hover:text-white ml-2 transition-colors"><X size={14} /></button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto custom-scrollbar-v pr-2 pb-20 px-4">
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-3">
          {allTodayStudents.map((s, idx) => {
            const status = s.todaySession?.attendance_status || '';
            const currentHour = currentTime.getHours();
            const studentHour = getStudentHour(s);
            const studentElapsed = getElapsedMinutesForHour(studentHour);
            const assignedSlot = studentTimerMap[s.id];
            const prevStudent = idx > 0 ? allTodayStudents[idx - 1] : null;
            const prevStudentHour = prevStudent ? getStudentHour(prevStudent) : null;
            
            let showHourDivider = studentHour !== prevStudentHour;
            let showTimerDivider = false;
            if (activeTab === 'timer') {
              const prevAssignedSlot = prevStudent ? studentTimerMap[prevStudent.id] : null;
              showTimerDivider = !!(assignedSlot && assignedSlot !== prevAssignedSlot);
              showHourDivider = !!(!assignedSlot && (prevAssignedSlot || studentHour !== prevStudentHour));
            }

            const isPureAttend = status.startsWith('출석'), isLate = status.startsWith('지각'), isAbsent = status.startsWith('결석'), isMakeupActive = status.includes(':보강') || (status.startsWith('보강:') && status.split(':').length === 2);
            const isSupplementPending = status === '보강', isAnyMarked = isPureAttend || isLate || isAbsent || isMakeupActive;
            const isCurrentSession = studentHour === currentHour || studentHour === 999;
            const isLateWarning = isCurrentSession && !isAnyMarked && !isSupplementPending && studentElapsed >= (settings.late_threshold || 10);
            const isCriticalWarning = isCurrentSession && !isAnyMarked && !isSupplementPending && studentElapsed >= (settings.alert_threshold || 15);
            const sharedTimer = assignedSlot ? globalTimers[assignedSlot] : null;
            let remainingSec = 0, progress = 0, isTimerExpired = false;
            if (sharedTimer && sharedTimer.startTime) {
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
                {showTimerDivider && assignedSlot && (
                  <div className="col-span-full mt-8 mb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center gap-2 ${timerColors[assignedSlot].bg} ${timerColors[assignedSlot].border} text-white`}><Clock size={12} /> Timer Slot #{assignedSlot} Group</div>
                      <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{globalTimers[assignedSlot].duration} min session</div>
                    </div>
                    <div className={`flex-1 h-px bg-gradient-to-r ${timerColors[assignedSlot].bg}/30 to-transparent`} />
                  </div>
                )}
                {showHourDivider && (
                  <div className="col-span-full mt-8 mb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setCollapsedHours(prev => ({ ...prev, [studentHour]: !prev[studentHour] }))}
                        className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] shadow-lg transition-all ${collapsedHours[studentHour] ? 'bg-gray-800 border-white/10 text-gray-500' : (studentHour === 999 ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : studentHour < currentHour ? 'bg-white/5 border-white/10 text-gray-600' : studentHour === currentHour ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-blue-600/20 border-blue-500/30 text-blue-400')}`}
                      >
                        {studentHour === 999 ? '보강 / 기타 수업' : (studentHour >= 12 ? (studentHour === 12 ? `오후 12:${displayMinute}` : `오후 ${studentHour-12}:${displayMinute}`) : `오전 ${studentHour}:${displayMinute}`) + ' 수업'}
                        <span className="ml-2 opacity-50">{collapsedHours[studentHour] ? '▼' : '▲'}</span>
                      </button>
                      {studentHour !== 999 && !collapsedHours[studentHour] && (
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${selectedDate !== getTodayStr() ? (selectedDate > getTodayStr() ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' : 'bg-gray-500/20 text-gray-500 border-gray-500/20') : (studentElapsed < (settings.late_threshold || 10) ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20' : studentElapsed < (settings.alert_threshold || 15) ? 'bg-amber-500/20 text-amber-500 border-amber-500/20' : 'bg-red-500/20 text-red-500 border-red-500/20')}`}>
                            {selectedDate === getTodayStr() ? (studentElapsed < 0 ? `${Math.abs(studentElapsed)}분 전` : `${studentElapsed}분 경과`) : (selectedDate > getTodayStr() ? '수업 예정' : '수업 종료')}
                          </span>
                          <div className="flex items-center gap-1 ml-2">
                            <button onClick={() => handleResetHour(studentHour)} className="flex items-center gap-1.5 px-3 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-black text-gray-400 hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest"><RotateCcw size={10} /> 전체 초기화</button>
                            <button onClick={() => handleFinishHour(studentHour)} className="flex items-center gap-1.5 px-3 py-0.5 bg-red-600/10 border border-red-500/20 rounded text-[10px] font-black text-red-500 hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest">마감하기</button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
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
                      className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center gap-2 transition-all duration-300 cursor-pointer overflow-hidden ${activeTab === 'timer' ? (selectedIds.includes(s.id) ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-600/5' : isTimerExpired ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse' : sharedTimer ? `${timerColors[assignedSlot].border} ${timerColors[assignedSlot].bg}/5` : 'border-white/10 bg-white/5') : (isPureAttend ? 'opacity-60 grayscale-[0.2] scale-[0.98] border-white/10 bg-white/5' : isMakeupActive ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-900/20' : isAbsent ? 'bg-red-500/20 border-red-500 shadow-lg shadow-red-900/20' : isLate ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-900/20' : isCriticalWarning ? 'bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse' : isLateWarning ? 'bg-amber-500/10 border-amber-500' : isSupplementPending ? 'bg-indigo-500/5 border-indigo-500/30 border-dashed' : 'bg-blue-600/5 border-blue-500/50 hover:border-blue-500 hover:bg-blue-500/10')}`}
                    >
                      {activeTab === 'timer' ? (
                        <>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20"><svg className="w-24 h-24 rotate-[-90deg]"><circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/10" />{sharedTimer && <motion.circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="251.2" animate={{ strokeDashoffset: 251.2 * (progress / 100) }} className={`${isTimerExpired ? 'text-red-500' : timerColors[assignedSlot].text}`} />}</svg></div>
                          {sharedTimer && !isTimerExpired && <div className={`absolute bottom-0 left-0 h-1 z-0 transition-all duration-1000 ${timerColors[assignedSlot].bg}`} style={{ width: `${100 - progress}%` }} />}
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 z-10"><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => {}} className="w-3 h-3 rounded-sm border-white/20 bg-black/40 checked:bg-blue-500 cursor-pointer" /></div>
                          <div className="text-center px-1 relative z-10"><h3 className="text-2xl font-black tracking-tighter leading-none text-white drop-shadow-lg">{s.name}</h3><p className={`mt-2 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${sharedTimer ? `${timerColors[assignedSlot].border} ${timerColors[assignedSlot].text}` : s.grade.includes('초') ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : s.grade.includes('고') ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-blue-400 border-blue-500/30 bg-blue-500/10'}`}>{sharedTimer ? `Timer ${assignedSlot}` : s.grade}</p></div>
                        </>
                      ) : (
                        <>
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-40"><div className={`w-1 h-1 rounded-full ${studentHour === 999 ? 'bg-indigo-500' : (studentHour < currentHour ? 'bg-gray-600' : studentHour === currentHour ? 'bg-emerald-500' : 'bg-blue-500/40')}`} /><span className="text-[6px] font-black uppercase text-gray-500">{studentHour === 999 ? 'SUP' : (studentHour >= 12 ? (studentHour === 12 ? '12p' : `${studentHour-12}p`) : `${studentHour}a`)}</span></div>
                          <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1"><div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isPureAttend ? 'bg-white/10 text-gray-500' : isMakeupActive ? 'bg-blue-500 text-white' : isAbsent ? 'bg-red-500 text-white' : isLate ? 'bg-amber-500 text-black' : isCriticalWarning ? 'bg-red-500 text-white' : isLateWarning ? 'bg-amber-500 text-black' : isSupplementPending ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-blue-600 text-white'}`}>{isPureAttend ? <Check size={10} strokeWidth={4} /> : isAbsent ? <LogOut size={10} /> : isLate ? <Clock size={10} strokeWidth={3} /> : isMakeupActive ? <CalendarClock size={10} /> : isSupplementPending ? <Plus size={10} strokeWidth={4} /> : <User size={10} />}</div><button onClick={(e) => { e.stopPropagation(); setActiveStudentId(s.id); }} className="p-1 hover:bg-white/10 rounded transition-colors text-gray-600 hover:text-white"><MoreHorizontal size={12} /></button></div>
                          <div className="text-center px-1"><h3 className={`text-2xl font-black tracking-tighter leading-none ${isPureAttend ? 'text-gray-400' : 'text-white'}`}>{s.name}</h3><div className="mt-2 flex flex-col items-center gap-1">
                            {(() => { const isES = s.grade.includes('초'); const isHS = s.grade.includes('고'); const colorClass = isES ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : isHS ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-blue-400 border-blue-500/30 bg-blue-500/10'; return <p className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${isPureAttend ? 'text-gray-600 border-white/5 bg-white/5 opacity-50' : colorClass}`}>{s.grade}</p>; })()}
                            <div className="flex items-center gap-1.5 mt-1 justify-center">
                              {s.management_notes && (
                                <div className="relative group/tooltip">
                                  <StickyNote size={12} className="text-amber-500 opacity-40 group-hover/tooltip:opacity-100 transition-opacity" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-amber-100 text-amber-900 text-[10px] font-bold rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 border border-amber-200">
                                    <div className="flex items-center gap-1 mb-1 border-b border-amber-900/10 pb-1 text-[8px] uppercase tracking-tighter opacity-60"><StickyNote size={8} /> Teacher's Note</div>
                                    <div className="whitespace-pre-wrap leading-tight text-left">{s.management_notes}</div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-amber-100" />
                                  </div>
                                </div>
                              )}
                              {s.recent_mission && (
                                <div className="relative group/tooltip">
                                  <Target size={12} className="text-blue-500 opacity-40 group-hover/tooltip:opacity-100 transition-opacity" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-blue-600 text-white text-[10px] font-bold rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 border border-blue-400/30">
                                    <div className="flex items-center gap-1 mb-1 border-b border-white/20 pb-1 text-[8px] uppercase tracking-tighter opacity-60"><Target size={8} /> Current Mission</div>
                                    <div className="whitespace-pre-wrap leading-tight text-left">{s.recent_mission}</div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-blue-600" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div></div>
                          {isAnyMarked && <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter ${isAbsent ? 'bg-red-500 text-white' : isLate ? 'bg-amber-500 text-black' : isMakeupActive ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-gray-400'}`}>{isMakeupActive ? (status.includes(':') ? (isNaN(parseInt(status.split(':')[1])) ? '보강' : `${status.split(':')[1]}시`) : '보강') : (status.startsWith('출석') ? '출석' : status.startsWith('지각') ? '지각' : status.startsWith('결석') ? '결석' : status)}</div>}
                          {!isAnyMarked && !isSupplementPending && isLateWarning && <div className={`absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter ${isCriticalWarning ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'}`}><AlertCircle size={8} /> {isCriticalWarning ? '미등원' : '지각위험'}</div>}
                        </>
                      )}
                      <AnimatePresence>
                        {isActive && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-1" onClick={(e) => e.stopPropagation()}>
                            {!isTimeShiftOpen ? (
                              <div className="flex flex-col gap-1 w-full h-full p-0.5">
                                <div className="grid grid-cols-2 gap-1 flex-1 min-h-0">
                                  <button onClick={() => handleQuickAction(s.id, '출석')} className="flex flex-col items-center justify-center bg-emerald-600/20 border border-emerald-500/20 rounded hover:bg-emerald-600 transition-all group p-1"><Check size={12} className="text-emerald-500 group-hover:text-white" /><span className="text-[7px] font-black uppercase mt-0.5">출석</span></button>
                                  <button onClick={() => handleQuickAction(s.id, '지각')} className="flex flex-col items-center justify-center bg-amber-600/20 border border-amber-500/20 rounded hover:bg-amber-600 transition-all group p-1"><Clock size={12} className="text-amber-500 group-hover:text-white" /><span className="text-[7px] font-black uppercase mt-0.5">지각</span></button>
                                  <button onClick={() => handleQuickAction(s.id, '결석')} className="flex flex-col items-center justify-center bg-red-600/20 border border-red-500/20 rounded hover:bg-red-600 transition-all group p-1"><X size={12} className="text-red-500 group-hover:text-white" /><span className="text-[7px] font-black uppercase mt-0.5">결석</span></button>
                                  <button onClick={() => setIsTimeShiftOpen(true)} className="flex flex-col items-center justify-center bg-blue-600/20 border border-blue-500/20 rounded hover:bg-blue-600 transition-all group p-1"><CalendarClock size={12} className="text-blue-500 group-hover:text-white" /><span className="text-[7px] font-black uppercase mt-0.5">이동</span></button>
                                </div>
                                <button onClick={() => handleQuickAction(s.id, null)} className="py-1 px-2 text-[7px] font-black uppercase text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 rounded shrink-0 transition-colors">상태 초기화 (Reset)</button>
                              </div>
                            ) : (
                              <div className="flex flex-col w-full h-full p-1">
                                <button onClick={() => setIsTimeShiftOpen(false)} className="flex items-center gap-1 text-[7px] font-black text-gray-500 hover:text-white mb-1 uppercase"><ArrowLeft size={6} /> 뒤로</button>
                                <div className="grid grid-cols-4 gap-0.5 overflow-y-auto pr-1 custom-scrollbar-v flex-1">
                                  {[13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(h => (<button key={h} onClick={() => handleTimeShift(s.id, h)} className="py-1 rounded bg-white/5 border border-white/10 text-[8px] font-black hover:bg-blue-600 transition-all">{h >= 12 ? (h === 12 ? '12p' : `${h-12}p`) : `${h}a`}</button>))}
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

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-center gap-6 z-10 shrink-0">
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-gray-600 uppercase tracking-tighter">전체</span><span className="text-xl font-black text-white">{stats.total}</span></div>
        <div className="w-px h-6 bg-white/10" />
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">출석</span><span className="text-xl font-black text-emerald-500">{stats.attended}</span></div>
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">지각</span><span className="text-xl font-black text-amber-500">{stats.late}</span></div>
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">결석</span><span className="text-xl font-black text-red-500">{stats.absent}</span></div>
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter opacity-70">확인 필요</span><span className="text-xl font-black text-amber-500 animate-pulse">{stats.pending}</span></div>
        <div className="flex items-center gap-2"><span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">예정</span><span className="text-xl font-black text-blue-500 opacity-60">{stats.upcoming}</span></div>
      </div>
    </motion.div>
  );
}
