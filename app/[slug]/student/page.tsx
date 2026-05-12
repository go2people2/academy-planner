'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, ClipboardCheck, Bell, User, LogOut, 
  ChevronRight, Loader2, AlertCircle, CheckCircle2, Hash, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TestAnswerModal from '@/components/dashboard/TestAnswerModal';

export default function StudentPortal() {
  const router = useRouter();
  const { slug } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [todaySession, setTodaySession] = useState<any>(null);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'tests' | 'history'>('today');
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });

  const fetchStudentData = useCallback(async (studentId: string) => {
    try {
      const { data: logs, error: sErr } = await supabase
        .from('ams_session_logs')
        .select('*')
        .eq('student_id', studentId)
        .order('session_date', { ascending: false })
        .limit(50);
      
      if (logs) {
        setAllLogs(logs);
        const today = logs.find(l => l.session_date === selectedDate);
        if (today) {
          let nqText = '', nqCut = 0;
          try {
            if (today.homework_to?.startsWith('{')) {
              const parsed = JSON.parse(today.homework_to);
              nqText = parsed.text || '';
              nqCut = parsed.cut || 0;
            }
          } catch (e) {}
          setTodaySession({ ...today, next_quiz_text: nqText, next_quiz_cut: nqCut });
        }
      }
    } catch (e) {
      console.error('Fetch student data error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    const studentJson = localStorage.getItem('ams_student');
    if (!studentJson) {
      router.push(`/${slug}/login`);
      return;
    }
    const parsedStudent = JSON.parse(studentJson);
    setStudent(parsedStudent);
    fetchStudentData(parsedStudent.id);
  }, [slug, router, fetchStudentData]);

  const handleLogout = () => {
    localStorage.removeItem('ams_student');
    router.push(`/${slug}/login`);
  };

  const handleTestSubmit = async (result: any) => {
    if (!student || isSaving) return;
    setIsSaving(true);
    try {
      const { answers, calculatedScore } = result;
      const updateData: any = {
        student_id: student.id,
        session_date: selectedDate,
        test_answers: answers,
      };
      if (calculatedScore !== undefined) updateData.test_score = calculatedScore;

      const { error } = await supabase.from('ams_session_logs').upsert([updateData], { onConflict: 'student_id, session_date' });
      if (error) throw error;

      alert('테스트 답안이 제출되었습니다.');
      setIsTestModalOpen(false);
      fetchStudentData(student.id);
    } catch (e) {
      console.error('Test submit error:', e);
      alert('제출 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !student) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-gray-500">
        <Loader2 className="animate-spin mb-4" size={32} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Loading Student Profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] font-sans pb-24">
      {/* 학생 상단 바 */}
      <header className="p-6 flex items-center justify-between bg-[#0a0a0a] border-b border-white/5 sticky top-0 z-20 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-sm flex items-center justify-center shadow-lg shadow-blue-600/20">
            <User className="text-white" size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-white truncate">{student.name} 학생</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate">
              {student.grade} · {student.class_name || '일반반'}
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-white transition-all active:scale-95">
          <LogOut size={20} />
        </button>
      </header>

      <main className="p-4 space-y-6 max-w-md mx-auto min-h-[calc(100vh-180px)]">
        <AnimatePresence mode="wait">
          {activeTab === 'today' && (
            <motion.div key="today" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
              {todaySession?.special_notes && (
                <section className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-sm flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0"><Bell className="text-blue-500" size={20} /></div>
                  <div><h3 className="text-xs font-bold text-blue-400">선생님 한마디</h3><p className="text-[11px] text-gray-300 leading-relaxed mt-0.5 whitespace-pre-wrap">{todaySession.special_notes}</p></div>
                </section>
              )}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1"><h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2"><BookOpen size={14} /> 오늘의 학습 & 과제</h3></div>
                <div className="space-y-3">
                  <div className="bg-[#0f0f0f] border border-white/5 p-4 rounded-sm">
                    <div className="flex items-center gap-2 mb-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-tighter">Classwork</h4></div>
                    <p className="text-[13px] font-bold text-white whitespace-pre-wrap">{todaySession?.classwork_text || '기록된 진도가 없습니다.'}</p>
                  </div>
                  <div className="bg-[#0f0f0f] border border-white/5 p-4 rounded-sm">
                    <div className="flex items-center gap-2 mb-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /><h4 className="text-[11px] font-black text-blue-500 uppercase tracking-tighter">Homework</h4></div>
                    <p className="text-[13px] font-bold text-white whitespace-pre-wrap">{todaySession?.homework_text || '기록된 숙제가 없습니다.'}</p>
                  </div>
                  {todaySession?.test_status && (
                    <div className="bg-[#0f0f0f] border border-white/5 p-4 rounded-sm">
                      <div className="flex items-center gap-2 mb-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /><h4 className="text-[11px] font-black text-amber-500 uppercase tracking-tighter">Today's Test</h4></div>
                      <div className="flex items-center justify-between"><p className="text-[13px] font-bold text-white">{todaySession.test_status}</p><span className="text-lg font-black text-amber-500 tabular-nums">{todaySession.test_score !== null ? `${todaySession.test_score}%` : '진행 중'}</span></div>
                    </div>
                  )}
                </div>
              </section>
              {todaySession?.next_quiz_text && (
                <section className="bg-indigo-600/10 border border-indigo-500/20 p-5 rounded-sm space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><ClipboardCheck size={60} className="text-indigo-500" /></div>
                  <div className="flex items-center gap-2"><AlertCircle size={14} className="text-indigo-400" /><h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Next Quiz</h3></div>
                  <p className="text-sm font-black text-white">{todaySession.next_quiz_text}</p>
                  <div className="flex items-center gap-2 mt-2"><span className="text-[10px] font-bold text-indigo-300/60 uppercase">Goal:</span><span className="px-2 py-0.5 bg-indigo-500 text-white text-[9px] font-black rounded-full">오답 {todaySession.next_quiz_cut}개 이하 통과</span></div>
                </section>
              )}
              <section className="pt-4">
                <button onClick={() => setIsTestModalOpen(true)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-sm shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 transition-all active:scale-95 text-sm uppercase tracking-wider"><ClipboardCheck size={20} /> 테스트 답안 입력하기</button>
              </section>
            </motion.div>
          )}

          {activeTab === 'tests' && (
            <motion.div key="tests" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 px-1"><ClipboardCheck size={14} /> My Test Archive</h3>
              
              {/* 💡 성적 추이 그래프 추가 */}
              <GradeGraph logs={allLogs} />

              <div className="space-y-3">
                {allLogs.filter(l => l.test_score !== null).map((log, i) => (
                  <div key={i} className="bg-[#0f0f0f] border border-white/5 p-4 rounded-sm flex items-center justify-between">
...
function GradeGraph({ logs }: { logs: any[] }) {
  const chartData = useMemo(() => {
    return logs
      .filter(l => l.test_score !== null)
      .slice(0, 10)
      .reverse();
  }, [logs]);

  if (chartData.length < 2) return null;

  return (
    <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-sm space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <TrendingUp size={12} className="text-blue-500" /> Performance Trend
        </h4>
        <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">최근 10회</span>
      </div>
      
      <div className="h-32 flex items-end justify-between gap-1.5 px-2 pt-4 relative">
        {/* 배경 가이드 라인 */}
        <div className="absolute inset-x-0 top-4 bottom-0 flex flex-col justify-between pointer-events-none opacity-20">
          <div className="border-t border-dashed border-white/20 w-full" />
          <div className="border-t border-dashed border-white/20 w-full" />
          <div className="border-t border-dashed border-white/20 w-full" />
        </div>

        {chartData.map((data, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
            {/* 툴팁 */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
              {data.test_score}%
            </div>
            
            <div className="w-full bg-blue-500/10 rounded-t-[1px] relative flex items-end h-24 overflow-hidden">
              <motion.div 
                initial={{ height: 0 }} 
                animate={{ height: `${data.test_score}%` }} 
                transition={{ delay: i * 0.05, duration: 1, ease: "easeOut" }}
                className={`w-full ${data.test_score >= 80 ? 'bg-blue-500' : data.test_score >= 60 ? 'bg-amber-500' : 'bg-red-500'} shadow-[0_0_15px_rgba(59,130,246,0.3)]`} 
              />
            </div>
            <span className="text-[7px] font-black text-gray-600 rotate-45 origin-left whitespace-nowrap ml-1">{data.session_date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 px-1"><Clock size={14} /> Learning History</h3>
              <div className="relative pl-4 space-y-8 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-white/5">
                {allLogs.map((log, i) => (
                  <div key={i} className="relative pl-6">
                    <div className="absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    <div className="bg-[#0f0f0f] border border-white/5 p-4 rounded-sm space-y-3">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">{log.session_date}</p>
                      <div><h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-tighter mb-1">Classwork</h4><p className="text-[12px] font-bold text-white leading-relaxed">{log.classwork_text || '-'}</p></div>
                      <div><h4 className="text-[11px] font-black text-blue-500 uppercase tracking-tighter mb-1">Homework</h4><p className="text-[12px] font-bold text-gray-300 leading-relaxed">{log.homework_text || '-'}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-2xl border-t border-white/5 px-8 py-4 flex justify-between items-center z-30">
        <button onClick={() => setActiveTab('today')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'today' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}><BookOpen size={20} /><span className="text-[9px] font-bold uppercase">Today</span></button>
        <button onClick={() => setActiveTab('tests')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'tests' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}><ClipboardCheck size={20} /><span className="text-[9px] font-bold uppercase">Tests</span></button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}><Clock size={20} /><span className="text-[9px] font-bold uppercase">History</span></button>
      </nav>

      <AnimatePresence>
        {isTestModalOpen && (
          <TestAnswerModal 
            testId={todaySession?.test_status || ''}
            studentName={student.name}
            onClose={() => setIsTestModalOpen(false)}
            onSave={handleTestSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
