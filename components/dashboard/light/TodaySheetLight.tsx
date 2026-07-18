'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Loader2, Settings2, Check, 
  Calendar as CalendarIcon, History as HistoryIcon, 
  LayoutGrid, Table as TableIcon, Share2, Percent, RotateCcw,
  Download, FileSpreadsheet, FileText as FileTextIcon, Copy,
  SortAsc, Clock as ClockIcon, X, Wand2, TrendingUp, ClipboardList, FileText, Zap,
  Maximize2, Minimize2, ArrowLeft, ArrowRight, AlertTriangle, ArrowUp, ArrowDown, Eye, EyeOff, Printer, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Megaphone
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TodaySheetRow } from './TodaySheetRowLight';
import { HistoryRows } from '../TodaySheetHistory';
import ReportPreview from '../ReportPreview';
import PrintPreviewModal from '../todaySheet/PrintPreviewModal';
import StudentReportCardPrintModal from '../todaySheet/StudentReportCardPrintModal';
import HokmaJournalPrintModal from '../todaySheet/HokmaJournalPrintModal';
import { TagBatchInputModal } from '../todaySheet/TagBatchInputModal';
import { getDayOfWeek, getTodayStr } from '@/lib/utils';
import { ChecklistTabLight } from './ChecklistTabLight';
import { ATTENDANCE_STATUS, normalizeAttendanceStatus, mapColumnToProp } from '@/lib/sessionFieldMap';
import { syncTodaySheetDom } from '@/lib/todaySheetDomSync';
import { useTodaySheetShortcuts } from '../hooks/useTodaySheetShortcuts';
import { useCoopCollaboration } from '@/hooks/useCoopCollaboration';
import { useTodaySheetExport } from '@/hooks/useTodaySheetExport';
import { useTodaySheetImport } from '@/hooks/useTodaySheetImport';

interface ColumnConfig {
  id: string;
  label: string;
  minWidth: number;
  isSticky?: boolean;
  canHide: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'select', label: '', minWidth: 40, isSticky: true, canHide: false },
  { id: 'date', label: '날짜', minWidth: 50, canHide: true },
  { id: 'name', label: '이름', minWidth: 120, isSticky: true, canHide: false },
  { id: 'tools', label: '🛠️', minWidth: 80, isSticky: true, canHide: false },
  { id: 'management_notes', label: '주의점', minWidth: 150, canHide: true },
  { id: 'attendance', label: '출결', minWidth: 80, canHide: true },
  { id: 'test_id', label: '오늘TEST', minWidth: 140, canHide: true },
  { id: 'test_score', label: '점수', minWidth: 60, canHide: true },
  { id: 'next_quiz', label: '다음TEST', minWidth: 200, canHide: true },
  { id: 'review', label: '과제확인', minWidth: 180, canHide: true },
  { id: 'classwork', label: '오늘 할 일(To-Do)', minWidth: 200, canHide: true },
  { id: 'completed_classwork', label: '수행진도', minWidth: 200, canHide: true },
  { id: 'assign', label: '오늘숙제', minWidth: 220, canHide: true },
  { id: 'mission', label: '학생미션', minWidth: 220, canHide: true },
  { id: 'notes', label: '특이사항', minWidth: 160, canHide: true },
  { id: 'action', label: '', minWidth: 8, isSticky: true, canHide: false }
];

// --- Sub-components ---

