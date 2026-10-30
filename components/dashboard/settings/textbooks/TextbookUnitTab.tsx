'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Save, Loader2, BookOpen, AlertCircle, Lock } from 'lucide-react';
import { getTextbookAuthHeaders } from '@/lib/textbookAuthClient';
import TextbookUnitRow, { UnitRowData } from './TextbookUnitRow';
import { getCardStyle, getTableHeaderStyle, getTableDivideStyle, getSearchInputStyle, getFilterGroupStyle, getFilterInactiveBtnStyle } from './textbookTheme';

type UnitRow = UnitRowData;

interface TextbookUnitTabProps {
  academyInfo: any;
  masterTextbooks: any[];
  isLight?: boolean;
  initialBookcode?: string;
}

export default function TextbookUnitTab({
  academyInfo,
  masterTextbooks = [],
  isLight = false,
  initialBookcode,
}: TextbookUnitTabProps) {
  const [selectedBookcode, setSelectedBookcode] = useState<string>(initialBookcode || '');
  const [bookSearch, setBookSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | 'elem' | 'mid' | 'high'>('all');
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // initialBookcode 변경 시 반영
  useEffect(() => {
    if (initialBookcode) setSelectedBookcode(initialBookcode);
  }, [initialBookcode]);

  // 교재 목록 필터 (검색어 + 학년 뱃지)
  const filteredBooks = useMemo(() => {
    const q = bookSearch.toLowerCase().trim();
    return masterTextbooks.filter(b => {
      if (q && !b.title?.toLowerCase().includes(q) && !b.bookcode?.toLowerCase().includes(q)) return false;
      if (gradeFilter === 'all') return true;
      const g = (b.grade || '').toLowerCase();
      if (gradeFilter === 'elem') return g.includes('초') || b.title?.includes('초');
      if (gradeFilter === 'mid') return g.includes('중') || b.title?.includes('중');
      return g.includes('고') || /공수|미적|대수|확통|기하/.test(g || b.title || '');
    });
  }, [masterTextbooks, bookSearch, gradeFilter]);

  // 교재 자동 선택 (선택된 교재가 없고 목록이 있을 때)
  useEffect(() => {
    if (!selectedBookcode && filteredBooks.length > 0) {
      setSelectedBookcode(filteredBooks[0].bookcode);
    }
  }, [filteredBooks, selectedBookcode]);

  // 선택된 교재의 단원 로드
  const fetchUnits = useCallback(async (code: string) => {
    if (!code) return;
    setIsLoadingUnits(true);
    try {
      const res = await fetch(`/api/textbooks/${code}`);
      if (res.ok) {
        const data = await res.json();
        setUnits((data || []).map((u: any, idx: number) => ({
          id: u.id, bookcode: code, unit_order: idx + 1,
          unit_name: u.unit || u.unit_name || '',
          start_page: parseInt(u.start_page, 10) || 0,
          end_page: parseInt(u.end_page, 10) || 0,
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBookcode) fetchUnits(selectedBookcode);
  }, [selectedBookcode, fetchUnits]);

  const currentBook = masterTextbooks.find(b => b.bookcode === selectedBookcode);
  const isCommon = Boolean(selectedBookcode?.startsWith('common--'));
  const academySlug = academyInfo?.slug;
  const isOwnBook = Boolean(academySlug && selectedBookcode?.startsWith(`${academySlug}--`));
  const isReadOnly = isCommon || !isOwnBook;

  // 단원 행 값 변경
  const handleUnitChange = (index: number, field: keyof UnitRow, val: any) => {
    if (isReadOnly) return;
    setUnits(prev => prev.map((u, i) => (i === index ? { ...u, [field]: val } : u)));
  };

  // 단원 추가
  const handleAddUnit = () => {
    if (!selectedBookcode || isReadOnly) return;
    const nextOrder = units.length + 1;
    const lastUnit = units[units.length - 1];
    const nextStartPage = lastUnit ? lastUnit.end_page + 1 : 1;
    setUnits(prev => [...prev, { bookcode: selectedBookcode, unit_order: nextOrder, unit_name: `단원 ${nextOrder}`, start_page: nextStartPage, end_page: nextStartPage + 10 }]);
  };

  // 단원 삭제
  const handleDeleteUnit = async (index: number) => {
    if (isReadOnly) return;
    const target = units[index];
    if (!confirm(`'${target.unit_name}' 단원을 삭제하시겠습니까?`)) return;

    if (target.id) {
      try {
        const res = await fetch(`/api/textbooks/units?id=${target.id}&bookcode=${target.bookcode}`, {
          method: 'DELETE', headers: getTextbookAuthHeaders(),
        });
        if (!res.ok) throw new Error('삭제 실패');
      } catch {
        alert('단원 삭제 중 오류가 발생했습니다.');
        return;
      }
    }
    setUnits(prev => prev.filter((_, i) => i !== index));
  };

  // 단원 일괄 저장
  const handleSaveAll = async () => {
    if (!selectedBookcode || isReadOnly) return;
    setIsSaving(true);
    try {
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const res = await fetch('/api/textbooks/units', {
          method: 'POST', headers: getTextbookAuthHeaders(),
          body: JSON.stringify({ id: u.id, bookcode: selectedBookcode, unit_order: i + 1, unit_name: u.unit_name, start_page: u.start_page, end_page: u.end_page }),
        });
        if (!res.ok) throw new Error(`단원 ${i + 1} 저장 실패`);
      }
      alert('단원 정보가 성공적으로 저장되었습니다.');
      fetchUnits(selectedBookcode);
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
      {/* 1. 좌측 교재 선택 패널 (4컬럼) */}
      <div className={`md:col-span-4 rounded p-3 space-y-2.5 border ${getCardStyle(isLight)}`}>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={bookSearch}
            onChange={(e) => setBookSearch(e.target.value)}
            placeholder="교재 검색..."
            className={`w-full pl-7 pr-2.5 py-1 text-xs rounded border focus:outline-none focus:border-indigo-500 ${getSearchInputStyle(isLight)}`}
          />
        </div>

        {/* 학년 필터 뱃지 버튼 */}
        <div className={`flex items-center gap-1 p-1 rounded border ${getFilterGroupStyle(isLight)}`}>
          {(['all', 'elem', 'mid', 'high'] as const).map((gf) => {
            const labels = { all: '전체', elem: '초등', mid: '중등', high: '고등' };
            const isActive = gradeFilter === gf;
            return (
              <button
                key={gf}
                onClick={() => setGradeFilter(gf)}
                className={`flex-1 py-1 text-[11px] font-bold rounded transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : getFilterInactiveBtnStyle(isLight)
                }`}
              >
                {labels[gf]}
              </button>
            );
          })}
        </div>

        <div className={`max-h-[550px] overflow-y-auto pr-1 divide-y ${isLight ? 'divide-gray-200' : 'divide-gray-800/40'}`}>
          {filteredBooks.map((b) => {
            const isSelected = b.bookcode === selectedBookcode;
            const isBookCommon = b.bookcode?.startsWith('common--');
            return (
              <button
                key={b.bookcode}
                onClick={() => setSelectedBookcode(b.bookcode)}
                className={`w-full text-left p-2 rounded text-xs transition-colors ${
                  isSelected
                    ? (isLight ? 'bg-indigo-50 border border-indigo-400 text-indigo-950 font-bold' : 'bg-indigo-600/30 border border-indigo-500 text-white font-bold')
                    : (isLight ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200')
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{b.title}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-bold shrink-0 ${
                    isLight
                      ? (isBookCommon ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200')
                      : (isBookCommon ? 'bg-blue-950 text-blue-300 border border-blue-800/40' : 'bg-purple-950 text-purple-300 border border-purple-800/40')
                  }`}>
                    {isBookCommon ? '공용' : '자체'}
                  </span>
                </div>
                <div className={`text-[10px] font-mono truncate mt-0.5 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>{b.bookcode}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 우측 단원 스프레드시트 에디터 (8컬럼) */}
      <div className={`md:col-span-8 rounded p-4 space-y-4 border ${getCardStyle(isLight)}`}>
        {/* 상단 교재 타이틀 및 액션 버튼 */}
        <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-gray-200' : 'border-gray-800'}`}>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-bold flex items-center gap-1.5 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                <BookOpen size={16} className="text-indigo-400" />
                {currentBook?.title || '교재를 선택해 주세요'}
              </h3>
              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium ${
                isReadOnly
                  ? (isLight ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-blue-950/60 text-blue-300 border border-blue-800/60')
                  : (isLight ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-purple-950/60 text-purple-300 border border-purple-800/60')
              }`}>
                {isReadOnly ? <><Lock size={11} /> 공용 표준 교재 (읽기 전용)</> : '우리 학원 자체 교재'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">{selectedBookcode}</p>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddUnit}
                className={`px-2.5 py-1.5 text-xs rounded font-bold inline-flex items-center gap-1 transition-colors ${
                  isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300' : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
              >
                <Plus size={14} /> 단원 추가
              </button>
              <button
                onClick={handleSaveAll}
                disabled={isSaving || units.length === 0}
                className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                저장
              </button>
            </div>
          )}
        </div>

        {/* 단원 목록 스프레드시트 그리드 */}
        {isLoadingUnits ? (
          <div className="py-20 text-center text-gray-500 flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-indigo-400" />
            <span className="text-xs">단원 데이터를 불러오는 중...</span>
          </div>
        ) : units.length === 0 ? (
          <div className={`py-16 text-center text-gray-500 border border-dashed rounded ${isLight ? 'border-gray-300 bg-gray-50/50' : 'border-gray-800'}`}>
            <AlertCircle size={28} className="mx-auto text-gray-600 mb-2" />
            <p className="text-xs">등록된 단원이 없습니다.</p>
            {!isReadOnly && (
              <button onClick={handleAddUnit} className="mt-3 text-xs text-indigo-400 underline font-bold">
                첫 번째 단원 추가하기
              </button>
            )}
          </div>
        ) : (
          <div className={`border rounded overflow-hidden ${isLight ? 'border-gray-200' : 'border-gray-800'}`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead className={`border-b font-bold uppercase tracking-wider ${getTableHeaderStyle(isLight)}`}>
                <tr>
                  <th className="py-2 px-3 w-12 text-center">순서</th>
                  <th className="py-2 px-3">단원명</th>
                  <th className="py-2 px-3 w-24 text-center">시작 p</th>
                  <th className="py-2 px-3 w-24 text-center">끝 p</th>
                  {!isReadOnly && <th className="py-2 px-3 w-12 text-center">삭제</th>}
                </tr>
              </thead>
              <tbody className={`divide-y ${getTableDivideStyle(isLight)}`}>
                {units.map((unit, idx) => (
                  <TextbookUnitRow
                    key={unit.id || `${unit.bookcode}-${idx}`} unit={unit} index={idx}
                    readOnly={isReadOnly} onChange={handleUnitChange} onDelete={handleDeleteUnit} isLight={isLight}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
