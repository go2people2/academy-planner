'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, BookOpen, BarChart3, Calendar, MessageSquare, 
  TrendingUp, CheckCircle2, AlertCircle, Clock, 
  ChevronRight, BookMarked, Target, GraduationCap,
  Check, Square, CheckSquare, Trash2, Edit3, Plus, Loader2
} from 'lucide-react';
import { Student, SessionLog, TextbookOption } from '@/types/dashboard';
import { supabase } from '@/lib/supabase';

interface StudentStudyReportDrawerProps {
  student: Student;
  availableTextbooks: TextbookOption[];
  onClose: () => void;
  onEditMode: () => void;
  onRefreshStudents?: () => Promise<void>;
}

type TabType = 'summary' | 'history' | 'stats' | 'roadmap' | 'journal';

export default function StudentStudyReportDrawer({ student, availableTextbooks, onClose, onEditMode, onRefreshStudents }: StudentStudyReportDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary');

  // 💡 실데이터 기반 통계 계산
  const stats = useMemo(() => {
    const logs = student.allLogs || [];
    const recentLogs = logs.slice(0, 20);
    
    // 1. 출석률 계산
    const attendances = recentLogs.filter(l => l.attendance_status === '출석' || l.attendance_status === '보강' || l.attendance_status === '온라인');
    const attendanceRate = recentLogs.length > 0 ? Math.round((attendances.length / recentLogs.length) * 100) : 0;

    // 2. 숙제 이행률 (등급 기반)
    const statusWeight = { 'perfect': 100, 'good': 85, 'neutral': 70, 'poor': 40, 'bad': 20, 'none': 0 };
    const validHomeworkLogs = recentLogs.filter(l => l.status && l.status !== 'none');
    const totalHwScore = validHomeworkLogs.reduce((acc, l) => acc + (statusWeight[l.status as keyof typeof statusWeight] || 0), 0);
    const homeworkRate = validHomeworkLogs.length > 0 ? Math.round(totalHwScore / validHomeworkLogs.length) : 0;

    // 3. 테스트 평균 (최근 5회)
    const testLogs = logs.filter(l => l.test_score !== null && l.test_score !== undefined).slice(0, 5);
    const avgTestScore = testLogs.length > 0 ? Math.round(testLogs.reduce((acc, l) => acc + (Number(l.test_score) || 0), 0) / testLogs.length) : 0;

    // 4. 이번 달 결석 / 보강 횟수 계산
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthStr = String(currentMonth + 1).padStart(2, '0');
    const currentMonthPrefix = `${currentYear}-${currentMonthStr}`;

    const thisMonthLogs = logs.filter(l => l.date && l.date.startsWith(currentMonthPrefix));
    const absencesCount = thisMonthLogs.filter(l => l.attendance_status === '결석').length;
    const makeupsCount = thisMonthLogs.filter(l => l.attendance_status && l.attendance_status.startsWith('보강')).length;
    const currentMonthName = `${currentMonth + 1}월`;

    return { 
      attendanceRate, 
      homeworkRate, 
      avgTestScore, 
      testCount: testLogs.length,
      absencesCount,
      makeupsCount,
      currentMonthName
    };
  }, [student.allLogs]);

  return (
    <motion.div 
      initial={{ x: '100%' }} 
      animate={{ x: 0 }} 
      exit={{ x: '100%' }} 
      transition={{ type: 'spring', damping: 30, stiffness: 200 }} 
      className="fixed inset-y-0 right-0 w-[550px] bg-[#080808]/98 backdrop-blur-3xl border-l border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden shadow-blue-900/10"
    >
      {/* 1. 상단 학생 정보 섹션 */}
      <div className="relative p-8 pb-6 border-b border-white/5 bg-gradient-to-br from-blue-600/10 to-transparent">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 transition-colors">
          <X size={18} />
        </button>

        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-[4px] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <GraduationCap className="text-white" size={32} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-white tracking-tight">{student.name}</h2>
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-[2px] text-[10px] font-black uppercase tracking-widest">
                {student.grade}
              </span>
            </div>
            <p className="text-gray-400 font-bold text-[11px] flex items-center gap-2">
              <span className="text-blue-400">{student.school}</span>
              <span className="opacity-30">|</span>
              <span>{student.class}</span>
            </p>
            <div className="flex gap-1.5 mt-2">
              {['출석 안정', '숙제 우수', '진도 빠름'].map(tag => (
                <span key={tag} className="text-[9px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-[2px] border border-white/5 italic">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 네비게이션 탭 */}
      <div className="flex px-4 py-2 gap-1 bg-[#0a0a0a] border-b border-white/5 overflow-x-auto custom-scrollbar-h">
        <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} icon={<TrendingUp size={14}/>} label="종합 요약" />
        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<BookMarked size={14}/>} label="교재 히스토리" />
        <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart3 size={14}/>} label="학습 통계" />
        <TabButton active={activeTab === 'roadmap'} onClick={() => setActiveTab('roadmap')} icon={<Target size={14}/>} label="미래 로드맵" />
        <TabButton active={activeTab === 'journal'} onClick={() => setActiveTab('journal')} icon={<MessageSquare size={14}/>} label="상담 일지" />
      </div>

      {/* 3. 메인 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar-v p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && <SummaryTab key="summary" student={student} stats={stats} availableTextbooks={availableTextbooks} />}
          {activeTab === 'history' && <HistoryTab key="history" student={student} availableTextbooks={availableTextbooks} onRefreshStudents={onRefreshStudents} />}
          {activeTab === 'stats' && <StatsTab key="stats" student={student} onRefreshStudents={onRefreshStudents} />}
          {activeTab === 'roadmap' && <RoadmapTab key="roadmap" student={student} />}
          {activeTab === 'journal' && <JournalTab key="journal" student={student} />}
        </AnimatePresence>
      </div>

      {/* 4. 하단 버튼 */}
      <div className="p-6 border-t border-white/5 bg-[#0a0a0a]/50 flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 px-4 bg-white/5 text-gray-400 rounded-[2px] text-[11px] font-black uppercase hover:bg-white/10 transition-all border border-white/5">
          Close Report
        </button>
        <button onClick={onEditMode} className="flex-1 py-3 px-4 bg-blue-600/10 text-blue-400 rounded-[2px] text-[11px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all border border-blue-500/20">
          학생 정보 수정
        </button>
      </div>
    </motion.div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 rounded-[2px] transition-all whitespace-nowrap ${
        active 
          ? 'bg-blue-600/10 text-blue-500 border-b-2 border-blue-600 rounded-b-none' 
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {icon}
      <span className="text-[11px] font-black uppercase tracking-tight">{label}</span>
    </button>
  );
}

