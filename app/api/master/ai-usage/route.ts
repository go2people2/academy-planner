import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

// 📌 [GET] /api/master/ai-usage?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyMasterAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // 기본 기간 설정 (이번 달 1일 ~ 오늘)
    const nowKST = new Date(Date.now() + 9 * 3600 * 1000);
    const defaultStart = new Date(nowKST.getFullYear(), nowKST.getMonth(), 1).toISOString().split('T')[0];
    const defaultEnd = nowKST.toISOString().split('T')[0];

    const startDateStr = startDateParam || defaultStart;
    const endDateStr = endDateParam || defaultEnd;

    // ISO YYYY-MM-DD 날짜 포맷 정규식 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDateStr) || !dateRegex.test(endDateStr)) {
      return NextResponse.json({ success: false, error: '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD 형식)' }, { status: 400 });
    }

    // 💡 기간 조건: 시작일 00:00:00 KST 포함, 종료일의 다음 날 00:00:00 KST 미만
    // UTC로 변환: KST 00:00은 전날 15:00 UTC
    const startUtc = new Date(`${startDateStr}T00:00:00+09:00`).toISOString();
    const endNextDay = new Date(new Date(`${endDateStr}T00:00:00+09:00`).getTime() + 24 * 3600 * 1000).toISOString();

    // 1. 학원 기본 정보 조회 (전체 학원 매핑용)
    const { data: academies, error: acErr } = await supabaseAdmin
      .from('ams_academies')
      .select('id, academy_name, slug')
      .order('created_at', { ascending: true });

    if (acErr || !academies) {
      return NextResponse.json({ success: false, error: acErr?.message || '학원 목록 조회 실패' }, { status: 500 });
    }

    // 2. ams_ai_usage_logs에서 status = 'success'인 로그만 조회
    const { data: logs, error: logErr } = await supabaseAdmin
      .from('ams_ai_usage_logs')
      .select('id, academy_id, provider, model, input_tokens, output_tokens, estimated_cost_usd, created_at')
      .eq('status', 'success')
      .gte('created_at', startUtc)
      .lt('created_at', endNextDay)
      .order('created_at', { ascending: false });

    if (logErr) {
      // 테이블이 아직 미생성된 경우 빈 통계 반환 (안전 처리)
      const isMissingTable = logErr.code === 'PGRST205' || logErr.message?.includes('not find the table');
      if (isMissingTable) {
        return NextResponse.json({
          success: true,
          period: { startDate: startDateStr, endDate: endDateStr },
          summary: {
            totalCount: 0,
            openaiCount: 0,
            geminiCount: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCostUsd: 0,
          },
          academyStats: [],
          tablePending: true,
        });
      }
      return NextResponse.json({ success: false, error: logErr.message }, { status: 500 });
    }

    // 3. 학원별 집계 Map 생성
    const academyMap = new Map<string, {
      academy_id: string;
      academy_name: string;
      slug: string;
      totalCount: number;
      openaiCount: number;
      geminiCount: number;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      latestCreatedAt: string | null;
    }>();

    academies.forEach((ac) => {
      academyMap.set(ac.id, {
        academy_id: ac.id,
        academy_name: ac.academy_name,
        slug: ac.slug,
        totalCount: 0,
        openaiCount: 0,
        geminiCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latestCreatedAt: null,
      });
    });

    let summaryTotalCount = 0;
    let summaryOpenaiCount = 0;
    let summaryGeminiCount = 0;
    let summaryInputTokens = 0;
    let summaryOutputTokens = 0;
    let summaryCostUsd = 0;

    (logs || []).forEach((row) => {
      summaryTotalCount += 1;
      const inTok = Number(row.input_tokens) || 0;
      const outTok = Number(row.output_tokens) || 0;
      const cost = Number(row.estimated_cost_usd) || 0;

      summaryInputTokens += inTok;
      summaryOutputTokens += outTok;
      summaryCostUsd += cost;

      if (row.provider === 'openai') summaryOpenaiCount += 1;
      if (row.provider === 'gemini') summaryGeminiCount += 1;

      const acStat = academyMap.get(row.academy_id);
      if (acStat) {
        acStat.totalCount += 1;
        acStat.inputTokens += inTok;
        acStat.outputTokens += outTok;
        acStat.estimatedCostUsd = Number((acStat.estimatedCostUsd + cost).toFixed(6));
        if (row.provider === 'openai') acStat.openaiCount += 1;
        if (row.provider === 'gemini') acStat.geminiCount += 1;

        if (!acStat.latestCreatedAt || new Date(row.created_at) > new Date(acStat.latestCreatedAt)) {
          acStat.latestCreatedAt = row.created_at;
        }
      }
    });

    // 전체 학원 목록을 정렬 (호출 수 많은 순, 0건인 학원도 포함)
    const academyStats = Array.from(academyMap.values())
      .filter((a) => a.slug !== 'hplan') // 테스트 학원 제외
      .sort((a, b) => b.totalCount - a.totalCount);

    return NextResponse.json({
      success: true,
      period: { startDate: startDateStr, endDate: endDateStr },
      summary: {
        totalCount: summaryTotalCount,
        openaiCount: summaryOpenaiCount,
        geminiCount: summaryGeminiCount,
        totalInputTokens: summaryInputTokens,
        totalOutputTokens: summaryOutputTokens,
        totalCostUsd: Number(summaryCostUsd.toFixed(4)),
      },
      academyStats,
      tablePending: false,
    });

  } catch (err: any) {
    console.error('Master AI usage API error:', err);
    return NextResponse.json({ success: false, error: err.message || '서버 오류' }, { status: 500 });
  }
}
