'use client';

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { MasterTextbookStatsData } from '../components/MasterTextbookStats';

export interface MasterTextbookRecord {
  bookcode: string;
  title: string;
  grade?: string;
  category?: string;
  publisher?: string;
  e_period?: string;
  status: '활성' | '비활성';
  share_scope: 'public' | 'group' | 'private';
  share_status: 'unsubmitted' | 'pending' | 'approved' | 'rejected';
  has_problem_data: boolean;
  unit_count: number;
  created_at: string;
}

export interface MasterAcademyOption {
  id: string;
  slug: string;
  name?: string;
}

export function useMasterTextbooks(isAuthorized: boolean) {
  const [textbooks, setTextbooks] = useState<MasterTextbookRecord[]>([]);
  const [stats, setStats] = useState<MasterTextbookStatsData | null>(null);
  const [academies, setAcademies] = useState<MasterAcademyOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 💡 마스터 인증 헤더 헬퍼
  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('ams_user') : null;
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u?.id) headers['x-ams-user-id'] = u.id;
      } catch {}
    }
    return headers;
  }, []);

  // 1. 전체 교재 및 통계 조회
  const fetchTextbooks = useCallback(async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/master/textbooks', { headers });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '교재 데이터 조회 실패');
      }
      setTextbooks(data.textbooks || []);
      setStats(data.stats || null);
      setAcademies(data.academies || []);
    } catch (err: any) {
      setErrorMsg(err.message || '데이터 로딩 중 오류 발생');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, getAuthHeaders]);

  // 2. 교재 상태 토글 (활성 ↔ 비활성)
  const toggleStatus = useCallback(async (bookcode: string, currentStatus: '활성' | '비활성') => {
    const newStatus: '활성' | '비활성' = currentStatus === '활성' ? '비활성' : '활성';
    setIsUpdating(bookcode);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/master/textbooks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ bookcode, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '상태 변경 실패');
      }
      // 로컬 상태 낙관적 갱신
      setTextbooks(prev => prev.map(b => b.bookcode === bookcode ? { ...b, status: newStatus } : b));
      setStats(prev => prev ? {
        ...prev,
        active_count: newStatus === '활성' ? prev.active_count + 1 : prev.active_count - 1,
        inactive_count: newStatus === '비활성' ? prev.inactive_count + 1 : prev.inactive_count - 1,
      } : null);
    } catch (err: any) {
      alert(`상태 변경 실패: ${err.message}`);
    } finally {
      setIsUpdating(null);
    }
  }, [getAuthHeaders]);

  // 3. 신규 공용 교재 + 단원 일괄 등록 (성공 여부 반환)
  const addTextbook = useCallback(async (payload: any): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/master/textbooks', { method: 'POST', headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '교재 등록 실패');
      alert(`신규 공용 교재가 등록되었습니다. (단원 ${data.unit_count ?? 0}개)`);
      await fetchTextbooks();
      return true;
    } catch (err: any) {
      alert(`등록 실패: ${err.message}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [getAuthHeaders, fetchTextbooks]);

  // 4. 기존 교재 정보 + 단원 수정 (성공 여부 반환)
  const updateTextbook = useCallback(async (payload: any): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/master/textbooks', { method: 'PATCH', headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '교재 수정 실패');
      alert('교재 정보와 단원이 저장되었습니다.');
      await fetchTextbooks();
      return true;
    } catch (err: any) {
      alert(`수정 실패: ${err.message}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [getAuthHeaders, fetchTextbooks]);

  // 5. 단일 교재 단원 조회 (수정 모달용)
  const loadUnits = useCallback(async (bookcode: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/master/textbooks?bookcode=${encodeURIComponent(bookcode)}`, { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '단원 조회 실패');
      return (data.units || []).map((u: any) => ({
        unit_name: u.unit_name,
        start_page: u.start_page,
        end_page: u.end_page,
      }));
    } catch (err: any) {
      alert(`단원 불러오기 실패: ${err.message}`);
      return [];
    }
  }, [getAuthHeaders]);

  // 6. 교재 및 연결된 단원 영구 삭제
  const deleteTextbook = useCallback(async (bookcode: string): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/master/textbooks?bookcode=${encodeURIComponent(bookcode)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '교재 삭제 실패');
      alert('교재와 단원이 영구 삭제되었습니다.');
      await fetchTextbooks();
      return true;
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [getAuthHeaders, fetchTextbooks]);

  return {
    textbooks,
    stats,
    academies,
    isLoading,
    isUpdating,
    isSubmitting,
    errorMsg,
    fetchTextbooks,
    toggleStatus,
    addTextbook,
    updateTextbook,
    deleteTextbook,
    loadUnits,
  };
}
