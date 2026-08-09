import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getTodayStr, getDayOfWeek } from '@/lib/utils';
import { ATTENDANCE_STATUS } from '@/lib/sessionFieldMap';
import { Student, SessionLog, TextbookOption } from '@/types/dashboard';
import { getEnrichedStudentData } from '@/lib/studentDataEnricher';

export function useDashboardData(params: {
  slug: string | string[] | undefined;
  selectedDate: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  currentUser: any;
  isWarpMode: boolean;
  setShowMorningBriefing: React.Dispatch<React.SetStateAction<boolean>>;
  noticeDirtyRef: React.MutableRefObject<Record<string, boolean>>;
  setNoticeDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const {
    slug,
    selectedDate,
    setSelectedDate,
    currentUser,
    isWarpMode,
    setShowMorningBriefing,
    noticeDirtyRef,
    setNoticeDrafts,
  } = params;

  const [isLoading, setIsLoading] = useState(true);
  const [academy, setAcademy] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [availableTextbooks, setAvailableTextbooks] = useState<TextbookOption[]>([]);
  const [isRefreshingBooks, setIsRefreshingBooks] = useState(false);

  const fetchTeachers = useCallback(async (academyId: string) => {
    try {
      const { data, error } = await supabase
        .from('ams_teachers')
        .select('*')
        .eq('academy_id', academyId)
        .neq('role', 'master')
        .order('name', { ascending: true });
      if (!error) {
        setTeachers(data || []);
        return data || [];
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }, []);

  const refreshTextbooks = useCallback(async () => {
    setIsRefreshingBooks(true);
    try {
      const res = await fetch('/api/textbooks');
      if (res.ok) setAvailableTextbooks(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshingBooks(false);
    }
  }, []);

  const fetchAllData = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      let currentAcademy = academy;
      let currentTeachers = teachers;

      if (!currentAcademy) {
        const normalizedSlug = (Array.isArray(slug) ? slug[0] : slug || '').toLowerCase();
        const { data: acData } = await supabase.from('ams_academies').select('*').eq('slug', normalizedSlug).maybeSingle();
        if (acData) { 
          const announcements = { monthly: '', weekly: '', daily: '', ...(acData.announcements || {}) };
          const enrichedAcademy = { ...acData, announcements };
          setAcademy(enrichedAcademy); 
          currentAcademy = enrichedAcademy; 
          currentTeachers = await fetchTeachers(acData.id); 
        } else {
          setIsLoading(false);
          return;
        }
      } else { 
        const { data: acData } = await supabase.from('ams_academies').select('*').eq('id', currentAcademy.id).maybeSingle();
        if (acData) {
           const announcements = { monthly: '', weekly: '', daily: '', ...(acData.announcements || {}) };
           const enrichedAcademy = { ...acData, announcements };
           setAcademy(enrichedAcademy);
           currentAcademy = enrichedAcademy;
        }
        currentTeachers = await fetchTeachers(currentAcademy.id); 
      }

      if (currentAcademy?.announcements) {
        setNoticeDrafts(prev => {
          return {
            monthly: noticeDirtyRef.current.monthly ? prev.monthly : currentAcademy.announcements.monthly,
            weekly: noticeDirtyRef.current.weekly ? prev.weekly : currentAcademy.announcements.weekly,
            daily: noticeDirtyRef.current.daily ? prev.daily : currentAcademy.announcements.daily
          };
        });
      }

      let studentsQuery = supabase.from('ams_students').select('*').eq('academy_id', currentAcademy.id);
      const user = currentUser || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ams_user') || 'null') : null);
      if (user && user.role === 'teacher') {
        studentsQuery = studentsQuery.eq('teacher_id', user.id);
      }

      const { data: studentsData, error: sErr } = await studentsQuery;
      if (sErr) throw sErr;

      const { data: tasksData } = await supabase.from('ams_tasks')
        .select('*').eq('academy_id', currentAcademy.id).eq('is_completed', false).like('title', '[건의]%');

      const enriched = await Promise.all((studentsData || []).map(async (s) => {
        const [recentLogsRes, selectedDateLogRes, legacyLogRes] = await Promise.all([
          supabase.from('ams_session_logs')
            .select('*').eq('student_id', s.id).order('session_date', { ascending: false }).limit(20),
          supabase.from('ams_session_logs')
            .select('*').eq('student_id', s.id).eq('session_date', selectedDate),
          supabase.from('ams_session_logs')
            .select('*').eq('student_id', s.id).eq('session_date', '1900-01-01').maybeSingle()
        ]);
        
        const logsData = [...(recentLogsRes.data || [])];
        if (selectedDateLogRes.data && Array.isArray(selectedDateLogRes.data)) {
          selectedDateLogRes.data.forEach(l => {
            if (!logsData.some(existing => existing.id === l.id)) {
              logsData.push(l);
            }
          });
        }
        if (legacyLogRes.data && !logsData.some(l => l.id === legacyLogRes.data.id)) {
          logsData.push(legacyLogRes.data);
        }
        
        return getEnrichedStudentData(
          s, logsData || [], selectedDate, availableTextbooks, 
          currentAcademy, currentTeachers, tasksData || []
        );
      }));

      const processed = enriched.map(s => {
        if (isWarpMode) {
          const name = s.name || '';
          const maskedName = name.length <= 2
            ? (name[0] || '') + '*'
            : name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
          return {
            ...s,
            name: maskedName,
            phone: s.phone ? '010-****-****' : '',
            school: s.school ? '***' : '',
            management_notes: '🔒 원격 지원 모드에서는 열람이 제한됩니다.',
            recent_mission: '🔒 원격 지원 모드에서는 열람이 제한됩니다.'
          };
        }
        return s;
      });

      setStudents(processed);
    } catch (e) { 
      console.error('Fetch All Data Error:', e); 
    } finally { 
      setIsLoading(false); 
    }
  }, [selectedDate, slug, academy, teachers, fetchTeachers, currentUser, isWarpMode, setNoticeDrafts, noticeDirtyRef]);

  useEffect(() => {
    const checkDate = () => {
      const realToday = getTodayStr();
      if (selectedDate !== realToday) {
        const lastKnownToday = sessionStorage.getItem('ams_last_today');
        if (lastKnownToday && lastKnownToday !== realToday) {
          setSelectedDate(realToday);
        }
        sessionStorage.setItem('ams_last_today', realToday);
      }
    };
    const interval = setInterval(checkDate, 60000);
    window.addEventListener('focus', checkDate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkDate);
    };
  }, [selectedDate, setSelectedDate]);

  useEffect(() => {
    setStudents([]);
    fetchAllData(true);
  }, [selectedDate, fetchAllData]);

  useEffect(() => {
    refreshTextbooks();
  }, [refreshTextbooks, slug]);

  useEffect(() => {
    if (isLoading || !academy) return;
    const checkBriefing = () => {
      const hasSeenBriefing = sessionStorage.getItem(`ams_briefing_${selectedDate}`);
      if (hasSeenBriefing) return;
      const hasAnnouncements = Object.values(academy.announcements || {}).some(v => String(v).trim());
      if (hasAnnouncements) {
        setShowMorningBriefing(true);
      }
    };
    checkBriefing();
  }, [isLoading, !!academy, selectedDate, students.length, setShowMorningBriefing]);

  const getFilteredBaseFields = (sessionData: any) => {
    const ALLOWED_COLUMNS = [
      'status', 'attendance_status', 'special_notes', 'classwork_text', 'classwork_json', 
      'completed_classwork_text', 'completed_classwork_json',
      'homework_text', 'homework_json', 'test_status', 'test_score', 'test_result', 'approval_status', 
      'session_date', 'academy_id', 'student_id', 'homework_to', 'timer_started_at', 'timer_duration',
      'moved_to_hour', 'attendance_reason', 'management_notes'
    ];
    const filtered: any = {};
    Object.keys(sessionData).forEach(key => {
      let dbKey = key === 'date' ? 'session_date' : key;
      if (dbKey === 'test_id') dbKey = 'test_status';
      
      if (['next_quiz_text', 'next_quiz_cut', 'next_quiz_trial', 'next_quiz_json', 'test_result', 'homework_to', 'test_completed', 'test_cut', 'mission', 'todo_achievement', 'test_score_type', 'test_total_count', 'hw_checked_today', 'hw_passed_today'].includes(dbKey)) return;
      
      if (ALLOWED_COLUMNS.includes(dbKey)) {
        let val = (sessionData as any)[key];
        
        if (dbKey === 'attendance_status' && val === undefined) return;

        if (['test_score', 'moved_to_hour', 'timer_duration', 'timer_started_at'].includes(dbKey)) {
          const parsed = parseInt(String(val), 10);
          val = (val === '' || val === undefined || val === null || isNaN(parsed)) ? null : parsed;
        }
        if (dbKey === 'status' && val === 'none') val = null;
        if (dbKey === 'attendance_status' && (val === '' || val === ATTENDANCE_STATUS.BEFORE)) val = null;
        filtered[dbKey] = val;
      }
    });
    return filtered;
  };

  const buildMergedTestResult = (existingJsonRaw: any, sessionData: any, fallbacks: {
    completed: any; mission: string; cut: string | number; achievement: number; sType: string; tTotal: number; hwCheckedToday: boolean; hwPassedToday: boolean;
  }) => {
    let existing = {};
    try {
      if (existingJsonRaw) existing = (typeof existingJsonRaw === 'string' ? JSON.parse(existingJsonRaw) : existingJsonRaw);
    } catch (e) {
      console.error('Failed to parse existing test_result:', e);
    }

    const isCompleted = ('test_completed' in sessionData) ? sessionData.test_completed : fallbacks.completed;
    
    return JSON.stringify({ 
      ...existing,
      completed: isCompleted === true ? true : (isCompleted === false ? false : null),
      cut: ('test_cut' in sessionData) ? sessionData.test_cut : fallbacks.cut,
      mission: ('mission' in sessionData) ? sessionData.mission : fallbacks.mission,
      todo_achievement: ('todo_achievement' in sessionData) ? sessionData.todo_achievement : fallbacks.achievement,
      score_type: ('test_score_type' in sessionData) ? sessionData.test_score_type : fallbacks.sType,
      total_count: ('test_total_count' in sessionData) ? sessionData.test_total_count : fallbacks.tTotal,
      hw_checked_today: ('hw_checked_today' in sessionData) ? sessionData.hw_checked_today : fallbacks.hwCheckedToday,
      hw_passed_today: ('hw_passed_today' in sessionData) ? sessionData.hw_passed_today : fallbacks.hwPassedToday
    });
  };

  const saveTodaySession = useCallback(async (studentId: string, sessionData: Partial<SessionLog>) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 데이터를 수정할 수 없습니다.');
      return false;
    }
    const realStudentId = studentId.replace(/_special.*$/, '').replace(/_makeup.*$/, '');
    const student = students.find(s => s.id === realStudentId);
    if (!student || !academy) return false;

    const targetSaveDate = sessionData.session_date || selectedDate;
    const targetCourseName = sessionData.course_name || '정규';

    let existingLog = (student.allLogs || []).find((l: any) => 
      sessionData.id ? l.id === sessionData.id : (
        (l.date || l.session_date) === targetSaveDate && 
        (l.course_name === targetCourseName || (targetCourseName === '정규' && !l.course_name))
      )
    );

    if (!existingLog && targetCourseName === '정규') {
      existingLog = student.todaySession;
    }

    let sessionId = existingLog?.id || (targetCourseName === '정규' ? student.todaySession?.id : undefined);

    const targetSession = existingLog || student.todaySession;

    if ('management_notes' in sessionData && sessionData.management_notes !== undefined) {
      await supabase.from('ams_students').update({ 
        management_notes: sessionData.management_notes 
      }).eq('id', realStudentId);
    }

    const dataToSave = { ...sessionData };
    const filteredData = getFilteredBaseFields(dataToSave);

    const hasTestKey = ('test_id' in dataToSave) || ('test_status' in dataToSave);
    if (!hasTestKey && targetSession?.test_id) {
      filteredData.test_status = targetSession.test_id;
    }

    let existingMovedHour = targetSession?.moved_to_hour;
    if (existingMovedHour === undefined || existingMovedHour === null) {
      const status = targetSession?.attendance_status || '';
      if (status.includes(':')) {
        const parts = status.split(':');
        const val = parseInt(parts[parts.length - 1]);
        if (!isNaN(val) && val < 24) {
          existingMovedHour = val;
        }
      }
    }

    if (dataToSave.moved_to_hour !== undefined) {
      filteredData.moved_to_hour = dataToSave.moved_to_hour;
    } else if (existingMovedHour !== undefined && existingMovedHour !== null) {
      filteredData.moved_to_hour = existingMovedHour;
    }

    const nqObj = {
      text: ('next_quiz_text' in dataToSave) ? dataToSave.next_quiz_text : (targetSession?.next_quiz_text ?? ''),
      cut: ('next_quiz_cut' in dataToSave) ? dataToSave.next_quiz_cut : (targetSession?.next_quiz_cut ?? 0),
      trial: ('next_quiz_trial' in dataToSave) ? dataToSave.next_quiz_trial : (targetSession?.next_quiz_trial ?? 1),
      json: ('next_quiz_json' in dataToSave) ? dataToSave.next_quiz_json : (targetSession?.next_quiz_json ?? [])
    };
    filteredData['homework_to'] = JSON.stringify(nqObj);
    
    filteredData['test_result'] = buildMergedTestResult(
      targetSession?.test_result, 
      dataToSave, 
      {
        completed: targetSession?.test_completed,
        mission: targetSession?.mission ?? '',
        cut: targetSession?.test_cut ?? 0,
        achievement: targetSession?.todo_achievement ?? 0,
        sType: targetSession?.test_score_type ?? 'score',
        tTotal: targetSession?.test_total_count ?? 0,
        hwCheckedToday: targetSession?.hw_checked_today ?? false,
        hwPassedToday: targetSession?.hw_passed_today ?? false
      }
    );

    setStudents(prev => prev.map(s => {
      if (s.id !== realStudentId) return s;

      const currentAllLogs = [...(s.allLogs || [])];
      let targetLogIdx = currentAllLogs.findIndex((l: any) => 
        sessionData.id ? l.id === sessionData.id : (
          (l.date || l.session_date) === targetSaveDate && 
          (l.course_name === targetCourseName || (targetCourseName === '정규' && !l.course_name))
        )
      );

      if (targetLogIdx === -1 && targetCourseName === '정규') {
        targetLogIdx = currentAllLogs.findIndex((l: any) => l.id === s.todaySession?.id);
      }

      const existingLogObj: any = targetLogIdx !== -1 ? currentAllLogs[targetLogIdx] : (s.todaySession || {});

      const mergedLogObj = {
        ...existingLogObj,
        ...filteredData,
        id: sessionId || existingLogObj?.id,
        student_id: realStudentId,
        academy_id: academy.id,
        session_date: targetSaveDate,
        course_name: targetCourseName,
        next_quiz_text: nqObj.text,
        next_quiz_cut: nqObj.cut,
        next_quiz_trial: nqObj.trial,
        next_quiz_json: nqObj.json,
        test_completed: ('test_completed' in dataToSave) ? dataToSave.test_completed : existingLogObj?.test_completed,
        mission: ('mission' in dataToSave) ? dataToSave.mission : existingLogObj?.mission,
        todo_achievement: ('todo_achievement' in dataToSave) ? dataToSave.todo_achievement : existingLogObj?.todo_achievement,
        test_score_type: ('test_score_type' in dataToSave) ? dataToSave.test_score_type : existingLogObj?.test_score_type,
        test_total_count: ('test_total_count' in dataToSave) ? dataToSave.test_total_count : existingLogObj?.test_total_count,
        hw_checked_today: ('hw_checked_today' in dataToSave) ? dataToSave.hw_checked_today : existingLogObj?.hw_checked_today,
        hw_passed_today: ('hw_passed_today' in dataToSave) ? dataToSave.hw_passed_today : existingLogObj?.hw_passed_today,
        management_notes: ('management_notes' in dataToSave) ? dataToSave.management_notes : s.management_notes,
      };

      if (targetLogIdx !== -1) {
        currentAllLogs[targetLogIdx] = mergedLogObj;
      } else {
        currentAllLogs.push(mergedLogObj);
      }

      const updatedS = getEnrichedStudentData(
        { ...s, management_notes: ('management_notes' in dataToSave) ? dataToSave.management_notes : s.management_notes }, 
        currentAllLogs, 
        selectedDate, 
        availableTextbooks, 
        academy, 
        teachers, 
        []
      );

      return updatedS;
    }));

    try {
      let resData, resErr;
      if (sessionId) {
        const res = await supabase.from('ams_session_logs').update(filteredData).eq('id', sessionId).select().single();
        resData = res.data; resErr = res.error;
      } else {
        const payload = { ...filteredData, student_id: realStudentId, academy_id: academy.id, session_date: targetSaveDate, course_name: targetCourseName };
        const res = await supabase.from('ams_session_logs').insert(payload).select().single();
        resData = res.data; resErr = res.error;
      }

      if (resErr) throw resErr;

      if (resData) {
        setStudents(prev => prev.map(s => {
          if (s.id !== realStudentId) return s;
          const currentAllLogs = [...(s.allLogs || [])];
          const logIdx = currentAllLogs.findIndex((l: any) => 
            l.id === resData.id || (
              (l.date || l.session_date) === targetSaveDate && 
              (l.course_name === targetCourseName || (targetCourseName === '정규' && !l.course_name))
            )
          );
          if (logIdx !== -1) {
            currentAllLogs[logIdx] = { ...currentAllLogs[logIdx], ...resData };
          } else {
            currentAllLogs.push(resData);
          }
          return getEnrichedStudentData(s, currentAllLogs, selectedDate, availableTextbooks, academy, teachers, []);
        }));
      }
      return true;
    } catch (e) {
      console.error('Failed to save session log:', e);
      fetchAllData(false);
      return false;
    }
  }, [students, academy, selectedDate, availableTextbooks, teachers, isWarpMode, fetchAllData]);

  return {
    isLoading,
    setIsLoading,
    academy,
    setAcademy,
    teachers,
    setTeachers,
    students,
    setStudents,
    availableTextbooks,
    setAvailableTextbooks,
    isRefreshingBooks,
    fetchTeachers,
    refreshTextbooks,
    fetchAllData,
    saveTodaySession,
  };
}
