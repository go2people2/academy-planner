'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, BookOpen, Save, Loader2, Layers, CheckCircle2, Lock, Unlock, HelpCircle, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getEffectiveBaseServerUrl } from '@/lib/mediaUrl';
import UnitVideoSection from './UnitVideoSection';
import TimelineSection from './TimelineSection';
import RelatedResourcesSection, { ResourceLinkItem } from './RelatedResourcesSection';
import ProblemPageModuleBuilder, { PageModuleData } from './ProblemPageModuleBuilder';

interface TextbookModuleBuilderProps {
  masterTextbooks: any[];
  academyInfo: any;
  isLight?: boolean;
}

export type BookTypeCategory = 'concept' | 'problem' | 'none';

export interface UnitModuleData {
  customUnitName?: string;
  videoPath: string;
  timelineText: string;
  resources: ResourceLinkItem[];
}

export default function TextbookModuleBuilder({
  masterTextbooks = [],
  academyInfo,
  isLight = false
}: TextbookModuleBuilderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'ELEM' | 'MID' | 'HIGH' | 'SAT'>('ALL');
  const [selectedBookcode, setSelectedBookcode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 대분류 카테고리 판별 헬퍼 (수동 지정값 최우선)
  const getBookCategory = (book: any): 'ELEM' | 'MID' | 'HIGH' | 'SAT' => {
    if (!book) return 'HIGH';
    const savedCat = builtModules[book.bookcode]?.category;
    if (savedCat) return savedCat;

    const text = `${book.title || ''} ${book.bookcode || ''} ${book.grade || ''} ${book.subject || ''}`.toLowerCase();

    if (text.includes('수능') || text.includes('기출') || text.includes('모의') || text.includes('자이') || text.includes('마플') || text.includes('sat')) {
      return 'SAT';
    }
    if (text.includes('초등') || text.includes('초1') || text.includes('초2') || text.includes('초3') || text.includes('초4') || text.includes('초5') || text.includes('초6') || text.includes('elem')) {
      return 'ELEM';
    }
    if (text.includes('중등') || text.includes('중1') || text.includes('중2') || text.includes('중3') || text.includes('m1') || text.includes('m2') || text.includes('m3') || text.includes('mid')) {
      return 'MID';
    }
    return 'HIGH'; // 기본값 고등
  };
  
  // 전체 교재 빌드 데이터 (bookType, category, units, pages 포함)
  const [builtModules, setBuiltModules] = useState<Record<string, {
    bookType?: BookTypeCategory;
    category?: 'ELEM' | 'MID' | 'HIGH' | 'SAT';
    units?: Record<number, UnitModuleData>;
    pages?: Record<number, PageModuleData>;
  }>>({});

  // 내부망 기본 서버 주소
  const baseServerUrl = useMemo(() => {
    return getEffectiveBaseServerUrl(academyInfo);
  }, [academyInfo]);

  if (process.env.NODE_ENV !== 'production') {
    console.log('[builder-media-debug]', { baseServerUrl });
  }

  // 1. 학습 모듈 데이터 로드
  useEffect(() => {
    const loadModules = async () => {
      if (!academyInfo?.id) return;
      setIsLoading(true);
      try {
        const session = await supabase.auth.getSession();
        const token = session.data?.session?.access_token;
        if (!token) return;

        const res = await fetch(`/api/learning-hub?academyId=${academyInfo.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          const rawModules = data.modules || {};
          const normalizedModules: Record<string, any> = {};

          // 이전 레거시 데이터 호환성 정규화 (bookType 보장)
          Object.keys(rawModules).forEach(code => {
            const item = rawModules[code];
            if (item && typeof item === 'object') {
              if (item.bookType) {
                normalizedModules[code] = item;
              } else if (item.pages || item.units) {
                normalizedModules[code] = {
                  bookType: 'concept',
                  ...item
                };
              } else {
                // 이전 평탄화 단원 객체인 경우
                normalizedModules[code] = {
                  bookType: 'concept',
                  units: item,
                  pages: {}
                };
              }
            }
          });

          setBuiltModules(normalizedModules);
        }
      } catch (e) {
        console.error('Failed to load learning modules:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadModules();
  }, [academyInfo?.id]);

  // 선택된 교재 객체
  const currentBook = useMemo(() => {
    return masterTextbooks.find(b => b.bookcode === selectedBookcode);
  }, [masterTextbooks, selectedBookcode]);

  // 선택된 교재의 단원 리스트
  const units = useMemo(() => {
    if (!currentBook) return [];
    if (Array.isArray(currentBook.units) && currentBook.units.length > 0) return currentBook.units;
    if (Array.isArray(currentBook.unit_list) && currentBook.unit_list.length > 0) return currentBook.unit_list;
    return Array.from({ length: 8 }, (_, i) => ({ title: `단원 ${i + 1}` }));
  }, [currentBook]);

  // 교재 대분류 + 검색어 필터링
  const filteredBooks = useMemo(() => {
    return masterTextbooks.filter(b => {
      // 1. 대분류 필터
      if (selectedCategory !== 'ALL') {
        const cat = getBookCategory(b);
        if (cat !== selectedCategory) return false;
      }

      // 2. 검색어 필터
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = b.title && b.title.toLowerCase().includes(q);
        const matchesCode = b.bookcode && b.bookcode.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode) return false;
      }

      return true;
    });
  }, [masterTextbooks, selectedCategory, searchQuery]);

  // 현재 교재의 빌드 데이터 (bookType, units, pages)
  const currentBookModule = builtModules[selectedBookcode || ''] || {};
  const currentBookType: BookTypeCategory = currentBookModule.bookType || 'concept';
  const currentBookUnitsData = currentBookModule.units || {};
  const currentBookPagesData = currentBookModule.pages || {};

  // 🔒 스마트 락 조건: 이미 영상 데이터가 1개라도 작성되어 있는지 판단
  const hasExistingVideoData = useMemo(() => {
    if (!selectedBookcode) return false;
    const mod = builtModules[selectedBookcode];
    if (!mod) return false;

    if (mod.units) {
      const hasUnitVid = Object.values(mod.units).some(u => !!u?.videoPath);
      if (hasUnitVid) return true;
    }
    if (mod.pages) {
      const hasPageVid = Object.values(mod.pages).some(p => p.problems?.some(pr => !!pr?.videoPath));
      if (hasPageVid) return true;
    }
    return false;
  }, [builtModules, selectedBookcode]);

  // 대분류 카테고리 변경 함수 (수동 지정)
  const handleChangeCategory = (cat: 'ELEM' | 'MID' | 'HIGH' | 'SAT') => {
    if (!selectedBookcode) return;
    setBuiltModules(prev => ({
      ...prev,
      [selectedBookcode]: {
        ...prev[selectedBookcode],
        category: cat
      }
    }));
    setIsDirty(true);
  };

  // 단원 데이터 업데이트 헬퍼
  const handleUpdateUnitData = (unitIdx: number, field: keyof UnitModuleData, val: any) => {
    if (!selectedBookcode) return;
    const existingBookData = { ...(builtModules[selectedBookcode] || {}) };
    const existingUnits = { ...(existingBookData.units || {}) };
    const existingUnitData = existingUnits[unitIdx] || { videoPath: '', timelineText: '', resources: [] };

    existingUnits[unitIdx] = {
      ...existingUnitData,
      [field]: val
    };

    setBuiltModules(prev => ({
      ...prev,
      [selectedBookcode]: {
        ...existingBookData,
        units: existingUnits
      }
    }));
  };

  // 페이지 데이터 업데이트 헬퍼 (문제집 유형서)
  const handleUpdatePageData = (pageNo: number, pageData: PageModuleData) => {
    if (!selectedBookcode) return;
    const existingBookData = { ...(builtModules[selectedBookcode] || {}) };
    const existingPages = { ...(existingBookData.pages || {}) };

    existingPages[pageNo] = pageData;

    setBuiltModules(prev => ({
      ...prev,
      [selectedBookcode]: {
        ...existingBookData,
        pages: existingPages
      }
    }));
  };

  const handleDeletePageData = (pageNo: number) => {
    if (!selectedBookcode) return;
    const existingBookData = { ...(builtModules[selectedBookcode] || {}) };
    const existingPages = { ...(existingBookData.pages || {}) };
    delete existingPages[pageNo];

    setBuiltModules(prev => ({
      ...prev,
      [selectedBookcode]: {
        ...existingBookData,
        pages: existingPages
      }
    }));
  };

  // 연계 링크 추가/수정/삭제
  const handleAddResource = (unitIdx: number) => {
    const unitData = currentBookUnitsData[unitIdx] || { videoPath: '', timelineText: '', resources: [] };
    const newRes: ResourceLinkItem = {
      id: `res_${Date.now()}`,
      type: 'prerequisite',
      title: '',
      path: ''
    };
    handleUpdateUnitData(unitIdx, 'resources', [...(unitData.resources || []), newRes]);
  };

  const handleUpdateResource = (unitIdx: number, resId: string, field: keyof ResourceLinkItem, val: string) => {
    const unitData = currentBookUnitsData[unitIdx] || { videoPath: '', timelineText: '', resources: [] };
    const updated = (unitData.resources || []).map(r => r.id === resId ? { ...r, [field]: val } : r);
    handleUpdateUnitData(unitIdx, 'resources', updated);
  };

  const handleDeleteResource = (unitIdx: number, resId: string) => {
    const unitData = currentBookUnitsData[unitIdx] || { videoPath: '', timelineText: '', resources: [] };
    const updated = (unitData.resources || []).filter(r => r.id !== resId);
    handleUpdateUnitData(unitIdx, 'resources', updated);
  };

  // 🛡️ 미저장 변경사항 상태 관리 (안전 보장)
  const [isDirty, setIsDirty] = useState(false);

  // 교재 선택 변경 핸들러 (미저장 데이터 안전 보호)
  const handleSelectBookcode = async (targetBookcode: string) => {
    if (selectedBookcode === targetBookcode) return;

    if (isDirty && selectedBookcode) {
      const confirmSave = window.confirm(
        `⚠️ [${currentBook?.title || '현재 교재'}] 의 수정 내용이 아직 저장되지 않았습니다.\n\n[확인]: 저장 후 이동\n[취소]: 저장하지 않고 이동`
      );

      if (confirmSave) {
        await handleSaveModule();
      }
    }

    setIsDirty(false);
    setSelectedBookcode(targetBookcode);
  };

  // 교재 유형 변경 (스마트 락 보호 + isDirty 세팅)
  const handleChangeBookType = (newType: BookTypeCategory) => {
    if (!selectedBookcode) return;
    if (hasExistingVideoData && currentBookType !== newType) {
      const ok = window.confirm('⚠️ 주의: 이미 작성된 영상 경로 데이터가 존재합니다. 포맷 변경 시 일부 화면 노출 방식이 달라질 수 있습니다. 정말 변경하시겠습니까?');
      if (!ok) return;
    }

    setBuiltModules(prev => ({
      ...prev,
      [selectedBookcode]: {
        ...prev[selectedBookcode],
        bookType: newType
      }
    }));
    setIsDirty(true);
  };

  // 저장 (POST)
  const handleSaveModule = async () => {
    if (!selectedBookcode || !academyInfo?.id) return;
    setIsSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      if (!token) throw new Error('인증 토큰 없음');

      const currentCat = getBookCategory(currentBook);

      // 💾 저장할 페이로드 객체 (bookType, category 명시 보장)
      const payloadToSave = {
        bookType: currentBookType,
        category: currentCat,
        units: currentBookUnitsData,
        pages: currentBookPagesData,
        updatedAt: new Date().toISOString()
      };

      const res = await fetch('/api/learning-hub', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          academyId: academyInfo.id,
          bookcode: selectedBookcode,
          moduleData: payloadToSave
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.module) {
          setBuiltModules(prev => ({
            ...prev,
            [selectedBookcode]: data.module
          }));
        }
        setIsDirty(false);
        alert(`🎉 [${currentBook?.title}] (${currentBookType === 'problem' ? '유형서' : currentBookType === 'none' ? 'PDF전용' : '개념서'}) 포맷으로 저장 완료되었습니다!`);
      } else {
        throw new Error('저장 실패');
      }
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 💡 상단 헤더 & 교재 검색 */}
      <div className={`p-4 rounded-md border ${
        isLight ? 'bg-white border-gray-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black flex items-center gap-2">
              <Layers className="text-indigo-500" size={18} />
              <span>🛠️ 교재별 디지털 학습 페이지 저작 빌더</span>
            </h2>
            <p className="text-xs opacity-75 mt-0.5">
              교재를 검색해 고르신 후, 단원별 내부망 영상 연동, 타임스탬프 파트 나누기, 하단 선행 보충 링크를 구축하세요.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="빌드할 교재명 검색..."
              className={`w-full pl-9 pr-3 py-1.5 text-xs rounded border outline-none font-bold placeholder:text-gray-400 ${
                isLight ? 'bg-gray-50 border-gray-250 text-gray-800 focus:border-indigo-500' : 'bg-black/30 border-white/10 text-white'
              }`}
            />
          </div>
        </div>

        {/* 📚 대분류 카테고리 필터 탭 바 */}
        <div className="flex items-center gap-1.5 overflow-x-auto mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
          <span className="text-[11px] font-black text-gray-400 shrink-0 mr-1">대분류:</span>
          {[
            { id: 'ALL', label: '전체' },
            { id: 'ELEM', label: '🎒 초등' },
            { id: 'MID', label: '🏫 중등' },
            { id: 'HIGH', label: '🎓 고등' },
            { id: 'SAT', label: '🏛️ 수능/기출' }
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-black transition-all shrink-0 border ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                  : isLight
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 검색 결과 교재 칩 태그 선택 바 */}
        <div className="flex items-center gap-1.5 overflow-x-auto mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-slate-800">
          {filteredBooks.map(b => {
            const isSelected = selectedBookcode === b.bookcode;
            const moduleData = builtModules[b.bookcode];
            const bookType: BookTypeCategory = moduleData?.bookType || 'concept';
            const isBuilt = !!moduleData;

            // 3가지 포맷별 차별화 색상 지정
            let chipStyle = isLight
              ? 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700';

            if (isBuilt) {
              if (bookType === 'concept') {
                chipStyle = isLight
                  ? 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100'
                  : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/25';
              } else if (bookType === 'problem') {
                chipStyle = isLight
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25';
              } else if (bookType === 'none') {
                chipStyle = isLight
                  ? 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-850';
              }
            }

            if (isSelected) {
              if (bookType === 'problem') {
                chipStyle = 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400';
              } else if (bookType === 'none') {
                chipStyle = 'bg-gray-600 text-white border-gray-700 shadow-md ring-2 ring-gray-400';
              } else {
                chipStyle = 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400';
              }
            }

            return (
              <button
                key={b.bookcode}
                type="button"
                onClick={() => handleSelectBookcode(b.bookcode)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${chipStyle}`}
              >
                <BookOpen size={12} />
                <span>{b.title}</span>
                {isBuilt && (
                  <span className="text-[9px] font-mono font-black px-1 rounded bg-black/20 dark:bg-black/40">
                    {bookType === 'concept' ? '🔵개념' : bookType === 'problem' ? '📙유형' : '⚪PDF'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 선택된 교재 단원별 빌드 작업 영역 */}
      {!selectedBookcode ? (
        <div className={`p-12 text-center rounded-md border text-xs font-bold text-gray-400 ${
          isLight ? 'bg-white border-gray-200' : 'bg-slate-900/40 border-slate-800'
        }`}>
          👈 위 검색창이나 교재 목록에서 학습 페이지를 구축할 교재를 선택해 주세요.
        </div>
      ) : (
        <div className="space-y-4">
          {/* 🔒 교재 포맷 유형 스마트 락 스위처 바 */}
          <div className={`p-3.5 rounded-md border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isLight ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-indigo-500 flex items-center gap-1">
                  {hasExistingVideoData ? <Lock size={14} className="text-amber-400" /> : <Unlock size={14} className="text-emerald-400" />}
                  <span>[{currentBook?.title}] 포맷:</span>
                </span>

                {/* 3종 순환 스위치 버튼 */}
                <div className="flex items-center gap-1 p-1 rounded bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleChangeBookType('concept')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                      currentBookType === 'concept'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🔵 개념서</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChangeBookType('problem')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                      currentBookType === 'problem'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>📙 유형서</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChangeBookType('none')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                      currentBookType === 'none'
                        ? 'bg-gray-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>⚪ PDF전용</span>
                  </button>
                </div>
              </div>

              {/* 대분류 카테고리 수동 수성/지정 스위처 */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200 dark:border-slate-700">
                <span className="text-xs font-bold text-gray-500">대분류 지정:</span>
                <select
                  value={getBookCategory(currentBook)}
                  onChange={(e) => handleChangeCategory(e.target.value as any)}
                  className={`text-xs font-bold px-2.5 py-1 rounded border outline-none ${
                    isLight ? 'bg-white border-indigo-200 text-indigo-900' : 'bg-slate-950 border-slate-700 text-indigo-300'
                  }`}
                >
                  <option value="ELEM">🎒 초등</option>
                  <option value="MID">🏫 중등</option>
                  <option value="HIGH">🎓 고등</option>
                  <option value="SAT">🏛️ 수능/기출</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveModule}
              disabled={isSaving}
              className="px-4 py-2 rounded text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 shadow-md flex items-center gap-1.5 transition-all shrink-0"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>💾 교재 학습장 빌드 저장</span>
            </button>
          </div>

          {/* 포맷 1: 개념서 포맷 (단원별 영상 + 타임라인) */}
          {currentBookType === 'concept' && (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar-v">
              {units.map((unit: any, uIdx: number) => {
                const defaultUnitName = typeof unit === 'string' ? unit : (unit.title || unit.name || `단원 ${uIdx + 1}`);
                const uData = currentBookUnitsData[uIdx] || { customUnitName: '', videoPath: '', timelineText: '', resources: [] };

                return (
                  <div key={uIdx} className={`p-4 rounded-md border space-y-3 ${
                    isLight ? 'bg-white border-gray-200' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <UnitVideoSection
                      unitIdx={uIdx}
                      unitName={defaultUnitName}
                      customUnitName={uData.customUnitName !== undefined ? uData.customUnitName : defaultUnitName}
                      videoPath={uData.videoPath || ''}
                      baseServerUrl={baseServerUrl}
                      onChangeUnitName={(val) => handleUpdateUnitData(uIdx, 'customUnitName', val)}
                      onChangeVideoPath={(val) => handleUpdateUnitData(uIdx, 'videoPath', val)}
                      isLight={isLight}
                    />

                    <TimelineSection
                      timelineText={uData.timelineText || ''}
                      onChangeTimelineText={(val) => handleUpdateUnitData(uIdx, 'timelineText', val)}
                      isLight={isLight}
                    />

                    <RelatedResourcesSection
                      resources={uData.resources || []}
                      baseServerUrl={baseServerUrl}
                      onAddResource={() => handleAddResource(uIdx)}
                      onUpdateResource={(rId, field, val) => handleUpdateResource(uIdx, rId, field, val)}
                      onDeleteResource={(rId) => handleDeleteResource(uIdx, rId)}
                      isLight={isLight}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* 포맷 2: 문제집 / 유형서 포맷 (페이지 & 문항별) */}
          {currentBookType === 'problem' && (
            <ProblemPageModuleBuilder
              pageDataMap={currentBookPagesData}
              baseServerUrl={baseServerUrl}
              onUpdatePageData={handleUpdatePageData}
              onDeletePageData={handleDeletePageData}
              isLight={isLight}
            />
          )}

          {/* 포맷 3: 영상 없음 / PDF 전용 */}
          {currentBookType === 'none' && (
            <div className={`p-8 rounded-md border text-center space-y-2 ${
              isLight ? 'bg-gray-50 border-gray-200 text-gray-600' : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <BookOpen size={24} className="mx-auto opacity-50 text-indigo-500" />
              <h4 className="font-black text-xs">[영상 없음] 상태로 설정되었습니다.</h4>
              <p className="text-[11px] opacity-75">
                이 교재는 동영상 플레이어 없이 PDF 자료실 기본 보기용으로 사용되며, 학생 동영상 서랍에서는 자동으로 감춰집니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
