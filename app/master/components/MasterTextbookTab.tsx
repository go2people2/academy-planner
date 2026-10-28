'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, BookOpen, RefreshCw } from 'lucide-react';
import { MasterTextbookStats } from './MasterTextbookStats';
import { MasterTextbookModal, MasterTextbookFormData } from './MasterTextbookModal';
import { MasterTextbookRow } from './MasterTextbookRow';
import { useMasterTextbooks, MasterTextbookRecord } from '../hooks/useMasterTextbooks';

interface MasterTextbookTabProps {
  isAuthorized: boolean;
}

export function MasterTextbookTab({ isAuthorized }: MasterTextbookTabProps) {
  const {
    textbooks,
    stats,
    academies,
    isLoading,
    isUpdating,
    isSubmitting,
    fetchTextbooks,
    toggleStatus,
    addTextbook,
    updateTextbook,
    deleteTextbook,
    loadUnits,
  } = useMasterTextbooks(isAuthorized);

  // book === null 이면 신규 등록, 값이 있으면 수정
  const [modal, setModal] = useState<{ open: boolean; book: MasterTextbookRecord | null }>({ open: false, book: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | 'elem' | 'mid' | 'high'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'public' | 'custom'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (isAuthorized) fetchTextbooks();
  }, [isAuthorized, fetchTextbooks]);

  // 필터링 목록
  const filteredBooks = useMemo(() => {
    return textbooks.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      if (q && !b.title?.toLowerCase().includes(q) && !b.bookcode?.toLowerCase().includes(q)) return false;

      // 구분 필터
      const isPublic = b.share_scope === 'public' && b.share_status === 'approved';
      if (scopeFilter === 'public' && !isPublic) return false;
      if (scopeFilter === 'custom' && isPublic) return false;

      // 상태 필터
      if (statusFilter === 'active' && b.status !== '활성') return false;
      if (statusFilter === 'inactive' && b.status !== '비활성') return false;

      // 학년 필터
      if (gradeFilter !== 'all') {
        const g = (b.grade || '').toLowerCase();
        if (gradeFilter === 'elem' && !(g.includes('초') || b.title.includes('초'))) return false;
        if (gradeFilter === 'mid' && !(g.includes('중') || b.title.includes('중'))) return false;
        if (gradeFilter === 'high' && !(g.includes('고') || g.includes('공수') || g.includes('미적') || g.includes('대수') || g.includes('확통') || g.includes('기하'))) return false;
      }
      return true;
    });
  }, [textbooks, searchQuery, gradeFilter, scopeFilter, statusFilter]);

  const openCreateModal = () => setModal({ open: true, book: null });
  const openEditModal = (book: MasterTextbookRecord) => setModal({ open: true, book });
  const closeModal = () => setModal({ open: false, book: null });

  // 등록/수정 성공 시에만 모달을 닫아 입력 내용 유실 방지
  const handleModalSubmit = async (data: MasterTextbookFormData, isEdit: boolean) => {
    const ok = isEdit ? await updateTextbook(data) : await addTextbook(data);
    if (ok) closeModal();
  };

  const handleDeleteTextbook = async (book: MasterTextbookRecord) => {
    const confirmed = window.confirm(
      `[${book.title}] (${book.bookcode})\n\n해당 교재와 연결된 단원 ${book.unit_count}개가 DB에서 영구 삭제됩니다.\n과거 수업 이력이 있는 교재라면 삭제 대신 '비활성' 설정을 권장합니다.\n\n정말 영구 삭제하시겠습니까?`
    );
    if (!confirmed) return;
    await deleteTextbook(book.bookcode);
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 통계 카드 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <BookOpen size={18} className="text-blue-400" />
            AMS 전체 교재 현황 및 공용 배포 관리
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">전국 가맹 학원에 공급되는 공용 교재의 마스터 상태 및 목차를 총괄 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTextbooks()}
            disabled={isLoading}
            className="p-2 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 rounded font-bold text-xs flex items-center gap-1.5 transition-colors"
            title="새로고침"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-900/30 transition-all"
          >
            <Plus size={14} /> 새 교재 및 단원 등록
          </button>
        </div>
      </div>

      <MasterTextbookStats stats={stats} isLoading={isLoading} />

      {/* 2. 컨트롤 바 (검색 + 필터) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111111] p-3 rounded border border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* 학년 필터 */}
          <div className="flex items-center gap-1 bg-gray-900/60 p-1 rounded border border-gray-800">
            {(['all', 'elem', 'mid', 'high'] as const).map((gf) => {
              const labels = { all: '전체', elem: '초등', mid: '중등', high: '고등' };
              const active = gradeFilter === gf;
              return (
                <button
                  key={gf}
                  onClick={() => setGradeFilter(gf)}
                  className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                    active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {labels[gf]}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-gray-700 mx-1 hidden sm:block" />

          {/* 구분 필터 */}
          <div className="flex items-center gap-1 bg-gray-900/60 p-1 rounded border border-gray-800">
            {(['all', 'public', 'custom'] as const).map((sf) => {
              const labels = { all: '전체구분', public: '공용 교재', custom: '학원 자체' };
              const active = scopeFilter === sf;
              return (
                <button
                  key={sf}
                  onClick={() => setScopeFilter(sf)}
                  className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                    active ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {labels[sf]}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-gray-700 mx-1 hidden sm:block" />

          {/* 상태 필터 */}
          <div className="flex items-center gap-1 bg-gray-900/60 p-1 rounded border border-gray-800">
            {(['all', 'active', 'inactive'] as const).map((st) => {
              const labels = { all: '전체상태', active: '활성', inactive: '보관(비활성)' };
              const active = statusFilter === st;
              const color = st === 'active' ? 'bg-emerald-600 text-white' : st === 'inactive' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-white';
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                    active ? color : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {labels[st]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="교재명 또는 코드 검색..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* 3. 테이블 */}
      <div className="bg-[#111111] border border-gray-800 rounded overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#181818] sticky top-0 z-10 border-b border-gray-800 text-gray-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-28 text-center">마스터 상태</th>
                <th className="py-2.5 px-3 w-64">교재코드</th>
                <th className="py-2.5 px-3">교재명</th>
                <th className="py-2.5 px-3 w-20 text-center">학년</th>
                <th className="py-2.5 px-3 w-28">출판사</th>
                <th className="py-2.5 px-3 w-24 text-center">등록 단원 수</th>
                <th className="py-2.5 px-3 w-24 text-center">구분</th>
                <th className="py-2.5 px-3 w-28 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filteredBooks.map((book) => (
                <MasterTextbookRow
                  key={book.bookcode}
                  book={book}
                  isBusy={isUpdating === book.bookcode}
                  onToggle={(b) => toggleStatus(b.bookcode, b.status)}
                  onEdit={openEditModal}
                  onDelete={handleDeleteTextbook}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 교재 등록/수정 모달 (열릴 때마다 새로 마운트되어 폼 초기화) */}
      {modal.open && (
        <MasterTextbookModal
          book={modal.book}
          academies={academies}
          isSubmitting={isSubmitting}
          actions={{ onClose: closeModal, onSubmit: handleModalSubmit, loadUnits }}
        />
      )}
    </div>
  );
}
