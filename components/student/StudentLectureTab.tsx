'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Video, BookOpen, Film, Play, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { getEffectiveBaseServerUrl, openMediaVideo } from '@/lib/mediaUrl';
import { supabase } from '@/lib/supabase';

interface StudentLectureTabProps {
  student: any;
  availableTextbooks: any[];
  academy: any;
  isLight?: boolean;
}

export default function StudentLectureTab({
  student,
  availableTextbooks = [],
  academy,
  isLight = false
}: StudentLectureTabProps) {
  const [selectedBookcode, setSelectedBookcode] = useState<string | null>(null);
  const [builtModules, setBuiltModules] = useState<Record<string, any>>({});
  const [fetchedUnitsMap, setFetchedUnitsMap] = useState<Record<string, any[]>>({});
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [isApiError, setIsApiError] = useState(false);

  // 1. 학원 AMF 미디어 서버 기본 주소
  const baseServerUrl = useMemo(() => {
    return getEffectiveBaseServerUrl(academy);
  }, [academy]);

  // 2. 학생에게 배정된 교재 목록 파싱
  const assignedBooks = useMemo(() => {
    if (!student || !availableTextbooks.length) return [];
    
    let assignedCodes: string[] = [];
    const bookCourses = student.book_courses;
    
    if (bookCourses && typeof bookCourses === 'object') {
      Object.keys(bookCourses).forEach(key => {
        if (!key.startsWith('__') && !key.startsWith("'__")) {
          assignedCodes.push(key.trim().toLowerCase());
        }
      });
    }

    if (assignedCodes.length === 0 && Array.isArray(student.assigned_books)) {
      assignedCodes = student.assigned_books.map((b: string) => String(b).trim().toLowerCase());
    }

    if (assignedCodes.length === 0) {
      return availableTextbooks.slice(0, 5); // Fallback 노출
    }

    return availableTextbooks.filter(tb => {
      const code = (tb.bookcode || tb.id || '').trim().toLowerCase();
      return assignedCodes.includes(code);
    });
  }, [student, availableTextbooks]);

  // 3. 현재 학원의 교재 모듈(영상 메타데이터) 로드
  useEffect(() => {
    const fetchLearningModules = async () => {
      if (!academy?.id) return;
      setIsLoadingModules(true);
      try {
        const session = await supabase.auth.getSession();
        const token = session.data?.session?.access_token;
        if (!token) return;

        const res = await fetch(`/api/learning-hub?academyId=${academy.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setBuiltModules(data.modules || {});
        }
      } catch (e) {
        console.error('[StudentLectureTab] Module load error:', e);
      } finally {
        setIsLoadingModules(false);
      }
    };

    fetchLearningModules();
  }, [academy?.id]);

  // 선택된 교재의 구글 시트 단원 로드 (배열 파싱 안전화 적용)
  const fetchUnitsForBook = useCallback(async (bookcode: string) => {
    setIsLoadingUnits(true);
    setIsApiError(false);
    try {
      const res = await fetch(`/api/textbooks/${encodeURIComponent(bookcode)}`);
      if (res.ok) {
        const rawData = await res.json();
        // 💡 [핵심] API가 배열 자체로 반환하는 경우와 { units: [...] } 형태 모두 안전 처리
        const unitsList = Array.isArray(rawData) ? rawData : (rawData?.units ?? []);
        setFetchedUnitsMap(prev => ({
          ...prev,
          [bookcode]: unitsList
        }));
      } else {
        setIsApiError(true);
      }
    } catch (e) {
      console.error('[StudentLectureTab] Units load error:', e);
      setIsApiError(true);
    } finally {
      setIsLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedBookcode) return;
    if (fetchedUnitsMap[selectedBookcode]) return;
    fetchUnitsForBook(selectedBookcode);
  }, [selectedBookcode, fetchedUnitsMap, fetchUnitsForBook]);

  // 현재 선택된 교재 정보
  const currentBook = useMemo(() => {
    if (!selectedBookcode) return null;
    return assignedBooks.find(b => (b.bookcode || b.id || '').trim().toLowerCase() === selectedBookcode.toLowerCase());
  }, [selectedBookcode, assignedBooks]);

  // 현재 교재의 단원 목록
  const currentUnits = useMemo(() => {
    if (!selectedBookcode) return [];
    return fetchedUnitsMap[selectedBookcode] || [];
  }, [selectedBookcode, fetchedUnitsMap]);

  // 현재 교재의 빌드된 영상 모듈 메타데이터
  const currentModule = useMemo(() => {
    if (!selectedBookcode) return null;
    return builtModules[selectedBookcode] || null;
  }, [selectedBookcode, builtModules]);

  // 🎬 영상 재생 클릭 핸들러 (전역 VideoPlayerModal 팝업 트리거)
  const handlePlayVideo = (videoPath: string, unitName: string, timelineText?: string) => {
    if (!videoPath) return;

    if (!baseServerUrl) {
      alert('학원 AMF 미디어 서버 주소가 설정되지 않았습니다. Settings(또는 집 개발 모드 전용 입력창)에서 미디어 서버 주소를 먼저 설정해 주세요.');
      return;
    }

    const title = `${currentBook?.title || '교재'} - ${unitName}`;
    openMediaVideo(videoPath, academy, title, timelineText);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* 📚 1. 내 배정 교재 서랍 카탈로그 */}
      <div className={`p-4 rounded-xl border shadow-sm ${
        isLight ? 'bg-white border-gray-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-slate-800">
          <h3 className="text-xs font-black flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">
            <Video size={16} />
            <span>📺 내 수강 교재 강의 목록 ({assignedBooks.length}권)</span>
          </h3>
          {!baseServerUrl && (
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              ⚠️ AMF 미디어 서버 설정 필요
            </span>
          )}
        </div>

        {/* 배정된 교재가 없을 때 빈 안내 */}
        {assignedBooks.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <BookOpen size={28} className="mx-auto text-gray-400 opacity-40" />
            <p className="text-xs font-bold text-gray-400">
              현재 학생에게 배정된 교재가 없습니다.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto pt-3 pb-1 custom-scrollbar-h">
            {assignedBooks.map(book => {
              const code = (book.bookcode || book.id || '').trim();
              const isSelected = selectedBookcode?.toLowerCase() === code.toLowerCase();
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setSelectedBookcode(code)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 border flex items-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md scale-105'
                      : isLight
                        ? 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                        : 'bg-black/40 hover:bg-black/70 text-slate-300 border-slate-800'
                  }`}
                >
                  <Film size={14} className={isSelected ? 'text-white' : 'text-indigo-400'} />
                  <span>{book.title || code}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 📺 2. 선택된 교재의 단원별 강의 영상 목록 */}
      {selectedBookcode && (
        <div className={`p-4 rounded-xl border shadow-sm space-y-3 ${
          isLight ? 'bg-white border-gray-200' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-2">
              <span>📗 {currentBook?.title} 단원 강의 목록</span>
            </h4>
          </div>

          {/* 💡 상태 표기 규격화 */}
          {isLoadingUnits || isLoadingModules ? (
            <div className="flex items-center justify-center py-12 gap-2 text-xs font-bold text-gray-400">
              <Loader2 size={18} className="animate-spin text-indigo-500" />
              <span>단원 목차를 불러오는 중입니다.</span>
            </div>
          ) : isApiError ? (
            <div className="text-center py-10 space-y-2 text-xs font-bold text-rose-400">
              <p>단원 정보를 불러오지 못했습니다. 다시 시도해 주세요.</p>
              <button
                type="button"
                onClick={() => fetchUnitsForBook(selectedBookcode)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] inline-flex items-center gap-1"
              >
                <RefreshCw size={12} />
                <span>다시 시도</span>
              </button>
            </div>
          ) : currentUnits.length === 0 ? (
            <div className="text-center py-10 text-xs font-bold text-gray-400 italic">
              등록된 단원 또는 강의가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {currentUnits.map((u, idx) => {
                const unitName = typeof u === 'string' ? u : (u.unit || u.title || `단원 ${idx + 1}`);
                
                // 💡 [핵심] StudentCoursePlayer와 1:1 매칭되는 실제 등록 영상 메타데이터만 획득 (임의 표준 경로 추정 금지!)
                const unitData = currentModule?.units?.[idx] || currentModule?.units?.[idx + 1] || {};
                const registeredVideoPath = unitData.videoPath || '';
                const timelineText = unitData.timelineText || '';

                return (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
                      isLight ? 'bg-gray-50 border-gray-200 hover:border-indigo-300' : 'bg-black/30 border-slate-800/80 hover:border-indigo-500/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          단원 {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-100">{unitName}</span>
                      </div>
                      {u.start_page && u.end_page && (
                        <p className="text-[11px] text-gray-400 font-mono">
                          페이지: p.{u.start_page} ~ p.{u.end_page}
                        </p>
                      )}
                    </div>

                    {registeredVideoPath ? (
                      <button
                        type="button"
                        onClick={() => handlePlayVideo(registeredVideoPath, unitName, timelineText)}
                        className="px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow transition-all active:scale-95 shrink-0"
                      >
                        <Play size={13} className="fill-current" />
                        <span>강의 시청</span>
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded text-[11px] font-bold text-gray-500 bg-white/5 border border-white/5 shrink-0">
                        강의 준비 중
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
