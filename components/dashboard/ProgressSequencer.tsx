'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, BookOpen, FileText, CheckCircle, Play, Settings, Loader2
} from 'lucide-react';
import { Student } from '@/types/dashboard';

interface ProgressSequencerProps {
  students: Student[];
  masterTextbooks: any[];
}

export default function ProgressSequencer({ students, masterTextbooks }: ProgressSequencerProps) {
  const [activeStudentId, setActiveStudentId] = useState<string | null>(students[0]?.id || null);
  const activeStudent = students.find(s => s.id === activeStudentId);

  return (
    <div className="flex h-full overflow-hidden bg-[#050505]">
      {/* Track Selector (Left) */}
      <div className="w-52 border-r border-white/10 flex flex-col h-full bg-[#0a0a0a] z-20">
        <div className="p-5 border-b border-white/10 bg-white/[0.02] font-black text-[9px] uppercase text-blue-500 tracking-widest italic flex items-center justify-between">
          <span>Tracks</span>
          <Users size={12} />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {students.map(s => (
            <div key={s.id} onClick={() => setActiveStudentId(s.id)} className={`p-4 border-b border-white/[0.05] cursor-pointer transition-all relative ${activeStudentId === s.id ? 'bg-blue-600/20' : 'hover:bg-white/[0.03]'}`}>
              {activeStudentId === s.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]" />}
              <p className={`font-black text-[11px] mb-0.5 ${activeStudentId === s.id ? 'text-white' : 'text-gray-500'}`}>{s.name}</p>
              <p className="text-[9px] text-gray-600 font-bold uppercase">{s.grade} · {s.class}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline (Right) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {activeStudent ? (
          <>
            <div className="h-14 border-b border-white/10 bg-[#0d0d0d] flex items-center px-8 justify-between z-10 shadow-xl">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-black text-[10px] uppercase tracking-wider text-white">{activeStudent.name}&apos;s Master Sequence</span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-10 space-y-12 relative bg-[#080808] custom-scrollbar">
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundSize: '40px 40px', backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)' }} />
              {activeStudent.assigned_books.map((tabName, i) => (
                <ProgressTrack key={i} tabName={tabName} student={activeStudent} masterTextbooks={masterTextbooks} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-800 uppercase font-black tracking-[0.5em]">Select track</div>
        )}
      </div>
    </div>
  );
}

function ProgressTrack({ tabName, student, masterTextbooks }: any) {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const textbook = masterTextbooks.find((m:any) => m.tabName === tabName);

  useEffect(() => {
    fetch(`/api/textbooks/${tabName}`).then(res => res.json()).then(data => { setUnits(data); setLoading(false); });
  }, [tabName]);

  const historyPages = useMemo(() => student.allLogs.flatMap((log:any) => log.homework_json).filter((h:any) => h.book_name === tabName).flatMap((h:any) => {
    const [s, e] = h.range.split('-').map(Number);
    return (s && e) ? Array.from({length: e-s+1}, (_, i) => s+i) : [];
  }), [student.allLogs, tabName]);

  return (
    <div className="space-y-5 relative z-10">
      <div className="flex items-center gap-3 bg-white/[0.03] w-fit pr-6 pl-2 py-1.5 rounded-xl border border-white/5 shadow-inner">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg"><BookOpen size={16} /></div>
        <div className="flex flex-col">
          <h3 className="font-black text-[12px] text-white tracking-tight leading-none mb-1">{textbook?.title || tabName}</h3>
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{tabName}</span>
        </div>
      </div>
      
      <div className="flex gap-4 overflow-x-auto pb-8 custom-scrollbar-h px-1">
        {loading ? (
          <div className="flex gap-4">{Array.from({length: 6}).map((_, i) => <div key={i} className="min-w-[220px] h-36 rounded-2xl bg-white/[0.02] border border-white/10 animate-pulse" />)}</div>
        ) : (
          units.map((u, idx) => {
            const unitName = u[0];
            const startP = Number(u[1]); 
            const endP = Number(u[2]);
            const isDone = historyPages.some((p:number) => p >= startP && p <= endP);
            const isPlaying = !isDone && historyPages.some((p:number) => Math.abs(p - startP) < 20);
            
            return (
              <motion.div 
                key={idx} 
                whileHover={{ scale: 1.02, y: -4 }} 
                className={`min-w-[220px] h-36 rounded-2xl border flex flex-col relative overflow-hidden transition-all duration-300 ${
                  isDone 
                    ? 'bg-[#1a1a1a] border-blue-500/50 shadow-[0_15px_40px_rgba(37,99,235,0.15)]' 
                    : isPlaying 
                      ? 'bg-[#1a1a1a] border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.15)]' 
                      : 'bg-[#0a0a0a] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="px-5 pt-5 flex justify-between items-center mb-2">
                  <div className={`px-2 py-0.5 rounded text-[8px] font-black italic uppercase tracking-widest ${
                    isDone ? 'bg-blue-500/20 text-blue-400' : isPlaying ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-gray-600'
                  }`}>
                    Unit {String(idx + 1).padStart(2, '0')}
                  </div>
                  {isDone && <CheckCircle size={14} className="text-blue-500 shadow-glow" />}
                  {isPlaying && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
                </div>
                
                <div className="px-5 pb-4 flex-1">
                  <p className={`font-black text-[13px] leading-[1.4] mb-1 line-clamp-2 ${isDone ? 'text-white' : 'text-gray-300'}`}>
                    {unitName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[9px] font-bold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">P.{startP}</span>
                    <div className="w-1 h-[1px] bg-gray-700" />
                    <span className="text-[9px] font-bold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">P.{endP}</span>
                  </div>
                </div>
                
                {/* Progress Bar Bottom */}
                <div className="h-1.5 w-full bg-black/40 flex items-center">
                  <div className={`h-full transition-all duration-1000 ${
                    isDone 
                      ? 'w-full bg-gradient-to-r from-blue-600 to-indigo-500' 
                      : isPlaying 
                        ? 'w-1/3 bg-gradient-to-r from-amber-600 to-orange-500 animate-pulse' 
                        : 'w-0'
                  }`} />
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
