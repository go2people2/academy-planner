import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { TextbookOption, ExamSchedule } from '@/types/dashboard';

export const WRONG_ANSWER_THEMES: Record<string, { primary: string; bg: string; ring: string; buttonText?: string }> = {
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

export function useStudentPortal(slug: string | string[] | undefined) {
  const [student, setStudent] = useState<any>(null);
  const [academy, setAcademy] = useState<any>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [todaySession, setTodaySession] = useState<any>(null);
  const [todaySessionStatus, setTodaySessionStatus] = useState<'resolved' | 'missing' | 'ambiguous'>('missing');
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDashboardSlim, setIsDashboardSlim] = useState(false);
  const [activeTab, setActiveTab] = useState<'study' | 'lecture' | 'history' | 'suggestion' | 'wrong-answer' | 'exam-submit'>('study');
  
  const [wrongAnswerStudent, setWrongAnswerStudent] = useState<any>(null);
  const [wrongAnswerAcademy, setWrongAnswerAcademy] = useState<any>(null);
  const [wrongAnswerTheme, setWrongAnswerTheme] = useState<any>(WRONG_ANSWER_THEMES.default);
  
  const [availableTextbooks, setAvailableTextbooks] = useState<TextbookOption[]>([]);
  const [examSchedules, setExamSchedules] = useState<ExamSchedule[]>([]);
  const [localClasswork, setLocalClasswork] = useState('');
  const [localCompletedClasswork, setLocalCompletedClasswork] = useState('');
  const [localHomework, setLocalHomework] = useState('');
  const [todayPlan, setTodayPlan] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [mySuggestions, setMySuggestions] = useState<any[]>([]);
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
    const currentPeriod = academy?.operation_settings?.current_exam_period;
    const normalize = (name: string) => (name || '').trim().replace(/\s+/g, '').replace(/학교$/, '');
    
    const studentSchool = normalize(student.school);
    const studentGrade = (student.grade || '').trim();

    if (!studentSchool) return null;

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
      : upcomingSchedules;

    const exactMatch = currentPeriodSchedules.find(ex => 
      normalize(ex.school_name) === studentSchool && 
      (ex.grade?.trim() === studentGrade)
    );
    if (exactMatch) return exactMatch;

    const schoolMatch = currentPeriodSchedules.find(ex => 
      normalize(ex.school_name) === studentSchool && 
      (!ex.grade || ex.grade.trim() === '')
    );
    
    return schoolMatch || null;
  }, [student, examSchedules, academy?.operation_settings?.current_exam_period, selectedDate]);

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
      const baseStudentId = studentId ? studentId.split('_special_')[0] : '';
      const { data: stData } = await supabase.from('ams_students').select('*').eq('id', baseStudentId).single();
      if (stData) {
        setStudent(stData);
        if (acData) {
          const { data: exData } = await supabase.from('ams_exam_schedules').select('*').eq('academy_id', acData.id).order('target_date', { ascending: true });
          if (exData) setExamSchedules(exData);

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
                  .eq('academy_id', waAcData.id)
                  .eq('name', amsTeacher.name)
                  .maybeSingle();
                if (waTeacher) waTeacherId = waTeacher.id;
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
              } else {
                setWrongAnswerStudent({
                  id: stData.id,
                  name: stData.name,
                  academy_id: waAcData.id,
                  teacher_id: waTeacherId || null,
                  phone: stData.phone,
                });
              }
            }
          } catch (waErr) {
            console.error('Error matching wrong answer account:', waErr);
          }

        try {
          const [apiRes, dbTbRes] = await Promise.all([
            fetch('/api/textbooks').then(r => r.ok ? r.json() : []).catch(() => []),
            supabase.from('ams_master_textbooks').select('*').eq('academy_id', acData.id).order('title')
          ]);
          const dbData = dbTbRes.data || [];
          const combined = [...apiRes];
          dbData.forEach((dt: any) => {
            if (!combined.some(c => c.bookcode === dt.bookcode || c.title === dt.title)) {
              combined.push(dt);
            }
          });
          setAvailableTextbooks(combined);
        } catch (tbErr) {
          console.error('Error fetching textbooks:', tbErr);
        }

        const { data: logsData } = await supabase
          .from('ams_session_logs')
          .select('*')
          .eq('student_id', studentId)
          .order('session_date', { ascending: false });

        if (logsData) {
          setAllLogs(logsData);
          const matchedCandidates = logsData.filter(l => {
            if (l.session_date !== selectedDate) return false;
            const rawCourse = l.course_name ? l.course_name.trim() : '';
            const logCourse = rawCourse || '정규';

            if (activeCourse === '정규' || !activeCourse) {
              return logCourse === '정규';
            }

            return logCourse === activeCourse || (logCourse !== '정규' && (logCourse.includes(activeCourse) || activeCourse.includes(logCourse)));
          });

          if (matchedCandidates.length === 1) {
            const single = matchedCandidates[0];
            setTodaySession(single);
            setTodaySessionStatus('resolved');
            setLocalClasswork(single.classwork_text || '');
            setLocalCompletedClasswork(single.completed_classwork_text || '');
            setLocalHomework(single.homework_text || '');
            setTodayPlan('');
          } else if (matchedCandidates.length > 1) {
            setTodaySession(null);
            setTodaySessionStatus('ambiguous');
            setLocalClasswork('');
            setLocalCompletedClasswork('');
            setLocalHomework('');
            setTodayPlan('');
          } else {
            setTodaySession(null);
            setTodaySessionStatus('missing');
            setLocalClasswork('');
            setLocalCompletedClasswork('');
            setLocalHomework('');
            setTodayPlan('');
          }
        }
      }
    }
    } catch (err) {
      console.error('Error fetching student data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCourse, selectedDate, slug]);

  return {
    student,
    setStudent,
    academy,
    setAcademy,
    confirmSubmitOpen,
    setConfirmSubmitOpen,
    todaySession,
    todaySessionStatus,
    setTodaySession,
    allLogs,
    setAllLogs,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    isTestModalOpen,
    setIsTestModalOpen,
    isHistoryOpen,
    setIsHistoryOpen,
    isDashboardSlim,
    setIsDashboardSlim,
    activeTab,
    setActiveTab,
    wrongAnswerStudent,
    wrongAnswerAcademy,
    wrongAnswerTheme,
    availableTextbooks,
    examSchedules,
    localClasswork,
    setLocalClasswork,
    localCompletedClasswork,
    setLocalCompletedClasswork,
    localHomework,
    setLocalHomework,
    todayPlan,
    setTodayPlan,
    suggestion,
    setSuggestion,
    mySuggestions,
    setMySuggestions,
    teachers,
    selectedDate,
    setSelectedDate,
    validClassDates,
    setValidClassDates,
    selectedCourse,
    setSelectedCourse,
    invalidDateAlert,
    setInvalidDateAlert,
    matchedExam,
    fetchAllStudentData,
  };
}
