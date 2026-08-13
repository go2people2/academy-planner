'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Save, Trash2, Loader2, AlertCircle, Search, FileText, Zap, HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TextbookPdfSettingsProps {
  academyInfo: any;
  masterTextbooks: any[];
  onUpdateAcademyInfo?: (updates: any) => Promise<void> | void;
  isLight?: boolean;
}

export interface UnitOverrideItem {
  key: string;
  kind: 'sheet' | 'custom';
  sourceUnitKey?: string;
  sourceIndex?: number;
  sourceLabel?: string;
  startPage?: number | string;
  endPage?: number | string;
  label: string;
}

interface BookLinks {
  pdfUrl: string;
  answerUrl: string;
  explanationUrl: string;
  quiz1Url?: string;
  quiz2Url?: string;
  quiz3Url?: string;
  unitPdfUrl?: string;
  unitQuizzesMap?: Record<string | number, any>;
  unitQuizSettingsOverride?: UnitOverrideItem[] | null;
}

export default function TextbookPdfSettings({ 
  academyInfo, 
  masterTextbooks = [], 
  onUpdateAcademyInfo,
  isLight = false 
}: TextbookPdfSettingsProps) {
  const [pdfsMap, setPdfsMap] = useState<Record<string, BookLinks>>({});
  const [inputMap, setInputMap] = useState<Record<string, BookLinks>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [submittingBook, setSubmittingBook] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'elementary' | 'middle' | 'high' | 'etc'>('all');

  // 💡 펼쳐진 단원별 퀴즈 관리 교재 코드
  const [expandedQuizBookcode, setExpandedBookCode] = useState<string | null>(null);

  // 💡 동적으로 로드한 Google Sheet 단원 목록 캐시
  const [fetchedUnitsMap, setFetchedUnitsMap] = useState<Record<string, any[]>>({});
  const [isFetchingUnits, setIsFetchingUnits] = useState<Record<string, boolean>>({});

  // 💡 학원 내부 서버 기본 주소 (Base Server URL) - DB에 기록된 학원 주소를 최우선 동적 바인딩
  const [baseServerUrl, setBaseServerUrl] = useState<string>(() => {
    if (academyInfo?.operation_settings?.base_server_url) {
      return String(academyInfo.operation_settings.base_server_url).trim();
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_base_server_url');
      if (saved) return saved.trim();
    }
    return '';
  });

  // DB의 학원 정보가 변경되거나 로드되면 입력 필드를 동적으로 최신화
  useEffect(() => {
    if (academyInfo?.operation_settings?.base_server_url) {
      const dbUrl = String(academyInfo.operation_settings.base_server_url).trim();
      setBaseServerUrl(dbUrl);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ams_base_server_url', dbUrl);
      }
    }
  }, [academyInfo?.operation_settings?.base_server_url]);

  const [isCopiedBaseUrl, setIsCopiedBaseUrl] = useState(false);

  const handleSaveBaseServerUrl = async (url: string) => {
    setBaseServerUrl(url);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ams_base_server_url', url);
    }
    // DB 세팅에도 백업 저장
    if (academyInfo?.id) {
      try {
        const opSettings = { ...(academyInfo.operation_settings || {}), base_server_url: url };
        const { data, error } = await supabase
          .from('ams_academies')
          .update({ operation_settings: opSettings })
          .eq('id', academyInfo.id)
          .select('id');

        if (error) {
          console.error('[BaseServerUrl Save Error]', error.message);
          alert(`[DB 저장 실패] 학원 기본 서버 주소를 DB에 저장하지 못했습니다: ${error.message}\n(로컬 브라우저 저장소와 DB 간 주소 불일치가 발생할 수 있습니다.)`);
          return;
        }

        if (!data || data.length !== 1) {
          console.error('[BaseServerUrl Save Error] Row count updated is not 1:', data);
          alert('[DB 저장 실패] 학원 설정 갱신(0건) 실패했습니다. 권한 또는 academy_id를 확인해 주세요.');
          return;
        }

        // DB 저장 성공 후에만 부모 state 갱신
        if (onUpdateAcademyInfo) {
          await onUpdateAcademyInfo({ operation_settings: opSettings });
        }
      } catch (e: any) {
        console.error('[BaseServerUrl Save Exception]', e?.message || e);
        alert(`[DB 저장 예외 발생] 학원 기본 서버 주소 저장 중 예외가 발생했습니다: ${e?.message || '알 수 없는 오류'}`);
      }
    }
  };

  const handleCopyBaseUrl = () => {
    if (!baseServerUrl) return;
    navigator.clipboard.writeText(baseServerUrl);
    setIsCopiedBaseUrl(true);
    setTimeout(() => setIsCopiedBaseUrl(false), 2000);
  };

  // 1. 등록된 PDF 링크 데이터 로드
  const fetchPdfLinks = async () => {
    if (!academyInfo?.id) return;
    setIsLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;

      if (!token) throw new Error('인증 토큰이 없습니다.');

      const res = await fetch(`/api/textbooks/pdf?academyId=${academyInfo.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        const mapped: Record<string, BookLinks> = {};
        (data.pdfs || []).forEach((p: any) => {
          let parsedUnitMap = {};
          if (p.unit_quizzes_json) {
            try {
              parsedUnitMap = typeof p.unit_quizzes_json === 'string' ? JSON.parse(p.unit_quizzes_json) : p.unit_quizzes_json;
            } catch (e) {}
          }

          let parsedOverride: UnitOverrideItem[] | null = null;
          if (p.unit_quiz_settings_json) {
            try {
              parsedOverride = typeof p.unit_quiz_settings_json === 'string' ? JSON.parse(p.unit_quiz_settings_json) : p.unit_quiz_settings_json;
            } catch (e) {}
          }

          mapped[p.bookcode] = {
            pdfUrl: p.pdf_url || '',
            answerUrl: p.answer_url || '',
            explanationUrl: p.explanation_url || '',
            quiz1Url: p.quiz1_url || '',
            quiz2Url: p.quiz2_url || '',
            quiz3Url: p.quiz3_url || '',
            unitPdfUrl: p.unit_pdf_url || '',
            unitQuizzesMap: parsedUnitMap,
            unitQuizSettingsOverride: Array.isArray(parsedOverride) ? parsedOverride : null
          };
        });
        setPdfsMap(mapped);
        setInputMap(mapped);
      }
    } catch (e) {
      console.error('Failed to load textbook PDFs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPdfLinks();
  }, [academyInfo?.id]);

  // 💡 단원 펼치기 시 Google Sheet 단원 동적 로딩
  const handleToggleExpandQuiz = useCallback(async (bookcode: string) => {
    if (expandedQuizBookcode === bookcode) {
      setExpandedBookCode(null);
      return;
    }

    setExpandedBookCode(bookcode);

    // 이미 캐시되었거나 마스터에 유효한 units가 있다면 API 호출 생략
    const currentBook = masterTextbooks.find(b => b.bookcode === bookcode);
    const hasMasterUnits = Array.isArray(currentBook?.units) && currentBook.units.length > 0;
    if (fetchedUnitsMap[bookcode] || hasMasterUnits) {
      return;
    }

    setIsFetchingUnits(prev => ({ ...prev, [bookcode]: true }));
    try {
      const res = await fetch(`/api/textbooks/${bookcode}`);
      if (res.ok) {
        const unitsData = await res.json();
        if (Array.isArray(unitsData)) {
          setFetchedUnitsMap(prev => ({ ...prev, [bookcode]: unitsData }));
        }
      }
    } catch (e) {
      console.error(`Failed to fetch units for ${bookcode}:`, e);
    } finally {
      setIsFetchingUnits(prev => ({ ...prev, [bookcode]: false }));
    }
  }, [expandedQuizBookcode, fetchedUnitsMap, masterTextbooks]);

  // 입력 주소에서 기본 서버 주소를 감지하여 뒷경로만 산뜻하게 추출하는 유틸
  const cleanPath = (rawVal: string) => {
    if (!rawVal) return '';
    let val = rawVal.trim();
    if (baseServerUrl && val.startsWith(baseServerUrl)) {
      val = val.substring(baseServerUrl.length);
    }
    return val;
  };

  // 2. 주소 변경 핸들러
  const handleUrlChange = (bookcode: string, field: 'pdfUrl' | 'answerUrl' | 'explanationUrl' | 'quiz1Url' | 'quiz2Url' | 'quiz3Url' | 'unitPdfUrl', val: string) => {
    const base = inputMap[bookcode] || pdfsMap[bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '', quiz1Url: '', quiz2Url: '', quiz3Url: '', unitPdfUrl: '', unitQuizzesMap: {} };
    setInputMap(prev => ({
      ...prev,
      [bookcode]: {
        ...base,
        [field]: cleanPath(val)
      }
    }));
  };

  // 💡 단원별 퀴즈 상대경로 변경 핸들러 (기존 저장 데이터 손실 방지 병합)
  const handleUnitQuizPathChange = (bookcode: string, unitKey: string | number, field: 'quiz1Path' | 'quiz2Path' | 'quiz3Path' | 'unitPdfPath', val: string) => {
    const saved = pdfsMap[bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '', quiz1Url: '', quiz2Url: '', quiz3Url: '', unitPdfUrl: '', unitQuizzesMap: {} };
    const current = inputMap[bookcode] || saved;
    const currentUnitMap = { ...(saved.unitQuizzesMap || {}), ...(current.unitQuizzesMap || {}) };
    const unitData = { ...(currentUnitMap[unitKey] || {}) };
    
    unitData[field] = cleanPath(val);
    currentUnitMap[unitKey] = unitData;

    setInputMap(prev => ({
      ...prev,
      [bookcode]: {
        ...current,
        unitQuizzesMap: currentUnitMap
      }
    }));
  };

  // 💡 단원 오버라이드 단원명 수정 핸들러
  const handleOverrideLabelChange = (bookcode: string, overrideList: UnitOverrideItem[], targetKey: string, newLabel: string) => {
    const saved = pdfsMap[bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '', quiz1Url: '', quiz2Url: '', quiz3Url: '', unitPdfUrl: '', unitQuizzesMap: {} };
    const current = inputMap[bookcode] || saved;
    const updatedList = overrideList.map(item => item.key === targetKey ? { ...item, label: newLabel } : item);

    setInputMap(prev => ({
      ...prev,
      [bookcode]: {
        ...current,
        unitQuizSettingsOverride: updatedList
      }
    }));
  };

  // 💡 단원 추가 핸들러 ([+ 단원 추가])
  const handleAddCustomUnit = (bookcode: string, currentList: UnitOverrideItem[]) => {
    const saved = pdfsMap[bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '', quiz1Url: '', quiz2Url: '', quiz3Url: '', unitPdfUrl: '', unitQuizzesMap: {} };
    const current = inputMap[bookcode] || saved;
    const newKey = `custom-${crypto.randomUUID()}`;
    const newItem: UnitOverrideItem = {
      key: newKey,
      kind: 'custom',
      label: `단원 ${currentList.length + 1}`
    };

    setInputMap(prev => ({
      ...prev,
      [bookcode]: {
        ...current,
        unitQuizSettingsOverride: [...currentList, newItem]
      }
    }));
  };

  // 💡 단원 삭제 핸들러 (로컬 상태만 제거)
  const handleDeleteOverrideUnit = (bookcode: string, currentList: UnitOverrideItem[], targetKey: string) => {
    const saved = pdfsMap[bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '', quiz1Url: '', quiz2Url: '', quiz3Url: '', unitPdfUrl: '', unitQuizzesMap: {} };
    const current = inputMap[bookcode] || saved;
    const updatedList = currentList.filter(item => item.key !== targetKey);

    setInputMap(prev => ({
      ...prev,
      [bookcode]: {
        ...current,
        unitQuizSettingsOverride: updatedList
      }
    }));
  };

  // 💡 Google Sheet 단원으로 복원 핸들러
  const handleResetToSheetUnits = (bookcode: string) => {
    const saved = pdfsMap[bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '', quiz1Url: '', quiz2Url: '', quiz3Url: '', unitPdfUrl: '', unitQuizzesMap: {} };
    const current = inputMap[bookcode] || saved;

    setInputMap(prev => ({
      ...prev,
      [bookcode]: {
        ...current,
        unitQuizSettingsOverride: null // null로 복원 세팅
      }
    }));
  };

  // 3. 링크 등록 및 저장 (POST)
  const handleSave = async (bookcode: string) => {
    const saved = pdfsMap[bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '', quiz1Url: '', quiz2Url: '', quiz3Url: '', unitPdfUrl: '', unitQuizzesMap: {}, unitQuizSettingsOverride: null };
    const current = inputMap[bookcode] || saved;

    // 삭제 예정 오버라이드 단원 체크 안내
    const isOverrideDefined = current.unitQuizSettingsOverride !== undefined ? current.unitQuizSettingsOverride !== null : saved.unitQuizSettingsOverride !== null;
    if (isOverrideDefined) {
      const confirmSave = confirm('단원 설정 및 연결된 퀴즈/PDF 링크를 저장하시겠습니까?\n(삭제 처리한 단원에 연결된 퀴즈/PDF 링크도 함께 보관 업데이트됩니다)');
      if (!confirmSave) return;
    }

    // 기존 단원별 링크 데이터 손실 방지 병합
    const mergedUnitQuizzesMap = {
      ...(saved.unitQuizzesMap || {}),
      ...(current.unitQuizzesMap || {})
    };

    const finalOverride = current.unitQuizSettingsOverride !== undefined 
      ? current.unitQuizSettingsOverride 
      : (saved.unitQuizSettingsOverride ?? null);
    
    if (submittingBook) return;
    setSubmittingBook(bookcode);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;

      if (!token) throw new Error('인증 토큰이 없습니다.');

      const res = await fetch('/api/textbooks/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          academyId: academyInfo.id,
          bookcode,
          pdfUrl: (current.pdfUrl || '').trim(),
          answerUrl: (current.answerUrl || '').trim(),
          explanationUrl: (current.explanationUrl || '').trim(),
          quiz1Url: (current.quiz1Url || '').trim(),
          quiz2Url: (current.quiz2Url || '').trim(),
          quiz3Url: (current.quiz3Url || '').trim(),
          unitPdfUrl: (current.unitPdfUrl || '').trim(),
          unitQuizzesMap: mergedUnitQuizzesMap,
          unitQuizSettingsJson: finalOverride
        })
      });

      if (res.ok) {
        const resData = await res.json();
        const savedLinks: BookLinks = {
          pdfUrl: (current.pdfUrl || '').trim(),
          answerUrl: (current.answerUrl || '').trim(),
          explanationUrl: (current.explanationUrl || '').trim(),
          quiz1Url: (current.quiz1Url || '').trim(),
          quiz2Url: (current.quiz2Url || '').trim(),
          quiz3Url: (current.quiz3Url || '').trim(),
          unitPdfUrl: (current.unitPdfUrl || '').trim(),
          unitQuizzesMap: mergedUnitQuizzesMap,
          unitQuizSettingsOverride: finalOverride
        };
        setPdfsMap(prev => ({ ...prev, [bookcode]: savedLinks }));
        setInputMap(prev => ({ ...prev, [bookcode]: savedLinks }));
        if (resData.warning) {
          alert(`⚠️ ${resData.warning}`);
        } else {
          alert('교재 PDF 3종 링크가 안전하게 저장되었습니다.');
        }
      } else {
        const errData = await res.json();
        throw new Error(errData.error || '저장 실패');
      }
    } catch (e: any) {
      alert(`저장에 실패했습니다: ${e.message}`);
    } finally {
      setSubmittingBook(null);
    }
  };

  // 4. 링크 해제 및 삭제 (DELETE)
  const handleDelete = async (bookcode: string) => {
    if (!confirm('연결된 교재 3종 링크를 완전히 삭제하시겠습니까?')) return;
    if (submittingBook) return;
    setSubmittingBook(bookcode);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;

      if (!token) throw new Error('인증 토큰이 없습니다.');

      const res = await fetch(`/api/textbooks/pdf?academyId=${academyInfo.id}&bookcode=${bookcode}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setPdfsMap(prev => {
          const next = { ...prev };
          delete next[bookcode];
          return next;
        });
        setInputMap(prev => {
          const next = { ...prev };
          delete next[bookcode];
          return next;
        });
        alert('교재 연동 링크가 삭제되었습니다.');
      } else {
        const errData = await res.json();
        throw new Error(errData.error || '삭제 실패');
      }
    } catch (e: any) {
      alert(`삭제에 실패했습니다: ${e.message}`);
    } finally {
      setSubmittingBook(null);
    }
  };

  // 학교급/학년 분류 헬퍼
  const getGradeCategory = (b: any) => {
    const g = (b.grade || b.grade_type || b.category || b.grade_category || '').toString().trim().toLowerCase();
    const title = (b.title || '').toString().trim().toLowerCase();
    const code = (b.bookcode || '').toString().trim().toLowerCase();
    if (g.includes('초') || title.includes('초등') || code.startsWith('e_') || code.startsWith('e-')) return 'elementary';
    if (g.includes('중') || title.includes('중등') || code.startsWith('m_') || code.startsWith('m-')) return 'middle';

    const isHighSchool = [
      '고등', '고1', '고2', '고3', 'h_', 'h-',
      '공수', '공통수학', '수학(상)', '수학(하)', '수상', '수하',
      '수1', '수2', '수학1', '수학2', '확통', '확률', '기하', '미적', '대수'
    ].some(kw => title.includes(kw) || code.includes(kw) || g.includes(kw));

    if (g.includes('고') || isHighSchool) return 'high';

    return 'etc';
  };

  // 💡 [개발 환경 전용] 집/개발 PC 전용 로컬 미디어 서버 주소 (localStorage ams_dev_media_server_url)
  const [devMediaServerUrl, setDevMediaServerUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ams_dev_media_server_url') || '';
    }
    return '';
  });

  const handleSaveDevMediaServerUrl = (url: string) => {
    setDevMediaServerUrl(url);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ams_dev_media_server_url', url.trim());
    }
  };

  // 필터링 및 검색 로직
  const filteredTextbooks = masterTextbooks.filter(book => {
    const matchesSearch = !searchQuery.trim() || 
      book.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      book.bookcode?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;

    return getGradeCategory(book) === activeTab;
  });

  return (
    <div className="space-y-6">
      {/* 🏛️ 상단 안내 & 기본 서버 주소 설정 */}
      <div className={`p-4 rounded-[6px] border shadow-sm ${
        isLight ? 'bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200 text-indigo-950' : 'bg-gradient-to-r from-indigo-950/40 to-slate-900 border-indigo-500/20 text-indigo-100'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black px-2 py-0.5 rounded bg-indigo-600 text-white uppercase tracking-wider">
                Internal Server
              </span>
              <h3 className="font-bold text-sm">🖥️ 학원 내부 서버 기본 주소 (Base Server URL)</h3>
            </div>
            <p className="text-xs opacity-75">
              학원 로컬 맥미니/파일 서버 주소를 저장하고 복사합니다. 각 입력창에는 <strong>뒷부분 파일 경로</strong>만 적으시면 자동 합성됩니다.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input 
              type="text"
              value={baseServerUrl}
              onChange={(e) => handleSaveBaseServerUrl(e.target.value)}
              placeholder="http://192.168.0.207:8080"
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded border outline-none w-full sm:w-64 ${
                isLight ? 'bg-white border-indigo-250 text-indigo-900 focus:border-indigo-600' : 'bg-slate-900 border-indigo-500/40 text-indigo-200'
              }`}
            />
            <button
              type="button"
              onClick={handleCopyBaseUrl}
              className={`px-3 py-1.5 rounded text-xs font-bold shrink-0 transition-all flex items-center gap-1 border shadow-sm ${
                isCopiedBaseUrl
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700'
              }`}
            >
              {isCopiedBaseUrl ? '✓ 복사됨!' : '📋 기본 주소 복사'}
            </button>
          </div>
        </div>

        {/* 🏠 [개발 환경 전용] 내 로컬 브라우저 전용 미디어 주소 설정 (production 배포 환경 숨김) */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-3 pt-3 border-t border-dashed border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-500/10 p-3 rounded border border-amber-500/30">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-600 text-white tracking-wider">
                  DEV ONLY OVERRIDE
                </span>
                <p className="text-xs font-bold text-amber-300">
                  🏠 [집/개발 PC 전용] 내 로컬 브라우저 전용 미디어 서버 주소
                </p>
              </div>
              <p className="text-[11px] text-amber-200/80">
                학원 공용 DB를 변경하지 않고 현재 내 로컬 브라우저에만 고유하게 저장됩니다. (배포 앱 미노출)
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input 
                type="text"
                value={devMediaServerUrl}
                onChange={(e) => handleSaveDevMediaServerUrl(e.target.value)}
                placeholder="예: http://192.168.0.207:8080"
                className="px-3 py-1.5 text-xs font-mono font-bold rounded border border-amber-500/40 bg-slate-900 text-amber-200 outline-none w-full sm:w-64"
              />
              {devMediaServerUrl && (
                <button
                  type="button"
                  onClick={() => handleSaveDevMediaServerUrl('')}
                  className="px-2 py-1.5 rounded text-xs font-bold bg-amber-800/60 hover:bg-amber-700 text-amber-100 shrink-0"
                >
                  초기화
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🔍 검색 및 탭 컨트롤 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="교재명 또는 교재코드 검색..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-[4px] border outline-none font-bold placeholder:text-gray-400 ${
              isLight ? 'bg-white border-gray-250 text-gray-800 focus:border-blue-500' : 'bg-black/30 border-white/10 text-white focus:border-blue-500/50'
            }`}
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: '전체' },
            { id: 'elementary', label: '초등' },
            { id: 'middle', label: '중등' },
            { id: 'high', label: '고등' },
            { id: 'etc', label: '기타' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const count = masterTextbooks.filter(b => {
              if (tab.id === 'all') return true;
              return getGradeCategory(b) === tab.id;
            }).length;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-[4px] text-xs font-black transition-all flex items-center gap-1.5 border ${
                  isActive
                    ? isLight
                      ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                      : 'bg-blue-600/10 text-blue-400 border-blue-500/30'
                    : isLight
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-transparent'
                      : 'bg-white/5 hover:bg-white/10 text-gray-400 border-transparent'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] font-bold ${isActive ? (isLight ? 'text-blue-100' : 'text-blue-450') : 'text-gray-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 📋 교재 링크 매핑 리스트 테이블 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-500 text-xs font-black">
          <Loader2 className="animate-spin" size={16} />
          교재 연동 데이터 불러오는 중...
        </div>
      ) : (
        <div className={`border rounded-[4px] overflow-hidden ${
          isLight ? 'bg-white border-gray-250 shadow-sm' : 'bg-white/[0.02] border-white/5'
        }`}>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b text-[9px] font-black uppercase tracking-widest ${
                isLight ? 'bg-gray-50 border-gray-200 text-gray-500' : 'border-white/5 text-gray-500 bg-black/20'
              }`}>
                <th className="py-3 px-4 w-[220px]">교재명 (코드)</th>
                <th className="py-3 px-4">교재 PDF & 단원별 퀴즈 뒷경로 연동</th>
                <th className="py-3 px-4 text-center w-[110px] no-print">작업</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-150' : 'divide-white/5'}`}>
              {filteredTextbooks.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-500 font-bold italic">
                    등록되거나 매칭되는 교재가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredTextbooks.map((book) => {
                  const saved = pdfsMap[book.bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '', unitQuizzesMap: {} };
                  const current = inputMap[book.bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '', unitQuizzesMap: {} };
                  const isPending = submittingBook === book.bookcode;
                  const isQuizExpanded = expandedQuizBookcode === book.bookcode;

                  const isModified = 
                    (current.pdfUrl || '').trim() !== (saved.pdfUrl || '').trim() ||
                    (current.answerUrl || '').trim() !== (saved.answerUrl || '').trim() ||
                    (current.explanationUrl || '').trim() !== (saved.explanationUrl || '').trim() ||
                    JSON.stringify(current.unitQuizzesMap || {}) !== JSON.stringify(saved.unitQuizzesMap || {});

                  const hasAnySaved = !!(saved.pdfUrl || saved.answerUrl || saved.explanationUrl || (saved.unitQuizzesMap && Object.keys(saved.unitQuizzesMap).length > 0));

                  // 단원 리스트 구하기 (유효 배열이 있을 때만 사용, 고정 8단원 더미 폴백 제거)
                  const units = Array.isArray(book.units) && book.units.length > 0 ? book.units :
                                Array.isArray(book.unit_list) && book.unit_list.length > 0 ? book.unit_list : [];

                  return (
                    <tr key={book.bookcode} className={`transition-colors font-bold ${
                      isLight ? 'hover:bg-gray-50/50 text-gray-700' : 'hover:bg-white/[0.01] text-gray-300'
                    }`}>
                      {/* 교재 이름 */}
                      <td className="py-3 px-4 align-top">
                        <div className="flex items-start gap-2 pt-1">
                          <BookOpen size={14} className={`mt-0.5 shrink-0 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
                          <div>
                            <span className={isLight ? 'text-gray-850 font-black' : 'text-white'}>{book.title}</span>
                            <div className={`text-[9px] font-mono mt-0.5 ${isLight ? 'text-gray-400' : 'text-gray-600'}`}>{book.bookcode}</div>
                          </div>
                        </div>
                      </td>

                      {/* 3종 링크 주소 및 단원 퀴즈 뒷경로 입력 칸 */}
                      <td className="py-3 px-4 space-y-2">
                        {/* 1. 교재 본문 뒷경로 */}
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-[10px] font-bold text-indigo-500 flex items-center gap-1 shrink-0">
                            <FileText size={11} /> 📖 본문
                          </span>
                          <div className="flex items-center flex-1 rounded border overflow-hidden">
                            <span className={`px-2 py-1 text-[10px] font-mono border-r opacity-60 shrink-0 ${
                              isLight ? 'bg-gray-100 border-gray-250 text-gray-600' : 'bg-slate-800 border-white/10 text-slate-400'
                            }`}>
                              {baseServerUrl}
                            </span>
                            <input 
                              type="text"
                              value={current.pdfUrl || ''}
                              onChange={(e) => handleUrlChange(book.bookcode, 'pdfUrl', e.target.value)}
                              placeholder="/pdf/m_concept/main.pdf"
                              disabled={isPending}
                              className={`w-full px-2.5 py-1 text-xs outline-none font-bold placeholder:text-gray-400 ${
                                isLight 
                                  ? 'bg-white text-gray-800' 
                                  : 'bg-black/30 text-white'
                              }`}
                            />
                          </div>
                        </div>

                        {/* 2. 빠른 답 뒷경로 */}
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-[10px] font-bold text-amber-500 flex items-center gap-1 shrink-0">
                            <Zap size={11} /> ⚡ 빠른답
                          </span>
                          <div className="flex items-center flex-1 rounded border overflow-hidden">
                            <span className={`px-2 py-1 text-[10px] font-mono border-r opacity-60 shrink-0 ${
                              isLight ? 'bg-gray-100 border-gray-250 text-gray-600' : 'bg-slate-800 border-white/10 text-slate-400'
                            }`}>
                              {baseServerUrl}
                            </span>
                            <input 
                              type="text"
                              value={current.answerUrl || ''}
                              onChange={(e) => handleUrlChange(book.bookcode, 'answerUrl', e.target.value)}
                              placeholder="/pdf/m_concept/ans.pdf"
                              disabled={isPending}
                              className={`w-full px-2.5 py-1 text-xs outline-none font-bold placeholder:text-gray-400 ${
                                isLight 
                                  ? 'bg-white text-gray-800' 
                                  : 'bg-black/30 text-white'
                              }`}
                            />
                          </div>
                        </div>

                        {/* 3. 정답 및 해설 뒷경로 */}
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-[10px] font-bold text-emerald-500 flex items-center gap-1 shrink-0">
                            <HelpCircle size={11} /> 📝 해설
                          </span>
                          <div className="flex items-center flex-1 rounded border overflow-hidden">
                            <span className={`px-2 py-1 text-[10px] font-mono border-r opacity-60 shrink-0 ${
                              isLight ? 'bg-gray-100 border-gray-250 text-gray-600' : 'bg-slate-800 border-white/10 text-slate-400'
                            }`}>
                              {baseServerUrl}
                            </span>
                            <input 
                              type="text"
                              value={current.explanationUrl || ''}
                              onChange={(e) => handleUrlChange(book.bookcode, 'explanationUrl', e.target.value)}
                              placeholder="/pdf/m_concept/exp.pdf"
                              disabled={isPending}
                              className={`w-full px-2.5 py-1 text-xs outline-none font-bold placeholder:text-gray-400 ${
                                isLight 
                                  ? 'bg-white text-gray-800' 
                                  : 'bg-black/30 text-white'
                              }`}
                            />
                          </div>
                        </div>

                        {/* 🎯 단원별 1차·2차·3차 퀴즈 뒷경로 개별 설정 서브 아코디언 */}
                        <div className="pt-2">
                          {(() => {
                            // 1. Google Sheet 원본 단원 목록 (동적 로드 캐시 포함)
                            const sheetUnits = fetchedUnitsMap[book.bookcode] || 
                              (Array.isArray(book.units) && book.units.length > 0 ? book.units :
                              Array.isArray(book.unit_list) && book.unit_list.length > 0 ? book.unit_list : []);

                            // 2. 오버라이드 목록 유무 판단
                            const savedOverride = saved.unitQuizSettingsOverride;
                            const currentOverride = current.unitQuizSettingsOverride;
                            const activeOverride = currentOverride !== undefined ? currentOverride : savedOverride;
                            const isOverrideActive = Array.isArray(activeOverride);

                            // 3. 표시할 최종 단원 목록 계산
                            let displayOverrideList: UnitOverrideItem[] = [];
                            if (isOverrideActive && activeOverride) {
                              displayOverrideList = activeOverride;
                            } else {
                              // Google Sheet 원본 단원 기준 오버라이드 맵 자동 구성
                              displayOverrideList = sheetUnits.map((unitObj: any, uIdx: number) => {
                                const rawName = typeof unitObj === 'string' ? unitObj : (unitObj.unit || unitObj.title || unitObj.name || `단원 ${uIdx + 1}`);
                                const normName = String(rawName).trim().replace(/\s+/g, '-');
                                const startP = typeof unitObj === 'object' ? (unitObj.start_page || unitObj.startPage || '0') : '0';
                                const endP = typeof unitObj === 'object' ? (unitObj.end_page || unitObj.endPage || '0') : '0';
                                const sKey = `${book.bookcode}__${normName}__${startP}__${endP}`;

                                return {
                                  key: `sheet-${uIdx}`,
                                  kind: 'sheet',
                                  sourceUnitKey: sKey,
                                  sourceIndex: uIdx,
                                  sourceLabel: rawName,
                                  startPage: startP,
                                  endPage: endP,
                                  label: rawName
                                };
                              });
                            }

                            const isFetching = isFetchingUnits[book.bookcode];

                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleExpandQuiz(book.bookcode)}
                                  className={`w-full py-1.5 px-3 rounded text-xs font-black flex items-center justify-between transition-all border ${
                                    isQuizExpanded
                                      ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                                      : isLight
                                        ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                                        : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>🎯 단원별 퀴즈 & PDF 뒷경로 설정 ({displayOverrideList.length}개 단원)</span>
                                    {isOverrideActive ? (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500 text-white">
                                        설정에서 조정됨 {displayOverrideList.length}개 단원 (원본 {sheetUnits.length}개)
                                      </span>
                                    ) : (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-blue-500/80 text-white">
                                        Google Sheet 기준 {sheetUnits.length}개 단원
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-bold">{isQuizExpanded ? '▲ 닫기' : '▼ 펼치기'}</span>
                                </button>

                                {isQuizExpanded && (
                                  <div className={`p-3 rounded-md border space-y-3 mt-2 text-xs animate-fadeIn ${
                                    isLight ? 'bg-purple-50/30 border-purple-200' : 'bg-slate-950/50 border-purple-500/20'
                                  }`}>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-2 border-purple-500/20">
                                      <p className="text-[11px] opacity-75 font-normal">
                                        💡 단원별 1·2·3차 퀴즈 및 단원 PDF 파일 상대경로를 지정하고 단원명을 직접 수정/추가할 수 있습니다.
                                      </p>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleAddCustomUnit(book.bookcode, displayOverrideList)}
                                          className="px-2.5 py-1 rounded text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-sm flex items-center gap-1"
                                        >
                                          + 단원 추가
                                        </button>
                                        {isOverrideActive && (
                                          <button
                                            type="button"
                                            onClick={() => handleResetToSheetUnits(book.bookcode)}
                                            className="px-2.5 py-1 rounded text-[11px] font-bold bg-gray-600 hover:bg-gray-700 text-white transition-all shadow-sm"
                                            title="수정한 단원 목록을 지우고 Google Sheet 원본 단원으로 되돌립니다 (저장 시 DB 반영)"
                                          >
                                            ↺ Google Sheet 단원으로 복원
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {isFetching ? (
                                      <div className="py-8 text-center text-purple-400 font-bold flex items-center justify-center gap-2">
                                        <Loader2 className="animate-spin" size={16} />
                                        Google Sheet에서 단원 목록 불러오는 중...
                                      </div>
                                    ) : displayOverrideList.length === 0 ? (
                                      <div className={`p-3 text-center rounded border text-xs font-semibold ${
                                        isLight ? 'bg-amber-50/60 border-amber-200 text-amber-800' : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                                      }`}>
                                        등록된 단원 정보가 없습니다. 교재 마스터에서 단원을 먼저 등록하시거나 `[+ 단원 추가]` 버튼으로 단원을 추가해 주세요.
                                      </div>
                                    ) : (
                                      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar-v">
                                        {displayOverrideList.map((item: UnitOverrideItem, uIdx: number) => {
                                          // 💡 퀴즈 매핑 조회 (1차: item.key ➔ 2차: sourceUnitKey ➔ 3차: sourceIndex 호환)
                                          const savedMap = saved.unitQuizzesMap || {};
                                          const currentMap = current.unitQuizzesMap || {};
                                          const mergedMap = { ...savedMap, ...currentMap };

                                          const unitMap = mergedMap[item.key] || 
                                                          (item.sourceUnitKey ? mergedMap[item.sourceUnitKey] : null) || 
                                                          (item.sourceIndex !== undefined ? mergedMap[item.sourceIndex] : null) || 
                                                          {};

                                          const targetQuizKey = item.key;

                                          return (
                                            <div 
                                              key={item.key}
                                              className={`p-2.5 rounded border space-y-2 ${
                                                isLight ? 'bg-white border-purple-150' : 'bg-slate-900 border-slate-800'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between gap-2 border-b pb-1.5 border-purple-500/10">
                                                <div className="flex items-center gap-2 flex-1">
                                                  <span className="font-bold text-xs text-purple-600 dark:text-purple-300 shrink-0">
                                                    {uIdx + 1}.
                                                  </span>
                                                  <input 
                                                    type="text"
                                                    value={item.label}
                                                    onChange={(e) => handleOverrideLabelChange(book.bookcode, displayOverrideList, item.key, e.target.value)}
                                                    placeholder="단원명 입력"
                                                    className={`px-2 py-0.5 text-xs font-black rounded border outline-none flex-1 max-w-sm ${
                                                      isLight ? 'bg-purple-50/50 border-purple-200 text-gray-800 focus:border-purple-500' : 'bg-black/40 border-purple-500/30 text-white focus:border-purple-400'
                                                    }`}
                                                  />
                                                  {item.kind === 'custom' && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-200">
                                                      사용자 추가
                                                    </span>
                                                  )}
                                                  {item.kind === 'sheet' && item.sourceLabel && item.sourceLabel !== item.label && (
                                                    <span className="text-[9px] font-normal opacity-60 italic">
                                                      (원본: {item.sourceLabel})
                                                    </span>
                                                  )}
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteOverrideUnit(book.bookcode, displayOverrideList, item.key)}
                                                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all shrink-0"
                                                  title="이 단원을 화면에서 제거합니다 (저장 시 DB 반영)"
                                                >
                                                  삭제
                                                </button>
                                              </div>

                                              <div className="space-y-1.5 text-[11px] pt-1">
                                                {/* 1차 퀴즈 */}
                                                <div className="flex items-center gap-2 w-full">
                                                  <span className="w-16 font-bold text-purple-500 shrink-0 text-right pr-1">1차 퀴즈</span>
                                                  <div className="flex items-center flex-1 min-w-0 rounded border overflow-hidden">
                                                    {baseServerUrl && (
                                                      <span className={`px-2 py-0.5 text-[10px] font-mono border-r opacity-50 shrink-0 ${
                                                        isLight ? 'bg-gray-100 border-gray-200 text-gray-600' : 'bg-slate-800 border-slate-700 text-slate-400'
                                                      }`}>
                                                        {baseServerUrl}
                                                      </span>
                                                    )}
                                                    <input 
                                                      type="text"
                                                      value={unitMap.quiz1Path || ''}
                                                      onChange={(e) => handleUnitQuizPathChange(book.bookcode, targetQuizKey, 'quiz1Path', e.target.value)}
                                                      placeholder="/pdf/unit1/quiz1_final.pdf"
                                                      className={`w-full min-w-0 flex-1 px-2.5 py-1 text-xs outline-none font-mono font-bold placeholder:text-gray-400 ${
                                                        isLight ? 'bg-white text-gray-800' : 'bg-black/30 text-white'
                                                      }`}
                                                    />
                                                  </div>
                                                </div>

                                                {/* 2차 퀴즈 */}
                                                <div className="flex items-center gap-2 w-full">
                                                  <span className="w-16 font-bold text-purple-400 shrink-0 text-right pr-1">2차 퀴즈</span>
                                                  <div className="flex items-center flex-1 min-w-0 rounded border overflow-hidden">
                                                    {baseServerUrl && (
                                                      <span className={`px-2 py-0.5 text-[10px] font-mono border-r opacity-50 shrink-0 ${
                                                        isLight ? 'bg-gray-100 border-gray-200 text-gray-600' : 'bg-slate-800 border-slate-700 text-slate-400'
                                                      }`}>
                                                        {baseServerUrl}
                                                      </span>
                                                    )}
                                                    <input 
                                                      type="text"
                                                      value={unitMap.quiz2Path || ''}
                                                      onChange={(e) => handleUnitQuizPathChange(book.bookcode, targetQuizKey, 'quiz2Path', e.target.value)}
                                                      placeholder="/pdf/unit1/quiz2_final.pdf"
                                                      className={`w-full min-w-0 flex-1 px-2.5 py-1 text-xs outline-none font-mono font-bold placeholder:text-gray-400 ${
                                                        isLight ? 'bg-white text-gray-800' : 'bg-black/30 text-white'
                                                      }`}
                                                    />
                                                  </div>
                                                </div>

                                                {/* 3차 퀴즈 */}
                                                <div className="flex items-center gap-2 w-full">
                                                  <span className="w-16 font-bold text-purple-300 shrink-0 text-right pr-1">3차 퀴즈</span>
                                                  <div className="flex items-center flex-1 min-w-0 rounded border overflow-hidden">
                                                    {baseServerUrl && (
                                                      <span className={`px-2 py-0.5 text-[10px] font-mono border-r opacity-50 shrink-0 ${
                                                        isLight ? 'bg-gray-100 border-gray-200 text-gray-600' : 'bg-slate-800 border-slate-700 text-slate-400'
                                                      }`}>
                                                        {baseServerUrl}
                                                      </span>
                                                    )}
                                                    <input 
                                                      type="text"
                                                      value={unitMap.quiz3Path || ''}
                                                      onChange={(e) => handleUnitQuizPathChange(book.bookcode, targetQuizKey, 'quiz3Path', e.target.value)}
                                                      placeholder="/pdf/unit1/quiz3_final.pdf"
                                                      className={`w-full min-w-0 flex-1 px-2.5 py-1 text-xs outline-none font-mono font-bold placeholder:text-gray-400 ${
                                                        isLight ? 'bg-white text-gray-800' : 'bg-black/30 text-white'
                                                      }`}
                                                    />
                                                  </div>
                                                </div>

                                                {/* 단원 PDF */}
                                                <div className="flex items-center gap-2 w-full">
                                                  <span className="w-16 font-bold text-sky-400 shrink-0 text-right pr-1">단원 PDF</span>
                                                  <div className="flex items-center flex-1 min-w-0 rounded border overflow-hidden">
                                                    {baseServerUrl && (
                                                      <span className={`px-2 py-0.5 text-[10px] font-mono border-r opacity-50 shrink-0 ${
                                                        isLight ? 'bg-gray-100 border-gray-200 text-gray-600' : 'bg-slate-800 border-slate-700 text-slate-400'
                                                      }`}>
                                                        {baseServerUrl}
                                                      </span>
                                                    )}
                                                    <input 
                                                      type="text"
                                                      value={unitMap.unitPdfPath || ''}
                                                      onChange={(e) => handleUnitQuizPathChange(book.bookcode, targetQuizKey, 'unitPdfPath', e.target.value)}
                                                      placeholder="/pdf/unit1/main_unit.pdf"
                                                      className={`w-full min-w-0 flex-1 px-2.5 py-1 text-xs outline-none font-mono font-bold placeholder:text-gray-400 ${
                                                        isLight ? 'bg-white text-gray-800' : 'bg-black/30 text-white'
                                                      }`}
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>

                      {/* 작업 단추 */}
                      <td className="py-3 px-4 text-center no-print align-top pt-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSave(book.bookcode)}
                            disabled={isPending || (!isModified && hasAnySaved)}
                            className={`px-3 py-1.5 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
                              isPending
                                ? 'opacity-40 cursor-wait'
                                : !isModified && hasAnySaved
                                  ? isLight 
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed'
                                  : isLight
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
                                    : 'bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white'
                            }`}
                          >
                            {isPending && submittingBook === book.bookcode ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Save size={12} />
                            )}
                            저장
                          </button>

                          {hasAnySaved && (
                            <button
                              type="button"
                              onClick={() => handleDelete(book.bookcode)}
                              disabled={isPending}
                              className={`w-8 h-8 rounded-[2px] transition-all flex items-center justify-center border ${
                                isLight
                                  ? 'bg-white border-red-200 text-red-500 hover:bg-red-50'
                                  : 'bg-red-500/5 border-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
                              }`}
                              title="링크 연동 완전 해제"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
