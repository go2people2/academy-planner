import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin, authenticateDeviceRequest } from '../../wrong-answers/authHelper';

/**
 * 💡 POST /api/app/v1/students/reset-pin
 * 학생 모바일 4자리 PIN 번호 초기화 (student_users)
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 기기 토큰 검증 및 academy_id 추출 (학원 격리 보장)
    const auth = await authenticateDeviceRequest(req);
    if (!auth.success) return auth.response;
    const academyId = auth.academyId;

    // 2. 요청 Body 파싱 및 유효성 검증
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: '유효한 JSON 요청 본문이 필요합니다.' },
        { status: 400 }
      );
    }

    const studentId = body?.student_id?.trim();
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'student_id가 누락되었습니다.' },
        { status: 400 }
      );
    }

    let rawPin = body?.pin;
    let pinStr = typeof rawPin === 'string' ? rawPin.trim() : (typeof rawPin === 'number' ? String(rawPin).trim() : '1234');
    if (!pinStr) pinStr = '1234';

    if (!/^\d{4,8}$/.test(pinStr)) {
      return NextResponse.json(
        { success: false, error: 'PIN은 4자리 이상 8자리 이하의 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    // 3. 해당 학원에 소속된 학생인지 검증 (학원 격리 및 타 학원 침범 차단)
    const { data: student, error: studentErr } = await supabaseAdmin
      .from('ams_students')
      .select('id')
      .eq('id', studentId)
      .eq('academy_id', academyId)
      .maybeSingle();

    if (studentErr || !student) {
      return NextResponse.json(
        { success: false, error: '해당 학원에 존재하지 않는 학생 ID이거나 접근 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 4. 모바일 앱 규격에 맞춰 bcrypt($2a$06$) 해싱
    const hashedPin = bcrypt.hashSync(pinStr, 6);

    // 5. student_users 테이블의 pin_code_hash 업데이트 및 실패 카운트 초기화
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('student_users')
      .update({
        pin_code_hash: hashedPin,
        failed_login_attempts: 0,
      })
      .eq('id', studentId)
      .eq('academy_id', academyId)
      .select('id');

    if (updateErr) {
      console.error('Failed to update student_users pin_code_hash:', updateErr);
      return NextResponse.json(
        { success: false, error: 'PIN 초기화 중 데이터베이스 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { success: false, error: '학생 로그인 계정(student_users)을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'PIN이 성공적으로 초기화되었습니다.',
    });
  } catch (err: any) {
    console.error('Exception in reset-pin route:', err);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
