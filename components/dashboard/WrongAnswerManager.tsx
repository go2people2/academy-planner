'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, BookOpen, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import WrongAnswerStudentList from './WrongAnswerStudentList';

interface WrongAnswerManagerProps {
  academyId: string;
  currentUser?: any;
}

// 오답노트 지점별 테마 정의
const THEMES: Record<string, { primary: string; bg: string; ring: string; buttonText?: string }> = {
  navy: { primary: '#1e3a8a', bg: '#f8faff', ring: 'focus:ring-blue-900' },
  default: { primary: '#1e3a8a', bg: '#f8faff', ring: 'focus:ring-blue-900' },
  green: { primary: '#10b981', bg: '#ecfdf5', ring: 'focus:ring-emerald-500' },
  orange: { primary: '#f97316', bg: '#fff7ed', ring: 'focus:ring-orange-500' },
  purple: { primary: '#8b5cf6', bg: '#f5f3ff', ring: 'focus:ring-purple-500' },
  skyblue: { primary: '#0ea5e9', bg: '#f0f9ff', ring: 'focus:ring-sky-500' },
  pink: { primary: '#db2777', bg: '#fdf2f8', ring: 'focus:ring-pink-600' },
  indigo: { primary: '#4f46e5', bg: '#eef2ff', ring: 'focus:ring-indigo-600' },
  rose: { primary: '#e11d48', bg: '#fff1f2', ring: 'focus:ring-rose-600' },
  teal: { primary: '#0d9488', bg: '#f0fdfa', ring: 'focus:ring-teal-600' },
  slate: { primary: '#64748b', bg: '#f1f5f9', ring: 'focus:ring-slate-500' },
  black: { primary: '#000000', bg: '#ffffff', ring: 'focus:ring-black' },
  yellow: { primary: '#451a03', bg: '#fbbf24', ring: 'focus:ring-amber-950' },
  mint: { primary: '#064e3b', bg: '#34d399', ring: 'focus:ring-emerald-950' },
  lime: { primary: '#1a2e05', bg: '#a3e635', ring: 'focus:ring-lime-950' },
  gold: { primary: '#431407', bg: '#f97316', ring: 'focus:ring-orange-950' },
  charcoal: { primary: '#a3e635', bg: '#0f172a', ring: 'focus:ring-lime-400', buttonText: '#0f172a' },
  'coral-navy': { primary: '#fb7185', bg: '#020617', ring: 'focus:ring-rose-400' },
  chalkboard: { primary: '#ffffff', bg: '#064e3b', ring: 'focus:ring-white', buttonText: '#064e3b' }
};

const CATEGORIES_ORDER = [
  '중1-1', '중1-2', '중2-1', '중2-2', '중3-1', '중3-2',
  '공통수학1', '공통수학2', '대수', '미적분1', '미적분2', '확률과 통계', '기하',
  '초5-1', '초5-2', '초6-1', '초6-2'
];

