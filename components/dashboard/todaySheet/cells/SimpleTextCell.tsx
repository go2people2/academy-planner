'use client';

import React, { useLayoutEffect } from 'react';

interface SimpleTextCellProps {
  student: any;
  colId: string;
  currentText: string;
  isEditing: boolean;
  isActive: boolean;
  onSave: (field: string, value: string, options?: any) => void;
  handleKeyDown: (e: React.KeyboardEvent, colId: string) => void;
  handleLocalInput: (e: React.FormEvent<HTMLTextAreaElement>, field: string) => void;
  handleCellInteraction: (e: React.MouseEvent, colId: string, type: 'click' | 'dblclick') => void;
  commonTextStyle: string;
  snippets?: string[];
  snippetTrigger?: string;
}

export const SimpleTextCell = React.forwardRef<HTMLTextAreaElement, SimpleTextCellProps>(({
  student, colId, currentText, isEditing, isActive, onSave, handleKeyDown, handleLocalInput, handleCellInteraction, commonTextStyle, snippets, snippetTrigger
}, ref) => {

  // 💡 [이식] 해당 컬럼의 자동 높이 조절 및 포커스 로직
  useLayoutEffect(() => {
    if (ref && typeof ref !== 'function' && ref.current && (isEditing || isActive)) {
      if (document.activeElement !== ref.current) {
        ref.current.value = currentText || '';
      }
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
      if (isEditing && document.activeElement !== ref.current) ref.current.focus();
    }
  }, [isEditing, isActive, currentText, ref]);

  return (
    <div className="relative w-full h-full flex items-start justify-start group/cell">
      {(isEditing || isActive) && (
        <textarea 
          ref={ref}
          defaultValue={currentText || ''} 
          data-student-id={student.id}
          data-col-id={colId}
          onFocus={(e) => {
            // 💡 포커스를 얻는 순간 (천천히 클릭하여 입력 모드 진입 포함) 락 브로드캐스트 활성화
            handleCellInteraction(e as any, colId, 'dblclick');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              onSave(colId, (e.target as HTMLTextAreaElement).value);
            }
            handleKeyDown(e, colId);
          }} 
          onBlur={(e) => onSave(colId, e.target.value, { isBlur: true })} 
          placeholder="-" 
          className={`${commonTextStyle} bg-transparent resize-none overflow-y-hidden block relative z-20`} 
          onInput={(e) => handleLocalInput(e, colId)} 
        />
      )}
      
      {!isEditing && !isActive && (
        <div 
          onClick={(e) => handleCellInteraction(e, colId, 'click')}
          onDoubleClick={(e) => handleCellInteraction(e, colId, 'dblclick')}
          className={`${commonTextStyle} whitespace-pre-wrap min-h-[22px] flex flex-col items-start justify-start cursor-text`}
        >
          <div className="w-full">{currentText || '-'}</div>
        </div>
      )}
    </div>
  );
});

SimpleTextCell.displayName = 'SimpleTextCell';
