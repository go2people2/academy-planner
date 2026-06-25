// src/pages/BookAssignmentPage.jsx
import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, BookOpen, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import BookCard from '../components/BookCard';

export default function BookAssignmentPage({ onBack, academyId, theme }) {
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState('');
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]); // ★ 추가: 카테고리 목록
  const [selectedCategory, setSelectedCategory] = useState('전체'); // ★ 추가: 선택된 카테고리
  const [assigned, setAssigned] = useState([]);

  // ★ 테마 색상 적용 도우미 (누락된 부분 복구)
  const themeStyle = {
    text: { color: theme.primary },
    bg: { backgroundColor: theme.bg },
    button: { backgroundColor: theme.primary },
    border: { borderColor: theme.primary },
    ring: { '--tw-ring-color': theme.primary },
    lightBg: { backgroundColor: theme.primary + '1A' } // 투명도 10%
  };

  // ★ 사용자 요청 카테고리 순서 정의
  const CATEGORIES_ORDER = [
    '중1-1', '중1-2', '중2-1', '중2-2', '중3-1', '중3-2',
    '공통수학1', '공통수학2', '대수', '미적분1', '미적분2', '확률과 통계', '기하',
    '초5-1', '초5-2', '초6-1', '초6-2'
  ];

  // ★ 카테고리 정렬 함수
  const sortCategories = (cats) => {
    return [...cats].sort((a, b) => {
      let indexA = CATEGORIES_ORDER.indexOf(a);
      let indexB = CATEGORIES_ORDER.indexOf(b);
      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;
      return indexA - indexB;
    });
  };

  // 에러 자동 숨김
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 3000);
    return () => clearTimeout(t);
  }, [error]);

  // 선생님 목록 로딩 (기존 로직 유지)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!academyId) return;
      try {
        setLoading(true);
        const { data, error: qErr } = await supabase
          .from('teachers')
          .select('id, name')
          .eq('academy_id', academyId)
          .order('name', { ascending: true });
        
        if (qErr) throw qErr;
        if (mounted) setTeachers(data ?? []);
      } catch (e) {
        setError(e.message || '선생님 목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [academyId]);

  // 학생 목록 로딩 (기존 로직 유지)
  useEffect(() => {
    let mounted = true;
    const fetchStudents = async () => {
      setError('');
      setStudents([]);
      setStudentId('');
      if (!teacherId) return;
      
      try {
        setLoading(true);
        const { data, error: qErr } = await supabase
          .from('student_users')
          .select('id, name, grade')
          .eq('teacher_id', teacherId)
          .order('name', { ascending: true });
        
        if (qErr) throw qErr;
        if (mounted) setStudents(data ?? []);
      } catch (e) {
        setError(e.message || '학생 목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchStudents();
    return () => { mounted = false; };
  }, [teacherId]);

  // 교재 및 카테고리 목록 로딩
  useEffect(() => {
    let mounted = true;
    (async () => {
      setBooks([]);
      setCategories([]);
      setAssigned([]);
      setSelectedCategory('전체');
      if (!studentId || !academyId) return;
      
      try {
        setLoading(true);
        
        // 학생 정보
        const { data: studentInfo, error: studentErr } = await supabase
          .from('student_users')
          .select('assigned_books')
          .eq('id', studentId)
          .single();
        
        if (studentErr) throw studentErr;
        
        let booksData = [];
        let rawCategories = new Set();

        // 1. books 테이블 시도
        try {
          const { data, error: booksErr } = await supabase
            .from('books')
            .select('id, book_name, thumbnail_url, category')
            .eq('academy_id', academyId)
            .order('book_name', { ascending: true });
          
          if (!booksErr && data && data.length > 0) {
            booksData = data.map(b => ({
              ...b,
              book_name: b.book_name?.trim() || '이름 없음',
              category: b.category?.trim() || null
            }));
            booksData.forEach(item => { if (item.category) rawCategories.add(item.category); });
          }
        } catch (e) { console.error('Books table fetch error:', e); }
        
        // 2. catalog 테이블 시도
        if (booksData.length === 0 || rawCategories.size === 0) {
          try {
            const { data: catalogData, error: catErr } = await supabase
              .from('problem_catalog')
              .select('book_name, category')
              .eq('academy_id', academyId);
            
            if (!catErr && catalogData) {
              if (booksData.length === 0) {
                const uniqueNames = [...new Set(catalogData.map(item => item.book_name?.trim()))].filter(Boolean);
                booksData = uniqueNames.map(name => {
                  const found = catalogData.find(c => c.book_name?.trim() === name);
                  return { id: name, book_name: name, thumbnail_url: null, category: found?.category?.trim() || null };
                });
              }
              catalogData.forEach(item => { if (item.category) rawCategories.add(item.category.trim()); });
            }
          } catch (e) { console.error('Catalog fetch error:', e); }
        }
        
        if (mounted) {
          setBooks(booksData || []);
          setCategories(sortCategories(Array.from(rawCategories)));
          setAssigned(studentInfo?.assigned_books || []);
        }
      } catch (e) {
        setError(e.message || '교재 목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    
    return () => { mounted = false; };
  }, [studentId, academyId]);

  // ★ 필터링된 교재 목록 계산
  const filteredBooks = selectedCategory === '전체' 
    ? books 
    : books.filter(b => b.category?.trim() === selectedCategory);

  const toggleBook = (bookName) => {
    setAssigned(prev => 
      prev.includes(bookName)
        ? prev.filter(b => b !== bookName)
        : [...prev, bookName]
    );
  };

  const toggleAll = () => {
    setAssigned(prev => 
      prev.length === books.length 
        ? [] 
        : books.map(b => b.book_name)
    );
  };

  const handleSaveAssignment = async () => {
    if (!studentId) return;
    
    try {
      setLoading(true);
      const { error: updateError } = await supabase
        .from('student_users')
        .update({ assigned_books: assigned })
        .eq('id', studentId);
      
      if (updateError) throw updateError;
      
      alert(`✅ ${assigned.length}권의 교재가 배정되었습니다.`);
    } catch (e) {
      setError(e.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6" style={themeStyle.bg}>
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black" style={themeStyle.text}>교재 배정</h1>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            뒤로가기
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* 선생님 선택 */}
        <div className="mb-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-4">1. 담당 선생님 선택</h2>
          <select
            value={teacherId}
            onChange={(e) => {
              setTeacherId(e.target.value);
              setStudentId('');
              setAssigned([]);
            }}
            disabled={loading}
            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-slate-800 font-semibold transition-all focus:ring-1"
            style={{ '--tw-ring-color': theme.primary }}
            onFocus={(e) => e.target.style.borderColor = theme.primary}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          >
            <option value="">-- 선생님을 선택하세요 --</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name} 선생님</option>
            ))}
          </select>
        </div>

        {/* 학생 선택 */}
        {teacherId && (
          <div className="mb-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4">2. 학생 선택</h2>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={loading || students.length === 0}
              className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-slate-800 font-semibold transition-all focus:ring-1"
              style={{ '--tw-ring-color': theme.primary }}
              onFocus={(e) => e.target.style.borderColor = theme.primary}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            >
              <option value="">-- 학생을 선택하세요 --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.grade ? `${s.grade} ` : ''}{s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ★ 카테고리 선택 띠 (가로 스크롤) */}
        {studentId && categories.length > 0 && (
          <div className="mb-6 overflow-hidden">
            <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x">
              <button
                onClick={() => setSelectedCategory('전체')}
                className={`flex-none snap-start px-6 py-2 rounded-full font-bold transition-all ${
                  selectedCategory === '전체' 
                    ? 'text-white shadow-md' 
                    : 'bg-white text-slate-400 border border-slate-100'
                }`}
                style={selectedCategory === '전체' ? themeStyle.button : {}}
              >
                전체
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex-none snap-start px-6 py-2 rounded-full font-bold transition-all ${
                    selectedCategory === cat 
                      ? 'text-white shadow-md' 
                      : 'bg-white text-slate-400 border border-slate-100'
                  }`}
                  style={selectedCategory === cat ? themeStyle.button : {}}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 교재 배정 */}
        {studentId && books.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">
                3. 교재 배정 
                {selectedCategory !== '전체' && (
                  <span className="ml-2 text-sm text-slate-400">({selectedCategory})</span>
                )}
                <span className="ml-2" style={themeStyle.text}>({assigned.length}/{books.length}권)</span>
              </h2>
              <button
                onClick={toggleAll}
                className="text-sm px-3 py-1.5 rounded-lg font-bold transition-colors"
                style={themeStyle.lightBg}
              >
                <span style={themeStyle.text}>{assigned.length === books.length ? '전체 해제' : '전체 선택'}</span>
              </button>
            </div>

            {/* 교재 카드 그리드 (필터링된 목록 적용) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {filteredBooks.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  isSelected={assigned.includes(book.book_name)}
                  onToggle={() => toggleBook(book.book_name)}
                  theme={theme}
                />
              ))}
            </div>

            {filteredBooks.length === 0 && (
              <div className="text-center py-12 text-slate-400 font-bold">
                해당 카테고리에 교재가 없습니다.
              </div>
            )}

            {/* 저장 버튼 */}
            <button
              onClick={handleSaveAssignment}
              disabled={loading}
              className="w-full text-white p-4 rounded-xl font-bold text-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:brightness-110"
              style={themeStyle.button}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  저장 중...
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  교재 배정 저장
                </>
              )}
            </button>
          </div>
        )}

        {/* 교재 없음 */}
        {studentId && books.length === 0 && !loading && (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <BookOpen size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-semibold">등록된 교재가 없습니다.</p>
          </div>
        )}

        {/* 로딩 오버레이 */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 shadow-2xl flex items-center gap-3">
              <Loader2 className="animate-spin" size={24} style={themeStyle.text} />
              <span className="font-bold text-slate-700">로딩 중...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}