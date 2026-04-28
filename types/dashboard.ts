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
  academy_id: string; 
  teacher_id?: string; // 💡 담당 선생님 ID 추가
  name: string;
  school: string;
  grade: string;
  class: string;
  class_days: string[];
  day_schedules?: {
    [key: string]: number[];
  };
  assigned_books: string[];
  assigned_book_titles?: string[];
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
}

export interface TextbookOption {
  title: string;
  grade: string;
  course: string;
  tabName: string;
}
