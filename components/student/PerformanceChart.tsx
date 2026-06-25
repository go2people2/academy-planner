'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { parseInlineTests } from '@/lib/utils';

interface PerformanceChartProps {
  logs: any[];
}

interface ChartItem {
  date: string;
  testName: string;
  score: number;
  maxScore: number;
  type: 'score' | 'count';
  percentage: number;
}

export default function PerformanceChart({ logs }: PerformanceChartProps) {
  const chartData = useMemo(() => {
    const items: ChartItem[] = [];

    // logs는 최신순(역순)으로 들어오므로, 모든 로그를 순회하며 테스트 항목을 추출합니다.
    for (const log of logs) {
      const date = log.session_date || '';

      // 1. 인라인 테스트 파싱 시도 (test_status)
      const parsed = parseInlineTests(log.test_status);
      if (parsed && parsed.length > 0) {
        for (const t of parsed) {
          if (t.numericScore !== null && t.numericScore !== undefined) {
            const type = t.maxScore === 100 ? 'score' : 'count';
            const percentage = t.maxScore > 0 ? (t.numericScore / t.maxScore) * 100 : 0;
            items.push({
              date,
              testName: t.name || '테스트',
              score: t.numericScore,
              maxScore: t.maxScore,
              type,
              percentage,
            });
          }
        }
      } else {
        // 2. 기존 수동 입력 test_score 파싱
        if (log.test_score !== null && log.test_score !== undefined) {
          const isCount = log.test_score_type === 'count';
          const score = parseFloat(log.test_score) || 0;
          const maxScore = isCount ? (parseInt(log.test_total_count) || 10) : 100;
          const type = isCount ? 'count' : 'score';
          const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
          items.push({
            date,
            testName: '테스트',
            score,
            maxScore,
            type,
            percentage,
          });
        }
      }
    }

    // 최신순으로 추출된 리스트에서 최근 10개만 슬라이스한 후, 과거->현재 순으로 그리기 위해 reverse() 합니다.
    return items.slice(0, 10).reverse();
  }, [logs]);

  if (chartData.length === 0) return null;

  return (
    <div className="bg-[#121212] border border-white/5 p-10 rounded-[4px] space-y-8 shadow-inner text-left mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-3">
        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-500" /> Performance Trend
        </h4>
        <div className="flex items-center gap-4 text-[9px] font-bold text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-amber-500 rounded-[1px] opacity-80" />
            <span>점수형 (100점 만점)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-pink-500 rounded-[1px] opacity-80" />
            <span>개수형 (맞힌 수 / 문항 수)</span>
          </div>
        </div>
      </div>
      <div className="h-44 flex items-end justify-between gap-3 px-2 pt-8 relative text-center">
        <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none opacity-20 z-0">
          <div className="border-t border-dashed border-white/30 w-full relative">
            <span className="absolute -top-3 -left-5 text-[9px] font-black text-white">100</span>
          </div>
          <div className="border-t border-dashed border-white/10 w-full" />
          <div className="border-t border-dashed border-white/20 w-full relative">
            <span className="absolute -top-3 -left-4 text-[9px] font-black text-amber-500">60</span>
          </div>
          <div className="border-t border-solid border-white/30 w-full" />
        </div>
        {chartData.map((data, i) => {
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative z-10">
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 text-white text-[10px] font-black px-2.5 py-1.5 rounded-[4px] opacity-0 group-hover:opacity-100 transition-all z-30 whitespace-nowrap shadow-2xl scale-75 group-hover:scale-100 origin-bottom pointer-events-none flex flex-col gap-0.5 items-center">
                <span className="text-gray-400">{data.testName}</span>
                {data.type === 'score' ? (
                  <span className="text-amber-400 text-[11px]">{data.score}점</span>
                ) : (
                  <span className="text-pink-400 text-[11px]">{data.score} / {data.maxScore} 개</span>
                )}
              </div>
              <div 
                className="absolute text-[9px] font-black pointer-events-none z-20 whitespace-nowrap select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                style={{ 
                  bottom: `calc(${data.percentage * 1.4}px + 30px)`, 
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                {data.type === 'score' ? (
                  <span className="text-amber-500/90">{data.score}</span>
                ) : (
                  <span className="text-pink-500/90">{data.score}/{data.maxScore}</span>
                )}
              </div>
              <div className="w-full max-w-[28px] bg-white/5 rounded-t-[2px] relative flex items-end h-[140px] overflow-hidden group-hover:bg-white/10 transition-colors">
                {data.type === 'score' ? (
                  <motion.div 
                    initial={{ height: 0 }} 
                    animate={{ height: `${Math.min(100, Math.max(0, data.percentage))}%` }} 
                    transition={{ delay: i * 0.05, duration: 1, ease: [0.33, 1, 0.68, 1] }} 
                    className={`w-full rounded-t-[1px] opacity-60 group-hover:opacity-100 transition-opacity ${
                      data.percentage >= 80 ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 
                      data.percentage >= 60 ? 'bg-amber-600/80' : 'bg-red-500/80'
                    }`} 
                  />
                ) : (
                  data.maxScore > 25 ? (
                    <motion.div 
                      initial={{ height: 0 }} 
                      animate={{ height: `${Math.min(100, Math.max(0, data.percentage))}%` }} 
                      transition={{ delay: i * 0.05, duration: 1, ease: [0.33, 1, 0.68, 1] }} 
                      className={`w-full rounded-t-[1px] opacity-60 group-hover:opacity-100 transition-opacity ${
                        data.percentage >= 80 ? 'bg-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]' : 
                        data.percentage >= 60 ? 'bg-pink-600/80' : 'bg-red-500/80'
                      }`} 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col-reverse justify-between gap-[2px]">
                      {Array.from({ length: data.maxScore }).map((_, idx) => {
                        const isLightOn = idx < data.score;
                        return (
                          <motion.div
                            key={idx}
                            initial={{ scaleY: 0, opacity: 0 }}
                            animate={{ scaleY: 1, opacity: isLightOn ? 0.7 : 0.2 }}
                            whileHover={{ opacity: isLightOn ? 1.0 : 0.3 }}
                            transition={{ delay: i * 0.05 + idx * 0.03, duration: 0.3 }}
                            className={`w-full flex-1 rounded-[1px] transition-all ${
                              isLightOn 
                                ? (data.percentage >= 80 ? 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.4)]' : data.percentage >= 60 ? 'bg-pink-600/80' : 'bg-red-500/80')
                                : 'bg-white/10'
                            }`}
                          />
                        );
                      })}
                    </div>
                  )
                )}
              </div>
              <span className="text-[9px] font-black text-gray-500 rotate-45 origin-left whitespace-nowrap ml-2 mt-1 group-hover:text-white transition-colors">
                {data.date.slice(5).replace('-', '.')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
