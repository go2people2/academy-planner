-- ==============================================================================
-- 20261021_direct_access_protection_triggers.sql
-- 퇴사 교사 및 퇴원 학생의 Supabase 클라이언트 직접 접근(Bypass) 및 권한 필드 변조 차단
--
-- 적용 대상: Supabase SQL Editor
-- 선행 조건: docs/migrations/20261021_retire_discharge_policies.sql 적용 완료 후 실행
-- ==============================================================================

BEGIN;

-- 1. 교사 테이블 직접 UPDATE 방어 트리거
--    (클라이언트 anon/authenticated 권한의 퇴사자 수정 및 권한/학원/보안 필드 조작 차단)
CREATE OR REPLACE FUNCTION public.ams_protect_teacher_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 클라이언트 직접 호출(anon 또는 authenticated) 감지
  IF current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated') 
     OR (current_user IN ('anon', 'authenticated') AND current_setting('request.jwt.claim.role', true) IS NULL) THEN
    
    -- 1) 이미 퇴사한 교사는 본인 정보 포함 일체 직접 수정 불가
    IF OLD.is_deleted = true THEN
      RAISE EXCEPTION 'RETIRED_TEACHER_UPDATE_FORBIDDEN'
        USING DETAIL = '퇴사 처리된 교사 데이터는 직접 수정할 수 없습니다.';
    END IF;

    -- 2) 보안/권한 핵심 필드(is_deleted, retired_at, role, academy_id, user_id) 임의 변조 금지
    IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted
       OR NEW.retired_at IS DISTINCT FROM OLD.retired_at
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.academy_id IS DISTINCT FROM OLD.academy_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'TEACHER_SECURITY_FIELDS_UPDATE_FORBIDDEN'
        USING DETAIL = '보안 및 권한 필드(is_deleted, role, academy_id 등)는 직접 수정할 수 없습니다.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ams_protect_teacher_security_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ams_protect_teacher_security_fields() TO service_role;

DROP TRIGGER IF EXISTS trg_ams_protect_teacher_security_fields ON public.ams_teachers;
CREATE TRIGGER trg_ams_protect_teacher_security_fields
BEFORE UPDATE ON public.ams_teachers
FOR EACH ROW
EXECUTE FUNCTION public.ams_protect_teacher_security_fields();


-- 2. 학생 테이블 직접 UPDATE 방어 트리거
--    (클라이언트 anon/authenticated 권한의 퇴원 상태 및 직전 교사 임의 변조 차단)
CREATE OR REPLACE FUNCTION public.ams_protect_student_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 클라이언트 직접 호출(anon 또는 authenticated) 감지
  IF current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated') 
     OR (current_user IN ('anon', 'authenticated') AND current_setting('request.jwt.claim.role', true) IS NULL) THEN
    
    -- 퇴원 상태(is_deleted) 및 직전 교사(last_teacher_id) 직접 변조 금지
    -- (퇴원은 반드시 ams_discharge_student RPC를 통해서만 수행)
    IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted
       OR NEW.last_teacher_id IS DISTINCT FROM OLD.last_teacher_id THEN
      RAISE EXCEPTION 'STUDENT_SECURITY_FIELDS_UPDATE_FORBIDDEN'
        USING DETAIL = '퇴원 상태 및 직전 교사 정보는 전용 절차를 통해서만 변경할 수 있습니다.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ams_protect_student_security_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ams_protect_student_security_fields() TO service_role;

DROP TRIGGER IF EXISTS trg_ams_protect_student_security_fields ON public.ams_students;
CREATE TRIGGER trg_ams_protect_student_security_fields
BEFORE UPDATE ON public.ams_students
FOR EACH ROW
EXECUTE FUNCTION public.ams_protect_student_security_fields();


-- 3. 위험 직접 작업 권한 회수 (DELETE 및 교사 임의 INSERT 차단)
REVOKE DELETE ON public.ams_teachers FROM anon, authenticated;
REVOKE DELETE ON public.ams_students FROM anon, authenticated;

COMMIT;
