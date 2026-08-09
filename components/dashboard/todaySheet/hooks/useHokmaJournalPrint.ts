import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Student } from '@/types/dashboard';

export const JOURNAL_THEMES = {
  slateBlue: {
    name: '슬레이트 인디고 블루 (추천)',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#7387A5',
    headerText: '#ffffff',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#374151',
    metaTextColor: '#1f2937',
    logoFilter: 'invert(52%) sepia(21%) saturate(718%) hue-rotate(177deg) brightness(91%) contrast(87%)',
  },
  indigo: {
    name: '보라 인디고',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#f3e8ff',
    headerText: '#6b21a8',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#7e22ce',
    metaTextColor: '#1f2937',
    logoFilter: 'invert(18%) sepia(85%) saturate(3000%) hue-rotate(260deg) brightness(85%) contrast(100%)',
  },
  amber: {
    name: '호박색',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#fef3e2',
    headerText: '#9a3412',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#c2410c',
    metaTextColor: '#27272a',
    logoFilter: 'invert(12%) sepia(85%) saturate(1600%) hue-rotate(350deg) brightness(85%) contrast(110%)',
  },
  rose: {
    name: '핑크 로즈',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#fff0f2',
    headerText: '#9f1239',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#be123c',
    metaTextColor: '#1f2937',
    logoFilter: 'invert(13%) sepia(85%) saturate(4000%) hue-rotate(335deg) brightness(85%) contrast(100%)',
  },
  sage: {
    name: '포레스트 세이지',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#f0f4f0',
    headerText: '#166534',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#15803d',
    metaTextColor: '#27272a',
    logoFilter: 'invert(22%) sepia(80%) saturate(1200%) hue-rotate(110deg) brightness(80%) contrast(100%)',
  },
  classic: {
    name: '클래식 그레이',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#f3f4f6',
    headerText: '#1f2937',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#4b5563',
    metaTextColor: '#1f2937',
    logoFilter: 'grayscale(1) brightness(0.6) contrast(1.2)',
  }
};

export type ThemeKey = keyof typeof JOURNAL_THEMES;

export const PEN_COLORS = [
  { val: '#1e3a8a', label: '청색 볼펜 (Blue)' },
  { val: '#111827', label: '흑색 볼펜 (Black)' },
  { val: '#be123c', label: '적색 볼펜 (Red)' }
];

export function useHokmaJournalPrint({
  initialMonth,
  selectedStudents = [],
  allStudents = [],
}: {
  initialMonth?: string;
  selectedStudents?: Student[];
  allStudents?: Student[];
}) {
  const defaultMonth = useMemo(() => {
    if (initialMonth) return initialMonth;
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${mm}`;
  }, [initialMonth]);

  const [dateMode, setDateMode] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const [customStartDate, setCustomStartDate] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${mm}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDay).padStart(2, '0');
    return `${now.getFullYear()}-${mm}-${dd}`;
  });

  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>('amber');
  const [selectedPenColor, setSelectedPenColor] = useState<string>('#1e3a8a');
  const [hwOverrides, setHwOverrides] = useState<Record<string, string>>({});

  const handleToggleHwScore = async (studentId: string, dateKey: string, currentScore: string, targetCourse?: string) => {
    if (!dateKey || !studentId) return;
    const scoreOrder = ['10점', '7점', '4점', '0점', '-'];
    const curIdx = scoreOrder.indexOf(currentScore);
    const nextScore = scoreOrder[(curIdx + 1) % scoreOrder.length];
    const overrideKey = `${studentId}_${dateKey}`;
    
    setHwOverrides(prev => ({
      ...prev,
      [overrideKey]: nextScore
    }));

    let newAchievement = 0;
    if (nextScore === '10점') newAchievement = 100;
    else if (nextScore === '7점') newAchievement = 70;
    else if (nextScore === '4점') newAchievement = 40;
    else if (nextScore === '0점' || nextScore === '-') newAchievement = 0;

    const targetStudent = (selectedStudents || []).find(s => s.id === studentId) || (allStudents || []).find(s => s.id === studentId);
    if (targetStudent) {
      const formattedDate = dateKey.replace(/\./g, '-');
      const formattedDotDate = dateKey.replace(/-/g, '.');
      (targetStudent.allLogs || []).forEach((l: any) => {
        const lDate = (l.date || l.session_date || '').replace(/\./g, '-');
        if (lDate === formattedDate || l.date === formattedDotDate || l.session_date === formattedDotDate) {
          const lCourse = l.course_name || '정규';
          if (!targetCourse || targetCourse === '정규' ? (lCourse === '정규' || !l.course_name) : lCourse === targetCourse) {
            l.todo_achievement = newAchievement;
          }
        }
      });
      if (targetStudent.todaySession) {
        const sDate = (targetStudent.todaySession.date || targetStudent.todaySession.session_date || '').replace(/\./g, '-');
        if (sDate === formattedDate) {
          targetStudent.todaySession.todo_achievement = newAchievement;
        }
      }
    }

    try {
      const formattedDate = dateKey.replace(/\./g, '-');
      await supabase
        .from('ams_session_logs')
        .update({ todo_achievement: newAchievement })
        .eq('student_id', studentId)
        .or(`session_date.eq.${formattedDate},date.eq.${formattedDate}`);
    } catch (e) {
      console.error('Failed to update todo_achievement override', e);
    }
  };

  return {
    dateMode,
    setDateMode,
    selectedMonth,
    setSelectedMonth,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    selectedTheme,
    setSelectedTheme,
    selectedPenColor,
    setSelectedPenColor,
    hwOverrides,
    setHwOverrides,
    handleToggleHwScore,
  };
}
