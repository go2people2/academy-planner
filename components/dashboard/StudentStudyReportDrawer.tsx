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
  availableTextbooks: TextbookOption[]; // 💡 추가
  onClose: () => void;
  onEditMode: () => void; // 정보 수정 모드로 전환 (선택 사항)
}

type TabType = 'summary' | 'history' | 'stats' | 'roadmap' | 'journal';

export default function StudentStudyReportDrawer({ student, availableTextbooks, onClose, onEditMode }: StudentStudyReportDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary');

  // 데이터 가공 (실제 데이터 + 더미 데이터 혼합)
  const stats = useMemo(() => {
    const logs = student.allLogs || [];
    const attendanceRate = 95; // 더미
    const homeworkRate = 88; // 더미
    const avgTestScore = 82; // 더미

    return { attendanceRate, homeworkRate, avgTestScore };
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
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <GraduationCap className="text-white" size={32} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-white tracking-tight">{student.name}</h2>
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
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
                <span key={tag} className="text-[9px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 italic">
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
          {activeTab === 'history' && <HistoryTab key="history" student={student} />}
          {activeTab === 'stats' && <StatsTab key="stats" student={student} />}
          {activeTab === 'roadmap' && <RoadmapTab key="roadmap" student={student} />}
          {activeTab === 'journal' && <JournalTab key="journal" student={student} />}
        </AnimatePresence>
      </div>

      {/* 4. 하단 버튼 (수정 모드 접근) */}
      <div className="p-6 border-t border-white/5 bg-[#0a0a0a]/50 flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 px-4 bg-white/5 text-gray-400 rounded-xl text-[11px] font-black uppercase hover:bg-white/10 transition-all border border-white/5">
          Close Report
        </button>
        <button onClick={onEditMode} className="flex-1 py-3 px-4 bg-blue-600/10 text-blue-400 rounded-xl text-[11px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all border border-blue-500/20">
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
      className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${
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

// --- 탭별 서브 컴포넌트들 ---

function SummaryTab({ student, stats, availableTextbooks }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* 주요 지표 */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="평균 출석률" value={`${stats.attendanceRate}%`} sub="최근 20세션" color="text-emerald-500" icon={<CheckCircle2 size={16}/>} />
        <MetricCard label="숙제 이행률" value={`${stats.homeworkRate}%`} sub="최근 4주" color="text-blue-500" icon={<BookOpen size={16}/>} />
        <MetricCard label="테스트 평균" value={`${stats.avgTestScore}점`} sub="최근 5회" color="text-orange-500" icon={<BarChart3 size={16}/>} />
      </div>

      {/* 현재 진행 교재 */}
      <section className="space-y-4">
        <SectionTitle title="현재 학습 중인 교재" />
        <div className="space-y-2">
          {student.assigned_books.map((bookCode: string) => {
            const bookInfo = availableTextbooks?.find((b: any) => b.bookcode === bookCode);
            const bookTitle = bookInfo?.title || bookCode;

            return (
              <div key={bookCode} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black text-white">{bookTitle}</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Expected completion: 2 weeks left</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-black text-blue-500">65%</div>
                  <div className="w-24 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '65%' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 최근 상담 요약 */}
      <section className="space-y-4">
        <SectionTitle title="최근 특이사항" />
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
          {student.allLogs.filter((l: any) => l.special_notes).slice(0, 2).map((log: any) => (
            <div key={log.id} className="flex gap-4">
              <div className="shrink-0 text-[10px] font-black text-gray-600 tabular-nums pt-1">{log.date}</div>
              <p className="text-[11px] font-medium text-gray-400 leading-relaxed italic">"{log.special_notes}"</p>
            </div>
          ))}
          {student.allLogs.filter((l: any) => l.special_notes).length === 0 && (
            <p className="text-[10px] text-gray-700 font-bold uppercase text-center py-4 tracking-widest">기록된 상담 내용이 없습니다.</p>
          )}
        </div>
      </section>
    </motion.div>
  );
}

function HistoryTab({ student }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SectionTitle title="누적 교재 히스토리" />
      <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
        {[
          { date: '2026.03.15', title: '고등 수학 (상) 기본', status: '완료', result: '성취도 우수' },
          { date: '2026.02.01', title: '중학 수학 3-2 심화', status: '완료', result: '오답 정리 필요' },
          { date: '2025.12.10', title: '중학 수학 3-1 기본', status: '완료', result: '성취도 보통' },
        ].map((item, i) => (
          <div key={i} className="relative">
            <div className="absolute -left-[30px] top-1 w-6 h-6 rounded-full bg-[#080808] border-2 border-blue-500 flex items-center justify-center z-10 shadow-lg shadow-blue-500/20">
              <CheckCircle2 size={12} className="text-blue-500" />
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-2 group hover:bg-white/[0.08] transition-all">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">{item.date}</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded uppercase">{item.status}</span>
              </div>
              <h4 className="text-[13px] font-black text-white tracking-tight">{item.title}</h4>
              <p className="text-[11px] font-bold text-gray-500 italic">마지막 성취도: {item.result}</p>
            </div>
          </div>
        ))}
        <div className="text-center pt-4">
          <button className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] hover:text-blue-500 transition-colors">기록 더 보기</button>
        </div>
      </div>
    </motion.div>
  );
}

function StatsTab({ student }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-center py-20">
      <div className="w-20 h-20 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <BarChart3 size={40} />
      </div>
      <h3 className="text-sm font-black text-white uppercase tracking-widest">학습 통계 분석 엔진 준비 중</h3>
      <p className="text-[11px] text-gray-500 leading-relaxed font-bold uppercase tracking-tight">
        최근 테스트 결과와 숙제 데이터를 분석하여<br />성취도 그래프를 생성하고 있습니다.
      </p>
      <div className="flex justify-center gap-2 mt-10">
        {[40, 70, 50, 90, 60, 80].map((h, i) => (
          <div key={i} className="w-4 bg-blue-600/20 rounded-t-md relative flex items-end h-20 overflow-hidden border border-white/5">
            <motion.div 
              initial={{ height: 0 }} animate={{ height: `${h}%` }} 
              transition={{ delay: i * 0.1, duration: 1 }}
              className="w-full bg-blue-500" 
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function RoadmapTab({ student }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <SectionTitle title="학습 로드맵 예상 (2026 상반기)" />
      <div className="space-y-4">
        <RoadmapItem month="5월" task="고등 수학 (상) 심화" sub="오답 정밀 타격 및 고난도 유형 정복" active />
        <RoadmapItem month="6월" task="고등 수학 (하) 선행" sub="집합과 명제 기본 개념 확립" />
        <RoadmapItem month="7월" task="여름방학 특강 (수학 I)" sub="삼각함수 및 수열 집중 학습" />
      </div>
    </motion.div>
  );
}

function JournalTab({ student }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SectionTitle title="누적 상담 및 지도 일지" />
      <div className="space-y-3">
        {student.allLogs.filter((l: any) => l.special_notes).map((log: any) => (
          <div key={log.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-500 flex items-center gap-1.5"><Clock size={12}/> {log.date}</span>
              <span className="text-[9px] font-bold text-blue-500 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10 italic">Session Log</span>
            </div>
            <p className="text-[11px] font-bold text-gray-300 leading-relaxed">{log.special_notes}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// --- 보조 컴포넌트 ---

function MetricCard({ label, value, sub, color, icon }: any) {
  return (
    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-1 shadow-inner group hover:border-white/10 transition-all">
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
    <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${active ? 'bg-blue-600/10 border-blue-500/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black ${active ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'}`}>
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
