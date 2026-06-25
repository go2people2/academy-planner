// src/components/BookCard.jsx
import React from 'react';
import { CheckCircle2, BookOpen } from 'lucide-react';

export default function BookCard({ book, isSelected, onToggle, theme }) {
  // 책 제목에서 색상 생성
  const getBookColor = (bookName) => {
    const colors = [
      'from-blue-400 to-blue-600',
      'from-green-400 to-green-600',
      'from-purple-400 to-purple-600',
      'from-pink-400 to-pink-600',
      'from-orange-400 to-orange-600',
      'from-teal-400 to-teal-600',
      'from-indigo-400 to-indigo-600',
      'from-red-400 to-red-600',
    ];
    const hash = bookName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const themeStyle = {
    primary: theme?.primary || '#1E3A8A',
    lightPrimary: (theme?.primary || '#1E3A8A') + '33', // 20% opacity for ring
  };

  return (
    <button
      onClick={onToggle}
      className={`
        relative rounded-xl overflow-hidden transition-all duration-200 border-2
        ${isSelected 
          ? 'shadow-lg scale-105' 
          : 'border-slate-200 hover:shadow-md'
        }
      `}
      style={{
        borderColor: isSelected ? themeStyle.primary : '#e2e8f0',
        boxShadow: isSelected ? `0 0 0 4px ${themeStyle.lightPrimary}` : ''
      }}
    >
      {/* 썸네일 or 책 제목 카드 */}
      <div className="aspect-[3/4] relative">
        {book.thumbnail_url ? (
          // 썸네일이 있는 경우
          <>
            <img
              src={book.thumbnail_url}
              alt={book.book_name}
              className={`
                w-full h-full object-cover transition-all duration-300
                ${isSelected 
                  ? 'brightness-100 saturate-100' 
                  : 'brightness-75 saturate-50 opacity-70'
                }
              `}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            {/* 이미지 로드 실패 시 fallback */}
            <div 
              className={`
                absolute inset-0 bg-gradient-to-br ${getBookColor(book.book_name)} 
                items-center justify-center p-4 hidden transition-all duration-300
                ${isSelected ? 'opacity-100' : 'opacity-70'}
              `}
            >
              <div className="text-center">
                <BookOpen size={40} className="text-white mx-auto mb-3 opacity-80" />
                <p className="text-white font-bold text-base leading-tight">
                  {book.book_name}
                </p>
              </div>
            </div>
          </>
        ) : (
          // 썸네일이 없는 경우 - 그라데이션 카드
          <div className={`
            absolute inset-0 bg-gradient-to-br ${getBookColor(book.book_name)} 
            flex items-center justify-center p-4 transition-all duration-300
            ${isSelected ? 'opacity-100' : 'opacity-70'}
          `}>
            <div className="text-center">
              <BookOpen size={40} className="text-white mx-auto mb-3 opacity-80" />
              <p className="text-white font-bold text-base leading-tight">
                {book.book_name}
              </p>
            </div>
          </div>
        )}

        {/* 선택 체크 아이콘 - 오른쪽 상단 */}
        {isSelected && (
          <div className="absolute top-3 right-3 bg-white rounded-full p-0.5 shadow-lg">
            <CheckCircle2 size={28} style={{ color: themeStyle.primary }} />
          </div>
        )}
      </div>

      {/* 하단 제목 바 */}
      <div className={`p-3 text-sm font-bold text-center transition-colors duration-200 ${
        isSelected ? 'text-white' : 'bg-slate-50 text-slate-700'
      }`}
      style={isSelected ? { backgroundColor: themeStyle.primary } : {}}
      >
        <div className="line-clamp-2">{book.book_name}</div>
      </div>
    </button>
  );
}
