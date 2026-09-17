CREATE OR REPLACE FUNCTION public.save_session_log_guarded(
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
  v_session public.ams_session_logs%ROWTYPE;
  v_updated public.ams_session_logs%ROWTYPE;
  v_target_id bigint := p_session_id;
BEGIN
  SELECT teacher_id, teacher_role, actor_uid INTO v_teacher_id, v_teacher_role, v_actor_uid
  FROM public.check_teacher_academy_access(p_academy_id);

  IF v_target_id IS NOT NULL AND v_target_id > 0 THEN
    SELECT * INTO v_session
    FROM public.ams_session_logs
    WHERE id = v_target_id AND academy_id = p_academy_id
    FOR UPDATE;
  ELSE
    SELECT * INTO v_session
    FROM public.ams_session_logs
    WHERE student_id = p_student_id
      AND session_date = p_session_date
      AND (course_name = p_course_name OR (p_course_name = '정규' AND (course_name IS NULL OR course_name = '정규')))
      AND (moved_to_hour = p_moved_to_hour OR (p_moved_to_hour IS NULL AND moved_to_hour IS NULL))
      AND academy_id = p_academy_id
    FOR UPDATE;
  END IF;

  IF v_session.id IS NOT NULL THEN
    IF p_expected_version IS NOT NULL AND v_session.version != p_expected_version THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'VERSION_MISMATCH',
        'message', '다른 선생님이 이 학생의 제출을 승인하거나 수정했습니다. 최신 내용을 불러와 확인해 주세요.',
        'current_version', v_session.version,
        'current_session', row_to_json(v_session)
      );
    END IF;

    UPDATE public.ams_session_logs SET
      attendance_status = CASE
        WHEN p_payload ? 'attendance_status' THEN p_payload->>'attendance_status'
        ELSE attendance_status
      END,
      attendance_reason = CASE
        WHEN p_payload ? 'attendance_reason' THEN p_payload->>'attendance_reason'
        ELSE attendance_reason
      END,
      classwork_text = CASE
        WHEN p_payload ? 'classwork_text' THEN p_payload->>'classwork_text'
        ELSE classwork_text
      END,
      classwork_json = CASE
        WHEN p_payload ? 'classwork_json' THEN p_payload->'classwork_json'
        ELSE classwork_json
      END,
      completed_classwork_text = CASE
        WHEN p_payload ? 'completed_classwork_text' THEN p_payload->>'completed_classwork_text'
        ELSE completed_classwork_text
      END,
      completed_classwork_json = CASE
        WHEN p_payload ? 'completed_classwork_json' THEN p_payload->'completed_classwork_json'
        ELSE completed_classwork_json
      END,
      homework_text = CASE
        WHEN p_payload ? 'homework_text' THEN p_payload->>'homework_text'
        ELSE homework_text
      END,
      homework_json = CASE
        WHEN p_payload ? 'homework_json' THEN p_payload->'homework_json'
        ELSE homework_json
      END,
      homework_to = CASE
        WHEN p_payload ? 'homework_to' THEN p_payload->>'homework_to'
        ELSE homework_to
      END,
      special_notes = CASE
        WHEN p_payload ? 'special_notes' THEN p_payload->>'special_notes'
        ELSE special_notes
      END,
      management_notes = CASE
        WHEN p_payload ? 'management_notes' THEN p_payload->>'management_notes'
        ELSE management_notes
      END,
      test_status = CASE
        WHEN p_payload ? 'test_status' THEN p_payload->>'test_status'
        WHEN p_payload ? 'test_id' THEN p_payload->>'test_id'
        ELSE test_status
      END,
      test_score = CASE
        WHEN p_payload ? 'test_score' THEN (p_payload->>'test_score')::numeric
        ELSE test_score
      END,
      test_result = CASE
        WHEN p_payload ? 'test_result' THEN p_payload->>'test_result'
        ELSE test_result
      END,
      moved_to_hour = CASE
        WHEN p_payload ? 'moved_to_hour' THEN (p_payload->>'moved_to_hour')::numeric
        ELSE moved_to_hour
      END,
      is_pure_makeup = CASE
        WHEN p_payload ? 'is_pure_makeup' THEN (p_payload->>'is_pure_makeup')::boolean
        ELSE is_pure_makeup
      END,
      timer_started_at = CASE
        WHEN p_payload ? 'timer_started_at' THEN (p_payload->>'timer_started_at')::bigint
        ELSE timer_started_at
      END,
      timer_duration = CASE
        WHEN p_payload ? 'timer_duration' THEN (p_payload->>'timer_duration')::numeric
        ELSE timer_duration
      END,
      session_snapshot = CASE
        WHEN p_payload ? 'session_snapshot' THEN p_payload->'session_snapshot'
        ELSE session_snapshot
      END,
      version = v_session.version + 1,
      updated_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_updated;

    RETURN jsonb_build_object('success', true, 'data', row_to_json(v_updated));
  ELSE
    INSERT INTO public.ams_session_logs (
      academy_id,
      student_id,
      session_date,
      course_name,
      moved_to_hour,
      is_pure_makeup,
      attendance_status,
      attendance_reason,
      classwork_text,
      classwork_json,
      completed_classwork_text,
      completed_classwork_json,
      homework_text,
      homework_json,
      homework_to,
      special_notes,
      management_notes,
      test_status,
      test_score,
      test_result,
      session_snapshot,
      version,
      updated_at
    ) VALUES (
      p_academy_id,
      p_student_id,
      p_session_date,
      COALESCE(p_course_name, '정규'),
      COALESCE(p_moved_to_hour, (p_payload->>'moved_to_hour')::numeric),
      COALESCE((p_payload->>'is_pure_makeup')::boolean, false),
      p_payload->>'attendance_status',
      p_payload->>'attendance_reason',
      p_payload->>'classwork_text',
      p_payload->'classwork_json',
      p_payload->>'completed_classwork_text',
      p_payload->'completed_classwork_json',
      p_payload->>'homework_text',
      p_payload->'homework_json',
      p_payload->>'homework_to',
      p_payload->>'special_notes',
      p_payload->>'management_notes',
      COALESCE(p_payload->>'test_status', p_payload->>'test_id'),
      (p_payload->>'test_score')::numeric,
      p_payload->>'test_result',
      p_payload->'session_snapshot',
      1,
      now()
    )
    RETURNING * INTO v_updated;

    RETURN jsonb_build_object('success', true, 'data', row_to_json(v_updated));
  END IF;
END;
$$;
