export type StudentStatus = 'perfect' | 'good' | 'neutral' | 'poor' | 'bad' | 'none';

export interface HomeworkItem {
  type: 'book' | 'custom';
  book_name: string;
  range: string;
  units?: string[];
}

export interface SessionLog {
  id?: string;
  date: string;
  status: StudentStatus;
  attendance_status: string;
  special_notes: string;
  classwork_text: string;
  classwork_json: HomeworkItem[];
  homework_text: string;
  homework_json: HomeworkItem[];
  next_quiz_text?: string; // 💡 추가
  next_quiz_json?: HomeworkItem[]; // 💡 추가
  next_quiz_cut?: string | number; // 💡 추가 (0~4개 커트라인)
  next_quiz_trial?: number; // 💡 추가 (1차, 2차...)
  test_id?: string;
  test_score?: number | string;
  test_score_type?: 'score' | 'count'; // 💡 추가
  test_total_count?: number; // 💡 신규 추가
  test_result?: string;
  test_cut?: string | number; // 💡 오늘 테스트 커트라인 추가
  test_completed?: boolean; // 💡 추가 (테스트 완료 여부)
  report_sent_at?: string;
}

export interface Student {
  id: string;
  academy_id: string;
  teacher_id?: string;
  name: string;
  school: string;
  grade: string;
  course: string;
  book_courses?: Record<string, string>;
  class: string;
  phone?: string;
  last_consulted_at?: string;
  created_at?: string;
  status_changed_at?: string;
  class_days: string[];
  assigned_books: string[];
  day_schedules: Record<string, number[]>;
  management_notes?: string; // 💡 추가 (선생님 전용 관리 메모)
  recent_mission?: string; // 💡 추가 (학생용 개별 미션)
  target_exam_date?: string; // 💡 추가 (목표 시험일)
  suggestions?: Task[]; // 💡 추가 (학생 건의사항)
  history: StudentStatus[];
  isRedLight: boolean;
  lastSession?: SessionLog;
  todaySession?: SessionLog;
  allLogs: SessionLog[];
}

export interface Teacher {
  id: string;
  academy_id: string;
  name: string;
  email?: string;
  role: 'admin' | 'teacher';
  homework_presets?: Record<string, string>; // 💡 추가
}

export interface TextbookOption {
  bookcode: string;
  title: string;
  grade: string;
  status: string;
  ePeriod: string;
}

export interface ExamSchedule {
  id: string;
  academy_id: string;
  school_name: string;
  grade?: string; // NULL이면 전학년
  exam_name?: string;
  target_date: string;
  created_at: string;
}

export interface Task {
  id: string;
  academy_id: string;
  title: string;
  content: string;
  start_date: string; // 💡 시작일 추가
  target_date: string; // 💡 종료일(마감일)
  display_period_type: 'custom' | 'weekly' | 'monthly'; // 💡 기간 유형 추가
  is_completed: boolean;
  created_by: string;
  type: 'manual' | 'auto';
  created_at: string;
}
