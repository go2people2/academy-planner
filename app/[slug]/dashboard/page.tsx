'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// 분리된 컴포넌트 임포트
import Sidebar from '@/components/dashboard/Sidebar';
import Overview from '@/components/dashboard/Overview';
import TodaySheet from '@/components/dashboard/TodaySheet';
import ProgressSequencer from '@/components/dashboard/ProgressSequencer';
import StudentDetailDrawer from '@/components/dashboard/StudentDetailDrawer';
import StudentStudyReportDrawer from '@/components/dashboard/StudentStudyReportDrawer';
import MonthlyChanges from '@/components/dashboard/MonthlyChanges';
import SettingsView from '@/components/dashboard/SettingsView';
import NotificationsView from '@/components/dashboard/NotificationsView';

// 공통 타입 임포트
import { Student, SessionLog, StudentStatus, TextbookOption } from '@/types/dashboard';

const DAYS_KOR = ['일', '월', '화', '수', '목', '금', '토'];

export default function DashboardPage() {
  const router = useRouter();
  const { slug } = useParams();
  const [viewMode, setViewMode] = useState<'board' | 'todayTable' | 'progress' | 'studentEdit' | 'monthlyChanges' | 'settings' | 'notifications'>('board');
  const [activeProgressStudentId, setActiveProgressStudentId] = useState<string | null>(null);

  // 💡 브라우저 히스토리 및 단축키 관리
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.viewMode) {
        setViewMode(event.state.viewMode);
        if (event.state.studentId) setActiveProgressStudentId(event.state.studentId);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '[') { e.preventDefault(); window.history.back(); }
        else if (e.key === ']') { e.preventDefault(); window.history.forward(); }
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    if (!window.history.state) { window.history.replaceState({ viewMode: 'board' }, ''); }
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navigateTo = useCallback((mode: typeof viewMode, studentId: string | null = null) => {
    setViewMode(mode);
    if (studentId) setActiveProgressStudentId(studentId);
    window.history.pushState({ viewMode: mode, studentId }, '');
  }, []);

  const [academy, setAcademy] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isAndFilter, setIsAndFilter] = useState(false);
  const [filterTarget, setFilterTarget] = useState<'all' | 'today' | 'rest'>('rest');
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userJson = localStorage.getItem('ams_user');
    if (!userJson) { router.push(`/${slug}/login`); return; }
    setCurrentUser(JSON.parse(userJson));
  }, [slug, router]);
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [availableTextbooks, setAvailableTextbooks] = useState<TextbookOption[]>([]);
  const [isRefreshingBooks, setIsRefreshingBooks] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const handleViewProgress = (studentId: string) => {
    navigateTo('progress', studentId);
    setSelectedStudentId(null);
  };

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });

  const selectedDayKey = useMemo(() => {
    const d = new Date(selectedDate);
    return DAYS_KOR[d.getDay()];
  }, [selectedDate]);

  const fetchTeachers = useCallback(async (academyId: string) => {
    try {
      const { data, error } = await supabase.from('ams_teachers').select('*').eq('academy_id', academyId).order('name', { ascending: true });
      if (!error) setTeachers(data || []);
    } catch (e) { console.error(e); }
  }, []);

  const refreshTextbooks = useCallback(async () => {
    setIsRefreshingBooks(true);
    try {
      const res = await fetch('/api/textbooks');
      if (res.ok) setAvailableTextbooks(await res.json());
    } catch (e) { console.error(e); } finally { setIsRefreshingBooks(false); }
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      let currentAcademy = academy;
      if (!currentAcademy) {
        const normalizedSlug = (Array.isArray(slug) ? slug[0] : slug || '').toLowerCase();
        const { data: acData } = await supabase.from('ams_academies').select('*').eq('slug', normalizedSlug).single();
        if (acData) { setAcademy(acData); currentAcademy = acData; await fetchTeachers(acData.id); }
        else { setIsLoading(false); return; }
      } else { await fetchTeachers(currentAcademy.id); }

      let studentsQuery = supabase.from('ams_students').select('*').eq('academy_id', currentAcademy.id);
      const userJson = localStorage.getItem('ams_user');
      const user = userJson ? JSON.parse(userJson) : null;
      if (user && user.role === 'teacher') { studentsQuery = studentsQuery.eq('teacher_id', user.id); }

      const { data: studentsData, error: sErr } = await studentsQuery;
      if (sErr) throw sErr;

      const enriched = await Promise.all((studentsData || []).map(async (s) => {
        const { data: logsData } = await supabase.from('ams_session_logs').select('*').eq('student_id', s.id).order('session_date', { ascending: false }).limit(20);
        const logs: SessionLog[] = (logsData || []).map(l => ({
          id: l.id, date: l.session_date, status: (l.status || 'none') as StudentStatus,
          attendance_status: l.attendance_status || '출석', special_notes: l.special_notes || '',
          classwork_text: l.classwork_text || '', classwork_json: l.classwork_json || [],
          homework_text: l.homework_text || '', homework_json: l.homework_json || [],
          test_id: l.test_id || '', test_score: l.test_score, report_sent_at: l.report_sent_at
        }));
        const history = logs.filter(l => l.date < selectedDate).slice(0, 5).map(l => l.status);
        while (history.length < 5) history.push('none');
        return {
          id: s.id, academy_id: s.academy_id, teacher_id: s.teacher_id,
          name: s.name, school: s.school || '미지정', grade: s.grade || '미지정', course: s.course || 'C',
          book_courses: s.book_courses || {}, class: s.class_name || '일반반',
          phone: s.phone || '', is_deleted: !!s.is_deleted,
          last_consulted_at: s.last_consulted_at, created_at: s.created_at,
          status_changed_at: s.status_changed_at || s.updated_at,
          class_days: s.class_days || [], assigned_books: s.assigned_books || [], day_schedules: s.day_schedules || {},
          history, isRedLight: history.includes('poor') || history.includes('bad'),
          lastSession: logs.filter(l => l.date < selectedDate)[0], todaySession: logs.find(l => l.date === selectedDate),
          allLogs: logs
        };
      }));
      setStudents(enriched);
      await refreshTextbooks();
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, [selectedDate, refreshTextbooks, slug, academy, fetchTeachers]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const saveTodaySession = async (studentId: string, sessionData: Partial<SessionLog>) => {
    const student = students.find(s => s.id === studentId);
    if (!student || !academy) return false;
    let sessionId = student.todaySession?.id;

    const { test_score, test_result, ...restData } = sessionData as any;
    const dbCompatibleData = {
      ...restData,
      test_score: (test_score === '' || test_score === undefined || test_score === null) ? null : parseInt(String(test_score), 10),
      test_result: test_result || null
    };

    try {
      if (!sessionId) {
        const { data, error } = await supabase.from('ams_session_logs').insert([{
          student_id: studentId, academy_id: academy.id, session_date: selectedDate, 
          ...dbCompatibleData, status: sessionData.status || 'none'
        }]).select();
        if (error) return false;
        if (data) {
          const newLog = { ...data[0], homework_json: sessionData.homework_json || [], classwork_json: sessionData.classwork_json || [] } as SessionLog;
          setStudents(prev => prev.map(s => s.id === studentId ? { ...s, todaySession: newLog, allLogs: [newLog, ...s.allLogs.filter(l => l.date !== selectedDate)].sort((a,b) => b.date.localeCompare(a.date)) } : s));
          return true;
        }
      } else {
        const { error } = await supabase.from('ams_session_logs').update(dbCompatibleData).eq('id', sessionId);
        if (error) return false;
        const updated = { ...student.todaySession!, ...sessionData };
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, todaySession: updated, allLogs: s.allLogs.map(l => l.date === selectedDate ? updated : l) } : s));
        return true;
      }
    } catch (e) { return false; }
    return false;
  };

  const handleAddNewStudent = async (data: any) => {
    if (!academy) return;
    try {
      const { error } = await supabase.from('ams_students').insert([{
        academy_id: academy.id, name: data.name, school: data.school, grade: data.grade,
        course: data.course, book_courses: data.book_courses || {}, class_name: data.class_name, phone: data.phone,
        teacher_id: data.teacher_id || null, class_days: data.class_days, day_schedules: data.day_schedules, assigned_books: data.assigned_books, is_deleted: false
      }]);
      if (error) throw error;
      await fetchAllData();
    } catch (e) { console.error(e); }
  };

  const addStudentToToday = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student || student.todaySession) return;
    await saveTodaySession(studentId, { attendance_status: '보강', homework_text: student.lastSession?.homework_text || '' });
  };

  const batchAddStudents = async (studentIds: string[], reasons: Record<string, string> = {}) => {
    if (!academy) return;
    setIsLoading(true);
    try {
      const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const newLogs: any[] = [];
      for (const id of studentIds) {
        const s = students.find(st => st.id === id);
        const reason = reasons[id] || '';
        const formatted = reason ? `[${timestamp}] ${reason}` : '';
        const exist = s?.todaySession?.special_notes || '';
        const notes = exist ? `${exist}\n${formatted}`.trim() : formatted;
        newLogs.push({ student_id: id, student_name: s?.name, academy_id: academy.id, session_date: selectedDate, attendance_status: '보강', status: 'none', special_notes: notes });
      }
      const { data, error } = await supabase.from('ams_session_logs').upsert(newLogs, { onConflict: 'student_id, session_date' }).select();
      if (!error && data) { await fetchAllData(); }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const removeStudentFromToday = async (studentId: string, reason: string = '') => {
    const student = students.find(s => s.id === studentId);
    if (!student || !academy) return;
    try {
      const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const formatted = reason ? `[${timestamp}] ${reason}` : '';
      const exist = student.todaySession?.special_notes || '';
      const notes = exist ? `${exist}\n${formatted}`.trim() : formatted;
      const logData = { student_id: studentId, student_name: student.name, academy_id: academy.id, session_date: selectedDate, attendance_status: '수업제외', special_notes: notes, status: 'none' };
      const { error } = await supabase.from('ams_session_logs').upsert([logData], { onConflict: 'student_id, session_date' });
      if (!error) await fetchAllData();
    } catch (e) { console.error(e); }
  };

  const updateStudentInfo = async (studentId: string, field: string, value: any) => {
    try {
      if (field === 'PERMANENT_DELETE') {
        await supabase.from('ams_students').delete().eq('id', studentId);
        setSelectedStudentId(null);
      } else {
        const updateData: any = { [field]: value };
        if (field === 'is_deleted') {
          const now = new Date();
          const offset = now.getTimezoneOffset() * 60000;
          updateData.status_changed_at = new Date(now.getTime() - offset).toISOString();
        }
        await supabase.from('ams_students').update(updateData).eq('id', studentId);
      }
      await fetchAllData();
    } catch (e) { console.error(e); }
  };

  const handleAddNewTeacherAccount = async (d: any) => {
    if (!academy) return;
    try {
      await supabase.from('ams_teachers').insert([{ academy_id: academy.id, name: d.name, login_id: d.login_id, password: d.password, role: d.role || 'teacher' }]);
      await fetchTeachers(academy.id);
    } catch (e) { alert('오류 발생'); }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('ams_teachers').delete().eq('id', id);
    if (academy) await fetchTeachers(academy.id);
  };

  // 💡 필터링 로직 복구
  const todayStudents = useMemo(() => students.filter(s => {
    if (s.is_deleted) return false;
    const isToday = (s.class_days.includes(selectedDayKey) && (!s.todaySession || s.todaySession.attendance_status !== '수업제외')) || 
                    (s.todaySession && s.todaySession.attendance_status !== '수업제외' && s.todaySession.attendance_status !== 'none') ||
                    (s.todaySession && s.todaySession.attendance_status === '보강');
    if (!isToday) return false;
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedFilter !== 'All' && (filterTarget === 'today' || filterTarget === 'all')) { if (!s.grade.includes(selectedFilter)) return false; }
    if (selectedDays.length > 0 && (filterTarget === 'today' || filterTarget === 'all')) {
      if (isAndFilter) { if (!selectedDays.every(day => s.class_days.includes(day))) return false; }
      else { if (!s.class_days.some(day => selectedDays.includes(day))) return false; }
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [students, selectedDayKey, selectedFilter, selectedDays, isAndFilter, filterTarget, searchQuery]);

  const filteredAllStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedFilter === 'Discharged') { return s.is_deleted === true && s.name.toLowerCase().includes(searchQuery.toLowerCase()); }
      if (s.is_deleted) return false;
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedFilter !== 'All' && (filterTarget === 'rest' || filterTarget === 'all')) { if (!s.grade.includes(selectedFilter)) return false; }
      if (selectedDays.length > 0 && (filterTarget === 'rest' || filterTarget === 'all')) {
        if (isAndFilter) { if (!selectedDays.every(day => s.class_days.includes(day))) return false; }
        else { if (!s.class_days.some(day => selectedDays.includes(day))) return false; }
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, searchQuery, selectedFilter, selectedDays, isAndFilter, filterTarget]);

  const allTodayIds = useMemo(() => students.filter(s => {
    if (s.is_deleted) return false;
    return (s.class_days.includes(selectedDayKey) && (!s.todaySession || s.todaySession.attendance_status !== '수업제외')) || 
           (s.todaySession && s.todaySession.attendance_status !== '수업제외' && s.todaySession.attendance_status !== 'none') ||
           (s.todaySession && s.todaySession.attendance_status === '보강');
  }).map(s => s.id), [students, selectedDayKey]);

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] flex font-sans selection:bg-blue-500/30 overflow-hidden text-xs">
      <Sidebar viewMode={viewMode} setViewMode={navigateTo} todayCount={todayStudents.length} students={students} selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter} selectedDays={selectedDays} setSelectedDays={setSelectedDays} isAndFilter={isAndFilter} setIsAndFilter={setIsAndFilter} filterTarget={filterTarget} setFilterTarget={setFilterTarget} academyInfo={academy} />
      <main className="flex-1 h-screen overflow-y-auto bg-[#080808] relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500"><Loader2 className="animate-spin mb-4" size={32} /><p className="text-[10px] font-black uppercase tracking-[0.4em]">Syncing Academy Data...</p></div>
        ) : (
          <div className="h-full">
            {viewMode === 'board' && <Overview todayStudents={todayStudents} filteredAllStudents={filteredAllStudents} allTodayIds={allTodayIds} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={isBatchMode} setIsBatchMode={setIsBatchMode} onBatchAdd={batchAddStudents} onRemoveFromToday={removeStudentFromToday} onAddNewStudent={handleAddNewStudent} masterTextbooks={availableTextbooks} teachers={teachers} consultationCycle={academy?.consultation_cycle || 21} />}
            {viewMode === 'studentEdit' && <Overview todayStudents={[]} filteredAllStudents={filteredAllStudents} allTodayIds={[]} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={false} setIsBatchMode={() => {}} onBatchAdd={async () => {}} onRemoveFromToday={removeStudentFromToday} onAddNewStudent={handleAddNewStudent} masterTextbooks={availableTextbooks} teachers={teachers} title="전체 학생 정보 관리" showAddButton={true} hideTodaySection={true} consultationCycle={academy?.consultation_cycle || 21} />}
            {viewMode === 'todayTable' && <TodaySheet students={todayStudents} selectedDate={selectedDate} onDateChange={setSelectedDate} onViewProgress={handleViewProgress} masterTextbooks={availableTextbooks} onSave={saveTodaySession} academyInfo={academy} currentUser={currentUser} />}
            {viewMode === 'progress' && <ProgressSequencer students={filteredAllStudents} masterTextbooks={availableTextbooks} initialStudentId={activeProgressStudentId} />}
            {viewMode === 'monthlyChanges' && <MonthlyChanges students={students} />}
            {viewMode === 'notifications' && <NotificationsView academyInfo={academy} students={students} currentUser={currentUser} />}
            {viewMode === 'settings' && <SettingsView teachers={teachers} onAddTeacher={handleAddNewTeacherAccount} onDeleteTeacher={handleDeleteTeacher} academyInfo={academy} currentUser={currentUser} />}
          </div>
        )}
      </main>
      <AnimatePresence>
        {selectedStudentId && selectedStudent && !isBatchMode && (
          viewMode === 'studentEdit' ? <StudentDetailDrawer student={selectedStudent} availableTextbooks={availableTextbooks} isRefreshingBooks={isRefreshingBooks} onRefreshBooks={refreshTextbooks} onUpdateInfo={updateStudentInfo} onAddToToday={addStudentToToday} onClose={() => setSelectedStudentId(null)} teachers={teachers} /> : <StudentStudyReportDrawer student={selectedStudent} availableTextbooks={availableTextbooks} onClose={() => setSelectedStudentId(null)} onEditMode={() => navigateTo('studentEdit')} />
        )}
      </AnimatePresence>
      <AnimatePresence>{selectedStudentId && !isBatchMode && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStudentId(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />)}</AnimatePresence>
    </div>
  );
}
