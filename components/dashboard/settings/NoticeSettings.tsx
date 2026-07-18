'use client';

import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';

interface NoticeSettingsProps {
  academyInfo: any;
  isAdmin: boolean;
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
  noticeDrafts: Record<string, string>;
  onNoticeDraftChange: (key: string, value: string) => void;
  isLight?: boolean;
}

export default function NoticeSettings({ 
  academyInfo, 
  isAdmin, 
  onUpdateAcademyInfo, 
  noticeDrafts, 
  onNoticeDraftChange,
  isLight = false
}: NoticeSettingsProps) {
  
  const announcements = academyInfo?.announcements || {};
  
  // 💡 하위 호환성: 만약 단일 텍스트(text)가 없는데 기존 3개 데이터가 존재하면 합쳐서 초기값으로 설정
  const getUnifiedValue = () => {
    if (noticeDrafts.text !== undefined) {
      return noticeDrafts.text;
    }
    if (announcements.text) {
      return announcements.text;
    }
    const parts = [];
    if (announcements.monthly) parts.push(`[이번 달 주안점] ${announcements.monthly}`);
    if (announcements.weekly) parts.push(`[이번 주 목표] ${announcements.weekly}`);
    if (announcements.daily) parts.push(`[오늘의 한마디] ${announcements.daily}`);
    return parts.join('\n\n');
  };

  const currentValue = getUnifiedValue();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-3xl mx-auto"
    >
      <div className={`border p-6 rounded-lg space-y-6 ${
        isLight 
          ? 'bg-white border-gray-200 shadow-sm' 
          : 'bg-[#0f0f0f] border-white/10'
      }`}>
        <div className="border-b border-dashed pb-3 flex items-center justify-between">
          <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isLight ? 'text-gray-700' : 'text-white'}`}>
            <MessageSquare size={16} className="text-amber-500" />
            📢 학원 공지 및 전달사항 설정
          </h3>
          {isAdmin && (
            <p className="text-[9px] text-gray-500 italic">
              * 입력 후 바깥을 클릭(포커스 아웃)하면 실시간으로 저장 및 반영됩니다.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <textarea 
            id="notice-unified-text"
            readOnly={!isAdmin}
            value={currentValue}
            onChange={(e) => onNoticeDraftChange('text', e.target.value)}
            onBlur={async (e) => {
              if (!isAdmin || !onUpdateAcademyInfo) return;
              const val = e.target.value;
              if (val === announcements.text) return;

              // 💡 announcements.text 필드에 통째로 저장
              await onUpdateAcademyInfo({ announcements: { ...announcements, text: val } });
            }}
            placeholder={isAdmin ? "전체 선생님들께 전달할 공지나 오늘 수업 브리핑 내용을 자유롭게 적어주세요." : '원장님이 작성한 공지가 여기에 표시됩니다.'}
            rows={12}
            className={`w-full border rounded-[4px] px-4 py-3 text-[12px] font-bold outline-none transition-all resize-none leading-relaxed ${
              isLight
                ? 'bg-gray-50/50 border-gray-250 text-gray-800 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500'
                : 'bg-black/40 border-white/10 text-gray-250 focus:border-amber-500 focus:bg-black/60'
            } ${!isAdmin ? 'cursor-default opacity-70' : ''}`}
          />
        </div>
      </div>
    </motion.div>
  );
}
