'use client';

import React, { useEffect, useState } from 'react';
import { X, BookPlus, BookOpen, Loader2 } from 'lucide-react';
import { MasterUnitEditor, MasterUnitDraft } from './MasterUnitEditor';
import { MasterBookcodeBuilder, BookcodeFormParts, INITIAL_BOOKCODE_PARTS, resolveBookcode } from './MasterBookcodeBuilder';
import type { MasterTextbookRecord, MasterAcademyOption } from '../hooks/useMasterTextbooks';

export interface MasterTextbookFormData {
  bookcode: string;
  title: string;
  grade: string;
  category: string;
  publisher: string;
  e_period: string;
  /** 신규 등록 시: null/미지정 = 공용 교재, 값 = 해당 학원 slug */
  owner_slug?: string | null;
  owner_academy_id?: string | null;
  units: MasterUnitDraft[];
}

export interface MasterTextbookModalActions {
  onClose: () => void;
  onSubmit: (data: MasterTextbookFormData, isEdit: boolean) => Promise<void>;
  loadUnits: (bookcode: string) => Promise<MasterUnitDraft[]>;
}

interface MasterTextbookModalProps {
  /** null 이면 신규 등록, 값이 있으면 기존 교재 수정 */
  book: MasterTextbookRecord | null;
  academies: MasterAcademyOption[];
  isSubmitting: boolean;
  actions: MasterTextbookModalActions;
}

const GRADES = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const inputCls = 'w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500';

/**
 * 💡 교재 원스톱 등록/수정 모달
 * 상단: 교재 기본 정보(구글 시트 1번 탭) / 하단: 단원 목차(구글 시트 2번 탭)
 * 부모가 열릴 때만 마운트하므로 열 때마다 폼이 초기화됩니다.
 */
export function MasterTextbookModal({ book, academies, isSubmitting, actions }: MasterTextbookModalProps) {
  const isEdit = !!book;
  const [title, setTitle] = useState(book?.title ?? '');
  const [codeParts, setCodeParts] = useState<BookcodeFormParts>(INITIAL_BOOKCODE_PARTS);
  const [grade, setGrade] = useState(book?.grade ?? '중1');
  const [publisher, setPublisher] = useState(book?.publisher ?? '');
  const [category, setCategory] = useState(book?.category ?? '정규');
  const [ePeriod, setEPeriod] = useState(book?.e_period ?? '20');
  const [units, setUnits] = useState<MasterUnitDraft[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(isEdit);

  // 수정: 기존 코드 고정 / 신규: 입력값으로 자동 조합
  const bookcode = isEdit ? book!.bookcode : (resolveBookcode(codeParts, academies).code ?? '');

  // 수정 모드: 기존 단원 불러오기
  useEffect(() => {
    if (!book) return;
    let alive = true;
    actions.loadUnits(book.bookcode)
      .then((loaded) => { if (alive) setUnits(loaded); })
      .finally(() => { if (alive) setIsLoadingUnits(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.bookcode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert('교재명은 필수 입력 항목입니다.'); return; }
    if (codeParts.ownerType === 'academy' && !codeParts.academySlug.trim()) {
      alert('학원 전용 교재 등록 시 학원 식별자(slug)를 입력해 주세요.');
      return;
    }
    if (!bookcode) { alert('교재코드를 만들 수 없습니다. 개정연도(4자리), 교재 약어(소문자 영문·숫자)를 확인해 주세요.'); return; }
    if (units.some((u) => !u.unit_name.trim())) { alert('이름이 비어 있는 단원이 있습니다.'); return; }
    if (units.some((u) => u.start_page > u.end_page)) { alert('시작 페이지가 끝 페이지보다 큰 단원이 있습니다.'); return; }

    await actions.onSubmit({
      bookcode,
      title: title.trim(),
      grade: grade.trim(),
      category: category.trim(),
      publisher: publisher.trim() || '시중출판사',
      e_period: ePeriod.trim(),
      owner_slug: isEdit ? undefined : (codeParts.ownerType === 'academy' ? codeParts.academySlug.trim() : null),
      units,
    }, isEdit);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-gray-800 rounded-lg max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            {isEdit ? <BookOpen size={18} className="text-indigo-400" /> : <BookPlus size={18} className="text-blue-400" />}
            <h3 className="text-sm font-bold text-white">{isEdit ? '교재 정보 및 단원 수정' : '신규 교재 + 단원 일괄 등록'}</h3>
          </div>
          <button onClick={actions.onClose} className="text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
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
          <div>
            <label className="block text-gray-400 font-bold mb-1">교재명 (타이틀) *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: [중2-2] 쎈수학" className={inputCls} required />
          </div>

          {isEdit ? (
            <div>
              <label className="block text-gray-400 font-bold mb-1">교재코드 (고유식별자)</label>
              <input type="text" value={bookcode} readOnly className={`${inputCls} font-mono opacity-60 cursor-not-allowed`} />
              <p className="text-[10px] text-gray-500 mt-1">교재코드는 등록 후 변경할 수 없습니다.</p>
            </div>
          ) : (
            <MasterBookcodeBuilder parts={codeParts} academies={academies} onChange={setCodeParts} />
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-gray-400 font-bold mb-1">학년</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls}>
                {(GRADES.includes(grade) ? GRADES : [grade, ...GRADES]).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 font-bold mb-1">출판사</label>
              <input type="text" value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="예: 신사고" className={inputCls} />
            </div>
            <div>
              <label className="block text-gray-400 font-bold mb-1">카테고리</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="정규" className={inputCls} />
            </div>
          </div>

          <MasterUnitEditor units={units} onChange={setUnits} isLoading={isLoadingUnits} />

          <div className="pt-2 flex justify-end gap-2 border-t border-gray-800">
            <button type="button" onClick={actions.onClose} disabled={isSubmitting} className="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 font-bold">취소</button>
            <button type="submit" disabled={isSubmitting || isLoadingUnits} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5">
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              {isEdit ? '수정 내용 저장' : '교재 및 전체 단원 한 번에 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
