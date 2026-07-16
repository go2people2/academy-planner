import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CooperatingCell {
  colId: string;
  clientId: string;
  timestamp: number;
}

/**
 * 📝 [리팩토링] useCoopCollaboration: 다중 기기 실시간 동시 편집 감지 및 충돌 방지를 위한 공용 브로드캐스트 훅
 * 기존의 모든 타이밍 정책(15초 자동 만료, 5초 주기 정화)과 데이터 규격을 단 1%의 유실 없이 고스란히 이식합니다.
 */
export function useCoopCollaboration(academyInfoId: string | undefined) {
  const [cooperatingCells, setCooperatingCells] = useState<Record<string, CooperatingCell>>({});
  const [myClientId, setMyClientId] = useState<string>('');

  // 1. 탭 고유 임시 기기 세션 ID 발급 (sessionStorage 활용)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let clientId = sessionStorage.getItem('ams_collaboration_client_id');
      if (!clientId) {
        clientId = 'client-' + Math.random().toString(36).substring(2, 11);
        sessionStorage.setItem('ams_collaboration_client_id', clientId);
      }
      setMyClientId(clientId);
    }
  }, []);

  // 2. 내가 특정 셀을 편집하기 시작하거나 마쳤을 때 이벤트를 발신하는 함수
  const sendCoopEvent = useCallback((event: 'focus_in' | 'focus_out', studentId: string, colId: string) => {
    if (!myClientId || !academyInfoId) return;
    const channel = supabase.channel(`today_sheet_coop_${academyInfoId}`);
    if (event === 'focus_in') {
      channel.send({
        type: 'broadcast',
        event: 'focus_in',
        payload: { clientId: myClientId, studentId, colId }
      });
    } else {
      channel.send({
        type: 'broadcast',
        event: 'focus_out',
        payload: { studentId, colId }
      });
    }
  }, [myClientId, academyInfoId]);

  // 3. Supabase Broadcast 실시간 협업 채널 바인딩 및 15초 자동 정화 GC 가동
  useEffect(() => {
    if (!myClientId || !academyInfoId) return;

    const coopChannel = supabase.channel(`today_sheet_coop_${academyInfoId}`, {
      config: {
        broadcast: { self: false }
      }
    });

    coopChannel
      .on('broadcast', { event: 'focus_in' }, ({ payload }) => {
        const { clientId, studentId, colId } = payload;
        setCooperatingCells(prev => ({
          ...prev,
          [`${studentId}_${colId}`]: { colId, clientId, timestamp: Date.now() }
        }));
      })
      .on('broadcast', { event: 'focus_out' }, ({ payload }) => {
        const { studentId, colId } = payload;
        setCooperatingCells(prev => {
          const next = { ...prev };
          delete next[`${studentId}_${colId}`];
          return next;
        });
      })
      .subscribe();

    // 비정상 유실 방지 가비지 컬렉터 (15초 초과 시 자동 증발)
    const timer = setInterval(() => {
      setCooperatingCells(prev => {
        const now = Date.now();
        const next: Record<string, CooperatingCell> = {};
        let changed = false;
        Object.keys(prev).forEach(key => {
          if (now - prev[key].timestamp < 15000) {
            next[key] = prev[key];
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 5000);

    return () => {
      coopChannel.unsubscribe();
      clearInterval(timer);
    };
  }, [myClientId, academyInfoId]);

  return {
    cooperatingCells,
    sendCoopEvent
  };
}
