/**
 * rowIdentity.ts
 *
 * 선택과목(특강) 행의 파생 ID(_special_xxx)와 students 배열의 원본 학생 ID를
 * 안전하게 매칭하기 위한 중앙 유틸리티.
 *
 * 사용 배경:
 * - filteredStudents에는 정규 행(student_123)과 특강 파생 행(student_123_special_방학특강_0)이 공존
 * - 단순 1:1 매칭(u.studentId === s.id)으로는 특강 행 로컬 state 갱신이 누락됨
 * - 이 유틸을 통해 어느 훅에서도 동일한 안전한 매칭을 보장
 */

/**
 * students 배열의 학생 객체(s)와 업데이트 항목의 studentId가 같은 학생을 가리키는지 판별
 *
 * @param s - students 배열에서 꺼낸 학생 객체 (s.id는 항상 원본 학생 ID)
 * @param updateStudentId - update 항목의 studentId (정규 ID 또는 _special_xxx 파생 ID)
 */
export function matchRowIdentity(s: any, updateStudentId: string): boolean {
  const realId = extractRealStudentId(updateStudentId);
  return (
    String(s.id) === String(updateStudentId) ||  // 직접 매칭 (정규 행)
    String(s.id) === String(realId) ||            // 파생 ID에서 추출한 실제 ID 매칭
    (s.originalId && String(s.originalId) === String(realId)) // originalId 폴백
  );
}

/**
 * 특강 파생 ID에서 실제 학생 ID를 추출
 * 예: "student_123_special_방학특강_0" → "student_123"
 * 예: "student_123" → "student_123" (정규 ID는 그대로 반환)
 *
 * @param studentId - 정규 또는 파생(_special_xxx) 학생 ID
 */
export function extractRealStudentId(studentId: string): string {
  if (!studentId) return '';
  return String(studentId).replace(/_special.*$/, '').replace(/_makeup.*$/, '');
}
