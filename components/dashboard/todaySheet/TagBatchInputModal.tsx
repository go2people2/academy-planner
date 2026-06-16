'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tags, Save } from 'lucide-react';
import { Student } from '@/types/dashboard';

interface TagBatchInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onBatchSave: (updates: { studentId: string, newData: any, prevData: any }[]) => Promise<void>;
}

const TARGET_COLUMNS = [
  { id: 'test_id', label: '오늘TEST' },
  { id: 'homework_text', label: '오늘숙제' },
  { id: 'mission', label: '학생미션' },
  { id: 'next_quiz_text', label: '다음테스트' },
];

export const TagBatchInputModal: React.FC<TagBatchInputModalProps> = ({
  isOpen, onClose, students, onBatchSave
}) => {
  const [mounted, setMounted] = useState(false);
  const [targetCol, setTargetCol] = useState('test_id');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showStudents, setShowStudents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // 화면에 띄울 태그 그룹들 계산
  const tagGroups = useMemo(() => {
    // 가, 나, 다, 라 그룹은 무조건 화면에 나오도록 기본 할당 (학생 0명이어도 표시)
    const groups: Record<string, Student[]> = {
      '가': [],
      '나': [],
      '다': [],
      '라': [],
    };
    
    students.forEach(s => {
      const tag = s.level_tag || '미지정';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(s);
    });

    // 가, 나, 다, 라 순 정렬 후, 그 외 태그, '미지정'은 맨 끝으로
    const sortedTags = Object.keys(groups).sort((a, b) => {
      if (a === '미지정') return 1;
      if (b === '미지정') return -1;
      
      const predefined = ['가', '나', '다', '라'];
      const aIndex = predefined.indexOf(a);
      const bIndex = predefined.indexOf(b);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      return a.localeCompare(b);
    });

    return sortedTags.map(tag => ({
      tag,
      students: groups[tag],
    }));
  }, [students]);

  // 모달 열릴 때마다 입력창 초기화 및 ESC 이벤트 등록
  useEffect(() => {
    if (isOpen) {
      setInputs({});
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, targetCol, onClose]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      const updates: { studentId: string, newData: any, prevData: any }[] = [];
      
      tagGroups.forEach(group => {
        const text = inputs[group.tag]?.trim() || '';
        if (text) {
          group.students.forEach(s => {
            updates.push({
              studentId: s.id,
              newData: { [targetCol]: text },
              prevData: s.todaySession || {}
            });
          });
        }
      });

      if (updates.length > 0) {
        await onBatchSave(updates);
      }
      
      onClose();
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const getTagColor = (tag: string) => {
    if (tag === '가') return "bg-emerald-500/20 text-emerald-300 font-black border-emerald-400/80";
    if (tag === '나') return "bg-blue-500/20 text-blue-300 font-black border-blue-400/80";
    if (tag === '다') return "bg-amber-500/20 text-amber-300 font-black border-amber-400/80";
    if (tag === '라') return "bg-red-500/20 text-red-300 font-black border-red-400/80";
    if (tag === '미지정') return "bg-white/5 text-gray-500 border-white/10";
    return "bg-indigo-500/20 text-indigo-300 font-black border-indigo-400/80"; // 기본 자유 태그 색상
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-2xl bg-[#0a0a0a] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <Tags className="text-indigo-400" size={16} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-white tracking-tight">태그별 일괄 입력</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">현재 화면의 학생 {students.length}명을 태그별로 분류하여 일괄 입력합니다.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-white/10 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar-h">
            
            {/* Target Column Selector */}
            <div className="bg-[#111] border border-white/5 rounded-lg p-3">
              <label className="block text-[12px] font-bold text-gray-300 mb-2 ml-1">입력할 칸 선택</label>
              <div className="grid grid-cols-4 gap-2">
                {TARGET_COLUMNS.map(col => (
                  <button
                    key={col.id}
                    onClick={() => setTargetCol(col.id)}
                    className={`w-full py-2 rounded-md text-[12px] font-bold transition-all ${
                      targetCol === col.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 border border-blue-500' 
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-white/10'
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag Input Rows */}
            <div className="space-y-2">
              {tagGroups.map((group) => (
                <div key={group.tag} className="flex gap-3 items-center bg-white/[0.02] border border-white/5 p-3 rounded-lg">
                  {/* Tag Label Info */}
                  <div className="w-24 shrink-0 flex flex-col gap-2">
                    <div>
                      <div className={`min-w-[32px] h-[32px] px-1 rounded-[6px] border text-[15px] font-black inline-flex items-center justify-center shadow-sm ${getTagColor(group.tag)}`}>
                        {group.tag}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pl-0.5 mt-0.5">
                      <div className="text-[10px] text-gray-400 font-medium">
                        {group.students.length}명
                      </div>
                      {group.students.length > 0 && (
                        <button 
                          onClick={() => setShowStudents(prev => ({ ...prev, [group.tag]: !prev[group.tag] }))}
                          className="text-[9px] text-blue-400 hover:text-blue-300 underline underline-offset-2"
                        >
                          {showStudents[group.tag] ? '숨기기' : '명단보기'}
                        </button>
                      )}
                    </div>
                    {showStudents[group.tag] && (
                      <div className="text-[12px] text-gray-200 font-medium leading-relaxed bg-black/60 p-2 rounded border border-white/10 mt-1.5 max-h-32 overflow-y-auto custom-scrollbar-h">
                        {group.students.map(s => s.name).join(', ')}
                      </div>
                    )}
                  </div>
                  
                  {/* Textarea */}
                  <div className="flex-1 min-w-0">
                    <textarea
                      placeholder={`${group.tag} 태그 학생들에게 일괄 적용할 내용을 입력하세요.`}
                      value={inputs[group.tag] || ''}
                      onChange={(e) => setInputs(prev => ({ ...prev, [group.tag]: e.target.value }))}
                      className="w-full h-10 bg-black border border-white/10 rounded-md p-2 text-[12px] text-white placeholder:text-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none transition-all custom-scrollbar-h"
                    />
                  </div>
                </div>
              ))}
              {tagGroups.length === 0 && (
                <div className="text-center py-10 text-gray-500 text-[13px]">
                  현재 화면에 학생이 없습니다.
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-white/10 bg-white/[0.02]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[12px] font-bold text-gray-400 hover:text-white transition-colors"
            >
              취소 (ESC)
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || tagGroups.length === 0 || Object.values(inputs).every(v => !v.trim())}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-[12px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/30"
            >
              {isSaving ? (
                <span className="animate-pulse">저장 중...</span>
              ) : (
                <>
                  <Save size={14} />
                  일괄 저장하기
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
