'use client';

import React from 'react';
import {
  COMMON_PREFIX,
  BOOKCODE_SUFFIXES,
  GRADE_CODE_OPTIONS,
  BookcodeSuffix,
  buildBookcode,
  sanitizeCodePart,
  sanitizeSlug,
} from '@/lib/textbookCode';
import type { MasterAcademyOption } from '../hooks/useMasterTextbooks';

export interface BookcodeFormParts {
  ownerType: 'common' | 'academy';
  academySlug: string;
  year: string;
  gradeSelect: string;    // 목록 코드 또는 CUSTOM_GRADE
  customGrade: string;
  abbr: string;
  suffix: BookcodeSuffix;
}

export const CUSTOM_GRADE = '__custom';

export const INITIAL_BOOKCODE_PARTS: BookcodeFormParts = {
  ownerType: 'common',
  academySlug: '',
  year: '2022',
  gradeSelect: 'm22',
  customGrade: '',
  abbr: '',
  suffix: 'main',
};

/** 입력값으로부터 현재 접두어와 완성된 교재코드를 계산합니다 (불완전하면 code = null) */
export function resolveBookcode(parts: BookcodeFormParts, _academies?: MasterAcademyOption[]) {
  const prefix = parts.ownerType === 'common'
    ? COMMON_PREFIX
    : sanitizeSlug(parts.academySlug).replace(/^-+|-+$/g, '');
  const gradeCode = parts.gradeSelect === CUSTOM_GRADE ? sanitizeCodePart(parts.customGrade) : parts.gradeSelect;
  const code = prefix
    ? buildBookcode({ prefix, year: parts.year, gradeCode, abbr: parts.abbr, suffix: parts.suffix })
    : null;
  return { prefix, code };
}

interface MasterBookcodeBuilderProps {
  parts: BookcodeFormParts;
  academies?: MasterAcademyOption[];
  onChange: (parts: BookcodeFormParts) => void;
}

const inputCls = 'w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500';

/**
 * 💡 교재코드 자동 생성 폼 — {접두어}--{개정연도}-{학년학기코드}-{교재약어}-{main|wb}
 * 접두어: 공용 교재 = common / 학원 교재 = 해당 학원 slug 직접 입력
 */
export function MasterBookcodeBuilder({ parts, academies, onChange }: MasterBookcodeBuilderProps) {
  const set = <K extends keyof BookcodeFormParts>(key: K, val: BookcodeFormParts[K]) => onChange({ ...parts, [key]: val });
  const { prefix, code } = resolveBookcode(parts, academies);

  return (
    <div className="space-y-3 p-3 rounded border border-gray-800 bg-black/20">
      <div>
        <label className="block text-gray-400 font-bold mb-1">교재 소유 구분 *</label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            type="button"
            onClick={() => set('ownerType', 'common')}
            className={`py-2 px-3 text-xs font-bold rounded border transition-colors ${
              parts.ownerType === 'common'
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            공용 교재 (접두어: common)
          </button>
          <button
            type="button"
            onClick={() => set('ownerType', 'academy')}
            className={`py-2 px-3 text-xs font-bold rounded border transition-colors ${
              parts.ownerType === 'academy'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            개별 학원 전용 (slug 직접 입력)
          </button>
        </div>

        {parts.ownerType === 'academy' && (
          <div>
            <label className="block text-[11px] text-purple-300 font-bold mb-1">
              대상 학원 식별자(slug) 입력 *
            </label>
            <input
              type="text"
              value={parts.academySlug}
              onChange={(e) => set('academySlug', sanitizeSlug(e.target.value))}
              placeholder="예: hokma, math-lab (소문자 영문·숫자·하이픈)"
              className={`${inputCls} font-mono border-purple-500/50 focus:border-purple-400`}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              * 해당 학원의 slug를 입력하시면 해당 학원 전용(private) 교재로 등록됩니다.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-gray-400 font-bold mb-1">개정연도</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={parts.year}
            onChange={(e) => set('year', e.target.value.replace(/\D/g, ''))}
            placeholder="2022"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-gray-400 font-bold mb-1">학년·학기</label>
          <select value={parts.gradeSelect} onChange={(e) => set('gradeSelect', e.target.value)} className={inputCls}>
            {GRADE_CODE_OPTIONS.map((g) => (
              <option key={g.code} value={g.code}>{g.label} · {g.code}</option>
            ))}
            <option value={CUSTOM_GRADE}>직접 입력...</option>
          </select>
          {parts.gradeSelect === CUSTOM_GRADE && (
            <input
              type="text"
              value={parts.customGrade}
              onChange={(e) => set('customGrade', sanitizeCodePart(e.target.value))}
              placeholder="소문자·숫자"
              className={`${inputCls} mt-1 font-mono`}
            />
          )}
        </div>
        <div>
          <label className="block text-gray-400 font-bold mb-1">교재 약어 *</label>
          <input
            type="text"
            value={parts.abbr}
            onChange={(e) => set('abbr', sanitizeCodePart(e.target.value))}
            placeholder="예: gnssen"
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <label className="block text-gray-400 font-bold mb-1">끝말</label>
          <select value={parts.suffix} onChange={(e) => set('suffix', e.target.value as BookcodeSuffix)} className={inputCls}>
            {BOOKCODE_SUFFIXES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-gray-400 font-bold mb-1">완성될 교재코드</label>
        <div className={`px-3 py-2 rounded border font-mono text-[12px] break-all ${code ? 'border-emerald-700/50 bg-emerald-950/20 text-emerald-300' : 'border-gray-800 text-gray-500'}`}>
          {code ?? (prefix ? '교재 약어(소문자 영문·숫자)와 연도 4자리를 입력하면 코드가 만들어집니다.' : '학원을 선택해 주세요.')}
        </div>
        <p className="text-[10px] text-gray-500 mt-1">
          한글·공백·대문자는 자동으로 제외됩니다. 오답노트 DB와 같은 이름을 쓰므로 등록 후에는 변경할 수 없습니다.
        </p>
      </div>
    </div>
  );
}
