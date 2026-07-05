'use client';

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Table as TableIcon, Activity, Settings, LogOut, GraduationCap, UserX, UserCog, ArrowLeftRight, UserCircle,
  ChevronLeft, ChevronRight, Bell, Edit2, Save, X, MessageSquare, Calendar, TrendingUp, Sun, Moon, ClipboardCheck, Zap, AlertTriangle,
  BookOpen, FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  currentUser?: any; // 💡 추가
  viewMode: string;
  setViewMode: (mode: any) => void;
  todayCount: number;
  students: any[];
  selectedFilter: string;
  setSelectedFilter: (filter: string) => void;
  selectedDays: string[]; 
  setSelectedDays: (days: string[]) => void; 
  isAndFilter: boolean; 
  setIsAndFilter: (val: boolean) => void; 
  filterTarget: 'all' | 'today' | 'rest';
  setFilterTarget: (target: 'all' | 'today' | 'rest') => void;
  academyInfo: any; 
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
  teachers: any[];
  selectedTeacherId: string;
  setSelectedTeacherId: (id: string) => void;
  isClassroomModeOpen: boolean;
  onStartClass: () => void;
  selectedHour: string;
  setSelectedHour: (hour: string) => void;
  availableHours: number[];
}

const DAYS_SHORT = ['월', '화', '수', '목', '금', '토', '일'];

