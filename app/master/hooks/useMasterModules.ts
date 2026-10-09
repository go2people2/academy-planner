'use client';

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { AcademyModuleOverview, ModuleStatus, ActivationCode } from '@/types/modules';

export function useMasterModules(isAuthorized: boolean) {
  const [moduleOverviews, setModuleOverviews] = useState<AcademyModuleOverview[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [moduleError, setModuleError] = useState('');

  // 필터 상태
  const [filterModule, setFilterModule] = useState<'all' | 'hokma_active' | 'hokma_pending'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // 모달 제어 상태
  const [selectedAcademy, setSelectedAcademy] = useState<AcademyModuleOverview | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 모듈 수정 폼 상태
  const [editAmsStatus, setEditAmsStatus] = useState<ModuleStatus>('active');
  const [editHokmaStatus, setEditHokmaStatus] = useState<ModuleStatus>('inactive');
  const [editHokmaMaxDevices, setEditHokmaMaxDevices] = useState(1);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // 설치 코드 발급 상태
  const [issuedCodeInfo, setIssuedCodeInfo] = useState<{ code: string; expires_at: string; prefix: string } | null>(null);
  const [isIssuingCode, setIsIssuingCode] = useState(false);
  const [activationCodes, setActivationCodes] = useState<ActivationCode[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [isRevokingCodeId, setIsRevokingCodeId] = useState<string | null>(null);
  const [revealingCodeId, setRevealingCodeId] = useState<string | null>(null);

  // 설치 링크 상태
  const [installUrl, setInstallUrl] = useState<string>('');
  const [isInstallUrlConfigured, setIsInstallUrlConfigured] = useState<boolean>(false);

  // 기기 해제 처리 상태
  const [isRevokingDevice, setIsRevokingDevice] = useState(false);

  // 1. 모듈 현황 목록 조회
  const fetchModuleOverviews = useCallback(async () => {
    if (!isAuthorized) return;
    setIsLoadingModules(true);
    setModuleError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/master/modules', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '모듈 현황 조회 실패');
      }
      setModuleOverviews(data.academies || []);
    } catch (err: any) {
      console.error('Fetch module overviews error:', err);
      setModuleError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingModules(false);
    }
  }, [isAuthorized]);

  // 1-1. 특정 학원의 설치 코드 목록 조회 (plain_code 미포함, 메타데이터만)
  const fetchActivationCodes = useCallback(async (academyId: string) => {
    setIsLoadingCodes(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`/api/master/activation-codes?academy_id=${academyId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActivationCodes(data.codes || []);
        setIsInstallUrlConfigured(Boolean(data.install_url_configured));
        setInstallUrl(data.install_url || '');
      } else {
        setActivationCodes([]);
      }
    } catch (err) {
      console.error('Fetch activation codes error:', err);
      setActivationCodes([]);
    } finally {
      setIsLoadingCodes(false);
    }
  }, []);

  // 2. 모달 열기
  const openModuleModal = useCallback((academy: AcademyModuleOverview) => {
    setSelectedAcademy(academy);
    setEditAmsStatus(academy.ams_status);
    setEditHokmaStatus(academy.hokmanote_status);
    setEditHokmaMaxDevices(academy.hokmanote_max_devices || 1);
    setIssuedCodeInfo(null);
    setIsModalOpen(true);
    fetchActivationCodes(academy.id);
  }, [fetchActivationCodes]);

  // 3. 모달 닫기
  const closeModuleModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedAcademy(null);
    setIssuedCodeInfo(null);
    setActivationCodes([]);
  }, []);

  // 4. 모듈 상태 저장 (AMS & HokmaNote)
  const handleSaveModuleStatus = useCallback(async () => {
    if (!selectedAcademy) return;
    setIsSavingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // 1) AMS 상태 저장
      const resAms = await fetch('/api/master/modules', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          academy_id: selectedAcademy.id,
          module_code: 'ams',
          status: editAmsStatus,
        }),
      });
      const dataAms = await resAms.json();
      if (!dataAms.success) throw new Error(dataAms.error);

      // 2) HokmaNote 상태 저장
      const resHokma = await fetch('/api/master/modules', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          academy_id: selectedAcademy.id,
          module_code: 'hokmanote',
          status: editHokmaStatus,
          max_devices: editHokmaMaxDevices,
        }),
      });
      const dataHokma = await resHokma.json();
      if (!dataHokma.success) throw new Error(dataHokma.error);

      alert('모듈 사용 권한이 저장되었습니다.');
      await fetchModuleOverviews();
      closeModuleModal();
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setIsSavingStatus(false);
    }
  }, [selectedAcademy, editAmsStatus, editHokmaStatus, editHokmaMaxDevices, fetchModuleOverviews, closeModuleModal]);

  // 5. HokmaNote 설치 코드 발급 (forceReissue 및 expectedActiveCodeId 옵션 지원)
  const handleIssueActivationCode = useCallback(async (forceReissue = false, expectedActiveCodeId?: string) => {
    if (!selectedAcademy) return;
    setIsIssuingCode(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/master/activation-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          academy_id: selectedAcademy.id,
          module_code: 'hokmanote',
          force_reissue: forceReissue,
          expected_active_code_id: expectedActiveCodeId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error_code === 'ACTIVE_CODE_ALREADY_EXISTS') {
          const existingId = data.existing_code_id;
          const doReissue = confirm(
            '이미 사용 가능한 설치 코드가 발급되어 있습니다.\n\n기존 코드를 폐기하고 새 설치 코드를 재발급하시겠습니까?'
          );
          if (doReissue) {
            // 원자적 재발급: 확인했던 기존 코드 ID를 expected_active_code_id로 전달
            await handleIssueActivationCode(true, existingId);
            return;
          }
          return;
        }
        if (data.error_code === 'ACTIVE_CODE_CHANGED' || data.error_code === 'ACTIVE_CODE_NOT_FOUND') {
          alert(data.error || '설치 코드 상태가 변경되었습니다. 최신 코드를 목록에서 확인해 주세요.');
          await fetchActivationCodes(selectedAcademy.id);
          return;
        }
        throw new Error(data.error || '설치 코드 발급 실패');
      }

      setIssuedCodeInfo({
        code: data.code,
        expires_at: data.expires_at,
        prefix: data.prefix,
      });

      // 발급 후 코드 목록 새로고침
      await fetchActivationCodes(selectedAcademy.id);
    } catch (err: any) {
      alert(`코드 발급 실패: ${err.message}`);
    } finally {
      setIsIssuingCode(false);
    }
  }, [selectedAcademy, fetchActivationCodes]);

  // 5-1. 설치 코드 즉시 폐기 (Revoke)
  const handleRevokeActivationCode = useCallback(async (codeId: string) => {
    if (!selectedAcademy) return;
    if (!confirm('이 설치 코드를 즉시 폐기하시겠습니까? 폐기된 코드는 더 이상 사용할 수 없습니다.')) {
      return;
    }
    setIsRevokingCodeId(codeId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/master/activation-codes', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code_id: codeId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '코드 폐기 실패');
      }

      // 만약 방금 노출 중이던 코드가 폐기된 것이라면 노출 정보도 해제
      if (issuedCodeInfo) {
        setIssuedCodeInfo(null);
      }

      // 목록 새로고침
      await fetchActivationCodes(selectedAcademy.id);
    } catch (err: any) {
      alert(`코드 폐기 실패: ${err.message}`);
    } finally {
      setIsRevokingCodeId(null);
    }
  }, [selectedAcademy, issuedCodeInfo, fetchActivationCodes]);

  // 5-2. 특정 코드의 원문 복호화 조회 (Reveal)
  const handleRevealCode = useCallback(async (codeId: string): Promise<string | null> => {
    setRevealingCodeId(codeId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/master/activation-codes/reveal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code_id: codeId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || '코드 원문 조회에 실패했습니다.');
        return null;
      }

      // 해당 코드의 plain_code를 로컬 목록 상태에 반영
      setActivationCodes((prev) =>
        prev.map((c) => (c.id === codeId ? { ...c, plain_code: data.code } : c))
      );

      // 상단 활성 코드 카드에도 동기화
      setIssuedCodeInfo({
        code: data.code,
        expires_at: data.expires_at,
        prefix: data.code.substring(0, 7),
      });

      return data.code;
    } catch (err: any) {
      alert(`코드 복호화 실패: ${err.message}`);
      return null;
    } finally {
      setRevealingCodeId(null);
    }
  }, []);

  // 6. 등록 기기 원격 해제 (Revoke)
  const handleRevokeDevice = useCallback(async (deviceId: string) => {
    if (!confirm('정말 해당 Mac 기기 등록을 해제하시겠습니까? 해당 기기의 HokmaNote는 즉시 미등록 상태로 차단됩니다.')) {
      return;
    }
    setIsRevokingDevice(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`/api/master/devices/${deviceId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: '관리자 수동 해제' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '기기 해제 실패');
      }

      alert('기기 등록이 해제되었습니다.');
      await fetchModuleOverviews();
      closeModuleModal();
    } catch (err: any) {
      alert(`기기 해제 실패: ${err.message}`);
    } finally {
      setIsRevokingDevice(false);
    }
  }, [fetchModuleOverviews, closeModuleModal]);

  // 7. 필터링된 학원 목록 계산
  const filteredOverviews = useMemo(() => {
    return moduleOverviews.filter((ac) => {
      // 1) 모듈 필터
      if (filterModule === 'hokma_active' && ac.hokmanote_status !== 'active') return false;
      if (filterModule === 'hokma_pending' && ac.hokmanote_status !== 'pending_setup') return false;

      // 2) 상태 필터
      if (filterStatus === 'active' && ac.ams_status !== 'active') return false;
      if (filterStatus === 'inactive' && ac.ams_status !== 'inactive') return false;

      return true;
    });
  }, [moduleOverviews, filterModule, filterStatus]);

  // 8. 요약 통계 계산 (H 플래너 제외 집계)
  const summaryStats = useMemo(() => {
    const validAcademies = moduleOverviews.filter((a) => a.slug !== 'hplan');
    const amsActiveCount = validAcademies.filter((a) => a.ams_status === 'active').length;
    const hokmaActiveCount = validAcademies.filter((a) => a.hokmanote_status === 'active').length;
    const hokmaPendingCount = validAcademies.filter((a) => a.hokmanote_status === 'pending_setup').length;

    return {
      total: validAcademies.length,
      amsActive: amsActiveCount,
      hokmaActive: hokmaActiveCount,
      hokmaPending: hokmaPendingCount,
    };
  }, [moduleOverviews]);

  return {
    moduleOverviews: filteredOverviews,
    isLoadingModules,
    moduleError,
    fetchModuleOverviews,
    filterModule,
    setFilterModule,
    filterStatus,
    setFilterStatus,
    selectedAcademy,
    isModalOpen,
    openModuleModal,
    closeModuleModal,
    editAmsStatus,
    setEditAmsStatus,
    editHokmaStatus,
    setEditHokmaStatus,
    editHokmaMaxDevices,
    setEditHokmaMaxDevices,
    isSavingStatus,
    handleSaveModuleStatus,
    issuedCodeInfo,
    setIssuedCodeInfo,
    isIssuingCode,
    handleIssueActivationCode,
    activationCodes,
    isLoadingCodes,
    isRevokingCodeId,
    handleRevokeActivationCode,
    revealingCodeId,
    handleRevealCode,
    installUrl,
    isInstallUrlConfigured,
    isRevokingDevice,
    handleRevokeDevice,
    summaryStats,
  };
}
