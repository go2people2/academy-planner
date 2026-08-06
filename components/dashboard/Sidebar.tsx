'use client';

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Table as TableIcon, Activity, Settings, LogOut, GraduationCap, UserX, UserCog, ArrowLeftRight, UserCircle,
  ChevronLeft, ChevronRight, Bell, Edit2, Save, X, MessageSquare, Calendar, TrendingUp, Sun, Moon, ClipboardCheck, Zap, AlertTriangle,
  BookOpen, FileText, GripVertical, Library, Film
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

const DEFAULT_MENU_ORDER = [
  'live', 'board', 'todayTable', 'pdfLibrary', 'videoTest', 'teacherTask', 'studentEdit',
  'progress', 'monthlyChanges', 'exams', 'problemErrors', 'wrongAnswersAdmin'
];

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
  const [menuOrder, setMenuOrder] = useState<string[]>(DEFAULT_MENU_ORDER);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!currentUser?.id) return;
    const saved = localStorage.getItem(`ams_sidebar_order_${currentUser.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[];
        const merged = [
          ...parsed.filter(id => DEFAULT_MENU_ORDER.includes(id)),
          ...DEFAULT_MENU_ORDER.filter(id => !parsed.includes(id))
        ];
        setMenuOrder(merged);
      } catch {}
    }
  }, [currentUser?.id]);

  const handleDragStart = (id: string) => setDraggedId(id);

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === id) return;
    setDragOverId(id);
    setMenuOrder(prev => {
      const next = [...prev];
      const from = next.indexOf(draggedId);
      const to = next.indexOf(id);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
  };

  const handleDragEnd = () => {
    if (currentUser?.id) {
      localStorage.setItem(`ams_sidebar_order_${currentUser.id}`, JSON.stringify(menuOrder));
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const toggleTheme = () => {
    localStorage.setItem('theme', 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    router.push(`/${slug}/dashboard-light`);
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
    <aside className="w-52 border-r border-white/5 bg-[#0a0a0a]/90 backdrop-blur-2xl flex flex-col p-3 sticky top-0 h-screen z-30">
      {/* 내비게이션 제어 */}
      <div className="flex items-stretch gap-1 mb-6">
        <button onClick={() => window.history.back()} className="flex-1 py-1.5 rounded-[2px] bg-white/[0.05] border border-white/10 text-gray-300 hover:text-white hover:bg-blue-600/20 hover:border-blue-500/30 transition-all active:scale-95 group flex items-center justify-center">
          <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <button onClick={() => window.history.forward()} className="flex-1 py-1.5 rounded-[2px] bg-white/[0.05] border border-white/10 text-gray-300 hover:text-white hover:bg-blue-600/20 hover:border-blue-500/30 transition-all active:scale-95 group flex items-center justify-center">
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="mb-6 px-1 space-y-4">
        {/* 1. 학원 브랜딩 */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('board')}>
          <div className="w-8 h-8 bg-blue-600 rounded-[2px] flex items-center justify-center shadow-lg shrink-0">
            <GraduationCap className="text-white" size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-black tracking-tight text-white leading-tight uppercase truncate">
              {academyInfo?.academy_name || 'Academy'}
            </h1>
            <p className="text-[7px] font-bold text-blue-500 tracking-[0.2em] uppercase mt-0.5">Management</p>
          </div>
        </div>

        {/* 2 & 3. 날짜 및 사용자 정보 */}
        <div className="flex items-stretch gap-1">
          <div className="flex-[1.2] px-1.5 py-1 bg-white/[0.05] rounded-[2px] border border-white/10 flex items-center justify-center gap-1 min-w-0">
            <span className="text-[15px] font-black text-gray-100 tabular-nums leading-none">{new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
            <span className="text-[13px] font-bold text-blue-400 leading-none">({new Date().toLocaleDateString('ko-KR', { weekday: 'short' })})</span>
          </div>
          {user && (
            <div className="flex-1 p-1.5 bg-white/5 rounded-[2px] border border-white/5 flex items-center gap-1.5 min-w-0">
              <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0"><UserCircle size={10} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-white truncate leading-none">{user.name}</p>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter mt-0.5">{user.role}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar-v">
        <nav className="space-y-1">
          <h3 className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2 px-2">Menu</h3>
          {menuOrder.map(id => {
            const menuMap: Record<string, any> = {
              live: <SidebarLink key="live" id="live" icon={<Zap size={14} className={isClassroomModeOpen ? "text-amber-500 fill-current animate-pulse" : "text-amber-400"} />} label="수업 시작 (LIVE)" active={isClassroomModeOpen} onClick={() => onStartClass()} variant="blue" isDragging={draggedId === 'live'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              board: <SidebarLink key="board" id="board" icon={<LayoutDashboard size={14} className="text-purple-400" />} label="Overview" active={viewMode === 'board' && selectedFilter !== 'Discharged'} onClick={() => { setViewMode('board'); setSelectedFilter('All'); }} isDragging={draggedId === 'board'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              todayTable: <SidebarLink key="todayTable" id="todayTable" icon={<TableIcon size={14} className="text-sky-400" />} label="Daily Sheet" active={viewMode === 'todayTable'} onClick={() => { setViewMode('todayTable'); setSelectedFilter('All'); }} badge={todayCount > 0 ? String(todayCount) : undefined} isDragging={draggedId === 'todayTable'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              pdfLibrary: <SidebarLink key="pdfLibrary" id="pdfLibrary" icon={<Library size={14} className="text-indigo-400" />} label="교재 PDF 자료실" active={viewMode === 'pdfLibrary'} onClick={() => { setViewMode('pdfLibrary'); setSelectedFilter('All'); }} isDragging={draggedId === 'pdfLibrary'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              videoTest: <SidebarLink key="videoTest" id="videoTest" icon={<Film size={14} className="text-purple-400" />} label="비디오 플레이어 실험실" active={viewMode === 'videoTest'} onClick={() => { setViewMode('videoTest'); setSelectedFilter('All'); }} isDragging={draggedId === 'videoTest'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              teacherTask: <SidebarLink key="teacherTask" id="teacherTask" icon={<ClipboardCheck size={14} className="text-pink-400" />} label="업무/보강/설문" active={viewMode === 'teacherTask'} onClick={() => { setViewMode('teacherTask'); setSelectedFilter('All'); }} isDragging={draggedId === 'teacherTask'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              problemErrors: <SidebarLink key="problemErrors" id="problemErrors" icon={<AlertTriangle size={14} className="text-orange-400" />} label="교재 오류 관리" active={viewMode === 'problemErrors'} onClick={() => { setViewMode('problemErrors'); setSelectedFilter('All'); }} isDragging={draggedId === 'problemErrors'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              progress: <SidebarLink key="progress" id="progress" icon={<Activity size={14} className="text-teal-400" />} label="교재별진도" active={viewMode === 'progress'} onClick={() => { setViewMode('progress'); setSelectedFilter('All'); }} isDragging={draggedId === 'progress'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              exams: <SidebarLink key="exams" id="exams" icon={<FileText size={14} className="text-blue-400" />} label="기출문제 관리" active={viewMode === 'exams'} onClick={() => { setViewMode('exams'); setSelectedFilter('All'); }} isDragging={draggedId === 'exams'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              wrongAnswersAdmin: <SidebarLink key="wrongAnswersAdmin" id="wrongAnswersAdmin" icon={<BookOpen size={14} className="text-emerald-400" />} label="오답노트 관리" active={viewMode === 'wrongAnswersAdmin'} onClick={() => { setViewMode('wrongAnswersAdmin'); setSelectedFilter('All'); }} isDragging={draggedId === 'wrongAnswersAdmin'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              studentEdit: <SidebarLink key="studentEdit" id="studentEdit" icon={<UserCog size={14} className="text-amber-400" />} label="학생정보수정" active={viewMode === 'studentEdit'} onClick={() => { setViewMode('studentEdit'); setSelectedFilter('All'); }} isDragging={draggedId === 'studentEdit'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
              monthlyChanges: <SidebarLink key="monthlyChanges" id="monthlyChanges" icon={<ArrowLeftRight size={14} className="text-indigo-400" />} label="이번 달 변동 사항" active={viewMode === 'monthlyChanges'} onClick={() => { setViewMode('monthlyChanges'); setSelectedFilter('All'); }} isDragging={draggedId === 'monthlyChanges'} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />,
            };
            return menuMap[id] ?? null;
          })}
        </nav>

        <nav className="space-y-1">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Filter</h3>
            <div className="flex bg-white/10 rounded-[2px] p-0.5 border border-white/10">
              {(['all', 'today', 'rest'] as const).map((t) => (
                <button key={t} onClick={() => setFilterTarget(t)} className={`text-[7px] px-1.5 py-0.5 rounded-[1px] font-black uppercase transition-all ${filterTarget === t ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-300 hover:text-white'}`}>
                  {t === 'all' ? 'All' : t === 'today' ? 'Top' : 'Btm'}
                </button>
              ))}
            </div>
          </div>

          <div className="px-1 space-y-3">
            <div className="space-y-1.5 w-full">
              <div className="flex bg-white/5 rounded-[2px] p-0.5 border border-white/5 w-full">
                {[
                  { label: 'ALL', key: 'All' }, { label: 'HS', key: '고' }, { label: 'MS', key: '중' }, { label: 'ES', key: '초' }
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
                      className={`flex-1 flex flex-col items-center py-1 rounded-[1px] transition-all ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-300 hover:text-white'}`}
                    >
                      <span className="text-[9px] font-black uppercase">{g.label}</span>
                      <span className={`text-[7px] font-bold opacity-70 ${isActive ? 'text-white' : 'text-gray-300'}`}>
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
                                  ? 'bg-blue-600 text-white shadow-md' 
                                  : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
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
                                  ? 'bg-blue-600 text-white shadow-md' 
                                  : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
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
                                  ? 'bg-blue-600 text-white shadow-md' 
                                  : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
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
                    <button key={day} onClick={() => toggleDay(day)} className={`flex-1 h-[22px] rounded-[2px] text-[9px] font-black transition-all border ${isActive ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-white/10 border-white/10 text-gray-300 hover:bg-white/20 hover:text-white'}`}>{day}</button>
                  );
                })}
              </div>
              {selectedDays.length > 0 && (
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-[2px] border border-white/5">
                    <button onClick={() => { setIsAndFilter(true); setIsMultiMode(true); }} className={`px-1.5 py-0.5 rounded-[1px] text-[7px] font-black transition-all ${isMultiMode && isAndFilter ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-300 hover:text-white'}`}>AND</button>
                    <button onClick={() => { setIsAndFilter(false); setIsMultiMode(true); }} className={`px-1.5 py-0.5 rounded-[1px] text-[7px] font-black transition-all ${isMultiMode && !isAndFilter ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-300 hover:text-white'}`}>OR</button>
                  </div>
                  <button onClick={() => { setSelectedDays([]); setIsAndFilter(false); setIsMultiMode(false); }} className="text-blue-500 hover:text-blue-400 lowercase font-bold tracking-normal text-[8px] px-1">reset</button>
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="pt-1">
                <div className="relative group">
                  <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className="w-full bg-white/10 border border-white/15 rounded-[2px] py-2 px-3 text-[10px] font-black text-gray-200 outline-none appearance-none cursor-pointer hover:bg-white/20 hover:text-white hover:border-white/30 transition-all">
                    <option value="All" className="bg-[#121212]">All Teachers (전체 교사)</option>
                    {(teachers || []).map((t, idx) => <option key={t.id || idx} value={t.id} className="bg-[#121212]">{t.name} 선생님</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 group-hover:text-blue-500 transition-colors"><UserCircle size={12} /></div>
                </div>
              </div>
            )}

            {/* 💡 시작 시간대 필터 추가 */}
            <div className="pt-1">
              <div className="relative group">
                <select value={selectedHour} onChange={(e) => setSelectedHour(e.target.value)} className="w-full bg-white/10 border border-white/15 rounded-[2px] py-2 px-3 text-[10px] font-black text-gray-200 outline-none appearance-none cursor-pointer hover:bg-white/20 hover:text-white hover:border-white/30 transition-all">
                  <option value="All" className="bg-[#121212]">All Times (전체 시간)</option>
                  {availableHours.map((h, idx) => <option key={h || idx} value={String(h)} className="bg-[#121212]">{formatHour(h)}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 group-hover:text-blue-500 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </div>

      <div className="pt-4 border-t border-white/5 space-y-1">
        {/* 테마 토글 버튼 */}
        <button onClick={toggleTheme} className="w-full flex items-center gap-2 px-3 py-2 rounded-[2px] text-gray-300 hover:bg-white/10 hover:text-white transition-all group font-bold" title="Light Mode로 전환">
          <Moon size={14} className="text-indigo-400 group-hover:animate-pulse" />
          <span className="text-[11px]">Dark Mode</span>
        </button>

        <SidebarLink icon={<Settings size={14} />} label="Settings" active={viewMode === 'settings'} onClick={() => { setViewMode('settings'); setSelectedFilter('All'); }} />
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-[2px] text-gray-300 hover:bg-red-600/20 hover:text-red-400 transition-all group font-bold">
          <LogOut size={14} />
          <span className="text-[11px]">Log Out</span>
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ id, icon, label, active = false, onClick, badge, variant, isDragging, onDragStart, onDragOver, onDragEnd }: any) {
  const isBlueVariant = variant === 'blue';
  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart?.(id); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(e, id); }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-[2px] cursor-pointer transition-all group ${
        isDragging
          ? 'opacity-40 scale-95 border border-dashed border-white/20'
          : active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
            : isBlueVariant
              ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white shadow-inner'
              : 'text-gray-200 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span className="opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing text-gray-400 shrink-0 -ml-1">
        <GripVertical size={12} />
      </span>
      <span className={(active || isBlueVariant) ? 'text-white' : 'group-hover:text-blue-500 transition-colors'}>{icon}</span>
      <span className="font-bold text-[11px] tracking-tight">{label}</span>
      {badge && <span className="ml-auto bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded ring-2 ring-[#0a0a0a]">{badge}</span>}
    </div>
  );
}
