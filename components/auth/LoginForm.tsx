'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function LoginForm({ academy }: { academy: any }) {
  const { slug } = useParams();
  const [loginType, setLoginType] = useState<'teacher' | 'student'>('teacher');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  if (!academy) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111]/80 backdrop-blur-xl border border-red-500/20 p-10 rounded-[4px] shadow-2xl text-center space-y-6"
      >
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
          <Lock size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-black text-white uppercase tracking-tight">Unregistered Access</h1>
          <p className="text-gray-400 text-xs leading-relaxed">
            죄송합니다. <span className="text-red-400 font-bold">[{slug}]</span> 슬러그로 등록된 학원을 찾을 수 없습니다.<br/>
            주소를 다시 확인하거나 관리자에게 문의해 주세요.
          </p>
        </div>
        <button 
          onClick={() => window.location.href = '/'}
          className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-[2px] transition-all"
        >
          Back to Main
        </button>
      </motion.div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (loginType === 'teacher') {
        // 1. 원장님 관리자 모드 체크 (ID: admin, PW: academy.admin_password)
        if (username === 'admin' && password === academy.admin_password) {
          localStorage.setItem('ams_user', JSON.stringify({
            role: 'admin',
            id: 'admin',
            name: '원장님'
          }));
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
          .eq('password', password)
          .single();

        if (teacher) {
          localStorage.setItem('ams_user', JSON.stringify({
            role: 'teacher',
            id: teacher.id,
            name: teacher.name
          }));
          setIsLoading(false);
          router.push(`/${slug}/dashboard`);
        } else {
          alert('ID 또는 비밀번호가 올바르지 않습니다.');
          setIsLoading(false);
        }
      } else {
        // 3. 학생 로그인 체크 (ams_students 테이블 조회)
        const { data: student, error } = await supabase
          .from('ams_students')
          .select('*')
          .eq('academy_id', academy.id)
          .eq('name', studentName)
          .like('phone', `%${phoneLast4}`)
          .single();

        if (student) {
          localStorage.setItem('ams_student', JSON.stringify(student));
          setIsLoading(false);
          router.push(`/${slug}/student`);
        } else {
          alert('학생 정보를 찾을 수 없습니다. 이름과 전화번호 뒷자리를 확인해 주세요.');
          setIsLoading(false);
        }
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
      className="bg-[#111111]/80 backdrop-blur-xl border border-white/10 p-8 rounded-[4px] shadow-2xl"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2 uppercase">
          {academy.academy_name}
        </h1>
        <p className="text-gray-400 text-sm">{academy.welcome_message || 'Academy Management System'}</p>
      </div>

      {/* 탭 전환 */}
      <div className="flex mb-8 bg-black/40 p-1 rounded-[2px] border border-white/5">
        <button 
          onClick={() => setLoginType('teacher')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${loginType === 'teacher' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}
        >
          Teacher / Admin
        </button>
        <button 
          onClick={() => setLoginType('student')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${loginType === 'student' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}
        >
          Student Portal
        </button>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {loginType === 'teacher' ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Teacher ID / admin
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                <input 
                  type="text"
                  placeholder="Enter your ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-[2px] py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
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
                  className="w-full bg-black/40 border border-white/5 rounded-[2px] py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                  required
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Student Name (이름)
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                <input 
                  type="text"
                  placeholder="성함을 입력하세요"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-[2px] py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Phone Last 4 Digits (번호 뒷자리)
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                <input 
                  type="text"
                  maxLength={4}
                  placeholder="전화번호 뒷자리 4자리"
                  value={phoneLast4}
                  onChange={(e) => setPhoneLast4(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-black/40 border border-white/5 rounded-[2px] py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600 tabular-nums"
                  required
                />
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-[2px] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {loginType === 'teacher' ? 'Sign In' : 'Enter Student Portal'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-8 border-t border-white/5 text-center">
        <p className="text-gray-500 text-xs">
          {loginType === 'teacher' ? 'Forgot your credentials? Please contact the administrator.' : '로그인에 어려움이 있다면 학원 선생님께 문의해 주세요.'}
        </p>
      </div>
    </motion.div>
  );
}
