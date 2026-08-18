-- 📅 주간 시간표(Timetables) 저장 테이블 생성 DDL
CREATE TABLE IF NOT EXISTS ams_timetables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES ams_academies(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES ams_teachers(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL, -- '월', '화', '수', '목', '금', '토', '일'
    time_slot TEXT NOT NULL,   -- '4~5', '5~6', '6~7', '7~8', '8~9', '9~10'
    row_index INT NOT NULL,    -- 1~18번 자리 (행 인덱스)
    student_id UUID REFERENCES ams_students(id) ON DELETE SET NULL, -- 배정된 학생 ID
    bg_color TEXT DEFAULT 'default' NOT NULL, -- 셀 배경색 ('default', 'green', 'yellow', 'orange', 'blue')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_timetable_slot_row UNIQUE (academy_id, teacher_id, day_of_week, time_slot, row_index)
);

-- RLS 활성화 및 권한 설정
ALTER TABLE ams_timetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users" ON ams_timetables
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all for authenticated master or admin" ON ams_timetables
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
