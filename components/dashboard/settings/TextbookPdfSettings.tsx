'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Save, Trash2, Loader2, AlertCircle, Search, FileText, Zap, HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TextbookPdfSettingsProps {
  academyInfo: any;
  masterTextbooks: any[];
  isLight?: boolean;
}

interface BookLinks {
  pdfUrl: string;
  answerUrl: string;
  explanationUrl: string;
}

export default function TextbookPdfSettings({ academyInfo, masterTextbooks = [], isLight = false }: TextbookPdfSettingsProps) {
  const [pdfsMap, setPdfsMap] = useState<Record<string, BookLinks>>({});
  const [inputMap, setInputMap] = useState<Record<string, BookLinks>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [submittingBook, setSubmittingBook] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'elementary' | 'middle' | 'high' | 'etc'>('all');

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
          mapped[p.bookcode] = {
            pdfUrl: p.pdf_url || '',
            answerUrl: p.answer_url || '',
            explanationUrl: p.explanation_url || ''
          };
        });
        setPdfsMap(mapped);
        setInputMap(mapped); // 입력 폼에도 동기화
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

  // 2. 구글 드라이브 주소 변경 핸들러
  const handleUrlChange = (bookcode: string, field: 'pdfUrl' | 'answerUrl' | 'explanationUrl', val: string) => {
    const base = inputMap[bookcode] || pdfsMap[bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '' };
    setInputMap(prev => ({
      ...prev,
      [bookcode]: {
        ...base,
        [field]: val
      }
    }));
  };

  // 3. 링크 등록 및 저장 (POST)
  const handleSave = async (bookcode: string) => {
    const current = inputMap[bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '' };
    
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
          pdfUrl: current.pdfUrl.trim(),
          answerUrl: current.answerUrl.trim(),
          explanationUrl: current.explanationUrl.trim()
        })
      });

      if (res.ok) {
        const resData = await res.json();
        const savedLinks = {
          pdfUrl: current.pdfUrl.trim(),
          answerUrl: current.answerUrl.trim(),
          explanationUrl: current.explanationUrl.trim()
        };
        setPdfsMap(prev => ({ ...prev, [bookcode]: savedLinks }));
        if (resData.warning) {
          alert(`⚠️ ${resData.warning}`);
        } else {
          alert('구글 드라이브 교재 3종 링크가 안전하게 저장되었습니다.');
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
    const g = (b.grade || b.grade_type || b.category || '').toString().trim();
    const title = (b.title || '').toString().trim();
    const code = (b.bookcode || '').toString().trim();

    if (g.includes('초') || title.includes('초등') || code.startsWith('E_') || code.startsWith('E-')) return 'elementary';
    if (g.includes('중') || title.includes('중등') || code.startsWith('M_') || code.startsWith('M-')) return 'middle';
    if (g.includes('고') || title.includes('고등') || code.startsWith('H_') || code.startsWith('H-')) return 'high';
    return 'etc';
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
      {/* 💡 헤더 안내 영역 */}
      <div className={`p-4 rounded-[4px] border ${
        isLight ? 'bg-blue-50/50 border-blue-200 text-blue-900' : 'bg-blue-500/5 border-blue-500/20 text-blue-200'
      }`}>
        <div className="flex items-start gap-3">
          <BookOpen className="text-blue-500 shrink-0 mt-0.5" size={18} />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-sm">📖 교재별 구글 드라이브 3종 링크 연동 (본문 / 빠른답 / 정답해설)</p>
            <p className="opacity-80">
              학원에서 사용하는 각 마스터 교재별로 **교재 본문, 빠른 답, 정답 및 해설** 구글 드라이브 공유 링크(URL)를 등록해 두시면, 수업 및 숙제 작성 시 개별 버튼으로 즉시 열어보실 수 있습니다.
            </p>
          </div>
        </div>
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
                <th className="py-3 px-4">구글 드라이브 3종 연동 주소</th>
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
                  const saved = pdfsMap[book.bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '' };
                  const current = inputMap[book.bookcode] || { pdfUrl: '', answerUrl: '', explanationUrl: '' };
                  const isPending = submittingBook === book.bookcode;
                  const isModified = 
                    current.pdfUrl.trim() !== saved.pdfUrl.trim() ||
                    current.answerUrl.trim() !== saved.answerUrl.trim() ||
                    current.explanationUrl.trim() !== saved.explanationUrl.trim();
                  const hasAnySaved = !!(saved.pdfUrl || saved.answerUrl || saved.explanationUrl);

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

                      {/* 3종 링크 주소 입력 칸 */}
                      <td className="py-3 px-4 space-y-2">
                        {/* 1. 교재 본문 링크 */}
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-[10px] font-bold text-indigo-500 flex items-center gap-1 shrink-0">
                            <FileText size={11} /> 📖 본문
                          </span>
                          <input 
                            type="text"
                            value={current.pdfUrl}
                            onChange={(e) => handleUrlChange(book.bookcode, 'pdfUrl', e.target.value)}
                            placeholder="https://drive.google.com/file/d/... (본문 PDF URL)"
                            disabled={isPending}
                            className={`w-full border rounded-[2px] px-2.5 py-1 text-xs outline-none font-bold placeholder:text-gray-400 ${
                              isLight 
                                ? 'bg-white border-gray-250 text-gray-800 focus:border-indigo-500' 
                                : 'bg-black/30 border-white/10 text-white focus:border-indigo-500/50'
                            }`}
                          />
                        </div>

                        {/* 2. 빠른 답 링크 */}
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-[10px] font-bold text-amber-500 flex items-center gap-1 shrink-0">
                            <Zap size={11} /> ⚡ 빠른답
                          </span>
                          <input 
                            type="text"
                            value={current.answerUrl}
                            onChange={(e) => handleUrlChange(book.bookcode, 'answerUrl', e.target.value)}
                            placeholder="https://drive.google.com/file/d/... (빠른답 PDF URL)"
                            disabled={isPending}
                            className={`w-full border rounded-[2px] px-2.5 py-1 text-xs outline-none font-bold placeholder:text-gray-400 ${
                              isLight 
                                ? 'bg-white border-gray-250 text-gray-800 focus:border-amber-500' 
                                : 'bg-black/30 border-white/10 text-white focus:border-amber-500/50'
                            }`}
                          />
                        </div>

                        {/* 3. 정답 및 해설 링크 */}
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-[10px] font-bold text-emerald-500 flex items-center gap-1 shrink-0">
                            <HelpCircle size={11} /> 📝 해설
                          </span>
                          <input 
                            type="text"
                            value={current.explanationUrl}
                            onChange={(e) => handleUrlChange(book.bookcode, 'explanationUrl', e.target.value)}
                            placeholder="https://drive.google.com/file/d/... (정답/해설 PDF URL)"
                            disabled={isPending}
                            className={`w-full border rounded-[2px] px-2.5 py-1 text-xs outline-none font-bold placeholder:text-gray-400 ${
                              isLight 
                                ? 'bg-white border-gray-250 text-gray-800 focus:border-emerald-500' 
                                : 'bg-black/30 border-white/10 text-white focus:border-emerald-500/50'
                            }`}
                          />
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
