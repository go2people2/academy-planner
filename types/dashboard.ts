export type StudentStatus = 'perfect' | 'good' | 'neutral' | 'poor' | 'bad' | 'none';

export interface HomeworkItem {
  type: 'book' | 'custom';
  book_name: string;
  range: string;
  units?: string[];
  start_page?: string;
  end_page?: string;
  note?: string;
}

export interface SessionLog {
  id?: string;
  date: string;
  session_date?: string; // 💡 추가 (구형 스키마 하위 호환성용)
  status: StudentStatus;
  attendance_status: string;
  special_notes: string;
  classwork_text: string;
  classwork_json: HomeworkItem[];
  completed_classwork_text?: string; // 💡 실제 수행 진도 텍스트
  completed_classwork_json?: HomeworkItem[]; // 💡 실제 수행 진도 데이터
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
  timer_started_at?: number; // 💡 추가 (타이머 시작 시각)
  timer_duration?: number; // 💡 추가 (타이머 시간 - 분)
  moved_to_hour?: number | null; // 💡 추가 (시간 이동/보강 시 변경된 교시)
  mission?: string; // 💡 추가 (학생용 개별 미션)
  todo_achievement?: number; // 💡 추가 (투두 달성률)
  hasHwTo?: boolean; // 💡 추가 (숙제 이월 여부)
  hasTestResult?: boolean; // 💡 추가 (테스트 결과 여부)
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
  is_deleted?: boolean; // 💡 추가 (퇴원 여부)
  isTodayClassDay?: boolean; // 💡 추가 (오늘 수업 여부)
  teacher_initial?: string; // 💡 추가
  teacher_name?: string; // 💡 추가
}

export interface Teacher {
  id: string;
  academy_id: string;
  name: string;
  initials?: string; // 💡 추가
  nickname?: string; // 💡 추가 (ACA2000 별칭/직함 용)
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
