import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useChecklistTab({
  students,
  allStudents = [],
  academyInfo,
  selectedFilter = 'All',
  selectedTeacherId = 'All',
}: {
  students: any[];
  allStudents?: any[];
  academyInfo: any;
  selectedFilter?: string;
  selectedTeacherId?: string;
}) {
  const [topics, setTopics] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, Record<string, any>>>({});
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');

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
    status: string;
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

  const displayStudents = useMemo(() => {
    const baseList = showAllDays 
      ? (allStudents && allStudents.length > 0 ? allStudents : students)
      : students;
    
    let filtered = baseList.filter(s => !s.is_deleted);

    if (selectedFilter && selectedFilter !== 'All') {
      if (selectedFilter.startsWith('Grade-')) {
        const gradeTarget = selectedFilter.replace('Grade-', '');
        filtered = filtered.filter(s => s.grade && s.grade.includes(gradeTarget));
      } else if (selectedFilter.startsWith('Class-')) {
        const classIdTarget = selectedFilter.replace('Class-', '');
        filtered = filtered.filter(s => s.class_id === classIdTarget);
      }
    }

    if (selectedTeacherId && selectedTeacherId !== 'All') {
      filtered = filtered.filter(s => s.teacher_id === selectedTeacherId);
    }

    if (activeChecklistFilter.topicId && activeChecklistFilter.status !== 'none') {
      const targetTopicId = activeChecklistFilter.topicId;
      const targetStatus = activeChecklistFilter.status;

      filtered = filtered.filter(student => {
        const cellData = items[student.id]?.[targetTopicId];
        const studentStatus = cellData?.status || 'none';
        
        if (targetStatus === 'checked') {
          return studentStatus === 'checked' || cellData?.is_checked === true;
        }

        if (targetStatus === 'empty') {
          return studentStatus === 'none' && cellData?.is_checked !== true;
        }

        return studentStatus === targetStatus;
      });
    }

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

  const handleArchiveTopic = useCallback(async (topicId: string) => {
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
  }, [topics]);

  const handleRestoreTopic = useCallback(async (topicId: string) => {
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
  }, [topics]);

  const handleCycleColumnFilter = useCallback((topicId: string) => {
    setActiveChecklistFilter(prev => {
      if (prev.topicId !== topicId) {
        return { topicId, status: 'checked' };
      }
      
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
  }, []);

  return {
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
  };
}
