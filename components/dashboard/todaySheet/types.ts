export interface ColumnConfig {
  id: string;
  label: string;
  minWidth: number;
  isSticky?: boolean;
  canHide: boolean;
}

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'select', label: '', minWidth: 40, isSticky: true, canHide: false },
  { id: 'date', label: '날짜', minWidth: 50, canHide: true },
  { id: 'name', label: '이름', minWidth: 120, isSticky: true, canHide: false },
  { id: 'tools', label: '도구', minWidth: 80, isSticky: true, canHide: false },
  { id: 'management_notes', label: '주의점', minWidth: 150, canHide: true },
  { id: 'book_progress', label: '진도파악', minWidth: 160, canHide: true },
  { id: 'attendance', label: '출결', minWidth: 80, canHide: true },
  { id: 'test_id', label: '오늘TEST', minWidth: 140, canHide: true },
  { id: 'test_score', label: '점수', minWidth: 60, canHide: true },
  { id: 'next_quiz', label: '다음TEST', minWidth: 200, canHide: true },
  { id: 'review', label: '과제확인', minWidth: 180, canHide: true },
  { id: 'classwork', label: '오늘 할 일(To-Do)', minWidth: 200, canHide: true },
  { id: 'completed_classwork', label: '수행진도', minWidth: 200, canHide: true },
  { id: 'assign', label: '오늘숙제', minWidth: 220, canHide: true },
  { id: 'mission', label: '학생미션', minWidth: 220, canHide: true },
  { id: 'notes', label: '특이사항', minWidth: 160, canHide: true },
  { id: 'action', label: '', minWidth: 8, isSticky: true, canHide: false }
];
