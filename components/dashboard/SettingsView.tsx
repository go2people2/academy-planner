'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCircle, Shield, Key, Trash2, UserPlus, Save, X, Loader2,
  Lock, Settings as SettingsIcon, Users, Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SettingsViewProps {
  teachers: any[];
  onAddTeacher: (data: any) => Promise<void>;
  onDeleteTeacher: (id: string) => Promise<void>;
  onUpdateTeacher: (id: string, updates: any) => Promise<void>;
  onUpdateCurrentUser: (updates: any) => void;
  academyInfo: any;
  currentUser: any;
}

export default function SettingsView({ teachers, onAddTeacher, onDeleteTeacher, onUpdateTeacher, onUpdateCurrentUser, academyInfo, currentUser }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'teachers' | 'academy' | 'account'>('teachers');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setLocalTempName] = useState('');

  const [newTeacher, setNewTeacher] = useState({
    name: '',
    login_id: '',
    password: '',
    role: 'teacher'
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onAddTeacher(newTeacher);
    setIsSaving(false);
    setIsAddModalOpen(false);
    setNewTeacher({ name: '', login_id: '', password: '', role: 'teacher' });
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="p-6 space-y-6 bg-[#080808] min-h-full">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <SettingsIcon size={24} className="text-blue-500" />
            Settings
          </h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">
            학원 설정 및 개인 상용구 관리
          </p>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex gap-4 border-b border-white/5">
        {isAdmin && (
          <>
            <button 
              onClick={() => setActiveTab('teachers')}
              className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'teachers' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}
            >
              <div className="flex items-center gap-2">
                <Users size={14} /> Teacher Management
              </div>
              {activeTab === 'teachers' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
            </button>
            <button 
              onClick={() => setActiveTab('academy')}
              className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'academy' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}
            >
              <div className="flex items-center gap-2">
                <Shield size={14} /> Academy Info
              </div>
              {activeTab === 'academy' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
            </button>
          </>
        )}
        <button 
          onClick={() => setActiveTab('account')}
          className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'account' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}
        >
          <div className="flex items-center gap-2">
            <UserCircle size={14} /> My Feedback Presets
          </div>
          {activeTab === 'account' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
        </button>
      </div>

      {/* 1. 선생님 관리 탭 */}
      {activeTab === 'teachers' && isAdmin && (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              Teacher Accounts <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-[2px]">{teachers.length}</span>
            </h3>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-[2px] hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
            >
              <UserPlus size={14} /> Add New Teacher
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((t) => (
              <motion.div layout key={t.id} className="bg-[#0f0f0f] border border-white/10 p-5 rounded-[4px] space-y-4 hover:border-white/20 transition-all group">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-white/5 rounded-[2px] flex items-center justify-center text-gray-400 group-hover:text-blue-400 transition-colors shrink-0">
                      <UserCircle size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {editingId === t.id ? (
                        <input 
                          autoFocus
                          value={tempName}
                          onChange={(e) => setLocalTempName(e.target.value)}
                          onBlur={async () => {
                            if (tempName && tempName !== t.name) {
                              setIsSaving(true);
                              await onUpdateTeacher(t.id, { name: tempName });
                              setIsSaving(false);
                            }
                            setEditingId(null);
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              if (tempName && tempName !== t.name) {
                                setIsSaving(true);
                                await onUpdateTeacher(t.id, { name: tempName });
                                setIsSaving(false);
                              }
                              setEditingId(null);
                            }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-full bg-black/40 border border-blue-500/50 rounded-[2px] px-2 py-0.5 text-sm font-black text-white outline-none"
                        />
                      ) : (
                        <h4 
                          className="text-sm font-black text-white truncate cursor-pointer hover:text-blue-400 transition-colors flex items-center gap-1"
                          onClick={() => {
                            setEditingId(t.id);
                            setLocalTempName(t.name);
                          }}
                          title="클릭하여 이름 수정"
                        >
                          {t.name}
                        </h4>
                      )}
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">ID: {t.login_id}</p>
                    </div>
                  </div>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-[2px] border shrink-0 ${t.role === 'admin' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                    {t.role.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-end gap-2 border-t border-white/5 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onDeleteTeacher(t.id)}
                    className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                    title="계정 삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 2. 학원 정보 탭 */}
      {activeTab === 'academy' && isAdmin && (
        <div className="max-w-2xl space-y-8">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-[4px] p-8 space-y-8">
            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-l-2 border-blue-500 pl-3">Basic Information</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Academy Name</label>
                  <div className="px-4 py-3 bg-black/40 border border-white/10 rounded-[2px] text-sm font-bold text-white">
                    {academyInfo?.academy_name}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Academy Slug</label>
                  <div className="px-4 py-3 bg-black/40 border border-white/10 rounded-[2px] text-sm font-bold text-blue-500">
                    {academyInfo?.slug}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-4 border-t border-white/5">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-l-2 border-emerald-500 pl-3">Management Settings</h3>
              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[4px] space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Users size={14} className="text-emerald-500" />
                      Regular Consultation Cycle
                    </h4>
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                      마지막 상담일로부터 설정된 기간이 지나면 대시보드에 알림이 표시됩니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input 
                        type="number" 
                        defaultValue={academyInfo?.consultation_cycle || 21}
                        onBlur={async (e) => {
                          const val = parseInt(e.target.value);
                          if (val > 0) {
                            setIsSaving(true);
                            const { error } = await supabase
                              .from('ams_academies')
                              .update({ consultation_cycle: val })
                              .eq('id', academyInfo.id);
                            setIsSaving(false);
                            if (!error) alert('상담 주기가 변경되었습니다.');
                          }
                        }}
                        className="w-20 bg-black border border-white/10 rounded-[2px] py-2 px-3 text-center text-sm font-black text-emerald-400 outline-none focus:border-emerald-500 transition-all" 
                      />
                      <span className="absolute -right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 uppercase">Days</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 내 피드백 설정 탭 (누구나 접근 가능) */}
      {activeTab === 'account' && (
        <div className="max-w-2xl space-y-8">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-[4px] p-8 space-y-8">
            <div className="space-y-2">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-l-2 border-amber-500 pl-3">Homework Feedback Presets</h3>
              <p className="text-[10px] text-gray-500 font-medium ml-3">과제 평가 버튼을 눌렀을 때 특이사항에 자동으로 입력될 문구를 설정합니다.</p>
            </div>

            <div className="space-y-4 pt-2">
              {[
                { key: 'perfect', label: 'S (Perfect)', color: 'bg-emerald-500', desc: '숙제를 아주 완벽하게 잘 해왔습니다.' },
                { key: 'good', label: 'A (Good)', color: 'bg-blue-500', desc: '숙제를 잘 수행했습니다.' },
                { key: 'neutral', label: 'B (Neutral)', color: 'bg-white/20', desc: '숙제 수행이 보통입니다.' },
                { key: 'poor', label: 'C (Poor)', color: 'bg-amber-500', desc: '숙제가 미흡한 부분이 있습니다.' },
                { key: 'bad', label: 'F (Bad)', color: 'bg-red-500', desc: '숙제를 거의 해오지 않았습니다.' },
              ].map((preset) => (
                <div key={preset.key} className="flex items-start gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-[4px] group hover:border-white/10 transition-all">
                  <div className={`w-10 h-10 rounded-[2px] ${preset.color} flex items-center justify-center text-white font-black text-sm shrink-0`}>
                    {preset.label[0]}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase">{preset.label}</label>
                    <textarea 
                      defaultValue={currentUser?.homework_presets?.[preset.key] || preset.desc}
                      placeholder="버튼 클릭 시 입력될 문구를 작성하세요"
                      onBlur={async (e) => {
                        const val = e.target.value;
                        const newPresets = { ...(currentUser?.homework_presets || {}), [preset.key]: val };
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
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 신규 선생님 등록 모달 */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121212] border border-white/10 rounded-[4px] w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Register New Teacher</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddSubmit} className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Full Name</label>
                  <input required type="text" placeholder="선생님 이름" value={newTeacher.name} onChange={(e) => setNewTeacher({...newTeacher, name: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm outline-none focus:border-blue-500 transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Login ID</label>
                  <input required type="text" placeholder="아이디 입력" value={newTeacher.login_id} onChange={(e) => setNewTeacher({...newTeacher, login_id: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm outline-none focus:border-blue-500 transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                    <input required type="password" placeholder="초기 비밀번호" value={newTeacher.password} onChange={(e) => setNewTeacher({...newTeacher, password: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 pl-10 pr-4 text-white text-sm outline-none focus:border-blue-500 transition-all" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Role</label>
                  <select value={newTeacher.role} onChange={(e) => setNewTeacher({...newTeacher, role: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] py-3 px-4 text-white text-sm outline-none appearance-none cursor-pointer">
                    <option value="teacher" className="bg-[#121212]">Normal Teacher</option>
                    <option value="admin" className="bg-[#121212]">Admin Manager</option>
                  </select>
                </div>
                
                <button type="submit" disabled={isSaving} className="w-full bg-blue-600 py-4 rounded-[2px] text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
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
