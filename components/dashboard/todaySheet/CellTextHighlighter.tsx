'use client';

import React from 'react';

interface CellTextHighlighterProps {
  text: string;
  columnId: string;
  isLight?: boolean;
}

export const CellTextHighlighter: React.FC<CellTextHighlighterProps> = ({
  text,
  columnId,
  isLight = false,
}) => {
  if (!text) return <>-</>;

  const isTestField = columnId === 'test_id' || columnId === 'next_quiz';
  const isTaskField =
    columnId === 'classwork' ||
    columnId === 'completed_classwork' ||
    columnId === 'assign' ||
    columnId === 'mission' ||
    columnId === 'notes' ||
    columnId === 'management_notes';

  if (!isTestField && !isTaskField) return <>{text}</>;

  return (
    <>
      {text.split('\n').map((line, i) => {
        const isLast = i === text.split('\n').length - 1;

        if (isTestField) {
          if (!line.trim().startsWith('-')) {
            return (
              <React.Fragment key={i}>
                {line}
                {!isLast && '\n'}
              </React.Fragment>
            );
          }

          const colonIdx = line.indexOf(':');
          if (colonIdx === -1) {
            return (
              <React.Fragment key={i}>
                {line}
                {!isLast && '\n'}
              </React.Fragment>
            );
          }

          const beforeColon = line.substring(0, colonIdx + 1);
          const afterColon = line.substring(colonIdx + 1);

          const commaIdx = afterColon.indexOf(',,');
          const scorePart = commaIdx !== -1 ? afterColon.substring(0, commaIdx) : afterColon;
          const memoPart = commaIdx !== -1 ? afterColon.substring(commaIdx + 2) : '';

          const highlightScore = (str: string) => {
            if (!str.includes('/')) {
              return (
                <span className={isLight ? 'text-emerald-700 font-medium' : 'text-emerald-400 font-normal'}>
                  {str}
                </span>
              );
            }

            const parts = str.split('/');
            return (
              <span className="font-normal">
                <span className={isLight ? 'text-rose-600 font-medium' : 'text-pink-300'}>{parts[0]}</span>
                {parts.length > 1 && (
                  <>
                    <span className={isLight ? 'text-gray-400 mx-0.5' : 'text-gray-600 mx-0.5'}>/</span>
                    <span className={isLight ? 'text-blue-600 font-medium' : 'text-blue-400'}>{parts[1]}</span>
                  </>
                )}
                {parts.length > 2 && (
                  <>
                    <span className={isLight ? 'text-gray-400 mx-0.5' : 'text-gray-600 mx-0.5'}>/</span>
                    <span className={isLight ? 'text-amber-600 font-medium' : 'text-orange-400'}>{parts[2]}</span>
                  </>
                )}
                {parts.slice(3).map((p, idx) => (
                  <React.Fragment key={idx}>
                    <span className={isLight ? 'text-gray-400 mx-0.5' : 'text-gray-600 mx-0.5'}>/</span>
                    <span>{p}</span>
                  </React.Fragment>
                ))}
              </span>
            );
          };

          return (
            <React.Fragment key={i}>
              <span className={isLight ? 'text-[#1e293b] font-normal' : ''}>{beforeColon}</span>
              {highlightScore(scorePart)}
              <span className={isLight ? 'text-gray-500 italic' : 'text-gray-500 italic'}>{memoPart}</span>
              {!isLast && '\n'}
            </React.Fragment>
          );
        }

        if (isTaskField) {
          const match = line.match(/^(\s*[-*+•]\s*)(.*)$/);
          const assignClass =
            columnId === 'assign'
              ? isLight
                ? 'text-[#0f172a] font-normal'
                : 'text-blue-200 font-normal'
              : isLight
              ? 'text-[#1e293b] font-normal'
              : '';

          if (!match) {
            const plainCommaIdx = line.indexOf(',,');
            if (plainCommaIdx === -1) {
              return (
                <React.Fragment key={i}>
                  <span className={assignClass}>{line}</span>
                  {!isLast && '\n'}
                </React.Fragment>
              );
            }
            const plainContent = line.substring(0, plainCommaIdx);
            const plainMemo = line.substring(plainCommaIdx + 2);
            return (
              <React.Fragment key={i}>
                <span className={assignClass}>{plainContent}</span>
                <span className={isLight ? 'text-gray-500 italic ml-1' : 'text-gray-400 italic ml-1'}>
                  ({plainMemo})
                </span>
                {!isLast && '\n'}
              </React.Fragment>
            );
          }

          const prefix = match[1];
          const contentAndMemo = match[2];
          const commaIdx = contentAndMemo.indexOf(',,');

          let content = contentAndMemo;
          let memo = '';
          if (commaIdx !== -1) {
            content = contentAndMemo.substring(0, commaIdx);
            memo = contentAndMemo.substring(commaIdx + 2);
          }

          return (
            <React.Fragment key={i}>
              <span className={isLight ? 'text-blue-600 font-medium' : 'text-blue-400 font-normal'}>{prefix}</span>
              <span className={assignClass}>{content}</span>
              {memo && (
                <span className={isLight ? 'text-gray-500 italic ml-1' : 'text-gray-400 italic ml-1'}>
                  ({memo})
                </span>
              )}
              {!isLast && '\n'}
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={i}>
            {line}
            {!isLast && '\n'}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default CellTextHighlighter;
