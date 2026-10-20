-- ==============================================================================
-- 20261021_retire_discharge_policies.sql
-- 퇴원 및 교사 퇴사 정책 관련 스키마 확장, 동시성 제어 프로시저 및 권한 설정
-- 
-- 적용 대상: Supabase SQL Editor
-- 주의: 함수 생성과 권한 제한을 단일 트랜잭션으로 처리하며, 타 함수 권한은 건드리지 않음
-- ==============================================================================

BEGIN;

-- 1. ams_teachers 테이블 확장 (소프트 삭제 및 퇴사 시각)
ALTER TABLE public.ams_teachers
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS ams_teachers_academy_is_deleted_idx
ON public.ams_teachers (academy_id, is_deleted);

-- 2. ams_students 테이블 확장 (마지막 담당 교사 보존 컬럼)
ALTER TABLE public.ams_students
ADD COLUMN IF NOT EXISTS last_teacher_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS ams_students_teacher_id_idx
ON public.ams_students (teacher_id)
WHERE teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ams_students_academy_is_deleted_idx
ON public.ams_students (academy_id, is_deleted);


-- ==============================================================================
-- 3. 원자적 교사 퇴사 처리 함수 (SECURITY DEFINER + search_path 고정)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.ams_retire_teacher(
    p_academy_id UUID,
    p_teacher_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_teacher RECORD;
    v_assigned_count INT;
BEGIN
    -- 1) 대상 교사 행에 배타적 행 잠금(FOR UPDATE) 획득
    SELECT id, academy_id, role, is_deleted
    INTO v_teacher
    FROM public.ams_teachers
    WHERE id = p_teacher_id
      AND academy_id = p_academy_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEACHER_NOT_FOUND',
            'message', '해당 학원에서 대상 교사를 찾을 수 없습니다.'
        );
    END IF;

    -- 2) 원장 및 마스터 계정 보호
    IF v_teacher.role IN ('admin', 'master') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'CANNOT_RETIRE_ADMIN',
            'message', '원장 또는 관리자 계정은 퇴사 처리할 수 없습니다.'
        );
    END IF;

    -- 3) 멱등성: 이미 퇴사 처리된 경우 성공 반환
    IF v_teacher.is_deleted = true THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'already_retired',
            'teacher_id', p_teacher_id
        );
    END IF;

    -- 4) 담당 학생 0명 검증 (전체 학생 명부 기준)
    SELECT COUNT(*)
    INTO v_assigned_count
    FROM public.ams_students
    WHERE teacher_id = p_teacher_id
      AND academy_id = p_academy_id;

    IF v_assigned_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEACHER_HAS_ASSIGNED_STUDENTS',
            'message', '담당 학생이 0명일 때만 퇴사 처리가 가능합니다.',
            'assigned_count', v_assigned_count
        );
    END IF;

    -- 5) 퇴사 상태 반영 (소프트 삭제)
    UPDATE public.ams_teachers
    SET is_deleted = true,
        retired_at = NOW()
    WHERE id = p_teacher_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'retired',
        'teacher_id', p_teacher_id
    );
END;
$$;

