'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ClipboardCheck, Bell, User, LogOut, ChevronRight } from 'lucide-react';

export default function StudentPortal() {
  const [studentInfo, setStudentInfo] = useState<any>({
    name: '김학생',
    grade: '중3',
    class: 'A반'
  });

  const [todayHomework, setTodayHomework] = useState<any[]>([
    { id: 1, book: '쎈 수학', range: 'p.120 ~ p.125', status: 'pending' },
    { id: 2, book: '개념원리', range: '단원 테스트 준비', status: 'completed' }
  ]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] font-sans pb-20">
      {/* 학생 상단 바 */}
      <header className="p-6 flex items-center justify-between bg-[#0a0a0a] border-b border-white/5 sticky top-0 z-20 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <User className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-base font-black text-white">{studentInfo.name} 학생</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{studentInfo.grade} · {studentInfo.class}</p>
          </div>
        </div>
        <button className="p-2 text-gray-500 hover:text-white transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      <main className="p-4 space-y-6 max-w-md mx-auto">
        {/* 공지사항/알림 */}
        <section className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
            <Bell className="text-blue-500" size={20} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-blue-400">학원 공지</h3>
            <p className="text-[11px] text-gray-300 leading-relaxed mt-0.5">이번 주 목요일은 단원 평가가 예정되어 있습니다. 준비해 오세요!</p>
          </div>
        </section>

        {/* 오늘의 과제 섹션 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <BookOpen size={14} /> 오늘의 과제
            </h3>
            <span className="text-[10px] text-blue-500 font-bold">{todayHomework.length}개</span>
          </div>

          <div className="space-y-3">
            {todayHomework.map((hw) => (
              <motion.div 
                key={hw.id}
                whileTap={{ scale: 0.98 }}
                className="bg-[#0f0f0f] border border-white/5 p-4 rounded-2xl flex items-center justify-between group"
              >
                <div>
                  <h4 className="text-[13px] font-bold text-white">{hw.book}</h4>
                  <p className="text-[11px] text-gray-500 mt-1">{hw.range}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  hw.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/10 text-transparent'
                }`}>
                  <ClipboardCheck size={14} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 테스트 입력 버튼 (메인 액션) */}
        <section className="pt-4">
          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 transition-all active:scale-95 text-sm uppercase tracking-wider">
            <ClipboardCheck size={20} />
            테스트 답안 입력하기
          </button>
        </section>
      </main>

      {/* 하단 탭 바 (모바일 최적화) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-2xl border-t border-white/5 px-8 py-4 flex justify-between items-center z-30">
        <div className="flex flex-col items-center gap-1 text-blue-500">
          <BookOpen size={20} />
          <span className="text-[9px] font-bold">Home</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-gray-600 hover:text-gray-400 transition-colors">
          <ClipboardCheck size={20} />
          <span className="text-[9px] font-bold">Tests</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-gray-600 hover:text-gray-400 transition-colors">
          <User size={20} />
          <span className="text-[9px] font-bold">My</span>
        </div>
      </nav>
    </div>
  );
}
