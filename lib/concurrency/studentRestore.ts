import { SupabaseClient } from '@supabase/supabase-js';

export interface RestoreStudentResult {
  success: boolean;
  status?: 'restored' | 'already_active';
  student_id?: string;
  teacher_id?: string | null;
  teacher_assignment_status?:
    | 'RESTORED_PREVIOUS'
    | 'ASSIGNED_SPECIFIED'
    | 'UNASSIGNED_PREVIOUS_TEACHER_INACTIVE'
    | 'UNASSIGNED_NO_PREVIOUS_TEACHER'
    | 'MAINTAINED_EXISTING';
  message?: string;
  error_code?: string;
  error?: string;
}

/**
 * 💡 학생 재원 복귀(Restore) 처리
 * 
 * 원칙:
 * 1. 반드시 DB 레벨 원자적 프로시저(ams_restore_student)로만 실행합니다.
 * 2. RPC 미적용 또는 부재 시 비트랜잭션 클라이언트 쿼리로 학생 상태를 임의 변경하지 않으며,
 *    즉시 503 RESTORE_NOT_READY 오류로 안전하게 중단합니다.
 */
export async function restoreStudent(
  academyId: string,
  studentId: string,
  specifiedTeacherId: string | null | undefined,
  supabase: SupabaseClient
): Promise<RestoreStudentResult> {
  const cleanSpecifiedTeacherId =
    typeof specifiedTeacherId === 'string' && specifiedTeacherId.trim()
      ? specifiedTeacherId.trim()
      : null;

  // 원자적 RPC 호출
  const { data: rpcData, error: rpcError } = await supabase.rpc('ams_restore_student', {
    p_academy_id: academyId,
    p_student_id: studentId,
    p_specified_teacher_id: cleanSpecifiedTeacherId,
  });

  // RPC 실행 오류 또는 함수 미존재 시: 학생 상태 변경 없이 즉시 RESTORE_NOT_READY 반환
  if (rpcError) {
    console.error('[restoreStudent] RPC ams_restore_student execution failed:', rpcError);
    return {
      success: false,
      error_code: 'RESTORE_NOT_READY',
      error: '학생 복귀용 데이터베이스 프로시저(ams_restore_student)가 준비되지 않았거나 실행에 실패했습니다. (운영 DB RPC 마이그레이션 확인 필요)',
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
      teacher_id: rpcData.teacher_id,
      teacher_assignment_status: rpcData.teacher_assignment_status,
      message: rpcData.message,
    };
  }

  return {
    success: false,
    error_code: rpcData.error_code || 'RESTORE_FAILED',
    error: rpcData.error || rpcData.message || '학생 복귀 처리에 실패했습니다.',
  };
}
