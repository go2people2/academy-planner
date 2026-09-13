-- ============================================================================
-- 1. updated_at 자동 갱신 공통 함수
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- 2. academy_modules (학원별 모듈 계약 및 사용 권한 상태 마스터)
-- ============================================================================
CREATE TABLE IF NOT EXISTS academy_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES ams_academies(id) ON DELETE CASCADE,
    module_code TEXT NOT NULL CHECK (module_code IN ('ams', 'hokmanote')),
    status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'trial', 'pending_setup', 'active', 'grace', 'suspended')),
    plan_code TEXT DEFAULT 'standard',
    max_devices INTEGER NOT NULL DEFAULT 1 CHECK (max_devices > 0),
    trial_ends_at TIMESTAMPTZ,
    grace_until TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_academy_module UNIQUE (academy_id, module_code)
);

CREATE TRIGGER trg_academy_modules_updated_at
BEFORE UPDATE ON academy_modules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_academy_modules_lookup 
ON academy_modules (academy_id, module_code, status);

-- ============================================================================
-- 3. activation_codes (HokmaNote 로컬 Mac 일회성 설치 코드)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES ams_academies(id) ON DELETE CASCADE,
    module_code TEXT NOT NULL DEFAULT 'hokmanote' CHECK (module_code = 'hokmanote'),
    code_hash TEXT NOT NULL,
    code_prefix VARCHAR(10) NOT NULL,
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'used', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
    used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_by UUID REFERENCES ams_teachers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activation_codes_hash 
ON activation_codes (code_hash) WHERE status = 'issued';

-- ============================================================================
-- 4. academy_devices (등록 승인된 Mac 기기 목록)
-- ============================================================================
CREATE TABLE IF NOT EXISTS academy_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES ams_academies(id) ON DELETE CASCADE,
    module_code TEXT NOT NULL DEFAULT 'hokmanote' CHECK (module_code = 'hokmanote'),
    device_uuid VARCHAR(128) NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    platform VARCHAR(20) NOT NULL DEFAULT 'macos',
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    activated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    revoked_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_academy_device UNIQUE (academy_id, module_code, device_uuid)
);

CREATE INDEX IF NOT EXISTS idx_academy_devices_active 
ON academy_devices (academy_id, module_code, status);

