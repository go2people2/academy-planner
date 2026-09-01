import { HomeworkItem, StudentStatus } from './dashboard';

/**
 * 💡 TodaySheet 행(Row) 및 세션 데이터를 1:1로 특정하기 위한 복합 비즈니스 식별자
 */
export interface SessionIdentity {
  academyId: string;           // 테넌트 식별자
  studentId: string;           // 원본 학생 UUID (파생 접미사 제외)
  sessionDate: string;         // YYYY-MM-DD
  courseName: string;          // '정규' 또는 특강 과목명
  isPureMakeup: boolean;       // 순수 보강 여부
  movedToHour: number | null;  // 시간이동/보강 시 대상 교시 (없으면 null)
  sessionId?: string;          // DB PK (유효한 DB ID일 때만 최우선 매칭용으로 활용)
}

/**
 * 💡 저장 작업의 트리거 원인
 */
export type SaveTriggerSource =
  | 'user_input_blur'      // 마우스 포커스 이탈
  | 'user_input_enter'     // Enter 키 확정
  | 'attendance_toggle'    // 출결 상태 순환
  | 'absence_reason'       // 결석 사유 팝오버
  | 'supplement_time'      // 보강/시간이동 선택
  | 'clipboard_paste'      // 붙여넣기
  | 'clipboard_cut'        // 잘라내기
  | 'cell_clear'           // Backspace / Delete 범위 삭제
  | 'fill_down'            // 아래로 채우기
  | 'undo_redo';           // 실행 취소 / 다시 실행

/**
 * 💡 저장 가능한 세션 데이터 필드 (시스템/이력/식별 메타데이터 제외)
 */
export interface SessionPatch {
  status?: StudentStatus;
  attendance_status?: string;
  attendance_reason?: string | null;
  special_notes?: string;
  classwork_text?: string;
  classwork_json?: HomeworkItem[];
  completed_classwork_text?: string;
  completed_classwork_json?: HomeworkItem[];
  homework_text?: string;
  homework_json?: HomeworkItem[];
  hw_checked_today?: boolean;
  hw_passed_today?: boolean;
  next_quiz_text?: string;
  next_quiz_json?: HomeworkItem[];
  next_quiz_cut?: string | number;
  next_quiz_trial?: number;
  test_id?: string;
  test_status?: string;
  test_score?: number | string;
  test_score_type?: 'score' | 'count';
  test_total_count?: number;
  test_result?: string;
  homework_to?: string;
  test_cut?: string | number;
  test_completed?: boolean;
  test_answers?: any;
  management_notes?: string;
  mission?: string;
  todo_achievement?: number;
  approval_status?: string;
  from_moved_to_hour?: number | null;
}

/**
 * 💡 단일 세션 패치 저장 요청 파라미터
 */
export interface SaveSessionPatchRequest {
  identity: SessionIdentity;
  patch: SessionPatch;
  options?: {
    source: SaveTriggerSource;
    skipBlur?: boolean;
    optimisticOnly?: boolean;
  };
}

/**
 * 💡 단일 세션 패치 저장 응답
 */
export interface SaveSessionPatchResult {
  success: boolean;
  savedSessionId?: string;
  error?: any;
}

/**
 * 💡 단일 세션 패치 저장 함수 타입
 */
export type SaveSessionPatchFunction = (
  request: SaveSessionPatchRequest
) => Promise<SaveSessionPatchResult>;
