'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ChevronRight, BookOpen, User, Search, AlertCircle
} from 'lucide-react';
import { Student, TextbookOption } from '@/types/dashboard';
import BookProgressRow from './BookProgressRow';

interface ProgressSequencerProps {
  students: Student[];
  masterTextbooks: TextbookOption[];
  initialStudentId?: string | null;
  onSaveLegacy?: (studentId: string, bookCode: string, unitName: string) => Promise<boolean>;
}

export default function ProgressSequencer({ students, masterTextbooks, initialStudentId, onSaveLegacy }: ProgressSequencerProps) {
  const [searchQuery, setSearchQuery] = useState(''); // 💡 검색어 상태
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || (students[0]?.id || null));
  
  // 💡 검색 필터링 로직
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(s => 
      (s.name || '').toLowerCase().includes(query) || 
      (s.grade || '').toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

  // 💡 필터링 결과(filteredStudents) 또는 외부 주입 ID가 변경될 때 선택 상태 자동 보정
  useEffect(() => {
    // 1. 외부에서 지정한 initialStudentId가 있고, 그 학생이 현재 필터링된 목록에 있다면 우선 선택
    if (initialStudentId && filteredStudents.some(s => s.id === initialStudentId)) {
      setSelectedStudentId(initialStudentId);
      return;
    }
    
    // 2. 현재 선택된 학생이 필터링된 목록에 존재하지 않는다면 첫 번째 학생 선택
    if (filteredStudents.length > 0) {
      const exists = filteredStudents.some(s => s.id === selectedStudentId);
      if (!exists) {
        setSelectedStudentId(filteredStudents[0].id);
      }
    } else {
      setSelectedStudentId(null);
    }
  }, [filteredStudents, initialStudentId]);

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4">
        <AlertCircle size={48} className="opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">No students available</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#050505] overflow-hidden">
      {/* 1. 왼쪽: 학생 목록 */}
      <div className="w-64 border-r border-white/5 flex flex-col bg-black/20">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <User size={14} /> Student Progress
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={12} />
            <input 
              type="text" 
              placeholder="학생 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-[4px] py-2 pl-9 pr-3 text-[11px] text-white focus:outline-none focus:border-blue-500 transition-all font-bold"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar-v p-2 space-y-1">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s, idx) => (
              <button
                key={s.id || idx}
                onClick={() => setSelectedStudentId(s.id)}
                className={`w-full flex items-center justify-between p-3 rounded-[2px] transition-all group ${selectedStudentId === s.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
              >
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[13px] font-black truncate w-full text-left">{s.name}</span>
                  <span className={`text-[8px] font-bold uppercase tracking-tighter ${selectedStudentId === s.id ? 'text-blue-100' : 'text-gray-600'}`}>{s.grade} · {s.course}</span>
                </div>
                <ChevronRight size={14} className={`transition-transform ${selectedStudentId === s.id ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`} />
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-gray-600 text-[10px] font-bold uppercase tracking-widest">
              검색 결과 없음
            </div>
          )}
        </div>
      </div>

      {/* 2. 오른쪽: 전체 교재 목록 */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#080808]">
        {selectedStudent ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar-v p-5 space-y-8">
            <div className="space-y-0.5 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{selectedStudent.name} 학생 진도표</h2>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">학습 진행도를 확인합니다.</p>
                </div>
                {/* 💡 스마트 프로그레스 바 범례 추가 */}
                <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase">처음풀기</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[9px] font-black text-amber-500 uppercase">오답완료</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[9px] font-black text-blue-500 uppercase">숙제부여</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedStudent.assigned_books.length > 0 ? (
              selectedStudent.assigned_books
                .filter(code => {
                  if (!code) return false;
                  const bookCourse = selectedStudent.book_courses?.[code] || selectedStudent.course || '';
                  return !String(bookCourse).includes('-done'); // 💡 완료된 교재는 진도표에서 숨김
                })
                .map(bookCode => {
                // 💡 더욱 유연한 교재 매칭 (정확히 일치하지 않아도 코드 앞부분이 같으면 매칭 시도)
                const textbook = masterTextbooks.find(m => m.bookcode === bookCode) || 
                                masterTextbooks.find(m => m.bookcode.toLowerCase().startsWith(bookCode.toLowerCase())) ||
                                masterTextbooks.find(m => bookCode.toLowerCase().startsWith(m.bookcode.toLowerCase()));
                return (
                  <BookProgressRow 
                    key={bookCode}
                    student={selectedStudent}
                    bookCode={bookCode}
                    textbook={textbook}
                    onSaveLegacy={onSaveLegacy}
                  />
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-700 gap-2">
                <BookOpen size={48} className="opacity-10 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">배정된 교재가 없습니다</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600 font-bold text-[11px] uppercase tracking-wider">
            {filteredStudents.length === 0 ? "검색 결과에 맞는 학생이 없습니다" : "학생을 선택해주세요"}
          </div>
        )}
      </div>
    </div>
  );
}



