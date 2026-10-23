import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, authenticateDeviceRequest } from '../../wrong-answers/authHelper';

/**
 * 💡 GET /api/app/v1/students/assigned-books
 * 학생별 배정 교재 조회 (student_book_assignments_v3)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('student_id')?.trim() || null;

    let query = supabaseAdmin
      .from('student_book_assignments_v3')
      .select('student_id, bookcode')
      .eq('academy_id', academyId)
      .eq('status', 'active');

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch student_book_assignments_v3:', error);
      return NextResponse.json(
        { success: false, error: '배정 교재 목록 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 학생 ID를 키로 하는 교재 코드 배열 맵 생성
    const assignments: Record<string, string[]> = {};
    if (data && Array.isArray(data)) {
      for (const row of data) {
        if (!row.student_id || !row.bookcode) continue;
        if (!assignments[row.student_id]) {
          assignments[row.student_id] = [];
        }
        if (!assignments[row.student_id].includes(row.bookcode)) {
          assignments[row.student_id].push(row.bookcode);
        }
      }
    }

    // 단일 학생 조회인데 배정 내역이 없다면 빈 배열로 응답 객체 초기화
    if (studentId && !assignments[studentId]) {
      assignments[studentId] = [];
    }

    return NextResponse.json({
      success: true,
      assignments,
    });
  } catch (err: any) {
    console.error('Exception in assigned-books GET route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 💡 학생 교재 배정 일괄 저장/갱신 핸들러 (POST 및 PUT 공용)
 */
async function handleSaveAssignments(req: NextRequest) {
  try {
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: '유효한 JSON 요청 본문이 필요합니다.' },
        { status: 400 }
      );
    }

    const studentId = body?.student_id?.trim();
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'student_id가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const rawBookcodes = body?.bookcodes;
    if (!Array.isArray(rawBookcodes)) {
      return NextResponse.json(
        { success: false, error: 'bookcodes는 배열 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    // 1. 해당 학원에 소속된 학생인지 검증 (학원 격리 및 외래키 오류 방지)
    const { data: student, error: studentErr } = await supabaseAdmin
      .from('ams_students')
      .select('id')
      .eq('id', studentId)
      .eq('academy_id', academyId)
      .maybeSingle();

    if (studentErr || !student) {
      return NextResponse.json(
        { success: false, error: '해당 학원에 존재하지 않는 학생 ID이거나 접근 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 중복 제거 및 유효한 문자열 필터링
    const uniqueBookcodes = Array.from(
      new Set(
        rawBookcodes
          .filter((code: any) => typeof code === 'string' && code.trim().length > 0)
          .map((code: string) => code.trim())
      )
    );

    // 2. 해당 학원 및 학생의 기존 배정 내역 삭제
    const { error: deleteErr } = await supabaseAdmin
      .from('student_book_assignments_v3')
      .delete()
      .eq('academy_id', academyId)
      .eq('student_id', studentId);

    if (deleteErr) {
      console.error('Failed to clean existing student_book_assignments_v3:', deleteErr);
      return NextResponse.json(
        { success: false, error: '기존 배정 내역 정리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 3. 새로운 배정 교재가 있다면 일괄 삽입
    if (uniqueBookcodes.length > 0) {
      const insertRows = uniqueBookcodes.map((code) => ({
        academy_id: academyId,
        student_id: studentId,
        bookcode: code,
        status: 'active',
      }));

      const { error: insertErr } = await supabaseAdmin
        .from('student_book_assignments_v3')
        .insert(insertRows);

      if (insertErr) {
        console.error('Failed to insert student_book_assignments_v3:', insertErr);
        return NextResponse.json(
          { success: false, error: '신규 교재 배정 저장 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      assigned_count: uniqueBookcodes.length,
    });
  } catch (err: any) {
    console.error('Exception in assigned-books POST/PUT route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleSaveAssignments(req);
}

export async function PUT(req: NextRequest) {
  return handleSaveAssignments(req);
}
