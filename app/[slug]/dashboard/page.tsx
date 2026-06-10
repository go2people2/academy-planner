'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { getTodayStr, getDayOfWeek, getInitial } from '@/lib/utils';
import { ATTENDANCE_STATUS, normalizeAttendanceStatus } from '@/lib/sessionFieldMap';
import { Student, SessionLog, StudentStatus, TextbookOption } from '@/types/dashboard';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 💡 [리팩토링] 대시보드 데이터 로딩 및 가공 로직 분리
 */

// 1. 교재 코드를 실제 이름으로 변환하는 유틸리티
const translateBookCodes = (text: string, availableTextbooks: any[]) => {
  if (!text || !availableTextbooks || availableTextbooks.length === 0) return text;
  let result = text;
  const sortedMaster = [...availableTextbooks].sort((a, b) => (b.bookcode?.length || 0) - (a.bookcode?.length || 0));
  sortedMaster.forEach(m => {
    if (m.bookcode && m.title) {
      const escapedCode = m.bookcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedCode, 'gi');
      result = result.replace(regex, m.title);
    }
  });
  return result;
};

// 2. [추가] 예정 테스트 정보 파싱 헬퍼
const parseHomeworkTo = (homeworkToRaw: any) => {
  let text = '', cut = 0, trial = 1, json = [];
  let hasHwTo = false;
  try {
    if (homeworkToRaw?.startsWith('{')) {
      const parsed = JSON.parse(homeworkToRaw);
      text = parsed.text || ''; cut = parsed.cut || 0; trial = parsed.trial || 1; json = parsed.json || [];
      if (text) hasHwTo = true;
    } else if (homeworkToRaw) {
      hasHwTo = true; text = homeworkToRaw;
    }
  } catch (e) {}
  return { text, cut, trial, json, hasHwTo };
};

// 3. [추가] 테스트 결과 정보 파싱 헬퍼
const parseTestResult = (testResultRaw: any, testStatus: string) => {
  let isTestCompleted = undefined;
  let tCut = 0;
  let missionSnapshot = '';
  let todoAchievement = 0;
  let sType: 'score' | 'count' = 'score';
  let tTotal = 0;
  let hasTestResult = false;
  try {
    if (testResultRaw?.startsWith('{')) {
      const res = JSON.parse(testResultRaw);
      isTestCompleted = res.completed === true ? true : (res.completed === false ? false : undefined);
      tCut = res.cut || 0;
      missionSnapshot = res.mission || '';
      todoAchievement = res.todo_achievement || 0;
      sType = res.score_type || 'score';
      tTotal = res.total_count || 0;
      if (isTestCompleted !== undefined || testStatus || missionSnapshot || todoAchievement > 0) hasTestResult = true;
    }
  } catch (e) {}
  return { isTestCompleted, tCut, missionSnapshot, todoAchievement, sType, tTotal, hasTestResult };
};

// 4. 개별 DB 로그를 SessionLog 형식으로 변환
const buildSessionLog = (l: any, textbooks: any[]): SessionLog => {
  const nq = parseHomeworkTo(l.homework_to);
  const tr = parseTestResult(l.test_result, l.test_status);

  return {
    id: l.id, date: l.session_date, status: (l.status || 'none') as StudentStatus,
    attendance_status: normalizeAttendanceStatus(l.attendance_status), 
    special_notes: translateBookCodes(l.special_notes || '', textbooks),
    classwork_text: translateBookCodes(l.classwork_text || '', textbooks), classwork_json: l.classwork_json || [],
    completed_classwork_text: translateBookCodes(l.completed_classwork_text || '', textbooks), 
    completed_classwork_json: l.completed_classwork_json || [],
    homework_text: translateBookCodes(l.homework_text || '', textbooks), homework_json: l.homework_json || [],
    next_quiz_text: translateBookCodes(nq.text, textbooks), next_quiz_json: nq.json, next_quiz_cut: nq.text ? nq.cut : (nq.hasHwTo ? nq.cut : 0), next_quiz_trial: nq.text ? nq.trial : (nq.hasHwTo ? nq.trial : 1),
    test_id: translateBookCodes(l.test_status || '', textbooks), test_score: l.test_score, 
    test_score_type: tr.sType,
    test_total_count: tr.tTotal,
    test_cut: tr.tCut, 
    test_completed: tr.isTestCompleted, 
    mission: translateBookCodes(tr.missionSnapshot, textbooks),
    todo_achievement: tr.todoAchievement,
    report_sent_at: l.report_sent_at,
    timer_started_at: l.timer_started_at,
    timer_duration: l.timer_duration,
    moved_to_hour: (() => {
      // 💡 [데이터 모델 전이] 신규 저장은 moved_to_hour 필드를 사용하지만,
      // 기존 attendance_status에 시간이 인코딩된 구형 데이터는 읽기 단계(Read-side)에서만 하위 호환을 위해 파싱합니다.
      if (l.moved_to_hour !== undefined && l.moved_to_hour !== null) return l.moved_to_hour;
      const status = l.attendance_status || '';
      if (status.includes(':')) {
        const parts = status.split(':');
        const val = parseInt(parts[parts.length - 1]);
        if (!isNaN(val) && val < 24) return val;
      }
      return null;
    })(),
    hasHwTo: nq.hasHwTo, hasTestResult: tr.hasTestResult
  };
};

