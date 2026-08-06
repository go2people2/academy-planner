'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize, Video, ListVideo, Bookmark
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
  const [showChapters, setShowChapters] = useState(true);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // 모달 오픈 시 초기화
  useEffect(() => {
    if (isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(true);
    }
  }, [isOpen, videoUrl]);

  // 마우스 움직임 감지 시 컨트롤러 자동 노출/숨김
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  // 재생/일시정지
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // 특정 시간(초)으로 바로 이동
  const jumpToSeconds = (targetSeconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = targetSeconds;
    setCurrentTime(targetSeconds);
    if (!isPlaying) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // 10초 스킵
  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    jumpToSeconds(Math.min(Math.max(videoRef.current.currentTime + seconds, 0), duration));
  };

  // 배속 변경
  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
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
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => console.error(err));
      setIsFullscreen(false);
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
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        skip(-10);
      } else if (e.key === 'ArrowRight') {
        skip(10);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape' && !isFullscreen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, duration, isFullscreen]);

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

          {/* 로딩 인디케이터 */}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 gap-2 text-white">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-slate-300">동영상 고속 서빙 스트리밍 중...</span>
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
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration);
                setIsLoading(false);
              }
            }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
              }
            }}
            onEnded={() => setIsPlaying(false)}
            onWaiting={() => setIsLoading(true)}
            onPlaying={() => setIsLoading(false)}
          />

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
