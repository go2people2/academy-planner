-- ============================================================================
-- ams_ai_usage_logs (AI 기능별 사용량 계량 및 분석 전용 로그 테이블)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ams_ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(64) NOT NULL,
    academy_id UUID NOT NULL REFERENCES ams_academies(id) ON DELETE CASCADE,
    student_id UUID REFERENCES ams_students(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES ams_teachers(id) ON DELETE SET NULL,
    feature VARCHAR(50) NOT NULL DEFAULT 'briefing' CHECK (feature IN ('briefing')),
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('openai', 'gemini')),
    model VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
    input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 💡 [중복 방지] 동일 학원, 기능, request_id에 대해 성공 로그 1건만 허용 (Partial Unique Index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ams_ai_usage_success_req
ON ams_ai_usage_logs (academy_id, feature, request_id)
WHERE status = 'success';

-- 💡 [Master 기간별 통계 및 학원별 집계 최적화 인덱스]
CREATE INDEX IF NOT EXISTS idx_ams_ai_usage_academy_created
ON ams_ai_usage_logs (academy_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ams_ai_usage_created_at
ON ams_ai_usage_logs (created_at DESC);

-- 💡 [RLS 활성화 및 브라우저 클라이언트 직접 접근 원천 차단]
ALTER TABLE ams_ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- anon 및 authenticated 클라이언트의 직접 SELECT/INSERT/UPDATE/DELETE 모두 불허
CREATE POLICY "Deny direct public client access to ams_ai_usage_logs"
ON ams_ai_usage_logs FOR ALL TO public
USING (false) WITH CHECK (false);
