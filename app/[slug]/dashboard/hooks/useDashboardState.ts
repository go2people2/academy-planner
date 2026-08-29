import { useState, useEffect, useRef, useCallback } from 'react';
import { getTodayStr } from '@/lib/utils';

export interface DashboardState {
  viewMode: string;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;
  isMounted: boolean;
  isFullScreen: boolean;
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  activeProgressStudentId: string | null;
  setActiveProgressStudentId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedDate: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  selectedFilter: string;
  setSelectedFilter: React.Dispatch<React.SetStateAction<string>>;
  selectedDays: string[];
  setSelectedDays: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTeacherId: string;
  setSelectedTeacherId: React.Dispatch<React.SetStateAction<string>>;
  selectedHour: string;
  setSelectedHour: React.Dispatch<React.SetStateAction<string>>;
  isAndFilter: boolean;
  setIsAndFilter: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  studentEditSearchQuery: string;
  setStudentEditSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  noticeDrafts: Record<string, string>;
  setNoticeDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  noticeDirty: Record<string, boolean>;
  setNoticeDirty: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  noticeDirtyRef: React.MutableRefObject<Record<string, boolean>>;
  handleNoticeDraftChange: (key: string, value: string) => void;
  selectedStudentId: string | null;
  setSelectedStudentId: React.Dispatch<React.SetStateAction<string | null>>;
  handleSelectStudent: (studentId: string | null) => void;
  isBatchMode: boolean;
  setIsBatchMode: React.Dispatch<React.SetStateAction<boolean>>;
  isClassroomModeOpen: boolean;
  setIsClassroomModeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isTimetableModalOpen: boolean;
  setIsTimetableModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isApprovalModalOpen: boolean;
  setIsApprovalModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showMorningBriefing: boolean;
  setShowMorningBriefing: React.Dispatch<React.SetStateAction<boolean>>;
  sortMode: 'time' | 'name' | 'grade' | 'school';
  setSortMode: React.Dispatch<React.SetStateAction<'time' | 'name' | 'grade' | 'school'>>;
  sortDirection: 'asc' | 'desc';
  setSortDirection: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  navigateTo: (mode: string, skipHistory?: boolean) => void;
  goBack: () => void;
  goForward: () => void;
  handleViewProgress: (id: string) => void;
}

