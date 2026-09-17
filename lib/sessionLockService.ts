import { supabase } from '@/lib/supabase';
import { SessionLog } from '@/types/dashboard';

/**
 * 🔒 학생 제출 보호 필드 목록 (approval_status = 'approved' 시 잠금 대상)
 */
export const SUBMISSION_PROTECTED_FIELDS = [
  'completed_classwork_text',
  'completed_classwork_json',
  'homework_text',
  'homework_json',
  'todo_achievement'
] as const;

export const SUBMISSION_PROTECTED_COLUMNS = [
  'completed_classwork',
  'assign'
] as const;

/**
 * 💡 컬럼 ID 또는 DB 필드명이 학생 제출 보호 대상인지 확인
 */
export function isProtectedSubmissionField(key: string): boolean {
  return (
    (SUBMISSION_PROTECTED_FIELDS as readonly string[]).includes(key) ||
    (SUBMISSION_PROTECTED_COLUMNS as readonly string[]).includes(key)
  );
}

/**
 * 💡 세션이 현재 사용자에게 잠금(수정 불가) 상태인지 판정
 * - approval_status !== 'approved' 이면 잠금 아님 (편집 가능)
 * - approval_status === 'approved' 이면 기본 잠금
 * - 단, edit_unlocked_by === currentAuthUid 이면 잠금 해제 상태 (해당 사용자만 편집 가능)
 */
export function isSessionApprovedAndLocked(
  session: Partial<SessionLog> | null | undefined,
  currentAuthUid: string | null | undefined
): boolean {
  if (!session) return false;
  if (session.approval_status !== 'approved') return false;
  if (currentAuthUid && session.edit_unlocked_by === currentAuthUid) {
    return false; // 내가 잠금 해제한 상태 -> 편집 가능
  }
  return true; // 잠금 상태
}

/**
 * 💡 현재 로그인한 Supabase Auth User ID (auth.uid) 안전 조회
 */
export async function getCurrentAuthUid(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

export interface GuardedSaveResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  current_version?: number;
  current_session?: any;
}

/**
 * 1. 일반 저장 Guarded RPC 호출
 */
export async function callSaveSessionLogGuarded(params: {
  sessionId?: number | string | null;
  academyId: string;
  studentId: string;
  sessionDate: string;
  courseName: string;
  movedToHour: number | null;
  payload: Record<string, any>;
  expectedVersion?: number | null;
}): Promise<GuardedSaveResult> {
  try {
    const rawId = params.sessionId ? parseInt(String(params.sessionId), 10) : null;
    const validSessionId = rawId && !isNaN(rawId) && rawId > 0 ? rawId : null;

    const { data, error } = await supabase.rpc('save_session_log_guarded', {
      p_session_id: validSessionId,
      p_academy_id: params.academyId,
      p_student_id: params.studentId,
      p_session_date: params.sessionDate,
      p_course_name: params.courseName || '정규',
      p_moved_to_hour: params.movedToHour,
      p_payload: params.payload,
      p_expected_version: params.expectedVersion ?? null
    });

    if (error) {
      // 🔒 [보안 강화] RPC 미설치 시 direct update/insert fallback을 전면 차단 (Fail-Closed)
      if (error.code === 'PGRST202' || error.message?.includes('save_session_log_guarded')) {
        return {
          success: false,
          error: 'RPC_NOT_INSTALLED',
          message: '잠금 기능의 DB 설정이 완료되지 않아 저장할 수 없습니다. 관리자에게 문의해 주세요.'
        };
      }
      return {
        success: false,
        error: error.code || 'RPC_ERROR',
        message: error.message || '저장 중 오류가 발생했습니다.'
      };
    }

    return data as GuardedSaveResult;
  } catch (err: any) {
    console.error('Guarded save error:', err);
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: err.message || '네트워크 오류가 발생했습니다.'
    };
  }
}

/**
 * 2. 제출 승인 Guarded RPC 호출
 */
