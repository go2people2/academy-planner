-- 📖 교재 PDF/구글 드라이브 링크 매핑 테이블 생성 DDL
CREATE TABLE IF NOT EXISTS ams_textbook_pdfs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES ams_academies(id) ON DELETE CASCADE,
    bookcode TEXT NOT NULL,
    pdf_url TEXT,
    answer_url TEXT,
    explanation_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_academy_bookcode UNIQUE (academy_id, bookcode)
);
ALTER TABLE ams_textbook_pdfs ADD COLUMN IF NOT EXISTS answer_url TEXT;
ALTER TABLE ams_textbook_pdfs ADD COLUMN IF NOT EXISTS explanation_url TEXT;

-- RLS 활성화
ALTER TABLE ams_textbook_pdfs ENABLE ROW LEVEL SECURITY;

-- 격리 및 조회 권한 정책
CREATE POLICY "Allow select for authenticated users" ON ams_textbook_pdfs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all for authenticated master or admin" ON ams_textbook_pdfs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
