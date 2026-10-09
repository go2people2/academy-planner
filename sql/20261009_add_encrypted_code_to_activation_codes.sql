-- ============================================================================
-- HokmaNote 설치 코드 암호화 및 원자적 발급 시스템 최종 마이그레이션 DDL
-- 단일 트랜잭션(BEGIN ~ COMMIT)으로 실행되어 도중 오류 발생 시 100% 롤백됩니다.
-- ============================================================================

BEGIN;

-- 1. activation_codes 테이블에 AES-256-GCM 암호화 저장용 컬럼 추가 (public 스키마)
ALTER TABLE public.activation_codes 
ADD COLUMN IF NOT EXISTS encrypted_code TEXT,
ADD COLUMN IF NOT EXISTS iv TEXT,
ADD COLUMN IF NOT EXISTS auth_tag TEXT,
ADD COLUMN IF NOT EXISTS key_version INTEGER DEFAULT 1;

-- 2. code_hash 고유 제약 인덱스 (동일 해시 중복 발급 원천 차단)
CREATE UNIQUE INDEX IF NOT EXISTS uk_activation_codes_code_hash 
ON public.activation_codes (code_hash);

-- 3. 동일 학원·모듈당 단 1개의 'issued' 유효 코드만 존재하도록 보장하는 부분 고유 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS uk_activation_codes_active_single 
ON public.activation_codes (academy_id, module_code) 
WHERE (status = 'issued');

-- 4. 원자적 설치 코드 발급/재발급 Stored Procedure (RPC) 등록
-- - RETURNS TABLE의 출력 변수명을 out_* 로 명명하여 컬럼명과의 모호성/충돌 원천 방지
-- - 모든 테이블 참조에 ac., ams. 등 명시적 별칭 부여
-- - TIMESTAMPTZ 연산에 불필요한 timezone 변환 없이 표준 now() 사용
-- - CASCADE 없는 안전한 CREATE OR REPLACE 정의
CREATE OR REPLACE FUNCTION public.rpc_issue_activation_code(
    p_academy_id UUID,
    p_module_code TEXT,
    p_code_hash TEXT,
    p_code_prefix VARCHAR(10),
    p_encrypted_code TEXT,
    p_iv TEXT,
    p_auth_tag TEXT,
    p_key_version INTEGER,
    p_expires_at TIMESTAMPTZ,
    p_created_by UUID,
    p_force_reissue BOOLEAN DEFAULT FALSE,
    p_expected_active_code_id UUID DEFAULT NULL
)
RETURNS TABLE (
    out_success BOOLEAN,
    out_error_code TEXT,
    out_code_id UUID,
    out_existing_code_id UUID,
    out_expires_at TIMESTAMPTZ,
    out_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing RECORD;
    v_new_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    -- [1] 학원 존재 확인 및 행 잠금 (학원 단위 발급 요청 직렬화)
    PERFORM ams.id 
    FROM public.ams_academies AS ams 
    WHERE ams.id = p_academy_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'ACADEMY_NOT_FOUND', NULL::UUID, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- [2] 만료 시각이 지난 기존 'issued' 코드를 동일 트랜잭션에서 'expired'로 일괄 정리
    -- (부분 고유 인덱스 uk_activation_codes_active_single과의 충돌 방지 및 상태 정상화)
    UPDATE public.activation_codes AS ac
    SET status = 'expired'
    WHERE ac.academy_id = p_academy_id
      AND ac.module_code = p_module_code
      AND ac.status = 'issued'
      AND ac.expires_at <= now();

    -- [3] 아직 만료되지 않은 기존 유효 코드 확인 및 행 잠금
    SELECT ac.id, ac.expires_at, ac.created_at INTO v_existing 
    FROM public.activation_codes AS ac
    WHERE ac.academy_id = p_academy_id 
      AND ac.module_code = p_module_code 
      AND ac.status = 'issued' 
      AND ac.expires_at > now()
    FOR UPDATE;

    -- [4] 발급 정책 분기 검증
    IF NOT p_force_reissue THEN
        -- [일반 신규 발급] 기존 유효 코드가 존재하면 신규 발급 거절 및 안내
        IF FOUND THEN
            RETURN QUERY SELECT false, 'ACTIVE_CODE_ALREADY_EXISTS', NULL::UUID, v_existing.id, v_existing.expires_at, v_existing.created_at;
            RETURN;
        END IF;
    ELSE
        -- [기존 코드 폐기 후 재발급]
        -- 1) 클라이언트가 확인했던 대상 코드 ID 필수 검증
        IF p_expected_active_code_id IS NULL THEN
            RETURN QUERY SELECT false, 'REISSUE_EXPECTED_ID_REQUIRED', NULL::UUID, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
            RETURN;
        END IF;

        -- 2) 사용자가 확인했던 코드가 이미 만료/사용되어 현재 유효 코드가 없는 경우 (레이스 컨디션)
        IF NOT FOUND THEN
            RETURN QUERY SELECT false, 'ACTIVE_CODE_NOT_FOUND', NULL::UUID, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
            RETURN;
        END IF;

        -- 3) 현재 유효 코드 ID가 사용자가 확인했던 ID와 불일치하는 경우 (다른 관리자에 의해 이미 재발급됨)
        IF v_existing.id <> p_expected_active_code_id THEN
            RETURN QUERY SELECT false, 'ACTIVE_CODE_CHANGED', NULL::UUID, v_existing.id, v_existing.expires_at, v_existing.created_at;
            RETURN;
        END IF;

        -- 4) 검증 완료: 확인했던 해당 유효 코드를 원자적으로 폐기 처리
        UPDATE public.activation_codes AS ac
        SET status = 'revoked', revoked_at = now()
        WHERE ac.id = v_existing.id;
    END IF;

    -- [5] 신규 코드 INSERT (단일 유효 코드 보장 인덱스 및 해시 고유 인덱스 검증)
    INSERT INTO public.activation_codes (
        academy_id,
        module_code,
        code_hash,
        code_prefix,
        encrypted_code,
        iv,
        auth_tag,
        key_version,
        status,
        expires_at,
        max_uses,
        used_count,
        created_by,
        created_at
    ) VALUES (
        p_academy_id,
        p_module_code,
        p_code_hash,
        p_code_prefix,
        p_encrypted_code,
        p_iv,
        p_auth_tag,
        p_key_version,
        'issued',
        p_expires_at,
        1,
        0,
        p_created_by,
        now()
    )
    RETURNING activation_codes.id, activation_codes.created_at INTO v_new_id, v_created_at;

    -- [6] 발급 성공 반환
    RETURN QUERY SELECT true, NULL::TEXT, v_new_id, NULL::UUID, p_expires_at, v_created_at;
END;
$$;

-- 5. 권한 엄격 제한 (SECURITY DEFINER 보안 강화: anon, authenticated, public 차단 / service_role 허용)
REVOKE ALL ON FUNCTION public.rpc_issue_activation_code(
    UUID, TEXT, TEXT, VARCHAR(10), TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, UUID, BOOLEAN, UUID
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.rpc_issue_activation_code(
    UUID, TEXT, TEXT, VARCHAR(10), TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, UUID, BOOLEAN, UUID
) FROM anon;

REVOKE ALL ON FUNCTION public.rpc_issue_activation_code(
    UUID, TEXT, TEXT, VARCHAR(10), TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, UUID, BOOLEAN, UUID
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_issue_activation_code(
    UUID, TEXT, TEXT, VARCHAR(10), TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, UUID, BOOLEAN, UUID
) TO service_role;

COMMIT;
