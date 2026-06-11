'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, TrendingUp, MessageSquare, AlertCircle, CheckCircle2, 
  X, ChevronRight, User, ClipboardCheck
} from 'lucide-react';
import { Student } from '@/types/dashboard';

interface MorningBriefingModalProps {
  academyInfo: any;
  todayStudents: Student[];
  allStudents?: Student[]; // 💡 추가
  onClose: () => void;
}

export default function MorningBriefingModal({ academyInfo, todayStudents, allStudents = [], onClose }: MorningBriefingModalProps) {
  const [mounted, setMounted] = useState(false);
  const announcements = academyInfo?.announcements || {};
  
  // 💡 오늘 등원생 중 주의사항(management_notes)이 있는 학생들 필터링
  const specialCareStudents = todayStudents.filter(s => s.management_notes?.trim());

  // 💡 [추가] 필수 학생 정보가 누락된 재원생 필터링
  const missingInfoStudents = allStudents.filter(s => {
    if (s.is_deleted) return false;
    const missing: string[] = [];
    if (!s.phone?.trim()) missing.push('연락처');
    if (!s.school?.trim()) missing.push('학교');
    if (!s.course?.trim()) missing.push('코스');
    if (!s.teacher_id) missing.push('담당 선생님');
    if (!s.class_days || s.class_days.length === 0) missing.push('수업 요일');
    
    if (missing.length > 0) {
      (s as any).missingFields = missing;
      return true;
    }
    return false;
  });

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0f0f0f] border border-white/10 rounded-[4px] w-full max-w-4xl shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/10 p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
              <Calendar className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Morning Briefing</h2>
              <p className="text-[10px] text-blue-400/60 font-black uppercase tracking-[0.3em] mt-0.5">Strategy & Special Care Today</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar-v p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 왼쪽: 학원 전체 공지 (원장님 전략) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2 px-1">
              <ClipboardCheck size={16} className="text-blue-500" />
              <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Academy Strategy</h3>
            </div>
            
            <div className="grid gap-4">
              {[
                { label: '이번 달 주안점', key: 'monthly', icon: <Calendar size={14} />, color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
                { label: '이번 주 목표', key: 'weekly', icon: <TrendingUp size={14} />, color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
                { label: '오늘의 한마디', key: 'daily', icon: <MessageSquare size={14} />, color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' }
              ].filter(item => announcements[item.key]?.trim()).map(item => (
                <div key={item.key} className={`${item.color} border rounded-[4px] p-5 flex flex-col gap-2 shadow-sm`}>
                  <div className="flex items-center gap-2 opacity-60">
                    {item.icon}
                    <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                  </div>
                  <p className="text-[13px] font-bold leading-relaxed whitespace-pre-wrap">
                    {announcements[item.key]}
                  </p>
                </div>
              ))}

              {/* 💡 모든 공지가 없을 경우 안내 */}
              {Object.values(announcements).every(v => !String(v).trim()) && (
                <div className="py-12 text-center border border-dashed border-white/5 rounded-[4px] bg-white/[0.01]">
                  <MessageSquare size={24} className="text-gray-800 mx-auto mb-2 opacity-20" />
                  <p className="text-[10px] text-gray-700 font-black uppercase tracking-widest">No active notices</p>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 요주의 학생 명단 & 누락 정보 알림 */}
          <div className="lg:col-span-5 space-y-6 flex flex-col">
            {/* 1. 요주의 학생 명단 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <AlertCircle size={16} className="text-amber-500" />
                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Special Care Required</h3>
              </div>

              <div className="space-y-3 max-h-[25vh] overflow-y-auto custom-scrollbar-v pr-1">
                {specialCareStudents.length > 0 ? (
                  specialCareStudents.map((s, idx) => (
                    <div key={s.id || idx} className="bg-white/5 border border-white/5 rounded-[4px] p-4 group hover:bg-white/[0.08] transition-all">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-black text-white">{s.name}</span>
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">{s.grade}</span>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50" />
                      </div>
                      <p className="text-[11px] font-bold text-amber-200/60 leading-relaxed italic whitespace-pre-wrap">
                        "{s.management_notes}"
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center border border-dashed border-white/5 rounded-[4px]">
                    <CheckCircle2 size={24} className="text-gray-700 mx-auto mb-2 opacity-20" />
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">No critical alerts today</p>
                  </div>
                )}
              </div>
            </div>

            {/* 2. 학생 정보 입력 누락 알림 */}
            {missingInfoStudents.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 px-1">
                  <AlertCircle size={16} className="text-rose-500 animate-pulse" />
                  <h3 className="text-[11px] font-black text-rose-400 uppercase tracking-widest">⚠️ Student Info Missing</h3>
                </div>

                <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar-v pr-1">
                  {missingInfoStudents.map((s, idx) => {
                    const missingFields = (s as any).missingFields || [];
                    return (
                      <div key={s.id || idx} className="bg-rose-950/10 border border-rose-500/10 rounded-[4px] p-3.5 group hover:bg-rose-950/20 transition-all">
                        <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-rose-500/5">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-black text-rose-200">{s.name}</span>
                            <span className="text-[9px] font-bold text-rose-400/60 uppercase tracking-tighter">{s.grade || '학년 미지정'}</span>
                          </div>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-black uppercase">누락</span>
                        </div>
                        <p className="text-[10px] font-bold text-rose-300/70 leading-relaxed">
                          누락 항목: <span className="text-rose-400 font-extrabold">{missingFields.join(', ')}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex items-center justify-between gap-4">
          <p className="text-[10px] text-gray-600 font-medium">
            * 이 브리핑은 매일 첫 로그인 시 1회 노출됩니다.
          </p>
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-10 py-4 bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-[2px] shadow-2xl shadow-blue-900/40 hover:bg-blue-500 hover:scale-[1.02] transition-all active:scale-95"
          >
            오늘 수업 시작하기 <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
