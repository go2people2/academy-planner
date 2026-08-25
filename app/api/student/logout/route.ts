import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const allowInsecure = process.env.ALLOW_INSECURE_STUDENT_COOKIE === 'true' || process.env.NODE_ENV !== 'production';
  const isSecure = !allowInsecure;

  const response = NextResponse.json({ success: true });

  // 💡 학생 세션 쿠키 즉시 만료 및 제거
  response.cookies.set({
    name: 'ams_student_session',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: 0
  });

  return response;
}
