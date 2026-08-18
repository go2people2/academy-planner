import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getTodayStr } from '@/lib/utils';
import { Student, Teacher } from '@/types/dashboard';

export interface TeacherTaskItem {
  id: string;
  academy_id: string;
  title: string;
  content: string;
  start_date: string;
  target_date: string;
  display_period_type: 'custom' | 'weekly' | 'monthly';
  is_completed: boolean;
  created_by: string;
  created_at: string;
  type?: string;
}

export const buildMakeupPayload = (params: {
  studentId: string;
  studentName?: string;
  academyId: string;
  makeupDate: string;
  makeupTime: string;
  makeupEndTime: string;
  makeupType: string;
  makeupReason?: string;
  courseName?: string;
}) => {
  const { studentId, studentName, academyId, makeupDate, makeupTime, makeupEndTime, makeupType, makeupReason, courseName = '정규' } = params;
  const hour = makeupTime ? parseInt(makeupTime.split(':')[0]) : 19;
  const noteText = makeupReason && makeupReason.trim() ? `[${makeupType}] (${makeupReason.trim()})` : `[${makeupType}]`;

  return {
    student_id: studentId,
    student_name: studentName || '학생',
    academy_id: academyId,
    session_date: makeupDate,
    attendance_status: `보강:${makeupTime}~${makeupEndTime}`,
    attendance_reason: '보강 수업',
    moved_to_hour: hour,
    status: 'none',
    completed_classwork_text: noteText,
    course_name: courseName
  };
};

export interface UseTeacherTasksProps {
  academyInfo: any;
  students: Student[];
  teachers: Teacher[];
  currentUser: any;
  onRefreshStudents?: (showLoader?: boolean) => Promise<void>;
}

