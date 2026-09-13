import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ModuleStatus } from '@/types/modules';

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

// 마스터 권한 검증 헬퍼
async function verifyMasterAuth(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: '인증 토큰이 누락되었습니다.', status: 401 };
  }
  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return { authorized: false, error: '유효하지 않은 세션입니다.', status: 401 };
  }

  const { data: teacher } = await supabaseAdmin
    .from('ams_teachers')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const isMaster = user.app_metadata?.role === 'master' || teacher?.role === 'master';
  if (!isMaster) {
    return { authorized: false, error: '마스터 권한이 필요합니다.', status: 403 };
  }
  return { authorized: true, user };
}

// 1. 학원별 모듈 통합 현황 조회
export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyMasterAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    // 1) 전체 학원 목록 조회
    const { data: academies, error: acErr } = await supabaseAdmin
      .from('ams_academies')
      .select('id, academy_name, slug, operation_settings, created_at')
      .order('created_at', { ascending: true });

    if (acErr || !academies) {
      return NextResponse.json({ success: false, error: acErr?.message || '학원 목록 조회 실패' }, { status: 500 });
    }

    // 2) academy_modules 조회 (테이블 존재 시)
    const { data: rawModules, error: modErr } = await supabaseAdmin
      .from('academy_modules')
      .select('*');

    // 3) academy_devices 조회 (테이블 존재 시)
    const { data: rawDevices } = await supabaseAdmin
      .from('academy_devices')
      .select('*')
      .eq('status', 'active');

    // 4) 최신 활동 조회를 위해 최근 30일간의 ams_session_logs 일지 최신 생성일자 집계
    const { data: recentLogs } = await supabaseAdmin
      .from('ams_session_logs')
      .select('academy_id, session_date, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    const modulesByAcademy = new Map<string, Record<string, any>>();
    if (rawModules && !modErr) {
      rawModules.forEach((m) => {
        if (!modulesByAcademy.has(m.academy_id)) {
          modulesByAcademy.set(m.academy_id, {});
        }
        modulesByAcademy.get(m.academy_id)![m.module_code] = m;
      });
    }

    const devicesByAcademy = new Map<string, any[]>();
    if (rawDevices) {
      rawDevices.forEach((d) => {
        if (!devicesByAcademy.has(d.academy_id)) {
          devicesByAcademy.set(d.academy_id, []);
        }
        devicesByAcademy.get(d.academy_id)!.push(d);
      });
    }

    const latestLogByAcademy = new Map<string, string>();
    if (recentLogs) {
      recentLogs.forEach((log) => {
        if (log.academy_id && !latestLogByAcademy.has(log.academy_id)) {
          latestLogByAcademy.set(log.academy_id, log.created_at || log.session_date);
        }
      });
    }

    // 기본 확정 시드 규칙 정의 (DB 미반영 또는 fallback 상황 대비)
    const legacyActiveSlugs = new Set(['hokma', 'hokma-cn', 'wc-math']);

    const overviewList = academies.map((ac) => {
      const isSuspended = ac.operation_settings?.is_suspended === true;
      const acModules = modulesByAcademy.get(ac.id) || {};
      const acDevices = devicesByAcademy.get(ac.id) || [];

      // 💡 AMS 기본 상태 판정
      let amsStatus: ModuleStatus = 'active';
      if (acModules.ams?.status) {
        amsStatus = acModules.ams.status as ModuleStatus;
      } else if (ac.slug === 'hplan' || isSuspended) {
        amsStatus = 'inactive';
      }

      // 💡 HokmaNote 기본 상태 판정
      let hokmaStatus: ModuleStatus = 'inactive';
      let hokmaMaxDevices = 1;
      if (acModules.hokmanote?.status) {
        hokmaStatus = acModules.hokmanote.status as ModuleStatus;
        hokmaMaxDevices = acModules.hokmanote.max_devices || 1;
      } else if (legacyActiveSlugs.has(ac.slug)) {
        hokmaStatus = 'active';
      }

      // 💡 기존 .env 설치본 여부
      const isLegacy = legacyActiveSlugs.has(ac.slug) && acDevices.length === 0;

      // 💡 최근 활동 계산
      let latestSource: 'AMS' | 'HokmaNote' | 'none' = 'none';
      let latestTimestamp: string | undefined = undefined;
      let displayActivity = '활동 기록 없음';

      const amsLast = latestLogByAcademy.get(ac.id);
      let hokmaLast: string | undefined = undefined;
      if (acDevices.length > 0) {
        const sortedDevices = [...acDevices].sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
        hokmaLast = sortedDevices[0].last_seen_at;
      }

      if (amsLast && hokmaLast) {
        if (new Date(hokmaLast) > new Date(amsLast)) {
          latestSource = 'HokmaNote';
          latestTimestamp = hokmaLast;
        } else {
          latestSource = 'AMS';
          latestTimestamp = amsLast;
        }
      } else if (hokmaLast) {
        latestSource = 'HokmaNote';
        latestTimestamp = hokmaLast;
      } else if (amsLast) {
        latestSource = 'AMS';
        latestTimestamp = amsLast;
      }

      if (latestTimestamp) {
        const diffMs = Date.now() - new Date(latestTimestamp).getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        let timeStr = '';
        if (diffHours < 1) {
          timeStr = '방금 전';
        } else if (diffHours < 24) {
          timeStr = `${diffHours}시간 전`;
        } else if (diffDays < 7) {
          timeStr = `${diffDays}일 전`;
        } else {
          timeStr = latestTimestamp.slice(0, 10);
        }
        displayActivity = `${latestSource} · ${timeStr}`;
      } else if (ac.slug === 'hplan') {
        displayActivity = '테스트 학원';
      }

      return {
        id: ac.id,
        academy_name: ac.academy_name,
        slug: ac.slug,
        is_suspended: isSuspended,
        ams_status: amsStatus,
        hokmanote_status: hokmaStatus,
        hokmanote_max_devices: hokmaMaxDevices,
        active_device_count: acDevices.length,
        registered_devices: acDevices,
        is_legacy_installation: isLegacy,
        latest_activity: {
          source: latestSource,
          timestamp: latestTimestamp,
          display: displayActivity,
        },
      };
    });

    return NextResponse.json({
      success: true,
      academies: overviewList,
    });
  } catch (err: any) {
    console.error('Failed to get module overview:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 2. 학원 모듈 상태 수정 (PATCH)
export async function PATCH(req: NextRequest) {
  try {
    const authCheck = await verifyMasterAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const { academy_id, module_code, status, max_devices } = body;

    if (!academy_id || !module_code || !status) {
      return NextResponse.json({ success: false, error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    if (!['ams', 'hokmanote'].includes(module_code)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 모듈 코드입니다.' }, { status: 400 });
    }

    const validStatuses: ModuleStatus[] = ['inactive', 'trial', 'pending_setup', 'active', 'grace', 'suspended'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 모듈 상태값입니다.' }, { status: 400 });
    }

    const upsertData: Record<string, any> = {
      academy_id,
      module_code,
      status,
      updated_at: new Date().toISOString(),
    };
    if (typeof max_devices === 'number' && max_devices > 0) {
      upsertData.max_devices = max_devices;
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('academy_modules')
      .upsert(upsertData, { onConflict: 'academy_id,module_code' });

    if (upsertErr) {
      console.error('Module upsert error:', upsertErr);
      return NextResponse.json({ success: false, error: `모듈 상태 저장 실패: ${upsertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '모듈 상태가 성공적으로 변경되었습니다.' });
  } catch (err: any) {
    console.error('Failed to update module:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
