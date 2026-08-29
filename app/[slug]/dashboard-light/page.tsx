// Forced light mode rebuild trigger
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/light/SidebarLight';
import Overview from '@/components/dashboard/light/OverviewLight';
import TodaySheet from '@/components/dashboard/light/TodaySheetLight';
import ProgressSequencer from '@/components/dashboard/light/ProgressSequencerLight';
import MonthlyChanges from '@/components/dashboard/light/MonthlyChangesLight';
import SettingsView from '@/components/dashboard/light/SettingsViewLight';
import NotificationsView from '@/components/dashboard/light/NotificationsViewLight';
import StudentDetailDrawer from '@/components/dashboard/StudentDetailDrawer';
import StudentStudyReportDrawer from '@/components/dashboard/StudentStudyReportDrawer';
import MorningBriefingModal from '@/components/dashboard/light/MorningBriefingModalLight';
import ClassroomMode from '@/components/dashboard/light/ClassroomModeLight';
import TeacherTasks from '@/components/dashboard/light/TeacherTasksLight';
import ApprovalModal from '@/components/dashboard/ApprovalModal';
import ProblemErrorManager from '@/components/dashboard/light/ProblemErrorManagerLight';
import WrongAnswerManager from '@/components/dashboard/WrongAnswerManager';
import ExamPaperManager from '@/components/dashboard/exam/light/ExamPaperManagerLight';
import TimetableSettings from '@/components/dashboard/settings/TimetableSettings';
import PdfLibraryView from '@/components/dashboard/PdfLibraryView';
import DigitalMathLibraryView from '@/components/dashboard/DigitalMathLibraryView';
import VideoPlayerModal from '@/components/common/VideoPlayerModal';
import { supabase } from '@/lib/supabase';
import { getTodayStr, getDayOfWeek, getInitial } from '@/lib/utils';
import { ATTENDANCE_STATUS, normalizeAttendanceStatus } from '@/lib/sessionFieldMap';
import { Student, SessionLog, StudentStatus, TextbookOption, AbsenceLinkContext } from '@/types/dashboard';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEnrichedStudentData, evaluateTodayStatus, buildSessionLog } from '@/lib/studentDataEnricher';

/**
 * 💡 [리팩토링] 파생 상태 계산 및 필터링 유틸리티
 */

