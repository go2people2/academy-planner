CREATE OR REPLACE FUNCTION public.trg_protect_approved_session_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_is_protected_changed boolean := false;
BEGIN
  -- 1. 승인(approved) 상태가 아니면 즉시 통과
  IF OLD.approval_status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  -- 2. 이미 잠금 해제 상태(edit_unlocked_by IS NOT NULL)인 경우 수정 허용
  IF OLD.edit_unlocked_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 3. 학생 제출 보호 필드(4종) 변경 여부 대조
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

  -- 4. 승인 상태에서 학생 제출 필드가 변경되었다면 차단
  IF v_is_protected_changed THEN
    RAISE EXCEPTION 'SESSION_LOCKED_APPROVED: 승인 완료된 세션의 학생 제출 내용은 잠겨 있습니다. 수정을 원하시면 먼저 [잠금 해제]를 진행해 주세요. (세션 ID: %)', OLD.id;
  END IF;

  -- 출결, 점수, 메모, 시간 등 교사 운영 필드만 변경된 경우 정상 통과
  RETURN NEW;
END;
$$;
