'use client';

import { useState } from 'react';
import { Plus, Trash2, FileText, Video, Hash, Sparkles, Wand2 } from 'lucide-react';

export interface ProblemVideoItem {
  problemNo: string; // "1번", "3번", "28번"
  videoPath: string;  // "/video/rpm/p45_q03.mp4"
}

export interface PageModuleData {
  pageNo: number; // 45
  isNoProblemPage?: boolean; // 문제없는 페이지 (개념/표지/쉬어가는 페이지)
  problems: ProblemVideoItem[];
}

interface ProblemPageModuleBuilderProps {
  pageDataMap: Record<number, PageModuleData>;
  baseServerUrl: string;
  onUpdatePageData: (pageNo: number, data: PageModuleData) => void;
  onDeletePageData: (pageNo: number) => void;
  isLight?: boolean;
}

export default function ProblemPageModuleBuilder({
  pageDataMap = {},
  baseServerUrl,
  onUpdatePageData,
  onDeletePageData,
  isLight = false
}: ProblemPageModuleBuilderProps) {
  const [selectedPageInput, setSelectedPageInput] = useState<number>(45);

  // 일괄 문항 생성 상태 (예: 1번~15번 또는 501번~520번)
  // 스마트 번호 일괄 생성 (시작번호만 입력 시 연번으로 자동 채움, 끝번호 입력 시 해당 구간)
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEndStr, setRangeEndStr] = useState<string>('10');
  const [itemCountStr, setItemCountStr] = useState<string>('6');
  const [prefixFolder, setPrefixFolder] = useState<string>('/video/rpm');

  const currentPageData = pageDataMap[selectedPageInput] || {
    pageNo: selectedPageInput,
    problems: [
      { problemNo: '1번', videoPath: '' },
      { problemNo: '2번', videoPath: '' },
      { problemNo: '3번', videoPath: '' }
    ]
  };

  // ⚡ 스마트 연번 자동 생성 핸들러
  const handleAutoGenerateRange = () => {
    let start = rangeStart || 1;
    let end = start;

    if (rangeEndStr.trim() !== '') {
      // 끝 번호가 입력된 경우
      end = parseInt(rangeEndStr, 10) || start;
    } else {
      // 끝 번호가 비어있고 (아무 말도 없이 연번), 시작 번호만 적은 경우 -> itemCount 사용
      const count = parseInt(itemCountStr, 10) || 6;
      end = start + count - 1;
    }

    if (start > end) {
      alert('시작 번호가 끝 번호보다 클 수 없습니다.');
      return;
    }

    const newProblems: ProblemVideoItem[] = [];
    const prefix = prefixFolder.replace(/\/+$/, '');

    for (let i = start; i <= end; i++) {
      const pStr = `${i}번`;
      const pIndexStr = String(i).padStart(2, '0');
      const vPath = prefix ? `${prefix}/p${selectedPageInput}_q${pIndexStr}.mp4` : '';
      newProblems.push({ problemNo: pStr, videoPath: vPath });
    }

    onUpdatePageData(selectedPageInput, { ...currentPageData, problems: newProblems });
  };

  const handleAddProblem = () => {
    const nextNo = (currentPageData.problems.length + 1) + '번';
    const updated = [...currentPageData.problems, { problemNo: nextNo, videoPath: '' }];
    onUpdatePageData(selectedPageInput, { ...currentPageData, problems: updated });
  };

  const handleUpdateProblem = (idx: number, field: keyof ProblemVideoItem, val: string) => {
    const updated = currentPageData.problems.map((p, i) => i === idx ? { ...p, [field]: val } : p);
    onUpdatePageData(selectedPageInput, { ...currentPageData, problems: updated });
  };

  const handleDeleteProblem = (idx: number) => {
    const updated = currentPageData.problems.filter((_, i) => i !== idx);
    onUpdatePageData(selectedPageInput, { ...currentPageData, problems: updated });
  };

  const existingPages = Object.keys(pageDataMap).map(Number).sort((a, b) => a - b);

  return (
    <div className={`p-4 rounded-md border space-y-4 ${
      isLight ? 'bg-amber-50/30 border-amber-200' : 'bg-slate-900 border-amber-500/20'
    }`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-slate-800">
        <div className="space-y-0.5">
          <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <FileText size={15} />
            <span>📙 문제집 / 유형서 페이지 & 문항별 숏폼 해설 연동</span>
          </h4>
          <p className="text-[11px] opacity-75">
            페이지 번호를 고르고 각 문항 번호 옆에 해설 영상 경로를 매칭하세요.
          </p>
        </div>

        {/* 페이지 선택/입력 바 & 개념/문제없는 페이지 토글 */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-amber-600 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/30">
            <input
              type="checkbox"
              checked={!!currentPageData.isNoProblemPage}
              onChange={(e) => {
                onUpdatePageData(selectedPageInput, {
                  ...currentPageData,
                  isNoProblemPage: e.target.checked
                });
              }}
              className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
            />
            <span>🚫 문제없는 페이지 (개념/쉬어가는 페이지)</span>
          </label>

          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-gray-500">페이지:</span>
            <input
              type="number"
              value={selectedPageInput}
              onChange={(e) => setSelectedPageInput(parseInt(e.target.value, 10) || 1)}
              min={1}
              className={`w-16 px-2 py-1 text-xs font-bold font-mono rounded border outline-none text-center ${
                isLight ? 'bg-white border-amber-300 text-amber-900' : 'bg-slate-950 border-amber-500/40 text-amber-300'
              }`}
            />
            <span className="text-xs font-bold text-gray-500">p</span>
          </div>
        </div>
      </div>

      {/* ✨ 스마트 일괄 문항 번호 & 경로 1초 자동 생성 바 */}
      <div className={`p-3 rounded border space-y-2 ${
        isLight ? 'bg-amber-100/40 border-amber-200' : 'bg-slate-950/80 border-amber-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Sparkles size={14} />
            <span>✨ [스마트 일괄 생성] 문제 번호 1초 자동 완성</span>
          </span>
          <span className="text-[10px] text-gray-400 font-bold">수동 지정 필요 없이 1초 만에 연속 번호 생성</span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-gray-500">시작:</span>
            <input
              type="number"
              value={rangeStart}
              onChange={(e) => setRangeStart(parseInt(e.target.value, 10) || 1)}
              className={`w-16 px-2 py-1 text-xs font-bold rounded border outline-none text-center ${
                isLight ? 'bg-white border-amber-250 text-gray-800' : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
            <span className="text-[11px] font-bold text-gray-500">번 ~ 끝:</span>
            <input
              type="text"
              value={rangeEndStr}
              onChange={(e) => setRangeEndStr(e.target.value)}
              placeholder="자동"
              className={`w-14 px-2 py-1 text-xs font-bold rounded border outline-none text-center ${
                isLight ? 'bg-white border-amber-250 text-gray-800' : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
            <span className="text-[11px] font-bold text-gray-500">번</span>
          </div>

          <div className="flex items-center gap-1 flex-1">
            <span className="text-[11px] font-bold text-gray-500 shrink-0">영상폴더:</span>
            <input
              type="text"
              value={prefixFolder}
              onChange={(e) => setPrefixFolder(e.target.value)}
              placeholder="/video/rpm"
              className={`w-full px-2 py-1 text-xs font-mono rounded border outline-none ${
                isLight ? 'bg-white border-amber-250 text-gray-800' : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
          </div>

          <button
            type="button"
            onClick={handleAutoGenerateRange}
            className="px-3 py-1 rounded text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center justify-center gap-1 shrink-0 transition-all"
          >
            <Wand2 size={13} />
            <span>⚡ 일괄 생성</span>
          </button>
        </div>
      </div>

      {/* 이미 세팅된 페이지 칩 목록 */}
      {existingPages.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar-h">
          <span className="text-[10px] font-bold text-gray-400 shrink-0">등록된 페이지:</span>
          {existingPages.map(pNo => {
            const pData = pageDataMap[pNo];
            const isNoProb = !!pData?.isNoProblemPage;

            return (
              <button
                key={pNo}
                type="button"
                onClick={() => setSelectedPageInput(pNo)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition-all border flex items-center gap-1 ${
                  selectedPageInput === pNo
                    ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                    : isNoProb
                      ? 'bg-gray-100 dark:bg-slate-900 text-gray-400 border-gray-300 dark:border-slate-800'
                      : isLight
                        ? 'bg-white hover:bg-amber-100 text-amber-900 border-amber-200'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                }`}
              >
                <span>{pNo}p</span>
                {isNoProb && <span className="text-[9px]">🚫</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* 선택된 페이지의 문항 번호 및 영상 상대경로 입력 세트 */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-amber-600 dark:text-amber-300 flex items-center gap-1">
            <Hash size={13} />
            <span>[{selectedPageInput} 페이지] 문항 목록 ({currentPageData.problems.length}개 문제)</span>
          </span>

          <button
            type="button"
            onClick={handleAddProblem}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 border transition-all ${
              isLight
                ? 'bg-amber-100 hover:bg-amber-600 hover:text-white text-amber-900 border-amber-300'
                : 'bg-amber-500/20 hover:bg-amber-600 hover:text-white text-amber-300 border-amber-500/30'
            }`}
          >
            <Plus size={12} />
            <span>+ 문항 추가</span>
          </button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar-v">
          {currentPageData.problems.map((prob, pIdx) => (
            <div
              key={pIdx}
              className={`p-2.5 rounded border flex items-center gap-2 ${
                isLight ? 'bg-white border-amber-200' : 'bg-slate-950 border-slate-800'
              }`}
            >
              {/* 문항 번호 입력 (예: 1번, 3번, 28번) */}
              <input
                type="text"
                value={prob.problemNo}
                onChange={(e) => handleUpdateProblem(pIdx, 'problemNo', e.target.value)}
                placeholder="3번"
                className={`w-16 px-2 py-1 text-xs font-bold rounded border outline-none text-center ${
                  isLight ? 'bg-gray-50 border-gray-250 text-gray-800' : 'bg-slate-900 border-slate-700 text-amber-300'
                }`}
              />

              {/* 영상 상대 경로 */}
              <div className="flex items-center flex-1 rounded border overflow-hidden">
                <span className={`px-2 py-1 text-[10px] font-mono border-r opacity-60 shrink-0 ${
                  isLight ? 'bg-gray-100 border-gray-250 text-gray-600' : 'bg-slate-900 border-white/10 text-slate-400'
                }`}>
                  {baseServerUrl}
                </span>
                <input
                  type="text"
                  value={prob.videoPath}
                  onChange={(e) => handleUpdateProblem(pIdx, 'videoPath', e.target.value)}
                  placeholder={`/video/rpm/p${selectedPageInput}_q${pIdx + 1}.mp4`}
                  className={`w-full px-2 py-1 text-xs font-mono outline-none ${
                    isLight ? 'bg-white text-gray-800' : 'bg-black/30 text-white'
                  }`}
                />
              </div>

              {/* 삭제 버튼 */}
              <button
                type="button"
                onClick={() => handleDeleteProblem(pIdx)}
                className="p-1 text-red-500 hover:text-red-700 transition-colors shrink-0"
                title="문항 삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
