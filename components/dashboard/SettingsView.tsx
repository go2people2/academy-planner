'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCircle, Shield, Key, Trash2, UserPlus, Save, X, Loader2,
  Lock, Settings as SettingsIcon, Users, Check, Calendar, TrendingUp, MessageSquare
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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
  const [activeTab, setActiveTab] = useState<'teachers' | 'academy' | 'account' | 'notices'>('teachers');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setLocalTempName] = useState('');

  const [formData, setFormData] = useState({
    login_id: '',
    password: '',
    name: '',
    role: 'teacher' as 'admin' | 'teacher'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onAddTeacher(formData);
    setIsSaving(false);
    setIsAddModalOpen(false);
    setFormData({ login_id: '', password: '', name: '', role: 'teacher' });
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
                        <input autoFocus value={tempName} onChange={(e) => setLocalTempName(e.target.value)}
                          onBlur={() => { onUpdateTeacher(t.id, { name: tempName }); setEditingId(null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateTeacher(t.id, { name: tempName }); setEditingId(null); } }}
                          className="bg-black/60 border border-blue-500 rounded px-2 py-0.5 text-sm font-black text-white outline-none w-24" />
                      ) : (
                        <h4 onClick={() => { setEditingId(t.id); setLocalTempName(t.name); }} className="text-sm font-black text-white cursor-pointer hover:text-blue-400 transition-colors">{t.name}</h4>
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
                      <input required value={formData.login_id} onChange={e => setFormData({ ...formData, login_id: e.target.value })}
                        className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white pl-10 outline-none focus:border-blue-500 transition-all" placeholder="ID" />
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Password</label>
                    <div className="relative">
                      <input required type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white pl-10 outline-none focus:border-blue-500 transition-all" placeholder="Password" />
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Teacher Name</label>
                    <div className="relative">
                      <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white pl-10 outline-none focus:border-blue-500 transition-all" placeholder="Name" />
                      <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
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
