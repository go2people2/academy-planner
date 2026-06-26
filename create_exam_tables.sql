-- =============================================
-- OMR 채점 시스템 테이블 생성 SQL
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 시험지 목록 테이블
CREATE TABLE IF NOT EXISTS ams_exam_papers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id text NOT NULL,
  title text NOT NULL,
  region text DEFAULT '',
  school text DEFAULT '',
  grade text DEFAULT '',
  subject text DEFAULT '수학',
  year integer DEFAULT EXTRACT(YEAR FROM NOW())::integer,
  semester text DEFAULT '',
  scope text DEFAULT '',
  question_count integer DEFAULT 30,
  answer_key jsonb DEFAULT '{}',
  question_types jsonb DEFAULT '{}',
  essay_questions jsonb DEFAULT '[]',
  file_links jsonb DEFAULT '[]',
  tags text[] DEFAULT '{}',
  created_by text DEFAULT '',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- 2. 학생 답안 제출 테이블
CREATE TABLE IF NOT EXISTS ams_exam_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id uuid REFERENCES ams_exam_papers(id) ON DELETE CASCADE,
  academy_id text NOT NULL,
  student_id text NOT NULL,
  student_name text DEFAULT '',
  answers jsonb DEFAULT '{}',
  input_method text DEFAULT 'digital',
  omr_image_url text DEFAULT '',
  auto_score numeric DEFAULT 0,
  essay_scores jsonb DEFAULT '{}',
  total_score numeric DEFAULT 0,
  wrong_questions integer[] DEFAULT '{}',
  submitted_at timestamptz DEFAULT NOW(),
  graded_at timestamptz
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_exam_papers_academy ON ams_exam_papers(academy_id);
CREATE INDEX IF NOT EXISTS idx_exam_papers_region ON ams_exam_papers(region);
CREATE INDEX IF NOT EXISTS idx_exam_papers_grade ON ams_exam_papers(grade);
CREATE INDEX IF NOT EXISTS idx_exam_papers_year ON ams_exam_papers(year);
CREATE INDEX IF NOT EXISTS idx_exam_papers_semester ON ams_exam_papers(semester);
CREATE INDEX IF NOT EXISTS idx_exam_papers_subject ON ams_exam_papers(subject);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam ON ams_exam_submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_student ON ams_exam_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_academy ON ams_exam_submissions(academy_id);

-- 4. RLS 활성화 및 정책
ALTER TABLE ams_exam_papers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_exam_papers' AND policyname = 'exam_papers_all') THEN
    CREATE POLICY exam_papers_all ON ams_exam_papers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE ams_exam_submissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_exam_submissions' AND policyname = 'exam_submissions_all') THEN
    CREATE POLICY exam_submissions_all ON ams_exam_submissions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
