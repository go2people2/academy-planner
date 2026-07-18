'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, BookOpen, BarChart3, Calendar, MessageSquare, 
  TrendingUp, CheckCircle2, AlertCircle, Clock, 
  ChevronRight, BookMarked, Target, GraduationCap,
  Check, Square, CheckSquare, Trash2, Edit3, Plus, Loader2,
  Sparkles, Award
} from 'lucide-react';
import { Student, SessionLog, TextbookOption } from '@/types/dashboard';
import { supabase } from '@/lib/supabase';
import AIConsultationBriefing from './AIConsultationBriefing';

interface StudentStudyReportDrawerProps {
  student: Student;
  availableTextbooks: TextbookOption[];
  onClose: () => void;
  onEditMode: () => void;
  onRefreshStudents?: () => Promise<void>;
  isLight?: boolean;
}

type TabType = 'summary' | 'history' | 'stats' | 'roadmap' | 'journal' | 'ai-briefing' | 'school-scores';

export default function StudentStudyReportDrawer({ student, availableTextbooks, onClose, onEditMode, onRefreshStudents, isLight = false }: StudentStudyReportDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary');

  // 💡 실데이터 기반 통계 계산
  const stats = useMemo(() => {
    const logs = student.allLogs || [];
    // 💡 [안정화] 수업제외, 수업취소 등 학생 결석과 무관하게 수업이 미진행된 날은 출석률 모수(분모)에서 제외한 뒤 최근 20회를 가져옵니다.
    const validLogs = logs.filter(l => l.attendance_status && !['수업제외', '수업취소'].includes(l.attendance_status));
    const recentLogs = validLogs.slice(0, 20);
    
    // 1. 출석률 계산 (보강:시간 형태도 누락 없이 출석으로 인정)
    const attendances = recentLogs.filter(l => 
      l.attendance_status === '출석' || 
      l.attendance_status === '온라인' || 
      l.attendance_status.startsWith('bo강') || // 보강 오타 방지
      l.attendance_status.startsWith('보강')
    );
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
      className={`fixed inset-y-0 right-0 w-[550px] backdrop-blur-3xl border-l shadow-2xl z-50 flex flex-col overflow-hidden transition-all ${
        isLight 
          ? 'bg-white border-gray-250 shadow-gray-400/20 text-[#37352f]' 
          : 'bg-[#080808]/98 border-white/10 shadow-blue-900/10 text-white'
      }`}
    >
      {/* 1. 상단 학생 정보 섹션 */}
      <div className={`relative p-8 pb-6 border-b transition-all ${
        isLight 
          ? 'border-gray-150 bg-gradient-to-br from-blue-50 to-transparent' 
          : 'border-white/5 bg-gradient-to-br from-blue-600/10 to-transparent'
      }`}>
        <button onClick={onClose} className={`absolute top-6 right-6 p-2 rounded-full transition-colors ${
          isLight ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-white/5 text-gray-400 hover:bg-white/10'
        }`}>
          <X size={18} />
        </button>

        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 rounded-[4px] flex items-center justify-center shadow-lg ${
            isLight ? 'bg-blue-600 shadow-blue-600/15' : 'bg-blue-600 shadow-blue-600/20'
          }`}>
            <GraduationCap className="text-white" size={32} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className={`text-2xl font-black tracking-tight ${isLight ? 'text-[#37352f]' : 'text-white'}`}>{student.name}</h2>
              <span className={`px-2 py-0.5 border rounded-[2px] text-[10px] font-black uppercase tracking-widest ${
                isLight ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
              }`}>
                {student.grade}
              </span>
            </div>
            <p className={`font-bold text-[11px] flex items-center gap-2 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
              <span className={isLight ? 'text-blue-600' : 'text-blue-400'}>{student.school}</span>
              <span className="opacity-30">|</span>
              <span>{student.class}</span>
            </p>
            <div className="flex gap-1.5 mt-2">
              {['출석 안정', '숙제 우수', '진도 빠름'].map(tag => (
                <span key={tag} className={`text-[9px] font-bold px-2 py-0.5 rounded-[2px] border italic ${
                  isLight ? 'text-gray-500 bg-gray-50 border-gray-200' : 'text-gray-500 bg-white/5 border-white/5'
                }`}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 네비게이션 탭 */}
      <div className={`flex px-4 py-2 gap-1 border-b overflow-x-auto custom-scrollbar-h ${
        isLight ? 'bg-gray-50 border-gray-200' : 'bg-[#0a0a0a] border-white/5'
      }`}>
        <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} icon={<TrendingUp size={14}/>} label="종합 요약" isLight={isLight} />
        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<BookMarked size={14}/>} label="교재 히스토리" isLight={isLight} />
        <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart3 size={14}/>} label="학습 통계" isLight={isLight} />
        <TabButton active={activeTab === 'roadmap'} onClick={() => setActiveTab('roadmap')} icon={<Target size={14}/>} label="미래 로드맵" isLight={isLight} />
        <TabButton active={activeTab === 'journal'} onClick={() => setActiveTab('journal')} icon={<MessageSquare size={14}/>} label="상담 일지" isLight={isLight} />
        <TabButton active={activeTab === 'ai-briefing'} onClick={() => setActiveTab('ai-briefing')} icon={<Sparkles size={14}/>} label="🤖 AI 브리핑" isLight={isLight} />
        <TabButton active={activeTab === 'school-scores'} onClick={() => setActiveTab('school-scores')} icon={<Award size={14}/>} label="📊 학교 성적" isLight={isLight} />
      </div>

      {/* 3. 메인 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar-v p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && <SummaryTab key="summary" student={student} stats={stats} availableTextbooks={availableTextbooks} isLight={isLight} />}
          {activeTab === 'history' && <HistoryTab key="history" student={student} availableTextbooks={availableTextbooks} onRefreshStudents={onRefreshStudents} isLight={isLight} />}
          {activeTab === 'stats' && <StatsTab key="stats" student={student} onRefreshStudents={onRefreshStudents} isLight={isLight} />}
          {activeTab === 'roadmap' && <RoadmapTab key="roadmap" student={student} isLight={isLight} />}
          {activeTab === 'journal' && <JournalTab key="journal" student={student} isLight={isLight} />}
          {activeTab === 'ai-briefing' && <AIConsultationBriefing key="ai-briefing" student={student} isLight={isLight} />}
          {activeTab === 'school-scores' && <SchoolScoresTab key="school-scores" student={student} isLight={isLight} />}
        </AnimatePresence>
      </div>

      {/* 4. 하단 버튼 */}
      <div className={`p-6 border-t flex gap-3 ${
        isLight ? 'border-gray-200 bg-gray-50' : 'border-white/5 bg-[#0a0a0a]/50'
      }`}>
        <button onClick={onClose} className={`flex-1 py-3 px-4 rounded-[2px] text-[11px] font-black uppercase transition-all border ${
          isLight ? 'bg-white hover:bg-gray-50 text-gray-600 border-gray-250 shadow-sm' : 'bg-white/5 text-gray-400 hover:bg-white/10 border-white/5'
        }`}>
          Close Report
        </button>
        <button onClick={onEditMode} className={`flex-1 py-3 px-4 rounded-[2px] text-[11px] font-black uppercase transition-all border ${
          isLight ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-md shadow-blue-600/10' : 'bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white border-blue-500/20'
        }`}>
          학생 정보 수정
        </button>
      </div>
    </motion.div>
  );
}

