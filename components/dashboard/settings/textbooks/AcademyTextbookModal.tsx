'use client';

import React, { useState } from 'react';
import { X, BookPlus, Loader2, Lock } from 'lucide-react';
import {
  BOOKCODE_SUFFIXES,
  GRADE_CODE_OPTIONS,
  BookcodeSuffix,
  buildBookcode,
  sanitizeCodePart,
} from '@/lib/textbookCode';
import { MasterUnitEditor, MasterUnitDraft } from '@/app/master/components/MasterUnitEditor';
import { getTextbookAuthHeaders } from '@/lib/textbookAuthClient';

interface AcademyTextbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  academySlug: string;
  academyName: string;
  onSuccess: () => void;
}

const CUSTOM_GRADE = '__custom';
const inputCls = 'w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-indigo-500';

export default function AcademyTextbookModal({
  isOpen,
  onClose,
  academySlug,
  academyName,
  onSuccess,
}: AcademyTextbookModalProps) {
  const [year, setYear] = useState('2022');
  const [gradeSelect, setGradeSelect] = useState('m22');
  const [customGrade, setCustomGrade] = useState('');
  const [abbr, setAbbr] = useState('');
  const [suffix, setSuffix] = useState<BookcodeSuffix>('main');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('정규');
  const [publisher, setPublisher] = useState(academyName ? `${academyName} 자체` : '자체제작');
  const [ePeriod, setEPeriod] = useState('20');
  const [units, setUnits] = useState<MasterUnitDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const gradeCode = gradeSelect === CUSTOM_GRADE ? sanitizeCodePart(customGrade) : gradeSelect;
  const bookcode = buildBookcode({
    prefix: academySlug,
    year,
    gradeCode,
    abbr: sanitizeCodePart(abbr),
    suffix,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert('교재명은 필수 입력 항목입니다.'); return; }
    if (!bookcode) { alert('교재 약어(소문자 영문·숫자)와 개정연도를 확인해 주세요.'); return; }
    if (units.some((u) => !u.unit_name.trim())) { alert('이름이 비어 있는 단원이 있습니다.'); return; }
    if (units.some((u) => u.start_page > u.end_page)) { alert('시작 페이지가 끝 페이지보다 큰 단원이 있습니다.'); return; }

    setIsSubmitting(true);
    try {
      const headers = await getTextbookAuthHeaders();
      const res = await fetch('/api/textbooks', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookcode,
          title: title.trim(),
          grade: gradeSelect === CUSTOM_GRADE ? customGrade : gradeSelect,
          category: category.trim(),
          publisher: publisher.trim() || '자체제작',
          e_period: ePeriod.trim(),
          units,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '교재 등록 실패');

      alert(`[${title.trim()}] 우리 학원 자체 교재가 등록되었습니다. (단원 ${data.unit_count ?? 0}개)`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`등록 실패: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-gray-800 rounded-lg max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <BookPlus size={18} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-white">우리 학원 자체 교재 등록</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
              e.preventDefault();
            }
          }}
          className="space-y-4 text-xs"
        >
          {/* 1. 교재코드 자동 생성 (학원 slug 고정) */}
          <div className="p-3 rounded border border-purple-800/40 bg-purple-950/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-purple-300 font-bold flex items-center gap-1.5">
                <Lock size={12} /> 학원 전용 식별자 (접두어 고정)
              </label>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-700/50">
                {academySlug}
              </span>
            </div>
            <p className="text-[10px] text-gray-400">
              * {academyName || academySlug} 학원 전용 교재로 등록되며, 타 학원에는 절대 노출되지 않습니다.
            </p>

            <div className="grid grid-cols-4 gap-2 pt-1">
              <div>
                <label className="block text-gray-400 font-bold mb-1">개정연도</label>
                <input
                  type="text"
                  maxLength={4}
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-gray-400 font-bold mb-1">학년·학기</label>
                <select value={gradeSelect} onChange={(e) => setGradeSelect(e.target.value)} className={inputCls}>
                  {GRADE_CODE_OPTIONS.map((g) => (
                    <option key={g.code} value={g.code}>{g.label} · {g.code}</option>
                  ))}
                  <option value={CUSTOM_GRADE}>직접 입력...</option>
                </select>
                {gradeSelect === CUSTOM_GRADE && (
                  <input
                    type="text"
                    value={customGrade}
                    onChange={(e) => setCustomGrade(sanitizeCodePart(e.target.value))}
                    placeholder="예: h11"
                    className={`${inputCls} mt-1`}
                  />
                )}
              </div>
              <div>
                <label className="block text-gray-400 font-bold mb-1">교재 약어 *</label>
                <input
                  type="text"
                  value={abbr}
                  onChange={(e) => setAbbr(sanitizeCodePart(e.target.value))}
                  placeholder="예: final"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className="block text-gray-400 font-bold mb-1">끝말</label>
                <select value={suffix} onChange={(e) => setSuffix(e.target.value as BookcodeSuffix)} className={inputCls}>
                  {BOOKCODE_SUFFIXES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 font-bold mb-1">생성될 교재코드</label>
              <div className={`px-3 py-1.5 rounded border font-mono text-[11px] break-all ${
                bookcode ? 'border-purple-600/50 bg-purple-950/40 text-purple-200' : 'border-gray-800 text-gray-500'
              }`}>
                {bookcode ?? '약어(소문자 영문·숫자)를 입력하시면 코드가 조합됩니다.'}
              </div>
            </div>
          </div>

          {/* 2. 교재 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 font-bold mb-1">교재명 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: [중2-2] 호크마 내신대비 프린트"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-gray-400 font-bold mb-1">구분(시즌)</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="예: 정규, 내신대비, 특강"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 font-bold mb-1">출판사/제작처</label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="예: 자체제작, 학원프린트"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-gray-400 font-bold mb-1">기준 회차(e-period)</label>
              <input
                type="text"
                value={ePeriod}
                onChange={(e) => setEPeriod(e.target.value)}
                placeholder="20"
                className={inputCls}
              />
            </div>
          </div>

          {/* 3. 단원 목차 스프레드시트 편집기 (엑셀 일괄 붙여넣기 지원) */}
          <MasterUnitEditor units={units} onChange={setUnits} />

          {/* 하단 버튼 */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-bold transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !bookcode || !title.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              <span>자체 교재 등록</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
