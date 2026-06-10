import { NextResponse } from 'next/server';
import { SolapiMessageService } from 'solapi';

// 💡 환경 변수에서 솔라피 인증 정보 로드
const API_KEY = process.env.SOLAPI_API_KEY || '';
const API_SECRET = process.env.SOLAPI_API_SECRET || '';
const SENDER_NUMBER = process.env.SOLAPI_SENDER_NUMBER || '';
const TEMPLATE_ID = process.env.SOLAPI_TEMPLATE_ID || ''; // 알림톡 템플릿 ID
const PF_ID = process.env.SOLAPI_PF_ID || ''; // 카카오 비즈니스 채널 ID

const messageService = new SolapiMessageService(API_KEY, API_SECRET);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentName, phone, sessionData, academyName } = body;

    if (!phone) {
      return NextResponse.json({ error: '수신 번호가 없습니다.' }, { status: 400 });
    }

    // 💡 휴대폰 번호 형식 정리 (하이픈 제거)
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // 💡 메시지 본문 구성
    const reportText = `
[${academyName || 'Hokma Math'} 학습 리포트]
안녕하세요, ${studentName} 학생의 오늘 수업 내용입니다.

📚 진도: ${sessionData.classwork_text || '-'}
🏠 과제: ${sessionData.homework_text || '-'}
📝 테스트: ${sessionData.test_id || '-'} ${sessionData.test_score ? `(${sessionData.test_score}%)` : ''}
🔔 예정: ${sessionData.next_quiz_text || '-'}
(목표: 오답 ${sessionData.next_quiz_cut || 0}개 이하 통과)

항상 최선을 다해 지도하겠습니다. 감사합니다.
`.trim();

    const messagePayload: any = {
      to: cleanPhone,
      from: SENDER_NUMBER,
      text: reportText,
    };

    // 알림톡 템플릿 ID와 PF ID가 설정되어 있는 경우 알림톡으로 전송
    if (TEMPLATE_ID && PF_ID) {
      messagePayload.kakaoOptions = {
        pfId: PF_ID,
        templateId: TEMPLATE_ID,
      };
    }

    const result: any = await messageService.send(messagePayload);

    return NextResponse.json({ 
      success: true, 
      messageId: result.messageId,
      status: result.statusCode 
    });

  } catch (error: any) {
    console.error('❌ [Report API] Error:', error);
    return NextResponse.json({ 
      error: error.message || '메시지 전송 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
