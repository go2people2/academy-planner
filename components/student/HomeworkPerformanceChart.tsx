'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { getHwEval } from '@/lib/sessionTestResult';

interface HomeworkPerformanceChartProps {
  logs: any[];
  isLight?: boolean;
}

interface HomeworkChartItem {
  date: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  score: number;       // 10점 만점 기준 점수 (10, 8, 5, 3, 0)
  percentage: number;  // 100% 기준 이행률 (100, 80, 50, 30, 0)
  desc: string;        // 평가 설명 (완벽, 우수, 보통, 미흡, 부진, 평가보류)
  comment?: string;    // special_notes 코멘트 (선생님 피드백 문구만 노출, management_notes 제외)
}

const GRADE_CONFIG = {
  A: {
    label: 'A',
    score: 10,
    percentage: 100,
    desc: '완벽 (10점)',
    barBg: 'bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.45)]',
    textCol: 'text-emerald-500 font-black',
    badgeCol: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  },
  B: {
    label: 'B',
    score: 8,
    percentage: 80,
    desc: '우수 (8점)',
    barBg: 'bg-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.45)]',
    textCol: 'text-blue-500 font-black',
    badgeCol: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  },
  C: {
    label: 'C',
    score: 5,
    percentage: 50,
    desc: '보통 (5점)',
    barBg: 'bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.45)]',
    textCol: 'text-amber-500 font-black',
    badgeCol: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  },
  D: {
    label: 'D',
    score: 3,
    percentage: 30,
    desc: '미흡 (3점)',
    barBg: 'bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.45)]',
    textCol: 'text-orange-500 font-black',
    badgeCol: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  },
  E: {
    label: 'E',
    score: 0,
    percentage: 0,
    desc: '부진 (0점)',
    barBg: 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.45)]',
    textCol: 'text-rose-500 font-black',
    badgeCol: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  },
  F: {
    label: 'F',
    score: 0,
    percentage: 0,
    desc: '평가보류 (0점)',
    barBg: 'bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.45)]',
    textCol: 'text-purple-400 font-black',
    badgeCol: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  }
};

