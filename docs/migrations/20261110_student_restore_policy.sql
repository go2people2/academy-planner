-- ==============================================================================
-- 20261110_student_restore_policy.sql
-- 학생 재원 복귀(Restore) 원자적 프로시저 및 담당 교사 배정/복원 정책
--
-- 적용 대상: Supabase SQL Editor (배포 승인 시 적용)
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.ams_restore_student(
    p_academy_id UUID,
    p_student_id UUID,
    p_specified_teacher_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_student RECORD;
    v_target_teacher_id UUID := NULL;
    v_teacher RECORD;
    v_assignment_status TEXT := 'UNASSIGNED';
    v_message TEXT;
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
            'error', '해당 학원에서 대상 학생을 찾을 수 없습니다.'
        );
    END IF;

    -- 2) 멱등성: 이미 재원 중인 학생은 기존 담당 교사 변경 없이 200 성공 반환
    IF v_student.is_deleted = false THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'already_active',
            'student_id', p_student_id,
            'teacher_id', v_student.teacher_id,
            'teacher_assignment_status', 'MAINTAINED_EXISTING',
            'message', '이미 재원 중인 학생입니다. 기존 담당 교사를 유지합니다.'
        );
    END IF;

    -- 3) 담당 교사 결정 로직
    IF p_specified_teacher_id IS NOT NULL THEN
        -- A: 명시적 지정 교사 검증
        SELECT id, academy_id, is_deleted
        INTO v_teacher
        FROM public.ams_teachers
        WHERE id = p_specified_teacher_id
          AND academy_id = p_academy_id;

        IF NOT FOUND OR v_teacher.is_deleted = true THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TEACHER_NOT_ACTIVE_OR_MISMATCH',
                'error', '지정한 담당 교사가 존재하지 않거나, 다른 학원 소속이거나, 퇴사한 교사입니다.'
            );
        END IF;

        v_target_teacher_id := p_specified_teacher_id;
        v_assignment_status := 'ASSIGNED_SPECIFIED';
        v_message := '지정된 담당 교사로 배정되었습니다.';
    ELSE
        -- B: 이전 교사(last_teacher_id) 복원 검토
        IF v_student.last_teacher_id IS NOT NULL THEN
            SELECT id, academy_id, is_deleted
            INTO v_teacher
            FROM public.ams_teachers
            WHERE id = v_student.last_teacher_id
              AND academy_id = p_academy_id
              AND is_deleted = false;

            IF FOUND THEN
                v_target_teacher_id := v_student.last_teacher_id;
                v_assignment_status := 'RESTORED_PREVIOUS';
                v_message := '이전 담당 교사로 자동 배정되었습니다.';
            ELSE
                v_target_teacher_id := NULL;
                v_assignment_status := 'UNASSIGNED_PREVIOUS_TEACHER_INACTIVE';
                v_message := '이전 담당 교사가 퇴사(또는 비활성)하여 미배정 상태로 복귀되었습니다.';
            END IF;
        ELSE
            v_target_teacher_id := NULL;
            v_assignment_status := 'UNASSIGNED_NO_PREVIOUS_TEACHER';
            v_message := '이전 담당 교사 기록이 없어 미배정 상태로 복귀되었습니다.';
        END IF;
    END IF;

    -- 4) 복구 실행
    UPDATE public.ams_students
    SET is_deleted = false,
        teacher_id = v_target_teacher_id
    WHERE id = p_student_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'restored',
        'student_id', p_student_id,
        'teacher_id', v_target_teacher_id,
        'teacher_assignment_status', v_assignment_status,
        'message', v_message
    );
END;
$$;

-- 실행 권한 통제: PUBLIC, anon, authenticated 회수 및 service_role 단독 부여
REVOKE ALL ON FUNCTION public.ams_restore_student(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ams_restore_student(UUID, UUID, UUID) TO service_role;

COMMIT;
