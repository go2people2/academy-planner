'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// 분리된 컴포넌트 임포트
import Sidebar from '@/components/dashboard/Sidebar';
import Overview from '@/components/dashboard/Overview';
import TodaySheet from '@/components/dashboard/TodaySheet'; // 나중에 DailySheet로 개칭 예정
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

  // --- 💡 핵심 변경: 선택된 날짜 관리 ---
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 선택된 날짜에 따른 요일 정보 계산
  const selectedDayKey = useMemo(() => {
    const d = new Date(selectedDate);
    return DAYS_KOR[d.getDay()];
  }, [selectedDate]);

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
        // 선택된 날짜를 기준으로 로그를 가져옴 (오늘뿐만 아니라 과거 날짜 기록도 포함)
        const { data: logsData } = await supabase.from('ams_session_logs').select('*').eq('student_id', s.id).order('session_date', { ascending: false }).limit(20);
        
        const logs: SessionLog[] = (logsData || []).map(l => ({
          id: l.id, date: l.session_date, status: (l.status || 'none') as StudentStatus,
          attendance_status: l.attendance_status || '출석', special_notes: l.special_notes || '',
          homework_text: l.homework_text || '',
          homework_json: l.homework_json || [],
          test_id: l.test_id || ''
        }));

        const history = logs.filter(l => l.date < selectedDate).slice(0, 5).map(l => l.status);
        while (history.length < 5) history.push('none');

        // selectedDate에 해당하는 세션 찾기
        const todaySession = logs.find(l => l.date === selectedDate);
        // selectedDate보다 이전의 가장 최근 세션 찾기
        const lastSession = logs.filter(l => l.date < selectedDate)[0];

        return {
          id: s.id, academy_id: s.academy_id, name: s.name, school: s.school || '미지정', grade: s.grade || '미지정', class: s.class_name || '일반반',
          class_days: s.class_days || [], assigned_books: s.assigned_books || [],
          history, isRedLight: history.includes('warning') || history.includes('late'),
          lastSession, todaySession,
          allLogs: logs
        };
      }));

      setStudents(enriched);
      await refreshTextbooks();
    } catch (error) { console.error('Data load error:', error); } finally { setIsLoading(false); }
  }, [selectedDate, refreshTextbooks]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const saveTodaySession = async (studentId: string, sessionData: Partial<SessionLog>) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return false;
    
    // 컴포넌트에서 전달된 구체적인 날짜가 있으면 사용, 없으면 전체 선택 날짜 사용
    const targetDate = (sessionData as any).session_date || selectedDate;
    
    // 해당 날짜의 세션이 이미 존재하는지 전체 로그에서 확인
    const existingSession = student.allLogs?.find(l => l.date === targetDate);
    let sessionId = existingSession?.id;

    try {
      if (!sessionId) {
        const { data, error } = await supabase.from('ams_session_logs').insert([{
          student_id: studentId, academy_id: student.academy_id, session_date: targetDate, ...sessionData, status: sessionData.status || 'none'
        }]).select();
        if (error) return false;
        if (data) {
          // 데이터 갱신을 위해 전체 데이터를 다시 불러오거나 로컬 상태를 영리하게 업데이트
          setStudents(prev => prev.map(s => s.id === studentId ? { 
            ...s, 
            todaySession: targetDate === selectedDate ? (data[0] as SessionLog) : s.todaySession,
            allLogs: [data[0] as SessionLog, ...(s.allLogs || []).filter(l => l.id !== data[0].id)]
          } : s));
          return true;
        }
      } else {
        const { error } = await supabase.from('ams_session_logs').update(sessionData).eq('id', sessionId);
        if (error) return false;
        setStudents(prev => prev.map(s => s.id === studentId ? { 
          ...s, 
          todaySession: targetDate === selectedDate ? { ...s.todaySession!, ...sessionData } : s.todaySession,
          allLogs: (s.allLogs || []).map(l => l.id === sessionId ? { ...l, ...sessionData } : l)
        } : s));
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
        return { student_id: id, academy_id: s?.academy_id, session_date: selectedDate, attendance_status: '보강', status: 'none' };
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

  const todayStudents = useMemo(() => students.filter(s => s.class_days.includes(selectedDayKey) || !!s.todaySession).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [students, selectedDayKey]);
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
                todayKey={selectedDayKey} isBatchMode={isBatchMode} setIsBatchMode={setIsBatchMode}
                onBatchAdd={batchAddStudents} onRemoveFromToday={removeStudentFromToday}
                onAddNewStudent={handleAddNewStudent}
              />
            )}
            {viewMode === 'todayTable' && (
              <TodaySheet 
                students={todayStudents} 
                selectedDate={selectedDate} // 날짜 전달
                onDateChange={setSelectedDate} // 날짜 변경 함수 전달
                masterTextbooks={availableTextbooks} 
                onSave={saveTodaySession} 
              />
            )}
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
