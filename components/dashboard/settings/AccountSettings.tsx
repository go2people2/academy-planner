'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Lock, Keyboard, Zap } from 'lucide-react';
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
    ? (academyInfo?.operation_settings?.default_homework_presets || {}) 
    : (currentUser?.homework_presets || {});
    
  const [localVal, setLocalVal] = useState(currentPresets[preset.id] || '');

  useEffect(() => {
    if (document.activeElement?.id !== `preset-${preset.id}`) {
      setLocalVal(currentPresets[preset.id] || '');
    }
  }, [currentPresets[preset.id], preset.id]);

  const gradeLetter = preset.label.split(' ')[0];
  const gradeDesc = preset.label.substring(preset.label.indexOf('('));

  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-[4px] px-3 py-1.5 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-2 shrink-0 w-[105px]">
        <div className={`w-2.5 h-2.5 rounded-full ${preset.color} shrink-0`} />
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-[11px] font-black text-white">{gradeLetter}</span>
          <span className="text-[8px] font-bold text-gray-500 truncate">{gradeDesc}</span>
        </div>
      </div>
      <input 
        id={`preset-${preset.id}`}
        type="text"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={async (e) => {
          const val = e.target.value;
          const newPresets = { ...currentPresets, [preset.id]: val };
          
          if (isMasterAdmin) {
            if (onUpdateAcademyInfo) {
              await onUpdateAcademyInfo({ 
                operation_settings: {
                  ...(academyInfo?.operation_settings || {}),
                  default_homework_presets: newPresets
                }
              });
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
        placeholder={isMasterAdmin ? "학원 피드백 문구" : "피드백 문구"}
        className="flex-1 bg-black/40 border border-white/10 rounded-[2px] px-3 py-1 text-[11px] font-bold text-gray-300 outline-none focus:border-amber-500 transition-all h-7"
      />
      {isMasterAdmin && <span className="text-[7px] font-black text-amber-500 uppercase tracking-tighter bg-amber-500/10 px-1 py-0.5 rounded shrink-0">Default</span>}
      {isTeacherAdmin && <span className="text-[7px] font-black text-blue-500 uppercase tracking-tighter bg-blue-500/10 px-1 py-0.5 rounded shrink-0">Preset</span>}
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

  const isMasterAdmin = currentUser?.id === 'admin';
  const currentPresets = isMasterAdmin 
    ? (academyInfo?.operation_settings?.default_homework_presets || {}) 
    : (currentUser?.homework_presets || {});

  // 단축어 10개 가져오기 및 초기화
  const snippets = useMemo(() => {
    const arr = currentPresets.snippets || [];
    const result = [...arr];
    while (result.length < 10) {
      result.push('');
    }
    return result.slice(0, 10);
  }, [currentPresets.snippets]);

  // 트리거 기호 가져오기 (기본값 ';')
  const trigger = currentPresets.snippet_trigger || ';';

  const [localSnippets, setLocalSnippets] = useState<string[]>(snippets);
  const [localTrigger, setLocalTrigger] = useState<string>(trigger);

  useEffect(() => {
    if (!document.activeElement?.id.startsWith('snippet-')) {
      setLocalSnippets(snippets);
    }
  }, [snippets]);

  useEffect(() => {
    setLocalTrigger(trigger);
  }, [trigger]);

  const savePresets = async (updatedPresets: any) => {
    if (isMasterAdmin) {
      if (onUpdateAcademyInfo) {
        await onUpdateAcademyInfo({ 
          operation_settings: { 
            ...(academyInfo?.operation_settings || {}), 
            default_homework_presets: updatedPresets 
          } 
        });
      }
    } else {
      const { error } = await supabase
        .from('ams_teachers')
        .update({ homework_presets: updatedPresets })
        .eq('id', currentUser.id);
      if (!error) {
        onUpdateCurrentUser({ homework_presets: updatedPresets });
      }
    }
  };

  const handleSnippetChange = (index: number, val: string) => {
    const next = [...localSnippets];
    next[index] = val;
    setLocalSnippets(next);
  };

  const handleSnippetBlur = async (index: number, val: string) => {
    if (snippets[index] === val) return; // 변경사항이 없으면 저장 생략

    setLocalSnippets(prev => {
      const next = [...prev];
      next[index] = val;
      
      // 상태 업데이트와 동시에 DB 저장 실행 (최신 prev 값 기준)
      const nextPresets = { ...currentPresets, snippets: next };
      savePresets(nextPresets);
      return next;
    });
  };

  const handleTriggerChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalTrigger(val);
    const nextPresets = { ...currentPresets, snippet_trigger: val };
    await savePresets(nextPresets);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
      <div className="max-w-4xl space-y-12">
        
        {/* 피드백 프리셋 섹션 */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-1">
            <MessageSquare className="text-amber-500" size={20} />
            <h3 className="text-sm font-black text-white uppercase tracking-widest">My Feedback Presets</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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

        {/* 자주 쓰는 단축어 및 트리거 설정 섹션 */}
        <div className="space-y-6 border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
            <div className="flex items-center gap-3">
              <Keyboard className="text-blue-500" size={20} />
              <h3 className="text-sm font-black text-white uppercase tracking-widest">My Shortcuts & Snippets</h3>
            </div>
            
            {/* 트리거 기호 선택 Dropdown */}
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-[4px]">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Trigger Key</label>
              <select
                value={localTrigger}
                onChange={handleTriggerChange}
                className="bg-black text-xs font-black text-blue-400 outline-none border-0 cursor-pointer py-0.5 rounded"
              >
                <option value=";">; (세미콜론 - 권장)</option>
                <option value="#"># (샵/우물정)</option>
                <option value="`">` (백틱/₩원화)</option>
                <option value="@">@ (골뱅이)</option>
                <option value="none">사용 안 함</option>
              </select>
            </div>
          </div>
          
          <p className="text-[11px] text-gray-500 font-medium leading-relaxed px-1">
            일지 작성 시, 선택한 트리거 기호 뒤에 숫자를 입력하면 등록해 둔 자주 쓰는 문구로 즉시 치환됩니다.
            {localTrigger === ';' && <span className="text-blue-400 ml-1">예: ';1' 입력 시 1번 문구로 자동 완성</span>}
            {localTrigger === '#' && <span className="text-amber-500 ml-1">주의: 수학 문제 번호(#1, #2 등) 입력 시 자동완성이 실행될 수 있습니다.</span>}
            {localTrigger === '`' && <span className="text-blue-400 ml-1">예: '`1' 입력 시 1번 문구로 자동 완성 (한글 모드에서는 ₩1로도 동작)</span>}
            {localTrigger === '@' && <span className="text-blue-400 ml-1">예: '@1' 입력 시 1번 문구로 자동 완성</span>}
            {localTrigger === 'none' && <span className="text-gray-400 ml-1">자동 치환이 꺼집니다. 입력창 하단의 칩 버튼 클릭으로만 입력됩니다.</span>}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localSnippets.map((snip, index) => (
              <div key={index} className="bg-white/5 border border-white/5 rounded-[4px] p-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-[4px] bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-blue-400">{index === 9 ? 0 : index + 1}</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      Shortcut {index === 9 ? '10 (Trigger: ' + (localTrigger === 'none' ? '버튼' : localTrigger + '0') + ')' : (index + 1) + ' (Trigger: ' + (localTrigger === 'none' ? '버튼' : localTrigger + (index + 1)) + ')'}
                    </label>
                  </div>
                  <input
                    id={`snippet-${index}`}
                    type="text"
                    value={snip}
                    onChange={(e) => handleSnippetChange(index, e.target.value)}
                    onBlur={(e) => handleSnippetBlur(index, e.target.value)}
                    placeholder={`${index === 9 ? '0' : index + 1}번 단축 문구 입력`}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2 text-[12px] font-bold text-gray-300 outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 패스워드 변경 섹션 */}
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
