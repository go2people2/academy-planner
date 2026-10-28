-- ==============================================================================
-- 📚 AMS 교재 시스템 최종 마이그레이션 SQL 초안 v2 (검토용 - 실행 금지)
-- 날짜: 2026-10-26
-- 목적: 다중 테넌트 격리, 지정 학원/시즌 공유, 공용 검수 분리, 4개 테이블 체계
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 공통 트리거 함수 (updated_at 자동 갱신 및 불변 컬럼 보호)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- bookcode 및 created_by_academy_id 변경 방지 트리거 함수 (IS DISTINCT FROM 적용)
CREATE OR REPLACE FUNCTION public.trg_protect_textbook_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- bookcode는 PK이므로 변경 금지
  IF NEW.bookcode <> OLD.bookcode THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: 교재 식별자(bookcode)는 변경할 수 없습니다.';
  END IF;

  -- 소유 학원 변경 금지 (NULL 전환 시도까지 포함하여 IS DISTINCT FROM으로 완전 차단)
  IF NEW.created_by_academy_id IS DISTINCT FROM OLD.created_by_academy_id THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: 교재의 최초 소유 학원(created_by_academy_id)은 변경할 수 없습니다.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- shares.owner_academy_id가 부모 교재 소유 학원과 일치하도록 강제하는 트리거 함수
CREATE OR REPLACE FUNCTION public.trg_enforce_textbook_share_owner()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_owner UUID;
BEGIN
  SELECT created_by_academy_id INTO v_parent_owner
  FROM public.ams_textbooks
  WHERE bookcode = NEW.bookcode;

  IF v_parent_owner IS NULL THEN
    RAISE EXCEPTION 'INVALID_SHARE: 공용 교재는 특정 학원 지정 공유(ams_textbook_shares) 대상이 될 수 없습니다.';
  END IF;

  -- 부모 교재의 소유 학원과 강제 일치
  IF NEW.owner_academy_id IS DISTINCT FROM v_parent_owner THEN
    NEW.owner_academy_id := v_parent_owner;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. 테넌트 및 권한 검증 헬퍼 함수
-- ------------------------------------------------------------------------------
-- 현재 로그인한 교사의 소속 academy_id 조회
CREATE OR REPLACE FUNCTION public.get_auth_teacher_academy_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT academy_id 
  FROM public.ams_teachers 
  WHERE user_id = auth.uid() 
    AND is_deleted = false;
$$;

-- 현재 로그인한 교사가 플랫폼 총괄 마스터(role = 'master')인지 검증
CREATE OR REPLACE FUNCTION public.is_platform_master()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.ams_teachers 
    WHERE user_id = auth.uid() 
      AND role = 'master' 
      AND is_deleted = false
  );
$$;

-- 현재 로그인한 교사가 원장(admin) 또는 마스터(master)인지 검증 (교재 설정 수정용)
CREATE OR REPLACE FUNCTION public.is_admin_or_master()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.ams_teachers 
    WHERE user_id = auth.uid() 
      AND role IN ('admin', 'master') 
      AND is_deleted = false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_auth_teacher_academy_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_teacher_academy_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_platform_master() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_master() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_master() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_master() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. 테이블 DDL (4개 테이블 체계)
-- ------------------------------------------------------------------------------

-- (1) ams_textbooks: 교재 마스터 원본
CREATE TABLE IF NOT EXISTS public.ams_textbooks (
    bookcode VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    grade VARCHAR(50),
    category VARCHAR(50),                                 -- 시즌 태그 (예: 2026-기말대비, 정규)
    publisher VARCHAR(100),
    e_period VARCHAR(50),
    status VARCHAR(20) DEFAULT '활성' NOT NULL,
    
    -- 공유 범위 및 검수 상태 분리
    share_scope VARCHAR(20) DEFAULT 'private' NOT NULL,   -- 'private'(학원단독), 'group'(지정공유), 'public'(공용신청)
    share_status VARCHAR(20) DEFAULT 'unsubmitted' NOT NULL, -- 'unsubmitted'(미신청), 'pending'(심사대기), 'approved'(공용승인), 'rejected'(반려)
    
    -- 오답노트 원본 데이터 보유 여부 플래그
    has_problem_data BOOLEAN DEFAULT false NOT NULL,
    
    -- 최초 등록 소유 학원 (공용 승인 후에도 원본 학원 기록 영구 보존)
    created_by_academy_id UUID REFERENCES public.ams_academies(id) ON DELETE RESTRICT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT chk_textbooks_status CHECK (status IN ('활성', '비활성')),
    CONSTRAINT chk_textbooks_share_scope CHECK (share_scope IN ('private', 'group', 'public')),
    CONSTRAINT chk_textbooks_share_status CHECK (share_status IN ('unsubmitted', 'pending', 'approved', 'rejected')),
    -- 공용 배포 완료된 교재 외의 모든 신규 등록 교재는 소유 학원이 필수
    CONSTRAINT chk_textbooks_creator_required CHECK (
      created_by_academy_id IS NOT NULL 
      OR (share_scope = 'public' AND share_status = 'approved')
    )
);