// 5. 과거 숙제 내역 취합 유틸리티
const calculateAggregatedHw = (pastLogs: SessionLog[], academy: any) => {
  let aggregatedHw = "";
  if (pastLogs.length === 0) return "";

  for (const log of pastLogs) {
    const isLogHoliday = (academy?.operation_settings?.holidays || []).some((h: any) => h.date === log.date);
    if (isLogHoliday && !log.attendance_status?.startsWith(ATTENDANCE_STATUS.SUPPLEMENT)) continue;
    if (!log.attendance_status || log.attendance_status === ATTENDANCE_STATUS.BEFORE) continue;
    if ([ATTENDANCE_STATUS.ABSENT, ATTENDANCE_STATUS.CANCELED, ATTENDANCE_STATUS.EXCLUDED].includes(log.attendance_status as any)) continue;
    
    if (log.homework_text) {
      const dateStr = log.date ? log.date.slice(5).replace('-', '.') : '';
      const line = `${dateStr}(${getDayOfWeek(log.date)})\n${log.homework_text}`;
      aggregatedHw = aggregatedHw ? `${line}\n\n${aggregatedHw}` : line;
    }
    if ([ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE].some(st => log.attendance_status.startsWith(st))) break;
  }
  return aggregatedHw;
};

// 4. 오늘의 세션 데이터 결정 및 이월 로직
const determineTodaySession = (
  student: any, todayLog: SessionLog | undefined, baseSession: SessionLog | undefined, 
  isTodayClassDay: boolean, selectedDate: string, academy: any
) => {
  const activePlanText = baseSession?.next_quiz_text || (baseSession?.test_completed === false ? (baseSession.test_id || "") : "");
  const activePlanCut = baseSession?.next_quiz_text ? (Number(baseSession.next_quiz_cut) || 0) : (baseSession?.test_completed === false ? (Number(baseSession.test_cut) || 0) : 0);
  const activePlanTrial = baseSession?.next_quiz_text ? (Number(baseSession.next_quiz_trial) || 1) : (baseSession?.test_completed === false ? 1 : 1);
  const baseMission = baseSession?.mission || student.recent_mission || "";
  
  // 💡 [개선] 이전 수업의 점수 입력 타입(score/count)을 기본값으로 상속
  const defaultScoreType = baseSession?.test_score_type || 'score';

  if (todayLog) {
    if (!todayLog.mission && baseMission) todayLog.mission = baseMission;
    
    // 💡 [개선] 타입 정보가 없는 기존 로그에도 기본 타입 적용
    if (!todayLog.test_score_type) todayLog.test_score_type = defaultScoreType;

    if (isTodayClassDay) {
      const isSkipped = [ATTENDANCE_STATUS.EXCLUDED, ATTENDANCE_STATUS.ABSENT, ATTENDANCE_STATUS.CANCELED].includes(todayLog.attendance_status as any);
      if (!todayLog.test_id && activePlanText && !isSkipped) {
        todayLog.test_id = activePlanText; todayLog.test_cut = activePlanCut;
      }
    } else if (!todayLog.next_quiz_text && activePlanText) {
      todayLog.next_quiz_text = activePlanText; todayLog.next_quiz_cut = activePlanCut; todayLog.next_quiz_trial = activePlanTrial;
    }
    return todayLog;
  }

  return { 
    id: 'temp', date: selectedDate, status: 'none', 
    attendance_status: ATTENDANCE_STATUS.BEFORE, 
    test_id: isTodayClassDay ? activePlanText : '', test_cut: isTodayClassDay ? activePlanCut : 0, 
    mission: baseMission, next_quiz_text: !isTodayClassDay ? activePlanText : '', 
    next_quiz_cut: !isTodayClassDay ? activePlanCut : 0, next_quiz_trial: !isTodayClassDay ? activePlanTrial : 1, 
    test_completed: undefined,
    test_score_type: defaultScoreType // 💡 [추가] 초기 타입 상속
  } as any;
};

// 5. 학생의 최근 5회차 학습 상태 히스토리 계산
const calculateStudentHistory = (logs: SessionLog[], targetDate: string): StudentStatus[] => {
  const history = logs.filter(l => l.date < targetDate).slice(0, 5).map(l => l.status);
  while (history.length < 5) history.push('none');
  return history;
};

// 6. 오늘 수업 계획의 모태가 될 과거 세션(베이스 세션) 선택
const selectBaseSession = (logs: SessionLog[], targetDate: string, holidays: any[]): SessionLog | undefined => {
  const pastLogs = logs.filter(l => l.date < targetDate).sort((a, b) => b.date.localeCompare(a.date));
  return pastLogs.find(l => {
    const isLogHoliday = (holidays || []).some((h: any) => h.date === l.date);
    const isMakeup = l.attendance_status?.startsWith(ATTENDANCE_STATUS.SUPPLEMENT);
    return (l.next_quiz_text || l.test_id || l.classwork_text || l.homework_text) && 
           ![ATTENDANCE_STATUS.ABSENT, ATTENDANCE_STATUS.CANCELED, ATTENDANCE_STATUS.EXCLUDED].includes(l.attendance_status as any) && (!isLogHoliday || isMakeup); 
  }) || pastLogs[0];
};

// 7. 오늘의 수업 여부 및 휴일 상태 판정 (순수 스케줄 기반)
const evaluateTodayStatus = (targetDate: string, classDays: string[], holidays: any[]) => {
  const isScheduledDay = classDays?.map((d: string) => d.trim()).includes(getDayOfWeek(targetDate));
  const isHoliday = (holidays || []).some((h: any) => h.date === targetDate);
  const isTodayClassDay = isScheduledDay && !isHoliday;
  return { isScheduledDay, isHoliday, isTodayClassDay };
};

