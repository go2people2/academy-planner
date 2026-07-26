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
import TeacherTasks from '@/components/dashboard/TeacherTasks';
import ApprovalModal from '@/components/dashboard/ApprovalModal';
import ProblemErrorManager from '@/components/dashboard/ProblemErrorManager';
import WrongAnswerManager from '@/components/dashboard/WrongAnswerManager';
import ExamPaperManager from '@/components/dashboard/exam/ExamPaperManager';
import TimetableSettings from '@/components/dashboard/settings/TimetableSettings';
import { supabase } from '@/lib/supabase';
import { getTodayStr, getDayOfWeek, getInitial } from '@/lib/utils';
import { ATTENDANCE_STATUS, normalizeAttendanceStatus } from '@/lib/sessionFieldMap';
import { Student, SessionLog, StudentStatus, TextbookOption } from '@/types/dashboard';
import { getEnrichedStudentData, evaluateTodayStatus } from '@/lib/studentDataEnricher';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 💡 [리팩토링] 대시보드 데이터 로딩 및 가공 로직 분리
 */

// 1. 교재 코드를 실제 이름으로 변환하는 유틸리티
;

/**
 * 💡 [리팩토링] 파생 상태 계산 및 필터링 유틸리티
 */

const getStudentStartTime = (student: any, day: string) => {
  // 1. 시간 이동 필드(moved_to_hour) 우선 사용
  if (student.todaySession?.moved_to_hour !== undefined && student.todaySession?.moved_to_hour !== null) {
    const mVal = student.todaySession.moved_to_hour;
    let h = mVal >= 100 ? Math.floor(mVal / 100) : mVal;
    if (h < 10) h += 12;
    return h;
  }

  // 2. [호환성] attendance_status에 인코딩된 시간 정보 파싱
  const status = student.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
  if (status.includes(':')) { 
    const parts = status.split(':'); 
    let val = parseInt(parts[parts.length - 1]); 
    if (!isNaN(val) && val < 24) {
      if (val < 10) val += 12;
      return val;
    }
  }

  // 3. 오늘 요일에 해당하는 선택과목/방학특강 스케줄이 있다면 최우선 적용
  const rawElective = student.book_courses?.['__elective_courses'];
  if (rawElective) {
    try {
      const courses = JSON.parse(rawElective);
      if (Array.isArray(courses)) {
        for (const c of courses) {
          if (c.days?.includes(day) && c.schedules?.[day]) {
            const sched = c.schedules[day];
            if (Array.isArray(sched) && sched.length > 0) {
              const firstVal = sched[0];
              let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
              if (h < 10) h += 12;
              return h;
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 4. 기본 정규 스케줄 사용
  const hours = student.day_schedules?.[day] || [];
  if (hours.length === 0) return 999; 
  const parsedHours = hours.map((h: number) => {
    let hourVal = h >= 100 ? Math.floor(h / 100) : h;
    if (hourVal < 10) hourVal += 12;
    return hourVal;
  });
  return Math.min(...parsedHours);
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
  filterTarget: 'today' | 'rest',
  selectedHour: string // 💡 시작 시간대 필터 추가
}) => {
  const { students, selectedDayKey, selectedDate, academy, searchQuery, selectedTeacherId, selectedFilter, selectedDays, isAndFilter, filterTarget, selectedHour } = params;
  
  return students.filter(s => {
    // 퇴원생 필터 처리
    if (selectedFilter === 'Discharged') {
      return s.is_deleted === true && s.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    if (s.is_deleted) return false;
    if (s.isSkipped && filterTarget === 'rest') return false;

    const isTodaySession = s.isTodayClassDay;

    // 검색어 필터
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // 담당 선생님 필터
    if (selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;

    // 💡 [이중 가드] 정규 또는 특강 시간 중 단 하나라도 선택한 시간대와 맞물리면 통과시킵니다.
    if (filterTarget === 'today' && selectedHour !== 'All') {
      const matchHour = parseInt(selectedHour, 10);
      
      const regHours = s.day_schedules?.[selectedDayKey] || [];
      const hasRegMatch = regHours.some((hVal: number) => {
        let hourVal = hVal >= 100 ? Math.floor(hVal / 100) : hVal;
        if (hourVal < 10) hourVal += 12;
        return hourVal === matchHour;
      });

      let hasElectiveMatch = false;
      const rawElective = s.book_courses?.['__elective_courses'];
      if (rawElective) {
        try {
          const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
          if (Array.isArray(courses)) {
            for (const c of courses) {
              if (c.days?.includes(selectedDayKey) && c.schedules?.[selectedDayKey]) {
                const sched = c.schedules[selectedDayKey];
                if (Array.isArray(sched)) {
                  hasElectiveMatch = sched.some((hVal: number) => {
                    let hourVal = hVal >= 100 ? Math.floor(hVal / 100) : hVal;
                    if (hourVal < 10) hourVal += 12;
                    return hourVal === matchHour;
                  });
                  if (hasElectiveMatch) break;
                }
              }
            }
          }
        } catch (e) {}
      }

      if (!hasRegMatch && !hasElectiveMatch) return false;
    }

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
  const [isMounted, setIsMounted] = useState(false); // 💡 하이드레이션 mismatch 방지용 플래그
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [activeProgressStudentId, setActiveProgressStudentId] = useState<string | null>(null);
  const [isWarpMode, setIsWarpMode] = useState(false); // 💡 임시 원격 지원 모드 플래그 추가

  const handleAuthError = useCallback(async (e: any) => {
    if (e && (e.code === '42501' || String(e.message).includes('row-level security') || e.status === 403 || e.status === 401)) {
      alert('인증 정보가 만료되었거나 계정 권한이 변경되었습니다. 정상적인 이용을 위해 다시 로그인해 주세요.');
      localStorage.removeItem('ams_user');
      await supabase.auth.signOut();
      router.push(`/${slug}/login`);
      return true;
    }
    return false;
  }, [router, slug]);

  useEffect(() => {
    // 💡 [안정화] 마운트 완료 후 클라이언트 환경에서만 이전 보던 탭 화면을 복구하여 Hydration Mismatch를 방지합니다.
    setIsMounted(true);
    const savedTab = localStorage.getItem('ams_viewMode');
    const recoveredUserJson = localStorage.getItem('ams_user');
    if (recoveredUserJson && savedTab) {
      const role = JSON.parse(recoveredUserJson).role;
      if (savedTab === 'settings' && role !== 'admin' && role !== 'master') {
        setViewMode('board');
      } else {
        setViewMode(savedTab);
      }
    }

    if (!slug) return;
    const userJson = localStorage.getItem('ams_user');
    if (!userJson) { router.push(`/${slug}/login`); return; }
    
    const localUser = JSON.parse(userJson);
    const warpFlag = localStorage.getItem('ams_is_warp') === 'true';

    const setupMasterSession = async () => {
      const normalizedSlug = (Array.isArray(slug) ? slug[0] : slug || '').toLowerCase();
      const { data: targetAc } = await supabase
        .from('ams_academies')
        .select('id')
        .eq('slug', normalizedSlug)
        .maybeSingle();

      if (!targetAc) {
        alert('존재하지 않는 학원입니다.');
        router.push('/');
        return;
      }

      // 💡 [개선] 마스터 권한의 경우, URL 슬러그를 기반으로 academy_id 실시간 임시 업데이트 및 세션 고정 지원
      if (localUser?.role === 'master') {
        if (localUser.academy_id !== targetAc.id) {
          localUser.academy_id = targetAc.id;
          localStorage.setItem('ams_user', JSON.stringify(localUser));
        }
      } else {
        // 💡 [보안 강화] 일반 교사(admin, teacher)인 경우, 세션의 academy_id와 현재 URL의 학원 ID가 불일치하면 즉시 접근 차단
        if (localUser.academy_id !== targetAc.id) {
          alert('해당 학원의 대시보드 접근 권한이 없습니다. 자동으로 로그아웃됩니다.');
          localStorage.removeItem('ams_user');
          await supabase.auth.signOut();
          router.replace(`/${normalizedSlug}/login`);
          return;
        }
      }

      setIsWarpMode(localUser?.role === 'master' && warpFlag);
      setCurrentUser(localUser);

      // 💡 마지막으로 보던 화면(탭) 복구 (새로고침 대응 - 지연 초기화 함수에서 선행 처리하므로 중복 set은 제거하고 history만 적용)
      const savedViewMode = localStorage.getItem('ams_viewMode');
      const initialMode = savedViewMode && !(savedViewMode === 'settings' && localUser?.role !== 'admin' && localUser?.role !== 'master') ? savedViewMode : 'board';
      if (typeof window !== 'undefined') {
        window.history.replaceState({ viewMode: initialMode }, '');
      }

      // 💡 [개선] 다른 컴퓨터에서 변경된 최신 프리셋 정보를 DB로부터 동기화
      if (localUser?.id) {
        const { data: latestUser, error } = await supabase
          .from('ams_teachers')
          .select('*')
          .eq('id', localUser.id)
          .maybeSingle();
        
        if (!error && latestUser) {
          // 마스터 권한인 경우 DB의 academy_id(시스템 관리국)로 덮어쓰지 않고 현재 원격 임시 접속 중인 학원 ID를 보존
          const preservedAcademyId = localUser.role === 'master' ? localUser.academy_id : latestUser.academy_id;
          const preservedRole = localUser.role === 'master' ? 'master' : latestUser.role;
          const merged = { ...localUser, ...latestUser, role: preservedRole, academy_id: preservedAcademyId };
          setCurrentUser(merged);
          localStorage.setItem('ams_user', JSON.stringify(merged));
        }
      }
    };

    setupMasterSession();
  }, [slug, router]);

  const [academy, setAcademy] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('All');
  const [selectedHour, setSelectedHour] = useState<string>('All');
  const isFirstRender = useRef(true);
  const prevDateRef = useRef(selectedDate);

  // 날짜 변경 시 시간대 필터는 자동으로 풀리게 유도 (최초 렌더링 리셋 방지)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (prevDateRef.current !== selectedDate) {
      setSelectedHour('All');
      prevDateRef.current = selectedDate;
    }
  }, [selectedDate]);

  // 💡 선택한 선생님 필터 상태 로컬스토리지 연동
  useEffect(() => {
    const saved = localStorage.getItem('ams_selectedTeacherId');
    if (saved) setSelectedTeacherId(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('ams_selectedTeacherId', selectedTeacherId);
  }, [selectedTeacherId]);

  // 💡 선택한 시간대 필터 상태 로컬스토리지 연동
  useEffect(() => {
    const saved = localStorage.getItem('ams_selectedHour');
    if (saved) setSelectedHour(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('ams_selectedHour', selectedHour);
  }, [selectedHour]);

  // 💡 viewMode 변경 시 로컬스토리지에 저장하여 새로고침 시 복구 가능하도록 지원
  useEffect(() => {
    if (isMounted && viewMode) {
      localStorage.setItem('ams_viewMode', viewMode);
    }
  }, [viewMode, isMounted]);

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
  const handleSelectStudent = (studentId: string | null) => {
    if (studentId && isWarpMode) {
      alert('🔒 원격 지원 모드에서는 개인정보 보호를 위해 학생 상세 프로필 조회가 제한됩니다.');
      return;
    }
    setSelectedStudentId(studentId);
  };
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isClassroomModeOpen, setIsClassroomModeOpen] = useState(false);
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  
  // 💡 [추가] 검사(승인) 대기열 모달 상태
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [showMorningBriefing, setShowMorningBriefing] = useState(false);
  const [sortMode, setSortMode] = useState<'time' | 'name' | 'grade' | 'school'>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const navigateTo = useCallback((mode: string, skipHistory = false) => { 
    if (viewMode === mode) return;

    // 💡 [방어] 일반 교사의 설정 화면 진입 차단
    if (mode === 'settings' && currentUser?.role !== 'admin' && currentUser?.role !== 'master') {
      alert('권한이 없습니다.');
      return;
    }

    setViewMode(mode); setSelectedStudentId(null); 
    if (typeof window !== 'undefined') {
      if (skipHistory) {
        window.history.replaceState({ viewMode: mode }, '');
      } else {
        window.history.pushState({ viewMode: mode }, '');
      }
    }
  }, [viewMode, currentUser?.role]);

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }, []);

  const goForward = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.forward();
    }
  }, []);

  // 💡 [추가] 브라우저 뒤로가기 / 앞으로가기 이벤트 (popstate) 감지 및 연동
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && typeof e.state.viewMode === 'string') {
        setViewMode(e.state.viewMode);
        setSelectedStudentId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleNavShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '[') { e.preventDefault(); goBack(); }
      if (e.ctrlKey && e.key === ']') { e.preventDefault(); goForward(); }
      
      // 💡 Shift + Alt + L (또는 한글 모드 'ㅣ') 입력 시 라이브 모드 토글
      if (e.shiftKey && e.altKey && (e.key === 'l' || e.key === 'L' || e.key === 'ㅣ')) {
        e.preventDefault();
        setIsClassroomModeOpen(prev => !prev);
      }

      // 💡 Shift + Alt + T (또는 한글 모드 'ㅅ') 입력 시 시간표 전체화면 토글
      if (e.shiftKey && e.altKey && (e.key === 't' || e.key === 'T' || e.key === 'ㅅ')) {
        e.preventDefault();
        if (currentUser?.role !== 'admin' && currentUser?.role !== 'master') {
          alert('시간표 관리 권한이 없습니다. (원장/마스터 권한 필요)');
          return;
        }
        setIsTimetableModalOpen(prev => !prev);
      }

      // 💡 Escape 키 입력 시 시간표 모달 닫기
      if (e.key === 'Escape' || e.key === 'Esc') {
        setIsTimetableModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleNavShortcuts);
    return () => window.removeEventListener('keydown', handleNavShortcuts);
  }, [goBack, goForward, currentUser]);
  
  const handleUpdateCurrentUser = (updates: any) => {
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated); localStorage.setItem('ams_user', JSON.stringify(updated));
  };

  const handleViewProgress = (id: string) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 개인정보 보호를 위해 학생 개별 리포트 조회가 제한됩니다.');
      return;
    }
    setActiveProgressStudentId(id); 
    setViewMode('progress'); 
  };

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
        const [recentLogsRes, legacyLogRes] = await Promise.all([
          supabase.from('ams_session_logs')
            .select('*').eq('student_id', s.id).order('session_date', { ascending: false }).limit(20),
          supabase.from('ams_session_logs')
            .select('*').eq('student_id', s.id).eq('session_date', '1900-01-01').maybeSingle()
        ]);
        
        const logsData = [...(recentLogsRes.data || [])];
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
  }, [selectedDate, slug, academy, teachers, fetchTeachers, currentUser, isWarpMode]);

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
      const hasAnnouncements = Object.values(academy.announcements || {}).some(v => String(v).trim());
      if (hasAnnouncements) { setShowMorningBriefing(true); }
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
    'homework_text', 'homework_json', 'test_status', 'test_score', 'test_result', 'approval_status', 
    'session_date', 'academy_id', 'student_id', 'homework_to', 'timer_started_at', 'timer_duration',
    'moved_to_hour', 'attendance_reason', 'management_notes'
  ];
  const filtered: any = {};
  Object.keys(sessionData).forEach(key => {
    let dbKey = key === 'date' ? 'session_date' : key;
    if (dbKey === 'test_id') dbKey = 'test_status';
    
    // JSON 필드 및 파생 필드 제외 (메인에서 별도 처리)
    if (['next_quiz_text', 'next_quiz_cut', 'next_quiz_trial', 'next_quiz_json', 'test_result', 'homework_to', 'test_completed', 'test_cut', 'mission', 'todo_achievement', 'test_score_type', 'test_total_count', 'hw_checked_today', 'hw_passed_today'].includes(dbKey)) return;
    
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
  completed: any, mission: string, cut: string | number, achievement: number, sType: string, tTotal: number, hwCheckedToday: boolean, hwPassedToday: boolean
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
  const realStudentId = studentId.replace(/_special.*$/, '');
  const student = students.find(s => s.id === realStudentId);
  if (!student || !academy) return false;

  const targetCourseName = sessionData.course_name || '정규';
  const existingLog = (student.allLogs || []).find((l: any) => 
    (l.date || l.session_date) === selectedDate && 
    (l.course_name === targetCourseName || (targetCourseName === '정규' && !l.course_name))
  );
  let sessionId = existingLog?.id || (targetCourseName === '정규' ? student.todaySession?.id : undefined);
  
  // 💡 [독립 세션 참조] targetCourseName에 따른 특정 세션 객체 지정 (정규 vs 특강 세션 분리)
  const targetSession = existingLog || (targetCourseName === '정규' ? student.todaySession : undefined);

  // 💡 [추가] 관리 주의점(management_notes) 수정 시, 학생 마스터 정보 테이블도 함께 연동 갱신
  if ('management_notes' in sessionData && sessionData.management_notes !== undefined) {
    await supabase.from('ams_students').update({ 
      management_notes: sessionData.management_notes 
    }).eq('id', realStudentId);
  }

  const dataToSave = { ...sessionData };

  // 1. 기본 필드 필터링
  const filteredData = getFilteredBaseFields(dataToSave);

  // 💡 [안정화] 오늘 테스트 ID(test_status / test_id)가 저장 요청에 아예 전달되지 않았고, 현재 세션에 존재한다면 포함
  const hasTestKey = ('test_id' in dataToSave) || ('test_status' in dataToSave);
  if (!hasTestKey && targetSession?.test_id) {
    filteredData.test_status = targetSession.test_id;
  }

  // 💡 [개선] 출결 덮어쓰기 및 보강 정보 정리
  const newAttendanceStatus = filteredData.attendance_status;
  const isSupplementStatus = newAttendanceStatus?.startsWith(ATTENDANCE_STATUS.SUPPLEMENT);

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

  // 💡 오늘 정규 혹은 특강(선택과목) 스케줄이 존재하는지 감지
  const dayKey = getDayOfWeek(selectedDate);
  const regularHours = student.day_schedules?.[dayKey] || [];
  const rawElective = student.book_courses?.['__elective_courses'];
  let hasElectiveToday = false;
  if (rawElective) {
    try {
      const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
      if (Array.isArray(courses)) {
        hasElectiveToday = courses.some((c: any) => 
          c && c.days && (
            Array.isArray(c.days) 
              ? c.days.some((d: any) => typeof d === 'string' && d.trim() === dayKey)
              : (typeof c.days === 'string' && c.days.includes(dayKey))
          )
        );
      }
    } catch(e) {}
  }
  const hasAnyScheduleToday = regularHours.length > 0 || hasElectiveToday;

  // 💡 [좀비 보강 박멸] 새로 지정된 출결 상태가 '보강'이 아니고, 오늘 실제로 기본 등원 시간표(스케줄)가 존재하는 학생인 경우에만 기존 보강 정보(moved_to_hour)를 null로 정리합니다.
  // 오늘 아무 스케줄도 없이 보강으로 수동 등원한 학생인 경우에는 출결 처리가 되더라도 등원 교시 정보를 유지해야 라이브 모드 명단에서 사라지지 않습니다.
  if (newAttendanceStatus && !isSupplementStatus && hasAnyScheduleToday) {
    filteredData.moved_to_hour = null;
  } else if (existingMovedHour !== undefined && existingMovedHour !== null) {
    if (filteredData.moved_to_hour === undefined) {
      filteredData.moved_to_hour = existingMovedHour;
    }
  }

  // 2. 예정 테스트 정보 가공 (homework_to)
  const nqObj = {
    text: ('next_quiz_text' in dataToSave) ? dataToSave.next_quiz_text : (targetSession?.next_quiz_text ?? ''),
    cut: ('next_quiz_cut' in dataToSave) ? dataToSave.next_quiz_cut : (targetSession?.next_quiz_cut ?? 0),
    trial: ('next_quiz_trial' in dataToSave) ? dataToSave.next_quiz_trial : (targetSession?.next_quiz_trial ?? 1),
    json: ('next_quiz_json' in dataToSave) ? dataToSave.next_quiz_json : (targetSession?.next_quiz_json ?? [])
  };
  filteredData['homework_to'] = JSON.stringify(nqObj);
  
  // 3. 테스트 결과 정보 병합 (test_result)
  filteredData['test_result'] = buildMergedTestResult(
    targetSession?.test_result, 
    dataToSave, 
    {
      completed: targetSession?.test_completed,
      mission: student.recent_mission ?? '',
      cut: targetSession?.test_cut ?? 0,
      achievement: targetSession?.todo_achievement ?? 0,
      sType: targetSession?.test_score_type ?? 'score',
      tTotal: targetSession?.test_total_count ?? 0,
      hwCheckedToday: targetSession?.hw_checked_today ?? false,
      hwPassedToday: targetSession?.hw_passed_today ?? false
    }
  );

  setStudents(prev => prev.map(s => {
    // 💡 학생 ID가 일치하는 특정 행 검출
    const isTargetStudent = s.id === studentId || s.originalId === studentId;

    if (isTargetStudent) {
      const isTestCompleted = ('test_completed' in dataToSave) ? dataToSave.test_completed : (targetCourseName === '정규' ? s.todaySession?.test_completed : undefined);
      const targetRecentMission = ('mission' in dataToSave) ? (dataToSave.mission ?? '') : (s.recent_mission ?? '');
      
      const updatedTodaySession = {
        ...(s.todaySession || { id: 'temp', student_id: studentId, academy_id: academy.id, date: selectedDate, session_date: selectedDate }),
        ...filteredData,
        date: selectedDate, status: filteredData.status || 'none',
        management_notes: ('management_notes' in dataToSave) ? dataToSave.management_notes : (s.todaySession?.management_notes ?? s.management_notes),
        test_id: ('test_id' in dataToSave) ? dataToSave.test_id : (('test_status' in dataToSave) ? dataToSave.test_status : s.todaySession?.test_id),
        test_completed: isTestCompleted,
        test_cut: ('test_cut' in dataToSave) ? dataToSave.test_cut : (s.todaySession?.test_cut ?? 0),
        mission: targetRecentMission,
        todo_achievement: ('todo_achievement' in dataToSave) ? dataToSave.todo_achievement : (s.todaySession?.todo_achievement ?? 0),
        test_answers: ('test_answers' in dataToSave) ? dataToSave.test_answers : s.todaySession?.test_answers,
        next_quiz_text: nqObj.text,
        next_quiz_cut: nqObj.cut,
        next_quiz_trial: nqObj.trial,
        next_quiz_json: nqObj.json,
        hasHwTo: !!nqObj.text,
        hw_checked_today: ('hw_checked_today' in dataToSave) ? dataToSave.hw_checked_today : s.todaySession?.hw_checked_today,
        hw_passed_today: ('hw_passed_today' in dataToSave) ? dataToSave.hw_passed_today : s.todaySession?.hw_passed_today,
        hasTestResult: isTestCompleted !== undefined || ('test_cut' in dataToSave) || ('mission' in dataToSave) || ('todo_achievement' in dataToSave)
      };

      // 💡 [동기화 특효처방] 일지 보관함(allLogs) 내 오늘 날짜 & 해당 과목의 로그만 정밀 갱신!
      let updatedAllLogs = s.allLogs || [];
      const logIndex = updatedAllLogs.findIndex(l =>
        (l.date || l.session_date) === selectedDate &&
        (l.course_name === targetCourseName || (targetCourseName === '정규' && (!l.course_name || l.course_name === '정규')))
      );
      
      const logToPut = {
        ...(logIndex !== -1 ? updatedAllLogs[logIndex] : { id: 'temp', student_id: studentId, academy_id: academy.id, date: selectedDate, session_date: selectedDate }),
        ...filteredData,
        date: selectedDate,
        status: filteredData.status || 'none',
        management_notes: ('management_notes' in dataToSave) ? dataToSave.management_notes : (logIndex !== -1 ? updatedAllLogs[logIndex].management_notes : s.management_notes),
        test_id: ('test_id' in dataToSave) ? dataToSave.test_id : (logIndex !== -1 ? updatedAllLogs[logIndex].test_id : undefined),
        test_completed: isTestCompleted,
        test_cut: ('test_cut' in dataToSave) ? dataToSave.test_cut : (logIndex !== -1 ? updatedAllLogs[logIndex].test_cut : 0),
        mission: targetRecentMission,
        todo_achievement: ('todo_achievement' in dataToSave) ? dataToSave.todo_achievement : (logIndex !== -1 ? updatedAllLogs[logIndex].todo_achievement : 0),
        test_answers: ('test_answers' in dataToSave) ? dataToSave.test_answers : (logIndex !== -1 ? updatedAllLogs[logIndex].test_answers : undefined),
        next_quiz_text: nqObj.text,
        next_quiz_cut: nqObj.cut,
        next_quiz_trial: nqObj.trial,
        next_quiz_json: nqObj.json,
        hasHwTo: !!nqObj.text,
        hw_checked_today: ('hw_checked_today' in dataToSave) ? dataToSave.hw_checked_today : (logIndex !== -1 ? updatedAllLogs[logIndex].hw_checked_today : false),
        hw_passed_today: ('hw_passed_today' in dataToSave) ? dataToSave.hw_passed_today : (logIndex !== -1 ? updatedAllLogs[logIndex].hw_passed_today : false)
      };

      if (logIndex !== -1) {
        updatedAllLogs = updatedAllLogs.map((l, i) => i === logIndex ? logToPut : l);
      } else {
        updatedAllLogs = [{ ...logToPut, course_name: targetCourseName }, ...updatedAllLogs];
      }

      return {
        ...s,
        management_notes: ('management_notes' in dataToSave) ? (dataToSave.management_notes ?? '') : s.management_notes,
        recent_mission: targetRecentMission,
        // 💡 정규 수업일 때만 s.todaySession을 교체하고, 특강일 때는 정규 todaySession 데이터 보존
        todaySession: targetCourseName === '정규' ? updatedTodaySession : s.todaySession,
        allLogs: updatedAllLogs
      };
    }
    return s;
  }));

    try {
      const payload: any = { 
        student_id: realStudentId, 
        student_name: student.name, 
        academy_id: academy.id, 
        session_date: selectedDate, 
        course_name: sessionData.course_name || '정규',
        ...filteredData 
      };
      let targetId = (sessionId && sessionId !== 'temp') ? sessionId : undefined;
      if (!targetId) {
        const { data: existingDbLog } = await supabase
          .from('ams_session_logs')
          .select('id')
          .eq('student_id', realStudentId)
          .eq('session_date', selectedDate)
          .eq('course_name', targetCourseName)
          .maybeSingle();
        if (existingDbLog?.id) {
          targetId = existingDbLog.id;
        }
      }

      if (targetId) {
        payload.id = targetId;
      } else {
        if (!('attendance_status' in filteredData)) {
          payload.attendance_status = null;
        }
      }

      // 💡 [개선] PKEY 충돌 방지 및 안전한 upsert 갱신
      const { data: savedLog, error } = await supabase
        .from('ams_session_logs')
        .upsert([payload], { onConflict: 'student_id,session_date,course_name' })
        .select()
        .maybeSingle();

      if (error) throw error;

      if (savedLog) {
        setStudents(prev => prev.map(s => {
          if (s.id === studentId) {
            const nextQuiz = savedLog.homework_to ? (typeof savedLog.homework_to === 'string' ? JSON.parse(savedLog.homework_to) : savedLog.homework_to) : {};
            const testRes = savedLog.test_result ? (typeof savedLog.test_result === 'string' ? JSON.parse(savedLog.test_result) : savedLog.test_result) : {};
            
            const savedCourseName = savedLog.course_name || '정규';
            const isRegularCourse = savedCourseName === '정규' || !savedCourseName;

            const finalSavedTodaySession = {
              ...savedLog,
              // 💡 [지연 상태 덮어쓰기 방지] DB 비동기 저장이 지연되어 완료되었을 때, 
              // 그 사이 사용자가 수정/복구해 둔 로컬 상태 텍스트 필드가 존재한다면 이를 최우선 보존 (정규 과목만 적용)
              ...(isRegularCourse && s.todaySession?.classwork_text !== undefined ? { classwork_text: s.todaySession.classwork_text } : {}),
              ...(isRegularCourse && s.todaySession?.completed_classwork_text !== undefined ? { completed_classwork_text: s.todaySession.completed_classwork_text } : {}),
              ...(isRegularCourse && s.todaySession?.homework_text !== undefined ? { homework_text: s.todaySession.homework_text } : {}),
              ...(isRegularCourse && s.todaySession?.special_notes !== undefined ? { special_notes: s.todaySession.special_notes } : {}),
              ...(isRegularCourse && s.todaySession?.test_score !== undefined ? { test_score: s.todaySession.test_score } : {}),
              
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
              hw_checked_today: testRes.hw_checked_today === true,
              hw_passed_today: testRes.hw_passed_today === true,
              hasTestResult: true,
              test_answers: savedLog.test_answers || null
            };

            // 💡 [동기화 특효처방] DB 서버 반영 완료된 최종 일지를 allLogs 에도 일관성 있게 주입!
            let updatedAllLogs = s.allLogs || [];
            const logIndex = updatedAllLogs.findIndex(l =>
              (l.date || l.session_date) === selectedDate &&
              (l.course_name === savedCourseName || (savedCourseName === '정규' && !l.course_name))
            );
            if (logIndex !== -1) {
              updatedAllLogs = updatedAllLogs.map((l, i) => i === logIndex ? { ...l, ...finalSavedTodaySession } : l);
            } else {
              updatedAllLogs = [finalSavedTodaySession, ...updatedAllLogs];
            }

            return {
              ...s,
              ...(isRegularCourse ? { todaySession: finalSavedTodaySession } : {}),
              allLogs: updatedAllLogs
            };
          }
          return s;
        }));
      }

      return true;
    } catch (e: any) { 
      console.error('Save error:', e); 
      if (await handleAuthError(e)) return false;
      if (e && typeof e === 'object') {
        console.error('Save error detailed:', {
          message: e.message,
          details: e.details,
          hint: e.hint,
          code: e.code
        });
      }
      // 💡 실패 시에도 전체 리페치를 하지 않고 에러만 출력 (사용자 입력값 보존을 위해)
      return false; 
    }
  }, [students, academy, selectedDate]);

  /**
   * 💡 화면에 표시된 필터링된 학생들의 제출 상태를 한 번에 일괄 해제
   */
  const saveBatchTodaySession = useCallback(async (studentIds: string[], sessionData: Partial<SessionLog>) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 데이터를 수정할 수 없습니다.');
      return false;
    }
    if (!academy) return false;

    const dataToSave = { ...sessionData };

    // 1. 기본 필드 필터링
    const filteredData = getFilteredBaseFields(dataToSave);

    // 2. 로컬 상태 낙관적 업데이트
    setStudents(prev => prev.map(s => {
      if (studentIds.includes(s.id)) {
        let localMovedHour = s.todaySession?.moved_to_hour;
        if (localMovedHour === undefined || localMovedHour === null) {
          const status = s.todaySession?.attendance_status || '';
          if (status.includes(':')) {
            const parts = status.split(':');
            const val = parseInt(parts[parts.length - 1]);
            if (!isNaN(val) && val < 24) localMovedHour = val;
          }
        }

        return {
          ...s,
          todaySession: {
            ...(s.todaySession || { id: 'temp', student_id: s.id, academy_id: academy.id, date: selectedDate, session_date: selectedDate }),
            ...filteredData,
            date: selectedDate,
            status: filteredData.status || s.todaySession?.status || 'none',
            ...(localMovedHour !== undefined && localMovedHour !== null ? { moved_to_hour: localMovedHour } : {})
          }
        };
      }
      return s;
    }));

    try {
      // 3. DB upsert용 페이로드 구성
      const payloads = studentIds.map(studentId => {
        const student = students.find(s => s.id === studentId);
        const sessionId = student?.todaySession?.id;
        
        let localMovedHour = student?.todaySession?.moved_to_hour;
        if (localMovedHour === undefined || localMovedHour === null) {
          const status = student?.todaySession?.attendance_status || '';
          if (status.includes(':')) {
            const parts = status.split(':');
            const val = parseInt(parts[parts.length - 1]);
            if (!isNaN(val) && val < 24) localMovedHour = val;
          }
        }

        const payload: any = {
          student_id: studentId,
          student_name: student?.name || '',
          academy_id: academy.id,
          session_date: selectedDate,
          course_name: '정규', // 💡 배치 저장은 항상 정규 수업 로그에만 적용
          ...filteredData
        };
        // 💡 [안정화] 배치 저장 시 오늘 테스트 ID(test_status)가 저장 요청에 누락되어 있고, 현재 클라이언트에 임시 이월/입력된 값이 존재한다면 이를 포함하여 저장합니다.
        if (!('test_id' in dataToSave) && student?.todaySession?.test_id) {
          payload.test_status = student.todaySession.test_id;
        }
        if (localMovedHour !== undefined && localMovedHour !== null) {
          payload.moved_to_hour = localMovedHour;
        }
        if (sessionId && sessionId !== 'temp') {
          payload.id = sessionId;
        }
        return payload;
      });

      const { data: savedLogs, error } = await supabase
        .from('ams_session_logs')
        .upsert(payloads, { onConflict: 'student_id,session_date,course_name' })
        .select();

      if (error) throw error;

      // 4. 비동기 DB 완료 후 로컬 상태 최종 재동기화 (지연 덮어쓰기 방지 적용)
      if (savedLogs && savedLogs.length > 0) {
        setStudents(prev => prev.map(s => {
          const savedLog = savedLogs.find(log => log.student_id === s.id);
          if (savedLog) {
            const nextQuiz = savedLog.homework_to ? (typeof savedLog.homework_to === 'string' ? JSON.parse(savedLog.homework_to) : savedLog.homework_to) : {};
            const testRes = savedLog.test_result ? (typeof savedLog.test_result === 'string' ? JSON.parse(savedLog.test_result) : savedLog.test_result) : {};
            
            return {
              ...s,
              todaySession: {
                ...savedLog,
                ...(s.todaySession?.classwork_text !== undefined ? { classwork_text: s.todaySession.classwork_text } : {}),
                ...(s.todaySession?.completed_classwork_text !== undefined ? { completed_classwork_text: s.todaySession.completed_classwork_text } : {}),
                ...(s.todaySession?.homework_text !== undefined ? { homework_text: s.todaySession.homework_text } : {}),
                ...(s.todaySession?.special_notes !== undefined ? { special_notes: s.todaySession.special_notes } : {}),
                ...(s.todaySession?.test_score !== undefined ? { test_score: s.todaySession.test_score } : {}),
                
                date: savedLog.session_date,
                status: savedLog.status || 'none',
                test_id: savedLog.test_status,
                test_score_type: testRes.score_type || 'score',
                test_total_count: testRes.total_count || 0,
                test_completed: testRes.completed,
                test_cut: testRes.cut || 0,
                mission: testRes.mission || '',
                todo_achievement: testRes.todo_achievement || 0,
                next_quiz_text: nextQuiz.text || '',
                next_quiz_cut: nextQuiz.cut || 0,
                next_quiz_trial: nextQuiz.trial || 1,
                next_quiz_json: nextQuiz.json || [],
                hasHwTo: !!nextQuiz.text,
                hw_checked_today: testRes.hw_checked_today === true,
                hw_passed_today: testRes.hw_passed_today === true,
                hasTestResult: true
              }
            };
          }
          return s;
        }));
      }
      return true;
    } catch (e: any) { 
      console.error('Batch Save error:', e); 
      if (await handleAuthError(e)) return false;
      return false; 
    }
  }, [students, academy, selectedDate]);

  const handleUpdateAcademyInfo = async (updates: any) => {
    if (!academy?.id) return;
    const academyId = academy.id;

    // 💡 [추가] 학원 주소 식별자(Slug) 변경 시 동기화 및 중복 체크
    if (updates.slug !== undefined) {
      const newSlug = String(updates.slug).trim().toLowerCase();
      if (!newSlug) {
        alert('주소 식별자는 공백으로 지정할 수 없습니다.');
        return;
      }
      
      try {
        // 1. 중복된 slug가 있는지 ams_academies에서 사전 조회
        const { data: duplicate, error: dupErr } = await supabase
          .from('ams_academies')
          .select('id')
          .eq('slug', newSlug)
          .maybeSingle();
        
        if (dupErr) throw dupErr;
        if (duplicate && duplicate.id !== academyId) {
          alert(`이미 사용 중인 주소 식별자(slug: ${newSlug})입니다. 다른 이름을 지정해 주세요.`);
          return;
        }

        // 2. 오답노트 테이블(academies) 동시 수정
        const oldSlug = academy.slug;
        if (oldSlug) {
          const { data: waAc, error: waErr } = await supabase
            .from('academies')
            .select('id')
            .eq('slug', oldSlug)
            .maybeSingle();
          
          if (waErr) throw waErr;
          
          if (waAc) {
            const { error: waUpdateErr } = await supabase
              .from('academies')
              .update({ slug: newSlug })
              .eq('id', waAc.id);
            if (waUpdateErr) {
              console.error('Failed to sync WA academy slug:', waUpdateErr);
            }
          }
        }
      } catch (err: any) {
        console.error('Slug validation error:', err);
        alert('주소 식별자 검증 중 오류가 발생했습니다: ' + err.message);
        return;
      }
      
      updates.slug = newSlug;
    }

    // 💡 [임시 디버그] 현재 세션의 클레임(Claim) 정보 출력
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[AUTH CHECK] user.id =', session?.user?.id);
    console.log('[AUTH CHECK] app_metadata =', session?.user?.app_metadata);
    console.log('[AUTH CHECK] user_metadata =', session?.user?.user_metadata);

    try {
      // 💡 [정식 보안 규격] 서버 API를 경유하여 RLS 제약 없이 안전하게 업데이트
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/academy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ academyId, updates })
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || '학원 정보 수정 실패');
      }

      if (resData.success && resData.data) {
        // ✅ DB 성공 시에만 로컬 상태 반영
        setAcademy((prev: any) => ({ ...prev, ...resData.data }));

        // 💡 [추가] 만약 slug가 정상 변경되었다면 새 URL로 리다이렉트
        if (updates.slug !== undefined) {
          alert(`주소 식별자가 '${updates.slug}'(으)로 성공적으로 변경되었습니다. 새로운 주소로 이동합니다.`);
          window.location.href = `/${updates.slug}/dashboard`;
          return;
        }

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

        console.log('학원 설정 저장 완료');
      } else {
        alert('저장 실패: ' + (resData.error || '알 수 없는 오류'));
      }
    } catch (e) { 
      console.error('Update academy error:', e); 
      await handleAuthError(e);
    }
  };

  const handleSaveLegacyProgress = useCallback(async (studentId: string, bookCode: string, unitName: string, mode: 'add' | 'remove' = 'add') => {
    if (!academy) return false;
    try {
      const { data: legacyLog } = await supabase.from('ams_session_logs').select('*').eq('student_id', studentId).eq('session_date', '1900-01-01').maybeSingle();
      let currentCwJson: any[] = []; if (legacyLog && legacyLog.classwork_json) currentCwJson = [...(legacyLog.classwork_json as any[])];
      const bookIdx = currentCwJson.findIndex(j => j.book_name === bookCode);

      if (mode === 'remove') {
        // 단원 완료 취소: units 배열에서 해당 단원 제거
        if (bookIdx > -1) {
          currentCwJson[bookIdx].units = (currentCwJson[bookIdx].units || []).filter((u: string) => u !== unitName);
          if (currentCwJson[bookIdx].units.length === 0) currentCwJson.splice(bookIdx, 1);
        }
      } else {
        // 단원 완료 추가 (기존 로직)
        if (bookIdx > -1) { const currentUnits = currentCwJson[bookIdx].units || []; if (!currentUnits.includes(unitName)) currentCwJson[bookIdx].units = [...currentUnits, unitName]; } 
        else { currentCwJson.push({ type: 'book', book_name: bookCode, range: 'Legacy Completion', units: [unitName] }); }
      }

      const logData = { student_id: studentId, academy_id: academy.id, session_date: '1900-01-01', classwork_text: `[LEGACY] 진도 수동 보정 데이터`, classwork_json: currentCwJson, status: null };
      if (legacyLog) { await supabase.from('ams_session_logs').update(logData).eq('id', legacyLog.id); } else if (mode === 'add') { await supabase.from('ams_session_logs').insert([logData]); }
      await fetchAllData(false); return true;
    } catch (e) { console.error('Legacy progress error:', e); return false; }
  }, [academy, fetchAllData]);

  const handleAddNewStudent = async (data: any) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 데이터를 수정할 수 없습니다.');
      return;
    }
    if (!academy) return;
    try {
      await supabase.from('ams_students').insert([{ academy_id: academy.id, name: data.name, school: data.school, grade: data.grade, course: data.course, book_courses: data.book_courses || {}, class_name: data.class_name, phone: data.phone, teacher_id: data.teacher_id || null, class_days: data.class_days, day_schedules: data.day_schedules, assigned_books: data.assigned_books, is_deleted: false }]);
      await fetchAllData(false);
    } catch (e: any) { 
      console.error(e); 
      await handleAuthError(e);
    }
  };

  const handleBatchAddStudents = async (newStudents: any[]) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 데이터를 수정할 수 없습니다.');
      return false;
    }
    if (!academy || newStudents.length === 0) return false;
    try {
      const dbPayload = newStudents.map(s => ({
        academy_id: academy.id,
        name: s.name,
        school: s.school || '',
        grade: s.grade || '',
        course: s.course || 'C',
        book_courses: s.book_courses || {},
        class_name: s.class_name || '',
        phone: s.phone || '',
        login_suffix: s.login_suffix || null,
        teacher_id: s.teacher_id || null,
        class_days: s.class_days || [],
        day_schedules: s.day_schedules || {},
        assigned_books: s.assigned_books || [],
        is_deleted: false
      }));
      
      const { error } = await supabase.from('ams_students').insert(dbPayload);
      if (error) throw error;
      
      await fetchAllData(false);
      return true;
    } catch (e: any) {
      console.error('Update student failed:', e);
      if (await handleAuthError(e)) return false;
      alert('학생 정보 수정에 실패했습니다.');
      return false;
    }
  };

  const addStudentToToday = async (studentId: string) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 데이터를 수정할 수 없습니다.');
      return;
    }
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // 오늘이 정규 수업 요일인지 판정
    const { isTodayClassDay: isScheduledToday } = evaluateTodayStatus(selectedDate, student.class_days || [], academy?.operation_settings?.holidays);

    if (isScheduledToday) {
      // 💡 정규 수업 요일인 학생은 "수업전"으로 온전히 복구
      await saveTodaySession(studentId, { 
        attendance_status: ATTENDANCE_STATUS.BEFORE, 
        homework_text: student.lastSession?.homework_text || '',
        moved_to_hour: null,
        attendance_reason: null
      });
    } else {
      // 정규 요일이 아닌 학생은 기존처럼 "보강"으로 추가
      const settings = academy?.operation_settings || {};
      const baseTime = settings.first_period_time || "";
      const baseHour = baseTime ? parseInt(baseTime.split(':')[0]) : 15;

      await saveTodaySession(studentId, { 
        attendance_status: '보강', 
        homework_text: student.lastSession?.homework_text || '',
        moved_to_hour: baseHour,
        attendance_reason: '보강 수업'
      });
    }
  };

  const batchAddStudents = async (studentIds: string[], reasons: Record<string, string> = {}, makeupHours: Record<string, number> = {}) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 데이터를 수정할 수 없습니다.');
      return;
    }
    if (!academy) return;
    setIsLoading(true);
    try {
      const newLogs = studentIds.map(id => {
        const s = students.find(st => st.id === id);
        if (!s) return null;
        
        const { isTodayClassDay: isScheduledToday } = evaluateTodayStatus(selectedDate, s.class_days || [], academy?.operation_settings?.holidays);
        const hour = makeupHours[id] !== undefined ? makeupHours[id] : null;
        const reason = reasons[id] || '보강 수업';
        
        const log: any = { 
          student_id: id, 
          student_name: s.name, 
          academy_id: academy.id, 
          session_date: selectedDate, 
          attendance_status: isScheduledToday ? ATTENDANCE_STATUS.BEFORE : '보강', 
          status: null, 
          moved_to_hour: isScheduledToday ? null : hour,
          attendance_reason: isScheduledToday ? null : reason,
          course_name: '정규'
        };

        const exist = s.todaySession?.special_notes || ''; 
        log.special_notes = (exist && !exist.includes('[temp]')) ? exist : '';
        
        return log;
      }).filter(Boolean);

      if (newLogs.length === 0) {
        setIsBatchMode(false);
        return;
      }

      const { error } = await supabase.from('ams_session_logs').upsert(newLogs, { onConflict: 'student_id,session_date,course_name' });
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

  const removeStudentFromToday = async (studentId: string, reason: string = '', mode: 'delete' | 'cancel' = 'cancel') => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 데이터를 수정할 수 없습니다.');
      return;
    }
    const student = students.find(s => s.id === studentId); 
    if (!student || !academy) return;
    try {
      const logId = student.todaySession?.id;
      const hasLog = logId && logId !== 'temp';

      if (mode === 'delete') {
        const confirmResult = confirm(
          `오늘 ${student.name} 학생의 수업 데이터를 데이터베이스에서 완전히 삭제하시겠습니까?\n\n` +
          `※ 이 작업은 되돌릴 수 없으며, 오늘 출결 통계 및 명단에서 아예 지워집니다.`
        );
        if (!confirmResult) return;

        // 🗑️ RLS를 완벽히 돌파하는 백엔드 API 호출 방식으로 완전 삭제 (DELETE)
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_session',
            studentId,
            sessionDate: selectedDate
          })
        });
        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || '백엔드 세션 삭제 실패');
        }
      } else {
        // 📝 기존 결석/수업취소 이력 보존 방식 유지 (UPSERT)
        const payload: any = { 
          student_id: studentId, 
          student_name: student.name, 
          academy_id: academy.id, 
          session_date: selectedDate, 
          attendance_status: '결석', 
          status: null,
          attendance_reason: reason || '결석 공지',
          moved_to_hour: null,
          course_name: student.courseName || '정규'
        };

        const exist = student.todaySession?.special_notes || ''; 
        payload.special_notes = (exist && !exist.includes('[temp]')) ? exist : '';

        if (hasLog) payload.id = logId;
        const { error } = await supabase.from('ams_session_logs').upsert([payload], { onConflict: 'student_id,session_date,course_name' });
        if (error) throw error;
      }

      await fetchAllData(false);
    } catch (e: any) { 
      console.error('Remove Student Error:', e); 
      alert(`학생 제외 중 오류가 발생했습니다: ${e?.message || JSON.stringify(e)}`);
    }
  };

  const updateStudentInfo = async (studentId: string, fieldOrUpdates: string | any, value?: any) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 데이터를 수정할 수 없습니다.');
      return;
    }
    try {
      if (fieldOrUpdates === 'PERMANENT_DELETE') {
        await supabase.from('ams_session_logs').update({ student_id: null }).eq('student_id', studentId);
        await supabase.from('ams_students').delete().eq('id', studentId); setSelectedStudentId(null);
      } else {
        let updateData: any = (typeof fieldOrUpdates === 'string') ? { [fieldOrUpdates]: value } : { ...fieldOrUpdates };
        const realStudentId = studentId.includes('_special_') ? studentId.split('_special_')[0] : studentId;
        
        // 💡 [낙관적 업데이트] 로컬 상태 즉시 갱신
        setStudents(prev => prev.map(s => (s.id === studentId || s.id === realStudentId || s.originalId === realStudentId) ? { ...s, ...updateData } : s));

        const { error } = await supabase.from('ams_students').update(updateData).eq('id', realStudentId);
        if (error) {
          console.error('Failed to update student info:', error);
          alert(`학생 정보 수정 중 오류가 발생했습니다: ${error.message}`);
        }

        // 💡 [추가] 관리 주의점(management_notes) 수정 시 히스토리 로그 테이블에 적재
        if (updateData.management_notes !== undefined && academy) {
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUser?.id);
          const creatorId = isValidUUID ? currentUser.id : null;
          await supabase.from('ams_student_management_logs').insert([{
            student_id: realStudentId,
            academy_id: academy.id,
            teacher_id: creatorId,
            notes: updateData.management_notes
          }]);
        }
      }
      await fetchAllData(false);
    } catch (e: any) { 
      console.error(e);
      alert('학생 정보 수정 처리 중 오류가 발생했습니다.');
    }
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
        nickname: d.nickname, // 💡 추가 (ACA2000 별칭)
        role: d.role 
      }]); 
      await fetchTeachers(academy.id); 
    } 
    catch (e) { 
      console.error(e); 
      await handleAuthError(e);
    }
  };

  const handleDeleteTeacher = async (id: string) => { 
    if (!confirm('삭제하시겠습니까?')) return; 
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/teachers/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          alert('인증 정보가 만료되었거나 계정 권한이 변경되었습니다. 정상적인 이용을 위해 다시 로그인해 주세요.');
          localStorage.removeItem('ams_user');
          await supabase.auth.signOut();
          router.push(`/${slug}/login`);
          return;
        }
        const errData = await res.json();
        console.error('Delete Error:', errData.error);
        alert('삭제 실패: ' + errData.error);
      } else {
        console.log('Delete Success');
        if (selectedTeacherId === id) {
          setSelectedTeacherId('All');
        }
        if (academy) await fetchTeachers(academy.id); 
      }
    } catch (e) {
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateTeacher = async (id: string, updates: any) => { 
    try { 
      console.log(`Updating teacher ${id}:`, updates);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // 💡 [개선] 권한 동기화를 위해 직접 DB 업데이트 대신 전용 서버 API 호출
      const res = await fetch(`/api/teachers/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          alert('인증 정보가 만료되었거나 계정 권한이 변경되었습니다. 정상적인 이용을 위해 다시 로그인해 주세요.');
          localStorage.removeItem('ams_user');
          await supabase.auth.signOut();
          router.push(`/${slug}/login`);
          return;
        }
        const errData = await res.json();
        console.error('Update Error:', errData.error);
        alert('저장 실패: ' + errData.error);
      } else {
        console.log('Update Success');
        if (academy) await fetchTeachers(academy.id); 
      }
    } catch (e) { console.error(e); } 
  };

  // 💡 [추가] 제출 승인/반려 핸들러 (세션 로그 ID 기준)
  const handleApproveSubmissions = async (logIds: string[]) => {
    if (!academy) return;
    try {
      const updates = logIds.map(logId => {
        const idVal = parseInt(logId, 10);
        if (isNaN(idVal)) return null;
        return supabase.from('ams_session_logs').update({
          approval_status: 'approved'
        }).eq('id', idVal);
      }).filter(Boolean);
      
      if (updates.length > 0) {
        await Promise.all(updates);
        await fetchAllData(true);
      }
    } catch (e) {
      console.error(e);
      alert('승인 중 오류가 발생했습니다.');
    }
  };

  const handleRejectSubmissions = async (logIds: string[]) => {
    if (!academy) return;
    try {
      const updates = logIds.map(logId => {
        const idVal = parseInt(logId, 10);
        if (isNaN(idVal)) return null;
        return supabase.from('ams_session_logs').update({
          approval_status: 'none'
        }).eq('id', idVal);
      }).filter(Boolean);
      
      if (updates.length > 0) {
        await Promise.all(updates);
        await fetchAllData(true);
      }
    } catch (e) {
      console.error(e);
      alert('반려 중 오류가 발생했습니다.');
    }
  };

  const selectedDayKey = getDayOfWeek(selectedDate);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

  // 💡 [추가] 오늘 제출(submitted)한 모든 활성 원생의 일지(정규/특강 모두 포함)를 수집
  const pendingSubmissions = useMemo(() => {
    const list: any[] = [];
    students.forEach((s: any) => {
      if (s.is_deleted) return;
      (s.allLogs || []).forEach((l: any) => {
        if ((l.date || l.session_date) === selectedDate && l.approval_status === 'submitted') {
          list.push({
            id: l.id.toString(),
            studentId: s.id,
            name: s.name,
            school: s.school || '',
            course: l.course_name || '정규',
            completed_classwork_text: l.completed_classwork_text,
            homework_text: l.homework_text,
            todo_achievement: l.todo_achievement,
            test_id: l.test_status || l.test_id,
            test_score: l.test_score,
            test_cut: l.test_cut,
            logId: l.id
          });
        }
      });
    });
    return list;
  }, [students, selectedDate]);

  // 💡 오늘 등원하는 학생들의 실제 시간대 목록 동적 추출 (사이드바 드롭다운용)
  const availableHours = useMemo(() => {
    const rawTodayList = filterStudentList({
      students, selectedDayKey, selectedDate, academy, searchQuery: '',
      selectedTeacherId: 'All', selectedFilter: 'All', selectedDays: [], isAndFilter: false,
      filterTarget: 'today', selectedHour: 'All'
    });
    const hoursSet = new Set<number>();
    rawTodayList.forEach(s => {
      const h = getStudentStartTime(s, selectedDayKey);
      hoursSet.add(h);
    });
    return Array.from(hoursSet).sort((a, b) => a - b);
  }, [students, selectedDayKey, selectedDate, academy]);

  // 1. 오늘의 학생 리스트 (필터링 + 정렬 - Overview는 항상 이름순)
  const todayStudents = useMemo(() => {
    const list = filterStudentList({
      students, selectedDayKey, selectedDate, academy, searchQuery, 
      selectedTeacherId, selectedFilter, selectedDays, isAndFilter, filterTarget: 'today',
      selectedHour
    });

    return list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, selectedDayKey, selectedFilter, selectedDays, isAndFilter, searchQuery, selectedTeacherId, sortMode, academy, selectedDate, selectedHour]);

  // 💡 [추가] 오늘 수업 예정이었으나 제외(취소)된 학생 목록
  const excludedStudents = useMemo(() => {
    return students.filter(s => {
      if (s.is_deleted) return false;
      const isSkipped = s.todaySession?.attendance_status === ATTENDANCE_STATUS.EXCLUDED;
      const isMakeup = s.todaySession?.attendance_status?.startsWith(ATTENDANCE_STATUS.SUPPLEMENT) || 
                       (s.todaySession?.moved_to_hour !== undefined && s.todaySession?.moved_to_hour !== null);
      return (s.isScheduledToday || isMakeup) && isSkipped;
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students]);

  // 2. 전체/나머지 학생 리스트 (오늘 수업자 제외)
  const filteredAllStudents = useMemo(() => {
    return filterStudentList({
      students, selectedDayKey, selectedDate, academy, searchQuery, 
      selectedTeacherId, selectedFilter, selectedDays: [], isAndFilter: false, filterTarget: 'rest',
      selectedHour: 'All'
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, searchQuery, selectedFilter, selectedTeacherId, selectedDayKey, selectedDate, academy]);

  // 💡 [추가] 날짜/수업 여부와 무관한 전체 필터링 리스트 (학생 정보 수정 전용)
  const pureFilteredStudents = useMemo(() => {
    return getPureFilteredStudents({
      students, searchQuery: studentEditSearchQuery, selectedTeacherId, selectedFilter, selectedDays, isAndFilter
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, studentEditSearchQuery, selectedFilter, selectedDays, isAndFilter, selectedTeacherId]);

  // 💡 [추가] 진도 탭 전용 사이드바 필터 적용 리스트 (오늘 수업 여부 무관)
  const progressFilteredStudents = useMemo(() => {
    return getPureFilteredStudents({
      students, searchQuery: '', selectedTeacherId, selectedFilter, selectedDays, isAndFilter
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, selectedFilter, selectedDays, isAndFilter, selectedTeacherId]);

  const allTodayIds = useMemo(() => {
    return students.filter(s => {
      if (s.is_deleted) return false;
      return s.isTodayClassDay;
    }).map(s => s.id);
  }, [students]);

  if (academy?.operation_settings?.is_suspended === true && currentUser?.role !== 'master') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-sans p-6 text-white text-xs selection:bg-red-500/30">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30 text-red-500 mx-auto animate-pulse">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white/95">서비스 제공이 일시 중지되었습니다</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Academy Suspended</p>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed font-bold">
            본 지점은 현재 서비스 이용이 잠시 중지되었습니다.<br />
            구독 갱신 또는 설정 점검 중이오니, 자세한 사항은 시스템 마스터 관리자에게 문의해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] flex font-sans selection:bg-blue-500/30 overflow-hidden text-xs">
      {!(viewMode === 'todayTable' && isFullScreen) && (
        <Sidebar currentUser={currentUser} viewMode={viewMode} setViewMode={navigateTo} todayCount={todayStudents.length} students={students} selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter} selectedDays={selectedDays} setSelectedDays={setSelectedDays} isAndFilter={isAndFilter} setIsAndFilter={setIsAndFilter} filterTarget={filterTarget} setFilterTarget={setFilterTarget} academyInfo={academy} onUpdateAcademyInfo={handleUpdateAcademyInfo} teachers={teachers} selectedTeacherId={selectedTeacherId} setSelectedTeacherId={setSelectedTeacherId} isClassroomModeOpen={isClassroomModeOpen} onStartClass={() => setIsClassroomModeOpen(true)} selectedHour={selectedHour} setSelectedHour={setSelectedHour} availableHours={availableHours} />
      )}
      <main className="flex-1 h-screen overflow-y-auto bg-[#080808] relative">
        {(() => {
          // 💡 [안정화] 정규/특강 포함 오늘 제출(submitted)한 모든 활성 세션을 승인 대기 목록에 바인딩
          return pendingSubmissions.length > 0 ? (
            <div className="sticky top-0 z-40 flex justify-center py-3 bg-[#080808]/90 backdrop-blur-sm">
              <button 
                onClick={() => setIsApprovalModalOpen(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-full shadow-2xl shadow-blue-900/50 flex items-center gap-3 transition-all animate-bounce"
              >
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-[12px]">{pendingSubmissions.length}</div>
                명 제출 검사 대기 중! 클릭해서 확인
              </button>
            </div>
          ) : null;
        })()}

        {isLoading ? (<div className="flex flex-col items-center justify-center h-full text-gray-500"><Loader2 className="animate-spin mb-4" size={32} /><p className="text-[10px] font-black uppercase tracking-[0.4em]">Syncing Academy Data...</p></div>) : (
          <div className="h-full">
             {viewMode === 'board' && <Overview todayStudents={todayStudents} excludedStudents={excludedStudents} filteredAllStudents={filteredAllStudents} allTodayIds={allTodayIds} selectedStudentId={selectedStudentId} onSelectStudent={handleSelectStudent} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={isBatchMode} setIsBatchMode={setIsBatchMode} onBatchAdd={batchAddStudents} onRemoveFromToday={removeStudentFromToday} onAddNewStudent={handleAddNewStudent} masterTextbooks={availableTextbooks} teachers={teachers} consultationCycle={academy?.consultation_cycle || 21} onStartClass={() => setIsClassroomModeOpen(true)} academyInfo={academy} currentUser={currentUser} />}
             {viewMode === 'studentEdit' && <Overview todayStudents={[]} filteredAllStudents={pureFilteredStudents} allTodayIds={[]} selectedStudentId={selectedStudentId} onSelectStudent={handleSelectStudent} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={false} setIsBatchMode={() => {}} onBatchAdd={async () => {}} onRemoveFromToday={removeStudentFromToday} onAddNewStudent={handleAddNewStudent} onBatchAddStudents={handleBatchAddStudents} masterTextbooks={availableTextbooks} teachers={teachers} title="전체 학생 정보 관리" showAddButton={true} hideTodaySection={true} consultationCycle={academy?.consultation_cycle || 21} academyInfo={academy} searchQuery={studentEditSearchQuery} onSearchChange={setStudentEditSearchQuery} currentUser={currentUser} showDuplicateWarning={true} />}
             {viewMode === 'todayTable' && (
              <TodaySheet 
                students={todayStudents} 
                allStudents={students}
                setStudents={setStudents} 
                selectedDate={selectedDate} 
                 onDateChange={setSelectedDate} 
                 onViewProgress={handleViewProgress} 
                 onSelectStudent={handleSelectStudent} 
                 masterTextbooks={availableTextbooks} 
                 onSave={saveTodaySession} 
                 onBatchSave={saveBatchTodaySession}
                 onUpdateStudentInfo={updateStudentInfo} 
                 onRemoveFromToday={removeStudentFromToday}
                 academyInfo={academy} 
                 currentUser={currentUser} 
                 sortMode={sortMode} 
                 onSortModeChange={setSortMode} 
                 sortDirection={sortDirection}
                 onSortDirectionChange={setSortDirection}
                 onOpenBriefing={() => setShowMorningBriefing(true)} 
                 selectedFilter={selectedFilter}
                 setSelectedFilter={setSelectedFilter}
                 selectedTeacherId={selectedTeacherId}
                 setSelectedTeacherId={setSelectedTeacherId}
                 selectedDays={selectedDays}
                 setSelectedDays={setSelectedDays}
                 isAndFilter={isAndFilter}
                 setIsAndFilter={setIsAndFilter}
                 teachers={teachers}
                 isFullScreen={isFullScreen}
                 onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                 selectedHour={selectedHour}
               />
             )}
 
             {viewMode === 'progress' && <ProgressSequencer students={progressFilteredStudents.filter(s => !s.is_deleted)} masterTextbooks={availableTextbooks} initialStudentId={activeProgressStudentId} onSaveLegacy={handleSaveLegacyProgress} />}
             {viewMode === 'monthlyChanges' && <MonthlyChanges students={students} onSelectStudent={handleSelectStudent} />}
            {viewMode === 'settings' && <SettingsView teachers={teachers} students={students} masterTextbooks={availableTextbooks} onAddTeacher={handleAddNewTeacherAccount} onDeleteTeacher={handleDeleteTeacher} onUpdateTeacher={handleUpdateTeacher} onUpdateCurrentUser={handleUpdateCurrentUser} onUpdateAcademyInfo={handleUpdateAcademyInfo} academyInfo={academy} currentUser={currentUser} noticeDrafts={noticeDrafts} onNoticeDraftChange={handleNoticeDraftChange} />}
            {viewMode === 'teacherTask' && <TeacherTasks academyInfo={academy} students={students} teachers={teachers} currentUser={currentUser} onRefreshStudents={fetchAllData} />}
            {viewMode === 'problemErrors' && <ProblemErrorManager academyInfo={academy} students={students} teachers={teachers} currentUser={currentUser} />}
            {viewMode === 'wrongAnswersAdmin' && <WrongAnswerManager academyId={academy?.id || ''} currentUser={currentUser} />}
             {viewMode === 'exams' && <ExamPaperManager academyId={academy?.id || ''} />}
          </div>
        )}
      </main>
      <AnimatePresence>
        {isClassroomModeOpen && < ClassroomMode students={students} onSave={saveTodaySession} onClose={() => setIsClassroomModeOpen(false)} selectedDate={selectedDate} academyInfo={academy} selectedTeacherId={selectedTeacherId} />}
        {showMorningBriefing && (
          <MorningBriefingModal 
            academyInfo={academy} 
            todayStudents={todayStudents} 
            allStudents={students}
            onClose={() => { 
              setShowMorningBriefing(false); 
              sessionStorage.setItem(`ams_briefing_${selectedDate}`, 'true'); 
            }} 
          />
        )}
        {selectedStudentId && selectedStudent && !isBatchMode && (
          (viewMode === 'studentEdit' || selectedStudent.is_deleted) ? (
            <StudentDetailDrawer 
              student={selectedStudent} 
              availableTextbooks={availableTextbooks} 
              isRefreshingBooks={isRefreshingBooks} 
              onRefreshBooks={refreshTextbooks} 
              onUpdateInfo={updateStudentInfo} 
              onAddToToday={addStudentToToday} 
              onClose={() => setSelectedStudentId(null)} 
              teachers={teachers} 
              academyInfo={academy} 
            />
          ) : (
            <StudentStudyReportDrawer 
              student={selectedStudent} 
              availableTextbooks={availableTextbooks} 
              onClose={() => setSelectedStudentId(null)} 
              onEditMode={() => navigateTo('studentEdit')} 
              onRefreshStudents={fetchAllData}
            />
          )
        )}
      </AnimatePresence>
      <AnimatePresence>{selectedStudentId && !isBatchMode && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStudentId(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />)}</AnimatePresence>
      {isApprovalModalOpen && (
        <ApprovalModal 
          pendingStudents={pendingSubmissions}
          onClose={() => setIsApprovalModalOpen(false)}
          onApprove={async (ids) => {
            await handleApproveSubmissions(ids);
            setIsApprovalModalOpen(false);
          }}
          onReject={async (ids) => {
            await handleRejectSubmissions(ids);
            setIsApprovalModalOpen(false);
          }}
        />
      )}

      {/* 📅 시간표 전체화면 모달 (Shift + Alt + T) */}
      {isTimetableModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full h-full max-w-[96vw] max-h-[92vh] bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl flex flex-col overflow-hidden relative">
            {/* 닫기 버튼 (우측 상단 플로팅 격리) */}
            <button 
              onClick={() => setIsTimetableModalOpen(false)}
              className="absolute top-3 right-3 z-[99999] text-gray-400 hover:text-white transition-colors p-1.5 bg-black/50 hover:bg-black/80 rounded-full border border-white/10"
              title="닫기 (ESC)"
            >
              <X size={18} />
            </button>
            {/* 본문 콘텐츠 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#161616]">
              <TimetableSettings
                academyInfo={academy}
                teachers={teachers}
                students={students}
                isLight={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