-- (2) ams_textbook_units: 단원 및 페이지 매핑
CREATE TABLE IF NOT EXISTS public.ams_textbook_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookcode VARCHAR(100) NOT NULL REFERENCES public.ams_textbooks(bookcode) ON DELETE CASCADE,
    unit_order INT NOT NULL DEFAULT 1,
    unit_name VARCHAR(255) NOT NULL,
    start_page INT DEFAULT 0 NOT NULL,
    end_page INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_textbook_unit UNIQUE (bookcode, unit_order),
    CONSTRAINT chk_unit_page_range CHECK (start_page <= end_page)
);

-- (3) ams_textbook_shares: 지정 학원 및 시즌 공유 장부
CREATE TABLE IF NOT EXISTS public.ams_textbook_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookcode VARCHAR(100) NOT NULL REFERENCES public.ams_textbooks(bookcode) ON DELETE CASCADE,
    owner_academy_id UUID NOT NULL REFERENCES public.ams_academies(id) ON DELETE CASCADE, -- 부모 교재 소유 학원 (RLS 재귀 방지용)
    target_academy_id UUID NOT NULL REFERENCES public.ams_academies(id) ON DELETE CASCADE,
    valid_until TIMESTAMPTZ,                              -- 시즌 공유 종료일 (NULL이면 무기한/철회전까지)
    is_revoked BOOLEAN DEFAULT false NOT NULL,            -- 공유 철회 여부
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_textbook_share UNIQUE (bookcode, target_academy_id)
);

-- (4) ams_academy_books: 학원별 교재 활성화 및 별칭 설정
CREATE TABLE IF NOT EXISTS public.ams_academy_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES public.ams_academies(id) ON DELETE CASCADE,
    bookcode VARCHAR(100) NOT NULL REFERENCES public.ams_textbooks(bookcode) ON DELETE RESTRICT,
    is_enabled BOOLEAN DEFAULT true NOT NULL,             -- 해당 학원에서 신규 노출 여부
    custom_title VARCHAR(255),                            -- 학원 전용 교재 별칭
    display_order INT DEFAULT 999,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_academy_bookcode UNIQUE (academy_id, bookcode)
);

-- ------------------------------------------------------------------------------
-- 4. 인덱스 및 트리거 바인딩
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_units_bookcode ON public.ams_textbook_units(bookcode, unit_order);
CREATE INDEX IF NOT EXISTS idx_shares_lookup ON public.ams_textbook_shares(target_academy_id, bookcode, is_revoked, valid_until);
CREATE INDEX IF NOT EXISTS idx_shares_owner ON public.ams_textbook_shares(owner_academy_id, bookcode);
CREATE INDEX IF NOT EXISTS idx_academy_books_lookup ON public.ams_academy_books(academy_id, bookcode, is_enabled);

-- updated_at 트리거
DROP TRIGGER IF EXISTS trg_ams_textbooks_updated_at ON public.ams_textbooks;
CREATE TRIGGER trg_ams_textbooks_updated_at BEFORE UPDATE ON public.ams_textbooks
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ams_textbook_units_updated_at ON public.ams_textbook_units;
CREATE TRIGGER trg_ams_textbook_units_updated_at BEFORE UPDATE ON public.ams_textbook_units
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ams_textbook_shares_updated_at ON public.ams_textbook_shares;
CREATE TRIGGER trg_ams_textbook_shares_updated_at BEFORE UPDATE ON public.ams_textbook_shares
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ams_academy_books_updated_at ON public.ams_academy_books;
CREATE TRIGGER trg_ams_academy_books_updated_at BEFORE UPDATE ON public.ams_academy_books
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 불변 컬럼 보호 트리거
DROP TRIGGER IF EXISTS trg_ams_textbooks_immutable ON public.ams_textbooks;
CREATE TRIGGER trg_ams_textbooks_immutable BEFORE UPDATE ON public.ams_textbooks
FOR EACH ROW EXECUTE FUNCTION public.trg_protect_textbook_immutable_fields();