export async function callApproveSessionLogGuarded(
  logIds: (number | string)[],
  academyId: string
): Promise<{ success: boolean; error?: string; message?: string; approved_count?: number; skipped_already_approved_count?: number; skipped_not_submitted_count?: number; not_found_count?: number }> {
  try {
    const validLogIds = logIds.map(id => parseInt(String(id), 10)).filter(id => !isNaN(id) && id > 0);
    if (validLogIds.length === 0) return { success: true, approved_count: 0 };

    const { data, error } = await supabase.rpc('approve_session_log_guarded', {
      p_log_ids: validLogIds,
      p_academy_id: academyId
    });

    if (error) {
      if (error.code === 'PGRST202' || error.message?.includes('approve_session_log_guarded')) {
        return {
          success: false,
          error: 'RPC_NOT_INSTALLED',
          message: '잠금 기능의 DB 설정이 완료되지 않아 승인할 수 없습니다. 관리자에게 문의해 주세요.'
        };
      }
      return { success: false, error: error.code, message: error.message };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: 'EXCEPTION', message: err.message };
  }
}

/**
 * 3. 잠금 해제 Guarded RPC 호출
 */
export async function callUnlockSessionForEditGuarded(
  logId: number | string,
  academyId: string
): Promise<GuardedSaveResult> {
  try {
    const validId = parseInt(String(logId), 10);
    if (isNaN(validId)) return { success: false, error: 'INVALID_ID' };

    const { data, error } = await supabase.rpc('unlock_session_for_edit_guarded', {
      p_log_id: validId,
      p_academy_id: academyId
    });

    if (error) {
      const msg = (error.code === 'PGRST202' || error.message?.includes('unlock_session_for_edit_guarded'))
        ? '잠금 기능의 DB 설정이 완료되지 않아 잠금 해제할 수 없습니다. 관리자에게 문의해 주세요.'
        : error.message;
      return { success: false, error: error.code, message: msg };
    }

    return data as GuardedSaveResult;
  } catch (err: any) {
    return { success: false, error: 'EXCEPTION', message: err.message };
  }
}

/**
 * 4. 수정 완료 후 다시 잠금 Guarded RPC 호출
 */
export async function callRelockSessionGuarded(
  logId: number | string,
  academyId: string
): Promise<GuardedSaveResult> {
  try {
    const validId = parseInt(String(logId), 10);
    if (isNaN(validId)) return { success: false, error: 'INVALID_ID' };

    const { data, error } = await supabase.rpc('relock_session_guarded', {
      p_log_id: validId,
      p_academy_id: academyId
    });

    if (error) {
      const msg = (error.code === 'PGRST202' || error.message?.includes('relock_session_guarded'))
        ? '잠금 기능의 DB 설정이 완료되지 않아 다시 잠글 수 없습니다. 관리자에게 문의해 주세요.'
        : error.message;
      return { success: false, error: error.code, message: msg };
    }

    return data as GuardedSaveResult;
  } catch (err: any) {
    return { success: false, error: 'EXCEPTION', message: err.message };
  }
}

/**
 * 5. 학생 제출 원본 복원 Guarded RPC 호출
 */
export async function callRestoreSubmissionSnapshotGuarded(
  logId: number | string,
  academyId: string
): Promise<GuardedSaveResult> {
  try {
    const validId = parseInt(String(logId), 10);
    if (isNaN(validId)) return { success: false, error: 'INVALID_ID' };

    const { data, error } = await supabase.rpc('restore_submission_snapshot_guarded', {
      p_log_id: validId,
      p_academy_id: academyId
    });

    if (error) {
      const msg = (error.code === 'PGRST202' || error.message?.includes('restore_submission_snapshot_guarded'))
        ? '잠금 기능의 DB 설정이 완료되지 않아 원본을 복원할 수 없습니다. 관리자에게 문의해 주세요.'
        : error.message;
      return { success: false, error: error.code, message: msg };
    }

    return data as GuardedSaveResult;
  } catch (err: any) {
    return { success: false, error: 'EXCEPTION', message: err.message };
  }
}
