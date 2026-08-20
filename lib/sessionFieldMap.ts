/**
 * 💡 TodaySheet의 Column ID와 Session Log의 DB 필드명 간의 매핑 정보
 */

// 1. Column ID -> DB Field Name
export const COLUMN_TO_FIELD_MAP: Record<string, string> = {
  'attendance': 'attendance_status',
  'test_id': 'test_status',
  'test_score': 'test_score',
  'assign': 'homework_text',
  'classwork': 'classwork_text',
  'completed_classwork': 'completed_classwork_text',
  'mission': 'mission',
  'notes': 'special_notes',
  'next_quiz': 'next_quiz_text',
  'management_notes': 'management_notes'
};

// 💡 [추가] Column ID -> JS Property Name (SessionLog 객체 내부 키)
export const COLUMN_TO_PROP_MAP: Record<string, string> = {
  'attendance': 'attendance_status',
  'test_id': 'test_id', // DB 필드명은 test_status지만 JS 속성은 test_id임
  'test_score': 'test_score',
  'assign': 'homework_text',
  'classwork': 'classwork_text',
  'completed_classwork': 'completed_classwork_text',
  'mission': 'mission',
  'notes': 'special_notes',
  'next_quiz': 'next_quiz_text',
  'management_notes': 'management_notes'
};

// 2. DB Field Name -> Column ID (Inverse Map)
// ... (기존 코드와 동일)
export const FIELD_TO_COLUMN_MAP: Record<string, string> = {
  'attendance_status': 'attendance',
  'test_status': 'test_id',
  'test_id': 'test_id', 
  'test_score': 'test_score',
  'homework_text': 'assign',
  'classwork_text': 'classwork',
  'completed_classwork_text': 'completed_classwork',
  'mission': 'mission',
  'special_notes': 'notes',
  'next_quiz_text': 'next_quiz',
  'management_notes': 'management_notes'
};

// 3. Attendance Status Constants
export const ATTENDANCE_STATUS = {
  BEFORE: '수업전',
  PRESENT: '출석',
  LATE: '지각',
  EARLY_LEAVE: '조퇴',
  ABSENT: '결석',
  MOVE: '이동',
  EXCLUDED: '수업제외',
  CANCELED: '수업취소',
  SUPPLEMENT: '보강' // 보강은 보강:13 형식으로도 쓰이므로 prefix로 활용
} as const;

/**
 * 💡 출석 상태값을 '수업전' 중심으로 정규화하고 인코딩된 시간 정보를 제거합니다.
 */
export const normalizeAttendanceStatus = (status: string | null | undefined): string => {
  if (!status || status === 'none' || status === '') return ATTENDANCE_STATUS.BEFORE;
  // 💡 [호환성] '출석:13' 또는 '보강:13' 형태에서 상태값만 추출
  if (status.includes(':')) return status.split(':')[0];
  return status;
};

/**
 * 💡 컬럼 ID를 대응하는 DB 필드명으로 변환합니다.
 */
export const mapColumnToField = (colId: string): string => {
  return COLUMN_TO_FIELD_MAP[colId] || colId;
};

/**
 * 💡 컬럼 ID를 대응하는 JS 속성명으로 변환합니다. (낙관적 업데이트용)
 */
export const mapColumnToProp = (colId: string): string => {
  return COLUMN_TO_PROP_MAP[colId] || colId;
};

/**
 * 💡 DB 필드명을 대응하는 컬럼 ID로 변환합니다.
 */
export const mapFieldToColumn = (field: string): string => {
  return FIELD_TO_COLUMN_MAP[field] || field;
};
