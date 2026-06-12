'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Calendar, Plus, Check, Trash2, Clock, 
  User, CheckCircle, AlertCircle, Search, Sparkles, Loader2, CalendarRange, X, EyeOff
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getTodayStr } from '@/lib/utils';
import { SessionLog, Student, Teacher } from '@/types/dashboard';

interface TeacherTasksProps {
  academyInfo: any;
  students: Student[];
  teachers: Teacher[];
  currentUser: any;
  onRefreshStudents: (showLoader?: boolean) => Promise<void>;
}

interface TeacherTaskItem {
  id: string;
  academy_id: string;
  title: string;
  content: string;
  start_date: string;
  target_date: string;
  display_period_type: 'custom' | 'weekly' | 'monthly';
  is_completed: boolean;
  created_by: string; // 담당 선생님 ID
  created_at: string;
}

export default function TeacherTasks({
  academyInfo,
  students,
  teachers,
  currentUser,
  onRefreshStudents
}: TeacherTasksProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'makeups'>('tasks');
  const [tasks, setTasks] = useState<TeacherTaskItem[]>([]);
  const [makeups, setMakeups] = useState<any[]>([]);
  const [isTaskLoading, setIsTaskLoading] = useState(false);
  const [isMakeupLoading, setIsMakeupLoading] = useState(false);
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState<boolean>(false);
  const [hiddenTaskIds, setHiddenTaskIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ams_hidden_task_ids');
      if (stored) {
        try {
          setHiddenTaskIds(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  // --- Task Form States ---
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskContent, setTaskContent] = useState('');
  const [taskTargetDate, setTaskTargetDate] = useState(getTodayStr());
  const [taskAssignee, setTaskAssignee] = useState(currentUser?.id || '');

  // --- Makeup Form States ---
  const [isMakeupModalOpen, setIsMakeupModalOpen] = useState(false);
  const [makeupDate, setMakeupDate] = useState(getTodayStr());
  const [makeupTime, setMakeupTime] = useState<string>('19:00'); // 디폴트 19:00
  const [makeupSearch, setMakeupSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [makeupGradeFilter, setMakeupGradeFilter] = useState<string>('all');
  const [makeupDayFilter, setMakeupDayFilter] = useState<string>('all');
  const [showOnlyMyStudentsInMakeup, setShowOnlyMyStudentsInMakeup] = useState<boolean>(true);

  // 1. Fetch Tasks
  const fetchTasks = useCallback(async () => {
    if (!academyInfo?.id) return;
    setIsTaskLoading(true);
    try {
      const { data, error } = await supabase
        .from('ams_tasks')
        .select('*')
        .eq('academy_id', academyInfo.id)
        .order('target_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setIsTaskLoading(false);
    }
  }, [academyInfo?.id]);

  // 2. Fetch Makeup Sessions
  const fetchMakeups = useCallback(async () => {
    if (!academyInfo?.id) return;
    setIsMakeupLoading(true);
    try {
      const { data, error } = await supabase
        .from('ams_session_logs')
        .select('*')
        .eq('academy_id', academyInfo.id)
        .like('attendance_status', '보강%')
        .order('session_date', { ascending: true });

      if (error) throw error;
      setMakeups(data || []);
    } catch (err) {
      console.error('Error fetching makeups:', err);
    } finally {
      setIsMakeupLoading(false);
    }
  }, [academyInfo?.id]);

  useEffect(() => {
    fetchTasks();
    fetchMakeups();
  }, [fetchTasks, fetchMakeups]);

  // 3. Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !academyInfo?.id) return;

    try {
      const newTask = {
        academy_id: academyInfo.id,
        title: taskTitle.trim(),
        content: taskContent.trim(),
        start_date: getTodayStr(),
        target_date: taskTargetDate,
        display_period_type: 'custom',
        is_completed: false,
        created_by: taskAssignee || currentUser?.id || '',
        type: 'manual'
      };

      const { error } = await supabase
        .from('ams_tasks')
        .insert([newTask]);

      if (error) throw error;

      setTaskTitle('');
      setTaskContent('');
      setTaskTargetDate(getTodayStr());
      setIsTaskModalOpen(false);
      fetchTasks();
    } catch (err) {
      console.error('Error adding task:', err);
      alert('업무 등록에 실패했습니다.');
    }
  };

  // 4. Toggle Task Completion
  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      // 낙관적 업데이트
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: !currentStatus } : t));

      const { error } = await supabase
        .from('ams_tasks')
        .update({ is_completed: !currentStatus })
        .eq('id', taskId);

      if (error) throw error;
    } catch (err) {
      console.error('Error toggling task:', err);
      fetchTasks();
    }
  };

  // 5. Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('해당 업무를 삭제하시겠습니까?')) return;
    try {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      const { error } = await supabase
        .from('ams_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    } catch (err) {
      console.error('Error deleting task:', err);
      fetchTasks();
    }
  };

  const handleHideTask = (taskId: string) => {
    setHiddenTaskIds(prev => {
      const next = [...prev, taskId];
      localStorage.setItem('ams_hidden_task_ids', JSON.stringify(next));
      return next;
    });
  };

  // 6. Add Makeup Sessions
  const handleAddMakeups = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0 || !academyInfo?.id) return;

    try {
      const payloads = selectedStudentIds.map(studentId => {
        const student = students.find(s => s.id === studentId);
        const hour = makeupTime ? parseInt(makeupTime.split(':')[0]) : 19;
        return {
          student_id: studentId,
          student_name: student?.name || '학생',
          academy_id: academyInfo.id,
          session_date: makeupDate,
          attendance_status: `보강:${makeupTime}`,
          moved_to_hour: hour,
          status: 'none'
        };
      });

      const { error } = await supabase
        .from('ams_session_logs')
        .upsert(payloads, { onConflict: 'student_id,session_date' });

      if (error) throw error;

      setSelectedStudentIds([]);
      setMakeupSearch('');
      setMakeupGradeFilter('all');
      setMakeupDayFilter('all');
      setShowOnlyMyStudentsInMakeup(true);
      setIsMakeupModalOpen(false);
      
      // 스케줄 목록 및 상위 학생 정보 리프레시
      await fetchMakeups();
      await onRefreshStudents(false);
      alert('보강 예약이 추가되었습니다. 당일 Overview에 자동으로 반영됩니다.');
    } catch (err) {
      console.error('Error adding makeup sessions:', err);
      alert('보강 추가에 실패했습니다.');
    }
  };

  // 7. Change Makeup Attendance Status (완료 처리)
  const handleMakeupAttendance = async (logId: string, studentId: string, date: string, status: string) => {
    try {
      // 로컬 즉시 반영 (낙관적 업데이트)
      setMakeups(prev => prev.map(m => m.id === logId ? { ...m, attendance_status: status } : m));

      const { error } = await supabase
        .from('ams_session_logs')
        .update({ attendance_status: status })
        .eq('id', logId);

      if (error) throw error;

      await onRefreshStudents(false);
      fetchMakeups();
    } catch (err) {
      console.error('Error updating makeup attendance:', err);
      fetchMakeups();
    }
  };

  // 8. Delete Makeup Session
  const handleDeleteMakeup = async (logId: string) => {
    if (!confirm('이 보강 스케줄 예약을 취소하시겠습니까?')) return;
    try {
      setMakeups(prev => prev.filter(m => m.id !== logId));
      const { error } = await supabase
        .from('ams_session_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      await onRefreshStudents(false);
      fetchMakeups();
    } catch (err) {
      console.error('Error deleting makeup:', err);
      fetchMakeups();
    }
  };

  const handleDeleteGroupMakeups = async (makeupsInGroup: any[]) => {
    if (makeupsInGroup.length === 0) return;
    const count = makeupsInGroup.length;
    if (!confirm(`이 시간대의 보강 예약(${count}명)을 모두 취소하시겠습니까?`)) return;

    try {
      const idsToDelete = makeupsInGroup.map(m => m.id);
      setMakeups(prev => prev.filter(m => !idsToDelete.includes(m.id)));

      const { error } = await supabase
        .from('ams_session_logs')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      await onRefreshStudents(false);
      fetchMakeups();
    } catch (err) {
      console.error('Error deleting group makeups:', err);
      fetchMakeups();
    }
  };

  // --- Filtering & Memos ---
  const visibleTasks = useMemo(() => {
    let list = tasks.filter(task => {
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
    return students
      .filter(s => {
        if (s.is_deleted) return false;

        // 내 학생만 보기 필터링 (활성화된 경우)
        if (showOnlyMyStudentsInMakeup && currentUser?.id) {
          if (s.teacher_id !== currentUser.id) return false;
        }

        // 1. 학년 필터링
        if (makeupGradeFilter !== 'all') {
          const gradeStr = s.grade || '';
          if (!gradeStr.includes(makeupGradeFilter)) return false;
        }

        // 2. 요일 필터링
        if (makeupDayFilter !== 'all') {
          const days = s.class_days || [];
          if (!days.includes(makeupDayFilter)) return false;
        }

        // 3. 텍스트 검색어 필터링 (이름, 학년, 요일, 반 이름 복합 매칭)
        if (makeupSearch.trim()) {
          const query = makeupSearch.toLowerCase().replace(/\s+/g, '');
          
          const nameMatch = s.name.toLowerCase().replace(/\s+/g, '').includes(query);
          const gradeMatch = s.grade ? s.grade.toLowerCase().replace(/\s+/g, '').includes(query) : false;
          const classMatch = s.class ? s.class.toLowerCase().replace(/\s+/g, '').includes(query) : false;
          
          const daysMap: { [key: string]: string } = {
            '월요일': '월', '화요일': '화', '수요일': '수', '목요일': '목',
            '금요일': '금', '토요일': '토', '일요일': '일'
          };
          const cleanQuery = daysMap[query] || query;
          const dayMatch = s.class_days ? s.class_days.some((d: string) => d.toLowerCase().includes(cleanQuery)) : false;

          if (!(nameMatch || gradeMatch || classMatch || dayMatch)) return false;
        }

        return true;
      })
      .slice(0, 30);
  }, [students, makeupSearch, makeupGradeFilter, makeupDayFilter, showOnlyMyStudentsInMakeup, currentUser]);

  const getMakeupTimeKey = useCallback((makeup: any) => {
    // 1. 시간이동 정보(moved_to_hour) 최우선 적용
    if (makeup.moved_to_hour !== undefined && makeup.moved_to_hour !== null) {
      return `${String(makeup.moved_to_hour).padStart(2, '0')}:00`;
    }
    // 2. 예약 상태(attendance_status) 파싱
    const status = makeup.attendance_status || '';
    if (status.includes(':')) {
      const parts = status.split(':');
      return `${parts[1]}:${parts[2] || '00'}`;
    }
    return '시간 미지정';
  }, []);

  const groupedMakeups = useMemo(() => {
    const groups: Record<string, {
      date: string;
      time: string;
      items: any[];
    }> = {};

    makeups.forEach(makeup => {
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
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });
  }, [makeups, getMakeupTimeKey]);

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
    const target = new Date(targetDateStr);
    const today = new Date(getTodayStr());
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'D-Day';
    if (diffDays < 0) return `지남 (${Math.abs(diffDays)}일)`;
    return `D-${diffDays}`;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#050505] p-6 space-y-6">
      
      {/* 1. Header & Tab Switches */}
      <div className="flex items-center justify-between shrink-0 bg-black/40 border border-white/10 rounded-xl p-4 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">업무 및 보강 관리</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Teacher Workboard & Makeup Scheduler</p>
          </div>
        </div>

        <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-lg">
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${activeTab === 'tasks' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`}
          >
            <Sparkles size={14} /> 강사 업무 보드
          </button>
          <button 
            onClick={() => setActiveTab('makeups')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${activeTab === 'makeups' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-white'}`}
          >
            <CalendarRange size={14} /> 보강 스케줄러
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
                    const isOverdue = new Date(task.target_date) < new Date(getTodayStr()) && !task.is_completed;
                    
                    return (
                      <motion.div 
                        key={task.id}
                        layout
                        className={`group relative flex flex-col justify-between border rounded-xl p-4 bg-[#0a0a0a] transition-all ${task.is_completed ? 'border-emerald-500/20 opacity-60' : (isOverdue ? 'border-rose-500/30' : 'border-white/10 hover:border-white/20')}`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-black leading-tight ${task.is_completed ? 'text-gray-500 line-through' : 'text-white'}`}>{task.title}</h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={() => handleToggleTask(task.id, task.is_completed)}
                                className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${task.is_completed ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-white/20 hover:border-blue-500 hover:text-blue-500'}`}
                                title="완료 처리"
                              >
                                <Check size={10} strokeWidth={4} />
                              </button>

                              {/* 원장 화면 숨기기 버튼 */}
                              {task.title?.startsWith('[건의]') && (currentUser?.role === 'admin' || currentUser?.role === 'master') && (
                                <button 
                                  onClick={() => handleHideTask(task.id)}
                                  className="w-5 h-5 rounded-full flex items-center justify-center border border-white/10 text-gray-500 hover:border-amber-500 hover:text-amber-500 transition-all opacity-0 group-hover:opacity-100"
                                  title="내 화면에서 숨기기"
                                >
                                  <EyeOff size={10} />
                                </button>
                              )}

                              <button 
                                onClick={() => handleDeleteTask(task.id)}
                                className="w-5 h-5 rounded-full flex items-center justify-center border border-white/10 text-gray-500 hover:border-rose-500 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                title="완전 삭제"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                          <p className={`text-xs leading-relaxed ${task.is_completed ? 'text-gray-600' : 'text-gray-400'}`}>{task.content || '세부 설명이 없습니다.'}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-bold">
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <User size={12} />
                            <span>{assignee?.nickname || assignee?.name || '지정되지 않음'}</span>
                          </div>
                          
                          <div className={`px-2 py-0.5 rounded-[4px] uppercase font-black ${task.is_completed ? 'bg-emerald-500/10 text-emerald-400' : (isOverdue ? 'bg-rose-500/10 text-rose-400 animate-pulse' : 'bg-blue-500/10 text-blue-400')}`}>
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
              <div className="flex items-center justify-between shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">다가오는 보강 스케줄 ({makeups.length}개)</span>
                <button 
                  onClick={() => setIsMakeupModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-black hover:bg-blue-500 transition-all shadow-md shadow-blue-600/10"
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
                        className="group relative flex flex-col justify-between border border-white/10 rounded-xl p-4 bg-[#0a0a0a] transition-all hover:border-white/20"
                      >
                        <div className="space-y-3">
                          {/* 카드 헤더: 날짜와 시간 */}
                          <div className="flex items-center justify-between pb-2 border-b border-white/5 gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Calendar size={13} className="text-blue-400 shrink-0" />
                              <span className="text-xs font-black text-white truncate">{formattedDate}</span>
                              {isToday && <span className="text-blue-500 font-black text-[9px] shrink-0">(오늘)</span>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1 text-gray-400 text-[11px] font-bold">
                                <Clock size={11} className="text-gray-500" />
                                <span>{group.time} ({group.items.length}명)</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => handleDeleteGroupMakeups(group.items)}
                                className="text-[8.5px] font-black px-1.5 py-0.5 border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500 text-rose-400 hover:text-white rounded transition-all"
                              >
                                전체 취소
                              </button>
                            </div>
                          </div>

                          {/* 카드 바디: 소속 학생 목록 */}
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5 custom-scrollbar-v">
                            {group.items.map((makeup) => {
                              const studentObj = students.find(s => s.id === makeup.student_id);
                              const isCompleted = makeup.attendance_status === '출석' || makeup.attendance_status === '결석';
                              
                              return (
                                <div key={makeup.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 group/row">
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="text-xs font-bold text-white truncate">{makeup.student_name}</span>
                                    <span className="text-[8.5px] font-black text-gray-500 uppercase">
                                      {studentObj?.grade || '정보없음'}
                                      {studentObj?.class_days && studentObj.class_days.length > 0 ? ` · ${studentObj.class_days.join('')}` : ''}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isCompleted ? (
                                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                                        makeup.attendance_status === '출석'
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                      }`}>
                                        {makeup.attendance_status}
                                      </span>
                                    ) : (
                                      <div className="flex gap-1">
                                        <button 
                                          onClick={() => handleMakeupAttendance(makeup.id, makeup.student_id, makeup.session_date, '출석')}
                                          className="text-[8px] font-black px-1.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-400 rounded transition-all"
                                        >
                                          출석
                                        </button>
                                        <button 
                                          onClick={() => handleMakeupAttendance(makeup.id, makeup.student_id, makeup.session_date, '결석')}
                                          className="text-[8px] font-black px-1.5 py-0.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-rose-400 rounded transition-all"
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
              className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
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
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">마감 기한</label>
                    <input 
                      type="date" 
                      value={taskTargetDate}
                      onChange={(e) => setTaskTargetDate(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all [color-scheme:dark]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">담당 강사</label>
                    <select 
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all select-none"
                    >
                      <option value="" disabled>강사 선택</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id} className="bg-black text-white">{t.nickname || t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setIsTaskModalOpen(false)}
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

        {/* MODAL 2: Makeup Session Add Modal */}
        {isMakeupModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">보강 일정 예약</h3>
                <button onClick={() => setIsMakeupModalOpen(false)} className="text-gray-500 hover:text-white transition-all"><X size={16} /></button>
              </div>

              <form onSubmit={handleAddMakeups} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">보강 날짜</label>
                    <input 
                      type="date" 
                      value={makeupDate}
                      onChange={(e) => setMakeupDate(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all [color-scheme:dark]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">보강 시간</label>
                    <input 
                      type="time"
                      value={makeupTime}
                      onChange={(e) => setMakeupTime(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">보강 대상 학생 검색 및 필터</label>
                  
                  {/* 학년/요일 필터 셀렉트 박스 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest">학년 필터</label>
                      <select 
                        value={makeupGradeFilter}
                        onChange={(e) => setMakeupGradeFilter(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
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
                      <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest">요일 필터</label>
                      <select 
                        value={makeupDayFilter}
                        onChange={(e) => setMakeupDayFilter(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
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

                  {/* 원장용 내 학생만 보기 체크박스 */}
                  {(currentUser?.role === 'admin' || currentUser?.role === 'master') && (
                    <div className="flex justify-end px-1 pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={showOnlyMyStudentsInMakeup}
                          onChange={(e) => setShowOnlyMyStudentsInMakeup(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
                        />
                        <span className="text-[10px] font-black text-gray-400 hover:text-white transition-all uppercase tracking-wider">내 담당 학생만 보기</span>
                      </label>
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-600" size={14} />
                    <input 
                      type="text" 
                      value={makeupSearch}
                      onChange={(e) => setMakeupSearch(e.target.value)}
                      placeholder="이름, 학년, 요일, 반 이름으로 검색..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
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
                            className="text-[9px] font-black text-blue-400 hover:text-blue-300 transition-all uppercase tracking-wider"
                          >
                            {isAllFilteredSelected ? '전체 해제' : '검색 결과 전체 선택'}
                          </button>
                        )}
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-white/10 rounded-lg p-1 bg-black/60 space-y-0.5 custom-scrollbar-v">
                        {filteredStudents.map(s => {
                          const isSelected = selectedStudentIds.includes(s.id);
                          return (
                            <div 
                              key={s.id}
                              onClick={() => {
                                setSelectedStudentIds(prev => isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id]);
                              }}
                              className={`flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer text-xs font-bold transition-all ${isSelected ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                            >
                              <span>{s.name} ({s.grade || '학년미정'} | {s.class_days && s.class_days.length > 0 ? s.class_days.join('') : '요일미정'})</span>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 bg-blue-600 text-white' : 'border-white/20'}`}>
                                {isSelected && <Check size={10} strokeWidth={4} />}
                              </div>
                            </div>
                          );
                        })}
                        {filteredStudents.length === 0 && (
                          <div className="p-3 text-center text-xs text-gray-600">조건에 부합하는 학생이 없습니다.</div>
                        )}
                      </div>
                    </div>

                  {/* Selected Students Chips */}
                  {selectedStudentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {selectedStudentIds.map(id => {
                        const s = students.find(st => st.id === id);
                        return (
                          <div key={id} className="flex items-center gap-1.5 bg-blue-600/10 border border-blue-500/20 px-2 py-1 rounded text-[10px] font-black text-blue-400">
                            <span>{s?.name}</span>
                            <button 
                              type="button" 
                              onClick={() => setSelectedStudentIds(prev => prev.filter(item => item !== id))}
                              className="text-blue-500 hover:text-blue-300 transition-colors"
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
                      setSelectedStudentIds([]);
                      setMakeupSearch('');
                      setMakeupGradeFilter('all');
                      setMakeupDayFilter('all');
                      setShowOnlyMyStudentsInMakeup(true);
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    disabled={selectedStudentIds.length === 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-lg text-xs font-black transition-all"
                  >
                    보강 추가
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