import { getStudentStartTime, getStudentActiveHours, getPureFilteredStudents, filterStudentList } from '../dashboard/utils/dashboardFilters';

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
    // 라이트 모드 강제 고정
    const originalTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');

    return () => {
      // 나갈 때 원래 테마 복구
      if (originalTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    };
  }, []);

  useEffect(() => {
    // 💡 [안정화] 마운트 완료 후 클라이언트 환경에서만 이전 보던 탭 화면을 복구하여 Hydration Mismatch를 방지합니다.
    setIsMounted(true);
    const savedTab = localStorage.getItem('ams_viewMode');
    const recoveredUserJson = localStorage.getItem('ams_user');
    if (recoveredUserJson && savedTab) {
      setViewMode(savedTab);
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

      // 💡 마지막으로 보던 화면(탭) 복구 (새로고침 대응 - 지연 초기화 함수에서 선행 처리하므로 중복 set is_deleted)
      const savedViewMode = localStorage.getItem('ams_viewMode');
      const initialMode = savedViewMode || 'board';
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

  // 🎬 전역 비디오 팝업 플레이어 모달 상태
  const [globalVideoState, setGlobalVideoState] = useState<{
    isOpen: boolean;
    videoUrl: string;
    title?: string;
    timestampsText?: string;
  }>({ isOpen: false, videoUrl: '' });

  useEffect(() => {
    const handleGlobalVideoOpen = (e: any) => {
      if (e.detail?.videoUrl) {
        setGlobalVideoState({
          isOpen: true,
          videoUrl: e.detail.videoUrl,
          title: e.detail.title || '학습 동영상 플레이어',
          timestampsText: e.detail.timestampsText || ''
        });
      }
    };
    window.addEventListener('ams-open-video-modal', handleGlobalVideoOpen as any);
    return () => {
      window.removeEventListener('ams-open-video-modal', handleGlobalVideoOpen as any);
    };
  }, []);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ams_selectedTeacherId') || 'All';
    }
    return 'All';
  });
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

  // 💡 [보안/편의 개선] 로그인한 사용자 권한 및 활성 교사 목록에 따른 선생님 필터 초기화/복원/저장
  const normalizedSlugStr = (Array.isArray(slug) ? slug[0] : slug || '').toLowerCase();
  const teacherStorageKey = currentUser?.id && normalizedSlugStr
    ? `ams_selectedTeacherId_${normalizedSlugStr}_${currentUser.id}`
    : null;

  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.role === 'teacher') {
      // 일반 교사는 본인 전용 데이터이므로 필터를 항상 'All'로 유지 (본인 학생만 서버/쿼리 레벨에서 로드됨)
      setSelectedTeacherId('All');
      if (teacherStorageKey) localStorage.removeItem(teacherStorageKey);
    } else {
      // 관리자(admin/master)는 신규 키 -> 레거시 키 순으로 복원
      let targetTeacherId = 'All';
      if (teacherStorageKey) {
        const savedNew = localStorage.getItem(teacherStorageKey);
        if (savedNew) {
          targetTeacherId = savedNew;
        } else {
          const legacySaved = localStorage.getItem('ams_selectedTeacherId');
          if (legacySaved) {
            targetTeacherId = legacySaved;
          }
        }
      }
      setSelectedTeacherId(targetTeacherId);
    }
  }, [currentUser?.id, currentUser?.role, teacherStorageKey]);

  // 💡 선택한 선생님 필터 상태 로컬스토리지 연동
  useEffect(() => {
    if (teacherStorageKey && selectedTeacherId) {
      localStorage.setItem(teacherStorageKey, selectedTeacherId);
    }
  }, [selectedTeacherId, teacherStorageKey]);

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

  // 💡 [Fallback Effect] 데이터 로딩 완료 후, 선택된 선생님이 활성 교사 목록(재원생 1명 이상)에서 사라졌다면 'All'로 안전하게 되돌림
  useEffect(() => {
    if (isLoading || !currentUser || currentUser.role === 'teacher') return;
    if (selectedTeacherId === 'All') return;

    const activeTeacherIdSet = new Set(
      students.filter(s => !s.is_deleted && s.teacher_id).map(s => s.teacher_id)
    );

    if (!activeTeacherIdSet.has(selectedTeacherId)) {
      setSelectedTeacherId('All');
    }
  }, [isLoading, currentUser?.role, selectedTeacherId, students]);
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

  // 💡 [결석 연동 보강 프리셋 상태]
  const [absenceLinkPreset, setAbsenceLinkPreset] = useState<AbsenceLinkContext | null>(null);

  // 💡 결석 연동 보강 전용 진입 핸들러
  const handleNavigateToLinkedMakeup = useCallback((mode: string | AbsenceLinkContext) => {
    if (typeof mode === 'object' && mode !== null && mode.source === 'absence-popup') {
      setAbsenceLinkPreset(mode);
    }
    setViewMode('teacherTask');
    setSelectedStudentId(null);
    if (typeof window !== 'undefined') {
      window.history.pushState({ viewMode: 'teacherTask' }, '');
    }
  }, []);

  // 💡 일반 탭 전환 핸들러 (사이드바 등에서 진입 시 결석 연동 프리셋은 무조건 null로 초기화)
  const navigateTo = useCallback((mode: string | AbsenceLinkContext, skipHistory = false) => {
    if (typeof mode === 'object' && mode !== null && mode.source === 'absence-popup') {
      handleNavigateToLinkedMakeup(mode);
      return;
    }

    // 일반 탭 진입 시 결석 연동 컨텍스트 확실하게 정리
    setAbsenceLinkPreset(null);

    const targetMode = mode as string;
    if (viewMode === targetMode) return;

    setViewMode(targetMode); setSelectedStudentId(null);
    if (typeof window !== 'undefined') {
      if (skipHistory) {
        window.history.replaceState({ viewMode: targetMode }, '');
      } else {
        window.history.pushState({ viewMode: targetMode }, '');
      }
    }
  }, [viewMode, currentUser?.role, handleNavigateToLinkedMakeup]);

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
  const realStudentId = studentId.replace(/_special.*$/, '').replace(/_makeup.*$/, '');
  const student = students.find(s => s.id === realStudentId);
  if (!student || !academy) return false;

  const targetSaveDate = sessionData.session_date || selectedDate;
  const targetCourseName = sessionData.course_name || '정규';
  const targetMovedHour = sessionData.moved_to_hour !== undefined ? sessionData.moved_to_hour : null;
  const fromMovedHour = sessionData.from_moved_to_hour !== undefined ? sessionData.from_moved_to_hour : null;
  const targetIsPureMakeup = ('is_pure_makeup' in sessionData)
    ? (sessionData.is_pure_makeup === true)
    : undefined;

  // 💡 [시간 이동 저장 정밀화] 기존 세션 ID 또는 from_moved_to_hour로 기존 로그를 정확하게 타겟팅하여 UPDATE
  let existingLog = (student.allLogs || []).find((l: any) =>
    sessionData.id && sessionData.id !== 'temp' ? l.id === sessionData.id : (
      (l.date || l.session_date) === targetSaveDate &&
      (l.course_name === targetCourseName || (targetCourseName === '정규' && !l.course_name)) &&
      (
        fromMovedHour !== null
          ? ((l.moved_to_hour ?? null) === fromMovedHour)
          : ((l.moved_to_hour ?? null) === targetMovedHour)
      ) &&
      (targetIsPureMakeup !== undefined ? ((l.is_pure_makeup ?? false) === targetIsPureMakeup) : true)
    )
  );

  if (!existingLog && targetCourseName === '정규' && targetMovedHour === null && (student.todaySession?.course_name === '정규' || !student.todaySession?.course_name) && (student.todaySession?.moved_to_hour ?? null) === null && !targetIsPureMakeup) {
    existingLog = student.todaySession;
  }

  let sessionId = (sessionData.id && sessionData.id !== 'temp' && !String(sessionData.id).startsWith('temp:'))
    ? sessionData.id
    : (existingLog?.id && existingLog.id !== 'temp' && !String(existingLog.id).startsWith('temp:') ? existingLog.id : undefined);

  // 💡 [독립 세션 참조] 과목이 일치하는 existingLog만 targetSession으로 사용 (타 과목 todaySession으로 교차 오염 차단)
  const targetSession = existingLog;
  const finalIsPureMakeup = targetIsPureMakeup !== undefined ? targetIsPureMakeup : (targetSession?.is_pure_makeup === true);

  const dataToSave = { ...sessionData };

  // 1. 기본 필드 필터링
  const filteredData = getFilteredBaseFields(dataToSave);

  // 💡 [안정화] 오늘 테스트 ID(test_status / test_id)가 저장 요청에 아예 전달되지 않았고, 현재 세션에 존재한다면 포함
  const hasTestKey = ('test_id' in dataToSave) || ('test_status' in dataToSave);
  if (!hasTestKey && targetSession?.test_id) {
    filteredData.test_status = targetSession.test_id;
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
      const sRealId = s.originalId || s.id;
      if (sRealId !== realStudentId) return s;

      const isTestCompleted = ('test_completed' in dataToSave) ? dataToSave.test_completed : (targetCourseName === '정규' && targetMovedHour === null ? s.todaySession?.test_completed : undefined);

      let updatedAllLogs = s.allLogs || [];
      const logIndex = updatedAllLogs.findIndex(l =>
        sessionId && sessionId !== 'temp' && !String(sessionId).startsWith('temp:') ? l.id === sessionId : (
          (l.date || l.session_date) === selectedDate &&
          (l.course_name === targetCourseName || (targetCourseName === '정규' && (!l.course_name || l.course_name === '정규'))) &&
          (
            fromMovedHour !== null
              ? ((l.moved_to_hour ?? null) === fromMovedHour)
              : ((l.moved_to_hour ?? null) === targetMovedHour)
          ) &&
          ((l.is_pure_makeup ?? false) === (finalIsPureMakeup ?? false))
        )
      );

      const logToPut = {
        ...(logIndex !== -1 ? updatedAllLogs[logIndex] : { id: sessionId || `temp:${realStudentId}:${selectedDate}:${targetCourseName}:${finalIsPureMakeup ? 'makeup' : 'regular'}:${targetMovedHour ?? 'null'}`, student_id: realStudentId, academy_id: academy.id, date: selectedDate, session_date: selectedDate }),
        ...filteredData,
        date: selectedDate,
        course_name: targetCourseName,
        moved_to_hour: targetMovedHour,
        is_pure_makeup: finalIsPureMakeup,
        status: filteredData.status || 'none',
        management_notes: ('management_notes' in dataToSave) ? dataToSave.management_notes : (logIndex !== -1 ? updatedAllLogs[logIndex].management_notes : s.management_notes),
        test_id: ('test_id' in dataToSave) ? dataToSave.test_id : (logIndex !== -1 ? updatedAllLogs[logIndex].test_id : undefined),
        test_completed: isTestCompleted,
        test_cut: ('test_cut' in dataToSave) ? dataToSave.test_cut : (logIndex !== -1 ? updatedAllLogs[logIndex].test_cut : 0),
        mission: ('mission' in dataToSave) ? dataToSave.mission : (logIndex !== -1 ? updatedAllLogs[logIndex].mission : undefined),
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
        updatedAllLogs = [{ ...logToPut, course_name: targetCourseName, moved_to_hour: targetMovedHour, is_pure_makeup: finalIsPureMakeup }, ...updatedAllLogs];
      }

      // todaySession은 오직 정규 원래 수업(targetCourseName === '정규', targetMovedHour === null && !finalIsPureMakeup)일 때만 업데이트!
      const isRegularOriginalCourse = (targetCourseName === '정규' || !targetCourseName) && targetMovedHour === null && !finalIsPureMakeup;

      const updatedTodaySession = isRegularOriginalCourse ? {
        ...(s.todaySession || { id: sessionId || `temp:${realStudentId}:${selectedDate}:정규:regular:null`, student_id: realStudentId, academy_id: academy.id, date: selectedDate, session_date: selectedDate }),
        ...filteredData,
        date: selectedDate,
        status: filteredData.status || 'none',
        course_name: '정규',
        moved_to_hour: null,
        is_pure_makeup: false,
        management_notes: ('management_notes' in dataToSave) ? (dataToSave.management_notes ?? '') : (s.todaySession?.management_notes ?? ''),
        test_id: ('test_id' in dataToSave) ? dataToSave.test_id : (('test_status' in dataToSave) ? dataToSave.test_status : s.todaySession?.test_id),
        test_completed: isTestCompleted,
        test_cut: ('test_cut' in dataToSave) ? dataToSave.test_cut : (s.todaySession?.test_cut ?? 0),
        mission: ('mission' in dataToSave) ? (dataToSave.mission ?? '') : (s.todaySession?.mission ?? ''),
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
      } : s.todaySession;

      return {
        ...s,
        management_notes: ('management_notes' in dataToSave) ? (dataToSave.management_notes ?? '') : s.management_notes,
        todaySession: updatedTodaySession,
        allLogs: updatedAllLogs
      };
    }));

    try {
      if (finalIsPureMakeup && !filteredData.attendance_reason) {
        filteredData.attendance_reason = targetSession?.attendance_reason || '보강 수업';
      }

      // 💡 [불변 스냅샷 보존] 오늘 및 미래 세션 생성 시 최초 1회만 당시 수업 맥락 스냅샷 생성 (과거 날짜는 자동 생성 금지, 기존 스냅샷 덮어쓰기 금지)
      let sessionSnapshotToSave = targetSession?.session_snapshot;
      if (!sessionSnapshotToSave && targetSaveDate >= getTodayStr()) {
        const dayKey = getDayOfWeek(targetSaveDate || selectedDate);
        const isMakeup = finalIsPureMakeup;
        const isSpecial = !isMakeup && targetCourseName !== '정규';
        let courseId: string | null = null;
        let scheduledDays: string[] = [];
        let scheduledHours: number[] = [];
        const classDays = Array.isArray(student.class_days) && student.class_days.length > 0
          ? student.class_days
          : [];
        const scheduleDays = Object.entries(student.day_schedules || {})
          .filter(([, hours]) => Array.isArray(hours) && (hours as any[]).length > 0)
          .map(([day]) => day.replace('요일', '').trim())
          .filter(Boolean);
        const regularClassDays = classDays.length > 0 ? classDays : scheduleDays;

        if (isMakeup) {
          // 💡 [보강 수업 스냅샷] 보강 여부와 무관하게 당시 학생의 정규 시간표 등록 요일을 식별 정보로 보존
          scheduledDays = regularClassDays;
          scheduledHours = targetMovedHour !== null ? [targetMovedHour] : [];
        } else if (isSpecial) {
          const rawElective = student.book_courses?.['__elective_courses'];
          if (rawElective) {
            try {
              const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
              if (Array.isArray(courses)) {
                const matchC = courses.find((c: any) => c && (c.subject?.trim() === targetCourseName || c.course_name?.trim() === targetCourseName));
                if (matchC) {
                  courseId = matchC.id || null;
                  scheduledDays = Array.isArray(matchC.days) ? matchC.days : (typeof matchC.days === 'string' ? [matchC.days] : []);
                  const schedH = matchC.schedules?.[dayKey] || matchC.hours || [];
                  scheduledHours = Array.isArray(schedH) ? schedH.map((h: any) => {
                    const num = parseInt(String(h), 10);
                    if (isNaN(num)) return 16;
                    return num >= 100 ? Math.floor(num / 100) : num;
                  }) : [];
                }
              }
            } catch (e) {}
          }
        } else {
          // 정규 수업
          scheduledDays = regularClassDays;
          scheduledHours = (student.day_schedules?.[dayKey] || []).map((h: any) => {
            const num = parseInt(String(h), 10);
            if (isNaN(num)) return 16;
            return num >= 100 ? Math.floor(num / 100) : num;
          });
        }

        sessionSnapshotToSave = {
          version: 1,
          sessionType: isMakeup ? 'makeup' : (isSpecial ? 'elective' : 'regular'),
          courseName: targetCourseName,
          courseId: courseId,
          scheduledDays: scheduledDays,
          scheduledHours: scheduledHours,
          isPureMakeup: isMakeup,
          source: 'today_sheet',
          capturedAt: new Date().toISOString()
        };
      }

      const payload: any = {
        student_id: realStudentId,
        student_name: student.name,
        academy_id: academy.id,
        session_date: targetSaveDate,
        course_name: targetCourseName,
        moved_to_hour: targetMovedHour,
        ...filteredData,
        is_pure_makeup: finalIsPureMakeup,
        ...(sessionSnapshotToSave ? { session_snapshot: sessionSnapshotToSave } : {})
      };
      let targetId = (sessionId && sessionId !== 'temp' && !String(sessionId).startsWith('temp:')) ? sessionId : undefined;
      if (!targetId) {
        let query = supabase
          .from('ams_session_logs')
          .select('id')
          .eq('student_id', realStudentId)
          .eq('session_date', targetSaveDate)
          .order('created_at', { ascending: false })
          .limit(1);

        if (targetCourseName && targetCourseName !== '정규') {
          query = query.eq('course_name', targetCourseName);
        } else if (targetCourseName === '정규') {
          query = query.or('course_name.eq.정규,course_name.is.null');
        }

        const queryMovedHour = fromMovedHour !== null ? fromMovedHour : targetMovedHour;
        if (queryMovedHour !== null) {
          query = query.eq('moved_to_hour', queryMovedHour);
        } else {
          query = query.is('moved_to_hour', null);
        }

        if (finalIsPureMakeup) {
          query = query.eq('is_pure_makeup', true);
        } else {
          query = query.or('is_pure_makeup.eq.false,is_pure_makeup.is.null');
        }

        const { data: dbLogs } = await query;
        if (dbLogs && dbLogs.length > 0) {
          targetId = dbLogs[0].id;
        }
      }

      if (targetId) {
        payload.id = targetId;
      } else {
        if (!('attendance_status' in filteredData)) {
          payload.attendance_status = null;
        }
      }

      const conflictKeys = payload.id ? 'id' : 'student_id,session_date,course_name,moved_to_hour';
      const { data: savedLog, error } = await supabase
        .from('ams_session_logs')
        .upsert([payload], { onConflict: conflictKeys })
        .select()
        .maybeSingle();

      if (error) throw error;

      if (savedLog) {
        setStudents(prev => prev.map(s => {
          const sRealId = s.originalId || s.id;
          if (sRealId !== realStudentId) return s;

          const nextQuiz = savedLog.homework_to ? (typeof savedLog.homework_to === 'string' ? JSON.parse(savedLog.homework_to) : savedLog.homework_to) : {};
          const testRes = savedLog.test_result ? (typeof savedLog.test_result === 'string' ? JSON.parse(savedLog.test_result) : savedLog.test_result) : {};

          const savedCourseName = savedLog.course_name || '정규';
          const isRegularOriginalSession = (savedCourseName === '정규' || !savedCourseName) && (savedLog.moved_to_hour === null || savedLog.moved_to_hour === undefined) && savedLog.is_pure_makeup !== true;

          const finalSavedTodaySession = {
            ...savedLog,
            // 💡 [지연 상태 덮어쓰기 방지] DB 비동기 저장이 지연되어 완료되었을 때,
            // 그 사이 사용자가 수정/복구해 둔 로컬 상태 텍스트 필드가 존재한다면 이를 최우선 보존 (정규 과목만 적용)
            ...(isRegularOriginalSession && !('classwork_text' in dataToSave) && s.todaySession?.classwork_text !== undefined ? { classwork_text: s.todaySession.classwork_text } : {}),
            ...(isRegularOriginalSession && !('completed_classwork_text' in dataToSave) && s.todaySession?.completed_classwork_text !== undefined ? { completed_classwork_text: s.todaySession.completed_classwork_text } : {}),
            ...(isRegularOriginalSession && !('homework_text' in dataToSave) && s.todaySession?.homework_text !== undefined ? { homework_text: s.todaySession.homework_text } : {}),
            ...(isRegularOriginalSession && !('special_notes' in dataToSave) && s.todaySession?.special_notes !== undefined ? { special_notes: s.todaySession.special_notes } : {}),
            ...(isRegularOriginalSession && !('test_score' in dataToSave) && s.todaySession?.test_score !== undefined ? { test_score: s.todaySession.test_score } : {}),

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
            test_answers: savedLog.test_answers || null,
            is_pure_makeup: savedLog.is_pure_makeup ?? finalIsPureMakeup
          };

          // 💡 [동기화 특효처방] DB 서버 반영 완료된 최종 일지를 allLogs 에도 일관성 있게 주입!
          let updatedAllLogs = s.allLogs || [];
          let logIndex = -1;
          if (savedLog.id) {
            logIndex = updatedAllLogs.findIndex(l => l.id === savedLog.id);
          }
          if (logIndex === -1) {
            logIndex = updatedAllLogs.findIndex(l =>
              (l.id === 'temp' || String(l.id || '').startsWith('temp:') || !l.id) &&
              (l.date || l.session_date) === selectedDate &&
              (l.course_name === savedCourseName || (savedCourseName === '정규' && !l.course_name)) &&
              (
                fromMovedHour !== null
                  ? ((l.moved_to_hour ?? null) === fromMovedHour)
                  : ((l.moved_to_hour ?? null) === (savedLog.moved_to_hour ?? null))
              ) &&
              ((l.is_pure_makeup ?? false) === (finalIsPureMakeup ?? false))
            );
          }

          if (logIndex !== -1) {
            updatedAllLogs = updatedAllLogs.map((l, i) => i === logIndex ? { ...l, ...finalSavedTodaySession } : l);
          } else {
            updatedAllLogs = [finalSavedTodaySession, ...updatedAllLogs];
          }

          return {
            ...s,
            ...(isRegularOriginalSession ? { todaySession: finalSavedTodaySession } : {}),
            allLogs: updatedAllLogs
          };
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

  // 💡 [결석 세션 최소 단일 재조회 핸들러]
  const refreshAbsenceSession = useCallback(async (context: {
    studentId: string;
    sessionDate: string;
    courseName: string;
    movedToHour: number | null;
  }): Promise<boolean> => {
    if (!academy) return false;

    try {
      const realStudentId = context.studentId.replace(/_special.*$/, '').replace(/_makeup.*$/, '');
      let query = supabase
        .from('ams_session_logs')
        .select('*')
        .eq('academy_id', academy.id)
        .eq('student_id', realStudentId)
        .eq('session_date', context.sessionDate)
        .eq('is_pure_makeup', false);

      if (context.courseName && context.courseName !== '정규') {
        query = query.eq('course_name', context.courseName);
      } else {
        query = query.or('course_name.eq.정규,course_name.is.null');
      }

      if (context.movedToHour === null) {
        query = query.is('moved_to_hour', null);
      } else {
        query = query.eq('moved_to_hour', context.movedToHour);
      }

      const { data: logData, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (error) {
        console.error('Failed to query absence session:', error.message || error);
        return false;
      }

      if (!logData || !logData.id) {
        return false;
      }

      const isValidSessionLogId = (value: unknown): boolean => {
        const normalized = String(value ?? '').trim();
        return /^[1-9]\d*$/.test(normalized);
      };

      if (!isValidSessionLogId(logData.id)) {
        return false;
      }

      const enrichedLog = buildSessionLog(logData, availableTextbooks);

      setStudents(prev => prev.map(s => {
        const sRealId = s.originalId || s.id;
        if (sRealId !== realStudentId) return s;

        let updatedAllLogs = s.allLogs || [];
        const existingIdx = updatedAllLogs.findIndex(l => String(l.id) === String(enrichedLog.id));

        if (existingIdx !== -1) {
          updatedAllLogs = updatedAllLogs.map((l, i) => i === existingIdx ? { ...l, ...enrichedLog } : l);
        } else {
          updatedAllLogs = [enrichedLog, ...updatedAllLogs];
        }

        const isRegularOriginalSession = (context.courseName === '정규' || !context.courseName) && context.movedToHour === null;

        return {
          ...s,
          ...(isRegularOriginalSession ? { todaySession: enrichedLog } : {}),
          allLogs: updatedAllLogs
        };
      }));

      return true;
    } catch (err: any) {
      console.error('Exception during absence session refresh:', err?.message || err);
      return false;
    }
  }, [academy, availableTextbooks]);

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
        .upsert(payloads, { onConflict: 'student_id,session_date,course_name,moved_to_hour' })
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
        if (bookIdx > -1) {
          currentCwJson[bookIdx].units = (currentCwJson[bookIdx].units || []).filter((u: string) => u !== unitName);
          if (currentCwJson[bookIdx].units.length === 0) currentCwJson.splice(bookIdx, 1);
        }
      } else {
        if (bookIdx > -1) { const currentUnits = currentCwJson[bookIdx].units || []; if (!currentUnits.includes(unitName)) currentCwJson[bookIdx].units = [...currentUnits, unitName]; }
        else { currentCwJson.push({ type: 'book', book_name: bookCode, range: 'Legacy Completion', units: [unitName] }); }
      }

      const logData = { student_id: studentId, academy_id: academy.id, session_date: '1900-01-01', classwork_text: `[LEGACY] 진도 수동 보정 데이터`, classwork_json: currentCwJson, status: null };
      if (legacyLog) { await supabase.from('ams_session_logs').update(logData).eq('id', legacyLog.id); } else if (mode === 'add') { await supabase.from('ams_session_logs').insert([logData]); }
      await fetchAllData(false); return true;
    } catch (e) {
      console.error('Legacy progress error:', e);
      await handleAuthError(e);
      return false;
    }
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
    } catch (e) {
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
      console.error('Batch add students failed:', e);
      if (await handleAuthError(e)) return false;
      alert('일괄 등록 실패: ' + e.message);
      return false;
    }
  };

  const addStudentToToday = async (studentId: string) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 데이터를 수정할 수 없습니다.');
      return;
    }
    if (!academy) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // 오늘이 정규 수업 요일인지 판정
    const { isTodayClassDay: isScheduledToday } = evaluateTodayStatus(selectedDate, student.class_days || [], academy?.operation_settings?.holidays);

    const newStatus = isScheduledToday ? ATTENDANCE_STATUS.BEFORE : '보강';
    const newReason = isScheduledToday ? null : '보강 수업';

    // '수업취소', '수업제외' 잔상 텍스트 제거
    const cleanNotes = (student.todaySession?.special_notes || '')
      .replace(/\[수업취소\]|\[수업제외\]|수업취소|수업제외/g, '')
      .trim();

    // 1. 로컬 상태 즉시 낙관적 업데이트 (화면 즉시 반영)
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          todaySession: s.todaySession ? {
            ...s.todaySession,
            attendance_status: newStatus,
            attendance_reason: newReason,
            special_notes: cleanNotes,
          } : s.todaySession
        };
      }
      return s;
    }));

    // 2. DB 직접 업데이트 (saveTodaySession 우회)
    try {
      const targetSaveDate = selectedDate;
      const targetCourseName = '정규';
      let targetId = (student.todaySession?.id && student.todaySession.id !== 'temp') ? student.todaySession.id : undefined;
      if (!targetId) {
        const { data: existing } = await supabase
          .from('ams_session_logs')
          .select('id')
          .eq('student_id', studentId)
          .eq('session_date', targetSaveDate)
          .eq('course_name', targetCourseName)
          .maybeSingle();
        if (existing?.id) targetId = existing.id;
      }

      const payload: any = {
        student_id: studentId,
        student_name: student.name,
        academy_id: academy.id,
        session_date: targetSaveDate,
        course_name: targetCourseName,
        attendance_status: newStatus,
        attendance_reason: newReason,
        special_notes: cleanNotes,
      };
      if (targetId) payload.id = targetId;
      if (!isScheduledToday) {
        const settings = academy?.operation_settings || {};
        const baseHour = parseInt((settings.first_period_time || '15:00').split(':')[0]);
        payload.moved_to_hour = baseHour;
      }

      const { error } = await supabase
        .from('ams_session_logs')
        .upsert([payload], { onConflict: payload.id ? 'id' : 'student_id,session_date,course_name,moved_to_hour' });

      if (error) throw error;
    } catch (e: any) {
      console.error('수업 복구 저장 오류:', e);
    }
  };

  const batchAddStudents = async (
    studentIds: string[],
    reasons: Record<string, string> = {},
    makeupHours: Record<string, number> = {},
    makeupCourses: Record<string, string> = {}
  ) => {
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

        const courseName = makeupCourses[id] || '정규';
        const { isTodayClassDay: isScheduledToday } = evaluateTodayStatus(selectedDate, s.class_days || [], academy?.operation_settings?.holidays);
        const hour = makeupHours[id] !== undefined ? makeupHours[id] : null;
        const reason = reasons[id] || '보강 수업';

        const log: any = {
          student_id: id,
          student_name: s.name,
          academy_id: academy.id,
          session_date: selectedDate,
          attendance_status: '보강',
          status: null,
          moved_to_hour: hour,
          attendance_reason: reason,
          course_name: courseName
        };

        const exist = s.todaySession?.special_notes || '';
        log.special_notes = (exist && !exist.includes('[temp]')) ? exist : '';

        return log;
      }).filter(Boolean);

      if (newLogs.length === 0) {
        setIsBatchMode(false);
        return;
      }

      for (const log of newLogs) {
        const targetStudent = students.find(s => s.id === log.student_id);
        const targetMoved = log.moved_to_hour ?? null;
        const existing = (targetStudent?.allLogs || []).find((l: any) =>
          (l.date || l.session_date) === log.session_date &&
          (l.course_name === log.course_name || (log.course_name === '정규' && (!l.course_name || l.course_name === '정규'))) &&
          ((l.moved_to_hour ?? null) === targetMoved)
        );
        if (existing?.id) {
          await supabase.from('ams_session_logs').update(log).eq('id', existing.id);
        } else {
          await supabase.from('ams_session_logs').insert([log]);
        }
      }
      await fetchAllData(false);
      setIsBatchMode(false);
    } catch (e) {
      console.error('Batch Add Error:', e);
      alert('일괄 추가 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeStudentFromToday = async (
    studentId: string,
    reason: string = '',
    mode: 'delete' | 'cancel' = 'cancel',
    sessionMeta?: {
      courseName?: string;
      sessionId?: string;
      movedToHour?: number | null;
      isMakeup?: boolean;
    }
  ) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 데이터를 수정할 수 없습니다.');
      return;
    }

    // 💡 [선택과목/특강/보강 파생 ID 대응 및 sessionMeta 우선 적용]
    let realStudentId = studentId;
    let targetCourseName = sessionMeta?.courseName || '정규';
    let targetSessionId: string | undefined = (sessionMeta?.sessionId && sessionMeta.sessionId !== 'temp' && !String(sessionMeta.sessionId).startsWith('temp:'))
      ? sessionMeta.sessionId
      : undefined;
    let targetMovedHour: number | null = sessionMeta?.movedToHour !== undefined ? sessionMeta.movedToHour : null;
    let isMakeupDeletion = sessionMeta?.isMakeup !== undefined ? sessionMeta.isMakeup : studentId.includes('_makeup_');

    // 1. sessionMeta가 지정되지 않은 경우, 현재 렌더링된 todayStudents 목록에서 해당 row 객체 탐색
    if (!sessionMeta) {
      const targetRow = (todayStudents as any[])?.find((s: any) => s.id === studentId);
      if (targetRow) {
        realStudentId = targetRow.originalId || targetRow.id;
        targetCourseName = targetRow.courseName || targetRow.todaySession?.course_name || (targetRow.isSpecialClass ? targetRow.electiveCourse?.subject : '정규') || '정규';
        if (targetRow.todaySession?.id && targetRow.todaySession.id !== 'temp') {
          targetSessionId = targetRow.todaySession.id;
        }
        if (targetRow.todaySession?.moved_to_hour !== undefined && targetRow.todaySession?.moved_to_hour !== null) {
          targetMovedHour = targetRow.todaySession.moved_to_hour;
        }
      } else if (studentId.includes('_special_')) {
        const parts = studentId.split('_special_');
        realStudentId = parts[0];
        if (parts[1]) {
          const subParts = parts[1].split('_');
          targetCourseName = subParts[0] || '특강';
        }
      } else if (studentId.includes('_makeup_')) {
        const parts = studentId.split('_makeup_');
        realStudentId = parts[0];
        const makeupSuffix = parts[1] || '';
        if (makeupSuffix) {
          const subParts = makeupSuffix.split('_');
          if (subParts.length >= 2) {
            targetCourseName = subParts[0];
            targetSessionId = subParts[1];
          } else {
            targetSessionId = makeupSuffix;
          }
        }
      }
    } else {
      if (studentId.includes('_special_')) {
        realStudentId = studentId.split('_special_')[0];
      } else if (studentId.includes('_makeup_')) {
        realStudentId = studentId.split('_makeup_')[0];
      }
    }

    const student = students.find(s => s.id === realStudentId || s.originalId === realStudentId);
    if (!student || !academy) return;

    // 2. 세션 ID가 없는 경우 student.allLogs에서 정밀 매칭
    if (!targetSessionId || targetSessionId === 'temp' || String(targetSessionId).startsWith('temp:')) {
      const matchedLog = (student.allLogs || []).find((l: any) =>
        (l.date || l.session_date) === selectedDate &&
        (l.course_name === targetCourseName || (targetCourseName === '정규' && (!l.course_name || l.course_name === '정규'))) &&
        (isMakeupDeletion
          ? (l.is_pure_makeup === true || String(l.attendance_status || '').startsWith('보강'))
          : (l.is_pure_makeup !== true && !String(l.attendance_status || '').startsWith('보강'))) &&
        (targetMovedHour === null || (l.moved_to_hour ?? null) === targetMovedHour)
      );
      if (matchedLog?.id && matchedLog.id !== 'temp' && !String(matchedLog.id).startsWith('temp:')) {
        targetSessionId = matchedLog.id;
        if (targetMovedHour === null && matchedLog.moved_to_hour !== undefined && matchedLog.moved_to_hour !== null) {
          targetMovedHour = matchedLog.moved_to_hour;
        }
      }
    }
    try {
      if (mode === 'delete') {
        const confirmResult = confirm(
          `오늘 ${student.name} 학생의 [${targetCourseName}] 수업 데이터를 데이터베이스에서 완전히 삭제하시겠습니까?\n\n` +
          `※ 이 작업은 되돌릴 수 없으며, 오늘 출결 통계 및 명단에서 아예 지워집니다.`
        );
        if (!confirmResult) return;

        const isRealSessionId = targetSessionId && targetSessionId !== 'temp' && !String(targetSessionId).startsWith('temp:');

        // 🗑️ RLS를 완벽히 돌파하는 백엔드 API 호출 방식으로 완전 삭제 (DELETE)
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_session',
            sessionId: isRealSessionId ? targetSessionId : undefined,
            studentId: realStudentId,
            sessionDate: selectedDate,
            courseName: targetCourseName,
            movedToHour: targetMovedHour,
            isMakeup: isMakeupDeletion
          })
        });
        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || '백엔드 세션 삭제 실패');
        }

        // 💡 [낙관적 즉시 반영] 삭제된 세션을 allLogs에서 즉시 제거
        const isCourseMatch = (c1: string, c2: string) => {
          const clean1 = (c1 || '정규').replace(/\s+/g, '').toLowerCase();
          const clean2 = (c2 || '정규').replace(/\s+/g, '').toLowerCase();
          return clean1 === clean2 || clean1.includes(clean2) || clean2.includes(clean1);
        };

        setStudents((prev: any[]) => (prev || []).map((s: any) => {
          if (s.id === realStudentId || s.originalId === realStudentId) {
            const updatedLogs = (s.allLogs || []).filter((l: any) => {
              if (targetSessionId && l.id === targetSessionId) return false;
              const lDate = (l.date || l.session_date || '').replace(/\./g, '-');
              const lCourse = l.course_name || '정규';
              const lMoved = l.moved_to_hour ?? null;
              const lIsMakeup = l.is_pure_makeup === true || String(l.attendance_status || '').startsWith('보강');

              if (lDate === selectedDate && isCourseMatch(lCourse, targetCourseName)) {
                if (isMakeupDeletion) {
                  // 💡 보강 삭제 시에는 오직 보강 로그만 제거 (원래 수업 로그는 절대 삭제 금지!)
                  if (lIsMakeup && (targetMovedHour === null || lMoved === targetMovedHour)) {
                    return false;
                  }
                } else {
                  // 💡 비보강 수업 삭제 시
                  if (!lIsMakeup && (targetMovedHour === null || lMoved === targetMovedHour)) {
                    return false;
                  }
                }
              }
              return true;
            });
            return {
              ...s,
              allLogs: updatedLogs,
              ...(!isMakeupDeletion && targetCourseName === '정규' ? { todaySession: { ...s.todaySession, attendance_status: '출석전', status: 'none', moved_to_hour: null } } : {})
            };
          }
          return s;
        }));
      } else {
        // 💡 [수업취소/제외 시 원위치 복구 명확화]
        // 원래 오늘 등원 시간표가 없던 원생(isScheduledToday === false)이 수업 취소를 누른 경우:
        // DB 세션을 삭제하여 하단(Bottom) 명단으로 100% 원위치 즉시 복귀시킵니다!
        const { isTodayClassDay: isScheduledToday } = evaluateTodayStatus(selectedDate, student.class_days || [], academy?.operation_settings?.holidays);

        if (!isScheduledToday) {
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete_session',
              studentId: realStudentId,
              sessionDate: selectedDate,
              courseName: targetCourseName
            })
          });
          const resData = await res.json();
          if (!res.ok || !resData.success) {
            throw new Error(resData.error || '백엔드 세션 삭제 실패');
          }
        } else {
          // 원래 오늘 정규 시간표에 있던 원생은 '수업취소' 상태로 상단 이력 보존
          const payload: any = {
            student_id: realStudentId,
            student_name: student.name,
            academy_id: academy.id,
            session_date: selectedDate,
            attendance_status: '수업취소',
            status: null,
            attendance_reason: reason || '수업 취소',
            moved_to_hour: null,
            course_name: targetCourseName
          };

          const exist = student.todaySession?.special_notes || '';
          payload.special_notes = (exist && !exist.includes('[temp]')) ? exist : '';
          if (payload.id) {
            const { error } = await supabase.from('ams_session_logs').update(payload).eq('id', payload.id);
            if (error) throw error;
          } else {
            const targetStudent = students.find(s => s.id === studentId);
            const targetMovedHour = payload.moved_to_hour ?? null;
            const existing = (targetStudent?.allLogs || []).find((l: any) =>
              (l.date || l.session_date) === selectedDate &&
              (l.course_name === targetCourseName || (targetCourseName === '정규' && (!l.course_name || l.course_name === '정규'))) &&
              ((l.moved_to_hour ?? null) === targetMovedHour)
            );
            if (existing?.id) {
              const { error } = await supabase.from('ams_session_logs').update(payload).eq('id', existing.id);
              if (error) throw error;
            } else {
              const { error } = await supabase.from('ams_session_logs').insert([payload]);
              if (error) throw error;
            }
          }
        }
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

        const dbUpdateData = { ...updateData };
        delete dbUpdateData.book_progress_history;

        if (Object.keys(dbUpdateData).length > 0) {
          const { error } = await supabase.from('ams_students').update(dbUpdateData).eq('id', realStudentId);
          if (error) {
            console.error('Failed to update student info:', error);
            alert(`학생 정보 수정 중 오류가 발생했습니다: ${error.message}`);
          }
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
        // 💡 [성능 최적화] 이미 로컬 상태(setStudents)가 0ms로 즉시 갱신된 가벼운 진도/태그/노트 수정은
        // 학원 전체 데이터를 다시 다운로드하는 무거운 fetchAllData를 건너뛰어 지연(Lag)을 방지
        const isLightweightUpdate = Object.keys(updateData).every(k =>
          ['book_progress', 'book_progress_updated_at', 'level_tag', 'management_notes', 'book_progress_history'].includes(k)
        );

        if (!isLightweightUpdate) {
          await fetchAllData(false);
        }
      }
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
      const activeHours = getStudentActiveHours(s, selectedDayKey, selectedDate);
      activeHours.forEach(h => hoursSet.add(h));
    });
    return Array.from(hoursSet).sort((a, b) => a - b);
  }, [students, selectedDayKey, selectedDate, academy]);

  // 1. 오늘의 학생 리스트 (필터링 + 가상 분할 팽창 + 정렬 - Overview는 항상 이름순)
  // 💡 [격리] TodaySheet/Overview는 오늘 날짜 기준이므로 selectedDays 요일 교집합 필터를 적용하지 않음 (selectedDays: [])
  const todayStudents = useMemo(() => {
    const list = filterStudentList({
      students, selectedDayKey, selectedDate, academy, searchQuery,
      selectedTeacherId, selectedFilter, selectedDays: [], isAndFilter: false, filterTarget: 'today',
      selectedHour
    });

    const expandedList: Student[] = [];
    list.forEach(s => {
      const todayLogs = (s.allLogs || []).filter((l: any) => (l.date || l.session_date) === selectedDate);
      const isMakeupLog = (log: any) => log?.is_pure_makeup === true;
      const movedLog = todayLogs.find((l: any) => (!l.course_name || l.course_name === '정규') && !isMakeupLog(l) && l.moved_to_hour !== null && l.moved_to_hour !== undefined && l.moved_to_hour > 0);
      const regularSession = movedLog || todayLogs.find((l: any) => (l.course_name === '정규' || !l.course_name) && !isMakeupLog(l));
      const makeupLogs = todayLogs.filter((l: any) => isMakeupLog(l));

      let hasActiveElectiveToday = false;
      const rawElective = s.book_courses?.['__elective_courses'];
      if (rawElective) {
        try {
          const parsed = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
          if (Array.isArray(parsed)) {
            hasActiveElectiveToday = parsed.some((c: any) => {
              if (!c) return false;
              const courseSubject = c.subject?.trim() || '특강';
              const hasDay = c.days && (
                Array.isArray(c.days)
                  ? c.days.some((d: any) => typeof d === 'string' && d.trim() === selectedDayKey)
                  : (typeof c.days === 'string' && c.days.includes(selectedDayKey))
              );

              const startDate = c.startDate || c.start_date;
              const endDate = c.endDate || c.end_date;
              const isBefore = startDate ? (selectedDate < startDate) : false;
              const isAfter = endDate ? (selectedDate > endDate) : false;

              const hasLogToday = todayLogs.some((l: any) => (l.course_name || '').trim() === courseSubject);

              return (hasDay || hasLogToday) && !isBefore && !isAfter;
            });
          }
        } catch (e) {}
      }

      // 1. 오늘이 정규 수업일이거나 활성 선택과목이 있는 경우: Overview 통합 카드 1개 생성
      if (s.isScheduledToday || hasActiveElectiveToday) {
        expandedList.push({
          ...s,
          __courseType: 'regular',
          todaySession: regularSession || s.todaySession || {
            id: 'temp',
            date: selectedDate,
            status: 'none',
            attendance_status: ATTENDANCE_STATUS.BEFORE,
            course_name: '정규'
          } as any
        });
      }

      // 3. 정규 수업일 여부와 관계없이 보강 로그가 있으면 보강 카드 독립 추가 생성 (중복 ID 방지)
      makeupLogs.forEach((mLog: any, mIdx: number) => {
        const courseKey = mLog.course_name ? `${mLog.course_name}_` : '';
        const makeupId = `${s.id}_makeup_${courseKey}${mLog.id || mLog.moved_to_hour || mIdx}`;
        if (!expandedList.some(item => item.id === makeupId)) {
          expandedList.push({
            ...s,
            id: makeupId,
            originalId: s.id,
            courseName: mLog.course_name || '정규',
            isSpecialClass: mLog.course_name && mLog.course_name !== '정규',
            __courseType: 'makeup',
            todaySession: mLog
          });
        }
      });
    });

    const mergedByStudent = new Map<string, Student>();

    expandedList.forEach((item: any) => {
      const realId = item.originalId || item.id;
      const existing = mergedByStudent.get(realId);

      if (!existing || item.__courseType === 'regular') {
        mergedByStudent.set(realId, item);
      }
    });

    return Array.from(mergedByStudent.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, selectedDayKey, selectedFilter, searchQuery, selectedTeacherId, sortMode, academy, selectedDate, selectedHour]);

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
    const ids = new Set<string>();
    todayStudents.forEach(s => {
      ids.add(s.id);
      if (s.originalId) ids.add(s.originalId);
    });
    return Array.from(ids);
  }, [todayStudents]);

  if (academy?.operation_settings?.is_suspended === true && currentUser?.role !== 'master') {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center font-sans p-6 text-[#37352f] text-xs selection:bg-red-500/10">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30 text-red-500 mx-auto animate-pulse">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-[#37352f]">서비스 제공이 일시 중지되었습니다</h2>
            <p className="text-[10px] text-[#37352f]/50 font-bold uppercase mt-1">Academy Suspended</p>
          </div>
          <p className="text-[11px] text-[#37352f]/70 leading-relaxed font-bold">
            본 지점은 현재 서비스 이용이 잠시 중지되었습니다.<br />
            구독 갱신 또는 설정 점검 중이오니, 자세한 사항은 시스템 마스터 관리자에게 문의해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#37352f] flex font-sans selection:bg-blue-500/10 overflow-hidden text-xs">
      {!(viewMode === 'todayTable' && isFullScreen) && (
        <Sidebar currentUser={currentUser} viewMode={viewMode} setViewMode={navigateTo} todayCount={todayStudents.length} students={students} selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter} selectedDays={selectedDays} setSelectedDays={setSelectedDays} isAndFilter={isAndFilter} setIsAndFilter={setIsAndFilter} academyInfo={academy} onUpdateAcademyInfo={handleUpdateAcademyInfo} teachers={teachers} selectedTeacherId={selectedTeacherId} setSelectedTeacherId={setSelectedTeacherId} isClassroomModeOpen={isClassroomModeOpen} onStartClass={() => setIsClassroomModeOpen(true)} selectedHour={selectedHour} setSelectedHour={setSelectedHour} availableHours={availableHours} />
      )}
      <main className="flex-1 h-screen overflow-y-auto bg-[#fbfbfa] relative">
        {(() => {
          // 💡 [안정화] 정규/특강 포함 오늘 제출(submitted)한 모든 활성 세션을 승인 대기 목록에 바인딩
          return pendingSubmissions.length > 0 ? (
            <div className="sticky top-0 z-40 flex justify-center py-3 bg-[#fbfbfa]/90 backdrop-blur-sm">
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
             {viewMode === 'board' && <Overview todayStudents={todayStudents} excludedStudents={excludedStudents} filteredAllStudents={filteredAllStudents} allTodayIds={allTodayIds} selectedStudentId={selectedStudentId} onSelectStudent={handleSelectStudent} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={isBatchMode} setIsBatchMode={setIsBatchMode} onBatchAdd={batchAddStudents} onRemoveFromToday={removeStudentFromToday} onAddNewStudent={handleAddNewStudent} onRestoreStudent={addStudentToToday} masterTextbooks={availableTextbooks} teachers={teachers} consultationCycle={academy?.consultation_cycle || 21} onStartClass={() => setIsClassroomModeOpen(true)} academyInfo={academy} currentUser={currentUser} isLight={true} />}
             {viewMode === 'studentEdit' && <Overview todayStudents={[]} filteredAllStudents={pureFilteredStudents} allTodayIds={[]} selectedStudentId={selectedStudentId} onSelectStudent={handleSelectStudent} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={false} setIsBatchMode={() => {}} onBatchAdd={async () => {}} onRemoveFromToday={removeStudentFromToday} onAddNewStudent={handleAddNewStudent} onBatchAddStudents={handleBatchAddStudents} masterTextbooks={availableTextbooks} teachers={teachers} title="전체 학생 정보 관리" showAddButton={true} hideTodaySection={true} consultationCycle={academy?.consultation_cycle || 21} academyInfo={academy} searchQuery={studentEditSearchQuery} onSearchChange={setStudentEditSearchQuery} currentUser={currentUser} isLight={true} />}
             {viewMode === 'pdfLibrary' && <PdfLibraryView masterTextbooks={availableTextbooks} academyInfo={academy} isLight={true} />}
             {viewMode === 'digitalLibrary' && <DigitalMathLibraryView masterTextbooks={availableTextbooks} academyInfo={academy} currentUser={currentUser} isLight={true} />}
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
                 onNavigateTab={handleNavigateToLinkedMakeup}
                 onRefreshAbsenceSession={refreshAbsenceSession}
                 onRefreshData={fetchAllData}
               />
             )}

             {viewMode === 'progress' && <ProgressSequencer students={progressFilteredStudents.filter(s => !s.is_deleted)} masterTextbooks={availableTextbooks} initialStudentId={activeProgressStudentId} onSaveLegacy={handleSaveLegacyProgress} />}
             {viewMode === 'monthlyChanges' && <MonthlyChanges students={students} onSelectStudent={handleSelectStudent} />}
            {viewMode === 'settings' && <SettingsView teachers={teachers} students={students} masterTextbooks={availableTextbooks} onAddTeacher={handleAddNewTeacherAccount} onDeleteTeacher={handleDeleteTeacher} onUpdateTeacher={handleUpdateTeacher} onUpdateCurrentUser={handleUpdateCurrentUser} onUpdateAcademyInfo={handleUpdateAcademyInfo} academyInfo={academy} currentUser={currentUser} noticeDrafts={noticeDrafts} onNoticeDraftChange={handleNoticeDraftChange} />}
            {viewMode === 'teacherTask' && (
              <TeacherTasks
                academyInfo={academy}
                students={students}
                teachers={teachers}
                currentUser={currentUser}
                onRefreshStudents={fetchAllData}
                isLight={true}
                absenceLinkPreset={absenceLinkPreset}
                onClearAbsenceLinkPreset={() => setAbsenceLinkPreset(null)}
              />
            )}
            {viewMode === 'problemErrors' && <ProblemErrorManager academyInfo={academy} students={students} teachers={teachers} currentUser={currentUser} />}
            {viewMode === 'wrongAnswersAdmin' && <WrongAnswerManager academyId={academy?.id || ''} currentUser={currentUser} />}
             {viewMode === 'exams' && <ExamPaperManager academyId={academy?.id || ''} />}
          </div>
        )}
      </main>
      <AnimatePresence>
        {isClassroomModeOpen && <ClassroomMode students={students} onSave={saveTodaySession} onClose={() => setIsClassroomModeOpen(false)} selectedDate={selectedDate} academyInfo={academy} selectedTeacherId={selectedTeacherId} isLight={true} />}
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
              isLight={true}
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
        <div className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full h-full max-w-[96vw] max-h-[92vh] bg-white border border-gray-250 rounded-lg shadow-2xl flex flex-col overflow-hidden relative">
            {/* 닫기 버튼 (우측 상단 플로팅 격리 - 라이트 테마) */}
            <button
              onClick={() => setIsTimetableModalOpen(false)}
              className="absolute top-3 right-3 z-[99999] text-gray-500 hover:text-gray-800 transition-colors p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full border border-gray-200"
              title="닫기 (ESC)"
            >
              <X size={18} />
            </button>
            {/* 본문 콘텐츠 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
              <TimetableSettings
                academyInfo={academy}
                teachers={teachers}
                students={students}
                isLight={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* 🎬 전역 비디오 팝업 플레이어 모달 */}
      <VideoPlayerModal
        isOpen={globalVideoState.isOpen}
        videoUrl={globalVideoState.videoUrl}
        title={globalVideoState.title}
        timestampsText={globalVideoState.timestampsText}
        onClose={() => setGlobalVideoState(prev => ({ ...prev, isOpen: false }))}
        isLight={true}
      />
    </div>
  );
}
