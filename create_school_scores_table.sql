-- =============================================
-- 학교 지필평가(중간/기말) 성적 관리 테이블 생성 SQL
-- Supabase SQL Editor에서 실행하세요
-- =============================================

CREATE TABLE IF NOT EXISTS ams_school_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid REFERENCES ams_students(id) ON DELETE CASCADE,
  academy_id text NOT NULL,
  school_grade text NOT NULL, -- '중1', '중2', '중3', '고1', '고2', '고3'
  semester text NOT NULL,     -- '1학기 중간', '1학기 기말', '2학기 중간', '2학기 기말'
  score numeric NOT NULL,     -- 0~100 점수
  note text DEFAULT '',       -- 간단한 메모 (예: 실수 1개, 수행평가 포함 등)
  created_at timestamptz DEFAULT NOW()
);

-- 인덱스 생성 (조회 최적화)
CREATE INDEX IF NOT EXISTS idx_school_scores_student ON ams_school_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_school_scores_academy ON ams_school_scores(academy_id);

-- RLS (Row Level Security) 활성화
ALTER TABLE ams_school_scores ENABLE ROW LEVEL SECURITY;

-- 정책 생성 (모든 작업 허용)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_school_scores' AND policyname = 'school_scores_all') THEN
    CREATE POLICY school_scores_all ON ams_school_scores FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
