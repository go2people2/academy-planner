import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Plus, Loader2, CheckSquare, AlertTriangle, MinusSquare, Square, GripVertical, Archive, ArchiveRestore, Search } from 'lucide-react';
import ChecklistPrintPreviewModal from './ChecklistPrintPreviewModal';

export interface ChecklistTabProps {
  students: any[];
  allStudents?: any[];
  academyInfo: any;
  selectedFilter?: string;
  selectedTeacherId?: string;
  isLight?: boolean;
}

import { useChecklistTab } from './hooks/useChecklistTab';

export const ChecklistTab = forwardRef<any, ChecklistTabProps>(({ 
  students, 
  allStudents = [], 
  academyInfo, 
  selectedFilter = 'All', 
  selectedTeacherId = 'All',
  isLight = false 
}, ref) => {
  const {
    topics,
    setTopics,
    items,
    setItems,
    isPrintOpen,
    setIsPrintOpen,
    isArchiveModalOpen,
    setIsArchiveModalOpen,
    archiveSearchQuery,
    setArchiveSearchQuery,
    archivedTopicIds,
    setArchivedTopicIds,
    showAllDays,
    setShowAllDays,
    activeChecklistFilter,
    setActiveChecklistFilter,
    displayStudents,
    activeTopics,
    archivedTopics,
    searchedArchivedTopics,
    handleArchiveTopic,
    handleRestoreTopic,
    handleCycleColumnFilter,
    isLoading,
    setIsLoading,
    isAddingTopic,
    setIsAddingTopic,
    newTopicTitle,
    setNewTopicTitle,
  } = useChecklistTab({
    students,
    allStudents,
    academyInfo,
    selectedFilter,
    selectedTeacherId,
  });

  // 열 필터 헤더 전용 아이콘 렌더링
  const renderColumnFilterIcon = (topicId: string) => {
    const isCurrent = activeChecklistFilter.topicId === topicId;
    const filterStatus = isCurrent ? activeChecklistFilter.status : 'none';

    switch (filterStatus) {
      case 'checked':
        return <CheckSquare className="text-green-500 fill-green-500/10 hover:opacity-80 transition-all cursor-pointer animate-pulse" size={14} strokeWidth={2.5} />;
      case 'hold':
        return <AlertTriangle className="text-amber-500 fill-amber-500/10 hover:opacity-80 transition-all cursor-pointer animate-pulse" size={14} strokeWidth={2.5} />;
      case 'na':
        return <MinusSquare className="text-gray-400 fill-gray-400/10 hover:opacity-80 transition-all cursor-pointer animate-pulse" size={14} strokeWidth={2.5} />;
      case 'empty':
        return <Square className="text-blue-400 fill-blue-500/5 hover:opacity-80 transition-all cursor-pointer animate-pulse" size={14} strokeWidth={2.5} />;
      default:
        return (
          <div 
            className={`w-3.5 h-3.5 rounded-[3px] border transition-all cursor-pointer flex items-center justify-center text-[8px] font-black ${
              isLight 
                ? 'border-gray-400 text-gray-500 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-600' 
                : 'border-white/20 text-white/30 hover:border-blue-400 hover:bg-blue-50/5 hover:text-blue-400'
            }`} 
            title="클릭하여 이 열 조건으로 학생 필터링"
          >
            F
          </div>
        );
    }
  };

  useImperativeHandle(ref, () => ({
    openPrintPreview() {
      if (typeof window !== 'undefined') {
        window.print();
      }
    }
  }));

  const [draggedTopicId, setDraggedTopicId] = useState<string | null>(null);

  // 1. 데이터 조회
  const fetchData = async () => {
    if (!academyInfo?.id) return;
    setIsLoading(true);
    try {
      // 1) 주제 조회 (기본 DB 조회를 만든 후, display_order/로컬 순서로 보정)
      const { data: topicsData, error: err1 } = await supabase
        .from('ams_checklist_topics')
        .select('*')
        .eq('academy_id', academyInfo.id)
        .order('created_at', { ascending: true });

      if (err1) throw err1;
      
      let rawTopics = topicsData || [];
      // 로컬에 저장된 드래그 순서가 있는 경우 순서 재정렬
      const savedOrderJson = localStorage.getItem(`ams_checklist_topics_order_${academyInfo.id}`);
      if (savedOrderJson) {
        try {
          const savedOrder: string[] = JSON.parse(savedOrderJson);
          if (Array.isArray(savedOrder) && savedOrder.length > 0) {
            rawTopics = [...rawTopics].sort((a, b) => {
              const idxA = savedOrder.indexOf(a.id);
              const idxB = savedOrder.indexOf(b.id);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return (a.display_order || 0) - (b.display_order || 0);
            });
          }
        } catch (e) {}
      } else if (rawTopics.some(t => t.display_order !== undefined && t.display_order !== null)) {
        rawTopics = [...rawTopics].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      }

      setTopics(rawTopics);

      if (rawTopics.length > 0) {
        const topicIds = rawTopics.map(t => t.id);
        
        // 2) 아이템 조회
        const { data: itemsData, error: err2 } = await supabase
          .from('ams_checklist_items')
          .select('*')
          .in('topic_id', topicIds);

        if (err2) throw err2;

        // items 상태 재조합 [studentId][topicId]
        const itemsMap: Record<string, Record<string, any>> = {};
        (itemsData || []).forEach(item => {
          const key = item.course_name && item.course_name !== '정규' 
            ? `${item.student_id}_special_${item.course_name}_0`
            : item.student_id;

          if (!itemsMap[key]) {
            itemsMap[key] = {};
          }
          itemsMap[key][item.topic_id] = item;

          if (!itemsMap[item.student_id]) {
            itemsMap[item.student_id] = {};
          }
          if (!itemsMap[item.student_id][item.topic_id]) {
            itemsMap[item.student_id][item.topic_id] = item;
          }
        });

        // 특강 학생용 로컬 보존 데이터와 안전 병합 (새로고침 시 100% 복원 보장)
        try {
          const savedVirtualJson = localStorage.getItem(`ams_checklist_virtual_items_${academyInfo?.id}`);
          if (savedVirtualJson) {
            const savedMap = JSON.parse(savedVirtualJson);
            Object.keys(savedMap).forEach(vKey => {
              if (vKey.includes('_special_')) {
                itemsMap[vKey] = { ...(itemsMap[vKey] || {}), ...savedMap[vKey] };
              }
            });
          }
        } catch (e) {}

        setItems(itemsMap);
      } else {
        setItems({});
      }
    } catch (err) {
      console.error('Checklist Fetch Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [academyInfo?.id]);

  // 2. 상태 순환 토글 핸들러 (none -> checked -> hold -> na -> none)
  const handleCycleStatus = async (studentObj: any, topicId: string, currentVal: any) => {
    const virtualStudentId = typeof studentObj === 'string' ? studentObj : studentObj.id;
    const realStudentUuid = typeof studentObj === 'object' && studentObj.originalId 
      ? studentObj.originalId 
      : virtualStudentId.split('_special_')[0];

    const currentStatus = currentVal.status || 'none';
    let nextStatus = 'none';
    if (currentStatus === 'none') nextStatus = 'checked';
    else if (currentStatus === 'checked') nextStatus = 'hold';
    else if (currentStatus === 'hold') nextStatus = 'na';
    else nextStatus = 'none';

    // 1) 로컬 상태 낙관적 갱신 (가상 ID 기준 UI 독립 유지)
    const nextItem = {
      ...currentVal,
      status: nextStatus,
      is_checked: nextStatus === 'checked',
      student_id: realStudentUuid,
      topic_id: topicId
    };

    setItems(prev => {
      const studentMap = { ...(prev[virtualStudentId] || {}) };
      studentMap[topicId] = nextItem;
      const updated = { ...prev, [virtualStudentId]: studentMap };
      // 새로고침 시에도 특강 학생 행의 체크가 100% 복원되도록 로컬 보관소 동기화
      try {
        localStorage.setItem(`ams_checklist_virtual_items_${academyInfo?.id}`, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 2) DB Upsert
    try {
      const courseName = typeof studentObj === 'object' 
        ? (studentObj.isSpecialClass ? (studentObj.electiveCourse?.subject?.trim() || studentObj.courseName || '특강') : '정규')
        : '정규';

      const payload: any = {
        topic_id: topicId,
        student_id: realStudentUuid,
        course_name: courseName,
        status: nextStatus,
        is_checked: nextStatus === 'checked',
        memo: currentVal.memo || ''
      };
      if (currentVal.id) payload.id = currentVal.id;

      let { data, error } = await supabase
        .from('ams_checklist_items')
        .upsert([payload], { onConflict: 'student_id,topic_id' })
        .select();

      if (error && (error.code === '42703' || error.message?.includes('status'))) {
        delete payload.status;
        const retry = await supabase
          .from('ams_checklist_items')
          .upsert([payload], { onConflict: 'student_id,topic_id' })
          .select();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      
      if (data && data[0]) {
        setItems(prev => {
          const studentMap = { ...(prev[virtualStudentId] || {}) };
          studentMap[topicId] = { ...data[0], status: nextStatus };
          return { ...prev, [virtualStudentId]: studentMap };
        });
      }
    } catch (err: any) {
      console.error('Cycle Status Error:', err);
      alert('체크 상태 저장에 실패했습니다: ' + (err.message || ''));
      fetchData();
    }
  };

  // 상태별 아이콘 렌더링 헬퍼
  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'checked':
        return <CheckSquare className="text-green-500 fill-green-500/10 hover:opacity-80 transition-all animate-fade-in" size={16} strokeWidth={2.5} />;
      case 'hold':
        return <AlertTriangle className="text-amber-500 fill-amber-500/10 hover:opacity-80 transition-all animate-fade-in" size={16} strokeWidth={2.5} />;
      case 'na':
        return <MinusSquare className="text-gray-400 fill-gray-400/10 hover:opacity-80 transition-all animate-fade-in" size={16} strokeWidth={2.5} />;
      default:
        return (
          <div className={`w-4 h-4 rounded-[3px] border transition-all ${
            isLight 
              ? 'border-gray-400 hover:border-blue-600 hover:bg-blue-50 shadow-sm' 
              : 'border-white/20 hover:border-blue-500 hover:bg-blue-500/10'
          }`} />
        );
    }
  };

  // 완료 인원수 집계 함수
  const getCheckedCount = (topicId: string) => {
    let count = 0;
    displayStudents.forEach(student => {
      const cellData = items[student.id]?.[topicId];
      if (cellData?.status === 'checked' || cellData?.is_checked === true) {
        count++;
      }
    });
    return count;
  };

  // 3. 메모 저장 핸들러
  const handleSaveMemo = async (studentObj: any, topicId: string, nextMemo: string, currentVal: any) => {
    if ((currentVal.memo || '') === nextMemo) return;

    const virtualStudentId = typeof studentObj === 'string' ? studentObj : studentObj.id;
    const realStudentUuid = typeof studentObj === 'object' && studentObj.originalId 
      ? studentObj.originalId 
      : virtualStudentId.split('_special_')[0];

    // 1) 로컬 상태 낙관적 갱신
    setItems(prev => {
      const studentMap = { ...(prev[virtualStudentId] || {}) };
      studentMap[topicId] = {
        ...currentVal,
        memo: nextMemo,
        student_id: realStudentUuid,
        topic_id: topicId
      };
      return { ...prev, [virtualStudentId]: studentMap };
    });

    // 2) DB Upsert
    try {
      const courseName = typeof studentObj === 'object' 
        ? (studentObj.isSpecialClass ? (studentObj.electiveCourse?.subject?.trim() || studentObj.courseName || '특강') : '정규')
        : '정규';

      const payload: any = {
        topic_id: topicId,
        student_id: realStudentUuid,
        course_name: courseName,
        status: currentVal.status || (currentVal.is_checked ? 'checked' : 'none'),
        is_checked: currentVal.is_checked || false,
        memo: nextMemo
      };
      if (currentVal.id) payload.id = currentVal.id;

      const { data, error } = await supabase
        .from('ams_checklist_items')
        .upsert([payload], { onConflict: 'student_id,topic_id' })
        .select();

      if (error) throw error;
      
      if (data && data[0]) {
        setItems(prev => {
          const studentMap = { ...(prev[virtualStudentId] || {}) };
          studentMap[topicId] = data[0];
          return { ...prev, [virtualStudentId]: studentMap };
        });
      }
    } catch (err) {
      console.error('Save Memo Error:', err);
      alert('메모 저장에 실패했습니다.');
      fetchData();
    }
  };

  // 4. 주제 추가 핸들러
  const handleAddTopic = async () => {
    if (!newTopicTitle.trim() || !academyInfo?.id) return;
    setIsAddingTopic(true);
    try {
      const { error } = await supabase
        .from('ams_checklist_topics')
        .insert([{
          academy_id: academyInfo.id,
          title: newTopicTitle.trim()
        }]);

      if (error) throw error;
      setNewTopicTitle('');
      await fetchData();
    } catch (err) {
      console.error('Add Topic Error:', err);
      alert('체크 항목 주제 추가에 실패했습니다.');
    } finally {
      setIsAddingTopic(false);
    }
  };

  // 6. 주제 순서 변경 (Drag & Drop)
  const handleTopicReorder = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const currentIndex = topics.findIndex(t => t.id === draggedId);
    const targetIndex = topics.findIndex(t => t.id === targetId);
    if (currentIndex === -1 || targetIndex === -1) return;

    const newTopics = [...topics];
    const [moved] = newTopics.splice(currentIndex, 1);
    newTopics.splice(targetIndex, 0, moved);

    // display_order 부여
    const updatedTopics = newTopics.map((t, idx) => ({ ...t, display_order: idx + 1 }));
    setTopics(updatedTopics);

    try {
      const upsertPayload = updatedTopics.map(t => ({
        id: t.id,
        academy_id: academyInfo.id,
        title: t.title,
        display_order: t.display_order
      }));

      const { error } = await supabase
        .from('ams_checklist_topics')
        .upsert(upsertPayload, { onConflict: 'id' });

      if (error) {
        // DB에 display_order 컬럼이 없을 수도 있으므로 로컬 저장도 지원
        console.warn('Upsert display_order DB error (falling back to local):', error);
        localStorage.setItem(`ams_checklist_topics_order_${academyInfo.id}`, JSON.stringify(updatedTopics.map(t => t.id)));
      }
    } catch (err) {
      console.error('Reorder Topic Error:', err);
    }
  };
  // 5. 주제 삭제 핸들러
  const handleDeleteTopic = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    if (!confirm(`⚠️ "${topic.title}" 체크 항목을 정말 삭제하시겠습니까?\n이 항목에 입력된 모든 학생의 체크 정보와 메모가 완전히 삭제됩니다.`)) return;

    try {
      const { error } = await supabase
        .from('ams_checklist_topics')
        .delete()
        .eq('id', topicId);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Delete Topic Error:', err);
      alert('체크 항목 삭제에 실패했습니다.');
    }
  };

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const defaultWidths = { name: 70 };
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_checklist_col_widths');
      if (saved) {
        try {
          return { ...defaultWidths, ...JSON.parse(saved) };
        } catch (e) {
          console.error(e);
        }
      }
    }
    return defaultWidths;
  });

  const getTableWidth = () => {
    const nameW = colWidths.name || 70;
    let sum = nameW + 40;
    activeTopics.forEach(t => {
      sum += (colWidths[`${t.id}-check`] || 35) + (colWidths[`${t.id}-memo`] || 85);
    });
    return sum;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ams_checklist_col_widths', JSON.stringify(colWidths));
    }
  }, [colWidths]);

  const handleResizeStart = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || (colKey.endsWith('-check') ? 35 : colKey.endsWith('-memo') ? 85 : 70);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(colKey.endsWith('-check') ? 20 : colKey.endsWith('-memo') ? 30 : 40, startWidth + deltaX);
      setColWidths(prev => ({
        ...prev,
        [colKey]: newWidth
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="animate-spin text-blue-500" size={24} />
        <span className="text-xs font-bold text-gray-400">체크리스트 정보 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 컨트롤 영역 */}
      <div className={`flex justify-between items-center p-3 rounded-[3px] border shadow-sm ${isLight ? 'bg-white border-[#e3e2e0]' : 'bg-[#0d0d0d] border-white/5'}`}>
        <div className="flex flex-col gap-0.5">
          <h4 className={`text-[12px] font-black ${isLight ? 'text-[#37352f]' : 'text-gray-200'}`}>📋 체크리스트</h4>
          <p className="text-[9px] text-gray-500 font-bold">학생 개별로 기말고사, 오답노트, 안내문 수거 등의 완료 현황을 기록하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 새 항목 추가 폼 (상단 툴바 통합) */}
          <div className={`flex items-center gap-1.5 mr-1 p-1 rounded-[3px] border ${isLight ? 'bg-gray-100 border-[#e3e2e0]' : 'bg-[#141414] border-white/10'}`}>
            <input
              type="text"
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTopic();
              }}
              placeholder="예: 6월 모의고사 오답노트"
              className={`px-2 py-1 text-[11px] rounded-[2px] outline-none focus:border-blue-500 w-44 font-bold border ${isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-[#090909] border-white/10 text-white'}`}
            />
            <button
              onClick={handleAddTopic}
              disabled={isAddingTopic || !newTopicTitle.trim()}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-[2px] text-[10px] font-black hover:bg-blue-500 disabled:bg-gray-400 transition-all shadow-md cursor-pointer"
            >
              {isAddingTopic ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              추가
            </button>
          </div>

          {/* 보관함 버튼 */}
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-[10px] font-black border transition-all shadow-md cursor-pointer ${
              isLight 
                ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100' 
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
            }`}
            title="보관 처리된 체크리스트 항목들을 확인 및 복구합니다."
          >
            <Archive size={12} />
            📦 보관함 ({archivedTopics.length})
          </button>

          {/* 필터 전체 해제 버튼 */}
          {activeChecklistFilter.topicId !== null && (
            <button
              onClick={() => setActiveChecklistFilter({ topicId: null, status: 'none' })}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] text-[10px] font-black border transition-all shadow-md cursor-pointer animate-fade-in ${
                isLight 
                  ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100' 
                  : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
              }`}
              title="활성화된 열 필터를 초기화합니다."
            >
              🧹 필터 해제
            </button>
          )}

          {/* 다른 요일 포함 토글 스위치 단추 */}
          <button
            onClick={() => setShowAllDays(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-[10px] font-black border transition-all shadow-md cursor-pointer ${
              showAllDays 
                ? 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white' 
                : (isLight ? 'bg-gray-100 border-[#e3e2e0] text-gray-700 hover:bg-gray-200' : 'bg-[#151515] hover:bg-[#202020] border-white/5 text-gray-400')
            }`}
            title="오늘 요일 외의 모든 학생들을 체크리스트 명단에 소환합니다."
          >
            <CheckSquare size={12} className={showAllDays ? "animate-pulse" : ""} />
            다른 요일 학생 포함
          </button>
        </div>
      </div>

      {/* 테이블 래퍼 */}
      <div className={`border rounded-[3px] overflow-auto shadow-sm max-h-[calc(100vh-280px)] custom-scrollbar-h custom-scrollbar-v relative ${isLight ? 'bg-white border-[#e3e2e0]' : 'bg-[#090909] border-white/5'}`}>
        <table style={{ minWidth: getTableWidth(), width: '100%' }} className="w-full border-collapse table-fixed text-xs text-left">
          <colgroup>
            <col style={{ width: colWidths.name || 70, minWidth: colWidths.name || 70 }} />
            {activeTopics.map(t => {
              const checkWidth = colWidths[`${t.id}-check`] || 35;
              const memoWidth = colWidths[`${t.id}-memo`] || 85;
              return (
                <React.Fragment key={`col-${t.id}`}>
                  <col style={{ width: checkWidth, minWidth: checkWidth }} />
                  <col style={{ width: memoWidth, minWidth: memoWidth }} />
                </React.Fragment>
              );
            })}
            <col />
          </colgroup>
          <thead>
            {/* 1단 머지 헤더 */}
            <tr className={`border-b uppercase tracking-widest text-[9.5px] font-black sticky top-0 z-30 shadow-sm ${
              isLight ? 'border-[#e3e2e0] bg-gray-100 text-gray-700' : 'border-white/5 bg-[#121212] text-gray-400'
            }`}>
              <th rowSpan={2} className={`py-3 px-3 border-r text-left sticky left-0 top-0 z-50 shadow-sm group relative ${
                isLight ? 'border-[#e3e2e0] bg-gray-100 text-[#37352f]' : 'border-white/5 bg-[#121212] text-gray-200'
              }`}>
                학생 이름
                <div 
                  onMouseDown={(e) => handleResizeStart(e, 'name')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/30 transition-colors z-40"
                  title="드래그하여 이름 열 너비 조절"
                />
              </th>
              {activeTopics.map(t => (
                <th 
                  key={t.id} 
                  colSpan={2} 
                  draggable
                  onDragStart={(e) => {
                    setDraggedTopicId(t.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', t.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedTopicId && draggedTopicId !== t.id) {
                      handleTopicReorder(draggedTopicId, t.id);
                    }
                    setDraggedTopicId(null);
                  }}
                  className={`py-2.5 px-3 border-r text-center group relative cursor-grab active:cursor-grabbing transition-colors ${
                    isLight ? 'border-[#e3e2e0]' : 'border-white/5'
                  } ${
                    draggedTopicId === t.id ? 'bg-blue-600/30 border-blue-400' : ''
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mr-2">
                    <GripVertical size={13} className="text-gray-400 hover:text-gray-700 shrink-0 cursor-grab active:cursor-grabbing" />
                    {/* 전역 열 필터 버튼 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCycleColumnFilter(t.id); }}
                      className="inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-200 transition-all cursor-pointer"
                      title="클릭하여 이 열의 체크 상태 기준 필터링 순환"
                    >
                      {renderColumnFilterIcon(t.id)}
                    </button>
                    <span className={`text-[11px] font-black text-center break-all leading-tight ${isLight ? 'text-[#37352f]' : 'text-gray-100'}`} title={t.title}>
                      {t.title}
                    </span>
                    {/* 보관 버튼 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleArchiveTopic(t.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-amber-600 hover:bg-amber-100 transition-all cursor-pointer"
                      title="체크 항목 보관함으로 이동"
                    >
                      <Archive size={11} strokeWidth={2.5} />
                    </button>
                    {/* 삭제 버튼 */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTopic(t.id); }} 
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-600 hover:bg-red-100 transition-all cursor-pointer"
                      title="체크 항목 영구 제거"
                    >
                      <Trash2 size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                  <div 
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, `${t.id}-memo`); }}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/30 transition-colors z-40"
                    title="드래그하여 이 주제의 가로 폭 조절"
                  />
                </th>
              ))}
              <th rowSpan={2} className="py-3 px-3 text-center"></th>
            </tr>
            {/* 2단 상세 헤더 */}
            <tr className={`border-b uppercase tracking-widest text-[8.5px] font-black sticky top-[37px] z-30 shadow-sm ${
              isLight ? 'border-[#e3e2e0] bg-gray-100 text-gray-600' : 'border-white/5 bg-[#121212] text-gray-500'
            }`}>
              {activeTopics.map(t => (
                <React.Fragment key={`sub-${t.id}`}>
                  <th className={`py-1.5 px-2 border-r text-center ${isLight ? 'border-[#e3e2e0]' : 'border-white/5'}`}>완료</th>
                  <th className={`py-1.5 px-2 border-r text-left ${isLight ? 'border-[#e3e2e0]' : 'border-white/5'}`}>메모 / 특이사항</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>

          <tbody>
            {displayStudents.length === 0 ? (
              <tr>
                <td colSpan={1 + activeTopics.length * 2 + 1} className="py-12 text-center text-xs text-gray-500 font-bold italic">
                  필터링된 학생이 존재하지 않습니다.
                </td>
              </tr>
            ) : (
              displayStudents.map((student, idx) => {
                const rowBg = isLight 
                  ? (idx % 2 === 0 ? "bg-white hover:bg-blue-50/50" : "bg-[#f9f9f8] hover:bg-blue-50/50")
                  : (idx % 2 === 0 ? "bg-[#0f0f0f] hover:bg-[#1a1a1a]" : "bg-[#151515] hover:bg-[#1a1a1a]");
                return (
                  <tr key={student.id} className={`${rowBg} border-b transition-colors align-middle text-[11px] ${isLight ? 'border-[#e3e2e0]' : 'border-white/5'}`}>
                    {/* 1열 고정 학생명 */}
                    <td className={`py-1 px-1.5 border-r font-black sticky left-0 bg-inherit z-20 shadow-sm ${
                      isLight ? 'border-[#e3e2e0] text-[#37352f]' : 'border-white/5 text-gray-200'
                    }`}>
                      <div className="leading-none py-1">
                        <span className="truncate max-w-[80px] text-[11px]" title={student.name}>{student.isSpecialClass ? `${student.electiveCourse?.subject?.trim() || '특강'}-` : ''}{student.name}</span>
                      </div>
                    </td>

                    {/* 2열 이후 체크/메모 */}
                    {activeTopics.map(t => {
                      const cellData = items[student.id]?.[t.id] || { is_checked: false, memo: '' };
                      return (
                        <React.Fragment key={`${student.id}-${t.id}`}>
                          {/* 체크 상태 순환 셀 */}
                          <td className={`py-1 px-2 border-r text-center ${isLight ? 'border-[#e3e2e0]' : 'border-white/5'}`}>
                            <button 
                              onClick={() => handleCycleStatus(student, t.id, cellData)}
                              className="inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-200/50 transition-all cursor-pointer animate-fade-in"
                              title="클릭하여 상태 순환 (공란 -> 완료 -> 보류 -> 제외)"
                            >
                              {renderStatusIcon(cellData.status)}
                            </button>
                          </td>
                          {/* 메모 입력 셀 */}
                          <td className={`py-0.5 px-1.5 border-r align-middle ${isLight ? 'border-[#e3e2e0]' : 'border-white/5'}`}>
                            <input 
                              type="text"
                              defaultValue={cellData.memo}
                              onBlur={(e) => handleSaveMemo(student, t.id, e.target.value, cellData)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              placeholder="-"
                              className={`w-full bg-transparent border border-transparent rounded-[2px] px-1 py-0.5 text-[10px] font-bold outline-none transition-all ${
                                isLight 
                                  ? 'text-[#37352f] hover:border-[#e3e2e0] focus:border-blue-500 focus:bg-white' 
                                  : 'text-gray-300 hover:border-white/10 focus:border-blue-500 focus:bg-[#1a1a1a]'
                              }`}
                            />
                          </td>
                        </React.Fragment>
                      );
                    })}

                    <td className="py-2.5 px-3"></td>
                  </tr>
                );
              })
            )}
            {/* 맨 아래 합계 행 */}
            {displayStudents.length > 0 && (
              <tr className={`border-t font-bold text-[11px] align-middle sticky bottom-0 z-10 shadow-sm ${
                isLight ? 'bg-gray-100 border-[#e3e2e0] text-gray-700' : 'bg-[#121212] border-white/5 text-gray-400'
              }`}>
                <td className={`py-2.5 px-1.5 border-r font-black sticky left-0 z-20 text-center ${
                  isLight ? 'bg-gray-100 border-[#e3e2e0] text-gray-700' : 'bg-[#121212] border-white/5 text-gray-500'
                }`}>
                  완료 인원
                </td>
                {topics.map(t => {
                  const checkedCount = getCheckedCount(t.id);
                  return (
                    <React.Fragment key={`sum-${t.id}`}>
                      <td className={`py-2 px-2 border-r text-center font-black ${
                        isLight ? 'bg-emerald-50 border-[#e3e2e0] text-emerald-700' : 'bg-green-500/5 border-white/5 text-green-400'
                      }`}>
                        {checkedCount}명
                      </td>
                      <td className={`py-2 px-2.5 border-r ${isLight ? 'border-[#e3e2e0]' : 'border-white/5'}`}></td>
                    </React.Fragment>
                  );
                })}
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 📦 보관함 모달 */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121212] border border-white/10 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#181818]">
              <div className="flex items-center gap-2">
                <Archive size={16} className="text-amber-400" />
                <h3 className="text-sm font-black text-white">📦 체크 항목 보관함</h3>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  총 {archivedTopics.length}개 보관됨
                </span>
              </div>
              <button
                onClick={() => setIsArchiveModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 검색창 */}
            <div className="p-3 border-b border-white/5 bg-[#141414]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={archiveSearchQuery}
                  onChange={(e) => setArchiveSearchQuery(e.target.value)}
                  placeholder="보관된 체크 항목 검색..."
                  className="w-full bg-[#090909] border border-white/10 rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 font-bold"
                />
              </div>
            </div>

            {/* 보관 항목 리스트 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar-v">
              {searchedArchivedTopics.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500 font-bold">
                  {archiveSearchQuery.trim() ? '검색어와 일치하는 보관 항목이 없습니다.' : '보관함이 비어 있습니다.'}
                </div>
              ) : (
                searchedArchivedTopics.map((topic) => {
                  return (
                    <div
                      key={topic.id}
                      className="flex items-center justify-between p-3 bg-[#181818] border border-white/5 rounded-lg hover:border-amber-500/30 transition-all group"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-black text-gray-200">
                          {topic.title.replace(/^\[ARCHIVED\]\s*/, '')}
                        </span>
                        <span className="text-[9.5px] font-bold text-gray-500">
                          생성일: {new Date(topic.created_at || Date.now()).toLocaleDateString('ko-KR')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreTopic(topic.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded text-[10px] font-black transition-all shadow cursor-pointer"
                          title="메인 체크리스트 표로 복구합니다"
                        >
                          <ArchiveRestore size={12} />
                          복구
                        </button>
                        <button
                          onClick={() => handleDeleteTopic(topic.id)}
                          className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="영구 삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ChecklistTab.displayName = 'ChecklistTab';