export default function WrongAnswerManager({ academyId, currentUser }: WrongAnswerManagerProps) {
  const [waAcademy, setWaAcademy] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [allBooks, setAllBooks] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingAcademy, setLoadingAcademy] = useState(true); // 💡 무한 로딩 방지용 플래그
  const [errorMsg, setErrorMsg] = useState('');

  // 테마 추출 (지점 slug 기반, 로드 전에는 default 사용)
  const currentTheme = waAcademy && THEMES[waAcademy.theme] ? THEMES[waAcademy.theme] : THEMES.default;
  const themeStyle = {
    text: { color: currentTheme.primary },
    bg: { backgroundColor: currentTheme.bg },
    button: { backgroundColor: currentTheme.primary, color: currentTheme.buttonText || '#ffffff' },
    border: { borderColor: currentTheme.primary },
    ring: { '--tw-ring-color': currentTheme.primary } as React.CSSProperties,
    lightBg: { backgroundColor: currentTheme.primary + '1A' }
  };

  // 💡 [조회] 출석부 지점 ID(ams_academies)의 slug와 매칭되는 오답노트 지점(academies) 정보 로드
  useEffect(() => {
    const loadWaAcademy = async () => {
      if (!academyId) {
        setLoadingAcademy(false);
        return;
      }
      try {
        const { data: amsAc, error: amsErr } = await supabase
          .from('ams_academies')
          .select('slug')
          .eq('id', academyId)
          .maybeSingle();
        
        if (amsErr) throw amsErr;

        if (amsAc) {
          const { data: waAc, error: waErr } = await supabase
            .from('academies')
            .select('*')
            .eq('slug', amsAc.slug)
            .maybeSingle();
          
          if (waErr) throw waErr;

          if (waAc) {
            setWaAcademy(waAc);
            await fetchTeachers(waAc.id);
            await fetchAllBooks(waAc.id);
          } else {
            setErrorMsg(`오답노트 데이터베이스에 해당 지점(slug: ${amsAc.slug}) 정보가 등록되어 있지 않습니다. 관리자에게 등록을 요청하세요.`);
          }
        } else {
          setErrorMsg('학원 정보를 불러올 수 없습니다.');
        }
      } catch (err) {
        console.error('Failed to load WA academy:', err);
        setErrorMsg('오답노트 지점 정보를 불러오는 과정에서 오류가 발생했습니다.');
      } finally {
        setLoadingAcademy(false);
      }
    };
    loadWaAcademy();
  }, [academyId]);

  // 선생님 로드 시 학생 목록 조회
  useEffect(() => {
    if (selectedTeacher && waAcademy) {
      fetchStudents(selectedTeacher.id, waAcademy.id);
    }
  }, [selectedTeacher, waAcademy]);

  const fetchTeachers = async (waAcId: string) => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('academy_id', waAcId)
        .order('name');
      if (error) throw error;
      if (data) {
        // 권한에 따른 교사 필터링
        const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'master';
        if (isAdmin) {
          setTeachers(data);
        } else {
          // 일반 교사는 본인 이름만 필터링
          const filtered = data.filter(t => t.name === currentUser?.name);
          setTeachers(filtered);
          if (filtered.length > 0) {
            setSelectedTeacher(filtered[0]);
          } else {
            setErrorMsg('오답노트에 선생님 정보가 등록되어 있지 않습니다. 관리자에게 문의하세요.');
          }
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('선생님 목록을 불러오지 못했습니다.');
    }
  };

  const fetchStudents = async (teacherId: string, waAcId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_users')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('academy_id', waAcId)
        .order('name');
      if (error) throw error;
      if (data) setStudents(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('학생 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllBooks = async (waAcId: string) => {
    try {
      const { data: catalogData } = await supabase
        .from('problem_catalog')
        .select('book_name, category')
        .eq('academy_id', waAcId);

      if (catalogData) {
        const uniqueBooks: any[] = [];
        const rawCategories = new Set<string>();

        catalogData.forEach(c => {
          if (c.category) rawCategories.add(c.category.trim());
          const trimmedName = c.book_name?.trim();
          if (trimmedName && !uniqueBooks.find(b => b.book_name === trimmedName)) {
            uniqueBooks.push({ book_name: trimmedName, category: c.category?.trim() });
          }
        });

        // 카테고리 정렬 규칙 적용
        const sortedCats = Array.from(rawCategories).sort((a, b) => {
          let idxA = CATEGORIES_ORDER.indexOf(a);
          let idxB = CATEGORIES_ORDER.indexOf(b);
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });

        setAllBooks(uniqueBooks.sort((a, b) => a.book_name.localeCompare(b.book_name, 'ko')));
        setCategories(sortedCats);
      }
    } catch (err) {
      console.error('Error fetching catalog books:', err);
    }
  };

  const handleRefreshStudents = async () => {
    if (selectedTeacher && waAcademy) {
      await fetchStudents(selectedTeacher.id, waAcademy.id);
    }
  };

  if (loadingAcademy) {
    return (
      <div className="p-8 text-center text-gray-500 font-bold">
        <Loader2 className="animate-spin mx-auto mb-4" size={32} />
        <p className="text-xs uppercase tracking-widest font-black">Syncing Wrong Answer Database...</p>
      </div>
    );
  }

  if (!waAcademy) {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto text-slate-800">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between gap-4">
          <h1 className="text-2xl font-black flex items-center gap-2 text-red-600">
            <BookOpen size={24} />
            오답노트 관리
          </h1>
        </div>
        {errorMsg && (
          <div className="p-6 bg-red-50 border border-red-100 rounded-3xl text-red-600 font-bold text-xs space-y-2">
            <p className="text-sm font-black">⚠️ 오답노트 데이터베이스 연동 실패</p>
            <p>{errorMsg}</p>
          </div>
        )}
      </div>
    );
  }

  // 관리자 권한 여부
  const isAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'master';

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto text-slate-800 transition-colors" style={{ color: '#1e293b' }}>
      
      {/* 1. 상단 바 */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2" style={themeStyle.text}>
            <BookOpen size={24} />
            오답노트 관리
          </h1>
          <p className="text-xs text-slate-400 font-black mt-1 uppercase tracking-wider">
            {waAcademy.academy_name} • Student & Textbook Settings
          </p>
        </div>
        <div className="text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl">
          지점 테마: <span className="font-extrabold uppercase" style={themeStyle.text}>{waAcademy.theme}</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 font-bold text-xs">
          {errorMsg}
        </div>
      )}

      {/* 2. 교사 선택 (관리자일 때만 노출) */}
      {isAdminUser && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-sm font-black text-slate-400 mb-4 flex items-center gap-2 italic">
            <Users size={16} />
            Step 1. 담당 선생님 선택
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {teachers.map(teacher => {
              const isActive = selectedTeacher?.id === teacher.id;
              return (
                <button
                  key={teacher.id}
                  onClick={() => {
                    setSelectedTeacher(teacher);
                  }}
                  className={`p-4 rounded-2xl font-black text-xs transition-all ${
                    isActive
                      ? 'text-white shadow-lg scale-105'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                  style={isActive ? themeStyle.button : {}}
                >
                  {teacher.name} 선생님
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. 학생 목록 및 교재 배정 */}
      {selectedTeacher && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <WrongAnswerStudentList
            students={students}
            allBooks={allBooks}
            categories={categories}
            themeStyle={themeStyle}
            currentTheme={currentTheme}
            waAcademy={waAcademy}
            selectedTeacher={selectedTeacher}
            onRefreshStudents={handleRefreshStudents}
            isAdminUser={isAdminUser}
          />
        </div>
      )}

    </div>
  );
}
