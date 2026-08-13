'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Film, 
  Clock, 
  ChevronRight, 
  RotateCcw, 
  RotateCw, 
  Maximize2, 
  Loader2, 
  AlertTriangle, 
  RefreshCw, 
  FileText 
} from 'lucide-react';
import StudentResourceLinks from './StudentResourceLinks';
import { openMediaPdf } from '@/lib/mediaUrl';
import { UnitModuleData } from '../learningBuilder/TextbookModuleBuilder';
import { PageModuleData, ProblemVideoItem } from '../learningBuilder/ProblemPageModuleBuilder';

interface StudentCoursePlayerProps {
  bookTitle: string;
  units: any[];
  bookModule: any;
  baseServerUrl: string;
  isLight?: boolean;
}

const SEEK_STEP_SECONDS = 10; // 10초 앞/뒤 이동 상수
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

export default function StudentCoursePlayer({
  bookTitle,
  units = [],
  bookModule = {},
  baseServerUrl,
  isLight = false
}: StudentCoursePlayerProps) {
  const [selectedUnitIdx, setSelectedUnitIdx] = useState(0);
  const [selectedPageNo, setSelectedPageNo] = useState<number>(45);
  const [selectedProblemVideo, setSelectedProblemVideo] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // 🎬 미디어 상태 및 타이머 관리
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [currentRate, setCurrentRate] = useState<number>(1);

  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSeekingRef = useRef<boolean>(false);

  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  const bookType = bookModule?.bookType || 'concept';
  const unitsData = bookModule?.units || {};
  const pagesData: Record<number, PageModuleData> = bookModule?.pages || {};

  // 현재 단원 모듈 데이터
  const currentUnitData = unitsData[selectedUnitIdx] || { videoPath: '', timelineText: '', resources: [] };
  const currentPageData = pagesData[selectedPageNo] || { pageNo: selectedPageNo, problems: [] };

  // 비디오 풀 URL 생성 헬퍼
  const getFullUrl = useCallback((path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = (baseServerUrl || '').replace(/\/+$/, '');
    const rel = path.startsWith('/') ? path : `/${path}`;
    return `${base}${rel}`;
  }, [baseServerUrl]);

  const activeVideoUrl = bookType === 'problem' 
    ? getFullUrl(selectedProblemVideo)
    : getFullUrl(currentUnitData.videoPath);

  // 연관 PDF 리소스 확인 (중복 없는 1:1 직결 연관 PDF)
  const activePdfUrl = useMemo(() => {
    if (!currentUnitData?.resources || !Array.isArray(currentUnitData.resources)) return '';
    const pdfRes = currentUnitData.resources.find((r: any) => 
      r && (r.type === 'pdf' || (r.url && typeof r.url === 'string' && r.url.toLowerCase().endsWith('.pdf')))
    );
    if (!pdfRes || !pdfRes.url) return '';
    
    const path = pdfRes.url.trim();
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = (baseServerUrl || '').replace(/\/+$/, '');
    const rel = path.startsWith('/') ? path : `/${path}`;
    return `${base}${rel}`;
  }, [currentUnitData?.resources, baseServerUrl]);

  // 비디오 URL 변경 시 미디어 상태 및 타이머 안전 초기화
  useEffect(() => {
    clearLoadingTimeout();
    isSeekingRef.current = false;
    setIsLoading(!!activeVideoUrl);
    setIsError(false);
    setIsPlaying(false);
    setCurrentRate(1);
    if (videoRef.current) {
      try {
        videoRef.current.playbackRate = 1;
      } catch (e) {
        // ignore
      }
    }

    return () => {
      clearLoadingTimeout();
    };
  }, [activeVideoUrl, clearLoadingTimeout]);

  // 컴포넌트 unmount 시 cleanup
  useEffect(() => {
    return () => {
      clearLoadingTimeout();
    };
  }, [clearLoadingTimeout]);

  // 🎥 비디오 이벤트 기반 상태 핸들러
  const handleLoadStart = () => {
    clearLoadingTimeout();
    isSeekingRef.current = false;
    setIsLoading(true);
    setIsError(false);
  };

  const handleWaiting = () => {
    // seek 진행 중이거나 seek 타이머 대기 중일 때는 즉시 켜지 않고 300ms 타이머에 위임하여 깜빡임 방지
    if (isSeekingRef.current || loadingTimeoutRef.current !== null) {
      return;
    }
    setIsLoading(true);
  };

  const handleSeeking = () => {
    isSeekingRef.current = true;
    clearLoadingTimeout();
    // 300ms 이상 탐색이 길어질 때만 로딩 오버레이 켜기 (연속 클릭 시 깜빡임 완벽 방지)
    loadingTimeoutRef.current = setTimeout(() => {
      if (isSeekingRef.current) {
        setIsLoading(true);
      }
    }, 300);
  };

  const handleCanPlay = () => {
    clearLoadingTimeout();
    isSeekingRef.current = false;
    setIsLoading(false);
  };

  const handlePlaying = () => {
    clearLoadingTimeout();
    isSeekingRef.current = false;
    setIsLoading(false);
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleSeeked = () => {
    clearLoadingTimeout();
    isSeekingRef.current = false;
    setIsLoading(false);
  };

  const handleEnded = () => {
    clearLoadingTimeout();
    isSeekingRef.current = false;
    setIsPlaying(false);
    setIsLoading(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    clearLoadingTimeout();
    isSeekingRef.current = false;
    setIsLoading(false);
    setIsPlaying(false);
    setIsError(true);
    if (process.env.NODE_ENV !== 'production') {
      const err = e.currentTarget.error;
      console.error('[StudentCoursePlayer Video Error]', {
        code: err?.code,
        message: err?.message,
        src: activeVideoUrl
      });
    }
  };

  // 🔄 다시 시도 로직
  const handleRetry = () => {
    clearLoadingTimeout();
    isSeekingRef.current = false;
    setIsError(false);
    setIsLoading(true);
    if (videoRef.current) {
      try {
        videoRef.current.load();
      } catch (err) {
        console.error('[Video Load Retry Error]', err);
      }
    }
  };

  // ⏯️ 재생 / 일시정지 토글
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    if (vid.paused) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, []);

  // ⏩ 10초 앞/뒤 탐색 (Clamp 처리)
  const handleSkip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    const dur = vid.duration;
    if (dur === undefined || isNaN(dur) || !isFinite(dur)) return;

    const newTime = Math.max(0, Math.min(dur, vid.currentTime + seconds));
    vid.currentTime = newTime;
  }, []);

  // ⚡ 배속 조절
  const handlePlaybackRateChange = (rate: number) => {
    setCurrentRate(rate);
    if (videoRef.current) {
      try {
        videoRef.current.playbackRate = rate;
      } catch (err) {
        console.warn('[PlaybackRate Error]', err);
      }
    }
  };

  // 🖥️ 전체화면
  const handleFullscreen = () => {
    if (!videoRef.current) return;
    const vid = videoRef.current as any;
    try {
      if (vid.requestFullscreen) {
        vid.requestFullscreen().catch(() => {});
      } else if (vid.webkitEnterFullscreen) {
        // iPad Safari Native Fullscreen
        vid.webkitEnterFullscreen();
      }
    } catch (err) {
      console.warn('[Fullscreen Error]', err);
    }
  };

  // 🎹 키보드 단축키 (Space: 재생/일시정지, ←/→: 10초 이동)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName?.toUpperCase();
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (e.key === ' ' || e.code === 'Space') {
        if (activeVideoUrl && !isError) {
          e.preventDefault();
          togglePlay();
        }
      } else if (e.key === 'ArrowLeft') {
        if (activeVideoUrl && !isError) {
          e.preventDefault();
          handleSkip(-SEEK_STEP_SECONDS);
        }
      } else if (e.key === 'ArrowRight') {
        if (activeVideoUrl && !isError) {
          e.preventDefault();
          handleSkip(SEEK_STEP_SECONDS);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeVideoUrl, isError, togglePlay, handleSkip]);

  const handleOpenResource = (fullUrl: string) => {
    if (fullUrl) window.open(fullUrl, '_blank');
  };

  // 타임스탬프 파트 파싱
  const parsedTimestamps = useMemo(() => {
    if (!currentUnitData.timelineText) return [];
    const lines = currentUnitData.timelineText.split('\n');
    const list: { seconds: number; timeStr: string; label: string }[] = [];

    lines.forEach((line: string) => {
      const match = line.match(/\[?(\d{1,2}):(\d{2})\]?\s*(.*)/);
      if (match) {
        const secs = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        const label = match[3].trim() || '파트';
        list.push({ seconds: secs, timeStr: `${match[1]}:${match[2]}`, label });
      }
    });

    return list;
  }, [currentUnitData.timelineText]);

  // 타임 점프 헬퍼
  const handleSeekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
    }
  };

  const defaultUnitName = typeof units[selectedUnitIdx] === 'string' 
    ? units[selectedUnitIdx] 
    : (units[selectedUnitIdx]?.title || `단원 ${selectedUnitIdx + 1}`);
  const currentUnitName = currentUnitData?.customUnitName || defaultUnitName;

  return (
    <div className="space-y-4">
      {/* 📺 메인 비디오 플레이어 & 우측 단원/파트 목차 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* [좌측 2컬럼] 메인 비디오 플레이어 */}
        <div className={`lg:col-span-2 p-4 rounded-md border space-y-3 ${
          isLight ? 'bg-white border-gray-200' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800 flex-wrap gap-2">
            <h3 className="font-black text-sm tracking-tight text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <Film size={16} />
              <span>
                {bookType === 'problem' 
                  ? `📙 ${selectedPageNo}페이지 문항 해설` 
                  : `${selectedUnitIdx + 1}단원. ${currentUnitName}`}
              </span>
            </h3>
            
            <div className="flex items-center gap-2">
              {/* 📄 단원 직결 연관 PDF 오픈 버튼 */}
              {activePdfUrl && (
                <button
                  type="button"
                  onClick={() => openMediaPdf(activePdfUrl)}
                  className="px-2.5 py-1 text-xs font-bold rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center gap-1 transition-all"
                  title="해당 단원의 연관 PDF 자료를 엽니다"
                >
                  <FileText size={13} />
                  <span>PDF 열기</span>
                </button>
              )}
              <span className="text-[10px] opacity-75 font-bold">{bookTitle}</span>
            </div>
          </div>

          {/* 비디오 뷰어 */}
          {!activeVideoUrl ? (
            <div className={`aspect-video rounded flex flex-col items-center justify-center gap-2 border text-gray-400 text-xs font-bold ${
              isLight ? 'bg-gray-50 border-gray-200' : 'bg-black/40 border-slate-800'
            }`}>
              <Film size={28} className="opacity-40" />
              <span>
                {bookType === 'problem' 
                  ? '문항 번호를 클릭하면 해설 동영상이 바로 재생됩니다.' 
                  : '선택하신 단원의 영상이 아직 연동되지 않았습니다.'}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative aspect-video rounded overflow-hidden bg-black shadow-lg group">
                <video
                  key={activeVideoUrl}
                  ref={videoRef}
                  src={activeVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  controlsList="nodownload"
                  className="w-full h-full object-contain"
                  onLoadStart={handleLoadStart}
                  onWaiting={handleWaiting}
                  onSeeking={handleSeeking}
                  onCanPlay={handleCanPlay}
                  onPlaying={handlePlaying}
                  onPause={handlePause}
                  onSeeked={handleSeeked}
                  onEnded={handleEnded}
                  onError={handleError}
                />

                {/* 🌀 로딩 오버레이 */}
                {isLoading && !isError && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white z-10 pointer-events-none">
                    <Loader2 size={32} className="animate-spin text-indigo-400" />
                    <span className="text-xs font-bold tracking-tight">동영상 로딩 중...</span>
                  </div>
                )}

                {/* ⚠️ 재생 실패 에러 오버레이 & 다시 시도 버튼 */}
                {isError && (
                  <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center gap-3 text-white z-20">
                    <AlertTriangle size={36} className="text-amber-400" />
                    <p className="text-xs font-bold leading-relaxed max-w-sm text-slate-300">
                      동영상을 불러오지 못했습니다. 학원 Wi‑Fi 연결, AMF 서버 상태 또는 파일 경로를 확인한 뒤 다시 시도해 주세요.
                    </p>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="mt-1 px-4 py-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow transition-all active:scale-95"
                    >
                      <RefreshCw size={14} />
                      <span>다시 시도</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 🎛️ AMF 학습 보완 커스텀 툴바 (기본 controls 보존) */}
              <div className={`p-2 rounded flex items-center justify-between gap-2 border flex-wrap ${
                isLight ? 'bg-gray-100 border-gray-200 text-gray-800' : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}>
                {/* 좌측: 재생/일시정지, -10초, +10초 */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={isError}
                    className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 transition-all ${
                      isLight ? 'bg-white hover:bg-gray-200 text-gray-900 border' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    } disabled:opacity-40`}
                    title="재생 / 일시정지 (Space)"
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? '일시정지' : '재생'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSkip(-SEEK_STEP_SECONDS)}
                    disabled={isError}
                    className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-all ${
                      isLight ? 'bg-white hover:bg-gray-200 text-gray-900 border' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    } disabled:opacity-40`}
                    title="10초 뒤로 (←)"
                  >
                    <RotateCcw size={13} />
                    <span>-10초</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSkip(SEEK_STEP_SECONDS)}
                    disabled={isError}
                    className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-all ${
                      isLight ? 'bg-white hover:bg-gray-200 text-gray-900 border' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    } disabled:opacity-40`}
                    title="10초 앞으로 (→)"
                  >
                    <RotateCw size={13} />
                    <span>+10초</span>
                  </button>
                </div>

                {/* 우측: 배속 버튼 칩 세트 & 전체화면 */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold opacity-60 mr-0.5">배속:</span>
                    {PLAYBACK_RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handlePlaybackRateChange(rate)}
                        disabled={isError}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                          currentRate === rate
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : isLight
                              ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        } disabled:opacity-40`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleFullscreen}
                    disabled={isError}
                    className={`p-1.5 rounded transition-all ${
                      isLight ? 'bg-white hover:bg-gray-200 text-gray-900 border' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    } disabled:opacity-40`}
                    title="전체화면"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ⏱️ 타임스탬프 파트 바로가기 버튼 칩 세트 */}
          {parsedTimestamps.length > 0 && (
            <div className="pt-2 border-t border-dashed border-gray-200 dark:border-slate-800 space-y-1.5">
              <span className="text-[10px] font-bold text-purple-500 flex items-center gap-1">
                <Clock size={11} /> ⏱️ 파트/문항 빠르게 찾아가기
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar-h">
                {parsedTimestamps.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSeekTo(item.seconds)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold shrink-0 transition-all border flex items-center gap-1.5 ${
                      isLight
                        ? 'bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-800 border-purple-200'
                        : 'bg-purple-500/10 hover:bg-purple-600 hover:text-white text-purple-300 border-purple-500/30'
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-75">[{item.timeStr}]</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* [우측 1컬럼] 개념서 단원 목차 또는 문제집 페이지 문항 목록 */}
        <div className={`p-4 rounded-md border space-y-3 ${
          isLight ? 'bg-white border-gray-200' : 'bg-slate-900 border-slate-800'
        }`}>
          {bookType === 'problem' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                <span className="font-black text-xs text-amber-600 dark:text-amber-400">📙 페이지 & 문항 선택</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={selectedPageNo}
                    onChange={(e) => setSelectedPageNo(parseInt(e.target.value, 10) || 1)}
                    className={`w-14 px-1.5 py-0.5 text-xs font-bold font-mono rounded border outline-none text-center ${
                      isLight ? 'bg-gray-50 border-amber-300 text-amber-900' : 'bg-slate-950 border-amber-500/40 text-amber-300'
                    }`}
                  />
                  <span className="text-xs font-bold text-gray-500">p</span>
                </div>
              </div>

              {/* 해당 페이지의 문항 칩 버튼 세트 */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400">
                  [{selectedPageNo}p] 문항 해설 영상 ({currentPageData.problems?.length || 0}문제):
                </span>

                {!currentPageData.problems || currentPageData.problems.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400 italic font-bold">
                    해당 페이지에 연동된 문항 영상이 없습니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar-v">
                    {currentPageData.problems.map((prob, pIdx) => {
                      const isSelected = selectedProblemVideo === prob.videoPath && !!prob.videoPath;
                      const hasVideo = !!prob.videoPath;

                      return (
                        <button
                          key={pIdx}
                          type="button"
                          disabled={!hasVideo}
                          onClick={() => setSelectedProblemVideo(prob.videoPath)}
                          className={`p-2 rounded text-xs font-bold transition-all border flex items-center justify-between gap-1 ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-700 shadow-sm ring-1 ring-amber-400'
                              : hasVideo
                                ? isLight
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-gray-100 dark:bg-slate-950 text-gray-400 border-gray-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <span>{prob.problemNo}</span>
                          {hasVideo && <Play size={11} className={isSelected ? 'text-white' : 'text-amber-500'} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="font-black text-xs text-indigo-500 flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                <span>📚 단원 목차 ({units.length}개 단원)</span>
                <span className="text-[10px] text-gray-400">클릭 시 영상 전환</span>
              </h4>

              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar-v">
                {units.map((unit: any, idx: number) => {
                  const defaultUName = typeof unit === 'string' ? unit : (unit.title || `단원 ${idx + 1}`);
                  const uName = unitsData[idx]?.customUnitName || defaultUName;
                  const isSelected = selectedUnitIdx === idx;
                  const hasVideo = !!unitsData[idx]?.videoPath;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedUnitIdx(idx)}
                      className={`w-full p-2.5 rounded text-left transition-all border flex items-center justify-between gap-2 text-xs font-bold ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                          : isLight
                            ? 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                            : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      <span className="truncate flex-1">
                        {idx + 1}. {uName}
                      </span>
                      {hasVideo ? (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          ▶ 영상
                        </span>
                      ) : (
                        <ChevronRight size={14} className="opacity-40 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 💡 하단 선생님 추천 연계 보충 링크 */}
      <StudentResourceLinks
        resources={currentUnitData.resources || []}
        baseServerUrl={baseServerUrl}
        onOpenResource={handleOpenResource}
        isLight={isLight}
      />
    </div>
  );
}
