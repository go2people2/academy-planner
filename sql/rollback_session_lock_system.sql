-- ==============================================================================
-- 🔄 Rollback: AMS Session Lock System & Guarded RPC
-- ==============================================================================

-- 1. Trigger 제거
DROP TRIGGER IF EXISTS trg_ams_session_logs_lock_guard ON ams_session_logs;
DROP FUNCTION IF EXISTS trg_protect_approved_session_submission();

-- 2. Guarded RPC 제거
DROP FUNCTION IF EXISTS save_session_log_guarded(bigint, uuid, uuid, date, text, numeric, jsonb, integer);
DROP FUNCTION IF EXISTS approve_session_log_guarded(bigint[], uuid);
DROP FUNCTION IF EXISTS unlock_session_for_edit_guarded(bigint, uuid);
DROP FUNCTION IF EXISTS relock_session_guarded(bigint, uuid);
DROP FUNCTION IF EXISTS restore_submission_snapshot_guarded(bigint, uuid);
DROP FUNCTION IF EXISTS check_teacher_academy_access(uuid);

-- 3. 인덱스 제거
DROP INDEX IF EXISTS idx_ams_session_logs_lock_state;

-- 4. 추가 컬럼 제거 (필요 시 주석 해제하여 실행)
-- ALTER TABLE ams_session_logs
--   DROP COLUMN IF EXISTS submission_snapshot,
--   DROP COLUMN IF EXISTS approved_at,
--   DROP COLUMN IF EXISTS approved_by,
--   DROP COLUMN IF EXISTS edit_unlocked_by,
--   DROP COLUMN IF EXISTS edit_unlocked_at,
--   DROP COLUMN IF EXISTS version,
--   DROP COLUMN IF EXISTS updated_at;
