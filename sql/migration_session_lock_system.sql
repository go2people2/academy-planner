-- ==============================================================================
-- 🔒 AMS Session Lock System & Guarded RPC Migration (최소 안전 모델)
-- ==============================================================================
-- 1. ams_session_logs 컬럼 확장
-- 2. 헬퍼 함수: 교사 학원 소속 검증 (check_teacher_academy_access)
-- 3. 핵심 Guarded RPC 함수:
--    - save_session_log_guarded (일반 저장 및 버전 충돌 검증)
--    - approve_session_log_guarded (제출 승인 및 불변 스냅샷 박제)
--    - unlock_session_for_edit_guarded (임시 잠금 해제)
--    - relock_session_guarded (수정 완료 후 다시 잠금)
--    - restore_submission_snapshot_guarded (제출 원본 복원)
-- 4. DB 레벨 원천 방어: BEFORE UPDATE Trigger (단순 안전 모델)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 컬럼 추가 DDL 및 인덱스
-- ------------------------------------------------------------------------------
ALTER TABLE ams_session_logs 
  ADD COLUMN IF NOT EXISTS submission_snapshot jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS edit_unlocked_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS edit_unlocked_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ams_session_logs_lock_state 
  ON ams_session_logs (academy_id, approval_status, edit_unlocked_by);


