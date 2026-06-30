import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 💡 서버 사이드에서 RLS(보안 정책)를 우회하여 안전하게 쿼리할 수 있도록 Admin 클라이언트 생성
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured in .env.local' },
        { status: 500 }
      );
    }

    // 1. 폼 데이터에서 이미지 및 메타 정보 추출
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const autoMatch = formData.get('autoMatch') === 'true'; // 자동 매칭 모드 여부
    
    // 학생 메타 정보 (자동 매칭 모드 시 제출용)
    const academyId = formData.get('academyId') as string | null;
    const studentId = formData.get('studentId') as string | null;
    const studentName = formData.get('studentName') as string | null;

    const questionCountStr = formData.get('questionCount') as string | null;
    let questionCount = questionCountStr ? parseInt(questionCountStr, 10) : 30;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file found in the request' },
        { status: 400 }
      );
    }

    // 2. 이미지를 Base64 스트링으로 변환
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    // 💡 [디버깅 모드] 업로드된 사진을 서버 로컬 임시 폴더에 저장하여 진단 지원
    try {
      const fs = require('fs/promises');
      const path = require('path');
      const tempDir = path.join(process.cwd(), 'public', 'temp_omr_scans');
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(path.join(tempDir, 'last_scan.jpg'), buffer);
      console.log('💡 [DEBUG] OMR 스캔 이미지가 임시 저장되었습니다: public/temp_omr_scans/last_scan.jpg');
    } catch (saveErr) {
      console.error('Failed to save debug scan image:', saveErr);
    }

    // 3. 모드별 프롬프트 구성
    let prompt = '';
    const omrStructureGuide = `
[OMR 카드 레이아웃 구조 가이드]
이 OMR 시험지 카드는 문항들이 가로로 정렬된 3개의 세로 기둥(단/Section)으로 분할되어 있습니다.
- 1단 (좌측 기둥): 1번부터 20번 문항이 세로로 정렬되어 있습니다.
- 2단 (중앙 기둥): 21번부터 40번 문항이 세로로 정렬되어 있습니다.
- 3단 (우측 기둥): 41번부터 45번 문항이 세로로 정렬되어 있습니다.

각 문항 번호(Row)별로 가로 방향에 ① ② ③ ④ ⑤ 선택지 동그라미들이 나열되어 있습니다.
동그라미 내부가 컴퓨터용 사인펜 등 검정색 펜으로 완전히 칠해진 번호(마킹 완료)를 찾아내야 합니다.
칠해져 있지 않고 빈 상태로 남은(원래의 연한 회색이나 흰색 동그라미) 선택지는 마킹되지 않은 것입니다.
한 줄에 검정색 마킹이 전혀 존재하지 않는 문항 번호는 반드시 값을 null로 배정하세요.
    `;

    if (autoMatch) {
      // 💡 [시험지 자동 매칭 모드]
      prompt = `
이 이미지는 학생이 작성한 OMR 시험 답안지 사진입니다.
${omrStructureGuide}

[요구사항]
1. OMR 상단 중앙의 '시험 고유번호' 입력 영역을 정확하게 분석하여 최종 4자리 코드를 "examCode" 필드에 반환해 주세요. (예: "4449", "4448")
   - [필독] 이 영역은 상단에 아라비아 숫자를 손글씨로 적어두는 4개의 사각형 칸(Box)이 있고, 그 아래에 세로 방향으로 0~9 마킹 동그라미가 정렬되어 있습니다.
   - 먼저, 상단 사각형 칸 안에 손글씨(또는 인쇄)로 적힌 아라비아 숫자 4자리(예: "4449", "4448")를 1순위로 선명하게 판독하십시오.
   - 그 다음, 아래 세로 마킹 컬럼에서 칠해진 숫자들이 상단 손글씨 숫자와 일치하는지 상호 교차 대조(Crosscheck)하여 오류가 없는 최종 4자리 숫자를 결정하십시오.
   - 최종 결정된 4자리 숫자를 "examCode" 필드에 반드시 문자열로 입력해 주세요. (예: "4449" 또는 "4448")

2. 문항 번호(1번부터 최대 45번까지 존재하는 마킹들을 분석)와 마킹된 번호(1 ~ 5)를 매칭하여 "answers" 필드에 추출해 주세요.
3. 아무런 마킹이 없는 번호는 null로 처리해 주세요.
4. 반드시 아래 JSON 포맷으로만 응답해야 합니다.

출력 JSON 예시:
{
  "examCode": "4449",
  "answers": {
    "1": 3,
    "2": 5,
    "3": "72", // 주관식 필기가 있는 경우 텍스트 판독
    "4": null
  }
}
      `;
    } else {
      // [일반 개별 매칭 모드]
      prompt = `
이 이미지는 학생이 작성한 OMR 시험 답안지 사진입니다.
총 문항 수는 ${questionCount}개입니다.
${omrStructureGuide}

[요구사항]
1. 문항 번호(1번부터 ${questionCount}번까지)와 각 문항별로 학생이 마킹(체크)한 번호(1 ~ 5)를 매칭하여 추출해 주세요.
2. 만약 해당 문항이 주관식 단답형이거나 서술형이고, 손글씨 정답 풀이가 적혀 있다면 한글/영어/숫자를 그대로 텍스트로 인식해 주세요.
3. 마킹을 아예 하지 않고 빈 칸으로 비워둔 번호는 null로 처리해 주세요.
4. 반드시 키(문항번호)와 값(마킹번호 또는 텍스트)으로 구성된 순수 JSON 객체 포맷으로만 응답해야 합니다.

출력 JSON 예시:
{
  "1": 3,
  "2": 5,
  "3": "72",
  "4": null,
  "5": 1
}
      `;
    }

    // 4. OpenAI GPT-4o API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a precise OMR answer sheet parser. Analyze the provided image to retrieve the marked choices and the exam code (if applicable). Return only a single valid JSON object.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', errorText);
      return NextResponse.json(
        { error: `OpenAI API returned error: ${response.statusText}` },
        { status: 500 }
      );
    }

    const responseData = await response.json();
    const resultText = responseData.choices?.[0]?.message?.content;

    // 💡 디버깅용: AI가 실제로 판독해 낸 원본 JSON 문자열을 로컬 터미널 콘솔에 출력
    console.log('=== [AI OMR 판독 원본 결과] ===\n', resultText);

    if (!resultText) {
      return NextResponse.json(
        { error: 'Failed to extract text content from OpenAI response' },
        { status: 500 }
      );
    }

    const parsedData = JSON.parse(resultText);

    // 💡 5. 자동 매칭 모드인 경우 데이터베이스 연동 자동 채점 및 제출
    if (autoMatch) {
      const examCode = parsedData.examCode;
      const parsedAnswers = parsedData.answers || {};

      if (!examCode) {
        return NextResponse.json(
          { error: 'OMR 이미지에서 시험 고유번호를 판독하지 못했습니다.' },
          { status: 400 }
        );
      }

      // 1) Supabase에서 고유코드를 매칭하는 시험지 조회
      // 1) Supabase에서 고유코드를 매칭하는 시험지 조회 (샵 접두사 유연 매칭 지원)
      const cleanedCode = examCode.toString().trim().replace(/^#/, '');
      const codeWithHash = `#${cleanedCode}`;
      const codeWithoutHash = cleanedCode;

      const { data: examData, error: examError } = await supabaseAdmin
        .from('ams_exam_papers')
        .select('*')
        .in('exam_code', [codeWithoutHash, codeWithHash])
        .maybeSingle();

      if (examError) {
        console.error('Exam Query DB Error:', examError);
      }

      if (examError || !examData) {
        return NextResponse.json(
          { error: `마킹된 시험 고유번호 [${examCode}] 에 매치되는 시험지를 시스템에서 찾을 수 없습니다.` },
          { status: 404 }
        );
      }

      // 2) 서버 사이드 실시간 채점 수행 (프론트엔드 균등 백분율 점수 계산과 100% 매칭)
      let correctCount = 0;
      let gradableCount = 0;
      const wrongQuestions: number[] = [];
      const questionTypes = examData.question_types || {};
      const answerKey = examData.answer_key || {};
      
      const qCount = examData.question_count;
      
      for (let i = 1; i <= qCount; i++) {
        const qKey = i.toString();
        const studentAns = parsedAnswers[qKey];
        const correctAns = answerKey[qKey];
        const qType = questionTypes[qKey] || 'multiple_choice';

        if (qType === 'essay') {
          continue; // 서술형은 채점 유예
        }

        gradableCount++;

        if (qType === 'multiple_choice') {
          if (Number(studentAns) === Number(correctAns)) {
            correctCount++;
          } else {
            wrongQuestions.push(i);
          }
        } else if (qType === 'multiple_choice_multi') {
          const sArr = Array.isArray(studentAns) ? studentAns.map(Number).sort() : [Number(studentAns)];
          const cArr = Array.isArray(correctAns) ? correctAns.map(Number).sort() : [Number(correctAns)];
          if (JSON.stringify(sArr) === JSON.stringify(cArr)) {
            correctCount++;
          } else {
            wrongQuestions.push(i);
          }
        } else if (qType === 'short_answer') {
          const sStr = String(studentAns || '').trim().toLowerCase().replace(/\s+/g, '');
          const cStr = String(correctAns || '').trim().toLowerCase().replace(/\s+/g, '');
          if (sStr === cStr && cStr !== '') {
            correctCount++;
          } else {
            wrongQuestions.push(i);
          }
        }
      }

      // 점수 계산 (균등 백분율 배점)
      const autoScore = gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 0;

      // 3) Supabase `ams_exam_submissions` 에 가채점 결과 다이렉트 인서트
      const payload = {
        academy_id: academyId,
        student_id: studentId,
        student_name: studentName,
        exam_id: examData.id,
        answers: parsedAnswers,
        auto_score: autoScore,
        total_score: autoScore,
        wrong_questions: wrongQuestions,
        submitted_at: new Date().toISOString(),
        reveal_answers: false, // 기본 잠금
        input_method: 'scan'
      };

      const { data: subData, error: subError } = await supabaseAdmin
        .from('ams_exam_submissions')
        .insert(payload)
        .select()
        .single();

      if (subError) {
        throw new Error(`답안 제출 정보 저장 실패: ${subError.message}`);
      }

      return NextResponse.json({
        success: true,
        exam: examData,
        submission: subData,
        answers: parsedAnswers
      });
    }

    // [일반 모드] 분석된 정답 정보만 반환
    return NextResponse.json({ success: true, answers: parsedData });
  } catch (error: any) {
    console.error('OCR Processing Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during OMR processing' },
      { status: 500 }
    );
  }
}
