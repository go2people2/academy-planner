-- ==============================================================================
-- 📚 ams_textbooks, ams_textbook_units, ams_academy_books 테이블 생성 DDL
-- 날짜: 2026-10-26
-- 목적: 단일 구글시트 기반 교재 관리를 다중 학원 지원 Supabase DB 구조로 전환
-- ==============================================================================

-- 1. 교재 메타데이터 마스터 테이블 (공용 + 개별 학원 등록 교재)
CREATE TABLE IF NOT EXISTS public.ams_textbooks (
    bookcode VARCHAR(100) PRIMARY KEY,                    -- 교재 코드 (예: M-2-1-01)
    title VARCHAR(255) NOT NULL,                          -- 기본 교재명
    grade VARCHAR(50),                                    -- 대상 학년 (예: 중2, 초6)
    category VARCHAR(50),                                 -- 분류 (예: 내신대비, 개념원리 등)
    publisher VARCHAR(100),                               -- 출판사
    e_period VARCHAR(50),                                 -- 학습 주기 (구글시트 e-period)
    status VARCHAR(20) DEFAULT '활성',                     -- 교재 상태 ('활성', '비활성')
    
    -- 크라우드소싱 & 공유 승인 관련 필드
    share_status VARCHAR(20) DEFAULT 'approved',          -- 'pending'(심사대기), 'approved'(공용승인), 'private'(학원단독)
    created_by_academy_id UUID REFERENCES public.ams_academies(id) ON DELETE SET NULL, -- 등록한 학원 (공용교재는 NULL)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 교재 단원 및 페이지 매핑 테이블
CREATE TABLE IF NOT EXISTS public.ams_textbook_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookcode VARCHAR(100) NOT NULL REFERENCES public.ams_textbooks(bookcode) ON DELETE CASCADE,
    unit_order INT NOT NULL DEFAULT 1,                    -- 단원 정렬 순서
    unit_name VARCHAR(255) NOT NULL,                      -- 단원명
    start_page INT DEFAULT 0,                             -- 시작 페이지
    end_page INT DEFAULT 0,                               -- 종료 페이지
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: bookcode 기준 단원 조회 최적화
CREATE INDEX IF NOT EXISTS idx_textbook_units_bookcode ON public.ams_textbook_units(bookcode, unit_order);

-- 3. 학원별 교재 ON/OFF 및 별칭(Alias) 설정 테이블
CREATE TABLE IF NOT EXISTS public.ams_academy_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES public.ams_academies(id) ON DELETE CASCADE,
    bookcode VARCHAR(100) NOT NULL REFERENCES public.ams_textbooks(bookcode) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,             -- 해당 학원에서 사용 여부 (ON/OFF)
    custom_title VARCHAR(255),                            -- 학원 전용 교재 별칭 (NULL이면 master의 title 사용)
    display_order INT DEFAULT 999,                        -- 학원 내 드롭다운 표시 순서
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_academy_bookcode UNIQUE (academy_id, bookcode)
);

-- 인덱스: 학원별 활성 교재 목록 조회 최적화
CREATE INDEX IF NOT EXISTS idx_academy_books_lookup ON public.ams_academy_books(academy_id, is_enabled);

-- ==============================================================================
-- RLS (Row Level Security) 설정
-- ==============================================================================

-- 1) ams_textbooks
ALTER TABLE public.ams_textbooks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_textbooks' AND policyname = 'Allow select ams_textbooks for all') THEN
        CREATE POLICY "Allow select ams_textbooks for all" ON public.ams_textbooks
            FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_textbooks' AND policyname = 'Allow write ams_textbooks for authenticated') THEN
        CREATE POLICY "Allow write ams_textbooks for authenticated" ON public.ams_textbooks
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2) ams_textbook_units
ALTER TABLE public.ams_textbook_units ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_textbook_units' AND policyname = 'Allow select ams_textbook_units for all') THEN
        CREATE POLICY "Allow select ams_textbook_units for all" ON public.ams_textbook_units
            FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_textbook_units' AND policyname = 'Allow write ams_textbook_units for authenticated') THEN
        CREATE POLICY "Allow write ams_textbook_units for authenticated" ON public.ams_textbook_units
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3) ams_academy_books
ALTER TABLE public.ams_academy_books ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_academy_books' AND policyname = 'Allow select ams_academy_books for all') THEN
        CREATE POLICY "Allow select ams_academy_books for all" ON public.ams_academy_books
            FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ams_academy_books' AND policyname = 'Allow write ams_academy_books for authenticated') THEN
        CREATE POLICY "Allow write ams_academy_books for authenticated" ON public.ams_academy_books
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
