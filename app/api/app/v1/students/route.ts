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

const CHUNK_SIZE = 1000;

export async function GET(req: NextRequest) {
  try {
    // 1. 호스트 토큰 및 권한 검증
    const auth = await verifyHostRequest(req, supabaseAdmin);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error_code: auth.errorCode, error: auth.error },
        { status: auth.status }
      );
    }

    const academyId = auth.academyId;

    // 2. 전체 학생 데이터 조회 (Supabase 1,000행 제한 대응을 위한 페이지네이션 순회)
    const allStudents: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('ams_students')
        .select(`
          id,
          academy_id,
          name,
          school,
          grade,
          class_name,
          teacher_id,
          class_days,
          assigned_books,
          course,
          phone,
          registration_date,
          created_at
        `)
        .eq('academy_id', academyId)
        .eq('is_deleted', false)
        .order('name', { ascending: true })
        .range(from, from + CHUNK_SIZE - 1);

      if (error) {
        console.error('[students] Failed to fetch students:', error);
        return NextResponse.json(
          { success: false, error: '학생 목록 조회 중 데이터베이스 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      if (data && data.length > 0) {
        allStudents.push(...data);
        if (data.length < CHUNK_SIZE) {
          hasMore = false;
        } else {
          from += CHUNK_SIZE;
        }
      } else {
        hasMore = false;
      }
    }

    return NextResponse.json({
      success: true,
      count: allStudents.length,
      students: allStudents,
    });
  } catch (err: any) {
    console.error('[students] Fatal Exception:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
