import React, { useState, useEffect } from 'react';
import { 
  LogOut, 
  Users, 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BookAssignmentPage from './BookAssignmentPage'; // ★ 새로 추가된 import

// ★ 핵심: App.jsx에서 넘겨준 academyId(학원 식별번호)와 theme(테마 객체)를 받습니다.
export default function AdminPage({ onExit, academyId, theme }) {
  // --- 상태 관리 ---
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [students, setStudents] = useState([]);
  const [allBooks, setAllBooks] = useState([]); // {book_name, category} 객체 배열로 변경
  const [categories, setCategories] = useState([]); // ★ 추가: 카테고리 목록
  const [selectedCategory, setSelectedCategory] = useState('전체'); // ★ 추가: 선택된 카테고리
  
  const [editingStudent, setEditingStudent] = useState(null); // 수정 중인 학생
  const [expandedStudent, setExpandedStudent] = useState(null); // 교재/PIN 수정 열린 학생

  // ★ 사용자 요청 카테고리 순서 정의 (BookAssignmentPage와 동일)
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
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showBookAssignment, setShowBookAssignment] = useState(false); 
  
  // ★ 테마 색상 적용 도우미 (하드코딩된 색상 제거용)
  const themeStyle = {
    text: { color: theme.primary },
    bg: { backgroundColor: theme.bg },
    button: { backgroundColor: theme.primary },
    border: { borderColor: theme.primary },
    ring: { '--tw-ring-color': theme.primary }, // 포커스 링 색상
    lightBg: { backgroundColor: theme.primary + '1A' } // 투명도 10%
  };

  // 에러 메시지 3초 자동 숨김
  useEffect(() => {
    if (!error && !successMsg) return;
    const timer = setTimeout(() => {
      setError('');
      setSuccessMsg('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [error, successMsg]);

  // 초기 로딩 (선생님 & 교재 목록)
  useEffect(() => {
    if (academyId && !showBookAssignment) { 
      fetchTeachers();
      fetchAllBooks();
    }
  }, [academyId, showBookAssignment]);

  // 선생님 선택 시 학생 목록 로딩
  useEffect(() => {
    if (selectedTeacher) {
      fetchStudents();
    }
  }, [selectedTeacher]);

  // --- 데이터 불러오기 함수들 ---

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('academy_id', academyId)
        .order('name');
      
      if (error) throw error;
      if (data) setTeachers(data);
    } catch (err) {
      setError('선생님 목록을 불러오지 못했습니다.');
      console.error(err);
    }
  };

  const fetchStudents = async () => {
    if (!selectedTeacher) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_users')
        .select('*')
        .eq('teacher_id', selectedTeacher.id)
        .eq('academy_id', academyId)
        .order('name');

      if (error) throw error;
      if (data) setStudents(data);
    } catch (err) {
      setError('학생 목록을 불러오지 못했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllBooks = async () => {
    try {
      // 1. books 테이블에서 카테고리 포함 조회
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select('book_name, category')
        .eq('academy_id', academyId)
        .order('book_name');

      let finalBooks = [];
      let rawCategories = new Set();

      if (!booksError && booksData && booksData.length > 0) {
        finalBooks = booksData.map(b => ({ book_name: b.book_name.trim(), category: b.category?.trim() }));
        booksData.forEach(b => { if (b.category) rawCategories.add(b.category.trim()); });
      }

      // 2. catalog 테이블에서도 보충 (카테고리 정보가 중요하므로)
      const { data: catalogData } = await supabase
        .from('problem_catalog')
        .select('book_name, category')
        .eq('academy_id', academyId);

      if (catalogData) {
        catalogData.forEach(c => {
          if (c.category) rawCategories.add(c.category.trim());
          // 아직 없는 책 이름이면 추가
          if (!finalBooks.find(b => b.book_name === c.book_name.trim())) {
            finalBooks.push({ book_name: c.book_name.trim(), category: c.category?.trim() });
          }
        });
      }

      setAllBooks(finalBooks.sort((a, b) => a.book_name.localeCompare(b.book_name)));
      setCategories(sortCategories(Array.from(rawCategories)));
    } catch (err) {
      console.error('Error fetching books:', err);
    }
  };

  // --- 기능 함수들 ---

  // 학생 정보 수정 (이름, 학원, 교재, PIN)
  const handleUpdateStudent = async (studentId) => {
    if (!editingStudent) return;
    
    if (!editingStudent.name.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!editingStudent.grade) { setError('학년을 선택해주세요.'); return; }

    setLoading(true);
    
    try {
      // 기본 정보 업데이트
      const { error: updateError } = await supabase
        .from('student_users')
        .update({
          name: editingStudent.name.trim(),
          grade: editingStudent.grade,
          assigned_books: editingStudent.assigned_books
        })
        .eq('id', studentId);

      if (updateError) throw updateError;

      // PIN 변경이 있는 경우에만 처리
      if (editingStudent.pin && editingStudent.pin.length > 0) {
        if (editingStudent.pin.length < 3 || editingStudent.pin.length > 6) {
          setError('PIN은 3~6자리여야 합니다.');
          setLoading(false);
          return;
        }
        
        const { error: pinError } = await supabase.rpc('set_student_pin', {
          student_id_input: studentId,
          pin_input: editingStudent.pin
        });
        if (pinError) throw pinError;
      }

      setSuccessMsg('정보가 수정되었습니다!');
      setEditingStudent(null);
      fetchStudents();
      
    } catch (err) {
      console.error('학생 수정 오류:', err);
      setError('수정 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 교재 선택 토글 함수 (수정 모드 공용)
  const toggleBook = (bookName) => {
    if (!editingStudent) return;
    
    const currentBooks = editingStudent.assigned_books || [];
    const updated = currentBooks.includes(bookName)
      ? currentBooks.filter(b => b !== bookName)
      : [...currentBooks, bookName];
    
    setEditingStudent({ ...editingStudent, assigned_books: updated });
  };

  // --- 화면 렌더링 (UI) ---

  return (
    // ★ 교재 배정 페이지가 활성화되면 해당 페이지를 렌더링
    showBookAssignment ? (
      <BookAssignmentPage
        academyId={academyId}
        onBack={() => setShowBookAssignment(false)}
        theme={theme} // ★ 테마 전달
      />
    ) : (
      // ★ 아니면 기존 관리자 페이지 내용을 렌더링
      <div className="min-h-screen p-6" style={themeStyle.bg}>
        <div className="max-w-6xl mx-auto">
          {/* 상단 헤더 */}
          <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div>
              <h1 className="text-3xl font-black tracking-tight" style={themeStyle.text}>
                관리자 페이지
              </h1>
              <p className="text-sm text-slate-400 font-bold mt-1">
                선생님 / 학생 / 교재 관리 (보안모드 작동중)
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBookAssignment(true)}
                className="flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-bold transition-all hover:brightness-110"
                style={themeStyle.button}
              >
                <BookOpen size={18} />
                교재 배정 관리
              </button>
              <button
                onClick={onExit}
                className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-colors"
              >
                <LogOut size={18} />
                나가기
              </button>
            </div>
          </div>

          {/* 선생님 선택 영역 */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
            <h2 className="text-sm font-black text-slate-400 mb-4 flex items-center gap-2">
              <Users size={16} />
              담당 선생님 선택
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {teachers.map(teacher => (
                <button
                  key={teacher.id}
                  onClick={() => setSelectedTeacher(teacher)}
                  className={`p-4 rounded-2xl font-bold transition-all ${
                    selectedTeacher?.id === teacher.id
                      ? 'text-white shadow-lg scale-105'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                  style={selectedTeacher?.id === teacher.id ? themeStyle.button : {}}
                >
                  {teacher.name}
                </button>
              ))}
            </div>
          </div>

          {/* 학생 관리 영역 (선생님 선택 시에만 보임) */}
          {selectedTeacher && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-slate-800">
                  {selectedTeacher.name} 선생님의 학생 목록
                </h2>
                <p className="text-xs text-slate-400 font-bold">
                  * 학생 추가/삭제는 로컬 앱에서 진행해주세요.
                </p>
              </div>

            {/* 학생 목록 리스트 */}
            <div className="space-y-3">
              {loading && students.length === 0 ? (
                <div className="text-center py-8 text-slate-400">로딩 중...</div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-slate-400">등록된 학생이 없습니다.</div>
              ) : (
                students.map(student => (
                  <div
                    key={student.id}
                    className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 transition-all"
                    style={{ borderColor: expandedStudent === student.id || editingStudent?.id === student.id ? theme.primary + '33' : '#f1f5f9' }}
                  >
                    {/* 학생 카드 헤더 */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200" style={themeStyle.text}>
                          <span className="text-lg font-black">{student.name[0]}</span>
                        </div>
                        
                        {/* 수정 모드 vs 보기 모드 */}
                        <div>
                          {editingStudent?.id === student.id ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editingStudent.name}
                                onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})}
                                className="px-3 py-1 bg-white rounded-lg font-bold text-slate-700 border-2 outline-none"
                                style={themeStyle.border}
                              />
                              <select
                                value={editingStudent.grade}
                                onChange={(e) => setEditingStudent({...editingStudent, grade: e.target.value})}
                                className="px-3 py-1 bg-white rounded-lg font-bold text-slate-700 border-2 outline-none"
                                style={themeStyle.border}
                              >
                                <option value="">학년</option>
                                <option value="초5">초5</option>
                                <option value="초6">초6</option>
                                <option value="중1">중1</option>
                                <option value="중2">중2</option>
                                <option value="중3">중3</option>
                                <option value="고1">고1</option>
                                <option value="고2">고2</option>
                                <option value="고3">고3</option>
                              </select>
                            </div>
                          ) : (
                            <>
                              <div className="font-black text-slate-800">
                                {student.name}
                                {student.grade && (
                                  <span className="text-sm font-bold text-slate-400 ml-2">
                                    ({student.grade})
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-bold">
                                교재 {student.assigned_books?.length || 0}개
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 액션 버튼들 */}
                      <div className="flex items-center gap-2">
                        {editingStudent?.id === student.id ? (
                          <>
                            <button
                              onClick={() => handleUpdateStudent(student.id)}
                              disabled={loading}
                              className="p-2 text-white rounded-lg hover:brightness-110"
                              style={themeStyle.button}
                            >
                              <Save size={16} />
                            </button>
                            <button
                              onClick={() => setEditingStudent(null)}
                              className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingStudent({
                                  id: student.id,
                                  name: student.name,
                                  grade: student.grade || '',
                                  pin: '', 
                                  assigned_books: student.assigned_books || []
                                });
                                setSelectedCategory('전체'); // 카테고리 초기화
                              }}
                              className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                              title="정보 수정"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => setExpandedStudent(
                                expandedStudent === student.id ? null : student.id
                              )}
                              className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                              title="상세 보기"
                            >
                              {expandedStudent === student.id ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 확장 영역 (교재 수정 및 PIN 리셋) */}
                    {(expandedStudent === student.id || editingStudent?.id === student.id) && (
                      <div className="p-4 bg-white border-t border-slate-100">
                        <label className="text-xs font-black text-slate-500 mb-2 block">
                          배정 교재 관리
                        </label>

                        {/* ★ 학생 수정 시에도 나타나는 카테고리 띠 */}
                        <div className="mb-4 overflow-hidden">
                          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
                            <button
                              type="button"
                              onClick={() => setSelectedCategory('전체')}
                              className={`flex-none snap-start px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                selectedCategory === '전체' 
                                  ? 'text-white shadow-md' 
                                  : 'bg-slate-50 text-slate-400 border border-slate-100'
                              }`}
                              style={selectedCategory === '전체' ? themeStyle.button : {}}
                            >
                              전체
                            </button>
                            {categories.map(cat => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`flex-none snap-start px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                  selectedCategory === cat 
                                    ? 'text-white shadow-md' 
                                    : 'bg-slate-50 text-slate-400 border border-slate-100'
                                }`}
                                style={selectedCategory === cat ? themeStyle.button : {}}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 교재 목록 (필터링 적용) */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                          {allBooks
                            .filter(book => selectedCategory === '전체' || book.category === selectedCategory)
                            .map(book => {
                              const bookName = book.book_name;
                              const isAssigned = editingStudent?.id === student.id
                                ? editingStudent.assigned_books.includes(bookName)
                                : student.assigned_books?.includes(bookName);
                              
                              return (
                                <button
                                  key={bookName}
                                  type="button"
                                  onClick={() => {
                                    if (editingStudent?.id === student.id) {
                                      toggleBook(bookName);
                                    }
                                  }}
                                  disabled={editingStudent?.id !== student.id}
                                  className={`p-2 rounded-lg text-xs font-bold transition-all ${
                                    isAssigned
                                      ? 'text-white'
                                      : 'bg-slate-100 text-slate-400'
                                  } ${
                                    editingStudent?.id === student.id
                                      ? 'cursor-pointer hover:opacity-80'
                                      : 'cursor-default'
                                  }`}
                                  style={isAssigned ? themeStyle.button : {}}
                                >
                                  {bookName}
                                </button>
                              );
                          })}
                        </div>
                        
                        {/* PIN 리셋 (수정 모드일 때만 보임) */}
                          {editingStudent?.id === student.id && (
                            <div>
                              <label className="text-xs font-black text-slate-500 mb-2 block">
                                PIN 리셋 (변경시에만 입력)
                              </label>
                              <input
                                type="password"
                                value={editingStudent.pin}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  if (value.length <= 6) {
                                    setEditingStudent({...editingStudent, pin: value});
                                  }
                                }}
                                placeholder="새 PIN (3~6자리)"
                                maxLength={6}
                                className="w-full md:w-48 p-3 bg-slate-50 rounded-xl font-bold text-slate-700 border outline-none text-center tracking-widest transition-all"
                                style={themeStyle.ring}
                                onFocus={(e) => e.target.style.borderColor = theme.primary}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                              />
                              <p className="text-xs text-slate-400 mt-2">
                                입력하지 않으면 기존 PIN이 유지됩니다.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 알림 메시지들 */}
          {successMsg && (
            <div className="fixed bottom-6 right-6 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold z-50 animate-bounce" style={themeStyle.button}>
              <CheckCircle2 size={20} />
              {successMsg}
            </div>
          )}
          {error && (
            <div className="fixed bottom-6 right-6 bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold z-50">
              <AlertCircle size={20} />
              {error}
            </div>
          )}
        </div>
      </div>
    )
  );
}
