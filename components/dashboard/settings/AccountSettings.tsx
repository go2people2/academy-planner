'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AccountSettingsProps {
  currentUser: any;
  onUpdateCurrentUser: (updates: any) => void;
  academyInfo: any;
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
}

function PresetItem({ preset, currentUser, onUpdateCurrentUser, academyInfo, onUpdateAcademyInfo }: { preset: any, currentUser: any, onUpdateCurrentUser: any, academyInfo: any, onUpdateAcademyInfo?: any }) {
  const isMasterAdmin = currentUser?.id === 'admin';
  const isTeacherAdmin = !isMasterAdmin && currentUser?.role === 'admin';
  
  const currentPresets = isMasterAdmin 
    ? (academyInfo?.default_homework_presets || {}) 
    : (currentUser?.homework_presets || {});
    
  const [localVal, setLocalVal] = useState(currentPresets[preset.id] || '');

  useEffect(() => {
    if (document.activeElement?.id !== `preset-${preset.id}`) {
      setLocalVal(currentPresets[preset.id] || '');
    }
  }, [currentPresets[preset.id], preset.id]);

  return (
    <div className="bg-white/5 border border-white/5 rounded-[4px] p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${preset.color}`} />
        <span className="text-[10px] font-black text-white uppercase tracking-widest">{preset.label}</span>
        {isMasterAdmin && <span className="ml-auto text-[8px] font-black text-amber-500 uppercase tracking-tighter bg-amber-500/10 px-1.5 py-0.5 rounded">Academy Default</span>}
        {isTeacherAdmin && <span className="ml-auto text-[8px] font-black text-blue-500 uppercase tracking-tighter bg-blue-500/10 px-1.5 py-0.5 rounded">Personal Preset</span>}
      </div>
      <textarea 
        id={`preset-${preset.id}`}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={async (e) => {
          const val = e.target.value;
          const newPresets = { ...currentPresets, [preset.id]: val };
          
          if (isMasterAdmin) {
            if (onUpdateAcademyInfo) {
              await onUpdateAcademyInfo({ default_homework_presets: newPresets });
            }
          } else {
            const { error } = await supabase
              .from('ams_teachers')
              .update({ homework_presets: newPresets })
              .eq('id', currentUser.id);
            if (!error) {
              onUpdateCurrentUser({ homework_presets: newPresets });
            }
          }
        }}
        placeholder={isMasterAdmin ? "학원 표준 기본 문구 입력" : "나만의 피드백 문구 입력"}
        className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2 text-[12px] font-bold text-gray-300 outline-none focus:border-amber-500 transition-all min-h-[60px] resize-none"
      />
    </div>
  );
}

export default function AccountSettings({ currentUser, onUpdateCurrentUser, academyInfo, onUpdateAcademyInfo }: AccountSettingsProps) {
  const feedbackPresets = [
    { id: 'perfect', label: 'S (Perfect)', color: 'bg-emerald-500' },
    { id: 'good', label: 'A (Good)', color: 'bg-blue-500' },
    { id: 'neutral', label: 'B (Neutral)', color: 'bg-white/20' },
    { id: 'poor', label: 'C (Poor)', color: 'bg-amber-500' },
    { id: 'bad', label: 'F (Bad)', color: 'bg-red-500' }
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="max-w-4xl space-y-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-1">
            <MessageSquare className="text-amber-500" size={20} />
            <h3 className="text-sm font-black text-white uppercase tracking-widest">My Feedback Presets</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feedbackPresets.map(preset => (
              <PresetItem 
                key={preset.id}
                preset={preset}
                currentUser={currentUser}
                onUpdateCurrentUser={onUpdateCurrentUser}
                academyInfo={academyInfo}
                onUpdateAcademyInfo={onUpdateAcademyInfo}
              />
            ))}
          </div>
        </div>

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
  );
}
