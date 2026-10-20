import { SupabaseClient } from '@supabase/supabase-js';

export interface DischargeStudentResult {
  success: boolean;
  status?: 'discharged' | 'already_discharged';
  student_id?: string;
  last_teacher_id?: string | null;
  error_code?: string;
  error?: string;
}

/**
 * 💡 학생 퇴원 처리
 * 
 * 원칙:
 * 1. 반드시 DB 레벨 원자적 트랜잭션 및 배타적 행 잠금(ams_discharge_student RPC)으로만 실행.
 * 2. RPC 부재나 DB 오류 시 비트랜잭션 클라이언트 fallback으로 우회하지 않고 명확한 오류로 즉시 중단.
 */
export async function dischargeStudent(
  academyId: string,
  studentId: string,
  reason: string | null | undefined,
  supabase: SupabaseClient
): Promise<DischargeStudentResult> {
  const cleanReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;

  const { data: rpcData, error: rpcError } = await supabase.rpc('ams_discharge_student', {
    p_academy_id: academyId,
    p_student_id: studentId,
    p_reason: cleanReason,
  });

  if (rpcError) {
    console.error('[dischargeStudent] RPC ams_discharge_student execution failed:', rpcError);
    return {
      success: false,
      error_code: 'RPC_EXECUTION_FAILED',
      error: `DB 트랜잭션 프로시저(ams_discharge_student) 실행 실패: ${rpcError.message}`,
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
    return {
      success: true,
      status: rpcData.status,
      student_id: rpcData.student_id,
      last_teacher_id: rpcData.last_teacher_id,
    };
  }

  return {
    success: false,
    error_code: rpcData.error_code || 'DISCHARGE_FAILED',
    error: rpcData.message || '학생 퇴원 처리에 실패했습니다.',
  };
}
