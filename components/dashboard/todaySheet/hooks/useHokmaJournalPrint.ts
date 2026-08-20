import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Student } from '@/types/dashboard';
import { withHwEval, parseSessionTestResult } from '@/lib/sessionTestResult';

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
    
    // 💡 10점 -> 10, 7점 -> 7, 4점 -> 4, 0점 -> 0, '-' -> null (미입력)
    let nextHwEval: number | null = null;
    if (nextScore === '10점') nextHwEval = 10;
    else if (nextScore === '7점') nextHwEval = 7;
    else if (nextScore === '4점') nextHwEval = 4;
    else if (nextScore === '0점') nextHwEval = 0;
    else if (nextScore === '-') nextHwEval = null;

    const targetStudent = (selectedStudents || []).find(s => s.id === studentId) || (allStudents || []).find(s => s.id === studentId);
    if (!targetStudent) return;

    const formattedDate = dateKey.replace(/\./g, '-');
    const formattedDotDate = dateKey.replace(/-/g, '.');

    // 해당 날짜 및 과목에 매칭되는 실제 세션 로그 탐색
    const matchedLog = (targetStudent.allLogs || []).find((l: any) => {
      const lDate = (l.date || l.session_date || '').replace(/\./g, '-');
      if (lDate !== formattedDate && l.date !== formattedDotDate && l.session_date !== formattedDotDate) return false;
      const lCourse = l.course_name || '정규';
      if (!targetCourse || targetCourse === '정규') {
        return lCourse === '정규' || !l.course_name;
      }
      return lCourse === targetCourse;
    });

    if (!matchedLog?.id || matchedLog.id === 'temp') {
      alert("해당 날짜의 수업 기록이 DB에 존재하지 않아 점수를 수정할 수 없습니다.");
      return;
    }

    const previousTestResult = matchedLog.test_result;
    const newTestResultStr = withHwEval(previousTestResult, nextHwEval);

    // 낙관적 UI 업데이트
    setHwOverrides(prev => ({
      ...prev,
      [overrideKey]: nextScore
    }));
    matchedLog.test_result = newTestResultStr;

    try {
      // 💡 [안전 규칙] log.id 기반으로 test_result만 업데이트
      const { data, error } = await supabase
        .from('ams_session_logs')
        .update({ test_result: newTestResultStr })
        .eq('id', matchedLog.id)
        .select()
        .single();

      if (error || !data) {
        throw error || new Error("서버 갱신 실패");
      }

      matchedLog.test_result = data.test_result;
    } catch (e) {
      console.error('Failed to update hw_eval in HokmaJournal', e);
      // 실패 시 롤백
      setHwOverrides(prev => {
        const next = { ...prev };
        delete next[overrideKey];
        return next;
      });
      matchedLog.test_result = previousTestResult;
      alert("숙제 완성도 점수 저장에 실패했습니다.");
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
