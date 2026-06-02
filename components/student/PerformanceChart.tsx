'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface PerformanceChartProps {
  logs: any[];
}

export default function PerformanceChart({ logs }: PerformanceChartProps) {
  const chartData = useMemo(() => 
    logs.filter(l => l.test_score !== null && l.test_score !== undefined)
        .slice(0, 10)
        .reverse(), 
    [logs]
  );

  if (chartData.length < 2) return null;

  return (
    <div className="bg-[#121212] border border-white/5 p-10 rounded-[4px] space-y-8 shadow-inner text-left mt-8">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-500" /> Performance Trend
        </h4>
        <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-[2px] border border-blue-500/20">
          Last 10 Tests
        </span>
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
        {chartData.map((data, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative z-10">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[11px] font-black px-2.5 py-1.5 rounded-[2px] opacity-0 group-hover:opacity-100 transition-all z-20 whitespace-nowrap shadow-2xl scale-75 group-hover:scale-100 origin-bottom">
              {data.test_score}%
            </div>
            <div className="w-full max-w-[28px] bg-white/5 rounded-t-[2px] relative flex items-end h-[140px] overflow-hidden group-hover:bg-white/10 transition-colors">
              <motion.div 
                initial={{ height: 0 }} 
                animate={{ height: `${Math.min(100, Math.max(0, data.test_score))}%` }} 
                transition={{ delay: i * 0.05, duration: 1, ease: [0.33, 1, 0.68, 1] }} 
                className={`w-full rounded-t-[1px] ${
                  data.test_score >= 80 ? 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 
                  data.test_score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`} 
              />
            </div>
            <span className="text-[9px] font-black text-gray-500 rotate-45 origin-left whitespace-nowrap ml-2 mt-1 group-hover:text-white transition-colors">
              {data.session_date.slice(5).replace('-', '.')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
