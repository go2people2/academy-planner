'use client';

import { useState, useMemo } from 'react';
import { BookOpen, Layers } from 'lucide-react';

interface StudentBookDrawerProps {
  assignedBooks: any[];
  builtModules?: Record<string, any>;
  selectedBookcode: string | null;
  onSelectBook: (bookcode: string) => void;
  isLight?: boolean;
}

export default function StudentBookDrawer({
  assignedBooks = [],
  builtModules = {},
  selectedBookcode,
  onSelectBook,
  isLight = false
}: StudentBookDrawerProps) {
  const [selectedCat, setSelectedCat] = useState<'ALL' | 'ELEM' | 'MID' | 'HIGH' | 'SAT'>('ALL');

  // 대분류 카테고리 자동 판별 헬퍼
  const getBookCategory = (book: any): 'ELEM' | 'MID' | 'HIGH' | 'SAT' => {
    const text = `${book.title || ''} ${book.bookcode || ''} ${book.grade || ''} ${book.subject || ''}`.toLowerCase();
    if (text.includes('수능') || text.includes('기출') || text.includes('모의') || text.includes('자이') || text.includes('마플') || text.includes('sat')) return 'SAT';
    if (text.includes('초등') || text.includes('초1') || text.includes('초2') || text.includes('초3') || text.includes('초4') || text.includes('초5') || text.includes('초6') || text.includes('elem')) return 'ELEM';
    if (text.includes('중등') || text.includes('중1') || text.includes('중2') || text.includes('중3') || text.includes('m1') || text.includes('m2') || text.includes('m3') || text.includes('mid')) return 'MID';
    return 'HIGH';
  };

  const filteredBooks = useMemo(() => {
    if (selectedCat === 'ALL') return assignedBooks;
    return assignedBooks.filter(b => getBookCategory(b) === selectedCat);
  }, [assignedBooks, selectedCat]);

  return (
    <div className={`p-4 rounded-md border space-y-3 ${
      isLight ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200' : 'bg-gradient-to-r from-slate-900 to-indigo-950/60 border-indigo-500/20'
    }`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-indigo-200/40 dark:border-indigo-500/20">
        <h3 className="text-xs font-black flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300">
          <Layers size={15} />
          <span>📚 내 개인 교재 서랍 ({filteredBooks.length} / {assignedBooks.length}권)</span>
        </h3>

        {/* 📚 대분류 탭 버튼 세트 */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'ALL', label: '전체' },
            { id: 'ELEM', label: '🎒초등' },
            { id: 'MID', label: '🏫중등' },
            { id: 'HIGH', label: '🎓고등' },
            { id: 'SAT', label: '🏛️수능' }
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCat(cat.id as any)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all shrink-0 border ${
                selectedCat === cat.id
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                  : isLight
                    ? 'bg-white hover:bg-gray-100 text-gray-700 border-gray-250'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {filteredBooks.length === 0 ? (
        <div className="text-center py-6 text-xs text-gray-400 font-bold italic">
          선택한 카테고리에 해당되는 교재가 서랍에 없습니다.
        </div>
      ) : (
        <div className="flex items-center gap-3 overflow-x-auto pb-1 custom-scrollbar-h">
          {filteredBooks.map((book) => {
            const isSelected = selectedBookcode === book.bookcode;
            const bookType = builtModules[book.bookcode]?.bookType || 'concept';

            let cardStyle = isLight
              ? 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
              : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800';

            if (isSelected) {
              if (bookType === 'problem') {
                cardStyle = 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400';
              } else {
                cardStyle = 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400';
              }
            }

            return (
              <button
                key={book.bookcode}
                type="button"
                onClick={() => onSelectBook(book.bookcode)}
                className={`p-3 rounded-md border transition-all shrink-0 w-44 text-left flex flex-col justify-between gap-2 shadow-sm ${cardStyle}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <BookOpen size={14} className={isSelected ? 'text-white' : bookType === 'problem' ? 'text-amber-500' : 'text-indigo-500'} />
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      isSelected ? 'bg-white/20 text-white' : isLight ? 'bg-gray-100 text-gray-600' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {bookType === 'problem' ? '📙 유형서' : '🔵 개념서'}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs line-clamp-1" title={book.title}>
                    {book.title}
                  </h4>
                </div>

                <div className="flex items-center justify-between text-[10px] opacity-80 border-t border-dashed border-white/20 pt-1.5">
                  <span>과목: {book.subject || '수학'}</span>
                  {isSelected && <span className="font-black text-amber-300">▶ 열림</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
