import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 💡 RLS 우회용 Supabase Admin 클라이언트 생성
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, model, startDate, endDate } = body;

    if (!studentId) {
      return NextResponse.json({ error: '학생 ID(studentId)가 필요합니다.' }, { status: 400 });
    }

    const selectedModel = model || 'openai';
    const supabase = getSupabase();

    // 💡 날짜 기본값 설정 (오늘 기준 최근 30일)
    const todayKST = new Date(Date.now() + 9 * 3600 * 1000);
    const defaultEndDate = todayKST.toISOString().split('T')[0];
    const defaultStartDate = new Date(todayKST.getTime() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const finalStartDate = startDate || defaultStartDate;
    const finalEndDate = endDate || defaultEndDate;

    // 1. 학생 기본 정보 조회
    const { data: student, error: stdErr } = await supabase
      .from('ams_students')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (stdErr || !student) {
      return NextResponse.json({ error: '학생 정보를 불러오지 못했습니다.' }, { status: 404 });
    }

    // 2. 설정된 기간의 수업 일지 조회
    const { data: sessionLogs, error: logErr } = await supabase
      .from('ams_session_logs')
      .select('*')
      .eq('student_id', studentId)
      .gte('session_date', finalStartDate)
      .lte('session_date', finalEndDate)
      .order('session_date', { ascending: false });

    if (logErr) {
      console.error('Error fetching session logs:', logErr);
    }

    // 3. 설정된 기간의 OMR 시험 제출 정보 및 시험지 조인
    const { data: examSubmissions, error: examErr } = await supabase
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
      .eq('student_id', studentId)
      .gte('submitted_at', `${finalStartDate}T00:00:00`)
      .lte('submitted_at', `${finalEndDate}T23:59:59`)
      .order('submitted_at', { ascending: false });

    if (examErr) {
      console.error('Error fetching exam submissions:', examErr);
    }

    // 4. 데이터 가공 및 AI용 데이터 컨텍스트(텍스트) 구성
    const formattedLogs = (sessionLogs || []).map((l: any) => {
      return `- 날짜: ${l.session_date} / 출결: ${l.attendance_status || '정보없음'} / 일지 상태: ${l.status || 'neutral'} / 숙제체크: ${l.hw_checked_today ? '완료' : '미검사/미흡'} / 성적: ${l.test_score ? `${l.test_score}점` : '없음'} / 특이사항: ${l.special_notes || '없음'}`;
    }).join('\n');

    const formattedExams = (examSubmissions || []).map((sub: any) => {
      const paper = sub.ams_exam_papers;
      return `- 시험명: [${paper?.year}년 ${paper?.semester || ''}] ${paper?.title || '정기 시험'} / 점수: ${sub.total_score}점 (총 ${paper?.question_count || 0}문항) / 틀린 문항 번호: ${Array.isArray(sub.wrong_questions) ? sub.wrong_questions.join(', ') : '없음'}`;
    }).join('\n');

    // 5. 프롬프트 생성
    const systemPrompt = `
당신은 수학 학원의 원장님과 담당 강사를 돕는 전문적인 인공지능 학습 컨설턴트 및 상담 분석가입니다.
전달받은 학생의 기본 정보, 최근 10회 수업 일지 데이터(출결, 숙제 태도, 평소 테스트 점수, 특이사항), 그리고 최근에 수행한 OMR 정기 고사 시험 성적 정보를 종합 분석하여 **"학부모 상담용 고품질 리포트"**를 한국어로 작성해야 합니다.

작성 시 반드시 다음의 세 가지 영역으로 구성해 주세요. 각 영역 제목은 마크다운 H3(###) 태그를 사용하여 구분해 주세요.

### 📊 성적 및 취약점 분석
- 최근 중간/기말고사 OMR 시험 점수 추이를 요약하고, 틀린 문항 번호를 토대로 분석한 학생의 수학적 취약 부분(예: 서술형 풀이 누락, 특정 단원 계산 실수 등)을 명확하게 도출합니다.
- 평소 수업 퀴즈 점수와의 비교를 통해 실전 시험에서의 긴장도나 개념 이해 수준을 대비하여 설명합니다.

### 🏃 성실도 및 태도 분석
- 출결 상태(결석/지각 횟수) 및 최근 10회차의 숙제 수행률(이행 완료 비율 등)을 수치적으로 종합 요약합니다.
- 수업 일지에 기록된 특이사항과 태도 상태(perfect, good, poor 등)를 반영하여 공부 습관과 태도 변화를 설명합니다.

### 🗣️ 학부모 추천 상담 멘트
- 선생님이 학부모님과 전화 혹은 대면 상담할 때 구두로 직접 전달하기에 가장 적절하고 신뢰감 높은 구체적인 발화 가이드(대화 멘트)를 제공합니다.
- 지나치게 딱딱한 어조보다는 친근하면서도 객관적인 사실을 짚고, 향후 개선을 위한 학원의 클리닉 계획을 담아 안심할 수 있는 어조로 작성해 주세요.
`.trim();

    const userPrompt = `
[학생 기본 정보]
- 이름: ${student.name}
- 학년: ${student.grade}
- 학교: ${student.school}
- 코스/클래스: ${student.course || '미정'} / ${student.class || '미정'}

[최근 10회차 수업 일지 기록]
${formattedLogs || '기록된 수업 일지가 없습니다.'}

[최근 정기/OMR 고사 성적]
${formattedExams || '기록된 정기 고사 성적이 없습니다.'}
`.trim();

    let aiResponseText = '';

    // 6. 모델 분기 처리 및 API 호출
    if (selectedModel === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
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
          model: 'gpt-4o',
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

    } else if (selectedModel === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: 'Google Gemini API 키가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.' }, { status: 500 });
      }

      // Gemini 1.5 Pro API direct fetch 호출
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
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
        throw new Error(errorData.error?.message || `Gemini API 호출 에러: ${geminiRes.status}`);
      }

      const geminiData = await geminiRes.json();
      aiResponseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      return NextResponse.json({ error: `지원하지 않는 모델입니다: ${selectedModel}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      model: selectedModel,
      briefing: aiResponseText
    });

  } catch (error: any) {
    console.error('❌ [Briefing API Error]:', error);
    return NextResponse.json({
      error: error.message || '상담 브리핑 생성 중 알 수 없는 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
