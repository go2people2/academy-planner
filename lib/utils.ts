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
    '김': 'K', '이': 'L', '박': 'P', '최': 'C', '정': 'J', '강': 'K', '조': 'J', '윤': 'Y', '장': 'J', '임': 'L', '한': 'H', '오': 'O', '서': 'S', '신': 'S', '권': 'K', '황': 'H', '안': 'A', '송': 'S', '전': 'J', '홍': 'H', '유': 'Y', '고': 'K', '문': 'M', '양': 'Y', '손': 'S', '배': 'B', '백': 'B', '허': 'H', '남': 'N', '심': 'S', '노': 'N', '하': 'H', '곽': 'K', '성': 'S', '차': 'C', '주': 'J', '우': 'W', '구': 'K', '나': 'N', '민': 'M', '지': 'J'
  };
  return mapping[firstChar] || firstChar.toUpperCase();
}

/**
 * 💡 인라인 테스트 파싱 함수
 * "- [제목] : [점수] , [메모]" 형식을 파싱합니다.
 * 쉼표 이후의 모든 텍스트(줄바꿈 포함)는 다음 하이픈('-')이 나타나기 전까지 메모로 간주합니다.
 */
export interface ParsedTest {
  name: string;
  score: string;
  numericScore: number;
  maxScore: number;
  memo: string;
}

export function parseInlineTests(text: string | undefined | null): ParsedTest[] | null {
  if (!text) return null;
  const lines = text.split('\n');
  const tests: ParsedTest[] = [];
  let currentTest: ParsedTest | null = null;
  
  for (const line of lines) {
    if (line.trim().startsWith('-')) {
      if (currentTest) tests.push(currentTest);
      
      const content = line.trim().substring(1).trim(); // 맨 앞의 '-' 제거
      const parts = content.split(':');
      
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const rest = parts.slice(1).join(':').trim(); // 콜론이 여러 개일 경우 대비
        
        // 쉼표(,)를 기준으로 점수와 메모 분리
        const scoreMemoParts = rest.split(',');
        const scoreStr = scoreMemoParts[0].trim();
        const memo = scoreMemoParts.slice(1).join(',').trim(); // 쉼표가 메모 안에 또 있을 경우 대비
        
        let numericScore = 0;
        let maxScore = 100; // 슬래시 없으면 기본 100점
        
        const cleanScore = scoreStr.replace(/[^0-9/]/g, ''); // 숫자와 슬래시만 추출
        if (cleanScore.includes('/')) {
          const parts = cleanScore.split('/');
          numericScore = parseInt(parts[0]) || 0;
          maxScore = parseInt(parts[1]) || 10;
        } else {
          numericScore = parseInt(cleanScore) || 0;
        }
        
        currentTest = { name, score: scoreStr, numericScore, maxScore, memo };
      } else {
        // 콜론(:)이 없는 경우 전부 이름으로 간주
        currentTest = { name: content, score: '', numericScore: 0, maxScore: 100, memo: '' };
      }
    } else {
      // 💡 하이픈으로 시작하지 않는 줄은 이전 테스트의 메모에 줄바꿈과 함께 이어붙임!
      if (currentTest) {
        currentTest.memo += (currentTest.memo ? '\n' : '') + line.trim();
      }
    }
  }
  
  if (currentTest) tests.push(currentTest);
  
  return tests.length > 0 ? tests : null;
}
