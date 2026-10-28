import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeUnits, syncBookUnits, fetchAllUnitBookcodes, fetchBookUnits } from '@/lib/masterTextbookUnits';
import { COMMON_PREFIX, validateNewBookcode } from '@/lib/textbookCode';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * 💡 마스터 권한 검증 헬퍼 (Bearer 토큰 or x-ams-user-id)
 */
async function verifyMasterAuth(req: NextRequest) {
  // 1. Bearer Token 검증
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) {
      const { data: teacher } = await supabaseAdmin
        .from('ams_teachers')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .maybeSingle();

      if (user.app_metadata?.role === 'master' || teacher?.role === 'master') {
        return { authorized: true };
      }
    }
  }

  // 2. x-ams-user-id 헤더 검증 (로컬 세션)
  const amsUserId = req.headers.get('x-ams-user-id');
  if (amsUserId) {
    const { data: dbTeacher } = await supabaseAdmin
      .from('ams_teachers')
      .select('role')
      .eq('id', amsUserId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (dbTeacher?.role === 'master') {
      return { authorized: true };
    }
  }

  return { authorized: false, error: '마스터 권한이 필요합니다.', status: 403 };
}

/**
 * 💡 GET /api/master/textbooks
 * 전체 교재 목록 및 통계 데이터 조회 (Master Portal)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyMasterAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 0. 단일 교재 단원 조회 (편집 모달용): ?bookcode=xxx
    const singleCode = new URL(req.url).searchParams.get('bookcode');
    if (singleCode) {
      return NextResponse.json({ success: true, units: await fetchBookUnits(singleCode) });
    }

    // 1. 전체 교재 목록 조회
    const { data: books, error: bookErr } = await supabaseAdmin
      .from('ams_textbooks')
      .select('bookcode, title, grade, category, publisher, e_period, status, share_scope, share_status, has_problem_data, created_at, updated_at')
      .order('title', { ascending: true });

    if (bookErr) throw bookErr;

    // 2. 단원 수 매핑 (1000행 제한 없이 전체 조회)
    const units = (await fetchAllUnitBookcodes()).map(bookcode => ({ bookcode }));

    const unitCountMap: Record<string, number> = {};
    for (const u of units) {
      unitCountMap[u.bookcode] = (unitCountMap[u.bookcode] || 0) + 1;
    }

    const textbooks = (books || []).map(b => ({
      ...b,
      unit_count: unitCountMap[b.bookcode] || 0,
    }));

    // 3. 통계 계산
    const stats = {
      total_count: textbooks.length,
      public_count: textbooks.filter(b => b.share_scope === 'public' && b.share_status === 'approved').length,
      custom_count: textbooks.filter(b => b.share_scope !== 'public').length,
      active_count: textbooks.filter(b => b.status === '활성').length,
      inactive_count: textbooks.filter(b => b.status === '비활성').length,
      total_units: units?.length || 0,
    };

    // 4. 학원 목록 (등록 모달의 소유 학원 선택용 — 민감 컬럼은 조회하지 않음)
    const { data: academyRows } = await supabaseAdmin
      .from('ams_academies')
      .select('id, slug, academy_name')
      .order('slug', { ascending: true });
    const academies = (academyRows || []).map(a => ({ id: a.id, slug: a.slug, name: a.academy_name }));

    return NextResponse.json({ success: true, stats, textbooks, academies });
  } catch (err: any) {
    console.error('Error in master textbooks GET:', err);
    return NextResponse.json({ error: '교재 목록 및 통계 조회 실패' }, { status: 500 });
  }
}

/**
 * 💡 POST /api/master/textbooks
 * 신규 공용 교재 등록 (Master Portal)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyMasterAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { bookcode, title, grade, category, publisher, e_period, owner_academy_id, owner_slug } = body;

    if (!bookcode || !title) {
      return NextResponse.json({ error: '교재코드와 교재명은 필수입니다.' }, { status: 400 });
    }

    // 소유 결정: owner_slug / owner_academy_id 없으면 공용(common), 있으면 해당 학원 전용(slug 접두어)
    let ownerAcademyId: string | null = null;
    let expectedPrefix = COMMON_PREFIX;
    const targetSlug = (owner_slug || '').trim().toLowerCase();

    if (targetSlug) {
      const { data: academy } = await supabaseAdmin
        .from('ams_academies')
        .select('id, slug')
        .eq('slug', targetSlug)
        .maybeSingle();
      if (!academy?.id) {
        return NextResponse.json({ error: `입력하신 학원 식별자(slug: '${targetSlug}')를 등록된 학원 목록에서 찾을 수 없습니다.` }, { status: 400 });
      }
      ownerAcademyId = academy.id;
      expectedPrefix = academy.slug;
    } else if (owner_academy_id) {
      const { data: academy } = await supabaseAdmin
        .from('ams_academies')
        .select('id, slug')
        .eq('id', owner_academy_id)
        .maybeSingle();
      if (!academy?.slug) {
        return NextResponse.json({ error: '선택한 학원을 찾을 수 없습니다.' }, { status: 400 });
      }
      ownerAcademyId = academy.id;
      expectedPrefix = academy.slug;
    }

    const codeError = validateNewBookcode(String(bookcode).trim(), expectedPrefix);
    if (codeError) return NextResponse.json({ error: codeError }, { status: 400 });

    const { units, error: unitErr } = normalizeUnits(body.units);
    if (unitErr) return NextResponse.json({ error: unitErr }, { status: 400 });

    const isCommon = ownerAcademyId === null;
    const payload = {
      bookcode: String(bookcode).trim(),
      title: String(title).trim(),
      grade: grade ? String(grade).trim() : null,
      category: category ? String(category).trim() : '정규',
      publisher: publisher ? String(publisher).trim() : '시중출판사',
      e_period: e_period ? String(e_period).trim() : '20',
      status: '활성',
      share_scope: isCommon ? 'public' : 'private',
      share_status: isCommon ? 'approved' : 'unsubmitted',
      has_problem_data: false,
      created_by_academy_id: ownerAcademyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('ams_textbooks')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 존재하는 교재코드입니다.' }, { status: 409 });
      }
      throw error;
    }

    // 단원 동시 등록 (실패 시 방금 만든 교재를 되돌려 반쪽 등록 방지)
    if (units && units.length > 0) {
      try {
        await syncBookUnits(payload.bookcode, units);
      } catch (e) {
        await supabaseAdmin.from('ams_textbooks').delete().eq('bookcode', payload.bookcode);
        throw e;
      }
    }

    return NextResponse.json({ success: true, textbook: data, unit_count: units?.length || 0 });
  } catch (err: any) {
    console.error('Error in master textbooks POST:', err);
    return NextResponse.json({ error: '신규 공용 교재 등록 실패' }, { status: 500 });
  }
}

/**
 * 💡 PATCH /api/master/textbooks
 * 교재 수정: 상태(활성/비활성), 기본 정보, 단원 목록 중 전달된 항목만 반영
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyMasterAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { bookcode, status, title, grade, category, publisher, e_period } = body;

    if (!bookcode) {
      return NextResponse.json({ error: 'bookcode가 필요합니다.' }, { status: 400 });
    }
    if (status !== undefined && !['활성', '비활성'].includes(status)) {
      return NextResponse.json({ error: '상태는 활성/비활성만 가능합니다.' }, { status: 400 });
    }
    if (title !== undefined && !String(title).trim()) {
      return NextResponse.json({ error: '교재명은 비워둘 수 없습니다.' }, { status: 400 });
    }

    const { units, error: unitErr } = normalizeUnits(body.units);
    if (unitErr) return NextResponse.json({ error: unitErr }, { status: 400 });

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status !== undefined) updates.status = status;
    if (title !== undefined) updates.title = String(title).trim();
    if (grade !== undefined) updates.grade = grade ? String(grade).trim() : null;
    if (category !== undefined) updates.category = category ? String(category).trim() : '정규';
    if (publisher !== undefined) updates.publisher = publisher ? String(publisher).trim() : null;
    if (e_period !== undefined) updates.e_period = e_period ? String(e_period).trim() : null;

    const { data, error } = await supabaseAdmin
      .from('ams_textbooks')
      .update(updates)
      .eq('bookcode', bookcode)
      .select()
      .single();

    if (error) throw error;

    if (units !== undefined) await syncBookUnits(bookcode, units);

    return NextResponse.json({ success: true, textbook: data });
  } catch (err: any) {
    console.error('Error in master textbooks PATCH:', err);
    return NextResponse.json({ error: '교재 수정 실패' }, { status: 500 });
  }
}

/**
 * 💡 DELETE /api/master/textbooks
 * 교재 및 연결된 단원, 학원 설정 일괄 영구 삭제
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyMasterAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const bookcode = searchParams.get('bookcode')?.trim();
    if (!bookcode) {
      return NextResponse.json({ error: '삭제할 bookcode가 필요합니다.' }, { status: 400 });
    }

    await supabaseAdmin.from('ams_textbook_units').delete().eq('bookcode', bookcode);
    await supabaseAdmin.from('ams_academy_books').delete().eq('bookcode', bookcode);
    await supabaseAdmin.from('ams_textbook_shares').delete().eq('bookcode', bookcode);
    const { error } = await supabaseAdmin.from('ams_textbooks').delete().eq('bookcode', bookcode);
    if (error) throw error;

    return NextResponse.json({ success: true, message: '교재 및 단원이 삭제되었습니다.', bookcode });
  } catch (err: any) {
    console.error('Error in master textbooks DELETE:', err);
    return NextResponse.json({ error: '교재 삭제 실패: ' + (err?.message || '') }, { status: 500 });
  }
}
