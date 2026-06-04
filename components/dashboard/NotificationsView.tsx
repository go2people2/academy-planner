'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Calendar, CheckCircle2, Circle, Clock, MessageSquare, 
  Plus, Trash2, UserCircle, AlertCircle, TrendingUp, Check, 
  ChevronLeft, ChevronRight, X, Filter
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Student, Task } from '@/types/dashboard';

interface NotificationsViewProps {
  academyInfo: any;
  students: Student[];
  currentUser: any;
}

export default function NotificationsView({ academyInfo, students, currentUser }: NotificationsViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'weekly' | 'monthly'>('all');

  const [newTask, setNewTask] = useState({ 
    title: '', 
    content: '', 
    display_period_type: 'custom' as 'custom' | 'weekly' | 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    target_date: new Date().toISOString().split('T')[0]
  });

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

  // 2. 업무 추가 (기간 자동 계산 포함)
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;

    // 💡 UUID 형식이 아닌 ID(예: 'admin')는 DB 저장 시 에러를 유발하므로 안전하게 처리
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUser?.id);
    const creatorId = isValidUUID ? currentUser.id : null;

    const { data, error } = await supabase.from('ams_tasks').insert([{
      academy_id: academyInfo.id,
      title: newTask.title,
      content: newTask.content,
      start_date: newTask.start_date,
      target_date: newTask.target_date,
      display_period_type: newTask.display_period_type,
      is_completed: false,
      created_by: creatorId, // 💡 안전한 ID 적용
      type: 'manual'
    }]).select();

    if (!error && data) {
      setTasks([data[0], ...tasks]);
      setIsAddingTask(false);
      setNewTask({ 
        title: '', 
        content: '', 
        display_period_type: 'custom',
        start_date: new Date().toISOString().split('T')[0],
        target_date: new Date().toISOString().split('T')[0] 
      });
    } else if (error) {
      console.error('Task create error 상세:', JSON.stringify(error, null, 2));
      alert(`업무 저장 실패: ${error.message || '알 수 없는 오류'}`);
    }
  };

  // 3. 기간 유형 선택 시 날짜 자동 설정
  const setPeriodType = (type: 'custom' | 'weekly' | 'monthly') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (type === 'weekly') {
      const day = now.getDay(); // 0(일) ~ 6(토)
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // 월요일 기준
      start = new Date(now.setDate(diff));
      end = new Date(now.setDate(diff + 6));
    } else if (type === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    setNewTask({
      ...newTask,
      display_period_type: type,
      start_date: start.toISOString().split('T')[0],
      target_date: end.toISOString().split('T')[0]
    });
  };

  const toggleTask = async (task: Task) => {
    const { error } = await supabase.from('ams_tasks').update({ is_completed: !task.is_completed }).eq('id', task.id);
    if (!error) setTasks(tasks.map(t => t.id === task.id ? { ...t, is_completed: !t.is_completed } : t));
  };

  const deleteTask = async (id: string) => {
    if (!confirm('업무를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('ams_tasks').delete().eq('id', id);
    if (!error) setTasks(tasks.filter(t => t.id !== id));
  };
// 5. 상담 필요 학생 계산 (자동 알림 - 5주 이상 경과만)
const consultationAlerts = useMemo(() => {
  return students.filter(s => {
    if (s.is_deleted) return false;
    // 💡 일반 선생님인 경우 본인 담당 학생만 필터링
    if (!isAdmin && s.teacher_id !== currentUser?.id) return false;
    
    if (!s.last_consulted_at) return true; // 기록 없으면 표시

    const lastDate = new Date(s.last_consulted_at);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 35; // 💡 5주(35일) 이상만 알림
  });
}, [students, isAdmin, currentUser?.id]);

// 6. 학생 건의사항 알림 계산
const suggestionAlerts = useMemo(() => {
  const suggestions = tasks.filter(t => t.title.startsWith('[건의]') && !t.is_completed);
  
  if (isAdmin) return suggestions;

  // 💡 일반 선생님인 경우 본인 담당 학생의 건의만 필터링
  const myStudentNames = students
    .filter(s => s.teacher_id === currentUser?.id)
    .map(s => s.name);

  return suggestions.filter(t => {
    const studentNameMatch = t.title.replace('[건의] ', '').trim();
    return myStudentNames.includes(studentNameMatch);
  });
}, [tasks, isAdmin, students, currentUser?.id]);

  const filteredTasks = useMemo(() => {
    if (filterTab === 'all') return tasks;
    return tasks.filter(t => t.display_period_type === filterTab && !t.title.startsWith('[건의]'));
  }, [tasks, filterTab]);

  const mainTasks = useMemo(() => {
    return filteredTasks.filter(t => !t.title.startsWith('[건의]'));
  }, [filteredTasks]);

  return (
    <div className="p-8 space-y-10 bg-[#080808] min-h-full max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Bell size={28} className="text-blue-500" />
            Notifications
          </h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">학원 운영 및 업무 관리</p>
        </div>
        {isAdmin && (
          <button onClick={() => setIsAddingTask(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-[2px] hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20">
            <Plus size={16} /> New Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 왼쪽: 업무 리스트 */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock size={14} className="text-blue-400" /> Tasks Archive
              </h3>
              <div className="flex bg-white/5 rounded-full p-1 border border-white/5">
                {(['all', 'weekly', 'monthly'] as const).map(t => (
                  <button key={t} onClick={() => setFilterTab(t)} className={`text-[8px] px-3 py-1 rounded-full font-black uppercase transition-all ${filterTab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="py-20 text-center text-gray-600 animate-pulse text-[10px] font-black uppercase tracking-widest">Loading tasks...</div>
            ) : mainTasks.length === 0 ? (
              <div className="py-20 border border-dashed border-white/5 rounded-[4px] text-center text-gray-700 text-[10px] font-bold uppercase tracking-widest">No tasks found in this period</div>
            ) : (
              mainTasks.map((task) => (
                <motion.div layout key={task.id} className={`group bg-[#0f0f0f] border rounded-[4px] p-4 transition-all ${task.is_completed ? 'border-white/5 opacity-50' : 'border-white/10 hover:border-blue-500/30'}`}>
                  <div className="flex items-start gap-4">
                    <button onClick={() => toggleTask(task)} className={`mt-1 transition-colors ${task.is_completed ? 'text-emerald-500' : 'text-gray-600 hover:text-blue-500'}`}>
                      {task.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                    </button>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-black transition-all ${task.is_completed ? 'text-gray-600 line-through' : 'text-white'}`}>{task.title}</h4>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-[2px] uppercase ${task.display_period_type === 'monthly' ? 'bg-purple-500/20 text-purple-400' : task.display_period_type === 'weekly' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-500'}`}>
                            {task.display_period_type}
                          </span>
                        </div>
                        <span className={`text-[9px] font-black tabular-nums ${new Date(task.target_date) < new Date() && !task.is_completed ? 'text-red-500' : 'text-gray-600'}`}>
                          {task.start_date.slice(5).replace('-', '.')} ~ {task.target_date.slice(5).replace('-', '.')}
                        </span>
                      </div>
                      <p className={`text-[11px] leading-relaxed ${task.is_completed ? 'text-gray-700' : 'text-gray-400'}`}>{task.content}</p>
                    </div>
                    {isAdmin && <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-600 hover:text-red-500 transition-all"><Trash2 size={16} /></button>}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* 오른쪽: 자동 알림 (상담 & 건의사항) */}
        <div className="lg:col-span-5 space-y-6">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
            <AlertCircle size={14} className="text-amber-500" /> Auto Alerts
          </h3>

          {/* 학생 건의사항 알림 */}
          <div className="bg-[#0f0f0f] border border-blue-500/10 rounded-[4px] overflow-hidden divide-y divide-white/5">
            <div className="p-4 bg-blue-500/5 flex justify-between items-center">
              <div>
                <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">학생 건의사항</h4>
                <p className="text-[9px] text-gray-500 font-medium mt-1">학생들이 보낸 실시간 요청 사항입니다.</p>
              </div>
              <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">{suggestionAlerts.length}</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar-v">
              {suggestionAlerts.length === 0 ? (
                <div className="p-10 text-center text-gray-700 text-[10px] font-bold uppercase tracking-widest italic">No new suggestions</div>
              ) : (
                suggestionAlerts.map((task) => (
                  <div key={task.id} className="p-4 space-y-3 group hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-blue-500" />
                        <span className="text-[12px] font-black text-white">{task.title.replace('[건의] ', '')}</span>
                      </div>
                      <span className="text-[9px] font-black text-gray-600 uppercase tabular-nums">{task.target_date.replace(/-/g, '.')}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed bg-black/30 p-2.5 rounded border border-white/5">{task.content}</p>
                    <div className="flex justify-end">
                      <button 
                        onClick={() => toggleTask(task)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white text-[9px] font-black rounded uppercase transition-all"
                      >
                        <Check size={12} strokeWidth={3} /> 확인 완료
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 상담 누락 알림 */}
          <div className="bg-[#0f0f0f] border border-amber-500/10 rounded-[4px] overflow-hidden divide-y divide-white/5">
            <div className="p-4 bg-amber-500/5 flex justify-between items-center">
              <div>
                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">상담 누락 알림</h4>
                <p className="text-[9px] text-gray-500 font-medium mt-1">상담 주기가 경과한 학생 목록입니다.</p>
              </div>
              <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">{consultationAlerts.length}</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar-v">
              {consultationAlerts.length === 0 ? (
                <div className="p-10 text-center text-gray-700 text-[10px] font-bold uppercase tracking-widest italic">All consultations up to date</div>
              ) : (
                consultationAlerts.map((s, idx) => (
                 <div key={s.id || idx} className="p-4 flex items-center justify-between group hover:bg-white/[0.02] transition-colors">                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[2px] bg-white/5 flex items-center justify-center text-gray-500"><UserCircle size={18} /></div>
                      <div>
                        <h5 className="text-[12px] font-black text-gray-200">{s.name}</h5>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">{s.grade} · {s.class}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-gray-600 block uppercase">Last: {s.last_consulted_at ? s.last_consulted_at.slice(5).replace('-', '.') : 'N/A'}</span>
                      <span className="text-[8px] font-bold text-amber-500 uppercase tracking-tighter">Action Required</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 업무 추가 모달 */}
      <AnimatePresence>
        {isAddingTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#121212] border border-white/10 rounded-[4px] w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-blue-600/5">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Plus size={18} className="text-blue-500" /> New Task</h3>
                <button onClick={() => setIsAddingTask(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddTask} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Period Type</label>
                  <div className="flex gap-2">
                    {(['weekly', 'monthly', 'custom'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setPeriodType(t)} className={`flex-1 py-2.5 rounded-[2px] text-[10px] font-black uppercase tracking-widest border transition-all ${newTask.display_period_type === t ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-black border-white/10 text-gray-500 hover:border-white/30'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Start Date</label>
                    <input type="date" value={newTask.start_date} onChange={(e) => setNewTask({...newTask, start_date: e.target.value, display_period_type: 'custom'})} className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm font-bold outline-none focus:border-blue-500 transition-all [color-scheme:dark]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">End Date</label>
                    <input type="date" value={newTask.target_date} onChange={(e) => setNewTask({...newTask, target_date: e.target.value, display_period_type: 'custom'})} className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm font-bold outline-none focus:border-blue-500 transition-all [color-scheme:dark]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Task Title</label>
                  <input required type="text" placeholder="업무 제목을 입력하세요" value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Description</label>
                  <textarea rows={2} placeholder="상세 설명을 입력하세요" value={newTask.content} onChange={(e) => setNewTask({...newTask, content: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm outline-none focus:border-blue-500 transition-all resize-none" />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsAddingTask(false)} className="flex-1 bg-white/5 py-4 rounded-[2px] text-gray-500 text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Cancel</button>
                  <button type="submit" className="flex-[2] bg-blue-600 py-4 rounded-[2px] text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                    <Check size={16} /> Create Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
