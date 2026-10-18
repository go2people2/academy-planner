-- ============================================================================
-- ams_teachers login_id 전역 중복 방지 유니크 인덱스 생성 DDL
-- 적용 대상: public.ams_teachers
-- 규칙: 공백 제거(TRIM) 및 소문자 정규화(LOWER) 기준 전역 유일성 보장
-- 상태: 2026-10-19 Supabase 대시보드 SQL Editor에서 수동 적용 및 유효 상태 검증 완료
-- 정의: CREATE UNIQUE INDEX ams_teachers_unique_lower_login_id_idx ON public.ams_teachers USING btree (lower(TRIM(BOTH FROM login_id)))
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS ams_teachers_unique_lower_login_id_idx 
ON public.ams_teachers (LOWER(TRIM(login_id)));
