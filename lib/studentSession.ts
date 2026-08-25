import crypto from 'crypto';

const SECRET_KEY = process.env.STUDENT_PORTAL_TOKEN_SECRET || 'hokma-student-portal-auth-secret-key-2026-safe-guard-99';

export interface StudentSessionPayload {
  student_id: string;
  academy_id: string;
  name: string;
  exp: number; // Unix timestamp in seconds
}

export function createStudentToken(studentId: string, academyId: string, name: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  // 💡 [보안 규칙 3] 학생 세션 만료 12시간 (최대 24시간 이내)
  const exp = Math.floor(Date.now() / 1000) + (12 * 60 * 60);
  
  const payload: StudentSessionPayload = {
    student_id: studentId,
    academy_id: academyId,
    name: name,
    exp
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyStudentToken(token: string): StudentSessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null; // 서명 불일치 (위조)
  }

  try {
    const payload: StudentSessionPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    );

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // 만료됨
    }

    if (!payload.student_id || !payload.academy_id) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}
