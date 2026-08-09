import { useState, useMemo } from 'react';
import { Student } from '@/types/dashboard';

export type ReportTabType = 'summary' | 'history' | 'stats' | 'roadmap' | 'journal' | 'ai-briefing' | 'school-scores';

export function useStudentStudyReport(student: Student) {
  const [activeTab, setActiveTab] = useState<ReportTabType>('summary');

  const stats = useMemo(() => {
    const logs = student.allLogs || [];
    const validLogs = logs.filter(l => l.attendance_status && !['수업제외', '수업취소'].includes(l.attendance_status));
    const recentLogs = validLogs.slice(0, 20);
    
    const attendances = recentLogs.filter(l => 
      l.attendance_status === '출석' || 
      l.attendance_status === '온라인' || 
      l.attendance_status.startsWith('bo강') ||
      l.attendance_status.startsWith('보강')
    );
    const attendanceRate = recentLogs.length > 0 ? Math.round((attendances.length / recentLogs.length) * 100) : 0;

    const statusWeight = { 'perfect': 100, 'good': 85, 'neutral': 70, 'poor': 40, 'bad': 20, 'none': 0 };
    const validHomeworkLogs = recentLogs.filter(l => l.status && l.status !== 'none');
    const totalHwScore = validHomeworkLogs.reduce((acc, l) => acc + (statusWeight[l.status as keyof typeof statusWeight] || 0), 0);
    const homeworkRate = validHomeworkLogs.length > 0 ? Math.round(totalHwScore / validHomeworkLogs.length) : 0;

    const testLogs = logs.filter(l => l.test_score !== null && l.test_score !== undefined).slice(0, 5);
    const avgTestScore = testLogs.length > 0 ? Math.round(testLogs.reduce((acc, l) => acc + (Number(l.test_score) || 0), 0) / testLogs.length) : 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthStr = String(currentMonth + 1).padStart(2, '0');
    const currentMonthPrefix = `${currentYear}-${currentMonthStr}`;

    const thisMonthLogs = logs.filter(l => l.date && l.date.startsWith(currentMonthPrefix));
    const absencesCount = thisMonthLogs.filter(l => l.attendance_status === '결석').length;
    const makeupsCount = thisMonthLogs.filter(l => l.attendance_status && l.attendance_status.startsWith('보강')).length;
    const currentMonthName = `${currentMonth + 1}월`;

    return { 
      attendanceRate, 
      homeworkRate, 
      avgTestScore, 
      testCount: testLogs.length,
      absencesCount,
      makeupsCount,
      currentMonthName
    };
  }, [student.allLogs]);

  const absenceLogs = useMemo(() => {
    const logs = student.allLogs || [];
    return logs
      .filter((l: any) => l.attendance_status === '결석')
      .sort((a: any, b: any) => new Date(b.date || b.session_date || 0).getTime() - new Date(a.date || a.session_date || 0).getTime());
  }, [student.allLogs]);

  return {
    activeTab,
    setActiveTab,
    stats,
    absenceLogs,
  };
}
