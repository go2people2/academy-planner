'use client';

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Table as TableIcon, Activity, Settings, LogOut, GraduationCap, UserX, UserCog, ArrowLeftRight, UserCircle,
  ChevronLeft, ChevronRight, Bell, Edit2, Save, X, MessageSquare, Calendar, TrendingUp
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
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
}

const DAYS_SHORT = ['월', '화', '수', '목', '금', '토', '일'];

export default function Sidebar({ 
  viewMode, setViewMode, todayCount, students, selectedFilter, setSelectedFilter,
  selectedDays, setSelectedDays, isAndFilter, setIsAndFilter, 
  filterTarget, setFilterTarget,
  academyInfo, onUpdateAcademyInfo,
  teachers, selectedTeacherId, setSelectedTeacherId 
}: SidebarProps) {
  const router = useRouter();
  const { slug } = useParams();
  const [user, setUser] = useState<any>(null);

  const [isMultiMode, setIsMultiMode] = useState(false);
  const [isEditingStrategy, setIsEditingStrategy] = useState(false);
  const [tempNotices, setTempNotices] = useState<any>({});

  const isAdmin = user?.role === 'admin';
  const announcements = academyInfo?.announcements || {};

  useEffect(() => {
    const userJson = localStorage.getItem('ams_user');
    if (userJson) setUser(JSON.parse(userJson));
  }, []);

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
        <button onClick={() => window.history.back()} className="flex-1 py-3 rounded-[2px] bg-white/[0.03] border border-white/5 text-gray-500 hover:text-white hover:bg-blue-600/20 hover:border-blue-500/30 transition-all active:scale-95 group flex items-center justify-center">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <button onClick={() => window.history.forward()} className="flex-1 py-3 rounded-[2px] bg-white/[0.03] border border-white/5 text-gray-500 hover:text-white hover:bg-blue-600/20 hover:border-blue-500/30 transition-all active:scale-95 group flex items-center justify-center">
          <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
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

        {/* 💡 학원 전략 위젯 */}
        <div className="relative bg-white/5 border border-white/5 rounded-[4px] p-3 space-y-2 group/strategy">
          <div className="flex items-center justify-between">
            <h3 className="text-[8px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={10} className="text-blue-500" /> Academy Strategy
            </h3>
            {isAdmin && (
              <button onClick={() => setIsEditingStrategy(true)} className="opacity-0 group-hover/strategy:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-[2px] text-gray-400 hover:text-white">
                <Edit2 size={10} />
              </button>
            )}
          </div>
          <div className="space-y-1.5 min-h-[30px]">
            {announcements.daily ? (
              <p className="text-[10px] font-bold text-gray-200 leading-snug line-clamp-2 italic">"{announcements.daily}"</p>
            ) : (
              <p className="text-[9px] text-gray-600 italic">No active strategy</p>
            )}
          </div>

          <AnimatePresence>
            {isEditingStrategy && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#121212] border border-white/10 rounded-[4px] w-full max-w-sm shadow-2xl p-6 space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Settings size={14} className="text-blue-500" /> Quick Edit Notice</h4>
                    <button onClick={() => setIsEditingStrategy(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
                  </div>
                  <div className="space-y-4">
                    {[
                      { key: 'monthly', label: 'Month Focus', icon: <Calendar size={12} /> },
                      { key: 'weekly', label: 'Week Goal', icon: <TrendingUp size={12} /> },
                      { key: 'daily', label: 'Daily Note', icon: <MessageSquare size={12} /> }
                    ].map(item => (
                      <div key={item.key} className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-500 uppercase flex items-center gap-1.5">{item.icon} {item.label}</label>
                        <textarea value={tempNotices[item.key] || ''} onChange={(e) => setTempNotices({ ...tempNotices, [item.key]: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 rounded-[2px] p-2.5 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all min-h-[60px] resize-none" />
                      </div>
                    ))}
                  </div>
                  <button onClick={async () => { if (onUpdateAcademyInfo) await onUpdateAcademyInfo({ announcements: tempNotices }); setIsEditingStrategy(false); }}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-[2px] shadow-lg transition-all flex items-center justify-center gap-2"
                  ><Save size={14} /> Update All Notices</button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* 2 & 3. 날짜 및 사용자 정보 */}
        <div className="flex items-stretch gap-1">
          <div className="flex-1 px-1.5 py-1 bg-white/[0.03] rounded-[2px] border border-white/5 flex items-center justify-center gap-1 min-w-0">
            <span className="text-[10px] font-black text-gray-300 tabular-nums leading-none">{new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
            <span className="text-[9px] font-bold text-blue-500 leading-none">({new Date().toLocaleDateString('ko-KR', { weekday: 'short' })})</span>
          </div>
          {user && (
            <div className="flex-[1.2] p-1.5 bg-white/5 rounded-[2px] border border-white/5 flex items-center gap-1.5 min-w-0">
              <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0"><UserCircle size={10} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-white truncate leading-none">{user.name}</p>
                <p className="text-[7px] font-bold text-gray-500 uppercase tracking-tighter mt-0.5">{user.role}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar-v">
        <nav className="space-y-1">
          <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">Menu</h3>
          <SidebarLink icon={<LayoutDashboard size={14} />} label="Overview" active={viewMode === 'board' && selectedFilter !== 'Discharged'} onClick={() => { setViewMode('board'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<Bell size={14} />} label="Notifications" active={viewMode === 'notifications'} onClick={() => { setViewMode('notifications'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<TableIcon size={14} />} label="Daily Sheet" active={viewMode === 'todayTable'} onClick={() => { setViewMode('todayTable'); setSelectedFilter('All'); }} badge={todayCount > 0 ? String(todayCount) : undefined} />
          <SidebarLink icon={<Activity size={14} />} label="Progress" active={viewMode === 'progress'} onClick={() => { setViewMode('progress'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<UserCog size={14} />} label="학생정보수정" active={viewMode === 'studentEdit'} onClick={() => { setViewMode('studentEdit'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<ArrowLeftRight size={14} />} label="이번 달 변동 사항" active={viewMode === 'monthlyChanges'} onClick={() => { setViewMode('monthlyChanges'); setSelectedFilter('All'); }} />
          <SidebarLink icon={<UserX size={14} />} label="Discharged" active={viewMode === 'board' && selectedFilter === 'Discharged'} onClick={() => { setViewMode('board'); setSelectedFilter('Discharged'); }} />
        </nav>

        <nav className="space-y-1">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Filter</h3>
            <div className="flex bg-white/5 rounded-[2px] p-0.5 border border-white/5">
              {(['all', 'today', 'rest'] as const).map((t) => (
                <button key={t} onClick={() => setFilterTarget(t)} className={`text-[7px] px-1.5 py-0.5 rounded-[1px] font-black uppercase transition-all ${filterTarget === t ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-400'}`}>
                  {t === 'all' ? 'All' : t === 'today' ? 'Top' : 'Btm'}
                </button>
              ))}
            </div>
          </div>

          <div className="px-1 space-y-3">
            <div className="flex bg-white/5 rounded-[2px] p-0.5 border border-white/5 w-full">
              {[
                { label: 'ALL', key: 'All' }, { label: 'HS', key: '고' }, { label: 'MS', key: '중' }, { label: 'ES', key: '초' }
              ].map((g) => (
                <button key={g.key} onClick={() => setSelectedFilter(g.key)} className={`flex-1 flex flex-col items-center py-1 rounded-[1px] transition-all ${selectedFilter === g.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-400'}`}>
                  <span className="text-[9px] font-black uppercase">{g.label}</span>
                  <span className={`text-[7px] font-bold opacity-40 ${selectedFilter === g.key ? 'text-white' : 'text-gray-500'}`}>
                    {g.key === 'All' ? students.filter(s => !s.is_deleted).length : students.filter(s => !s.is_deleted && s.grade.includes(g.key)).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex gap-[3px] w-full">
                {DAYS_SHORT.map((day) => {
                  const isActive = selectedDays.includes(day);
                  return (
                    <button key={day} onClick={() => toggleDay(day)} className={`flex-1 h-[22px] rounded-[2px] text-[9px] font-black transition-all border ${isActive ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-400'}`}>{day}</button>
                  );
                })}
              </div>
              {selectedDays.length > 0 && (
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-[2px] border border-white/5">
                    <button onClick={() => { setIsAndFilter(true); setIsMultiMode(true); }} className={`px-1.5 py-0.5 rounded-[1px] text-[7px] font-black transition-all ${isMultiMode && isAndFilter ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-400'}`}>AND</button>
                    <button onClick={() => { setIsAndFilter(false); setIsMultiMode(true); }} className={`px-1.5 py-0.5 rounded-[1px] text-[7px] font-black transition-all ${isMultiMode && !isAndFilter ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-400'}`}>OR</button>
                  </div>
                  <button onClick={() => { setSelectedDays([]); setIsAndFilter(false); setIsMultiMode(false); }} className="text-blue-500 hover:text-blue-400 lowercase font-bold tracking-normal text-[8px] px-1">reset</button>
                </div>
              )}
            </div>

            <div className="pt-1">
              <div className="relative group">
                <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-[2px] py-2 px-3 text-[10px] font-black text-gray-400 outline-none appearance-none cursor-pointer hover:bg-white/10 hover:text-white hover:border-white/20 transition-all">
                  <option value="All" className="bg-[#121212]">All Teachers (전체)</option>
                  {(teachers || []).map(t => <option key={t.id} value={t.id} className="bg-[#121212]">{t.name} 선생님</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 group-hover:text-blue-500 transition-colors"><UserCircle size={12} /></div>
              </div>
            </div>
          </div>
        </nav>
      </div>

      <div className="pt-4 border-t border-white/5 space-y-1">
        <SidebarLink icon={<Settings size={14} />} label="Settings" active={viewMode === 'settings'} onClick={() => { setViewMode('settings'); setSelectedFilter('All'); }} />
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-[2px] text-gray-500 hover:bg-red-500/10 hover:text-red-500 transition-all group font-bold">
          <LogOut size={14} />
          <span className="text-[11px]">Log Out</span>
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ icon, label, active = false, onClick, badge }: any) {
  return (
    <div onClick={onClick} className={`flex items-center gap-2 px-3 py-2 rounded-[2px] cursor-pointer transition-all group ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>
      <span className={active ? 'text-white' : 'group-hover:text-blue-500 transition-colors'}>{icon}</span>
      <span className="font-bold text-[11px] tracking-tight">{label}</span>
      {badge && <span className="ml-auto bg-red-600 text-white text-[8px] font-black px-1 py-0.5 rounded ring-2 ring-[#0a0a0a]">{badge}</span>}
    </div>
  );
}
