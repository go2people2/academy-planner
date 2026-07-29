'use client';

import React from 'react';
import { 
  ChevronLeft, ChevronRight, Settings2, 
  Wand2, Maximize2, Minimize2 
} from 'lucide-react';

interface TodaySheetHeaderProps {
  colWidths: Record<string, number>;
  activeColumns: any[];
  onMouseDown: (e: React.MouseEvent, colId: string) => void;
  onDoubleClick: (colId: string) => void;
  onSelectAll: (checked: boolean) => void;
  isAllSelected: boolean;
  onFocusColumn: (colId: string | null) => void;
  focusColumn: string | null;
  onColumnReorder: (draggedId: string, targetId: string) => void;
  showAllTools: boolean;
  setShowAllTools: (show: boolean) => void;
  isToolsEditMode: boolean;
  setIsToolsEditMode: (edit: boolean) => void;
  onAutofillManagementNotes?: () => void;
}

export function TodaySheetHeader({ 
  colWidths, 
  activeColumns, 
  onMouseDown, 
  onDoubleClick, 
  onSelectAll, 
  isAllSelected, 
  onFocusColumn, 
  focusColumn, 
  onColumnReorder, 
  showAllTools, 
  setShowAllTools, 
  isToolsEditMode, 
  setIsToolsEditMode, 
  onAutofillManagementNotes 
}: TodaySheetHeaderProps) {
  // 💡 action 컬럼을 제외한 실질적인 마지막 데이터 컬럼 판별
  const lastDataColumnId = React.useMemo(() => {
    const dataCols = activeColumns.filter((c: any) => c.id !== 'action');
    return dataCols.length > 0 ? dataCols[dataCols.length - 1].id : null;
  }, [activeColumns]);

  // 💡 드래그앤드롭 컬럼 순서 변경 상태
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [isOrigDragged, setIsOrigDragged] = React.useState(false);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [canDrag, setCanDrag] = React.useState(true); // 💡 리사이즈 조작 중 드래그 오작동 차단 상태

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!canDrag) {
      e.preventDefault();
      return;
    }
    const protectedCols = ['select', 'name', 'tools', 'action'];
    if (protectedCols.includes(id)) {
      e.preventDefault();
      return;
    }
    setDraggedId(id);
    setIsOrigDragged(false);
    e.dataTransfer.setData('text/plain', id);
    
    // 💡 원본 헤더의 크기 규격을 정확히 복제하여 100% 동일한 크기의 고스트 생성
    const originalHeader = e.currentTarget as HTMLElement;
    const rect = originalHeader.getBoundingClientRect();

    const dragImg = document.createElement('div');
    dragImg.style.position = 'absolute';
    dragImg.style.top = '-1000px';
    dragImg.style.left = '-1000px';
    dragImg.style.width = `${rect.width}px`;
    dragImg.style.height = `${rect.height}px`;
    dragImg.style.lineHeight = `${rect.height}px`;
    dragImg.style.backgroundColor = '#00d2ff'; // 💡 산뜻한 아쿠아 블루
    dragImg.style.color = '#050505'; // 💡 대비율을 극대화한 매트 블랙
    dragImg.style.fontWeight = 'bold';
    dragImg.style.fontSize = '12px';
    dragImg.style.textAlign = 'center';
    dragImg.style.border = '1px solid #22d3ee';
    dragImg.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    dragImg.style.whiteSpace = 'nowrap';
    dragImg.style.overflow = 'hidden';
    dragImg.style.textOverflow = 'ellipsis';
    dragImg.style.zIndex = '99999';

    const col = activeColumns.find((c: any) => c.id === id);
    dragImg.innerText = col ? col.label : id;
    document.body.appendChild(dragImg);

    // 💡 브라우저에 원본 크기 맞춤 드래그 이미지 주입 (마우스 포인터 정중앙 정렬)
    e.dataTransfer.setDragImage(dragImg, rect.width / 2, rect.height / 2);
    
    // 스냅샷 촬영 후 즉시 원래 자리만 반투명 처리하고 임시 노드 제거
    setTimeout(() => {
      if (document.body.contains(dragImg)) {
        document.body.removeChild(dragImg);
      }
      setIsOrigDragged(true);
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    const protectedCols = ['select', 'name', 'tools', 'action'];
    if (protectedCols.includes(id) || draggedId === id) return;
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedId;
    if (id && targetId && id !== targetId) {
      onColumnReorder(id, targetId);
    }
    setDraggedId(null);
    setIsOrigDragged(false);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setIsOrigDragged(false);
    setDragOverId(null);
  };

  return (
    <tr className="bg-black border-b border-white/20 select-none">
      {activeColumns.map((col: any) => {
        const isStickyHorizontally = col.id === 'name' || col.id === 'tools' || col.id === 'action' || col.id === 'select';
        const canFocus = ['test_id', 'next_quiz', 'classwork', 'completed_classwork', 'assign', 'mission', 'notes', 'management_notes'].includes(col.id);
        const isAction = col.id === 'action';
        const isSelect = col.id === 'select';
        const isLastDataCol = col.id === lastDataColumnId;
        
        let leftOffset: string | number = 'auto';
        if (col.id === 'select') leftOffset = 0;
        else if (col.id === 'name') leftOffset = (colWidths['select'] || 40) - 1;
        else if (col.id === 'tools') leftOffset = (colWidths['select'] || 40) + (colWidths['name'] || 120) - 2;

        const styles: React.CSSProperties = {
          width: isLastDataCol ? 'auto' : (colWidths[col.id] || col.minWidth),
          minWidth: colWidths[col.id] || col.minWidth,
          position: 'sticky',
          top: 0,
          left: leftOffset,
          right: col.id === 'action' ? 0 : 'auto',
          zIndex: isStickyHorizontally ? 50 : 40,
          backgroundColor: draggedId === col.id 
            ? (isOrigDragged ? '#075985' : '#00d2ff') // 💡 고스트는 아쿠아(#00d2ff), 남겨진 원본은 딥 아쿠아(#075985)
            : dragOverId === col.id 
            ? '#1e293b' 
            : focusColumn === col.id 
            ? '#172554' 
            : '#000000',
          cursor: !['select', 'name', 'tools', 'action'].includes(col.id) ? 'grab' : 'default',
        };
        return (
          <th 
            key={col.id} 
            data-col-id={col.id}
            style={styles} 
            draggable={canDrag && !['select', 'name', 'tools', 'action'].includes(col.id)}
            onDragStart={(e) => handleDragStart(e, col.id)}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => handleDrop(e, col.id)}
            onDragEnd={handleDragEnd}
            className={`relative group py-3 ${isAction ? 'px-0' : 'px-3'} text-[12px] font-black uppercase tracking-widest text-center border-r border-white/12 transition-all ${
              focusColumn === col.id 
                ? 'text-blue-400 bg-blue-950/20 border-b-2 border-b-blue-500/80 shadow-[0_1px_0_rgba(59,130,246,0.3)]' 
                : 'text-gray-400 shadow-[0_1px_0_rgba(255,255,255,0.1)]'
            } ${
              draggedId === col.id ? `${isOrigDragged ? 'opacity-30' : 'opacity-100'} bg-blue-600/30 border-2 border-dashed border-blue-500 text-white font-extrabold` : ''
            } ${
              dragOverId === col.id ? 'border-l-4 border-l-blue-500 bg-white/10' : ''
            }`}
          >
            {!isAction && (
              <div className="flex items-center justify-center gap-1.5 w-full">
                {isSelect ? (
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-blue-600 cursor-pointer"
                  />
                ) : (
                <>
                  <div className={`flex items-center gap-1.5 ${col.id === 'review' ? 'italic' : ''}`}>
                    {col.id === 'review' ? (
                      <>
                        <span className="text-blue-500/80 font-black mr-0.5">"</span>
                        <span className="text-blue-200">{col.label}</span>
                        <span className="text-blue-500/80 font-black ml-0.5">"</span>
                      </>
                    ) : col.id === 'tools' ? (
                      <div className="flex items-center gap-1 select-none">
                        <span>{col.label}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllTools(!showAllTools);
                            if (showAllTools && setIsToolsEditMode) {
                              setIsToolsEditMode(false);
                            }
                          }}
                          className={`p-0.5 rounded transition-all flex items-center justify-center ${
                            showAllTools 
                              ? 'bg-blue-600/30 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30' 
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700'
                          }`}
                          title={showAllTools ? '7개 도구 접기' : '7개 도구 펼치기'}
                        >
                          {showAllTools ? <ChevronLeft size={10} strokeWidth={2.5} /> : <ChevronRight size={10} strokeWidth={2.5} />}
                        </button>
                        {showAllTools && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsToolsEditMode(!isToolsEditMode);
                            }}
                            className={`p-0.5 rounded transition-all flex items-center justify-center ${
                              isToolsEditMode 
                                ? 'bg-amber-500/30 text-amber-400 hover:bg-amber-600 hover:text-white border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.4)]' 
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700'
                            }`}
                            title={isToolsEditMode ? '도구 편집 모드 종료' : '도구 순서 편집'}
                          >
                            <Settings2 size={10} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.id === 'management_notes' && onAutofillManagementNotes && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAutofillManagementNotes();
                            }}
                            className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition-all flex items-center justify-center shadow-sm cursor-pointer ml-0.5"
                            title="비어있는 주의점 칸에 최신 메모 수동 이월하기"
                          >
                            <Wand2 size={11} className="text-amber-300" />
                          </button>
                        )}
                      </span>
                    )}
                    {canFocus && (
                      focusColumn === col.id ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onFocusColumn(null); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-amber-500/20 rounded transition-all text-amber-400"
                          title="원래 크기로 복귀"
                        >
                          <Minimize2 size={10} />
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onFocusColumn(col.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all text-blue-400"
                          title="넓게 보기"
                        >
                          <Maximize2 size={10} />
                        </button>
                      )
                    )}
                  </div>

                </>
              )}
              </div>
            )}

            {!isAction && (
              <div 
                onMouseDown={(e) => onMouseDown(e, col.id)}
                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(col.id); }}
                onMouseEnter={() => setCanDrag(false)}
                onMouseLeave={() => setCanDrag(true)}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 transition-colors z-30 opacity-0 group-hover:opacity-100" 
                title="더블클릭하여 자동 크기 조절 / 드래그하여 수동 조절"
              />
            )}
          </th>
        );
      })}
    </tr>
  );
}