-- ------------------------------------------------------------------------------
-- 2. 헬퍼 함수: 현재 호출 교사 소속 검증
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_teacher_academy_access(p_academy_id uuid)
RETURNS TABLE (teacher_id uuid, teacher_role text, actor_uid uuid)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_actor_id uuid;
  v_teacher ams_teachers%ROWTYPE;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: 로그인 인증 정보(auth.uid)가 필요합니다.';
  END IF;

  SELECT * INTO v_teacher
  FROM ams_teachers
  WHERE user_id = v_actor_id
    AND academy_id = p_academy_id
    AND role IN ('teacher', 'admin')
  LIMIT 1;

  IF v_teacher.id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_TEACHER: 해당 학원(%s)에 등록된 교사 또는 관리자 계정이 아닙니다.', p_academy_id;
  END IF;

  RETURN QUERY SELECT v_teacher.id, v_teacher.role, v_actor_id;
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. RPC 1: save_session_log_guarded (일반 저장 및 Optimistic Lock 버전 검증)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION save_session_log_guarded(
  p_session_id bigint,
  p_academy_id uuid,
  p_student_id uuid,
  p_session_date date,
  p_course_name text,
  p_moved_to_hour numeric,
  p_payload jsonb,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_actor_uid uuid;
  v_teacher_id uuid;
  v_teacher_role text;
  v_session ams_session_logs%ROWTYPE;
  v_updated ams_session_logs%ROWTYPE;
  v_target_id bigint := p_session_id;
BEGIN
  -- 1. 인증 및 학원 권한 검증
  SELECT teacher_id, teacher_role, actor_uid INTO v_teacher_id, v_teacher_role, v_actor_uid
  FROM check_teacher_academy_access(p_academy_id);

  -- 2. 대상 세션 조회
  IF v_target_id IS NOT NULL AND v_target_id > 0 THEN
    SELECT * INTO v_session
    FROM ams_session_logs
    WHERE id = v_target_id AND academy_id = p_academy_id
    FOR UPDATE;
  ELSE
    SELECT * INTO v_session
    FROM ams_session_logs
    WHERE student_id = p_student_id
      AND session_date = p_session_date
      AND (course_name = p_course_name OR (p_course_name = '정규' AND (course_name IS NULL OR course_name = '정규')))
      AND (moved_to_hour = p_moved_to_hour OR (p_moved_to_hour IS NULL AND moved_to_hour IS NULL))
      AND academy_id = p_academy_id
    FOR UPDATE;
  END IF;

  -- 3. 기존 세션 UPDATE
  IF v_session.id IS NOT NULL THEN
    -- A) Optimistic Lock (Version 검증)
    IF p_expected_version IS NOT NULL AND v_session.version != p_expected_version THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'VERSION_MISMATCH',
        'message', '다른 선생님이 이 학생의 제출을 승인하거나 수정했습니다. 최신 내용을 불러와 확인해 주세요.',
        'current_version', v_session.version,
        'current_session', row_to_json(v_session)
      );
    END IF;

    -- B) 화이트리스트 필드 업데이트
    UPDATE ams_session_logs SET
      attendance_status = CASE WHEN p_payload ? 'attendance_status' THEN p_payload->>'attendance_status' ELSE attendance_status END,
      attendance_reason = CASE WHEN p_payload ? 'attendance_reason' THEN p_payload->>'attendance_reason' ELSE attendance_reason END,
      classwork_text = CASE WHEN p_payload ? 'classwork_text' THEN p_payload->>'classwork_text' ELSE classwork_text END,
      classwork_json = CASE WHEN p_payload ? 'classwork_json' THEN p_payload->'classwork_json' ELSE classwork_json END,
      completed_classwork_text = CASE WHEN p_payload ? 'completed_classwork_text' THEN p_payload->>'completed_classwork_text' ELSE completed_classwork_text END,
      completed_classwork_json = CASE WHEN p_payload ? 'completed_classwork_json' THEN p_payload->'completed_classwork_json' ELSE completed_classwork_json END,
      homework_text = CASE WHEN p_payload ? 'homework_text' THEN p_payload->>'homework_text' ELSE homework_text END,
      homework_json = CASE WHEN p_payload ? 'homework_json' THEN p_payload->'homework_json' ELSE homework_json END,
      next_quiz_text = CASE WHEN p_payload ? 'next_quiz_text' THEN p_payload->>'next_quiz_text' ELSE next_quiz_text END,
      next_quiz_json = CASE WHEN p_payload ? 'next_quiz_json' THEN p_payload->'next_quiz_json' ELSE next_quiz_json END,
      next_quiz_cut = CASE WHEN p_payload ? 'next_quiz_cut' THEN p_payload->>'next_quiz_cut' ELSE next_quiz_cut END,
      next_quiz_trial = CASE WHEN p_payload ? 'next_quiz_trial' THEN (p_payload->>'next_quiz_trial')::numeric ELSE next_quiz_trial END,
      test_id = CASE WHEN p_payload ? 'test_id' THEN p_payload->>'test_id' WHEN p_payload ? 'test_status' THEN p_payload->>'test_status' ELSE test_id END,
      test_score = CASE WHEN p_payload ? 'test_score' THEN (p_payload->>'test_score')::numeric ELSE test_score END,
      test_score_type = CASE WHEN p_payload ? 'test_score_type' THEN p_payload->>'test_score_type' ELSE test_score_type END,
      test_total_count = CASE WHEN p_payload ? 'test_total_count' THEN (p_payload->>'test_total_count')::numeric ELSE test_total_count END,
      test_result = CASE WHEN p_payload ? 'test_result' THEN p_payload->>'test_result' ELSE test_result END,
      test_cut = CASE WHEN p_payload ? 'test_cut' THEN p_payload->>'test_cut' ELSE test_cut END,
      test_completed = CASE WHEN p_payload ? 'test_completed' THEN (p_payload->>'test_completed')::boolean ELSE test_completed END,
      homework_to = CASE WHEN p_payload ? 'homework_to' THEN p_payload->>'homework_to' ELSE homework_to END,
      special_notes = CASE WHEN p_payload ? 'special_notes' THEN p_payload->>'special_notes' ELSE special_notes END,
      management_notes = CASE WHEN p_payload ? 'management_notes' THEN p_payload->>'management_notes' ELSE management_notes END,
      mission = CASE WHEN p_payload ? 'mission' THEN p_payload->>'mission' ELSE mission END,
      todo_achievement = CASE WHEN p_payload ? 'todo_achievement' THEN (p_payload->>'todo_achievement')::numeric ELSE todo_achievement END,
      hw_checked_today = CASE WHEN p_payload ? 'hw_checked_today' THEN (p_payload->>'hw_checked_today')::boolean ELSE hw_checked_today END,
      hw_passed_today = CASE WHEN p_payload ? 'hw_passed_today' THEN (p_payload->>'hw_passed_today')::boolean ELSE hw_passed_today END,
      moved_to_hour = CASE WHEN p_payload ? 'moved_to_hour' THEN (p_payload->>'moved_to_hour')::numeric ELSE moved_to_hour END,
      from_moved_to_hour = CASE WHEN p_payload ? 'from_moved_to_hour' THEN (p_payload->>'from_moved_to_hour')::numeric ELSE from_moved_to_hour END,
      is_pure_makeup = CASE WHEN p_payload ? 'is_pure_makeup' THEN (p_payload->>'is_pure_makeup')::boolean ELSE is_pure_makeup END,
      timer_started_at = CASE WHEN p_payload ? 'timer_started_at' THEN (p_payload->>'timer_started_at')::bigint ELSE timer_started_at END,
      timer_duration = CASE WHEN p_payload ? 'timer_duration' THEN (p_payload->>'timer_duration')::numeric ELSE timer_duration END,
      session_snapshot = CASE WHEN p_payload ? 'session_snapshot' THEN p_payload->'session_snapshot' ELSE session_snapshot END,
      version = v_session.version + 1,
      updated_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_updated;

    RETURN jsonb_build_object('success', true, 'data', row_to_json(v_updated));
  ELSE
    -- 4. 신규 세션 INSERT
    INSERT INTO ams_session_logs (
      academy_id, student_id, session_date, course_name, moved_to_hour,
      attendance_status, attendance_reason, classwork_text, classwork_json,
      completed_classwork_text, completed_classwork_json, homework_text, homework_json,
      special_notes, management_notes, mission, todo_achievement,
      test_id, test_score, test_cut, test_result, homework_to,
      session_snapshot, version, updated_at
    ) VALUES (
      p_academy_id, p_student_id, p_session_date, COALESCE(p_course_name, '정규'), p_moved_to_hour,
      p_payload->>'attendance_status', p_payload->>'attendance_reason', p_payload->>'classwork_text', p_payload->'classwork_json',
      p_payload->>'completed_classwork_text', p_payload->'completed_classwork_json', p_payload->>'homework_text', p_payload->'homework_json',
      p_payload->>'special_notes', p_payload->>'management_notes', p_payload->>'mission', (p_payload->>'todo_achievement')::numeric,
      COALESCE(p_payload->>'test_id', p_payload->>'test_status'), (p_payload->>'test_score')::numeric, p_payload->>'test_cut', p_payload->>'test_result', p_payload->>'homework_to',
      p_payload->'session_snapshot', 1, now()
    )
    RETURNING * INTO v_updated;

    RETURN jsonb_build_object('success', true, 'data', row_to_json(v_updated));
  END IF;
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. RPC 2: approve_session_log_guarded (제출 승인 및 불변 스냅샷 박제)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_session_log_guarded(
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
  v_rec ams_session_logs%ROWTYPE;
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
  FROM check_teacher_academy_access(p_academy_id);

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
    SELECT * FROM ams_session_logs
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
    IF v_rec.submission_snapshot IS NOT NULL THEN
      v_snapshot := v_rec.submission_snapshot;
    ELSE
      v_snapshot := jsonb_build_object(
        'completed_classwork_text', v_rec.completed_classwork_text,
        'completed_classwork_json', v_rec.completed_classwork_json,
        'homework_text', v_rec.homework_text,
        'homework_json', v_rec.homework_json,
        'todo_achievement', v_rec.todo_achievement,
        'captured_at', now()
      );
    END IF;

    UPDATE ams_session_logs SET
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
-- 5. RPC 3: unlock_session_for_edit_guarded (임시 잠금 해제)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION unlock_session_for_edit_guarded(
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
  v_session ams_session_logs%ROWTYPE;
  v_updated ams_session_logs%ROWTYPE;
BEGIN
  SELECT teacher_id, teacher_role, actor_uid INTO v_teacher_id, v_teacher_role, v_actor_uid
  FROM check_teacher_academy_access(p_academy_id);

  SELECT * INTO v_session
  FROM ams_session_logs
  WHERE id = p_log_id AND academy_id = p_academy_id
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', '세션 일지를 찾을 수 없습니다.');
  END IF;

  IF v_session.approval_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_APPROVED', 'message', '승인 완료된 세션만 잠금 해제할 수 있습니다.');
  END IF;

  -- 이미 잠금 해제된 세션이면 DB 값을 다시 덮어쓰지 않고 현재 세션 반환 (버전/시각 보존)
  IF v_session.edit_unlocked_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'data', row_to_json(v_session),
      'message', '이미 잠금 해제되어 있는 세션입니다.'
    );
  END IF;

  -- 잠금 해제 플래그 설정
  UPDATE ams_session_logs SET
    edit_unlocked_by = v_actor_uid,
    edit_unlocked_at = now(),
    version = version + 1,
    updated_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object('success', true, 'data', row_to_json(v_updated));
END;
$$;


-- ------------------------------------------------------------------------------
-- 6. RPC 4: relock_session_guarded (수정 완료 후 다시 잠금)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION relock_session_guarded(
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
  v_session ams_session_logs%ROWTYPE;
  v_updated ams_session_logs%ROWTYPE;
BEGIN
  SELECT teacher_id, teacher_role, actor_uid INTO v_teacher_id, v_teacher_role, v_actor_uid
  FROM check_teacher_academy_access(p_academy_id);

  SELECT * INTO v_session
  FROM ams_session_logs
  WHERE id = p_log_id AND academy_id = p_academy_id
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', '세션 일지를 찾을 수 없습니다.');
  END IF;

  -- 1. approval_status = 'approved' 검증
  IF v_session.approval_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_APPROVED', 'message', '승인 완료된 세션만 다시 잠글 수 있습니다.');
  END IF;

  -- 2. edit_unlocked_by IS NOT NULL 검증
  IF v_session.edit_unlocked_by IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_LOCKED',
      'message', '이미 잠겨 있는 세션입니다.',
      'current_session', row_to_json(v_session)
    );
  END IF;

  -- 두 조건이 모두 맞을 때만 다시 잠금
  UPDATE ams_session_logs SET
    edit_unlocked_by = NULL,
    edit_unlocked_at = NULL,
    version = version + 1,
    updated_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object('success', true, 'data', row_to_json(v_updated));
END;
$$;


-- ------------------------------------------------------------------------------
-- 7. RPC 5: restore_submission_snapshot_guarded (제출 원본 복원)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION restore_submission_snapshot_guarded(
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
  v_session ams_session_logs%ROWTYPE;
  v_updated ams_session_logs%ROWTYPE;
  v_snap jsonb;
BEGIN
  SELECT teacher_id, teacher_role, actor_uid INTO v_teacher_id, v_teacher_role, v_actor_uid
  FROM check_teacher_academy_access(p_academy_id);

  SELECT * INTO v_session
  FROM ams_session_logs
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

  -- 원본 복원 UPDATE
  UPDATE ams_session_logs SET
    completed_classwork_text = v_snap->>'completed_classwork_text',
    completed_classwork_json = v_snap->'completed_classwork_json',
    homework_text = v_snap->>'homework_text',
    homework_json = v_snap->'homework_json',
    todo_achievement = (v_snap->>'todo_achievement')::numeric,
    version = version + 1,
    updated_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object('success', true, 'data', row_to_json(v_updated));
END;
$$;


-- ------------------------------------------------------------------------------
-- 8. 🛡️ DB 레벨 원천 방어: BEFORE UPDATE Trigger (최소 안전 규칙)
-- ------------------------------------------------------------------------------
-- 규칙:
-- OLD.approval_status = 'approved'
-- AND OLD.edit_unlocked_by IS NULL
-- AND 학생 제출 보호 필드(5종)가 변경됨
-- → 저장 거부 (RAISE EXCEPTION)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_protect_approved_session_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_is_protected_changed boolean := false;
BEGIN
  -- 1. 승인 상태가 아니면 즉시 통과
  IF OLD.approval_status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  -- 2. 이미 잠금 해제 상태(edit_unlocked_by IS NOT NULL)인 경우 수정 허용
  IF OLD.edit_unlocked_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 3. 학생 제출 보호 필드(5종) 변경 여부 대조
  IF NEW.completed_classwork_text IS DISTINCT FROM OLD.completed_classwork_text THEN
    v_is_protected_changed := true;
  END IF;
  IF NEW.completed_classwork_json IS DISTINCT FROM OLD.completed_classwork_json THEN
    v_is_protected_changed := true;
  END IF;
  IF NEW.homework_text IS DISTINCT FROM OLD.homework_text THEN
    v_is_protected_changed := true;
  END IF;
  IF NEW.homework_json IS DISTINCT FROM OLD.homework_json THEN
    v_is_protected_changed := true;
  END IF;
  IF NEW.todo_achievement IS DISTINCT FROM OLD.todo_achievement THEN
    v_is_protected_changed := true;
  END IF;

  -- 4. 보호 필드가 변경되었다면 저장 거부
  IF v_is_protected_changed THEN
    RAISE EXCEPTION 'SESSION_LOCKED_APPROVED: 승인 완료된 세션의 학생 제출 내용은 잠겨 있습니다. 수정을 원하시면 먼저 [잠금 해제]를 진행해 주세요. (세션 ID: %)', OLD.id;
  END IF;

  -- 출결, 특이사항, 관리메모, 시험 등 교사 운영 필드만 변경된 경우 정상 통과
  RETURN NEW;
END;
$$;

-- 트리거 바인딩
DROP TRIGGER IF EXISTS trg_ams_session_logs_lock_guard ON ams_session_logs;
CREATE TRIGGER trg_ams_session_logs_lock_guard
  BEFORE UPDATE ON ams_session_logs
  FOR EACH ROW
  EXECUTE FUNCTION trg_protect_approved_session_submission();


-- ------------------------------------------------------------------------------
-- 9. 권한 제어 (RPC 함수 실행 권한)
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION save_session_log_guarded(bigint, uuid, uuid, date, text, numeric, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION approve_session_log_guarded(bigint[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION unlock_session_for_edit_guarded(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION relock_session_guarded(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION restore_submission_snapshot_guarded(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_teacher_academy_access(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION save_session_log_guarded(bigint, uuid, uuid, date, text, numeric, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_session_log_guarded(bigint[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_session_for_edit_guarded(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION relock_session_guarded(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_submission_snapshot_guarded(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_teacher_academy_access(uuid) TO authenticated;
