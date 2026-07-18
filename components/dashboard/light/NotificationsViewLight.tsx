'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, CheckCircle2, Circle, Trash2, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Student, Task } from '@/types/dashboard';
import SurveyManagement from './SurveyManagementLight';

interface NotificationsViewProps {
  academyInfo: any;
  students: Student[];
  currentUser: any;
}

export default function NotificationsView({ academyInfo, students, currentUser }: NotificationsViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewTab, setViewTab] = useState<'surveys' | 'suggestions'>('suggestions');

  const isAdmin = currentUser?.role === 'admin';

  // 1. 데이터 로드
  useEffect(() => {
    fetchTasks();
  }, [academyInfo.id]);

  const fetchTasks = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('ams_tasks')
      .select('*')
      .eq('academy_id', academyInfo.id)
      .order('is_completed', { ascending: true })
      .order('target_date', { ascending: true });
    
    if (!error) setTasks(data || []);
    setIsLoading(false);
  };

  const toggleTask = async (task: Task) => {
    const { error } = await supabase.from('ams_tasks').update({ is_completed: !task.is_completed }).eq('id', task.id);
    if (!error) setTasks(tasks.map(t => t.id === task.id ? { ...t, is_completed: !t.is_completed } : t));
  };

  const deleteTask = async (id: string) => {
    if (!confirm('건의사항을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('ams_tasks').delete().eq('id', id);
    if (!error) setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="p-8 space-y-10 bg-[#f4f4f5] min-h-full max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[#e3e2e0] pb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-[#37352f] uppercase tracking-tight flex items-center gap-3">
            <Bell size={28} className="text-blue-500" />
            공지/건의/설문
          </h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">학원 설문 및 건의사항 관리</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-[#e3e2e0] pb-2">
        <button 
          onClick={() => setViewTab('suggestions')}
          className={`pb-2 text-sm font-black uppercase tracking-widest transition-all ${viewTab === 'suggestions' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-[#37352f]/50 hover:text-[#37352f]'}`}
        >
          학생 건의사항
        </button>
        <button 
          onClick={() => setViewTab('surveys')}
          className={`pb-2 text-sm font-black uppercase tracking-widest transition-all ${viewTab === 'surveys' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-[#37352f]/50 hover:text-[#37352f]'}`}
        >
          설문 / 수요조사
        </button>
      </div>

      {viewTab === 'surveys' ? (
        <SurveyManagement academyInfo={academyInfo} students={students} currentUser={currentUser} />
      ) : isLoading ? (
        <div className="py-20 text-center text-gray-400 animate-pulse text-[10px] font-black uppercase tracking-widest bg-white shadow-sm border border-[#e3e2e0] rounded-xl">Loading suggestions...</div>
      ) : (
        <SuggestionHistoryView 
          tasks={tasks} 
          toggleTask={toggleTask} 
          deleteTask={deleteTask} 
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

// --- Sub-component: SuggestionHistoryView ---
function SuggestionHistoryView({ tasks, toggleTask, deleteTask, isAdmin }: any) {
  const [sugFilter, setSugFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const suggestions = useMemo(() => {
    return tasks.filter((t: any) => t.title.startsWith('[건의]'));
  }, [tasks]);

  const filteredSuggestions = useMemo(() => {
    let result = suggestions;
    if (sugFilter === 'pending') {
      result = result.filter((t: any) => !t.is_completed);
    } else if (sugFilter === 'completed') {
      result = result.filter((t: any) => t.is_completed);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t: any) => 
        t.title.toLowerCase().includes(q) || 
        (t.content && t.content.toLowerCase().includes(q))
      );
    }
    // 최신 날짜 역순 정렬
    return result.sort((a: any, b: any) => new Date(b.target_date).getTime() - new Date(a.target_date).getTime());
  }, [suggestions, sugFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#e3e2e0] p-4 rounded-xl shadow-sm">
        {/* 필터 탭 */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Filter:</span>
          <div className="flex bg-[#f7f7f5] rounded-full p-1 border border-[#e3e2e0]">
            {[
              { id: 'all', label: '전체' },
              { id: 'pending', label: '미완료' },
              { id: 'completed', label: '완료됨' }
            ].map(f => (
              <button 
                key={f.id} 
                onClick={() => setSugFilter(f.id as any)} 
                className={`text-[10px] px-3.5 py-1.5 rounded-full font-black transition-all ${sugFilter === f.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-[#37352f]'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 검색 인풋 */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="학생 이름이나 내용 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#e3e2e0] rounded-md py-2 px-3 text-[11px] text-[#37352f] placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 건의 리스트 */}
      <div className="space-y-3">
        {filteredSuggestions.length === 0 ? (
          <div className="py-20 border border-dashed border-[#e3e2e0] rounded-xl text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest bg-white shadow-sm">
            조회된 건의 사항이 없습니다.
          </div>
        ) : (
          filteredSuggestions.map((task: any) => (
            <motion.div 
              layout 
              key={task.id} 
              className={`group bg-white border border-[#e3e2e0] rounded-xl p-4 transition-all shadow-[0_1px_4px_rgba(15,15,15,0.08)] ${
                task.is_completed ? 'opacity-60 bg-gray-50/50' : 'hover:border-blue-400'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <button 
                    onClick={() => toggleTask(task)} 
                    className={`mt-1 transition-colors shrink-0 ${task.is_completed ? 'text-emerald-500' : 'text-gray-300 hover:text-blue-500'}`}
                  >
                    {task.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className={`text-sm font-black transition-all ${task.is_completed ? 'text-gray-400 line-through' : 'text-[#37352f]'}`}>
                        {task.title.replace('[건의] ', '')}
                      </h4>
                      <span className={`text-[9px] font-black text-gray-400 uppercase tabular-nums`}>
                        {task.target_date.replace(/-/g, '.')}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed whitespace-pre-wrap ${task.is_completed ? 'text-gray-400 line-through' : 'text-[#37352f]/95'}`}>
                      {task.content}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => deleteTask(task.id)} 
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
