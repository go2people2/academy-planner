'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Search, FileText, Zap, HelpCircle, ExternalLink, X, Loader2, Library, ChevronDown, ChevronUp, Target, Layers
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PdfLibraryViewProps {
  masterTextbooks: any[];
  academyInfo: any;
  isLight?: boolean;
}

interface BookLinks {
  pdfUrl: string;
  answerUrl: string;
  explanationUrl: string;
  quiz1Url?: string;
  quiz2Url?: string;
  quiz3Url?: string;
  unitPdfUrl?: string;
  unitQuizzesMap?: Record<number, { quiz1Path?: string; quiz2Path?: string; quiz3Path?: string; unitPdfPath?: string }>;
}

export default function PdfLibraryView({ masterTextbooks = [], academyInfo, isLight = false }: PdfLibraryViewProps) {
  const [pdfLinks, setPdfLinks] = useState<Record<string, BookLinks>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'elementary' | 'middle' | 'high' | 'etc'>('all');
  const [activePdfUrl, setActivePdfUrl] = useState<{ title: string; url: string } | null>(null);
  
  // 💡 펼쳐진 교재 코드 (아코디언 토글)
  const [expandedBookCode, setExpandedBookCode] = useState<string | null>(null);

  // 💡 학원 내부 서버 기본 주소
  const [baseServerUrl, setBaseServerUrl] = useState<string>(() => {
    if (academyInfo?.operation_settings?.base_server_url) {
      return academyInfo.operation_settings.base_server_url;
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ams_base_server_url') || 'http://192.168.0.207:8080';
    }
    return 'http://192.168.0.207:8080';
  });

  useEffect(() => {
    if (academyInfo?.operation_settings?.base_server_url) {
      setBaseServerUrl(academyInfo.operation_settings.base_server_url);
    }
  }, [academyInfo?.operation_settings?.base_server_url]);

  // 1. 등록된 교재 PDF 링크 불러오기
  useEffect(() => {
    const loadPdfLinks = async () => {
      if (!academyInfo?.id) return;
      setIsLoading(true);
      try {
        const session = await supabase.auth.getSession();
        const token = session.data?.session?.access_token;
        if (!token) throw new Error('인증 토큰 없음');

        const res = await fetch(`/api/textbooks/pdf?academyId=${academyInfo.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
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

            mapped[p.bookcode] = {
              pdfUrl: p.pdf_url || '',
              answerUrl: p.answer_url || '',
              explanationUrl: p.explanation_url || '',
              quiz1Url: p.quiz1_url || '',
              quiz2Url: p.quiz2_url || '',
              quiz3Url: p.quiz3_url || '',
              unitPdfUrl: p.unit_pdf_url || '',
              unitQuizzesMap: parsedUnitMap
            };
          });
          setPdfLinks(mapped);
        }
      } catch (e) {
        console.error('Failed to load PDF library links:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadPdfLinks();
  }, [academyInfo?.id]);

  // 2. 대분류 학년 카테고리 추출
  const getGradeCategory = (book: any) => {
    const title = (book.title || '').toLowerCase();
    const code = (book.bookcode || '').toLowerCase();
    const gradeCat = (book.grade_category || '').toLowerCase();

    if (gradeCat.includes('초') || title.includes('초등') || code.startsWith('e_')) return 'elementary';
    if (gradeCat.includes('중') || title.includes('중등') || code.startsWith('m_')) return 'middle';

    // 고등 과목 키워드 자동 감지
    const isHighSchool = [
      '고등', '고1', '고2', '고3', 'h_',
      '공수', '공통수학', '수학(상)', '수학(하)', '수상', '수하',
      '수1', '수2', '수학1', '수학2', '확통', '확률', '기하', '미적', '대수'
    ].some(kw => title.includes(kw) || code.includes(kw) || gradeCat.includes(kw));

    if (gradeCat.includes('고') || isHighSchool) return 'high';

    if (title.includes('초')) return 'elementary';
    if (title.includes('중')) return 'middle';
    if (title.includes('고')) return 'high';

    return 'etc';
  };

  // 3. 필터링된 교재 목록
  const filteredBooks = useMemo(() => {
    return masterTextbooks.filter(b => {
      const category = getGradeCategory(b);
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const matchesSearch = !searchQuery.trim() || 
        (b.title && b.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.bookcode && b.bookcode.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [masterTextbooks, activeCategory, searchQuery]);

  // 학원 내부 서버 풀 주소 합성 헬퍼
  const getFullServerUrl = (path?: string) => {
    if (!path || !path.trim()) return '';
    const cleanP = path.trim();
    if (cleanP.startsWith('http://') || cleanP.startsWith('https://')) {
      return cleanP;
    }
    const base = (baseServerUrl || '').replace(/\/+$/, '');
    const relative = cleanP.startsWith('/') ? cleanP : `/${cleanP}`;
    return `${base}${relative}`;
  };

  const openPdf = (title: string, rawUrlOrPath: string) => {
    if (!rawUrlOrPath) return;
    const fullUrl = getFullServerUrl(rawUrlOrPath);
    if (!fullUrl) return;
    window.open(fullUrl, '_blank');
  };

  const toggleExpand = (bookcode: string) => {
    setExpandedBookCode(prev => (prev === bookcode ? null : bookcode));
  };

  // 💡 단원 데이터 추출 (실제 교재 단원 정보가 있으면 정확히 반영)
  const getBookUnits = (book: any) => {
    if (Array.isArray(book.units) && book.units.length > 0) {
      return book.units;
    }
    if (Array.isArray(book.unit_list) && book.unit_list.length > 0) {
      return book.unit_list;
    }
    if (Array.isArray(book.chapters) && book.chapters.length > 0) {
      return book.chapters;
    }
    // 기본 단원 템플릿
    const defaultTitles = [
      '다항식의 연산', '방정식과 부등식', '도형의 방정식', '집합과 명제', 
      '함수와 그래프', '수열', '지수와 로그', '삼각함수'
    ];
    return Array.from({ length: 8 }, (_, i) => ({
      unitNo: i + 1,
      title: defaultTitles[i] || `단원 주제 ${i + 1}`
    }));
  };

  // 단원 제목 깔끔한 포맷팅 (1. [단원제목])
  const formatUnitTitle = (unit: any, idx: number) => {
    const rawTitle = typeof unit === 'string' ? unit : (unit?.title || unit?.name || unit?.unit_name || `단원주제 ${idx + 1}`);
    const cleanTitle = rawTitle.replace(/^(\d+단원|\d+\.|\d+\))\s*/, '').trim();
    return `${idx + 1}. ${cleanTitle || rawTitle}`;
  };

  const handleQuizClick = (book: any, unitIdx: number, unitTitle: string, round: number) => {
    const links = pdfLinks[book.bookcode];
    const unitMap = links?.unitQuizzesMap?.[unitIdx];
    const unitPath = round === 1 ? unitMap?.quiz1Path : round === 2 ? unitMap?.quiz2Path : unitMap?.quiz3Path;
    
    // 단원별 세부 경로가 없으면 교재 대표 경로 fallback
    const fallbackPath = round === 1 ? links?.quiz1Url : round === 2 ? links?.quiz2Url : links?.quiz3Url;
    const finalPath = unitPath || fallbackPath;

    if (finalPath && finalPath.trim() !== '') {
      openPdf(`${book.title} - ${unitTitle} (${round}차 퀴즈)`, finalPath);
    } else {
      alert(`🎯 [${book.title}]\n${unitTitle} - ${round}차 퀴즈 학원 서버 경로가 아직 연결되지 않았습니다.\n(설정(Settings) ➔ '교재 PDF/퀴즈 관리'에서 상대 경로를 입력하시면 바로 열람 가능합니다)`);
    }
  };

  const handleUnitPdfClick = (book: any, unitIdx: number, unitTitle: string) => {
    const links = pdfLinks[book.bookcode];
    const unitMap = links?.unitQuizzesMap?.[unitIdx];
    const unitPath = unitMap?.unitPdfPath || links?.unitPdfUrl;

    if (unitPath && unitPath.trim() !== '') {
      openPdf(`${book.title} - ${unitTitle} (단원 PDF)`, unitPath);
    } else {
      alert(`📂 [${book.title}]\n${unitTitle} - 단원별 PDF 학원 서버 경로가 아직 연결되지 않았습니다.\n(설정(Settings) ➔ '교재 PDF/퀴즈 관리'에서 상대 경로를 입력하시면 바로 열람 가능합니다)`);
    }
  };

  return (
    <div className={`p-6 space-y-6 min-h-screen ${isLight ? 'bg-[#f7f6f3] text-gray-800' : 'bg-[#0f172a] text-gray-100'}`}>
      {/* 📖 상단 타이틀 헤더 */}
      <div className={`p-5 rounded-lg border shadow-sm ${
        isLight ? 'bg-white border-gray-200' : 'bg-slate-900/80 border-slate-800'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <Library size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight">교재 PDF & 퀴즈 자료실</h1>
            <p className="text-xs opacity-70 mt-0.5">
              학원에 등록된 모든 마스터 교재의 본문 PDF, 해설지 및 **단원별 1차·2차·3차 퀴즈**를 한눈에 열람합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 🔍 대분류 탭 & 검색 컨트롤 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* 대분류 필터 탭 */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: '전체 교재' },
            { id: 'elementary', label: '초등' },
            { id: 'middle', label: '중등' },
            { id: 'high', label: '고등' },
            { id: 'etc', label: '기타' }
          ].map(tab => {
            const isActive = activeCategory === tab.id;
            const count = masterTextbooks.filter(b => tab.id === 'all' || getGradeCategory(b) === tab.id).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                className={`px-4 py-2 rounded-md text-xs font-black transition-all flex items-center gap-2 border ${
                  isActive
                    ? isLight
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow'
                      : 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                    : isLight
                      ? 'bg-white hover:bg-gray-100 text-gray-600 border-gray-200'
                      : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-white/20 text-white' : isLight ? 'bg-gray-100 text-gray-500' : 'bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 검색창 */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="교재명 또는 교재코드 검색..."
            className={`w-full pl-10 pr-4 py-2 text-xs rounded-md border outline-none font-bold placeholder:text-gray-400 transition-all ${
              isLight 
                ? 'bg-white border-gray-250 text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500' 
                : 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500/50'
            }`}
          />
        </div>
      </div>

      {/* 📚 교재 카드 목록 리스트 */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 className="animate-spin text-indigo-500" size={24} />
          <span className="text-xs font-bold">등록된 교재 자료를 불러오는 중입니다...</span>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className={`p-12 text-center rounded-lg border text-xs font-bold ${
          isLight ? 'bg-white border-gray-200 text-gray-400' : 'bg-slate-900/40 border-slate-800 text-slate-500'
        }`}>
          검색 조건에 해당하거나 등록된 교재가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {filteredBooks.map(book => {
            const links = pdfLinks[book.bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '' };
            const isExpanded = expandedBookCode === book.bookcode;
            const units = getBookUnits(book);

            return (
              <div 
                key={book.bookcode}
                className={`p-4 rounded-lg border transition-all flex flex-col justify-between gap-4 ${
                  isLight 
                    ? 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md' 
                    : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm tracking-tight line-clamp-1" title={book.title}>
                      {book.title}
                    </h3>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase shrink-0 ${
                      isLight ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {book.bookcode}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-60 mt-1">
                    과목: {book.subject || '일반'} | 학년: {book.grade_category || '공통'}
                  </p>
                </div>

                {/* PDF 링크 기본 버튼 영역 */}
                <div className="space-y-1.5 pt-2 border-t border-dashed border-gray-200 dark:border-slate-800">
                  {/* 1. 본문 PDF */}
                  <button
                    onClick={() => openPdf(`${book.title} - 본문 PDF`, links.pdfUrl)}
                    disabled={!links.pdfUrl}
                    className={`w-full py-1.5 px-3 rounded text-xs font-bold flex items-center justify-between transition-all ${
                      links.pdfUrl
                        ? isLight
                          ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200'
                          : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/20'
                        : isLight
                          ? 'bg-gray-50 text-gray-300 border border-gray-150 cursor-not-allowed'
                          : 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText size={13} />
                      <span>📖 본문 PDF</span>
                    </span>
                    {links.pdfUrl ? <ExternalLink size={12} /> : <span className="text-[10px] opacity-60">미등록</span>}
                  </button>

                  {/* 2. 빠른 답 & 해설 버튼 세트 */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => openPdf(`${book.title} - 빠른 답`, links.answerUrl)}
                      disabled={!links.answerUrl}
                      className={`py-1.5 px-2.5 rounded text-[11px] font-bold flex items-center justify-between transition-all ${
                        links.answerUrl
                          ? isLight
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200'
                            : 'bg-amber-500/10 text-amber-400 hover:bg-amber-600 hover:text-white border border-amber-500/20'
                          : isLight
                            ? 'bg-gray-50 text-gray-300 border border-gray-150 cursor-not-allowed'
                            : 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Zap size={12} />
                        <span>⚡ 빠른답</span>
                      </span>
                      {links.answerUrl ? <ExternalLink size={10} /> : <span className="text-[9px] opacity-60">X</span>}
                    </button>

                    <button
                      onClick={() => openPdf(`${book.title} - 정답 및 해설`, links.explanationUrl)}
                      disabled={!links.explanationUrl}
                      className={`py-1.5 px-2.5 rounded text-[11px] font-bold flex items-center justify-between transition-all ${
                        links.explanationUrl
                          ? isLight
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/20'
                          : isLight
                            ? 'bg-gray-50 text-gray-300 border border-gray-150 cursor-not-allowed'
                            : 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <HelpCircle size={12} />
                        <span>📝 해설</span>
                      </span>
                      {links.explanationUrl ? <ExternalLink size={10} /> : <span className="text-[9px] opacity-60">X</span>}
                    </button>
                  </div>

                  {/* 🎯 단원별 퀴즈 (1차·2차·3차) 아코디언 토글 버튼 */}
                  <button
                    onClick={() => toggleExpand(book.bookcode)}
                    className={`w-full mt-2 py-2 px-3 rounded-md text-xs font-black flex items-center justify-between transition-all border ${
                      isExpanded
                        ? 'bg-purple-600 text-white border-purple-700 shadow-md'
                        : isLight
                          ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                          : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Target size={14} className={isExpanded ? 'animate-pulse' : ''} />
                      <span>🎯 단원별 퀴즈 보기 ({units.length}개 단원)</span>
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* 📂 [아코디언 영역] 단원 리스트 및 1차, 2차, 3차 퀴즈 버튼 */}
                {isExpanded && (
                  <div className={`p-3 rounded-md border space-y-2 mt-1 animate-fadeIn text-xs ${
                    isLight ? 'bg-purple-50/40 border-purple-200' : 'bg-slate-950/60 border-purple-500/20'
                  }`}>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-purple-400 tracking-wider pb-1 border-b border-purple-500/20">
                      <span>단원 목록</span>
                      <span>퀴즈 차수</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar-v">
                      {units.map((unit: any, idx: number) => {
                        const unitTitle = formatUnitTitle(unit, idx);
                        const unitMap = links.unitQuizzesMap?.[idx];

                        return (
                          <div 
                            key={idx}
                            className={`p-2 rounded flex items-center justify-between gap-2 border transition-all ${
                              isLight ? 'bg-white border-gray-200 hover:border-purple-300' : 'bg-slate-900 border-slate-800 hover:border-purple-500/40'
                            }`}
                          >
                            <span className="font-bold text-[11px] truncate flex-1" title={unitTitle}>
                              {unitTitle}
                            </span>

                            {/* 1차, 2차, 3차 퀴즈 및 단원 PDF 버튼 (링크 미등록 시 비활성화 회색) */}
                            <div className="flex items-center gap-1 shrink-0">
                              {[1, 2, 3].map(round => {
                                const unitPath = round === 1 ? unitMap?.quiz1Path : round === 2 ? unitMap?.quiz2Path : unitMap?.quiz3Path;
                                const fallbackPath = round === 1 ? links.quiz1Url : round === 2 ? links.quiz2Url : links.quiz3Url;
                                const hasUrl = !!((unitPath && unitPath.trim()) || (fallbackPath && fallbackPath.trim()));

                                return (
                                  <button
                                    key={round}
                                    onClick={() => handleQuizClick(book, idx, unitTitle, round)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-black transition-all border ${
                                      hasUrl
                                        ? isLight
                                          ? 'bg-purple-100 hover:bg-purple-600 hover:text-white text-purple-800 border-purple-200 shadow-sm'
                                          : 'bg-purple-500/20 hover:bg-purple-600 hover:text-white text-purple-300 border-purple-500/30'
                                        : isLight
                                          ? 'bg-gray-50 text-gray-300 border-gray-150 cursor-not-allowed'
                                          : 'bg-slate-800/40 text-slate-600 border-slate-800/60 cursor-not-allowed'
                                    }`}
                                    title={hasUrl ? `${unitTitle} - ${round}차 퀴즈 열기` : `${round}차 퀴즈 미등록`}
                                  >
                                    {round}차
                                  </button>
                                );
                              })}

                              {/* 4번째 버튼: 단원 PDF */}
                              {(() => {
                                const unitPdfPath = unitMap?.unitPdfPath || links.unitPdfUrl;
                                const hasUnitPdf = !!(unitPdfPath && unitPdfPath.trim());
                                return (
                                  <button
                                    onClick={() => handleUnitPdfClick(book, idx, unitTitle)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-black transition-all border flex items-center gap-0.5 ${
                                      hasUnitPdf
                                        ? isLight
                                          ? 'bg-sky-100 hover:bg-sky-600 hover:text-white text-sky-800 border-sky-200 shadow-sm'
                                          : 'bg-sky-500/20 hover:bg-sky-600 hover:text-white text-sky-300 border-sky-500/30'
                                        : isLight
                                          ? 'bg-gray-50 text-gray-300 border-gray-150 cursor-not-allowed'
                                          : 'bg-slate-800/40 text-slate-600 border-slate-800/60 cursor-not-allowed'
                                    }`}
                                    title={hasUnitPdf ? `${unitTitle} - 단원별 PDF 자료 열기` : '단원 PDF 미등록'}
                                  >
                                    <span>📂 단원PDF</span>
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 📖 인앱 PDF 뷰어 모달 */}
      {activePdfUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col p-4 sm:p-6 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 text-white">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-indigo-400" />
              <h2 className="font-bold text-sm tracking-tight">{activePdfUrl.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={activePdfUrl.url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-bold transition-all flex items-center gap-1"
              >
                <span>새 창으로 열기</span>
                <ExternalLink size={12} />
              </a>
              <button
                onClick={() => setActivePdfUrl(null)}
                className="p-1 rounded hover:bg-white/20 text-gray-300 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
            <iframe
              src={activePdfUrl.url}
              className="w-full h-full border-none"
              title="PDF Viewer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
