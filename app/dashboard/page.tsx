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
import StudentStudyReportDrawer from '@/components/dashboard/StudentStudyReportDrawer'; // 💡 추가
import MonthlyChanges from '@/components/dashboard/MonthlyChanges';

// 공통 타입 임포트
import { Student, SessionLog, StudentStatus, TextbookOption } from '@/types/dashboard';

const DAYS_KOR = ['일', '월', '화', '수', '목', '금', '토'];

export default function DashboardPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'board' | 'todayTable' | 'progress' | 'studentEdit' | 'monthlyChanges'>('board');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [filterTarget, setFilterTarget] = useState<'all' | 'today' | 'rest'>('rest'); // 💡 필터 적용 범위 추가
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [availableTextbooks, setAvailableTextbooks] = useState<TextbookOption[]>([]);
  const [isRefreshingBooks, setIsRefreshingBooks] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  });

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
      const { data: studentsData, error: sErr } = await supabase.from('ams_students').select('*');
      if (sErr) throw sErr;

      const enriched = await Promise.all((studentsData || []).map(async (s) => {
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
        return {
          id: s.id, academy_id: s.academy_id, name: s.name, school: s.school || '미지정', grade: s.grade || '미지정', class: s.class_name || '일반반',
          phone: s.phone || '', is_deleted: !!s.is_deleted,
          created_at: s.created_at, // 💡 추가
          status_changed_at: s.updated_at, // 💡 추가
          class_days: s.class_days || [], assigned_books: s.assigned_books || [], day_schedules: s.day_schedules || {},
          history, isRedLight: history.includes('warning') || history.includes('late'),
          lastSession: logs.filter(l => l.date < selectedDate)[0], todaySession: logs.find(l => l.date === selectedDate),
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
    let sessionId = student.todaySession?.id;
    try {
      if (!sessionId) {
        const { data, error } = await supabase.from('ams_session_logs').insert([{
          student_id: studentId, 
          student_name: student.name, // 💡 이름 저장
          academy_id: student.academy_id, 
          session_date: selectedDate, 
          ...sessionData, 
          status: sessionData.status || 'none'
        }]).select();
        if (error) return false;
        if (data) {
          setStudents(prev => prev.map(s => s.id === studentId ? { ...s, todaySession: data[0] as SessionLog } : s));
          return true;
        }
      } else {
        const { error } = await supabase.from('ams_session_logs').update({
          ...sessionData,
          student_name: student.name // 💡 이름 업데이트 (이름 변경 대비)
        }).eq('id', sessionId);
        if (error) return false;
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, todaySession: { ...s.todaySession!, ...sessionData, student_name: student.name } } : s));
        return true;
      }
    } catch (e) { return false; }
    return false;
  };

  const handleAddNewStudent = async (data: any) => {
    try {
      const { error } = await supabase.from('ams_students').insert([{
        academy_id: students[0]?.academy_id || 'hokma-math',
        name: data.name, school: data.school, grade: data.grade, class_name: data.class_name, phone: data.phone, 
        class_days: data.class_days, day_schedules: data.day_schedules, assigned_books: data.assigned_books, is_deleted: false
      }]);
      if (error) throw error;
      await fetchAllData();
    } catch (e) { console.error('Add student error:', e); }
  };

  const addStudentToToday = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student || student.todaySession) return;
    await saveTodaySession(studentId, { attendance_status: '보강', homework_text: student.lastSession?.homework_text || '' });
  };

  const batchAddStudents = async (studentIds: string[], reasons: Record<string, string> = {}) => {
    setIsLoading(true);
    try {
      const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

      const inserts = await Promise.all(studentIds.map(async id => {
        const s = students.find(st => st.id === id);
        const reason = reasons[id] || '';
        const formattedReason = reason ? `[${timestamp}] ${reason}` : '';

        // 기존 로그가 있는지 확인 (오늘 날짜)
        const { data: existingLog } = await supabase
          .from('ams_session_logs')
          .select('special_notes')
          .eq('student_id', id)
          .eq('session_date', selectedDate)
          .single();

        const newNotes = existingLog?.special_notes 
          ? `${existingLog.special_notes}\n${formattedReason}`.trim()
          : formattedReason;

        return { 
          student_id: id, 
          student_name: s?.name,
          academy_id: s?.academy_id, 
          session_date: selectedDate, 
          attendance_status: '보강', 
          status: 'none',
          special_notes: newNotes 
        };
      }));

      const { error } = await supabase.from('ams_session_logs').upsert(inserts, { onConflict: 'student_id, session_date' });
      if (!error) await fetchAllData();
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const removeStudentFromToday = async (studentId: string, reason: string = '') => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    try {
      const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const formattedReason = reason ? `[${timestamp}] ${reason}` : '';
      
      const existingNotes = student.todaySession?.special_notes || '';
      const newNotes = existingNotes 
        ? `${existingNotes}\n${formattedReason}`.trim()
        : formattedReason;

      if (student.todaySession?.id) {
        const { error } = await supabase
          .from('ams_session_logs')
          .update({ 
            attendance_status: '수업제외', 
            special_notes: newNotes,
            student_name: student.name // 💡 이름 업데이트
          })
          .eq('id', student.todaySession.id);
        if (!error) await fetchAllData();
      } else {
        const { error } = await supabase
          .from('ams_session_logs')
          .insert([{
            student_id: studentId,
            student_name: student.name, // 💡 이름 저장
            academy_id: student.academy_id,
            session_date: selectedDate,
            attendance_status: '수업제외',
            special_notes: newNotes,
            status: 'none'
          }]);
        if (!error) await fetchAllData();
      }
    } catch (e) { console.error(e); }
  };

  const updateStudentInfo = async (studentId: string, field: string, value: any) => {
    try {
      if (field === 'PERMANENT_DELETE') {
        const { error } = await supabase.from('ams_students').delete().eq('id', studentId);
        if (error) throw error;
        setSelectedStudentId(null);
      } else {
        const { error } = await supabase.from('ams_students').update({ [field]: value }).eq('id', studentId);
        if (error) throw error;
      }
      await fetchAllData();
    } catch (e) { console.error('Update student error:', e); }
  };

  const todayStudents = useMemo(() => students.filter(s => {
    if (s.is_deleted) return false;

    // 1. 오늘 수업 여부 확인 (이게 가장 우선되는 구분값)
    const isToday = (s.class_days.includes(selectedDayKey) && (!s.todaySession || s.todaySession.attendance_status !== '수업제외')) || 
                    (s.todaySession && s.todaySession.attendance_status !== '수업제외' && s.todaySession.attendance_status !== 'none') ||
                    (s.todaySession && s.todaySession.attendance_status === '보강');
    
    if (!isToday) return false;

    // 2. 검색어 필터링
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    // 3. 학년 필터 적용 (타겟이 Top 또는 All일 때만 가시성 결정)
    if (selectedFilter !== 'All' && (filterTarget === 'today' || filterTarget === 'all')) {
      if (!s.grade.includes(selectedFilter)) return false;
    }
    
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [students, selectedDayKey, selectedFilter, filterTarget, searchQuery]);

  const filteredAllStudents = useMemo(() => {
    return students.filter(s => {
      // 1. 퇴원생 모드일 때
      if (selectedFilter === 'Discharged') {
        return s.is_deleted === true && s.name.toLowerCase().includes(searchQuery.toLowerCase());
      }

      // 2. 일반 모드
      if (s.is_deleted) return false;
      
      // 검색어 확인
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

      // 학년 필터 적용 (타겟이 Btm 또는 All일 때만 가시성 결정)
      if (selectedFilter !== 'All' && (filterTarget === 'rest' || filterTarget === 'all')) {
        if (!s.grade.includes(selectedFilter)) return false;
      }
      
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, searchQuery, selectedFilter, filterTarget]);

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

  // 💡 필터와 상관없이 '오늘 수업인' 학생들의 전체 ID 목록 (목록 간 이동 방지용)
  const allTodayIds = useMemo(() => students.filter(s => {
    if (s.is_deleted) return false;
    return (s.class_days.includes(selectedDayKey) && (!s.todaySession || s.todaySession.attendance_status !== '수업제외')) || 
           (s.todaySession && s.todaySession.attendance_status !== '수업제외' && s.todaySession.attendance_status !== 'none') ||
           (s.todaySession && s.todaySession.attendance_status === '보강');
  }).map(s => s.id), [students, selectedDayKey]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] flex font-sans selection:bg-blue-500/30 overflow-hidden text-xs">
      <Sidebar 
        viewMode={viewMode} setViewMode={setViewMode} 
        todayCount={todayStudents.length} students={students} 
        selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter}
        filterTarget={filterTarget} setFilterTarget={setFilterTarget} // 💡 추가된 프롭
      />
      <main className="flex-1 h-screen overflow-y-auto bg-[#080808] relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Loader2 className="animate-spin mb-4" size={32} /><p className="text-[10px] font-black uppercase tracking-[0.4em]">Syncing Academy Data...</p>
          </div>
        ) : (
          <div className="h-full">
            {viewMode === 'board' && (
              <Overview 
                todayStudents={todayStudents} 
                filteredAllStudents={filteredAllStudents} // 💡 항상 목록 표시
                allTodayIds={allTodayIds} // 💡 추가
                selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} 
                todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={isBatchMode} setIsBatchMode={setIsBatchMode}
                onBatchAdd={batchAddStudents} onRemoveFromToday={removeStudentFromToday}
                onAddNewStudent={handleAddNewStudent}
                masterTextbooks={availableTextbooks}
              />
            )}
            {viewMode === 'studentEdit' && (
              <Overview 
                todayStudents={[]} // 💡 상단 섹션 숨김용 빈 배열
                filteredAllStudents={filteredAllStudents} // 💡 필터링된 전체 학생 표시
                allTodayIds={[]} // 에디트 모드에서는 제외 로직 불필요
                selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} 
                todayKey={selectedDayKey} selectedFilter={selectedFilter} isBatchMode={false} setIsBatchMode={() => {}}
                onBatchAdd={async () => {}} onRemoveFromToday={removeStudentFromToday}
                onAddNewStudent={handleAddNewStudent}
                masterTextbooks={availableTextbooks}
                title="전체 학생 정보 관리" 
                showAddButton={true} // 💡 수정 모드에서만 버튼 표시
                hideTodaySection={true} // 💡 상단 섹션 완전히 제거
              />
            )}
            {viewMode === 'todayTable' && <TodaySheet students={todayStudents} selectedDate={selectedDate} onDateChange={setSelectedDate} masterTextbooks={availableTextbooks} onSave={saveTodaySession} />}
            {viewMode === 'progress' && <ProgressSequencer students={students.filter(s => !s.is_deleted)} masterTextbooks={availableTextbooks} />}
            {viewMode === 'monthlyChanges' && <MonthlyChanges students={students} />}
          </div>
        )}
      </main>
      <AnimatePresence>
        {selectedStudentId && selectedStudent && !isBatchMode && (
          <>
            {viewMode === 'studentEdit' ? (
              <StudentDetailDrawer 
                student={selectedStudent} 
                availableTextbooks={availableTextbooks} 
                isRefreshingBooks={isRefreshingBooks} 
                onRefreshBooks={refreshTextbooks} 
                onUpdateInfo={updateStudentInfo} 
                onAddToToday={addStudentToToday} 
                onClose={() => setSelectedStudentId(null)} 
              />
            ) : (
              <StudentStudyReportDrawer 
                student={selectedStudent} 
                onClose={() => setSelectedStudentId(null)} 
                onEditMode={() => setViewMode('studentEdit')}
              />
            )}
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>{selectedStudentId && !isBatchMode && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStudentId(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />)}</AnimatePresence>
    </div>
  );
}