// 8. 학생 담당 교사 정보 추출
const findTeacherInfo = (teachers: any[], teacherId?: string, fallbackName?: string) => {
  const teacher = (teachers || []).find(t => t.id === teacherId);
  return {
    name: teacher?.name || '',
    initial: teacher ? (teacher.initials || getInitial(teacher.name)) : (fallbackName ? getInitial(fallbackName) : '?')
  };
};

// 9. 학생 1명의 데이터 보강 (최종 조합)
const getEnrichedStudentData = (
  s: any, logsData: any[], selectedDate: string, 
  availableTextbooks: any[], academy: any, teachers: any[], tasksData: any[]
) => {
  const logs = (logsData || []).map(l => buildSessionLog(l, availableTextbooks));
  
  const history = calculateStudentHistory(logs, selectedDate);
  const baseSession = selectBaseSession(logs, selectedDate, academy?.operation_settings?.holidays);
  const todayLog = logs.find(l => String(l.date) === String(selectedDate));
  
  const { isHoliday, isTodayClassDay: isScheduledToday } = evaluateTodayStatus(selectedDate, s.class_days, academy?.operation_settings?.holidays);
  const isMakeup = todayLog?.attendance_status?.startsWith(ATTENDANCE_STATUS.SUPPLEMENT) || (todayLog?.moved_to_hour !== undefined && todayLog?.moved_to_hour !== null);
  const isSkipped = todayLog?.attendance_status === ATTENDANCE_STATUS.EXCLUDED;
  const isTodayClassDay = (isScheduledToday || isMakeup) && !isSkipped; // 💡 최종 수업 대상 여부
  
  const pastLogs = logs.filter(l => l.date < selectedDate).sort((a, b) => b.date.localeCompare(a.date));
  const aggregatedHw = calculateAggregatedHw(pastLogs, academy);
  const todaySession = determineTodaySession(s, todayLog, baseSession, isTodayClassDay, selectedDate, academy);

  const tInfo = findTeacherInfo(teachers, s.teacher_id, s.teacher_name);

  return {
    ...s, teacher_name: tInfo.name, teacher_initial: tInfo.initial,
    school: s.school || '미지정', grade: s.grade || '미지정', course: s.course || 'C', book_courses: s.book_courses || {}, class: s.class_name || '일반반',
    is_deleted: !!s.is_deleted, class_days: s.class_days || [], assigned_books: s.assigned_books || [],
    suggestions: (tasksData || []).filter(t => t.title === `[건의] ${s.name}`),
    history, isRedLight: history.includes('poor') || history.includes('bad'),
    lastSession: baseSession ? { ...baseSession, homework_text: aggregatedHw } : undefined, 
    todaySession, allLogs: logs,
    isTodayClassDay // 💡 필터링용 속성 추가
  };
};

/**
 * 💡 [리팩토링] 파생 상태 계산 및 필터링 유틸리티
 */

// 1. 학생의 오늘 수업 시작 시각 계산 (정렬용)
const getStudentStartTime = (student: any, day: string) => {
  // 1. 시간 이동 필드(moved_to_hour) 우선 사용
  if (student.todaySession?.moved_to_hour !== undefined && student.todaySession?.moved_to_hour !== null) {
    return student.todaySession.moved_to_hour;
  }

  // 2. [호환성] attendance_status에 인코딩된 시간 정보 파싱
  const status = student.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
  if (status.includes(':')) { 
    const parts = status.split(':'); 
    const val = parseInt(parts[parts.length - 1]); 
    if (!isNaN(val) && val < 24) return val; 
  }

  // 3. 기본 스케줄 사용
  const hours = student.day_schedules?.[day] || [];
  if (hours.length === 0) return 999; 
  return Math.min(...hours.map((h: number) => h % 100));
};

