import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 💡 안전한 서버 사이드 Admin 클라이언트 생성 (RLS 우회 권한 보유)
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

export async function POST(req: NextRequest) {
  try {
    // 1. Authorization 헤더 검증을 통한 세션 유저 식별
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증 토큰이 누락되었습니다.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // 임시 클라이언트를 토큰으로 서명하여 유저 객체 정보 획득
    const tempClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { auth: { persistSession: false } }
    );
    
    const { data: { user }, error: authErr } = await tempClient.auth.getUser(token);
    if (authErr || !user) {
      console.error('[API] User verification failed:', authErr?.message);
      return NextResponse.json({ error: '유효하지 않은 세션입니다.' }, { status: 401 });
    }

    const body = await req.json();
    const { academyId, updates } = body;

    if (!academyId || !updates) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    // 2. 권한 검증: ams_teachers 테이블에서 원장(admin) 또는 마스터(master) 권한 확인
    const { data: teacher, error: teacherErr } = await supabaseAdmin
      .from('ams_teachers')
      .select('role, academy_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (teacherErr || !teacher) {
      console.error('[API] Teacher lookup failed:', teacherErr?.message);
      return NextResponse.json({ error: '교사 프로필을 찾을 수 없습니다.' }, { status: 403 });
    }

    // 마스터가 아닌 경우, 반드시 본인 학원의 설정만 수정 가능하도록 제한
    const isMaster = teacher.role === 'master';
    const isAdmin = teacher.role === 'admin';

    if (!isMaster && (!isAdmin || teacher.academy_id !== academyId)) {
      return NextResponse.json({ error: '학원 설정을 수정할 권한이 없습니다.' }, { status: 403 });
    }

    // 💡 [Surgical Update] ams_academies에서 병합해야 하는 오브젝트 필드(operation_settings 등) 갱신 처리
    // DB의 기존 데이터를 읽어서 덮어쓰기 방식으로 병합
    const { data: currentAcademy, error: fetchErr } = await supabaseAdmin
      .from('ams_academies')
      .select('*')
      .eq('id', academyId)
      .maybeSingle();

    if (fetchErr || !currentAcademy) {
      return NextResponse.json({ error: '대상 학원을 찾을 수 없습니다.' }, { status: 404 });
    }

    const dbPayload: any = {};
    Object.keys(updates).forEach(key => {
      if (typeof updates[key] === 'object' && updates[key] !== null && currentAcademy[key]) {
        dbPayload[key] = { ...currentAcademy[key], ...updates[key] };
      } else {
        dbPayload[key] = updates[key];
      }
    });

    // 3. ams_academies 테이블 업데이트 (RLS 우회 적용)
    const { data: updatedData, error: updateErr } = await supabaseAdmin
      .from('ams_academies')
      .update(dbPayload)
      .eq('id', academyId)
      .select();

    if (updateErr) {
      console.error('[API] Academy update failed:', updateErr.message);
      return NextResponse.json({ error: '학원 정보 저장 실패' }, { status: 500 });
    }

    if (!updatedData || updatedData.length === 0) {
      return NextResponse.json({ error: '업데이트된 행이 없습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updatedData[0] });

  } catch (error: any) {
    console.error('[API] Academy update fatal error:', error);
    return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
  }
}
