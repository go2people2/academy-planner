'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Printer, X, FileText, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { getDayOfWeek } from '@/lib/utils';

interface ChecklistPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  selectedDate: string;
  academyInfo: any;
  topics: any[];
  items: Record<string, Record<string, any>>;
}

export default function ChecklistPrintPreviewModal({
  isOpen,
  onClose,
  students,
  selectedDate,
  academyInfo,
  topics,
  items
}: ChecklistPrintPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  
  // 이미지 저장 엔진 로드 관련 상태 (dom-to-image)
  const [domToImageLoaded, setDomToImageLoaded] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);

  // PDF 저장 엔진 로드 관련 상태 (jsPDF)
  const [jsPdfLoaded, setJsPdfLoaded] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);

  // Excel 저장 엔진 로드 관련 상태 (SheetJS)
  const [xlsxLoaded, setXlsxLoaded] = useState(false);
  const [isSavingExcel, setIsSavingExcel] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // topics 변경 시 초기화
  useEffect(() => {
    if (topics.length > 0) {
      setSelectedTopicIds(topics.map(t => t.id));
    }
  }, [topics]);

  // academyInfo 로드 시 최초 1회 기본 타이틀 설정
  useEffect(() => {
    if (academyInfo?.name) {
      setCustomTitle(`${academyInfo.name} 체크리스트`);
    } else {
      setCustomTitle('학원 체크리스트');
    }
  }, [academyInfo]);

  // dom-to-image CDN 동적 적재
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      if ((window as any).domtoimage) {
        setDomToImageLoaded(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js';
      script.async = true;
      script.onload = () => {
        setDomToImageLoaded(true);
      };
      script.onerror = () => {
        console.error('dom-to-image load failed');
      };
      document.body.appendChild(script);
    }
  }, [isOpen]);

  // jsPDF CDN 동적 적재
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      if ((window as any).jspdf) {
        setJsPdfLoaded(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.async = true;
      script.onload = () => {
        setJsPdfLoaded(true);
      };
      script.onerror = () => {
        console.error('jsPDF load failed');
      };
      document.body.appendChild(script);
    }
  }, [isOpen]);

  // SheetJS Excel CDN 동적 적재
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      if ((window as any).XLSX) {
        setXlsxLoaded(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
      script.async = true;
      script.onload = () => {
        setXlsxLoaded(true);
      };
      script.onerror = () => {
        console.error('SheetJS load failed');
      };
      document.body.appendChild(script);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handlePrint = () => {
    // 💡 브라우저 포커스 리셋 후 인쇄 실행 (취소 후 재클릭 시 먹통 버그 완벽 방지)
    if (typeof window !== 'undefined') {
      window.focus();
      setTimeout(() => {
        window.print();
      }, 50);
    }
  };

  // dom-to-image 기반 이미지 저장 처리
  const handleSaveAsImage = async () => {
    const domtoimage = (window as any).domtoimage;
    if (!domtoimage) {
      alert('이미지 생성 라이브러리가 아직 준비되지 않았습니다. 1~2초 후 다시 시도해 주세요.');
      return;
    }
    const printArea = document.querySelector('.print-area') as HTMLElement;
    if (!printArea) {
      alert('저장할 영역을 찾을 수 없습니다.');
      return;
    }

    setIsSavingImage(true);
    try {
      // 2배 선명도 스케일링 설정
      const scale = 2;
      const dataUrl = await domtoimage.toPng(printArea, {
        bgcolor: '#ffffff',
        width: printArea.offsetWidth * scale,
        height: printArea.offsetHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${printArea.offsetWidth}px`,
          height: `${printArea.offsetHeight}px`
        }
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${customTitle || '체크리스트'}_${selectedDate}.png`;
      link.click();
    } catch (e) {
      console.error('Save Image Error:', e);
      alert('이미지 파일 변환 중 오류가 발생했습니다.');
    } finally {
      setIsSavingImage(false);
    }
  };

  // jsPDF 및 dom-to-image 연동 PDF 변환 저장
  const handleSaveAsPdf = async () => {
    const domtoimage = (window as any).domtoimage;
    const jspdf = (window as any).jspdf;
    if (!domtoimage || !jspdf) {
      alert('PDF 변환 도구가 아직 준비되지 않았습니다. 1~2초 후 다시 시도해 주세요.');
      return;
    }
    const printArea = document.querySelector('.print-area') as HTMLElement;
    if (!printArea) {
      alert('저장할 영역을 찾을 수 없습니다.');
      return;
    }

    setIsSavingPdf(true);
    try {
      // 2배 선명도 캡처
      const scale = 2;
      const dataUrl = await domtoimage.toPng(printArea, {
        bgcolor: '#ffffff',
        width: printArea.offsetWidth * scale,
        height: printArea.offsetHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${printArea.offsetWidth}px`,
          height: `${printArea.offsetHeight}px`
        }
      });

      // A4 문서 인스턴스화
      const doc = new jspdf.jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // A4 규격(210 x 297)에 맞춰 삽입
      doc.addImage(dataUrl, 'PNG', 0, 0, 210, 297);
      
      // 다운로드 트리거
      doc.save(`${customTitle || '체크리스트'}_${selectedDate}.pdf`);
    } catch (e) {
      console.error('Save PDF Error:', e);
      alert('PDF 파일 변환 중 오류가 발생했습니다.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  // 💡 진도파악 객체/문자열 데이터 안전 변환 헬퍼 (Objects are not valid as a React child 방지)
  const formatBookProgress = (prog: any): string => {
    if (!prog) return '-';
    if (typeof prog === 'string') return prog.trim() || '-';
    if (typeof prog === 'object') {
      const keys = Object.keys(prog);
      if (keys.length === 0) return '-';
      return keys.map(k => {
        const v = prog[k];
        return v ? `${k}: ${v}` : k;
      }).join(', ');
    }
    return String(prog);
  };

  // SheetJS 활용 엑셀 저장 처리
  const handleSaveAsExcel = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert('엑셀 변환 라이브러리가 아직 준비되지 않았습니다. 1~2초 후 다시 시도해 주세요.');
      return;
    }

    setIsSavingExcel(true);
    try {
      const excelData: any[][] = [];

      // 1. 타이틀 행 추가
      excelData.push([`${customTitle} (${formattedDate})`]);
      excelData.push([]); // 빈 칸 행

      // 2. 표 헤더 행 추가
      const headerRow = ['학생 이름'];
      displayTopics.forEach(t => {
        headerRow.push(`${t.title} - 완료`);
        headerRow.push(`${t.title} - 메모`);
      });
      excelData.push(headerRow);

      // 3. 학생 데이터 행 추가
      students.forEach(student => {
        const row = [student.name];
        displayTopics.forEach(t => {
          const cellData = items[student.id]?.[t.id] || { status: 'none', memo: '' };
          row.push(getStatusSymbol(cellData.status));
          row.push(cellData.memo || '');
        });
        excelData.push(row);
      });

      // 4. 완료 인원 합계 행 추가
      if (students.length > 0 && displayTopics.length > 0) {
        const sumRow = ['완료 인원'];
        displayTopics.forEach(t => {
          const count = getCheckedCount(t.id);
          sumRow.push(`${count}명`);
          sumRow.push(''); // 메모 열은 빈칸
        });
        excelData.push(sumRow);
      }

      // 워크시트 생성
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // 열 가로 폭 자동 정의
      const colsWidth = [{ wch: 15 }]; // 이름 열
      displayTopics.forEach(() => {
        colsWidth.push({ wch: 10 }); // 완료 기호 열
        colsWidth.push({ wch: 25 }); // 메모 열
      });
      worksheet['!cols'] = colsWidth;

      // 워크북 생성 및 다운로드 실행
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '체크리스트');
      XLSX.writeFile(workbook, `${customTitle || '체크리스트'}_${selectedDate}.xlsx`);
    } catch (e) {
      console.error('Save Excel Error:', e);
      alert('엑셀 변환 중 오류가 발생했습니다.');
    } finally {
      setIsSavingExcel(false);
    }
  };

  // 완료 인원수 집계
  const getCheckedCount = (topicId: string) => {
    let count = 0;
    students.forEach(student => {
      const cellData = items[student.id]?.[topicId];
      if (cellData?.status === 'checked' || cellData?.is_checked === true) {
        count++;
      }
    });
    return count;
  };

  // 상태 기호 텍스트 변환
  const getStatusSymbol = (status: string) => {
    switch (status) {
      case 'checked':
        return '✓';
      case 'hold':
        return '▲';
      case 'na':
        return '-';
      default:
        return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked':
        return 'text-green-600 font-bold';
      case 'hold':
        return 'text-amber-600 font-bold';
      case 'na':
        return 'text-gray-400 font-normal';
      default:
        return '';
    }
  };

  // 인쇄 대상 필터링된 주제들
  const displayTopics = topics.filter(t => selectedTopicIds.includes(t.id));

  const dayOfWeekStr = getDayOfWeek(selectedDate);
  const formattedDate = `${selectedDate} (${dayOfWeekStr})`;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm no-print p-4">
      {/* 인쇄 전용 CSS 삽입 */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          /* 테이블 테두리 선명화 */
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10px !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #000000 !important;
            padding: 6px 4px !important;
            background: transparent !important;
            color: #000000 !important;
          }
          .print-table th {
            font-weight: bold !important;
            background-color: #f2f2f2 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-lg shadow-2xl flex flex-col w-full max-w-5xl h-[90vh] overflow-hidden text-[#37352f]"
      >
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">📋 체크리스트 인쇄 미리보기</h3>
              <p className="text-[10px] text-gray-500 font-bold">제목을 클릭하여 인쇄용 제목을 적절히 커스텀하세요.</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {/* 이미지로 저장 버튼 */}
            <button
              onClick={handleSaveAsImage}
              disabled={isSavingImage || !domToImageLoaded}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 text-white rounded-[6px] text-xs font-black shadow-md cursor-pointer transition-all"
            >
              {isSavingImage ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              이미지로 저장
            </button>
            {/* PDF로 저장 버튼 */}
            <button
              onClick={handleSaveAsPdf}
              disabled={isSavingPdf || !domToImageLoaded || !jsPdfLoaded}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 text-white rounded-[6px] text-xs font-black shadow-md cursor-pointer transition-all"
            >
              {isSavingPdf ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              PDF로 저장
            </button>
            {/* 엑셀로 저장 버튼 */}
            <button
              onClick={handleSaveAsExcel}
              disabled={isSavingExcel || !xlsxLoaded}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white rounded-[6px] text-xs font-black shadow-md cursor-pointer transition-all"
            >
              {isSavingExcel ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={14} />
              )}
              엑셀로 저장
            </button>
            {/* 인쇄하기 버튼 */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-[6px] text-xs font-black shadow-md cursor-pointer transition-all mr-1.5"
            >
              <Printer size={14} />
              인쇄하기
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 인쇄 대상 제외/선택 컨트롤러 */}
        {topics.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-gray-50 border-b border-gray-150 px-6 py-3 text-[11px] font-bold no-print shrink-0">
            <span className="text-gray-500 mr-2">📌 인쇄/저장할 체크 주제 선택:</span>
            {topics.map(t => {
              const isSelected = selectedTopicIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTopicIds(prev => 
                      prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                    );
                  }}
                  className={`px-3 py-1 rounded-full cursor-pointer transition-all border text-[10px] font-black ${
                    isSelected 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/10' 
                      : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {t.title}
                </button>
              );
            })}
          </div>
        )}

        {/* 종이 영역 시뮬레이션 */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-100 flex justify-center">
          <div className="print-area bg-white w-[210mm] min-h-[297mm] p-[15mm] shadow-lg border border-gray-200 flex flex-col text-black">
            {/* 인쇄 문서 타이틀 (인라인 편집 지원) */}
            <div className="text-center mb-6 shrink-0 group relative">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="text-xl font-bold tracking-tight text-center bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-gray-50 rounded px-2 py-0.5 w-full outline-none transition-all text-black font-sans"
                placeholder="체크리스트 제목을 입력하세요"
                title="클릭하여 제목을 직접 수정할 수 있습니다."
              />
              <p className="text-xs text-gray-600 font-medium mt-1">
                일자: {formattedDate}
              </p>
            </div>

            {/* 인쇄 전용 테이블 */}
            <div className="flex-1 overflow-x-hidden">
              <table className="print-table w-full border-collapse border border-black text-xs text-left">
                <thead>
                  {/* 1단 헤더 */}
                  <tr className="border-b border-black bg-gray-100">
                    <th rowSpan={2} className="py-2.5 px-3 border-r border-black font-bold text-center w-[80px]">
                      학생 이름
                    </th>
                    {displayTopics.map(t => (
                      <th key={t.id} colSpan={2} className="py-2 px-3 border-r border-black font-bold text-center text-[10px]">
                        {t.title}
                      </th>
                    ))}
                  </tr>
                  {/* 2단 헤더 */}
                  <tr className="border-b border-black bg-gray-100">
                    {displayTopics.map(t => (
                      <React.Fragment key={`sub-h-${t.id}`}>
                        <th className="py-1 px-1 border-r border-black font-bold text-center text-[9px] w-[35px]">완료</th>
                        <th className="py-1 px-2 border-r border-black font-bold text-left text-[9px]">메모 / 특이사항</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={1 + displayTopics.length * 2} className="py-8 text-center text-gray-400 font-bold italic">
                        학생이 존재하지 않습니다.
                      </td>
                    </tr>
                  ) : (
                    students.map(student => (
                      <tr key={student.id} className="border-b border-black">
                        {/* 학생 이름 */}
                        <td className="py-2 px-2.5 border-r border-black font-bold text-left text-[11px]">
                          {student.isSpecialClass ? `${student.electiveCourse?.subject?.trim() || '특강'}-` : ''}{student.name}
                        </td>
                        {/* 주제별 완료/메모 */}
                        {displayTopics.map(t => {
                          const cellData = items[student.id]?.[t.id] || { status: 'none', memo: '' };
                          const symbol = getStatusSymbol(cellData.status);
                          return (
                            <React.Fragment key={`${student.id}-${t.id}`}>
                              {/* 완료 기호 */}
                              <td className={`py-2 px-1 border-r border-black text-center text-xs font-black ${getStatusColor(cellData.status)}`}>
                                {symbol}
                              </td>
                              {/* 메모 */}
                              <td className="py-2 px-2 border-r border-black text-[10px] text-gray-700 break-all leading-tight">
                                {cellData.memo || '-'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))
                  )}

                  {/* 합계 행 */}
                  {students.length > 0 && displayTopics.length > 0 && (
                    <tr className="bg-gray-50 font-bold border-b border-black">
                      <td className="py-2 px-2.5 border-r border-black text-center font-bold text-gray-600">
                        완료 인원
                      </td>
                      {displayTopics.map(t => {
                        const count = getCheckedCount(t.id);
                        return (
                          <React.Fragment key={`sum-${t.id}`}>
                            <td className="py-2 px-1 border-r border-black text-center font-bold text-green-600">
                              {count}명
                            </td>
                            <td className="py-2 px-2 border-r border-black"></td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