-- 공유 장부 소유 학원 일치 강제 트리거
DROP TRIGGER IF EXISTS trg_ams_textbook_shares_owner ON public.ams_textbook_shares;
CREATE TRIGGER trg_ams_textbook_shares_owner BEFORE INSERT OR UPDATE ON public.ams_textbook_shares
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_textbook_share_owner();

-- ------------------------------------------------------------------------------
-- 5. RLS (Row Level Security) 정책 정의
-- ------------------------------------------------------------------------------
ALTER TABLE public.ams_textbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_textbook_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_textbook_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_academy_books ENABLE ROW LEVEL SECURITY;

-- [A] ams_textbooks

-- 조회 정책:
-- 1) 공용 승인: share_scope = 'public' AND share_status = 'approved'
-- 2) 소유 학원: created_by_academy_id = get_auth_teacher_academy_id()
-- 3) 유효한 지정 공유: share_scope = 'group' AND ams_textbook_shares에 유효한 레코드 존재
-- 4) 플랫폼 마스터
CREATE POLICY "textbooks_select_policy" ON public.ams_textbooks
FOR SELECT TO authenticated USING (
  (share_scope = 'public' AND share_status = 'approved')
  OR (created_by_academy_id = public.get_auth_teacher_academy_id())
  OR (
    share_scope = 'group' 
    AND EXISTS (
      SELECT 1 FROM public.ams_textbook_shares s
      WHERE s.bookcode = ams_textbooks.bookcode
        AND s.target_academy_id = public.get_auth_teacher_academy_id()
        AND s.is_revoked = false
        AND (s.valid_until IS NULL OR s.valid_until >= NOW())
    )
  )
  OR public.is_platform_master()
);

-- 등록 정책:
-- 일반 학원은 본인 소유로만 등록 가능하며, share_status는 'unsubmitted' 또는 'pending'만 가능 (공용 승인 우회 차단)
CREATE POLICY "textbooks_insert_policy" ON public.ams_textbooks
FOR INSERT TO authenticated WITH CHECK (
  public.is_platform_master()
  OR (
    created_by_academy_id = public.get_auth_teacher_academy_id()
    AND share_status IN ('unsubmitted', 'pending')
  )
);

-- 수정 정책:
-- 1) 승인된 공용 교재(share_status = 'approved')는 소유 학원이라도 직접 수정 불가 (마스터만 가능)
-- 2) 비공개/지정공유/승인전 교재는 소유 학원 권한으로 수정 가능
-- 3) 일반 학원은 share_status를 'approved'로 직접 변경할 수 없음
CREATE POLICY "textbooks_update_policy" ON public.ams_textbooks
FOR UPDATE TO authenticated USING (
  public.is_platform_master()
  OR (
    created_by_academy_id = public.get_auth_teacher_academy_id()
    AND share_status <> 'approved'
  )
) WITH CHECK (
  public.is_platform_master()
  OR (
    created_by_academy_id = public.get_auth_teacher_academy_id()
    AND share_status IN ('unsubmitted', 'pending')
  )
);

-- 삭제 정책:
-- 승인된 공용 교재는 삭제 불가. 미승인 교재만 소유 학원 또는 마스터가 삭제 가능
CREATE POLICY "textbooks_delete_policy" ON public.ams_textbooks
FOR DELETE TO authenticated USING (
  (public.is_platform_master() AND share_status <> 'approved')
  OR (
    created_by_academy_id = public.get_auth_teacher_academy_id()
    AND share_status IN ('unsubmitted', 'pending')
  )
);

-- [B] ams_textbook_units (단원 정보)

