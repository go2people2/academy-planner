'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import Overview from '@/components/dashboard/Overview';
import TodaySheet from '@/components/dashboard/TodaySheet';
import ProgressSequencer from '@/components/dashboard/ProgressSequencer';
import MonthlyChanges from '@/components/dashboard/MonthlyChanges';
import SettingsView from '@/components/dashboard/SettingsView';
import NotificationsView from '@/components/dashboard/NotificationsView';
import StudentDetailDrawer from '@/components/dashboard/StudentDetailDrawer';
import StudentStudyReportDrawer from '@/components/dashboard/StudentStudyReportDrawer';
import MorningBriefingModal from '@/components/dashboard/MorningBriefingModal';
import ClassroomMode from '@/components/dashboard/ClassroomMode';
import { supabase } from '@/lib/supabase';
import { getTodayStr, getDayOfWeek } from '@/lib/utils';
import { Student, SessionLog, StudentStatus, TextbookOption } from '@/types/dashboard';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardPage() {
  const router = useRouter();
  const { slug } = useParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<string>('board');
  const [activeProgressStudentId, setActiveProgressStudentId] = useState<string | null>(null);
  const [navHistory, setNavHistory] = useState<string[]>(['board']);
  const [historyIdx, setHistoryIdx] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const userJson = localStorage.getItem('ams_user');
    if (!userJson) { router.push(`/${slug}/login`); return; }
    setCurrentUser(JSON.parse(userJson));
  }, [slug, router]);

  const [academy, setAcademy] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('All');
  const [isAndFilter, setIsAndFilter] = useState(false);
  const [filterTarget, setFilterTarget] = useState<'all' | 'today' | 'rest'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [availableTextbooks, setAvailableTextbooks] = useState<TextbookOption[]>([]);
  const [isRefreshingBooks, setIsRefreshingBooks] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isClassroomModeOpen, setIsClassroomModeOpen] = useState(false);
  const [showMorningBriefing, setShowMorningBriefing] = useState(false);
  const [sortMode, setSortMode] = useState<'time' | 'name'>('time');

  const navigateTo = useCallback((mode: string, skipHistory = false) => { 
    if (viewMode === mode) return;
    setViewMode(mode); setSelectedStudentId(null); 
    if (!skipHistory) {
      setNavHistory(prev => {
        const newHist = prev.slice(0, historyIdx + 1);
        newHist.push(mode);
        setHistoryIdx(newHist.length - 1);
        return newHist;
      });
    }
  }, [viewMode, historyIdx]);

  const goBack = useCallback(() => {
    if (historyIdx > 0) {
      const prevMode = navHistory[historyIdx - 1];
      setHistoryIdx(historyIdx - 1); setViewMode(prevMode); setSelectedStudentId(null);
    }
  }, [historyIdx, navHistory]);

  const goForward = useCallback(() => {
    if (historyIdx < navHistory.length - 1) {
      const nextMode = navHistory[historyIdx + 1];
      setHistoryIdx(historyIdx + 1); setViewMode(nextMode); setSelectedStudentId(null);
    }
  }, [historyIdx, navHistory]);

  useEffect(() => {
    const handleNavShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '[') { e.preventDefault(); goBack(); }
      if (e.ctrlKey && e.key === ']') { e.preventDefault(); goForward(); }
    };
    window.addEventListener('keydown', handleNavShortcuts);
    return () => window.removeEventListener('keydown', handleNavShortcuts);
  }, [goBack, goForward]);
  
  const handleUpdateCurrentUser = (updates: any) => {
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated); localStorage.setItem('ams_user', JSON.stringify(updated));
  };

  const handleViewProgress = (id: string) => { setActiveProgressStudentId(id); setViewMode('progress'); };

  const getInitial = (name: string) => {
    if (!name) return '?';
    const firstChar = name.charAt(0);
    const mapping: Record<string, string> = {
      '김': 'K', '이': 'L', '박': 'P', '최': 'C', '정': 'J', '강': 'K', '조': 'J', '윤': 'Y', '장': 'J', '임': 'L', '한': 'H', '오': 'O', '서': 'S', '신': 'S', '권': 'K', '황': 'H', '안': 'A', '송': 'S', '전': 'J', '홍:': 'H', '유': 'Y', '고': 'K', '문': 'M', '양': 'Y', '손': 'S', '배': 'B', '백': 'B', '허': 'H', '남': 'N', '심': 'S', '노': 'N', '하': 'H', '곽': 'K', '성': 'S', '차': 'C', '주': 'J', '우': 'W', '구': 'K', '신': 'S', '임': 'L', '나': 'N', '전': 'J', '민': 'M', '송': 'S', '지': 'J'
    };
    return mapping[firstChar] || firstChar.toUpperCase();
  };

  const fetchTeachers = useCallback(async (academyId: string) => {
    try {
      const { data, error } = await supabase.from('ams_teachers').select('*').eq('academy_id', academyId).order('name', { ascending: true });
      if (!error) setTeachers(data || []);
    } catch (e) { console.error(e); }
  }, []);

  const refreshTextbooks = useCallback(async () => {
    setIsRefreshingBooks(true);
    try {
      const res = await fetch('/api/textbooks');
      if (res.ok) setAvailableTextbooks(await res.json());
    } catch (e) { console.error(e); } finally { setIsRefreshingBooks(false); }
  }, []);

  const fetchAllData = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      let currentAcademy = academy;
      if (!currentAcademy) {
        const normalizedSlug = (Array.isArray(slug) ? slug[0] : slug || '').toLowerCase();
        const { data: acData } = await supabase.from('ams_academies').select('*').eq('slug', normalizedSlug).single();
        if (acData) { 
          const announcements = { monthly: '', weekly: '', daily: '', ...(acData.announcements || {}) };
          const enrichedAcademy = { ...acData, announcements };
          setAcademy(enrichedAcademy); currentAcademy = enrichedAcademy; await fetchTeachers(acData.id); 
        } else { setIsLoading(false); return; }
      } else { await fetchTeachers(currentAcademy.id); }

      let studentsQuery = supabase.from('ams_students').select('*').eq('academy_id', currentAcademy.id);
      const user = currentUser || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ams_user') || 'null') : null);
      if (user && user.role === 'teacher') { studentsQuery = studentsQuery.eq('teacher_id', user.id); }

      const { data: studentsData, error: sErr } = await studentsQuery;
      if (sErr) throw sErr;

      const { data: tasksData } = await supabase.from('ams_tasks').select('*').eq('academy_id', academy?.id).eq('is_completed', false).like('title', '[건의]%');

      const enriched = await Promise.all((studentsData || []).map(async (s) => {
        const { data: logsData } = await supabase.from('ams_session_logs').select('*').eq('student_id', s.id).order('session_date', { ascending: false }).limit(20);
        
        const logs: SessionLog[] = (logsData || []).map(l => {
          let nqText = '', nqCut = 0, nqTrial = 1, nqJson = [];
          let hasHwTo = false;
          try {
            if (l.homework_to?.startsWith('{')) {
              const parsed = JSON.parse(l.homework_to);
              nqText = parsed.text || ''; nqCut = parsed.cut || 0; nqTrial = parsed.trial || 1; nqJson = parsed.json || [];
              if (nqText) hasHwTo = true; // 💡 텍스트가 있을 때만 유의미한 기록으로 간주
            } else if (l.homework_to) {
              hasHwTo = true; nqText = l.homework_to;
            }
          } catch (e) {}

          let isTestCompleted = undefined;
          let tCut = 0;
          let missionSnapshot = '';
          let todoAchievement = 0;
          let hasTestResult = false;
          try {
            if (l.test_result?.startsWith('{')) {
              const res = JSON.parse(l.test_result);
              isTestCompleted = res.completed === true ? true : (res.completed === false ? false : undefined);
              tCut = res.cut || 0;
              missionSnapshot = res.mission || '';
              todoAchievement = res.todo_achievement || 0;
              // 💡 상태(완료/미완료), 텍스트, 미션, 혹은 성취도가 있을 때만 유의미한 기록으로 간주
              if (isTestCompleted !== undefined || l.test_status || missionSnapshot || todoAchievement > 0) hasTestResult = true;
            }
          } catch (e) {}

          return {
            id: l.id, date: l.session_date, status: (l.status || 'none') as StudentStatus,
            attendance_status: l.attendance_status || '', special_notes: l.special_notes || '',
            classwork_text: l.classwork_text || '', classwork_json: l.classwork_json || [],
            homework_text: l.homework_text || '', homework_json: l.homework_json || [],
            next_quiz_text: nqText, next_quiz_json: nqJson, next_quiz_cut: nqText ? nqCut : (hasHwTo ? nqCut : 0), next_quiz_trial: nqText ? nqTrial : (hasHwTo ? nqTrial : 1),
            test_id: l.test_status || '', test_score: l.test_score, 
            test_cut: tCut, 
            test_completed: isTestCompleted, 
            mission: missionSnapshot,
            todo_achievement: todoAchievement,
            report_sent_at: l.report_sent_at,
            hasHwTo, hasTestResult
          };
        });
        const history = logs.filter(l => l.date < selectedDate).slice(0, 5).map(l => l.status);
        while (history.length < 5) history.push('none');

        const pastLogs = logs.filter(l => l.date < selectedDate).sort((a, b) => b.date.localeCompare(a.date));
        let aggregatedHw = "";
        
        // 💡 기준 수업(baseSession) 찾기: 단순히 최근 날짜가 아니라, 
        // 테스트 계획(next_quiz_text)이나 실제 기록이 남아있는 '마지막 수업'을 끝까지 추적하여 찾음
        let baseSession = pastLogs.find(l => 
          (l.next_quiz_text || l.test_id || l.classwork_text || l.homework_text) && 
          !['결석', '수업취소', '수업제외'].includes(l.attendance_status)
        ) || pastLogs[0];
        
        const dayName = getDayOfWeek(selectedDate);
        const todayLog = logs.find(l => String(l.date) === String(selectedDate));
        
        // 💡 수업일 판정: 정규 요일이거나, 명시적으로 출결(출석/지각/보강)이 입력된 경우
        const isTodayClassDay = s.class_days?.includes(dayName) || 
                                (todayLog?.attendance_status && !['none', ''].includes(todayLog.attendance_status));

        // 💡 1. 활성 계획(Active Plan) 확립
        // 💡 수정: '다음 계획'이 있다면 무조건 그것을 우선함. 계획이 없을 때만 미완료 시험 재시험을 제안함.
        const activePlanText = baseSession?.next_quiz_text || (baseSession?.test_completed === false ? (baseSession.test_id || "") : "");
        const activePlanCut = baseSession?.next_quiz_text ? (Number(baseSession.next_quiz_cut) || 0) : (baseSession?.test_completed === false ? (Number(baseSession.test_cut) || 0) : 0);
        const activePlanTrial = baseSession?.next_quiz_text ? (Number(baseSession.next_quiz_trial) || 1) : (baseSession?.test_completed === false ? 1 : 1);
        const baseMission = baseSession?.mission || s.recent_mission || ""; // 💡 마지막 미션 추적

        if (pastLogs.length > 0) {
          for (const log of pastLogs) {
            if (['결석', '수업취소', '수업제외'].includes(log.attendance_status)) continue;
            if (log.homework_text) {
              const dateStr = log.date ? log.date.slice(5).replace('-', '.') : '';
              const dateLabel = dateStr ? `${dateStr}(${getDayOfWeek(log.date)})\n` : '';
              const line = `${dateLabel}${log.homework_text}`;
              aggregatedHw = aggregatedHw ? `${line}\n\n${aggregatedHw}` : line;
            }
            if (!log.attendance_status?.startsWith('보강')) break;
          }
        }

        if (todayLog) {
          // 💡 학생 미션 자동 채우기: 새로운 입력이 없으면 이전 기록을 계속 유지
          if (!todayLog.mission && baseMission) {
            todayLog.mission = baseMission;
          }

          if (isTodayClassDay) {
            // [수업일] 오늘 테스트 칸에 계획 복사 (기존 기록 보호)
            if (!todayLog.test_id && !todayLog.hasTestResult && activePlanText) {
              todayLog.test_id = activePlanText;
              todayLog.test_cut = activePlanCut;
            }
          } else {
            // [사이 날짜] 다음 테스트 칸에 계획 보존 (기존 기록 보호)
            if (!todayLog.next_quiz_text && !todayLog.hasHwTo && activePlanText) {
              todayLog.next_quiz_text = activePlanText;
              todayLog.next_quiz_cut = activePlanCut;
              todayLog.next_quiz_trial = activePlanTrial;
            }
          }
        }

        const studentSuggestions = (tasksData || []).filter(t => t.title === `[건의] ${s.name}`);
        const teacher = (teachers || []).find(t => t.id === s.teacher_id);
        const teacherInitial = teacher ? getInitial(teacher.name) : '?';

        return {
          id: s.id, academy_id: s.academy_id, teacher_id: s.teacher_id,
          teacher_name: teacher?.name || '',
          teacher_initial: teacherInitial,
          name: s.name, school: s.school || '미지정', grade: s.grade || '미지정', course: s.course || 'C',
          book_courses: s.book_courses || {}, class: s.class_name || '일반반',
          phone: s.phone || '', is_deleted: !!s.is_deleted,
          last_consulted_at: s.last_consulted_at, created_at: s.created_at,
          status_changed_at: s.status_changed_at || s.updated_at,
          class_days: s.class_days || [], assigned_books: s.assigned_books || [], day_schedules: s.day_schedules || {},
          management_notes: s.management_notes || '',
          recent_mission: s.recent_mission || '',
          suggestions: studentSuggestions,
          history, isRedLight: history.includes('poor') || history.includes('bad'),
          lastSession: baseSession ? { ...baseSession, homework_text: aggregatedHw } : undefined, 
          todaySession: todayLog || { 
            id: 'temp', date: selectedDate, status: 'none', attendance_status: '', 
            test_id: isTodayClassDay ? activePlanText : '', 
            test_cut: isTodayClassDay ? activePlanCut : 0, 
            mission: baseMission, // 💡 임시 객체에도 마지막 미션 부여
            next_quiz_text: !isTodayClassDay ? activePlanText : '', 
            next_quiz_cut: !isTodayClassDay ? activePlanCut : 0, 
            next_quiz_trial: !isTodayClassDay ? activePlanTrial : 1, 
            test_completed: undefined 
          } as any,
          allLogs: logs
        };
      }));
      setStudents(enriched); await refreshTextbooks();
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, [selectedDate, refreshTextbooks, slug, academy?.id, fetchTeachers, currentUser]);

  useEffect(() => {
    const checkDate = () => {
      const realToday = getTodayStr();
      if (selectedDate !== realToday) {
        const lastKnownToday = sessionStorage.getItem('ams_last_today');
        if (lastKnownToday && lastKnownToday !== realToday) { setSelectedDate(realToday); }
        sessionStorage.setItem('ams_last_today', realToday);
      }
    };
    const interval = setInterval(checkDate, 60000);
    window.addEventListener('focus', checkDate);
    return () => { clearInterval(interval); window.removeEventListener('focus', checkDate); };
  }, [selectedDate]);

  useEffect(() => { setStudents([]); fetchAllData(true); }, [selectedDate]);

  useEffect(() => {
    if (isLoading || !academy) return;
    const checkBriefing = () => {
      const hasSeenBriefing = sessionStorage.getItem(`ams_briefing_${selectedDate}`);
      if (hasSeenBriefing) return;
      const hasNotes = students.some(s => s.management_notes?.trim());
      const hasAnnouncements = Object.values(academy.announcements || {}).some(v => String(v).trim());
      if (hasNotes || hasAnnouncements) { setShowMorningBriefing(true); }
    };
    checkBriefing();
  }, [isLoading, !!academy, selectedDate, students.length]);

  const saveTodaySession = useCallback(async (studentId: string, sessionData: Partial<SessionLog>) => {
    const student = students.find(s => s.id === studentId);
    if (!student || !academy) return false;
    let sessionId = student.todaySession?.id;

    const ALLOWED_COLUMNS = ['status', 'attendance_status', 'special_notes', 'classwork_text', 'classwork_json', 'homework_text', 'homework_json', 'test_status', 'test_score', 'test_result', 'session_date', 'academy_id', 'student_id', 'homework_to', 'timer_started_at', 'timer_duration'];
    const filteredData: any = {};
    const nqObj = {
      text: ('next_quiz_text' in sessionData) ? sessionData.next_quiz_text : (student.todaySession?.next_quiz_text ?? ''),
      cut: ('next_quiz_cut' in sessionData) ? sessionData.next_quiz_cut : (student.todaySession?.next_quiz_cut ?? 0),
      trial: ('next_quiz_trial' in sessionData) ? sessionData.next_quiz_trial : (student.todaySession?.next_quiz_trial ?? 1),
      json: ('next_quiz_json' in sessionData) ? sessionData.next_quiz_json : (student.todaySession?.next_quiz_json ?? [])
    };
    filteredData['homework_to'] = JSON.stringify(nqObj);
    
    const isTestCompleted = ('test_completed' in sessionData) ? sessionData.test_completed : student.todaySession?.test_completed;
    const currentMission = ('mission' in sessionData) ? sessionData.mission : (student.todaySession?.mission ?? student.recent_mission ?? '');
    
    filteredData['test_result'] = JSON.stringify({ 
      completed: isTestCompleted === true ? true : (isTestCompleted === false ? false : null),
      cut: ('test_cut' in sessionData) ? sessionData.test_cut : (student.todaySession?.test_cut ?? 0),
      mission: currentMission,
      todo_achievement: ('todo_achievement' in sessionData) ? sessionData.todo_achievement : (student.todaySession?.todo_achievement ?? 0)
    });

    Object.keys(sessionData).forEach(key => {
      let dbKey = key === 'date' ? 'session_date' : key;
      if (dbKey === 'test_id') dbKey = 'test_status';
      if (['next_quiz_text', 'next_quiz_cut', 'next_quiz_trial', 'next_quiz_json', 'test_result', 'homework_to', 'test_completed', 'test_cut', 'mission', 'todo_achievement'].includes(dbKey)) return;
      if (ALLOWED_COLUMNS.includes(dbKey)) {
        let val = (sessionData as any)[key];
        if (dbKey === 'test_score') {
          const parsed = parseInt(String(val), 10);
          val = (val === '' || val === undefined || val === null || isNaN(parsed)) ? null : parsed;
        }
        if (dbKey === 'status' && val === 'none') val = null;
        if (dbKey === 'attendance_status' && val === '') val = null;
        filteredData[dbKey] = val;
      }
    });

    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          todaySession: {
            ...(s.todaySession || { id: 'temp', student_id: studentId, academy_id: academy.id, date: selectedDate, session_date: selectedDate }),
            ...filteredData,
            date: selectedDate, status: filteredData.status || 'none',
            test_id: ('test_id' in sessionData) ? sessionData.test_id : s.todaySession?.test_id,
            test_completed: isTestCompleted,
            test_cut: ('test_cut' in sessionData) ? sessionData.test_cut : (s.todaySession?.test_cut ?? 0),
            mission: currentMission,
            todo_achievement: ('todo_achievement' in sessionData) ? sessionData.todo_achievement : (s.todaySession?.todo_achievement ?? 0),
            next_quiz_text: nqObj.text,
            next_quiz_cut: nqObj.cut,
            next_quiz_trial: nqObj.trial,
            next_quiz_json: nqObj.json,
            hasHwTo: !!nqObj.text,
            hasTestResult: isTestCompleted !== undefined || ('test_cut' in sessionData) || ('mission' in sessionData) || ('todo_achievement' in sessionData)
          }
        };
      }
      return s;
    }));

    try {
      const payload: any = { student_id: studentId, student_name: student.name, academy_id: academy.id, session_date: selectedDate, ...filteredData };
      if (sessionId && sessionId !== 'temp') payload.id = sessionId;
      const { error } = await supabase.from('ams_session_logs').upsert([payload], { onConflict: 'student_id,session_date' });
      if (error) throw error; return true;
    } catch (e) { console.error('Save error:', e); await fetchAllData(false); return false; }
  }, [students, academy, selectedDate, fetchAllData]);

  const handleUpdateAcademyInfo = async (updates: any) => {
    if (!academy) return;
    try {
      await supabase.from('ams_academies').update(updates).eq('id', academy.id);
      setAcademy(prev => ({ ...prev, ...updates }));
    } catch (e) { console.error('Update academy error:', e); }
  };

  const handleSaveLegacyProgress = useCallback(async (studentId: string, bookCode: string, unitName: string) => {
    if (!academy) return false;
    try {
      const { data: legacyLog } = await supabase.from('ams_session_logs').select('*').eq('student_id', studentId).eq('session_date', '1900-01-01').maybeSingle();
      let currentCwJson: any[] = []; if (legacyLog && legacyLog.classwork_json) currentCwJson = [...(legacyLog.classwork_json as any[])];
      const bookIdx = currentCwJson.findIndex(j => j.book_name === bookCode);
      if (bookIdx > -1) { const currentUnits = currentCwJson[bookIdx].units || []; if (!currentUnits.includes(unitName)) currentCwJson[bookIdx].units = [...currentUnits, unitName]; } 
      else { currentCwJson.push({ type: 'book', book_name: bookCode, range: 'Legacy Completion', units: [unitName] }); }
      const logData = { student_id: studentId, academy_id: academy.id, session_date: '1900-01-01', classwork_text: `[LEGACY] 진도 수동 보정 데이터`, classwork_json: currentCwJson, status: null };
      if (legacyLog) { await supabase.from('ams_session_logs').update(logData).eq('id', legacyLog.id); } else { await supabase.from('ams_session_logs').insert([logData]); }
      await fetchAllData(false); return true;
    } catch (e) { console.error('Legacy progress error:', e); return false; }
  }, [academy, fetchAllData]);

  const handleAddNewStudent = async (data: any) => {
    if (!academy) return;
    try {
      await supabase.from('ams_students').insert([{ academy_id: academy.id, name: data.name, school: data.school, grade: data.grade, course: data.course, book_courses: data.book_courses || {}, class_name: data.class_name, phone: data.phone, teacher_id: data.teacher_id || null, class_days: data.class_days, day_schedules: data.day_schedules, assigned_books: data.assigned_books, is_deleted: false }]);
      await fetchAllData();
    } catch (e) { console.error(e); }
  };

  const addStudentToToday = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student || (student.todaySession?.id && student.todaySession.id !== 'temp')) return;
    await saveTodaySession(studentId, { attendance_status: '보강', homework_text: student.lastSession?.homework_text || '' });
  };

  const batchAddStudents = async (studentIds: string[], reasons: Record<string, string> = {}) => {
    if (!academy) return;
    setIsLoading(true);
    try {
      const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const newLogs = studentIds.map(id => {
        const s = students.find(st => st.id === id); const reason = reasons[id] || ''; const formatted = reason ? `[${timestamp}] ${reason}` : '';
        const exist = s?.todaySession?.special_notes || ''; const notes = (exist && !exist.includes('[temp]')) ? `${exist}\n${formatted}`.trim() : formatted;
        return { student_id: id, student_name: s?.name, academy_id: academy.id, session_date: selectedDate, attendance_status: '보강', status: null, special_notes: notes };
      });
      const { error } = await supabase.from('ams_session_logs').upsert(newLogs, { onConflict: 'student_id,session_date' });
      if (error) throw error; await fetchAllData(); setIsBatchMode(false);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const removeStudentFromToday = async (studentId: string, reason: string = '') => {
    const student = students.find(s => s.id === studentId); if (!student || !academy) return;
    try {
      const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); const formatted = reason ? `[${timestamp}] ${reason}` : '';
      const exist = student.todaySession?.special_notes || ''; const notes = (exist && !exist.includes('[temp]')) ? `${exist}\n${formatted}`.trim() : formatted;
      const payload: any = { student_id: studentId, student_name: student.name, academy_id: academy.id, session_date: selectedDate, attendance_status: '수업제외', special_notes: notes, status: null };
      if (student.todaySession?.id && student.todaySession.id !== 'temp') payload.id = student.todaySession.id;
      const { error } = await supabase.from('ams_session_logs').upsert([payload], { onConflict: 'student_id,session_date' });
      if (error) throw error; await fetchAllData();
    } catch (e) { console.error(e); }
  };

  const updateStudentInfo = async (studentId: string, fieldOrUpdates: string | any, value?: any) => {
    try {
      if (fieldOrUpdates === 'PERMANENT_DELETE') {
        await supabase.from('ams_session_logs').update({ student_id: null }).eq('student_id', studentId);
        await supabase.from('ams_students').delete().eq('id', studentId); setSelectedStudentId(null);
      } else {
        let updateData: any = (typeof fieldOrUpdates === 'string') ? { [fieldOrUpdates]: value } : { ...fieldOrUpdates };
        await supabase.from('ams_students').update(updateData).eq('id', studentId);
      }
      await fetchAllData();
    } catch (e: any) { console.error(e); }
  };

  const handleAddNewTeacherAccount = async (d: any) => {
    if (!academy) return;
    try { await supabase.from('ams_teachers').insert([{ academy_id: academy.id, login_id: d.login_id, password: d.password, name: d.name, role: d.role }]); await fetchTeachers(academy.id); } 
    catch (e) { console.error(e); }
  };

  const handleDeleteTeacher = async (id: string) => { if (!confirm('삭제하시겠습니까?')) return; await supabase.from('ams_teachers').delete().eq('id', id); if (academy) await fetchTeachers(academy.id); };

  const handleUpdateTeacher = async (id: string, updates: any) => { try { await supabase.from('ams_teachers').update(updates).eq('id', id); if (academy) await fetchTeachers(academy.id); } catch (e) { console.error(e); } };

  const selectedDayKey = getDayOfWeek(selectedDate);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

  const todayStudents = useMemo(() => students.filter(s => {
    if (s.is_deleted === true) return false;
    const hasRealSession = s.todaySession?.id && s.todaySession.id !== 'temp';
    const isScheduledToday = s.class_days.includes(selectedDayKey);
    const attStatus = s.todaySession?.attendance_status || '';
    const isToday = (isScheduledToday && attStatus !== '수업제외') || (hasRealSession && attStatus !== '수업제외' && attStatus !== '');
    if (!isToday) return false;
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;
    if (selectedFilter !== 'All' && (filterTarget === 'today' || filterTarget === 'all')) { if (!s.grade.includes(selectedFilter)) return false; }
    if (selectedDays.length > 0 && (filterTarget === 'today' || filterTarget === 'all')) {
      if (isAndFilter) { if (!selectedDays.every(day => s.class_days.includes(day))) return false; }
      else { if (!s.class_days.some(day => selectedDays.includes(day))) return false; }
    }
    return true;
  }).sort((a, b) => {
    if (sortMode === 'name') return a.name.localeCompare(b.name, 'ko');
    const getStartTime = (student: any, day: string) => {
      const status = student.todaySession?.attendance_status || '';
      if (status.includes(':')) { const parts = status.split(':'); const val = parseInt(parts[parts.length - 1]); if (!isNaN(val) && val < 24) return val; }
      const hours = student.day_schedules?.[day] || [];
      if (hours.length === 0) return 999; return Math.min(...hours.map((h: number) => h % 100));
    };
    const startTimeA = getStartTime(a, selectedDayKey); const startTimeB = getStartTime(b, selectedDayKey);
    if (startTimeA !== startTimeB) return startTimeA - startTimeB; return a.name.localeCompare(b.name, 'ko');
  }), [students, selectedDayKey, selectedFilter, selectedDays, isAndFilter, filterTarget, searchQuery, selectedTeacherId, sortMode]);

  const filteredAllStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedFilter === 'Discharged') { return s.is_deleted === true && s.name.toLowerCase().includes(searchQuery.toLowerCase()); }
      if (s.is_deleted) return false;
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;
      if (selectedFilter !== 'All' && (filterTarget === 'rest' || filterTarget === 'all')) { if (!s.grade.includes(selectedFilter)) return false; }
      if (selectedDays.length > 0 && (filterTarget === 'rest' || filterTarget === 'all')) {
        if (isAndFilter) { if (!selectedDays.every(day => s.class_days.includes(day))) return false; }
        else { if (!s.class_days.some(day => selectedDays.includes(day))) return false; }
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, searchQuery, selectedFilter, selectedDays, isAndFilter, filterTarget, selectedTeacherId]);

  const allTodayIds = useMemo(() => students.filter(s => {
    if (s.is_deleted) return false;
    const hasRealSession = s.todaySession?.id && s.todaySession.id !== 'temp';
    const isScheduledToday = s.class_days.includes(selectedDayKey);
    const attStatus = s.todaySession?.attendance_status || '';
    return (isScheduledToday && attStatus !== '수업제외') || (hasRealSession && attStatus !== '수업제외' && attStatus !== '');
  }).map(s => s.id), [students, selectedDayKey]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] flex font-sans selection:bg-blue-500/30 overflow-hidden text-xs">
      <Sidebar viewMode={viewMode} setViewMode={navigateTo} todayCount={todayStudents.length} students={students} selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter} selectedDays={selectedDays} setSelectedDays={setSelectedDays} isAndFilter={isAndFilter} setIsAndFilter={setIsAndFilter} filterTarget={filterTarget} setFilterTarget={setFilterTarget} academyInfo={academy} onUpdateAcademyInfo={handleUpdateAcademyInfo} teachers={teachers} selectedTeacherId={selectedTeacherId} setSelectedTeacherId={setSelectedTeacherId} />
      <main className="flex-1 h-screen overflow-y-auto bg-[#080808] relative">
        {isLoading ? (<div className="flex flex-col items-center justify-center h-full text-gray-500"><Loader2 className="animate-spin mb-4" size={32} /><p className="text-[10px] font-black uppercase tracking-[0.4em]">Syncing Academy Data...</p></div>) : (
          <div className="h-full">
            {viewMode === 'board' && <Overview todayStudents={todayStudents} filteredAllStudents={filteredAllStudents} allTodayIds={allTodayIds} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={isBatchMode} setIsBatchMode={setIsBatchMode} onBatchAdd={batchAddStudents} onRemoveFromToday={removeStudentFromToday} onAddNewStudent={handleAddNewStudent} masterTextbooks={availableTextbooks} teachers={teachers} consultationCycle={academy?.consultation_cycle || 21} onStartClass={() => setIsClassroomModeOpen(true)} academyInfo={academy} />}
            {viewMode === 'studentEdit' && <Overview todayStudents={[]} filteredAllStudents={filteredAllStudents} allTodayIds={[]} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={false} setIsBatchMode={() => {}} onBatchAdd={async () => {}} onRemoveFromToday={removeStudentFromToday} onAddNewStudent={handleAddNewStudent} masterTextbooks={availableTextbooks} teachers={teachers} title="전체 학생 정보 관리" showAddButton={true} hideTodaySection={true} consultationCycle={academy?.consultation_cycle || 21} academyInfo={academy} />}
            {viewMode === 'todayTable' && <TodaySheet students={todayStudents} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} masterTextbooks={availableTextbooks} onSave={saveTodaySession} onUpdateStudentInfo={updateStudentInfo} academyInfo={academy} currentUser={currentUser} sortMode={sortMode} onSortModeChange={setSortMode} />}
            {viewMode === 'progress' && <ProgressSequencer students={filteredAllStudents} masterTextbooks={availableTextbooks} initialStudentId={activeProgressStudentId} onSaveLegacy={handleSaveLegacyProgress} />}
            {viewMode === 'monthlyChanges' && <MonthlyChanges students={students} />}
            {viewMode === 'notifications' && <NotificationsView academyInfo={academy} students={students} currentUser={currentUser} />}
            {viewMode === 'settings' && <SettingsView teachers={teachers} onAddTeacher={handleAddNewTeacherAccount} onDeleteTeacher={handleDeleteTeacher} onUpdateTeacher={handleUpdateTeacher} onUpdateCurrentUser={handleUpdateCurrentUser} onUpdateAcademyInfo={handleUpdateAcademyInfo} academyInfo={academy} currentUser={currentUser} />}
          </div>
        )}
      </main>
      <AnimatePresence>
        {isClassroomModeOpen && <ClassroomMode students={students} onSave={saveTodaySession} onClose={() => setIsClassroomModeOpen(false)} selectedDate={selectedDate} academyInfo={academy} selectedTeacherId={selectedTeacherId} />}
        {showMorningBriefing && <MorningBriefingModal academyInfo={academy} todayStudents={todayStudents} onClose={() => { setShowMorningBriefing(false); sessionStorage.setItem(`ams_briefing_${selectedDate}`, 'true'); }} />}
        {selectedStudentId && selectedStudent && !isBatchMode && (viewMode === 'studentEdit' ? <StudentDetailDrawer student={selectedStudent} availableTextbooks={availableTextbooks} isRefreshingBooks={isRefreshingBooks} onRefreshBooks={refreshTextbooks} onUpdateInfo={updateStudentInfo} onAddToToday={addStudentToToday} onClose={() => setSelectedStudentId(null)} teachers={teachers} /> : <StudentStudyReportDrawer student={selectedStudent} availableTextbooks={availableTextbooks} onClose={() => setSelectedStudentId(null)} onEditMode={() => navigateTo('studentEdit')} />)}
      </AnimatePresence>
      <AnimatePresence>{selectedStudentId && !isBatchMode && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStudentId(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />)}</AnimatePresence>
    </div>
  );
}
