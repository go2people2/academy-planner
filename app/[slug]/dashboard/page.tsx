'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import Overview from '@/components/dashboard/Overview';
import TodaySheet from '@/components/dashboard/TodaySheet';
import ProgressSequencer from '@/components/dashboard/ProgressSequencer';
import MonthlyChanges from '@/components/dashboard/MonthlyChanges';
import SettingsView from '@/components/dashboard/SettingsView';
import NotificationsView from '@/components/dashboard/NotificationsView';
import StudentDetailDrawer from '@/components/dashboard/StudentDetailDrawer';
import StudentStudyReportDrawer from '@/components/dashboard/StudentStudyReportDrawer';
import { supabase } from '@/lib/supabase';
import { Student, SessionLog, StudentStatus, TextbookOption } from '@/types/dashboard';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardPage() {
  const router = useRouter();
  const { slug } = useParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<string>('board');
  const [activeProgressStudentId, setActiveProgressStudentId] = useState<string | null>(null);

  useEffect(() => {
    const userJson = localStorage.getItem('ams_user');
    if (!userJson) { router.push(`/${slug}/login`); return; }
    setCurrentUser(JSON.parse(userJson));
  }, [slug, router]);

  const [academy, setAcademy] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('All');
  const [isAndFilter, setIsAndFilter] = useState(false);
  const [filterTarget, setFilterTarget] = useState<'all' | 'today' | 'rest'>('rest');
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [availableTextbooks, setAvailableTextbooks] = useState<TextbookOption[]>([]);
  const [isRefreshingBooks, setIsRefreshingBooks] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const navigateTo = (mode: string) => { setViewMode(mode); setSelectedStudentId(null); };
  
  const handleUpdateCurrentUser = (updates: any) => {
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);
    localStorage.setItem('ams_user', JSON.stringify(updated));
  };

  const handleViewProgress = (id: string) => { setActiveProgressStudentId(id); setViewMode('progress'); };

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

  const fetchAllData = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      let currentAcademy = academy;
      if (!currentAcademy) {
        const normalizedSlug = (Array.isArray(slug) ? slug[0] : slug || '').toLowerCase();
        const { data: acData } = await supabase.from('ams_academies').select('*').eq('slug', normalizedSlug).single();
        if (acData) { setAcademy(acData); currentAcademy = acData; await fetchTeachers(acData.id); }
        else { setIsLoading(false); return; }
      } else { await fetchTeachers(currentAcademy.id); }

      let studentsQuery = supabase.from('ams_students').select('*').eq('academy_id', currentAcademy.id);
      const user = currentUser || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ams_user') || 'null') : null);
      if (user && user.role === 'teacher') { studentsQuery = studentsQuery.eq('teacher_id', user.id); }

      const { data: studentsData, error: sErr } = await studentsQuery;
      if (sErr) throw sErr;

      const enriched = await Promise.all((studentsData || []).map(async (s) => {
        const { data: logsData } = await supabase.from('ams_session_logs').select('*').eq('student_id', s.id).order('session_date', { ascending: false }).limit(20);
        const logs: SessionLog[] = (logsData || []).map(l => {
          // 💡 test_result에서 타입과 회차 정보를 안전하게 추출 (JSON 또는 기존 문자열 대응)
          let scoreType: 'score' | 'count' = 'score';
          let trial = 1;
          try {
            if (l.test_result?.startsWith('{')) {
              const res = JSON.parse(l.test_result);
              scoreType = res.type || 'score';
              trial = res.trial || 1;
            } else if (l.test_result === 'count') {
              scoreType = 'count';
            }
          } catch (e) {}

          return {
            id: l.id, date: l.session_date, status: (l.status || 'none') as StudentStatus,
            attendance_status: l.attendance_status || '출석', special_notes: l.special_notes || '',
            classwork_text: l.classwork_text || '', classwork_json: l.classwork_json || [],
            homework_text: l.homework_text || '', homework_json: l.homework_json || [],
            next_quiz_text: l.unit_info || '', 
            next_quiz_json: l.homework_to ? JSON.parse(l.homework_to) : [],
            next_quiz_cut: l.homework_from || 0,
            next_quiz_trial: trial,
            test_id: l.test_status || '', 
            test_score: l.test_score, 
            test_score_type: scoreType,
            report_sent_at: l.report_sent_at
          };
        });
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
  }, [selectedDate, refreshTextbooks, slug, academy, fetchTeachers, currentUser]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const saveTodaySession = async (studentId: string, sessionData: Partial<SessionLog>) => {
    const student = students.find(s => s.id === studentId);
    if (!student || !academy) return false;
    let sessionId = student.todaySession?.id;

    // 💡 DB 컬럼 선별 (material_1 사용 배제하여 타입 에러 방지)
    const ALLOWED_COLUMNS = [
      'status', 'attendance_status', 'special_notes', 'classwork_text', 'classwork_json', 
      'homework_text', 'homework_json', 'test_status', 'test_score', 'test_result', 
      'session_date', 'academy_id', 'student_id',
      'unit_info', 'homework_from', 'homework_to'
    ];

    const filteredData: any = {};
    
    // 💡 복합 데이터 처리 (test_result에 JSON으로 통합 저장)
    const currentRes = student.todaySession?.test_result;
    let resObj = { type: 'score', trial: 1 };
    try {
      if (currentRes?.startsWith('{')) resObj = JSON.parse(currentRes);
      else if (currentRes === 'count') resObj.type = 'count';
    } catch(e) {}
    
    if (sessionData.test_score_type) resObj.type = sessionData.test_score_type;
    if (sessionData.next_quiz_trial !== undefined) resObj.trial = Number(sessionData.next_quiz_trial);
    filteredData['test_result'] = JSON.stringify(resObj);

    Object.keys(sessionData).forEach(key => {
      let dbKey = key === 'date' ? 'session_date' : key;
      if (dbKey === 'test_id') dbKey = 'test_status';
      if (dbKey === 'test_score_type' || dbKey === 'next_quiz_trial' || dbKey === 'test_result') return; 
      
      if (dbKey === 'next_quiz_text') dbKey = 'unit_info';
      if (dbKey === 'next_quiz_cut') dbKey = 'homework_from';
      if (dbKey === 'next_quiz_json') {
        dbKey = 'homework_to';
        filteredData[dbKey] = JSON.stringify((sessionData as any)[key]);
        return;
      }

      if (ALLOWED_COLUMNS.includes(dbKey)) {
        let val = (sessionData as any)[key];
        if (dbKey === 'test_score') {
          val = (val === '' || val === undefined || val === null) ? null : parseInt(String(val), 10);
        }
        filteredData[dbKey] = val;
      }
    });

    try {
      if (!sessionId) {
        const { error } = await supabase.from('ams_session_logs').insert([{
          student_id: studentId, academy_id: academy.id, session_date: selectedDate, 
          ...filteredData, status: sessionData.status || 'none'
        }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ams_session_logs').update(filteredData).eq('id', sessionId);
        if (error) throw error;
      }
      await fetchAllData(false);
      return true;
    } catch (e) { console.error('Save error detailed:', e); return false; }
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
      const newLogs = studentIds.map(id => {
        const s = students.find(st => st.id === id);
        const reason = reasons[id] || '';
        const formatted = reason ? `[${timestamp}] ${reason}` : '';
        const exist = s?.todaySession?.special_notes || '';
        const notes = exist ? `${exist}\n${formatted}`.trim() : formatted;
        return { student_id: id, student_name: s?.name, academy_id: academy.id, session_date: selectedDate, attendance_status: '보강', status: 'none', special_notes: notes };
      });
      const { error } = await supabase.from('ams_session_logs').upsert(newLogs, { onConflict: 'student_id, session_date' });
      if (error) throw error;
      await fetchAllData();
      setIsBatchMode(false);
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
      const { error } = await supabase.from('ams_session_logs').upsert([{ 
        student_id: studentId, student_name: student.name, academy_id: academy.id, 
        session_date: selectedDate, attendance_status: '수업제외', special_notes: notes, status: 'none' 
      }], { onConflict: 'student_id, session_date' });
      if (error) throw error;
      await fetchAllData();
    } catch (e) { console.error(e); }
  };

  const updateStudentInfo = async (studentId: string, fieldOrUpdates: string | any, value?: any) => {
    try {
      if (fieldOrUpdates === 'PERMANENT_DELETE') {
        const { error } = await supabase.from('ams_students').delete().eq('id', studentId);
        if (error) throw error;
        setSelectedStudentId(null);
        alert('학생 정보가 영구 삭제되었습니다.');
      } else {
        let updateData: any = (typeof fieldOrUpdates === 'string') ? { [fieldOrUpdates]: value } : { ...fieldOrUpdates };
        const { error } = await supabase.from('ams_students').update(updateData).eq('id', studentId);
        if (error) throw error;
        if (updateData.is_deleted === true) alert('퇴원 처리가 완료되었습니다. "Discharged" 메뉴에서 확인하실 수 있습니다.');
      }
      await fetchAllData();
    } catch (e: any) { alert('오류가 발생했습니다: ' + e.message); }
  };

  const handleAddNewTeacherAccount = async (d: any) => {
    if (!academy) return;
    try {
      const { error } = await supabase.from('ams_teachers').insert([{ academy_id: academy.id, login_id: d.login_id, password: d.password, name: d.name, role: d.role }]);
      if (error) throw error;
      await fetchTeachers(academy.id);
    } catch (e) { console.error(e); }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('ams_teachers').delete().eq('id', id);
    if (academy) await fetchTeachers(academy.id);
  };

  const handleUpdateTeacher = async (id: string, updates: any) => {
    try {
      await supabase.from('ams_teachers').update(updates).eq('id', id);
      if (academy) await fetchTeachers(academy.id);
    } catch (e) { console.error(e); }
  };

  function getDayOfWeek(dateStr: string) { const days = ['일', '월', '화', '수', '목', '금', '토']; return days[new Date(dateStr).getDay()]; }
  const selectedDayKey = getDayOfWeek(selectedDate);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

  const todayStudents = useMemo(() => students.filter(s => {
    if (s.is_deleted) return false;
    const isToday = (s.class_days.includes(selectedDayKey) && (!s.todaySession || s.todaySession.attendance_status !== '수업제외')) || 
                    (s.todaySession && s.todaySession.attendance_status !== '수업제외' && s.todaySession.attendance_status !== 'none') ||
                    (s.todaySession && s.todaySession.attendance_status === '보강');
    if (!isToday) return false;
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;
    if (selectedFilter !== 'All' && (filterTarget === 'today' || filterTarget === 'all')) { if (!s.grade.includes(selectedFilter)) return false; }
    if (selectedDays.length > 0 && (filterTarget === 'today' || filterTarget === 'all')) {
      if (isAndFilter) { if (!selectedDays.every(day => s.class_days.includes(day))) return false; }
      else { if (!s.class_days.some(day => selectedDays.includes(day))) return false; }
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [students, selectedDayKey, selectedFilter, selectedDays, isAndFilter, filterTarget, searchQuery, selectedTeacherId]);

  const filteredAllStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedFilter === 'Discharged') { return s.is_deleted === true && s.name.toLowerCase().includes(searchQuery.toLowerCase()); }
      if (s.is_deleted) return false;
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) return false;
      if (selectedFilter !== 'All' && (filterTarget === 'rest' || filterTarget === 'all')) { if (!s.grade.includes(selectedFilter)) return false; }
      if (selectedDays.length > 0 && (filterTarget === 'rest' || filterTarget === 'all')) {
        if (isAndFilter) { if (!selectedDays.every(day => s.class_days.includes(day))) return false; }
        else { if (!s.class_days.some(day => selectedDays.includes(day))) return false; }
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, searchQuery, selectedFilter, selectedDays, isAndFilter, filterTarget, selectedTeacherId]);

  const allTodayIds = useMemo(() => students.filter(s => {
    if (s.is_deleted) return false;
    return (s.class_days.includes(selectedDayKey) && (!s.todaySession || s.todaySession.attendance_status !== '수업제외')) || 
           (s.todaySession && s.todaySession.attendance_status !== '수업제외' && s.todaySession.attendance_status !== 'none') ||
           (s.todaySession && s.todaySession.attendance_status === '보강');
  }).map(s => s.id), [students, selectedDayKey]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] flex font-sans selection:bg-blue-500/30 overflow-hidden text-xs">
      <Sidebar 
        viewMode={viewMode} setViewMode={navigateTo} todayCount={todayStudents.length} students={students} 
        selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter} 
        selectedDays={selectedDays} setSelectedDays={setSelectedDays} 
        isAndFilter={isAndFilter} setIsAndFilter={setIsAndFilter} 
        filterTarget={filterTarget} setFilterTarget={setFilterTarget} 
        academyInfo={academy} 
        teachers={teachers} selectedTeacherId={selectedTeacherId} setSelectedTeacherId={setSelectedTeacherId}
      />
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
            {viewMode === 'settings' && <SettingsView teachers={teachers} onAddTeacher={handleAddNewTeacherAccount} onDeleteTeacher={handleDeleteTeacher} onUpdateTeacher={handleUpdateTeacher} onUpdateCurrentUser={handleUpdateCurrentUser} academyInfo={academy} currentUser={currentUser} />}
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
