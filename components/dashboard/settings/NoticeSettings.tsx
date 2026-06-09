'use client';

import { motion } from 'framer-motion';
import { Calendar, TrendingUp, MessageSquare } from 'lucide-react';

interface NoticeSettingsProps {
  academyInfo: any;
  isAdmin: boolean;
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
  noticeDrafts: Record<string, string>;
  onNoticeDraftChange: (key: string, value: string) => void;
}

function NoticeItem({ item, isAdmin, onUpdateAcademyInfo, value, onDraftChange, announcements }: { 
  item: any, isAdmin: boolean, onUpdateAcademyInfo: any, value: string, onDraftChange: any, announcements: any 
}) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-[4px] p-5 space-y-4">
      <div className="flex items-center gap-2">
        {item.icon}
        <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{item.label}</h4>
      </div>
      <textarea 
        id={`notice-${item.key}`}
        readOnly={!isAdmin}
        value={value}
        onChange={(e) => onDraftChange(item.key, e.target.value)}
        onBlur={async (e) => {
          if (!isAdmin || !onUpdateAcademyInfo) return;
          const val = e.target.value;
          if (val === announcements[item.key]) return;

          await onUpdateAcademyInfo({ announcements: { [item.key]: val } });
        }}
        placeholder={isAdmin ? item.placeholder : '원장님이 작성한 공지가 여기에 표시됩니다.'}
        className={`w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-3 text-[12px] font-bold text-gray-300 outline-none transition-all min-h-[120px] resize-none leading-relaxed ${isAdmin ? 'focus:border-amber-500' : 'cursor-default opacity-70'}`}
      />
      {isAdmin && <p className="text-[8px] text-gray-600 italic">* 입력 후 바깥을 클릭하면 전체 교사에게 즉시 공유됩니다.</p>}
    </div>
  );
}

export default function NoticeSettings({ academyInfo, isAdmin, onUpdateAcademyInfo, noticeDrafts, onNoticeDraftChange }: NoticeSettingsProps) {
  const notices = [
    { key: 'monthly', label: '이번 달 주안점', icon: <Calendar className="text-emerald-400" size={16} />, placeholder: '예: 오답 정밀 분석 및 개별 클리닉 강화' },
    { key: 'weekly', label: '이번 주 목표', icon: <TrendingUp className="text-blue-400" size={16} />, placeholder: '예: 교재 마무리 및 단원평가 실시 주간' },
    { key: 'daily', label: '오늘의 한마디', icon: <MessageSquare className="text-amber-400" size={16} />, placeholder: '예: 아이들 등원 시 밝은 미소로 맞이해 주세요!' }
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {notices.map((item) => (
          <NoticeItem 
            key={item.key} 
            item={item} 
            announcements={academyInfo?.announcements || {}} 
            value={noticeDrafts[item.key] || ''}
            isAdmin={isAdmin} 
            onUpdateAcademyInfo={onUpdateAcademyInfo} 
            onDraftChange={onNoticeDraftChange}
          />
        ))}
      </div>
    </motion.div>
  );
}
