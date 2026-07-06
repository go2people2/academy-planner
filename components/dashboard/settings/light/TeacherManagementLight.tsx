'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, UserCircle, Trash2, X, Key, Lock, Save, Loader2, Hash } from 'lucide-react';
import { getInitial } from '@/lib/utils';

interface TeacherManagementProps {
  teachers: any[];
  onAddTeacher: (data: any) => Promise<void>;
  onDeleteTeacher: (id: string) => Promise<void>;
  onUpdateTeacher: (id: string, updates: any) => Promise<void>;
}

export default function TeacherManagementLight({ teachers, onAddTeacher, onDeleteTeacher, onUpdateTeacher }: TeacherManagementProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setLocalTempName] = useState('');
  const [tempInitials, setLocalTempInitials] = useState('');
  const [tempNickname, setLocalTempNickname] = useState('');

  const [formData, setFormData] = useState({
    login_id: '',
    password: '',
    name: '',
    initials: '',
    nickname: '',
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
        <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <Users size={16} /> Current Teachers
        </h3>
        <button 
          onClick={() => setIsAddModalOpen(true)} 
          className="px-4 py-2 bg-blue-600 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-200/50"
        >
          <UserPlus size={14} /> Add New Teacher
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teachers.map(t => (
          <div 
            key={t.id} 
            className="bg-white border border-[#e3e2e0] rounded-lg p-5 flex items-center justify-between group hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                <UserCircle className="text-blue-600" size={20} />
              </div>
              <div>
                {editingId === t.id ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-gray-500 uppercase font-black">이름</span>
                      <input 
                        autoFocus 
                        value={tempName} 
                        onChange={(e) => setLocalTempName(e.target.value)}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') { 
                            onUpdateTeacher(t.id, { name: tempName, initials: tempInitials, nickname: tempNickname }); 
                            setEditingId(null); 
                          } 
                        }}
                        className="bg-white border border-blue-400 rounded px-2 py-0.5 text-xs font-bold text-[#37352f] outline-none w-32 focus:ring-1 focus:ring-blue-500/50" 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-gray-500 uppercase font-black">약칭 (Initials)</span>
                      <input 
                        value={tempInitials} 
                        onChange={(e) => setLocalTempInitials(e.target.value)}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') { 
                            onUpdateTeacher(t.id, { name: tempName, initials: tempInitials, nickname: tempNickname }); 
                            setEditingId(null); 
                          } 
                        }}
                        className="bg-white border border-amber-400 rounded px-2 py-0.5 text-[10px] font-bold text-[#37352f] outline-none w-24 focus:ring-1 focus:ring-blue-500/50" 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-gray-500 uppercase font-black">별칭/직함 (ACA2000)</span>
                      <input 
                        value={tempNickname} 
                        onChange={(e) => setLocalTempNickname(e.target.value)}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') { 
                            onUpdateTeacher(t.id, { name: tempName, initials: tempInitials, nickname: tempNickname }); 
                            setEditingId(null); 
                          } 
                        }}
                        placeholder="예: 대표원장"
                        className="bg-white border border-indigo-400 rounded px-2 py-0.5 text-[10px] font-bold text-[#37352f] placeholder-gray-400 outline-none w-32 focus:ring-1 focus:ring-blue-500/50" 
                      />
                    </div>
                    <button 
                      onClick={() => { 
                        onUpdateTeacher(t.id, { name: tempName, initials: tempInitials, nickname: tempNickname }); 
                        setEditingId(null); 
                      }} 
                      className="text-[9px] font-black bg-blue-600 text-white px-2 py-1 rounded mt-1.5 uppercase tracking-widest hover:bg-blue-500 transition-colors shadow-sm"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div>
                    <h4 
                      onClick={() => { 
                        setEditingId(t.id); 
                        setLocalTempName(t.name); 
                        setLocalTempInitials(t.initials || ''); 
                        setLocalTempNickname(t.nickname || ''); 
                      }} 
                      className="text-sm font-black text-[#37352f] cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-2"
                    >
                      {t.name}
                      <span className="text-[10px] font-black text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        ({t.initials || getInitial(t.name)})
                      </span>
                    </h4>
                    {t.nickname && (
                      <p className="text-[10px] font-bold text-indigo-700 mt-1 tracking-tight flex items-center gap-1">
                        <span className="bg-indigo-50 border border-indigo-100 rounded px-1 py-0.5">🏷️ ACA2000 직함: <span className="font-extrabold">{t.nickname}</span></span>
                      </p>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button 
                    onClick={() => { 
                      const nextRole = t.role === 'admin' ? 'teacher' : 'admin'; 
                      if (confirm(`'${t.name}' 선생님의 권한을 ${nextRole.toUpperCase()}(으)로 변경하시겠습니까?`)) {
                        onUpdateTeacher(t.id, { role: nextRole }); 
                      }
                    }}
                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded transition-all ${
                      t.role === 'admin' 
                        ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-sm' 
                        : 'bg-gray-50 text-gray-500 border border-[#e3e2e0] hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {t.role}
                  </button>
                  <span className="text-[9px] font-bold text-gray-400">{t.login_id}</span>
                </div>
              </div>
            </div>
            {t.role !== 'admin' && (
              <button 
                onClick={() => onDeleteTeacher(t.id)} 
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-rose-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white border border-[#e3e2e0] rounded-lg w-full max-w-md shadow-2xl overflow-hidden text-[#37352f]"
            >
              <div className="p-6 border-b border-[#e3e2e0] flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <UserPlus className="text-blue-600" size={20} />
                  <h3 className="text-sm font-black text-[#37352f] uppercase tracking-widest">Add New Teacher</h3>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="text-gray-400 hover:text-black hover:bg-gray-100 rounded-full p-1 transition-all"
                >
                  <X size={20} />
                </button>
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
                        <input 
                          required={f.required} 
                          type={f.type || 'text'} 
                          value={(formData as any)[f.key] || ''} 
                          onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                          className="w-full bg-white border border-[#edece9] rounded px-4 py-3 text-sm text-[#37352f] pl-10 outline-none focus:border-blue-500 transition-all font-bold placeholder-gray-300" 
                          placeholder={f.placeholder} 
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{f.icon}</div>
                      </div>
                    </div>
                  ))}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Role (권한)</label>
                    <div className="relative">
                      <select 
                        value={formData.role} 
                        onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                        className="w-full bg-white border border-[#edece9] rounded px-4 py-3 text-sm text-[#37352f] pl-10 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer font-bold"
                      >
                        <option value="teacher" className="bg-white text-[#37352f]">TEACHER (일반 교사)</option>
                        <option value="admin" className="bg-white text-[#37352f]">ADMIN (원장님 / 관리자)</option>
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <UserCircle size={16} />
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="w-full bg-blue-600 py-4 rounded text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
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
