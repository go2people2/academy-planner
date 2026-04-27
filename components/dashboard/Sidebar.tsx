'use client';

import { 
  LayoutDashboard, Table as TableIcon, Activity, Settings, LogOut, GraduationCap 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  viewMode: string;
  setViewMode: (mode: any) => void;
  todayCount: number;
  students: any[];
  selectedFilter: string;
  setSelectedFilter: (filter: string) => void;
}

export default function Sidebar({ 
  viewMode, setViewMode, todayCount, students, selectedFilter, setSelectedFilter 
}: SidebarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="w-52 border-r border-white/5 bg-[#0a0a0a]/90 backdrop-blur-2xl flex flex-col p-3 sticky top-0 h-screen z-30">
      <div className="flex items-center gap-2 mb-6 px-1 cursor-pointer" onClick={() => setViewMode('board')}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
          <GraduationCap className="text-white" size={18} />
        </div>
        <div>
          <h1 className="text-sm font-black tracking-tight text-white leading-none uppercase">HOKMA</h1>
          <p className="text-[7px] font-bold text-blue-500 tracking-[0.2em] uppercase mt-0.5">Management</p>
        </div>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar-v">
        <nav className="space-y-1">
          <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">Menu</h3>
          <SidebarLink 
            icon={<LayoutDashboard size={14} />} 
            label="Overview" 
            active={viewMode === 'board'} 
            onClick={() => setViewMode('board')} 
          />
          <SidebarLink 
            icon={<TableIcon size={14} />} 
            label="Today Sheet" 
            active={viewMode === 'todayTable'} 
            onClick={() => setViewMode('todayTable')} 
            badge={todayCount > 0 ? String(todayCount) : undefined} 
          />
          <SidebarLink 
            icon={<Activity size={14} />} 
            label="Progress" 
            active={viewMode === 'progress'} 
            onClick={() => setViewMode('progress')} 
          />
        </nav>

        <nav className="space-y-1">
          <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">Filter</h3>
          <FilterItem label="Total" count={students.length} active={selectedFilter === 'All'} onClick={() => setSelectedFilter('All')} />
          <FilterItem label="HS (고등)" count={students.filter(s => s.grade.includes('고')).length} active={selectedFilter === '고'} onClick={() => setSelectedFilter('고')} />
          <FilterItem label="MS (중등)" count={students.filter(s => s.grade.includes('중')).length} active={selectedFilter === '중'} onClick={() => setSelectedFilter('중')} />
        </nav>
      </div>

      <div className="pt-4 border-t border-white/5 space-y-1">
        <SidebarLink icon={<Settings size={14} />} label="Settings" />
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-500 transition-all group font-bold"
        >
          <LogOut size={14} />
          <span className="text-[11px]">Log Out</span>
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ icon, label, active = false, onClick, badge }: any) {
  return (
    <div onClick={onClick} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all group ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>
      <span className={active ? 'text-white' : 'group-hover:text-blue-500 transition-colors'}>{icon}</span>
      <span className="font-bold text-[11px] tracking-tight">{label}</span>
      {badge && <span className="ml-auto bg-red-600 text-white text-[8px] font-black px-1 py-0.5 rounded ring-2 ring-[#0a0a0a]">{badge}</span>}
    </div>
  );
}

function FilterItem({ label, count, active, onClick }: any) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition-all ${active ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-400 hover:bg-white/5'}`}>
      <span className="text-[11px] font-bold">{label}</span>
      <span className="text-[9px] font-black opacity-30">{count}</span>
    </div>
  );
}