export function useTeacherTasks({
  academyInfo,
  students,
  teachers,
  currentUser,
  onRefreshStudents,
}: UseTeacherTasksProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'makeups' | 'suggestions' | 'surveys' | 'links'>('makeups');
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
  const [editMakeupGroup, setEditMakeupGroup] = useState<any | null>(null);
  const [makeupDate, setMakeupDate] = useState(getTodayStr());
  const [makeupTime, setMakeupTime] = useState<string>('19:00');
  const [makeupEndTime, setMakeupEndTime] = useState<string>('22:00');
  const [makeupType, setMakeupType] = useState<string>('결석 보강');
  const [makeupReason, setMakeupReason] = useState<string>('');
  const [makeupSearch, setMakeupSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [makeupGradeFilter, setMakeupGradeFilter] = useState<string>('all');
  const [makeupDayFilter, setMakeupDayFilter] = useState<string>('all');
  const [showOnlyMyStudentsInMakeup, setShowOnlyMyStudentsInMakeup] = useState<boolean>(true);
  const [courseFilterMode, setCourseFilterMode] = useState<'all' | 'regularOnly' | 'electiveOnly'>('all');

  const [makeupCardSearch, setMakeupCardSearch] = useState<string>('');
  const [makeupCardPeriod, setMakeupCardPeriod] = useState<'today' | 'month' | 'all' | 'custom'>('today');
  const [makeupCardStartDate, setMakeupCardStartDate] = useState<string>(getTodayStr());
  const [makeupCardEndDate, setMakeupCardEndDate] = useState<string>(getTodayStr());

  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editingMemoText, setEditingMemoText] = useState<string>('');

  const getMonthlyMakeupCount = useCallback((studentId: string, sessionDate: string, makeupId?: string) => {
    if (!studentId || !sessionDate) return 1;
    const monthKey = sessionDate.slice(0, 7);
    const studentMonthMakeups = makeups
      .filter(m => m.student_id === studentId && m.session_date && m.session_date.startsWith(monthKey))
      .sort((a, b) => a.session_date.localeCompare(b.session_date) || (a.created_at || '').localeCompare(b.created_at || ''));

    const index = studentMonthMakeups.findIndex(m => m.id === makeupId || m.session_date === sessionDate);
    return index >= 0 ? index + 1 : 1;
  }, [makeups]);

  const handleSaveMemo = async (makeupId: string) => {
    try {
      setMakeups(prev => prev.map(m => m.id === makeupId ? { ...m, attendance_reason: editingMemoText } : m));
      setEditingMemoId(null);

      const { error } = await supabase
        .from('ams_session_logs')
        .update({ attendance_reason: editingMemoText })
        .eq('id', makeupId);

      if (error) throw error;
      if (onRefreshStudents) onRefreshStudents(false);
    } catch (err) {
      console.error('Error saving memo:', err);
      alert('메모 저장 중 오류가 발생했습니다.');
      fetchMakeups();
    }
  };

  const fetchTasks = useCallback(async () => {
    if (!academyInfo?.id) return;
    setIsTaskLoading(true);
    try {
      const { data, error } = await supabase
        .from('ams_tasks')
        .select('*')
        .eq('academy_id', academyInfo.id)
        .or('type.is.null,type.in.(manual,link)')
        .order('target_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setIsTaskLoading(false);
    }
  }, [academyInfo?.id]);

  const fetchMakeups = useCallback(async () => {
    if (!academyInfo?.id) return;
    setIsMakeupLoading(true);
    try {
      const { data, error } = await supabase
        .from('ams_session_logs')
        .select('*')
        .eq('academy_id', academyInfo.id)
        .or('attendance_status.ilike.보강%,special_notes.ilike.%보강%,attendance_reason.ilike.%보강%')
        .order('session_date', { ascending: false });

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

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
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

  const handleAddMakeups = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academyInfo?.id) return;

    if (editMakeupGroup) {
      try {
        const hour = makeupTime ? parseInt(makeupTime.split(':')[0]) : 19;

        const updatePromises = editMakeupGroup.items.map((item: any) => {
          const newNotes = makeupReason && makeupReason.trim() ? `[${makeupType}] (${makeupReason.trim()})` : `[${makeupType}]`;

          return supabase
            .from('ams_session_logs')
            .update({
              session_date: makeupDate,
              attendance_status: `보강:${makeupTime}~${makeupEndTime}`,
              attendance_reason: '보강 수업',
              moved_to_hour: hour,
              completed_classwork_text: newNotes
            })
            .eq('id', item.id);
        });

        let insertPromise: Promise<void> = Promise.resolve();
        if (selectedStudentIds.length > 0) {
          const payloads = selectedStudentIds.map(studentId => {
            const student = students.find(s => s.id === studentId);
            return buildMakeupPayload({
              studentId,
              studentName: student?.name,
              academyId: academyInfo.id,
              makeupDate,
              makeupTime,
              makeupEndTime,
              makeupType,
              courseName: '정규'
            });
          });

          insertPromise = (async () => {
            const { error } = await supabase
              .from('ams_session_logs')
              .upsert(payloads, { onConflict: 'student_id,session_date,course_name,moved_to_hour' });
            if (error) throw error;
          })();
        }

        await Promise.all([...updatePromises, insertPromise]);

        setIsMakeupModalOpen(false);
        setEditMakeupGroup(null);
        setSelectedStudentIds([]);
        setMakeupSearch('');
        setMakeupType('결석 보강');
        setMakeupEndTime('21:00');
        
        await fetchMakeups();
        if (onRefreshStudents) await onRefreshStudents(false);
        alert('보강 정보가 일괄 수정되었습니다.');
      } catch (err) {
        console.error('Error updating group makeup sessions:', err);
        alert('보강 수정에 실패했습니다.');
      }
    } else {
      if (selectedStudentIds.length === 0) return;
      try {
        const payloads = selectedStudentIds.map(itemKey => {
          let realStudentId = itemKey;
          let courseName = '정규';

          if (itemKey.includes('_special_')) {
            const parts = itemKey.split('_special_');
            realStudentId = parts[0];
            let rawCourse = parts.slice(1).join('_special_');
            rawCourse = rawCourse.replace(/_\d+$/, '').trim();

            const student = students.find(s => s.id === realStudentId || s.originalId === realStudentId);
            let matchedSubject = (student as any)?.courseName || (student as any)?.electiveCourse?.subject;

            if (!matchedSubject && student?.book_courses?.['__elective_courses']) {
              try {
                const parsed = typeof student.book_courses['__elective_courses'] === 'string'
                  ? JSON.parse(student.book_courses['__elective_courses'])
                  : student.book_courses['__elective_courses'];
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const match = parsed.find((c: any) => c?.subject && (rawCourse.includes(c.subject) || c.subject.includes(rawCourse)));
                  if (match) matchedSubject = match.subject;
                  else if (parsed[0]?.subject) matchedSubject = parsed[0].subject;
                }
              } catch (e) {}
            }

            courseName = matchedSubject || (rawCourse && rawCourse !== 'undefined' ? rawCourse : '특강');
          }

          const student = students.find(s => s.id === realStudentId || s.originalId === realStudentId);
          return buildMakeupPayload({
            studentId: realStudentId,
            studentName: student?.name,
            academyId: academyInfo.id,
            makeupDate,
            makeupTime,
            makeupEndTime,
            makeupType,
            makeupReason,
            courseName
          });
        });

        const { error } = await supabase
          .from('ams_session_logs')
          .upsert(payloads, { onConflict: 'student_id,session_date,course_name,moved_to_hour' });

        if (error) throw error;

        setSelectedStudentIds([]);
        setMakeupSearch('');
        setMakeupGradeFilter('all');
        setMakeupDayFilter('all');
        setMakeupType('결석 보강');
        setMakeupReason('');
        setMakeupEndTime('21:00');
        setShowOnlyMyStudentsInMakeup(true);
        setIsMakeupModalOpen(false);
        
        await fetchMakeups();
        if (onRefreshStudents) await onRefreshStudents(true);
        alert('보강 예약이 추가되었습니다. 당일 Overview에 자동으로 반영됩니다.');
      } catch (err) {
        console.error('Error adding makeup sessions:', err);
        alert('보강 추가에 실패했습니다.');
      }
    }
  };

  const handleOpenEditMakeupModal = (group: any) => {
    setEditMakeupGroup(group);
    setMakeupDate(group.session_date);
    setMakeupTime(group.time);
    setMakeupEndTime(group.endTime);
    setMakeupType(group.type);

    let pureReason = '';
    if (group.notes && group.notes.includes('(') && group.notes.includes(')')) {
      pureReason = group.notes.substring(group.notes.indexOf('(') + 1, group.notes.lastIndexOf(')')).trim();
    }
    setMakeupReason(pureReason);
    setSelectedStudentIds([]);
    setIsMakeupModalOpen(true);
  };

  const handleDeleteMakeupGroup = async (group: any) => {
    if (!confirm(`[${group.session_date} ${group.time}] 보강 일정에 포함된 원생 ${group.items.length}명의 보강 예약을 정말 삭제하시겠습니까?`)) return;

    try {
      const idsToDelete = group.items.map((item: any) => item.id);
      const { error } = await supabase
        .from('ams_session_logs')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      await fetchMakeups();
      if (onRefreshStudents) await onRefreshStudents(false);
      alert('해당 보강 일정이 정상적으로 삭제되었습니다.');
    } catch (err) {
      console.error('Error deleting makeup group:', err);
      alert('보강 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleOpenEditGroupMakeup = useCallback((group: any) => {
    setEditMakeupGroup(group);
    setMakeupDate(group.date);
    
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
    setMakeupEndTime(endTime || `${String(parseInt(startTime.split(':')[0]) + 3).padStart(2, '0')}:00`);

    const firstItem = group.items[0];
    const notes = firstItem?.completed_classwork_text || firstItem?.special_notes || '';
    const typeMatch = notes.match(/^\[(.*?)\]/);
    const type = typeMatch ? typeMatch[1] : '진도 보강';
    const reasonMatch = notes.match(/\((.*?)\)/);
    const reason = reasonMatch ? reasonMatch[1] : '';

    setMakeupType(type);
    setMakeupReason(reason);
    setIsMakeupModalOpen(true);
  }, []);

  const handleMakeupAttendance = useCallback(async (logId: string, studentId: string, date: string, status: string) => {
    try {
      setMakeups(prev => prev.map(m => m.id === logId ? { ...m, attendance_status: status } : m));

      const { error } = await supabase
        .from('ams_session_logs')
        .update({ 
          attendance_status: status,
          attendance_reason: '보강 수업'
        })
        .eq('id', logId);

      if (error) throw error;

      if (onRefreshStudents) await onRefreshStudents(false);
      fetchMakeups();
    } catch (err) {
      console.error('Error updating makeup attendance:', err);
      fetchMakeups();
    }
  }, [fetchMakeups, onRefreshStudents]);

  const handleDeleteMakeup = useCallback(async (logId: string) => {
    if (!confirm('이 보강 스케줄 예약을 취소하시겠습니까?')) return;
    try {
      setMakeups(prev => prev.filter(m => m.id !== logId));

      await supabase
        .from('ams_session_logs')
        .update({ 
          attendance_status: 'BEFORE', 
          attendance_reason: null
        })
        .eq('id', logId);

      const { error } = await supabase
        .from('ams_session_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      if (onRefreshStudents) await onRefreshStudents(true);
      fetchMakeups();
    } catch (err) {
      console.error('Error deleting makeup:', err);
      fetchMakeups();
    }
  }, [fetchMakeups, onRefreshStudents]);

  const handleDeleteGroupMakeups = useCallback(async (makeupsInGroup: any[]) => {
    if (makeupsInGroup.length === 0) return;
    const count = makeupsInGroup.length;
    if (!confirm(`이 시간대의 보강 예약(${count}명)을 모두 취소하시겠습니까?`)) return;

    try {
      const idsToDelete = makeupsInGroup.map(m => m.id);
      setMakeups(prev => prev.filter(m => !idsToDelete.includes(m.id)));

      await supabase
        .from('ams_session_logs')
        .update({ 
          attendance_status: 'BEFORE', 
          attendance_reason: null
        })
        .in('id', idsToDelete);

      const { error } = await supabase
        .from('ams_session_logs')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      if (onRefreshStudents) await onRefreshStudents(true);
      fetchMakeups();
    } catch (err) {
      console.error('Error deleting group makeups:', err);
      fetchMakeups();
    }
  }, [fetchMakeups, onRefreshStudents]);

  const handleDeleteSingleMakeup = async (makeupId: string, studentName: string) => {
    if (!confirm(`[${studentName}] 학생의 보강 예약을 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('ams_session_logs')
        .delete()
        .eq('id', makeupId);

      if (error) throw error;

      await fetchMakeups();
      if (onRefreshStudents) await onRefreshStudents(false);
    } catch (err) {
      console.error('Error deleting single makeup:', err);
      alert('보강 삭제 중 오류가 발생했습니다.');
    }
  };

  return {
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
    handleOpenEditMakeupModal,
    handleOpenEditGroupMakeup,
    handleMakeupAttendance,
    handleDeleteMakeup,
    handleDeleteGroupMakeups,
    handleDeleteMakeupGroup,
    handleDeleteSingleMakeup,
  };
}
