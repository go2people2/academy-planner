import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 💡 안전한 서버 사이드 Admin 클라이언트 생성 (Auth 및 테이블 우회 권한)
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
    // 💡 1. [보안] Bearer 토큰 파싱 및 인증 사용자 검증
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '인증 토큰이 누락되었거나 형식이 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '인증되지 않았거나 만료된 세션입니다.' },
        { status: 401 }
      );
    }

    // 💡 2. [보안] Master Role 서버 검증 (ams_teachers 및 app_metadata)
    const { data: teacher, error: teacherErr } = await supabaseAdmin
      .from('ams_teachers')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (teacherErr) {
      return NextResponse.json(
        { success: false, error: '권한 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const isMaster = user.app_metadata?.role === 'master' || teacher?.role === 'master';
    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다. (Master 권한 필요)' },
        { status: 403 }
      );
    }

    // 💡 3. Body 파싱 및 파라미터 유효성 검증
    const body = await req.json();
    const { academyId, academyName, slug, oldSlug } = body;

    // 파라미터 유효성 검증
    if (!academyId || !academyName || !slug) {
      return NextResponse.json(
        { success: false, error: '모든 필수 입력 값을 기입해 주세요.' },
        { status: 400 }
      );
    }

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanName = academyName.trim();

    // 1. 슬러그 중복 검사
    const { data: duplicate, error: dupErr } = await supabaseAdmin
      .from('ams_academies')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (dupErr) throw dupErr;
    if (duplicate && duplicate.id !== academyId) {
      return NextResponse.json(
        { success: false, error: `슬러그 [${cleanSlug}]는 이미 사용 중입니다. 다른 슬러그를 지정해 주세요.` },
        { status: 400 }
      );
    }

    // 💡 기존 operation_settings 조회하여 is_suspended, AI 설정 및 기능 플래그(features) 병합
    const { data: currentAc } = await supabaseAdmin
      .from('ams_academies')
      .select('operation_settings')
      .eq('id', academyId)
      .maybeSingle();
    
    // 허용된 feature key whitelist 검증 및 boolean sanitize
    const currentFeatures = currentAc?.operation_settings?.features || {};
    const nextFeatures: Record<string, boolean> = { ...currentFeatures };
    if (body.features && typeof body.features === 'object') {
      if (typeof body.features.operations_tools === 'boolean') {
        nextFeatures.operations_tools = body.features.operations_tools;
      }
      if (typeof body.features.learning_resources === 'boolean') {
        nextFeatures.learning_resources = body.features.learning_resources;
      }
      if (typeof body.features.assessment_tools === 'boolean') {
        nextFeatures.assessment_tools = body.features.assessment_tools;
      }
    }

    const currentAiSettings = currentAc?.operation_settings?.ai_settings || {};
    const nextAiSettings = body.aiSettings ? {
      ...currentAiSettings,
      ...(typeof body.aiSettings === 'object' ? body.aiSettings : {})
    } : currentAiSettings;

    const nextSettings = {
      ...(currentAc?.operation_settings || {}),
      is_suspended: body.isSuspended === true,
      ai_settings: nextAiSettings,
      features: nextFeatures
    };

    // 2. ams_academies 학원 테이블 업데이트
    const { data: updateData, error: acError } = await supabaseAdmin
      .from('ams_academies')
      .update({
        academy_name: cleanName,
        slug: cleanSlug,
        operation_settings: nextSettings
      })
      .eq('id', academyId)
      .select('id');

    if (acError) {
      console.error('Academy Update Error:', acError);
      return NextResponse.json(
        { success: false, error: `학원 정보 수정 실패: ${acError.message}` },
        { status: 400 }
      );
    }

    if (!updateData || updateData.length === 0) {
      return NextResponse.json(
        { success: false, error: '수정 대상 학원을 찾을 수 없거나 권한이 부족합니다.' },
        { status: 404 }
      );
    }

    // 3. 오답노트 테이블(academies) 동시 업데이트
    if (oldSlug) {
      const { data: waAc, error: waErr } = await supabaseAdmin
        .from('academies')
        .select('id')
        .eq('slug', oldSlug)
        .maybeSingle();

      if (!waErr && waAc) {
        const { error: waUpdateErr } = await supabaseAdmin
          .from('academies')
          .update({
            academy_name: cleanName,
            slug: cleanSlug
          })
          .eq('id', waAc.id);
        
        if (waUpdateErr) {
          console.error('Failed to sync WA academy slug:', waUpdateErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '학원 정보가 정상적으로 수정되었습니다.'
    });

  } catch (err: any) {
    console.error('Update Academy Fatal Error:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