export function useDashboardState(currentUser: any, isWarpMode: boolean) {
  const [viewMode, setViewMode] = useState<string>('board');
  const [isMounted, setIsMounted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [activeProgressStudentId, setActiveProgressStudentId] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ams_selectedTeacherId') || 'All';
    }
    return 'All';
  });
  const [selectedHour, setSelectedHour] = useState<string>('All');
  const isFirstRender = useRef(true);
  const prevDateRef = useRef(selectedDate);

  // 날짜 변경 시 시간대 필터는 자동으로 풀리게 유도
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

  // 로그인한 사용자 권한에 따른 선생님 필터 초기화
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'teacher') {
        setSelectedTeacherId('All');
        localStorage.removeItem('ams_selectedTeacherId');
      } else {
        const savedTeacherId = localStorage.getItem('ams_selectedTeacherId');
        if (savedTeacherId) {
          setSelectedTeacherId(savedTeacherId);
        }
      }
    }
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (selectedTeacherId) {
      localStorage.setItem('ams_selectedTeacherId', selectedTeacherId);
    }
  }, [selectedTeacherId]);

  // 선택한 시간대 필터 상태 로컬스토리지 연동
  useEffect(() => {
    const saved = localStorage.getItem('ams_selectedHour');
    if (saved) setSelectedHour(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('ams_selectedHour', selectedHour);
  }, [selectedHour]);

  // viewMode 변경 시 로컬스토리지에 저장
  useEffect(() => {
    if (isMounted && viewMode) {
      localStorage.setItem('ams_viewMode', viewMode);
    }
  }, [viewMode, isMounted]);

  const [isAndFilter, setIsAndFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentEditSearchQuery, setStudentEditSearchQuery] = useState('');

  const [noticeDrafts, setNoticeDrafts] = useState<Record<string, string>>({ monthly: '', weekly: '', daily: '' });
  const [noticeDirty, setNoticeDirty] = useState<Record<string, boolean>>({ monthly: false, weekly: false, daily: false });
  const noticeDirtyRef = useRef<Record<string, boolean>>({ monthly: false, weekly: false, daily: false });

  const handleNoticeDraftChange = (key: string, value: string) => {
    setNoticeDrafts(prev => ({ ...prev, [key]: value }));
    setNoticeDirty(prev => ({ ...prev, [key]: true }));
    noticeDirtyRef.current[key] = true;
  };

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
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [showMorningBriefing, setShowMorningBriefing] = useState(false);
  const [sortMode, setSortMode] = useState<'time' | 'name' | 'grade' | 'school'>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const navigateTo = useCallback((mode: string, skipHistory = false) => { 
    if (viewMode === mode) return;

    setViewMode(mode); 
    setSelectedStudentId(null); 
    if (typeof window !== 'undefined') {
      if (skipHistory) {
        window.history.replaceState({ viewMode: mode }, '');
      } else {
        window.history.pushState({ viewMode: mode }, '');
      }
    }
  }, [viewMode]);

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

  // 브라우저 뒤로가기 / 앞으로가기 이벤트 연동
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

  // 키보드 단축키
  useEffect(() => {
    const handleNavShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '[') { e.preventDefault(); goBack(); }
      if (e.ctrlKey && e.key === ']') { e.preventDefault(); goForward(); }
      
      if (e.shiftKey && e.altKey && (e.key === 'l' || e.key === 'L' || e.key === 'ㅣ')) {
        e.preventDefault();
        setIsClassroomModeOpen(prev => !prev);
      }

      if (e.shiftKey && e.altKey && (e.key === 't' || e.key === 'T' || e.key === 'ㅅ')) {
        e.preventDefault();
        if (currentUser?.role !== 'admin' && currentUser?.role !== 'master') {
          alert('시간표 관리 권한이 없습니다. (원장/마스터 권한 필요)');
          return;
        }
        setIsTimetableModalOpen(prev => !prev);
      }

      if (e.key === 'Escape' || e.key === 'Esc') {
        setIsTimetableModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleNavShortcuts);
    return () => window.removeEventListener('keydown', handleNavShortcuts);
  }, [goBack, goForward, currentUser]);

  const handleViewProgress = (id: string) => {
    if (isWarpMode) {
      alert('🔒 원격 지원 모드에서는 개인정보 보호를 위해 학생 개별 리포트 조회가 제한됩니다.');
      return;
    }
    setActiveProgressStudentId(id); 
    setViewMode('progress'); 
  };

  return {
    viewMode,
    setViewMode,
    isMounted,
    setIsMounted,
    isFullScreen,
    setIsFullScreen,
    activeProgressStudentId,
    setActiveProgressStudentId,
    selectedDate,
    setSelectedDate,
    selectedFilter,
    setSelectedFilter,
    selectedDays,
    setSelectedDays,
    selectedTeacherId,
    setSelectedTeacherId,
    selectedHour,
    setSelectedHour,
    isAndFilter,
    setIsAndFilter,
    searchQuery,
    setSearchQuery,
    studentEditSearchQuery,
    setStudentEditSearchQuery,
    noticeDrafts,
    setNoticeDrafts,
    noticeDirty,
    setNoticeDirty,
    noticeDirtyRef,
    handleNoticeDraftChange,
    selectedStudentId,
    setSelectedStudentId,
    handleSelectStudent,
    isBatchMode,
    setIsBatchMode,
    isClassroomModeOpen,
    setIsClassroomModeOpen,
    isTimetableModalOpen,
    setIsTimetableModalOpen,
    isApprovalModalOpen,
    setIsApprovalModalOpen,
    showMorningBriefing,
    setShowMorningBriefing,
    sortMode,
    setSortMode,
    sortDirection,
    setSortDirection,
    navigateTo,
    goBack,
    goForward,
    handleViewProgress,
  };
}
