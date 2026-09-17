'use client';

import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Teacher } from '@/types/dashboard';
import { ExamSortOption, StageFilterOption } from './types';

interface ExamOverviewFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedStage: StageFilterOption;
  onStageChange: (stage: StageFilterOption) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedTeacherId: string;
  onTeacherChange: (teacherId: string) => void;
  selectedSchool: string;
  onSchoolChange: (school: string) => void;
  selectedGrade: string;
  onGradeChange: (grade: string) => void;
  selectedSort: ExamSortOption;
  onSortChange: (sort: ExamSortOption) => void;
  onResetFilters: () => void;
  teachers: Teacher[];
  availableSchools: string[];
  availableGrades: string[];
  totalCount: number;
  filteredCount: number;
  isLight?: boolean;
}

export const ExamOverviewFilters: React.FC<ExamOverviewFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedStage,
  onStageChange,
  selectedStatus,
  onStatusChange,
  selectedTeacherId,
  onTeacherChange,
  selectedSchool,
  onSchoolChange,
  selectedGrade,
  onGradeChange,
  selectedSort,
  onSortChange,
  onResetFilters,
  teachers,
  availableSchools,
  availableGrades,
  totalCount,
  filteredCount,
  isLight = false
}) => {
  const selectCls = `text-xs px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer transition-colors ${
    isLight
      ? 'bg-white border-[#e3e2e0] text-gray-800 focus:border-blue-500'
      : 'bg-[#18181b] border-white/10 text-gray-200 focus:border-blue-500'
  }`;

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedStage !== 'default' ||
    selectedStatus !== 'all' ||
    selectedTeacherId !== 'all' ||
    selectedSchool !== 'all' ||
    selectedGrade !== 'all' ||
    selectedSort !== 'dday';

  return (
    <div className={`p-3.5 rounded-lg border flex flex-col gap-3 ${
      isLight ? 'bg-white border-[#e3e2e0]' : 'bg-[#0f0f0f] border-white/10'
    }`}>
      {/* 상단: 검색창 + 학제 탭 + 카운트 */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-xs">
            <Search
              size={15}
              className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
                isLight ? 'text-gray-400' : 'text-gray-500'
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="학생 이름, 학교 검색..."
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors ${
                isLight
                  ? 'bg-gray-50 border-[#e3e2e0] text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'
                  : 'bg-[#18181b] border-white/10 text-white placeholder-gray-500 focus:border-blue-500'
              }`}
            />
          </div>

          {/* 학제 필터 버튼 그룹 */}
          <div className={`flex items-center p-0.5 rounded-lg border text-xs ${
            isLight ? 'bg-gray-100 border-[#e3e2e0]' : 'bg-[#18181b] border-white/10'
          }`}>
            {[
              { id: 'default', label: '중·고등' },
              { id: 'all', label: '전체' },
              { id: 'middle', label: '중등' },
              { id: 'high', label: '고등' },
              { id: 'elementary', label: '초등' }
            ].map(tab => {
              const isActive = selectedStage === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onStageChange(tab.id as StageFilterOption)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    isActive
                      ? isLight
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'bg-white/15 text-white shadow-xs'
                      : isLight
                        ? 'text-gray-500 hover:text-gray-900'
                        : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 결과 카운트 & 초기화 버튼 */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-medium ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
            대상 <strong className={isLight ? 'text-gray-900' : 'text-white'}>{filteredCount}</strong>명
            {filteredCount !== totalCount && ` (전체 ${totalCount}명)`}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                isLight
                  ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="필터 초기화"
            >
              <RotateCcw size={12} />
              초기화
            </button>
          )}
        </div>
      </div>

      {/* 하단: 상세 셀렉트 필터들 */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed border-gray-500/20">
        {/* 상태 필터 */}
        <select
          value={selectedStatus}
          onChange={e => onStatusChange(e.target.value)}
          className={selectCls}
        >
          <option value="all">전체 대비 상태</option>
          <option value="ongoing">시험 진행 중</option>
          <option value="urgent">최우선 (D-7 & 4회 이하)</option>
          <option value="d7">D-7 이내</option>
          <option value="lack_classes">잔여 수업 부족 (4회 이하)</option>
          <option value="d14">D-14 이내</option>
          <option value="normal">여유</option>
          <option value="no_schedule">시험 일정 미등록</option>
        </select>

        {/* 담당 교사 필터 */}
        <select
          value={selectedTeacherId}
          onChange={e => onTeacherChange(e.target.value)}
          className={selectCls}
        >
          <option value="all">전체 담당 선생님</option>
          {teachers.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}{t.initials ? ` (${t.initials})` : ''}
            </option>
          ))}
        </select>

        {/* 학교 필터 */}
        {availableSchools.length > 0 && (
          <select
            value={selectedSchool}
            onChange={e => onSchoolChange(e.target.value)}
            className={selectCls}
          >
            <option value="all">전체 학교</option>
            {availableSchools.map(school => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>
        )}

        {/* 학년 필터 */}
        {availableGrades.length > 0 && (
          <select
            value={selectedGrade}
            onChange={e => onGradeChange(e.target.value)}
            className={selectCls}
          >
            <option value="all">전체 학년</option>
            {availableGrades.map(grade => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        )}

        {/* 정렬 셀렉트 */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`text-[11px] font-medium ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
            정렬:
          </span>
          <select
            value={selectedSort}
            onChange={e => onSortChange(e.target.value as ExamSortOption)}
            className={selectCls}
          >
            <option value="dday">D-Day 임박순</option>
            <option value="classes">잔여 수업 적은 순</option>
            <option value="name">학생 이름순</option>
            <option value="school">학교순</option>
          </select>
        </div>
      </div>
    </div>
  );
};
