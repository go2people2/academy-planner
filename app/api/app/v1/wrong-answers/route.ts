import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, authenticateDeviceRequest } from './authHelper';

/**
 * 💡 GET /api/app/v1/wrong-answers
 * 호크마노트 v3 전용 오답 목록 조회 (wrong_answer_submissions_v3)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    const { searchParams } = new URL(req.url);
    const statusParam = (searchParams.get('status') || 'pending').trim().toLowerCase();
    const studentId = searchParams.get('student_id')?.trim() || null;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    const validStatuses = ['pending', 'completed', 'all'];
    if (!validStatuses.includes(statusParam)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 status 값입니다. ('pending', 'completed', 'all' 중 하나여야 합니다)" },
        { status: 400 }
      );
    }

    const selectCols = 'id, academy_id, student_id, student_name, bookcode, book_name, chapter_codes, problem_codes, problems_detail, memo, status, metadata, created_at';

    let query = supabaseAdmin
      .from('wrong_answer_submissions_v3')
      .select(selectCols, { count: 'exact' })
      .eq('academy_id', academyId);

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (statusParam !== 'all') {
      query = query.eq('status', statusParam);
    }

    const { data: submissions, count, error: queryErr } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryErr) {
      console.error('Failed to fetch wrong_answer_submissions_v3:', queryErr);
      return NextResponse.json(
        { success: false, error: '오답 수신함 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      submissions: submissions || [],
      data: submissions || [],
      total: count ?? (submissions?.length || 0),
      limit,
      offset,
    });
  } catch (err: any) {
    console.error('Exception in wrong-answers GET route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 💡 PATCH /api/app/v1/wrong-answers
 * 호크마노트 v3 전용 오답 상태 변경 (Body 또는 Query의 id 기준)
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { searchParams } = new URL(req.url);
    const submissionId = (body?.id || searchParams.get('id'))?.trim();
    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: '오답 ID가 지정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const targetStatus = (body?.status || 'completed').trim().toLowerCase();
    const nowIso = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from('wrong_answer_submissions_v3')
      .select('id, metadata')
      .eq('id', submissionId)
      .eq('academy_id', academyId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '해당 학원의 오답 제출 건을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const meta = (existing.metadata && typeof existing.metadata === 'object') ? { ...existing.metadata } : {};
    if (targetStatus === 'completed') {
      meta.completed_at = nowIso;
    }

    const { data, error } = await supabaseAdmin
      .from('wrong_answer_submissions_v3')
      .update({
        status: targetStatus,
        metadata: meta,
      })
      .eq('id', submissionId)
      .eq('academy_id', academyId)
      .select('id');

    if (error) {
      console.error('Failed to update wrong_answer_submissions_v3:', error);
      return NextResponse.json(
        { success: false, error: '오답 상태 변경 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: '해당 학원의 오답 제출 건을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '처리 완료되었습니다.',
      id: data[0].id,
    });
  } catch (err: any) {
    console.error('Exception in wrong-answers PATCH route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 💡 DELETE /api/app/v1/wrong-answers
 * 호크마노트 v3 전용 오답 삭제 (Body 또는 Query의 id 기준)
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { searchParams } = new URL(req.url);
    const submissionId = (body?.id || searchParams.get('id'))?.trim();
    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: '오답 ID가 지정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('wrong_answer_submissions_v3')
      .delete()
      .eq('id', submissionId)
      .eq('academy_id', academyId)
      .select('id');

    if (error) {
      console.error('Failed to delete wrong_answer_submissions_v3:', error);
      return NextResponse.json(
        { success: false, error: '오답 삭제 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: '해당 학원의 오답 제출 건을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '영구 삭제되었습니다.',
      id: data[0].id,
    });
  } catch (err: any) {
    console.error('Exception in wrong-answers DELETE route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
