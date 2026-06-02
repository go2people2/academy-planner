'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCircle, Shield, Key, Trash2, UserPlus, Save, X, Loader2,
  Lock, Settings as SettingsIcon, Users, Check, Calendar, TrendingUp, MessageSquare,
  Clock, AlertTriangle, BookOpen, Hash
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TestContentEditor from './TestContentEditor';

interface SettingsViewProps {
  teachers: any[];
  onAddTeacher: (data: any) => Promise<void>;
  onDeleteTeacher: (id: string) => Promise<void>;
  onUpdateTeacher: (id: string, updates: any) => Promise<void>;
  onUpdateCurrentUser: (updates: any) => void;
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
  academyInfo: any;
  currentUser: any;
}

export default function SettingsView({ teachers, onAddTeacher, onDeleteTeacher, onUpdateTeacher, onUpdateCurrentUser, onUpdateAcademyInfo, academyInfo, currentUser }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'teachers' | 'academy' | 'account' | 'notices' | 'tests'>('teachers');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setLocalTempName] = useState('');
  const [tempInitials, setLocalTempInitials] = useState(''); // 💡 추가

  // 💡 테스트 및 시험 관리 상태
  const [tests, setTests] = useState<any[]>([]);
  const [examSchedules, setExamSchedules] = useState<any[]>([]);
  const [isTestEditorOpen, setIsTestEditorOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<any>(null);

  // 💡 신규 시험 일정 추가용 상태
  const [newExam, setNewExam] = useState({
    school_name: '',
    grade: '',
    exam_name: '',
    target_date: new Date().toISOString().split('T')[0]
  });

  // 학원 운영 설정 로컬 상태 (제어 컴포넌트용)
  const [opSettings, setOpSettings] = useState({
    first_period_time: "",
    late_threshold: 0,
    alert_threshold: 0,
    timer_presets: [] as number[]
  });

  // 데이터 로드 여부 추적
  const [isDataInitialized, setIsDataInitialized] = useState(false);

  // academyInfo 변경 시 로컬 상태 동기화 (최초 1회 또는 값이 있을 때만 안전하게 업데이트)
  useEffect(() => {
    const dbSettings = academyInfo?.operation_settings;
    if (dbSettings && !isDataInitialized) {
      setOpSettings({
        first_period_time: dbSettings.first_period_time || "",
        late_threshold: dbSettings.late_threshold ?? 10,
        alert_threshold: dbSettings.alert_threshold ?? 15,
        timer_presets: dbSettings.timer_presets || []
      });
      setIsDataInitialized(true);
    }
  }, [academyInfo, isDataInitialized]);
const updateOpSetting = async (key: string, value: any) => {
  if (!onUpdateAcademyInfo || !academyInfo) return;

  // 💡 중요: 상위의 academyInfo 대신 현재 로컬 상태(opSettings)를 기준으로 병합해야 함
  // (상태 업데이트가 비동기이므로, 즉시 반영될 새 상태를 직접 계산)
  const nextSettings = { 
    ...opSettings, 
    [key]: value 
  };

  setOpSettings(nextSettings); // 로컬 UI 즉시 갱신
  await onUpdateAcademyInfo({ operation_settings: nextSettings });
};

const updateTimerPreset = async (index: number, value: number) => {
  if (!onUpdateAcademyInfo || !academyInfo) return;
  const newPresets = [...opSettings.timer_presets];
  newPresets[index] = value;
  const nextSettings = { ...opSettings, timer_presets: newPresets };
  setOpSettings(nextSettings);
  await onUpdateAcademyInfo({ operation_settings: nextSettings });
};


  const fetchTests = async () => {
    const { data, error } = await supabase.from('ams_tests').select('*').order('created_at', { ascending: false });
    if (!error && data) setTests(data);
  };

  const fetchExams = async () => {
    if (!academyInfo) return;
    const { data, error } = await supabase
      .from('ams_exam_schedules')
      .select('*')
      .eq('academy_id', academyInfo.id)
      .order('target_date', { ascending: true });
    if (!error && data) setExamSchedules(data);
  };

  useEffect(() => {
    if (activeTab === 'tests') fetchTests();
    if (activeTab === 'exams') fetchExams();
  }, [activeTab]);

  const handleAddExam = async () => {
    if (!newExam.school_name || !newExam.target_date || !academyInfo) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('ams_exam_schedules').insert([{
        academy_id: academyInfo.id,
        school_name: newExam.school_name,
        grade: newExam.grade || null,
        exam_name: newExam.exam_name || '정기고사',
        target_date: newExam.target_date
      }]);
      if (error) throw error;
      setNewExam({ school_name: '', grade: '', exam_name: '', target_date: new Date().toISOString().split('T')[0] });
      await fetchExams();
    } catch (e) { console.error(e); alert('시험 일정 추가 중 오류가 발생했습니다.'); } finally { setIsSaving(false); }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('정말 이 시험 일정을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('ams_exam_schedules').delete().eq('id', id);
    if (!error) fetchExams();
  };

  const handleDeleteTest = async (id: string) => {
    if (!confirm('정말 이 테스트를 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.')) return;
    const { error } = await supabase.from('ams_tests').delete().eq('id', id);
    if (!error) fetchTests();
  };

  const [formData, setFormData] = useState({
    login_id: '',
    password: '',
    name: '',
    initials: '', // 💡 추가
    role: 'teacher' as 'admin' | 'teacher'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onAddTeacher(formData);
    setIsSaving(false);
    setIsAddModalOpen(false);
    setFormData({ login_id: '', password: '', name: '', initials: '', role: 'teacher' });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[4px] bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
            <SettingsIcon className="text-blue-500" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">System Settings</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Configure academy operations</p>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-white/10 gap-8">
        {currentUser.role === 'admin' && (
          <>
            <button onClick={() => setActiveTab('notices')} className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'notices' ? 'text-amber-500' : 'text-gray-600 hover:text-gray-400'}`}>
              Notices
              {activeTab === 'notices' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
            </button>
            <button onClick={() => setActiveTab('tests')} className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'tests' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}>
              Tests
              {activeTab === 'tests' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
            </button>
            <button onClick={() => setActiveTab('exams')} className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'exams' ? 'text-rose-500' : 'text-gray-600 hover:text-gray-400'}`}>
              Exams
              {activeTab === 'exams' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />}
            </button>
            <button onClick={() => setActiveTab('teachers')} className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'teachers' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}>
              Teachers
              {activeTab === 'teachers' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
            </button>
          </>
        )}
        <button onClick={() => setActiveTab('academy')} className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'academy' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}>
          Academy Info
          {activeTab === 'academy' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
        </button>
        <button onClick={() => setActiveTab('account')} className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'account' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}>
          My Account
          {activeTab === 'account' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
        </button>
      </div>

      <div className="pt-4">
        {/* 💡 학원 공지 관리 탭 */}
        {activeTab === 'notices' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'monthly', label: '이번 달 주안점', icon: <Calendar className="text-emerald-400" size={16} />, placeholder: '예: 오답 정밀 분석 및 개별 클리닉 강화' },
                { key: 'weekly', label: '이번 주 목표', icon: <TrendingUp className="text-blue-400" size={16} />, placeholder: '예: 교재 마무리 및 단원평가 실시 주간' },
                { key: 'daily', label: '오늘의 한마디', icon: <MessageSquare className="text-amber-400" size={16} />, placeholder: '예: 아이들 등원 시 밝은 미소로 맞이해 주세요!' }
              ].map((item) => {
                const isAdmin = currentUser.role === 'admin';
                const announcements = academyInfo?.announcements || {};
                
                return (
                  <div key={item.key} className="bg-white/5 border border-white/5 rounded-[4px] p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{item.label}</h4>
                    </div>
                    <textarea 
                      readOnly={!isAdmin}
                      defaultValue={announcements[item.key] || ''}
                      onBlur={async (e) => {
                        if (!isAdmin || !onUpdateAcademyInfo) return;
                        const newAnn = { ...announcements, [item.key]: e.target.value };
                        await onUpdateAcademyInfo({ announcements: newAnn });
                      }}
                      placeholder={isAdmin ? item.placeholder : '원장님이 작성한 공지가 여기에 표시됩니다.'}
                      className={`w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-3 text-[12px] font-bold text-gray-300 outline-none transition-all min-h-[120px] resize-none leading-relaxed ${isAdmin ? 'focus:border-amber-500' : 'cursor-default opacity-70'}`}
                    />
                    {isAdmin && <p className="text-[8px] text-gray-600 italic">* 입력 후 바깥을 클릭하면 전체 교사에게 즉시 공유됩니다.</p>}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* 💡 학교별 시험 일정 관리 탭 */}
        {activeTab === 'exams' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Calendar size={16} /> School Exam Schedules</h3>
              <p className="text-[10px] text-gray-600 font-bold">학교명과 학년이 일치하는 학생에게 자동으로 디데이가 표시됩니다.</p>
            </div>

            {/* 신규 일정 추가 폼 */}
            <div className="bg-rose-600/5 border border-rose-500/20 rounded-[4px] p-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end shadow-inner">
              <div className="space-y-1 md:col-span-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">학교 이름</label>
                <input type="text" placeholder="예: 현대고" value={newExam.school_name} onChange={e => setNewExam({...newExam, school_name: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-rose-500 transition-all" />
              </div>
              <div className="space-y-1 md:col-span-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">적용 학년 (선택)</label>
                <input type="text" placeholder="예: 고1 (비워두면 전학년)" value={newExam.grade} onChange={e => setNewExam({...newExam, grade: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-rose-500 transition-all" />
              </div>
              <div className="space-y-1 md:col-span-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">시험 명칭</label>
                <input type="text" placeholder="예: 1학기 기말" value={newExam.exam_name} onChange={e => setNewExam({...newExam, exam_name: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-rose-500 transition-all" />
              </div>
              <div className="space-y-1 md:col-span-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">시험 날짜</label>
                <input type="date" value={newExam.target_date} onChange={e => setNewExam({...newExam, target_date: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-rose-500 transition-all [color-scheme:dark]" />
              </div>
              <button onClick={handleAddExam} disabled={isSaving} className="md:col-span-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black rounded-[2px] uppercase tracking-widest transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2">
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <><Save size={12} /> Add Schedule</>}
              </button>
            </div>

            {/* 일정 목록 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {examSchedules.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-white/[0.02] border border-white/5 rounded-lg border-dashed">
                  <Calendar size={40} className="text-gray-800 mx-auto mb-4 opacity-20" />
                  <p className="text-xs font-black text-gray-600 uppercase tracking-widest">No exam schedules registered yet</p>
                </div>
              ) : (
                examSchedules.map(exam => (
                  <div key={exam.id} className="bg-white/5 border border-white/10 rounded-[4px] p-5 flex flex-col justify-between group hover:border-rose-500/30 transition-all relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-[4px] bg-rose-600/10 flex items-center justify-center border border-rose-500/20">
                        <Calendar className="text-rose-400" size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-white truncate">{exam.school_name} <span className="text-rose-400 ml-1">{exam.grade || '전학년'}</span></h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-gray-300 uppercase">{exam.exam_name}</span>
                          <span className="text-[10px] font-black text-rose-500 tabular-nums">{exam.target_date.replace(/-/g, '.')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-gray-600" />
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">
                          {Math.ceil((new Date(exam.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} Days Left
                        </span>
                      </div>
                      <button onClick={() => handleDeleteExam(exam.id)} className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* 💡 테스트 및 정답지 관리 탭 */}
        {activeTab === 'tests' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><BookOpen size={16} /> Test Content Management</h3>
              <button 
                onClick={() => { setEditingTest(null); setIsTestEditorOpen(true); }} 
                className="px-4 py-2 bg-blue-600 rounded-[2px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"
              >
                <UserPlus size={14} /> Register New Test
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tests.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-white/[0.02] border border-white/5 rounded-lg border-dashed">
                  <BookOpen size={40} className="text-gray-800 mx-auto mb-4 opacity-20" />
                  <p className="text-xs font-black text-gray-600 uppercase tracking-widest">No tests registered yet</p>
                </div>
              ) : (
                tests.map(test => (
                  <div key={test.id} className="bg-white/5 border border-white/10 rounded-[4px] p-5 flex flex-col justify-between group hover:border-blue-500/30 transition-all relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-[4px] bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
                        <Hash className="text-blue-400" size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-white truncate group-hover:text-blue-400 transition-colors">{test.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black text-blue-500 uppercase px-1.5 py-0.5 bg-blue-500/10 rounded-[2px]">{test.test_code}</span>
                          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">{test.total_questions} Questions</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                      <p className="text-[8px] font-bold text-gray-600 italic">Created at {new Date(test.created_at).toLocaleDateString()}</p>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingTest(test); setIsTestEditorOpen(true); }} className="px-3 py-1.5 bg-white/5 hover:bg-blue-600 text-[9px] font-black uppercase text-gray-400 hover:text-white rounded-[2px] transition-all">Edit Solutions</button>
                        <button onClick={() => handleDeleteTest(test.id)} className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* 선생님 계정 관리 탭 */}
        {activeTab === 'teachers' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Users size={16} /> Current Teachers</h3>
              <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-blue-600 rounded-[2px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"><UserPlus size={14} /> Add New Teacher</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map(t => (
                <div key={t.id} className="bg-white/5 border border-white/10 rounded-[4px] p-5 flex items-center justify-between group hover:border-blue-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600/20 to-indigo-600/20 flex items-center justify-center border border-white/5">
                      <UserCircle className="text-blue-400" size={20} />
                    </div>
                    <div>
                      {editingId === t.id ? (
                        <div className="flex flex-col gap-1">
                          <input autoFocus value={tempName} onChange={(e) => setLocalTempName(e.target.value)}
                            onBlur={(e) => {
                              const nextTarget = e.relatedTarget as HTMLElement;
                              if (nextTarget && e.currentTarget.parentElement?.contains(nextTarget)) return;
                              // 💡 정식 'initials' 컬럼에 저장
                              onUpdateTeacher(t.id, { name: tempName, initials: tempInitials }); 
                              setEditingId(null);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { 
                              onUpdateTeacher(t.id, { name: tempName, initials: tempInitials }); 
                              setEditingId(null); 
                            } }}
                            placeholder="Name"
                            className="bg-black/60 border border-blue-500 rounded px-2 py-0.5 text-sm font-black text-white outline-none w-24" />
                          <input value={tempInitials} onChange={(e) => setLocalTempInitials(e.target.value)}
                            onBlur={(e) => {
                              const nextTarget = e.relatedTarget as HTMLElement;
                              if (nextTarget && e.currentTarget.parentElement?.contains(nextTarget)) return;
                              onUpdateTeacher(t.id, { name: tempName, initials: tempInitials }); 
                              setEditingId(null);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { 
                              onUpdateTeacher(t.id, { name: tempName, initials: tempInitials }); 
                              setEditingId(null); 
                            } }}
                            placeholder="Initials"
                            className="bg-black/60 border border-amber-500 rounded px-2 py-0.5 text-[10px] font-black text-white outline-none w-16" />
                        </div>
                      ) : (
                        <>
                          <h4 onClick={() => { 
                            setEditingId(t.id); 
                            setLocalTempName(t.name); 
                            setLocalTempInitials(t.initials || ''); 
                          }} className="text-sm font-black text-white cursor-pointer hover:text-blue-400 transition-colors flex items-center gap-2">
                            {t.name}
                            <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              ({t.initials || '?'})
                            </span>
                          </h4>
                        </>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black text-gray-500 uppercase px-1.5 py-0.5 bg-white/5 rounded-[2px]">{t.role}</span>
                        <span className="text-[9px] font-bold text-gray-600">{t.login_id}</span>
                      </div>
                    </div>
                  </div>
                  {t.role !== 'admin' && (
                    <button onClick={() => onDeleteTeacher(t.id)} className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 학원 정보 설정 탭 (기존 탭 유지) */}
        {activeTab === 'academy' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
             <div className="max-w-2xl bg-white/5 border border-white/5 rounded-[4px] p-8 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                   <Shield className="text-blue-500" size={20} />
                   <h3 className="text-sm font-black text-white uppercase tracking-widest">Academy Profile</h3>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Academy Name</label>
                   <div className="p-4 bg-black/40 border border-white/10 rounded-[2px] text-lg font-black text-white">{academyInfo?.academy_name}</div>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Consultation Cycle (Days)</label>
                   <input type="number" defaultValue={academyInfo?.consultation_cycle || 21}
                     onBlur={async (e) => {
                        if (!onUpdateAcademyInfo) return;
                        await onUpdateAcademyInfo({ consultation_cycle: parseInt(e.target.value) });
                        alert('상담 주기가 변경되었습니다.');
                     }}
                     className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-blue-400 outline-none focus:border-blue-500 transition-all" />
                </div>

                {/* 💡 학생 페이지 마스터 패스키 설정 추가 */}
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Student Access Passkey (마스터 패스키)</label>
                   <div className="relative group">
                     <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-blue-400 transition-colors" />
                     <input 
                       type="text" 
                       maxLength={4}
                       defaultValue={academyInfo?.student_passkey || '2324'}
                       placeholder="4자리 숫자 입력"
                       onBlur={async (e) => {
                          if (!onUpdateAcademyInfo) return;
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          if (val.length !== 4) { alert('패스키는 숫자 4자리여야 합니다.'); return; }
                          await onUpdateAcademyInfo({ student_passkey: val });
                          alert('학생 페이지 패스키가 변경되었습니다.');
                       }}
                       className="w-full bg-black/40 border border-white/10 rounded-[2px] pl-12 pr-4 py-3 text-sm font-black text-amber-400 outline-none focus:border-blue-500 transition-all" 
                     />
                   </div>
                   <p className="text-[8px] text-gray-600 italic ml-1">* 이 번호를 입력하면 모든 학생의 페이지에 접속할 수 있습니다. (기본값: 2324)</p>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-6">
                  <div className="flex items-center gap-3">
                    <Clock className="text-amber-500" size={20} />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Live Mode & Policy</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">1교시 시작 시각</label>
                      <input 
                        type="time"
                        value={opSettings.first_period_time || ""}
                        onChange={(e) => setOpSettings(prev => ({ ...prev, first_period_time: e.target.value }))}
                        onBlur={(e) => updateOpSetting('first_period_time', e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-amber-500 outline-none focus:border-amber-500 transition-all cursor-pointer [color-scheme:dark]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">지각 기준 (분)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={opSettings.late_threshold || 0}
                          onChange={(e) => setOpSettings(prev => ({ ...prev, late_threshold: parseInt(e.target.value) || 0 }))}
                          onBlur={(e) => updateOpSetting('late_threshold', parseInt(e.target.value) || 0)}
                          className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-blue-400 outline-none focus:border-blue-500 transition-all" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">분</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">연락 알림 (분)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={opSettings.alert_threshold || 0}
                          onChange={(e) => setOpSettings(prev => ({ ...prev, alert_threshold: parseInt(e.target.value) || 0 }))}
                          onBlur={(e) => updateOpSetting('alert_threshold', parseInt(e.target.value) || 0)}
                          className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-red-400 outline-none focus:border-red-500 transition-all" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">분</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <Clock size={12} className="text-indigo-500" /> Timer Presets Configuration
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[0, 1, 2].map((idx) => (
                        <div key={idx} className="space-y-1">
                          <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest ml-1">Preset {idx + 1} (분)</label>
                          <input 
                            type="number" 
                            value={opSettings.timer_presets[idx] || 0}
                            onChange={(e) => {
                              const newPresets = [...opSettings.timer_presets];
                              newPresets[idx] = parseInt(e.target.value) || 0;
                              setOpSettings(prev => ({ ...prev, timer_presets: newPresets }));
                            }}
                            onBlur={(e) => updateTimerPreset(idx, parseInt(e.target.value) || 0)}
                            className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-indigo-400 outline-none focus:border-indigo-500 transition-all"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-600 font-medium mt-3 ml-1">
                      * 라이브 모드의 타이머 탭에서 사용할 3개의 자주 쓰는 시간을 설정할 수 있습니다. 4번째 칸은 라이브 모드에서 직접 입력이 가능합니다.
                    </p>
                  </div>
                  <p className="text-[9px] text-gray-600 italic">
                    * 1교시 시작 시각은 시간표의 파랑/주황 색상 구분(3교시 단위)의 기준이 됩니다.<br/>
                    * 지각 및 연락 알림 설정은 수업 시작 (LIVE) 모드에서 실시간으로 반영됩니다.
                  </p>
                </div>
             </div>
          </motion.div>
        )}

        {/* 내 계정 설정 탭 (기존 피드백 프리셋 등) */}
        {activeTab === 'account' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="max-w-4xl space-y-8">
              {/* 피드백 프리셋 설정 */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                  <MessageSquare className="text-amber-500" size={20} />
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">My Feedback Presets</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'perfect', label: 'S (Perfect)', color: 'bg-emerald-500' },
                    { id: 'good', label: 'A (Good)', color: 'bg-blue-500' },
                    { id: 'neutral', label: 'B (Neutral)', color: 'bg-white/20' },
                    { id: 'poor', label: 'C (Poor)', color: 'bg-amber-500' },
                    { id: 'bad', label: 'F (Bad)', color: 'bg-red-500' }
                  ].map(preset => (
                    <div key={preset.id} className="bg-white/5 border border-white/5 rounded-[4px] p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${preset.color}`} />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{preset.label}</span>
                      </div>
                      <textarea 
                        defaultValue={currentUser?.homework_presets?.[preset.id] || ''}
                        onBlur={async (e) => {
                          const newPresets = { ...(currentUser?.homework_presets || {}), [preset.id]: e.target.value };
                          setIsSaving(true);
                          const { error } = await supabase
                            .from('ams_teachers')
                            .update({ homework_presets: newPresets })
                            .eq('id', currentUser.id);
                          if (!error) {
                            onUpdateCurrentUser({ homework_presets: newPresets });
                            alert(`${preset.label} 문구가 저장되었습니다.`);
                          }
                          setIsSaving(false);
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2 text-[12px] font-bold text-gray-300 outline-none focus:border-amber-500 transition-all min-h-[60px] resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 비밀번호 변경 */}
              <div className="max-w-md bg-white/5 border border-white/5 rounded-[4px] p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <Lock className="text-red-500" size={20} />
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Change Password</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">New Password</label>
                    <input type="password" placeholder="••••••••" className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white outline-none focus:border-red-500 transition-all" />
                  </div>
                  <button className="w-full py-3 bg-white/5 border border-white/10 rounded-[2px] text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/10 transition-all">Update Password</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* 테스트 콘텐츠 에디터 모달 */}
      <AnimatePresence>
        {isTestEditorOpen && (
          <TestContentEditor 
            test={editingTest}
            onSave={fetchTests}
            onClose={() => setIsTestEditorOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* 강사 추가 모달 */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#121212] border border-white/10 rounded-[4px] w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <UserPlus className="text-blue-500" size={20} />
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Add New Teacher</h3>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-white transition-all"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Login ID</label>
                    <div className="relative">
                      <input required value={formData.login_id || ''} onChange={e => setFormData({ ...formData, login_id: e.target.value })}
                        className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white pl-10 outline-none focus:border-blue-500 transition-all" placeholder="ID" />
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Password</label>
                    <div className="relative">
                      <input required type="password" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white pl-10 outline-none focus:border-blue-500 transition-all" placeholder="Password" />
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Teacher Name</label>
                    <div className="relative">
                      <input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white pl-10 outline-none focus:border-blue-500 transition-all" placeholder="Name" />
                      <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Teacher Initials (이니셜)</label>
                    <div className="relative">
                      <input required value={formData.initials || ''} onChange={e => setFormData({ ...formData, initials: e.target.value })}
                        className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white pl-10 outline-none focus:border-blue-500 transition-all" placeholder="Initials (e.g. YH)" />
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={isSaving} className="w-full bg-blue-600 py-4 rounded-[2px] text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                  {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Complete Registration</>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
