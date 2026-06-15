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
  const isCountMode = formData.test_score_type === 'count';

  // 💡 인라인 테스트 모드 감지 (하이픈 문법을 썼다면 점수칸은 요약 뱃지로 변신)
  const parsedTests = parseInlineTests(formData.test_id);

  if (parsedTests) {
    return (
      <div className="relative w-full min-h-[22px] flex flex-col items-end justify-center px-3 py-1.5 group/score">
        {parsedTests.map((t, idx) => {
          const isPending = t.numericScore === null;
          const scoreText = isPending 
            ? (t.maxScore === 100 ? '채점 전' : `- / ${t.maxScore}`)
            : (t.maxScore === 100 ? `${t.numericScore}점` : `${t.numericScore}/${t.maxScore}`);
            
          let colorClass = 'text-gray-400';
          if (!isPending) {
            colorClass = t.isPass ? 'text-emerald-400' : 'text-red-400';
          }

          return (
            <div 
              key={idx} 
              className={`text-[12px] font-bold leading-snug text-right ${colorClass}`} 
              title={t.name}
            >
              {scoreText}
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
            className={`bg-transparent border-0 outline-none text-[14px] text-emerald-400 font-black p-0 m-0 ${isCountMode ? 'w-8 text-right' : 'w-full text-left'}`} 
          />

          {isCountMode && (
            <>
              <span className="text-gray-600 font-bold mx-1.5 shrink-0">/</span>
              <input 
                ref={totalInputRef}
                type="text"
                defaultValue={formData.test_total_count || ''}
                placeholder="?"
                className="w-10 bg-transparent border-0 outline-none text-[14px] text-blue-400 font-black p-0 m-0 text-left"
                onKeyDown={(e) => {
                  if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'Enter') {
                    // 💡 [Tab/Enter 저장] 단일 계약 사용
                    const scoreVal = numeratorInputRef.current?.value || formData.test_score;
                    onSave({ test_score: scoreVal, test_total_count: (e.target as HTMLInputElement).value });
                  }
                  handleKeyDown(e, colId);
                }}
                onBlur={(e) => {
                  // 💡 분자로 되돌아갈 때는 저장 무시 (TypeError 방지를 위해 로컬 Ref 사용)
                  if (e.relatedTarget === numeratorInputRef.current) return;
                  onSave({ test_total_count: e.target.value }, { isBlur: true });
                }}
              />
            </>
          )}
        </div>
      )}
      
      {!isEditing && !isActive && (
        <div 
          onClick={(e) => handleCellInteraction(e, colId, 'click')}
          onDoubleClick={(e) => handleCellInteraction(e, colId, 'dblclick')}
          className="px-4 text-[14px] text-left text-emerald-400 font-black pr-4 w-full min-h-[22px] py-1 flex items-center justify-start cursor-text group-hover/td:bg-white/[0.02] transition-colors"
        >
          {formData.test_score ? (
            formData.test_score_type === 'score' ? (
              `${formData.test_score}점`
            ) : (
              formData.test_total_count ? `${formData.test_score}개 / ${formData.test_total_count}개` : `${formData.test_score}개`
            )
          ) : '-'}
        </div>
      )}

      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-30">
        <button 
          onClick={(e) => { e.stopPropagation(); onTestScoreTypeToggle(); }} 
          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all text-[9px] font-black tracking-tighter ${formData.test_score_type === 'score' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}
          title={formData.test_score_type === 'score' ? '점수 모드 (클릭하여 개수 모드로 변경)' : '개수 모드 (클릭하여 점수 모드로 변경)'}
        >
          {formData.test_score_type === 'score' ? '점' : '개'}
        </button>
      </div>
    </div>
  );
});
