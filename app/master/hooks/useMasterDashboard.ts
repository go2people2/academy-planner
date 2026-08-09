import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function useMasterDashboard() {
  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [academies, setAcademies] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  
  const [editingAcademy, setEditingAcademy] = useState<any>(null);
  const [editAcademyName, setEditAcademyName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editIsSuspended, setEditIsSuspended] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editAiSettings, setEditAiSettings] = useState<{ active_models: string[]; default_model: string }>({ active_models: ['openai'], default_model: 'openai' });
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  const [academyName, setAcademyName] = useState('');
  const [slug, setSlug] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null, text: string }>({ type: null, text: '' });
  
  const [masterId, setMasterId] = useState('');
  const [masterPw, setMasterPw] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const router = useRouter();

  const fetchAcademies = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('ams_academies')
        .select('id, academy_name, slug, created_at, operation_settings')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setAcademies(data);
      }
    } catch (e) {
      console.error('Fetch academies error:', e);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    const userStr = localStorage.getItem('ams_user');
    if (!userStr) {
      setIsAuthorized(false);
      return;
    }
    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'master') {
        setIsAuthorized(false);
        return;
      }
      
      const { data: profile, error } = await supabase
        .from('ams_teachers')
        .select('academy_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && profile) {
        const restoredUser = {
          ...user,
          academy_id: profile.academy_id
        };
        localStorage.setItem('ams_user', JSON.stringify(restoredUser));
        localStorage.removeItem('ams_is_warp');
      }

      setIsAuthorized(true);
      fetchAcademies();
    } catch (e) {
      setIsAuthorized(false);
    }
  }, [fetchAcademies]);

  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, [checkAuth]);

  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      let email = masterId.trim().toLowerCase();
      if (!email.includes('@')) {
        email = `${email}@hokma-academy.com`;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: masterPw,
      });

      if (authError) {
        setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
        setIsLoggingIn(false);
        return;
      }

      if (data?.user) {
        const { data: profile, error: pErr } = await supabase
          .from('ams_teachers')
          .select('id, name, role, academy_id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (pErr || !profile) {
          await supabase.auth.signOut();
          setLoginError('사용자 프로필을 가져올 수 없습니다.');
          setIsLoggingIn(false);
          return;
        }

        if (profile.role !== 'master') {
          await supabase.auth.signOut();
          setLoginError('접근 권한이 없습니다. 마스터 계정만 접근 가능합니다.');
          setIsLoggingIn(false);
          return;
        }

        const masterUser = {
          role: profile.role,
          id: profile.id,
          name: profile.name,
          academy_id: profile.academy_id
        };
        localStorage.setItem('ams_user', JSON.stringify(masterUser));
        setIsAuthorized(true);
        fetchAcademies();
      }
    } catch (err) {
      console.error('Master login exception:', err);
      setLoginError('로그인 중 알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: null, text: '' });

    if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
      setStatusMsg({
        type: 'error',
        text: '슬러그는 오직 영문자, 숫자, 하이픈(-)만 포함할 수 있습니다.'
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/master/create-academy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academyName, slug, username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        setStatusMsg({
          type: 'success',
          text: `[${academyName}] 학원이 성공적으로 자동 개설되었습니다! 로그인 ID: ${username}`
        });
        setAcademyName('');
        setSlug('');
        setUsername('');
        setPassword('');
        fetchAcademies();
      } else {
        setStatusMsg({
          type: 'error',
          text: data.error || '학원 개설에 실패했습니다.'
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: '서버 통신 오류가 발생했습니다.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAcademy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAcademy?.id) return;
    
    const targetId = editingAcademy.id;
    const oldSlug = editingAcademy.slug;
    const cleanSlug = editSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanName = editAcademyName.trim();
    
    if (!cleanSlug) { alert('슬러그는 공백으로 지정할 수 없습니다.'); return; }
    if (!cleanName) { alert('학원 이름은 필수입니다.'); return; }
    
    setIsUpdating(true);
    try {
      const res = await fetch('/api/master/update-academy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          academyId: targetId, 
          academyName: cleanName, 
          slug: cleanSlug, 
          oldSlug, 
          isSuspended: editIsSuspended,
          aiSettings: editAiSettings 
        })
      });
      const data = await res.json();
      
      if (data.success) {
        alert('학원 정보가 정상적으로 변경되었습니다.');
        setEditingAcademy(null);
        fetchAcademies();
      } else {
        alert(data.error || '학원 정보 수정에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버통신 오류가 발생했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAcademy = async () => {
    if (!editingAcademy?.id) return;
    if (deleteConfirmInput !== editingAcademy.slug) {
      alert('영문 슬러그 확인 문구가 일치하지 않습니다.');
      return;
    }

    if (!confirm(`⚠️ 정말로 [${editingAcademy.academy_name}] 학원의 모든 데이터(원생, 선생님, 세션, 반, 설정)를 영구 삭제하시겠습니까?\n이 작업은 절대 복구할 수 없습니다!`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/master/delete-academy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          academyId: editingAcademy.id, 
          slug: editingAcademy.slug 
        })
      });
      const data = await res.json();

      if (data.success) {
        alert(`[${editingAcademy.academy_name}] 학원이 완전히 삭제되었습니다.`);
        setEditingAcademy(null);
        setShowDeleteSection(false);
        setDeleteConfirmInput('');
        fetchAcademies();
      } else {
        alert(data.error || '학원 삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버통신 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleWarpToAcademy = (targetAcademyId: string, targetSlug: string) => {
    const userStr = localStorage.getItem('ams_user');
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr);
      const warpedUser = {
        ...user,
        academy_id: targetAcademyId
      };
      localStorage.setItem('ams_user', JSON.stringify(warpedUser));
      localStorage.setItem('ams_is_warp', 'true');
      router.push(`/${targetSlug}/dashboard`);
    } catch (e) {
      console.error('Warp error:', e);
    }
  };

  const openEditModal = (a: any) => {
    setEditingAcademy(a);
    setEditAcademyName(a.academy_name);
    setEditSlug(a.slug);
    setEditIsSuspended(!!a.operation_settings?.is_suspended);
    setEditAiSettings(a.operation_settings?.ai_settings || { active_models: ['openai'], default_model: 'openai' });
    setShowDeleteSection(false);
    setDeleteConfirmInput('');
  };

  return {
    mounted,
    isAuthorized,
    academies,
    isLoadingList,
    editingAcademy,
    setEditingAcademy,
    editAcademyName,
    setEditAcademyName,
    editSlug,
    setEditSlug,
    editIsSuspended,
    setEditIsSuspended,
    isUpdating,
    editAiSettings,
    setEditAiSettings,
    isDeleting,
    deleteConfirmInput,
    setDeleteConfirmInput,
    showDeleteSection,
    setShowDeleteSection,
    academyName,
    setAcademyName,
    slug,
    setSlug,
    username,
    setUsername,
    password,
    setPassword,
    isSubmitting,
    statusMsg,
    masterId,
    setMasterId,
    masterPw,
    setMasterPw,
    loginError,
    isLoggingIn,
    handleMasterLogin,
    handleSubmit,
    handleUpdateAcademy,
    handleDeleteAcademy,
    handleWarpToAcademy,
    openEditModal,
  };
}
