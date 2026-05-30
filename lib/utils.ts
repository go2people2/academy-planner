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
 * 날짜 문자열을 MM.DD 형식으로 변환합니다.
 */
export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.slice(5).replace('-', '.');
}
