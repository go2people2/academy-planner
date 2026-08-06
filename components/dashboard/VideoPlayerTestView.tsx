'use client';

import { useState } from 'react';
import { Video, Play, Server, Monitor, Film, Bookmark, ListVideo } from 'lucide-react';
import VideoPlayerModal from '@/components/common/VideoPlayerModal';

interface VideoPlayerTestViewProps {
  isLight?: boolean;
}

// 💡 사용자가 제공해주신 타임스탬프 샘플 데이터
const DEFAULT_TIMESTAMPS_TEXT = `[00:00] 시작
[00:05] 27번
[02:10] 28번
[04:46] 29번
[05:57] 30번
[06:58] 31번
[07:47] 32번
[08:49] 33번
[10:33] 34번
[12:53] 35번
[13:16] 36번
[14:22] 37번
[15:44] 38번
[17:20] 39번
[18:50] 40번
[20:14] 41번
[21:11] 42번
[22:24] 43번
[23:27] 44번
[25:15] 45번
[26:33] 46번
[28:03] 47번
[30:52] 48번
[34:03] 49번`;

export default function VideoPlayerTestView({ isLight = false }: VideoPlayerTestViewProps) {
  const [videoUrlInput, setVideoUrlInput] = useState('http://192.168.0.13:8080/video/sample.mp4');
  const [videoTitleInput, setVideoTitleInput] = useState('[수능/모의고사 기출] 27번~49번 문항별 해설강의');
  const [timestampsText, setTimestampsText] = useState(DEFAULT_TIMESTAMPS_TEXT);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; title: string; timestamps: string } | null>(null);

  // 시뮬레이션용 단원 영상 샘플 데이터
  const sampleVideos = [
    {
      id: 'local-1',
      title: '[맥미니 로컬 서버] 27번~49번 문항별 통합 해설',
      url: 'http://192.168.0.13:8080/video/sample1.mp4',
      badge: '로컬 미디어 서버 (8080 포트)',
      timestamps: DEFAULT_TIMESTAMPS_TEXT
    },
    {
      id: 'sample-mp4',
      title: '[웹 샘플 테스트] 27번~49번 문항 타임점프 데모',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      badge: '공용 MP4 비디오 데모',
      timestamps: DEFAULT_TIMESTAMPS_TEXT
    }
  ];

  const handleOpenVideo = (url: string, title: string, timestamps: string) => {
    setSelectedVideo({ url, title, timestamps });
  };

  return (
    <div className={`p-6 space-y-6 min-h-screen ${isLight ? 'bg-[#f7f6f3] text-gray-800' : 'bg-[#0f172a] text-gray-100'}`}>
      {/* 🎬 헤더 타이틀 */}
      <div className={`p-5 rounded-lg border shadow-sm ${
        isLight ? 'bg-white border-gray-200' : 'bg-slate-900/80 border-slate-800'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">
            <Film size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight">학생 비디오 플레이어 & 문항별 타임스탬프 실험실</h1>
            <p className="text-xs opacity-70 mt-0.5">
              `[mm:ss] 문항명` 형태의 타임스탬프 정보를 주면, **영상 플레이어에 문항별 바로가기 버튼**이 자동 생성되는 기능을 테스트합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 🔗 URL 및 타임스탬프 입력 테스트 박스 */}
      <div className={`p-5 rounded-lg border space-y-4 ${
        isLight ? 'bg-white border-gray-200' : 'bg-slate-900/80 border-slate-800'
      }`}>
        <div className="flex items-center gap-2 border-b pb-3 border-gray-200 dark:border-slate-800">
          <Server size={18} className="text-indigo-500" />
          <h2 className="font-bold text-sm">로컬 미디어 서버 & 문항별 타임스탬프 입력</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-400">동영상 제목</label>
              <input 
                type="text"
                value={videoTitleInput}
                onChange={(e) => setVideoTitleInput(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded border outline-none font-bold mt-1 ${
                  isLight ? 'bg-white border-gray-200 text-gray-800' : 'bg-slate-950 border-slate-800 text-white'
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400">동영상 스트리밍 주소 (URL)</label>
              <input 
                type="text"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                placeholder="http://192.168.0.13:8080/video/..."
                className={`w-full px-3 py-2 text-xs rounded border outline-none font-mono font-bold mt-1 ${
                  isLight ? 'bg-white border-gray-200 text-gray-800' : 'bg-slate-950 border-slate-800 text-white'
                }`}
              />
            </div>
          </div>

          {/* 타임스탬프 텍스트 입력창 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Bookmark size={13} className="text-indigo-400" />
                <span>문항별 타임스탬프 텍스트 ([mm:ss] 문항명)</span>
              </label>
              <button 
                onClick={() => setTimestampsText(DEFAULT_TIMESTAMPS_TEXT)}
                className="text-[10px] text-indigo-400 hover:underline font-bold"
              >
                기본 27~49번 복원
              </button>
            </div>
            <textarea
              rows={6}
              value={timestampsText}
              onChange={(e) => setTimestampsText(e.target.value)}
              placeholder="[00:00] 시작&#10;[00:05] 27번&#10;[02:10] 28번..."
              className={`w-full p-2.5 text-xs rounded border outline-none font-mono font-bold custom-scrollbar-v ${
                isLight ? 'bg-white border-gray-200 text-gray-800' : 'bg-slate-950 border-slate-800 text-white'
              }`}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => handleOpenVideo(videoUrlInput, videoTitleInput, timestampsText)}
            className="px-4 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Play size={14} />
            <span>문항별 타임스탬프 비디오 플레이어 실행</span>
          </button>
        </div>
      </div>

      {/* 📚 샘플 학생 학습 영상 세트 카드 */}
      <div className="space-y-3">
        <h2 className="font-bold text-sm tracking-tight flex items-center gap-2">
          <Monitor size={16} className="text-indigo-400" />
          <span>시뮬레이션 카드 예시</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sampleVideos.map(video => (
            <div 
              key={video.id}
              className={`p-4 rounded-lg border transition-all flex flex-col justify-between gap-4 ${
                isLight 
                  ? 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md' 
                  : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/40'
              }`}
            >
              <div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                  isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-500/20 text-indigo-300'
                }`}>
                  {video.badge}
                </span>
                <h3 className="font-bold text-sm tracking-tight mt-2">
                  {video.title}
                </h3>
                <p className="text-[11px] font-mono opacity-50 mt-1 truncate">
                  {video.url}
                </p>
                <div className="mt-2 text-[11px] text-indigo-400 font-bold flex items-center gap-1">
                  <ListVideo size={13} />
                  <span>27번~49번 문항별 타임스탬프 탑재됨</span>
                </div>
              </div>

              <button
                onClick={() => handleOpenVideo(video.url, video.title, video.timestamps)}
                className={`w-full py-2 px-3 rounded text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                  isLight
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-indigo-500/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30'
                }`}
              >
                <Play size={14} />
                <span>문항 타임스탬프 해설 영상 열기</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 🎬 타임스탬프 지원 비디오 플레이어 모달 */}
      {selectedVideo && (
        <VideoPlayerModal
          isOpen={!!selectedVideo}
          videoUrl={selectedVideo.url}
          title={selectedVideo.title}
          timestampsText={selectedVideo.timestamps}
          onClose={() => setSelectedVideo(null)}
          isLight={isLight}
        />
      )}
    </div>
  );
}
