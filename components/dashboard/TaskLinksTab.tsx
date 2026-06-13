'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Check, Trash2, ExternalLink, User, Loader2, Sparkles, X, Edit2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getTodayStr } from '@/lib/utils';

interface TaskLinksTabProps {
  academyInfo: any;
  tasks: any[];
  teachers: any[];
  currentUser: any;
  onRefreshTasks: () => Promise<void>;
}

export default function TaskLinksTab({
  academyInfo,
  tasks,
  teachers,
  currentUser,
  onRefreshTasks
}: TaskLinksTabProps) {
  const [showOnlyMyLinks, setShowOnlyMyLinks] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLinkTask, setEditingLinkTask] = useState<any | null>(null);
  
  // Link Form States
  const [linkTitle, setLinkTitle] = useState('');
  const [linkContent, setLinkContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkAssignee, setLinkAssignee] = useState(currentUser?.id || '');
  const [isSaving, setIsSaving] = useState(false);

  // Filter and parse link tasks
  const linkTasks = React.useMemo(() => {
    return tasks
      .filter(task => {
        if (task.type !== 'link') return false;
        if (showOnlyMyLinks && task.created_by !== currentUser?.id) return false;
        return true;
      })
      .map(task => {
        let textContent = task.content || '';
        let url = '';
        
        // Try parsing JSON format
        if (typeof task.content === 'string' && task.content.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(task.content);
            textContent = parsed.text || '';
            url = parsed.link || '';
          } catch (e) {
            // fallback
            textContent = task.content;
          }
        }
        
        return {
          ...task,
          textContent,
          url
        };
      });
  }, [tasks, showOnlyMyLinks, currentUser]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim() || !academyInfo?.id) return;

    setIsSaving(true);
    try {
      // Ensure URL starts with http:// or https://
      let formattedUrl = linkUrl.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const newLinkTask = {
        academy_id: academyInfo.id,
        title: linkTitle.trim(),
        content: JSON.stringify({ text: linkContent.trim(), link: formattedUrl }),
        start_date: getTodayStr(),
        target_date: '9999-12-31', // 상시 업무 기한으로 약속된 미래 날짜
        display_period_type: 'custom',
        is_completed: false,
        created_by: linkAssignee || currentUser?.id || '',
        type: 'link'
      };

      const { error } = await supabase
        .from('ams_tasks')
        .insert([newLinkTask]);

      if (error) throw error;

      setLinkTitle('');
      setLinkContent('');
      setLinkUrl('');
      setLinkAssignee(currentUser?.id || '');
      setIsLinkModalOpen(false);
      await onRefreshTasks();
    } catch (err) {
      console.error('Error adding link task:', err);
      alert('링크 업무 등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingLinkTask(null);
    setLinkTitle('');
    setLinkContent('');
    setLinkUrl('');
    setLinkAssignee(currentUser?.id || '');
    setIsLinkModalOpen(true);
  };

  const handleOpenEditModal = (task: any) => {
    setEditingLinkTask(task);
    setLinkTitle(task.title);
    setLinkUrl(task.url);
    setLinkContent(task.textContent);
    setLinkAssignee(task.created_by);
    setIsLinkModalOpen(true);
  };

  const handleEditLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim() || !academyInfo?.id || !editingLinkTask) return;

    setIsSaving(true);
    try {
      let formattedUrl = linkUrl.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const { error } = await supabase
        .from('ams_tasks')
        .update({
          title: linkTitle.trim(),
          content: JSON.stringify({ text: linkContent.trim(), link: formattedUrl }),
          created_by: linkAssignee || currentUser?.id || ''
        })
        .eq('id', editingLinkTask.id);

      if (error) throw error;

      setLinkTitle('');
      setLinkContent('');
      setLinkUrl('');
      setLinkAssignee(currentUser?.id || '');
      setEditingLinkTask(null);
      setIsLinkModalOpen(false);
      await onRefreshTasks();
    } catch (err) {
      console.error('Error editing link task:', err);
      alert('링크 업무 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLinkTask) {
      handleEditLink(e);
    } else {
      handleAddLink(e);
    }
  };

  const handleToggleLink = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('ams_tasks')
        .update({ is_completed: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      await onRefreshTasks();
    } catch (err) {
      console.error('Error toggling link task status:', err);
      alert('상태 변경에 실패했습니다.');
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm('이 링크 업무를 완전히 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase
        .from('ams_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await onRefreshTasks();
    } catch (err) {
      console.error('Error deleting link task:', err);
      alert('삭제에 실패했습니다.');
    }
  };

  const handleOpenLink = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="absolute inset-0 flex flex-col space-y-4 overflow-hidden">
      {/* Header controls */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            업무 구글 시트 / 링크 ({linkTasks.length}개)
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={showOnlyMyLinks}
              onChange={(e) => setShowOnlyMyLinks(e.target.checked)}
              className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
            />
            <span className="text-[10px] font-black text-gray-400 hover:text-white transition-all uppercase tracking-wider">
              내 담당 링크만 보기
            </span>
          </label>
        </div>
        
        <button 
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-black hover:bg-blue-500 transition-all shadow-md shadow-blue-600/10"
        >
          <Plus size={14} /> 새 링크 등록
        </button>
      </div>

      {/* Grid of Link Cards */}
      <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 custom-scrollbar-v align-start content-start">
        {linkTasks.map((task) => {
          const assignee = teachers.find(t => t.id === task.created_by);
          return (
            <motion.div 
              key={task.id}
              layout
              className={`group relative flex flex-col justify-between border rounded-xl p-3 bg-[#0a0a0a] transition-all ${
                task.is_completed ? 'border-emerald-500/20 opacity-60' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className={`text-sm font-black leading-tight ${task.is_completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                    {task.title}
                  </h4>
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleToggleLink(task.id, task.is_completed)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                        task.is_completed 
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                          : 'border-white/20 hover:border-blue-500 hover:text-blue-500'
                      }`}
                      title="완료 처리"
                    >
                      <Check size={10} strokeWidth={4} />
                    </button>

                    <button 
                      onClick={() => handleOpenEditModal(task)}
                      className="w-5 h-5 rounded-full flex items-center justify-center border border-white/10 text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100"
                      title="수정"
                    >
                      <Edit2 size={10} />
                    </button>

                    <button 
                      onClick={() => handleDeleteLink(task.id)}
                      className="w-5 h-5 rounded-full flex items-center justify-center border border-white/10 text-gray-500 hover:border-rose-500 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                      title="완전 삭제"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
                
                <p className={`text-xs leading-relaxed ${task.is_completed ? 'text-gray-600' : 'text-gray-400'}`}>
                  {task.textContent || '링크에 대한 세부 설명이 없습니다.'}
                </p>
              </div>

              {/* Lower Section */}
              <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-col gap-2">
                {/* Link button */}
                <button
                  onClick={() => handleOpenLink(task.url)}
                  disabled={!task.url}
                  className={`w-full py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-black transition-all ${
                    task.is_completed
                      ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                      : 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 active:scale-95 shadow-md shadow-indigo-900/10'
                  }`}
                >
                  <ExternalLink size={13} />
                  <span>구글 시트 / 링크 열기</span>
                </button>

                {/* Footer assignee */}
                <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <User size={12} />
                    <span>{assignee?.nickname || assignee?.name || '지정되지 않음'}</span>
                  </div>
                  <div className="px-2 py-0.5 rounded-[4px] uppercase font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    상시
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {linkTasks.length === 0 && (
          <div className="col-span-full h-64 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-gray-500 gap-2">
            <Sparkles size={24} className="text-gray-600" />
            <span className="text-xs font-bold">등록된 업무 링크가 없습니다. 새 링크를 등록해 보세요.</span>
          </div>
        )}
      </div>

      {/* CREATE LINK MODAL */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f0f] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl relative"
            >
              <button 
                onClick={() => { setIsLinkModalOpen(false); setEditingLinkTask(null); }}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-all"
              >
                <X size={20} />
              </button>

              <h3 className="text-base font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                {editingLinkTask ? (
                  <>
                    <Edit2 size={18} className="text-blue-500" /> 업무 링크 수정
                  </>
                ) : (
                  <>
                    <Plus size={18} className="text-blue-500" /> 새 업무 링크 등록
                  </>
                )}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">업무 링크 제목</label>
                  <input 
                    type="text" 
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    required
                    placeholder="예: 초등부 단원 평가 관리 시트"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">구글 시트 / URL 주소</label>
                  <input 
                    type="text" 
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    required
                    placeholder="예: docs.google.com/spreadsheets/d/..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">세부 내용 (설명)</label>
                  <textarea 
                    value={linkContent}
                    onChange={(e) => setLinkContent(e.target.value)}
                    rows={2}
                    placeholder="업무 설명 및 관련 숙지 사항 입력"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                {/* 담당 강사 칩 선택 UX */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">담당 선생님</label>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1 custom-scrollbar-v">
                    {teachers.map(t => {
                      const isSelected = linkAssignee === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setLinkAssignee(t.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black transition-all ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black uppercase ${
                            isSelected ? 'bg-white text-blue-600' : 'bg-white/10 text-gray-300'
                          }`}>
                            {(t.nickname || t.name || '?')[0]}
                          </div>
                          <span>{t.nickname || t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => { setIsLinkModalOpen(false); setEditingLinkTask(null); }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5"
                  >
                    {isSaving && <Loader2 size={12} className="animate-spin" />}
                    <span>{editingLinkTask ? '수정' : '등록'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
