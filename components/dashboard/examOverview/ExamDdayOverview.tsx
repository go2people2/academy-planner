'use client';

import React from 'react';
import { Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { Student, Teacher } from '@/types/dashboard';
import { useExamOverviewData } from './useExamOverviewData';
import { ExamOverviewKpiCards } from './ExamOverviewKpiCards';
import { ExamOverviewFilters } from './ExamOverviewFilters';
import { ExamOverviewTable } from './ExamOverviewTable';

interface ExamDdayOverviewProps {
  academyInfo: any;
  students: Student[];
  teachers: Teacher[];
  slug: string;
  isLight?: boolean;
}

export const ExamDdayOverview: React.FC<ExamDdayOverviewProps> = ({
  academyInfo,
  students,
  teachers,
  slug,
  isLight = false
}) => {
  const {
    isLoading,
    fetchError,
    kpiCounts,
    filterOptions,
    filteredStudents,
    totalEnrichedCount,
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
    refetch
  } = useExamOverviewData({
    academyInfo,
    students,
    teachers
  });

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
      {/* 화면 상단 타이틀 & 새로고침 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h1 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              시험 대비 현황
            </h1>
          </div>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
            학원 전체 학생의 시험 일정, D-Day 및 잔여 정규수업 횟수를 종합 관리합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={refetch}
          disabled={isLoading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
            isLight
              ? 'bg-white border-[#e3e2e0] text-gray-700 hover:bg-gray-50 active:bg-gray-100'
              : 'bg-[#18181b] border-white/10 text-gray-300 hover:text-white hover:bg-white/5 active:bg-white/10'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="시험 일정 새로고침"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {/* 에러 안내 */}
      {fetchError && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* 5대 KPI 카드 */}
      <ExamOverviewKpiCards
        kpiCounts={kpiCounts}
        activeCardFilter={activeCardFilter}
        onToggleCard={handleToggleCardFilter}
        isLight={isLight}
      />

      {/* 필터 컨트롤 바 */}
      <ExamOverviewFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedStage={selectedStage}
        onStageChange={setSelectedStage}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedTeacherId={selectedTeacherId}
        onTeacherChange={setSelectedTeacherId}
        selectedSchool={selectedSchool}
        onSchoolChange={setSelectedSchool}
        selectedGrade={selectedGrade}
        onGradeChange={setSelectedGrade}
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
        onResetFilters={handleResetFilters}
        teachers={teachers}
        availableSchools={filterOptions.schools}
        availableGrades={filterOptions.grades}
        totalCount={totalEnrichedCount}
        filteredCount={filteredStudents.length}
        isLight={isLight}
      />

      {/* 종합 현황 테이블 */}
      <ExamOverviewTable
        students={filteredStudents}
        isLoading={isLoading}
        slug={slug}
        isLight={isLight}
      />
    </div>
  );
};
export default ExamDdayOverview;
