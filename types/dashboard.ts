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
  test_id?: string;
  test_score?: number | string;
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
