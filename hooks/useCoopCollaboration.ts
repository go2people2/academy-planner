import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface CooperatingCell {
  colId: string;
  clientId: string;
  timestamp: number;
  lockVersion: number;
}

export interface ForceTakeoverPayload {
  studentId: string;
  colId: string;
  previousClientId?: string;
  newClientId: string;
  lockVersion: number;
  timestamp: number;
}

/**
 * 📝 [리팩토링] useCoopCollaboration: 다중 기기 실시간 동시 편집 감지 및 충돌 방지를 위한 공용 브로드캐스트 훅
 * - lockVersion(세대/버전) 기반으로 늦은 heartbeat 역전 방지
 * - force_takeover 이벤트로 이전 소유자의 즉각적 편집 해제 및 새 소유자 즉시 진입 보장
 */
export function useCoopCollaboration(
  academyInfoId: string | undefined,
  onCellSave?: (studentId: string, colId: string, value: string) => void,
  onForceTakeoverReceived?: (studentId: string, colId: string, newClientId: string) => void
) {
  const [cooperatingCells, setCooperatingCells] = useState<Record<string, CooperatingCell>>({});
  const [myClientId, setMyClientId] = useState<string>('');

  // 💡 [안정화] 구독 완료된 실시간 웹소켓 채널을 보관할 레퍼런스
  const coopChannelRef = useRef<any>(null);
  const onForceTakeoverReceivedRef = useRef(onForceTakeoverReceived);
  useEffect(() => {
    onForceTakeoverReceivedRef.current = onForceTakeoverReceived;
  }, [onForceTakeoverReceived]);

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

  // 2. 내가 특정 셀을 편집하기 시작하거나 마쳤을 때 이벤트를 발신하는 함수 (lockVersion 포함)
  const sendCoopEvent = useCallback((
    event: 'focus_in' | 'focus_out',
    studentId: string,
    colId: string,
    lockVersion: number = 1
  ) => {
    if (!myClientId || !academyInfoId || !coopChannelRef.current) return;
    const channel = coopChannelRef.current;
    if (event === 'focus_in') {
      channel.send({
        type: 'broadcast',
        event: 'focus_in',
        payload: { clientId: myClientId, studentId, colId, lockVersion, timestamp: Date.now() }
      });
    } else {
      channel.send({
        type: 'broadcast',
        event: 'focus_out',
        payload: { clientId: myClientId, studentId, colId, lockVersion, timestamp: Date.now() }
      });
    }
  }, [myClientId, academyInfoId]);

  // 💡 [추가] 강제 강탈(force_takeover) 브로드캐스트 발신 함수 (비동기 결과 반환)
  const sendForceTakeover = useCallback(async (
    studentId: string,
    colId: string,
    previousClientId: string | undefined,
    newLockVersion: number
  ): Promise<boolean> => {
    if (!myClientId || !academyInfoId || !coopChannelRef.current) return false;
    const channel = coopChannelRef.current;
    try {
      const resp = await channel.send({
        type: 'broadcast',
        event: 'force_takeover',
        payload: {
          studentId,
          colId,
          previousClientId,
          newClientId: myClientId,
          lockVersion: newLockVersion,
          timestamp: Date.now()
        } as ForceTakeoverPayload
      });
      return resp === 'ok' || resp === true || !resp?.error;
    } catch (err) {
      console.error('Failed to broadcast force_takeover:', err);
      return false;
    }
  }, [myClientId, academyInfoId]);

  // 💡 [추가] 내가 특정 셀의 입력을 마치고 저장(onSave)했을 때 이벤트를 발신하는 함수
  const sendSaveEvent = useCallback((studentId: string, colId: string, value: string) => {
    if (!myClientId || !academyInfoId || !coopChannelRef.current) return;
    const channel = coopChannelRef.current;
    channel.send({
      type: 'broadcast',
      event: 'cell_save',
      payload: { studentId, colId, value }
    });
  }, [myClientId, academyInfoId]);

  // 💡 [안정화] onCellSave 콜백의 최신 참조값을 useRef로 관리하여 소켓 채널이 재연결(연결 끊김)되는 루프를 예방합니다.
  const onCellSaveRef = useRef(onCellSave);
  useEffect(() => {
    onCellSaveRef.current = onCellSave;
  }, [onCellSave]);

  // 3. Supabase Broadcast 실시간 협업 채널 바인딩 및 30초 자동 정화 GC 가동
  useEffect(() => {
    if (!myClientId || !academyInfoId) return;

    const coopChannel = supabase.channel(`today_sheet_coop_${academyInfoId}`, {
      config: {
        broadcast: { self: false }
      }
    });

    coopChannelRef.current = coopChannel;

    coopChannel
      .on('broadcast', { event: 'focus_in' }, ({ payload }) => {
        const { clientId, studentId, colId, lockVersion = 1, timestamp = Date.now() } = payload;
        const cellKey = `${studentId}_${colId}`;
        setCooperatingCells(prev => {
          const currentCell = prev[cellKey];
          // 💡 [lockVersion 가드] 기존 락의 lockVersion보다 낮은 이전 소유자의 늦은 heartbeat는 무시
          if (currentCell) {
            const currentVer = currentCell.lockVersion || 1;
            if (lockVersion < currentVer) {
              return prev;
            }
            if (lockVersion === currentVer && currentCell.clientId !== clientId && currentCell.timestamp > timestamp) {
              return prev;
            }
          }

          const next = { ...prev };
          // 이 조교(clientId)가 이전에 걸었던 다른 셀의 락을 실시간으로 정리
          Object.keys(next).forEach(key => {
            if (next[key].clientId === clientId && key !== cellKey) {
              delete next[key];
            }
          });
          next[cellKey] = { colId, clientId, timestamp, lockVersion };
          return next;
        });
      })
      .on('broadcast', { event: 'focus_out' }, ({ payload }) => {
        const { clientId, studentId, colId, lockVersion = 1 } = payload;
        const cellKey = `${studentId}_${colId}`;
        setCooperatingCells(prev => {
          const currentCell = prev[cellKey];
          if (!currentCell) return prev;
          // 💡 [엄격한 가드] 소유자 clientId가 일치하고 lockVersion도 일치할 때만 삭제 (늦은 과거 focus_out이 새 lock 삭제 방지)
          if (currentCell.clientId === clientId && (currentCell.lockVersion || 1) === lockVersion) {
            const next = { ...prev };
            delete next[cellKey];
            return next;
          }
          return prev;
        });
      })
      .on('broadcast', { event: 'force_takeover' }, ({ payload }) => {
        const { studentId, colId, newClientId, lockVersion, timestamp = Date.now() } = payload as ForceTakeoverPayload;
        const cellKey = `${studentId}_${colId}`;

        // 💡 1. 만약 내가 이 셀의 이전 편집자였다면 즉시 편집 해제 알림 트리거
        if (onForceTakeoverReceivedRef.current && newClientId !== myClientId) {
          onForceTakeoverReceivedRef.current(studentId, colId, newClientId);
        }

        // 💡 2. cooperatingCells 상태를 새 소유자 및 lockVersion으로 즉시 갱신
        setCooperatingCells(prev => {
          const next = { ...prev };
          next[cellKey] = {
            colId,
            clientId: newClientId,
            timestamp,
            lockVersion: lockVersion || (prev[cellKey]?.lockVersion ? prev[cellKey].lockVersion + 1 : 2)
          };
          return next;
        });
      })
      .on('broadcast', { event: 'cell_save' }, ({ payload }) => {
        const { studentId, colId, value } = payload;
        if (onCellSaveRef.current) {
          onCellSaveRef.current(studentId, colId, value);
        }
      })
      .subscribe();

    // 비정상 유실 방지 가비지 컬렉터 (30초 초과 시 자동 증발)
    const timer = setInterval(() => {
      setCooperatingCells(prev => {
        const now = Date.now();
        const next: Record<string, CooperatingCell> = {};
        let changed = false;
        Object.keys(prev).forEach(key => {
          if (now - prev[key].timestamp < 30000) {
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
      coopChannelRef.current = null;
      clearInterval(timer);
    };
  }, [myClientId, academyInfoId]);

  return {
    cooperatingCells,
    setCooperatingCells,
    sendCoopEvent,
    sendForceTakeover,
    sendSaveEvent,
    myClientId
  };
}
