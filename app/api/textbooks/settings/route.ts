import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateTextbookRequest } from '@/lib/textbookAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * 💡 GET /api/textbooks/settings
 * 학원별 교재 ON/OFF 및 별칭 설정 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateTextbookRequest(req);
    if (!auth.success || !auth.academyId) {
      return NextResponse.json({ error: auth.error || '인증 실패' }, { status: auth.status || 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('ams_academy_books')
      .select('bookcode, is_enabled, custom_title')
      .eq('academy_id', auth.academyId);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Error in textbooks settings GET:', err);
    return NextResponse.json({ error: '설정 조회 실패' }, { status: 500 });
  }
}

/**
 * 💡 POST /api/textbooks/settings
 * 학원별 교재 ON/OFF 스위치 및 맞춤 별칭 저장 (Admin / Master 전용)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateTextbookRequest(req);
    if (!auth.success || !auth.academyId) {
      return NextResponse.json({ error: auth.error || '인증 실패' }, { status: auth.status || 401 });
    }

    // 원장 또는 총괄 마스터만 수정 가능
    if (auth.role !== 'admin' && auth.role !== 'master') {
      return NextResponse.json({ error: '수정 권한이 없습니다. (원장 전용)' }, { status: 403 });
    }

    const body = await req.json();
    const { bookcode, is_enabled, custom_title } = body;

    if (!bookcode || typeof bookcode !== 'string') {
      return NextResponse.json({ error: '유효한 bookcode가 필요합니다.' }, { status: 400 });
    }

    const payload: any = {
      academy_id: auth.academyId,
      bookcode: bookcode.trim(),
      updated_at: new Date().toISOString(),
    };

    if (typeof is_enabled === 'boolean') {
      payload.is_enabled = is_enabled;
    }
    if (custom_title !== undefined) {
      payload.custom_title = custom_title ? String(custom_title).trim() : null;
    }

    const { data, error } = await supabaseAdmin
      .from('ams_academy_books')
      .upsert(payload, { onConflict: 'academy_id,bookcode' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, setting: data });
  } catch (err: any) {
    console.error('Error in textbooks settings POST:', err);
    return NextResponse.json({ error: '설정 저장 실패' }, { status: 500 });
  }
}
