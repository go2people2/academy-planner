import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Plus, Loader2, CheckSquare, AlertTriangle, MinusSquare, Square, GripVertical } from 'lucide-react';
import ChecklistPrintPreviewModal from './ChecklistPrintPreviewModal';

interface ChecklistTabProps {
  students: any[];
  allStudents?: any[];
  academyInfo: any;
  selectedFilter?: string;
  selectedTeacherId?: string;
}

export const ChecklistTab = forwardRef<any, ChecklistTabProps>(({ 
  students, 
  allStudents = [], 
  academyInfo, 
  selectedFilter = 'All', 
  selectedTeacherId = 'All' 
}, ref) => {
  const [topics, setTopics] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, Record<string, any>>>({});
  
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  
  const [showAllDays, setShowAllDays] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_checklist_show_all_days');
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ams_checklist_show_all_days', String(showAllDays));
    }
  }, [showAllDays]);

  const [activeChecklistFilter, setActiveChecklistFilter] = useState<{
    topicId: string | null;
    status: string; // 'none' | 'checked' | 'hold' | 'na'
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_checklist_active_filter');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return { topicId: null, status: 'none' };
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ams_checklist_active_filter', JSON.stringify(activeChecklistFilter));
    }
  }, [activeChecklistFilter]);

  // 실시간 화면 및 연산에 사용될 최종 학생 리스트
  const displayStudents = useMemo(() => {
    // 1) showAllDays가 false이면 부모가 넘겨준 오늘 요일 학생 목록(이미 정렬 완료) 사용
    const baseList = showAllDays 
      ? (allStudents && allStudents.length > 0 ? allStudents : students)
      : students;
    
    let filtered = baseList.filter(s => !s.is_deleted);

    // 2) 학년/반 필터 동기화
    if (selectedFilter && selectedFilter !== 'All') {
      if (selectedFilter.startsWith('Grade-')) {
        const gradeTarget = selectedFilter.replace('Grade-', ''); // 예: "초", "중", "고"
        filtered = filtered.filter(s => s.grade && s.grade.includes(gradeTarget));
      } else if (selectedFilter.startsWith('Class-')) {
        const classIdTarget = selectedFilter.replace('Class-', '');
        filtered = filtered.filter(s => s.class_id === classIdTarget);
      }
    }

    // 3) 담당 선생님 필터 동기화
    if (selectedTeacherId && selectedTeacherId !== 'All') {
      filtered = filtered.filter(s => s.teacher_id === selectedTeacherId);
    }

    // 4) 열 헤더에 지정된 "체크리스트 단일 열 필터" 적용!
    if (activeChecklistFilter.topicId && activeChecklistFilter.status !== 'none') {
      const targetTopicId = activeChecklistFilter.topicId;
      const targetStatus = activeChecklistFilter.status;

      filtered = filtered.filter(student => {
        const cellData = items[student.id]?.[targetTopicId];
        const studentStatus = cellData?.status || 'none';
        
        if (targetStatus === 'checked') {
          return studentStatus === 'checked' || cellData?.is_checked === true;
        }

        // 'empty' 필터일 때는, studentStatus가 'none' 이거나 데이터가 없는 미체크 상태인 경우만 필터링!
        if (targetStatus === 'empty') {
          return studentStatus === 'none' && cellData?.is_checked !== true;
        }

        return studentStatus === targetStatus;
      });
    }

    // 5) 가나다 순으로 깔끔하게 정렬 (showAllDays인 경우에만 정렬 혹은 항상 정렬도 좋지만 오늘 요일 리스트는 원래의 정렬 순서 유지)
    if (showAllDays) {
      return filtered.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
    return filtered;
  }, [students, allStudents, showAllDays, selectedFilter, selectedTeacherId, activeChecklistFilter, items]);

  const handleCycleColumnFilter = (topicId: string) => {
    setActiveChecklistFilter(prev => {
      // 다른 항목을 필터하려는 경우, 새로 지정하고 'checked'부터 시작
      if (prev.topicId !== topicId) {
        return { topicId, status: 'checked' };
      }
      
      // 같은 항목인 경우 5단 순환: none -> checked -> hold -> na -> empty -> none
      let nextStatus = 'none';
      if (prev.status === 'none') nextStatus = 'checked';
      else if (prev.status === 'checked') nextStatus = 'hold';
      else if (prev.status === 'hold') nextStatus = 'na';
      else if (prev.status === 'na') nextStatus = 'empty';
      else nextStatus = 'none';

      return {
        topicId: nextStatus === 'none' ? null : topicId,
        status: nextStatus
      };
    });
  };

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
            className="w-3.5 h-3.5 rounded-[3px] border border-white/20 hover:border-blue-400 hover:bg-blue-50/5 transition-all cursor-pointer flex items-center justify-center text-[8px] font-black text-white/30 hover:text-blue-400" 
            title="클릭하여 이 열 조건으로 학생 필터링"
          >
            F
          </div>
        );
    }
  };

  useImperativeHandle(ref, () => ({
    openPrintPreview() {
      setIsPrintOpen(true);
    }
  }));

  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
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
          if (!itemsMap[item.student_id]) {
            itemsMap[item.student_id] = {};
          }
          itemsMap[item.student_id][item.topic_id] = item;
        });
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
  const handleCycleStatus = async (studentId: string, topicId: string, currentVal: any) => {
    const currentStatus = currentVal.status || 'none';
    let nextStatus = 'none';
    if (currentStatus === 'none') nextStatus = 'checked';
    else if (currentStatus === 'checked') nextStatus = 'hold';
    else if (currentStatus === 'hold') nextStatus = 'na';
    else nextStatus = 'none';

    // 1) 로컬 상태 낙관적 갱신
    setItems(prev => {
      const studentMap = { ...(prev[studentId] || {}) };
      studentMap[topicId] = {
        ...currentVal,
        status: nextStatus,
        is_checked: nextStatus === 'checked', // 하위 호환성용
        student_id: studentId,
        topic_id: topicId
      };
      return { ...prev, [studentId]: studentMap };
    });

    // 2) DB Upsert
    try {
      const payload: any = {
        topic_id: topicId,
        student_id: studentId,
        status: nextStatus,
        is_checked: nextStatus === 'checked',
        memo: currentVal.memo || ''
      };
      if (currentVal.id) payload.id = currentVal.id;

      const { data, error } = await supabase
        .from('ams_checklist_items')
        .upsert([payload], { onConflict: 'student_id,topic_id' })
        .select();

      if (error) throw error;
      
      // DB 반환 ID 동기화
      if (data && data[0]) {
        setItems(prev => {
          const studentMap = { ...(prev[studentId] || {}) };
          studentMap[topicId] = data[0];
          return { ...prev, [studentId]: studentMap };
        });
      }
    } catch (err) {
      console.error('Cycle Status Error:', err);
      alert('체크 상태 저장에 실패했습니다.');
      fetchData(); // 롤백 복구
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
        return <div className="w-4 h-4 rounded-[3px] border border-white/10 hover:border-blue-500 hover:bg-blue-500/10 transition-all" />;
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
  const handleSaveMemo = async (studentId: string, topicId: string, nextMemo: string, currentVal: any) => {
    if ((currentVal.memo || '') === nextMemo) return; // 변경점 없으면 취소

    // 1) 로컬 상태 낙관적 갱신
    setItems(prev => {
      const studentMap = { ...(prev[studentId] || {}) };
      studentMap[topicId] = {
        ...currentVal,
        memo: nextMemo,
        student_id: studentId,
        topic_id: topicId
      };
      return { ...prev, [studentId]: studentMap };
    });

    // 2) DB Upsert
    try {
      const payload: any = {
        topic_id: topicId,
        student_id: studentId,
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
          const studentMap = { ...(prev[studentId] || {}) };
          studentMap[topicId] = data[0];
          return { ...prev, [studentId]: studentMap };
        });
      }
    } catch (err) {
      console.error('Save Memo Error:', err);
      alert('메모 저장에 실패했습니다.');
      fetchData(); // 롤백 복구
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

  const getTableWidth = () => {
    const nameW = colWidths.name || 70;
    let sum = nameW + 40;
    topics.forEach(t => {
      sum += (colWidths[`${t.id}-check`] || 35) + (colWidths[`${t.id}-memo`] || 85);
    });
    return sum;
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
      <div className="flex justify-between items-center bg-[#0d0d0d] border border-white/5 p-3 rounded-[3px] shadow-sm">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-[12px] font-black text-gray-200">📋 실시간 진척도 체크리스트</h4>
          <p className="text-[9px] text-gray-500 font-bold">학생 개별로 기말고사, 오답노트, 안내문 수거 등의 완료 현황을 기록하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 필터 전체 해제 버튼 */}
          {activeChecklistFilter.topicId !== null && (
            <button
              onClick={() => setActiveChecklistFilter({ topicId: null, status: 'none' })}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] text-[10px] font-black border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-md cursor-pointer animate-fade-in"
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
                : 'bg-[#151515] hover:bg-[#202020] border-white/5 text-gray-400'
            }`}
            title="오늘 요일 외의 모든 학생들을 체크리스트 명단에 소환합니다."
          >
            <CheckSquare size={12} className={showAllDays ? "animate-pulse" : ""} />
            다른 요일 학생 포함
          </button>

          <input 
            type="text" 
            value={newTopicTitle}
            onChange={(e) => setNewTopicTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
            placeholder="예: 기말고사 시험지 수거"
            className="bg-[#151515] border border-white/5 rounded-[2px] px-3 py-1.5 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all w-[180px]"
            disabled={isAddingTopic}
          />
          <button
            onClick={handleAddTopic}
            disabled={isAddingTopic || !newTopicTitle.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-[2px] text-[10px] font-black hover:bg-blue-500 disabled:bg-gray-700 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
          >
            {isAddingTopic ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            항목 추가
          </button>
        </div>
      </div>

      {/* 테이블 래퍼 */}
      <div className="border border-white/5 rounded-[3px] bg-[#090909] overflow-auto shadow-sm max-h-[calc(100vh-280px)] custom-scrollbar-h custom-scrollbar-v relative">
        <table style={{ minWidth: getTableWidth(), width: '100%' }} className="w-full border-collapse table-fixed text-xs text-left">
          <colgroup>
            <col style={{ width: colWidths.name || 70, minWidth: colWidths.name || 70 }} />
            {topics.map(t => {
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
            <tr className="border-b border-white/5 bg-[#121212] text-gray-400 uppercase tracking-widest text-[9.5px] font-black sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
              <th rowSpan={2} className="py-3 px-3 border-r border-white/5 text-left sticky left-0 top-0 bg-[#121212] z-50 shadow-[2px_2px_5px_rgba(0,0,0,0.3)] group relative">
                학생 이름
                <div 
                  onMouseDown={(e) => handleResizeStart(e, 'name')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/10 transition-colors z-40"
                  title="드래그하여 이름 열 너비 조절"
                />
              </th>
              {topics.map(t => (
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
                  className={`py-2.5 px-3 border-r border-white/5 text-center group relative cursor-grab active:cursor-grabbing transition-colors ${
                    draggedTopicId === t.id ? 'bg-blue-600/30 border-blue-400' : ''
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mr-2">
                    <GripVertical size={13} className="text-gray-500 hover:text-white shrink-0 cursor-grab active:cursor-grabbing" />
                    {/* 전역 열 필터 버튼 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCycleColumnFilter(t.id); }}
                      className="inline-flex items-center justify-center p-0.5 rounded hover:bg-white/10 transition-all cursor-pointer"
                      title="클릭하여 이 열의 체크 상태 기준 필터링 순환"
                    >
                      {renderColumnFilterIcon(t.id)}
                    </button>
                    <span className="text-gray-100 text-[11px] font-black text-center break-all leading-tight" title={t.title}>
                      {t.title}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTopic(t.id); }} 
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:bg-white/5 transition-all cursor-pointer"
                      title="체크 항목 제거"
                    >
                      <Trash2 size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                  <div 
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, `${t.id}-memo`); }}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/10 transition-colors z-40"
                    title="드래그하여 이 주제의 가로 폭 조절"
                  />
                </th>
              ))}
              <th rowSpan={2} className="py-3 px-3 text-center"></th>
            </tr>
            {/* 2단 상세 헤더 */}
            <tr className="border-b border-white/5 bg-[#121212] text-gray-500 uppercase tracking-widest text-[8.5px] font-black sticky top-[37px] z-30 shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
              {topics.map(t => (
                <React.Fragment key={`sub-${t.id}`}>
                  <th className="py-1.5 px-2 border-r border-white/5 text-center">완료</th>
                  <th className="py-1.5 px-2 border-r border-white/5 text-left">메모 / 특이사항</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>

          <tbody>
            {displayStudents.length === 0 ? (
              <tr>
                <td colSpan={1 + topics.length * 2 + 1} className="py-12 text-center text-xs text-gray-500 font-bold italic">
                  필터링된 학생이 존재하지 않습니다.
                </td>
              </tr>
            ) : (
              displayStudents.map((student, idx) => {
                const rowBg = idx % 2 === 0 ? "bg-[#0f0f0f]" : "bg-[#151515]";
                return (
                  <tr key={student.id} className={`${rowBg} border-b border-white/5 hover:bg-[#1a1a1a] transition-colors align-middle text-[11px]`}>
                    {/* 1열 고정 학생명 */}
                    <td className="py-1 px-1.5 border-r border-white/5 font-black text-gray-200 sticky left-0 bg-inherit z-20 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                      <div className="leading-none py-1">
                        <span className="truncate max-w-[80px] text-[11px]" title={student.name}>{student.isSpecialClass ? `${student.electiveCourse?.subject?.trim() || '특강'}-` : ''}{student.name}</span>
                      </div>
                    </td>

                    {/* 2열 이후 체크/메모 */}
                    {topics.map(t => {
                      const cellData = items[student.id]?.[t.id] || { is_checked: false, memo: '' };
                      return (
                        <React.Fragment key={`${student.id}-${t.id}`}>
                          {/* 체크 상태 순환 셀 */}
                          <td className="py-1 px-2 border-r border-white/5 text-center">
                            <button 
                              onClick={() => handleCycleStatus(student.id, t.id, cellData)}
                              className="inline-flex items-center justify-center p-0.5 rounded hover:bg-white/5 transition-all cursor-pointer animate-fade-in"
                              title="클릭하여 상태 순환 (공란 -> 완료 -> 보류 -> 제외)"
                            >
                              {renderStatusIcon(cellData.status)}
                            </button>
                          </td>
                          {/* 메모 입력 셀 */}
                          <td className="py-0.5 px-1.5 border-r border-white/5 align-middle">
                            <input 
                              type="text"
                              defaultValue={cellData.memo}
                              onBlur={(e) => handleSaveMemo(student.id, t.id, e.target.value, cellData)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              placeholder="-"
                              className="w-full bg-transparent border border-transparent hover:border-white/10 focus:border-blue-500 focus:bg-[#1a1a1a] rounded-[2px] px-1 py-0.5 text-[10px] font-bold text-gray-300 outline-none transition-all"
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
              <tr className="bg-[#121212] border-t border-white/5 font-bold text-[11px] text-gray-400 align-middle sticky bottom-0 z-10 shadow-[0_-2px_5px_rgba(0,0,0,0.2)]">
                <td className="py-2.5 px-1.5 border-r border-white/5 font-black sticky left-0 bg-[#121212] z-20 shadow-[2px_0_5px_rgba(0,0,0,0.2)] text-center text-gray-500">
                  완료 인원
                </td>
                {topics.map(t => {
                  const checkedCount = getCheckedCount(t.id);
                  return (
                    <React.Fragment key={`sum-${t.id}`}>
                      <td className="py-2 px-2 border-r border-white/5 text-center font-black text-green-400 bg-green-500/5">
                        {checkedCount}명
                      </td>
                      <td className="py-2 px-2.5 border-r border-white/5"></td>
                    </React.Fragment>
                  );
                })}
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <ChecklistPrintPreviewModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        students={displayStudents}
        selectedDate={academyInfo?.selectedDate || new Date().toISOString().split('T')[0]}
        academyInfo={academyInfo}
        topics={topics}
        items={items}
      />
    </div>
  );
});

ChecklistTab.displayName = 'ChecklistTab';
