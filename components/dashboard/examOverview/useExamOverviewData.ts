'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Student, Teacher } from '@/types/dashboard';
import {
  ExamSchedule,
  matchStudentExam,
  calculateDDay,
  getRemainingRegularClasses,
  determineExamPreparationStatus,
  getSchoolStage
} from '@/lib/examMatching';
import {
  EnrichedExamStudent,
  ExamSortOption,
  StageFilterOption,
  CardFilterType,
  KpiCounts
} from './types';
import { calculateExamKpiCounts, compareExamStudents } from './examOverviewHelpers';

interface UseExamOverviewDataParams {
  academyInfo: any;
  students: Student[];
  teachers: Teacher[];
}

export function useExamOverviewData({
  academyInfo,
  students,
  teachers
}: UseExamOverviewDataParams) {
  const [examSchedules, setExamSchedules] = useState<ExamSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 필터 및 정렬 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<StageFilterOption>('default');
  const [selectedSort, setSelectedSort] = useState<ExamSortOption>('dday');
  const [activeCardFilter, setActiveCardFilter] = useState<CardFilterType>(null);

  // 1. 학교별 시험 일정 데이터 조회 (tenant ID 기반)
  const fetchSchedules = useCallback(async () => {
    if (!academyInfo?.id) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('ams_exam_schedules')
        .select('*')
        .eq('academy_id', academyInfo.id)
        .order('target_date', { ascending: true });

      if (error) throw error;
      setExamSchedules((data as ExamSchedule[]) || []);
    } catch (err: any) {
      console.error('Fetch exam schedules error:', err);
      setFetchError(err.message || '시험 일정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [academyInfo?.id]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // 교사 맵 생성 (ID -> Teacher)
  const teacherMap = useMemo(() => {
    const map = new Map<string, Teacher>();
    (teachers || []).forEach(t => map.set(t.id, t));
    return map;
  }, [teachers]);

  const currentPeriod = academyInfo?.operation_settings?.current_exam_period;
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 2. 전체 재원생 데이터 보강 (Enrichment)
  const enrichedStudents: EnrichedExamStudent[] = useMemo(() => {
    const activeStudents = (students || []).filter(s => !s.is_deleted);

    return activeStudents.map(s => {
      const teacher = s.teacher_id ? teacherMap.get(s.teacher_id) : undefined;
      const stage = getSchoolStage(s.school, s.grade);
      const matched = matchStudentExam(s, examSchedules, currentPeriod, todayStr);
      const dday = calculateDDay(matched, todayStr);

      // 💡 정규수업 요일만 참조 (특강 제외)
      const remaining = matched && !dday.isOngoing
        ? getRemainingRegularClasses(matched.target_date, s.class_days, todayStr)
        : null;

      const status = determineExamPreparationStatus({
        matchedExam: matched,
        isOngoing: dday.isOngoing,
        dDayDiff: dday.dDayDiff,
        remainingClasses: remaining
      });

      let periodStr = '—';
      if (matched) {
        const startShort = matched.target_date.slice(5).replace('-', '.');
        if (matched.end_date && matched.end_date !== matched.target_date) {
          const endShort = matched.end_date.slice(5).replace('-', '.');
          periodStr = `${startShort} ~ ${endShort}`;
        } else {
          periodStr = startShort;
        }
      }

      const remainingLabel = dday.isOngoing
        ? '시험 진행 중'
        : matched
          ? (remaining !== null ? `잔여 ${remaining}회` : '—')
          : '—';

      return {
        id: s.id,
        name: s.name,
        school: s.school || '미지정',
        grade: s.grade || '',
        teacherId: s.teacher_id || null,
        teacherName: teacher?.name || '미배정',
        teacherInitial: teacher?.initials || '?',
        classDays: Array.isArray(s.class_days) ? s.class_days : [],
        schoolStage: stage,
        matchedExam: matched,
        examName: matched?.exam_name || '일정 미등록',
        examPeriodStr: periodStr,
        targetDate: matched?.target_date || null,
        endDate: matched?.end_date || null,
        dDayDiff: dday.dDayDiff,
        isOngoing: dday.isOngoing,
        dDayLabel: dday.dDayLabel,
        remainingClasses: remaining,
        remainingClassesLabel: remainingLabel,
        status
      };
    });
  }, [students, examSchedules, teacherMap, currentPeriod, todayStr]);

  // 3. 상단 5대 핵심 KPI 집계 (기본 대상: 중·고등부 재원생)
  const kpiCounts: KpiCounts = useMemo(() => {
    return calculateExamKpiCounts(enrichedStudents);
  }, [enrichedStudents]);

  // 4. 필터 옵션 목록 추출
  const filterOptions = useMemo(() => {
    const schools = Array.from(new Set(enrichedStudents.map(s => s.school).filter(Boolean))).sort();
    const grades = Array.from(new Set(enrichedStudents.map(s => s.grade).filter(Boolean))).sort();
    return { schools, grades };
  }, [enrichedStudents]);

  // 5. 필터링 및 정렬 파이프라인
  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter(s => {
      // 1) 카드 클릭 필터 (최우선 상호작용)
      if (activeCardFilter) {
        if (activeCardFilter === 'ongoing' && !s.isOngoing) return false;
        if (activeCardFilter === 'd7' && (s.isOngoing || s.dDayDiff < 0 || s.dDayDiff > 7 || !s.matchedExam)) return false;
        if (activeCardFilter === 'd14' && (s.isOngoing || s.dDayDiff <= 7 || s.dDayDiff > 14 || !s.matchedExam)) return false;
        if (activeCardFilter === 'lack_classes' && (s.isOngoing || !s.matchedExam || s.remainingClasses === null || s.remainingClasses < 0 || s.remainingClasses > 4)) return false;
        if (activeCardFilter === 'no_schedule' && s.matchedExam !== null) return false;
      }

      // 2) 학제 필터 (기본값: 중·고등)
      if (selectedStage === 'default' && (s.schoolStage !== 'middle' && s.schoolStage !== 'high')) return false;
      if (selectedStage === 'middle' && s.schoolStage !== 'middle') return false;
      if (selectedStage === 'high' && s.schoolStage !== 'high') return false;
      if (selectedStage === 'elementary' && s.schoolStage !== 'elementary') return false;

      // 3) 이름 검색
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesSchool = s.school.toLowerCase().includes(query);
        if (!matchesName && !matchesSchool) return false;
      }

      // 4) 대비 상태 필터
      if (selectedStatus !== 'all' && s.status !== selectedStatus) return false;

      // 5) 담당 교사 필터
      if (selectedTeacherId !== 'all' && s.teacherId !== selectedTeacherId) return false;

      // 6) 학교 필터
      if (selectedSchool !== 'all' && s.school !== selectedSchool) return false;

      // 7) 학년 필터
      if (selectedGrade !== 'all' && s.grade !== selectedGrade) return false;

      return true;
    }).sort((a, b) => compareExamStudents(a, b, selectedSort));
  }, [
    enrichedStudents,
    activeCardFilter,
    selectedStage,
    searchQuery,
    selectedStatus,
    selectedTeacherId,
    selectedSchool,
    selectedGrade,
    selectedSort
  ]);

  // 카드 토글 함수
  const handleToggleCardFilter = useCallback((type: CardFilterType) => {
    setActiveCardFilter(prev => prev === type ? null : type);
  }, []);

  // 전체 필터 초기화
  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedTeacherId('all');
    setSelectedSchool('all');
    setSelectedGrade('all');
    setSelectedStage('default');
    setSelectedSort('dday');
    setActiveCardFilter(null);
  }, []);

  return {
    isLoading,
    fetchError,
    kpiCounts,
    filterOptions,
    filteredStudents,
    totalEnrichedCount: enrichedStudents.length,
    activeCardFilter,
    searchQuery,
    selectedStatus,
    selectedTeacherId,
    selectedSchool,
    selectedGrade,
    selectedStage,
    selectedSort,
    setSearchQuery,
    setSelectedStatus,
    setSelectedTeacherId,
    setSelectedSchool,
    setSelectedGrade,
    setSelectedStage,
    setSelectedSort,
    handleToggleCardFilter,
    handleResetFilters,
    refetch: fetchSchedules
  };
}
