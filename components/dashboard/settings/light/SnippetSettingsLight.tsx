'use client';

import { useState, useEffect, useMemo } from 'react';
import { Keyboard, Zap, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SnippetSettingsProps {
  currentUser: any;
  onUpdateCurrentUser: (updates: any) => void;
}

export default function SnippetSettingsLight({ currentUser, onUpdateCurrentUser }: SnippetSettingsProps) {
  const initSnippets = (currentUser.snippets ?? []).slice(0, 10);
  while (initSnippets.length < 10) initSnippets.push('');
  
  const [localSnippets, setLocalSnippets] = useState<string[]>(initSnippets);
  const [localTrigger, setLocalTrigger] = useState<string>(currentUser.snippet_trigger ?? ';');
  const [localSets, setLocalSets] = useState<any[]>(currentUser.snippet_sets ?? []);
  const [newSetName, setNewSetName] = useState<string>('');

  useEffect(() => {
    setLocalSets(currentUser.snippet_sets ?? []);
  }, [currentUser.snippet_sets]);

  useEffect(() => {
    const arr = currentUser.snippets ?? [];
    const result = [...arr];
    while (result.length < 10) result.push('');
    setLocalSnippets(result.slice(0, 10));
  }, [currentUser.snippets]);

  useEffect(() => {
    setLocalTrigger(currentUser.snippet_trigger ?? ';');
  }, [currentUser.snippet_trigger]);

  const saveSnippets = async (updatedSnippets: string[]) => {
    try {
      const { error } = await supabase
        .from('ams_teachers')
        .update({ snippets: updatedSnippets })
        .eq('id', currentUser.id);
      if (!error) {
        await onUpdateCurrentUser({ snippets: updatedSnippets });
      } else {
        alert('단축어 저장에 실패했습니다.');
      }
    } catch (e) {
      alert('단축어 저장 중 오류가 발생했습니다.');
    }
  };

  const saveTrigger = async (trigger: string) => {
    try {
      const { error } = await supabase
        .from('ams_teachers')
        .update({ snippet_trigger: trigger })
        .eq('id', currentUser.id);
      if (!error) {
        await onUpdateCurrentUser({ snippet_trigger: trigger });
      } else {
        alert('트리거 저장에 실패했습니다.');
      }
    } catch (e) {
      alert('트리거 저장 중 오류가 발생했습니다.');
    }
  };

  const saveSnippetSets = async (updatedSets: any[]) => {
    try {
      const { error } = await supabase
        .from('ams_teachers')
        .update({ snippet_sets: updatedSets })
        .eq('id', currentUser.id);
      if (!error) {
        await onUpdateCurrentUser({ snippet_sets: updatedSets });
      } else {
        alert('단축어 세트 보관에 실패했습니다.');
      }
    } catch (e) {
      alert('단축어 세트 보관 중 오류가 발생했습니다.');
    }
  };

  const handleLoadSet = async (setId: string) => {
    const targetSet = localSets.find(s => s.id === setId);
    if (!targetSet) return;

    if (!confirm(`'${targetSet.name}' 단축어 세트로 교체하시겠습니까?\n현재 작성되어 노출 중인 단축어는 이 세트의 내용으로 덮어씌워집니다.`)) return;

    try {
      const updatedSnippets = [...(targetSet.snippets ?? [])].slice(0, 10);
      while (updatedSnippets.length < 10) updatedSnippets.push('');
      const updatedTrigger = targetSet.snippet_trigger ?? ';';

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
        alert('단축어 불러오기에 실패했습니다.');
      }
    } catch (e) {
      alert('단축어 불러오기 중 오류가 발생했습니다.');
    }
  };

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

  const handleDeleteSet = async (setId: string, name: string) => {
    if (!confirm(`'${name}' 세트를 보관함에서 삭제하시겠습니까?`)) return;
    const updatedSets = localSets.filter(s => s.id !== setId);
    await saveSnippetSets(updatedSets);
  };

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

  return (
    <div className="bg-white border border-[#e3e2e0] rounded-lg p-6 space-y-6 shadow-sm text-[#37352f]">
      <div className="flex items-center justify-between pb-2 border-b border-[#e3e2e0]">
        <div className="flex items-center gap-3">
          <Keyboard className="text-blue-600" size={18} />
          <h3 className="text-xs font-bold text-[#37352f] uppercase tracking-widest">일지 간편 상용구 (단축어) 설정</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-500">단축어 트리거 문자:</span>
          <input 
            type="text" 
            maxLength={1} 
            value={localTrigger} 
            onChange={(e) => setLocalTrigger(e.target.value)}
            onBlur={(e) => saveTrigger(e.target.value)}
            className="w-8 h-8 text-center bg-white border border-[#edece9] rounded text-sm font-bold text-blue-650 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 단축키 리스트 */}
        <div className="lg:col-span-8 space-y-4">
          <h4 className="text-[10px] font-bold text-gray-500 tracking-wider">단축키 바인딩 목록 (1~10번)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {localSnippets.map((snip, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-50/50 border border-[#edece9] px-3 py-2 rounded-lg text-xs">
                <span className="font-mono text-blue-600 font-bold shrink-0 w-8">
                  {localTrigger}{idx === 9 ? 0 : idx + 1}
                </span>
                <input 
                  id={`snippet-${idx}`}
                  type="text"
                  placeholder="상용구 텍스트 기입"
                  value={snip}
                  onChange={(e) => {
                    const next = [...localSnippets];
                    next[idx] = e.target.value;
                    setLocalSnippets(next);
                  }}
                  onBlur={() => saveSnippets(localSnippets)}
                  className="flex-1 bg-white border border-[#edece9] rounded px-2.5 py-1 text-xs font-bold text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 단축키 보관함 세트 */}
        <div className="lg:col-span-4 space-y-4 border-t lg:border-t-0 lg:border-l border-[#edece9] pt-4 lg:pt-0 lg:pl-6">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-500 animate-pulse" size={15} />
            <h4 className="text-[10px] font-bold text-[#37352f] tracking-wider">단축어 보관함 (세트)</h4>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="새 보관 세트명"
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                className="flex-1 bg-white border border-[#edece9] rounded px-3 py-1.5 text-xs font-bold text-gray-800 outline-none focus:border-amber-500 placeholder-gray-300"
              />
              <button 
                onClick={handleCreateSet}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded shadow-sm"
              >
                보관
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar-v pr-1">
              {localSets.length === 0 ? (
                <p className="text-[10px] text-gray-400 italic text-center py-4">저장된 세트가 없습니다.</p>
              ) : (
                localSets.map((s) => {
                  const isActive = activeSet?.id === s.id;
                  return (
                    <div 
                      key={s.id} 
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        isActive 
                          ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm' 
                          : 'bg-white border-[#edece9] hover:bg-gray-50'
                      }`}
                    >
                      <button 
                        onClick={() => handleLoadSet(s.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <span className="text-xs font-bold block truncate">{s.name}</span>
                        <span className="text-[8px] text-gray-400 block mt-0.5">
                          트리거: '{s.snippet_trigger}' / 항목 {(s.snippets ?? []).filter(Boolean).length}개
                        </span>
                      </button>
                      <button 
                        onClick={() => handleDeleteSet(s.id, s.name)}
                        className="p-1 hover:bg-rose-50 hover:text-red-600 rounded text-gray-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