export default function HomeworkPerformanceChart({ logs, isLight = false }: HomeworkPerformanceChartProps) {
  const chartData = useMemo(() => {
    const items: HomeworkChartItem[] = [];

    for (const log of logs) {
      const date = log.session_date || log.date || '';
      const notes = (log.special_notes || '').trim();

      // 1. test_result JSON 파싱
      let testResultObj: any = {};
      if (log.test_result && typeof log.test_result === 'string' && log.test_result.startsWith('{')) {
        try { testResultObj = JSON.parse(log.test_result); } catch (e) {}
      }

      const hwEval = getHwEval(log.test_result);
      const hwGrade = testResultObj.hw_grade || '';
      const hwGradeLabel = testResultObj.hw_grade_label || '';
      const s = log.status || '';

      let matchedGrade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | null = null;

      // 1-1. test_result.hw_grade 명시적 등급
      if (hwGrade === 'gradeA') matchedGrade = 'A';
      else if (hwGrade === 'gradeB') matchedGrade = 'B';
      else if (hwGrade === 'gradeC') matchedGrade = 'C';
      else if (hwGrade === 'gradeD') matchedGrade = 'D';
      else if (hwGrade === 'gradeE') matchedGrade = 'E';
      else if (hwGrade === 'gradeF') matchedGrade = 'F';

      // 1-2. test_result.hw_eval (0~10 정수)
      else if (typeof hwEval === 'number') {
        if (hwEval >= 10) matchedGrade = 'A';
        else if (hwEval >= 8) matchedGrade = 'B';
        else if (hwEval >= 5) matchedGrade = 'C';
        else if (hwEval >= 3) matchedGrade = 'D';
        else if (hwGradeLabel.includes('보류') || hwGradeLabel.includes('F')) matchedGrade = 'F';
        else matchedGrade = 'E';
      }

      // 1-3. status DB 표준 ENUM
      else if (s === 'perfect') matchedGrade = 'A';
      else if (s === 'good') matchedGrade = 'B';
      else if (s === 'neutral') matchedGrade = 'C';
      else if (s === 'poor') matchedGrade = 'D';
      else if (s === 'bad') matchedGrade = 'E';

      // 1-4. special_notes 텍스트 키워드 패턴
      else if (notes) {
        if (notes.includes('A등급') || notes.includes('[A]') || notes.includes('완벽') || notes.includes('최상') || notes.includes('[숙제이행: 10단계]') || notes.includes('10단계')) matchedGrade = 'A';
        else if (notes.includes('B등급') || notes.includes('[B]') || notes.includes('잘 수행') || notes.includes('우수') || notes.includes('잘함') || notes.includes('[숙제이행: 8단계]') || notes.includes('8단계')) matchedGrade = 'B';
        else if (notes.includes('C등급') || notes.includes('[C]') || notes.includes('보통') || notes.includes('[숙제이행: 5단계]') || notes.includes('5단계')) matchedGrade = 'C';
        else if (notes.includes('D등급') || notes.includes('[D]') || notes.includes('미흡') || notes.includes('[숙제이행: 3단계]') || notes.includes('3단계')) matchedGrade = 'D';
        else if (notes.includes('E등급') || notes.includes('[E]') || notes.includes('거의 해오지') || notes.includes('안 해') || notes.includes('부진') || notes.includes('[숙제이행: 0단계]') || notes.includes('0단계')) matchedGrade = 'E';
        else if (notes.includes('F등급') || notes.includes('[F]') || notes.includes('보류') || notes.includes('가져오지') || notes.includes('미지참') || notes.includes('안가져')) matchedGrade = 'F';
      }

      // 1-5. 숙제 체크박스
      else if (log.hw_checked_today === true) {
        matchedGrade = 'A';
      }

      if (matchedGrade) {
        const config = GRADE_CONFIG[matchedGrade];
        items.push({
          date,
          grade: matchedGrade,
          score: config.score,
          percentage: config.percentage,
          desc: config.desc,
          comment: notes || undefined
        });
      }
    }

    // 최신순 리스트에서 최근 10개 슬라이스 후, 과거->현재 순(좌->우)으로 reverse
    return items.slice(0, 10).reverse();
  }, [logs]);

  if (chartData.length === 0) {
    return (
      <div className={`p-12 text-center border rounded-[4px] ${
        isLight ? 'bg-gray-50/50 border-gray-200 text-gray-400' : 'bg-white/[0.02] border-white/5 text-gray-600'
      }`}>
        <p className="text-[11px] font-bold tracking-wider">아직 기록된 과제 평가가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={`p-6 sm:p-8 rounded-[4px] space-y-6 text-left border ${
      isLight ? 'bg-gray-50/50 border-gray-200' : 'bg-[#121212] border-white/5 shadow-inner'
    }`}>
      {/* 1. 상단 타이틀 & 범례 */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-2 border-b ${
        isLight ? 'border-gray-200' : 'border-white/5'
      }`}>
        <h4 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${
          isLight ? 'text-gray-700' : 'text-gray-400'
        }`}>
          <BookOpen size={16} className="text-emerald-500" /> 과제 이행률 추이
        </h4>
        <div className={`flex items-center gap-3 text-[9px] font-bold flex-wrap ${
          isLight ? 'text-gray-500' : 'text-gray-400'
        }`}>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-emerald-400 rounded-[1px]" />
            <span>A (100%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-400 rounded-[1px]" />
            <span>B (80%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-amber-400 rounded-[1px]" />
            <span>C (50%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-orange-500 rounded-[1px]" />
            <span>D (30%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-rose-500 rounded-[1px]" />
            <span>E/F (0%)</span>
          </div>
        </div>
      </div>

      {/* 2. 바 차트 영역 */}
      <div className="h-44 flex items-end justify-between gap-3 px-2 pt-8 relative text-center">
        {/* 가이드라인 (100%, 80%, 50%, 0%) */}
        <div className={`absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none z-0 ${
          isLight ? 'opacity-30' : 'opacity-20'
        }`}>
          <div className={`border-t border-dashed w-full relative ${isLight ? 'border-gray-400' : 'border-white/30'}`}>
            <span className={`absolute -top-3 -left-5 text-[9px] font-black ${isLight ? 'text-gray-700' : 'text-white'}`}>100%</span>
          </div>
          <div className={`border-t border-dashed w-full ${isLight ? 'border-gray-200' : 'border-white/10'}`} />
          <div className={`border-t border-dashed w-full relative ${isLight ? 'border-emerald-500/50' : 'border-white/20'}`}>
            <span className="absolute -top-3 -left-4 text-[9px] font-black text-emerald-500">50%</span>
          </div>
          <div className={`border-t border-solid w-full ${isLight ? 'border-gray-300' : 'border-white/30'}`} />
        </div>

        {chartData.map((data, i) => {
          const config = GRADE_CONFIG[data.grade];
          // 0%인 E/F 등급도 바가 완전히 안 보이는 것을 방지하고 클릭/호버할 수 있도록 최소 6px 높이 부여
          const barHeightPercent = Math.max(5, data.percentage);

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative z-10">
              {/* 호버 툴팁 (management_notes 제외, special_notes 코멘트만 노출) */}
              <div className={`absolute -top-20 left-1/2 -translate-x-1/2 border text-[10px] font-black px-3 py-2 rounded-[4px] opacity-0 group-hover:opacity-100 transition-all z-30 whitespace-nowrap shadow-2xl scale-75 group-hover:scale-100 origin-bottom pointer-events-none flex flex-col gap-1 items-center max-w-[200px] text-center ${
                isLight ? 'bg-white border-gray-250 text-gray-800 shadow-gray-400/20' : 'bg-[#1a1a1a] border-white/10 text-white shadow-2xl'
              }`}>
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] border font-black ${config.badgeCol}`}>
                    {data.grade}등급 ({data.percentage}%)
                  </span>
                </div>
                {data.comment && (
                  <span className={`text-[9px] font-medium truncate max-w-[180px] ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
                    "{data.comment}"
                  </span>
                )}
              </div>

              {/* 막대 상단 등급 라벨 */}
              <div 
                className="absolute text-[10px] font-black pointer-events-none z-20 whitespace-nowrap select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                style={{ 
                  bottom: `calc(${data.percentage * 1.4}px + 30px)`, 
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                <span className={config.textCol}>{data.grade}</span>
              </div>

              {/* 막대 바 */}
              <div className={`w-full max-w-[28px] rounded-t-[2px] relative flex items-end h-[140px] overflow-hidden transition-colors ${
                isLight ? 'bg-gray-200/60 group-hover:bg-gray-200' : 'bg-white/5 group-hover:bg-white/10'
              }`}>
                <motion.div 
                  initial={{ height: 0 }} 
                  animate={{ height: `${barHeightPercent}%` }} 
                  transition={{ delay: i * 0.05, duration: 0.8, ease: [0.33, 1, 0.68, 1] }} 
                  className={`w-full rounded-t-[1px] opacity-[0.85] group-hover:opacity-100 transition-opacity ${config.barBg}`} 
                />
              </div>

              {/* 막대 하단 날짜 (MM.DD) */}
              <span className={`text-[9px] font-black rotate-45 origin-left whitespace-nowrap ml-2 mt-1 transition-colors ${
                isLight ? 'text-gray-500 group-hover:text-gray-900' : 'text-gray-500 group-hover:text-white'
              }`}>
                {data.date.slice(5).replace('-', '.')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
