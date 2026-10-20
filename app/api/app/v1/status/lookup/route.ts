import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyHostRequest } from '@/lib/server/hostAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LOOKUP_LIMIT = 100;

export async function POST(req: NextRequest) {
  try {
    // 1. 호스트 토큰 인증
    const auth = await verifyHostRequest(req, supabaseAdmin);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error_code: auth.errorCode, error: auth.error },
        { status: auth.status }
      );
    }

    const academyId = auth.academyId;

    // 2. 요청 본문 파싱 및 검증
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_PAYLOAD', error: '요청 본문이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const { type, ids } = body;

    if (type !== 'student' && type !== 'teacher') {
      return NextResponse.json(
        {
          success: false,
          error_code: 'INVALID_TYPE',
          error: "type은 'student' 또는 'teacher'이어야 합니다.",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_LOOKUP_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error_code: 'INVALID_IDS_ARRAY',
          error: `ids는 1개 이상 ${MAX_LOOKUP_LIMIT}개 이하의 배열이어야 합니다.`,
        },
        { status: 400 }
      );
    }

    // UUID 형식 검증
    for (const id of ids) {
      if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
        return NextResponse.json(
          {
            success: false,
            error_code: 'INVALID_UUID_FORMAT',
            error: `유효하지 않은 UUID 형식이 포함되어 있습니다: ${id}`,
          },
          { status: 400 }
        );
      }
    }

    // 3. 대상 테이블 조회 (academy_id 격리 강제)
    const tableName = type === 'student' ? 'ams_students' : 'ams_teachers';
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('id, is_deleted')
      .eq('academy_id', academyId)
      .in('id', ids);

    if (error) {
      console.error(`[status/lookup] Fetch error on ${tableName}:`, error);
      return NextResponse.json(
        { success: false, error: '상태 조회 중 데이터베이스 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const foundMap = new Map<string, boolean>();
    (data || []).forEach((row: any) => {
      foundMap.set(row.id, !!row.is_deleted);
    });

    // 4. 요청된 각 UUID별 명시적 상태 매핑
    const results = ids.map((id: string) => {
      if (!foundMap.has(id)) {
        return {
          id,
          exists: false,
          status: 'not_found',
        };
      }

      const isDeleted = foundMap.get(id);
      if (type === 'student') {
        return {
          id,
          exists: true,
          status: isDeleted ? 'discharged' : 'active',
        };
      } else {
        return {
          id,
          exists: true,
          status: isDeleted ? 'retired' : 'active',
        };
      }
    });

    return NextResponse.json({
      success: true,
      type,
      results,
    });
  } catch (err: any) {
    console.error('[status/lookup] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
