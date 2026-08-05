'use client';

import React from 'react';
import ReportPreview from '../ReportPreview';
import PrintPreviewModal from './PrintPreviewModal';
import StudentReportCardPrintModal from './StudentReportCardPrintModal';
import { TagBatchInputModal } from './TagBatchInputModal';
import HokmaJournalPrintModal from './HokmaJournalPrintModal';

interface TodaySheetModalsProps {
  isPrintPreviewOpen: boolean;
  setIsPrintPreviewOpen: (open: boolean) => void;
  isCardPrintOpen: boolean;
  setIsCardPrintOpen: (open: boolean) => void;
  isHokmaPrintOpen: boolean;
  setIsHokmaPrintOpen: (open: boolean) => void;
  isTagModalOpen: boolean;
  setIsTagModalOpen: (open: boolean) => void;
  filteredStudents: any[];
  selectedDate: string;
  academyInfo?: any;
  teachers?: any[];
  masterTextbooks?: any[];
  currentUser?: any;
  onBatchSave?: (batchData: any) => void;
  activeColumns?: any[];
  columnWidths?: Record<string, number>;
}

export function TodaySheetModals({
  isPrintPreviewOpen,
  setIsPrintPreviewOpen,
  isCardPrintOpen,
  setIsCardPrintOpen,
  isHokmaPrintOpen,
  setIsHokmaPrintOpen,
  isTagModalOpen,
  setIsTagModalOpen,
  filteredStudents,
  selectedDate,
  academyInfo,
  teachers = [],
  masterTextbooks = [],
  currentUser,
  onBatchSave,
  activeColumns = [],
  columnWidths = {}
}: TodaySheetModalsProps) {
  return (
    <>
      {/* 1. 출석표 전체 인쇄 미리보기 모달 */}
      {isPrintPreviewOpen && (
        <PrintPreviewModal
          isOpen={isPrintPreviewOpen}
          onClose={() => setIsPrintPreviewOpen(false)}
          students={filteredStudents}
          selectedDate={selectedDate}
          academyInfo={academyInfo}
          activeColumns={activeColumns}
          columnWidths={columnWidths}
        />
      )}

      {/* 2. 카드/안내장 인쇄 모달 */}
      {isCardPrintOpen && (
        <StudentReportCardPrintModal
          isOpen={isCardPrintOpen}
          onClose={() => setIsCardPrintOpen(false)}
          students={filteredStudents}
          selectedDate={selectedDate}
          academyInfo={academyInfo}
        />
      )}

      {/* 3. 호크마 개별일지 인쇄 모달 */}
      {isHokmaPrintOpen && (
        <HokmaJournalPrintModal
          isOpen={isHokmaPrintOpen}
          onClose={() => setIsHokmaPrintOpen(false)}
          selectedStudents={filteredStudents}
          allStudents={filteredStudents}
          selectedTeacherId={undefined}
          masterTextbooks={masterTextbooks}
          initialMonth={selectedDate.substring(0, 7)}
          academyInfo={academyInfo}
        />
      )}

      {/* 4. 태그 일괄 입력 모달 */}
      {isTagModalOpen && (
        <TagBatchInputModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          students={filteredStudents}
          selectedIds={[]}
          onBatchSave={async (batchData) => {
            await onBatchSave?.(batchData);
            setIsTagModalOpen(false);
          }}
        />
      )}
    </>
  );
}
