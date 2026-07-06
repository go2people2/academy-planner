'use client';

import { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PasswordSettingsProps {
  currentUser: any;
}

export default function PasswordSettingsLight({ currentUser }: PasswordSettingsProps) {
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

      const email = loginId.includes('@') ? loginId : `${loginId}@academy.com`;

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword
      });

      if (authError) {
        alert('현재 비밀번호가 일치하지 않습니다.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        alert(`비밀번호 변경 중 에러가 발생했습니다: ${updateError.message}`);
        return;
      }

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
      alert('비밀번호 변경 중 에러가 발생했습니다.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="bg-white border border-[#e3e2e0] rounded-lg p-6 space-y-6 shadow-sm text-[#37352f]">
      <div className="flex items-center gap-3 pb-2 border-b border-[#e3e2e0]">
        <Lock className="text-rose-600" size={18} />
        <h3 className="text-xs font-bold text-[#37352f] uppercase tracking-widest">비밀번호 변경</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1 text-left">
          <label className="text-[11px] font-bold text-gray-500 ml-1">현재 비밀번호</label>
          <input 
            type="password" 
            placeholder="현재 비밀번호 입력"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-white border border-[#edece9] rounded px-4 py-2.5 text-sm font-bold text-gray-800 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
          />
        </div>
        <div className="space-y-1 text-left">
          <label className="text-[11px] font-bold text-gray-500 ml-1">새 비밀번호</label>
          <input 
            type="password" 
            placeholder="최소 4자 이상"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-white border border-[#edece9] rounded px-4 py-2.5 text-sm font-bold text-gray-800 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
          />
        </div>
        <div className="space-y-1 text-left">
          <label className="text-[11px] font-bold text-gray-500 ml-1">비밀번호 확인</label>
          <input 
            type="password" 
            placeholder="새 비밀번호 재입력"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-white border border-[#edece9] rounded px-4 py-2.5 text-sm font-bold text-gray-800 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button 
          onClick={handleUpdatePassword}
          disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
          className="px-8 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-md transition-all shadow-md shadow-rose-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isUpdatingPassword ? <Loader2 className="animate-spin" size={14} /> : '비밀번호 변경'}
        </button>
      </div>
    </div>
  );
}
