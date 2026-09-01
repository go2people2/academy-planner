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
  const draftRef = React.useRef<string | undefined>(undefined);
  const prevIsEditingRef = React.useRef(isEditing);

  // 💡 [편집 모드 진입 1회 포커스] isEditing이 true로 새로 진입할 때만 1회 포커스 부여
  React.useEffect(() => {
    if (isEditing && !prevIsEditingRef.current) {
      if (ref && typeof ref !== 'function' && ref.current && document.activeElement !== ref.current) {
        ref.current.focus();
      }
    }
    prevIsEditingRef.current = isEditing;
  }, [isEditing, ref]);

  // 💡 [이식] 해당 컬럼의 자동 높이 조절 및 DOM value 동기화 (사용자 입력 중 draft 보호)
  useLayoutEffect(() => {
    if (ref && typeof ref !== 'function' && ref.current && isEditing) {
      const isFocused = document.activeElement === ref.current;
      if (!isFocused && draftRef.current === undefined) {
        ref.current.value = currentText || '';
      }
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [isEditing, currentText, ref]);

  return (
    <div className="relative w-full h-full flex items-start justify-start group/cell">
      {isEditing && (
        <textarea 
          ref={ref}
          defaultValue={currentText || ''} 
          data-student-id={student.id}
          data-col-id={colId}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              if ((e.nativeEvent as any)?.isComposing) return;
              const currentVal = (e.currentTarget as HTMLTextAreaElement).value;
              const saveVal = currentVal !== undefined ? currentVal : (draftRef.current ?? '');
              draftRef.current = undefined;
              onSave(colId, saveVal, { skipNextBlur: true });
            }
            handleKeyDown(e, colId);
          }} 
          onBlur={(e) => {
            const currentVal = (e.currentTarget as HTMLTextAreaElement).value;
            const saveVal = currentVal !== undefined ? currentVal : (draftRef.current ?? '');
            draftRef.current = undefined;
            onSave(colId, saveVal, { isBlur: true });
          }} 
          placeholder="-" 
          className={`${commonTextStyle} bg-transparent resize-none overflow-y-hidden block relative z-20`} 
          onInput={(e) => {
            draftRef.current = (e.currentTarget as HTMLTextAreaElement).value;
            handleLocalInput(e, colId);
          }}
          onChange={(e) => {
            draftRef.current = (e.currentTarget as HTMLTextAreaElement).value;
          }} 
        />
      )}
      
      {!isEditing && (
        <div 
          className={`${commonTextStyle} whitespace-pre-wrap min-h-[22px] flex flex-col items-start justify-start cursor-default select-none`}
        >
          <div className="w-full">{currentText || '-'}</div>
        </div>
      )}
    </div>
  );
});

SimpleTextCell.displayName = 'SimpleTextCell';
