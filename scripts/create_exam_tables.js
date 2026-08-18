/**
 * OMR 채점 시스템 - Supabase 테이블 생성 스크립트
 * 실행: node create_exam_tables.js
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function createTables() {
  console.log('🔧 OMR 채점 시스템 테이블 생성 시작...');

  // 1. ams_exam_papers (시험지 목록)
  const { error: err1 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS ams_exam_papers (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        academy_id text NOT NULL,
        title text NOT NULL,
        region text DEFAULT '',
        school text DEFAULT '',
        grade text DEFAULT '',
        subject text DEFAULT '수학',
        year integer DEFAULT EXTRACT(YEAR FROM NOW()),
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
    `
  });
  if (err1) console.error('❌ ams_exam_papers 생성 실패:', err1.message);
  else console.log('✅ ams_exam_papers 테이블 생성 완료');

  // 2. ams_exam_submissions (학생 답안 제출)
  const { error: err2 } = await supabase.rpc('exec_sql', {
    sql: `
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
    `
  });
  if (err2) console.error('❌ ams_exam_submissions 생성 실패:', err2.message);
  else console.log('✅ ams_exam_submissions 테이블 생성 완료');

  // 3. 인덱스 생성
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_exam_papers_academy ON ams_exam_papers(academy_id);`,
    `CREATE INDEX IF NOT EXISTS idx_exam_papers_region ON ams_exam_papers(region);`,
    `CREATE INDEX IF NOT EXISTS idx_exam_papers_grade ON ams_exam_papers(grade);`,
    `CREATE INDEX IF NOT EXISTS idx_exam_papers_year ON ams_exam_papers(year);`,
    `CREATE INDEX IF NOT EXISTS idx_exam_papers_semester ON ams_exam_papers(semester);`,
    `CREATE INDEX IF NOT EXISTS idx_exam_papers_subject ON ams_exam_papers(subject);`,
    `CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam ON ams_exam_submissions(exam_id);`,
    `CREATE INDEX IF NOT EXISTS idx_exam_submissions_student ON ams_exam_submissions(student_id);`,
    `CREATE INDEX IF NOT EXISTS idx_exam_submissions_academy ON ams_exam_submissions(academy_id);`,
  ];

  for (const idx of indexes) {
    const { error } = await supabase.rpc('exec_sql', { sql: idx });
    if (error) console.error('❌ 인덱스 생성 실패:', error.message);
  }
  console.log('✅ 인덱스 생성 완료');

  // 4. RLS 정책 설정
  const rlsPolicies = [
    `ALTER TABLE ams_exam_papers ENABLE ROW LEVEL SECURITY;`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_exam_papers' AND policyname = 'exam_papers_all') THEN
        CREATE POLICY exam_papers_all ON ams_exam_papers FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;`,
    `ALTER TABLE ams_exam_submissions ENABLE ROW LEVEL SECURITY;`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_exam_submissions' AND policyname = 'exam_submissions_all') THEN
        CREATE POLICY exam_submissions_all ON ams_exam_submissions FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;`,
  ];

  for (const policy of rlsPolicies) {
    const { error } = await supabase.rpc('exec_sql', { sql: policy });
    if (error) console.error('❌ RLS 설정 실패:', error.message);
  }
  console.log('✅ RLS 정책 설정 완료');

  console.log('\n🎉 모든 테이블 생성 완료!');
}

createTables().catch(console.error);
