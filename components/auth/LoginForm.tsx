'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function LoginForm({ academy }: { academy: any }) {
  const { slug } = useParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academy) {
      alert('학원 정보가 없습니다. 관리자에게 문의하세요.');
      return;
    }
    setIsLoading(true);

    try {
      // 1. 원장님 관리자 모드 체크 (ID: admin, PW: academy.admin_password)
      if (username === 'admin' && password === academy.admin_password) {
        console.log('Admin Master Login successful');
        setIsLoading(false);
        router.push(`/${slug}/dashboard`);
        return;
      }

      // 2. 개별 선생님 로그인 체크 (ams_teachers 테이블 조회)
      const { data: teacher, error } = await supabase
        .from('ams_teachers')
        .select('*')
        .eq('academy_id', academy.id)
        .eq('login_id', username)
        .eq('password', password) // 💡 나중에는 Hash 암호화 비교로 업그레이드 필요
        .single();

      if (teacher) {
        console.log('Teacher Login successful:', teacher.name);
        setIsLoading(false);
        router.push(`/${slug}/dashboard`);
      } else {
        alert('ID 또는 비밀번호가 올바르지 않습니다.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('로그인 처리 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-[#111111]/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2 uppercase">
          {academy?.academy_name || 'Hokma'}
        </h1>
        <p className="text-gray-400 text-sm">{academy?.welcome_message || 'Teacher Management Portal'}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
            Teacher ID / admin
          </label>
...
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
            <input 
              type="text"
              placeholder="Enter your ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
            Password
          </label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
            <input 
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Sign In
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-8 border-t border-white/5 text-center">
        <p className="text-gray-500 text-xs">
          Forgot your credentials? Please contact the administrator.
        </p>
      </div>
    </motion.div>
  );
}
