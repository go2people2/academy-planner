import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateTextbookRequest } from '@/lib/textbookAuth';
import { getVisibleTextbookMasterList } from '@/lib/textbookService';
import { validateNewBookcode } from '@/lib/textbookCode';
import { normalizeUnits, syncBookUnits } from '@/lib/masterTextbookUnits';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateTextbookRequest(req);
    if (!auth.success || !auth.academyId) {
      return NextResponse.json(
        { error: auth.error || '인증되지 않은 요청입니다.' },
        { status: auth.status || 401 }
      );
    }

    const textbooks = await getVisibleTextbookMasterList(auth.academyId);
    return NextResponse.json(textbooks);
  } catch (error) {
    console.error('Textbook master API error:', error);
    return NextResponse.json({ error: 'Failed to fetch textbooks' }, { status: 500 });
  }
}

/**
 * 💡 POST /api/textbooks
 * 각 학원의 자체 전용 교재(private) 등록 (원장/마스터 권한)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateTextbookRequest(req);
    if (!auth.success || !auth.academyId) {
      return NextResponse.json(
        { error: auth.error || '인증되지 않은 요청입니다.' },
        { status: auth.status || 401 }
      );
    }

    if (auth.role !== 'admin' && auth.role !== 'master') {
      return NextResponse.json({ error: '교재 등록 권한이 없습니다. (원장 권한 필요)' }, { status: 403 });
    }

    const { data: academy } = await supabaseAdmin
      .from('ams_academies')
      .select('id, slug, academy_name')
      .eq('id', auth.academyId)
      .maybeSingle();

    if (!academy?.slug) {
      return NextResponse.json({ error: '학원 정보를 확인할 수 없습니다.' }, { status: 400 });
    }

    const body = await req.json();
    const { bookcode, title, grade, category, publisher, e_period } = body;

    if (!bookcode || !title) {
      return NextResponse.json({ error: '교재코드와 교재명은 필수입니다.' }, { status: 400 });
    }

    // 학원 전용 교재는 반드시 해당 학원의 고유 slug로 시작해야 함
    const codeError = validateNewBookcode(String(bookcode).trim(), academy.slug);
    if (codeError) return NextResponse.json({ error: codeError }, { status: 400 });

    const { units, error: unitErr } = normalizeUnits(body.units);
    if (unitErr) return NextResponse.json({ error: unitErr }, { status: 400 });

    const cleanBookcode = String(bookcode).trim();
    const payload = {
      bookcode: cleanBookcode,
      title: String(title).trim(),
      grade: grade ? String(grade).trim() : null,
      category: category ? String(category).trim() : '정규',
      publisher: publisher ? String(publisher).trim() : (academy.academy_name || '자체제작'),
      e_period: e_period ? String(e_period).trim() : '20',
      status: '활성',
      share_scope: 'private',
      share_status: 'unsubmitted',
      has_problem_data: false,
      created_by_academy_id: auth.academyId,
      updated_at: new Date().toISOString(),
    };

    const { data: textbook, error: insertErr } = await supabaseAdmin
      .from('ams_textbooks')
      .insert(payload)
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: '이미 존재하는 교재코드입니다.' }, { status: 409 });
      }
      throw insertErr;
    }

    if (units && units.length > 0) {
      try {
        await syncBookUnits(cleanBookcode, units);
      } catch (e) {
        await supabaseAdmin.from('ams_textbooks').delete().eq('bookcode', cleanBookcode);
        throw e;
      }
    }

    await supabaseAdmin
      .from('ams_academy_books')
      .upsert({
        academy_id: auth.academyId,
        bookcode: cleanBookcode,
        is_enabled: true,
        custom_title: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'academy_id,bookcode' });

    return NextResponse.json({ success: true, textbook, unit_count: units?.length || 0 });
  } catch (error: any) {
    console.error('Academy textbook POST error:', error);
    return NextResponse.json({ error: '자체 교재 등록 실패: ' + (error?.message || '') }, { status: 500 });
  }
}
