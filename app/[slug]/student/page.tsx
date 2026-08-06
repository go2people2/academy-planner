'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BookOpen, TrendingUp, MessageSquare, Globe, ExternalLink, FileText, Lock, Check, History, AlertTriangle, ClipboardCheck, Calendar, ChevronDown } from 'lucide-react';
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
import StudentSubmitPage from '@/components/wrong-answers/StudentSubmitPage';
import StudentExamSubmission from '@/components/dashboard/exam/StudentExamSubmission';

const WRONG_ANSWER_THEMES: Record<string, { primary: string; bg: string; ring: string; buttonText?: string }> = {
  navy: { primary: '#1e3a8a', bg: '#f8faff', ring: 'focus:ring-blue-900' },
  default: { primary: '#1e3a8a', bg: '#f8faff', ring: 'focus:ring-blue-900' },
  green: { primary: '#10b981', bg: '#ecfdf5', ring: 'focus:ring-emerald-500' },
  orange: { primary: '#f97316', bg: '#fff7ed', ring: 'focus:ring-orange-500' },
  purple: { primary: '#8b5cf6', bg: '#f5f3ff', ring: 'focus:ring-purple-500' },
  skyblue: { primary: '#0ea5e9', bg: '#f0f9ff', ring: 'focus:ring-sky-500' },
  pink: { primary: '#db2777', bg: '#fdf2f8', ring: 'focus:ring-pink-600' },
  indigo: { primary: '#4f46e5', bg: '#eef2ff', ring: 'focus:ring-indigo-600' },
  rose: { primary: '#e11d48', bg: '#fff1f2', ring: 'focus:ring-rose-600' },
  teal: { primary: '#0d9488', bg: '#f0fdfa', ring: 'focus:ring-teal-600' },
  slate: { primary: '#64748b', bg: '#f1f5f9', ring: 'focus:ring-slate-500' },
  black: { primary: '#000000', bg: '#ffffff', ring: 'focus:ring-black' },
  yellow: { primary: '#451a03', bg: '#fbbf24', ring: 'focus:ring-amber-950' },
  mint: { primary: '#064e3b', bg: '#34d399', ring: 'focus:ring-emerald-950' },
  lime: { primary: '#1a2e05', bg: '#a3e635', ring: 'focus:ring-lime-950' },
  gold: { primary: '#431407', bg: '#f97316', ring: 'focus:ring-orange-950' },
  charcoal: { primary: '#a3e635', bg: '#0f172a', ring: 'focus:ring-lime-400', buttonText: '#0f172a' },
  'coral-navy': { primary: '#fb7185', bg: '#020617', ring: 'focus:ring-rose-400' },
  chalkboard: { primary: '#ffffff', bg: '#064e3b', ring: 'focus:ring-white', buttonText: '#064e3b' }
};

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
  const [activeTab, setActiveTab] = useState<'study' | 'history' | 'suggestion' | 'wrong-answer' | 'exam-submit'>('study'); // 💡 모바일 탭 상태 추가 및 오답 제출 지원
  
  // 💡 오답노트 연동 상태
  const [wrongAnswerStudent, setWrongAnswerStudent] = useState<any>(null);
  const [wrongAnswerAcademy, setWrongAnswerAcademy] = useState<any>(null);
  const [wrongAnswerTheme, setWrongAnswerTheme] = useState<any>(WRONG_ANSWER_THEMES.default);
  
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
  const [validClassDates, setValidClassDates] = useState<{ date: string; label: string }[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('정규');
  const [invalidDateAlert, setInvalidDateAlert] = useState<string | null>(null);

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
      ? upcomingSchedules.filter(ex => {
          if (ex.exam_name && ex.exam_name.startsWith(currentPeriod)) return true;
          const periodType = currentPeriod.split('-').slice(1).join('-');
          const legacyNames: any = {
            '1-MID': ['1학기 중간', '1학기 중간고사'],
            '1-FINAL': ['1학기 기말', '1학기 기말고사'],
            '2-MID': ['2학기 중간', '2학기 중간고사'],
            '2-FINAL': ['2학기 기말', '2학기 기말고사']
          };
          if (ex.exam_name && (legacyNames[periodType] || []).includes(ex.exam_name)) return true;
          return false;
        })
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

  const lastSession = useMemo(() => {
    if (!allLogs || allLogs.length === 0) return null;
    const pastLogs = allLogs.filter(l => l.session_date < selectedDate && (l.course_name || '정규') === selectedCourse).sort((a, b) => b.session_date.localeCompare(a.session_date));
    
    let aggregatedHw = "";
    for (const log of pastLogs) {
      if (log.homework_text && log.homework_text.trim() !== '' && log.homework_text.trim() !== '결석') {
        const dateStr = log.session_date ? log.session_date.slice(5).replace('-', '.') : '';
        const dayName = ['일', '월', '화', '수', '목', '금', '토'][new Date(log.session_date).getDay()];
        let hText = log.homework_text;
        availableTextbooks.forEach(tb => { hText = hText.split(`[${tb.bookcode}]`).join(tb.title); });
        aggregatedHw = `${dateStr}(${dayName})\n${hText}`;
        break;
      }
    }

    const baseSession = pastLogs.find(l => {
      const isLogHoliday = (academy?.operation_settings?.holidays || []).some((h: any) => h.date === l.session_date);
      const isMakeup = l.attendance_status?.startsWith('보강');
      return (l.homework_to || l.test_status || l.classwork_text || l.homework_text) && 
             !['결석', '수업취소', '수업제외'].includes(l.attendance_status) && (!isLogHoliday || isMakeup); 
    }) || pastLogs.find(l => !['결석', '수업취소', '수업제외'].includes(l.attendance_status)) || pastLogs[0];
    
    return baseSession ? { ...baseSession, homework_text: aggregatedHw } : (aggregatedHw ? { id: 'temp', session_date: selectedDate, homework_text: aggregatedHw } : null);
  }, [allLogs, selectedDate, selectedCourse, academy, student, availableTextbooks]);

  const currentSelfEval = useMemo(() => {
    try {
      if (lastSession?.test_result?.startsWith('{')) {
        const res = JSON.parse(lastSession.test_result);
        if (res.hw_eval !== undefined && res.hw_eval !== null) return res.hw_eval;
      }
    } catch (e) {}
    return null;
  }, [lastSession?.test_result]);

  const upcomingMakeups = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return allLogs
      .filter(l => l.session_date >= todayStr && l.attendance_status?.startsWith('보강'))
      .sort((a, b) => a.session_date.localeCompare(b.session_date));
  }, [allLogs]);

  const fetchAllStudentData = useCallback(async (studentId: string, courseParam?: string) => {
    setIsLoading(true);
    const activeCourse = courseParam || selectedCourse;
    try {
      const normalizedSlug = (Array.isArray(slug) ? slug[0] : slug || '').toLowerCase();
      const { data: acData } = await supabase.from('ams_academies').select('*').eq('slug', normalizedSlug).single();
      let currentTeachers: any[] = [];
      if (acData) {
        setAcademy(acData);
        const { data: tData } = await supabase
          .from('ams_teachers')
          .select('*')
          .eq('academy_id', acData.id)
          .neq('role', 'master');
        if (tData) {
          setTeachers(tData);
          currentTeachers = tData;
        }
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

        try {
          const { data: waAcData } = await supabase
            .from('academies')
            .select('*')
            .eq('slug', normalizedSlug)
            .maybeSingle();

          if (waAcData) {
            setWrongAnswerAcademy(waAcData);
            const themeObj = WRONG_ANSWER_THEMES[waAcData.theme] || WRONG_ANSWER_THEMES.default;
            setWrongAnswerTheme(themeObj);

            let waTeacherId = null;
            const amsTeacher = currentTeachers?.find((t: any) => t.id === stData.teacher_id);
            if (amsTeacher?.name) {
              const { data: waTeacher } = await supabase
                .from('teachers')
                .select('id')
                .eq('name', amsTeacher.name)
                .eq('academy_id', waAcData.id)
                .maybeSingle();
              if (waTeacher) {
                waTeacherId = waTeacher.id;
              }
            }

            let query = supabase
              .from('student_users')
              .select('*')
              .eq('name', stData.name)
              .eq('academy_id', waAcData.id);

            if (waTeacherId) {
              query = query.eq('teacher_id', waTeacherId);
            }

            const { data: waStData } = await query.maybeSingle();

            if (waStData) {
              setWrongAnswerStudent(waStData);
            }
          }
        } catch (err) {
          console.error('Failed to load wrong answer student mapping:', err);
        }
      }
      const tbRes = await fetch('/api/textbooks');
      const textbooks: TextbookOption[] = tbRes.ok ? await tbRes.json() : [];
      if (tbRes.ok) setAvailableTextbooks(textbooks);

      const translateBookCodes = (text: string) => {
        if (!text || !textbooks || textbooks.length === 0) return text;
        let result = text;
        const sortedMaster = [...textbooks].sort((a, b) => (b.bookcode?.length || 0) - (a.bookcode?.length || 0));
        sortedMaster.forEach(m => {
          if (m.bookcode && m.title) {
            const escapedCode = m.bookcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedCode, 'gi');
            result = result.replace(regex, m.title);
          }
        });
        return result;
      };

      const { data: logs } = await supabase.from('ams_session_logs').select('*').eq('student_id', studentId).order('session_date', { ascending: false }).limit(50);
      
      if (logs) {
        setAllLogs(logs);

        // 💡 선택된 과목(정규/특강) 로그만 분리 필터링
        const courseLogs = logs.filter(l => (l.course_name || '정규') === activeCourse);

        const holidays = acData?.operation_settings?.holidays || [];
        const calculatedDates = getValidClassDates(stData, courseLogs, holidays, activeCourse);
        setValidClassDates(calculatedDates);

        // 💡 오늘 날짜 문자열 구하기
        const todayObj = new Date();
        const offsetVal = todayObj.getTimezoneOffset() * 60000;
        const todayStr = new Date(todayObj.getTime() - offsetVal).toISOString().split('T')[0];

        // 💡 디폴트 매칭 날짜 추천
        let defaultDate = todayStr;
        if (calculatedDates.length > 0) {
          const hasToday = calculatedDates.some(d => d.date === todayStr);
          if (hasToday) {
            defaultDate = todayStr;
          } else {
            // 오늘 이후 가장 가까운 미래 수업일 탐색
            const futureDates = calculatedDates.filter(d => d.date > todayStr).sort((a, b) => a.date.localeCompare(b.date));
            // 오늘 이전 가장 가까운 과거 수업일 탐색
            const pastDates = calculatedDates.filter(d => d.date < todayStr).sort((a, b) => b.date.localeCompare(a.date)); // 최신 순 정렬됨
            
            if (futureDates.length > 0) {
              defaultDate = futureDates[0].date;
            } else if (pastDates.length > 0) {
              defaultDate = pastDates[0].date;
            }
          }
        }

        // 💡 [무한루프 방지] 현재 selectedDate가 새로 보정된 defaultDate와 다를 때만 업데이트를 수행합니다.
        let activeDate = selectedDate;
        if (selectedDate !== defaultDate) {
          setSelectedDate(defaultDate);
          activeDate = defaultDate;
        }

        const dayName = ['일', '월', '화', '수', '목', '금', '토'][new Date(activeDate).getDay()];
        const todayLog = courseLogs.find(l => l.session_date === activeDate);
        const isTodayClassDay = stData.class_days?.includes(dayName) || todayLog?.attendance_status?.startsWith('보강');
        const pastLogs = courseLogs.filter(l => l.session_date < selectedDate).sort((a, b) => b.session_date.localeCompare(a.session_date));
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
          let todoAchievement = null;
          try { 
            if (todayLog.test_result?.startsWith('{')) { 
              const res = JSON.parse(todayLog.test_result); 
              todayCut = res.cut || 0; 
              todoAchievement = res.todo_achievement !== undefined ? res.todo_achievement : null;
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
            todo_achievement: todoAchievement,
            test_answers: todayLog.test_answers || null,
            onTodoClick: handleTodoAchievement,
            onTodoToggle: handleTodoToggle
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
            todo_achievement: null 
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
    const courseName = parsedStudent._selectedCourse || '정규';
    setSelectedCourse(courseName);
    fetchAllStudentData(parsedStudent.id, courseName);
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
            
            // 💡 [안정화] 텍스트 필드들도 동기화 (선생님이 수정했을 때 바로 보이도록)
            // 단, 학생이 입력창에 포커스를 둔 채 열심히 타이핑 중인 경우(activeElement가 textarea/input인 경우)
            // 실시간 동기화로 인한 입력값 강제 유실을 막기 위해 텍스트 덮어쓰기를 제한합니다!
            const activeTag = typeof document !== 'undefined' ? document.activeElement?.tagName?.toLowerCase() : '';
            const isEditing = activeTag === 'textarea' || activeTag === 'input';

            setTodayPlan(newData.classwork_text || '');
            if (!isEditing) {
              setLocalCompletedClasswork(newData.completed_classwork_text || '');
              setLocalHomework(newData.homework_text || '');
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [student?.id, selectedDate]);

  const handleManualSave = async (field: 'classwork' | 'completed_classwork' | 'homework' | 'special_notes', value: string) => {
    if (!student || !academy) return;
    
    // 💡 기존 값과 입력값이 완전히 같은 경우 불필요한 저장 스킵
    const dbField = field === 'special_notes' ? field : `${field}_text`;
    const currentValue = todaySession?.[dbField] || '';
    if ((currentValue || '').trim() === (value || '').trim()) {
      return;
    }

    setIsSaving(true);
    try {
      let finalValue = value;
      const updateData: any = { student_id: student.id, session_date: selectedDate, academy_id: academy.id, course_name: selectedCourse, [dbField]: finalValue };
      
      const { data, error } = await supabase
        .from('ams_session_logs')
        .upsert([updateData], { onConflict: 'student_id,session_date,course_name,moved_to_hour' })
        .select();
      if (error) throw error;
      let savedLog = data && data[0] ? data[0] : null;
      
      if (savedLog) {
        setTodaySession((prev: any) => ({ ...prev, ...savedLog }));
      } else if (field === 'special_notes') {
        setTodaySession((prev: any) => ({ ...prev, special_notes: finalValue }));
      }
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleTodoAchievement = async (percentage: number) => {
    if (!student || !academy) return;
    setIsSaving(true);
    try {
      const currentVal = todaySession?.todo_achievement !== undefined ? todaySession.todo_achievement : null;
      const nextVal = currentVal === percentage ? null : percentage; 
      const currentResult = todaySession?.test_result && todaySession.test_result.startsWith('{') ? JSON.parse(todaySession.test_result) : {};
      const newResult = { ...currentResult, todo_achievement: nextVal, checked_todos: null }; // 퍼센트 수동 클릭 시 개별 상태 초기화
      const updateData: any = { 
        student_id: student.id, 
        session_date: selectedDate, 
        academy_id: academy.id, 
        course_name: selectedCourse,
        test_result: JSON.stringify(newResult)
      };
      
      const { data, error } = await supabase
        .from('ams_session_logs')
        .upsert([updateData], { onConflict: 'student_id,session_date,course_name,moved_to_hour' })
        .select();
      if (error) throw error;
      let savedLog = data && data[0] ? data[0] : null;

      if (savedLog) {
        let savedAchievement = null;
        try {
          if (savedLog.test_result?.startsWith('{')) {
            const parsedRes = JSON.parse(savedLog.test_result);
            savedAchievement = parsedRes.todo_achievement !== undefined ? parsedRes.todo_achievement : null;
          }
        } catch (e) {}
        setTodaySession((prev: any) => ({ 
          ...prev, 
          ...savedLog, 
          todo_achievement: savedAchievement 
        }));
      } else {
        setTodaySession((prev: any) => ({ ...prev, todo_achievement: nextVal, test_result: JSON.stringify(newResult) }));
      }
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleTodoToggle = async (index: number, totalCount: number) => {
    if (!student || !academy) return;
    setIsSaving(true);
    try {
      const currentResult = todaySession?.test_result && todaySession.test_result.startsWith('{') ? JSON.parse(todaySession.test_result) : {};
      
      // 기존에 배열이 없으면 퍼센트 기반으로 채워진 배열 생성 (연속성 유지)
      let currentChecked: number[] = [];
      if (Array.isArray(currentResult.checked_todos)) {
        currentChecked = [...currentResult.checked_todos];
      } else {
        const currentPercentage = todaySession?.todo_achievement || 0;
        let checkedCount = 0;
        const opts = [0, 20, 40, 60, 80, 100];
        for (let j = 1; j < opts.length; j++) {
          if (currentPercentage >= opts[j]) checkedCount = j;
        }
        for (let j = 0; j < checkedCount; j++) currentChecked.push(j);
      }
      
      const pos = currentChecked.indexOf(index);
      const isChecking = pos === -1;
      
      if (!isChecking) {
        currentChecked.splice(pos, 1);
      } else {
        currentChecked.push(index);
      }
      
      // 실제 체크박스 항목(totalCount) 중 몇 개가 체크되었는지에 따라 퍼센트 재계산 (최대 100)
      const validChecked = currentChecked.filter(idx => idx < totalCount);
      let rawPercentage = totalCount > 0 ? (validChecked.length / totalCount) * 100 : 0;
      let newPercentage = Math.floor(rawPercentage / 10) * 10;
      if (validChecked.length > 0 && newPercentage === 0) newPercentage = 10;
      if (validChecked.length === totalCount) newPercentage = 100;
      
      const newResult = { ...currentResult, todo_achievement: newPercentage, checked_todos: currentChecked };
      
      const updateData: any = { 
        student_id: student.id, 
        session_date: selectedDate, 
        academy_id: academy.id, 
        course_name: selectedCourse,
        test_result: JSON.stringify(newResult)
      };
      
      const { data, error } = await supabase
        .from('ams_session_logs')
        .upsert([updateData], { onConflict: 'student_id,session_date,course_name,moved_to_hour' })
        .select();
      if (error) throw error;
      let savedLog = data && data[0] ? data[0] : null;
      
      if (savedLog) {
        let savedAchievement = null;
        try {
          if (savedLog.test_result?.startsWith('{')) {
            const parsedRes = JSON.parse(savedLog.test_result);
            savedAchievement = parsedRes.todo_achievement !== undefined ? parsedRes.todo_achievement : null;
          }
        } catch (e) {}
        setTodaySession((prev: any) => ({ 
          ...prev, 
          ...savedLog, 
          todo_achievement: savedAchievement 
        }));
      } else {
        setTodaySession((prev: any) => ({ ...prev, todo_achievement: newPercentage, test_result: JSON.stringify(newResult) }));
      }
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleApprovalSubmit = async (status: 'none' | 'submitted') => {
    if (!student) { alert("학생 정보를 불러오지 못했습니다."); return; }
    if (!academy) { alert("학원 정보를 불러오지 못했습니다."); return; }
    
    setIsSaving(true);
    try {
      // 💡 [동시성 안전조치] 텍스트 저장 완료 전에 최종 제출이 클릭되더라도 입력값 유실이 없도록 현재 최종 내용을 병합하여 전송합니다.
      const updateData: any = { 
        student_id: student.id, 
        session_date: selectedDate, 
        academy_id: academy.id, 
        course_name: selectedCourse,
        approval_status: status,
        completed_classwork_text: localCompletedClasswork || '',
        homework_text: localHomework || ''
      };
      const { data, error } = await supabase
        .from('ams_session_logs')
        .upsert([updateData], { onConflict: 'student_id,session_date,course_name,moved_to_hour' })
        .select();
      if (error) throw error;
      let savedLog = data && data[0] ? data[0] : null;
      if (savedLog) {
        setTodaySession((prev: any) => ({ ...prev, ...savedLog }));
      } else {
        setTodaySession((prev: any) => ({ ...prev, approval_status: status }));
      }
    } catch (e: any) { 
      console.error(e); 
      alert("제출 처리 중 오류가 발생했습니다: " + (e.message || "알 수 없는 오류"));
    } finally { 
      setIsSaving(false); 
      setConfirmSubmitOpen(false);
    }
  };

  const handleSelfEval = async (level: number) => {
    if (!student || !academy || !lastSession?.session_date) return;
    const targetDate = lastSession.session_date;
    const targetLog = allLogs.find(l => l.session_date === targetDate && (l.course_name || '정규') === selectedCourse) || lastSession;

    const isToggleOff = currentSelfEval === level; 
    let currentResult: any = {};
    try { if (targetLog?.test_result?.startsWith('{')) currentResult = JSON.parse(targetLog.test_result); } catch (e) {}
    
    if (isToggleOff) {
      delete currentResult.hw_eval;
    } else {
      currentResult.hw_eval = level;
    }
    
    setIsSaving(true);
    try {
      const updateData: any = { 
        student_id: student.id, 
        student_name: student.name,
        session_date: targetDate, 
        academy_id: academy.id, 
        course_name: selectedCourse,
        test_result: JSON.stringify(currentResult) 
      };
      let savedLog: any = null;
      if (targetLog?.id && targetLog.id !== 'temp') { 
        const { data, error } = await supabase.from('ams_session_logs').update(updateData).eq('id', targetLog.id).select(); 
        if (error) throw error;
        if (data && data[0]) savedLog = data[0];
      } else { 
        const { data, error } = await supabase.from('ams_session_logs').upsert([updateData], { onConflict: 'student_id,session_date,course_name,moved_to_hour' }).select(); 
        if (error) throw error;
        if (data && data[0]) savedLog = data[0];
      }
      
      if (savedLog) {
        setAllLogs(prev => prev.map(l => (l.session_date === targetDate && (l.course_name || '정규') === selectedCourse) ? { ...l, ...savedLog } : l));
      } else {
        setAllLogs(prev => prev.map(l => (l.session_date === targetDate && (l.course_name || '정규') === selectedCourse) ? { ...l, test_result: JSON.stringify(currentResult) } : l));
      }
      
      // 특이사항에 남아있는 예전 "[숙제이행: X단계]" 텍스트가 있다면 지워줍니다 (마이그레이션 효과)
      const currentNotes = todaySession?.special_notes || '';
      if (currentNotes.includes('[숙제이행:')) {
        const cleanNotes = currentNotes.replace(/\n?\[숙제이행: \d+단계\]/g, '').trim();
        await handleManualSave('special_notes', cleanNotes);
        setTodaySession((prev: any) => ({ ...prev, special_notes: cleanNotes }));
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleTestSubmit = async (result: any) => {
    if (!student || isSaving) return;
    setIsSaving(true);
    try {
      const { answers, calculatedScore, testId } = result;
      const updateData: any = { student_id: student.id, student_name: student.name, session_date: selectedDate, course_name: selectedCourse, test_status: testId || todaySession?.test_status };
      if (calculatedScore !== undefined) updateData.test_score = calculatedScore;
      if (todaySession?.id && todaySession.id !== 'temp') { await supabase.from('ams_session_logs').update(updateData).eq('id', todaySession.id); } 
      else { await supabase.from('ams_session_logs').upsert([updateData], { onConflict: 'student_id,session_date,course_name,moved_to_hour' }); }
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
    
    let currentLines = localCompletedClasswork.split('\n').map(l => l.trim()).filter(Boolean);
    
    // 제거할 태스크 삭제
    uncheckedTasks.forEach(task => {
      currentLines = currentLines.filter(line => line !== task);
    });
    
    // 추가할 태스크 넣기 (중복 방지)
    checkedTasks.forEach(task => {
      if (!currentLines.includes(task)) {
        currentLines.push(task);
      }
    });

    const currentClasswork = currentLines.join('\n');
    if (currentClasswork !== localCompletedClasswork) {
      setLocalCompletedClasswork(currentClasswork);
      await handleManualSave('completed_classwork', currentClasswork);
    }
  };

  const handleUpdateAssignedBooks = async (newBooks: string[]) => {
    if (!student) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('ams_students')
        .update({ assigned_books: newBooks })
        .eq('id', student.id);
      if (error) throw error;
      setStudent((prev: any) => prev ? { ...prev, assigned_books: newBooks } : null);
    } catch (e) {
      console.error('Failed to update assigned books:', e);
      alert('교재 업데이트 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
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
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">학생 정보를 불러오는 중...</p>
      </div>
    );
  }

  const approvalStatus = todaySession?.approval_status || 'none';

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] font-sans flex flex-col overflow-hidden text-center">
      {/* 💡 헤더 컴포넌트 */}
      <StudentHeader 
        student={student} teachers={teachers} selectedDate={selectedDate} 
        setSelectedDate={setSelectedDate} 
        validClassDates={validClassDates}
        onInvalidDateSelect={(dateStr) => setInvalidDateAlert(dateStr)}
        matchedExam={matchedExam} 
        getRemainingClasses={getRemainingClasses} handleLogout={handleLogout} getInitial={getInitial}
        academy={academy} selectedCourse={selectedCourse} setSelectedCourse={setSelectedCourse}
      />

      {/* 💡 데스크톱 전용 상단 탭 바 (오답노트 전환용) */}
      <div className="bg-[#0a0a0a] border-b border-white/5 hidden lg:flex px-4 md:px-8 shrink-0">
        <button
          onClick={() => setActiveTab('study')}
          className={`px-6 py-3 text-sm font-black tracking-tight border-b-2 transition-all ${
            activeTab !== 'wrong-answer' && activeTab !== 'exam-submit'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          📝 내 학습 플래너
        </button>
        <button
          onClick={() => setActiveTab('wrong-answer')}
          className={`px-6 py-3 text-sm font-black tracking-tight border-b-2 transition-all ${
            activeTab === 'wrong-answer'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          ❌ 틀린 문제 제출
        </button>
        <button
          onClick={() => setActiveTab('exam-submit')}
          className={`px-6 py-3 text-sm font-black tracking-tight border-b-2 transition-all ${
            activeTab === 'exam-submit'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          ✏️ 답안 제출
        </button>
      </div>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden pb-[64px] lg:pb-0">
        {activeTab === 'wrong-answer' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar-v bg-[#080808] p-4">
            {wrongAnswerStudent ? (
              <StudentSubmitPage
                studentData={wrongAnswerStudent}
                handleLogout={handleLogout}
                theme={wrongAnswerTheme}
                academyId={wrongAnswerAcademy?.id}
              />
            ) : (
              <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center text-gray-400 p-8">
                <AlertTriangle className="text-amber-500 mb-4" size={48} />
                <h3 className="text-lg font-black text-white mb-2">오답노트 미등록 학생</h3>
                <p className="text-sm text-gray-500 text-center max-w-md">
                  오답노트 시스템({wrongAnswerAcademy?.academy_name || '호크마 수학'})에 등록되지 않은 이름입니다.<br />
                  선생님께 이름 등록을 요청해 주세요. (출석부 이름: <b>{student?.name}</b>)
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'exam-submit' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar-v bg-[#080808] p-4">
            <StudentExamSubmission
              academyId={academy?.id || ''}
              studentId={student?.id || ''}
              studentName={student?.name || ''}
              studentGrade={student?.grade || ''}
              assignedExamId={todaySession?.test_status || ''}
              sessionDate={selectedDate}
            />
          </div>
        ) : (
          <>
            {/* ① 왼쪽 섹션: 대시보드 및 교재 시스템 */}
            <div className={`w-full lg:w-[60%] border-r border-white/5 bg-[#080808] overflow-y-auto custom-scrollbar-v p-3 md:p-6 xl:p-8 pt-2 md:pt-4 xl:pt-4 relative lg:block ${activeTab === 'study' || activeTab === 'history' ? 'block' : 'hidden lg:block'}`}>
          <div className={activeTab === 'study' ? 'block space-y-4 md:space-y-8' : 'hidden lg:block lg:space-y-8'}>
            <LearningDashboard 
              student={student} lastSession={lastSession} todaySession={todaySession} 
              selectedDate={selectedDate} currentSelfEval={currentSelfEval} 
              handleSelfEval={handleSelfEval} handleTodoAchievement={handleTodoAchievement} todayPlan={todayPlan}
              onTodoToggle={handleTodoToggle}
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
              selectedDate={selectedDate}
              selectedCourse={selectedCourse}
              onUpdateAssignedBooks={handleUpdateAssignedBooks}
              academy={academy}
            />
            {(() => {
              const isValidClassDate = validClassDates.some(d => d.date === selectedDate);

              return (
                <div className="mt-8 mb-4">
                  {approvalStatus === 'none' ? (
                    isValidClassDate ? (
                      <button 
                        onClick={() => setConfirmSubmitOpen(true)} 
                        disabled={isSaving}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl shadow-lg shadow-emerald-900/20 text-lg transition-all animate-in slide-in-from-bottom-2"
                      >
                        🚀 오늘의 학습 제출하기
                      </button>
                    ) : (
                      <button 
                        disabled={true}
                        className="w-full py-4 bg-gray-800/80 border border-gray-700/50 text-gray-400 font-bold rounded-xl text-base cursor-not-allowed flex items-center justify-center gap-2 shadow-inner"
                      >
                        🚫 수업일이 아니라 제출할 수 없습니다
                      </button>
                    )
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
              allLogs={allLogs.map(l => l.session_date === selectedDate && todaySession ? { ...l, ...todaySession } : l)} isHistoryOpen={isHistoryOpen} setIsHistoryOpen={setIsHistoryOpen} 
              opSettings={academy?.operation_settings || {}}
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
          </>
        )}
      </main>

      {/* 모바일 하단 플로팅 탭 네비게이션 (lg 미만에서만 노출) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-[#0c0c0c]/90 backdrop-blur-md border-t border-white/5 flex items-center justify-around z-30 px-2 shadow-2xl">
        {[
          { id: 'study', label: '오늘 학습', icon: <BookOpen size={16} /> },
          { id: 'wrong-answer', label: '오답 제출', icon: <AlertTriangle size={16} /> },
          { id: 'exam-submit', label: '답안 제출', icon: <FileText size={16} /> },
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
            testId={todaySession?.test_status || ''} 
            studentName={student.name} 
            onClose={() => setIsTestModalOpen(false)} 
            onSave={handleTestSubmit} 
            reviewData={todaySession?.test_answers || undefined}
          />
        )}
      </AnimatePresence>
      {/* 💡 커스텀 제출 확인 모달 */}
      <AnimatePresence>
        {confirmSubmitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSaving && setConfirmSubmitOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-[#111] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-left">
              <h3 className="text-lg font-black text-white mb-4">제출할 내용을 확인해주세요</h3>
              
              <div className="bg-[#0c0c0e] border border-white/10 rounded-xl p-4 mb-4 text-[13px] space-y-3.5">
                {/* 1. 과제 자가평가 (파란색 계열 가로 바 재현 - 크기 상향 및 텍스트 제거) */}
                <div className="pb-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-gray-400 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                      <ClipboardCheck className="text-blue-500" size={13} /> 과제 자가평가
                    </p>
                    <span className="bg-blue-600 px-2 py-0.5 rounded-[3px] text-white text-[9px] font-black shadow-lg">
                      Lvl {currentSelfEval !== null && currentSelfEval !== undefined ? currentSelfEval : '입력 안함'}
                    </span>
                  </div>
                  {/* 가로 바 */}
                  <div className="grid grid-cols-11 gap-0.5 w-full">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
                      const isSel = currentSelfEval !== null && currentSelfEval !== undefined && num <= currentSelfEval;
                      const getBtnColor = () => {
                        if (currentSelfEval === null || currentSelfEval === undefined) return '';
                        if (currentSelfEval <= 3) return 'bg-rose-600 border-rose-400';
                        if (currentSelfEval <= 5) return 'bg-orange-500 border-orange-400';
                        if (currentSelfEval >= 8) return 'bg-blue-600 border-blue-400';
                        return 'bg-emerald-500 border-emerald-400';
                      };
                      return (
                        <div 
                          key={num} 
                          className={`w-full h-[14px] rounded-[2px] text-[9px] sm:text-[10px] font-black flex items-center justify-center border leading-none transition-all ${
                            isSel 
                              ? `${getBtnColor()} text-white shadow-lg` 
                              : 'bg-white/5 border-white/10 text-white/30'
                          }`}
                        >
                          {currentSelfEval === null ? num : (num === currentSelfEval ? num : '')}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 오늘 달성률 (초록색 계열 가로 바 재현 - 크기 상향 및 텍스트 제거) */}
                <div className="pt-1 pb-3 border-b border-white/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-gray-400 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                      <TrendingUp className="text-emerald-500" size={13} /> 오늘 달성률
                    </p>
                    <span className="bg-emerald-600 px-2 py-0.5 rounded-[3px] text-white text-[9px] font-black shadow-lg">
                      {todaySession?.todo_achievement !== undefined && todaySession?.todo_achievement !== null ? `${todaySession.todo_achievement}%` : '입력 안함'}
                    </span>
                  </div>
                  {/* 가로 바 */}
                  <div className="grid grid-cols-11 gap-0.5 w-full">
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(num => {
                      const isSel = todaySession?.todo_achievement !== undefined && todaySession?.todo_achievement !== null && num <= todaySession.todo_achievement;
                      return (
                        <div 
                          key={num} 
                          className={`w-full h-[14px] rounded-[2px] text-[8px] sm:text-[9px] font-black flex items-center justify-center border leading-none transition-all ${
                            isSel
                              ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' 
                              : 'bg-white/5 border-white/10 text-white/30'
                          }`}
                        >
                          {(todaySession?.todo_achievement === undefined || todaySession?.todo_achievement === null) ? num : (num === todaySession?.todo_achievement ? num : '')}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 학원 공부 / 오답 고치기 (초록색 테마) */}
                <div className="space-y-1.5">
                  <p className="text-gray-400 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <BookOpen className="text-emerald-500" size={13} /> 학원공부 / 오답고치기
                  </p>
                  <p className="text-emerald-400 font-black leading-snug whitespace-pre-wrap pl-3 border-l-2 border-emerald-500/20">
                    {localCompletedClasswork || '입력된 기록이 없습니다.'}
                  </p>
                </div>

                {/* 4. 집에서 할 숙제 (파란색 테마) */}
                <div className="space-y-1.5">
                  <p className="text-gray-400 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <FileText className="text-blue-500" size={13} /> 집에서 할 숙제
                  </p>
                  <p className="text-blue-400 font-black leading-snug whitespace-pre-wrap pl-3 border-l-2 border-blue-500/20">
                    {localHomework || '입력된 기록이 없습니다.'}
                  </p>
                </div>
              </div>

              <p className="text-[12px] text-amber-500 mb-6 text-center font-semibold">제출하시면 선생님 확인 전까지 <b className="text-amber-400 font-black">수정하거나 취소할 수 없습니다.</b></p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmSubmitOpen(false)} 
                  disabled={isSaving} 
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-gray-300 font-bold rounded-xl transition-colors"
                >
                  좀 더 쓸래요
                </button>
                <button 
                  onClick={() => handleApprovalSubmit('submitted')} 
                  disabled={isSaving} 
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-black rounded-xl shadow-lg shadow-violet-900/40 transition-colors flex justify-center items-center"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : "이대로 제출하기!"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 💡 비수업일 선택 시 안내 모달 */}
      <AnimatePresence>
        {invalidDateAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setInvalidDateAlert(null)} 
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 10 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 10 }} 
              className="relative bg-[#121215] border border-amber-500/30 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center overflow-hidden"
            >
              <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-black text-white mb-2">이동할 수 없는 날짜입니다</h3>
              <p className="text-[13px] text-gray-300 font-semibold leading-relaxed mb-6">
                선생님 출석부에 등록된 <span className="text-amber-400 font-bold">수업일(정규/보강/특강)</span>이 아니어서 일지를 제출하거나 조회할 수 없습니다.
              </p>
              <button 
                onClick={() => setInvalidDateAlert(null)}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black rounded-xl shadow-lg shadow-amber-950/40 text-sm transition-all"
              >
                확인 (수업일 선택하기)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// 💡 [추가] 학생의 공식 수업일(정규, 보강, 특강/선택수업) 목록만을 역산하는 초정밀 필터링 유틸리티
const getValidClassDates = (st: any, logs: any[], academyHolidays: any[] = [], activeCourse: string = '정규') => {
  if (!st) return [];
  const validDatesMap: { [date: string]: { label: string; date: string } } = {};
  
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  
  // 오늘 기준 -7일 ~ +7일 범위 탐색
  for (let i = -7; i <= 7; i++) {
    const targetDate = new Date(today.getTime() - offset);
    targetDate.setDate(targetDate.getDate() + i);
    const dateStr = targetDate.toISOString().split('T')[0];
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][targetDate.getDay()];
    
    // 1. 정규 수업일 여부
    const isRegularClass = activeCourse === '정규' && st.class_days?.includes(dayOfWeek);
    
    // 2. 선택/특강 수업일 여부
    let isElectiveClass = false;
    const rawElective = st.book_courses?.['__elective_courses'];
    if (rawElective) {
      try {
        const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
        if (Array.isArray(courses)) {
          for (const c of courses) {
            const courseSubject = c.subject?.trim() || '특강';
            if (activeCourse !== '정규' && courseSubject !== activeCourse) continue;
            if (c.days?.includes(dayOfWeek) && c.schedules?.[dayOfWeek]) {
              isElectiveClass = true;
              break;
            }
          }
        }
      } catch (e) {}
    }
    
    // 3. 보강일 및 실제 일지 데이터 존재 여부 (기존 로그 분석)
    const matchingLog = logs?.find(l => l.session_date === dateStr);
    const hasLogContent = matchingLog && (
      (matchingLog.attendance_status && !['수업전', '수업제외', '수업취소'].includes(matchingLog.attendance_status)) ||
      matchingLog.classwork_text ||
      matchingLog.homework_text ||
      matchingLog.test_status ||
      matchingLog.homework_to
    );
    const isMakeup = matchingLog?.attendance_status?.startsWith('보강');
    
    // 4. 휴일 여부 체크 (휴일인데 보강이 없으면 수업 제외)
    const isHoliday = academyHolidays.some((h: any) => h.date === dateStr);
    
    if ((isRegularClass || isElectiveClass || isMakeup || hasLogContent) && (!isHoliday || isMakeup)) {
      let typeLabel = '';
      if (isMakeup) typeLabel = '보강 수업';
      else if (isElectiveClass) typeLabel = `${activeCourse} 수업`;
      else if (isRegularClass) typeLabel = '정규 수업';
      else typeLabel = '기존 수업';
      
      const displayLabel = `${dateStr.slice(5).replace('-', '.')} (${dayOfWeek}) - ${typeLabel}`;
      validDatesMap[dateStr] = {
        date: dateStr,
        label: displayLabel
      };
    }
  }
  
  // 날짜 역정렬 (최신 날짜가 목록 가장 앞으로 오도록 정렬)
  return Object.values(validDatesMap).sort((a, b) => b.date.localeCompare(a.date));
};
