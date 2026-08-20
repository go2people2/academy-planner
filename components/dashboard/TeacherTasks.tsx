'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Calendar, Plus, Check, Trash2, Clock, 
  User, CheckCircle, AlertCircle, Search, Sparkles, Loader2, CalendarRange, X, EyeOff, ExternalLink,
  Edit, Users, MessageSquare, CheckCircle2, Circle, FileText, Edit2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ATTENDANCE_STATUS } from '@/lib/sessionFieldMap';
import { getTodayStr } from '@/lib/utils';
import { SessionLog, Student, Teacher } from '@/types/dashboard';
import TaskLinksTab from './TaskLinksTab';
import SurveyManagement from './SurveyManagement';

import { useTeacherTasks } from './hooks/useTeacherTasks';

export interface TeacherTasksProps {
  academyInfo: any;
  students: Student[];
  teachers: Teacher[];
  currentUser: any;
  onRefreshStudents: (showLoader?: boolean) => Promise<void>;
  isLight?: boolean;
}

export default function TeacherTasks({
  academyInfo,
  students,
  teachers,
  currentUser,
  onRefreshStudents,
  isLight = false
}: TeacherTasksProps) {
  const {
    activeTab,
    setActiveTab,
    tasks,
    setTasks,
    makeups,
    setMakeups,
    isTaskLoading,
    isMakeupLoading,
    showOnlyMyTasks,
    setShowOnlyMyTasks,
    hiddenTaskIds,
    setHiddenTaskIds,
    isTaskModalOpen,
    setIsTaskModalOpen,
    taskTitle,
    setTaskTitle,
    taskContent,
    setTaskContent,
    taskTargetDate,
    setTaskTargetDate,
    taskAssignee,
    setTaskAssignee,
    isPermanentTask,
    setIsPermanentTask,
    isMakeupModalOpen,
    setIsMakeupModalOpen,
    editMakeupGroup,
    setEditMakeupGroup,
    makeupDate,
    setMakeupDate,
    makeupTime,
    setMakeupTime,
    makeupEndTime,
    setMakeupEndTime,
    makeupType,
    setMakeupType,
    makeupReason,
    setMakeupReason,
    makeupSearch,
    setMakeupSearch,
    selectedStudentIds,
    setSelectedStudentIds,
    makeupGradeFilter,
    setMakeupGradeFilter,
    makeupDayFilter,
    setMakeupDayFilter,
    showOnlyMyStudentsInMakeup,
    setShowOnlyMyStudentsInMakeup,
    courseFilterMode,
    setCourseFilterMode,
    makeupCardSearch,
    setMakeupCardSearch,
    makeupCardPeriod,
    setMakeupCardPeriod,
    makeupCardStartDate,
    setMakeupCardStartDate,
    makeupCardEndDate,
    setMakeupCardEndDate,
    editingMemoId,
    setEditingMemoId,
    editingMemoText,
    setEditingMemoText,
    getMonthlyMakeupCount,
    handleSaveMemo,
    fetchTasks,
    fetchMakeups,
    handleAddTask,
    handleToggleTask,
    handleDeleteTask,
    handleHideTask,
    handleAddMakeups,
    handleOpenEditGroupMakeup,
    handleMakeupAttendance,
    handleDeleteMakeup,
    handleDeleteGroupMakeups,
    handleDeleteMakeupGroup,
    handleDeleteSingleMakeup,
  } = useTeacherTasks({
    academyInfo,
    students,
    teachers,
    currentUser,
    onRefreshStudents,
  });

  // --- Filtering & Memos ---
  const visibleTasks = useMemo(() => {
    let list = tasks.filter(task => {
      if (task.type === 'link') return false; // 💡 링크 탭 전용 업무 제외
      const isSuggestion = task.title?.startsWith('[건의]');
      if (!isSuggestion) return true;
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'master';
      const isMyStudentSuggestion = task.created_by === currentUser?.id;
      return isAdmin || isMyStudentSuggestion;
    });

    const isCurrentAdmin = currentUser?.role === 'admin' || currentUser?.role === 'master';
    if (isCurrentAdmin && hiddenTaskIds.length > 0) {
      list = list.filter(task => !hiddenTaskIds.includes(task.id));
    }

    if (showOnlyMyTasks) {
      list = list.filter(task => task.created_by === currentUser?.id);
    }

    return list;
  }, [tasks, currentUser, showOnlyMyTasks, hiddenTaskIds]);

  const filteredStudents = useMemo(() => {
    const list: any[] = [];

    students.forEach(s => {
      if (s.is_deleted) return;

      // 내 학생만 보기 필터링 (내가 담임인 학생만 노출)
      if (showOnlyMyStudentsInMakeup && currentUser?.id) {
        if (s.teacher_id !== currentUser.id) return;
      }

      // 1. 학년 필터링
      if (makeupGradeFilter !== 'all') {
        const gradeStr = s.grade || '';
        if (!gradeStr.includes(makeupGradeFilter)) return;
      }

      // 수강 중인 선택과목(특강) 목록 파싱
      let electiveCourses: any[] = [];
      const rawElective = s.book_courses?.['__elective_courses'];
      if (rawElective) {
        try {
          const parsed = typeof rawElective === 'string' ? JSON.parse(rawElective) : Array.isArray(rawElective) ? rawElective : [];
          if (Array.isArray(parsed)) electiveCourses = parsed;
        } catch (e) {}
      }

      // 2. 요일 필터링 (정규 요일 / 선택과목 요일 체크)
      const regularDays = s.class_days || [];
      const isRegularMatchingDay = makeupDayFilter === 'all' || regularDays.includes(makeupDayFilter);

      // 3. 텍스트 검색어 필터링
      const query = makeupSearch.trim().toLowerCase().replace(/\s+/g, '');
      const daysMap: { [key: string]: string } = {
        '월요일': '월', '화요일': '화', '수요일': '수', '목요일': '목',
        '금요일': '금', '토요일': '토', '일요일': '일'
      };
      const cleanQuery = daysMap[query] || query;

      const nameMatch = query ? s.name.toLowerCase().replace(/\s+/g, '').includes(query) : true;
      const gradeMatch = query && s.grade ? s.grade.toLowerCase().replace(/\s+/g, '').includes(query) : false;
      const classMatch = query && s.class ? s.class.toLowerCase().replace(/\s+/g, '').includes(query) : false;
      const dayMatch = query && s.class_days ? s.class_days.some((d: string) => d.toLowerCase().includes(cleanQuery)) : false;
      const isSearchMatch = !query || (nameMatch || gradeMatch || classMatch || dayMatch);

      // (A) 정규 수업 항목 추가
      if (isRegularMatchingDay && isSearchMatch) {
        if (courseFilterMode !== 'electiveOnly') {
          list.push({
            ...s,
            itemKey: s.id,
            displayName: s.name,
            courseName: '정규'
          });
        }
      }

      // (B) 선택과목(특강) 수강생인 경우 선택과목 독립 항목 (예: [기하] 김시윤) 추가
      if (courseFilterMode !== 'regularOnly') {
        electiveCourses.forEach((c: any) => {
          if (!c) return;
          const subject = c.subject?.trim() || '특강';
          const courseDays = Array.isArray(c.days) ? c.days : (typeof c.days === 'string' ? c.days.split(/[,\s]+/) : []);
          const isElectiveMatchingDay = makeupDayFilter === 'all' || courseDays.includes(makeupDayFilter);
          const subjectMatch = query ? subject.toLowerCase().includes(query) : false;

          if (isElectiveMatchingDay && (isSearchMatch || subjectMatch)) {
            list.push({
              ...s,
              itemKey: `${s.id}_special_${subject}`,
              displayName: `[${subject}] ${s.name}`,
              courseName: subject
            });
          }
        });
      }
    });

    // 가나다순 정렬 (1. 학생 이름 가나다순 -> 2. 동일 학생 내 과목 가나다순: '정규' 우선)
    list.sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name, 'ko');
      if (nameCompare !== 0) return nameCompare;
      
      if (a.courseName === '정규') return -1;
      if (b.courseName === '정규') return 1;
      return a.courseName.localeCompare(b.courseName, 'ko');
    });

    return list;
  }, [students, makeupSearch, makeupGradeFilter, makeupDayFilter, showOnlyMyStudentsInMakeup, courseFilterMode, currentUser]);

  const getMakeupTimeKey = useCallback((makeup: any) => {
    // 1. 시간이동 정보(moved_to_hour) 최우선 적용
    if (makeup.moved_to_hour !== undefined && makeup.moved_to_hour !== null) {
      const h = typeof makeup.moved_to_hour === 'number' ? makeup.moved_to_hour : parseInt(makeup.moved_to_hour, 10);
      if (!isNaN(h)) {
        return `${String(h).padStart(2, '0')}:00`;
      }
    }
    // 2. 예약 상태(attendance_status)에서 보강 시간 영역 파싱
    const status = makeup.attendance_status || '';
    if (status.startsWith('보강:')) {
      return status.replace('보강:', '');
    }
    if (status.includes(':')) {
      const match = status.match(/(\d{1,2}):/);
      if (match) {
        return `${match[1].padStart(2, '0')}:00`;
      }
    }
    return '시간 미지정';
  }, []);

  const filteredMakeups = useMemo(() => {
    const todayStr = getTodayStr();
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'master';

    return makeups.filter(makeup => {
      // 💡 [철통 보안 패치] 일반 선생님(teacher) 로그인 시 100% 오직 '본인 담당 학생' 보강 카드만 노출 (담당자 미지정 포함 타 학생 완전 차단)
      if (!isAdmin && currentUser?.id) {
        const studentObj = students.find(s => s.id === makeup.student_id);
        if (!studentObj || studentObj.teacher_id !== currentUser.id) {
          return false;
        }
      }

      // 1. 기간 필터링
      if (makeupCardPeriod === 'today') {
        if (makeup.session_date < todayStr) return false;
      } else if (makeupCardPeriod === 'month') {
        const currentMonth = todayStr.slice(0, 7);
        if (!makeup.session_date?.startsWith(currentMonth)) return false;
      } else if (makeupCardPeriod === 'custom') {
        if (makeupCardStartDate && makeup.session_date < makeupCardStartDate) return false;
        if (makeupCardEndDate && makeup.session_date > makeupCardEndDate) return false;
      }

      // 2. 학생 / 검색어 필터링
      if (makeupCardSearch.trim()) {
        const q = makeupCardSearch.toLowerCase().replace(/\s+/g, '');
        const noteTextVal = makeup.completed_classwork_text || makeup.special_notes || '';
        const nameMatch = makeup.student_name ? makeup.student_name.toLowerCase().replace(/\s+/g, '').includes(q) : false;
        const noteMatch = noteTextVal ? noteTextVal.toLowerCase().replace(/\s+/g, '').includes(q) : false;
        const studentObj = students.find(s => s.id === makeup.student_id);
        const gradeMatch = studentObj?.grade ? studentObj.grade.toLowerCase().replace(/\s+/g, '').includes(q) : false;
        if (!(nameMatch || noteMatch || gradeMatch)) return false;
      }

      return true;
    });
  }, [makeups, makeupCardPeriod, makeupCardStartDate, makeupCardEndDate, makeupCardSearch, students, currentUser]);

  const groupedMakeups = useMemo(() => {
    const groups: Record<string, {
      date: string;
      time: string;
      items: any[];
    }> = {};

    filteredMakeups.forEach(makeup => {
      const timeKey = getMakeupTimeKey(makeup);
      const groupKey = `${makeup.session_date}|${timeKey}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          date: makeup.session_date,
          time: timeKey,
          items: []
        };
      }
      groups[groupKey].items.push(makeup);
    });

    return Object.values(groups).sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date); // 최신 날짜 우선 (내림차순)
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });
  }, [filteredMakeups, getMakeupTimeKey]);

  const isAllFilteredSelected = useMemo(() => {
    return filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const handleSelectAllFiltered = () => {
    setSelectedStudentIds(prev => {
      const union = new Set([...prev, ...filteredStudents.map(s => s.id)]);
      return Array.from(union);
    });
  };

  const handleDeselectAllFiltered = () => {
    const filteredIds = filteredStudents.map(s => s.id);
    setSelectedStudentIds(prev => prev.filter(id => !filteredIds.includes(id)));
  };

  const getDDay = (targetDateStr: string) => {
    if (targetDateStr === '9999-12-31') return '상시';
    const target = new Date(targetDateStr);
    const today = new Date(getTodayStr());
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'D-Day';
    if (diffDays < 0) return `지남 (${Math.abs(diffDays)}일)`;
    return `D-${diffDays}`;
  };

  return (
    <div className={`h-full flex flex-col overflow-hidden p-6 space-y-6 ${isLight ? 'bg-[#f7f7f5] text-[#37352f]' : 'bg-[#050505] text-white'}`}>
      
      {/* 1. Header & Tab Switches */}
      <div className={`flex items-center justify-between shrink-0 p-5 rounded-2xl border ${
        isLight ? 'bg-white border-[#e3e2e0] shadow-sm' : 'bg-black/40 border-white/10 backdrop-blur-2xl'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
            isLight ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
          }`}>
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-[#37352f]' : 'text-white'}`}>업무 및 보강 관리</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Teacher Workboard & Makeup Scheduler</p>
          </div>
        </div>

        <div className={`flex p-1 rounded-xl flex-wrap gap-1 border ${
          isLight ? 'bg-[#f0f0ed] border-[#e3e2e0]' : 'bg-white/5 border-white/10'
        }`}>
          <button 
            onClick={() => setActiveTab('makeups')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'makeups' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-white')
            }`}
          >
            <CalendarRange size={14} /> 보강 관리
          </button>
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'tasks' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-white')
            }`}
          >
            <Sparkles size={14} /> 업무 목록
          </button>
          <button 
            onClick={() => setActiveTab('suggestions')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'suggestions' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-white')
            }`}
          >
            <MessageSquare size={14} /> 학생 건의
          </button>
          <button 
            onClick={() => setActiveTab('surveys')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'surveys' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-white')
            }`}
          >
            <Users size={14} /> 설문/수요조사
          </button>
          <button 
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'links' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-white')
            }`}
          >
            <ExternalLink size={14} /> 유용한 링크
          </button>
        </div>
      </div>

      {/* 2. Main Work Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Tasks Board */}
          {activeTab === 'tasks' && (
            <motion.div 
              key="tasks-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="absolute inset-0 flex flex-col space-y-4 overflow-hidden"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">전체 등록된 할 일 ({visibleTasks.length}개)</span>
                  
                  {/* 내 담당 업무만 보기 토글 */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={showOnlyMyTasks}
                      onChange={(e) => setShowOnlyMyTasks(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
                    />
                    <span className="text-[10px] font-black text-gray-400 hover:text-white transition-all uppercase tracking-wider">내 담당 업무만 보기</span>
                  </label>

                  {/* 숨김 해제 버튼 (원장/마스터에게만 보임) */}
                  {(currentUser?.role === 'admin' || currentUser?.role === 'master') && hiddenTaskIds.length > 0 && (
                    <button 
                      onClick={() => {
                        if (confirm('숨겨놓았던 건의사항 카드를 모두 다시 표시하시겠습니까?')) {
                          setHiddenTaskIds([]);
                          localStorage.removeItem('ams_hidden_task_ids');
                        }
                      }}
                      className="text-[9px] font-black text-amber-500 hover:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 transition-all uppercase tracking-wider"
                    >
                      숨김 해제 ({hiddenTaskIds.length})
                    </button>
                  )}
                </div>
                
                <button 
                  onClick={() => setIsTaskModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-black hover:bg-blue-500 transition-all shadow-md shadow-blue-600/10"
                >
                  <Plus size={14} /> 새 업무 등록
                </button>
              </div>

              {isTaskLoading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar-v align-start content-start">
                  {visibleTasks.map((task) => {
                    const assignee = teachers.find(t => t.id === task.created_by);
                    const isOverdue = task.target_date !== '9999-12-31' && new Date(task.target_date) < new Date(getTodayStr()) && !task.is_completed;
                    
                    return (
                      <motion.div 
                        key={task.id}
                        layout
                        className={`group relative flex flex-col justify-between border rounded-2xl p-4 transition-all ${
                          isLight ? 'bg-white border-[#e3e2e0] shadow-sm hover:border-blue-400' : 'bg-[#0a0a0a] border-white/10 hover:border-white/20'
                        } ${task.is_completed ? 'opacity-60' : ''}`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-bold leading-tight ${
                              task.is_completed ? 'text-gray-400 line-through' : (isLight ? 'text-[#37352f]' : 'text-white')
                            }`}>{task.title}</h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={() => handleToggleTask(task.id, task.is_completed)}
                                className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                                  task.is_completed ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : (isLight ? 'border-gray-300 hover:border-blue-500 hover:text-blue-500' : 'border-white/20 hover:border-blue-500 hover:text-blue-500')
                                }`}
                                title="완료 처리"
                              >
                                <Check size={10} strokeWidth={4} />
                              </button>

                              {/* 원장 화면 숨기기 버튼 */}
                              {task.title?.startsWith('[건의]') && (currentUser?.role === 'admin' || currentUser?.role === 'master') && (
                                <button 
                                  onClick={() => handleHideTask(task.id)}
                                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all opacity-0 group-hover:opacity-100 ${
                                    isLight ? 'border-gray-300 text-gray-400 hover:border-amber-500 hover:text-amber-500' : 'border-white/10 text-gray-500 hover:border-amber-500 hover:text-amber-500'
                                  }`}
                                  title="내 화면에서 숨기기"
                                >
                                  <EyeOff size={10} />
                                </button>
                              )}

                              <button 
                                onClick={() => handleDeleteTask(task.id)}
                                className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all opacity-0 group-hover:opacity-100 ${
                                  isLight ? 'border-gray-300 text-gray-400 hover:border-rose-500 hover:text-rose-500' : 'border-white/10 text-gray-500 hover:border-rose-500 hover:text-rose-500'
                                }`}
                                title="완전 삭제"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                          <p className={`text-xs leading-relaxed whitespace-pre-wrap ${
                            task.is_completed ? 'text-gray-400 line-through' : (isLight ? 'text-gray-600' : 'text-gray-100')
                          }`}>{task.content || '세부 설명이 없습니다.'}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-bold">
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <User size={12} />
                            <span>{assignee?.nickname || assignee?.name || '지정되지 않음'}</span>
                          </div>
                          
                          <div className={`px-2 py-0.5 rounded-[4px] uppercase font-black ${
                            task.is_completed 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : isOverdue 
                                ? 'bg-rose-500/10 text-rose-400 animate-pulse' 
                                : task.target_date === '9999-12-31'
                                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                  : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {task.is_completed ? '완료' : getDDay(task.target_date)}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {visibleTasks.length === 0 && (
                    <div className="col-span-full h-64 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-gray-500 gap-2">
                      <Sparkles size={24} className="text-gray-600" />
                      <span className="text-xs font-bold">등록된 업무가 없습니다. 새 업무를 생성해 보세요.</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: Makeup Sessions Scheduler */}
          {activeTab === 'makeups' && (
            <motion.div 
              key="makeups-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="absolute inset-0 flex flex-col space-y-4 overflow-hidden"
            >
              <div className={`flex flex-wrap items-center justify-between gap-3 shrink-0 p-3 rounded-2xl border ${
                isLight ? 'bg-[#f2f1ee]/70 border-[#e3e2e0]' : 'bg-white/5 border-white/10'
              }`}>
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  {/* 학생 / 보강 검색어 */}
                  <div className="relative w-48 shrink-0">
                    <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} size={13} />
                    <input
                      type="text"
                      placeholder="학생명/학년 검색..."
                      value={makeupCardSearch}
                      onChange={(e) => setMakeupCardSearch(e.target.value)}
                      className={`w-full border rounded-xl pl-8 pr-2.5 py-1.5 text-xs outline-none focus:border-blue-500 transition-all ${
                        isLight ? 'bg-white border-[#e3e2e0] text-[#37352f] shadow-sm placeholder-gray-400' : 'bg-black/40 border-white/10 text-white placeholder-gray-500'
                      }`}
                    />
                  </div>

                  {/* 기간 선택 드롭다운 */}
                  <select
                    value={makeupCardPeriod}
                    onChange={(e) => setMakeupCardPeriod(e.target.value as any)}
                    className={`border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500 transition-all cursor-pointer ${
                      isLight ? 'bg-white border-[#e3e2e0] text-[#37352f] shadow-sm' : 'bg-black/40 border-white/10 text-gray-300 [color-scheme:dark]'
                    }`}
                  >
                    <option value="today">오늘 이후</option>
                    <option value="month">이번 달</option>
                    <option value="all">전체 기간</option>
                    <option value="custom">기간 직접 지정</option>
                  </select>

                  {/* 기간 직접 지정 시 시작일~종료일 */}
                  {makeupCardPeriod === 'custom' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={makeupCardStartDate}
                        onChange={(e) => setMakeupCardStartDate(e.target.value)}
                        className={`border rounded-xl px-2 py-1 text-xs focus:outline-none focus:border-blue-500 transition-all ${
                          isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-black/40 border-white/10 text-white [color-scheme:dark]'
                        }`}
                      />
                      <span className="text-gray-500 text-xs">~</span>
                      <input
                        type="date"
                        value={makeupCardEndDate}
                        onChange={(e) => setMakeupCardEndDate(e.target.value)}
                        className={`border rounded-xl px-2 py-1 text-xs focus:outline-none focus:border-blue-500 transition-all ${
                          isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-black/40 border-white/10 text-white [color-scheme:dark]'
                        }`}
                      />
                    </div>
                  )}

                  <span className="text-[10px] font-bold text-gray-500">
                    ({groupedMakeups.reduce((acc, g) => acc + g.items.length, 0)}명 / {groupedMakeups.length}개 카드)
                  </span>
                </div>

                <button 
                  onClick={() => setIsMakeupModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-all shadow-md shadow-blue-600/10 shrink-0"
                >
                  <Plus size={14} /> 보강 일정 예약
                </button>
              </div>

              {isMakeupLoading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar-v align-start content-start">
                  {groupedMakeups.map((group) => {
                    const formattedDate = group.date.slice(5).replace('-', '.');
                    const isToday = group.date === getTodayStr();
                    
                    return (
                      <motion.div 
                        key={`${group.date}-${group.time}`}
                        layout
                        className={`group relative flex flex-col justify-between border rounded-2xl p-4 transition-all ${
                          isLight ? 'bg-white border-[#e3e2e0] shadow-sm hover:border-blue-400' : 'bg-[#0a0a0a] border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* 카드 헤더: 날짜와 시간 */}
                          <div className={`flex items-center justify-between pb-2 border-b gap-2 ${
                            isLight ? 'border-b-[#e3e2e0]' : 'border-b-white/5'
                          }`}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Calendar size={13} className="text-blue-500 shrink-0" />
                              <span className={`text-xs font-bold truncate ${isLight ? 'text-[#37352f]' : 'text-white'}`}>{formattedDate}</span>
                              {isToday && <span className="text-blue-600 font-bold text-[9px] shrink-0">(오늘)</span>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1 text-gray-500 text-[11px] font-bold">
                                <Clock size={11} className="text-gray-400" />
                                <span>{group.time} ({group.items.length}명)</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => handleOpenEditGroupMakeup(group)}
                                className="text-[8.5px] font-bold px-1.5 py-0.5 border border-blue-200 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded transition-all"
                              >
                                수정
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleDeleteGroupMakeups(group.items)}
                                className="text-[8.5px] font-bold px-1.5 py-0.5 border border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded transition-all"
                              >
                                전체 취소
                              </button>
                            </div>
                          </div>

                          {/* 카드 바디: 소속 학생 목록 */}
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5 custom-scrollbar-v">
                            {group.items.map((makeup) => {
                              const studentObj = students.find(s => s.id === makeup.student_id);
                              const teacherObj = teachers.find(t => t.id === studentObj?.teacher_id);
                              const teacherName = teacherObj?.name || '담당미지정';
                              const isCompleted = makeup.attendance_status === '출석' || makeup.attendance_status === '결석' || makeup.attendance_status === '지각';
                              const monthlyCount = getMonthlyMakeupCount(makeup.student_id, makeup.session_date, makeup.id);
                              
                              // 💡 [수정 정책] 보강 사유는 special_notes만 사용 (completed_classwork_text 수행진도 완전 배제)
                              const rawNotes = (makeup.special_notes || '').trim();
                              const reasonText = rawNotes.length > 0 ? rawNotes : null;

                              return (
                                <div key={makeup.id} className={`py-2.5 border-b last:border-0 group/row ${
                                  isLight ? 'border-b-[#e3e2e0]' : 'border-b-white/5'
                                }`}>
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                                    {/* 좌측 정보 영역 (3줄 위계 구조) */}
                                    <div className="flex flex-col flex-1 min-w-0 space-y-1">
                                      {/* 1행: 학생 이름 + 과목 뱃지 + 회차 뱃지 */}
                                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                        <span className={`text-xs font-bold truncate ${isLight ? 'text-[#37352f]' : 'text-white'}`}>
                                          {makeup.student_name}
                                        </span>
                                        <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded shrink-0 border ${
                                          makeup.course_name && makeup.course_name !== '정규' 
                                            ? (isLight ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30') 
                                            : (isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/20 text-blue-300 border-blue-500/30')
                                        }`}>
                                          {makeup.course_name || '정규'}
                                        </span>
                                        <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded shrink-0 border ${
                                          isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                        }`}>
                                          이번 달 {monthlyCount}회차
                                        </span>
                                      </div>

                                      {/* 2행: 학년 · 등원요일 + 담당 교사 */}
                                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold text-gray-400">
                                        <span>
                                          {studentObj?.grade || '정보없음'}
                                          {studentObj?.class_days && studentObj.class_days.length > 0 ? ` · ${[...studentObj.class_days].sort((a, b) => {
                                            const order = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                                            return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
                                          }).join('')}` : ''}
                                        </span>
                                        <span className="text-gray-600">·</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8.5px] border ${
                                          isLight ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                        }`}>
                                          담당: {teacherName}
                                        </span>
                                      </div>

                                      {/* 3행: 긴 보강 사유 (원문 보존, 최대 2줄 clamp 및 break-words) */}
                                      {reasonText && (
                                        <div className="pt-0.5">
                                          <span className={`inline-flex items-center gap-1 text-[8.5px] font-medium px-2 py-0.5 rounded max-w-full break-words whitespace-normal leading-relaxed line-clamp-2 border ${
                                            isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                          }`}>
                                            📅 {reasonText}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* 우측 출결 상태 및 액션 영역 (shrink-0, 반응형 지원) */}
                                    <div className="flex items-center sm:flex-col sm:items-end justify-end shrink-0 pt-0.5 self-end sm:self-auto gap-1">
                                      {isCompleted ? (
                                        <div className="flex items-center sm:flex-col sm:items-end gap-1">
                                          <span className={`text-[8.5px] font-black px-2 py-0.5 rounded whitespace-nowrap border ${
                                            makeup.attendance_status === '출석'
                                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                              : makeup.attendance_status === '지각'
                                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                          }`}>
                                            {makeup.attendance_status === '출석' ? '🟢 출석' : makeup.attendance_status === '지각' ? '🟡 지각' : '🔴 결석'}
                                          </span>
                                          <button 
                                            type="button"
                                            onClick={() => handleMakeupAttendance(makeup.id, makeup.student_id, makeup.session_date, `보강:${group.time}`)}
                                            className={`text-[8px] font-bold underline underline-offset-2 px-1 transition-colors ${
                                              isLight ? 'text-gray-400 hover:text-gray-600' : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                            title="출석 상태 재초기화"
                                          >
                                            재수정
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <button 
                                            onClick={() => handleMakeupAttendance(makeup.id, makeup.student_id, makeup.session_date, '출석')}
                                            className="text-[8.5px] font-black px-1.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-400 rounded transition-all whitespace-nowrap"
                                          >
                                            출석
                                          </button>
                                          <button 
                                            onClick={() => handleMakeupAttendance(makeup.id, makeup.student_id, makeup.session_date, '지각')}
                                            className="text-[8.5px] font-black px-1.5 py-0.5 bg-amber-500/10 hover:bg-amber-500 hover:text-white border border-amber-500/20 text-amber-400 rounded transition-all whitespace-nowrap"
                                          >
                                            지각
                                          </button>
                                          <button 
                                            onClick={() => handleMakeupAttendance(makeup.id, makeup.student_id, makeup.session_date, '결석')}
                                            className="text-[8.5px] font-black px-1.5 py-0.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-rose-400 rounded transition-all whitespace-nowrap"
                                          >
                                            결석
                                          </button>
                                        </div>
                                      )}

                                      <button 
                                        onClick={() => handleDeleteMakeup(makeup.id)}
                                        className="w-5 h-5 rounded-full flex items-center justify-center border border-white/10 text-gray-500 hover:border-rose-500 hover:text-rose-500 hover:bg-rose-500/5 transition-all opacity-0 group-hover/row:opacity-100"
                                        title="보강 취소"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* 메모 표시 및 인라인 입력창 */}
                                  <div className="text-[10px] pt-0.5">
                                    {editingMemoId === makeup.id ? (
                                      <div className="flex items-center gap-1 w-full">
                                        <input
                                          type="text"
                                          value={editingMemoText}
                                          onChange={(e) => setEditingMemoText(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveMemo(makeup.id);
                                            if (e.key === 'Escape') setEditingMemoId(null);
                                          }}
                                          placeholder="메모 입력 후 Enter (예: 3단원 오답풀이)"
                                          className="flex-1 bg-black/60 border border-blue-500/50 rounded px-2 py-0.5 text-[10px] text-white focus:outline-none"
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveMemo(makeup.id)}
                                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9.5px] font-black shrink-0"
                                        >
                                          저장
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingMemoId(null)}
                                          className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white rounded text-[9.5px] font-black shrink-0"
                                        >
                                          취소
                                        </button>
                                      </div>
                                    ) : (
                                      <div 
                                        onClick={() => { setEditingMemoId(makeup.id); setEditingMemoText(makeup.attendance_reason || ''); }}
                                        className="flex items-center justify-between text-gray-400 hover:text-blue-300 cursor-pointer group/memo py-0.5 px-1 rounded hover:bg-white/5 transition-all"
                                        title="클릭하여 메모 수정"
                                      >
                                        <div className="flex items-center gap-1 min-w-0 pr-1">
                                          <FileText size={10} className="text-gray-500 shrink-0" />
                                          <span className={`truncate text-[9.5px] ${makeup.attendance_reason ? "text-blue-300 font-medium" : "text-gray-600 italic"}`}>
                                            {makeup.attendance_reason || '메모 작성...'}
                                          </span>
                                        </div>
                                        <Edit2 size={9} className="text-gray-500 group-hover/memo:text-blue-400 shrink-0 opacity-0 group-hover/memo:opacity-100 transition-opacity" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {makeups.length === 0 && (
                    <div className="col-span-full h-64 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-gray-500 gap-2">
                      <CalendarRange size={24} className="text-gray-600" />
                      <span className="text-xs font-bold">예약된 보강 일정이 없습니다.</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: Link Tasks */}
          {activeTab === 'links' && (
            <TaskLinksTab
              academyInfo={academyInfo}
              tasks={tasks}
              teachers={teachers}
              currentUser={currentUser}
              onRefreshTasks={fetchTasks}
              isLight={isLight}
            />
          )}

          {/* TAB 4: Student Suggestions */}
          {activeTab === 'suggestions' && (
            <motion.div 
              key="suggestions-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="absolute inset-0 flex flex-col space-y-4 overflow-hidden"
            >
              <SuggestionHistoryView 
                tasks={tasks} 
                toggleTask={(t: any) => handleToggleTask(t.id, t.is_completed)} 
                deleteTask={handleDeleteTask} 
                isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'master'} 
                isLight={isLight}
              />
            </motion.div>
          )}

          {/* TAB 5: Surveys Management */}
          {activeTab === 'surveys' && (
            <motion.div 
              key="surveys-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="absolute inset-0 flex flex-col overflow-y-auto custom-scrollbar-v"
            >
              <SurveyManagement academyInfo={academyInfo} students={students} currentUser={currentUser} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* 3. MODALS (Task Add Modal) */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1e1e24] border-2 border-white/20 rounded-2xl w-full max-w-md p-6 shadow-[0_0_30px_rgba(0,0,0,0.6)] space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">새 업무 등록</h3>
                <button onClick={() => setIsTaskModalOpen(false)} className="text-gray-500 hover:text-white transition-all"><X size={16} /></button>
              </div>

              <form onSubmit={handleAddTask} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">업무 제목</label>
                  <input 
                    type="text" 
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                    placeholder="예: 교재 검토, 영상 촬영 등"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">상세 내용</label>
                  <textarea 
                    value={taskContent}
                    onChange={(e) => setTaskContent(e.target.value)}
                    rows={3}
                    placeholder="업무 세부 지시 사항 입력"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">마감 기한</label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={isPermanentTask}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsPermanentTask(checked);
                            if (checked) {
                              setTaskTargetDate('9999-12-31');
                            } else {
                              setTaskTargetDate(getTodayStr());
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
                        />
                        <span className="text-[9px] font-black text-gray-400 hover:text-white transition-all uppercase tracking-wider">상시 업무</span>
                      </label>
                    </div>
                    <input 
                      type="date" 
                      value={isPermanentTask ? '' : taskTargetDate}
                      onChange={(e) => setTaskTargetDate(e.target.value)}
                      disabled={isPermanentTask}
                      required={!isPermanentTask}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all [color-scheme:dark] disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">담당 강사</label>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1 custom-scrollbar-v">
                    {teachers.map(t => {
                      const isSelected = taskAssignee === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTaskAssignee(t.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black transition-all ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black uppercase ${
                            isSelected ? 'bg-white text-blue-600' : 'bg-white/10 text-gray-300'
                          }`}>
                            {(t.nickname || t.name || '?')[0]}
                          </div>
                          <span>{t.nickname || t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsTaskModalOpen(false);
                      setTaskTitle('');
                      setTaskContent('');
                      setTaskTargetDate(getTodayStr());
                      setTaskAssignee(currentUser?.id || '');
                      setIsPermanentTask(false);
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black transition-all"
                  >
                    등록
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL 2: Makeup Session Add / Edit Modal */}
        {isMakeupModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 ${
                isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-[#1e1e24] border-2 border-white/20 text-white'
              }`}
            >
              <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-b-[#e3e2e0]' : 'border-b-white/5'}`}>
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-[#37352f]' : 'text-white'}`}>
                  {editMakeupGroup ? `보강 일정 수정` : '보강 일정 예약'}
                </h3>
                <button 
                  onClick={() => {
                    setIsMakeupModalOpen(false);
                    setEditMakeupGroup(null);
                    setSelectedStudentIds([]);
                  }} 
                  className={`transition-all ${isLight ? 'text-gray-400 hover:text-black' : 'text-gray-500 hover:text-white'}`}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddMakeups} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">보강 날짜</label>
                    <input 
                      type="date" 
                      value={makeupDate}
                      onChange={(e) => setMakeupDate(e.target.value)}
                      required
                      className={`w-full border rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-blue-500 transition-all ${
                        isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">시작 시간</label>
                    <input 
                      type="time"
                      value={makeupTime}
                      onChange={(e) => setMakeupTime(e.target.value)}
                      required
                      className={`w-full border rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-blue-500 transition-all ${
                        isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">종료 시간</label>
                    <input 
                      type="time"
                      value={makeupEndTime}
                      onChange={(e) => setMakeupEndTime(e.target.value)}
                      required
                      className={`w-full border rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-blue-500 transition-all ${
                        isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                      }`}
                    />
                  </div>
                </div>

                {/* 보강 구분 & 결석 원인 날짜 입력 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">보강 구분</label>
                    <select 
                      value={makeupType}
                      onChange={(e) => setMakeupType(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-all cursor-pointer ${
                        isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-[#0a0a0a] border-white/10 text-white'
                      }`}
                    >
                      <option value="결석 보강">결석 보강</option>
                      <option value="진도 보강">진도 보강</option>
                      <option value="시험 보강">시험 보강</option>
                      <option value="기타 보강">기타 보강</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                      결석 원인 날짜 <span className="text-[8px] font-normal text-gray-500">(선택)</span>
                    </label>
                    <input
                      type="text"
                      value={makeupReason}
                      onChange={(e) => setMakeupReason(e.target.value)}
                      placeholder="예: 8/2 결석분"
                      className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 transition-all ${
                        isLight ? 'bg-white border-amber-500/40 text-[#37352f] placeholder-gray-400' : 'bg-white/5 border-amber-500/30 text-amber-200 placeholder-gray-600'
                      }`}
                    />
                  </div>
                </div>

                {/* 수정 모드일 때 기존 학생 목록 표시 */}
                {editMakeupGroup && (
                  <div className={`space-y-1 border p-4 rounded-xl ${isLight ? 'bg-gray-50 border-[#e3e2e0]' : 'bg-white/5 border-white/5'}`}>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">기존 참여 학생 ({editMakeupGroup.items.length}명)</label>
                    <div className="max-h-24 overflow-y-auto pr-1 custom-scrollbar-v flex flex-wrap gap-1.5 mt-1.5">
                      {editMakeupGroup.items.map((item: any) => (
                        <span key={item.id} className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                          {item.student_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 학생 검색 및 필터 영역 (수정 모드와 신규 모드 공통 제공) */}
                <div className="space-y-2.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">
                    {editMakeupGroup ? '추가할 보강 대상 학생 검색 및 필터' : '보강 대상 학생 검색 및 필터'}
                  </label>
                  
                  {/* 학년/요일 필터 셀렉트 박스 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest">학년 필터</label>
                      <select 
                        value={makeupGradeFilter}
                        onChange={(e) => setMakeupGradeFilter(e.target.value)}
                        className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 transition-all cursor-pointer ${
                          isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-[#0a0a0a] border-white/10 text-white'
                        }`}
                      >
                        <option value="all">학년 전체</option>
                        <option value="중1">중1</option>
                        <option value="중2">중2</option>
                        <option value="중3">중3</option>
                        <option value="고1">고1</option>
                        <option value="고2">고2</option>
                        <option value="고3">고3</option>
                        <option value="초">초등</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest">요일 필터</label>
                      <select 
                        value={makeupDayFilter}
                        onChange={(e) => setMakeupDayFilter(e.target.value)}
                        className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 transition-all cursor-pointer ${
                          isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-[#0a0a0a] border-white/10 text-white'
                        }`}
                      >
                        <option value="all">요일 전체</option>
                        <option value="월">월요일</option>
                        <option value="화">화요일</option>
                        <option value="수">수요일</option>
                        <option value="목">목요일</option>
                        <option value="금">금요일</option>
                        <option value="토">토요일</option>
                        <option value="일">일요일</option>
                      </select>
                    </div>
                  </div>

                  {/* 내 담당 학생만 보기 & 정규만 / 선택과목만 필터 체크박스 바 */}
                  <div className={`flex items-center justify-between px-1 pt-1 border-t ${isLight ? 'border-t-[#e3e2e0]' : 'border-t-white/5'}`}>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={courseFilterMode === 'regularOnly'}
                          onChange={(e) => setCourseFilterMode(e.target.checked ? 'regularOnly' : 'all')}
                          className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-500"
                        />
                        <span className={`text-[10px] font-bold transition-all ${isLight ? 'text-gray-600 hover:text-black' : 'text-gray-300 hover:text-white'}`}>정규만</span>
                      </label>
                      
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={courseFilterMode === 'electiveOnly'}
                          onChange={(e) => setCourseFilterMode(e.target.checked ? 'electiveOnly' : 'all')}
                          className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-amber-500"
                        />
                        <span className="text-[10px] font-bold text-amber-500 hover:text-amber-600 transition-all">선택과목만</span>
                      </label>
                    </div>

                    {(currentUser?.role === 'admin' || currentUser?.role === 'master') && (
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={showOnlyMyStudentsInMakeup}
                          onChange={(e) => setShowOnlyMyStudentsInMakeup(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
                        />
                        <span className={`text-[10px] font-black uppercase tracking-wider transition-all ${isLight ? 'text-gray-500 hover:text-black' : 'text-gray-400 hover:text-white'}`}>내 담당 학생만 보기</span>
                      </label>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                    <input 
                      type="text" 
                      value={makeupSearch}
                      onChange={(e) => setMakeupSearch(e.target.value)}
                      placeholder="이름, 학년, 요일, 반 이름으로 검색..."
                      className={`w-full border rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-all ${
                        isLight ? 'bg-white border-[#e3e2e0] text-[#37352f] placeholder-gray-400' : 'bg-white/5 border-white/10 text-white placeholder-gray-600'
                      }`}
                    />
                  </div>

                  {/* Search Results */}
                  <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[9px] font-bold text-gray-500">검색 결과 ({filteredStudents.length}명)</span>
                        {filteredStudents.length > 0 && (
                          <button
                            type="button"
                            onClick={isAllFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered}
                            className="text-[9px] font-black text-blue-600 hover:text-blue-500 transition-all uppercase tracking-wider"
                          >
                            {isAllFilteredSelected ? '전체 해제' : '검색 결과 전체 선택'}
                          </button>
                        )}
                      </div>

                      <div className={`max-h-48 overflow-y-auto border rounded-lg p-1 space-y-0.5 custom-scrollbar-v ${
                        isLight ? 'bg-white border-[#e3e2e0]' : 'bg-black/60 border-white/10'
                      }`}>
                        {filteredStudents.map(s => {
                          const itemKey = s.itemKey || s.id;
                          const isSelected = selectedStudentIds.includes(itemKey);
                          const isSpecial = itemKey.includes('_special_');
                          const courseSubject = s.courseName || '정규';
                          return (
                            <div 
                              key={itemKey}
                              onClick={() => {
                                setSelectedStudentIds(prev => isSelected ? prev.filter(id => id !== itemKey) : [...prev, itemKey]);
                              }}
                              className={`flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer text-xs font-bold transition-all ${
                                isSelected 
                                  ? (isSpecial ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200') 
                                  : (isLight ? 'hover:bg-gray-100 text-[#37352f]' : 'hover:bg-white/5 text-gray-400 hover:text-white')
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                {isSpecial && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 border border-amber-500/30">
                                    {courseSubject}
                                  </span>
                                )}
                                <span>{s.name} ({s.grade || '학년미정'} | {s.class_days && s.class_days.length > 0 ? [...s.class_days].sort((a, b) => {
                                  const order = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                                  return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
                                }).join('') : '요일미정'})</span>
                              </div>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                isSelected 
                                  ? (isSpecial ? 'border-amber-500 bg-amber-500 text-white font-black' : 'border-blue-600 bg-blue-600 text-white') 
                                  : (isLight ? 'border-gray-300' : 'border-white/20')
                              }`}>
                                {isSelected && <Check size={10} strokeWidth={4} />}
                              </div>
                            </div>
                          );
                        })}
                        {filteredStudents.length === 0 && (
                          <div className="p-3 text-center text-xs text-gray-400">조건에 부합하는 학생이 없습니다.</div>
                        )}
                      </div>
                    </div>

                  {/* Selected Students Chips */}
                  {selectedStudentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {selectedStudentIds.map(itemKey => {
                        let name = '학생';
                        let isSpecial = false;
                        if (itemKey.includes('_special_')) {
                          isSpecial = true;
                          const parts = itemKey.split('_special_');
                          const st = students.find(s => s.id === parts[0]);
                          name = `[${parts[1]}] ${st?.name || '학생'}`;
                        } else {
                          const st = students.find(s => s.id === itemKey);
                          name = st?.name || '학생';
                        }
                        return (
                          <div 
                            key={itemKey} 
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-black border ${
                              isSpecial 
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' 
                                : 'bg-blue-50 border-blue-200 text-blue-700'
                            }`}
                          >
                            <span>{name}</span>
                            <button 
                              type="button" 
                              onClick={() => setSelectedStudentIds(prev => prev.filter(item => item !== itemKey))}
                              className={isSpecial ? "text-amber-500 hover:text-amber-700 transition-colors" : "text-blue-600 hover:text-blue-800 transition-colors"}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsMakeupModalOpen(false);
                      setEditMakeupGroup(null);
                      setSelectedStudentIds([]);
                      setMakeupSearch('');
                      setMakeupGradeFilter('all');
                      setMakeupDayFilter('all');
                      setShowOnlyMyStudentsInMakeup(true);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      isLight ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    disabled={!editMakeupGroup && selectedStudentIds.length === 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-lg text-xs font-black transition-all"
                  >
                    {editMakeupGroup ? '수정 완료' : '보강 추가'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// --- Sub-component: SuggestionHistoryView ---
function SuggestionHistoryView({ tasks, toggleTask, deleteTask, isAdmin, isLight = false }: any) {
  const [sugFilter, setSugFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const suggestions = useMemo(() => {
    return tasks.filter((t: any) => t.title.startsWith('[건의]'));
  }, [tasks]);

  const filteredSuggestions = useMemo(() => {
    let result = suggestions;
    if (sugFilter === 'pending') {
      result = result.filter((t: any) => !t.is_completed);
    } else if (sugFilter === 'completed') {
      result = result.filter((t: any) => t.is_completed);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t: any) => 
        t.title.toLowerCase().includes(q) || 
        (t.content && t.content.toLowerCase().includes(q))
      );
    }
    return result.sort((a: any, b: any) => new Date(b.target_date).getTime() - new Date(a.target_date).getTime());
  }, [suggestions, sugFilter, searchQuery]);

  return (
    <div className="space-y-6 h-full flex flex-col overflow-hidden">
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-2xl border ${isLight ? 'bg-[#f2f1ee]/70 border-[#e3e2e0]' : 'bg-[#0f0f0f] border-white/5'}`}>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Filter:</span>
          <div className={`flex rounded-xl p-1 border ${isLight ? 'bg-white border-[#e3e2e0] shadow-sm' : 'bg-white/5 border-white/5'}`}>
            {[
              { id: 'all', label: '전체' },
              { id: 'pending', label: '미완료' },
              { id: 'completed', label: '완료됨' }
            ].map(f => (
              <button 
                key={f.id} 
                onClick={() => setSugFilter(f.id as any)} 
                className={`text-[10px] px-3.5 py-1.5 rounded-lg font-bold transition-all ${sugFilter === f.id ? 'bg-blue-600 text-white shadow-sm' : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-500 hover:text-gray-300')}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="학생 이름이나 내용 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full border rounded-xl py-2 px-3 text-[11px] outline-none focus:border-blue-500 transition-all ${isLight ? 'bg-white border-[#e3e2e0] text-[#37352f] shadow-sm placeholder:text-gray-400' : 'bg-black/40 border-white/10 text-white placeholder:text-gray-650'}`}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-gray-400 hover:text-black' : 'text-gray-500 hover:text-white'}`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar-v space-y-3 pr-1">
        {filteredSuggestions.length === 0 ? (
          <div className={`py-20 border border-dashed rounded-2xl text-center text-xs font-bold ${isLight ? 'border-[#e3e2e0] bg-white text-gray-400 shadow-sm' : 'border-white/5 bg-black/20 text-gray-700'}`}>
            조회된 건의 사항이 없습니다.
          </div>
        ) : (
          filteredSuggestions.map((task: any) => (
            <motion.div 
              layout 
              key={task.id} 
              className={`group bg-[#0f0f0f] border rounded-[4px] p-4 transition-all ${
                task.is_completed ? 'border-white/5 opacity-80' : 'border-white/10 hover:border-blue-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <button 
                    onClick={() => toggleTask(task)} 
                    className={`mt-1 transition-colors shrink-0 ${task.is_completed ? 'text-emerald-500' : 'text-gray-600 hover:text-blue-500'}`}
                  >
                    {task.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className={`text-sm font-black transition-all ${task.is_completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                        {task.title.replace('[건의] ', '')}
                      </h4>
                      <span className={`text-[9px] font-black text-gray-650 uppercase tabular-nums`}>
                        {task.target_date.replace(/-/g, '.')}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed whitespace-pre-wrap ${task.is_completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                      {task.content}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => deleteTask(task.id)} 
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-600 hover:text-red-500 transition-all shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
