'use client';

import React from 'react';
import { ToggleLeft, ToggleRight, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { MasterTextbookRecord } from '../hooks/useMasterTextbooks';

interface MasterTextbookRowProps {
  book: MasterTextbookRecord;
  isBusy: boolean;
  onToggle: (book: MasterTextbookRecord) => void;
  onEdit: (book: MasterTextbookRecord) => void;
  onDelete: (book: MasterTextbookRecord) => void;
}

export function MasterTextbookRow({ book, isBusy, onToggle, onEdit, onDelete }: MasterTextbookRowProps) {
  const isPublic = book.share_scope === 'public' && book.share_status === 'approved';
  const isActive = book.status === '활성';

  return (
    <tr className={`hover:bg-gray-800/30 transition-colors ${!isActive ? 'opacity-40 bg-black/20' : ''}`}>
      {/* 마스터 상태 토글 */}
      <td className="py-2 px-3 text-center">
        <button
          onClick={() => onToggle(book)}
          disabled={isBusy}
          title={isActive ? '현재 활성 (클릭하여 비활성화)' : '현재 비활성 (클릭하여 활성화)'}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-bold transition-all"
          style={{
            borderColor: isActive ? '#059669' : '#d97706',
            backgroundColor: isActive ? 'rgba(5, 150, 105, 0.15)' : 'rgba(217, 119, 6, 0.15)',
            color: isActive ? '#34d399' : '#fbbf24',
          }}
        >
          {isBusy ? <Loader2 size={12} className="animate-spin" /> : isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          <span>{isActive ? '활성' : '비활성'}</span>
        </button>
      </td>

      <td className="py-2 px-3 font-mono text-[11px] text-gray-300 truncate max-w-[280px]" title={book.bookcode}>{book.bookcode}</td>
      <td className="py-2 px-3 font-bold text-white truncate max-w-[240px]" title={book.title}>{book.title}</td>
      <td className="py-2 px-3 text-center text-gray-400">{book.grade || '-'}</td>
      <td className="py-2 px-3 text-gray-400 truncate">{book.publisher || '-'}</td>

      {/* 단원 수 (클릭 시 수정 모달) */}
      <td className="py-2 px-3 text-center font-mono">
        <button
          onClick={() => onEdit(book)}
          title="단원 목차 편집"
          className={`px-1.5 py-0.5 rounded text-[11px] font-bold hover:ring-1 hover:ring-indigo-500 ${book.unit_count > 0 ? 'text-indigo-400 bg-indigo-950/40' : 'text-gray-500'}`}
        >
          {book.unit_count}개
        </button>
      </td>

      <td className="py-2 px-3 text-center">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
          isPublic ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40' : 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
        }`}>
          {isPublic ? '공용' : '자체'}
        </span>
      </td>

      {/* 관리: 수정 / 삭제 */}
      <td className="py-2 px-3 text-center">
        <div className="inline-flex items-center gap-1 justify-center">
          <button
            onClick={() => onEdit(book)}
            disabled={isBusy}
            title="교재 및 단원 정보 수정"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 hover:bg-indigo-600 text-gray-200 text-[11px] font-bold transition-colors disabled:opacity-40"
          >
            <Pencil size={11} /> 수정
          </button>
          <button
            onClick={() => onDelete(book)}
            disabled={isBusy}
            title="교재 및 단원 영구 삭제"
            className="inline-flex items-center justify-center p-1 rounded bg-gray-800 hover:bg-rose-700 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}
