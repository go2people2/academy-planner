'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Check, Trash2, ExternalLink, User, Loader2, Sparkles, X, Edit2, Globe, Lock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getTodayStr } from '@/lib/utils';
import { useModalEsc } from '@/hooks/useModalEsc';

interface TaskLinksTabProps {
  academyInfo: any;
  tasks: any[];
  teachers: any[];
  currentUser: any;
  onRefreshTasks: () => Promise<void>;
  isLight?: boolean;
}

// Helper to safely parse task content whether string or object
function parseLinkContent(content: any) {
  let textContent = '';
  let url = '';
  let isPrivate = false;

  if (content && typeof content === 'object') {
    textContent = content.text || content.content || '';
    url = content.link || content.url || '';
    isPrivate = !!(content.is_private || content.isPrivate);
  } else if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          textContent = parsed.text || parsed.content || '';
          url = parsed.link || parsed.url || '';
          isPrivate = !!(parsed.is_private || parsed.isPrivate);
        } else {
          textContent = content;
        }
      } catch (e) {
        textContent = content;
      }
    } else {
      textContent = content;
    }
  }

  return { textContent, url, isPrivate };
}

export default function TaskLinksTab({
  academyInfo,
  tasks,
  teachers,
  currentUser,
  onRefreshTasks,
  isLight = false
}: TaskLinksTabProps) {
  const [linkScopeFilter, setLinkScopeFilter] = useState<'all' | 'shared' | 'private'>('all');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLinkTask, setEditingLinkTask] = useState<any | null>(null);

  // Link Form States
  const [linkTitle, setLinkTitle] = useState('');
  const [linkContent, setLinkContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkAssignee, setLinkAssignee] = useState(currentUser?.id || '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 💡 [Esc 닫기 공통 적용]
  useModalEsc({
    isOpen: isLinkModalOpen,
    onClose: () => {
      setIsLinkModalOpen(false);
      setEditingLinkTask(null);
    },
    isSaving
  });

  // Filter and parse link tasks
  const linkTasks = React.useMemo(() => {
    return tasks
      .filter(task => {
        if (task.type !== 'link') return false;

        const { isPrivate: taskIsPrivate } = parseLinkContent(task.content);

        // 보안 규칙: 개인 링크는 오직 작성자 본인(created_by === currentUser.id)에게만 보임
        if (taskIsPrivate && task.created_by !== currentUser?.id) {
          return false;
        }

        // 세그먼트 필터링
        if (linkScopeFilter === 'shared' && taskIsPrivate) return false;
        if (linkScopeFilter === 'private' && !taskIsPrivate) return false;

        return true;
      })
      .map(task => {
        const { textContent, url, isPrivate: taskIsPrivate } = parseLinkContent(task.content);

        return {
          ...task,
          textContent,
          url,
          isPrivate: taskIsPrivate
        };
      });
  }, [tasks, linkScopeFilter, currentUser]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim() || !academyInfo?.id) return;

    setIsSaving(true);
    try {
      let formattedUrl = linkUrl.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }

      // 개인 링크인 경우 작성자를 현재 유저로 지정
      const creatorId = isPrivate ? (currentUser?.id || linkAssignee) : (linkAssignee || currentUser?.id || '');

      const newLinkTask = {
        academy_id: academyInfo.id,
        title: linkTitle.trim(),
        content: JSON.stringify({
          text: linkContent.trim(),
          link: formattedUrl,
          is_private: isPrivate
        }),
        start_date: getTodayStr(),
        target_date: '9999-12-31',
        display_period_type: 'custom',
        is_completed: false,
        created_by: creatorId,
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
      setIsPrivate(false);
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
    setIsPrivate(false);
    setIsLinkModalOpen(true);
  };

  const handleOpenEditModal = (task: any) => {
    setEditingLinkTask(task);
    setLinkTitle(task.title);
    setLinkUrl(task.url);
    setLinkContent(task.textContent);
    setLinkAssignee(task.created_by);
    setIsPrivate(!!task.isPrivate);
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

      // 개인 링크 설정 시 본인 아이디로 created_by를 유지/지정
      const creatorId = isPrivate ? (currentUser?.id || linkAssignee) : (linkAssignee || currentUser?.id || '');

      const { error } = await supabase
        .from('ams_tasks')
        .update({
          title: linkTitle.trim(),
          content: JSON.stringify({
            text: linkContent.trim(),
            link: formattedUrl,
            is_private: isPrivate
          }),
          created_by: creatorId
        })
        .eq('id', editingLinkTask.id);

      if (error) throw error;

      setLinkTitle('');
      setLinkContent('');
      setLinkUrl('');
      setLinkAssignee(currentUser?.id || '');
      setIsPrivate(false);
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
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            업무 구글 시트 / 링크 ({linkTasks.length}개)
          </span>

          {/* 세그먼트 필터 버튼 */}
          <div className={`flex items-center p-1 rounded-xl gap-1 border ${isLight ? 'bg-white border-[#e3e2e0] shadow-sm' : 'bg-white/5 border-white/10'}`}>
            <button
              type="button"
              onClick={() => setLinkScopeFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                linkScopeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-white')
              }`}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setLinkScopeFilter('shared')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                linkScopeFilter === 'shared'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-white')
              }`}
            >
              <Globe size={13} /> 공유 링크
            </button>
            <button
              type="button"
              onClick={() => setLinkScopeFilter('private')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                linkScopeFilter === 'private'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-white')
              }`}
            >
              <Lock size={13} /> 나만 보기 (개인)
            </button>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-all shadow-md shadow-blue-600/10"
        >
          <Plus size={15} /> 새 링크 등록
        </button>
      </div>

      {/* Grid of Link Cards */}
      <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 custom-scrollbar-v align-start content-start">
        {linkTasks.map((task) => {
          const assignee = teachers.find(t => t.id === task.created_by);
          return (
            <motion.div
              key={task.id}
              layout
              className={`group relative flex flex-col justify-between border rounded-2xl p-3.5 transition-all ${
                isLight ? 'bg-white border-[#e3e2e0] shadow-sm hover:border-blue-400' : 'bg-[#0a0a0a] border-white/10 hover:border-white/20'
              } ${task.is_completed ? 'opacity-60' : ''}`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      {task.isPrivate ? (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded shrink-0">
                          <Lock size={9} /> 개인
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded shrink-0">
                          <Globe size={9} /> 공유
                        </span>
                      )}
                    </div>
                    <h4 className={`text-sm font-bold leading-tight ${
                      task.is_completed ? 'text-gray-400 line-through' : (isLight ? 'text-[#37352f]' : 'text-white')
                    }`}>
                      {task.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleLink(task.id, task.is_completed)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                        task.is_completed
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : (isLight ? 'border-gray-300 hover:border-blue-500 hover:text-blue-500' : 'border-white/20 hover:border-blue-500 hover:text-blue-500')
                      }`}
                      title="완료 처리"
                    >
                      <Check size={10} strokeWidth={4} />
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(task)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all opacity-0 group-hover:opacity-100 ${
                        isLight ? 'border-gray-300 text-gray-400 hover:border-blue-500 hover:text-blue-500' : 'border-white/10 text-gray-500 hover:border-blue-500 hover:text-blue-500'
                      }`}
                      title="수정"
                    >
                      <Edit2 size={10} />
                    </button>

                    <button
                      onClick={() => handleDeleteLink(task.id)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all opacity-0 group-hover:opacity-100 ${
                        isLight ? 'border-gray-300 text-gray-400 hover:border-rose-500 hover:text-rose-500' : 'border-white/10 text-gray-500 hover:border-rose-500 hover:text-rose-500'
                      }`}
                      title="완전 삭제"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>

                <p className={`text-xs leading-relaxed ${
                  task.is_completed ? 'text-gray-400 line-through' : (isLight ? 'text-gray-600' : 'text-gray-400')
                }`}>
                  {task.textContent || '링크에 대한 세부 설명이 없습니다.'}
                </p>
              </div>

              {/* Lower Section */}
              <div className={`mt-3.5 pt-2.5 border-t flex flex-col gap-2 ${isLight ? 'border-t-[#e3e2e0]' : 'border-t-white/5'}`}>
                {/* Link button */}
                <button
                  onClick={() => handleOpenLink(task.url)}
                  disabled={!task.url}
                  className={`w-full py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                    task.is_completed
                      ? (isLight ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed')
                      : (isLight ? 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm' : 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 shadow-md')
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
                  <div className={`px-2 py-0.5 rounded-[4px] uppercase font-bold border ${isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                    상시
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {linkTasks.length === 0 && (
          <div className={`col-span-full h-64 border border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 ${isLight ? 'border-[#e3e2e0] bg-white text-gray-400 shadow-sm' : 'border-white/10 text-gray-500'}`}>
            <Sparkles size={24} className={isLight ? "text-blue-500" : "text-gray-600"} />
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
              className={`border w-full max-w-md rounded-2xl p-6 shadow-2xl relative ${
                isLight ? 'bg-white border-[#e3e2e0] text-[#37352f]' : 'bg-[#0f0f0f] border-white/10 text-white'
              }`}
            >
              <button
                onClick={() => { setIsLinkModalOpen(false); setEditingLinkTask(null); }}
                className={`absolute top-4 right-4 transition-all ${isLight ? 'text-gray-400 hover:text-black' : 'text-gray-500 hover:text-white'}`}
              >
                <X size={20} />
              </button>

              <h3 className={`text-base font-black uppercase tracking-wider mb-6 flex items-center gap-2 ${isLight ? 'text-[#37352f]' : 'text-white'}`}>
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
                {/* 공개 범위 선택 */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">공개 범위 설정</label>
                  <div className={`grid grid-cols-2 gap-2 p-1 border rounded-lg ${isLight ? 'bg-gray-50 border-[#e3e2e0]' : 'bg-white/5 border-white/10'}`}>
                    <button
                      type="button"
                      onClick={() => setIsPrivate(false)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-black transition-all ${
                        !isPrivate
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                          : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-white')
                      }`}
                    >
                      <Globe size={14} />
                      <span>🌐 전체 공유</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPrivate(true)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-black transition-all ${
                        isPrivate
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                          : (isLight ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-white')
                      }`}
                    >
                      <Lock size={14} />
                      <span>🔒 나만 보기 (개인)</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">업무 링크 제목</label>
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    required
                    placeholder="예: 초등부 단원 평가 관리 시트"
                    className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-all ${
                      isLight ? 'bg-white border-[#e3e2e0] text-[#37352f] placeholder-gray-400' : 'bg-white/5 border-white/10 text-white placeholder-gray-600'
                    }`}
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
                    className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-all ${
                      isLight ? 'bg-white border-[#e3e2e0] text-[#37352f] placeholder-gray-400' : 'bg-white/5 border-white/10 text-white placeholder-gray-600'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">세부 내용 (설명)</label>
                  <textarea
                    value={linkContent}
                    onChange={(e) => setLinkContent(e.target.value)}
                    rows={2}
                    placeholder="업무 설명 및 관련 숙지 사항 입력"
                    className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-all resize-none ${
                      isLight ? 'bg-white border-[#e3e2e0] text-[#37352f] placeholder-gray-400' : 'bg-white/5 border-white/10 text-white placeholder-gray-600'
                    }`}
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
                              : (isLight ? 'bg-gray-100 border-[#e3e2e0] text-gray-600 hover:bg-gray-200' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white')
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black uppercase ${
                            isSelected ? 'bg-white text-blue-600' : (isLight ? 'bg-gray-200 text-gray-700' : 'bg-white/10 text-gray-300')
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
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      isLight ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
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
