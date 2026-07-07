'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, TrendingUp, MessageSquare, 
  X, ChevronRight, ClipboardCheck
} from 'lucide-react';
import { Student } from '@/types/dashboard';

interface MorningBriefingModalProps {
  academyInfo: any;
  todayStudents: Student[];
  allStudents?: Student[];
  onClose: () => void;
}

export default function MorningBriefingModalLight({ academyInfo, onClose }: MorningBriefingModalProps) {
  const [mounted, setMounted] = useState(false);
  const announcements = academyInfo?.announcements || {};
  
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white border border-[#e3e2e0] rounded-lg w-full max-w-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 p-6 flex items-center justify-between border-b border-[#e3e2e0]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
              <Calendar className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-blue-900 uppercase tracking-tight">Today Briefing</h2>
              <p className="text-[10px] text-blue-600/70 font-black uppercase tracking-[0.3em] mt-0.5">Academy Strategy & Notices</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 바디 (1단 구성) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-v p-8 space-y-6 bg-white">
          <div className="flex items-center gap-2 px-1">
            <ClipboardCheck size={16} className="text-blue-600" />
            <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Academy Strategy</h3>
          </div>
          
          <div className="grid gap-4">
            {[
              { label: '이번 달 주안점', key: 'monthly', icon: <Calendar size={14} />, color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
              { label: '이번 주 목표', key: 'weekly', icon: <TrendingUp size={14} />, color: 'bg-blue-50 border-blue-200 text-blue-800' },
              { label: '오늘의 한마디', key: 'daily', icon: <MessageSquare size={14} />, color: 'bg-amber-50 border-amber-200 text-amber-800' }
            ].filter(item => announcements[item.key]?.trim()).map(item => (
              <div key={item.key} className={`${item.color} border rounded-lg p-5 flex flex-col gap-2 shadow-sm`}>
                <div className="flex items-center gap-2 opacity-75">
                  {item.icon}
                  <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                </div>
                <p className="text-[13px] font-bold leading-relaxed whitespace-pre-wrap text-gray-800">
                  {announcements[item.key]}
                </p>
              </div>
            ))}

            {/* 모든 공지가 없을 경우 안내 */}
            {Object.values(announcements).every(v => !String(v).trim()) && (
              <div className="py-12 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                <MessageSquare size={24} className="text-gray-400 mx-auto mb-2 opacity-55" />
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">No active notices</p>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t border-[#e3e2e0] bg-gray-50 flex items-center justify-between gap-4">
          <p className="text-[10px] text-gray-500 font-medium">
            * 이 브리핑은 매일 첫 로그인 시 1회 노출됩니다.
          </p>
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-10 py-4 bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-md shadow-md shadow-blue-200/50 hover:bg-blue-500 hover:scale-[1.02] transition-all active:scale-95"
          >
            오늘 수업 시작하기 <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
