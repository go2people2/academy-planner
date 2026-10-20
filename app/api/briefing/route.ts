import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractRealStudentId } from '@/lib/rowIdentity';

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

// 허용된 AI 모델 목록
const ALLOWED_MODELS: Record<string, { provider: 'openai' | 'gemini'; actualModel: string }> = {
  openai: { provider: 'openai', actualModel: 'gpt-4o' },
  gemini: { provider: 'gemini', actualModel: 'gemini-3.5-flash-lite' },
};

// 교사 세션 JWT 인증 검증 헬퍼
async function authenticateTeacher(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: '인증 토큰이 누락되었습니다.', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  const tempClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } }
  );

  const { data: { user }, error: authErr } = await tempClient.auth.getUser(token);
  if (authErr || !user) {
    return { error: '유효하지 않거나 만료된 세션입니다.', status: 401 };
  }

  // ams_teachers 테이블에서 교사 프로필 조회
  const { data: teacher, error: teacherErr } = await supabaseAdmin
    .from('ams_teachers')
    .select('id, academy_id, role')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .maybeSingle();

  if (teacherErr || !teacher) {
    return { error: '등록된 교사 프로필을 찾을 수 없습니다.', status: 403 };
  }

  // 브리핑 실행 가능한 교사 role 검증 ('admin', 'teacher', 'master')
  const allowedRoles = ['admin', 'teacher', 'master'];
  if (!teacher.role || !allowedRoles.includes(teacher.role)) {
    return { error: '브리핑 실행 권한이 없습니다.', status: 403 };
  }

  return { teacher, user };
}

