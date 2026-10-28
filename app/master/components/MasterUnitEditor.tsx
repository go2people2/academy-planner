'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ClipboardPaste, X } from 'lucide-react';
import { parsePastedUnits } from '@/lib/unitPasteParser';

export interface MasterUnitDraft {
  unit_name: string;
  start_page: number;
  end_page: number;
}

interface MasterUnitEditorProps {
  units: MasterUnitDraft[];
  onChange: (units: MasterUnitDraft[]) => void;
  isLoading?: boolean;
}

/**
 * 💡 단원 스프레드시트 편집기 (구글 시트 2번 탭 대응)
 * 순서는 행 순서로 자동 부여되며, 엑셀/시트 일괄 붙여넣기(Batch Paste)를 지원합니다.
 */
export function MasterUnitEditor({ units, onChange, isLoading }: MasterUnitEditorProps) {
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [pasteMode, setPasteMode] = useState<'replace' | 'append'>('replace');

  const parsedPreview = useMemo(() => parsePastedUnits(pastedText), [pastedText]);

  const update = (idx: number, field: keyof MasterUnitDraft, val: string | number) => {
    onChange(units.map((u, i) => (i === idx ? { ...u, [field]: val } : u)));
  };

  const add = () => {
    const last = units[units.length - 1];
    const start = last ? last.end_page + 1 : 1;
    onChange([...units, { unit_name: '', start_page: start, end_page: start + 10 }]);
  };

  const remove = (idx: number) => onChange(units.filter((_, i) => i !== idx));

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (idx === units.length - 1 && units[idx].unit_name.trim()) {
        add();
      }
    }
  };

  const handleApplyPaste = () => {
    if (parsedPreview.length === 0) {
      alert('인식된 단원 데이터가 없습니다. 엑셀이나 구글 시트에서 복사한 내용을 붙여넣어 주세요.');
      return;
    }
    if (pasteMode === 'replace') {
      onChange(parsedPreview);
    } else {
      onChange([...units, ...parsedPreview]);
    }
    setPastedText('');
    setIsPasteOpen(false);
  };

  const numInput = 'w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-xs text-center focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-gray-400 font-bold text-xs">
          단원 목차 ({units.length}개)
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPasteOpen((prev) => !prev)}
            className={`px-2.5 py-1 text-[11px] rounded font-bold inline-flex items-center gap-1 transition-colors ${
              isPasteOpen
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/50'
            }`}
          >
            <ClipboardPaste size={12} /> 엑셀/시트 일괄 붙여넣기
          </button>
          <button
            type="button"
            onClick={add}
            className="px-2 py-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-white rounded font-bold inline-flex items-center gap-1"
          >
            <Plus size={12} /> 단원 추가
          </button>
        </div>
      </div>

      {/* 엑셀/시트 일괄 붙여넣기 패널 */}
      {isPasteOpen && (
        <div className="p-3 rounded border border-indigo-500/40 bg-indigo-950/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <ClipboardPaste size={14} /> 엑셀 / 구글 시트 일괄 붙여넣기
            </span>
            <button
              type="button"
              onClick={() => setIsPasteOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            엑셀이나 구글 시트에서 복사(Ctrl+C)한 표를 아래 상자에 그대로 붙여넣기(Ctrl+V)하세요. (단원명, 시작p, 끝p 열 자동 매핑)
          </p>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={5}
            placeholder={`예시: 엑셀이나 구글 시트에서 드래그 복사한 셀을 여기에 붙여넣기\n1.1 유리수\t6\t18\n1.2 순환소수\t19\t32\n1.3 식의 계산\t33\t45`}
            className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
          />
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">적용 방식:</span>
              <label className="inline-flex items-center gap-1 text-gray-300 cursor-pointer text-[11px]">
                <input
                  type="radio"
                  name="pasteMode"
                  checked={pasteMode === 'replace'}
                  onChange={() => setPasteMode('replace')}
                />
                전체 덮어쓰기
              </label>
              <label className="inline-flex items-center gap-1 text-gray-300 cursor-pointer text-[11px]">
                <input
                  type="radio"
                  name="pasteMode"
                  checked={pasteMode === 'append'}
                  onChange={() => setPasteMode('append')}
                />
                뒤에 이어붙이기
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold ${parsedPreview.length > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                감지: {parsedPreview.length}개 단원
              </span>
              <button
                type="button"
                onClick={handleApplyPaste}
                disabled={parsedPreview.length === 0}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs disabled:opacity-40 transition-colors"
              >
                목차에 적용
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border border-gray-800 rounded max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-500">단원 불러오는 중...</div>
        ) : units.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            등록된 단원이 없습니다. 단원 없이 교재만 등록할 수도 있습니다.
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="bg-[#181818] sticky top-0 text-gray-400 font-bold">
              <tr>
                <th className="py-1.5 px-2 w-10 text-center">순서</th>
                <th className="py-1.5 px-2 text-left">단원명</th>
                <th className="py-1.5 px-2 w-20 text-center">시작 p</th>
                <th className="py-1.5 px-2 w-20 text-center">끝 p</th>
                <th className="py-1.5 px-2 w-10 text-center">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {units.map((u, idx) => (
                <tr key={idx}>
                  <td className="py-1 px-2 text-center font-mono text-gray-500">{idx + 1}</td>
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      value={u.unit_name}
                      onChange={(e) => update(idx, 'unit_name', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      placeholder="예: 1.1 삼각형의 성질"
                      className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="number"
                      value={u.start_page}
                      onChange={(e) => update(idx, 'start_page', parseInt(e.target.value, 10) || 0)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      className={numInput}
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="number"
                      value={u.end_page}
                      onChange={(e) => update(idx, 'end_page', parseInt(e.target.value, 10) || 0)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      className={numInput}
                    />
                  </td>
                  <td className="py-1 px-2 text-center">
                    <button type="button" onClick={() => remove(idx)} className="p-1 text-gray-500 hover:text-red-400" title="단원 삭제">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
