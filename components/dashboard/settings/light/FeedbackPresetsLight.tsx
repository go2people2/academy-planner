'use client';

import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface FeedbackPresetsProps {
  currentUser: any;
  onUpdateCurrentUser: (updates: any) => void;
  academyInfo: any;
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
}

function PresetItemLight({ 
  preset, currentUser, onUpdateCurrentUser, academyInfo, onUpdateAcademyInfo 
}: { 
  preset: any, currentUser: any, onUpdateCurrentUser: any, academyInfo: any, onUpdateAcademyInfo?: any 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const isMasterAdmin = currentUser?.id === 'admin';
  const isTeacherAdmin = !isMasterAdmin && currentUser?.role === 'admin';
  
  const currentPresets = isMasterAdmin 
    ? (academyInfo?.operation_settings?.default_homework_presets || {}) 
    : (currentUser?.homework_presets || {});
    
  const [localVal, setLocalVal] = useState(currentPresets[preset.id] || '');

  useEffect(() => {
    if (!isEditing && document.activeElement?.id !== `preset-${preset.id}`) {
      setLocalVal(currentPresets[preset.id] || '');
    }
  }, [currentPresets[preset.id], isEditing, preset.id]);

  const gradeLetter = preset.label.split(' ')[0];
  const gradeDesc = preset.label.substring(preset.label.indexOf('('));

  return (
    <div className="flex items-center gap-3 bg-white border border-[#edece9] rounded-lg px-3 py-2 hover:border-blue-400 transition-colors shadow-sm text-[#37352f]">
      <div className="flex items-center gap-2 shrink-0 w-[115px]">
        <div className={`w-2.5 h-2.5 rounded-full ${preset.color} shrink-0`} />
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-xs font-bold text-gray-800">{gradeLetter}</span>
          <span className="text-[9px] font-bold text-gray-400 truncate">{gradeDesc}</span>
        </div>
      </div>
      <input 
        id={`preset-${preset.id}`}
        type="text"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={async (e) => {
          try {
            const val = e.target.value;
            const newPresets = { ...currentPresets, [preset.id]: val };
            if (isMasterAdmin) {
              if (onUpdateAcademyInfo) {
                await onUpdateAcademyInfo({
                  operation_settings: {
                    ...(academyInfo?.operation_settings || {}),
                    default_homework_presets: newPresets,
                  },
                });
              }
            } else {
              const { error } = await supabase
                .from('ams_teachers')
                .update({ homework_presets: newPresets })
                .eq('id', currentUser.id);
              if (!error) {
                await onUpdateCurrentUser({ homework_presets: newPresets });
              } else {
                console.error('Preset save error:', error);
                alert('프리셋 저장에 실패했습니다.');
              }
            }
          } catch (e) {
            console.error('Preset save exception:', e);
            alert('프리셋 저장 중 오류가 발생했습니다.');
          } finally {
            setIsEditing(false);
          }
        }}
        placeholder={isMasterAdmin ? "학원 피드백 문구" : "피드백 문구"}
        className="flex-1 bg-white border border-[#edece9] rounded px-3 py-1 text-xs font-bold text-gray-800 outline-none focus:border-blue-500 transition-all h-8 focus:ring-1 focus:ring-blue-500/30"
      />
      {isMasterAdmin && <span className="text-[8px] font-black text-amber-700 uppercase tracking-tighter bg-amber-50 border border-amber-200 px-1 py-0.5 rounded shrink-0 shadow-sm">Default</span>}
      {isTeacherAdmin && <span className="text-[8px] font-black text-blue-700 uppercase tracking-tighter bg-blue-50 border border-blue-200 px-1 py-0.5 rounded shrink-0 shadow-sm">Preset</span>}
    </div>
  );
}

export default function FeedbackPresetsLight({ 
  currentUser, onUpdateCurrentUser, academyInfo, onUpdateAcademyInfo 
}: FeedbackPresetsProps) {
  const feedbackPresets = [
    { id: 'gradeA', label: 'A (수행도 최상)', color: 'bg-emerald-500' },
    { id: 'gradeB', label: 'B (수행도 우수)', color: 'bg-blue-500' },
    { id: 'gradeC', label: 'C (수행도 보통)', color: 'bg-gray-400' },
    { id: 'gradeD', label: 'D (수행도 저조)', color: 'bg-amber-500' },
    { id: 'gradeE', label: 'E (수행도 미흡)', color: 'bg-red-500' },
    { id: 'gradeF', label: 'F (수행도 불참)', color: 'bg-purple-500' }
  ];

  return (
    <div className="bg-white border border-[#e3e2e0] rounded-lg p-6 space-y-6 shadow-sm text-[#37352f]">
      <div className="flex items-center gap-3 pb-2 border-b border-[#e3e2e0]">
        <MessageSquare className="text-emerald-600" size={18} />
        <h3 className="text-xs font-bold text-[#37352f] uppercase tracking-widest">피드백 문구 설정</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {feedbackPresets.map((preset) => (
          <PresetItemLight 
            key={preset.id} 
            preset={preset} 
            currentUser={currentUser} 
            onUpdateCurrentUser={onUpdateCurrentUser} 
            academyInfo={academyInfo} 
            onUpdateAcademyInfo={onUpdateAcademyInfo} 
          />
        ))}
      </div>
      <p className="text-[9px] text-gray-400 font-bold italic leading-relaxed">
        * 학원 리포트 발행 시, 일지에 평점 알파벳을 기입하면 위 문장이 코멘트로 자동 입력됩니다.<br/>
        * 입력란 바깥을 클릭(onBlur)하면 작성하신 설정 내용이 안전하게 클라우드로 즉시 자동 보관됩니다.
      </p>
    </div>
  );
}