-- 조회: 부모 교재의 접근 권한을 충족하는 경우에만 단원 조회 가능
CREATE POLICY "units_select_policy" ON public.ams_textbook_units
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.ams_textbooks t
    WHERE t.bookcode = ams_textbook_units.bookcode
      AND (
        (t.share_scope = 'public' AND t.share_status = 'approved')
        OR (t.created_by_academy_id = public.get_auth_teacher_academy_id())
        OR (
          t.share_scope = 'group' 
          AND EXISTS (
            SELECT 1 FROM public.ams_textbook_shares s
            WHERE s.bookcode = t.bookcode
              AND s.target_academy_id = public.get_auth_teacher_academy_id()
              AND s.is_revoked = false
              AND (s.valid_until IS NULL OR s.valid_until >= NOW())
          )
        )
        OR public.is_platform_master()
      )
  )
);

-- 단원 등록/수정/삭제:
-- 마스터이거나, 부모 교재의 소유 학원(승인 전)만 가능 (공유받은 학원은 읽기 전용)
CREATE POLICY "units_modify_policy" ON public.ams_textbook_units
FOR ALL TO authenticated USING (
  public.is_platform_master()
  OR EXISTS (
    SELECT 1 FROM public.ams_textbooks t
    WHERE t.bookcode = ams_textbook_units.bookcode
      AND t.created_by_academy_id = public.get_auth_teacher_academy_id()
      AND t.share_status <> 'approved'
  )
) WITH CHECK (
  public.is_platform_master()
  OR EXISTS (
    SELECT 1 FROM public.ams_textbooks t
    WHERE t.bookcode = ams_textbook_units.bookcode
      AND t.created_by_academy_id = public.get_auth_teacher_academy_id()
      AND t.share_status <> 'approved'
  )
);

-- [C] ams_textbook_shares (지정 공유 장부 - RLS 재귀 배제)

-- 조회: 소유 학원(owner_academy_id), 공유 대상 학원(target_academy_id), 플랫폼 마스터
-- (ams_textbooks 역참조 서브쿼리를 제거하여 RLS 재귀 완전 차단)
CREATE POLICY "shares_select_policy" ON public.ams_textbook_shares
FOR SELECT TO authenticated USING (
  target_academy_id = public.get_auth_teacher_academy_id()
  OR owner_academy_id = public.get_auth_teacher_academy_id()
  OR public.is_platform_master()
);

-- 등록/수정/삭제:
-- 오직 부모 교재의 소유 학원 또는 플랫폼 마스터만 공유를 생성/수정/철회 가능
CREATE POLICY "shares_modify_policy" ON public.ams_textbook_shares
FOR ALL TO authenticated USING (
  public.is_platform_master()
  OR owner_academy_id = public.get_auth_teacher_academy_id()
) WITH CHECK (
  public.is_platform_master()
  OR owner_academy_id = public.get_auth_teacher_academy_id()
);

-- [D] ams_academy_books (학원별 활성화 및 커스텀 설정)

-- 조회: 내 학원의 설정만 조회 (선생님/원장 모두 조회 가능)
CREATE POLICY "academy_books_select_policy" ON public.ams_academy_books
FOR SELECT TO authenticated USING (
  academy_id = public.get_auth_teacher_academy_id()
  OR public.is_platform_master()
);

-- 수정/등록:
-- 원장(admin) 또는 마스터(master)만 수정 가능 (일반 teacher는 수정 불가)
-- 내 학원 장부만 수정 가능하며, 해당 교재가 현재 학원에서 유효하게 접근 가능한 교재여야 함
CREATE POLICY "academy_books_modify_policy" ON public.ams_academy_books
FOR ALL TO authenticated USING (
  (academy_id = public.get_auth_teacher_academy_id() AND public.is_admin_or_master())
  OR public.is_platform_master()
) WITH CHECK (
  ((academy_id = public.get_auth_teacher_academy_id() AND public.is_admin_or_master()) OR public.is_platform_master())
  AND EXISTS (
    SELECT 1 FROM public.ams_textbooks t
    WHERE t.bookcode = ams_academy_books.bookcode
      AND (
        (t.share_scope = 'public' AND t.share_status = 'approved')
        OR (t.created_by_academy_id = ams_academy_books.academy_id)
        OR (
          t.share_scope = 'group'
          AND EXISTS (
            SELECT 1 FROM public.ams_textbook_shares s
            WHERE s.bookcode = t.bookcode
              AND s.target_academy_id = ams_academy_books.academy_id
              AND s.is_revoked = false
              AND (s.valid_until IS NULL OR s.valid_until >= NOW())
          )
        )
        OR public.is_platform_master()
      )
  )
);
