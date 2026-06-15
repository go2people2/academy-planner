'use client';

import React from 'react';
import { parseInlineTests } from '@/lib/utils';

interface ScoreCellProps {
  student: any;
  colId: string;
  formData: any;
  isEditing: boolean;
  isActive: boolean;
  scoreInputRef?: (el: HTMLInputElement | null) => void;
  // 💡 단일 계약 고정: (updates, options?)
  onSave: (updates: Record<string, any>, options?: { isBlur?: boolean }) => void; 
  handleKeyDown: (e: React.KeyboardEvent, colId: string) => void;
  handleLocalInput: (e: React.FormEvent<HTMLInputElement>, field: string) => void;
  handleCellInteraction: (e: React.MouseEvent, colId: string, type: 'click' | 'dblclick') => void;
  onTestScoreTypeToggle: () => void;
}

export const ScoreCell = React.memo(function ScoreCell({
  student, colId, formData, isEditing, isActive, scoreInputRef,
  onSave, handleKeyDown, handleLocalInput, handleCellInteraction,
  onTestScoreTypeToggle
}: ScoreCellProps) {
  
  // 💡 로컬 Ref 신설하여 안전한 element 참조 보장 (prop이 함수일 경우 대응)
  const numeratorInputRef = React.useRef<HTMLInputElement>(null);
  const totalInputRef = React.useRef<HTMLInputElement>(null);


  // 💡 인라인 테스트 모드 감지 (하이픈 문법을 썼다면 점수칸은 요약 뱃지로 변신)
  const parsedTests = parseInlineTests(formData.test_id);

  if (parsedTests) {
    return (
      <div className="relative w-full min-h-[22px] flex flex-col items-end justify-center px-3 py-1.5 group/score">
        {parsedTests.map((t, idx) => {
          const isPending = t.numericScore === null;
          let scoreColor = 'text-gray-400';
          if (!isPending) {
            scoreColor = t.isPass ? 'text-emerald-400' : 'text-red-400';
          }

          return (
            <div 
              key={idx} 
              className="text-[12px] font-bold leading-snug text-right tracking-tight" 
              title={t.name}
            >
              {t.maxScore === 100 ? (
                <span className={scoreColor}>{isPending ? '채점 전' : `${t.numericScore}점`}</span>
              ) : (
                <>
                  <span className={scoreColor}>{isPending ? '-' : t.numericScore}</span>
                  <span className="text-gray-600 mx-0.5">/</span>
                  <span className="text-blue-400">{t.maxScore}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[22px] flex items-center justify-start group/score py-1 px-1">
      {(isEditing || isActive) && (
        <div className="flex items-center w-full min-h-[22px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <input 
            ref={(el) => {
              // 💡 로컬 Ref와 외부 Ref(prop) 동시 지원
              (numeratorInputRef as any).current = el;
              if (typeof scoreInputRef === 'function') scoreInputRef(el);
            }}
            type="text" 
            defaultValue={formData.test_score || ''} 
            data-student-id={student.id}
            data-col-id={colId}
            autoFocus={isEditing} 
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey && isCountMode) {
                // 💡 분자에서 Tab: 분모로 내부 이동 (저장 안 함)
                e.preventDefault();
                totalInputRef.current?.focus();
                return;
              }
              if (e.key === 'Enter') {
                // 💡 [Enter 저장] 단일 계약 사용
                const scoreVal = (e.target as HTMLInputElement).value;
                const totalVal = isCountMode ? (totalInputRef.current?.value || formData.test_total_count) : undefined;
                onSave({ test_score: scoreVal, test_total_count: totalVal });
              }
              handleKeyDown(e, colId);
            }} 
            onBlur={(e) => {
              // 💡 분모로 이동할 때는 저장 무시
              if (isCountMode && e.relatedTarget === totalInputRef.current) return;
              onSave({ test_score: e.target.value }, { isBlur: true });
            }} 
            onChange={(e) => handleLocalInput(e, 'test_score')} 
            placeholder="-" 
            className="bg-transparent border-0 outline-none text-[14px] text-emerald-400 font-black p-0 m-0 w-full text-left" 
          />
        </div>
      )}
      
      {!isEditing && !isActive && (
        <div 
          onClick={(e) => handleCellInteraction(e, colId, 'click')}
          onDoubleClick={(e) => handleCellInteraction(e, colId, 'dblclick')}
          className="px-4 text-[14px] text-left text-emerald-400 font-black pr-4 w-full min-h-[22px] py-1 flex items-center justify-start cursor-text group-hover/td:bg-white/[0.02] transition-colors"
        >
          {formData.test_score ? `${formData.test_score}점` : '-'}
        </div>
      )}
    </div>
  );
});
