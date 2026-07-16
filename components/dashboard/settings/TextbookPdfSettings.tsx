'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Save, Trash2, Loader2, AlertCircle, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TextbookPdfSettingsProps {
  academyInfo: any;
  masterTextbooks: any[];
  isLight?: boolean;
}

export default function TextbookPdfSettings({ academyInfo, masterTextbooks = [], isLight = false }: TextbookPdfSettingsProps) {
  const [pdfsMap, setPdfsMap] = useState<Record<string, string>>({});
  const [inputMap, setInputMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [submittingBook, setSubmittingBook] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
        const mapped: Record<string, string> = {};
        (data.pdfs || []).forEach((p: any) => {
          mapped[p.bookcode] = p.pdf_url;
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
  const handleUrlChange = (bookcode: string, val: string) => {
    setInputMap(prev => ({ ...prev, [bookcode]: val }));
  };

  // 3. 링크 등록 및 저장 (POST)
  const handleSave = async (bookcode: string) => {
    const rawUrl = inputMap[bookcode]?.trim() || '';
    
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
          pdfUrl: rawUrl
        })
      });

      if (res.ok) {
        setPdfsMap(prev => ({ ...prev, [bookcode]: rawUrl }));
        alert('구글 드라이브 교재 링크가 안전하게 저장되었습니다.');
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
    if (!confirm('연결된 교재 링크를 완전히 삭제하시겠습니까?')) return;
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
        setInputMap(prev => ({ ...prev, [bookcode]: '' }));
        alert('링크 연동이 해제되었습니다.');
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

  // 5. 검색 및 정렬 필터링
  const filteredTextbooks = masterTextbooks.filter(b => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return b.title?.toLowerCase().includes(query) || b.bookcode?.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      {/* 💡 구글 드라이브 저작권 및 사용법 안내 배너 */}
      <div className={`p-4 border rounded-[4px] flex items-start gap-3 ${
        isLight 
          ? 'bg-blue-50/50 border-blue-200 text-blue-900 shadow-sm' 
          : 'bg-blue-900/10 border-blue-500/20 text-blue-300'
      }`}>
        <AlertCircle className="shrink-0 mt-0.5" size={16} />
        <div className="space-y-1.5 text-[11px] leading-relaxed">
          <h4 className="font-black uppercase tracking-wider">구글 드라이브 교재 연동 가이드 및 저작권 안내</h4>
          <p className="font-semibold text-gray-500">
            시중 정식 출판 교재의 저작권을 보호하고 구글 계정의 비활성화를 예방하기 위해 아래 공유 방식을 강력히 권장합니다.
          </p>
          <ul className="list-disc pl-4 space-y-1 mt-1 font-medium">
            <li><strong className={isLight ? 'text-blue-950 font-black' : 'text-white'}>저작권 자료 (출판사 문제집)</strong>: 구글 드라이브 공유 설정을 <code className="px-1 py-0.5 rounded bg-black/10 font-bold font-mono">제한됨</code>으로 유지한 채, 소속 선생님들의 구글 이메일만 개별 권한 지정하여 공유해 주세요. (선생님들의 구글 세션으로 안전하게 열람 가능)</li>
            <li><strong className={isLight ? 'text-blue-950 font-black' : 'text-white'}>자체 제작 자료 (프린트, 기출 등)</strong>: 구글 드라이브 공유 옵션을 <code className="px-1 py-0.5 rounded bg-black/10 font-bold font-mono">링크가 있는 모든 사용자에게 뷰어로 공개</code>로 지정하시면 편리하게 즉시 열람할 수 있습니다.</li>
          </ul>
        </div>
      </div>

      {/* 🔍 검색 바 */}
      <div className="relative max-w-md no-print">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
          <Search size={14} />
        </span>
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="교재명 또는 교재 코드로 검색..."
          className={`w-full pl-9 pr-4 py-2 border rounded-[4px] text-xs outline-none font-bold ${
            isLight 
              ? 'bg-white border-gray-250 text-gray-800 placeholder:text-gray-400 focus:border-blue-500' 
              : 'bg-black/40 border-white/10 text-white placeholder:text-gray-650 focus:border-blue-500/50'
          }`}
        />
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
                <th className="py-3 px-4 w-[250px]">교재명 (코드)</th>
                <th className="py-3 px-4">구글 드라이브 / 외부 링크 주소</th>
                <th className="py-3 px-4 text-center w-[120px] no-print">작업</th>
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
                  const savedUrl = pdfsMap[book.bookcode] || '';
                  const currentInput = inputMap[book.bookcode] || '';
                  const isPending = submittingBook === book.bookcode;
                  const isModified = currentInput.trim() !== savedUrl.trim();

                  return (
                    <tr key={book.bookcode} className={`transition-colors font-bold ${
                      isLight ? 'hover:bg-gray-50/50 text-gray-700' : 'hover:bg-white/[0.01] text-gray-300'
                    }`}>
                      {/* 교재 이름 */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <BookOpen size={13} className={isLight ? 'text-gray-400' : 'text-gray-650'} />
                          <div>
                            <span className={isLight ? 'text-gray-850 font-black' : 'text-white'}>{book.title}</span>
                            <div className={`text-[8px] font-mono mt-0.5 ${isLight ? 'text-gray-400' : 'text-gray-600'}`}>{book.bookcode}</div>
                          </div>
                        </div>
                      </td>

                      {/* 링크 주소 입력 칸 */}
                      <td className="py-3 px-4">
                        <input 
                          type="text"
                          value={currentInput}
                          onChange={(e) => handleUrlChange(book.bookcode, e.target.value)}
                          placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                          disabled={isPending}
                          className={`w-full border rounded-[2px] px-3 py-1.5 text-xs outline-none font-bold placeholder:text-gray-450 ${
                            isLight 
                              ? 'bg-white border-gray-250 text-gray-800 focus:border-blue-500' 
                              : 'bg-black/30 border-white/10 text-white focus:border-blue-500/50'
                          }`}
                        />
                      </td>

                      {/* 작업 단추 */}
                      <td className="py-3 px-4 text-center no-print">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSave(book.bookcode)}
                            disabled={isPending || (!isModified && !!savedUrl)}
                            className={`px-3 py-1.5 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
                              isPending
                                ? 'opacity-40 cursor-wait'
                                : !isModified && !!savedUrl
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

                          {savedUrl && (
                            <button
                              type="button"
                              onClick={() => handleDelete(book.bookcode)}
                              disabled={isPending}
                              className={`w-8 h-8 rounded-[2px] transition-all flex items-center justify-center border ${
                                isLight
                                  ? 'bg-white border-red-200 text-red-500 hover:bg-red-50'
                                  : 'bg-red-500/5 border-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
                              }`}
                              title="링크 연동 해제"
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
