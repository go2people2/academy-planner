import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Plus, Loader2, CheckSquare, AlertTriangle, MinusSquare, Square, GripVertical, Archive, ArchiveRestore, Search } from 'lucide-react';
import ChecklistPrintPreviewModal from '../todaySheet/ChecklistPrintPreviewModal';

interface ChecklistTabLightProps {
  students: any[];
  allStudents?: any[];
  academyInfo: any;
  selectedFilter?: string;
  selectedTeacherId?: string;
}

export const ChecklistTabLight = forwardRef<any, ChecklistTabLightProps>(({ 
  students, 
  allStudents = [], 
  academyInfo, 
  selectedFilter = 'All', 
  selectedTeacherId = 'All' 
}, ref) => {
  const [topics, setTopics] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, Record<string, any>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');

  const [archivedTopicIds, setArchivedTopicIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined' && academyInfo?.id) {
      const saved = localStorage.getItem(`ams_checklist_archived_topics_${academyInfo.id}`);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && academyInfo?.id) {
      localStorage.setItem(`ams_checklist_archived_topics_${academyInfo.id}`, JSON.stringify(archivedTopicIds));
    }
  }, [archivedTopicIds, academyInfo?.id]);
  const [draggedTopicId, setDraggedTopicId] = useState<string | null>(null);

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

    // 5) 가나다 순으로 깔끔하게 정렬
    if (showAllDays) {
      return filtered.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
    return filtered;
  }, [students, allStudents, showAllDays, selectedFilter, selectedTeacherId, activeChecklistFilter, items]);

  const activeTopics = useMemo(() => {
    return topics.filter(t => !t.title?.startsWith('[ARCHIVED]') && !archivedTopicIds.includes(t.id));
  }, [topics, archivedTopicIds]);

  const archivedTopics = useMemo(() => {
    return topics.filter(t => t.title?.startsWith('[ARCHIVED]') || archivedTopicIds.includes(t.id));
  }, [topics, archivedTopicIds]);

  const searchedArchivedTopics = useMemo(() => {
    if (!archiveSearchQuery.trim()) return archivedTopics;
    const query = archiveSearchQuery.trim().toLowerCase();
    return archivedTopics.filter(t => {
      const cleanTitle = t.title.replace(/^\[ARCHIVED\]\s*/, '');
      return cleanTitle.toLowerCase().includes(query);
    });
  }, [archivedTopics, archiveSearchQuery]);

  const handleArchiveTopic = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const cleanTitle = topic.title.replace(/^\[ARCHIVED\]\s*/, '');
    if (confirm(`📦 "${cleanTitle}" 체크 항목을 보관함으로 이동하시겠습니까?\n메인 체크리스트 표에서는 즉시 숨겨지며 언제든지 보관함에서 복구할 수 있습니다.`)) {
      setArchivedTopicIds(prev => [...prev, topicId]);
      if (!topic.title.startsWith('[ARCHIVED]')) {
        const newTitle = `[ARCHIVED] ${topic.title}`;
        setTopics(prev => prev.map(t => t.id === topicId ? { ...t, title: newTitle } : t));
        try {
          await supabase.from('ams_checklist_topics').update({ title: newTitle }).eq('id', topicId);
        } catch (e) {
          console.error('Archive DB Update Error:', e);
        }
      }
    }
  };

  const handleRestoreTopic = async (topicId: string) => {
    setArchivedTopicIds(prev => prev.filter(id => id !== topicId));
    const topic = topics.find(t => t.id === topicId);
    if (topic && topic.title.startsWith('[ARCHIVED]')) {
      const cleanTitle = topic.title.replace(/^\[ARCHIVED\]\s*/, '');
      setTopics(prev => prev.map(t => t.id === topicId ? { ...t, title: cleanTitle } : t));
      try {
        await supabase.from('ams_checklist_topics').update({ title: cleanTitle }).eq('id', topicId);
      } catch (e) {
        console.error('Restore DB Update Error:', e);
      }
    }
  };

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

  // 열 필터 헤 roar 전용 아이콘 렌더링
  const renderColumnFilterIcon = (topicId: string) => {
    const isCurrent = activeChecklistFilter.topicId === topicId;
    const filterStatus = isCurrent ? activeChecklistFilter.status : 'none';

    switch (filterStatus) {
      case 'checked':
        return <CheckSquare className="text-green-600 fill-green-500/10 hover:opacity-80 transition-all cursor-pointer animate-pulse" size={14} strokeWidth={2.5} />;
      case 'hold':
        return <AlertTriangle className="text-amber-600 fill-amber-500/10 hover:opacity-80 transition-all cursor-pointer animate-pulse" size={14} strokeWidth={2.5} />;
      case 'na':
        return <MinusSquare className="text-gray-500 fill-gray-400/10 hover:opacity-80 transition-all cursor-pointer animate-pulse" size={14} strokeWidth={2.5} />;
      case 'empty':
        return <Square className="text-blue-500 fill-blue-500/5 border-blue-400 hover:opacity-80 transition-all cursor-pointer animate-pulse" size={14} strokeWidth={2.5} />;
      default:
        return (
          <div 
            className="w-3.5 h-3.5 rounded-[3px] border border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer flex items-center justify-center text-[8px] font-black text-gray-400 hover:text-blue-600" 
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

    // 1) 로컬 상태 낙관적 갱신
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
      try {
        localStorage.setItem(`ams_checklist_virtual_items_${academyInfo?.id}`, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 2) DB Upsert (status 컬럼이 없는 DB 환경에 대한 방어 fallback 포함)
    try {
      const payload: any = {
        topic_id: topicId,
        student_id: realStudentUuid,
        status: nextStatus,
        is_checked: nextStatus === 'checked',
        memo: currentVal.memo || ''
      };
      if (currentVal.id) payload.id = currentVal.id;

      let { data, error } = await supabase
        .from('ams_checklist_items')
        .upsert([payload], { onConflict: 'student_id,topic_id' })
        .select();

      // 만약 DB에 status 컬럼이 없는 경우(42703), status 제외 후 is_checked 기준 2차 시도
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
      
      // DB 반환 ID 동기화
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
      fetchData(); // 롤백 복구
    }
  };

  // 상태별 아이콘 렌더링 헬퍼
  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'checked':
        return <CheckSquare className="text-green-500 fill-green-50/50 hover:opacity-80 transition-all animate-fade-in" size={16} strokeWidth={2.5} />;
      case 'hold':
        return <AlertTriangle className="text-amber-500 fill-amber-50/50 hover:opacity-80 transition-all animate-fade-in" size={16} strokeWidth={2.5} />;
      case 'na':
        return <MinusSquare className="text-gray-400 fill-gray-50/50 hover:opacity-80 transition-all animate-fade-in" size={16} strokeWidth={2.5} />;
      default:
        return <div className="w-4 h-4 rounded-[3px] border border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 transition-all" />;
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
    if ((currentVal.memo || '') === nextMemo) return; // 변경점 없으면 취소

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
      const payload: any = {
        topic_id: topicId,
        student_id: realStudentUuid,
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
        <span className="text-xs font-bold text-[#37352f]/60">체크리스트 정보 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 컨트롤 영역 */}
      <div className="flex justify-between items-center bg-[#fcfcfc] border border-[#edece9] p-3 rounded-[3px] shadow-sm">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-[12px] font-black text-[#37352f]">📋 실시간 진척도 체크리스트</h4>
          <p className="text-[9px] text-[#37352f]/50 font-bold">학생 개별로 기말고사, 오답노트, 안내문 수거 등의 완료 현황을 기록하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 새 항목 추가 폼 (상단 툴바 통합) */}
          <div className="flex items-center gap-1.5 mr-1 bg-[#fbfbfa] border border-[#edece9] p-1 rounded-[3px]">
            <input
              type="text"
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTopic();
              }}
              placeholder="예: 6월 모의고사 오답노트"
              className="bg-white border border-[#edece9] text-[#37352f] px-2 py-1 text-[11px] rounded-[2px] outline-none focus:border-blue-500 w-44 font-bold"
            />
            <button
              onClick={handleAddTopic}
              disabled={isAddingTopic || !newTopicTitle.trim()}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-[2px] text-[10px] font-black hover:bg-blue-500 disabled:bg-gray-300 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
            >
              {isAddingTopic ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              추가
            </button>
          </div>

          {/* 보관함 버튼 */}
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-[10px] font-black border border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 transition-all shadow-md cursor-pointer"
            title="보관 처리된 체크리스트 항목들을 확인 및 복구합니다."
          >
            <Archive size={12} />
            📦 보관함 ({archivedTopics.length})
          </button>

          {/* 필터 전체 해제 버튼 */}
          {activeChecklistFilter.topicId !== null && (
            <button
              onClick={() => setActiveChecklistFilter({ topicId: null, status: 'none' })}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] text-[10px] font-black border border-red-500/30 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-md cursor-pointer animate-fade-in"
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
                : 'bg-white hover:bg-[#edece9] border-[#edece9] text-gray-500'
            }`}
            title="오늘 요일 외의 모든 학생들을 체크리스트 명단에 소환합니다."
          >
            <CheckSquare size={12} className={showAllDays ? "animate-pulse" : ""} />
            다른 요일 학생 포함
          </button>
        </div>
      </div>

      {/* 테이블 래퍼 */}
      <div className="border border-[#edece9] rounded-[3px] bg-white overflow-auto shadow-sm max-h-[calc(100vh-280px)] custom-scrollbar-h custom-scrollbar-v relative">
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
            <tr className="border-b border-[#edece9] bg-[#fcfcfc] text-[#37352f]/50 uppercase tracking-widest text-[9.5px] font-black sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <th rowSpan={2} className="py-3 px-3 border-r border-[#edece9] text-left sticky left-0 top-0 bg-[#fcfcfc] z-50 shadow-[2px_2px_5px_rgba(0,0,0,0.03)] group relative">
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
                  className={`py-2.5 px-3 border-r border-[#edece9] text-center group relative cursor-grab active:cursor-grabbing transition-colors ${
                    draggedTopicId === t.id ? 'bg-blue-50 border-blue-300' : ''
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mr-2">
                    <GripVertical size={13} className="text-gray-400 hover:text-gray-700 shrink-0 cursor-grab active:cursor-grabbing" />
                    {/* 전역 열 필터 버튼 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCycleColumnFilter(t.id); }}
                      className="inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-100 transition-all cursor-pointer"
                      title="클릭하여 이 열의 체크 상태 기준 필터링 순환"
                    >
                      {renderColumnFilterIcon(t.id)}
                    </button>
                    <span className="text-[#37352f] text-[11px] font-black text-center break-all leading-tight" title={t.title}>
                      {t.title}
                    </span>
                    {/* 보관 버튼 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleArchiveTopic(t.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                      title="체크 항목 보관함으로 이동"
                    >
                      <Archive size={11} strokeWidth={2.5} />
                    </button>
                    {/* 삭제 버튼 */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTopic(t.id); }} 
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-500 hover:bg-red-50 transition-all cursor-pointer"
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
            <tr className="border-b border-[#edece9] bg-[#fcfcfc] text-[#37352f]/40 uppercase tracking-widest text-[8.5px] font-black sticky top-[37px] z-30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              {activeTopics.map(t => (
                <React.Fragment key={`sub-${t.id}`}>
                  <th className="py-1.5 px-2 border-r border-[#edece9] text-center">완료</th>
                  <th className="py-1.5 px-2 border-r border-[#edece9] text-left">메모 / 특이사항</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>

          <tbody>
            {displayStudents.length === 0 ? (
              <tr>
                <td colSpan={1 + activeTopics.length * 2 + 1} className="py-12 text-center text-xs text-[#37352f]/40 font-bold italic">
                  필터링된 학생이 존재하지 않습니다.
                </td>
              </tr>
            ) : (
              displayStudents.map((student, idx) => {
                const rowBg = idx % 2 === 0 ? "bg-white" : "bg-[#fbfbfa]";
                return (
                  <tr key={student.id} className={`${rowBg} border-b border-[#edece9] hover:bg-[#f5f5f4] transition-colors align-middle text-[11px]`}>
                    {/* 1열 고정 학생명 */}
                    <td className="py-1 px-1.5 border-r border-[#edece9] font-black text-[#37352f] sticky left-0 bg-inherit z-20 shadow-[2px_0_5px_rgba(0,0,0,0.015)]">
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
                          <td className="py-1 px-2 border-r border-[#edece9] text-center">
                            <button 
                              onClick={() => handleCycleStatus(student, t.id, cellData)}
                              className="inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-100 transition-all cursor-pointer animate-fade-in"
                              title="클릭하여 상태 순환 (공란 -> 완료 -> 보류 -> 제외)"
                            >
                              {renderStatusIcon(cellData.status)}
                            </button>
                          </td>
                          {/* 메모 입력 셀 */}
                          <td className="py-0.5 px-1.5 border-r border-[#edece9] align-middle">
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
                              className="w-full bg-transparent border border-transparent hover:border-[#edece9] focus:border-blue-500 focus:bg-white rounded-[2px] px-1 py-0.5 text-[10px] font-bold text-[#37352f] outline-none transition-all"
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
              <tr className="bg-[#fcfcfc] border-t border-[#edece9] font-bold text-[11px] text-[#37352f]/60 align-middle sticky bottom-0 z-10 shadow-[0_-2px_5px_rgba(0,0,0,0.02)]">
                <td className="py-2.5 px-1.5 border-r border-[#edece9] font-black sticky left-0 bg-[#fcfcfc] z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)] text-center text-[#37352f]/50">
                  완료 인원
                </td>
                {activeTopics.map(t => {
                  const checkedCount = getCheckedCount(t.id);
                  return (
                    <React.Fragment key={`sum-${t.id}`}>
                      <td className="py-2 px-2 border-r border-[#edece9] text-center font-black text-green-600 bg-green-50/10">
                        {checkedCount}명
                      </td>
                      <td className="py-2 px-2.5 border-r border-[#edece9]"></td>
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
        topics={activeTopics}
        items={items}
      />

      {/* 📦 보관함 모달 */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#edece9] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-[#edece9] bg-[#fbfbfa]">
              <div className="flex items-center gap-2">
                <Archive size={16} className="text-amber-600" />
                <h3 className="text-sm font-black text-[#37352f]">📦 체크 항목 보관함</h3>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  총 {archivedTopics.length}개 보관됨
                </span>
              </div>
              <button
                onClick={() => setIsArchiveModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 검색창 */}
            <div className="p-3 border-b border-[#edece9] bg-[#fcfcfc]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={archiveSearchQuery}
                  onChange={(e) => setArchiveSearchQuery(e.target.value)}
                  placeholder="보관된 체크 항목 검색..."
                  className="w-full bg-white border border-[#edece9] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#37352f] placeholder-gray-400 outline-none focus:border-amber-500 font-bold"
                />
              </div>
            </div>

            {/* 보관 항목 리스트 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar-v">
              {searchedArchivedTopics.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 font-bold">
                  {archiveSearchQuery.trim() ? '검색어와 일치하는 보관 항목이 없습니다.' : '보관함이 비어 있습니다.'}
                </div>
              ) : (
                searchedArchivedTopics.map((topic) => {
                  return (
                    <div
                      key={topic.id}
                      className="flex items-center justify-between p-3 bg-[#fbfbfa] border border-[#edece9] rounded-lg hover:border-amber-400/50 transition-all group"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-black text-[#37352f]">
                          {topic.title.replace(/^\[ARCHIVED\]\s*/, '')}
                        </span>
                        <span className="text-[9.5px] font-bold text-gray-400">
                          생성일: {new Date(topic.created_at || Date.now()).toLocaleDateString('ko-KR')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreTopic(topic.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white border border-amber-200 rounded text-[10px] font-black transition-all shadow-sm cursor-pointer"
                          title="메인 체크리스트 표로 복구합니다"
                        >
                          <ArchiveRestore size={12} />
                          복구
                        </button>
                        <button
                          onClick={() => handleDeleteTopic(topic.id)}
                          className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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

ChecklistTabLight.displayName = 'ChecklistTabLight';
