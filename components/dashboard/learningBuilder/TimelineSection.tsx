'use client';

import { Clock, ListPlus, Trash2 } from 'lucide-react';

export interface TimelinePartItem {
  id: string;
  timeStr: string; // "08:15"
  label: string;   // "2파트: 대표유형"
}

interface TimelineSectionProps {
  timelineText: string;
  onChangeTimelineText: (text: string) => void;
  isLight?: boolean;
}

export default function TimelineSection({
  timelineText,
  onChangeTimelineText,
  isLight = false
}: TimelineSectionProps) {
  return (
    <div className={`p-3.5 rounded-md border space-y-2.5 ${
      isLight ? 'bg-purple-50/40 border-purple-150' : 'bg-slate-900 border-purple-500/20'
    }`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-xs text-purple-600 dark:text-purple-300 flex items-center gap-1.5">
          <Clock size={14} />
          <span>⏱️ 영상 내 세부 파트 & 타임스탬프 설정</span>
        </span>
        <span className="text-[10px] opacity-70">줄바꿈으로 구분</span>
      </div>

      <p className="text-[11px] opacity-75">
        양식: <code>[분:초] 파트명</code> (예: <code>[00:00] 1파트: 개념설명</code> 또는 <code>[08:15] 28번 문항</code>)
      </p>

      <textarea
        value={timelineText}
        onChange={(e) => onChangeTimelineText(e.target.value)}
        rows={4}
        placeholder="[00:00] 1파트: 핵심 개념 설명&#10;[08:15] 2파트: 대표유형 1번~5번&#10;[18:30] 3파트: 심화 응용 문제&#10;[24:10] 28번 문항 핀포인트 해설"
        className={`w-full p-2.5 text-xs font-mono rounded border outline-none font-bold placeholder:text-gray-400 ${
          isLight ? 'bg-white border-purple-200 text-gray-800 focus:border-purple-500' : 'bg-black/30 border-purple-500/30 text-white'
        }`}
      />
    </div>
  );
}
