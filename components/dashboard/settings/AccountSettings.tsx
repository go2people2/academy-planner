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
        className="flex-1 bg-black/40 border border-white/10 rounded-[2px] px-3 py-1 text-[11px] font-bold text-gray-300 outline-none focus:border-amber-500 transition-all h-7"
      />
      {isMasterAdmin && <span className="text-[7px] font-black text-amber-500 uppercase tracking-tighter bg-amber-500/10 px-1 py-0.5 rounded shrink-0">Default</span>}
      {isTeacherAdmin && <span className="text-[7px] font-black text-blue-500 uppercase tracking-tighter bg-blue-500/10 px-1 py-0.5 rounded shrink-0">Preset</span>}
    </div>
  );
}

export default function AccountSettings({ currentUser, onUpdateCurrentUser, academyInfo, onUpdateAcademyInfo }: AccountSettingsProps) {
  const feedbackPresets = [
    { id: 'gradeA', label: 'A', color: 'bg-emerald-500' },
    { id: 'gradeB', label: 'B', color: 'bg-blue-500' },
    { id: 'gradeC', label: 'C', color: 'bg-white/20' },
    { id: 'gradeD', label: 'D', color: 'bg-amber-500' },
    { id: 'gradeE', label: 'E', color: 'bg-red-500' },
    { id: 'gradeF', label: 'F', color: 'bg-purple-500' }
  ];

  const isMasterAdmin = currentUser?.id === 'admin';
  const currentPresets = isMasterAdmin 
    ? (academyInfo?.operation_settings?.default_homework_presets || {}) 
    : (currentUser?.homework_presets || {});
  // Migrate old preset keys (perfect, good, neutral, poor, bad) to new gradeA‑gradeF keys
  useEffect(() => {
    if (!('gradeA' in currentPresets)) {
      const migrated = {
        gradeA: currentPresets.perfect ?? '',
        gradeB: currentPresets.good ?? '',
        gradeC: currentPresets.neutral ?? '',
        gradeD: currentPresets.poor ?? '',
        gradeE: currentPresets.bad ?? '',
        gradeF: ''
      };
      // Save migrated presets back to Supabase / parent state
      savePresets(migrated);
    }
  }, [currentPresets]);

  // snippets와 trigger를 새 컬럼에서 직접 가져옵니다.
  const initSnippets = (currentUser.snippets ?? []).slice(0, 10);
  while (initSnippets.length < 10) initSnippets.push('');
  const [localSnippets, setLocalSnippets] = useState<string[]>(initSnippets);
  const [localTrigger, setLocalTrigger] = useState<string>(currentUser.snippet_trigger ?? ';');
  const [localSets, setLocalSets] = useState<any[]>(currentUser.snippet_sets ?? []);
  const [newSetName, setNewSetName] = useState<string>('');
  // Editing flags to prevent premature state reset
  const [isEditingPreset, setIsEditingPreset] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Record<number, boolean>>({});

  // 💡 [추가] 비밀번호 변경용 상태 및 핸들러
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      alert('현재 비밀번호를 입력해 주세요.');
      return;
    }
    if (!newPassword) {
      alert('새 비밀번호를 입력해 주세요.');
      return;
    }
    if (newPassword.length < 4) {
      alert('새 비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const loginId = currentUser?.login_id;
      if (!loginId) {
        alert('사용자 정보가 비어있어 비밀번호를 변경할 수 없습니다.');
        return;
      }

      // ams_teachers 테이블에서 현재 로그인한 교사의 아이디를 찾아서 이메일 형식으로 변환
      const email = loginId.includes('@') ? loginId : `${loginId}@academy.com`;

      // 1. 현재 비밀번호로 Supabase Auth 재로그인 시도하여 이전 비번 인증 검증
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword
      });

      if (authError) {
        alert('현재 비밀번호가 일치하지 않습니다.');
        return;
      }

      // 2. 인증 성공 시, 새 비밀번호로 업데이트 실행
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        alert(`비밀번호 변경 중 에러가 발생했습니다: ${updateError.message}`);
        return;
      }

      // 3. 교사 테이블(ams_teachers) 평문/백업용 패스워드 칼럼 업데이트
      const { error: dbError } = await supabase
        .from('ams_teachers')
        .update({ password: newPassword })
        .eq('id', currentUser.id);

      if (dbError) {
        console.warn('DB 교사 비밀번호 업데이트 실패 (메모 보존 실패):', dbError);
      }

      alert('비밀번호가 안전하게 변경되었습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      alert('비밀번호 변경 중 에러가 발생했습니다.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  useEffect(() => {
    setLocalSets(currentUser.snippet_sets ?? []);
  }, [currentUser.snippet_sets]);

  // 실시간 현재 활성화된 세트 객체 감지
  const activeSet = useMemo(() => {
    return localSets.find(s => {
      if (s.snippet_trigger !== localTrigger) return false;
      const sSnips = s.snippets ?? [];
      for (let i = 0; i < 10; i++) {
        if ((sSnips[i] ?? '') !== (localSnippets[i] ?? '')) return false;
      }
      return true;
    });
  }, [localSnippets, localTrigger, localSets]);

  // Sync with DB when profile updates
  useEffect(() => {
    const arr = currentUser.snippets ?? [];
    const result = [...arr];
    while (result.length < 10) result.push('');
    setLocalSnippets(result.slice(0, 10));
  }, [currentUser.snippets]);

  useEffect(() => {
    setLocalTrigger(currentUser.snippet_trigger ?? ';');
  }, [currentUser.snippet_trigger]);

  useEffect(() => {
    const anyEditing = Object.values(editingSnippet).some(v => v);
    if (!anyEditing && !document.activeElement?.id.startsWith('snippet-')) {
      // Logic for snippets reset based on current state
    }
  }, [editingSnippet]);

  const savePresets = async (updatedPresets: any) => {
    try {
      if (isMasterAdmin) {
        if (onUpdateAcademyInfo) {
          await onUpdateAcademyInfo({
            operation_settings: {
              ...(academyInfo?.operation_settings || {}),
              default_homework_presets: updatedPresets,
            },
          });
        }
      } else {
        const { error } = await supabase
          .from('ams_teachers')
          .update({ homework_presets: updatedPresets })
          .eq('id', currentUser.id);
        if (!error) {
          await onUpdateCurrentUser({ homework_presets: updatedPresets });
        } else {
          console.error('savePresets error:', error);
          alert('프리셋 저장에 실패했습니다.');
        }
      }
    } catch (e) {
      console.error('savePresets exception:', e);
      alert('프리셋 저장 중 오류가 발생했습니다.');
    }
  };

  // 새 컬럼에 snippets 저장
  const saveSnippets = async (updatedSnippets: string[]) => {
    try {
      const { error } = await supabase
        .from('ams_teachers')
        .update({ snippets: updatedSnippets })
        .eq('id', currentUser.id);
      if (!error) {
        await onUpdateCurrentUser({ snippets: updatedSnippets });
      } else {
        console.error('saveSnippets error:', error);
        alert('단축어 저장에 실패했습니다.');
      }
    } catch (e) {
      console.error('saveSnippets exception:', e);
      alert('단축어 저장 중 오류가 발생했습니다.');
    }
  };

  // 새 컬럼에 trigger 저장
  const saveTrigger = async (trigger: string) => {
    try {
      const { error } = await supabase
        .from('ams_teachers')
        .update({ snippet_trigger: trigger })
        .eq('id', currentUser.id);
      if (!error) {
        await onUpdateCurrentUser({ snippet_trigger: trigger });
      } else {
        console.error('saveTrigger error:', error);
        alert('트리거 저장에 실패했습니다.');
      }
    } catch (e) {
      console.error('saveTrigger exception:', e);
      alert('트리거 저장 중 오류가 발생했습니다.');
    }
  };

  // 보관함 세트 목록 저장
  const saveSnippetSets = async (updatedSets: any[]) => {
    try {
      const { error } = await supabase
        .from('ams_teachers')
        .update({ snippet_sets: updatedSets })
        .eq('id', currentUser.id);
      if (!error) {
        await onUpdateCurrentUser({ snippet_sets: updatedSets });
      } else {
        console.error('saveSnippetSets error:', error);
        alert('단축어 세트 보관에 실패했습니다.');
      }
    } catch (e) {
      console.error('saveSnippetSets exception:', e);
      alert('단축어 세트 보관 중 오류가 발생했습니다.');
    }
  };

  // 세트 불러오기 (Load)
  const handleLoadSet = async (setId: string) => {
    const targetSet = localSets.find(s => s.id === setId);
    if (!targetSet) return;

    if (!confirm(`'${targetSet.name}' 단축어 세트로 교체하시겠습니까?\n현재 작성되어 노출 중인 단축어는 이 세트의 내용으로 덮어씌워집니다.`)) return;

    try {
      const updatedSnippets = [...(targetSet.snippets ?? [])].slice(0, 10);
      while (updatedSnippets.length < 10) updatedSnippets.push('');
      const updatedTrigger = targetSet.snippet_trigger ?? ';';

      // 화면 상태 동시 갱신
      setLocalSnippets(updatedSnippets);
      setLocalTrigger(updatedTrigger);

      const { error } = await supabase
        .from('ams_teachers')
        .update({
          snippets: updatedSnippets,
          snippet_trigger: updatedTrigger
        })
        .eq('id', currentUser.id);

      if (!error) {
        await onUpdateCurrentUser({
          snippets: updatedSnippets,
          snippet_trigger: updatedTrigger
        });
      } else {
        console.error('LoadSet error:', error);
        alert('단축어 불러오기에 실패했습니다.');
      }
    } catch (e) {
      console.error('LoadSet exception:', e);
      alert('단축어 불러오기 중 오류가 발생했습니다.');
    }
  };

  // 새 세트 추가 (Save)
  const handleCreateSet = async () => {
    if (!newSetName.trim()) {
      alert('세트 이름을 입력해 주세요.');
      return;
    }

    const duplicate = localSets.find(s => s.name === newSetName.trim());
    if (duplicate && !confirm(`이미 '${newSetName.trim()}' 세트가 존재합니다. 덮어씌우시겠습니까?`)) {
      return;
    }

    const newSet = {
      id: duplicate ? duplicate.id : `set_${Date.now()}`,
      name: newSetName.trim(),
      snippet_trigger: localTrigger,
      snippets: localSnippets
    };

    const updatedSets = duplicate 
      ? localSets.map(s => s.id === duplicate.id ? newSet : s)
      : [...localSets, newSet];

    await saveSnippetSets(updatedSets);
    setNewSetName('');
  };

  // 세트 삭제 (Delete)
  const handleDeleteSet = async (setId: string, name: string) => {
    if (!confirm(`'${name}' 세트를 보관함에서 삭제하시겠습니까?`)) return;
    const updatedSets = localSets.filter(s => s.id !== setId);
    await saveSnippetSets(updatedSets);
  };

  const handleSnippetChange = (index: number, val: string) => {
    const next = [...localSnippets];
    next[index] = val;
    setLocalSnippets(next);
  };

  // Handle blur (save) for a snippet – 새로운 컬럼에 저장
  const handleSnippetBlur = async (index: number, val: string) => {
    const originalVal = currentUser.snippets?.[index] ?? '';
    if (originalVal === val) return; // No change
    setEditingSnippet(prev => ({ ...prev, [index]: true }));
    try {
      const updatedSnippets = (() => {
        const next = [...localSnippets];
        next[index] = val;
        setLocalSnippets(next);
        return next;
      })();
      await saveSnippets(updatedSnippets);
    } catch (e) {
      console.error('Snippet save error:', e);
      alert('단축어 저장에 실패했습니다.');
    } finally {
      setEditingSnippet(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleTriggerChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalTrigger(val);
    await saveTrigger(val);
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

          {/* 단축어 세트 보관함 매니저 (교사/조교별 복수 템플릿 지원) - 컴팩트 슬림 2행 고정 버전 */}
          <div className="bg-white/5 border border-white/5 rounded-[4px] p-3 space-y-3">
            {/* 1행: 타이틀 및 액티브 뱃지 & 삭제 버튼 */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-1.5 py-0.5 rounded">Snippet Presets</span>
                <span className="text-[10px] font-bold text-gray-500">교사별/조교별 단축어 보관함</span>
              </div>
              {/* 현재 활성화된 세트 표시 뱃지 및 인라인 삭제 */}
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-[4px] pl-2.5 pr-1.5 py-0.5 shrink-0">
                <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider">Active:</span>
                <span className={`text-[9px] font-black tracking-wider ${activeSet ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {activeSet ? activeSet.name : '개별 설정 (수정됨)'}
                </span>
                {activeSet && (
                  <button
                    onClick={() => handleDeleteSet(activeSet.id, activeSet.name)}
                    className="text-gray-500 hover:text-red-400 transition-colors p-0.5 ml-1 border-l border-white/10 pl-1.5"
                    title="현재 세트 보관함에서 삭제"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* 2행: 통합 관리 영역 (가로형 한 줄 배치) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1.5 border-t border-white/5">
              {/* 불러오기 드롭다운 */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleLoadSet(e.target.value);
                    e.target.value = ''; // Reset select
                  }
                }}
                defaultValue=""
                className="flex-1 bg-black/40 border border-white/10 rounded-[2px] px-2.5 py-1 text-[11px] font-bold text-gray-300 outline-none focus:border-blue-500 transition-all cursor-pointer h-8"
              >
                <option value="" disabled>저장된 세트 선택 (불러오기)...</option>
                {localSets.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Trigger: {s.snippet_trigger === 'none' ? '없음' : s.snippet_trigger})</option>
                ))}
              </select>

              {/* 현재 설정 저장 영역 */}
              <div className="flex-1 flex gap-1.5">
                <input
                  type="text"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="새 세트 이름 입력 (저장)"
                  className="flex-1 bg-black/40 border border-white/10 rounded-[2px] px-2.5 py-1 text-[11px] font-bold text-gray-300 outline-none focus:border-blue-500 transition-all h-8"
                />
                <button
                  onClick={handleCreateSet}
                  className="px-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase tracking-widest rounded-[2px] transition-all h-8 shrink-0"
                >
                  저장
                </button>
              </div>
            </div>
          </div>

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
                    onFocus={() => setEditingSnippet(prev => ({ ...prev, [index]: true }))}
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
              <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Current Password</label>
              <input 
                type="password" 
                placeholder="현재 비밀번호 입력" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white outline-none focus:border-red-500 transition-all placeholder:text-gray-700 font-bold" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">New Password</label>
              <input 
                type="password" 
                placeholder="새 비밀번호 입력" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white outline-none focus:border-red-500 transition-all placeholder:text-gray-700 font-bold" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Confirm New Password</label>
              <input 
                type="password" 
                placeholder="새 비밀번호 확인 입력" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm text-white outline-none focus:border-red-500 transition-all placeholder:text-gray-700 font-bold" 
              />
            </div>
            <button 
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword}
              className="w-full py-3 bg-white/5 border border-white/10 rounded-[2px] text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
