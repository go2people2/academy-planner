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
 * 💡 ACA2000 규격 반명용 접두사 추출 헬퍼
 * 규칙:
 *     정규수업 -> ''
 *     선택과목(아카 반명 입력 시) -> '[아카 반명]-'
 *     선택과목(아카 반명 비어있을 시) -> '[선택과목 명칭]-'
 *     선택과목(미지정 시) -> '특강-'
 */
export function getCoursePrefix(isSpecialClass?: boolean, electiveCourse?: any): string {
  if (!isSpecialClass) return '';
  const akaName = electiveCourse?.className?.trim();
  if (akaName) {
    return `${akaName}-`;
  }
  const subj = electiveCourse?.subject?.trim();
  if (!subj) {
    return '특강-';
  }
  return `${subj}-`;
}

/**
 * 💡 인라인 테스트 파싱 함수
 * "- [제목] : [점수] , [메모]" 형식을 파싱합니다.
 * 쉼표 이후의 모든 텍스트(줄바꿈 포함)는 다음 하이픈('-')이 나타나기 전까지 메모로 간주합니다.
 */
export interface ParsedTest {
  name: string;
  score: string;
  numericScore: number | null;
  maxScore: number;
  isPass: boolean | null;
  memo: string;
  explicitCut?: number | null;
}

export function parseInlineTests(
  text: string | undefined | null, 
  defaultScoreCut: number = 80, 
  defaultCountCut: number = 2
): ParsedTest[] | null {
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
        
        // 쉼표(,,)를 기준으로 점수와 메모 분리
        const scoreMemoParts = rest.split(',,');
        const scoreStr = scoreMemoParts[0].trim();
        const memo = scoreMemoParts.slice(1).join(',,').trim(); // 쉼표가 메모 안에 또 있을 경우 대비
        
        let numericScore: number | null = null;
        let maxScore = 100; // 슬래시 없으면 기본 100점
        let explicitCut: number | null = null;
        let isPass: boolean | null = null;
        
        const cleanScore = scoreStr.replace(/[^0-9/.]/g, ''); // 숫자, 슬래시, 소수점(.)만 추출
        if (cleanScore.includes('/')) {
          const parts = cleanScore.split('/');
          numericScore = parts[0] === '' ? null : (parseFloat(parts[0]) || 0);
          maxScore = parseInt(parts[1]) || 10;
          if (parts.length >= 3 && parts[2] !== '') {
            explicitCut = parseInt(parts[2]); // 3번째 값은 커트라인(오답허용개수 혹은 100점만점시 목표점수)
          }
        } else {
          numericScore = cleanScore === '' ? null : (parseFloat(cleanScore) || 0);
        }
        
        // 💡 통과(Pass) 여부 계산 로직 (채점 전이면 isPass는 null 유지)
        if (numericScore !== null) {
          if (maxScore === 100) {
            // 100점 만점일 때는 커트라인이 '목표 점수' (이상이어야 통과)
            const targetScore = explicitCut !== null && !isNaN(explicitCut) ? explicitCut : defaultScoreCut;
            isPass = numericScore >= targetScore;
          } else {
            // 100점 만점이 아닐 때(개수형)는 커트라인이 '오답 허용 개수' (이하로 틀려야 통과)
            const allowableMisses = explicitCut !== null && !isNaN(explicitCut) ? explicitCut : defaultCountCut;
            isPass = (maxScore - numericScore) <= allowableMisses;
          }
        }
        
        currentTest = { name, score: scoreStr, numericScore, maxScore, isPass, memo, explicitCut };
      } else {
        // 콜론(:)이 없는 경우 전부 이름으로 간주
        currentTest = { name: content, score: '', numericScore: null, maxScore: 100, isPass: null, memo: '', explicitCut: null };
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

/**
 * 💡 교재-수업 구분(정규 / 선택:[과목명] / 공통) 파싱 및 인코딩 헬퍼
 */
export function parseBookCourseValue(rawCourseValue: string = '') {
  const isKeep = rawCourseValue.includes('-keep');
  let startMonth = '';
  if (rawCourseValue.includes('-start-')) {
    const match = rawCourseValue.match(/-start-([^\-]+)/);
    if (match) startMonth = match[1];
  }
  let targetTag = '정규';
  if (rawCourseValue.includes('-target-')) {
    const match = rawCourseValue.match(/-target-([^\-]+)/);
    if (match) targetTag = match[1] || '정규';
  }

  // Base course (e.g. 'C', 'B', 'A')
  let baseCourse = rawCourseValue
    .replace(/-keep/g, '')
    .replace(/-start-[^\-]+/g, '')
    .replace(/-target-[^\-]+/g, '');

  return { baseCourse, isKeep, startMonth, targetTag };
}

export function buildBookCourseValue({
  baseCourse = 'C',
  isKeep = false,
  startMonth = '',
  targetTag = '정규'
}: {
  baseCourse?: string;
  isKeep?: boolean;
  startMonth?: string;
  targetTag?: string;
}): string {
  let val = baseCourse || 'C';
  if (startMonth) val += `-start-${startMonth}`;
  if (targetTag && targetTag !== '정규') val += `-target-${targetTag}`;
  if (isKeep) val += `-keep`;
  return val;
}

