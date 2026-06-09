'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TestAnswerModal from '@/components/dashboard/TestAnswerModal';
import { getInitial } from '@/lib/utils';
import { TextbookOption, ExamSchedule } from '@/types/dashboard';

// 💡 분리된 컴포넌트 임포트
import StudentHeader from '@/components/student/StudentHeader';
import LearningDashboard from '@/components/student/LearningDashboard';
import TextbookSystem from '@/components/student/TextbookSystem';
import TestStatusSection from '@/components/student/TestStatusSection';
import LearningHistoryList from '@/components/student/LearningHistoryList';
import StudentSuggestion from '@/components/student/StudentSuggestion';
import PerformanceChart from '@/components/student/PerformanceChart';

export default function StudentPortal() {
  const router = useRouter();
  const { slug } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [academy, setAcademy] = useState<any>(null); 
  const [todaySession, setTodaySession] = useState<any>(null);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [availableTextbooks, setAvailableTextbooks] = useState<TextbookOption[]>([]);
  const [examSchedules, setExamSchedules] = useState<ExamSchedule[]>([]);
  const [localClasswork, setLocalClasswork] = useState('');
  const [localCompletedClasswork, setLocalCompletedClasswork] = useState(''); // 💡 수행 진도 상태 추가
  const [localHomework, setLocalHomework] = useState('');
  const [todayPlan, setTodayPlan] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [mySuggestions, setMySuggestions] = useState<any[]>([]); // 💡 건의 히스토리 상태 추가
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });

  const matchedExam = useMemo(() => {
    if (!student || !examSchedules.length) return null;
    
    // 💡 [개선] 학원에서 정한 현재 관리 시험 회차 가져오기
    const currentPeriod = academy?.operation_settings?.current_exam_period;
    
    // 💡 학교명 정규화: 공백 제거 및 '학교' 접미사 제거하여 매칭 유연성 확보
    const normalize = (name: string) => (name || '').trim().replace(/\s+/g, '').replace(/학교$/, '');
    
    const studentSchool = normalize(student.school);
    const studentGrade = (student.grade || '').trim();

    if (!studentSchool) return null;

    // 1. 현재 학기(period) 필터링
    const currentPeriodSchedules = currentPeriod 
      ? examSchedules.filter(ex => ex.exam_name === currentPeriod)
      : examSchedules; // 설정이 없으면 전체에서 검색 (하위 호환성)

    // 2. 학교명 + 학년 완벽 일치
    const exactMatch = currentPeriodSchedules.find(ex => 
      normalize(ex.school_name) === studentSchool && 
      (ex.grade?.trim() === studentGrade)
    );
    if (exactMatch) return exactMatch;

    // 3. 학교명 일치 + 전학년 대상 (grade가 없거나 빈 값)
    const schoolMatch = currentPeriodSchedules.find(ex => 
      normalize(ex.school_name) === studentSchool && 
      (!ex.grade || ex.grade.trim() === '')
    );
    
    return schoolMatch || null;
  }, [student, examSchedules, academy?.operation_settings?.current_exam_period]);

  const currentSelfEval = useMemo(() => {
    const match = todaySession?.special_notes?.match(/\[숙제이행: (\d+)단계\]/);
    return match ? parseInt(match[1]) : null;
  }, [todaySession?.special_notes]);

  const lastSession = useMemo(() => {
    if (!allLogs || allLogs.length === 0) return null;
    const sessionsBeforeToday = allLogs.filter(l => l.session_date < selectedDate);
    return sessionsBeforeToday.find(l => !['결석', '수업취소', '수업제외'].includes(l.attendance_status)) || sessionsBeforeToday[0];
  }, [allLogs, selectedDate]);

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

        // 💡 학생 건의 사항 히스토리 가져오기 (최근 30일 이내, 최대 5개)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: suggData } = await supabase.from('ams_tasks')
          .select('*')
          .eq('academy_id', acData.id)
          .eq('title', `[건의] ${stData.name}`)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(5);
        if (suggData) setMySuggestions(suggData);
      }
      const tbRes = await fetch('/api/textbooks');
      const textbooks: TextbookOption[] = tbRes.ok ? await tbRes.json() : [];
      if (tbRes.ok) setAvailableTextbooks(textbooks);

      // 💡 [추가] 교재 코드를 실제 이름으로 변환하는 내부 유틸리티
      const translateBookCodes = (text: string) => {
        if (!text || !textbooks || textbooks.length === 0) return text;
        let result = text;
        const sortedMaster = [...textbooks].sort((a, b) => (b.bookcode?.length || 0) - (a.bookcode?.length || 0));
        sortedMaster.forEach(m => {
          if (m.bookcode && m.title) {
            const escapedCode = m.bookcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedCode, 'gi'); // 💡 'gi' 플래그 적용
            result = result.replace(regex, m.title);
          }
        });
        return result;
      };

      const { data: logs } = await supabase.from('ams_session_logs').select('*').eq('student_id', studentId).order('session_date', { ascending: false }).limit(50);
      
      if (logs) {
        setAllLogs(logs);
        const dayName = ['일', '월', '화', '수', '목', '금', '토'][new Date(selectedDate).getDay()];
        const todayLog = logs.find(l => l.session_date === selectedDate);
        const isTodayClassDay = stData.class_days?.includes(dayName) || todayLog?.attendance_status?.startsWith('보강');
        const pastLogs = logs.filter(l => l.session_date < selectedDate).sort((a, b) => b.session_date.localeCompare(a.session_date));
        const lastValidSession = pastLogs.find(l => !['결석', '수업취소', '수업제외'].includes(l.attendance_status)) || pastLogs[0];
        
        let autoTodayTest = "";
        let autoTodayTestCut = 0; 
        let autoNextTestText = "";
        let autoNextTestCut = 0;
        let autoNextTestTrial = 1;
        
        if (lastValidSession) {
          let isLastTestCompleted = false;
          try { 
            if (lastValidSession.test_result?.startsWith('{')) { 
              const res = JSON.parse(lastValidSession.test_result);
              isLastTestCompleted = res.completed === true; 
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

          setTodaySession({ 
            ...todayLog, 
            test_status: translateBookCodes(todayLog.test_status || autoTodayTest), 
            next_quiz_text: translateBookCodes(nqText || autoNextTestText), 
            next_quiz_cut: nqText ? nqCut : autoNextTestCut, 
            next_quiz_trial: nqText ? nqTrial : autoNextTestTrial, 
            next_quiz_json: nqJson, 
            test_cut: todayLog.test_cut || todayCut || autoTodayTestCut, 
            todo_achievement: todoAchievement 
          });
          
          setTodayPlan(translateBookCodes(todayLog.classwork_text || '')); 
          setLocalCompletedClasswork(translateBookCodes(todayLog.completed_classwork_text || '')); 
          setLocalHomework(translateBookCodes(todayLog.homework_text || ''));
        } else {
          setTodaySession({ 
            session_date: selectedDate, 
            test_status: translateBookCodes(autoTodayTest), 
            next_quiz_text: translateBookCodes(autoNextTestText), 
            next_quiz_cut: autoNextTestCut, 
            next_quiz_trial: autoNextTestTrial, 
            next_quiz_json: [], 
            test_cut: autoTodayTestCut, 
            todo_achievement: 0 
          } as any);
          setLocalCompletedClasswork(''); setTodayPlan(''); setLocalHomework('');
        }
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [selectedDate, slug]);

  useEffect(() => {
    // 💡 URL 파라미터에서 studentId가 있는지 먼저 확인 (선생님이 뷰어로 들어올 때)
    const params = new URLSearchParams(window.location.search);
    const paramStudentId = params.get('id');
    
    if (paramStudentId) {
      fetchAllStudentData(paramStudentId);
      return;
    }

    const studentJson = localStorage.getItem('ams_student');
    if (!studentJson) { router.push(`/${slug}/login`); return; }
    const parsedStudent = JSON.parse(studentJson);
    setStudent(parsedStudent);
    fetchAllStudentData(parsedStudent.id);
  }, [slug, router, fetchAllStudentData]);

  // 💡 실시간 데이터 동기화 (타이머 중단 등 반영)
  useEffect(() => {
    if (!student?.id || !selectedDate) return;

    const channel = supabase
      .channel(`sync_session_${student.id}_${selectedDate}`)
      .on(
        'postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'ams_session_logs', 
          filter: `student_id=eq.${student.id}` 
        }, 
        (payload: any) => {
          const newData = payload.new;
          if (newData && newData.session_date === selectedDate) {
            setTodaySession((prev: any) => ({
              ...prev,
              ...newData
            }));
            
            // 💡 텍스트 필드들도 동기화 (선생님이 수정했을 때 바로 보이도록)
            setTodayPlan(newData.classwork_text || '');
            setLocalCompletedClasswork(newData.completed_classwork_text || '');
            setLocalHomework(newData.homework_text || '');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [student?.id, selectedDate]);

  const handleManualSave = async (field: 'classwork' | 'completed_classwork' | 'homework' | 'special_notes', value: string) => {
    if (!student || !academy) return;
    setIsSaving(true);
    try {
      const dbField = field === 'special_notes' ? field : `${field}_text`;
      let finalValue = value;
      // 💡 분리된 컬럼 사용으로 인해 병합 로직 제거
      const updateData: any = { student_id: student.id, session_date: selectedDate, academy_id: academy.id, [dbField]: finalValue };
      if (todaySession?.id && todaySession.id !== 'temp') { await supabase.from('ams_session_logs').update(updateData).eq('id', todaySession.id); } 
      else { await supabase.from('ams_session_logs').insert([updateData]); }
      if (field === 'special_notes') setTodaySession((prev: any) => ({ ...prev, special_notes: finalValue }));
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleTodoAchievement = async (percentage: number) => {
    if (!student || !academy) return;
    setIsSaving(true);
    try {
      const currentVal = todaySession?.todo_achievement || 0;
      const nextVal = currentVal === percentage ? 0 : percentage; 
      const currentResult = todaySession?.test_result && todaySession.test_result.startsWith('{') ? JSON.parse(todaySession.test_result) : {};
      const newResult = { ...currentResult, todo_achievement: nextVal };
      const updateData: any = { student_id: student.id, session_date: selectedDate, academy_id: academy.id, test_result: JSON.stringify(newResult) };
      if (todaySession?.id && todaySession.id !== 'temp') { await supabase.from('ams_session_logs').update(updateData).eq('id', todaySession.id); } 
      else { await supabase.from('ams_session_logs').insert([updateData]); }
      setTodaySession((prev: any) => ({ ...prev, todo_achievement: nextVal, test_result: JSON.stringify(newResult) }));
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleSelfEval = async (level: number) => {
    if (!student) return;
    const isToggleOff = currentSelfEval === level; 
    const evalText = `[숙제이행: ${level}단계]`;
    let currentNotes = todaySession?.special_notes || '';
    let newNotes = isToggleOff ? currentNotes.replace(/\[숙제이행: \d+단계\]/, '').trim() : currentNotes.includes('[숙제이행:') ? currentNotes.replace(/\[숙제이행: \d+단계\]/, evalText) : (currentNotes ? `${evalText} ${currentNotes}` : evalText);
    await handleManualSave('special_notes', newNotes);
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
      const { data, error } = await supabase.from('ams_tasks').insert([{ 
        academy_id: academy.id, 
        title: `[건의] ${student.name}`, 
        content: suggestion, 
        start_date: selectedDate, 
        target_date: selectedDate, 
        display_period_type: 'custom', 
        is_completed: false, 
        type: 'manual' 
      }]).select();
      if (error) throw error; 
      alert('선생님께 건의사항이 전달되었습니다.'); 
      setSuggestion('');
      if (data) setMySuggestions(prev => [data[0], ...prev].slice(0, 5)); // 💡 리스트 즉시 갱신 (최대 5개)
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

  const handleLogout = () => { localStorage.removeItem('ams_student'); router.push(`/${slug}/login`); };

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
      {/* 💡 헤더 컴포넌트 */}
      <StudentHeader 
        student={student} teachers={teachers} selectedDate={selectedDate} 
        setSelectedDate={setSelectedDate} matchedExam={matchedExam} 
        getRemainingClasses={getRemainingClasses} handleLogout={handleLogout} getInitial={getInitial}
      />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* 왼쪽 섹션: 대시보드 및 교재 시스템 */}
        <div className="w-full lg:w-[60%] border-r border-white/5 bg-[#080808] overflow-y-auto custom-scrollbar-v p-8 xl:p-12 pt-6 xl:pt-8 space-y-12 relative">
          <LearningDashboard 
            student={student} lastSession={lastSession} todaySession={todaySession} 
            selectedDate={selectedDate} currentSelfEval={currentSelfEval} 
            handleSelfEval={handleSelfEval} handleTodoAchievement={handleTodoAchievement} todayPlan={todayPlan}
          />

          <TextbookSystem 
            student={student} availableTextbooks={availableTextbooks} allLogs={allLogs}
            localCompletedClasswork={localCompletedClasswork} setLocalCompletedClasswork={setLocalCompletedClasswork}
            localHomework={localHomework} setLocalHomework={setLocalHomework}
            todayPlan={todayPlan} handleManualSave={handleManualSave} isSaving={isSaving}
          />

          <PerformanceChart logs={allLogs} />
        </div>

        {/* 오른쪽 섹션: 테스트 상태, 히스토리, 건의사항 */}
        <div className="hidden lg:flex w-[40%] bg-[#0a0a0a] flex-col overflow-y-auto custom-scrollbar-v p-8 xl:p-12 space-y-10 relative">
          <TestStatusSection todaySession={todaySession} />
          
          <LearningHistoryList 
            allLogs={allLogs} isHistoryOpen={isHistoryOpen} setIsHistoryOpen={setIsHistoryOpen} 
          />

          <StudentSuggestion 
            suggestion={suggestion} setSuggestion={setSuggestion} 
            selectedDate={selectedDate} handleSuggestionSubmit={handleSuggestionSubmit} isSaving={isSaving}
            mySuggestions={mySuggestions}
          />
        </div>
      </main>

      {/* 테스트 답안 모달 */}
      <AnimatePresence>
        {isTestModalOpen && (
          <TestAnswerModal 
            testId={todaySession?.test_status || ''} studentName={student.name} 
            onClose={() => setIsTestModalOpen(false)} onSave={handleTestSubmit} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
