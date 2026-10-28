import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateTextbookRequest } from '@/lib/textbookAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * 💡 교재 단원 수정 권한 확인 헬퍼
 * - 플랫폼 마스터(master): 모든 교재 단원 수정 가능
 * - 공용 교재(common--): 마스터 외에는 수정 불가 (읽기 전용)
 * - 학원 원장(admin): 본인 학원에서 등록한 자체 교재만 수정 가능
 */
async function canEditTextbook(bookcode: string, academyId: string, role?: string): Promise<{ permitted: boolean; reason?: string }> {
  if (role === 'master') return { permitted: true };

  if (bookcode.startsWith('common--')) {
    return { permitted: false, reason: '공용 표준 교재(common--)의 단원은 본사(마스터)만 수정할 수 있습니다.' };
  }

  if (role === 'admin') {
    const { data: book } = await supabaseAdmin
      .from('ams_textbooks')
      .select('created_by_academy_id, bookcode')
      .eq('bookcode', bookcode)
      .maybeSingle();

    if (!book) {
      return { permitted: false, reason: '해당 교재를 찾을 수 없습니다.' };
    }

    if (book.created_by_academy_id !== academyId) {
      return { permitted: false, reason: '타 학원의 교재 단원은 수정할 수 없습니다.' };
    }

    return { permitted: true };
  }

  return { permitted: false, reason: '단원을 수정할 권한이 없습니다.' };
}

/**
 * 💡 POST /api/textbooks/units
 * 단원 추가 또는 수정 (Admin / Master)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateTextbookRequest(req);
    if (!auth.success || !auth.academyId) {
      return NextResponse.json({ error: auth.error || '인증 실패' }, { status: auth.status || 401 });
    }

    const body = await req.json();
    const { id, bookcode, unit_order, unit_name, start_page, end_page } = body;

    if (!bookcode || !unit_name) {
      return NextResponse.json({ error: '교재코드와 단원명은 필수입니다.' }, { status: 400 });
    }

    const authCheck = await canEditTextbook(bookcode, auth.academyId, auth.role);
    if (!authCheck.permitted) {
      return NextResponse.json({ error: authCheck.reason || '해당 교재의 단원을 수정할 권한이 없습니다.' }, { status: 403 });
    }

    const payload: any = {
      bookcode,
      unit_order: parseInt(unit_order, 10) || 1,
      unit_name: String(unit_name).trim(),
      start_page: parseInt(start_page, 10) || 0,
      end_page: parseInt(end_page, 10) || 0,
      updated_at: new Date().toISOString(),
    };

    if (id) payload.id = id;

    const { data, error } = await supabaseAdmin
      .from('ams_textbook_units')
      .upsert(payload, { onConflict: id ? 'id' : 'bookcode,unit_order' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, unit: data });
  } catch (err: any) {
    console.error('Error in textbook units POST:', err);
    return NextResponse.json({ error: '단원 저장 실패' }, { status: 500 });
  }
}

/**
 * 💡 DELETE /api/textbooks/units
 * 단원 삭제 (Admin / Master)
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateTextbookRequest(req);
    if (!auth.success || !auth.academyId) {
      return NextResponse.json({ error: auth.error || '인증 실패' }, { status: auth.status || 401 });
    }

    const { searchParams } = new URL(req.url);
    const unitId = searchParams.get('id');
    const bookcode = searchParams.get('bookcode');

    if (!unitId || !bookcode) {
      return NextResponse.json({ error: '단원 ID와 bookcode가 필요합니다.' }, { status: 400 });
    }

    const authCheck = await canEditTextbook(bookcode, auth.academyId, auth.role);
    if (!authCheck.permitted) {
      return NextResponse.json({ error: authCheck.reason || '해당 교재의 단원을 삭제할 권한이 없습니다.' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('ams_textbook_units')
      .delete()
      .eq('id', unitId)
      .eq('bookcode', bookcode);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in textbook units DELETE:', err);
    return NextResponse.json({ error: '단원 삭제 실패' }, { status: 500 });
  }
}
