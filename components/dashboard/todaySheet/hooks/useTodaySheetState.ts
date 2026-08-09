import { useState, useEffect, useCallback } from 'react';
import { ColumnConfig, DEFAULT_COLUMNS } from '../types';

export interface UseTodaySheetStateProps {
  currentUser?: any;
}

export function useTodaySheetState({ currentUser }: UseTodaySheetStateProps = {}) {
  const [showAllTools, setShowAllTools] = useState(false);
  const [isToolsEditMode, setIsToolsEditMode] = useState(false);
  const [toolsOrder, setToolsOrder] = useState<string[]>(() => {
    const defaultOrder = ['timeshift', 'profile', 'history', 'progress', 'separator', 'tag', 'portal', 'reset', 'delete'];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_tools_order');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            if (!parsed.includes('timeshift')) {
              return ['timeshift', ...parsed];
            }
            return parsed;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return defaultOrder;
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

  const [activeTab, setActiveTab] = useState<'daily' | 'checklist'>('daily');
  const [historyLimit, setHistoryLimit] = useState(3);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_history_limit');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) setHistoryLimit(parsed);
      }
    }
  }, []);

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

  useEffect(() => {
    if (isSettingsOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsSettingsOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSettingsOpen]);

  const [expandedHistory, setExpandedHistory] = useState<Record<string, number>>({});
  const [isSendingReport, setIsSendingReport] = useState<string | null>(null);
  const [isReportVisible, setIsReportVisible] = useState(false);

  return {
    showAllTools,
    setShowAllTools,
    isToolsEditMode,
    setIsToolsEditMode,
    toolsOrder,
    setToolsOrder,
    handleReorderTools,
    activeTab,
    setActiveTab,
    historyLimit,
    setHistoryLimit,
    colWidths,
    setColWidths,
    presets,
    setPresets,
    activeSet,
    setActiveSet,
    isSettingsOpen,
    setIsSettingsOpen,
    expandedHistory,
    setExpandedHistory,
    isSendingReport,
    setIsSendingReport,
    isReportVisible,
    setIsReportVisible,
  };
}
