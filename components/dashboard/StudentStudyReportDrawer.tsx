'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, BookOpen, BarChart3, Calendar, MessageSquare, 
  TrendingUp, CheckCircle2, AlertCircle, Clock, 
  ChevronRight, BookMarked, Target, GraduationCap
} from 'lucide-react';
import { Student, SessionLog, TextbookOption } from '@/types/dashboard';

interface StudentStudyReportDrawerProps {
  student: Student;
  availableTextbooks: TextbookOption[];
  onClose: () => void;
  onEditMode: () => void;
}

type TabType = 'summary' | 'history' | 'stats' | 'roadmap' | 'journal';

export default function StudentStudyReportDrawer({ student, availableTextbooks, onClose, onEditMode }: StudentStudyReportDrawerProps) {
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

    return { attendanceRate, homeworkRate, avgTestScore, testCount: testLogs.length };
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
          {activeTab === 'history' && <HistoryTab key="history" student={student} availableTextbooks={availableTextbooks} />}
          {activeTab === 'stats' && <StatsTab key="stats" student={student} />}
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
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="평균 출석률" value={`${stats.attendanceRate}%`} sub="최근 20세션" color="text-emerald-500" icon={<CheckCircle2 size={16}/>} />
        <MetricCard label="숙제 이행률" value={`${stats.homeworkRate}%`} sub="최근 4주" color="text-blue-500" icon={<BookOpen size={16}/>} />
        <MetricCard label="테스트 평균" value={`${stats.avgTestScore}점`} sub="최근 5회" color="text-orange-500" icon={<BarChart3 size={16}/>} />
      </div>

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
          {student.assigned_books.filter((code: string) => !!code).map((bookCode: string) => {
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

function HistoryTab({ student, availableTextbooks }: any) {
  const bookHistory = useMemo(() => {
    const historyMap: Record<string, { title: string, firstDate: string, lastDate: string, count: number }> = {};
    (student.allLogs || []).forEach((log: any) => {
      student.assigned_books.forEach((bookCode: string) => {
        const bookInfo = availableTextbooks?.find((b: any) => b.bookcode === bookCode);
        const title = bookInfo?.title || bookCode;
        if (log.classwork_text?.includes(title) || log.homework_text?.includes(title)) {
          if (!historyMap[bookCode]) { historyMap[bookCode] = { title, firstDate: log.date, lastDate: log.date, count: 1 }; }
          else {
            if (log.date > historyMap[bookCode].lastDate) historyMap[bookCode].lastDate = log.date;
            if (log.date < historyMap[bookCode].firstDate) historyMap[bookCode].firstDate = log.date;
            historyMap[bookCode].count++;
          }
        }
      });
    });
    return Object.values(historyMap).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [student.allLogs, student.assigned_books, availableTextbooks]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SectionTitle title="학습 교재 타임라인" />
      {bookHistory.length > 0 ? (
        <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
          {bookHistory.map((item, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[30px] top-1 w-6 h-6 rounded-full bg-[#080808] border-2 border-blue-500 flex items-center justify-center z-10 shadow-lg shadow-blue-500/20">
                {i === 0 ? <Clock size={12} className="text-blue-500 animate-pulse" /> : <CheckCircle2 size={12} className="text-blue-500" />}
              </div>
              <div className="bg-white/5 border border-white/5 p-4 rounded-[4px] space-y-2 group hover:bg-white/[0.08] transition-all">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">{item.firstDate.replace(/-/g, '.')} ~ {item.lastDate.replace(/-/g, '.')}</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-[2px] uppercase ${i === 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-500'}`}>{i === 0 ? 'In Progress' : 'Completed'}</span>
                </div>
                <h4 className="text-[13px] font-black text-white tracking-tight">{item.title}</h4>
                <p className="text-[11px] font-bold text-gray-500 italic">총 {item.count}회 세션 학습됨</p>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-[10px] text-gray-700 font-bold uppercase text-center py-20 tracking-widest">학습 이력이 없습니다.</p>}
    </motion.div>
  );
}

function StatsTab({ student }: any) {
  const testData = useMemo(() => (student.allLogs || []).filter((l: any) => l.test_score !== null).slice(0, 10).reverse(), [student.allLogs]);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
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
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SectionTitle title="누적 상담 및 지도 일지" />
      <div className="space-y-3">
        {student.allLogs.filter((l: any) => l.special_notes).map((log: any, idx: number) => (
          <div key={log.id || `${log.date}-${idx}`} className="bg-white/5 border border-white/5 p-4 rounded-[4px] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-500 flex items-center gap-1.5"><Clock size={12}/> {log.date}</span>
            </div>
            <p className="text-[11px] font-bold text-gray-300 leading-relaxed">{log.special_notes}</p>
          </div>
        ))}
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
