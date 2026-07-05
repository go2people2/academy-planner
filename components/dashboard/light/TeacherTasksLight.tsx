'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Calendar, Plus, Check, Trash2, Clock, 
  User, CheckCircle, AlertCircle, Search, Sparkles, Loader2, CalendarRange, X, EyeOff, ExternalLink,
  Edit
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getTodayStr } from '@/lib/utils';
import { SessionLog, Student, Teacher } from '@/types/dashboard';
import TaskLinksTab from './TaskLinksTabLight';

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
  type?: string; // 💡 링크/일반 업무 구분용 타입 추가
}

export default function TeacherTasks({
  academyInfo,
  students,
  teachers,
  currentUser,
  onRefreshStudents
}: TeacherTasksProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'makeups' | 'links'>('tasks');
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
  const [isPermanentTask, setIsPermanentTask] = useState(false);

  // --- Makeup Form States ---
  const [isMakeupModalOpen, setIsMakeupModalOpen] = useState(false);
  const [editMakeupGroup, setEditMakeupGroup] = useState<any | null>(null); // 카드(그룹) 단위 수정용 state로 변경
  const [makeupDate, setMakeupDate] = useState(getTodayStr());
  const [makeupTime, setMakeupTime] = useState<string>('19:00'); // 디폴트 19:00
  const [makeupEndTime, setMakeupEndTime] = useState<string>('21:00'); // 보강 종료 시간
  const [makeupType, setMakeupType] = useState<string>('진도 보강'); // 보강 유형
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
        .or('type.is.null,type.in.(manual,link)') // 💡 설문(survey) 제외, 업무 및 링크 보드용 데이터만 가져옴
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
      setTaskAssignee(currentUser?.id || '');
      setIsPermanentTask(false);
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

  // 6. Add or Edit Makeup Sessions
  const handleAddMakeups = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academyInfo?.id) return;

    if (editMakeupGroup) {
      // 💡 [수정 모드 - 그룹 카드 단위 일괄 수정]
      try {
        const hour = makeupTime ? parseInt(makeupTime.split(':')[0]) : 19;
        
        // 1. 그룹에 포함된 기존 학생의 세션 로그를 일괄 업데이트합니다.
        const updatePromises = editMakeupGroup.items.map((item: any) => {
          const currentNotes = item.special_notes || '';
          const pureNotes = currentNotes.startsWith('[') && currentNotes.includes(']')
            ? currentNotes.slice(currentNotes.indexOf(']') + 1).trim()
            : currentNotes;
          const newNotes = `[${makeupType}] ${pureNotes}`.trim();

          return supabase
            .from('ams_session_logs')
            .update({
              session_date: makeupDate,
              attendance_status: `보강:${makeupTime}~${makeupEndTime}`,
              moved_to_hour: hour,
              special_notes: newNotes
            })
            .eq('id', item.id);
        });

        // 2. 추가 선택된 새로운 학생이 있을 경우 신규 예약 추가 쿼리
        let insertPromise: Promise<void> = Promise.resolve();
        if (selectedStudentIds.length > 0) {
          const payloads = selectedStudentIds.map(studentId => {
            const student = students.find(s => s.id === studentId);
            return {
              student_id: studentId,
              student_name: student?.name || '학생',
              academy_id: academyInfo.id,
              session_date: makeupDate,
              attendance_status: `보강:${makeupTime}~${makeupEndTime}`,
              moved_to_hour: hour,
              status: 'none',
              special_notes: `[${makeupType}]`
            };
          });

          insertPromise = (async () => {
            const { error } = await supabase
              .from('ams_session_logs')
              .upsert(payloads, { onConflict: 'student_id,session_date' });
            if (error) throw error;
          })();
        }

        await Promise.all([...updatePromises, insertPromise]);

        setIsMakeupModalOpen(false);
        setEditMakeupGroup(null);
        setSelectedStudentIds([]);
        setMakeupSearch('');
        setMakeupType('진도 보강');
        setMakeupEndTime('21:00');
        
        await fetchMakeups();
        await onRefreshStudents(false);
        alert('보강 정보가 일괄 수정되었습니다.');
      } catch (err) {
        console.error('Error updating group makeup sessions:', err);
        alert('보강 수정에 실패했습니다.');
      }
    } else {
      // 💡 [신규 등록 모드]
      if (selectedStudentIds.length === 0) return;
      try {
        const payloads = selectedStudentIds.map(studentId => {
          const student = students.find(s => s.id === studentId);
          const hour = makeupTime ? parseInt(makeupTime.split(':')[0]) : 19;
          return {
            student_id: studentId,
            student_name: student?.name || '학생',
            academy_id: academyInfo.id,
            session_date: makeupDate,
            attendance_status: `보강:${makeupTime}~${makeupEndTime}`,
            moved_to_hour: hour,
            status: 'none',
            special_notes: `[${makeupType}]`
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
        setMakeupType('진도 보강');
        setMakeupEndTime('21:00');
        setShowOnlyMyStudentsInMakeup(true);
        setIsMakeupModalOpen(false);
        
        await fetchMakeups();
        await onRefreshStudents(false);
        alert('보강 예약이 추가되었습니다. 당일 Overview에 자동으로 반영됩니다.');
      } catch (err) {
        console.error('Error adding makeup sessions:', err);
        alert('보강 추가에 실패했습니다.');
      }
    }
  };

  // 6.5 보강 그룹 수정 모달 트리거
  const handleOpenEditGroupMakeup = (group: any) => {
    setEditMakeupGroup(group);
    setMakeupDate(group.date);
    
    // 시간 정보 파싱 ("19:00~21:00" -> 시작 19:00, 종료 21:00)
    const timeRange = group.time;
    let startTime = '19:00';
    let endTime = '21:00';
    if (timeRange.includes('~')) {
      const parts = timeRange.split('~');
      startTime = parts[0];
      endTime = parts[1];
    } else {
      startTime = timeRange;
      endTime = '';
    }
    setMakeupTime(startTime);
    setMakeupEndTime(endTime || `${String(parseInt(startTime.split(':')[0]) + 2).padStart(2, '0')}:00`);

    // 보강 유형 파싱 (첫 번째 아이템의 특이사항 기준)
    const firstItem = group.items[0];
    const notes = firstItem?.special_notes || '';
    const typeMatch = notes.match(/^\[(.*?)\]/);
    const type = typeMatch ? typeMatch[1] : '진도 보강';
    setMakeupType(type);

    setIsMakeupModalOpen(true);
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
    // 1. 예약 상태(attendance_status)에서 보강 시간 영역 전체 파싱 (시작~종료 포함)
    const status = makeup.attendance_status || '';
    if (status.startsWith('보강:')) {
      return status.replace('보강:', '');
    }
    // 2. 시간이동 정보(moved_to_hour) 최우선 적용
    if (makeup.moved_to_hour !== undefined && makeup.moved_to_hour !== null) {
      return `${String(makeup.moved_to_hour).padStart(2, '0')}:00`;
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
    <div className="h-full flex flex-col overflow-hidden bg-[#f4f4f5] p-6 space-y-6">
      
      {/* 1. Header & Tab Switches */}
      <div className="flex items-center justify-between shrink-0 bg-white border border-[#e3e2e0] rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-200">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-[#37352f]">업무 및 보강 관리</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Teacher Workboard & Makeup Scheduler</p>
          </div>
        </div>

        <div className="flex bg-[#f7f7f5] border border-[#e3e2e0] p-0.5 rounded-lg">
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${activeTab === 'tasks' ? 'bg-blue-600 text-white shadow-sm' : 'text-[#37352f]/50 hover:text-[#37352f]'}`}
          >
            <Sparkles size={14} /> 강사 업무 보드
          </button>
          <button 
            onClick={() => setActiveTab('makeups')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${activeTab === 'makeups' ? 'bg-blue-600 text-white shadow-sm' : 'text-[#37352f]/50 hover:text-[#37352f]'}`}
          >
            <CalendarRange size={14} /> 보강 스케줄러
          </button>
          <button 
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${activeTab === 'links' ? 'bg-blue-600 text-white shadow-sm' : 'text-[#37352f]/50 hover:text-[#37352f]'}`}
          >
            <ExternalLink size={14} /> 업무 링크
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
                      className="w-3.5 h-3.5 rounded border border-gray-300 bg-white text-blue-650 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-650"
                    />
                    <span className="text-[10px] font-black text-gray-600 hover:text-[#37352f] transition-all uppercase tracking-wider">내 담당 업무만 보기</span>
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
                      className="text-[9px] font-black text-amber-700 hover:text-amber-800 bg-amber-50 px-2.5 py-1 rounded-[6px] border border-amber-200 transition-all uppercase tracking-wider shadow-sm"
                    >
                      숨김 해제 ({hiddenTaskIds.length})
                    </button>
                  )}
                </div>
                
                <button 
                  onClick={() => setIsTaskModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-black hover:bg-blue-700 transition-all shadow-md"
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
                        className={`group relative flex flex-col justify-between border rounded-xl p-4 bg-white transition-all shadow-[0_1px_4px_rgba(15,15,15,0.08)] ${task.is_completed ? 'border-emerald-300 opacity-60 bg-gray-50/50' : (isOverdue ? 'border-rose-300 bg-rose-50/20' : 'border-[#e3e2e0] hover:border-blue-300')}`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-black leading-tight ${task.is_completed ? 'text-gray-400 line-through' : 'text-[#37352f]'}`}>{task.title}</h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={() => handleToggleTask(task.id, task.is_completed)}
                                className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${task.is_completed ? 'bg-emerald-50 border-emerald-350 text-emerald-600' : 'border-gray-300 hover:border-blue-500 hover:text-blue-500'}`}
                                title="완료 처리"
                              >
                                <Check size={10} strokeWidth={4} />
                              </button>

                              {/* 원장 화면 숨기기 버튼 */}
                              {task.title?.startsWith('[건의]') && (currentUser?.role === 'admin' || currentUser?.role === 'master') && (
                                <button 
                                  onClick={() => handleHideTask(task.id)}
                                  className="w-5 h-5 rounded-full flex items-center justify-center border border-gray-200 text-gray-400 hover:border-amber-500 hover:text-amber-500 transition-all opacity-0 group-hover:opacity-100"
                                  title="내 화면에서 숨기기"
                                >
                                  <EyeOff size={10} />
                                </button>
                              )}

                              <button 
                                onClick={() => handleDeleteTask(task.id)}
                                className="w-5 h-5 rounded-full flex items-center justify-center border border-gray-200 text-gray-400 hover:border-rose-500 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                title="완전 삭제"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                          <p className={`text-xs leading-relaxed ${task.is_completed ? 'text-gray-400' : 'text-[#37352f]/70'}`}>{task.content || '세부 설명이 없습니다.'}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#edece9] flex items-center justify-between text-[10px] font-bold">
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <User size={12} />
                            <span>{assignee?.nickname || assignee?.name || '지정되지 않음'}</span>
                          </div>
                          
                          <div className={`px-2 py-0.5 rounded-[4px] uppercase font-black ${
                            task.is_completed 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : isOverdue 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse' 
                                : task.target_date === '9999-12-31'
                                  ? 'bg-indigo-50 text-indigo-750 border border-indigo-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {task.is_completed ? '완료' : getDDay(task.target_date)}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {visibleTasks.length === 0 && (
                    <div className="col-span-full h-64 border border-dashed border-[#e3e2e0] rounded-xl flex flex-col items-center justify-center text-gray-400 gap-2 bg-white shadow-sm">
                      <Sparkles size={24} className="text-gray-300" />
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-black hover:bg-blue-700 transition-all shadow-md"
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
                        className="group relative flex flex-col justify-between border border-[#e3e2e0] rounded-xl p-4 bg-white transition-all shadow-[0_1px_4px_rgba(15,15,15,0.08)] hover:border-blue-300"
                      >
                        <div className="space-y-3">
                          {/* 카드 헤더: 날짜와 시간 */}
                          <div className="flex items-center justify-between pb-2 border-b border-[#edece9] gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Calendar size={13} className="text-blue-500 shrink-0" />
                              <span className="text-xs font-black text-[#37352f] truncate">{formattedDate}</span>
                              {isToday && <span className="text-blue-600 font-black text-[9px] shrink-0">(오늘)</span>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1 text-[#37352f]/70 text-[11px] font-bold">
                                <Clock size={11} className="text-gray-400" />
                                <span>{group.time} ({group.items.length}명)</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => handleOpenEditGroupMakeup(group)}
                                className="text-[8.5px] font-black px-1.5 py-0.5 border border-blue-200 bg-blue-50 hover:bg-blue-600 text-blue-650 hover:text-white rounded transition-all shadow-sm"
                              >
                                수정
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleDeleteGroupMakeups(group.items)}
                                className="text-[8.5px] font-black px-1.5 py-0.5 border border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-650 hover:text-white rounded transition-all shadow-sm"
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
                                  <div key={makeup.id} className="flex items-center justify-between py-1.5 border-b border-[#edece9] last:border-0 group/row">
                                    <div className="flex flex-col min-w-0 pr-2">
                                      <span className="text-xs font-bold text-[#37352f] truncate">{makeup.student_name}</span>
                                      <span className="text-[8.5px] font-black text-gray-400 uppercase">
                                        {studentObj?.grade || '정보없음'}
                                        {studentObj?.class_days && studentObj.class_days.length > 0 ? ` · ${[...studentObj.class_days].sort((a, b) => {
                                          const order = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                                          return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
                                        }).join('')}` : ''}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {isCompleted ? (
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                                          makeup.attendance_status === '출석'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                        }`}>
                                          {makeup.attendance_status}
                                        </span>
                                      ) : (
                                        <div className="flex gap-1">
                                          <button 
                                            onClick={() => handleMakeupAttendance(makeup.id, makeup.student_id, makeup.session_date, '출석')}
                                            className="text-[8px] font-black px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-250 text-emerald-650 rounded transition-all shadow-sm"
                                          >
                                            출석
                                          </button>
                                          <button 
                                            onClick={() => handleMakeupAttendance(makeup.id, makeup.student_id, makeup.session_date, '결석')}
                                            className="text-[8px] font-black px-1.5 py-0.5 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-250 text-rose-650 rounded transition-all shadow-sm"
                                          >
                                            결석
                                          </button>
                                        </div>
                                      )}

                                      <button 
                                        onClick={() => handleDeleteMakeup(makeup.id)}
                                        className="w-5 h-5 rounded-full flex items-center justify-center border border-gray-200 text-gray-400 hover:border-rose-500 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover/row:opacity-100"
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
                      <div className="col-span-full h-64 border border-dashed border-[#e3e2e0] rounded-xl flex flex-col items-center justify-center text-gray-400 gap-2 bg-white shadow-sm">
                        <CalendarRange size={24} className="text-gray-300" />
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
            />
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
                            isSelected ? 'bg-white text-blue-600' : 'bg-gray-200 text-gray-600'
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
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-250 text-gray-600 rounded-lg text-xs font-bold transition-all"
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black transition-all shadow-sm"
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#e3e2e0] rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#edece9]">
                <h3 className="text-sm font-black text-[#37352f] uppercase tracking-wider">
                  {editMakeupGroup ? `보강 일정 수정` : '보강 일정 예약'}
                </h3>
                <button 
                  onClick={() => {
                    setIsMakeupModalOpen(false);
                    setEditMakeupGroup(null);
                    setSelectedStudentIds([]);
                  }} 
                  className="text-gray-400 hover:text-gray-700 transition-all"
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
                      className="w-full bg-white border border-[#edece9] rounded-lg px-2 py-2 text-xs text-[#37352f] focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">시작 시간</label>
                    <input 
                      type="time"
                      value={makeupTime}
                      onChange={(e) => setMakeupTime(e.target.value)}
                      required
                      className="w-full bg-white border border-[#edece9] rounded-lg px-2 py-2 text-xs text-[#37352f] focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">종료 시간</label>
                    <input 
                      type="time"
                      value={makeupEndTime}
                      onChange={(e) => setMakeupEndTime(e.target.value)}
                      required
                      className="w-full bg-white border border-[#edece9] rounded-lg px-2 py-2 text-xs text-[#37352f] focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* 보강 구분 셀렉트 박스 */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">보강 구분</label>
                  <select 
                    value={makeupType}
                    onChange={(e) => setMakeupType(e.target.value)}
                    className="w-full bg-white border border-[#edece9] rounded-lg px-3 py-2 text-xs text-[#37352f] focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="진도 보강">진도 보강</option>
                    <option value="시험 보강">시험 보강</option>
                    <option value="결석 보강">결석 보강</option>
                    <option value="기타 보강">기타 보강</option>
                  </select>
                </div>

                {/* 수정 모드일 때 기존 학생 목록 표시 */}
                {editMakeupGroup && (
                  <div className="space-y-1 bg-gray-50 border border-[#edece9] p-4 rounded-xl">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">기존 참여 학생 ({editMakeupGroup.items.length}명)</label>
                    <div className="max-h-24 overflow-y-auto pr-1 custom-scrollbar-v flex flex-wrap gap-1.5 mt-1.5">
                      {editMakeupGroup.items.map((item: any) => (
                        <span key={item.id} className="bg-white border border-[#edece9] px-2.5 py-0.5 rounded text-[10px] font-bold text-[#37352f] shadow-sm">
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
                      <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest">학년 필터</label>
                      <select 
                        value={makeupGradeFilter}
                        onChange={(e) => setMakeupGradeFilter(e.target.value)}
                        className="w-full bg-white border border-[#edece9] rounded-lg px-2 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
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
                        className="w-full bg-white border border-[#edece9] rounded-lg px-2 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
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
                          className="w-3.5 h-3.5 rounded border border-gray-300 bg-white text-blue-650 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-650"
                        />
                        <span className="text-[10px] font-black text-gray-600 hover:text-[#37352f] transition-all uppercase tracking-wider">내 담당 학생만 보기</span>
                      </label>
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                    <input 
                      type="text" 
                      value={makeupSearch}
                      onChange={(e) => setMakeupSearch(e.target.value)}
                      placeholder="이름, 학년, 요일, 반 이름으로 검색..."
                      className="w-full bg-white border border-[#edece9] rounded-lg pl-9 pr-3 py-2 text-xs text-[#37352f] placeholder-gray-300 focus:outline-none focus:border-blue-500 transition-all"
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
                            className="text-[9px] font-black text-blue-600 hover:text-blue-700 transition-all uppercase tracking-wider"
                          >
                            {isAllFilteredSelected ? '전체 해제' : '검색 결과 전체 선택'}
                          </button>
                        )}
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-[#edece9] rounded-lg p-1 bg-white space-y-0.5 custom-scrollbar-v shadow-inner">
                        {filteredStudents.map(s => {
                          const isSelected = selectedStudentIds.includes(s.id);
                          return (
                            <div 
                              key={s.id}
                              onClick={() => {
                                setSelectedStudentIds(prev => isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id]);
                              }}
                              className={`flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer text-xs font-bold transition-all ${isSelected ? 'bg-blue-50 text-blue-650 border border-blue-200 shadow-sm' : 'hover:bg-gray-100 text-gray-650'}`}
                            >
                              <span>{s.name} ({s.grade || '학년미정'} | {s.class_days && s.class_days.length > 0 ? [...s.class_days].sort((a, b) => {
                                const order = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                                return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
                              }).join('') : '요일미정'})</span>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
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

                  {selectedStudentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {selectedStudentIds.map(id => {
                        const s = students.find(st => st.id === id);
                        return (
                          <div key={id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-[10px] font-black text-blue-650 shadow-sm">
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
                      setEditMakeupGroup(null);
                      setSelectedStudentIds([]);
                      setMakeupSearch('');
                      setMakeupGradeFilter('all');
                      setMakeupDayFilter('all');
                      setShowOnlyMyStudentsInMakeup(true);
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all"
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    disabled={!editMakeupGroup && selectedStudentIds.length === 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-lg text-xs font-black transition-all shadow-sm"
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
