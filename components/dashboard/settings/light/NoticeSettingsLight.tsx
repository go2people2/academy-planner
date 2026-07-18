'use client';

import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';

interface NoticeSettingsProps {
  academyInfo: any;
  isAdmin: boolean;
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
  noticeDrafts: Record<string, string>;
  onNoticeDraftChange: (key: string, value: string) => void;
}

export default function NoticeSettingsLight({ academyInfo, isAdmin, onUpdateAcademyInfo, noticeDrafts, onNoticeDraftChange }: NoticeSettingsProps) {
  const announcements = academyInfo?.announcements || {};

  const getUnifiedValue = () => {
    if (noticeDrafts.text !== undefined) return noticeDrafts.text;
    if (announcements.text) return announcements.text;
    const parts = [];
    if (announcements.monthly) parts.push(`[이번 달 주안점] ${announcements.monthly}`);
    if (announcements.weekly) parts.push(`[이번 주 목표] ${announcements.weekly}`);
    if (announcements.daily) parts.push(`[오늘의 한마디] ${announcements.daily}`);
    return parts.join('\n\n');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6 shadow-sm">
        <div className="border-b border-dashed border-gray-200 pb-3 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
            <MessageSquare size={16} className="text-amber-500" />
            📢 학원 공지 및 전달사항 설정
          </h3>
          {isAdmin && (
            <p className="text-[9px] text-gray-400 italic">
              * 입력 후 바깥을 클릭하면 실시간으로 저장 및 반영됩니다.
            </p>
          )}
        </div>

        <textarea
          id="notice-unified-text-light"
          readOnly={!isAdmin}
          value={getUnifiedValue()}
          onChange={(e) => onNoticeDraftChange('text', e.target.value)}
          onBlur={async (e) => {
            if (!isAdmin || !onUpdateAcademyInfo) return;
            const val = e.target.value;
            if (val === announcements.text) return;
            await onUpdateAcademyInfo({ announcements: { ...announcements, text: val } });
          }}
          placeholder={isAdmin ? '전체 선생님들께 전달할 공지나 오늘 수업 브리핑 내용을 자유롭게 적어주세요.' : '원장님이 작성한 공지가 여기에 표시됩니다.'}
          rows={12}
          className={`w-full border rounded-[4px] px-4 py-3 text-[12px] font-bold outline-none transition-all resize-none leading-relaxed bg-gray-50/50 border-gray-200 text-gray-800 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 ${!isAdmin ? 'cursor-default opacity-70' : ''}`}
        />
      </div>
    </motion.div>
  );
}
