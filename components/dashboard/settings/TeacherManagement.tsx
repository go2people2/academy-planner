'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, UserCircle, Trash2, X, Key, Lock, Save, Loader2, Hash } from 'lucide-react';
import { getInitial } from '@/lib/utils';
import { useModalEsc } from '@/hooks/useModalEsc';

interface TeacherManagementProps {
  teachers: any[];
  onAddTeacher: (data: any) => Promise<void>;
  onDeleteTeacher: (id: string) => Promise<void>;
  onUpdateTeacher: (id: string, updates: any) => Promise<void>;
}

export default function TeacherManagement({ teachers, onAddTeacher, onDeleteTeacher, onUpdateTeacher }: TeacherManagementProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 💡 [Esc 닫기 공통 적용]
  useModalEsc({
    isOpen: isAddModalOpen,
    onClose: () => setIsAddModalOpen(false),
    isSaving
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setLocalTempName] = useState('');
  const [tempInitials, setLocalTempInitials] = useState('');
  const [tempNickname, setLocalTempNickname] = useState(''); // 💡 추가

  const [formData, setFormData] = useState({
    login_id: '',
    password: '',
    name: '',
    initials: '',
    nickname: '', // 💡 추가
    role: 'teacher' as 'admin' | 'teacher'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onAddTeacher(formData);
    setIsSaving(false);
    setIsAddModalOpen(false);
    setFormData({ login_id: '', password: '', name: '', initials: '', nickname: '', role: 'teacher' });
  };

  return (
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
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-gray-500 uppercase font-black">이름</span>
                      <input autoFocus value={tempName} onChange={(e) => setLocalTempName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') {
                          onUpdateTeacher(t.id, { name: tempName, initials: tempInitials, nickname: tempNickname });
                          setEditingId(null);
                        } }}
                        className="bg-black/60 border border-blue-500/50 rounded px-2 py-0.5 text-xs font-black text-white outline-none w-32" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-gray-500 uppercase font-black">약칭 (Initials)</span>
                      <input value={tempInitials} onChange={(e) => setLocalTempInitials(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') {
                          onUpdateTeacher(t.id, { name: tempName, initials: tempInitials, nickname: tempNickname });
                          setEditingId(null);
                        } }}
                        className="bg-black/60 border border-amber-500/50 rounded px-2 py-0.5 text-[10px] font-black text-white outline-none w-24" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-gray-500 uppercase font-black">별칭/직함 (ACA2000)</span>
                      <input value={tempNickname} onChange={(e) => setLocalTempNickname(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') {
                          onUpdateTeacher(t.id, { name: tempName, initials: tempInitials, nickname: tempNickname });
                          setEditingId(null);
                        } }}
                        placeholder="예: 대표원장"
                        className="bg-black/60 border border-indigo-500/50 rounded px-2 py-0.5 text-[10px] font-black text-white placeholder-gray-600 outline-none w-32" />
                    </div>
                    <button onClick={() => { onUpdateTeacher(t.id, { name: tempName, initials: tempInitials, nickname: tempNickname }); setEditingId(null); }} className="text-[9px] font-black bg-blue-600 text-white px-2 py-1 rounded mt-1.5 uppercase tracking-widest hover:bg-blue-500 transition-colors">Save</button>
                  </div>
                ) : (
                  <div>
                    <h4 onClick={() => {
                      setEditingId(t.id);
                      setLocalTempName(t.name);
                      setLocalTempInitials(t.initials || '');
                      setLocalTempNickname(t.nickname || '');
                    }} className="text-sm font-black text-white cursor-pointer hover:text-blue-400 transition-colors flex items-center gap-2">
                      {t.name}
                      <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">({t.initials || getInitial(t.name)})</span>
                    </h4>
                    {t.nickname && (
                      <p className="text-[10px] font-black text-indigo-400/80 mt-0.5 tracking-tight flex items-center gap-1">
                        <span>🏷️</span> ACA2000 직함: <span className="text-white font-extrabold">{t.nickname}</span>
                      </p>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => { const nextRole = t.role === 'admin' ? 'teacher' : 'admin'; if (confirm(`'${t.name}' 선생님의 권한을 ${nextRole.toUpperCase()}(으)로 변경하시겠습니까?`)) onUpdateTeacher(t.id, { role: nextRole }); }}
                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-[2px] transition-all ${t.role === 'admin' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-white/5 text-gray-500 border border-white/10 hover:border-blue-500/30 hover:text-blue-400'}`}
                  >{t.role}</button>
                  <span className="text-[9px] font-bold text-gray-600">{t.login_id}</span>
                </div>
              </div>
            </div>
            {t.role !== 'admin' && <button onClick={() => onDeleteTeacher(t.id)} className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>

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
                  {[
                    { label: 'Login ID', key: 'login_id', icon: <Key size={16} />, placeholder: 'ID', required: true },
                    { label: 'Password', key: 'password', icon: <Lock size={16} />, placeholder: 'Password', type: 'password', required: true },
                    { label: 'Teacher Name', key: 'name', icon: <UserCircle size={16} />, placeholder: 'Name', required: true },
                    { label: 'Teacher Initials', key: 'initials', icon: <Hash size={16} />, placeholder: 'Initials (e.g. YH)', required: false },
                    { label: 'Teacher Nickname / Title (ACA2000)', key: 'nickname', icon: <Users size={16} />, placeholder: '직함 또는 별명 (예: 대표원장)', required: false }
                  ].map(f => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">{f.label}</label>
                      <div className="relative">
                        <input required={f.required} type={f.type || 'text'} value={(formData as any)[f.key] || ''} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                          className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white pl-10 outline-none focus:border-blue-500 transition-all" placeholder={f.placeholder} />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">{f.icon}</div>
                      </div>
                    </div>
                  ))}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Role (권한)</label>
                    <div className="relative">
                      <select
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                        className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white pl-10 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="teacher" className="bg-[#121212]">TEACHER (일반 교사)</option>
                        <option value="admin" className="bg-[#121212]">ADMIN (원장님 / 관리자)</option>
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
                        <UserCircle size={16} />
                      </div>
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
    </motion.div>
  );
}
