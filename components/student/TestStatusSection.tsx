'use client';

import { FileText, Target } from 'lucide-react';

interface TestStatusSectionProps {
  todaySession: any;
}

export default function TestStatusSection({ todaySession }: TestStatusSectionProps) {
  return (
    <div className="space-y-10">
      {/* 오늘 TEST */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <FileText size={14} className="text-rose-500" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white">오늘TEST</h3>
        </div>
        {todaySession?.test_status ? (
          <div className="bg-rose-600/10 border border-rose-500/30 p-3 rounded-md shadow-lg text-left border-l-4 border-l-rose-500">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] font-black text-white leading-tight">{todaySession.test_status}</p>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {todaySession?.test_score !== null && (
                    <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded">완료</span>
                  )}
                  {todaySession?.test_score !== null && (
                    <p className="text-[10px] font-black text-rose-400 whitespace-nowrap">{todaySession.test_score}%</p>
                  )}
                </div>
              </div>
              {todaySession?.test_cut > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-white bg-rose-600 px-2 py-0.5 rounded shadow-sm flex items-center gap-1.5">
                    커트라인: <span className="text-amber-400">{todaySession.test_cut}</span>개 이하
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative py-1 group">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-rose-500/30"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0a0a0a] px-4 text-[11px] font-black text-rose-500 uppercase tracking-widest border border-rose-500/20 rounded-full">없음</span>
            </div>
          </div>
        )}
      </div>

      {/* 다음 TEST */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Target size={14} className="text-indigo-500" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white">다음TEST</h3>
        </div>
        {todaySession?.next_quiz_text ? (
          <div className="bg-indigo-600/10 border border-indigo-500/30 p-3 rounded-md shadow-lg text-left border-l-4 border-l-indigo-500">
            <div className="flex flex-col gap-2">
              <p className="text-[14px] font-black text-white leading-tight whitespace-pre-wrap">{todaySession.next_quiz_text}</p>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-black text-white bg-indigo-600 px-2 py-0.5 rounded shadow-sm flex items-center gap-1.5">
                  커트라인: <span className="text-amber-400">{todaySession.next_quiz_cut}</span>개 이하
                </span>
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{todaySession.next_quiz_trial}차</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative py-1 group">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-indigo-500/30"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0a0a0a] px-4 text-[11px] font-black text-indigo-500 uppercase tracking-widest border border-indigo-500/20 rounded-full">없음</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
