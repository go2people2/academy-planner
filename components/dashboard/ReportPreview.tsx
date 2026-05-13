'use client';

import { motion } from 'framer-motion';
import { 
  LayoutGrid, Share2, AlertCircle, Check, Send, Loader2 
} from 'lucide-react';
import { Student } from '@/types/dashboard';

interface ReportPreviewProps {
  students: Student[];
  selectedDate: string;
  academyInfo: any;
  isSendingReport: string | null;
  handleSendIndividual: (id: string) => Promise<void>;
}

export default function ReportPreview({ 
  students, selectedDate, academyInfo, isSendingReport, handleSendIndividual 
}: ReportPreviewProps) {
  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="flex-1 space-y-4 pt-6 border-t border-white/10 min-h-0 flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-2 mb-2 shrink-0">
        <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <LayoutGrid size={18} className="text-amber-500" /> KakaoTalk Report Preview
        </h3>
        <div className="flex gap-5">
          <span className="flex items-center gap-2 text-[11px] font-black uppercase text-gray-600"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Ready</span>
          <span className="flex items-center gap-2 text-[11px] font-black uppercase text-gray-600"><div className="w-2.5 h-2.5 rounded-full bg-white/20" /> Sent</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar-v pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-5 pb-20 px-2 text-center">
          {students.map((s: any, idx: number) => {
            const session = s.todaySession;
            const hasData = session && (session.classwork_text || session.homework_text || session.test_id);
            const isSent = !!session?.report_sent_at;

            return (
              <div key={`${s.id}-${idx}`} className="flex flex-col gap-2.5 w-full max-w-[220px] mx-auto group text-center">
                <div className={`w-full aspect-[9/16] bg-[#bacee0] rounded-[28px] p-2.5 shadow-xl border-[4px] border-[#1a1a1a] relative overflow-hidden flex flex-col transition-all duration-300 ${!hasData ? 'opacity-30' : 'group-hover:translate-y-[-4px] group-hover:shadow-2xl'}`}>
                  <div className="flex justify-between items-center px-4 pt-1 pb-1.5 shrink-0">
                    <span className="text-[8px] font-black text-[#1a1a1a]/40">12:30</span>
                    <div className="flex gap-0.5"><div className="w-1.5 h-1.5 rounded-full bg-[#1a1a1a]/20" /><div className="w-1.5 h-1.5 rounded-full bg-[#1a1a1a]/20" /></div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar-v pr-0.5 space-y-4 min-h-0 text-center">
                    <div className="flex justify-center shrink-0">
                      <span className="bg-[#1a1a1a]/10 text-[#1a1a1a]/60 text-[7px] px-2 py-1 rounded-full font-bold">{selectedDate.replace(/-/g, '.')}</span>
                    </div>

                    <div className="flex items-start gap-1.5 text-left">
                      <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm border border-white/10"><Share2 size={14} /></div>
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <p className="text-[10px] font-black text-[#1a1a1a]/70 ml-0.5 truncate">{academyInfo?.academy_name || 'Hokma Math'}</p>
                        <div className={`bg-[#FEE500] rounded-tr-lg rounded-b-lg p-2.5 shadow-sm border border-[#e0cb00]/50 relative ${isSent ? 'grayscale-[0.5] opacity-80' : ''}`}>
                          <div className="border-b border-[#1a1a1a]/10 pb-2 mb-2 flex justify-between items-center">
                            <h4 className="text-[10px] font-extrabold text-[#1a1a1a] flex items-center gap-1"><AlertCircle size={10} className="text-[#1a1a1a]/60" /> 알림톡</h4>
                            {isSent && <Check size={10} className="text-blue-600 font-black" />}
                          </div>
                          {hasData ? (
                            <div className="space-y-2.5">
                              <p className="text-[11px] font-black text-[#1a1a1a] mb-0.5 text-center">[학습 리포트]</p>
                              <div className="space-y-2 text-[10px] font-bold text-[#1a1a1a]/80 leading-tight">
                                <p className="text-center">안녕하세요, <span className="text-blue-700 font-black">{s.name}</span> 학생 수업 내용입니다.</p>
                                <div className="bg-white/40 p-2 rounded-md space-y-1.5 border border-black/5 text-[9px] text-left">
                                  <p>📚 <span className="text-black/60 font-black">진도:</span> {session.classwork_text || '-'}</p>
                                  <p>🏠 <span className="text-black/60 font-black">과제:</span> {session.homework_text || '-'}</p>
                                  {(session.test_id || session.test_score) && (
                                    <p>📝 <span className="text-black/60 font-black">테스트:</span> {session.test_id} {session.test_score ? `(${session.test_score}%)` : ''}</p>
                                  )}
                                  {session.next_quiz_text && (
                                    <div className="flex flex-col">
                                      <p>🔔 <span className="text-black/60 font-black">예정:</span> {session.next_quiz_text}</p>
                                      <p className="ml-5 text-[8px] text-indigo-700/70 font-black italic">
                                        (목표: 오답 {session.next_quiz_cut || 0}개 이하 통과)
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="py-6 text-center"><p className="text-[10px] font-bold text-[#1a1a1a]/40 uppercase tracking-widest italic">Waiting...</p></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="h-0.5 w-14 bg-[#1a1a1a]/20 rounded-full mx-auto mt-2 mb-0.5 shrink-0" />
                </div>
                <button 
                  onClick={() => handleSendIndividual(s.id)}
                  disabled={!hasData || isSent || isSendingReport !== null}
                  className={`w-full py-3 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all flex items-center justify-center gap-2 shadow-xl ${
                    isSent ? 'bg-white/5 text-gray-600' : 
                    hasData ? 'bg-[#FEE500] text-[#1a1a1a] hover:brightness-95 active:scale-95' : 
                    'bg-white/5 text-gray-800'
                  }`}
                >
                  {isSendingReport === s.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  {isSent ? '전송 완료' : '발송하기'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
