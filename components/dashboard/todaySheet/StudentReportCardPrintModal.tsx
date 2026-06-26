'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Printer, X, FileSpreadsheet } from 'lucide-react';
import { getDayOfWeek } from '@/lib/utils';

interface StudentReportCardPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  selectedDate: string;
  academyInfo: any;
}

export default function StudentReportCardPrintModal({
  isOpen,
  onClose,
  students,
  selectedDate,
  academyInfo
}: StudentReportCardPrintModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handlePrint = () => {
    window.print();
  };

  // 날짜 포맷 변환 (2026-06-19 -> 2026. 6. 19)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr.replace(/-/g, '. ');
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
  };

  const dayKey = getDayOfWeek(selectedDate);

  // 등원 요일 추출 및 조인
  const getClassDays = (st: any) => {
    if (st.class_days && Array.isArray(st.class_days)) {
      return st.class_days.join('');
    }
    return '';
  };

  // 교시 구하기
  const getPeriod = (st: any) => {
    if (st.todaySession?.moved_to_hour !== undefined && st.todaySession?.moved_to_hour !== null) {
      return st.todaySession.moved_to_hour;
    }
    const stat = st.todaySession?.attendance_status || '';
    if (stat.includes(':')) {
      const parts = stat.split(':');
      const val = parseInt(parts[parts.length - 1]);
      if (!isNaN(val) && val < 24) return val;
    }
    const hours = st.day_schedules?.[dayKey] || [];
    if (hours.length > 0) {
      return Math.min(...hours.map((h: number) => h % 100));
    }
    return '';
  };

  // 테스트 표시 포맷팅
  const getTestDisplay = (session: any) => {
    if (!session || !session.test_id) return '';
    if (session.test_id.includes('(')) return session.test_id;
    if (session.test_score === undefined || session.test_score === null || session.test_score === '') {
      return session.test_id;
    }
    if (session.test_score_type === 'count') {
      return session.test_total_count 
        ? `${session.test_id} (${session.test_score}개 / ${session.test_total_count}개)`
        : `${session.test_id} (${session.test_score}개)`;
    }
    return `${session.test_id} (${session.test_score}점)`;
  };

  // 1. 인쇄 대상 리스트 가공 (교시 오름차순, 이름 오름차순 정렬)
  const sortedStudents = [...students].sort((a, b) => {
    const periodA = Number(getPeriod(a)) || 999;
    const periodB = Number(getPeriod(b)) || 999;
    if (periodA !== periodB) return periodA - periodB;
    return a.name.localeCompare(b.name, 'ko');
  });

  // 2. A4 6분할 출력을 위해 6개 단위로 쪼개고, 부족한 슬롯은 null로 채워서 빈 카드 가이드 확보
  const totalSlots = Math.ceil(sortedStudents.length / 6) * 6;
  const cardSlots = Array.from({ length: totalSlots }, (_, idx) => {
    if (idx < sortedStudents.length) {
      return sortedStudents[idx];
    }
    return null;
  });

  // 6개씩 페이지 분할
  const pages: any[][] = [];
  for (let i = 0; i < cardSlots.length; i += 6) {
    pages.push(cardSlots.slice(i, i + 6));
  }

  const printedDate = formatDate(selectedDate);

  return createPortal(
    <div className="fixed inset-0 z-[250] flex flex-col items-center justify-start p-4 md:p-8 bg-black/85 backdrop-blur-md overflow-y-auto print:static print:block print:overflow-visible print:p-0 print:bg-white print-preview-modal-container">
      {/* 컨트롤 헤더 바 */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-6 bg-gray-900/90 border border-white/10 rounded-xl p-4 shadow-xl shrink-0 no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              안내장 인쇄 미리보기 <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">{pages.length} Pages</span>
            </h3>
            <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">A4 세로형 6분할 피드백 카드 안내장 출력</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95"
          >
            <Printer size={14} /> 안내장 인쇄하기
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-all"
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* A4 용지 레이아웃 컨테이너 */}
      <div className="w-full max-w-[210mm] flex flex-col gap-8 print:block print:gap-0 print:w-full">
        {pages.map((pageCards, pageIdx) => (
          <div
            key={pageIdx}
            className="print-page-a4 w-[210mm] h-[297mm] bg-white text-black p-0 border border-gray-200 shadow-2xl grid grid-cols-2 grid-rows-3 overflow-hidden print:border-none print:shadow-none print:w-[210mm] print:h-[297mm] print:page-break-after-always print:page-break-inside-avoid mb-8 print:mb-0"
            style={{
              pageBreakAfter: 'always',
              pageBreakInside: 'avoid',
              boxSizing: 'border-box'
            }}
          >
            {pageCards.map((student, cardIdx) => {
              const globalIdx = pageIdx * 6 + cardIdx + 1;
              
              // 1. 빈 칸용 공백 카드 렌더링
              if (!student) {
                return (
                  <div
                    key={`empty-${cardIdx}`}
                    className="relative flex flex-col justify-start p-4 border border-dashed border-gray-300"
                    style={{
                      boxSizing: 'border-box',
                      height: '99mm',
                      width: '105mm'
                    }}
                  >
                    {/* 절취선 표시용 가이드 테두리만 출력 */}
                    <div className="w-full h-full border border-dashed border-gray-200/60 rounded flex items-center justify-center text-gray-300 text-[10px] font-black uppercase tracking-widest no-print select-none">
                      여백 카드 가이드
                    </div>
                  </div>
                );
              }

              // 2. 실제 학생 데이터 카드 렌더링
              const todaySess = student.todaySession || {};
              const lastSess = student.lastSession || {};
              const classDays = getClassDays(student);
              const period = getPeriod(student);
              const testDisplay = getTestDisplay(todaySess);

              return (
                <div
                  key={student.id}
                  className="relative flex flex-col justify-between p-4 border border-dashed border-gray-400"
                  style={{
                    boxSizing: 'border-box',
                    height: '99mm',
                    width: '105mm',
                    pageBreakInside: 'avoid'
                  }}
                >
                  <div className="flex flex-col h-full justify-between">
                    {/* 헤더: 2026. 6. 19 - 윤동건 - 고1 - 화목금 - 7 - <23> */}
                    <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-1">
                      <span className="text-[10px] font-black text-black tracking-tight whitespace-nowrap">
                        {printedDate} - {student.name} - {student.grade} - {classDays} - {period || '-'}
                      </span>
                      <span className="text-[10px] font-black text-black leading-none">
                        &lt;{globalIdx}&gt;
                      </span>
                    </div>

                    {/* 표 (6개 행 고정 높이) */}
                    <div className="flex-1 flex flex-col border border-black rounded-[2px] overflow-hidden text-[9.5px]">
                      
                      {/* 1. Mission */}
                      <div className="flex border-b border-black min-h-[22px] flex-1">
                        <div className="w-20 bg-gray-100 flex items-center justify-end pr-2 font-black border-r border-black select-none text-right shrink-0">
                          ▶ Mission
                        </div>
                        <div className="flex-1 px-2 py-1 flex items-center font-black text-[#ef4444] break-all leading-tight whitespace-pre-wrap">
                          {student.recent_mission || ''}
                        </div>
                      </div>

                      {/* 2. 해온숙제 */}
                      <div className="flex border-b border-black min-h-[22px] flex-1">
                        <div className="w-20 bg-gray-100 flex items-center justify-end pr-2 font-black border-r border-black select-none text-right shrink-0">
                          ▶ 해온숙제
                        </div>
                        <div className="flex-1 px-2 py-1 flex items-center font-bold text-gray-800 break-all leading-tight whitespace-pre-wrap">
                          {lastSess.homework_text || ''}
                        </div>
                      </div>

                      {/* 3. 오늘진도 */}
                      <div className="flex border-b border-black min-h-[22px] flex-1">
                        <div className="w-20 bg-gray-100 flex items-center justify-end pr-2 font-black border-r border-black select-none text-right shrink-0">
                          ▶ 오늘진도
                        </div>
                        <div className="flex-1 px-2 py-1 flex items-center font-bold text-gray-800 break-all leading-tight whitespace-pre-wrap">
                          {todaySess.classwork_text || ''}
                        </div>
                      </div>

                      {/* 4. 숙제 */}
                      <div className="flex border-b border-black min-h-[22px] flex-1">
                        <div className="w-20 bg-gray-100 flex items-center justify-end pr-2 font-black border-r border-black select-none text-right shrink-0">
                          ▶ 숙제
                        </div>
                        <div className="flex-1 px-2 py-1 flex items-center font-bold text-gray-800 break-all leading-tight whitespace-pre-wrap">
                          {todaySess.homework_text || ''}
                        </div>
                      </div>

                      {/* 5. 오늘Test */}
                      <div className="flex border-b border-black min-h-[22px] flex-1">
                        <div className="w-20 bg-gray-100 flex items-center justify-end pr-2 font-black border-r border-black select-none text-right shrink-0">
                          ▶ 오늘Test
                        </div>
                        <div className="flex-1 px-2 py-1 flex items-center font-bold text-gray-800 break-all leading-tight whitespace-pre-wrap">
                          {testDisplay}
                        </div>
                      </div>

                      {/* 6. 다음Test */}
                      <div className="flex min-h-[22px] flex-1">
                        <div className="w-20 bg-gray-100 flex items-center justify-end pr-2 font-black border-r border-black select-none text-right shrink-0">
                          ▶ 다음Test
                        </div>
                        <div className="flex-1 px-2 py-1 flex items-center font-bold text-gray-800 break-all leading-tight whitespace-pre-wrap">
                          {todaySess.next_quiz_text || ''}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 인쇄 시 감출 스타일시트 */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print,
          header,
          footer,
          nav,
          aside {
            display: none !important;
          }
          .print-preview-modal-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            overflow: visible !important;
          }
          .print-page-a4 {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            width: 210mm !important;
            height: 297mm !important;
          }
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