-- ============================================================================
-- 5. device_sessions (기기 세션 및 Refresh Token 해시 관리)
-- ============================================================================
CREATE TABLE IF NOT EXISTS device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES academy_devices(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_valid 
ON device_sessions (refresh_token_hash) WHERE revoked_at IS NULL;

-- ============================================================================
-- 6. 원자적 기기 등록 Stored Procedure (RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_activate_device_with_code(
    p_code_hash TEXT,
    p_device_uuid TEXT,
    p_device_name TEXT,
    p_platform TEXT,
    p_os_version TEXT,
    p_app_version TEXT,
    p_refresh_token_hash TEXT,
    p_session_expires_at TIMESTAMPTZ,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    success BOOLEAN,
    error_code TEXT,
    academy_id UUID,
    academy_name TEXT,
    slug TEXT,
    device_id UUID
) AS $$
DECLARE
    v_code RECORD;
    v_mod RECORD;
    v_active_devices_count INTEGER;
    v_device_id UUID;
    v_academy RECORD;
BEGIN
    -- 1. 코드 조회 및 행 잠금
    SELECT * INTO v_code FROM activation_codes 
    WHERE code_hash = p_code_hash FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'INVALID_CODE', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF v_code.status = 'revoked' THEN
        RETURN QUERY SELECT false, 'CODE_REVOKED', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF v_code.status = 'used' OR v_code.used_count >= v_code.max_uses THEN
        RETURN QUERY SELECT false, 'CODE_ALREADY_USED', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF v_code.expires_at < timezone('utc'::text, now()) THEN
        UPDATE activation_codes SET status = 'expired' WHERE id = v_code.id;
        RETURN QUERY SELECT false, 'CODE_EXPIRED', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- 2. 학원 및 모듈 권한 검증
    SELECT * INTO v_mod FROM academy_modules 
    WHERE academy_id = v_code.academy_id AND module_code = v_code.module_code FOR UPDATE;

    IF NOT FOUND OR v_mod.status IN ('inactive', 'suspended') THEN
        RETURN QUERY SELECT false, 'MODULE_NOT_AVAILABLE', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- 3. 허용 기기 수 대조 (동일 기기 재인증 제외)
    SELECT count(*) INTO v_active_devices_count FROM academy_devices 
    WHERE academy_id = v_code.academy_id AND module_code = v_code.module_code AND status = 'active'
      AND device_uuid <> p_device_uuid;

    IF v_active_devices_count >= v_mod.max_devices THEN
        RETURN QUERY SELECT false, 'DEVICE_LIMIT_EXCEEDED', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- 4. 기기 등록 또는 재활성화 (UPSERT)
    INSERT INTO academy_devices (
        academy_id, module_code, device_uuid, device_name, platform, 
        os_version, app_version, status, activated_at, last_seen_at, metadata
    ) VALUES (
        v_code.academy_id, v_code.module_code, p_device_uuid, p_device_name, p_platform,
        p_os_version, p_app_version, 'active', timezone('utc'::text, now()), timezone('utc'::text, now()), p_metadata
    )
    ON CONFLICT (academy_id, module_code, device_uuid) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        os_version = EXCLUDED.os_version,
        app_version = EXCLUDED.app_version,
        status = 'active',
        revoked_at = NULL,
        last_seen_at = timezone('utc'::text, now()),
        metadata = EXCLUDED.metadata
    RETURNING id INTO v_device_id;

    -- 5. 기존 세션 폐기 후 새 세션 등록
    UPDATE device_sessions SET revoked_at = timezone('utc'::text, now()), revoke_reason = 'new_login'
    WHERE device_id = v_device_id AND revoked_at IS NULL;

    INSERT INTO device_sessions (device_id, refresh_token_hash, expires_at)
    VALUES (v_device_id, p_refresh_token_hash, p_session_expires_at);

    -- 6. 코드 사용 완료 처리
    UPDATE activation_codes 
    SET status = 'used', used_count = used_count + 1, used_at = timezone('utc'::text, now())
    WHERE id = v_code.id;

    -- 7. 모듈 상태 전환 (pending_setup -> active)
    IF v_mod.status = 'pending_setup' THEN
        UPDATE academy_modules SET status = 'active' WHERE id = v_mod.id;
    END IF;

    -- 8. 학원 정보 조회 및 성공 반환
    SELECT academy_name, slug INTO v_academy FROM ams_academies WHERE id = v_code.academy_id;

    RETURN QUERY SELECT true, NULL::TEXT, v_code.academy_id, v_academy.academy_name, v_academy.slug, v_device_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. RLS 보안 정책 (일반 클라이언트 직접 접근 전면 차단)
-- ============================================================================
ALTER TABLE academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct client access to academy_modules" 
ON academy_modules FOR ALL TO public USING (false);

CREATE POLICY "Deny direct client access to activation_codes" 
ON activation_codes FOR ALL TO public USING (false);

CREATE POLICY "Deny direct client access to academy_devices" 
ON academy_devices FOR ALL TO public USING (false);

CREATE POLICY "Deny direct client access to device_sessions" 
ON device_sessions FOR ALL TO public USING (false);

-- ============================================================================
-- 8. 확정 초기 Seed 데이터 (5개 학원 상태 정밀 매핑)
-- ============================================================================
-- ① Hokma 수학, Hokma 청라, Onething Math: AMS active / HokmaNote active
INSERT INTO academy_modules (academy_id, module_code, status, max_devices)
SELECT id, 'ams', 'active', 1 FROM ams_academies WHERE slug IN ('hokma', 'hokma-cn', 'wc-math')
ON CONFLICT (academy_id, module_code) DO UPDATE SET status = 'active';

INSERT INTO academy_modules (academy_id, module_code, status, max_devices)
SELECT id, 'hokmanote', 'active', 1 FROM ams_academies WHERE slug IN ('hokma', 'hokma-cn', 'wc-math')
ON CONFLICT (academy_id, module_code) DO UPDATE SET status = 'active';

-- ② Jimath: AMS active / HokmaNote inactive
INSERT INTO academy_modules (academy_id, module_code, status, max_devices)
SELECT id, 'ams', 'active', 1 FROM ams_academies WHERE slug = 'jimath'
ON CONFLICT (academy_id, module_code) DO UPDATE SET status = 'active';

INSERT INTO academy_modules (academy_id, module_code, status, max_devices)
SELECT id, 'hokmanote', 'inactive', 1 FROM ams_academies WHERE slug = 'jimath'
ON CONFLICT (academy_id, module_code) DO UPDATE SET status = 'inactive';

-- ③ H 플래너 (테스트용): AMS inactive / HokmaNote inactive
INSERT INTO academy_modules (academy_id, module_code, status, max_devices)
SELECT id, 'ams', 'inactive', 1 FROM ams_academies WHERE slug = 'hplan'
ON CONFLICT (academy_id, module_code) DO UPDATE SET status = 'inactive';

INSERT INTO academy_modules (academy_id, module_code, status, max_devices)
SELECT id, 'hokmanote', 'inactive', 1 FROM ams_academies WHERE slug = 'hplan'
ON CONFLICT (academy_id, module_code) DO UPDATE SET status = 'inactive';
