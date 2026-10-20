-- ==============================================================================
-- 20261021_rollback_retire_discharge.sql
-- 20261021 마이그레이션 실패 시 안전한 원상 복구 스크립트
--
-- 적용 대상: Supabase SQL Editor
-- 선행 조건: 운영 배포 코드 롤백 완료 후 실행
-- ==============================================================================

BEGIN;

-- 1. 신규 트리거 제거
DROP TRIGGER IF EXISTS trg_ams_check_student_teacher_assignment ON public.ams_students;

-- 2. 신규 함수 제거
DROP FUNCTION IF EXISTS public.ams_check_student_teacher_assignment();
DROP FUNCTION IF EXISTS public.ams_discharge_student(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.ams_retire_teacher(UUID, UUID);

-- 3. check_teacher_academy_access 함수를 원래 운영 상태로 복원
--    (20261021 이전 migration_session_lock_system.sql 정의 100% 동일 복원)
CREATE OR REPLACE FUNCTION public.check_teacher_academy_access(p_academy_id uuid)
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

COMMIT;

-- 참고: ams_teachers.is_deleted, ams_teachers.retired_at, ams_students.last_teacher_id 컬럼은
-- 데이터를 보존하기 위해 의도적으로 DROP하지 않습니다. (기존 쿼리에 무해함)