// 💡 [추가] 학생 정보 수정 모드 전용 최소 필터링 로직 (날짜 로직 완전 배제)
const getPureFilteredStudents = (params: {
  students: Student[],
  searchQuery: string,
  selectedTeacherId: string,
  selectedFilter: string,
  selectedDays: string[],
  isAndFilter: boolean
}) => {
  const { students, searchQuery, selectedTeacherId, selectedFilter, selectedDays, isAndFilter } = params;
  
  return students.filter(s => {
    // 1. 퇴원생 필터 처리
    if (selectedFilter === 'Discharged') {
      return s.is_deleted === true && s.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    if (s.is_deleted) return false;

    // 2. 검색어 필터
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // 3. 담당 선생님 필터
    if (selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;

    // 4. 학년 필터
    if (selectedFilter !== 'All' && !s.grade.includes(selectedFilter)) return false;
    
    // 5. 수업 요일 필터
    if (selectedDays.length > 0) {
      const matchesDays = isAndFilter 
        ? selectedDays.every(day => s.class_days.includes(day))
        : selectedDays.some(day => s.class_days.includes(day));
      if (!matchesDays) return false;
    }

    return true;
  });
};

// 2. 공통 대시보드 학생 필터링 로직 (오늘/나머지 분류용)
const filterStudentList = (params: {
  students: Student[],
  selectedDayKey: string,
  selectedDate: string,
  academy: any,
  searchQuery: string,
  selectedTeacherId: string,
  selectedFilter: string,
  selectedDays: string[],
  isAndFilter: boolean,
  filterTarget: 'today' | 'rest'
}) => {
  const { students, selectedDayKey, selectedDate, academy, searchQuery, selectedTeacherId, selectedFilter, selectedDays, isAndFilter, filterTarget } = params;
  
  return students.filter(s => {
    // 퇴원생 필터 처리
    if (selectedFilter === 'Discharged') {
      return s.is_deleted === true && s.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    if (s.is_deleted) return false;

    const isTodaySession = s.isTodayClassDay;

    // 검색어 필터
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // 담당 선생님 필터
    if (selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;

    const isTodayTarget = filterTarget === 'today';
    const isRestTarget = filterTarget === 'rest';

    if (isTodayTarget && isTodaySession) {
      if (selectedFilter !== 'All' && !s.grade.includes(selectedFilter)) return false;
      if (selectedDays.length > 0) {
        const matchesDays = isAndFilter 
          ? selectedDays.every(day => s.class_days.includes(day))
          : selectedDays.some(day => s.class_days.includes(day)); 
        if (!matchesDays) return false;
      }
      return true;
    }

    if (isRestTarget && !isTodaySession) {
      if (selectedFilter !== 'All' && !s.grade.includes(selectedFilter)) return false;
      if (selectedDays.length > 0) {
        const matchesDays = isAndFilter 
          ? selectedDays.every(day => s.class_days.includes(day))
          : selectedDays.some(day => s.class_days.includes(day));
        if (!matchesDays) return false;
      }
      return true;
    }

    return false;
  });
};

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

    // 💡 [임시 디버그] 페이지 로드 시 현재 Auth 세션 클레임 즉시 출력
    const checkAuthSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('--- [AUTH CHECK ON LOAD] ---');
      console.log('user.id =', session?.user?.id);
      console.log('app_metadata =', session?.user?.app_metadata);
      console.log('user_metadata =', session?.user?.user_metadata);
      console.log('----------------------------');
    };
    checkAuthSession();
  }, [slug, router]);

  const [academy, setAcademy] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('All');
  const [isAndFilter, setIsAndFilter] = useState(false);
  const [filterTarget, setFilterTarget] = useState<'all' | 'today' | 'rest'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [studentEditSearchQuery, setStudentEditSearchQuery] = useState(''); // 💡 학생 정보 수정용 검색 상태 분리
  
  // 💡 [추가] 주안점 탭 전환 유실 방지용 상위 Draft 상태 및 Dirty 플래그 (Stale Closure 방지용 Ref 포함) - HMR 캐시 무효화용 수정
  const [noticeDrafts, setNoticeDrafts] = useState<Record<string, string>>({ monthly: '', weekly: '', daily: '' });
  const [noticeDirty, setNoticeDirty] = useState<Record<string, boolean>>({ monthly: false, weekly: false, daily: false });
  const noticeDirtyRef = useRef<Record<string, boolean>>({ monthly: false, weekly: false, daily: false });

  // 💡 [추가] Notice Draft 갱신 핸들러 (입력 중 State & Ref 동시 갱신)
  const handleNoticeDraftChange = (key: string, value: string) => {
    setNoticeDrafts(prev => ({ ...prev, [key]: value }));
    setNoticeDirty(prev => ({ ...prev, [key]: true }));
    noticeDirtyRef.current[key] = true;
  };

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

    // 💡 [방어] 일반 교사의 설정 화면 진입 차단
    if (mode === 'settings' && currentUser?.role !== 'admin' && currentUser?.role !== 'master') {
      alert('권한이 없습니다.');
      return;
    }

    setViewMode(mode); setSelectedStudentId(null); 
    if (!skipHistory) {
      setNavHistory(prev => {
        const newHist = prev.slice(0, historyIdx + 1);
        newHist.push(mode);
        setHistoryIdx(newHist.length - 1);
        return newHist;
      });
    }
  }, [viewMode, historyIdx, currentUser?.role]);

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

  const fetchTeachers = useCallback(async (academyId: string) => {
    try {
      const { data, error } = await supabase.from('ams_teachers').select('*').eq('academy_id', academyId).order('name', { ascending: true });
      if (!error) {
        setTeachers(data || []);
        return data || []; // 💡 데이터 반환 추가
      }
    } catch (e) { console.error(e); }
    return [];
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
      let currentTeachers = teachers; // 💡 로컬 변수 사용

      if (!currentAcademy) {
        const normalizedSlug = (Array.isArray(slug) ? slug[0] : slug || '').toLowerCase();
        const { data: acData } = await supabase.from('ams_academies').select('*').eq('slug', normalizedSlug).maybeSingle();
        if (acData) { 
          const announcements = { monthly: '', weekly: '', daily: '', ...(acData.announcements || {}) };
          const enrichedAcademy = { ...acData, announcements };
          setAcademy(enrichedAcademy); 
          currentAcademy = enrichedAcademy; 
          currentTeachers = await fetchTeachers(acData.id); 
        } else { setIsLoading(false); return; }
      } else { 
        // 백그라운드 갱신 시 최신 학원 정보 가져오기 (주안점 등 동기화 위해)
        const { data: acData } = await supabase.from('ams_academies').select('*').eq('id', currentAcademy.id).maybeSingle();
        if (acData) {
           const announcements = { monthly: '', weekly: '', daily: '', ...(acData.announcements || {}) };
           const enrichedAcademy = { ...acData, announcements };
           setAcademy(enrichedAcademy);
           currentAcademy = enrichedAcademy;
        }
        currentTeachers = await fetchTeachers(currentAcademy.id); 
      }

      // 💡 [개선] 매 데이터 로드 시마다 Draft 세팅 (Stale Closure를 막기 위해 Ref 기반으로 편집 여부 판단)
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
      if (user && user.role === 'teacher') { studentsQuery = studentsQuery.eq('teacher_id', user.id); }

      const { data: studentsData, error: sErr } = await studentsQuery;
      if (sErr) throw sErr;

      const { data: tasksData } = await supabase.from('ams_tasks')
        .select('*').eq('academy_id', currentAcademy.id).eq('is_completed', false).like('title', '[건의]%');

      // 2. 개별 학생 데이터 보강 (Enrichment)
      const enriched = await Promise.all((studentsData || []).map(async (s) => {
        const { data: logsData } = await supabase.from('ams_session_logs')
          .select('*').eq('student_id', s.id).order('session_date', { ascending: false }).limit(20);
        
        return getEnrichedStudentData(
          s, logsData || [], selectedDate, availableTextbooks, 
          currentAcademy, currentTeachers, tasksData || []
        );
      }));

      setStudents(enriched);
    } catch (e) { 
      console.error('Fetch All Data Error:', e); 
    } finally { 
      setIsLoading(false); 
    }
  }, [selectedDate, slug, academy, teachers, fetchTeachers, currentUser]);

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

  // 💡 [추가] 초기 로드 시 교재 마스터 목록 로드
  useEffect(() => { refreshTextbooks(); }, [refreshTextbooks, slug]);

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