-- 실행 권한 통제: PUBLIC, anon, authenticated 회수 및 service_role 단독 부여
REVOKE ALL ON FUNCTION public.ams_retire_teacher(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ams_retire_teacher(UUID, UUID) TO service_role;


-- ==============================================================================
-- 4. 원자적 학생 퇴원 처리 함수 (SECURITY DEFINER + search_path 고정)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.ams_discharge_student(
    p_academy_id UUID,
    p_student_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_student RECORD;
    v_updated_notes TEXT;
    v_discharge_tag TEXT;
BEGIN
    -- 1) 대상 학생 행에 배타적 행 잠금(FOR UPDATE) 획득
    SELECT id, academy_id, teacher_id, last_teacher_id, is_deleted, management_notes
    INTO v_student
    FROM public.ams_students
    WHERE id = p_student_id
      AND academy_id = p_academy_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'STUDENT_NOT_FOUND',
            'message', '해당 학원에서 대상 학생을 찾을 수 없습니다.'
        );
    END IF;

    -- 2) 멱등성: 이미 퇴원한 대상은 기존 보존 정보(last_teacher_id)를 덮어쓰지 않고 성공 반환
    IF v_student.is_deleted = true THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'already_discharged',
            'student_id', p_student_id,
            'last_teacher_id', v_student.last_teacher_id
        );
    END IF;

    -- 3) 관리 메모에 퇴원 사유 태그 기록 준비
    v_updated_notes := v_student.management_notes;
    IF p_reason IS NOT NULL AND TRIM(p_reason) <> '' THEN
        v_discharge_tag := '[퇴원일: ' || TO_CHAR(NOW(), 'YYYY-MM-DD') || '] [사유: ' || TRIM(p_reason) || ']';
        IF v_updated_notes IS NOT NULL AND TRIM(v_updated_notes) <> '' THEN
            v_updated_notes := v_updated_notes || E'\n' || v_discharge_tag;
        ELSE
            v_updated_notes := v_discharge_tag;
        END IF;
    END IF;

    -- 4) 최초 퇴원 전환: teacher_id 해제 및 last_teacher_id 보존을 원자적으로 수행
    UPDATE public.ams_students
    SET is_deleted = true,
        last_teacher_id = v_student.teacher_id,
        teacher_id = NULL,
        management_notes = v_updated_notes
    WHERE id = p_student_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'discharged',
        'student_id', p_student_id,
        'last_teacher_id', v_student.teacher_id
    );
END;
$$;

-- 실행 권한 통제: PUBLIC, anon, authenticated 회수 및 service_role 단독 부여
REVOKE ALL ON FUNCTION public.ams_discharge_student(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ams_discharge_student(UUID, UUID, TEXT) TO service_role;


-- ==============================================================================
-- 5. 학생 배정/생성/복구 시 퇴사 교사 차단 및 동시성 잠금 트리거
--    (ams_students의 teacher_id 지정 시 ams_teachers에 FOR SHARE 잠금 획득)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.ams_check_student_teacher_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- teacher_id가 지정되거나 변경된 경우에만 실행
    IF NEW.teacher_id IS NOT NULL THEN
        -- 교사 행에 공유 행 잠금(FOR SHARE)을 걸어 퇴사 트랜잭션(FOR UPDATE)과 직렬화
        PERFORM 1 FROM public.ams_teachers
        WHERE id = NEW.teacher_id
          AND academy_id = NEW.academy_id
          AND is_deleted = false
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'TEACHER_NOT_ACTIVE_OR_MISMATCH'
                USING DETAIL = '해당 교사가 활성 상태가 아니거나 다른 학원 소속입니다.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ams_check_student_teacher_assignment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ams_check_student_teacher_assignment() TO service_role;

DROP TRIGGER IF EXISTS trg_ams_check_student_teacher_assignment ON public.ams_students;
CREATE TRIGGER trg_ams_check_student_teacher_assignment
BEFORE INSERT OR UPDATE OF teacher_id ON public.ams_students
FOR EACH ROW
EXECUTE FUNCTION public.ams_check_student_teacher_assignment();

-- ==============================================================================
-- 6. 기존 세션 잠금 RPC들이 사용하는 교사 권한 확인 함수에 퇴사 상태 검사 추가
--    - 시그니처/반환 컬럼/SECURITY INVOKER는 기존과 동일 (기존 RPC 호출부 영향 없음)
--    - 추가되는 조건은 is_deleted = false 하나뿐이며 퇴사 교사에게만 영향
--    - 적용 전 운영의 현재 함수 정의(pg_get_functiondef)와 이 본문을 대조할 것
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_teacher_academy_access(p_academy_id uuid)
RETURNS TABLE (teacher_id uuid, teacher_role text, actor_uid uuid)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_actor_id uuid;
  v_teacher public.ams_teachers%ROWTYPE;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: 로그인 인증 정보(auth.uid)가 필요합니다.';
  END IF;

  SELECT * INTO v_teacher
  FROM public.ams_teachers
  WHERE user_id = v_actor_id
    AND academy_id = p_academy_id
    AND role IN ('teacher', 'admin')
    AND is_deleted = false
  LIMIT 1;

  IF v_teacher.id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_TEACHER: 해당 학원(%s)에 등록된 교사 또는 관리자 계정이 아닙니다.', p_academy_id;
  END IF;

  RETURN QUERY SELECT v_teacher.id, v_teacher.role, v_actor_id;
END;
$$;

COMMIT;
