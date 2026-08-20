export type SessionTestResult = Record<string, unknown>;

/**
 * 💡 test_result 문자열을 안전하게 객체로 파싱합니다.
 * 잘못된 JSON, null, 빈 문자열, 배열인 경우 빈 객체({})를 반환합니다.
 */
export function parseSessionTestResult(raw: unknown): SessionTestResult {
  if (typeof raw !== 'string' || !raw.trim().startsWith('{')) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SessionTestResult;
    }
  } catch {
    // parse failure fallback
  }
  return {};
}

/**
 * 💡 과제확인 점수가 유효한 0~10 정수인지 판별하는 타입 가드
 */
export function isValidHwEval(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10;
}

/**
 * 💡 test_result 객체 또는 문자열에서 유효한 hw_eval(0~10 정수)을 추출합니다.
 */
export function getHwEval(raw: unknown): number | undefined {
  if (!raw) return undefined;
  const obj = typeof raw === 'string' ? parseSessionTestResult(raw) : (typeof raw === 'object' && !Array.isArray(raw) ? (raw as SessionTestResult) : {});
  const val = obj.hw_eval;
  return isValidHwEval(val) ? val : undefined;
}

/**
 * 💡 기존 test_result 문자열을 파싱하여 다른 키를 모두 보존한 채 hw_eval만 갱신/삭제하여 JSON 문자열로 반환합니다.
 * - score가 유효한 0~10 정수이면 hw_eval 설정
 * - score가 null이면 hw_eval 키 삭제
 */
export function withHwEval(raw: unknown, score: number | null): string {
  const existing = parseSessionTestResult(raw);
  if (score === null) {
    const { hw_eval, ...rest } = existing;
    return JSON.stringify(rest);
  }
  if (!isValidHwEval(score)) {
    return JSON.stringify(existing);
  }
  return JSON.stringify({
    ...existing,
    hw_eval: score
  });
}
