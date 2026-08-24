'use client';

import React from 'react';
import { FileText, Target } from 'lucide-react';

interface TestStatusSectionProps {
  todaySession?: any;
  todayTestText?: string | null;
  nextTestText?: string | null;
}

// 💡 데일리 시트와 일반 테스트 데이터 통합을 위해 포맷 통합 헬퍼
export const getCombinedTestText = (status: string | undefined | null, score: string | undefined | null) => {
  const cleanStatus = String(status || '').trim();
  const cleanScore = String(score || '').trim();
  if (!cleanStatus) return '';

  if (cleanStatus.includes(':')) {
    return cleanStatus;
  }

  if (cleanScore) {
    return `- ${cleanStatus} : ${cleanScore}`;
  }

  return `- ${cleanStatus}`;
};

// 💡 데일리 시트(TodaySheetCell)와 동일한 하이라이팅 규칙을 학생 페이지로 이식하는 컴포넌트
export function RenderTestText({
  text,
  className = "text-[14px] leading-snug"
}: {
  text: string | undefined | null;
  className?: string;
}) {
  if (!text) return null;

  return (
    <div className={`flex flex-col gap-1.5 w-full text-left ${className}`}>
      {text.split('\n').map((line, i) => {
        const isLast = i === text.split('\n').length - 1;
        let cleanLine = line.trim();
        if (!cleanLine) return null;

        // 맨 앞의 하이픈(-)만 제거
        if (cleanLine.startsWith('-')) {
          cleanLine = cleanLine.substring(1).trim();
        }

        const colonIdx = cleanLine.indexOf(':');
        if (colonIdx === -1) {
          return (
            <div key={i} className="font-bold text-white break-all">
              {cleanLine}
              {!isLast && '\n'}
            </div>
          );
        }

        const beforeColon = cleanLine.substring(0, colonIdx + 1);
        const afterColon = cleanLine.substring(colonIdx + 1);

        const commaIdx = afterColon.indexOf(',');
        const scorePart = commaIdx !== -1 ? afterColon.substring(0, commaIdx) : afterColon;
        const memoPart = commaIdx !== -1 ? afterColon.substring(commaIdx) : '';

        const highlightScore = (str: string) => {
          const trimmed = str.trim();
          if (!trimmed.includes('/')) {
            if (trimmed !== '') {
              return <span className="text-emerald-400 font-bold">{str}</span>;
            }
            return <span className="text-white">{str}</span>;
          }

          const parts = trimmed.split('/');
          const isPending = parts[0] === '';

          return (
            <span className="font-bold">
              <span className={isPending ? 'text-gray-400' : 'text-pink-300'}>
                {isPending ? ' -' : ` ${parts[0]}`}
              </span>
              {parts.length > 1 && (
                <>
                  <span className="text-gray-600 mx-0.5">/</span>
                  <span className="text-blue-400">{parts[1]}</span>
                </>
              )}
              {parts.length > 2 && (
                <>
                  <span className="text-gray-600 mx-0.5">/</span>
                  <span className="text-orange-400">{parts[2]}</span>
                </>
              )}
              {parts.slice(3).map((p, idx) => (
                <React.Fragment key={idx}>
                  <span className="text-gray-600 mx-0.5">/</span>
                  <span>{p}</span>
                </React.Fragment>
              ))}
            </span>
          );
        };

        return (
          <div key={i} className="break-all">
            <span className="text-white font-bold">{beforeColon}</span>
            {highlightScore(scorePart)}
            <span className="text-gray-500 italic ml-1">{memoPart}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function TestStatusSection({ todaySession, todayTestText, nextTestText }: TestStatusSectionProps) {
  const finalTodayTest = todayTestText !== undefined
    ? (todayTestText ? getCombinedTestText(todayTestText, null) : '')
    : getCombinedTestText(todaySession?.test_status, todaySession?.test_score);

  const finalNextTest = nextTestText !== undefined
    ? (nextTestText || '')
    : (todaySession?.next_quiz_text || '');

  return (
    <div className="space-y-10">
      {/* 오늘 TEST */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <FileText size={14} className="text-rose-500" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white">오늘TEST</h3>
        </div>
        {finalTodayTest ? (
          <div className="bg-rose-600/10 border border-rose-500/30 p-3 rounded-md shadow-lg text-left border-l-4 border-l-rose-500">
            <RenderTestText text={finalTodayTest} />
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
        {finalNextTest ? (
          <div className="bg-indigo-600/10 border border-indigo-500/30 p-3 rounded-md shadow-lg text-left border-l-4 border-l-indigo-500">
            <RenderTestText text={finalNextTest} />
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
