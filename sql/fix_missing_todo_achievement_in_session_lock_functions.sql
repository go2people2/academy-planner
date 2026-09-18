-- ==============================================================================
-- 🔒 AMS Session Lock System Hotfix: Remove Non-Existent todo_achievement Reference
-- ==============================================================================
-- 목적:
--   1. ams_session_logs 테이블에 존재하지 않는 todo_achievement 물리 컬럼 참조를 제거하여
--      학생 제출 및 교사 승인 시 발생하는 `record "v_rec" has no field "todo_achievement"` 에러 해결.
--   2. todo_achievement는 기존처럼 test_result JSON 문자열 내부에서 유지·보존함.
--   3. 불변 스냅샷(submission_snapshot) 및 복원 대상은 4대 학습 본문만 안전하게 유지:
--      - completed_classwork_text
--      - completed_classwork_json
--      - homework_text
--      - homework_json
--
-- 대상 함수 (2종):
--   - public.approve_session_log_guarded(bigint[], uuid)
--   - public.restore_submission_snapshot_guarded(bigint, uuid)
--
-- ※ trg_protect_approved_session_submission 트리거는 운영 DB상 정상 확인되어 본 패치에서 완전히 제외함.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. approve_session_log_guarded (제출 승인 및 불변 스냅샷 생성)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_session_log_guarded(
  p_log_ids bigint[],
  p_academy_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_actor_uid uuid;
  v_teacher_id uuid;
  v_teacher_role text;
  v_rec public.ams_session_logs%ROWTYPE;
  v_snapshot jsonb;
  v_approved_count integer := 0;
  v_skipped_already_approved integer := 0;
  v_skipped_not_submitted integer := 0;
  v_not_found_count integer := 0;
  v_found_count integer := 0;
  v_input_count integer;
BEGIN
  -- 1. 인증 및 권한 검증
  SELECT teacher_id, teacher_role, actor_uid INTO v_teacher_id, v_teacher_role, v_actor_uid
  FROM public.check_teacher_academy_access(p_academy_id);

  v_input_count := array_length(p_log_ids, 1);
  IF v_input_count IS NULL OR v_input_count = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'approved_count', 0,
      'skipped_already_approved_count', 0,
      'skipped_not_submitted_count', 0,
      'not_found_count', 0
    );
  END IF;

  -- 2. 대상 세션 순회 처리
  FOR v_rec IN 
    SELECT * FROM public.ams_session_logs
    WHERE id = ANY(p_log_ids) AND academy_id = p_academy_id
    FOR UPDATE
  LOOP
    v_found_count := v_found_count + 1;

    -- A) 이미 approved인 경우 skip (스냅샷 덮어쓰기 방지)
    IF v_rec.approval_status = 'approved' THEN
      v_skipped_already_approved := v_skipped_already_approved + 1;
      CONTINUE;
    END IF;

    -- B) submitted가 아닌 경우 skip
    IF v_rec.approval_status IS DISTINCT FROM 'submitted' AND v_rec.approval_status IS DISTINCT FROM 'pending' THEN
      v_skipped_not_submitted := v_skipped_not_submitted + 1;
      CONTINUE;
    END IF;

    -- C) submitted 상태인 경우: 최초 1회 불변 스냅샷 생성 및 approved 처리
    --    (보호 대상 4개 학습 본문 필드만 스냅샷에 보존, v_rec.todo_achievement 참조 제거)
    IF v_rec.submission_snapshot IS NOT NULL THEN
      v_snapshot := v_rec.submission_snapshot;
    ELSE
      v_snapshot := jsonb_build_object(
        'completed_classwork_text', v_rec.completed_classwork_text,
        'completed_classwork_json', v_rec.completed_classwork_json,
        'homework_text', v_rec.homework_text,
        'homework_json', v_rec.homework_json,
        'captured_at', now()
      );
    END IF;

    UPDATE public.ams_session_logs SET
      approval_status = 'approved',
      submission_snapshot = v_snapshot,
      approved_at = now(),
      approved_by = v_actor_uid,
      edit_unlocked_by = NULL,
      edit_unlocked_at = NULL,
      version = version + 1,
      updated_at = now()
    WHERE id = v_rec.id;

    v_approved_count := v_approved_count + 1;
  END LOOP;

  v_not_found_count := v_input_count - v_found_count;

  RETURN jsonb_build_object(
    'success', true,
    'approved_count', v_approved_count,
    'skipped_already_approved_count', v_skipped_already_approved,
    'skipped_not_submitted_count', v_skipped_not_submitted,
    'not_found_count', v_not_found_count
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2. restore_submission_snapshot_guarded (제출 원본 복원)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_submission_snapshot_guarded(
  p_log_id bigint,
  p_academy_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_actor_uid uuid;
  v_teacher_id uuid;
  v_teacher_role text;
  v_session public.ams_session_logs%ROWTYPE;
  v_updated public.ams_session_logs%ROWTYPE;
  v_snap jsonb;
BEGIN
  SELECT teacher_id, teacher_role, actor_uid INTO v_teacher_id, v_teacher_role, v_actor_uid
  FROM public.check_teacher_academy_access(p_academy_id);

  SELECT * INTO v_session
  FROM public.ams_session_logs
  WHERE id = p_log_id AND academy_id = p_academy_id
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', '세션 일지를 찾을 수 없습니다.');
  END IF;

  IF v_session.approval_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_APPROVED', 'message', '승인 완료된 세션만 원본을 복원할 수 있습니다.');
  END IF;

  -- 잠금 해제 상태인지 확인
  IF v_session.edit_unlocked_by IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SESSION_LOCKED_APPROVED',
      'message', '세션이 잠겨 있습니다. 원본을 복원하려면 먼저 [잠금 해제]를 진행해 주세요.'
    );
  END IF;

  v_snap := v_session.submission_snapshot;
  IF v_snap IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_SNAPSHOT', 'message', '복원할 수 있는 학생 제출 원본 스냅샷이 없습니다.');
  END IF;

  -- 원본 복원 UPDATE (존재하는 4개 학생 제출 필드만 복원, todo_achievement 물리 컬럼 UPDATE 제거)
  UPDATE public.ams_session_logs SET
    completed_classwork_text = v_snap->>'completed_classwork_text',
    completed_classwork_json = v_snap->'completed_classwork_json',
    homework_text = v_snap->>'homework_text',
    homework_json = v_snap->'homework_json',
    version = version + 1,
    updated_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object('success', true, 'data', row_to_json(v_updated));
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. RPC 함수 실행 권한 설정
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.approve_session_log_guarded(bigint[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_session_log_guarded(bigint[], uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_submission_snapshot_guarded(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_submission_snapshot_guarded(bigint, uuid) TO authenticated;
