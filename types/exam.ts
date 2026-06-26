// OMR 채점 시스템 타입 정의

/** 문항 유형 */
export type QuestionType = 'multiple_choice' | 'multiple_choice_multi' | 'short_answer' | 'essay';

/** 학기 구분 */
export type SemesterType = '1학기 중간' | '1학기 기말' | '2학기 중간' | '2학기 기말';

/** 답안 입력 방식 */
export type InputMethod = 'digital' | 'omr_scan';

/** 시험지 정보 */
export interface ExamPaper {
  id: string;
  academy_id: string;
  exam_code: string;
  title: string;
  has_error: boolean;
  error_notes: string;
  region: string;
  school: string;
  grade: string;
  subject: string;
  year: number;
  semester: SemesterType | string;
  scope: string;
  question_count: number;
  /** 정답 키: {"1": 3, "2": 1, "28": "42", "30": "서술형"} */
  answer_key: Record<string, number | string | number[]>;
  /** 문항별 유형: {"1": "multiple_choice", "28": "short_answer", "30": "essay"} */
  question_types: Record<string, QuestionType>;
  /** 서술형 문항 배점: [{"q": 28, "points": 5}] */
  essay_questions: Array<{ q: number; points: number }>;
  /** 원본 파일 링크 */
  file_links: string[];
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** 시험지 등록/수정 폼 데이터 */
export interface ExamPaperFormData {
  exam_code: string;
  title: string;
  has_error: boolean;
  error_notes: string;
  region: string;
  school: string;
  grade: string;
  subject: string;
  year: number;
  semester: string;
  scope: string;
  question_count: number;
  answer_key: Record<string, number | string | number[]>;
  question_types: Record<string, QuestionType>;
  essay_questions: Array<{ q: number; points: number }>;
  file_links: string[];
  tags: string[];
}

/** 학생 답안 제출 */
export interface ExamSubmission {
  id: string;
  exam_id: string;
  academy_id: string;
  student_id: string;
  student_name: string;
  /** 학생 답안: {"1": 3, "2": 2, "28": "42"} */
  answers: Record<string, number | string | number[]>;
  input_method: InputMethod;
  omr_image_url: string;
  auto_score: number;
  /** 서술형 수동 점수: {"28": 4, "29": 5} */
  essay_scores: Record<string, number>;
  total_score: number;
  wrong_questions: number[];
  submitted_at: string;
  graded_at: string | null;
}

/** 채점 결과 */
export interface GradingResult {
  studentId: string;
  studentName: string;
  autoScore: number;
  essayScore: number;
  totalScore: number;
  wrongQuestions: number[];
  answers: Record<string, number | string | number[]>;
}

/** 문항별 통계 */
export interface QuestionStats {
  questionNumber: number;
  type: QuestionType;
  correctRate: number;
  wrongCount: number;
  totalCount: number;
  /** 객관식: 각 선택지별 선택 수 */
  choiceDistribution?: Record<number, number>;
}

/** 시험 검색 필터 */
export interface ExamSearchFilter {
  region?: string;
  grade?: string;
  subject?: string;
  year?: number;
  semester?: string;
  keyword?: string;
}
