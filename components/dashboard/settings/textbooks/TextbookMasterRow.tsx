'use client';

import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, Loader2, Edit2, Check, Copy, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { getRowHoverStyle } from './textbookTheme';

export interface TextbookMasterItem {
  bookcode: string;
  title: string;
  grade?: string;
  category?: string;
  publisher?: string;
  status: string;
  is_enabled?: boolean;
  custom_title?: string;
  unit_count?: number;
  has_hn?: boolean;
}

interface TextbookMasterRowProps {
  book: TextbookMasterItem;
  isEnabled: boolean;
  displayCustomTitle: string;
  isEditingThis: boolean;
  isSavingThis: boolean;
  editingTitle: string;
  setEditingTitle: (title: string) => void;
  onStartEdit: (code: string, title: string) => void;
  onCancelEdit: () => void;
  onSaveTitle: (code: string) => void;
  onToggle: (book: any) => void;
  onNavigateToUnits?: (code: string) => void;
  isLight?: boolean;
}

export default function TextbookMasterRow({
  book,
  isEnabled,
  displayCustomTitle,
  isEditingThis,
  isSavingThis,
  editingTitle,
  setEditingTitle,
  onStartEdit,
  onCancelEdit,
  onSaveTitle,
  onToggle,
  onNavigateToUnits,
  isLight = false,
}: TextbookMasterRowProps) {
  const [copied, setCopied] = useState(false);
  const isCommon = book.bookcode?.startsWith('common--');
  const unitCount = book.unit_count || 0;

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(book.bookcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
    }
  };

  return (
    <tr className={`${getRowHoverStyle(isLight)} transition-colors ${!isEnabled ? (isLight ? 'opacity-40 bg-gray-100' : 'opacity-40 bg-black/20') : ''}`}>
      {/* 사용 토글 스위치 */}
      <td className="py-2 px-3 text-center">
        <button
          onClick={() => onToggle(book)}
          disabled={isSavingThis}
          title={isEnabled ? '사용 중 (클릭하여 OFF)' : '숨김 (클릭하여 ON)'}
          className={`inline-flex items-center justify-center p-1 rounded transition-colors text-indigo-400 ${isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-700/50'}`}
        >
          {isSavingThis ? (
            <Loader2 size={16} className="animate-spin text-gray-400" />
          ) : isEnabled ? (
            <ToggleRight size={22} className="text-emerald-500" />
          ) : (
            <ToggleLeft size={22} className={isLight ? 'text-gray-400' : 'text-gray-600'} />
          )}
        </button>
      </td>

      {/* 교재코드 (복사 버튼 포함) */}
      <td className={`py-2 px-3 font-mono text-[11px] max-w-[280px] ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
        <div className="flex items-center gap-1 group/code">
          <span className="truncate" title={book.bookcode}>{book.bookcode}</span>
          <button
            type="button"
            onClick={handleCopyCode}
            title="교재코드 복사"
            className={`p-0.5 rounded opacity-0 group-hover/code:opacity-100 transition-opacity shrink-0 ${isLight ? 'text-gray-400 hover:text-gray-800' : 'text-gray-500 hover:text-white'}`}
          >
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          </button>
        </div>
      </td>

      {/* 본사 기본 교재명 + HN(호크마노트) 배지 */}
      <td className={`py-2 px-3 font-medium max-w-[240px] ${isLight ? 'text-gray-900' : 'text-white'}`}>
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate" title={book.title}>{book.title}</span>
          {book.has_hn && (
            <span
              title="호크마노트(오답노트) 문항 DB 구축 완료"
              className={`px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider shrink-0 select-none ${
                isLight ? 'bg-teal-50 text-teal-700 border border-teal-200 shadow-xs' : 'bg-teal-950 text-teal-300 border border-teal-700/60 shadow-sm shadow-teal-950/50'
              }`}
            >
              HN
            </span>
          )}
        </div>
      </td>

      {/* 우리 학원 맞춤 별칭 */}
      <td className="py-2 px-3">
        {isEditingThis ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveTitle(book.bookcode);
                if (e.key === 'Escape') onCancelEdit();
              }}
              autoFocus
              placeholder="우리 학원 별칭 입력..."
              className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:border-indigo-500 ${
                isLight ? 'bg-white border-indigo-400 text-gray-900' : 'bg-gray-900 border-indigo-500 text-white'
              }`}
            />
            <button
              onClick={() => onSaveTitle(book.bookcode)}
              className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-500"
            >
              <Check size={12} />
            </button>
          </div>
        ) : (
          <div
            onClick={() => onStartEdit(book.bookcode, displayCustomTitle)}
            className={`group flex items-center justify-between cursor-pointer py-1 px-2 rounded transition-colors ${
              isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800/60'
            }`}
          >
            <span className={displayCustomTitle ? (isLight ? 'text-amber-700 font-bold' : 'text-amber-300 font-bold') : (isLight ? 'text-gray-400 italic text-[11px]' : 'text-gray-500 italic text-[11px]')}>
              {displayCustomTitle || '별칭 없음 (기본명 사용)'}
            </span>
            <Edit2 size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </td>

      {/* 학년 */}
      <td className={`py-2 px-3 text-center ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
        {book.grade || '-'}
      </td>

      {/* 구분 (공용 / 자체) */}
      <td className="py-2 px-3 text-center">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
          isLight
            ? (isCommon ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200')
            : (isCommon ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40' : 'bg-purple-900/40 text-purple-300 border border-purple-700/40')
        }`}>
          {isCommon ? '공용' : '자체'}
        </span>
      </td>

      {/* 단원 상태 (완료 / 미완성 및 직행 버튼) */}
      <td className="py-2 px-3 text-center">
        {isCommon ? (
          unitCount > 0 ? (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isLight ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-blue-950/70 text-blue-300 border border-blue-800/50'
            }`}>
              <CheckCircle2 size={10} /> {unitCount}단원
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
              isLight ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-gray-900 text-gray-500 border border-gray-800'
            }`}>
              미완성(0)
            </span>
          )
        ) : (
          unitCount > 0 ? (
            <div className="flex items-center justify-center gap-1">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50'
              }`}>
                <CheckCircle2 size={10} /> {unitCount}단원
              </span>
              {onNavigateToUnits && (
                <button
                  type="button"
                  onClick={() => onNavigateToUnits(book.bookcode)}
                  title="단원 수정으로 이동"
                  className={`p-1 rounded transition-colors ${
                    isLight ? 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100' : 'text-gray-500 hover:text-indigo-300 hover:bg-gray-800'
                  }`}
                >
                  <ArrowRight size={11} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1">
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isLight ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-950/70 text-amber-300 border border-amber-800/50'
              }`}>
                <AlertTriangle size={10} /> 미완성(0)
              </span>
              {onNavigateToUnits && (
                <button
                  type="button"
                  onClick={() => onNavigateToUnits(book.bookcode)}
                  title="두 번째 탭으로 이동하여 단원 입력"
                  className="px-1.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] inline-flex items-center gap-0.5 shadow-sm transition-colors"
                >
                  입력 <ArrowRight size={9} />
                </button>
              )}
            </div>
          )
        )}
      </td>
    </tr>
  );
}