function SummaryTab({ student, stats, availableTextbooks }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* 기본 주요 지표 */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="평균 출석률" value={`${stats.attendanceRate}%`} sub="최근 20세션" color="text-emerald-500" icon={<CheckCircle2 size={16}/>} />
        <MetricCard label="숙제 이행률" value={`${stats.homeworkRate}%`} sub="최근 4주" color="text-blue-500" icon={<BookOpen size={16}/>} />
        <MetricCard label="테스트 평균" value={`${stats.avgTestScore}점`} sub="최근 5회" color="text-orange-500" icon={<BarChart3 size={16}/>} />
      </div>

      {/* 당월 출결 및 보강 통계 */}
      <section className="space-y-3">
        <SectionTitle title={`${stats.currentMonthName} 출결 및 보강 통계`} />
        <div className="grid grid-cols-2 gap-4">
          <MetricCard 
            label="이번 달 결석" 
            value={`${stats.absencesCount}회`} 
            sub="당월 누적 결석" 
            color="text-rose-400" 
            icon={<AlertCircle size={16} className="text-rose-400" />} 
          />
          <MetricCard 
            label="이번 달 보강 진행" 
            value={`${stats.makeupsCount}회`} 
            sub="당월 누적 보강" 
            color="text-blue-400" 
            icon={<Clock size={16} className="text-blue-400" />} 
          />
        </div>
      </section>

      {/* 💡 학생 관리 메모 (노란 삼각형 클릭 시 주요 확인 대상) */}
      {student.management_notes && (
        <section className="space-y-4">
          <SectionTitle title="학습 지도 시 주의사항" />
          <div className="relative group/postit">
            <div className="absolute inset-0 bg-amber-200 rounded-sm shadow-[5px_5px_15px_rgba(0,0,0,0.3)] rotate-[-1deg]" />
            <div className="relative bg-amber-100/90 backdrop-blur-sm p-6 min-h-[100px] rounded-sm flex flex-col shadow-inner">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-900/10 opacity-60">
                <AlertCircle size={14} className="text-amber-700" />
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Management Sticky Note</span>
              </div>
              <p className="text-[14px] font-bold text-amber-950 leading-relaxed whitespace-pre-wrap italic">
                "{student.management_notes}"
              </p>
              <div className="absolute bottom-2 right-4 flex items-center gap-1 opacity-20">
                <span className="text-[8px] font-black text-amber-900 uppercase">Registered Info</span>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-amber-300/50 rounded-tl-full shadow-[-2px_-2px_5px_rgba(0,0,0,0.1)] pointer-events-none" />
          </div>
        </section>
      )}

      <section className="space-y-4">
        <SectionTitle title="현재 학습 중인 교재" />
        <div className="space-y-2">
          {student.assigned_books.filter((code: string) => {
            if (!code) return false;
            const status = student.book_courses?.[code];
            return !String(status).includes('-done') && !String(status).includes('-keep');
          }).map((bookCode: string) => {
            const bookInfo = availableTextbooks?.find((b: any) => b.bookcode === bookCode);
            const bookTitle = bookInfo?.title || bookCode;
            const bookLogs = student.allLogs.filter((l: any) => l.classwork_text?.includes(bookTitle) || l.homework_text?.includes(bookTitle));
            const progress = Math.min(Math.round((bookLogs.length / 15) * 100), 95) || 5;

            return (
              <div key={bookCode} className="bg-white/5 border border-white/5 p-4 rounded-[4px] flex items-center justify-between group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-[2px] flex items-center justify-center text-blue-500">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black text-white">{bookTitle}</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                      {bookLogs.length > 0 ? `최근 ${bookLogs.length}회 세션 학습` : '최근 학습 기록 없음'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-black text-blue-500">{progress}%</div>
                  <div className="w-24 h-1 bg-white/10 rounded-[2px] mt-1 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-blue-500" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="최근 특이사항" />
        <div className="bg-white/[0.02] border border-white/5 rounded-[4px] p-5 space-y-4">
          {student.allLogs.filter((l: any) => l.special_notes).slice(0, 2).map((log: any, idx: number) => (
            <div key={log.id || `${log.date}-${idx}`} className="flex gap-4">
              <div className="shrink-0 text-[10px] font-black text-gray-600 tabular-nums pt-1">{log.date}</div>
              <p className="text-[11px] font-medium text-gray-400 leading-relaxed italic">"{log.special_notes}"</p>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}

function HistoryTab({ student, availableTextbooks, onRefreshStudents }: any) {
  const { activeBooks, completedBooks } = useMemo(() => {
    const active: any[] = [];
    const completed: any[] = [];
    
    const assigned = student.assigned_books || [];
    const courses = student.book_courses || {};
    const defaultCourse = student.course || 'C';
    
    assigned.forEach((code: string) => {
      if (!code) return;
      const bookInfo = availableTextbooks?.find((b: any) => b.bookcode === code);
      const title = bookInfo?.title || code;
      const rawVal = courses[code] || defaultCourse;
      
      let course = 'C';
      if (rawVal.startsWith('E') || rawVal.startsWith('D') || rawVal.startsWith('C') || rawVal.startsWith('B') || rawVal.startsWith('A')) {
        course = rawVal.charAt(0);
      }
      
      const isDone = rawVal.includes('-done');
      const isKeep = rawVal.includes('-keep');
      
      const bookLogs = (student.allLogs || []).filter((l: any) => 
        l.classwork_text?.includes(title) || l.homework_text?.includes(title)
      );
      const count = bookLogs.length;
      
      if (isDone) {
        let periodText = '완료됨';
        if (rawVal.includes('-done-')) {
          const info = rawVal.split('-done-')[1]; // "중2_2월-중2_5월"
          if (info.includes('-')) {
            const [start, end] = info.split('-');
            const [startG, startM] = start.split('_');
            const [endG, endM] = end.split('_');
            if (startG === endG) {
              periodText = `${startG} ${startM} ~ ${endM}`;
            } else {
              periodText = `${startG} ${startM} ~ ${endG} ${endM}`;
            }
          } else if (info.includes('_')) {
            const parts = info.split('_');
            if (parts.length >= 3) {
              periodText = `${parts[0]} ${parts[1]} ~ ${parts[2]}`;
            }
          }
        }
        completed.push({ code, title, course, count, periodText });
      } else {
        let startInfo = '';
        if (rawVal.includes('-start-')) {
          const part = rawVal.split('-start-')[1];
          if (part.includes('_')) {
            const [g, m] = part.split('_');
            startInfo = `${g} ${m} 시작`;
          }
        }
        active.push({ code, title, course, count, isKeep, startInfo });
      }
    });
    
    return { activeBooks: active, completedBooks: completed };
  }, [student.assigned_books, student.book_courses, student.course, student.allLogs, availableTextbooks]);

  // 💡 완료 교재 진행 중으로 복구 처리
  const handleRestoreBook = async (code: string, currentCourse: string) => {
    if (!confirm(`[${code}] 교재를 다시 진행 중으로 복구하시겠습니까?`)) return;
    try {
      const newCourses = { ...(student.book_courses || {}), [code]: currentCourse };
      const { error } = await supabase
        .from('ams_students')
        .update({ book_courses: newCourses })
        .eq('id', student.id);
      
      if (!error) {
        alert('진행 중 교재로 복구되었습니다.');
        if (onRefreshStudents) await onRefreshStudents();
      } else {
        throw error;
      }
    } catch (e) {
      console.error(e);
      alert('복구에 실패했습니다.');
    }
  };

  // 💡 교재 완전 삭제 처리
  const handleRemoveBook = async (code: string) => {
    if (!confirm(`[${code}] 교재 배정을 완전히 해제하시겠습니까?`)) return;
    try {
      const newBooks = (student.assigned_books || []).filter((b: string) => b !== code);
      const newCourses = { ...(student.book_courses || {}) };
      delete newCourses[code];
      
      const { error } = await supabase
        .from('ams_students')
        .update({ assigned_books: newBooks, book_courses: newCourses })
        .eq('id', student.id);
        
      if (!error) {
        alert('교재 배정이 완전히 해제되었습니다.');
        if (onRefreshStudents) await onRefreshStudents();
      } else {
        throw error;
      }
    } catch (e) {
      console.error(e);
      alert('해제에 실패했습니다.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-left">
      {/* 1. 진행 중인 교재 */}
      <section className="space-y-4">
        <SectionTitle title="현재 진행 중인 교재 (Active)" />
        {activeBooks.length > 0 ? (
          <div className="space-y-3">
            {activeBooks.map((item, idx) => (
              <div key={`active-${item.code}-${idx}`} className={`border p-4 rounded-[4px] flex items-center justify-between group transition-all ${item.isKeep ? 'bg-amber-500/5 border-amber-500/10 opacity-60' : 'bg-white/5 border-white/5 hover:border-blue-500/30'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-[2px] flex items-center justify-center ${item.isKeep ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-600/20 text-blue-500'}`}>
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black text-white flex items-center gap-2">
                      {item.title}
                      {item.isKeep && <span className="text-[8px] bg-amber-500 text-black px-1.5 py-0.5 rounded-sm font-black uppercase tracking-tighter">Keep</span>}
                    </h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2 mt-1">
                      <span>코스: {item.course}</span>
                      <span>•</span>
                      <span>{item.count > 0 ? `누적 ${item.count}회 학습` : '기록 없음'}</span>
                      {item.startInfo && (
                        <>
                          <span>•</span>
                          <span className="text-blue-400/80">{item.startInfo}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-gray-700 font-bold uppercase text-center py-10 tracking-widest bg-white/[0.01] border border-white/5 rounded-[4px]">진행 중인 교재가 없습니다.</p>
        )}
      </section>

      {/* 2. 완료한 교재 히스토리 */}
      <section className="space-y-4">
        <SectionTitle title="완료한 교재 히스토리 (Completed History)" />
        {completedBooks.length > 0 ? (
          <div className="relative pl-8 space-y-6 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-emerald-500/10">
            {completedBooks.map((item, idx) => (
              <div key={`completed-${item.code}-${idx}`} className="relative">
                <div className="absolute -left-[30px] top-1.5 w-6 h-6 rounded-full bg-[#080808] border-2 border-emerald-500 flex items-center justify-center z-10 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-[4px] space-y-2 group hover:bg-emerald-500/[0.08] transition-all flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-emerald-400/80 uppercase tracking-tighter font-mono">{item.periodText} 사용</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-400 uppercase">Completed</span>
                    </div>
                    <h4 className="text-[13px] font-black text-white tracking-tight">{item.title}</h4>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <span>코스: {item.course}</span>
                      <span>•</span>
                      <span>총 {item.count}회 세션 학습됨</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleRestoreBook(item.code, item.course)}
                      className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-[2px] text-[8px] font-black uppercase hover:bg-blue-500 hover:text-white transition-all"
                      title="진행 중으로 복구"
                    >
                      복구
                    </button>
                    <button 
                      onClick={() => handleRemoveBook(item.code)}
                      className="px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-[2px] text-[8px] font-black uppercase hover:bg-red-500 hover:text-white transition-all"
                      title="교재 배정 해제"
                    >
                      해제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-gray-700 font-bold uppercase text-center py-20 tracking-widest bg-white/[0.01] border border-white/5 rounded-[4px]">완료한 교재가 없습니다.</p>
        )}
      </section>
    </motion.div>
  );
}

function StatsTab({ student, onRefreshStudents }: { student: Student; onRefreshStudents?: () => Promise<void> }) {
  const testData = useMemo(() => (student.allLogs || []).filter((l: any) => l.test_score !== null).slice(0, 10).reverse(), [student.allLogs]);
  const [updatingLogId, setUpdatingLogId] = useState<string | null>(null);

  // 1. 결석/지각 내역 필터링 (최신순)
  const attendanceLogs = useMemo(() => {
    return (student.allLogs || [])
      .filter((l: any) => l.attendance_status === '결석' || l.attendance_status === '지각')
      .sort((a: any, b: any) => b.date.localeCompare(a.date));
  }, [student.allLogs]);

  // 2. 보강 토글 핸들러
  const handleToggleMakeup = async (log: any) => {
    if (updatingLogId) return;
    setUpdatingLogId(log.id);

    try {
      const currentNotes = log.special_notes || '';
      let newNotes = '';
      
      if (currentNotes.includes('[보강완료]')) {
        newNotes = currentNotes.replace('[보강완료]', '').trim();
      } else {
        newNotes = currentNotes ? `${currentNotes} [보강완료]` : '[보강완료]';
      }

      const { error } = await supabase
        .from('ams_session_logs')
        .update({ special_notes: newNotes })
        .eq('id', log.id);

      if (error) throw error;

      if (onRefreshStudents) {
        await onRefreshStudents();
      }
    } catch (err) {
      console.error('Error toggling makeup status:', err);
      alert('보강 상태 변경에 실패했습니다.');
    } finally {
      setUpdatingLogId(null);
    }
  };

  // 3. 보강완료 텍스트 제거하고 순수 사유만 추출하는 헬퍼
  const getPureReason = (notes: string) => {
    if (!notes) return '사유 미기재';
    const clean = notes.replace('[보강완료]', '').trim();
    return clean || '사유 미기재';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
      {/* 테스트 점수 추이 */}
      <section className="space-y-6">
        <SectionTitle title="최근 테스트 점수 추이" />
        {testData.length > 0 ? (
          <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[4px]">
            <div className="flex items-end justify-between gap-2 h-40 mb-4">
              {testData.map((log: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-[2px] opacity-0 group-hover:opacity-100 transition-all z-20 whitespace-nowrap">{log.test_score}점</div>
                  <div className="w-full bg-blue-600/10 rounded-t-[2px] relative flex items-end h-32 overflow-hidden border border-white/5">
                    <motion.div initial={{ height: 0 }} animate={{ height: `${log.test_score}%` }} className={`w-full ${log.test_score >= 80 ? 'bg-blue-500' : log.test_score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} />
                  </div>
                  <span className="text-[8px] font-black text-gray-600 rotate-45 origin-left ml-2 mt-1">{log.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : <p className="text-[10px] text-gray-700 font-bold uppercase text-center py-20 tracking-widest">기록된 점수가 없습니다.</p>}
      </section>

      {/* 출결 현황 및 결석 보강 관리 섹션 */}
      <section className="space-y-6">
        <SectionTitle title="결석 및 지각 내역 (보강 관리)" />
        {attendanceLogs.length > 0 ? (
          <div className="bg-white/[0.02] border border-white/5 rounded-lg overflow-hidden">
            <div className="max-h-80 overflow-y-auto pr-0.5 custom-scrollbar-v divide-y divide-white/5">
              {attendanceLogs.map((log: any) => {
                const isAbsent = log.attendance_status === '결석';
                const isLate = log.attendance_status === '지각';
                const isMakeupCompleted = log.special_notes?.includes('[보강완료]');
                const pureReason = getPureReason(log.special_notes || '');
                const isUpdating = updatingLogId === log.id;

                return (
                  <div key={log.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-500 tabular-nums">{log.date.replace(/-/g, '.')}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          isAbsent ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                          {log.attendance_status}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-gray-400">
                        사유: <span className={pureReason === '사유 미기재' ? 'text-gray-600 italic' : 'text-gray-300 font-bold'}>{pureReason}</span>
                      </p>
                    </div>

                    {/* 결석일 경우에만 보강 상태 관리 UI 제공 */}
                    {isAbsent && (
                      <button
                        type="button"
                        onClick={() => handleToggleMakeup(log)}
                        disabled={isUpdating}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-black border transition-all ${
                          isMakeupCompleted
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                        } ${isUpdating ? 'opacity-40 cursor-wait' : ''}`}
                      >
                        {isMakeupCompleted ? (
                          <>
                            <CheckSquare size={12} className="text-emerald-400" />
                            <span>보강 완료 (⭕)</span>
                          </>
                        ) : (
                          <>
                            <Square size={12} className="text-rose-400" />
                            <span>보강 미완료 (❌)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-white/10 rounded-lg py-12 flex flex-col items-center justify-center text-gray-500 gap-1.5">
            <CheckCircle2 size={20} className="text-gray-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider">결석 및 지각 기록이 없습니다.</span>
          </div>
        )}
      </section>
    </motion.div>
  );
}

function RoadmapTab({ student }: any) {
  const roadmap = useMemo(() => {
    const grade = student.grade || '';
    if (grade.includes('초6')) return [{ month: '5월', task: '중등 1-1 기초', sub: '소인수분해 및 정수', active: true }, { month: '6월', task: '중등 1-1 발전', sub: '일차방정식 정복' }, { month: '7월', task: '중등 1-2 선행', sub: '기본 도형 학습' }];
    if (grade.includes('중3')) return [{ month: '5월', task: '고등 수학(상) 시작', sub: '다항식 및 나머지 정리', active: true }, { month: '6월', task: '기말고사 대비', sub: '이차함수 및 통계' }, { month: '7월', task: '고등 수학(상) 심화', sub: '복소수 및 이차방정식' }];
    return [{ month: '5월', task: '현재 과정 심화', sub: '오답 정밀 분석', active: true }, { month: '6월', task: '다음 단원 선행', sub: '기본 예제 학습' }, { month: '7월', task: '여름방학 특강', sub: '취약 단원 보강' }];
  }, [student.grade]);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <SectionTitle title={`학습 로드맵 (${student.grade})`} />
      <div className="space-y-4">
        {roadmap.map((item, i) => <RoadmapItem key={i} month={item.month} task={item.task} sub={item.sub} active={item.active} />)}
      </div>
    </motion.div>
  );
}

function JournalTab({ student }: any) {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [isFetchLoading, setIsFetchLoading] = useState(false);

  // 작성/수정용 상태
  const [newDate, setNewDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 수정 전용 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState('');
  const [editingContent, setEditingContent] = useState('');

  // 1. 상담 데이터 조회 (Read)
  const fetchConsultations = async () => {
    if (!student?.id) return;
    setIsFetchLoading(true);
    try {
      const { data, error } = await supabase
        .from('ams_consultations')
        .select('*')
        .eq('student_id', student.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setConsultations(data || []);
    } catch (err) {
      console.error('Error fetching consultations:', err);
    } finally {
      setIsFetchLoading(false);
    }
  };

  // 학생이 바뀔 때 또는 마운트 시 조회
  useEffect(() => {
    fetchConsultations();
  }, [student?.id]);

  // 2. 상담 데이터 추가 (Create)
  const handleAddConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('ams_consultations')
        .insert({
          student_id: student.id,
          academy_id: student.academy_id,
          date: newDate.replace(/-/g, '.'), // 2026.07.10 형식으로 저장
          content: newContent.trim()
        });

      if (error) throw error;
      setNewContent('');
      
      // 상담일이 오늘 날짜라면 학생 테이블의 'last_consulted_at'도 자동으로 오늘로 연계 업데이트!
      const todayStr = new Date().toISOString().split('T')[0];
      if (newDate === todayStr) {
        await supabase
          .from('ams_students')
          .update({ last_consulted_at: todayStr })
          .eq('id', student.id);
      }

      await fetchConsultations();
    } catch (err) {
      console.error('Error saving consultation:', err);
      alert('상담 일지를 저장하는 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. 상담 데이터 수정 (Update)
  const handleUpdateConsultation = async (id: string) => {
    if (!editingContent.trim()) return;
    try {
      const { error } = await supabase
        .from('ams_consultations')
        .update({
          date: editingDate.replace(/-/g, '.'),
          content: editingContent.trim()
        })
        .eq('id', id);

      if (error) throw error;
      setEditingId(null);
      await fetchConsultations();
    } catch (err) {
      console.error('Error updating consultation:', err);
      alert('상담 일지를 수정하는 중 오류가 발생했습니다.');
    }
  };

  // 4. 상담 데이터 삭제 (Delete)
  const handleDeleteConsultation = async (id: string) => {
    if (!confirm('정말로 이 상담 일지를 영구 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase
        .from('ams_consultations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchConsultations();
    } catch (err) {
      console.error('Error deleting consultation:', err);
      alert('상담 일지를 삭제하는 중 오류가 발생했습니다.');
    }
  };

  // 5. [하이브리드 타임라인 병합] 수업 일지 특이사항 + 학부모 전용 상담 일지
  const mergedFeed = useMemo(() => {
    const feed: any[] = [];

    // 1) 수업 일지 특이사항 (지도 일지)
    const studyLogs = (student.allLogs || []).filter((l: any) => l.special_notes);
    studyLogs.forEach((log: any) => {
      feed.push({
        type: 'study',
        id: log.id || `${log.date}-study`,
        date: log.date.replace(/-/g, '.'),
        content: log.special_notes,
      });
    });

    // 2) 학부모 상담 기록
    consultations.forEach((c: any) => {
      feed.push({
        type: 'consult',
        id: c.id,
        date: c.date.replace(/-/g, '.'),
        content: c.content,
      });
    });

    // 3) 내림차순 정렬 (최신 날짜순)
    return feed.sort((a, b) => b.date.localeCompare(a.date));
  }, [student.allLogs, consultations]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      
      {/* ✍️ 신규 상담 일지 작성 폼 */}
      <div className="bg-amber-500/5 border border-amber-500/10 rounded-[4px] p-4 space-y-3 no-print">
        <div className="flex items-center gap-1.5 text-amber-500 font-black text-[10px] uppercase tracking-wider">
          <MessageSquare size={12} />
          학부모 상담 일지 새 기록
        </div>
        
        <form onSubmit={handleAddConsultation} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 uppercase font-black">상담 일자 :</span>
            <input 
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-[2px] px-2 py-1 text-xs text-white outline-none font-bold focus:border-amber-500/50 [color-scheme:dark]"
              required
            />
          </div>
          
          <textarea 
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="학부모님과 면담하거나 상담한 내용을 자유롭고 자세히 적어보세요..."
            className="w-full h-24 bg-black/40 border border-white/5 rounded-[2px] p-3 text-xs text-gray-100 placeholder:text-gray-600 outline-none focus:border-amber-500/30 transition-all font-bold resize-none leading-relaxed custom-scrollbar-v"
            required
          />
          
          <div className="flex justify-end">
            <button 
              type="submit"
              disabled={isSubmitting || !newContent.trim()}
              className="px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-white rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-45 disabled:pointer-events-none flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Plus size={12} />
                  상담 일지 저장
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 📅 누적 타임라인 피드 */}
      <div className="space-y-4">
        <SectionTitle title="통합 상담 및 지도 피드" />
        
        <div className="space-y-3">
          {mergedFeed.length === 0 ? (
            <div className="p-12 text-center text-gray-600 text-[10px] font-black uppercase tracking-widest italic bg-white/[0.01] border border-dashed border-white/5 rounded-[4px]">
              기록된 상담이나 지도 일지가 없습니다
            </div>
          ) : (
            mergedFeed.map((item) => {
              const isConsult = item.type === 'consult';
              const isEditing = editingId === item.id;

              return (
                <div 
                  key={item.id} 
                  className={`border p-4 rounded-[4px] space-y-2 transition-all shadow-inner ${
                    isConsult 
                      ? 'bg-amber-500/[0.02] border-amber-500/10 hover:border-amber-500/20' 
                      : 'bg-white/5 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-gray-500 flex items-center gap-1.5">
                        <Clock size={12}/> {item.date}
                      </span>
                      {isConsult ? (
                        <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-[2px] uppercase border border-amber-500/20">
                          학부모 상담
                        </span>
                      ) : (
                        <span className="text-[8px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-[2px] uppercase border border-blue-500/10">
                          수업 지도 특이사항
                        </span>
                      )}
                    </div>

                    {/* 수정 / 삭제 단추 (학부모 상담 일지인 경우만 활성화) */}
                    {isConsult && !isEditing && (
                      <div className="flex items-center gap-2 no-print">
                        <button 
                          onClick={() => {
                            setEditingId(item.id);
                            // 날짜 변환 "2026.07.10" -> "2026-07-10"
                            setEditingDate(item.date.replace(/\./g, '-'));
                            setEditingContent(item.content);
                          }}
                          className="text-gray-500 hover:text-amber-500 transition-colors"
                          title="일지 수정"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button 
                          onClick={() => handleDeleteConsultation(item.id)}
                          className="text-gray-500 hover:text-red-500 transition-colors"
                          title="일지 삭제"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 내용 노출 혹은 수정 모드 */}
                  {isEditing ? (
                    <div className="space-y-2 mt-1.5 pt-1 border-t border-white/5 no-print">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] text-gray-500 uppercase font-black">날짜 변경 :</span>
                        <input 
                          type="date"
                          value={editingDate}
                          onChange={(e) => setEditingDate(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-[2px] px-2 py-0.5 text-xs text-white outline-none font-bold focus:border-amber-500/40 [color-scheme:dark]"
                        />
                      </div>
                      <textarea 
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full h-20 bg-black/40 border border-amber-500/20 rounded-[2px] p-2.5 text-xs text-gray-100 focus:border-amber-500/40 outline-none resize-none leading-relaxed font-bold custom-scrollbar-v"
                      />
                      <div className="flex justify-end gap-2 text-[10px]">
                        <button 
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-gray-400 hover:bg-white/5 border border-white/5 rounded-[2px] font-black"
                        >
                          취소
                        </button>
                        <button 
                          onClick={() => handleUpdateConsultation(item.id)}
                          className="px-2.5 py-1 bg-amber-500/15 text-amber-500 border border-amber-500/25 hover:bg-amber-500 hover:text-white rounded-[2px] font-black transition-all"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] font-bold text-gray-300 leading-relaxed whitespace-pre-wrap break-all pl-0.5">
                      {item.content}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

    </motion.div>
  );
}

function MetricCard({ label, value, sub, color, icon }: any) {
  return (
    <div className="bg-white/5 border border-white/5 p-4 rounded-[4px] space-y-1 shadow-inner group hover:border-white/10 transition-all">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-xl font-black tabular-nums ${color}`}>{value}</div>
      <div className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter">{sub}</div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
      <ChevronRight size={14} className="text-blue-500" /> {title}
    </h5>
  );
}

function RoadmapItem({ month, task, sub, active = false }: any) {
  return (
    <div className={`p-4 rounded-[4px] border flex items-center gap-4 transition-all ${active ? 'bg-blue-600/10 border-blue-500/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
      <div className={`w-12 h-12 rounded-[2px] flex flex-col items-center justify-center font-black ${active ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'}`}>
        <span className="text-[10px] uppercase">{month}</span>
      </div>
      <div>
        <h4 className={`text-[13px] font-black ${active ? 'text-white' : 'text-gray-400'}`}>{task}</h4>
        <p className="text-[10px] font-bold text-gray-500">{sub}</p>
      </div>
      {active && <div className="ml-auto animate-pulse text-blue-500"><TrendingUp size={18}/></div>}
    </div>
  );
}
