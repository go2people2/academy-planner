'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  X, Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize, Video, ListVideo, Bookmark,
  Loader2, AlertTriangle, RefreshCw
} from 'lucide-react';

export interface TimestampItem {
  timeStr: string; // "02:10"
  seconds: number; // 130
  label: string;   // "28번"
}

interface VideoPlayerModalProps {
  isOpen: boolean;
  videoUrl: string;
  title?: string;
  timestampsText?: string; // "[00:05] 27번\n[02:10] 28번..."
  onClose: () => void;
  isLight?: boolean;
}

export default function VideoPlayerModal({ 
  isOpen, 
  videoUrl, 
  title = '학습 동영상 플레이어', 
  timestampsText = '',
  onClose,
  isLight = false 
}: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [showChapters, setShowChapters] = useState(true);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSeekingRef = useRef<boolean>(false);

  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  // 1. 타임스탬프 텍스트 자동 파싱 유틸
  const parsedTimestamps = useMemo<TimestampItem[]>(() => {
    if (!timestampsText.trim()) return [];
    const lines = timestampsText.split('\n');
    const items: TimestampItem[] = [];

    lines.forEach(line => {
      const match = line.match(/\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(.*)/);
      if (match) {
        let secs = 0;
        let timeDisplay = '';
        if (match[3] !== undefined) {
          // hh:mm:ss
          secs = parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
          timeDisplay = `${match[1]}:${match[2]}:${match[3]}`;
        } else {
          // mm:ss
          secs = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
          timeDisplay = `${match[1]}:${match[2]}`;
        }
        const label = match[4].trim() || '문항';
        items.push({ seconds: secs, timeStr: timeDisplay, label });
      }
    });

    return items.sort((a, b) => a.seconds - b.seconds);
  }, [timestampsText]);

  // 2. 현재 재생 시간 기준 활성화된 문항 탐색
  const currentActiveIndex = useMemo(() => {
    if (parsedTimestamps.length === 0) return -1;
    for (let i = parsedTimestamps.length - 1; i >= 0; i--) {
      if (currentTime >= parsedTimestamps[i].seconds) {
        return i;
      }
    }
    return 0;
  }, [currentTime, parsedTimestamps]);

  // 모달 오픈 및 비디오 URL 변경 시 초기화
  useEffect(() => {
    if (isOpen) {
      clearLoadingTimeout();
      isSeekingRef.current = false;
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(!!videoUrl);
      setIsError(false);
      setPlaybackRate(1.0);
      if (videoRef.current) {
        try {
          videoRef.current.playbackRate = 1.0;
        } catch (e) {
          // ignore
        }
      }
    }
    return () => {
      clearLoadingTimeout();
    };
  }, [isOpen, videoUrl, clearLoadingTimeout]);

  // unmount 시 cleanup
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
    if (isSeekingRef.current || loadingTimeoutRef.current !== null) {
      return;
    }
    setIsLoading(true);
  };

  const handleSeeking = () => {
    isSeekingRef.current = true;
    clearLoadingTimeout();
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
      console.error('[VideoPlayerModal Error]', {
        code: err?.code,
        message: err?.message,
        src: videoUrl
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

  // 마우스 움직임 감지 시 컨트롤러 자동 노출/숨김
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  // 재생/일시정지
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    if (vid.paused) {
      vid.play().catch(() => {});
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }, []);

  // 특정 시간(초)으로 바로 이동
  const jumpToSeconds = (targetSeconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = targetSeconds;
    setCurrentTime(targetSeconds);
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // 10초 스킵 (Clamp 처리)
  const skip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    const dur = vid.duration;
    if (dur === undefined || isNaN(dur) || !isFinite(dur)) return;
    const newTime = Math.max(0, Math.min(dur, vid.currentTime + seconds));
    vid.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  // 배속 변경
  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      try {
        videoRef.current.playbackRate = rate;
      } catch (e) {
        // ignore
      }
    }
  };

  // 음소거 토글
  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    videoRef.current.muted = nextMute;
  };

  // 전체화면 토글
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen().catch(() => {});
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          (containerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn('[Fullscreen error]', e);
    }
  };

  // 시간 포맷팅 (mm:ss)
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

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
        if (videoUrl && !isError) {
          e.preventDefault();
          togglePlay();
        }
      } else if (e.key === 'ArrowLeft') {
        if (videoUrl && !isError) {
          e.preventDefault();
          skip(-10);
        }
      } else if (e.key === 'ArrowRight') {
        if (videoUrl && !isError) {
          e.preventDefault();
          skip(10);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && !isFullscreen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, duration, isFullscreen, videoUrl, isError, togglePlay, skip]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-center items-center p-2 sm:p-4 animate-fadeIn">
      {/* 🎬 플레이어 메인 프레임 */}
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative w-full max-w-6xl bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col lg:flex-row h-[85vh] max-h-[720px]"
      >
        {/* 1. 비디오 영역 (왼쪽/상단) */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {/* 상단 오버레이 헤더 */}
          <div className={`absolute top-0 inset-x-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}>
            <div className="flex items-center gap-2 text-white">
              <Video className="text-indigo-400" size={20} />
              <h3 className="font-bold text-sm tracking-tight line-clamp-1">{title}</h3>
            </div>
            <div className="flex items-center gap-2">
              {parsedTimestamps.length > 0 && (
                <button
                  onClick={() => setShowChapters(!showChapters)}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                    showChapters ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  <ListVideo size={14} />
                  <span>문항 목록 ({parsedTimestamps.length})</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-black/40 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
                title="닫기 (ESC)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* 🌀 로딩 오버레이 */}
          {isLoading && !isError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs gap-2 text-white pointer-events-none">
              <Loader2 size={32} className="animate-spin text-indigo-400" />
              <span className="text-xs font-bold text-slate-300">동영상 로딩 중...</span>
            </div>
          )}

          {/* ⚠️ 재생 실패 에러 오버레이 & 다시 시도 버튼 */}
          {isError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 p-6 text-center gap-3 text-white">
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

          {/* 비디오 엘리먼트 */}
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            preload="auto"
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlay}
            onLoadStart={handleLoadStart}
            onWaiting={handleWaiting}
            onSeeking={handleSeeking}
            onCanPlay={handleCanPlay}
            onPlaying={handlePlaying}
            onPause={handlePause}
            onSeeked={handleSeeked}
            onEnded={handleEnded}
            onError={handleError}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration);
              }
            }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
              }
            }}
          />

          {/* 중앙 거대 재생(Play) 버튼 오버레이 */}
          {!isPlaying && !isLoading && (
            <div 
              onClick={togglePlay}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 cursor-pointer group/play transition-all"
            >
              <div className="w-20 h-20 rounded-full bg-indigo-600/90 group-hover/play:bg-indigo-500 text-white flex items-center justify-center shadow-2xl shadow-indigo-500/50 group-hover/play:scale-110 transition-all border-2 border-indigo-400/50">
                <Play size={36} className="ml-1 fill-current text-white" />
              </div>
            </div>
          )}

          {/* 하단 재생 컨트롤 바 */}
          <div className={`absolute bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 space-y-3 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}>
            {/* 타임라인 슬라이더 */}
            <div className="flex items-center gap-3 text-xs text-slate-300 font-mono font-bold">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => jumpToSeconds(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 accent-indigo-500 rounded-lg cursor-pointer"
              />
              <span>{formatTime(duration)}</span>
            </div>

            {/* 재생 컨트롤 세트 */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all active:scale-95"
                  title={isPlaying ? '일시정지 (Space)' : '재생 (Space)'}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>

                <button
                  onClick={() => skip(-10)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                  title="10초 뒤로 (←)"
                >
                  <RotateCcw size={16} />
                </button>

                <button
                  onClick={() => skip(10)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                  title="10초 앞으로 (→)"
                >
                  <RotateCw size={16} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* 배속 조절 */}
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg">
                  {[0.75, 1.0, 1.25, 1.5, 2.0].map(rate => (
                    <button
                      key={rate}
                      onClick={() => changePlaybackRate(rate)}
                      className={`px-2 py-0.5 text-[10px] font-black rounded transition-all ${
                        playbackRate === rate
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                {/* 음소거 */}
                <button onClick={toggleMute} className="text-slate-300 hover:text-white">
                  {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                {/* 전체화면 */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                  title="전체화면 (F)"
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 📌 [우측 타임스탬프 문항 패널] (타임스탬프가 있을 때 활성화) */}
        {parsedTimestamps.length > 0 && showChapters && (
          <div className="w-full lg:w-72 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-64 lg:h-full shrink-0">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2 text-indigo-400 font-black text-xs">
                <Bookmark size={14} />
                <span>문항별 바로가기 ({parsedTimestamps.length})</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold">클릭 시 시점 이동</span>
            </div>

            {/* 문항 버튼 리스트 */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar-v">
              {parsedTimestamps.map((item, idx) => {
                const isActive = currentActiveIndex === idx;

                return (
                  <button
                    key={idx}
                    onClick={() => jumpToSeconds(item.seconds)}
                    className={`w-full p-2.5 rounded text-left transition-all flex items-center justify-between gap-2 border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-1 ring-indigo-400'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xs font-black truncate">{item.label}</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-950 text-slate-400'
                    }`}>
                      {item.timeStr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
