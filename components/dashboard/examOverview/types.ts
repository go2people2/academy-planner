import { ExamSchedule, SchoolStage, ExamPreparationStatus } from '@/lib/examMatching';

export interface EnrichedExamStudent {
  id: string;
  name: string;
  school: string;
  grade: string;
  teacherId: string | null;
  teacherName: string;
  teacherInitial: string;
  classDays: string[];
  schoolStage: SchoolStage;
  matchedExam: ExamSchedule | null;
  examName: string;
  examPeriodStr: string;
  targetDate: string | null;
  endDate: string | null;
  dDayDiff: number;
  isOngoing: boolean;
  dDayLabel: string;
  remainingClasses: number | null;
  remainingClassesLabel: string;
  status: ExamPreparationStatus;
}

export type ExamSortOption = 'dday' | 'classes' | 'name' | 'school';
export type StageFilterOption = 'default' | 'all' | 'middle' | 'high' | 'elementary';
export type CardFilterType = 'ongoing' | 'd7' | 'd14' | 'lack_classes' | 'no_schedule' | null;

export interface KpiCounts {
  totalTarget: number;
  ongoing: number;
  d7: number;
  d14: number;
  lackClasses: number;
  noSchedule: number;
}
