import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, authenticateDeviceRequest } from '../authHelper';

/**
 * 💡 PATCH /api/app/v1/wrong-answers/[id]
 * 호크마노트 v3 전용 오답 상태 변경 (URL id 기준)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    const resolvedParams = await params;
    const submissionId = resolvedParams.id?.trim();
    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: '오답 ID가 지정되지 않았습니다.' },
        { status: 400 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
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
      console.error('Failed to complete wrong_answer_submissions_v3:', error);
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
    console.error('Exception in wrong-answers PATCH [id] route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 💡 DELETE /api/app/v1/wrong-answers/[id]
 * 호크마노트 v3 전용 오답 삭제 (URL id 기준)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    const resolvedParams = await params;
    const submissionId = resolvedParams.id?.trim();
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
      console.error('Failed to delete from wrong_answer_submissions_v3:', error);
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
    console.error('Exception in wrong-answers DELETE [id] route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
