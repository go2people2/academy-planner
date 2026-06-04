/**
 * 💡 공통 유틸리티 함수 모음
 */

/**
 * 날짜 문자열(YYYY-MM-DD)을 받아 요일(월~일)을 반환합니다.
 */
export function getDayOfWeek(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  // 💡 new Date(dateStr)은 UTC로 처리되어 타임존에 따라 요일이 바뀔 수 있음
  // 하이픈으로 분리하여 로컬 시각 기준으로 생성해야 정확함
  const [year, month, day] = dateStr.split('-').map(Number);
  return days[new Date(year, month - 1, day).getDay()];
}

/**
 * 날짜를 KST 기준으로 YYYY-MM-DD 형식의 문자열로 반환합니다.
 */
export function getTodayStr(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split('T')[0];
}

/**
 * 이름에서 첫 글자를 따서 영문 이니셜(또는 한글 첫 글자)을 반환합니다.
 */
export function getInitial(name: string): string {
  if (!name) return '?';
  const firstChar = name.charAt(0);
  const mapping: Record<string, string> = {
    '김': 'K', '이': 'L', '박': 'P', '최': 'C', '정': 'J', '강': 'K', '조': 'J', '윤': 'Y', '장': 'J', '임': 'L', '한': 'H', '오': 'O', '서': 'S', '신': 'S', '권': 'K', '황': 'H', '안': 'A', '송': 'S', '전': 'J', '홍': 'H', '유': 'Y', '고': 'K', '문': 'M', '양': 'Y', '손': 'S', '배': 'B', '백': 'B', '허': 'H', '남': 'N', '심': 'S', '노': 'N', '하': 'H', '곽': 'K', '성': 'S', '차': 'C', '주': 'J', '우': 'W', '구': 'K', '신': 'S', '임': 'L', '나': 'N', '전': 'J', '민': 'M', '송': 'S', '지': 'J'
  };
  return mapping[firstChar] || firstChar.toUpperCase();
}