const formatHour = (hour: number) => {
  if (hour === 999) return '보강/기타';
  const ampm = hour >= 12 ? '오후' : '오전';
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${ampm} ${displayHour}:00`;
};

export default function Sidebar({ 
  currentUser,
  viewMode, setViewMode, todayCount, students, selectedFilter, setSelectedFilter,
  selectedDays, setSelectedDays, isAndFilter, setIsAndFilter, 
  filterTarget, setFilterTarget,
  academyInfo, onUpdateAcademyInfo,
  teachers, selectedTeacherId, setSelectedTeacherId,
  isClassroomModeOpen, onStartClass,
  selectedHour, setSelectedHour, availableHours
}: SidebarProps) {
  const router = useRouter();
  const { slug } = useParams();
  const user = currentUser;
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [tempNotices, setTempNotices] = useState<any>({});

  const isAdmin = user?.role === 'admin' || user?.role === 'master';
  const announcements = academyInfo?.announcements || {};

  useEffect(() => {
    // 초기 테마 설정 로드
    const savedTheme = localStorage.getItem('theme');
    const isDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && isDarkSystem)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    router.push(`/${slug}/dashboard`);
  };

  useEffect(() => {
    if (academyInfo?.announcements) setTempNotices(academyInfo.announcements);
  }, [academyInfo]);

  useEffect(() => {
    if (selectedDays.length === 0) setIsMultiMode(false);
  }, [selectedDays]);

  const handleLogout = async () => {
    localStorage.removeItem('ams_user');
    await supabase.auth.signOut();
    router.push(`/${slug}/login`);
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      const newDays = selectedDays.filter(d => d !== day);
      setSelectedDays(newDays);
      if (newDays.length <= 1) setIsMultiMode(false);
    } else {
      if (isMultiMode) setSelectedDays([...selectedDays, day]);
      else setSelectedDays([day]);
    }
  };

  return (
    <aside className="w-52 border-r border-[#edece9] bg-[#f7f7f5] flex flex-col p-3 sticky top-0 h-screen z-30">
      {/* 내비게이션 제어 */}
      <div className="flex items-stretch gap-1 mb-6">
        <button onClick={() => window.history.back()} className="flex-1 py-1.5 rounded-[2px] bg-white border border-[#edece9] text-[#37352f]/70 hover:bg-[#edece9] hover:text-[#37352f] transition-all active:scale-95 group flex items-center justify-center">
          <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <button onClick={() => window.history.forward()} className="flex-1 py-1.5 rounded-[2px] bg-white border border-[#edece9] text-[#37352f]/70 hover:bg-[#edece9] hover:text-[#37352f] transition-all active:scale-95 group flex items-center justify-center">
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="mb-6 px-1 space-y-4">
        {/* 1. 학원 브랜딩 */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('board')}>
          <div className="w-8 h-8 bg-[#0c73e8] rounded-[2px] flex items-center justify-center shadow-lg shrink-0">
            <GraduationCap className="text-white" size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-black tracking-tight text-[#37352f] leading-tight uppercase truncate">
              {academyInfo?.academy_name || 'Academy'}
            </h1>
            <p className="text-[7px] font-bold text-[#0c73e8] tracking-[0.2em] uppercase mt-0.5">Management</p>
          </div>
        </div>

        {/* 2 & 3. 날짜 및 사용자 정보 */}
        <div className="flex items-stretch gap-1">
          <div className="flex-[1.2] px-1.5 py-1 bg-white rounded-[2px] border border-[#edece9] flex items-center justify-center gap-1 min-w-0">
            <span className="text-[15px] font-black text-[#37352f] tabular-nums leading-none">{new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
            <span className="text-[13px] font-bold text-[#0c73e8] leading-none">({new Date().toLocaleDateString('ko-KR', { weekday: 'short' })})</span>
          </div>
          {user && (
            <div className="flex-1 p-1.5 bg-white rounded-[2px] border border-[#edece9] flex items-center gap-1.5 min-w-0">
              <div className="w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center text-[#0c73e8] shrink-0"><UserCircle size={10} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-[#37352f] truncate leading-none">{user.name}</p>
                <p className="text-[9px] font-bold text-[#37352f]/50 uppercase tracking-tighter mt-0.5">{user.role}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar-v">
        <nav className="space-y-1">
          <h3 className="text-[9px] font-bold text-[#37352f]/45 uppercase tracking-widest mb-2 px-2">Menu</h3>
          <SidebarLink icon={<Zap size={14} className={isClassroomModeOpen ? "text-amber-500 fill-current animate-pulse" : "text-amber-500"} />} label="수업 시작 (LIVE)" active={isClassroomModeOpen} onClick={() => { onStartClass(); }} variant="blue" />
          <SidebarLink icon={<Bell size={14} className="text-rose-500" />} label="공지/건의/설문" active={viewMode === 'notifications'} onClick={() => { setViewMode('notifications'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<LayoutDashboard size={14} className="text-purple-500" />} label="Overview" active={viewMode === 'board' && selectedFilter !== 'Discharged'} onClick={() => { setViewMode('board'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<TableIcon size={14} className="text-sky-500" />} label="Daily Sheet" active={viewMode === 'todayTable'} onClick={() => { setViewMode('todayTable'); setSelectedFilter('All'); }} badge={todayCount > 0 ? String(todayCount) : undefined} />
          <SidebarLink icon={<ClipboardCheck size={14} className="text-pink-500" />} label="업무 및 보강 관리" active={viewMode === 'teacherTask'} onClick={() => { setViewMode('teacherTask'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<AlertTriangle size={14} className="text-orange-500" />} label="교재 오류 관리" active={viewMode === 'problemErrors'} onClick={() => { setViewMode('problemErrors'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<Activity size={14} className="text-teal-500" />} label="교재별진도" active={viewMode === 'progress'} onClick={() => { setViewMode('progress'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<FileText size={14} className="text-blue-500" />} label="기출문제 관리" active={viewMode === 'exams'} onClick={() => { setViewMode('exams'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<BookOpen size={14} className="text-emerald-500" />} label="오답노트 관리" active={viewMode === 'wrongAnswersAdmin'} onClick={() => { setViewMode('wrongAnswersAdmin'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<UserCog size={14} className="text-amber-600" />} label="학생정보수정" active={viewMode === 'studentEdit'} onClick={() => { setViewMode('studentEdit'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<ArrowLeftRight size={14} className="text-indigo-500" />} label="이번 달 변동 사항" active={viewMode === 'monthlyChanges'} onClick={() => { setViewMode('monthlyChanges'); setSelectedFilter('All'); }} />
        </nav>
 
        <nav className="space-y-1">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-[9px] font-bold text-[#37352f]/45 uppercase tracking-widest">Filter</h3>
            <div className="flex bg-[#edece9]/50 rounded-[2px] p-0.5 border border-[#edece9]">
              {(['all', 'today', 'rest'] as const).map((t) => (
                <button key={t} onClick={() => setFilterTarget(t)} className={`text-[7px] px-1.5 py-0.5 rounded-[1px] font-black uppercase transition-all ${filterTarget === t ? 'bg-[#edece9] text-[#37352f] shadow-sm' : 'text-[#37352f]/60 hover:text-[#37352f]'}`}>
                  {t === 'all' ? 'All' : t === 'today' ? 'Top' : 'Btm'}
                </button>
              ))}
            </div>
          </div>
 
          <div className="px-1 space-y-3">
            <div className="space-y-1.5 w-full">
              <div className="flex bg-[#edece9]/50 rounded-[2px] p-0.5 border border-[#edece9] w-full">
                {[
                  { label: 'ALL', key: 'All' }, { label: '고', key: '고' }, { label: '중', key: '중' }, { label: '초', key: '초' }
                ].map((g) => {
                  const isActive = selectedFilter === g.key || (g.key !== 'All' && selectedFilter.startsWith(g.key));
                  return (
                    <button 
                       key={g.key} 
                       onClick={() => {
                         if (g.key === 'All') {
                           setSelectedFilter('All');
                         } else {
                           setSelectedFilter(g.key);
                         }
                       }} 
                       className={`flex-1 flex flex-col items-center py-1 rounded-[1px] transition-all ${isActive ? 'bg-[#edece9] text-[#37352f] shadow-sm' : 'text-[#37352f]/60 hover:text-[#37352f]'}`}
                    >
                      <span className="text-[9px] font-black uppercase">{g.label}</span>
                      <span className={`text-[7px] font-bold opacity-80 ${isActive ? 'text-[#37352f]' : 'text-[#37352f]/50'}`}>
                        {g.key === 'All' ? students.filter(s => !s.is_deleted).length : students.filter(s => !s.is_deleted && s.grade.includes(g.key)).length}
                      </span>
                    </button>
                  );
                })}
              </div>
 
              {/* 💡 세부 학년 폴더형 칩 필터 애니메이션 */}
              <AnimatePresence initial={false}>
                {['초', '중', '고'].some(key => selectedFilter.startsWith(key)) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden w-full pt-1"
                  >
                    {selectedFilter.startsWith('초') && (
                      <div className="grid grid-cols-6 gap-1">
                        {['1', '2', '3', '4', '5', '6'].map(num => {
                          const gradeKey = `초${num}`;
                          const isSubActive = selectedFilter === gradeKey;
                          return (
                            <button
                              key={num}
                              onClick={() => setSelectedFilter(isSubActive ? '초' : gradeKey)}
                              className={`h-[20px] rounded-[2px] text-[8px] font-black transition-all ${
                                isSubActive 
                                  ? 'bg-[#edece9] text-[#37352f] shadow-sm' 
                                  : 'bg-white border border-[#edece9] text-[#37352f]/70 hover:bg-[#edece9]/55'
                              }`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {selectedFilter.startsWith('중') && (
                      <div className="grid grid-cols-3 gap-1">
                        {['1', '2', '3'].map(num => {
                          const gradeKey = `중${num}`;
                          const isSubActive = selectedFilter === gradeKey;
                          return (
                            <button
                              key={num}
                              onClick={() => setSelectedFilter(isSubActive ? '중' : gradeKey)}
                              className={`h-[20px] rounded-[2px] text-[8px] font-black transition-all ${
                                isSubActive 
                                  ? 'bg-[#edece9] text-[#37352f] shadow-sm' 
                                  : 'bg-white border border-[#edece9] text-[#37352f]/70 hover:bg-[#edece9]/55'
                              }`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {selectedFilter.startsWith('고') && (
                      <div className="grid grid-cols-3 gap-1">
                        {['1', '2', '3'].map(num => {
                          const gradeKey = `고${num}`;
                          const isSubActive = selectedFilter === gradeKey;
                          return (
                            <button
                              key={num}
                              onClick={() => setSelectedFilter(isSubActive ? '고' : gradeKey)}
                              className={`h-[20px] rounded-[2px] text-[8px] font-black transition-all ${
                                isSubActive 
                                  ? 'bg-[#edece9] text-[#37352f] shadow-sm' 
                                  : 'bg-white border border-[#edece9] text-[#37352f]/70 hover:bg-[#edece9]/55'
                              }`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
 
            <div className="space-y-2">
              <div className="flex gap-[3px] w-full">
                {DAYS_SHORT.map((day) => {
                  const isActive = selectedDays.includes(day);
                  return (
                    <button key={day} onClick={() => toggleDay(day)} className={`flex-1 h-[22px] rounded-[2px] text-[9px] font-black transition-all border ${isActive ? 'bg-[#0c73e8] border-[#0c73e8] text-white shadow-sm' : 'bg-white border-[#edece9] text-[#37352f] hover:bg-[#edece9]/45'}`}>{day}</button>
                  );
                })}
              </div>
              {selectedDays.length > 0 && (
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-0.5 bg-[#edece9]/50 p-0.5 rounded-[2px] border border-[#edece9]">
                    <button onClick={() => { setIsAndFilter(true); setIsMultiMode(true); }} className={`px-1.5 py-0.5 rounded-[1px] text-[7px] font-black transition-all ${isMultiMode && isAndFilter ? 'bg-[#edece9] text-[#37352f] shadow-sm' : 'text-[#37352f]/60 hover:text-[#37352f]'}`}>AND</button>
                    <button onClick={() => { setIsAndFilter(false); setIsMultiMode(true); }} className={`px-1.5 py-0.5 rounded-[1px] text-[7px] font-black transition-all ${isMultiMode && !isAndFilter ? 'bg-[#edece9] text-[#37352f] shadow-sm' : 'text-[#37352f]/60 hover:text-[#37352f]'}`}>OR</button>
                  </div>
                  <button onClick={() => { setSelectedDays([]); setIsAndFilter(false); setIsMultiMode(false); }} className="text-blue-600 hover:text-blue-500 lowercase font-bold tracking-normal text-[8px] px-1">reset</button>
                </div>
              )}
            </div>
 
            {isAdmin && (
              <div className="pt-1">
                <div className="relative group">
                  <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className="w-full bg-white border border-[#edece9] rounded-[2px] py-2 px-3 text-[10px] font-black text-[#37352f] outline-none appearance-none cursor-pointer hover:bg-[#edece9]/30 transition-all">
                    <option value="All" className="bg-white text-[#37352f]">All Teachers (전체 교사)</option>
                    {(teachers || []).map((t, idx) => <option key={t.id || idx} value={t.id} className="bg-white text-[#37352f]">{t.name} 선생님</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#37352f]/60 group-hover:text-blue-500 transition-colors"><UserCircle size={12} /></div>
                </div>
              </div>
            )}
 
            {/* 💡 시작 시간대 필터 추가 */}
            <div className="pt-1">
              <div className="relative group">
                <select value={selectedHour} onChange={(e) => setSelectedHour(e.target.value)} className="w-full bg-white border border-[#edece9] rounded-[2px] py-2 px-3 text-[10px] font-black text-[#37352f] outline-none appearance-none cursor-pointer hover:bg-[#edece9]/30 transition-all">
                  <option value="All" className="bg-white text-[#37352f]">All Times (전체 시간)</option>
                  {availableHours.map((h, idx) => <option key={h || idx} value={String(h)} className="bg-white text-[#37352f]">{formatHour(h)}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#37352f]/60 group-hover:text-blue-500 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </div>
 
      <div className="pt-4 border-t border-[#edece9] space-y-1">
        {/* 테마 토글 버튼 */}
        <button onClick={toggleTheme} className="w-full flex items-center gap-2 px-3 py-2 rounded-[2px] text-[#37352f]/70 hover:bg-[#edece9] hover:text-[#37352f] transition-all group font-bold">
          <Moon size={14} className="text-[#0c73e8] group-hover:animate-bounce" />
          <span className="text-[11px]">Dark Mode</span>
        </button>
 
        {/* 💡 [수정] 관리자 전용 메뉴로 제한 */}
        {isAdmin && (
          <SidebarLink icon={<Settings size={14} />} label="Settings" active={viewMode === 'settings'} onClick={() => { setViewMode('settings'); setSelectedFilter('All'); }} />
        )}
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-[2px] text-[#37352f]/70 hover:bg-red-50 hover:text-red-650 transition-all group font-bold">
          <LogOut size={14} />
          <span className="text-[11px]">Log Out</span>
        </button>
      </div>
    </aside>
  );
}
 
function SidebarLink({ icon, label, active = false, onClick, badge, variant }: any) {
  const isBlueVariant = variant === 'blue';
  return (
    <div 
      onClick={onClick} 
      className={`flex items-center gap-2 px-3 py-2 rounded-[2px] cursor-pointer transition-all group ${
        active 
          ? 'bg-[#edece9] text-[#37352f] font-extrabold shadow-sm' 
          : isBlueVariant
            ? 'bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm'
            : 'text-[#37352f]/80 hover:bg-[#edece9]/50 hover:text-[#37352f]'
      }`}
    >
      <span className={(active || isBlueVariant) ? 'text-[#37352f]' : 'text-[#37352f]/70 group-hover:text-[#37352f] transition-colors'}>{icon}</span>
      <span className={`font-bold text-[11px] tracking-tight ${active ? 'text-[#37352f]' : 'text-[#37352f]/80 group-hover:text-[#37352f] transition-colors'}`}>{label}</span>
      {badge && <span className="ml-auto bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded ring-2 ring-[#f7f7f5]">{badge}</span>}
    </div>
  );
}
