'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Plus } from 'lucide-react';
import { getTextbookAuthHeaders } from '@/lib/textbookAuthClient';
import { sortTextbooks, TextbookSortKey, SortDirection } from '@/lib/textbookSort';
import TextbookMasterRow from './TextbookMasterRow';
import AcademyTextbookModal from './AcademyTextbookModal';
import { getCardStyle, getTableHeaderStyle, getTableDivideStyle, getSearchInputStyle, getFilterGroupStyle, getFilterInactiveBtnStyle } from './textbookTheme';

interface TextbookMasterTabProps {
  academyInfo: any;
  masterTextbooks: any[];
  isLight?: boolean;
  onRefresh?: () => void;
  onNavigateToUnits?: (bookcode: string) => void;
}

export default function TextbookMasterTab({
  academyInfo,
  masterTextbooks = [],
  isLight = false,
  onRefresh,
  onNavigateToUnits,
}: TextbookMasterTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<'all' | 'elem' | 'mid' | 'high'>('all');
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<'all' | 'public' | 'custom'>('all');
  const [selectedUsageFilter, setSelectedUsageFilter] = useState<'all' | 'on' | 'off'>('all');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [onlyHn, setOnlyHn] = useState(false);
  const [sortKey, setSortKey] = useState<TextbookSortKey>('bookcode');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  
  // 학원 설정 맵 (bookcode -> { is_enabled: boolean, custom_title?: string })
  const [localSettings, setLocalSettings] = useState<Record<string, { is_enabled: boolean; custom_title: string }>>({});
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleSort = (key: TextbookSortKey) => {
    if (sortKey === key) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // 학년, 공용/자체, 사용여부, 단원상태 및 HN 필터링 + 동적 정렬
  const filteredBooks = useMemo(() => {
    const list = masterTextbooks.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const alias = (localSettings[b.bookcode]?.custom_title ?? b.custom_title ?? '').toLowerCase();
      if (q && !b.title?.toLowerCase().includes(q) && !b.bookcode?.toLowerCase().includes(q) && !alias.includes(q)) return false;

      // 1. 공용 / 자체 구분
      const isCommon = b.bookcode?.startsWith('common--');
      if (selectedScopeFilter === 'public' && !isCommon) return false;
      if (selectedScopeFilter === 'custom' && isCommon) return false;

      // 2. 학년 필터
      if (selectedGradeFilter !== 'all') {
        const g = (b.grade || '').toLowerCase();
        if (selectedGradeFilter === 'elem' && !(g.includes('초') || b.title?.includes('초'))) return false;
        if (selectedGradeFilter === 'mid' && !(g.includes('중') || b.title?.includes('중'))) return false;
        if (selectedGradeFilter === 'high' && !(g.includes('고') || /공수|미적|대수|확통|기하/.test(g || b.title || ''))) return false;
      }

      // 3. 사용 여부 (ON / OFF)
      if (selectedUsageFilter !== 'all') {
        const isEnabled = localSettings[b.bookcode]?.is_enabled ?? (b.is_enabled !== false);
        if (selectedUsageFilter === 'on' && !isEnabled) return false;
        if (selectedUsageFilter === 'off' && isEnabled) return false;
      }

      // 4. 단원 완성 여부
      if (selectedUnitFilter !== 'all') {
        const hasUnits = (b.unit_count || 0) > 0;
        if (selectedUnitFilter === 'completed' && !hasUnits) return false;
        if (selectedUnitFilter === 'incomplete' && hasUnits) return false;
      }

      // 5. 호크마노트(HN) 문항 DB 구축 여부
      if (onlyHn && !b.has_hn) return false;

      return true;
    });

    return sortTextbooks(list, sortKey, sortDir);
  }, [masterTextbooks, searchQuery, selectedGradeFilter, selectedScopeFilter, selectedUsageFilter, selectedUnitFilter, onlyHn, sortKey, sortDir, localSettings]);

  // ON/OFF 토글 핸들러
  const handleToggle = useCallback(async (book: any) => {
    const currentEnabled = localSettings[book.bookcode]?.is_enabled ?? (book.is_enabled !== false);
    const newEnabled = !currentEnabled;
    const currentCustomTitle = localSettings[book.bookcode]?.custom_title ?? (book.custom_title || '');

    // 낙관적 업데이트
    setLocalSettings(prev => ({ ...prev, [book.bookcode]: { is_enabled: newEnabled, custom_title: currentCustomTitle } }));
    setSavingCode(book.bookcode);
    try {
      const res = await fetch('/api/textbooks/settings', {
        method: 'POST',
        headers: getTextbookAuthHeaders(),
        body: JSON.stringify({ bookcode: book.bookcode, is_enabled: newEnabled, custom_title: currentCustomTitle || undefined }),
      });
      if (!res.ok) throw new Error('저장 실패');
      onRefresh?.();
    } catch {
      alert('설정 저장 중 오류가 발생했습니다.');
      setLocalSettings(prev => ({ ...prev, [book.bookcode]: { is_enabled: currentEnabled, custom_title: currentCustomTitle } }));
    } finally {
      setSavingCode(null);
    }
  }, [localSettings, onRefresh]);

  // 별칭 저장 핸들러 (실패 시 편집 상태/입력값 보존)
  const handleSaveTitle = useCallback(async (bookcode: string) => {
    const currentEnabled = localSettings[bookcode]?.is_enabled ?? true;
    const trimmedTitle = editingTitle.trim();
    setSavingCode(bookcode);
    try {
      const res = await fetch('/api/textbooks/settings', {
        method: 'POST',
        headers: getTextbookAuthHeaders(),
        body: JSON.stringify({ bookcode, is_enabled: currentEnabled, custom_title: trimmedTitle || null }),
      });
      if (!res.ok) throw new Error('별칭 저장 실패');
      setLocalSettings(prev => ({ ...prev, [bookcode]: { is_enabled: currentEnabled, custom_title: trimmedTitle } }));
      setEditingCode(null);
      onRefresh?.();
    } catch {
      alert('별칭 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingCode(null);
    }
  }, [editingTitle, localSettings, onRefresh]);

  return (
    <div className="space-y-4">
      {/* 1. 상단 컨트롤 바 (검색 + 학년 필터) */}
      <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded border ${getCardStyle(isLight)}`}>
        <div className="flex flex-wrap items-center gap-2">
          {/* 학년 필터 */}
          <div className={`flex items-center gap-1 p-1 rounded border ${getFilterGroupStyle(isLight)}`}>
            {(['all', 'elem', 'mid', 'high'] as const).map((f) => (
              <button key={f} onClick={() => setSelectedGradeFilter(f)} className={`px-2 py-1 text-xs font-bold rounded transition-colors ${selectedGradeFilter === f ? 'bg-indigo-600 text-white' : getFilterInactiveBtnStyle(isLight)}`}>
                {{ all: '전체', elem: '초등', mid: '중등', high: '고등' }[f]}
              </button>
            ))}
          </div>

          <div className={`h-4 w-px mx-0.5 hidden sm:block ${isLight ? 'bg-gray-300' : 'bg-gray-700'}`} />

          {/* 공용 / 자체 구분 필터 */}
          <div className={`flex items-center gap-1 p-1 rounded border ${getFilterGroupStyle(isLight)}`}>
            {(['all', 'public', 'custom'] as const).map((s) => (
              <button key={s} onClick={() => setSelectedScopeFilter(s)} className={`px-2 py-1 text-xs font-bold rounded transition-colors ${selectedScopeFilter === s ? (s === 'public' ? 'bg-blue-600 text-white' : s === 'custom' ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white') : getFilterInactiveBtnStyle(isLight)}`}>
                {{ all: '전체구분', public: '공용 교재', custom: '학원 자체' }[s]}
              </button>
            ))}
          </div>

          <div className={`h-4 w-px mx-0.5 hidden sm:block ${isLight ? 'bg-gray-300' : 'bg-gray-700'}`} />

          {/* 사용여부 (ON / OFF) 필터 */}
          <div className={`flex items-center gap-1 p-1 rounded border ${getFilterGroupStyle(isLight)}`}>
            {(['all', 'on', 'off'] as const).map((u) => (
              <button key={u} onClick={() => setSelectedUsageFilter(u)} className={`px-2 py-1 text-xs font-bold rounded transition-colors ${selectedUsageFilter === u ? (u === 'on' ? 'bg-emerald-600 text-white' : u === 'off' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white') : getFilterInactiveBtnStyle(isLight)}`}>
                {{ all: '전체상태', on: '사용중 (ON)', off: '미사용 (OFF)' }[u]}
              </button>
            ))}
          </div>

          <div className={`h-4 w-px mx-0.5 hidden sm:block ${isLight ? 'bg-gray-300' : 'bg-gray-700'}`} />

          {/* 단원 상태 (완료 / 미완성) 필터 */}
          <div className={`flex items-center gap-1 p-1 rounded border ${getFilterGroupStyle(isLight)}`}>
            {(['all', 'completed', 'incomplete'] as const).map((uf) => (
              <button key={uf} onClick={() => setSelectedUnitFilter(uf)} className={`px-2 py-1 text-xs font-bold rounded transition-colors ${selectedUnitFilter === uf ? (uf === 'completed' ? 'bg-emerald-600 text-white' : uf === 'incomplete' ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white') : getFilterInactiveBtnStyle(isLight)}`}>
                {{ all: '단원전체', completed: '단원완료', incomplete: '미완성(0개)' }[uf]}
              </button>
            ))}
          </div>

          <div className={`h-4 w-px mx-0.5 hidden sm:block ${isLight ? 'bg-gray-300' : 'bg-gray-700'}`} />

          {/* 호크마노트(HN) 필터 */}
          <button
            type="button"
            onClick={() => setOnlyHn(prev => !prev)}
            className={`px-2 py-1 text-xs font-bold rounded transition-colors border ${
              onlyHn
                ? 'bg-teal-600 border-teal-500 text-white shadow-sm shadow-teal-950/50'
                : (isLight ? 'bg-gray-100 border-gray-200 text-teal-700 hover:text-teal-900 hover:bg-gray-200' : 'bg-gray-900/60 border-gray-800 text-teal-400 hover:text-white hover:bg-gray-800')
            }`}
            title="호크마노트(오답노트) 문항 DB 구축 교재만 보기"
          >
            HN
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="교재명 또는 코드 검색..."
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded border focus:outline-none focus:border-indigo-500 ${getSearchInputStyle(isLight)}`}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-xs flex items-center gap-1 shrink-0 transition-colors shadow-md shadow-purple-950/40"
          >
            <Plus size={13} /> 자체 교재 등록
          </button>
        </div>
      </div>

      {/* 2. 교재 목록 테이블 (정렬 가능한 헤더) */}
      <div className={`border rounded overflow-hidden ${getCardStyle(isLight)}`}>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className={`sticky top-0 z-10 border-b font-bold uppercase tracking-wider ${getTableHeaderStyle(isLight)}`}>
              <tr>
                <th className="py-2.5 px-3 w-16 text-center">사용 여부</th>
                <th className="py-2.5 px-3 w-64">
                  <button onClick={() => handleSort('bookcode')} className={`flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded px-1 -mx-1 ${isLight ? 'hover:text-gray-900' : 'hover:text-white'}`}>
                    교재코드 <span className="text-[10px] text-indigo-400 font-mono">{sortKey === 'bookcode' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button onClick={() => handleSort('title')} className={`flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded px-1 -mx-1 ${isLight ? 'hover:text-gray-900' : 'hover:text-white'}`}>
                    기본 교재명 (본사) <span className="text-[10px] text-indigo-400 font-mono">{sortKey === 'title' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </button>
                </th>
                <th className="py-2.5 px-3 w-56">
                  <button onClick={() => handleSort('custom_title')} className={`flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded px-1 -mx-1 ${isLight ? 'hover:text-gray-900' : 'hover:text-white'}`}>
                    우리 학원 맞춤 별칭 <span className="text-[10px] text-indigo-400 font-mono">{sortKey === 'custom_title' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </button>
                </th>
                <th className="py-2.5 px-3 w-20 text-center">
                  <button onClick={() => handleSort('grade')} className={`inline-flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded px-1 -mx-1 ${isLight ? 'hover:text-gray-900' : 'hover:text-white'}`}>
                    학년 <span className="text-[10px] text-indigo-400 font-mono">{sortKey === 'grade' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </button>
                </th>
                <th className="py-2.5 px-3 w-20 text-center">구분</th>
                <th className="py-2.5 px-3 w-28 text-center">
                  <button onClick={() => handleSort('unit_count')} className={`inline-flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded px-1 -mx-1 ${isLight ? 'hover:text-gray-900' : 'hover:text-white'}`}>
                    단원 상태 <span className="text-[10px] text-indigo-400 font-mono">{sortKey === 'unit_count' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${getTableDivideStyle(isLight)}`}>
              {filteredBooks.map((book) => {
                const setting = localSettings[book.bookcode];
                const isEnabled = setting?.is_enabled ?? (book.is_enabled !== false);
                const displayCustomTitle = setting?.custom_title !== undefined ? setting.custom_title : (book.custom_title || '');

                return (
                  <TextbookMasterRow
                    key={book.bookcode}
                    book={book}
                    isEnabled={isEnabled}
                    displayCustomTitle={displayCustomTitle}
                    isEditingThis={editingCode === book.bookcode}
                    isSavingThis={savingCode === book.bookcode}
                    editingTitle={editingTitle}
                    setEditingTitle={setEditingTitle}
                    onStartEdit={(code, title) => { setEditingCode(code); setEditingTitle(title); }}
                    onCancelEdit={() => setEditingCode(null)}
                    onSaveTitle={handleSaveTitle}
                    onToggle={handleToggle}
                    onNavigateToUnits={onNavigateToUnits}
                    isLight={isLight}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 우리 학원 자체 교재 등록 모달 */}
      <AcademyTextbookModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        academySlug={academyInfo?.slug || ''}
        academyName={academyInfo?.name || ''}
        onSuccess={() => onRefresh?.()}
        isLight={isLight}
      />
    </div>
  );
}
