/**
 * 💡 교재 관리 클라이언트 인증 헬퍼
 * 브라우저 localStorage에 저장된 현재 로그인 사용자(ams_user)의 ID를 추출하여
 * 교재 API 요청 시 필수 권한 검증용 헤더(x-ams-user-id)를 생성합니다.
 */
export function getTextbookAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    try {
      const userStr = localStorage.getItem('ams_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user?.id) {
          headers['x-ams-user-id'] = user.id;
        }
      }
    } catch (err) {
      console.warn('Failed to parse ams_user from localStorage', err);
    }
  }

  return headers;
}