function TodaySheetHeader({ colWidths, activeColumns, onMouseDown, onDoubleClick, onSelectAll, isAllSelected, onFocusColumn, focusColumn, onColumnReorder, showAllTools, setShowAllTools, isToolsEditMode, setIsToolsEditMode }: any) {
  // 💡 action 컬럼을 제외한 실질적인 마지막 데이터 컬럼 판별
  const lastDataColumnId = React.useMemo(() => {
    const dataCols = activeColumns.filter((c: any) => c.id !== 'action');
    return dataCols.length > 0 ? dataCols[dataCols.length - 1].id : null;
  }, [activeColumns]);

  // 💡 [추가] 드래그앤드롭 컬럼 순서 변경 상태
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
    
    // 💡 [해결] 원본 헤더의 크기 규격을 정확히 복제하여 100% 동일한 크기의 고스트 생성
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
    <tr className="bg-[#f7f7f5] border-b border-[#edece9] select-none">
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
            ? (isOrigDragged ? '#e0f2fe' : '#bae6fd') 
            : dragOverId === col.id 
            ? '#f1f5f9' 
            : focusColumn === col.id 
            ? '#dbeafe' 
            : '#f7f7f5',
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
            className={`relative group py-3 ${isAction ? 'px-0' : 'px-3'} text-[12px] font-black uppercase tracking-widest text-center border-r border-[#edece9] transition-all ${
              focusColumn === col.id 
                ? 'text-blue-600 bg-blue-50 border-b-2 border-b-blue-400 shadow-sm' 
                : 'text-[#37352f]/70 shadow-sm'
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
                        <span className="text-blue-600 font-black mr-0.5">"</span>
                        <span className="text-blue-600 font-black">{col.label}</span>
                        <span className="text-blue-600 font-black ml-0.5">"</span>
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
                              ? 'bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200' 
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-black border border-gray-300'
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
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-300 shadow-sm' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-black border border-gray-300'
                            }`}
                            title={isToolsEditMode ? '도구 편집 모드 종료' : '도구 순서 편집'}
                          >
                            <Settings2 size={10} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    ) : (
                      col.label
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

// --- Main Component ---

export default function TodaySheet({
  students, setStudents, masterTextbooks, onSave, onBatchSave, onUpdateStudentInfo, selectedDate, onDateChange, onViewProgress, onSelectStudent, academyInfo, currentUser,
  sortMode = 'time', onSortModeChange,
  sortDirection = 'asc', onSortDirectionChange,
  onOpenBriefing, // 💡 추가
  selectedFilter, setSelectedFilter,
  selectedTeacherId, setSelectedTeacherId,
  selectedDays, setSelectedDays,
  isAndFilter, setIsAndFilter,
  teachers = [],
  isFullScreen = false,
  onToggleFullScreen
}: any) {

  // Undo/Redo stacks
  const undoStackRef = useRef<any[]>([]);
  const redoStackRef = useRef<any[]>([]);

  const pushToUndoStack = useCallback((updates: { studentId: string; newData: any; prevData: any }[]) => {
    const validUpdates = updates.filter(u => {
      return Object.keys(u.newData).some(key => {
        return String(u.newData[key] || '') !== String(u.prevData?.[key] || '');
      });
    });
    if (validUpdates.length > 0) {
      undoStackRef.current.push(validUpdates);
      redoStackRef.current = []; // 새로운 동작 발생 시 redo 초기화
    }
  }, []);

  const handleUndo = useCallback(async () => {
    if (undoStackRef.current.length === 0) return;
    const updates = undoStackRef.current.pop();
    if (!updates || updates.length === 0) return;

    // 💡 실제 변경된 필드만 추출하여 되돌림 (전체 세션이 아닌 변경 필드만)
    const undoUpdates = updates.map((u: any) => {
      const changedKeys = Object.keys(u.newData);
      const restoreData: any = {};
      changedKeys.forEach((key: string) => {
        restoreData[key] = u.prevData?.[key] ?? '';
      });
      return {
        studentId: u.studentId,
        newData: restoreData,
        prevData: { ...u.newData }
      };
    });

    setStudents((prev: any[]) => prev.map(s => {
      const update = undoUpdates.find((u: any) => u.studentId === s.id);
      if (update) {
        const hasMission = 'mission' in update.newData;
        return {
          ...s,
          ...(hasMission ? { recent_mission: update.newData.mission } : {}),
          todaySession: {
            ...(s.todaySession || {}),
            ...update.newData
          }
        };
      }
      return s;
    }));

    redoStackRef.current.push(updates);

    const invMap: any = { 
      'test_id': 'test_id',
      'test_status': 'test_id', 
      'test_score': 'test_score', 
      'classwork_text': 'classwork', 
      'completed_classwork_text': 'completed_classwork', 
      'homework_text': 'assign', 
      'next_quiz_text': 'next_quiz', 
      'mission': 'mission', 
      'special_notes': 'notes',
      'management_notes': 'management_notes',
      'attendance_status': 'attendance'
    };
    const affectedColIds = new Set<string>();
    undoUpdates.forEach((u: any) => {
      Object.keys(u.newData).forEach((key: string) => {
        const colId = invMap[key];
        if (colId) affectedColIds.add(colId);
      });
    });

    syncTodaySheetDom(undoUpdates, Array.from(affectedColIds));

    await Promise.all(undoUpdates.map(async (u: any) => {
      if ('mission' in u.newData && onUpdateStudentInfo) {
        await onUpdateStudentInfo(u.studentId, 'recent_mission', u.newData.mission);
      }
      const savePayload = { ...u.newData };
      delete savePayload.mission;
      if (Object.keys(savePayload).length > 0) {
        await onSave(u.studentId, savePayload);
      }
    }));
  }, [setStudents, onSave, onUpdateStudentInfo]);

  const handleRedo = useCallback(async () => {
    if (redoStackRef.current.length === 0) return;
    const updates = redoStackRef.current.pop();
    if (!updates || updates.length === 0) return;

    setStudents((prev: any[]) => prev.map(s => {
      const update = updates.find((u: any) => u.studentId === s.id);
      if (update) {
        const hasMission = 'mission' in update.newData;
        return {
          ...s,
          ...(hasMission ? { recent_mission: update.newData.mission } : {}),
          todaySession: {
            ...(s.todaySession || {}),
            ...update.newData
          }
        };
      }
      return s;
    }));

    undoStackRef.current.push(updates);

    const invMap: any = { 
      'test_id': 'test_id',
      'test_status': 'test_id', 
      'test_score': 'test_score', 
      'classwork_text': 'classwork', 
      'completed_classwork_text': 'completed_classwork', 
      'homework_text': 'assign', 
      'next_quiz_text': 'next_quiz', 
      'mission': 'mission', 
      'special_notes': 'notes',
      'management_notes': 'management_notes',
      'attendance_status': 'attendance'
    };
    const affectedColIds = new Set<string>();
    updates.forEach((u: any) => {
      Object.keys(u.newData).forEach((key: string) => {
        const colId = invMap[key];
        if (colId) affectedColIds.add(colId);
      });
    });

    syncTodaySheetDom(updates, Array.from(affectedColIds));

    await Promise.all(updates.map(async (u: any) => {
      if ('mission' in u.newData && onUpdateStudentInfo) {
        await onUpdateStudentInfo(u.studentId, 'recent_mission', u.newData.mission);
      }
      const savePayload = { ...u.newData };
      delete savePayload.mission;
      if (Object.keys(savePayload).length > 0) {
        await onSave(u.studentId, savePayload);
      }
    }));
  }, [setStudents, onSave, onUpdateStudentInfo]);

  // 1. States
  const [showAllTools, setShowAllTools] = useState(false); // 💡 [추가] 7개 도구 일괄 접기/펼치기 상태
  const [isToolsEditMode, setIsToolsEditMode] = useState(false); // 💡 도구 편집 모드 상태
  const [toolsOrder, setToolsOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_tools_order');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return ['profile', 'history', 'progress', 'separator', 'tag', 'portal', 'reset', 'delete'];
  });

  const handleReorderTools = useCallback((draggedId: string, targetId: string) => {
    setToolsOrder(prev => {
      const newOrder = [...prev];
      const draggedIdx = newOrder.indexOf(draggedId);
      const targetIdx = newOrder.indexOf(targetId);
      if (draggedIdx !== -1 && targetIdx !== -1) {
        newOrder.splice(draggedIdx, 1);
        newOrder.splice(targetIdx, 0, draggedId);
        localStorage.setItem('ams_tools_order', JSON.stringify(newOrder));
      }
      return newOrder;
    });
  }, []);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'checklist'>('daily');
  const [historyLimit, setHistoryLimit] = useState(3);
  
  useEffect(() => {
    const saved = localStorage.getItem('ams_history_limit');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) setHistoryLimit(parsed);
    }
  }, []);

  const [hiddenStudentIds, setHiddenStudentIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<{
    startStudentId: string, 
    startColId: string, 
    endStudentId: string, 
    endColId: string
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const defaultWidths = Object.fromEntries(DEFAULT_COLUMNS.map(col => [col.id, col.minWidth]));
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('todaySheetColWidths');
      if (saved) { try { const parsed = JSON.parse(saved); return { ...defaultWidths, ...parsed }; } catch (e) { console.error(e); } }
    }
    return defaultWidths;
  });

  const [presets, setPresets] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`todaySheetPresets_${currentUser?.id || 'default'}`);
      if (saved) return JSON.parse(saved);
    }
    return {
      '1': ['select', 'name', 'review', 'classwork', 'completed_classwork', 'assign', 'mission', 'action'],
      '2': ['select', 'name', 'test_id', 'test_score', 'notes', 'action'],
      '3': ['select', 'name', 'next_quiz', 'action'],
      '4': DEFAULT_COLUMNS.map(c => c.id)
    };
  });

  const [activeSet, setActiveSet] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`todaySheetActiveSet_${currentUser?.id || 'default'}`) || '1';
    return '1';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // 모달 ESC 닫기 공통 처리 (Column Settings)
  useEffect(() => {
    if (isSettingsOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsSettingsOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSettingsOpen]);

  const [isScrolled, setIsScrolled] = useState(false);

  // 스크롤 감지 (z-index 동적 조절용)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 5);
  }, []);

  const [activeCell, setActiveCell] = useState<{ studentId: string, columnId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ studentId: string, columnId: string } | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, number>>({});
  const [isSendingReport, setIsSendingReport] = useState<string | null>(null);
  const [isReportVisible, setIsReportVisible] = useState(false);

  // 💡 [추가] 다른 조교 기기로부터 저장 이벤트 수신 시, 로컬 상태 및 DOM을 즉시 갱신하는 핸들러
  const handleRemoteCellSave = useCallback((studentId: string, colId: string, value: string) => {
    const isEditingThis = editingCell?.studentId === studentId && editingCell?.columnId === colId;
    if (isEditingThis) return; // 내가 편집 중이면 덮어쓰기 무시

    const prop = mapColumnToProp(colId);
    if (!prop) return;

    // 1. 로컬 상태 업데이트
    setStudents((prev: any[]) => prev.map(s => {
      if (s.id === studentId) {
        if (colId === 'mission') {
          return { ...s, recent_mission: value };
        }
        if (colId === 'notes') {
          return {
            ...s,
            todaySession: {
              ...(s.todaySession || {}),
              special_notes: value
            }
          };
        }
        return {
          ...s,
          todaySession: {
            ...(s.todaySession || {}),
            [prop]: value
          }
        };
      }
      return s;
    }));

    // 2. DOM에 직접 값 주입 (화면 딜레이 방지)
    syncTodaySheetDom([{ studentId, newData: { [prop]: value } }], [colId]);
  }, [editingCell, setStudents]);

  // 📝 [리팩토링] 다중 기기 실시간 편집 및 협업 상태 분리 훅 호출
  const { cooperatingCells, sendCoopEvent, sendSaveEvent, myClientId } = useCoopCollaboration(academyInfo?.id, handleRemoteCellSave);

  // 💡 [추가 1] 내가 편집 중일 때 락이 15초 가비지 컬렉터에 의해 풀리지 않도록 5초 주기 하트비트 전송
  useEffect(() => {
    if (!editingCell || !academyInfo?.id) return;
    const interval = setInterval(() => {
      sendCoopEvent('focus_in', editingCell.studentId, editingCell.columnId);
    }, 5000);
    return () => clearInterval(interval);
  }, [editingCell, academyInfo?.id, sendCoopEvent]);

  // 💡 [추가 2] 다른 조교가 강제로 내 편집 권한을 뺏어갔는지 감시 (내 편집창 강제 종료)
  useEffect(() => {
    if (!editingCell || !myClientId) return;
    const key = `${editingCell.studentId}_${editingCell.columnId}`;
    const coop = cooperatingCells[key];
    if (coop && coop.clientId !== myClientId) {
      alert("다른 조교가 이 셀의 편집 권한을 강제로 가져갔습니다. 작성 중이던 내용이 취소됩니다.");
      setEditingCell(null);
    }
  }, [cooperatingCells, editingCell, myClientId]);

  // 📝 편집 셀 상태 변경 및 브로드캐스트 전송 일괄 래퍼 함수
  const updateEditingCell = useCallback((next: { studentId: string, columnId: string } | null) => {
    setEditingCell((prev) => {
      if (prev) {
        sendCoopEvent('focus_out', prev.studentId, prev.columnId);
      }
      if (next) {
        sendCoopEvent('focus_in', next.studentId, next.columnId);
      }
      return next;
    });
  }, [sendCoopEvent]);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [focusColumn, setFocusColumn] = useState<string | null>(null); // 💡 컬럼 포커스 모드 상태 추가
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false); // 💡 인쇄 미리보기 모달 상태 추가
  const [isCardPrintOpen, setIsCardPrintOpen] = useState(false); // 💡 학생별 안내장 인쇄 모달 상태 추가
  const [isHokmaPrintOpen, setIsHokmaPrintOpen] = useState(false); // 💡 호크마 일지 인쇄 모달 상태 추가
  const checklistRef = React.useRef<any>(null); // 💡 체크리스트 ref 추가
  const [isTagBatchMode, setIsTagBatchMode] = useState(false); // 💡 태그별 일괄입력 모달 상태 추가

  const [hideAbsent, setHideAbsent] = useState<'all' | 'absent' | 'attend'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`todaySheetHideAbsentCycle_${currentUser?.id || 'default'}`);
      return (saved as any) || 'all';
    }
    return 'all';
  });

  const toggleHideAbsent = useCallback(() => {
    setHideAbsent(prev => {
      let next: 'all' | 'absent' | 'attend' = 'all';
      if (prev === 'all') next = 'absent';
      else if (prev === 'absent') next = 'attend';
      else next = 'all';
      localStorage.setItem(`todaySheetHideAbsentCycle_${currentUser?.id || 'default'}`, next);
      return next;
    });
  }, [currentUser?.id]);

  const [showSecondRow, setShowSecondRow] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`todaySheetShowSecondRow_${currentUser?.id || 'default'}`);
      return saved === 'false' ? false : true;
    }
    return true;
  });

  const toggleSecondRow = useCallback(() => {
    setShowSecondRow(prev => {
      const next = !prev;
      localStorage.setItem(`todaySheetShowSecondRow_${currentUser?.id || 'default'}`, String(next));
      return next;
    });
  }, [currentUser?.id]);

  // 2. Memos
  // 💡 [추가] 드래그앤드롭 컬럼 순서 저장용 상태
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_today_sheet_column_order');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return DEFAULT_COLUMNS.map(c => c.id);
  });

  const handleColumnReorder = useCallback((draggedId: string, targetId: string) => {
    const protectedCols = ['select', 'name', 'tools', 'action'];
    if (protectedCols.includes(draggedId) || protectedCols.includes(targetId)) return;
    if (draggedId === targetId) return;

    setColumnOrder(prev => {
      const next = [...prev];
      const draggedIdx = next.indexOf(draggedId);
      const targetIdx = next.indexOf(targetId);
      if (draggedIdx === -1 || targetIdx === -1) return prev;

      next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, draggedId);
      
      localStorage.setItem('ams_today_sheet_column_order', JSON.stringify(next));
      return next;
    });
  }, []);

  const visibleColumns = useMemo(() => {
    if (focusColumn) {
      // 💡 포커스 모드일 때: 이름, 출결, 선택한 컬럼(+테스트 점수), 저장 버튼만 노출
      const base = ['select', 'name', 'attendance'];
      const focused = [focusColumn];
      if (focusColumn === 'test_id') focused.push('test_score');
      return [...base, ...focused, 'action'];
    }
    return presets[activeSet] || DEFAULT_COLUMNS.map(c => c.id);
  }, [presets, activeSet, focusColumn]);

  const activeColumns = useMemo(() => {
    const active = DEFAULT_COLUMNS.filter(col => !col.canHide || visibleColumns.includes(col.id));
    return [...active].sort((a, b) => {
      const idxA = columnOrder.indexOf(a.id);
      const idxB = columnOrder.indexOf(b.id);
      const orderA = idxA !== -1 ? idxA : DEFAULT_COLUMNS.findIndex(c => c.id === a.id) + 100;
      const orderB = idxB !== -1 ? idxB : DEFAULT_COLUMNS.findIndex(c => c.id === b.id) + 100;
      return orderA - orderB;
    });
  }, [visibleColumns, columnOrder]);

  // 💡 포커스 모드용 컬럼 너비 계산
  const focusColWidths = useMemo(() => {
    const base = { ...colWidths };
    base['action'] = 8; // 💡 저장 컬럼 너비를 8px로 강제 고정
    
    // 💡 7개 도구 접고 펼칠 때 셀 폭 동적 반응형 조정
    base['tools'] = showAllTools ? 206 : 110;

    if (focusColumn) {
      // 포커스된 컬럼은 화면의 상당 부분을 차지하도록 확장
      base[focusColumn] = 800;
      if (focusColumn === 'test_id') base['test_score'] = 100;
      base['name'] = 140;
      base['attendance'] = 80;
    }
    return base;
  }, [colWidths, focusColumn, showAllTools]);

  const totalWidth = useMemo(() => {
    if (focusColumn) return '100%'; // 포커스 모드에서는 테이블 너비를 100%로 설정
    return activeColumns.reduce((acc, col) => acc + (focusColWidths[col.id] || col.minWidth), 0);
  }, [activeColumns, focusColWidths, focusColumn]);

  // 💡 포커스 모드일 때 학생 필터링 및 전체 정렬 로직 적용
  const filteredStudents = useMemo(() => {
    let result = [...students];
    
    // 숨김 처리된 학생 필터링
    if (hiddenStudentIds.length > 0) {
      result = result.filter((s: any) => !hiddenStudentIds.includes(s.id));
    }

    // 결석/출석 접기 순환 필터링
    if (hideAbsent !== 'all') {
      result = result.filter((s: any) => {
        const status = normalizeAttendanceStatus(s.todaySession?.attendance_status);
        if (hideAbsent === 'absent') {
          // 결석한 학생만 표시
          return status === ATTENDANCE_STATUS.ABSENT;
        }
        if (hideAbsent === 'attend') {
          // 출석한 학생(결석 아니면 다 포함)만 표시
          return status !== ATTENDANCE_STATUS.ABSENT;
        }
        return true;
      });
    }
    
    if (focusColumn === 'test_id') {
      result = result.filter((s: any) => s.todaySession?.test_id || s.todaySession?.test_status);
    }

    const getGradeWeight = (grade: string): number => {
      if (!grade) return 999;
      const cleaned = grade.replace(/\s+/g, '');
      let levelWeight = 0;
      let year = 0;
      if (cleaned.includes('초')) {
        levelWeight = 10;
        const match = cleaned.match(/\d/);
        year = match ? parseInt(match[0], 10) : 0;
      } else if (cleaned.includes('중')) {
        levelWeight = 20;
        const match = cleaned.match(/\d/);
        year = match ? parseInt(match[0], 10) : 0;
      } else if (cleaned.includes('고')) {
        levelWeight = 30;
        const match = cleaned.match(/\d/);
        year = match ? parseInt(match[0], 10) : 0;
      } else {
        levelWeight = 40;
      }
      return levelWeight + year;
    };

    const dayKey = getDayOfWeek(selectedDate);
    const getStartTime = (st: any) => {
      // 1. 시간 이동 필드 우선 사용
      if (st.todaySession?.moved_to_hour !== undefined && st.todaySession?.moved_to_hour !== null) {
        return st.todaySession.moved_to_hour;
      }
      
      const stat = st.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
      if (stat.includes(':')) { 
        const parts = stat.split(':'); 
        const val = parseInt(parts[parts.length - 1]); 
        if (!isNaN(val) && val < 24) return val; 
      }
      const hours = st.day_schedules?.[dayKey] || [];
      if (hours.length > 0) {
        const firstVal = hours[0];
        let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
        if (h <= 12) h += 12;
        return h;
      }
      return 999;
    };

    return result.sort((a, b) => {
      let comparison = 0;
      if (sortMode === 'grade') {
        const gradeA = getGradeWeight(a.grade);
        const gradeB = getGradeWeight(b.grade);
        if (gradeA !== gradeB) {
          comparison = gradeA - gradeB;
          return sortDirection === 'asc' ? comparison : -comparison;
        }
      } else if (sortMode === 'time') {
        const timeA = getStartTime(a);
        const timeB = getStartTime(b);
        if (timeA !== timeB) {
          comparison = timeA - timeB;
          return sortDirection === 'asc' ? comparison : -comparison;
        }
      } else if (sortMode === 'school') {
        const schoolCmp = (a.school || '').localeCompare(b.school || '', 'ko');
        if (schoolCmp !== 0) return sortDirection === 'asc' ? schoolCmp : -schoolCmp;
        const gradeA = getGradeWeight(a.grade);
        const gradeB = getGradeWeight(b.grade);
        if (gradeA !== gradeB) {
          comparison = gradeA - gradeB;
          return sortDirection === 'asc' ? comparison : -comparison;
        }
      }
      comparison = a.name.localeCompare(b.name, 'ko');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [students, focusColumn, sortMode, sortDirection, selectedDate, hiddenStudentIds, hideAbsent]);

  // 3. Callbacks
  const isCellInRange = useCallback((studentId: string, colId: string) => {
    if (!selectedRange) return false;
    const sIdx = filteredStudents.findIndex((s:any) => s.id === selectedRange.startStudentId);
    const eIdx = filteredStudents.findIndex((s:any) => s.id === selectedRange.endStudentId);
    const cIdx = filteredStudents.findIndex((s:any) => s.id === studentId);
    const sColIdx = activeColumns.findIndex(col => col.id === selectedRange.startColId);
    const eColIdx = activeColumns.findIndex(col => col.id === selectedRange.endColId);
    const currentColIdx = activeColumns.findIndex(col => col.id === colId);
    if (sIdx === -1 || eIdx === -1 || sColIdx === -1 || eColIdx === -1) return false;
    const rMin = Math.min(sIdx, eIdx); const rMax = Math.max(sIdx, eIdx);
    const cMin = Math.min(sColIdx, eColIdx); const cMax = Math.max(sColIdx, eColIdx);
    return cIdx >= rMin && cIdx <= rMax && currentColIdx >= cMin && currentColIdx <= cMax;
  }, [selectedRange, filteredStudents, activeColumns]);

  const handleSave = useCallback(async (studentId: string, newData: any) => {
    // 💡 단일 셀 변경 내용도 Undo 히스토리에 추가
    const student = students.find((s: any) => s.id === studentId);
    const session = student?.todaySession || {};
    
    const prevData: any = {};
    const filteredNewData: any = {};
    
    const keys = Object.keys(newData);
    keys.forEach(key => {
      if (key === 'mission') {
        prevData[key] = student?.recent_mission || '';
        filteredNewData[key] = newData[key] || '';
      } else {
        prevData[key] = session[key] || '';
        filteredNewData[key] = newData[key] || '';
      }
    });

    pushToUndoStack([{
      studentId,
      newData: filteredNewData,
      prevData
    }]);

    const success = await onSave(studentId, newData);
    if (success && sendSaveEvent) {
      const invMap: any = { 
        'test_status': 'test_id', 
        'test_score': 'test_score', 
        'classwork_text': 'classwork', 
        'completed_classwork_text': 'completed_classwork', 
        'homework_text': 'assign', 
        'next_quiz_text': 'next_quiz', 
        'mission': 'mission', 
        'special_notes': 'notes', 
        'management_notes': 'management_notes' 
      };
      Object.keys(newData).forEach(key => {
        const colId = invMap[key] || key;
        sendSaveEvent(studentId, colId, newData[key]);
      });
    }
    return success;
  }, [onSave, students, pushToUndoStack, sendSaveEvent]);

  const handleBatchSave = useCallback(async (updates: { studentId: string, newData: any, prevData: any }[]) => {
    if (updates.length === 0) return;

    // 💡 Undo 스택에 저장
    pushToUndoStack(updates);
    
    // 💡 [낙관적 업데이트] DB 저장 전에 로컬 상태를 즉시 업데이트하여 UI 반응성 확보
    setStudents((prev: any[]) => prev.map(s => {
      const update = updates.find(u => u.studentId === s.id);
      if (update) {
        const hasMission = 'mission' in update.newData;
        return {
          ...s,
          ...(hasMission ? { recent_mission: update.newData.mission } : {}),
          todaySession: {
            ...(s.todaySession || {}),
            ...update.newData
          }
        };
      }
      return s;
    }));
    
    // 💡 [수정] mission 필드와 일반 세션 로그 필드를 분기 처리하여 알맞은 API로 전송
    await Promise.all(updates.map(async (u) => {
      if ('mission' in u.newData && onUpdateStudentInfo) {
        await onUpdateStudentInfo(u.studentId, 'recent_mission', u.newData.mission);
        if (sendSaveEvent) sendSaveEvent(u.studentId, 'mission', u.newData.mission);
      }
      
      const savePayload = { ...u.newData };
      delete savePayload.mission;
      
      if (Object.keys(savePayload).length > 0) {
        const success = await onSave(u.studentId, savePayload);
        if (success && sendSaveEvent) {
          const invMap: any = { 
            'test_status': 'test_id', 
            'test_score': 'test_score', 
            'classwork_text': 'classwork', 
            'completed_classwork_text': 'completed_classwork', 
            'homework_text': 'assign', 
            'next_quiz_text': 'next_quiz', 
            'mission': 'mission', 
            'special_notes': 'notes', 
            'management_notes': 'management_notes' 
          };
          Object.keys(savePayload).forEach(key => {
            const colId = invMap[key] || key;
            sendSaveEvent(u.studentId, colId, savePayload[key]);
          });
        }
      }
    }));
  }, [onSave, onUpdateStudentInfo, setStudents, pushToUndoStack, sendSaveEvent]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!activeCell) return;
    const clipboardData = e.clipboardData?.getData('text/plain');
    if (!clipboardData) return;
    try {
      const dataMatrix: string[][] = []; let currentRow: string[] = []; let currentCell = ''; let inQuotes = false;
      for (let i = 0; i < clipboardData.length; i++) {
        const char = clipboardData[i]; const nextChar = clipboardData[i + 1];
        if (char === '"') { if (inQuotes && nextChar === '"') { currentCell += '"'; i++; } else { inQuotes = !inQuotes; } } 
        else if (char === '\t' && !inQuotes) { currentRow.push(currentCell); currentCell = ''; }
        else if ((char === '\r' && nextChar === '\n' || char === '\n') && !inQuotes) { currentRow.push(currentCell); dataMatrix.push(currentRow); currentRow = []; currentCell = ''; if (char === '\r') i++; } 
        else { currentCell += char; }
      }
      if (currentCell !== '' || currentRow.length > 0) { currentRow.push(currentCell); dataMatrix.push(currentRow); }
      if (dataMatrix.length > 1 && dataMatrix[dataMatrix.length - 1].length === 1 && dataMatrix[dataMatrix.length - 1][0] === '') dataMatrix.pop();
      const isSingle = dataMatrix.length === 1 && dataMatrix[0].length === 1;
      const isEditing = !!editingCell;
      if (isEditing) return;
      e.preventDefault();
      const updates: any[] = [];
      const startColIdx = activeColumns.findIndex(col => col.id === activeCell.columnId);
      const mapField = (colId: string) => {
        if (colId === 'attendance') return 'attendance_status';
        if (colId === 'test_id') return 'test_id';
        if (colId === 'test_score') return 'test_score';
        if (colId === 'assign') return 'homework_text';
        if (colId === 'classwork') return 'classwork_text';
        if (colId === 'mission') return 'mission';
        if (colId === 'notes') return 'special_notes';
        if (colId === 'next_quiz') return 'next_quiz_text';
        return colId;
      };
      if (isSingle && selectedIds.length > 1) {
        const val = dataMatrix[0][0]; const col = activeColumns[startColIdx];
        if (col && !['select', 'name', 'action'].includes(col.id)) {
          const field = mapField(col.id);
          selectedIds.forEach(id => {
            const st = students.find((s: any) => s.id === id); if (!st) return;
            const session = st.todaySession || {};
            updates.push({ studentId: id, newData: { ...session, [field]: val }, prevData: { ...session } });
          });
        }
      } else {
        const startStudentIdx = students.findIndex((s: any) => s.id === activeCell.studentId);
        if (startStudentIdx === -1 || startColIdx === -1) return;
        dataMatrix.forEach((rowValues, rowOffset) => {
          const currentStudent = students[startStudentIdx + rowOffset]; if (!currentStudent) return;
          const session = currentStudent.todaySession || {}; const upds: any = { ...session }; let changed = false;
          rowValues.forEach((value, colOffset) => {
            const col = activeColumns[startColIdx + colOffset]; if (!col || ['select', 'name', 'action', 'date'].includes(col.id)) return;
            if (col.id === 'attendance') return;
            const field = mapField(col.id);
            if (String(session[field] || '') !== value) { upds[field] = value; changed = true; }
          });
          if (changed) updates.push({ studentId: currentStudent.id, newData: upds, prevData: { ...session } });
        });
      }
      if (updates.length > 0) { 
        // 💡 [낙관적 업데이트] 붙여넣기 데이터를 즉시 state에 반영
        setStudents((prev: any[]) => prev.map(s => {
          const update = updates.find(u => u.studentId === s.id);
          if (update) {
            return {
              ...s,
              todaySession: {
                ...(s.todaySession || {}),
                ...update.newData
              }
            };
          }
          return s;
        }));

        await handleBatchSave(updates); 
        setEditingCell(null); 

        // 💡 [최종 최적화] 브라우저의 다음 프레임에서 즉시 DOM 업데이트 (반응성 우선)
        requestAnimationFrame(() => {
          updates.forEach(u => {
            const invMap: any = { 'test_status': 'test_id', 'test_score': 'test_score', 'classwork_text': 'classwork', 'completed_classwork_text': 'completed_classwork', 'homework_text': 'assign', 'next_quiz_text': 'next_quiz', 'mission': 'mission', 'special_notes': 'notes', 'management_notes': 'management_notes' };
            Object.keys(u.newData).forEach(field => {
              // 💡 [최적화] 이전 데이터와 비교하여 실제 값이 바뀐 경우에만 DOM 조작
              if (String(u.newData[field] || '') === String(u.prevData?.[field] || '')) return;

              const colId = invMap[field];
              if (!colId) return;
              const selector = `[data-student-id="${u.studentId}"][data-col-id="${colId}"]`;
              const el = document.querySelector(selector) as HTMLTextAreaElement | HTMLInputElement;
              if (el) el.value = u.newData[field] || '';
            });
          });
        });
      }
    } catch (err) { console.error('Paste error:', err); }
  }, [activeCell, editingCell, activeColumns, selectedIds, students, handleBatchSave]);

  // 📝 [리팩토링] 엑셀 및 ACA2000 가공/다운로드 전용 분리 훅 호출
  const { handleExport } = useTodaySheetExport({
    students,
    teachers,
    currentUser,
    academyInfo,
    selectedDate,
    masterTextbooks,
    activeColumns,
    setIsExportOpen,
  });

  // 📝 [리팩토링] 아카2000 일지 엑셀 데이터 파일 복원/가져오기 전용 분리 훅 호출
  const { handleImportExcel } = useTodaySheetImport({
    students,
    onBatchSave,
  });

  const handleSelectAll = useCallback((checked: boolean) => { setSelectedIds(checked ? students.map((s: any) => s.id) : []); }, [students]);
  const handleSelectOne = useCallback((id: string, checked: boolean, shiftKey: boolean = false) => { 
    if (shiftKey && lastSelectedId) {
      const lastIdx = filteredStudents.findIndex((s: any) => s.id === lastSelectedId);
      const currIdx = filteredStudents.findIndex((s: any) => s.id === id);
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        const idsInRange = filteredStudents.slice(start, end + 1).map((s: any) => s.id);
        setSelectedIds(prev => {
          const newSet = new Set(prev);
          if (checked) { idsInRange.forEach(i => newSet.add(i)); }
          else { idsInRange.forEach(i => newSet.delete(i)); }
          return Array.from(newSet);
        });
        setLastSelectedId(id);
        return;
      }
    }
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
    setLastSelectedId(id);
  }, [filteredStudents, lastSelectedId]);

  const onCellMouseDown = useCallback((e: React.MouseEvent, studentId: string, colId: string) => {
    if (['select', 'action'].includes(colId)) return;
    const isShift = e.shiftKey;
    // 💡 브라우저가 blur 이벤트를 먼저 안전하게 처리하여 저장(onBlur)되도록 상태 변경을 한 프레임 지연
    requestAnimationFrame(() => {
      setSelectedRange({ startStudentId: studentId, startColId: colId, endStudentId: studentId, endColId: colId });
      setIsDragging(true);
      if (!isShift) { setActiveCell({ studentId, columnId: colId }); }
      updateEditingCell(null);
    });
  }, [updateEditingCell]);

  const onCellMouseEnter = useCallback((studentId: string, colId: string) => {
    if (!isDragging || !selectedRange) return;
    setSelectedRange(prev => prev ? { ...prev, endStudentId: studentId, endColId: colId } : null);
  }, [isDragging, selectedRange]);

  const handleActiveCellChange = useCallback((studentId: string, colId: string) => { 
    requestAnimationFrame(() => {
      setActiveCell({ studentId, columnId: colId }); 
      updateEditingCell(null);
    });
  }, [updateEditingCell]);
  const handleEditingCellChange = useCallback((studentId: string, colId: string | null) => { 
    requestAnimationFrame(() => {
      updateEditingCell(colId ? { studentId, columnId: colId } : null); 
    });
  }, [updateEditingCell]);
  const toggleHistory = useCallback((studentId: string) => { setExpandedHistory(prev => ({ ...prev, [studentId]: prev[studentId] ? 0 : 3 })); }, []);

  const handleSetSwitch = useCallback((setId: string) => { 
    setActiveSet(setId); 
    localStorage.setItem(`todaySheetActiveSet_${currentUser?.id || 'default'}`, setId); 
  }, [currentUser?.id]);

  const toggleColumn = useCallback((colId: string) => { 
    const newCols = visibleColumns.includes(colId) ? visibleColumns.filter(c => c !== colId) : [...visibleColumns, colId]; 
    const newPresets = { ...presets, [activeSet]: newCols }; 
    setPresets(newPresets); 
    localStorage.setItem(`todaySheetPresets_${currentUser?.id || 'default'}`, JSON.stringify(newPresets)); 
  }, [visibleColumns, presets, activeSet, currentUser?.id]);

  // 4. Custom Hooks (Shortcuts & Events)
  useTodaySheetShortcuts({
    activeCell, setActiveCell,
    editingCell, setEditingCell,
    students, setStudents,
    filteredStudents,
    activeColumns,
    selectedRange, setSelectedRange,
    selectedDate,
    handleBatchSave,
    handleSetSwitch,
    setIsDragging,
    selectedIds,
    onSave,
    toggleSecondRow,
    toggleHistory,
    handleUndo,
    handleRedo,
    toggleShowAllTools: () => {
      setShowAllTools(prev => {
        const next = !prev;
        if (!next) setIsToolsEditMode(false);
        return next;
      });
    }
  });

  const resizingCol = useRef<{ id: string; startX: number; startWidth: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent, colId: string) => { resizingCol.current = { id: colId, startX: e.pageX, startWidth: colWidths[colId] || 100 }; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); document.body.style.cursor = 'col-resize'; };
  const onMouseMove = (e: MouseEvent) => { if (!resizingCol.current) return; const { id, startX, startWidth } = resizingCol.current; const newWidth = Math.max(40, startWidth + (e.pageX - startX)); setColWidths(prev => ({ ...prev, [id]: newWidth })); };
  const onMouseUp = () => { if (resizingCol.current) { setColWidths(latest => { localStorage.setItem('todaySheetColWidths', JSON.stringify(latest)); return latest; }); } resizingCol.current = null; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); document.body.style.cursor = 'default'; };

  // 💡 더블클릭 자동 열폭 맞춤 핸들러 추가 (DOM 데이터 파싱 방식)
  const handleDoubleClickResize = useCallback((colId: string) => {
    const cells = document.querySelectorAll(`[data-col-id="${colId}"]`);
    if (cells.length === 0) return;

    const calcTextWidth = (text: string) => {
      if (!text) return 0;
      let width = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        if (char > 127) width += 12; // 한글
        else width += 7.2; // 영문, 숫자, 공백 등
      }
      return width;
    };

    let maxContentWidth = 60;

    cells.forEach((cell: any) => {
      let val = '';
      
      // 셀 내부에 textarea나 input이 있다면 그 value를 가져오고, 없으면 innerText를 사용
      const inputEl = cell.querySelector('textarea, input');
      if (inputEl) {
        val = inputEl.value || '';
      } else {
        val = cell.innerText || '';
      }

      // 줄바꿈이 있는 텍스트는 가장 긴 라인을 기준으로 계산
      const lines = val.split('\n');
      lines.forEach((line: string) => {
        const w = calcTextWidth(line.trim()) + 28; // 셀 패딩 및 여백 확보
        if (w > maxContentWidth) maxContentWidth = w;
      });
    });

    const col = activeColumns.find((c: any) => c.id === colId);
    const finalWidth = Math.min(450, Math.max(col?.minWidth || 60, maxContentWidth));
    setColWidths(prev => {
      const next = { ...prev, [colId]: finalWidth };
      localStorage.setItem('todaySheetColWidths', JSON.stringify(next));
      return next;
    });
  }, [activeColumns]);

  const handleSendAll = async () => { if (!confirm(`${students.length}명 일괄 발송하시겠습니까?`)) return; setIsSendingReport('all'); let count = 0; for (const s of students) { try { const res = await fetch('/api/report', { method: 'POST', body: JSON.stringify({ studentId: s.id, sessionDate: selectedDate, academyId: academyInfo.id }) }); if (res.ok) count++; } catch(e){} } alert(`${count}명 완료`); setIsSendingReport(null); };
  const handleSendIndividual = async (id: string) => { const s = students.find((st:any) => st.id === id); if (!s) return; setIsSendingReport(id); try { const res = await fetch('/api/report', { method: 'POST', body: JSON.stringify({ studentId: id, sessionDate: selectedDate, academyId: academyInfo.id }) }); if (res.ok) alert(`${s.name} 발송 완료`); } catch(e){} finally { setIsSendingReport(null); } };

  const gradeStats = useMemo(() => { const stats: Record<string, number> = {}; ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'].forEach(g => stats[g] = 0); students.forEach((s:any) => { if (stats[s.grade] !== undefined) stats[s.grade]++; }); return stats; }, [students]);

  return (
    <div className="p-3 space-y-4 relative flex flex-col h-full overflow-hidden bg-[#fbfbfa] text-center">
      <div className="flex items-center justify-between px-3 py-2 bg-[#f7f7f5] border border-[#edece9] rounded-lg shrink-0 no-print shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5 items-start">
            <div className="flex items-center gap-3">
              <h3 className="text-[13px] font-black uppercase tracking-widest text-[#0c73e8] flex items-center gap-2.5"><TableIcon size={16} /> Daily Sheet</h3>
              <div className="flex items-center bg-[#edece9] p-0.5 rounded-[4px] border border-[#edece9]/50 shadow-inner">
                <button
                  onClick={() => setActiveTab('daily')}
                  className={`px-2.5 py-1 rounded-[3px] text-[10px] font-black tracking-tight transition-all cursor-pointer ${
                    activeTab === 'daily' 
                      ? 'bg-white text-[#0c73e8] shadow-sm' 
                      : 'text-[#37352f]/60 hover:text-[#37352f]'
                  }`}
                >
                  📝 일지 작성
                </button>
                <button
                  onClick={() => setActiveTab('checklist')}
                  className={`px-2.5 py-1 rounded-[3px] text-[10px] font-black tracking-tight transition-all cursor-pointer ${
                    activeTab === 'checklist' 
                      ? 'bg-white text-[#0c73e8] shadow-sm' 
                      : 'text-[#37352f]/60 hover:text-[#37352f]'
                  }`}
                >
                  📋 체크리스트
                </button>
              </div>
              <button
                onClick={onOpenBriefing}
                title="오늘의 브리핑 열기"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-700 rounded-[4px] text-[10px] font-black tracking-tight transition-all cursor-pointer shadow-sm ml-2"
              >
                <Megaphone size={11} className="text-amber-600" />
                오늘의 브리핑
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter mr-1">{students.length} Total</span>
              {Object.entries(gradeStats).filter(([_, count]) => count > 0).map(([grade, count], idx) => {
                const colorClass = grade.includes('초') ? 'text-emerald-600/80' : grade.includes('고') ? 'text-amber-600/80' : 'text-blue-600/80';
                return <div key={grade || idx} className="flex items-center gap-1 bg-white border border-[#edece9] px-1.5 py-0.5 rounded-[2px] shadow-sm"><span className="text-[8px] font-bold text-gray-650 uppercase">{grade}</span><span className={`text-[8px] font-black ${colorClass}`}>{count}</span></div>;
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 no-print">
          {focusColumn && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-md animate-pulse shadow-sm">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Focus Mode: {DEFAULT_COLUMNS.find(c => c.id === focusColumn)?.label}</span>
              <button onClick={() => setFocusColumn(null)} className="p-1 hover:bg-blue-200 rounded text-blue-600 transition-all"><X size={14} /></button>
            </div>
          )}

          {(() => {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const seoulTime = new Date(utc + (9 * 3600000));
            const todayStr = `${seoulTime.getFullYear()}-${String(seoulTime.getMonth() + 1).padStart(2, '0')}-${String(seoulTime.getDate()).padStart(2, '0')}`;
            const isNotToday = selectedDate !== todayStr;
            
            const [y, m, d] = selectedDate.split('-');
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const selectedDayStr = (y && m && d) ? `(${dayNames[new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay()]})` : '';

            const displayDate = (y && m && d) ? `${y.slice(2)}.${m}.${d}` : selectedDate;

            return (
              <div className="flex items-center gap-1.5">
                {/* 💡 [추가] 오늘 날짜 퀵 복귀 Today 버튼 */}
                <button
                  onClick={() => isNotToday && onDateChange(todayStr)}
                  disabled={!isNotToday}
                  className={`px-2.5 py-1.5 text-[10.5px] font-black uppercase tracking-wider rounded-[6px] transition-all border shadow-sm ${
                    isNotToday
                      ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-600 hover:text-white cursor-pointer font-black'
                      : 'bg-gray-100 text-gray-400 border-gray-250 cursor-not-allowed opacity-60'
                  }`}
                  title="오늘 날짜로 복귀"
                >
                  Today
                </button>

                <div onClick={(e) => { const input = e.currentTarget.querySelector('input'); if (input && 'showPicker' in input) try { (input as any).showPicker(); } catch (err) { console.error(err); } }}
                  className={`flex items-center gap-1 border rounded-[6px] px-2 py-1.5 transition-all group cursor-pointer shadow-sm relative ${
                    isNotToday 
                      ? 'bg-red-50 border-red-300 text-red-750 hover:bg-red-100/70' 
                      : 'bg-amber-50 border-amber-300 text-amber-955 hover:bg-amber-100/80'
                  }`}>
                  <CalendarIcon size={13} className={isNotToday ? 'text-red-655 animate-pulse' : 'text-amber-800 group-hover:text-amber-900'} />
                  <span className={`text-[11.5px] font-black tracking-tight shrink-0 select-none ${isNotToday ? 'text-red-700' : 'text-amber-950'}`}>
                    {displayDate}
                  </span>
                  <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="absolute opacity-0 w-0 h-0 pointer-events-none" />
                  {isNotToday ? (
                    <div className="ml-0.5 px-1 py-0.5 bg-red-655 text-white text-[9px] font-black rounded-sm whitespace-nowrap shadow-[0_0_8px_rgba(220,38,38,0.15)]">
                      {selectedDayStr}
                    </div>
                  ) : (
                    <div className="ml-0.5 px-1 py-0.5 bg-amber-600 text-white text-[9px] font-black rounded-sm whitespace-nowrap shadow-sm">
                      {selectedDayStr}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <button onClick={() => setIsReportVisible(!isReportVisible)} className={`flex items-center gap-2 px-5 py-2 rounded-[6px] text-[11px] font-black uppercase tracking-widest transition-all border shadow-sm ${isReportVisible ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white border-[#edece9] text-[#37352f]/60 hover:text-[#37352f] hover:bg-[#edece9]/50'}`}><LayoutGrid size={16} /> {isReportVisible ? '리포트 닫기' : '리포트 미리보기'}</button>
          
          {/* 💡 [변경] 전체 리포트 발송 버튼 (1행 안전 구역으로 이동) */}
          <button onClick={handleSendAll} disabled={!!isSendingReport} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-[6px] text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 shadow-sm no-print">
            {isSendingReport === 'all' ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />} 전체 리포트 발송
          </button>
          
          <div className="relative">
            <button onClick={() => setIsExportOpen(!isExportOpen)} className="flex items-center gap-2 px-4 py-2 bg-white border border-[#edece9] rounded-[6px] text-[10px] font-black uppercase tracking-widest text-[#37352f]/70 hover:text-[#37352f] hover:bg-[#edece9]/50 transition-all shadow-sm"><Download size={14} /> Download</button>
            <AnimatePresence>
              {isExportOpen && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-56 bg-white border border-[#edece9] rounded-lg shadow-lg p-2 z-[100] overflow-hidden">
                  <div className="space-y-1">
                    <button onClick={() => handleExport('aca2000')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[#edece9]/50 text-[#37352f]/70 hover:text-indigo-600 transition-all text-left group border border-indigo-100 hover:border-indigo-300 mb-1 bg-indigo-50/30"><div className="w-8 h-8 rounded bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all"><Zap size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">ACA2000 전용</span><span className="text-[9px] text-gray-500">업로드용 맞춤 엑셀</span></div></button>
                    <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[#edece9]/50 text-[#37352f]/70 hover:text-emerald-600 transition-all text-left group"><div className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all"><FileSpreadsheet size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">Excel File</span><span className="text-[9px] text-gray-500">Microsoft Excel (.xlsx)</span></div></button>
                    <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[#edece9]/50 text-[#37352f]/70 hover:text-amber-600 transition-all text-left group"><div className="w-8 h-8 rounded bg-amber-50 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all"><FileTextIcon size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">CSV File</span><span className="text-[9px] text-gray-500">쉼표로 구분된 텍스트 파일</span></div></button>
                    <button onClick={() => handleExport('copy')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[#edece9]/50 text-[#37352f]/70 hover:text-[#37352f] transition-all text-left group"><div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center group-hover:bg-[#37352f] group-hover:text-white transition-all"><Copy size={16} /></div><div className="flex flex-col"><span className="text-[12px] font-black">Copy to Clipboard</span><span className="text-[9px] text-gray-500">다른 엑셀 시트에 바로 붙여넣기</span></div></button>
                    
                    <div className="border-t border-[#edece9] my-1.5" />
                    
                    <input 
                      type="file" 
                      id="excel-aca-import-input" 
                      accept=".xlsx, .xls" 
                      onChange={handleImportExcel} 
                      className="hidden" 
                    />
                    <button 
                      onClick={() => {
                        setIsExportOpen(false);
                        document.getElementById('excel-aca-import-input')?.click();
                      }} 
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[#edece9]/50 text-[#37352f]/70 hover:text-purple-600 transition-all text-left group border border-purple-100 hover:border-purple-300 bg-purple-5/30"
                    >
                      <div className="w-8 h-8 rounded bg-purple-100 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-black">엑셀 일지 가져오기 (Import)</span>
                        <span className="text-[9px] text-purple-600 font-bold">아카2000 엑셀 업로드 복원</span>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2행 접기/펼치기 토글 버튼 */}
          <button 
            onClick={toggleSecondRow} 
            className={`p-2 border rounded-[6px] transition-all shadow-sm ${showSecondRow ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' : 'bg-white border-gray-350 text-gray-700 hover:text-black hover:bg-gray-100/60'}`}
            title={showSecondRow ? "상세 설정 도구 접기" : "상세 설정 도구 펼치기"}
          >
            {showSecondRow ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-white border border-gray-350 rounded-[6px] text-gray-700 hover:text-black hover:bg-gray-100/60 transition-all shadow-sm"><Settings2 size={18} /></button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showSecondRow && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 bg-[#f7f7f5] border border-[#edece9] rounded-lg shrink-0 text-left no-print overflow-hidden shadow-sm"
          >
            {/* 2행 왼쪽: 세트 선택 스위치 & 전체화면 모드 필터들 */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Set</span>
                <div className="flex bg-white p-0.5 rounded-md border border-gray-300 shadow-sm">
                  {['1', '2', '3', '4'].map((setId, idx) => {
                    const keys = ['Q', 'W', 'E', 'R'];
                    return (
                      <button 
                        key={setId} 
                        onClick={() => handleSetSwitch(setId)} 
                        className={`w-7 py-1 rounded-[4px] text-[11px] font-black transition-all ${activeSet === setId ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`} 
                        title={`Alt + ${keys[idx]}`}
                      >
                        {setId}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={() => setIsTagBatchMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-250 hover:bg-indigo-600 hover:text-white rounded-[4px] text-[10px] font-black transition-all ml-2 shadow-sm"
                title="태그별 일괄입력 모드 열기"
              >
                <Wand2 size={12} />
                태그입력
              </button>

              <button
                onClick={toggleHideAbsent}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-[4px] text-[10px] font-black transition-all ml-1 shadow-sm ${
                  hideAbsent === 'absent'
                    ? 'bg-rose-55 text-rose-700 border-rose-250 hover:bg-rose-600 hover:text-white shadow-md'
                    : hideAbsent === 'attend'
                    ? 'bg-emerald-55 text-emerald-700 border-emerald-250 hover:bg-emerald-600 hover:text-white shadow-md'
                    : 'bg-white text-gray-600 border-gray-350 hover:bg-gray-100 hover:text-black shadow-sm'
                }`}
                title={
                  hideAbsent === 'all' ? '전체 학생 표시 중 (클릭 시 결석생만 표시)' :
                  hideAbsent === 'absent' ? '결석생만 표시 중 (클릭 시 출석생만 표시)' :
                  '출석생(지각 포함)만 표시 중 (클릭 시 전체 표시)'
                }
              >
                {hideAbsent === 'all' && '전체'}
                {hideAbsent === 'absent' && '결석'}
                {hideAbsent === 'attend' && '출석'}
              </button>





              {isFullScreen && (
                <>
                  <div className="h-4 w-px bg-[#edece9]" />

                  {/* 담당 선생님 필터 (라벨 제거) */}
                  <select 
                    value={selectedTeacherId} 
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="bg-white border border-[#edece9] rounded-[4px] px-2.5 py-1.5 text-[10px] font-bold text-[#37352f] outline-none focus:border-blue-500 shadow-sm"
                  >
                    <option value="All">전체 선생님</option>
                    {teachers.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.initials || '?'})</option>
                    ))}
                  </select>

                  <div className="h-4 w-px bg-[#edece9]" />

                  {/* 학년 필터 (라벨 제거 & 초/중/고 축소) */}
                  <div className="flex bg-white rounded-[4px] p-0.5 border border-gray-300 shadow-sm">
                    {[
                      { label: 'ALL', key: 'All' }, { label: '초', key: '초' }, { label: '중', key: '중' }, { label: '고', key: '고' }
                    ].map((g) => (
                      <button 
                        key={g.key} 
                        onClick={() => setSelectedFilter(g.key)} 
                        className={`px-2.5 py-1 rounded-[3px] text-[9px] font-black uppercase transition-all ${selectedFilter === g.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-850'}`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>

                  <div className="h-4 w-px bg-gray-250" />

                  {/* 요일 필터 (라벨 제거) */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-[3px]">
                      {['월', '화', '수', '목', '금', '토', '일'].map((day) => {
                        const isActive = selectedDays.includes(day);
                        return (
                          <button 
                            key={day} 
                            onClick={() => {
                              if (selectedDays.includes(day)) {
                                setSelectedDays(selectedDays.filter((d: string) => d !== day));
                              } else {
                                setSelectedDays([...selectedDays, day]);
                              }
                            }} 
                            className={`w-6 h-6 rounded-[3px] text-[8px] font-black transition-all border ${isActive ? 'bg-blue-600 border-blue-500 text-white shadow-md' : 'bg-white border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-800 shadow-sm'}`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    {selectedDays.length > 0 && (
                      <button 
                        onClick={() => setIsAndFilter(!isAndFilter)} 
                        className={`px-1.5 py-0.5 rounded-[3px] text-[8px] font-black uppercase border transition-all ${isAndFilter ? 'bg-indigo-50 border-indigo-250 text-indigo-700 shadow-sm font-bold' : 'bg-white border border-gray-300 text-gray-500 hover:text-gray-800'}`}
                      >
                        {isAndFilter ? 'AND' : 'OR'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 2행 오른쪽: 정렬, 선택 숨김 제어, 화면 컨트롤 */}
            <div className="flex flex-wrap items-center gap-4 ml-auto justify-end">
              {/* 이전 기록 개수 설정 */}
              <div className="flex items-center gap-1.5 bg-white rounded-[4px] px-2 py-0.5 border border-[#edece9] shadow-sm">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mr-1">이력</span>
                <select
                  value={historyLimit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setHistoryLimit(val);
                    localStorage.setItem('ams_history_limit', String(val));
                  }}
                  className="bg-transparent border-0 text-[10px] font-black text-[#37352f] outline-none cursor-pointer focus:ring-0 py-0.5"
                >
                  <option value={1} className="bg-white text-[#37352f]">1개</option>
                  <option value={2} className="bg-white text-[#37352f]">2개</option>
                  <option value={3} className="bg-white text-[#37352f]">3개</option>
                  <option value={5} className="bg-white text-[#37352f]">5개</option>
                  <option value={10} className="bg-white text-[#37352f]">10개</option>
                  <option value={20} className="bg-white text-[#37352f]">20개</option>
                </select>
              </div>

              <div className="h-4 w-px bg-[#edece9]" />

              {/* 정렬 방식 및 방향 필터 */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-gray-550 uppercase tracking-widest">Sort</span>
                <div className="flex bg-white rounded-[4px] p-0.5 border border-gray-300 shadow-sm">
                  {[
                    { label: '시간순', key: 'time' }, { label: '이름순', key: 'name' }, { label: '학년순', key: 'grade' }, { label: '학교순', key: 'school' }
                  ].map((m) => (
                    <button 
                      key={m.key} 
                      onClick={() => onSortModeChange(m.key as any)} 
                      className={`px-2.5 py-1 rounded-[3px] text-[9px] font-black uppercase transition-all ${sortMode === m.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1 rounded-[4px] bg-white border border-gray-300 text-gray-700 hover:text-black hover:bg-gray-100/60 transition-all flex items-center gap-1 text-[8px] font-black shadow-sm"
                  title={sortDirection === 'asc' ? '오름차순 (Up)' : '내림차순 (Down)'}
                >
                  {sortDirection === 'asc' ? <ArrowUp size={10} className="text-blue-500 font-bold" /> : <ArrowDown size={10} className="text-purple-500 font-bold" />}
                  {sortDirection === 'asc' ? 'UP' : 'DOWN'}
                </button>
              </div>

              {(selectedIds.length > 0 || hiddenStudentIds.length > 0) && (
                <div className="flex items-center gap-1.5">
                  {selectedIds.length > 0 && (
                    <button
                      onClick={() => {
                        setHiddenStudentIds(prev => [...prev, ...selectedIds]);
                        setSelectedIds([]);
                      }}
                      className="px-2 py-1 rounded-[4px] bg-red-50 border border-red-300 text-red-700 hover:bg-red-600 hover:text-white transition-all flex items-center gap-1 text-[8px] font-black shadow-sm"
                      title="선택한 학생들을 임시로 숨깁니다"
                    >
                      <EyeOff size={10} />
                      숨김 ({selectedIds.length})
                    </button>
                  )}
                  {hiddenStudentIds.length > 0 && (
                    <button
                      onClick={() => setHiddenStudentIds([])}
                      className="px-2 py-1 rounded-[4px] bg-blue-50 border border-blue-250 text-blue-700 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1 text-[8px] font-black shadow-sm"
                      title="숨겨진 학생들을 모두 다시 표시합니다"
                    >
                      <Eye size={10} />
                      해제 ({hiddenStudentIds.length})
                    </button>
                  )}
                </div>
              )}

              <div className="h-4 w-px bg-[#edece9]" />

              {/* 화면 컨트롤 (원래 크기로 복원, 전체화면, 인쇄하기) */}
              <div className="flex items-center gap-1.5">
                {focusColumn && (
                  <button 
                    onClick={() => setFocusColumn(null)} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-[4px] text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(37,99,235,0.2)] transition-all animate-pulse mr-1"
                  >
                    <ArrowLeft size={12} /> 원래 크기로
                  </button>
                )}
                 <button 
                  onClick={onToggleFullScreen} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-350 text-gray-700 hover:bg-gray-100 hover:text-black rounded-[4px] text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                >
                  {isFullScreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  {isFullScreen ? '원래화면' : '전체화면'}
                </button>
                <button 
                  onClick={() => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                    setTimeout(() => setIsCardPrintOpen(true), 150);
                  }} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 border border-emerald-500 text-white rounded-[4px] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg mr-1.5"
                >
                  <Printer size={12} /> 안내장
                </button>
                <button 
                  onClick={() => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                    setTimeout(() => setIsHokmaPrintOpen(true), 150);
                  }} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 border border-amber-500 text-white rounded-[4px] text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 transition-all shadow-lg mr-1.5"
                >
                  <Printer size={12} /> 개별일지
                </button>
                <button 
                  onClick={() => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                    setTimeout(() => {
                      if (activeTab === 'checklist') {
                        checklistRef.current?.openPrintPreview();
                      } else {
                        setIsPrintPreviewOpen(true);
                      }
                    }, 150);
                  }} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 border border-indigo-500 text-white rounded-[4px] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg"
                >
                  <Printer size={12} /> 인쇄하기
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'checklist' ? (
        <ChecklistTabLight ref={checklistRef} students={filteredStudents} academyInfo={academyInfo} />
      ) : (
        <div 
          className={`bg-[#fbfbfa] border border-[#edece9] rounded-lg shadow-md custom-scrollbar-h overflow-x-auto overflow-y-auto transition-all duration-500 ${isReportVisible ? 'max-h-[35vh] shrink-0' : 'flex-1 min-h-0'} today-sheet-container no-print`}
          onScroll={handleScroll}
        >
        <table style={{ width: totalWidth, minWidth: '100%' }} className={`border-collapse table-fixed text-xs text-left ${isDragging ? 'select-none' : ''}`}>
          <thead><TodaySheetHeader colWidths={focusColWidths} activeColumns={activeColumns} onMouseDown={onMouseDown} onDoubleClick={handleDoubleClickResize} onSelectAll={handleSelectAll} isAllSelected={students.length > 0 && selectedIds.length === students.length} onFocusColumn={setFocusColumn} focusColumn={focusColumn} onColumnReorder={handleColumnReorder} showAllTools={showAllTools} setShowAllTools={setShowAllTools} isToolsEditMode={isToolsEditMode} setIsToolsEditMode={setIsToolsEditMode} /></thead>
          <tbody className="divide-y divide-[#edece9] bg-white">
            {(() => {
              const dayKey = getDayOfWeek(selectedDate);
              const [_, configM] = (academyInfo?.operation_settings?.first_period_time || "00:00").split(':').map(Number);
              const displayMinute = configM.toString().padStart(2, '0');

              return filteredStudents.map((s: any, idx: number) => {
                const getStartTime = (st: any) => {
                  if (st.todaySession?.moved_to_hour !== undefined && st.todaySession?.moved_to_hour !== null) {
                    return st.todaySession.moved_to_hour;
                  }
                  const stat = st.todaySession?.attendance_status || ATTENDANCE_STATUS.BEFORE;
                  if (stat.includes(':')) { const parts = stat.split(':'); const val = parseInt(parts[parts.length - 1]); if (!isNaN(val) && val < 24) return val; }
                  const hours = st.day_schedules?.[dayKey] || [];
                  if (hours.length > 0) {
                    const firstVal = hours[0];
                    let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
                    if (h <= 12) h += 12;
                    return h;
                  }
                  return 999;
                };
                const currentStartTime = getStartTime(s);
                const prevStartTime = idx > 0 ? getStartTime(filteredStudents[idx - 1]) : null;
                const isNewSection = sortMode === 'time' && currentStartTime !== prevStartTime && !focusColumn;

                const timeSectionLabel = isNewSection 
                  ? (currentStartTime === 999 
                      ? '기타 타임' 
                      : (currentStartTime >= 12 
                          ? (currentStartTime === 12 ? `오후 12:${displayMinute}` : `오후 ${currentStartTime-12}:${displayMinute}`) 
                          : `오전 ${currentStartTime}:${displayMinute}`) + ' 수업'
                    )
                  : undefined;

                return (
                  <React.Fragment key={s.id}>
                    <TodaySheetRow
                      key={`${s.id}-${selectedDate}`}
                      student={s}
                      cooperatingCells={cooperatingCells}
                      rowIndex={idx}
                      masterTextbooks={masterTextbooks}
                      onSave={handleSave}
                      onUpdateStudentInfo={onUpdateStudentInfo}
                      onViewProgress={onViewProgress}
                      onSelectStudent={onSelectStudent}
                      colWidths={focusColWidths}
                      activeColumns={activeColumns}
                      selectedDate={selectedDate} 
                      isHistoryExpanded={!!expandedHistory[s.id]} 
                      onToggleHistory={toggleHistory} 
                      currentUser={currentUser} 
                      academyInfo={academyInfo}
                      activeCell={activeCell}
                      editingCell={editingCell}
                      onActiveCellChange={handleActiveCellChange}
                      onEditingCellChange={handleEditingCellChange}
                      isSelected={selectedIds.includes(s.id)} 
                      onSelectOne={handleSelectOne} 
                      selectedRange={selectedRange} 
                      isCellInRange={isCellInRange} 
                      onCellMouseDown={onCellMouseDown} 
                      onCellMouseEnter={onCellMouseEnter} 
                      isFirstInTimeSection={isNewSection}
                      timeSectionLabel={timeSectionLabel}
                      historyLimit={historyLimit}
                      isScrolled={isScrolled}
                      showAllTools={showAllTools}
                      isToolsEditMode={isToolsEditMode}
                      toolsOrder={toolsOrder}
                      onReorderTools={handleReorderTools}
                    />
                  </React.Fragment>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Settings2 size={16} /> Column Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar-v space-y-1">
              {DEFAULT_COLUMNS.filter(c => c.canHide).map(col => (
                <div key={col.id} onClick={() => toggleColumn(col.id)} className={`flex items-center justify-between px-3 py-2.5 rounded-md transition-all cursor-pointer group ${visibleColumns.includes(col.id) ? 'bg-blue-600/20' : 'hover:bg-white/5'}`}><span className={`text-[12px] font-bold ${visibleColumns.includes(col.id) ? 'text-blue-400' : 'text-gray-500'}`}>{col.label}</span>{visibleColumns.includes(col.id) && <Check size={16} className="text-blue-500" />}</div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>{isReportVisible && <ReportPreview students={students} selectedDate={selectedDate} academyInfo={academyInfo} isSendingReport={isSendingReport} handleSendIndividual={handleSendIndividual} />}</AnimatePresence>
      <PrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        students={filteredStudents}
        selectedDate={selectedDate}
        academyInfo={academyInfo}
        activeColumns={activeColumns}
        columnWidths={colWidths}
      />
      <StudentReportCardPrintModal
        isOpen={isCardPrintOpen}
        onClose={() => setIsCardPrintOpen(false)}
        students={selectedIds.length > 0 ? filteredStudents.filter((s: any) => selectedIds.includes(s.id)) : filteredStudents}
        selectedDate={selectedDate}
        academyInfo={academyInfo}
      />
      <HokmaJournalPrintModal
        isOpen={isHokmaPrintOpen}
        onClose={() => setIsHokmaPrintOpen(false)}
        selectedStudents={selectedIds.length > 0 ? filteredStudents.filter((s: any) => selectedIds.includes(s.id)) : filteredStudents}
        allStudents={students}
        selectedTeacherId={selectedTeacherId}
        masterTextbooks={masterTextbooks}
        initialMonth={selectedDate.substring(0, 7)}
        academyInfo={academyInfo}
      />

      {/* 태그별 일괄입력 모달 */}
      <TagBatchInputModal
        isOpen={isTagBatchMode}
        onClose={() => setIsTagBatchMode(false)}
        students={filteredStudents}
        selectedIds={selectedIds}
        onBatchSave={handleBatchSave}
      />
    </div>
  );
}
