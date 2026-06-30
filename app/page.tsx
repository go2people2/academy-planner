'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { School, ArrowRight, Loader2, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Academy {
  id: string;
  slug: string;
  academy_name: string;
}

export default function Home() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAcademies = async () => {
      try {
        const { data, error } = await supabase
          .from('ams_academies')
          .select('id, slug, academy_name')
          .order('academy_name', { ascending: true });

        if (error) throw error;
        setAcademies(data || []);
      } catch (err) {
        console.error('Failed to load academies:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAcademies();
  }, []);

  return (
    <div className="relative min-h-screen bg-[#050505] text-white flex flex-col justify-between p-6 overflow-hidden">
      {/* 백그라운드 디자인 글로우 효과 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none select-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none select-none" />

      {/* 헤더/네임스페이스 */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-4 shrink-0 z-10 border-b border-white/5">
        <span className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase font-sans">Hokmanote Gateway Portal</span>
      </div>

      {/* 메인 콘텐츠 허브 */}
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-12 flex-grow z-10 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-indigo-500 bg-clip-text text-transparent mb-3 uppercase">
            Hokmanote Portal
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 font-bold uppercase tracking-wider">
            학습 일지 및 OMR 기출문제 관리 시스템
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">등록된 학원 정보 조회 중...</span>
          </div>
        ) : academies.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] border border-white/5 p-8 rounded-xl max-w-md">
            <p className="text-sm text-gray-400 font-bold">등록된 학원 정보가 없습니다.</p>
            <p className="text-[10px] text-gray-600 font-bold mt-1">시스템 관리국에 학원 개설 요청을 문의하세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {academies.map((ac, idx) => (
              <motion.div
                key={ac.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
              >
                <Link
                  href={`/${ac.slug}/login`}
                  className="flex items-center justify-between p-5 bg-[#111111]/60 backdrop-blur-xl border border-white/10 rounded-lg hover:border-blue-500/40 hover:bg-blue-500/[0.02] transition-all group shadow-xl active:scale-[0.98] block"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                      <School size={20} />
                    </div>
                    <div className="flex flex-col text-left">
                      <h4 className="text-sm font-bold text-white tracking-wide group-hover:text-blue-400 transition-colors">
                        {ac.academy_name}
                      </h4>
                      <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5 tracking-wider">
                        Domain: /{ac.slug}
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1.5 transition-all duration-300" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 푸터 게이트웨이 */}
      <div className="w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between py-6 gap-3 shrink-0 z-10 border-t border-white/5 text-[9px] font-bold text-gray-600 uppercase tracking-wider font-sans">
        <span>© Hokmanote. All Rights Reserved.</span>
        <Link 
          href="/master" 
          className="flex items-center gap-1 hover:text-white transition-colors py-1 px-2.5 bg-white/[0.02] border border-white/5 rounded-full"
        >
          <Settings size={10} /> System Master Login
        </Link>
      </div>
    </div>
  );
}
