export type StudentStatus = 'perfect' | 'warning' | 'late' | 'none';

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
  homework_text: string;
  homework_json: HomeworkItem[];
}

export interface Student {
  id: string;
  academy_id: string; // 💡 학원 ID 추가
  name: string;
  school: string;
  grade: string;
  class: string;
  class_days: string[];
  assigned_books: string[];
  assigned_book_titles?: string[];
  history: StudentStatus[];
  isRedLight: boolean;
  lastSession?: SessionLog;
  todaySession?: SessionLog;
  allLogs: SessionLog[];
}

export interface TextbookOption {
  title: string;
  grade: string;
  course: string;
  tabName: string;
}
