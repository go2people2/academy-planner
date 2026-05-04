'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCircle, Shield, Key, Trash2, UserPlus, Save, X, Loader2,
  Lock, Settings as SettingsIcon, Users, Check
} from 'lucide-react';

interface SettingsViewProps {
  teachers: any[];
  onAddTeacher: (data: any) => Promise<void>;
  onDeleteTeacher: (id: string) => Promise<void>;
  academyInfo: any;
}

export default function SettingsView({ teachers, onAddTeacher, onDeleteTeacher, academyInfo }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'teachers' | 'academy'>('teachers');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <div className="p-6 space-y-6 bg-[#080808] min-h-full">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <SettingsIcon size={24} className="text-blue-500" />
            Academy Settings
          </h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">
            학원 정보 및 선생님 계정 관리
          </p>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex gap-4 border-b border-white/5">
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
      </div>

      {activeTab === 'teachers' && (
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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-[2px] flex items-center justify-center text-gray-400 group-hover:text-blue-400 transition-colors">
                      <UserCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{t.name}</h4>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">ID: {t.login_id}</p>
                    </div>
                  </div>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-[2px] border ${t.role === 'admin' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
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

      {activeTab === 'academy' && (
        <div className="max-w-2xl bg-[#0f0f0f] border border-white/10 rounded-[4px] p-8 space-y-8">
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

          <div className="space-y-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-l-2 border-blue-500 pl-3">Security</h3>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-[4px] p-4 flex items-start gap-4">
              <Shield className="text-amber-500 shrink-0" size={20} />
              <div>
                <h4 className="text-[11px] font-black text-amber-500 uppercase tracking-widest">Admin Master Password</h4>
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-1">
                  이 비밀번호는 'admin' 아이디로 로그인할 때 사용되는 최상위 권한 암호입니다.
                </p>
                <div className="mt-3 font-black text-lg text-white tracking-[0.3em]">
                  ••••••••
                </div>
              </div>
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
