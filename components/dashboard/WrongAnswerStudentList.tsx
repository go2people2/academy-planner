'use client';

import React, { useState, useEffect } from 'react';
import { 
  Edit, Save, X, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Key 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface WrongAnswerStudentListProps {
  students: any[];
  allBooks: any[];
  categories: string[];
  themeStyle: any;
  currentTheme: any;
  waAcademy: any;
  selectedTeacher: any;
  onRefreshStudents: () => Promise<void>;
  isAdminUser?: boolean;
}

export default function WrongAnswerStudentList({
  students,
  allBooks,
  categories,
  themeStyle,
  currentTheme,
  waAcademy,
  selectedTeacher,
  onRefreshStudents,
  isAdminUser
}: WrongAnswerStudentListProps) {
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!error && !successMsg) return;
    const timer = setTimeout(() => { setError(''); setSuccessMsg(''); }, 3000);
    return () => clearTimeout(timer);
  }, [error, successMsg]);

  // 선생님이 바뀌면 상태 초기화
  useEffect(() => {
    setEditingStudent(null);
    setExpandedStudent(null);
    setSelectedCategory('전체');
  }, [selectedTeacher]);

  const handleUpdateStudent = async (studentId: string) => {
    if (!editingStudent) return;
    if (!editingStudent.name.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!editingStudent.grade) { setError('학년을 선택해주세요.'); return; }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('student_users')
        .update({
          name: editingStudent.name.trim(),
          grade: editingStudent.grade,
          assigned_books: editingStudent.assigned_books
        })
        .eq('id', studentId);

      if (updateError) throw updateError;

      // PIN 변경이 있는 경우에만 RPC 호출
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

      setSuccessMsg('학생 정보가 안전하게 저장되었습니다.');
      setEditingStudent(null);
      await onRefreshStudents();
    } catch (err: any) {
      console.error('Save error:', err);
      setError('저장 중 오류 발생: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleBook = (bookName: string) => {
    if (!editingStudent) return;
    const currentBooks = editingStudent.assigned_books || [];
    const updated = currentBooks.includes(bookName)
      ? currentBooks.filter((b: string) => b !== bookName)
      : [...currentBooks, bookName];
    setEditingStudent({ ...editingStudent, assigned_books: updated });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <h2 className="text-base font-black text-slate-800">
          {isAdminUser ? `${selectedTeacher.name} 선생님의 학생 목록` : '담당 학생 목록'}
        </h2>
        <span className="text-[10px] font-bold text-slate-400">
          총 {students.length}명
        </span>
      </div>

      <div className="space-y-4">
        {loading && students.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-bold">로딩 중...</div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-bold">등록된 학생이 없습니다.</div>
        ) : (
          students.map(student => {
            const isExpanded = expandedStudent === student.id;
            const isEditing = editingStudent?.id === student.id;

            return (
              <div 
                key={student.id} 
                className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 transition-all duration-300"
                style={isExpanded || isEditing ? { borderColor: currentTheme.primary + '40', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.03)' } : {}}
              >
                
                {/* 학생 카드 헤더 */}
                <div className="p-4 flex items-center justify-between bg-white border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm" style={themeStyle.lightBg}>
                      <span style={themeStyle.text}>{student.name[0]}</span>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          value={editingStudent.name}
                          onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2"
                          style={themeStyle.ring}
                        />
                        <select
                          value={editingStudent.grade || ''}
                          onChange={e => setEditingStudent({ ...editingStudent, grade: e.target.value })}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2"
                          style={themeStyle.ring}
                        >
                          <option value="">학년 선택</option>
                          {['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'].map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <div className="font-extrabold text-slate-800 text-[13px]">
                          {student.name}
                          {student.grade && (
                            <span className="ml-1.5 text-xs text-slate-400 font-bold">({student.grade})</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-black mt-0.5 uppercase tracking-tight">
                          배정교재: {student.assigned_books?.length || 0}권
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleUpdateStudent(student.id)}
                          className="p-2 text-white rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center"
                          style={themeStyle.button}
                          title="저장"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={() => setEditingStudent(null)}
                          className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl transition-colors active:scale-95 flex items-center justify-center"
                          title="취소"
                        >
                          <X size={14} />
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
                              assigned_books: student.assigned_books || [],
                              pin: ''
                            });
                            setExpandedStudent(student.id);
                            setSelectedCategory('전체');
                          }}
                          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-100 rounded-xl transition-all active:scale-95 flex items-center justify-center"
                          title="수정"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-100 rounded-xl transition-all active:scale-95 flex items-center justify-center"
                          title="교재 목록"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 교재 배정 디테일 펼침 영역 */}
                {isExpanded && (
                  <div className="p-5 bg-white border-t border-slate-50 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-50 pb-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                        오답 교재 관리
                      </label>
                      
                      {/* 카테고리 필터 스크롤 */}
                      <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1 scrollbar-hide snap-x">
                        <button
                          type="button"
                          onClick={() => setSelectedCategory('전체')}
                          className={`px-3 py-1 rounded-full text-[10px] font-black transition-all snap-start ${
                            selectedCategory === '전체'
                              ? 'text-white shadow-md'
                              : 'bg-slate-50 text-slate-400 border border-slate-100/60'
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
                            className={`px-3 py-1 rounded-full text-[10px] font-black transition-all snap-start ${
                              selectedCategory === cat
                                ? 'text-white shadow-md'
                                : 'bg-slate-50 text-slate-400 border border-slate-100/60'
                            }`}
                            style={selectedCategory === cat ? themeStyle.button : {}}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 교재 리스트 그리드 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {allBooks
                        .filter(b => selectedCategory === '전체' || b.category === selectedCategory)
                        .map(book => {
                          const bookName = book.book_name;
                          const isAssigned = isEditing
                            ? editingStudent.assigned_books.includes(bookName)
                            : student.assigned_books?.includes(bookName);

                          return (
                            <button
                              key={bookName}
                              type="button"
                              onClick={() => isEditing && toggleBook(bookName)}
                              disabled={!isEditing}
                              className={`p-2.5 rounded-xl text-[10px] font-black text-left transition-all ${
                                isAssigned
                                  ? 'text-white shadow-sm'
                                  : 'bg-slate-50 text-slate-400 border border-slate-100/40'
                              } ${isEditing ? 'cursor-pointer hover:opacity-85 active:scale-95' : 'cursor-default'}`}
                              style={isAssigned ? themeStyle.button : {}}
                            >
                              {bookName}
                            </button>
                          );
                        })}
                    </div>

                    {/* PIN 번호 리셋 (수정 모드일 때만 노출) */}
                    {isEditing && (
                      <div className="pt-4 border-t border-slate-50 space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Key size={12} />
                          학생 PIN 리셋 (비밀번호 분실 시 새 PIN 3~6자리 기입)
                        </label>
                        <input
                          type="password"
                          value={editingStudent.pin}
                          onChange={e => setEditingStudent({ ...editingStudent, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                          placeholder="새 PIN 입력"
                          maxLength={6}
                          className="w-full sm:w-48 text-center text-lg font-mono tracking-widest p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2"
                          style={themeStyle.ring}
                        />
                        <p className="text-[10px] text-slate-400 font-bold">
                          * 입력 칸을 비워두고 저장하시면 기존에 설정된 학생 PIN 번호가 그대로 유지됩니다.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 알림 메시지 팝업 */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold z-50 animate-bounce" style={themeStyle.button}>
          <CheckCircle2 size={18} />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold z-50">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
    </div>
  );
}
