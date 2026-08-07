'use client';

import { useState, useRef, useMemo } from 'react';
import { Play, Film, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import StudentResourceLinks from './StudentResourceLinks';
import { UnitModuleData } from '../learningBuilder/TextbookModuleBuilder';

import { PageModuleData, ProblemVideoItem } from '../learningBuilder/ProblemPageModuleBuilder';

interface StudentCoursePlayerProps {
  bookTitle: string;
  units: any[];
  bookModule: any;
  baseServerUrl: string;
  isLight?: boolean;
}

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

  const bookType = bookModule?.bookType || 'concept';
  const unitsData = bookModule?.units || {};
  const pagesData: Record<number, PageModuleData> = bookModule?.pages || {};

  // 현재 단원 모듈 데이터
  const currentUnitData = unitsData[selectedUnitIdx] || { videoPath: '', timelineText: '', resources: [] };
  const currentPageData = pagesData[selectedPageNo] || { pageNo: selectedPageNo, problems: [] };

  // 비디오 풀 URL 생성 헬퍼
  const getFullUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = (baseServerUrl || '').replace(/\/+$/, '');
    const rel = path.startsWith('/') ? path : `/${path}`;
    return `${base}${rel}`;
  };

  const activeVideoUrl = bookType === 'problem' 
    ? getFullUrl(selectedProblemVideo)
    : getFullUrl(currentUnitData.videoPath);

  // 비디오 풀 URL
  const videoFullUrl = useMemo(() => {
    if (!currentUnitData.videoPath) return '';
    const path = currentUnitData.videoPath.trim();
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = (baseServerUrl || '').replace(/\/+$/, '');
    const rel = path.startsWith('/') ? path : `/${path}`;
    return `${base}${rel}`;
  }, [currentUnitData.videoPath, baseServerUrl]);

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
      videoRef.current.play();
    }
  };

  const handleOpenResource = (fullUrl: string) => {
    if (fullUrl) window.open(fullUrl, '_blank');
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
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
            <h3 className="font-black text-sm tracking-tight text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <Film size={16} />
              <span>
                {bookType === 'problem' 
                  ? `📙 ${selectedPageNo}페이지 문항 해설` 
                  : `${selectedUnitIdx + 1}단원. ${currentUnitName}`}
              </span>
            </h3>
            <span className="text-[10px] opacity-75 font-bold">{bookTitle}</span>
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
            <div className="relative aspect-video rounded overflow-hidden bg-black shadow-lg group">
              <video
                ref={videoRef}
                src={activeVideoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
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
