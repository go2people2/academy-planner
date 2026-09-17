import { useState, useMemo, useEffect, useCallback } from 'react';
import { Student } from '@/types/dashboard';
import { supabase } from '@/lib/supabase';
import { parseInlineTests } from '@/lib/utils';
import { getHwEval } from '@/lib/sessionTestResult';

export type ReportTabType = 'summary' | 'history' | 'stats' | 'roadmap' | 'journal' | 'ai-briefing' | 'school-scores';

export function useStudentStudyReport(student: Student) {
  const [activeTab, setActiveTab] = useState<ReportTabType>('summary');

  // 학생 객체에 이미 주입된 전체 세션 로그를 즉시 1순위로 사용 (로딩 지연 0ms)
  const allLogs = useMemo(() => {
    return student.allLogs || [];
  }, [student.allLogs]);

  const stats = useMemo(() => {
    const logs = allLogs;
    // 💡 attendance_status가 비어있는 과거 정상 세션도 누락되지 않도록 필터링 완화
    const validLogs = logs.filter(l => !['수업제외', '수업취소'].includes(l.attendance_status || ''));
    const recentLogs = validLogs.slice(0, 20);
    
    const attendances = recentLogs.filter(l => 
      !l.attendance_status || 
      l.attendance_status === '출석' || 
      l.attendance_status === '온라인' || 
      l.attendance_status.startsWith('bo강') ||
      l.attendance_status.startsWith('보강') ||
      l.attendance_status === '지각'
    );
    const attendanceRate = recentLogs.length > 0 ? Math.round((attendances.length / recentLogs.length) * 100) : 0;

    const statusWeight: Record<string, number> = {
      'gradeA': 100,
      'perfect': 100,
      'gradeB': 80,
      'good': 80,
      'gradeC': 50,
      'neutral': 50,
      'gradeD': 30,
      'poor': 30,
      'gradeE': 0,
      'bad': 0,
      'gradeF': 0,
      'none': 0
    };

    // 💡 과거 및 현재 숙제 평가 점수 종합 추출기 (test_result, status, special_notes, hw_checked_today, 텍스트 패턴 모두 지원)
    const parseHomeworkScore = (l: any): number | null => {
      // 1. test_result.hw_eval (0~10 정수)
      const hwEval = getHwEval(l.test_result);
      if (typeof hwEval === 'number') {
        return hwEval * 10;
      }

      // 2. test_result JSON 내의 hw_grade 확인
      if (l.test_result && typeof l.test_result === 'string' && l.test_result.startsWith('{')) {
        try {
          const parsed = JSON.parse(l.test_result);
          if (parsed.hw_grade && statusWeight[parsed.hw_grade] !== undefined) {
            return statusWeight[parsed.hw_grade];
          }
          if (typeof parsed.hw_level === 'number') {
            return parsed.hw_level * 10;
          }
        } catch (e) {}
      }

      // 3. status 필드 (perfect, good, neutral, poor, bad, gradeA~gradeF)
      const s = l.status;
      if (s && s !== 'none' && s !== 'hold' && statusWeight[s] !== undefined) {
        return statusWeight[s];
      }

      // 4. special_notes 내의 다양한 텍스트/키워드 패턴 분석 (선생님 커스텀 프리셋 & 등급 문자 호환)
      const notes = (l.special_notes || '').trim();
      if (notes) {
        // A 등급 패턴
        if (notes.includes('A등급') || notes.includes('[A]') || notes.includes('완벽') || notes.includes('최상') || notes.includes('[숙제이행: 10단계]') || notes.includes('10단계')) return 100;
        // B 등급 패턴
        if (notes.includes('B등급') || notes.includes('[B]') || notes.includes('잘 수행') || notes.includes('우수') || notes.includes('잘함') || notes.includes('[숙제이행: 8단계]') || notes.includes('8단계')) return 80;
        // C 등급 패턴
        if (notes.includes('C등급') || notes.includes('[C]') || notes.includes('보통') || notes.includes('[숙제이행: 5단계]') || notes.includes('5단계')) return 50;
        // D 등급 패턴
        if (notes.includes('D등급') || notes.includes('[D]') || notes.includes('미흡') || notes.includes('[숙제이행: 3단계]') || notes.includes('3단계')) return 30;
        // E 등급 패턴
        if (notes.includes('E등급') || notes.includes('[E]') || notes.includes('거의 해오지') || notes.includes('안 해') || notes.includes('부진') || notes.includes('[숙제이행: 0단계]') || notes.includes('0단계')) return 0;
        // F / 보류 패턴
        if (notes.includes('F등급') || notes.includes('[F]') || notes.includes('보류') || notes.includes('가져오지') || notes.includes('미지참') || notes.includes('안가져')) return 0;
      }

      // 5. 숙제 확인 체크 박스 (hw_checked_today === true)
      if (l.hw_checked_today === true) return 100;

      return null;
    };

    // 전체 세션 로그에서 숙제 평가 기록들을 시간순으로 추출
    const hwScores: number[] = [];
    logs.forEach(l => {
      const score = parseHomeworkScore(l);
      if (score !== null) {
        hwScores.push(score);
      }
    });

    // 최근 10회 기준 평균 도출
    const recentHwScores = hwScores.slice(0, 10);
    const homeworkRate = recentHwScores.length > 0
      ? Math.round(recentHwScores.reduce((a, b) => a + b, 0) / recentHwScores.length)
      : null;

    const hwRateText = homeworkRate !== null ? `${homeworkRate}%` : '-';
    const hwRateSub = recentHwScores.length > 0 ? `최근 ${recentHwScores.length}회` : '기록 없음';

    // 💡 테스트 점수형(100점 만점) 및 개수형(맞힌 수 / 문항 수) 정밀 파싱
    const scoreItems: number[] = [];
    const countItems: { score: number; maxScore: number }[] = [];

    for (const logItem of logs) {
      const log: any = logItem;
      const testContent = log.test_status || log.test_id || '';
      const parsed = parseInlineTests(testContent);

      if (parsed && parsed.length > 0) {
        for (const t of parsed) {
          if (t.numericScore !== null && t.numericScore !== undefined) {
            if (t.maxScore === 100) {
              scoreItems.push(t.numericScore);
            } else if (t.maxScore > 0) {
              countItems.push({ score: t.numericScore, maxScore: t.maxScore });
            }
          }
        }
      } else if (log.test_score !== null && log.test_score !== undefined && String(log.test_score).trim() !== '') {
        const isCount = log.test_score_type === 'count';
        const num = parseFloat(String(log.test_score));
        if (!isNaN(num)) {
          if (isCount) {
            const maxScore = parseInt(String(log.test_total_count), 10) || 10;
            countItems.push({ score: num, maxScore });
          } else {
            scoreItems.push(num);
          }
        }
      }
    }

    // 최근 10회 기준 평균 도출
    const recentScoreItems = scoreItems.slice(0, 10);
    const recentCountItems = countItems.slice(0, 10);

    const avgScore = recentScoreItems.length > 0
      ? Math.round(recentScoreItems.reduce((a, b) => a + b, 0) / recentScoreItems.length)
      : null;

    const avgCountScore = recentCountItems.length > 0
      ? Number((recentCountItems.reduce((a, b) => a + b.score, 0) / recentCountItems.length).toFixed(1))
      : null;

    const avgCountMax = recentCountItems.length > 0
      ? Math.round(recentCountItems.reduce((a, b) => a + b.maxScore, 0) / recentCountItems.length)
      : null;

    // 요약 표시 문자열 및 서브 텍스트
    let testMetricValue = '-';
    let testMetricSub = '기록 없음';

    if (avgScore !== null && avgCountScore !== null) {
      testMetricValue = `${avgScore}점 · ${avgCountScore}개`;
      testMetricSub = `점수 ${recentScoreItems.length}회 / 개수 ${recentCountItems.length}회`;
    } else if (avgScore !== null) {
      testMetricValue = `${avgScore}점`;
      testMetricSub = `최근 ${recentScoreItems.length}회 (100점 만점)`;
    } else if (avgCountScore !== null) {
      testMetricValue = `${avgCountScore} / ${avgCountMax}개`;
      testMetricSub = `최근 ${recentCountItems.length}회 (개수형)`;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthStr = String(currentMonth + 1).padStart(2, '0');
    const currentMonthPrefix = `${currentYear}-${currentMonthStr}`;

    const thisMonthLogs = logs.filter(l => {
      const d = l.date || l.session_date || '';
      return d.startsWith(currentMonthPrefix);
    });
    const absencesCount = thisMonthLogs.filter(l => l.attendance_status === '결석').length;
    const makeupsCount = thisMonthLogs.filter(l => l.attendance_status && l.attendance_status.startsWith('보강')).length;
    const currentMonthName = `${currentMonth + 1}월`;

    return { 
      attendanceRate, 
      homeworkRate: homeworkRate ?? 0, 
      hwRateText,
      hwRateSub,
      avgTestScore: avgScore ?? 0,
      avgScore,
      avgCountScore,
      avgCountMax,
      testMetricValue,
      testMetricSub,
      testCount: scoreItems.length + countItems.length,
      absencesCount,
      makeupsCount,
      currentMonthName
    };
  }, [allLogs]);

  const absenceLogs = useMemo(() => {
    const logs = allLogs;
    return logs
      .filter((l: any) => l.attendance_status === '결석')
      .sort((a: any, b: any) => new Date(b.date || b.session_date || 0).getTime() - new Date(a.date || a.session_date || 0).getTime());
  }, [allLogs]);

  return {
    activeTab,
    setActiveTab,
    stats,
    absenceLogs,
    allLogs,
  };
}