export async function POST(req: NextRequest) {
  try {
    // 1. JWT 인증 및 교사 프로필 검증 (토큰 없거나 유효하지 않으면 401)
    const authResult = await authenticateTeacher(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { teacher } = authResult;

    const body = await req.json();
    const { studentId, model, startDate, endDate, requestId } = body;

    if (!studentId) {
      return NextResponse.json({ error: '학생 ID(studentId)가 필요합니다.' }, { status: 400 });
    }

    // 2. 모델 화이트리스트 검증 (허용되지 않은 모델값은 AI 호출 전 400 차단)
    const modelKey = model || 'openai';
    if (!ALLOWED_MODELS[modelKey]) {
      return NextResponse.json({ error: `지원하지 않는 모델입니다: ${modelKey}` }, { status: 400 });
    }
    const { provider: verifiedProvider, actualModel: verifiedActualModel } = ALLOWED_MODELS[modelKey];

    const safeRequestId = (requestId && typeof requestId === 'string') 
      ? requestId.slice(0, 64) 
      : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 3. 학생 기본 정보 조회 (공용 헬퍼로 파생 ID 정제 및 DB 검증된 academy_id 획득)
    const realStudentId = extractRealStudentId(String(studentId));

    const { data: student, error: stdErr } = await supabaseAdmin
      .from('ams_students')
      .select('id, name, academy_id, grade, school, course, class_name')
      .eq('id', realStudentId)
      .maybeSingle();

    if (stdErr || !student) {
      if (stdErr) {
        console.error('[Briefing API] ams_students query error:', stdErr);
      }
      return NextResponse.json({ error: '학생 정보를 불러오지 못했습니다.' }, { status: 404 });
    }

    // 4. 테넌트 검증: 학생 소속 학원과 교사 소속 학원이 일치해야 함
    if (student.academy_id !== teacher.academy_id) {
      return NextResponse.json({ error: '타 학원 학생의 브리핑을 생성할 수 없습니다.' }, { status: 403 });
    }

    const verifiedAcademyId = student.academy_id;

    // 5. 사전 멱등성 검사 (동일 academy_id + feature + request_id 성공 건 존재 시 409 Conflict 반환)
    const { data: existingSuccess } = await supabaseAdmin
      .from('ams_ai_usage_logs')
      .select('id')
      .eq('academy_id', verifiedAcademyId)
      .eq('feature', 'briefing')
      .eq('request_id', safeRequestId)
      .eq('status', 'success')
      .maybeSingle();

    if (existingSuccess) {
      return NextResponse.json({
        error: '동일한 브리핑 생성 요청이 이미 처리되었습니다. 필요하면 브리핑 생성을 다시 눌러 새로 생성해 주세요.'
      }, { status: 409 });
    }

    // 💡 날짜 기본값 설정 (오늘 기준 최근 30일)
    const todayKST = new Date(Date.now() + 9 * 3600 * 1000);
    const defaultEndDate = todayKST.toISOString().split('T')[0];
    const defaultStartDate = new Date(todayKST.getTime() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const finalStartDate = startDate || defaultStartDate;
    const finalEndDate = endDate || defaultEndDate;

    // 6. 학원 정보 및 operation_settings 조회 (커스텀 프롬프트 로드용)
    let academySettings: any = null;
    const { data: academy } = await supabaseAdmin
      .from('ams_academies')
      .select('operation_settings')
      .eq('id', verifiedAcademyId)
      .maybeSingle();
    if (academy?.operation_settings) {
      academySettings = academy.operation_settings;
    }

    // 2. 설정된 기간의 수업 일지 조회 (정제된 student.id 기준)
    const { data: sessionLogs, error: logErr } = await supabaseAdmin
      .from('ams_session_logs')
      .select('*')
      .eq('student_id', student.id)
      .gte('session_date', finalStartDate)
      .lte('session_date', finalEndDate)
      .order('session_date', { ascending: false });

    if (logErr) {
      console.error('Error fetching session logs:', logErr);
    }

    // 3. 설정된 기간의 OMR 시험 제출 정보 및 시험지 조인 (정제된 student.id 기준)
    const { data: examSubmissions, error: examErr } = await supabaseAdmin
      .from('ams_exam_submissions')
      .select(`
        id,
        total_score,
        wrong_questions,
        submitted_at,
        ams_exam_papers (
          title,
          year,
          semester,
          question_count
        )
      `)
      .eq('student_id', student.id)
      .gte('submitted_at', `${finalStartDate}T00:00:00`)
      .lte('submitted_at', `${finalEndDate}T23:59:59`)
      .order('submitted_at', { ascending: false });

    if (examErr) {
      console.error('Error fetching exam submissions:', examErr);
    }

    // 4. 데이터 가공 및 AI용 데이터 컨텍스트(텍스트) 구성
    const formattedLogs = (sessionLogs || []).map((l: any) => {
      const parts: string[] = [`- 날짜: ${l.session_date}`];
      if (l.attendance_status) parts.push(`출결: ${l.attendance_status}`);
      if (l.classwork_text) parts.push(`진도: ${l.classwork_text}`);
      if (l.homework_text) parts.push(`숙제: ${l.homework_text}`);
      if (l.hw_checked_today !== undefined && l.hw_checked_today !== null) {
        parts.push(`숙제점검: ${l.hw_checked_today ? '완료' : '미검사/미흡'}`);
      }

      // 테스트 기록 (test_status, test_id)
      const tStatus = (l.test_status || '').trim();
      const tId = (l.test_id || '').trim();
      let testDesc = '';
      if (tStatus && tId && tStatus !== tId) {
        testDesc = `${tStatus} (${tId})`;
      } else {
        testDesc = tStatus || tId;
      }
      if (testDesc) parts.push(`테스트/평가: ${testDesc}`);

      // 숫자 점수 (0점도 유효 점수로 포함)
      if (l.test_score !== null && l.test_score !== undefined && l.test_score !== '') {
        parts.push(`점수: ${l.test_score}점`);
      }

      if (l.special_notes) parts.push(`특이사항: ${l.special_notes}`);
      return parts.join(' / ');
    }).join('\n');

    const formattedExams = (examSubmissions || []).map((sub: any) => {
      const paper = sub.ams_exam_papers;
      return `- 시험명: [${paper?.year}년 ${paper?.semester || ''}] ${paper?.title || '정기 시험'} / 점수: ${sub.total_score}점 (총 ${paper?.question_count || 0}문항) / 틀린 문항 번호: ${Array.isArray(sub.wrong_questions) ? sub.wrong_questions.join(', ') : '없음'}`;
    }).join('\n');

    // 5. 프롬프트 생성 (학원별 커스텀 프롬프트 우선 적용, 비어 있을 시 디폴트 탑재)
    const customPrompt = academySettings?.ai_settings?.custom_prompt;
    const systemPrompt = (customPrompt && customPrompt.trim()) 
      ? customPrompt.trim()
      : `
당신은 수학 학원의 원장님과 담당 강사를 돕는 전문적인 인공지능 학습 컨설턴트 및 상담 분석가입니다.
전달받은 학생의 기본 정보, 최근 수업 일지 데이터(출결, 진도, 숙제 이행, 단원평가/일일테스트/주간평가 기록, 특이사항), 그리고 정기 OMR 고사 성적(있는 경우)을 종합 분석하여 **"학부모 상담용 고품질 리포트"**를 한국어로 작성해야 합니다.

[분석 및 해석 핵심 원칙]
1. 평가 점수 해석 원칙:
   - 만점, 배점, 범위, 난이도가 명확히 제공되지 않은 경우 점수만으로 "성적이 낮다/높다/하락했다"고 단정하지 마십시오.
   - '2/8', '6/8', '20점', '44점'처럼 서로 형식이 다른 평가는 단순 평균하거나 직접 비교하지 마십시오.
   - 특히 총점이 불명확한 점수(예: 20점)는 성취 수준을 단정하는 근거로 과도하게 해석하지 말고, 단원별로 반복되는 오답 유형이나 점검 필요 여부를 중심으로 분석하십시오.
   - 점수·정답 수가 기록된 경우 "해당 평가에서", "최근 기록상", "해당 단원 평가에서는"처럼 범위를 한정하여 서술하십시오.
2. 학습 이해도 및 사실 기반 표현:
   - 단일 평가나 소수 기록만으로 학생 전체의 수학 이해도가 부족하다고 일반화하거나 낙인찍지 마십시오.
   - "이해도가 부족하다", "실력이 낮다" 대신 "최근 단원평가 기록에서는 … 관련 문항에서 어려움이 확인됩니다", "해당 단원의 개념 적용 과정과 오답 유형을 추가로 점검할 필요가 있습니다"처럼 관찰 기반의 객관적 표현을 사용하십시오.
   - 데이터에 없는 원인(시험 긴장, 집중력 부족 등)을 자의적으로 추측하지 마십시오.
3. 태도 및 성실도 표현:
   - 출석·숙제 점검 기록을 바탕으로 균형 있게 평가하되, '미검사/미흡' 기록만으로 실제 미제출이나 불성실로 단정하지 마십시오.
   - "최근 기록상 숙제 수행은 전반적으로 안정적입니다. 다만 일부 날짜에는 완료 범위 또는 점검 기록을 한 번 더 확인할 필요가 있습니다."와 같이 중립적이고 사실 기반으로 서술하십시오.
4. OMR 정기 고사 데이터 관련:
   - OMR 정기고사 데이터가 없더라도 "평가가 실시되지 않았다"거나 "기록이 누락되었다"고 절대 추측하지 마십시오. 수업 일지의 평가 기록을 유효한 학습 근거로 활용하십시오.
   - 수업 일지에도 테스트 기록이 전혀 없는 경우에만 "최근 일지에서 평가 기록을 확인하기 어렵다"처럼 사실에 근거하여 간결하게 서술하십시오.

작성 시 반드시 다음의 세 가지 영역으로 구성해 주세요. 각 영역 제목은 마크다운 H3(###) 태그를 사용하여 구분해 주세요.

### 📊 성적 및 취약점 분석
- [강점] 실제 기록에 근거한 학생의 강점 또는 긍정적 성취 관찰 1개 이상 제시
- [보완점] 실제 기록에서 확인되는 보완이 필요한 단원 또는 학습 요소 1~2개 도출
- [해석 주의] 평가마다 범위와 배점이 달라 점수 단순 비교에는 한계가 있음을 간략히 짚고 오답 유형 중심의 점검 필요성 언급
- [지도 방향] 학원에서 진행할 구체적인 다음 지도 방향 1개 제시 (예: 개념/조건 정리 → 기본 유형 다지기 → 오답 유형 재확인 등)

### 🏃 성실도 및 태도 분석
- 출결 및 숙제 이행 기록에서 확인되는 실제 긍정 사항 요약
- 점검 기록상 확인이 필요한 사항이 있다면 학생을 비난하지 않고 중립적으로 서술
- 수업 일지의 진도 소화력과 태도 변화를 종합하여 학생의 공부 습관을 객관적으로 설명

### 🗣️ 학부모 추천 상담 멘트
- 선생님이 학부모님과 전화/대면 상담 시 구두로 직접 전달하기에 가장 적절하고 신뢰감 높은 전문 교사 톤의 발화 가이드(대화 멘트)를 제공합니다.
- 다음의 4단계 흐름으로 자연스럽게 구성해 주세요:
  1. 실제 관찰된 긍정 사항
  2. 최근 확인된 보완 지점 (낙인 없이 객관적 표현)
  3. 학원에서 진행할 구체적 지원 계획 (추상적이지 않고 무엇을 어떤 방식으로 확인할지 구체적 1문장 이상)
  4. 다음 확인 시점 또는 점검 방식 안내
- 없는 일정이나 확인되지 않은 클리닉을 사실처럼 만들어내지 말고 제공된 데이터 범위 내에서 작성하십시오.
`.trim();

    const userPrompt = `
[학생 기본 정보]
- 이름: ${student.name}
- 학년: ${student.grade || '미정'}
- 학교: ${student.school || '미정'}
- 코스/클래스: ${student.course || '미정'} / ${student.class_name || '미정'}

[최근 수업 일지 기록 (진도, 숙제, 일일/단원평가)]
${formattedLogs || '기록된 수업 일지가 없습니다.'}

[최근 정기/OMR 고사 성적 (있는 경우)]
${formattedExams || '기록된 정기 고사 성적이 없습니다.'}
`.trim();

    let aiResponseText = '';

    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCostUsd = 0;

    // 7. 검증된 모델 분기 처리 및 API 호출
    if (verifiedProvider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY?.trim().replace(/[\r\n\s]+/g, '');
      if (!apiKey) {
        return NextResponse.json({ error: 'OpenAI API 키가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.' }, { status: 500 });
      }

      const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: verifiedActualModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7
        })
      });

      if (!openAiRes.ok) {
        const errorData = await openAiRes.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API 호출 에러: ${openAiRes.status}`);
      }

      const openAiData = await openAiRes.json();
      aiResponseText = openAiData.choices?.[0]?.message?.content || '';

      // OpenAI 토큰 추출 및 추정 원가 산출 (gpt-4o: 입력 $2.50/1M, 출력 $10.00/1M 기준)
      inputTokens = Number(openAiData.usage?.prompt_tokens) || 0;
      outputTokens = Number(openAiData.usage?.completion_tokens) || 0;
      estimatedCostUsd = Number(((inputTokens * 2.5 + outputTokens * 10.0) / 1000000).toFixed(6));

    } else if (verifiedProvider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY?.trim().replace(/[\r\n\s]+/g, '');
      if (!apiKey) {
        return NextResponse.json({ error: 'Google Gemini API 키가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.' }, { status: 500 });
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${verifiedActualModel}:generateContent?key=${apiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `${systemPrompt}\n\n[데이터]\n${userPrompt}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7
          }
        })
      });

      if (!geminiRes.ok) {
        const errorData = await geminiRes.json().catch(() => ({}));
        console.error('Gemini API Error details:', { status: geminiRes.status, model: verifiedActualModel, message: errorData.error?.message });
        throw new Error(`Gemini 브리핑 연결에 실패했습니다. (상태 코드: ${geminiRes.status})`);
      }

      const geminiData = await geminiRes.json();
      aiResponseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Gemini 토큰 추출 및 추정 원가 산출 (gemini-3.5-flash-lite: 입력 $0.075/1M, 출력 $0.30/1M 기준)
      inputTokens = Number(geminiData.usageMetadata?.promptTokenCount) || 0;
      outputTokens = Number(geminiData.usageMetadata?.candidatesTokenCount) || 0;
      estimatedCostUsd = Number(((inputTokens * 0.075 + outputTokens * 0.30) / 1000000).toFixed(6));
    }

    // 8. 💡 [사용량 계량 로그 기록] AI 호출 성공 시에만 success 로그 저장
    // 로그 실패 시에도 브리핑 본문 반환을 블로킹하지 않도록 안전 분리
    try {
      const { error: insertErr } = await supabaseAdmin
        .from('ams_ai_usage_logs')
        .insert([
          {
            request_id: safeRequestId,
            academy_id: verifiedAcademyId,
            student_id: student.id,
            teacher_id: teacher.id,
            feature: 'briefing',
            provider: verifiedProvider,
            model: verifiedActualModel,
            status: 'success',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            estimated_cost_usd: estimatedCostUsd,
          }
        ]);

      if (insertErr) {
        // 민감 정보 없는 구조화된 에러 로깅
        console.error('⚠️ [AI Usage Log Insert Error]:', {
          code: insertErr.code,
          message: insertErr.message,
          requestId: safeRequestId,
          academyId: verifiedAcademyId,
          provider: verifiedProvider,
          model: verifiedActualModel,
        });
      }
    } catch (logEx: any) {
      console.error('⚠️ [AI Usage Log Unexpected Error]:', {
        error: logEx?.message || 'Unknown logging error',
        requestId: safeRequestId,
      });
    }

    return NextResponse.json({
      success: true,
      model: modelKey,
      briefing: aiResponseText
    });

  } catch (error: any) {
    console.error('❌ [Briefing API Error]:', error.message || error);
    return NextResponse.json({
      error: error.message || '상담 브리핑 생성 중 알 수 없는 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