/**
 * 💡 [리팩토링] 저장 페이로드 조립 헬퍼
 */

// 1. ALLOWED_COLUMNS 기준 필터링 및 데이터 정제
const getFilteredBaseFields = (sessionData: any) => {
  const ALLOWED_COLUMNS = [
    'status', 'attendance_status', 'special_notes', 'classwork_text', 'classwork_json', 
    'completed_classwork_text', 'completed_classwork_json',
    'homework_text', 'homework_json', 'test_status', 'test_score', 'test_result', 
    'session_date', 'academy_id', 'student_id', 'homework_to', 'timer_started_at', 'timer_duration',
    'moved_to_hour'
  ];
  const filtered: any = {};
  Object.keys(sessionData).forEach(key => {
    let dbKey = key === 'date' ? 'session_date' : key;
    if (dbKey === 'test_id') dbKey = 'test_status';
    
    // JSON 필드 및 파생 필드 제외 (메인에서 별도 처리)
    if (['next_quiz_text', 'next_quiz_cut', 'next_quiz_trial', 'next_quiz_json', 'test_result', 'homework_to', 'test_completed', 'test_cut', 'mission', 'todo_achievement', 'test_score_type', 'test_total_count'].includes(dbKey)) return;
    
    if (ALLOWED_COLUMNS.includes(dbKey)) {
      let val = (sessionData as any)[key];
      
      // 💡 [개선] attendance_status는 오직 명시적으로 전달된 경우에만 포함 (undefined면 제외)
      if (dbKey === 'attendance_status' && val === undefined) return;

      if (dbKey === 'test_score') {
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

// 2. 테스트 결과 JSON 안전 병합 (기존 모든 키 보존)
const buildMergedTestResult = (existingJsonRaw: any, sessionData: any, fallbacks: {
  completed: any, mission: string, cut: string | number, achievement: number, sType: string, tTotal: number
}) => {
  let existing = {};
  try {
    if (existingJsonRaw) existing = (typeof existingJsonRaw === 'string' ? JSON.parse(existingJsonRaw) : existingJsonRaw);
  } catch (e) { console.error('Failed to parse existing test_result:', e); }

  const isCompleted = ('test_completed' in sessionData) ? sessionData.test_completed : fallbacks.completed;
  
  return JSON.stringify({ 
    ...existing,
    completed: isCompleted === true ? true : (isCompleted === false ? false : null),
    cut: ('test_cut' in sessionData) ? sessionData.test_cut : fallbacks.cut,
    mission: ('mission' in sessionData) ? sessionData.mission : fallbacks.mission,
    todo_achievement: ('todo_achievement' in sessionData) ? sessionData.todo_achievement : fallbacks.achievement,
    score_type: ('test_score_type' in sessionData) ? sessionData.test_score_type : fallbacks.sType,
    total_count: ('test_total_count' in sessionData) ? sessionData.test_total_count : fallbacks.tTotal
  });
};

const saveTodaySession = useCallback(async (studentId: string, sessionData: Partial<SessionLog>) => {
  const student = students.find(s => s.id === studentId);
  if (!student || !academy) return false;
  let sessionId = student.todaySession?.id;

  // 1. 기본 필드 필터링
  const filteredData = getFilteredBaseFields(sessionData);

  // 2. 예정 테스트 정보 가공 (homework_to)
  const nqObj = {
    text: ('next_quiz_text' in sessionData) ? sessionData.next_quiz_text : (student.todaySession?.next_quiz_text ?? ''),
    cut: ('next_quiz_cut' in sessionData) ? sessionData.next_quiz_cut : (student.todaySession?.next_quiz_cut ?? 0),
    trial: ('next_quiz_trial' in sessionData) ? sessionData.next_quiz_trial : (student.todaySession?.next_quiz_trial ?? 1),
    json: ('next_quiz_json' in sessionData) ? sessionData.next_quiz_json : (student.todaySession?.next_quiz_json ?? [])
  };
  filteredData['homework_to'] = JSON.stringify(nqObj);
  
  // 3. 테스트 결과 정보 병합 (test_result)
  filteredData['test_result'] = buildMergedTestResult(
    student.todaySession?.test_result, 
    sessionData, 
    {
      completed: student.todaySession?.test_completed,
      mission: student.todaySession?.mission ?? student.recent_mission ?? '',
      cut: student.todaySession?.test_cut ?? 0,
      achievement: student.todaySession?.todo_achievement ?? 0,
      sType: student.todaySession?.test_score_type ?? 'score',
      tTotal: student.todaySession?.test_total_count ?? 0
    }
  );

  setStudents(prev => prev.map(s => {
    if (s.id === studentId) {
      const isTestCompleted = ('test_completed' in sessionData) ? sessionData.test_completed : s.todaySession?.test_completed;
      const currentMission = ('mission' in sessionData) ? sessionData.mission : (s.todaySession?.mission ?? s.recent_mission ?? '');
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
      if (sessionId && sessionId !== 'temp') {
        payload.id = sessionId;
      } else {
        if (!('attendance_status' in filteredData)) {
          payload.attendance_status = null;
        }
      }

      // 💡 [개선] 전체 리페치 대신 서버에서 저장된 최신 데이터를 받아와서 로컬 상태에 직접 주입
      const { data: savedLog, error } = await supabase
        .from('ams_session_logs')
        .upsert([payload], { onConflict: 'student_id,session_date' })
        .select()
        .maybeSingle();

      if (error) throw error;

      if (savedLog) {
        setStudents(prev => prev.map(s => {
          if (s.id === studentId) {
            const nextQuiz = savedLog.homework_to ? (typeof savedLog.homework_to === 'string' ? JSON.parse(savedLog.homework_to) : savedLog.homework_to) : {};
            const testRes = savedLog.test_result ? (typeof savedLog.test_result === 'string' ? JSON.parse(savedLog.test_result) : savedLog.test_result) : {};
            
            return {
              ...s,
              todaySession: {
                ...savedLog,
                date: savedLog.session_date,
                status: savedLog.status || 'none',
                test_id: savedLog.test_status,
                test_score_type: testRes.score_type || 'score', // 💡 JSON에서 추출
                test_total_count: testRes.total_count || 0,     // 💡 JSON에서 추출
                test_completed: testRes.completed,
                test_cut: testRes.cut || 0,
                mission: testRes.mission || '',
                todo_achievement: testRes.todo_achievement || 0,
                next_quiz_text: nextQuiz.text || '',
                next_quiz_cut: nextQuiz.cut || 0,
                next_quiz_trial: nextQuiz.trial || 1,
                next_quiz_json: nextQuiz.json || [],
                hasHwTo: !!nextQuiz.text,
                hasTestResult: true
              }
            };
          }
          return s;
        }));
      }

      return true;
    } catch (e) { 
      console.error('Save error:', e); 
      // 💡 실패 시에도 전체 리페치를 하지 않고 에러만 출력 (사용자 입력값 보존을 위해)
      return false; 
    }
  }, [students, academy, selectedDate]);

  const handleUpdateAcademyInfo = async (updates: any) => {
    if (!academy?.id) return;
    const academyId = academy.id;

    // 💡 [임시 디버그] 현재 세션의 클레임(Claim) 정보 출력
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[AUTH CHECK] user.id =', session?.user?.id);
    console.log('[AUTH CHECK] app_metadata =', session?.user?.app_metadata);
    console.log('[AUTH CHECK] user_metadata =', session?.user?.user_metadata);

    try {
      // 💡 [Surgical Update] 변경된 필드만 추출하여 페이로드 조립
      const dbPayload: any = {};
      Object.keys(updates).forEach(key => {
        if (typeof updates[key] === 'object' && updates[key] !== null && academy[key]) {
          dbPayload[key] = { ...academy[key], ...updates[key] };
        } else {
          dbPayload[key] = updates[key];
        }
      });

      console.log('[LOG 3] handleUpdateAcademyInfo. Target ID:', academyId);
      console.log('[LOG 3] dbPayload to send:', dbPayload);

      // 💡 [수정] .single()을 제거하여 0행일 때의 406 에러 방지
      const { data, error, status } = await supabase
        .from('ams_academies')
        .update(dbPayload)
        .eq('id', academyId)
        .select();

      console.log('[LOG 4] Supabase Response:', { error, data, status, affectedRows: data?.length });

      if (error) {
        console.error('Update academy error:', error);
        alert('저장 실패: ' + error.message);
      } else if (data && data.length > 0) {
        // ✅ DB 성공 시에만 로컬 상태 반영 (affectedRows: 1)
        setAcademy((prev: any) => ({ ...prev, ...data[0] }));

        // 💡 [추가] 성공적으로 저장된 필드만 dirty 플래그 해제 (State & Ref 모두) 및 Draft 강제 동기화
        if (updates.announcements) {
          setNoticeDirty(prev => {
            const next = { ...prev };
            Object.keys(updates.announcements).forEach(k => { 
              next[k] = false; 
              noticeDirtyRef.current[k] = false; 
            });
            return next;
          });
          // 저장 성공한 값으로 Draft 최신화 (사용자 입력 확정)
          setNoticeDrafts(prev => ({ ...prev, ...updates.announcements }));
        }

        // 💡 [LOG 5] DB 재조회로 영속성 최종 증명
        const { data: proof } = await supabase
          .from('ams_academies')
          .select('announcements')
          .eq('id', academyId)
          .maybeSingle();
        console.log('[LOG 5] DB Direct Verification (announcements):', proof?.announcements);
      } else {
        // 💡 [경고] 0행 업데이트됨 (주로 RLS 정책 위반)
        console.warn('[LOG 4] No rows affected. Check RLS policies for ID:', academyId);
        alert('저장 실패: 수정 권한이 없거나 대상을 찾을 수 없습니다. (RLS Check 필요)');
      }
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
      await fetchAllData(false);
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
        const s = students.find(st => st.id === id);
        if (!s) return null;
        const reason = reasons[id] || ''; 
        const formatted = reason ? `[${timestamp}] ${reason}` : '';
        const exist = s.todaySession?.special_notes || ''; 
        const notes = (exist && !exist.includes('[temp]')) ? `${exist}\n${formatted}`.trim() : formatted;
        
        const log: any = { 
          student_id: id, 
          student_name: s.name, 
          academy_id: academy.id, 
          session_date: selectedDate, 
          attendance_status: '보강', 
          status: null, 
          special_notes: notes 
        };
        if (s.todaySession?.id && s.todaySession.id !== 'temp') log.id = s.todaySession.id;
        return log;
      }).filter(Boolean);

      if (newLogs.length === 0) {
        setIsBatchMode(false);
        return;
      }

      const { error } = await supabase.from('ams_session_logs').upsert(newLogs, { onConflict: 'student_id,session_date' });
      if (error) throw error;
      await fetchAllData(false); 
      setIsBatchMode(false);
    } catch (e) { 
      console.error('Batch Add Error:', e); 
      alert('일괄 추가 중 오류가 발생했습니다.');
    } finally { 
      setIsLoading(false); 
    }
  };

  const removeStudentFromToday = async (studentId: string, reason: string = '') => {
    const student = students.find(s => s.id === studentId); if (!student || !academy) return;
    try {
      const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); const formatted = reason ? `[${timestamp}] ${reason}` : '';
      const exist = student.todaySession?.special_notes || ''; const notes = (exist && !exist.includes('[temp]')) ? `${exist}\n${formatted}`.trim() : formatted;
      const payload: any = { student_id: studentId, student_name: student.name, academy_id: academy.id, session_date: selectedDate, attendance_status: '수업제외', special_notes: notes, status: null };
      if (student.todaySession?.id && student.todaySession.id !== 'temp') payload.id = student.todaySession.id;
      const { error } = await supabase.from('ams_session_logs').upsert([payload], { onConflict: 'student_id,session_date' });
      if (error) throw error; await fetchAllData(false);
    } catch (e) { 
      console.error('Remove Student Error:', e); 
      alert('학생 제외 중 오류가 발생했습니다.');
    }
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
      await fetchAllData(false);
    } catch (e: any) { console.error(e); }
  };

  const handleAddNewTeacherAccount = async (d: any) => {
    if (!academy) return;
    try { 
      await supabase.from('ams_teachers').insert([{ 
        academy_id: academy.id, 
        login_id: d.login_id, 
        password: d.password, 
        name: d.name, 
        initials: d.initials, // 💡 추가
        role: d.role 
      }]); 
      await fetchTeachers(academy.id); 
    } 
    catch (e) { console.error(e); }
  };

  const handleDeleteTeacher = async (id: string) => { if (!confirm('삭제하시겠습니까?')) return; await supabase.from('ams_teachers').delete().eq('id', id); if (academy) await fetchTeachers(academy.id); };

  const handleUpdateTeacher = async (id: string, updates: any) => { 
    try { 
      console.log(`Updating teacher ${id}:`, updates);
      
      // 💡 [개선] 권한 동기화를 위해 직접 DB 업데이트 대신 전용 서버 API 호출
      const res = await fetch(`/api/teachers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        const errData = await res.json();
        console.error('Update Error:', errData.error);
        alert('저장 실패: ' + errData.error);
      } else {
        console.log('Update Success');
        if (academy) await fetchTeachers(academy.id); 
      }
    } catch (e) { console.error(e); } 
  };

  const selectedDayKey = getDayOfWeek(selectedDate);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

  // 1. 오늘의 학생 리스트 (필터링 + 정렬)
  const todayStudents = useMemo(() => {
    const list = filterStudentList({
      students, selectedDayKey, selectedDate, academy, searchQuery, 
      selectedTeacherId, selectedFilter, selectedDays, isAndFilter, filterTarget: 'today'
    });

    return list.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name, 'ko');
      return getStudentStartTime(a, selectedDayKey) - getStudentStartTime(b, selectedDayKey);
    });
  }, [students, selectedDayKey, selectedFilter, selectedDays, isAndFilter, searchQuery, selectedTeacherId, sortMode, academy, selectedDate]);

  // 2. 전체/나머지 학생 리스트 (오늘 수업자 제외)
  const filteredAllStudents = useMemo(() => {
    return filterStudentList({
      students, selectedDayKey, selectedDate, academy, searchQuery, 
      selectedTeacherId, selectedFilter, selectedDays, isAndFilter, filterTarget: 'rest'
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, searchQuery, selectedFilter, selectedDays, isAndFilter, selectedTeacherId, selectedDayKey, selectedDate, academy]);

  // 💡 [추가] 날짜/수업 여부와 무관한 전체 필터링 리스트 (학생 정보 수정 전용)
  const pureFilteredStudents = useMemo(() => {
    return getPureFilteredStudents({
      students, searchQuery: studentEditSearchQuery, selectedTeacherId, selectedFilter, selectedDays, isAndFilter
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, studentEditSearchQuery, selectedFilter, selectedDays, isAndFilter, selectedTeacherId]);

  const allTodayIds = useMemo(() => {
    return students.filter(s => {
      if (s.is_deleted) return false;
      return s.isTodayClassDay;
    }).map(s => s.id);
  }, [students]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] flex font-sans selection:bg-blue-500/30 overflow-hidden text-xs">
      <Sidebar viewMode={viewMode} setViewMode={navigateTo} todayCount={todayStudents.length} students={students} selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter} selectedDays={selectedDays} setSelectedDays={setSelectedDays} isAndFilter={isAndFilter} setIsAndFilter={setIsAndFilter} filterTarget={filterTarget} setFilterTarget={setFilterTarget} academyInfo={academy} onUpdateAcademyInfo={handleUpdateAcademyInfo} teachers={teachers} selectedTeacherId={selectedTeacherId} setSelectedTeacherId={setSelectedTeacherId} />
      <main className="flex-1 h-screen overflow-y-auto bg-[#080808] relative">
        {isLoading ? (<div className="flex flex-col items-center justify-center h-full text-gray-500"><Loader2 className="animate-spin mb-4" size={32} /><p className="text-[10px] font-black uppercase tracking-[0.4em]">Syncing Academy Data...</p></div>) : (
          <div className="h-full">
            {viewMode === 'board' && <Overview todayStudents={todayStudents} filteredAllStudents={filteredAllStudents} allTodayIds={allTodayIds} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={isBatchMode} setIsBatchMode={setIsBatchMode} onBatchAdd={batchAddStudents} onRemoveFromToday={removeStudentFromToday} onAddNewStudent={handleAddNewStudent} masterTextbooks={availableTextbooks} teachers={teachers} consultationCycle={academy?.consultation_cycle || 21} onStartClass={() => setIsClassroomModeOpen(true)} academyInfo={academy} />}
            {viewMode === 'studentEdit' && <Overview todayStudents={[]} filteredAllStudents={pureFilteredStudents} allTodayIds={[]} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={false} setIsBatchMode={() => {}} onBatchAdd={async () => {}} onRemoveFromToday={removeStudentFromToday} onAddNewStudent={handleAddNewStudent} masterTextbooks={availableTextbooks} teachers={teachers} title="전체 학생 정보 관리" showAddButton={true} hideTodaySection={true} consultationCycle={academy?.consultation_cycle || 21} academyInfo={academy} searchQuery={studentEditSearchQuery} onSearchChange={setStudentEditSearchQuery} />}
            {viewMode === 'todayTable' && <TodaySheet students={todayStudents} setStudents={setStudents} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} onSelectStudent={setSelectedStudentId} masterTextbooks={availableTextbooks} onSave={saveTodaySession} onUpdateStudentInfo={updateStudentInfo} academyInfo={academy} currentUser={currentUser} sortMode={sortMode} onSortModeChange={setSortMode} onOpenBriefing={() => setShowMorningBriefing(true)} />}

            {viewMode === 'progress' && <ProgressSequencer students={filteredAllStudents} masterTextbooks={availableTextbooks} initialStudentId={activeProgressStudentId} onSaveLegacy={handleSaveLegacyProgress} />}
            {viewMode === 'monthlyChanges' && <MonthlyChanges students={students} />}
            {viewMode === 'notifications' && <NotificationsView academyInfo={academy} students={students} currentUser={currentUser} />}
            {viewMode === 'settings' && <SettingsView teachers={teachers} students={students} onAddTeacher={handleAddNewTeacherAccount} onDeleteTeacher={handleDeleteTeacher} onUpdateTeacher={handleUpdateTeacher} onUpdateCurrentUser={handleUpdateCurrentUser} onUpdateAcademyInfo={handleUpdateAcademyInfo} academyInfo={academy} currentUser={currentUser} noticeDrafts={noticeDrafts} onNoticeDraftChange={handleNoticeDraftChange} />}
          </div>
        )}
      </main>
      <AnimatePresence>
        {isClassroomModeOpen && < ClassroomMode students={students} onSave={saveTodaySession} onClose={() => setIsClassroomModeOpen(false)} selectedDate={selectedDate} academyInfo={academy} selectedTeacherId={selectedTeacherId} />}
        {showMorningBriefing && <MorningBriefingModal academyInfo={academy} todayStudents={todayStudents} onClose={() => { setShowMorningBriefing(false); sessionStorage.setItem(`ams_briefing_${selectedDate}`, 'true'); }} />}
        {selectedStudentId && selectedStudent && !isBatchMode && (viewMode === 'studentEdit' ? <StudentDetailDrawer student={selectedStudent} availableTextbooks={availableTextbooks} isRefreshingBooks={isRefreshingBooks} onRefreshBooks={refreshTextbooks} onUpdateInfo={updateStudentInfo} onAddToToday={addStudentToToday} onClose={() => setSelectedStudentId(null)} teachers={teachers} /> : <StudentStudyReportDrawer student={selectedStudent} availableTextbooks={availableTextbooks} onClose={() => setSelectedStudentId(null)} onEditMode={() => navigateTo('studentEdit')} />)}
      </AnimatePresence>
      <AnimatePresence>{selectedStudentId && !isBatchMode && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStudentId(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />)}</AnimatePresence>
    </div>
  );
}
