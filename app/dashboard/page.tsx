'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// 분리된 컴포넌트 임포트
import Sidebar from '@/components/dashboard/Sidebar';
import Overview from '@/components/dashboard/Overview';
import TodaySheet from '@/components/dashboard/TodaySheet';
import ProgressSequencer from '@/components/dashboard/ProgressSequencer';
import StudentDetailDrawer from '@/components/dashboard/StudentDetailDrawer';

// 공통 타입 임포트
import { Student, SessionLog, StudentStatus, TextbookOption } from '@/types/dashboard';

const DAYS_KOR = ['일', '월', '화', '수', '목', '금', '토'];

export default function DashboardPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'board' | 'todayTable' | 'progress'>('board');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [availableTextbooks, setAvailableTextbooks] = useState<TextbookOption[]>([]);
  const [isRefreshingBooks, setIsRefreshingBooks] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const { todayISO, todayKey, dateString } = useMemo(() => {
    const now = new Date();
    const iso = now.toISOString().split('T')[0];
    const key = DAYS_KOR[now.getDay()];
    const str = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
    return { todayISO: iso, todayKey: key, dateString: str };
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
      const { data: studentsData, error: sErr } = await supabase.from('ams_students').select('*').eq('is_deleted', false);
      if (sErr) throw sErr;

      const enriched = await Promise.all((studentsData || []).map(async (s) => {
        const { data: logsData } = await supabase.from('ams_session_logs').select('*').eq('student_id', s.id).order('session_date', { ascending: false }).limit(10);
        const logs: SessionLog[] = (logsData || []).map(l => ({
          id: l.id, date: l.session_date, status: (l.status || 'none') as StudentStatus,
          attendance_status: l.attendance_status || '출석', special_notes: l.special_notes || '',
          homework_text: l.homework_text || '',
          homework_json: l.homework_json || [],
          test_id: l.test_id || ''
        }));

        const history = logs.slice(0, 5).map(l => l.status);
        while (history.length < 5) history.push('none');

        return {
          id: s.id, academy_id: s.academy_id, name: s.name, school: s.school || '미지정', grade: s.grade || '미지정', class: s.class_name || '일반반',
          class_days: s.class_days || [], assigned_books: s.assigned_books || [],
          history, isRedLight: history.includes('warning') || history.includes('late'),
          lastSession: logs.filter(l => l.date < todayISO)[0], todaySession: logs.find(l => l.date === todayISO),
          allLogs: logs
        };
      }));

      setStudents(enriched);
      await refreshTextbooks();
    } catch (error) { console.error('Data load error:', error); } finally { setIsLoading(false); }
  }, [todayISO, refreshTextbooks]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const saveTodaySession = async (studentId: string, sessionData: Partial<SessionLog>) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return false;
    let sessionId = student.todaySession?.id;

    try {
      if (!sessionId) {
        const { data, error } = await supabase.from('ams_session_logs').insert([{
          student_id: studentId, academy_id: student.academy_id, session_date: todayISO, ...sessionData, status: sessionData.status || 'none'
        }]).select();
        if (error) return false;
        if (data) {
          setStudents(prev => prev.map(s => s.id === studentId ? { ...s, todaySession: data[0] as SessionLog } : s));
          return true;
        }
      } else {
        const { error } = await supabase.from('ams_session_logs').update(sessionData).eq('id', sessionId);
        if (error) return false;
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, todaySession: { ...s.todaySession!, ...sessionData } } : s));
        return true;
      }
    } catch (e) { return false; }
    return false;
  };

  const handleAddNewStudent = async (data: any) => {
    try {
      const { error } = await supabase.from('ams_students').insert([{
        academy_id: students[0]?.academy_id || 'hokma-math',
        name: data.name, school: data.school, grade: data.grade, class_name: data.class_name, phone: data.phone, class_days: data.class_days, is_deleted: false
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

  const batchAddStudents = async (studentIds: string[]) => {
    setIsLoading(true);
    try {
      const inserts = studentIds.map(id => {
        const s = students.find(st => st.id === id);
        return { student_id: id, academy_id: s?.academy_id, session_date: todayISO, attendance_status: '보강', status: 'none' };
      });
      const { error } = await supabase.from('ams_session_logs').insert(inserts);
      if (!error) await fetchAllData();
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const removeStudentFromToday = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student || !student.todaySession) return;
    try {
      const { error } = await supabase.from('ams_session_logs').delete().eq('id', student.todaySession.id);
      if (!error) await fetchAllData();
    } catch (e) { console.error(e); }
  };

  const updateStudentInfo = async (studentId: string, field: string, value: any) => {
    try {
      const { error } = await supabase.from('ams_students').update({ [field]: value }).eq('id', studentId);
      if (!error) await fetchAllData();
    } catch (e) { console.error(e); }
  };

  const todayStudents = useMemo(() => students.filter(s => s.class_days.includes(todayKey) || !!s.todaySession).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [students, todayKey]);
  const filteredAllStudents = useMemo(() => students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [students, searchQuery]);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] flex font-sans selection:bg-blue-500/30 overflow-hidden text-xs">
      <Sidebar viewMode={viewMode} setViewMode={setViewMode} todayCount={todayStudents.length} students={students} selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter} />
      <main className="flex-1 h-screen overflow-y-auto bg-[#080808] relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Loader2 className="animate-spin mb-4" size={32} /><p className="text-[10px] font-black uppercase tracking-[0.4em]">Syncing Academy Data...</p>
          </div>
        ) : (
          <div className="h-full">
            {viewMode === 'board' && (
              <Overview 
                todayStudents={todayStudents} filteredAllStudents={filteredAllStudents} 
                selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} 
                todayKey={todayKey} isBatchMode={isBatchMode} setIsBatchMode={setIsBatchMode}
                onBatchAdd={batchAddStudents} onRemoveFromToday={removeStudentFromToday}
                onAddNewStudent={handleAddNewStudent}
              />
            )}
            {viewMode === 'todayTable' && <TodaySheet students={todayStudents} masterTextbooks={availableTextbooks} onSave={saveTodaySession} />}
            {viewMode === 'progress' && <ProgressSequencer students={students} masterTextbooks={availableTextbooks} />}
          </div>
        )}
      </main>
      <AnimatePresence>
        {selectedStudentId && selectedStudent && !isBatchMode && (
          <StudentDetailDrawer student={selectedStudent} availableTextbooks={availableTextbooks} isRefreshingBooks={isRefreshingBooks} onRefreshBooks={refreshTextbooks} onUpdateInfo={updateStudentInfo} onAddToToday={addStudentToToday} onClose={() => setSelectedStudentId(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>{selectedStudentId && !isBatchMode && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStudentId(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />)}</AnimatePresence>
    </div>
  );
}
