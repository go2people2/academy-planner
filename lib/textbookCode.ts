/**
 * 💡 교재 코드(bookcode) 생성·검증 공용 모듈 (클라이언트/서버 공용, 외부 의존성 없음)
 *
 * 형식: {접두어}--{개정연도}-{학년학기코드}-{교재약어}-{main|wb}
 *  - 접두어: 공용 교재는 'common', 학원 교재는 학원 slug
 *  - 개정연도: 4자리 숫자
 *  - 학년학기코드/교재약어: 소문자 영문·숫자만 (한글 불가)
 *  - 끝말: main(본교재) | wb(워크북) — 오답노트 DB와 동일한 이름 사용
 */

export const COMMON_PREFIX = 'common';

export const BOOKCODE_SUFFIXES = [
  { value: 'main', label: '본교재 (main)' },
  { value: 'wb', label: '워크북 (wb)' },
] as const;

export type BookcodeSuffix = typeof BOOKCODE_SUFFIXES[number]['value'];

/** 학년·학기 코드 목록 (기존 등록 코드 기준) */
export const GRADE_CODE_OPTIONS: { code: string; label: string }[] = [
  { code: 'e51', label: '초5-1' },
  { code: 'e52', label: '초5-2' },
  { code: 'e61', label: '초6-1' },
  { code: 'e62', label: '초6-2' },
  { code: 'm11', label: '중1-1' },
  { code: 'm12', label: '중1-2' },
  { code: 'm21', label: '중2-1' },
  { code: 'm22', label: '중2-2' },
  { code: 'm31', label: '중3-1' },
  { code: 'm32', label: '중3-2' },
  { code: 'gt1', label: '공통수학1 (gt1)' },
  { code: 'gt2', label: '공통수학2 (gt2)' },
  { code: 'gs1', label: '공통수학1 (gs1)' },
  { code: 'gs2', label: '공통수학2 (gs2)' },
  { code: 'ds', label: '대수' },
  { code: 'wt', label: '확통' },
  { code: 'kh', label: '기하' },
  { code: 'mj1', label: '미적분1' },
  { code: 'mj2', label: '미적분2' },
];

// 접두어는 slug 특성상 하이픈 포함 가능(예: wc-math), 구분자 '--' 와는 구별됨
const BOOKCODE_REGEX = /^([a-z0-9]+(?:-[a-z0-9]+)*)--(\d{4})-([a-z0-9]+)-([a-z0-9]+)-(main|wb)$/;

/** 입력값에서 소문자 영문·숫자만 남깁니다 (교재약어/학년코드 입력용) */
export function sanitizeCodePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** 학원 slug 입력용: 소문자 영문·숫자·하이픈(-) 허용 (연속 하이픈 '--'는 연도 구분자이므로 단일화) */
export function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

export interface BookcodeParts {
  prefix: string;
  year: string;
  gradeCode: string;
  abbr: string;
  suffix: BookcodeSuffix;
}

/** 모든 구성 요소가 유효할 때만 코드를 만들고, 아니면 null */
export function buildBookcode(parts: BookcodeParts): string | null {
  const code = `${parts.prefix}--${parts.year}-${parts.gradeCode}-${parts.abbr}-${parts.suffix}`;
  return BOOKCODE_REGEX.test(code) ? code : null;
}

/**
 * 신규 등록용 코드 검증. 올바르면 null, 아니면 사용자에게 보여줄 오류 메시지 반환.
 * expectedPrefix: 공용이면 'common', 학원 교재면 해당 학원 slug
 */
export function validateNewBookcode(code: string, expectedPrefix: string): string | null {
  const m = BOOKCODE_REGEX.exec(code);
  if (!m) {
    return '교재코드는 {접두어}--{연도4자리}-{학년코드}-{교재약어}-main 형식의 소문자 영문·숫자만 가능합니다. (한글·공백 불가, 끝은 main 또는 wb)';
  }
  if (m[1] !== expectedPrefix) {
    return `교재코드 접두어는 '${expectedPrefix}' 이어야 합니다.`;
  }
  return null;
}
