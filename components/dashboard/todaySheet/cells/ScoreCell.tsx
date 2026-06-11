'use client';

import React from 'react';
import { Percent, Hash } from 'lucide-react';

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

  return (
    <div className="relative w-full h-full flex items-center justify-start group/score">
      {(isEditing || isActive) && (
        <div className="flex items-center w-full h-full px-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
          className="px-4 text-[14px] text-left text-emerald-400 font-black pr-4 w-full h-[56px] flex items-center justify-start cursor-text group-hover/td:bg-white/[0.02] transition-colors"
        >
          {formData.test_score ? (formData.test_score_type === 'score' ? `${formData.test_score}%` : `${formData.test_score}/${formData.test_total_count || '?'}`) : '-'}
        </div>
      )}

      <div className="absolute right-1 flex flex-col gap-0.5 z-30">
        <button 
          onClick={(e) => { e.stopPropagation(); onTestScoreTypeToggle(); }} 
          className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${formData.test_score_type === 'score' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-400'}`}
        >
          {formData.test_score_type === 'score' ? <Percent size={8} strokeWidth={4} /> : <Hash size={8} strokeWidth={4} />}
        </button>
        <span className="text-[7px] font-black text-gray-600/50 text-center uppercase">
          {formData.test_score_type === 'score' ? '%' : 'ea'}
        </span>
      </div>
    </div>
  );
});
