'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BookOpen, TrendingUp, MessageSquare, Globe, ExternalLink, FileText, Lock, Check, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TestAnswerModal from '@/components/dashboard/TestAnswerModal';
import { getInitial } from '@/lib/utils';
import { TextbookOption, ExamSchedule } from '@/types/dashboard';

// 💡 분리된 컴포넌트 임포트
import StudentHeader from '@/components/student/StudentHeader';
import LearningDashboard from '@/components/student/LearningDashboard';
import TextbookSystem from '@/components/student/TextbookSystem';
import SurveyList from '@/components/student/SurveyList';
import TestStatusSection from '@/components/student/TestStatusSection';
import LearningHistoryList from '@/components/student/LearningHistoryList';
import StudentSuggestion from '@/components/student/StudentSuggestion';
import PerformanceChart from '@/components/student/PerformanceChart';

export default function StudentPortal() {
  const router = useRouter();
  const { slug } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [academy, setAcademy] = useState<any>(null); 
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [todaySession, setTodaySession] = useState<any>(null);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDashboardSlim, setIsDashboardSlim] = useState(false); // 💡 대시보드 접기 상태를 전역으로 관리
  const [activeTab, setActiveTab] = useState<'study' | 'history' | 'suggestion'>('study'); // 💡 모바일 탭 상태 추가
  
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

    // 1. 현재 학기(period) 필터링 및 과거 시험 제외 (다가오는 시험만)
    const upcomingSchedules = examSchedules.filter(ex => ex.target_date >= selectedDate);
    const currentPeriodSchedules = currentPeriod 
      ? upcomingSchedules.filter(ex => ex.exam_name === currentPeriod)
      : upcomingSchedules; // 설정이 없으면 전체에서 검색 (하위 호환성)

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
  }, [student, examSchedules, academy?.operation_settings?.current_exam_period, selectedDate]);

  const currentSelfEval = useMemo(() => {
    const match = todaySession?.special_notes?.match(/\[숙제이행: (\d+)단계\]/);
    if (match) return parseInt(match[1]);

    const studentTeacher = teachers?.find(t => t.id === student?.teacher_id);
    const presets = studentTeacher?.homework_presets || { 'perfect': '숙제를 아주 완벽하게 잘 해왔습니다. *^^*', 'good': '숙제를 잘 수행했습니다.', 'neutral': '숙제 수행이 보통입니다.', 'poor': '숙제가 미흡한 부분이 있습니다.', 'bad': '숙제를 거의 해오지 않았습니다.' };
    const notes = todaySession?.special_notes || '';
    if (presets.perfect && notes.includes(presets.perfect)) return 10;
    if (presets.good && notes.includes(presets.good)) return 8;
    if (presets.neutral && notes.includes(presets.neutral)) return 6;
    if (presets.poor && notes.includes(presets.poor)) return 4;
    if (presets.bad && notes.includes(presets.bad)) return 2;
    return null;
  }, [todaySession?.special_notes, teachers, student?.teacher_id]);

  const lastSession = useMemo(() => {
    if (!allLogs || allLogs.length === 0) return null;
    const pastLogs = allLogs.filter(l => l.session_date < selectedDate).sort((a, b) => b.session_date.localeCompare(a.session_date));
    
    let aggregatedHw = "";
    for (const log of pastLogs) {
      if (log.homework_text) {
        const dateStr = log.session_date ? log.session_date.slice(5).replace('-', '.') : '';
        const dayName = ['일', '월', '화', '수', '목', '금', '토'][new Date(log.session_date).getDay()];
        let hText = log.homework_text;
        availableTextbooks.forEach(tb => { hText = hText.split(`[${tb.id}]`).join(tb.title); });
        const line = `${dateStr}(${dayName})\n${hText}`;
        aggregatedHw = aggregatedHw ? `${line}\n\n${aggregatedHw}` : line;
      }

      const isLogHoliday = (academy?.operation_settings?.holidays || []).some((h: any) => h.date === log.session_date);
      if (isLogHoliday && !log.attendance_status?.startsWith('보강')) continue;
      if (!log.attendance_status || log.attendance_status === '수업전') continue;
      if (['결석', '수업취소', '수업제외'].includes(log.attendance_status)) continue;

      let hwPassedToday = false;
      let hwCheckedToday = false;
      try {
        if (log.test_result?.startsWith('{')) {
          const res = JSON.parse(log.test_result);
          hwPassedToday = res.hw_passed_today === true;
          hwCheckedToday = res.hw_checked_today === true;
        }
      } catch (e) {}

      if (hwPassedToday) continue;

      const dayName = ['일', '월', '화', '수', '목', '금', '토'][new Date(log.session_date).getDay()];
      const isRegularClass = student?.class_days?.includes(dayName);
      const isPresent = ['출석', '지각'].some(st => log.attendance_status?.startsWith(st));

      if (hwCheckedToday || (isPresent && isRegularClass)) break;
    }

    const baseSession = pastLogs.find(l => {
      const isLogHoliday = (academy?.operation_settings?.holidays || []).some((h: any) => h.date === l.session_date);
      const isMakeup = l.attendance_status?.startsWith('보강');
      return (l.homework_to || l.test_status || l.classwork_text || l.homework_text) && 
             !['결석', '수업취소', '수업제외'].includes(l.attendance_status) && (!isLogHoliday || isMakeup); 
    }) || pastLogs.find(l => !['결석', '수업취소', '수업제외'].includes(l.attendance_status)) || pastLogs[0];
    
    return baseSession ? { ...baseSession, homework_text: aggregatedHw } : (aggregatedHw ? { id: 'temp', session_date: selectedDate, homework_text: aggregatedHw } : null);
  }, [allLogs, selectedDate, academy, student, availableTextbooks]);

  const upcomingMakeups = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return allLogs
      .filter(l => l.session_date >= todayStr && l.attendance_status === '보강')
      .sort((a, b) => a.session_date.localeCompare(b.session_date));
  }, [allLogs]);

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

  const handleApprovalSubmit = async (status: 'none' | 'submitted') => {
    if (!student) { alert("학생 정보를 불러오지 못했습니다."); return; }
    if (!academy) { alert("학원 정보를 불러오지 못했습니다."); return; }
    
    setIsSaving(true);
    try {
      const updateData: any = { student_id: student.id, session_date: selectedDate, academy_id: academy.id, approval_status: status };
      if (todaySession?.id && todaySession.id !== 'temp') { 
        const { error } = await supabase.from('ams_session_logs').update(updateData).eq('id', todaySession.id); 
        if (error) throw error;
      } else { 
        const { error } = await supabase.from('ams_session_logs').insert([updateData]); 
        if (error) throw error;
      }
      setTodaySession((prev: any) => ({ ...prev, approval_status: status }));
    } catch (e: any) { 
      console.error(e); 
      alert("제출 처리 중 오류가 발생했습니다: " + (e.message || "알 수 없는 오류"));
    } finally { 
      setIsSaving(false); 
      setConfirmSubmitOpen(false);
    }
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
        created_by: student.teacher_id || '',
        type: 'manual' 
      }]).select();
      if (error) throw error; 
      alert('선생님께 건의사항이 전달되었습니다.'); 
      setSuggestion('');
      if (data) setMySuggestions(prev => [data[0], ...prev].slice(0, 5)); // 💡 리스트 즉시 갱신 (최대 5개)
    } catch (e) { console.error(e); alert('전송 중 오류가 발생했습니다.'); } finally { setIsSaving(false); }
  };

  const handleSyncTasks = async (checkedTasks: string[], uncheckedTasks: string[]) => {
    if (!student || !academy) return;
    
    let currentClasswork = localCompletedClasswork;
    
    // 제거할 태스크 삭제
    uncheckedTasks.forEach(task => {
      currentClasswork = currentClasswork.split('\n').filter(line => line.trim() !== task).join('\n');
    });
    
    // 추가할 태스크 넣기 (중복 방지)
    checkedTasks.forEach(task => {
      if (!currentClasswork.split('\n').map(l => l.trim()).includes(task)) {
        currentClasswork = currentClasswork ? `${currentClasswork}\n${task}` : task;
      }
    });

    if (currentClasswork !== localCompletedClasswork) {
      setLocalCompletedClasswork(currentClasswork);
      await handleManualSave('completed_classwork', currentClasswork);
    }
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

  const approvalStatus = todaySession?.approval_status || 'none';

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] font-sans flex flex-col overflow-hidden text-center">
      {/* 💡 헤더 컴포넌트 */}
      <StudentHeader 
        student={student} teachers={teachers} selectedDate={selectedDate} 
        setSelectedDate={setSelectedDate} matchedExam={matchedExam} 
        getRemainingClasses={getRemainingClasses} handleLogout={handleLogout} getInitial={getInitial}
        academy={academy}
      />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden pb-[64px] lg:pb-0">
        {/* 왼쪽 섹션: 대시보드 및 교재 시스템 */}
        <div className={`w-full lg:w-[60%] border-r border-white/5 bg-[#080808] overflow-y-auto custom-scrollbar-v p-3 md:p-6 xl:p-8 pt-2 md:pt-4 xl:pt-4 relative lg:block ${activeTab === 'study' || activeTab === 'history' ? 'block' : 'hidden lg:block'}`}>
          <div className={activeTab === 'study' ? 'block space-y-4 md:space-y-8' : 'hidden lg:block lg:space-y-8'}>
            <LearningDashboard 
              student={student} lastSession={lastSession} todaySession={todaySession} 
              selectedDate={selectedDate} currentSelfEval={currentSelfEval} 
              handleSelfEval={handleSelfEval} handleTodoAchievement={handleTodoAchievement} todayPlan={todayPlan}
              isSlim={isDashboardSlim} setIsSlim={setIsDashboardSlim}
              approvalStatus={approvalStatus}
              onSyncTasks={handleSyncTasks}
            />

            <TextbookSystem 
              student={student} availableTextbooks={availableTextbooks} allLogs={allLogs}
              localCompletedClasswork={localCompletedClasswork} setLocalCompletedClasswork={setLocalCompletedClasswork}
              localHomework={localHomework} setLocalHomework={setLocalHomework}
              todayPlan={todayPlan} handleManualSave={handleManualSave} isSaving={isSaving}
              onBookSelect={(isActive) => { if (isActive) setIsDashboardSlim(true); }}
              approvalStatus={approvalStatus}
            />
            {(() => {
              return (
                <div className="mt-8 mb-4">
                  {approvalStatus === 'none' ? (
                    <button 
                      onClick={() => setConfirmSubmitOpen(true)} 
                      disabled={isSaving}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl shadow-lg shadow-emerald-900/20 text-lg transition-all animate-in slide-in-from-bottom-2"
                    >
                      🚀 오늘의 학습 제출하기
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-white/10 border border-white/20 text-white font-black rounded-xl text-lg flex items-center justify-center gap-2">
                      {approvalStatus === 'approved' ? (
                        <><Check size={24} className="text-blue-400" /> 선생님 검사 완료</>
                      ) : (
                        <><Lock size={24} className="text-amber-400" /> 검사 대기 중 (수정 불가)</>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className={activeTab === 'history' ? 'block mt-4' : 'hidden lg:block lg:mt-8'}>
            <PerformanceChart logs={allLogs} />
          </div>
        </div>

        {/* 오른쪽 섹션: 테스트 상태, 히스토리, 건의사항 */}
        <div className={`w-full lg:w-[40%] bg-[#0a0a0a] flex-col overflow-y-auto custom-scrollbar-v p-3 md:p-6 xl:p-8 pt-2 md:pt-4 xl:pt-4 space-y-4 md:space-y-8 relative lg:flex ${activeTab === 'history' || activeTab === 'suggestion' ? 'flex' : 'hidden lg:flex'}`}>
          
          {/* 모바일 전용: 시험일정 및 학원 채널 링크 (3번째 탭 'suggestion' 일 때 노출) */}
          <div className={`lg:hidden space-y-6 ${activeTab === 'suggestion' ? 'block' : 'hidden'}`}>
            {/* 1. 시험 일정 카드 */}
            {matchedExam && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 md:p-6 text-left space-y-2 md:space-y-3 shadow-lg shadow-rose-950/10 shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="text-rose-500" size={16} />
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-rose-400">다가오는 시험 일정</h3>
                </div>
                <div className="flex items-center justify-between text-[10px] md:text-xs font-bold text-gray-300 bg-white/[0.02] border border-white/5 rounded-lg p-3 md:p-4">
                  <span className="text-rose-200 font-extrabold">
                    {new Date(matchedExam.target_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                  </span>
                  <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest">
                    잔여 <span className="text-[14px] ml-0.5">{getRemainingClasses(matchedExam.target_date)}</span>회
                  </span>
                </div>
              </div>
            )}

            {/* 2. 학원 공식 채널 바로가기 버튼 */}
            {(academy?.operation_settings?.homepage_url || academy?.operation_settings?.naver_cafe_url) && (
              <div className="bg-blue-600/5 border border-blue-500/10 rounded-xl p-4 md:p-6 text-left space-y-3 md:space-y-4 shadow-lg shadow-blue-950/5 shrink-0">
                <div className="flex items-center gap-2">
                  <Globe className="text-blue-500" size={16} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-blue-400">학원 공식 채널</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {academy?.operation_settings?.homepage_url && (
                    <a 
                      href={(() => {
                        const url = academy.operation_settings.homepage_url.trim();
                        return /^https?:\/\//i.test(url) ? url : `https://${url}`;
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20 text-xs font-black transition-all hover:bg-blue-600/20 animate-none"
                    >
                      <Globe size={14} />
                      <span>{academy.operation_settings.homepage_title || "홈페이지"}</span>
                    </a>
                  )}
                  {academy?.operation_settings?.naver_cafe_url && (
                    <a 
                      href={(() => {
                        const url = academy.operation_settings.naver_cafe_url.trim();
                        return /^https?:\/\//i.test(url) ? url : `https://${url}`;
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 text-xs font-black transition-all hover:bg-emerald-600/20 animate-none"
                    >
                      <ExternalLink size={14} />
                      <span>{academy.operation_settings.naver_cafe_title || "네이버 카페"}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 설문조사 / 수요조사 */}
          <div className={activeTab === 'suggestion' ? 'block mb-6' : 'hidden'}>
            <SurveyList academyId={academy.id} student={student} />
          </div>

          {upcomingMakeups.length > 0 && (
            <div className={activeTab === 'suggestion' ? 'block' : 'hidden lg:block'}>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 md:p-6 text-left space-y-2 md:space-y-3 shadow-lg shadow-amber-950/10 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-amber-400">예정된 보강 스케줄</h3>
                </div>
                <div className="space-y-2">
                  {upcomingMakeups.map((m: any) => {
                    const formatted = m.session_date.slice(5).replace('-', '.');
                    return (
                      <div key={m.id} className="flex items-center justify-between text-xs font-bold text-gray-300 bg-white/[0.02] border border-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-200 font-extrabold">{formatted}</span>
                          <span className="text-gray-700">|</span>
                          <span>{m.moved_to_hour ? `${m.moved_to_hour}:00 수업` : '교시 미정'}</span>
                        </div>
                        <span className="bg-amber-500/20 text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">예약 완료</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          
          <div className={activeTab === 'history' ? 'block' : 'hidden lg:block'}>
            <TestStatusSection todaySession={todaySession} />
          </div>
          
          <div className={activeTab === 'history' ? 'block' : 'hidden lg:block'}>
            <LearningHistoryList 
              allLogs={allLogs} isHistoryOpen={isHistoryOpen} setIsHistoryOpen={setIsHistoryOpen} 
            />
          </div>

          <div className={activeTab === 'suggestion' ? 'block' : 'hidden lg:block'}>
            <StudentSuggestion 
              suggestion={suggestion} setSuggestion={setSuggestion} 
              selectedDate={selectedDate} handleSuggestionSubmit={handleSuggestionSubmit} isSaving={isSaving}
              mySuggestions={mySuggestions}
            />
          </div>
        </div>
      </main>

      {/* 모바일 하단 플로팅 탭 네비게이션 (lg 미만에서만 노출) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-[#0c0c0c]/90 backdrop-blur-md border-t border-white/5 flex items-center justify-around z-30 px-2 shadow-2xl">
        {[
          { id: 'study', label: '오늘 학습', icon: <BookOpen size={16} /> },
          { id: 'history', label: '히스토리', icon: <History size={16} /> },
          { id: 'suggestion', label: '알림장 & 설문', icon: <MessageSquare size={16} /> },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-all ${
                isActive ? 'text-blue-500 font-extrabold scale-105' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={isActive ? 'text-blue-500' : 'text-gray-500'}>
                {tab.icon}
              </div>
              <span className="text-[9px] font-bold tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 테스트 답안 모달 */}
      <AnimatePresence>
        {isTestModalOpen && (
          <TestAnswerModal 
            testId={todaySession?.test_status || ''} studentName={student.name} 
            onClose={() => setIsTestModalOpen(false)} onSave={handleTestSubmit} 
          />
        )}
      </AnimatePresence>
      {/* 💡 커스텀 제출 확인 모달 */}
      <AnimatePresence>
        {confirmSubmitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSaving && setConfirmSubmitOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-[#111] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full">
              <h3 className="text-lg font-black text-white mb-4">제출할 내용을 확인해주세요</h3>
              
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 text-[13px] space-y-4">
                <div>
                  <p className="text-gray-400 font-bold mb-1 flex items-center gap-1"><BookOpen size={14} /> 학원공부 / 오답고치기</p>
                  <p className="text-emerald-400 font-black leading-snug whitespace-pre-wrap">{localCompletedClasswork || '입력된 기록이 없습니다.'}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-bold mb-1 flex items-center gap-1"><FileText size={14} /> 집에서 할 숙제</p>
                  <p className="text-blue-400 font-black leading-snug whitespace-pre-wrap">{localHomework || '입력된 기록이 없습니다.'}</p>
                </div>
                <div className="flex gap-4 pt-2 border-t border-white/10">
                  <div className="flex-1">
                    <p className="text-gray-400 font-bold mb-1 flex items-center gap-1"><TrendingUp size={14} /> 오늘 달성률</p>
                    <p className="text-white font-black">{todaySession?.todo_achievement ? `${todaySession.todo_achievement}%` : '입력 안함'}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-400 font-bold mb-1 flex items-center gap-1"><Check size={14} /> 숙제이행 평가</p>
                    <p className="text-amber-400 font-black">
                      {currentSelfEval === 1 ? '1단계 (미흡)' : currentSelfEval === 2 ? '2단계 (보통)' : currentSelfEval === 3 ? '3단계 (우수)' : '입력 안함'}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[12px] text-gray-400 mb-6 text-center">제출하시면 선생님 확인 전까지 <b>수정하거나 취소할 수 없습니다.</b></p>
              
              <div className="flex gap-3">
                <button onClick={() => setConfirmSubmitOpen(false)} disabled={isSaving} className="flex-1 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold rounded-xl transition-colors">좀 더 쓸래요</button>
                <button onClick={() => handleApprovalSubmit('submitted')} disabled={isSaving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl shadow-lg shadow-emerald-900/20 transition-colors flex justify-center items-center">
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : "이대로 제출하기!"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