function TabButton({ active, onClick, icon, label, isLight = false }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 rounded-[2px] transition-all whitespace-nowrap ${
        active 
          ? isLight
            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 rounded-b-none font-extrabold'
            : 'bg-blue-600/10 text-blue-500 border-b-2 border-blue-600 rounded-b-none' 
          : isLight
            ? 'text-gray-400 hover:text-gray-700'
            : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {icon}
      <span className="text-[11px] font-black uppercase tracking-tight">{label}</span>
    </button>
  );
}

function SummaryTab({ student, stats, availableTextbooks, isLight }: any) {
  // 💡 [원장님 기획] 학생의 전체 로그 중 '결석' 상태인 로그들만 추출하여 최신 날짜 순으로 정렬합니다.
  const absenceLogs = useMemo(() => {
    const logs = student.allLogs || [];
    return logs
      .filter((l: any) => l.attendance_status === '결석')
      .sort((a: any, b: any) => new Date(b.date || b.session_date || 0).getTime() - new Date(a.date || a.session_date || 0).getTime());
  }, [student.allLogs]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* 기본 주요 지표 */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="평균 출석률" value={`${stats.attendanceRate}%`} sub="최근 20세션" color="text-emerald-500" icon={<CheckCircle2 size={16}/>} isLight={isLight} />
        <MetricCard label="숙제 이행률" value={`${stats.homeworkRate}%`} sub="최근 4주" color="text-blue-500" icon={<BookOpen size={16}/>} isLight={isLight} />
        <MetricCard label="테스트 평균" value={`${stats.avgTestScore}점`} sub="최근 5회" color="text-orange-500" icon={<BarChart3 size={16}/>} isLight={isLight} />
      </div>

      {/* 당월 출결 및 보강 통계 */}
      <section className="space-y-3">
        <SectionTitle title={`${stats.currentMonthName} 출결 및 보강 통계`} isLight={isLight} />
        <div className="grid grid-cols-2 gap-4">
          <MetricCard 
            label="이번 달 결석" 
            value={`${stats.absencesCount}회`} 
            sub="당월 누적 결석" 
            color="text-rose-500" 
            icon={<AlertCircle size={16} className="text-rose-500" />} 
            isLight={isLight}
          />
          <MetricCard 
            label="이번 달 보강 진행" 
            value={`${stats.makeupsCount}회`} 
            sub="당월 누적 보강" 
            color="text-blue-500" 
            icon={<Clock size={16} className="text-blue-500" />} 
            isLight={isLight}
          />
        </div>
      </section>

      {/* 💡 [원장님 특별 지침] 최근 결석 사유 및 날짜 리스트업 섹션 신설 */}
      <section className="space-y-3 text-left">
        <SectionTitle title="최근 결석 및 취소 히스토리" isLight={isLight} />
        {absenceLogs.length > 0 ? (
          <div className={`border rounded-[4px] p-4 ${
            isLight ? 'bg-gray-50/50 border-gray-200' : 'bg-white/5 border-white/5'
          }`}>
            <div className="max-h-[180px] overflow-y-auto custom-scrollbar-v pr-1 space-y-2">
              {absenceLogs.map((log: any, idx: number) => {
                const displayDate = log.date || log.session_date || '';
                const reason = log.attendance_reason || log.special_notes || '사유 미기재';
                return (
                  <div 
                    key={`absence-${displayDate}-${idx}`} 
                    className={`flex items-center justify-between p-2.5 rounded-[2px] border text-[12px] font-medium transition-all ${
                      isLight 
                        ? 'bg-white border-gray-200 hover:border-red-500/20 shadow-sm' 
                        : 'bg-[#0f0f0f] border-white/5 hover:border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm shadow-red-500/30 shrink-0" />
                      <span className={`font-black shrink-0 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                        {displayDate}
                      </span>
                    </div>
                    <span className="font-bold italic text-[11px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 max-w-[280px] truncate shrink-0">
                      {reason}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`border rounded-[4px] p-5 text-center text-[11px] font-bold ${
            isLight ? 'bg-gray-50/50 border-gray-250 text-gray-500' : 'bg-white/5 border-white/5 text-gray-500'
          }`}>
            🎉 최근 누적된 결석 기록이 전혀 없는 성실한 학생입니다.
          </div>
        )}
      </section>

      {/* 💡 학생 관리 메모 (노란 삼각형 클릭 시 주요 확인 대상) */}
      {student.management_notes && (
        <section className="space-y-4">
          <SectionTitle title="학습 지도 시 주의사항" isLight={isLight} />
          <div className="relative group/postit">
            <div className="absolute inset-0 bg-amber-250 rounded-sm shadow-[3px_3px_10px_rgba(0,0,0,0.15)] rotate-[-1deg]" />
            <div className="relative bg-amber-100 p-6 min-h-[100px] rounded-sm flex flex-col shadow-inner">
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
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-amber-300/30 rounded-tl-full shadow-[-2px_-2px_5px_rgba(0,0,0,0.05)] pointer-events-none" />
          </div>
        </section>
      )}
    </motion.div>
  );
}

function HistoryTab({ student, availableTextbooks, onRefreshStudents, isLight }: any) {
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
        <SectionTitle title="현재 진행 중인 교재 (Active)" isLight={isLight} />
        {activeBooks.length > 0 ? (
          <div className="space-y-3">
            {activeBooks.map((item, idx) => (
              <div key={`active-${item.code}-${idx}`} className={`border p-4 rounded-[4px] flex items-center justify-between group transition-all ${
                item.isKeep 
                  ? 'bg-amber-500/5 border-amber-500/10 opacity-60' 
                  : isLight 
                    ? 'bg-gray-50/50 border-gray-250 hover:border-blue-500/30' 
                    : 'bg-white/5 border-white/5 hover:border-blue-500/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-[2px] flex items-center justify-center ${
                    item.isKeep 
                      ? 'bg-amber-500/20 text-amber-500' 
                      : 'bg-blue-600/20 text-blue-500'
                  }`}>
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h4 className={`text-[13px] font-black flex items-center gap-2 ${
                      isLight ? 'text-gray-800' : 'text-white'
                    }`}>
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
                          <span className={isLight ? 'text-blue-600' : 'text-blue-400'}>{item.startInfo}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={`text-[10px] font-bold uppercase text-center py-10 tracking-widest border rounded-[4px] ${
            isLight ? 'bg-gray-50/30 border-gray-200 text-gray-400' : 'bg-white/[0.01] border-white/5 text-gray-700'
          }`}>진행 중인 교재가 없습니다.</p>
        )}
      </section>

      {/* 2. 완료한 교재 히스토리 */}
      <section className="space-y-4">
        <SectionTitle title="완료한 교재 히스토리 (Completed History)" isLight={isLight} />
        {completedBooks.length > 0 ? (
          <div className={`relative pl-8 space-y-6 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] ${
            isLight ? 'before:bg-emerald-500/20' : 'before:bg-emerald-500/10'
          }`}>
            {completedBooks.map((item, idx) => (
              <div key={`completed-${item.code}-${idx}`} className="relative">
                <div className={`absolute -left-[30px] top-1.5 w-6 h-6 rounded-full border-2 border-emerald-500 flex items-center justify-center z-10 shadow-lg shadow-emerald-500/20 ${
                  isLight ? 'bg-white' : 'bg-[#080808]'
                }`}>
                  <CheckCircle2 size={12} className="text-emerald-500" />
                </div>
                <div className={`border p-4 rounded-[4px] space-y-2 group transition-all flex items-center justify-between ${
                  isLight 
                    ? 'bg-emerald-50/[0.3] border-emerald-500/20 hover:bg-emerald-50/70' 
                    : 'bg-emerald-500/5 border-emerald-500/10 hover:bg-emerald-500/[0.08]'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-emerald-600/95 uppercase tracking-tighter font-mono">{item.periodText} 사용</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-600 uppercase">Completed</span>
                    </div>
                    <h4 className={`text-[13px] font-black tracking-tight ${isLight ? 'text-gray-800' : 'text-white'}`}>{item.title}</h4>
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
          <p className={`text-[10px] font-bold uppercase text-center py-20 tracking-widest border rounded-[4px] ${
            isLight ? 'bg-gray-50/30 border-gray-200 text-gray-400' : 'bg-white/[0.01] border-white/5 text-gray-700'
          }`}>완료한 교재가 없습니다.</p>
        )}
      </section>
    </motion.div>
  );
}

function StatsTab({ student, onRefreshStudents, isLight = false }: { student: Student; onRefreshStudents?: () => Promise<void>; isLight?: boolean }) {
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
        <SectionTitle title="최근 테스트 점수 추이" isLight={isLight} />
        {testData.length > 0 ? (
          <div className={`border p-8 rounded-[4px] ${
            isLight ? 'bg-gray-50/50 border-gray-250' : 'bg-white/[0.02] border-white/5'
          }`}>
            <div className="flex items-end justify-between gap-2 h-40 mb-4">
              {testData.map((log: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-[2px] opacity-0 group-hover:opacity-100 transition-all z-20 whitespace-nowrap">{log.test_score}점</div>
                  <div className={`w-full rounded-t-[2px] relative flex items-end h-32 overflow-hidden border ${
                    isLight ? 'bg-blue-600/5 border-gray-200' : 'bg-blue-600/10 border-white/5'
                  }`}>
                    <motion.div initial={{ height: 0 }} animate={{ height: `${log.test_score}%` }} className={`w-full ${log.test_score >= 80 ? 'bg-blue-500' : log.test_score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} />
                  </div>
                  <span className={`text-[8px] font-black rotate-45 origin-left ml-2 mt-1 ${
                    isLight ? 'text-gray-500' : 'text-gray-600'
                  }`}>{log.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : <p className={`text-[10px] font-bold uppercase text-center py-20 tracking-widest ${isLight ? 'text-gray-400' : 'text-gray-700'}`}>기록된 점수가 없습니다.</p>}
      </section>

      {/* 출결 현황 및 결석 보강 관리 섹션 */}
      <section className="space-y-6">
        <SectionTitle title="결석 및 지각 내역 (보강 관리)" isLight={isLight} />
        {attendanceLogs.length > 0 ? (
          <div className={`border rounded-lg overflow-hidden ${
            isLight ? 'bg-gray-50/50 border-gray-200' : 'bg-white/[0.02] border-white/5'
          }`}>
            <div className={`max-h-80 overflow-y-auto pr-0.5 custom-scrollbar-v divide-y ${
              isLight ? 'divide-gray-150' : 'divide-white/5'
            }`}>
              {attendanceLogs.map((log: any) => {
                const isAbsent = log.attendance_status === '결석';
                const isMakeupCompleted = log.special_notes?.includes('[보강완료]');
                const pureReason = getPureReason(log.special_notes || '');
                const isUpdating = updatingLogId === log.id;

                return (
                  <div key={log.id} className={`flex items-center justify-between p-4 transition-colors ${
                    isLight ? 'hover:bg-gray-100/50' : 'hover:bg-white/[0.02]'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black tabular-nums ${isLight ? 'text-gray-500' : 'text-gray-600'}`}>{log.date.replace(/-/g, '.')}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          isAbsent ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                          {log.attendance_status}
                        </span>
                      </div>
                      <p className={`text-[11px] font-medium ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                        사유: <span className={pureReason === '사유 미기재' ? 'text-gray-400 italic' : isLight ? 'text-gray-800 font-extrabold' : 'text-gray-300 font-bold'}>{pureReason}</span>
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
          <div className={`border border-dashed rounded-lg py-12 flex flex-col items-center justify-center gap-1.5 ${
            isLight ? 'bg-gray-50/30 border-gray-250 text-gray-400' : 'bg-white/[0.01] border-white/10 text-gray-500'
          }`}>
            <CheckCircle2 size={24} className="text-emerald-500" />
            <span className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-gray-500' : 'text-gray-600'}`}>출결 상태가 매우 안정적입니다.</span>
          </div>
        )}
      </section>
    </motion.div>
  );
}

function RoadmapTab({ student, isLight }: any) {
  const roadmap = useMemo(() => {
    const grade = student.grade || '';
    if (grade.includes('초6')) return [{ month: '5월', task: '중등 1-1 기초', sub: '소인수분해 및 정수', active: true }, { month: '6월', task: '중등 1-1 발전', sub: '일차방정식 정복' }, { month: '7월', task: '중등 1-2 선행', sub: '기본 도형 학습' }];
    if (grade.includes('중3')) return [{ month: '5월', task: '고등 수학(상) 시작', sub: '다항식 및 나머지 정리', active: true }, { month: '6월', task: '기말고사 대비', sub: '이차함수 및 통계' }, { month: '7월', task: '고등 수학(상) 심화', sub: '복소수 및 이차방정식' }];
    return [{ month: '5월', task: '현재 과정 심화', sub: '오답 정밀 분석', active: true }, { month: '6월', task: '다음 단원 선행', sub: '기본 예제 학습' }, { month: '7월', task: '여름방학 특강', sub: '취약 단원 보강' }];
  }, [student.grade]);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <SectionTitle title={`학습 로드맵 (${student.grade})`} isLight={isLight} />
      <div className="space-y-4">
        {roadmap.map((item, i) => <RoadmapItem key={i} month={item.month} task={item.task} sub={item.sub} active={item.active} isLight={isLight} />)}
      </div>
    </motion.div>
  );
}

function JournalTab({ student, isLight }: any) {
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

  // 5. 학부모 전용 상담 일지 피드 생성
  const mergedFeed = useMemo(() => {
    const feed: any[] = [];

    // 학부모 상담 기록만 추가
    consultations.forEach((c: any) => {
      feed.push({
        type: 'consult',
        id: c.id,
        date: c.date.replace(/-/g, '.'),
        content: c.content,
      });
    });

    // 내림차순 정렬 (최신 날짜순)
    return feed.sort((a, b) => b.date.localeCompare(a.date));
  }, [consultations]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      
      {/* ✍️ 신규 상담 일지 작성 폼 */}
      <div className={`border rounded-[4px] p-4 space-y-3 no-print ${
        isLight ? 'bg-amber-50/50 border-amber-500/20 shadow-sm' : 'bg-amber-500/5 border border-amber-500/10'
      }`}>
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
              className={`border rounded-[2px] px-2 py-1 text-xs outline-none font-bold focus:border-amber-500/50 ${
                isLight 
                  ? 'bg-white border-gray-250 text-gray-800 [color-scheme:light]' 
                  : 'bg-black/30 border border-white/10 text-white [color-scheme:dark]'
              }`}
              required
            />
          </div>
          
          <textarea 
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="학부모님과 면담하거나 상담한 내용을 자유롭고 자세히 적어보세요..."
            className={`w-full h-24 border rounded-[2px] p-3 text-xs outline-none focus:border-amber-500/30 transition-all font-bold resize-none leading-relaxed custom-scrollbar-v ${
              isLight 
                ? 'bg-white border-gray-250 text-gray-800 placeholder:text-gray-400' 
                : 'bg-black/40 border border-white/5 text-gray-100 placeholder:text-gray-600'
            }`}
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
        <SectionTitle title="학부모 상담 일지 내역" isLight={isLight} />
        
        <div className="space-y-3">
          {mergedFeed.length === 0 ? (
            <div className={`p-12 text-center text-gray-650 text-[10px] font-black uppercase tracking-widest italic border border-dashed rounded-[4px] ${
              isLight ? 'bg-gray-50/30 border-gray-250 text-gray-400' : 'bg-white/[0.01] border-white/5'
            }`}>
              기록된 학부모 상담 일지가 없습니다.
            </div>
          ) : (
            mergedFeed.map((item) => {
              const isEditing = editingId === item.id;

              return (
                <div 
                  key={item.id} 
                  className={`border p-4 rounded-[4px] space-y-2 transition-all shadow-inner ${
                    isLight
                      ? 'bg-amber-50/[0.2] border-amber-500/20 hover:border-amber-500/45'
                      : 'bg-amber-500/[0.02] border-amber-500/10 hover:border-amber-500/20'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-gray-500 flex items-center gap-1.5">
                        <Clock size={12}/> {item.date}
                      </span>
                      <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-[2px] uppercase border border-amber-500/20">
                        학부모 상담
                      </span>
                    </div>

                    {/* 수정 / 삭제 단추 */}
                    {!isEditing && (
                      <div className="flex items-center gap-2 no-print">
                        <button 
                          onClick={() => {
                            setEditingId(item.id);
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
                          className={`border rounded-[2px] px-2 py-0.5 text-xs outline-none font-bold focus:border-amber-500/40 ${
                            isLight 
                              ? 'bg-white border-gray-250 text-gray-800 [color-scheme:light]' 
                              : 'bg-black/40 border border-white/10 text-white [color-scheme:dark]'
                          }`}
                        />
                      </div>
                      <textarea 
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className={`w-full h-20 border rounded-[2px] p-2.5 text-xs focus:border-amber-500/40 outline-none resize-none leading-relaxed font-bold custom-scrollbar-v ${
                          isLight ? 'bg-white border-gray-250 text-gray-800' : 'bg-black/40 border border-amber-500/20 text-gray-100'
                        }`}
                      />
                      <div className="flex justify-end gap-2 text-[10px]">
                        <button 
                          onClick={() => setEditingId(null)}
                          className={`px-2.5 py-1 border rounded-[2px] font-black ${
                            isLight ? 'text-gray-500 hover:bg-gray-100 border-gray-250' : 'text-gray-400 hover:bg-white/5 border-white/5'
                          }`}
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
                    <p className={`text-[11px] font-bold leading-relaxed whitespace-pre-wrap break-all pl-0.5 ${
                      isLight ? 'text-gray-700' : 'text-gray-300'
                    }`}>
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

function MetricCard({ label, value, sub, color, icon, isLight = false }: any) {
  return (
    <div className={`p-4 rounded-[4px] space-y-1 shadow-inner group transition-all border ${
      isLight 
        ? 'bg-gray-50/50 border-gray-250 hover:border-gray-300' 
        : 'bg-white/5 border-white/5 hover:border-white/10'
    }`}>
      <div className={`flex items-center gap-2 mb-1 ${isLight ? 'text-gray-450' : 'text-gray-500'}`}>
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-xl font-black tabular-nums ${color}`}>{value}</div>
      <div className={`text-[8px] font-bold uppercase tracking-tighter ${isLight ? 'text-gray-400' : 'text-gray-650'}`}>{sub}</div>
    </div>
  );
}

function SectionTitle({ title, isLight = false }: { title: string; isLight?: boolean }) {
  return (
    <h5 className={`text-[10px] font-black uppercase tracking-[0.2em] px-1 flex items-center gap-2 ${
      isLight ? 'text-gray-600' : 'text-gray-500'
    }`}>
      <ChevronRight size={14} className={isLight ? 'text-blue-600' : 'text-blue-500'} /> {title}
    </h5>
  );
}

function RoadmapItem({ month, task, sub, active = false, isLight = false }: any) {
  return (
    <div className={`p-4 rounded-[4px] border flex items-center gap-4 transition-all ${
      active 
        ? isLight 
          ? 'bg-blue-50 border-blue-200 shadow-sm' 
          : 'bg-blue-600/10 border-blue-500/30' 
        : isLight 
          ? 'bg-gray-50/30 border-gray-200 opacity-60' 
          : 'bg-white/5 border-white/5 opacity-60'
    }`}>
      <div className={`w-12 h-12 rounded-[2px] flex flex-col items-center justify-center font-black ${
        active 
          ? 'bg-blue-600 text-white shadow-sm' 
          : isLight 
            ? 'bg-gray-100 text-gray-500' 
            : 'bg-white/5 text-gray-500'
      }`}>
        <span className="text-[10px] uppercase">{month}</span>
      </div>
      <div>
        <h4 className={`text-[13px] font-black ${
          active 
            ? isLight 
              ? 'text-gray-800' 
              : 'text-white' 
            : isLight 
              ? 'text-gray-400' 
              : 'text-gray-400'
        }`}>{task}</h4>
        <p className="text-[10px] font-bold text-gray-500">{sub}</p>
      </div>
      {active && <div className={isLight ? 'ml-auto text-blue-600' : 'ml-auto animate-pulse text-blue-500'}><TrendingUp size={18}/></div>}
    </div>
  );
}

function SchoolScoresTab({ student, isLight = false }: { student: Student; isLight?: boolean }) {
  const [scores, setScores] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 입력 폼 상태
  const [grade, setGrade] = useState('중1');
  const [semester, setSemester] = useState('1학기 중간');
  const [score, setScore] = useState('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchScores = async () => {
    if (!student?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ams_school_scores')
        .select('*')
        .eq('student_id', student.id);

      if (error) throw error;

      // 정렬 가중치 부여하여 정렬
      const gradeWeight: Record<string, number> = { '중1': 10, '중2': 20, '중3': 30, '고1': 40, '고2': 50, '고3': 60 };
      const semWeight: Record<string, number> = { '1학기 중간': 1, '1학기 기말': 2, '2학기 중간': 3, '2학기 기말': 4 };

      const sortedData = (data || []).sort((a: any, b: any) => {
        const wa = (gradeWeight[a.school_grade] || 0) + (semWeight[a.semester] || 0);
        const wb = (gradeWeight[b.school_grade] || 0) + (semWeight[b.semester] || 0);
        return wa - wb;
      });

      setScores(sortedData);
    } catch (err) {
      console.error('Error fetching school scores:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, [student?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericScore = parseFloat(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      alert('올바른 점수(0~100)를 입력해주세요.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from('ams_school_scores')
          .update({
            school_grade: grade,
            semester,
            score: numericScore,
            note: note.trim()
          })
          .eq('id', editingId);

        if (error) throw error;
        setEditingId(null);
      } else {
        const { error } = await supabase
          .from('ams_school_scores')
          .insert({
            student_id: student.id,
            academy_id: student.academy_id,
            school_grade: grade,
            semester,
            score: numericScore,
            note: note.trim()
          });

        if (error) throw error;
      }

      setScore('');
      setNote('');
      await fetchScores();
    } catch (err: any) {
      console.error('Error saving school score:', err);
      alert('성적 저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 시험 성적 기록을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase
        .from('ams_school_scores')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchScores();
    } catch (err: any) {
      console.error('Error deleting school score:', err);
      alert('삭제 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setGrade(item.school_grade);
    setSemester(item.semester);
    setScore(String(item.score));
    setNote(item.note || '');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* 1. 성적 추이 그래프 */}
      <section className="space-y-4">
        <SectionTitle title="학교 시험 성적 추이" isLight={isLight} />
        {scores.length > 0 ? (
          <div className={`border p-6 rounded-[4px] ${
            isLight ? 'bg-gray-50/50 border-gray-250' : 'bg-white/[0.02] border-white/5'
          }`}>
            <div className="flex items-end justify-between gap-4 h-40 mb-4 pt-6">
              {scores.map((item: any, i: number) => (
                <div key={item.id} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black px-2 py-1 rounded-[2px] opacity-0 group-hover:opacity-100 transition-all z-20 whitespace-nowrap shadow-md">
                    <div>{item.score}점</div>
                    {item.note && <div className="text-[7px] text-blue-200 mt-0.5">{item.note}</div>}
                  </div>
                  <div className={`w-full rounded-t-[2px] relative flex items-end h-32 overflow-hidden border ${
                    isLight ? 'bg-blue-600/5 border-gray-200' : 'bg-blue-600/10 border-white/5'
                  }`}>
                    <motion.div 
                      initial={{ height: 0 }} 
                      animate={{ height: `${item.score}%` }} 
                      className={`w-full ${
                        item.score >= 90 
                          ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]' 
                          : item.score >= 80 
                            ? 'bg-emerald-500' 
                            : item.score >= 70 
                              ? 'bg-amber-500' 
                              : 'bg-red-500'
                      }`} 
                    />
                  </div>
                  <div className={`text-[8px] font-black text-center tracking-tighter whitespace-nowrap ${
                    isLight ? 'text-gray-600' : 'text-gray-500'
                  }`}>
                    <div>{item.school_grade}</div>
                    <div className={`${isLight ? 'text-gray-400' : 'text-gray-600'} mt-0.5`}>{item.semester.split(' ')[1]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`p-16 text-center text-[10px] font-black uppercase tracking-widest italic border border-dashed rounded-[4px] ${
            isLight ? 'bg-gray-50/30 border-gray-250 text-gray-450' : 'bg-white/[0.01] border-white/5 text-gray-600'
          }`}>
            등록된 학교 성적이 없습니다. 아래 폼에서 첫 시험 성적을 기록해보세요!
          </div>
        )}
      </section>

      {/* 2. 학교 성적 입력 폼 */}
      <section className={`border rounded-[4px] p-5 space-y-4 ${
        isLight ? 'bg-blue-50/30 border-blue-200' : 'bg-blue-600/[0.02] border border-blue-500/10'
      }`}>
        <div className="flex items-center gap-1.5 text-blue-500 font-black text-[10px] uppercase tracking-wider">
          <Award size={12} />
          {editingId ? '학교 시험 성적 수정하기' : '학교 시험 성적 신규 등록'}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <span className="text-[9px] text-gray-500 font-bold uppercase block ml-0.5">학년</span>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className={`w-full border rounded-[2px] px-2.5 py-1.5 text-xs outline-none font-bold ${
                isLight ? 'bg-white border-gray-250 text-gray-800' : 'bg-black/40 border border-white/10 text-white'
              }`}
            >
              {['중1', '중2', '중3', '고1', '고2', '고3'].map(g => (
                <option key={g} value={g} className={isLight ? 'bg-white text-gray-800' : 'bg-[#121212] text-white'}>{g}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] text-gray-500 font-bold uppercase block ml-0.5">학기/시험</span>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className={`w-full border rounded-[2px] px-2.5 py-1.5 text-xs outline-none font-bold ${
                isLight ? 'bg-white border-gray-250 text-gray-800' : 'bg-black/40 border border-white/10 text-white'
              }`}
            >
              {['1학기 중간', '1학기 기말', '2학기 중간', '2학기 기말'].map(s => (
                <option key={s} value={s} className={isLight ? 'bg-white text-gray-800' : 'bg-[#121212] text-white'}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] text-gray-500 font-bold uppercase block ml-0.5">성적 (점수)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              required
              placeholder="0 ~ 100점"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className={`w-full border rounded-[2px] px-2.5 py-1.5 text-xs outline-none font-bold placeholder:text-gray-400 animate-none ${
                isLight ? 'bg-white border-gray-250 text-gray-800' : 'bg-black/40 border border-white/10 text-white'
              }`}
            />
          </div>

          <div className="space-y-1">
            <span className="text-[9px] text-gray-500 font-bold uppercase block ml-0.5">시험 특이사항/메모</span>
            <input
              type="text"
              placeholder="예: 수행 포함, 난이도 극상 등"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`w-full border rounded-[2px] px-2.5 py-1.5 text-xs outline-none font-bold placeholder:text-gray-450 ${
                isLight ? 'bg-white border-gray-250 text-gray-800' : 'bg-black/40 border border-white/10 text-white'
              }`}
            />
          </div>

          <div className="md:col-span-4 flex justify-end gap-2 pt-2 border-t border-white/5">
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setScore('');
                  setNote('');
                }}
                className={`px-3 py-1.5 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all border ${
                  isLight ? 'bg-white hover:bg-gray-55 text-gray-600 border-gray-250 shadow-sm' : 'bg-white/5 hover:bg-white/10 text-gray-400 border-white/5'
                }`}
              >
                취소
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || !score}
              className={`px-4 py-1.5 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                isLight 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-700' 
                  : 'bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white'
              }`}
            >
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : editingId ? '수정 완료' : '성적 등록'}
            </button>
          </div>
        </form>
      </section>

      {/* 3. 학교 성적 누적 기록 목록 */}
      <section className="space-y-4">
        <SectionTitle title="학교 시험 성적 누적 내역" isLight={isLight} />
        {scores.length > 0 ? (
          <div className={`border rounded-[4px] overflow-hidden ${
            isLight ? 'bg-white border-gray-250 shadow-sm' : 'bg-white/[0.02] border-white/5'
          }`}>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={`border-b text-[9px] font-black uppercase tracking-widest ${
                  isLight ? 'bg-gray-50 border-gray-200 text-gray-500' : 'border-white/5 text-gray-500 bg-black/20'
                }`}>
                  <th className="py-2.5 px-4">학년</th>
                  <th className="py-2.5 px-4">학기/시험</th>
                  <th className="py-2.5 px-4 text-center">점수</th>
                  <th className="py-2.5 px-4">메모</th>
                  <th className="py-2.5 px-4 text-right">작업</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-150' : 'divide-white/5'}`}>
                {scores.map((item) => (
                  <tr key={item.id} className={`transition-colors font-bold ${
                    isLight ? 'hover:bg-gray-50/50 text-gray-700' : 'hover:bg-white/[0.01] text-gray-300'
                  }`}>
                    <td className={`py-3 px-4 ${isLight ? 'text-gray-850 font-black' : 'text-white'}`}>{item.school_grade}</td>
                    <td className="py-3 px-4">{item.semester}</td>
                    <td className={`py-3 px-4 text-center font-extrabold ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>{item.score}점</td>
                    <td className={`py-3 px-4 font-medium text-[11px] ${isLight ? 'text-gray-500' : 'text-gray-650'}`}>{item.note || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="text-gray-500 hover:text-blue-500 transition-colors"
                          title="기록 수정"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="text-gray-500 hover:text-red-500 transition-colors"
                          title="기록 삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </motion.div>
  );
}
