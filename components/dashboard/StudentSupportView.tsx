'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserCheck, CalendarRange, UserMinus, ArrowLeftRight } from 'lucide-react';
import Overview from './Overview';
import TeacherTasks from './TeacherTasks';
import MonthlyChanges from './MonthlyChanges';
import MonthlyChangesLight from './light/MonthlyChangesLight';
import { Student, Teacher, TextbookOption, AbsenceLinkContext } from '@/types/dashboard';

export type StudentSupportTab = 'info' | 'makeups' | 'discharged' | 'history';

interface StudentSupportViewProps {
  academyInfo: any;
  students: Student[];
  teachers: Teacher[];
  availableTextbooks: TextbookOption[];
  currentUser: any;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onViewProgress: (studentId: string) => void;
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string | null) => void;
  onAddNewStudent: (data: any) => Promise<void>;
  onBatchAddStudents: (students: any[]) => Promise<any>;
  onRemoveFromToday: (id: string, reason?: string, actionType?: any, sessionMeta?: any) => Promise<void>;
  onRestoreStudent: (id: string) => Promise<void>;
  onRefreshData: (showLoader?: boolean) => Promise<void>;
  isLight?: boolean;
  filteredAllStudents?: Student[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTeacherId: string;
  selectedFilter: string;
  selectedDays: string[];
  isAndFilter: boolean;
  initialTab?: StudentSupportTab;
  absenceLinkPreset?: AbsenceLinkContext | null;
  onClearAbsenceLinkPreset?: () => void;
}

const TABS: { id: StudentSupportTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'info', label: '학생 정보', icon: UserCheck },
  { id: 'makeups', label: '보강 관리', icon: CalendarRange },
  { id: 'discharged', label: '수강 종료·퇴원생', icon: UserMinus },
  { id: 'history', label: '변동 이력 (월별)', icon: ArrowLeftRight },
];

export default function StudentSupportView({
  academyInfo,
  students,
  teachers,
  availableTextbooks,
  currentUser,
  selectedDate,
  onDateChange,
  onViewProgress,
  selectedStudentId,
  onSelectStudent,
  onAddNewStudent,
  onBatchAddStudents,
  onRemoveFromToday,
  onRestoreStudent,
  onRefreshData,
  isLight = false,
  filteredAllStudents,
  searchQuery,
  onSearchChange,
  selectedTeacherId,
  selectedFilter,
  selectedDays,
  isAndFilter,
  initialTab = 'info',
  absenceLinkPreset,
  onClearAbsenceLinkPreset,
}: StudentSupportViewProps) {
  const [activeTab, setActiveTab] = useState<StudentSupportTab>(initialTab);

  // 결석 팝업 연동 시 보강 탭으로 자동 전환
  useEffect(() => {
    if (absenceLinkPreset && absenceLinkPreset.source === 'absence-popup') {
      setActiveTab('makeups');
    }
  }, [absenceLinkPreset]);

  // 외부 initialTab 변경 시 동기화
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // 재원생 필터 목록 (퇴원생 제외)
  const activeFilteredStudents = useMemo(() => {
    if (filteredAllStudents) return filteredAllStudents;
    return students.filter(s => !s.is_deleted);
  }, [filteredAllStudents, students]);

  // 퇴원생 필터 목록
  const dischargedFilteredStudents = useMemo(() => {
    return students.filter(s => !!s.is_deleted);
  }, [students]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 1. 상단 4대 핵심 Core 서브 탭 바 */}
      <div className={`w-full px-6 py-2.5 flex items-center gap-1.5 border-b shrink-0 ${
        isLight ? 'bg-[#f7f7f5] border-[#edece9]' : 'bg-[#0f0f0f] border-white/10'
      }`}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'makeups' && onClearAbsenceLinkPreset) {
                  onClearAbsenceLinkPreset();
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[3px] text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? (isLight 
                      ? 'bg-[#0c73e8] text-white shadow-sm font-black' 
                      : 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black')
                  : (isLight 
                      ? 'text-[#37352f]/70 hover:text-[#37352f] hover:bg-[#edece9]' 
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5')
              }`}
            >
              <Icon size={14} className={isActive ? 'text-white' : (isLight ? 'text-[#37352f]/60' : 'text-gray-400')} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. 메인 컨텐츠 영역 (세로 스크롤 가능하도록 overflow-y-auto 적용) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar-v relative">
        {/* 탭 1: 학생 정보 (재원생 전체) */}
        {activeTab === 'info' && (
          <Overview
            todayStudents={[]}
            filteredAllStudents={activeFilteredStudents}
            allTodayIds={[]}
            selectedStudentId={selectedStudentId}
            onSelectStudent={onSelectStudent}
            selectedDate={selectedDate}
            onDateChange={onDateChange}
            onViewProgress={onViewProgress}
            todayKey={new Date().toLocaleDateString('en-US', { weekday: 'short' })}
            selectedFilter={selectedFilter}
            isBatchMode={false}
            setIsBatchMode={() => {}}
            onBatchAdd={async () => {}}
            onRemoveFromToday={onRemoveFromToday}
            onAddNewStudent={onAddNewStudent}
            onBatchAddStudents={onBatchAddStudents}
            masterTextbooks={availableTextbooks}
            teachers={teachers}
            title="전체 학생 정보 관리"
            showAddButton={true}
            hideTodaySection={true}
            consultationCycle={academyInfo?.consultation_cycle || 21}
            academyInfo={academyInfo}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            currentUser={currentUser}
            showDuplicateWarning={true}
            isLight={isLight}
          />
        )}

        {/* 탭 2: 보강 관리 */}
        {activeTab === 'makeups' && (
          <TeacherTasks
            academyInfo={academyInfo}
            students={students}
            teachers={teachers}
            currentUser={currentUser}
            onRefreshStudents={onRefreshData}
            isLight={isLight}
            absenceLinkPreset={absenceLinkPreset}
            onClearAbsenceLinkPreset={onClearAbsenceLinkPreset}
            onlyMakeupsMode={true}
          />
        )}

        {/* 탭 3: 수강 종료·퇴원생 */}
        {activeTab === 'discharged' && (
          <Overview
            todayStudents={[]}
            filteredAllStudents={dischargedFilteredStudents}
            allTodayIds={[]}
            selectedStudentId={selectedStudentId}
            onSelectStudent={onSelectStudent}
            selectedDate={selectedDate}
            onDateChange={onDateChange}
            onViewProgress={onViewProgress}
            todayKey={new Date().toLocaleDateString('en-US', { weekday: 'short' })}
            selectedFilter="Discharged"
            isBatchMode={false}
            setIsBatchMode={() => {}}
            onBatchAdd={async () => {}}
            onRemoveFromToday={onRemoveFromToday}
            onAddNewStudent={onAddNewStudent}
            onBatchAddStudents={onBatchAddStudents}
            masterTextbooks={availableTextbooks}
            teachers={teachers}
            title="수강 종료 / 퇴원생 아카이브"
            showAddButton={false}
            hideTodaySection={true}
            consultationCycle={academyInfo?.consultation_cycle || 21}
            academyInfo={academyInfo}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            currentUser={currentUser}
            showDuplicateWarning={false}
            isLight={isLight}
          />
        )}

        {/* 탭 4: 변동 이력 (월별) */}
        {activeTab === 'history' && (
          isLight ? (
            <MonthlyChangesLight students={students} onSelectStudent={onSelectStudent} />
          ) : (
            <MonthlyChanges students={students} onSelectStudent={onSelectStudent} />
          )
        )}
      </div>
    </div>
  );
}
