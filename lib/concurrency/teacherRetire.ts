import { SupabaseClient } from '@supabase/supabase-js';

export interface RetireTeacherResult {
  success: boolean;
  status?: 'retired' | 'already_retired';
  error_code?: string;
  error?: string;
  assigned_count?: number;
}

/**
 * 💡 교사 퇴사 처리
 * 
 * 원칙:
 * 1. 반드시 DB 레벨 원자적 트랜잭션 및 배타적 행 잠금(ams_retire_teacher RPC)으로만 실행.
 * 2. RPC 부재나 DB 오류 시 비트랜잭션 클라이언트 fallback으로 우회하지 않고 명확한 오류로 즉시 중단.
 */
export async function retireTeacher(
  academyId: string,
  teacherId: string,
  supabase: SupabaseClient
): Promise<RetireTeacherResult> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('ams_retire_teacher', {
    p_academy_id: academyId,
    p_teacher_id: teacherId,
  });

  if (rpcError) {
    console.error('[retireTeacher] RPC ams_retire_teacher execution failed:', rpcError);
    return {
      success: false,
      error_code: 'RPC_EXECUTION_FAILED',
      error: `DB 트랜잭션 프로시저(ams_retire_teacher) 실행 실패: ${rpcError.message}`,
    };
  }

  if (!rpcData || typeof rpcData !== 'object') {
    return {
      success: false,
      error_code: 'INVALID_RPC_RESPONSE',
      error: '프로시저 응답이 올바르지 않습니다.',
    };
  }

  if (rpcData.success) {
    return { success: true, status: rpcData.status };
  }

  return {
    success: false,
    error_code: rpcData.error_code || 'RETIRE_FAILED',
    error: rpcData.message || '교사 퇴사 처리에 실패했습니다.',
    assigned_count: rpcData.assigned_count,
  };
}
