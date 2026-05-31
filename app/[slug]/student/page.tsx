'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, ClipboardCheck, Bell, User, LogOut, 
  ChevronRight, Loader2, AlertCircle, CheckCircle2, Hash, Clock, TrendingUp, MessageSquare, Target, Zap, RotateCcw, Check, Plus, Minus, ClipboardList, ArrowLeft,
  Calendar as CalendarIcon, FileText, CheckCircle, Send, Circle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TestAnswerModal from '@/components/dashboard/TestAnswerModal';
import { TextbookOption, StudentStatus, SessionLog, ExamSchedule } from '@/types/dashboard';

export default function StudentPortal() {
  const router = useRouter();
  const { slug } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [academy, setAcademy] = useState<any>(null); 
  const [todaySession, setTodaySession] = useState<any>(null);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [availableTextbooks, setAvailableTextbooks] = useState<TextbookOption[]>([]);
  const [examSchedules, setExamSchedules] = useState<ExamSchedule[]>([]);
  const [activeBook, setActiveBook] = useState<any>(null);
  const [activeUnit, setActiveUnit] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [selectionRange, setSelectionRange] = useState<{ start: number | null, end: number | null }>({ start: null, end: null });
  const [suggestion, setSuggestion] = useState('');
  const [localClasswork, setLocalClasswork] = useState('');
  const [localHomework, setLocalHomework] = useState('');
  const [todayPlan, setTodayPlan] = useState('');

  const matchedExam = useMemo(() => {
    if (!student || !examSchedules.length) return null;
    const studentSchool = student.school?.trim();
    const studentGrade = student.grade?.trim();
    const exactMatch = examSchedules.find(ex => ex.school_name.trim() === studentSchool && ex.grade?.trim() === studentGrade);
    if (exactMatch) return exactMatch;
    const schoolMatch = examSchedules.find(ex => ex.school_name.trim() === studentSchool && (!ex.grade || ex.grade.trim() === ''));
    return schoolMatch || null;
  }, [student, examSchedules]);

  const solvedPages = useMemo(() => {
    if (!activeBook || !allLogs) return new Set<number>();
    const pages = new Set<number>();
    allLogs.forEach(log => {
      const classwork = log.classwork_json || [];
      const homework = log.homework_json || [];
      const allJson = [...classwork, ...homework];
      allJson.forEach((h: any) => {
        if (h.book_name === activeBook.bookcode && h.range) {
          const segments = h.range.split(',').map((s: string) => s.trim());
          segments.forEach((seg: string) => {
            const matches = seg.match(/p(\d+)\s*[~-]\s*p?(\d+)/i) || seg.match(/p(\d+)/i);
            if (matches) {
              const s = parseInt(matches[1]); const e = matches[2] ? parseInt(matches[2]) : s;
              if (!isNaN(s) && !isNaN(e)) { for (let i = Math.min(s, e); i <= Math.max(s, e); i++) pages.add(i); }
            }
          });
        }
      });
    });
    return pages;
  }, [activeBook, allLogs]);

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });

  const [teachers, setTeachers] = useState<any[]>([]);

  const getInitial = (name: string) => {
    if (!name) return '?';
    const firstChar = name.charAt(0);
    const mapping: Record<string, string> = {
      '김': 'K', '이': 'L', '박': 'P', '최': 'C', '정': 'J', '강': 'K', '조': 'J', '윤': 'Y', '장': 'J', '임': 'L', '한': 'H', '오': 'O', '서': 'S', '신': 'S', '권': 'K', '황': 'H', '안': 'A', '송': 'S', '전': 'J', '홍:': 'H', '유': 'Y', '고': 'K', '문': 'M', '양': 'Y', '손': 'S', '배': 'B', '백': 'B', '허': 'H', '남': 'N', '심': 'S', '노': 'N', '하': 'H', '곽': 'K', '성': 'S', '차': 'C', '주': 'J', '우': 'W', '구': 'K', '신': 'S', '임': 'L', '나': 'N', '전': 'J', '민': 'M', '송': 'S', '지': 'J'
    };
    return mapping[firstChar] || firstChar.toUpperCase();
  };

  const fetchAllStudentData = useCallback(async (studentId: string) => {
    setIsLoading(true);
    try {
      const normalizedSlug = (Array.isArray(slug) ? slug[0] : slug || '').toLowerCase();
      const { data: acData } = await supabase.from('ams_academies').select('*').eq('slug', normalizedSlug).single();
      if (acData) {
        setAcademy(acData);
        const { data: tData } = await supabase.from('ams_teachers').select('*').eq('academy_id', acData.id);
        if (tData) setTeachers(tData);
      }
      const { data: stData } = await supabase.from('ams_students').select('*').eq('id', studentId).single();
      if (stData) setStudent(stData);
      if (acData) {
        const { data: exData } = await supabase.from('ams_exam_schedules').select('*').eq('academy_id', acData.id).order('target_date', { ascending: true });
        if (exData) setExamSchedules(exData);
      }
      const tbRes = await fetch('/api/textbooks');
      if (tbRes.ok) setAvailableTextbooks(await tbRes.json());
      const { data: logs } = await supabase.from('ams_session_logs').select('*').eq('student_id', studentId).order('session_date', { ascending: false }).limit(50);
      
      if (logs) {
        setAllLogs(logs);
        const dayName = ['일', '월', '화', '수', '목', '금', '토'][new Date(selectedDate).getDay()];
        const todayLog = logs.find(l => l.session_date === selectedDate);
        const isTodayClassDay = stData.class_days?.includes(dayName) || todayLog?.attendance_status?.startsWith('보강');
        const pastLogs = logs.filter(l => l.session_date < selectedDate).sort((a, b) => b.session_date.localeCompare(a.session_date));
        const lastValidSession = pastLogs.find(l => !['결석', '수업취소', '수업제외'].includes(l.attendance_status)) || pastLogs[0];
        
        let autoTodayTest = "";
        let autoTodayTestCut = 0; // 💡 추가
        let autoNextTestText = "";
        let autoNextTestCut = 0;
        let autoNextTestTrial = 1;
        
        if (lastValidSession) {
          let isLastTestCompleted = false;
          try { 
            if (lastValidSession.test_result?.startsWith('{')) { 
              const res = JSON.parse(lastValidSession.test_result);
              isLastTestCompleted = res.completed === true; // 💡 명시적 true만 완료로 인정
            } 
          } catch (e) {}
          const lastPrepObj = (() => {
            try { if (lastValidSession.homework_to?.startsWith('{')) { return JSON.parse(lastValidSession.homework_to); } } catch (e) {}
            return { text: lastValidSession.homework_to || "", cut: 0, trial: 1 };
          })();

          let lastTodayCut = 0;
          try {
            if (lastValidSession.test_result?.startsWith('{')) {
              lastTodayCut = JSON.parse(lastValidSession.test_result).cut || 0;
            }
          } catch (e) {}

          // 💡 원장님 요청: '미완료' 유령 제거. 
          // '다음 계획'이 있다면 무조건 그것을 우선함. 계획이 없을 때만 미완료 시험 재시험을 표시함.
          const activePlanText = lastPrepObj.text || (isLastTestCompleted === false ? (lastValidSession.test_status || "") : "");
          const activePlanCut = lastPrepObj.text ? (lastPrepObj.cut || 0) : (isLastTestCompleted === false ? lastTodayCut : 0);
          const activePlanTrial = lastPrepObj.text ? (lastPrepObj.trial || 1) : 1;

          if (isTodayClassDay) {
            autoTodayTest = activePlanText;
            autoTodayTestCut = activePlanCut;
          } else {
            autoNextTestText = activePlanText;
            autoNextTestCut = activePlanCut;
            autoNextTestTrial = activePlanTrial;
            autoTodayTest = "";
            autoTodayTestCut = 0;
          }
        }
        if (todayLog) {
          let nqText = '', nqCut = 0, nqTrial = 1, nqJson = [];
          try {
            if (todayLog.homework_to && todayLog.homework_to.startsWith('{')) {
              const parsed = JSON.parse(todayLog.homework_to); nqText = parsed.text || ''; nqCut = parsed.cut || 0; nqTrial = parsed.trial || 1; nqJson = parsed.json || [];
            } else if (todayLog.homework_to) { nqText = todayLog.homework_to; }
          } catch (e) {}
          
          let todayCut = 0;
          let todoAchievement = 0;
          try { 
            if (todayLog.test_result?.startsWith('{')) { 
              const res = JSON.parse(todayLog.test_result); 
              todayCut = res.cut || 0; 
              todoAchievement = res.todo_achievement || 0;
            } 
          } catch (e) {}

          const rawCw = todayLog.classwork_text || ''; let plan = rawCw; let work = '';
          if (rawCw.includes('[수행]')) { const parts = rawCw.split('[수행]'); plan = parts[0].replace('[계획]', '').trim(); work = parts[1].trim(); } 
          else if (rawCw.startsWith('[계획]')) { plan = rawCw.replace('[계획]', '').trim(); }
          setTodaySession({ ...todayLog, test_status: todayLog.test_status || autoTodayTest, next_quiz_text: nqText || autoNextTestText, next_quiz_cut: nqText ? nqCut : autoNextTestCut, next_quiz_trial: nqText ? nqTrial : autoNextTestTrial, next_quiz_json: nqJson, test_cut: todayLog.test_cut || todayCut || autoTodayTestCut, todo_achievement: todoAchievement });
          setLocalClasswork(work); setTodayPlan(plan); setLocalHomework(todayLog.homework_text || '');
        } else {
          setTodaySession({ session_date: selectedDate, test_status: autoTodayTest, next_quiz_text: autoNextTestText, next_quiz_cut: autoNextTestCut, next_quiz_trial: autoNextTestTrial, next_quiz_json: [], test_cut: autoTodayTestCut, todo_achievement: 0 } as any);
          setLocalClasswork(''); setTodayPlan(''); setLocalHomework('');
        }
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [selectedDate, slug]);

  const handleTodoAchievement = async (percentage: number) => {
    if (!student || !academy) return;
    setIsSaving(true);
    try {
      const currentVal = todaySession?.todo_achievement || 0;
      const nextVal = currentVal === percentage ? 0 : percentage; // 💡 토글 기능 추가

      const currentResult = todaySession?.test_result && todaySession.test_result.startsWith('{') ? JSON.parse(todaySession.test_result) : {};
      const newResult = { ...currentResult, todo_achievement: nextVal };
      const updateData: any = { student_id: student.id, session_date: selectedDate, academy_id: academy.id, test_result: JSON.stringify(newResult) };
      
      if (todaySession?.id && todaySession.id !== 'temp') { await supabase.from('ams_session_logs').update(updateData).eq('id', todaySession.id); } 
      else { await supabase.from('ams_session_logs').insert([updateData]); }
      
      setTodaySession((prev: any) => ({ ...prev, todo_achievement: nextVal, test_result: JSON.stringify(newResult) }));
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleManualSave = async (field: 'classwork' | 'homework' | 'special_notes', value: string) => {
    if (!student || !academy) return;
    setIsSaving(true);
    try {
      const dbField = field === 'special_notes' ? field : `${field}_text`;
      let finalValue = value;
      if (field === 'classwork') { const planPart = todayPlan ? `[계획]\n${todayPlan}` : ''; const workPart = value ? `\n\n[수행]\n${value}` : ''; finalValue = `${planPart}${workPart}`.trim(); }
      const updateData: any = { student_id: student.id, session_date: selectedDate, academy_id: academy.id, [dbField]: finalValue };
      if (todaySession?.id && todaySession.id !== 'temp') { await supabase.from('ams_session_logs').update(updateData).eq('id', todaySession.id); } 
      else { await supabase.from('ams_session_logs').insert([updateData]); }
      if (field === 'special_notes') setTodaySession((prev: any) => ({ ...prev, special_notes: finalValue }));
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleSelfEval = async (level: number) => {
    if (!student) return;
    const isToggleOff = currentSelfEval === level; // 💡 토글 기능 추가
    const evalText = `[숙제이행: ${level}단계]`;
    let currentNotes = todaySession?.special_notes || '';
    
    let newNotes = "";
    if (isToggleOff) {
      newNotes = currentNotes.replace(/\[숙제이행: \d+단계\]/, '').trim();
    } else {
      newNotes = currentNotes.includes('[숙제이행:') 
        ? currentNotes.replace(/\[숙제이행: \d+단계\]/, evalText) 
        : (currentNotes ? `${evalText} ${currentNotes}` : evalText);
    }
    
    await handleManualSave('special_notes', newNotes);
  };

  const handleToggleHomeworkLine = async (lineIdx: number) => {
    if (!lastSession?.id) return;
    const lines = (lastSession.homework_text || '').split('\n');
    let line = lines[lineIdx];
    lines[lineIdx] = line.startsWith('✅ ') ? line.replace('✅ ', '') : `✅ ${line}`;
    const newText = lines.join('\n');
    setAllLogs(prev => prev.map(log => log.id === lastSession.id ? { ...log, homework_text: newText } : log));
    try { await supabase.from('ams_session_logs').update({ homework_text: newText }).eq('id', lastSession.id); } catch (e) { console.error(e); }
  };

  const fetchUnits = async (bookCode: string) => {
    setIsLoadingUnits(true);
    try {
      const res = await fetch(`/api/textbooks/${bookCode}`);
      if (res.ok) { setUnits(await res.json() || []); }
    } catch (e) { console.error(e); } finally { setIsLoadingUnits(false); }
  };

  useEffect(() => {
    const studentJson = localStorage.getItem('ams_student');
    if (!studentJson) { router.push(`/${slug}/login`); return; }
    const parsedStudent = JSON.parse(studentJson);
    setStudent(parsedStudent);
    fetchAllStudentData(parsedStudent.id);
  }, [slug, router, fetchAllStudentData]);

  const currentSelfEval = useMemo(() => {
    const match = todaySession?.special_notes?.match(/\[숙제이행: (\d+)단계\]/);
    return match ? parseInt(match[1]) : null;
  }, [todaySession?.special_notes]);

  const lastSession = useMemo(() => {
    if (!allLogs || allLogs.length === 0) return null;
    const sessionsBeforeToday = allLogs.filter(l => l.session_date < selectedDate);
    return sessionsBeforeToday.find(l => !['결석', '수업취소', '수업제외'].includes(l.attendance_status)) || sessionsBeforeToday[0];
  }, [allLogs, selectedDate]);

  const handleLogout = () => { localStorage.removeItem('ams_student'); router.push(`/${slug}/login`); };

  const handlePageClick = (p: number) => {
    if (selectionRange.start === null) { setSelectionRange({ start: p, end: null }); setSelectedPages([p]); } 
    else {
      const start = selectionRange.start; const end = p;
      const min = Math.min(start, end); const max = Math.max(start, end);
      const newRange = []; for (let i = min; i <= max; i++) newRange.push(i);
      setSelectedPages(prev => Array.from(new Set([...prev, ...newRange])).sort((a, b) => a - b));
      setSelectionRange({ start: null, end: null });
    }
  };

  const handleRecordLearning = async (type: 'classwork' | 'homework' | 'wrong') => {
    if (selectedPages.length === 0 || !activeBook || !student) return;
    const ranges: string[] = []; let start = selectedPages[0];
    for (let i = 1; i <= selectedPages.length; i++) { if (selectedPages[i] !== selectedPages[i - 1] + 1) { const end = selectedPages[i - 1]; ranges.push(start === end ? `p${start}` : `p${start}~${end}`); start = selectedPages[i]; } }
    const rangeText = ranges.join(', ');
    const fullText = `${type === 'wrong' ? '[오답] ' : ''}${activeBook.title} ${rangeText}`;
    const targetField = type === 'homework' ? 'homework' : 'classwork';
    const currentText = targetField === 'homework' ? localHomework : localClasswork;
    const newText = currentText ? `${currentText}\n${fullText}` : fullText;
    if (targetField === 'homework') setLocalHomework(newText); else setLocalClasswork(newText);
    await handleManualSave(targetField, newText);
    setSelectedPages([]);
  };

  const handleTestSubmit = async (result: any) => {
    if (!student || isSaving) return;
    setIsSaving(true);
    try {
      const { answers, calculatedScore, testId } = result;
      const updateData: any = { student_id: student.id, session_date: selectedDate, test_answers: answers, test_status: testId || todaySession?.test_status };
      if (calculatedScore !== undefined) updateData.test_score = calculatedScore;
      if (todaySession?.id && todaySession.id !== 'temp') { await supabase.from('ams_session_logs').update(updateData).eq('id', todaySession.id); } 
      else { await supabase.from('ams_session_logs').insert([updateData]); }
      alert('테스트 답안이 제출되었습니다.'); setIsTestModalOpen(false); fetchAllStudentData(student.id);
    } catch (e) { console.error(e); alert('제출 중 오류 발생'); } finally { setIsSaving(false); }
  };

  const handleSuggestionSubmit = async () => {
    if (!suggestion.trim() || !student || !academy) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('ams_tasks').insert([{ academy_id: academy.id, title: `[건의] ${student.name}`, content: suggestion, start_date: selectedDate, target_date: selectedDate, display_period_type: 'custom', is_completed: false, type: 'manual' }]);
      if (error) throw error; alert('선생님께 건의사항이 전달되었습니다.'); setSuggestion('');
    } catch (e) { console.error(e); alert('전송 중 오류가 발생했습니다.'); } finally { setIsSaving(false); }
  };

  const getRemainingClasses = useCallback((targetDate: string) => {
    if (!targetDate || !student?.class_days) return null;
    const today = new Date(selectedDate); const exam = new Date(targetDate);
    if (exam <= today) return 0;
    let count = 0; const current = new Date(today); current.setDate(current.getDate() + 1);
    while (current < exam) {
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][current.getDay()];
      if (student.class_days.includes(dayName)) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }, [student?.class_days, selectedDate]);

  if (isLoading || !student) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-gray-500">
        <Loader2 className="animate-spin mb-4" size={32} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Syncing Student Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] font-sans flex flex-col overflow-hidden text-center">
      <header className="px-8 py-4 flex items-center justify-between bg-[#0a0a0a] border-b border-white/5 shrink-0 z-20 shadow-xl">
        <div className="flex items-center gap-6 flex-1">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[4px] flex items-center justify-center shadow-lg shadow-blue-900/40 border border-blue-500/30"><User className="text-white" size={24} /></div>
          <div className="min-w-0 text-left">
            <div className="flex items-center mb-1 gap-10">
              <div className="flex items-center gap-4">
                {(() => {
                  const teacher = teachers.find(t => t.id === student.teacher_id);
                  const initial = teacher ? getInitial(teacher.name) : '?';
                  const days = student.class_days?.join('') || '무';
                  const rawClass = student.class_name || '일반반';
                  const simplifiedClass = rawClass.split('-')[0].trim(); // 💡 '삼산-Y' -> '삼산'

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
                <div className={`flex items-center gap-3 border px-4 py-2 rounded-lg shadow-lg transition-all shrink-0 ${matchedExam ? 'bg-rose-600/10 border-rose-500/30' : 'bg-white/5 border-white/20'}`}>
                  <FileText className={matchedExam ? 'text-rose-500' : 'text-gray-500'} size={18} />
                  <div className="text-right min-w-[110px]">
                    {matchedExam ? (<><p className="text-[15px] font-black text-white leading-none tracking-tight">{new Date(matchedExam.target_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}<span className="text-rose-400 ml-1.5 uppercase text-[9px] tracking-widest font-black">Exam</span></p><p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.15em] mt-1">{getRemainingClasses(matchedExam.target_date)} Classes Left</p></>) : (<><p className="text-[12px] font-black text-gray-500 leading-none uppercase tracking-widest">No Exam Set</p><p className="text-[9px] font-bold text-gray-600 mt-1 uppercase">시험 일정 없음</p></>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 rounded-[4px] bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all font-black uppercase tracking-widest text-[10px] border border-transparent hover:border-red-500/20"><LogOut size={16} /> Log Out</button>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-[60%] border-r border-white/5 bg-[#080808] overflow-y-auto custom-scrollbar-v p-8 xl:p-12 pt-6 xl:pt-8 space-y-12 relative">
          <div className="space-y-8">
            {student?.recent_mission ? (
              <motion.div key="active-mission" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gradient-to-r from-amber-400/50 to-orange-500/50 p-0.5 rounded-xl mb-2 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                <div className="bg-[#0a0a0a] rounded-[10px] p-6 flex items-center gap-6 border border-amber-400/10">
                  <div className="w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-amber-900/40 border border-amber-300/50"><Zap className="text-black fill-black" size={28} strokeWidth={3} /></div>
                  <div className="text-left"><p className="text-[22px] font-black text-white leading-tight tracking-tight drop-shadow-sm">{student.recent_mission}</p><p className="text-[11px] font-bold text-amber-400 mt-2.5 flex items-center gap-1.5"><CheckCircle2 size={12} /> 최근에 이거 꼭 해야 해! 집중해서 완료하자.</p></div>
                </div>
              </motion.div>
            ) : (
              <div className="relative py-2 group"><div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-amber-500"></div></div><div className="relative flex justify-center"><span className="bg-[#080808] px-6 text-[12px] font-black text-amber-500 uppercase tracking-[0.4em] border-2 border-amber-500 rounded-full py-1">학생미션</span></div></div>
            )}

            {lastSession ? (
              <div className="bg-blue-600/5 border border-blue-500/20 rounded-lg shadow-xl text-left border-l-4 border-l-blue-500 flex flex-col overflow-hidden">
                <div className="px-6 py-1 bg-white/[0.03] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5"><ClipboardCheck className="text-blue-500" size={14} /><h4 className="text-[11px] font-black text-white uppercase tracking-widest">과제확인</h4></div>
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-400 tabular-nums"><span>({lastSession.session_date.slice(5).replace('-', '.')})</span><ChevronRight size={10} className="text-blue-500/50" /><span className="bg-blue-500/10 px-1.5 py-0.5 rounded text-blue-300">({selectedDate.slice(5).replace('-', '.')})</span></div>
                  </div>
                  <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <button 
                        key={num} 
                        onClick={() => handleSelfEval(num)} 
                        className={`w-7 h-7 shrink-0 rounded-[2px] text-[13px] font-black transition-all border ${
                          (currentSelfEval !== null && num <= currentSelfEval) 
                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg' 
                            : 'bg-white/10 border-white/20 text-white hover:border-blue-500/50'
                        }`}
                      >
                        {currentSelfEval === null ? num : (num === currentSelfEval ? num : '')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-[18px] font-bold text-blue-200 leading-tight italic whitespace-pre-wrap">
                    <span className="text-blue-400 text-2xl font-black mr-1 opacity-80">"</span>
                    {lastSession.homework_text || '기록된 숙제가 없습니다.'}
                    <span className="text-blue-400 text-2xl font-black ml-1 opacity-80">"</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative py-2 group"><div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-blue-500"></div></div><div className="relative flex justify-center"><span className="bg-[#080808] px-6 text-[12px] font-black text-blue-500 uppercase tracking-[0.4em] border-2 border-blue-500 rounded-full py-1">과제확인</span></div></div>
            )}

            <div className="bg-emerald-600/5 border border-emerald-500/20 rounded-lg shadow-xl text-left border-l-4 border-l-emerald-500 flex flex-col overflow-hidden">
              <div className="px-6 py-1 bg-white/[0.03] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-emerald-500" size={16} />
                  <h4 className="text-[12px] font-black text-white uppercase tracking-widest">오늘 할 일 (To-Do)</h4>
                </div>
                <div className="flex-1 flex items-center justify-end gap-0.5 overflow-x-auto no-scrollbar pr-2">
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(num => (
                    <button 
                      key={num} 
                      onClick={() => handleTodoAchievement(num)} 
                      className={`w-7 h-7 shrink-0 rounded-[2px] text-[13px] font-black transition-all border ${
                        (todaySession?.todo_achievement && num <= todaySession.todo_achievement) 
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' 
                          : 'bg-white/10 border-white/20 text-white hover:border-emerald-500/50'
                      }`}
                    >
                      {(!todaySession?.todo_achievement) ? num : (num === todaySession?.todo_achievement ? num : '')}
                    </button>
                  ))}
                  <span className="text-[11px] font-black text-emerald-500/60 ml-1">%</span>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {todayPlan ? (
                  todayPlan.split('\n').filter(l => l.trim()).map((task, i) => (
                    <div key={i} className="flex items-start gap-3 group/task">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] group-hover/task:scale-125 transition-transform" />
                      <p className="text-[16px] font-bold text-white leading-snug">{task}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center opacity-30">
                    <CheckCircle2 size={24} className="text-emerald-500 mb-2" />
                    <p className="text-[12px] font-bold text-white italic">
                      {new Date(selectedDate) < new Date(new Date().setHours(0,0,0,0)) 
                        ? '이 날짜에는 기록된 학습 정보가 없습니다.' 
                        : '선생님이 계획을 입력 중입니다...'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar py-3 px-6 bg-white/[0.03] border-b border-white/5 shrink-0">
                {(student.assigned_books || []).filter((code: string) => {
                  const bookCourse = student.book_courses?.[code];
                  return !String(bookCourse).endsWith('-keep');
                }).map((code: string) => {
                  const book = availableTextbooks.find(b => b.bookcode === code);
                  if (!book) return null;
                  const isActive = activeBook?.bookcode === code;
                  return (
                    <motion.button key={code} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { if (activeBook?.bookcode === code) { setActiveBook(null); setActiveUnit(null); } else { setActiveBook(book); fetchUnits(code); setActiveUnit(null); } }} className={`flex items-center gap-2 border rounded-[4px] px-3 py-1.5 transition-all shrink-0 ${isActive ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-white/10 border-white/20 text-white hover:border-emerald-500/50 hover:bg-emerald-500/10'}`}><BookOpen size={12} className={isActive ? 'text-white' : 'text-emerald-500'} /><span className="text-[11px] font-black whitespace-nowrap">{book.title}</span></motion.button>
                  );
                })}
              </div>
              <div className="relative flex-1 min-h-[260px] overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-white/5 bg-black/20">
                  <div className="p-6 space-y-4 flex flex-col min-h-[300px]"><div className="flex items-center gap-2 px-1"><TrendingUp className="text-emerald-500" size={16} /><span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Today's Progress</span></div><textarea value={localClasswork} onChange={(e) => setLocalClasswork(e.target.value)} onBlur={() => handleManualSave('classwork', localClasswork)} placeholder="오늘 공부한 내용을 적어주세요. 위의 교재를 선택하면 자동으로 입력됩니다." rows={Math.max(10, localClasswork.split('\n').length)} className="w-full bg-transparent border-0 outline-none text-sm text-white font-bold leading-relaxed resize-none scrollbar-hide placeholder:text-white/10" /><div className="flex justify-between items-center pt-2 border-t border-white/[0.03] mt-auto"><span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Auto-sync Active</span>{isSaving && <Loader2 size={10} className="animate-spin text-emerald-500" />}</div></div>
                  <div className="p-6 space-y-4 flex flex-col min-h-[300px]"><div className="flex items-center gap-2 px-1"><ClipboardList className="text-blue-500" size={16} /><span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Assigned Homework</span></div><textarea value={localHomework} onChange={(e) => setLocalHomework(e.target.value)} onBlur={() => handleManualSave('homework', localHomework)} placeholder="다음 수업까지의 숙제를 적어주세요." rows={Math.max(10, localHomework.split('\n').length)} className="w-full bg-transparent border-0 outline-none text-sm text-white font-bold leading-relaxed resize-none scrollbar-hide placeholder:text-white/10" /><div className="flex justify-between items-center pt-2 border-t border-white/[0.03] mt-auto"><span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Real-time Cloud Sync</span>{isSaving && <Loader2 size={10} className="animate-spin text-blue-500" />}</div></div>
                </div>
                <AnimatePresence>
                  {activeBook && (
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="absolute inset-0 z-40 bg-[#0a0a0a] border-l border-emerald-500/20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
                      <div className="p-6 space-y-6 flex-1 flex flex-col overflow-y-auto custom-scrollbar-v">
                        {!activeUnit ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {units.map((u, i) => (<button key={i} onClick={() => setActiveUnit(u)} className="w-full flex items-center justify-between p-3.5 bg-white/[0.05] border border-white/10 rounded-md hover:bg-emerald-600/20 hover:border-emerald-500 transition-all group"><span className="text-[14px] font-black text-white group-hover:text-white">{u.unit}</span><span className="text-[11px] font-black text-emerald-400 tabular-nums bg-emerald-500/10 px-2 py-0.5 rounded">p{u.start_page}~{u.end_page}</span></button>))}
                          </div>
                        ) : (
                          <div className="space-y-6 flex-1 flex flex-col">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3"><button onClick={() => setActiveUnit(null)} className="p-1.5 bg-white/10 rounded-full text-white hover:bg-emerald-500 transition-all shadow-lg border border-white/10"><ArrowLeft size={14}/></button><div className="text-left"><h3 className="text-[15px] font-black text-white">{activeUnit.unit}</h3><p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{activeBook.title}</p></div></div>
                              <button onClick={() => setSelectedPages([])} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-[11px] font-black rounded uppercase border border-white/10">Clear All</button>
                            </div>
                            <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                              {(() => {
                                const start = parseInt(activeUnit.start_page); const end = parseInt(activeUnit.end_page);
                                const pages = []; for (let i = start; i <= end; i++) pages.push(i);
                                return pages.map(p => {
                                  const isSel = selectedPages.includes(p); const isSol = solvedPages.has(p);
                                  return (<button key={p} onClick={() => handlePageClick(p)} className={`aspect-square rounded-md flex items-center justify-center text-[12px] font-black tabular-nums transition-all border relative ${isSel ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)] scale-105' : isSol ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500' : 'bg-white/10 border-white/20 text-white hover:bg-emerald-500/30'}`}>{p}{isSol && !isSel && <div className="absolute top-0.5 right-0.5 opacity-50"><Check size={7} strokeWidth={4} /></div>}</button>);
                                });
                              })()}
                            </div>
                            <div className="pt-4 border-t border-white/10 flex flex-col gap-3 mt-auto">
                              <div className="p-3 bg-white/10 rounded-md border border-white/10"><span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 block">Selected Pages</span><p className="text-[15px] font-black text-white truncate">{selectedPages.length > 0 ? (() => { const ranges: string[] = []; let s = selectedPages[0]; for (let i = 1; i <= selectedPages.length; i++) { if (selectedPages[i] !== selectedPages[i - 1] + 1) { const e = selectedPages[i - 1]; ranges.push(s === e ? `${s}` : `${s}~${e}`); s = selectedPages[i]; } } return `p${ranges.join(', p')}`; })() : '페이지를 선택하세요'}</p></div>
                              <div className="flex gap-2">
                                <button onClick={() => handleRecordLearning('classwork')} disabled={selectedPages.length === 0 || isSaving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-black rounded-md transition-all text-[10px] uppercase shadow-lg shadow-emerald-900/20">+ 진도 추가</button>
                                <button onClick={() => handleRecordLearning('wrong')} disabled={selectedPages.length === 0 || isSaving} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-white font-black rounded-md transition-all text-[10px] uppercase shadow-lg shadow-amber-900/20">+ 오답 추가</button>
                                <button onClick={() => handleRecordLearning('homework')} disabled={selectedPages.length === 0 || isSaving} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-black rounded-md transition-all text-[10px] uppercase shadow-lg shadow-blue-900/20">+ 숙제 추가</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          <GradeGraph logs={allLogs} />
        </div>

        <div className="hidden lg:flex w-[40%] bg-[#0a0a0a] flex-col overflow-y-auto custom-scrollbar-v p-8 xl:p-12 space-y-10 relative">
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1"><FileText size={14} className="text-rose-500" /><h3 className="text-[11px] font-black uppercase tracking-widest text-white">오늘TEST</h3></div>
            {todaySession?.test_status ? (
              <div className="bg-rose-600/10 border border-rose-500/30 p-3 rounded-md shadow-lg text-left border-l-4 border-l-rose-500">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-black text-white leading-tight">{todaySession.test_status}</p>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {todaySession?.test_score !== null && <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded">완료</span>}
                      {todaySession?.test_score !== null && (<p className="text-[10px] font-black text-rose-400 whitespace-nowrap">{todaySession.test_score}%</p>)}
                    </div>
                  </div>
                  {todaySession?.test_cut > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-white bg-rose-600 px-2 py-0.5 rounded shadow-sm flex items-center gap-1.5">
                        커트라인: <span className="text-amber-400">{todaySession.test_cut}</span>개 이하
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative py-1 group"><div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-rose-500/30"></div></div><div className="relative flex justify-center"><span className="bg-[#0a0a0a] px-4 text-[11px] font-black text-rose-500 uppercase tracking-widest border border-rose-500/20 rounded-full">없음</span></div></div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1"><Target size={14} className="text-indigo-500" /><h3 className="text-[11px] font-black uppercase tracking-widest text-white">다음TEST</h3></div>
            {todaySession?.next_quiz_text ? (
              <div className="bg-indigo-600/10 border border-indigo-500/30 p-3 rounded-md shadow-lg text-left border-l-4 border-l-indigo-500">
                <div className="flex flex-col gap-2">
                  <p className="text-[14px] font-black text-white leading-tight whitespace-pre-wrap">{todaySession.next_quiz_text}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black text-white bg-indigo-600 px-2 py-0.5 rounded shadow-sm flex items-center gap-1.5">커트라인: <span className="text-amber-400">{todaySession.next_quiz_cut}</span>개 이하</span>
                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{todaySession.next_quiz_trial}차</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative py-1 group"><div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-indigo-500/30"></div></div><div className="relative flex justify-center"><span className="bg-[#0a0a0a] px-4 text-[11px] font-black text-indigo-500 uppercase tracking-widest border border-indigo-500/20 rounded-full">없음</span></div></div>
            )}
          </div>
          <div className="space-y-6">
            <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="w-full flex items-center justify-between px-1 group cursor-pointer border-t border-white/5 pt-6"><h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2"><Clock size={16} className={isHistoryOpen ? 'text-blue-500' : 'text-gray-400'} /> Learning History</h3><motion.div animate={{ rotate: isHistoryOpen ? 180 : 0 }} transition={{ duration: 0.2 }}><Plus size={16} className={isHistoryOpen ? 'text-blue-500' : 'text-white'} /></motion.div></button>
            <AnimatePresence>{isHistoryOpen && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="relative pl-6 space-y-8 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-white/20 text-left max-h-[600px] overflow-y-auto pr-2 custom-scrollbar-v">{allLogs.length === 0 ? <p className="text-xs text-white italic px-4 font-bold text-left">학습 기록을 불러오고 있습니다...</p> : allLogs.map((log, i) => (<div key={i} className="relative pl-8 text-left"><div className={`absolute left-[-22px] top-1.5 w-3 h-3 rounded-full border-[3px] border-[#0a0a0a] ${i === 0 ? 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]' : 'bg-gray-700'}`} /><div className="bg-[#121212] border border-white/10 p-6 rounded-[4px] space-y-5 hover:border-white/30 transition-colors shadow-sm"><div className="flex items-center justify-between border-b border-white/10 pb-2.5"><p className="text-[11px] font-black text-white uppercase tracking-widest">{log.session_date.replace(/-/g, '.')}</p>{log.test_score !== null && log.test_score !== undefined && <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-[2px] border border-blue-500/30">Score: {log.test_score}%</span>}</div><div className="space-y-4"><div><h4 className="text-[10px] font-black text-emerald-500 uppercase mb-1.5 flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-emerald-500" /> Classwork</h4>{(() => { const text = log.classwork_text || ''; if (text.includes('[수행]')) { const parts = text.split('[수행]'); const plan = parts[0].replace('[계획]', '').trim(); const work = parts[1].trim(); return (<div className="space-y-2">{plan && <p className="text-[12px] font-medium text-emerald-400/80 leading-relaxed italic border-l border-emerald-500/20 pl-2">Goal: {plan}</p>}{work && <p className="text-[13px] font-bold text-white leading-relaxed whitespace-pre-wrap">{work}</p>}</div>); } return <p className="text-[13px] font-bold text-white leading-relaxed whitespace-pre-wrap">{text.replace('[계획]', '').trim() || '-'}</p>; })()}</div><div><h4 className="text-[10px] font-black text-blue-500 uppercase mb-1.5 flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-blue-500" /> Homework</h4><p className="text-[13px] font-bold text-white leading-relaxed whitespace-pre-wrap">{log.homework_text || '-'}</p></div></div></div></div>))}</div></motion.div>)}</AnimatePresence>
          </div>
          <div className="space-y-6 pt-6 border-t border-white/10">
            <div className="flex items-center gap-2 px-1"><MessageSquare size={16} className="text-amber-500" /><h3 className="text-[11px] font-black uppercase tracking-widest text-white">선생님께 건의사항</h3></div>
            <div className="relative group"><textarea value={suggestion} onChange={(e) => setSuggestion(e.target.value)} placeholder="선생님께 하고 싶은 말이나 건의사항을 적어주세요." className="w-full bg-[#121212] border border-white/15 rounded-lg p-5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-amber-500 transition-all resize-none min-h-[120px]" /><div className="absolute bottom-4 right-4 flex items-center gap-3"><span className="text-[10px] font-bold text-white uppercase tracking-widest">{selectedDate.replace(/-/g, '.')}</span><button onClick={handleSuggestionSubmit} disabled={!suggestion.trim() || isSaving} className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-20 text-white text-[11px] font-black rounded uppercase tracking-widest transition-all shadow-lg shadow-amber-900/20 flex items-center gap-2">{isSaving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} 전송하기</button></div></div>
            <p className="text-[10px] text-white/60 font-medium px-1">작성하신 내용은 선생님의 대시보드에 즉시 알림으로 전달됩니다.</p>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {isTestModalOpen && (
          <TestAnswerModal testId={todaySession?.test_status || ''} studentName={student.name} onClose={() => setIsTestModalOpen(false)} onSave={handleTestSubmit} />
        )}
      </AnimatePresence>
    </div>
  );
}

function GradeGraph({ logs }: { logs: any[] }) {
  const chartData = useMemo(() => {
    return logs.filter(l => l.test_score !== null && l.test_score !== undefined).slice(0, 10).reverse();
  }, [logs]);
  if (chartData.length < 2) return null;
  return (
    <div className="bg-[#121212] border border-white/5 p-10 rounded-[4px] space-y-8 shadow-inner text-left mt-8">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={16} className="text-blue-500" /> Performance Trend</h4>
        <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-[2px] border border-blue-500/20">Last 10 Tests</span>
      </div>
      <div className="h-44 flex items-end justify-between gap-3 px-2 pt-8 relative text-center">
        <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none opacity-20 z-0">
          <div className="border-t border-dashed border-white/30 w-full relative"><span className="absolute -top-3 -left-5 text-[9px] font-black text-white">100</span></div>
          <div className="border-t border-dashed border-white/10 w-full" />
          <div className="border-t border-dashed border-white/20 w-full relative"><span className="absolute -top-3 -left-4 text-[9px] font-black text-amber-500">60</span></div>
          <div className="border-t border-solid border-white/30 w-full" />
        </div>
        {chartData.map((data, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative z-10">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[11px] font-black px-2.5 py-1.5 rounded-[2px] opacity-0 group-hover:opacity-100 transition-all z-20 whitespace-nowrap shadow-2xl scale-75 group-hover:scale-100 origin-bottom">{data.test_score}%</div>
            <div className="w-full max-w-[28px] bg-white/5 rounded-t-[2px] relative flex items-end h-[140px] overflow-hidden group-hover:bg-white/10 transition-colors">
              <motion.div initial={{ height: 0 }} animate={{ height: `${Math.min(100, Math.max(0, data.test_score))}%` }} transition={{ delay: i * 0.05, duration: 1, ease: [0.33, 1, 0.68, 1] }} className={`w-full rounded-t-[1px] ${data.test_score >= 80 ? 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : data.test_score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} />
            </div>
            <span className="text-[9px] font-black text-gray-500 rotate-45 origin-left whitespace-nowrap ml-2 mt-1 group-hover:text-white transition-colors">{data.session_date.slice(5).replace('-', '.')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
