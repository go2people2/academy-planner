'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Palette, Edit3 } from 'lucide-react';
import { Student, SessionLog } from '@/types/dashboard';

interface HokmaJournalPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: Student[];
  allStudents?: Student[]; // 💡 추가
  selectedTeacherId?: string; // 💡 추가
  initialMonth?: string; // Format: 'YYYY-MM' (e.g., '2026-07')
  masterTextbooks: any[];
  academyInfo?: any; // 💡 학원 정보 데이터 전달
}

// 🎨 다채로운 인쇄 테마 정의 (4가지 프리미엄 에디션)
const JOURNAL_THEMES = {
  amber: {
    name: '호박색 (Warm Amber)',
    bg: '#ffffff',
    border: '#e7d7c1',
    headerBg: '#fef3e2',
    headerText: '#9a3412',
    titleColor: '#9a3412',
    lineColor: '#d97706',
    descColor: '#c2410c',
    metaTextColor: '#27272a',
    logoFilter: 'invert(12%) sepia(85%) saturate(1600%) hue-rotate(350deg) brightness(85%) contrast(110%)', // 짙은 초콜릿 앰버
  },
  rose: {
    name: '핑크 로즈 (Rose Pink)',
    bg: '#ffffff',
    border: '#fda4af',
    headerBg: '#fff0f2',
    headerText: '#9f1239',
    titleColor: '#9f1239',
    lineColor: '#f43f5e',
    descColor: '#be123c',
    metaTextColor: '#1f2937',
    logoFilter: 'invert(13%) sepia(85%) saturate(4000%) hue-rotate(335deg) brightness(85%) contrast(100%)', // 짙은 로즈 핑크
  },
  sage: {
    name: '포레스트 세이지 (Sage Green)',
    bg: '#ffffff',
    border: '#c8d3c8',
    headerBg: '#f0f4f0',
    headerText: '#166534',
    titleColor: '#166534',
    lineColor: '#22c55e',
    descColor: '#15803d',
    metaTextColor: '#27272a',
    logoFilter: 'invert(22%) sepia(80%) saturate(1200%) hue-rotate(110deg) brightness(80%) contrast(100%)', // 짙은 세이지 포레스트 그린
  },
  classic: {
    name: '클래식 그레이 (Classic Gray)',
    bg: '#ffffff',
    border: '#d1d5db',
    headerBg: '#f3f4f6',
    headerText: '#1f2937',
    titleColor: '#1f2937',
    lineColor: '#4b5563',
    descColor: '#4b5563',
    metaTextColor: '#1f2937',
    logoFilter: 'grayscale(1) brightness(0.6) contrast(1.2)', // 원본 무채색 그레이스케일
  }
};

type ThemeKey = keyof typeof JOURNAL_THEMES;

// 🖊️ 볼펜 잉크 색상 옵션 정의
const PEN_COLORS = [
  { val: '#1e3a8a', label: '청색 볼펜 (Blue)' },
  { val: '#111827', label: '흑색 볼펜 (Black)' },
  { val: '#be123c', label: '적색 볼펜 (Red)' }
];

export default function HokmaJournalPrintModal({
  isOpen,
  onClose,
  selectedStudents,
  allStudents = [],
  selectedTeacherId = 'All',
  initialMonth,
  masterTextbooks,
  academyInfo
}: HokmaJournalPrintModalProps) {
  const academyName = academyInfo?.academy_name || academyInfo?.name || '호크마';
  const logoSrc = academyInfo?.logo_url || '';
  // 현재 날짜 기준 기본 연월 설정 ('YYYY-MM')
  const defaultMonth = useMemo(() => {
    if (initialMonth) return initialMonth;
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${mm}`;
  }, [initialMonth]);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>('amber'); // 기본 테마: 호박색
  const [selectedPenColor, setSelectedPenColor] = useState<string>('#1e3a8a'); // 기본 펜색상: 청색 볼펜
  const [showAllStudents, setShowAllStudents] = useState(false); // 💡 모든학생 일괄인쇄 토글 상태

  // 💡 인쇄 대상 학생 리스트 연산
  const targetStudents = useMemo(() => {
    if (showAllStudents && allStudents.length > 0) {
      if (selectedTeacherId === 'All') {
        return allStudents.filter(s => !s.is_deleted);
      }
      return allStudents.filter(s => !s.is_deleted && s.teacher_id === selectedTeacherId);
    }
    return selectedStudents;
  }, [showAllStudents, allStudents, selectedTeacherId, selectedStudents]);

  // 💡 글자 수가 20자를 초과하면 15px로 축소, 그렇지 않으면 기본 크기(18px/19px) 유지하는 유틸
  const getHandwritingFontSize = (text: string, baseSize = 18) => {
    if (!text) return `${baseSize}px`;
    return text.length > 20 ? '15px' : `${baseSize}px`;
  };

  // 연월 선택 드롭다운 옵션 생성 (최근 12개월)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
      options.push({ val, label });
    }
    return options;
  }, []);

  // 인쇄 트리거
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      document.body.classList.add('hokma-print-mode');
      const cleanup = () => {
        document.body.classList.remove('hokma-print-mode');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
    }
  };

  if (!isOpen || targetStudents.length === 0) return null;

  const currentThemeConfig = JOURNAL_THEMES[selectedTheme];

  return createPortal(
    <div className="hokma-journal-print-root fixed inset-0 z-[9999] flex flex-col bg-slate-900/95 text-white overflow-hidden">
      {/* 스타일 태그 주입 - 선택된 테마 및 펜 색상에 맞춰 CSS 변수 동적 생성 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap');

        :root {
          --theme-bg: ${currentThemeConfig.bg};
          --theme-border: ${currentThemeConfig.border};
          --theme-header-bg: ${currentThemeConfig.headerBg};
          --theme-header-text: ${currentThemeConfig.headerText};
          --theme-title-color: ${currentThemeConfig.titleColor};
          --theme-line-color: ${currentThemeConfig.lineColor};
          --theme-desc-color: ${currentThemeConfig.descColor};
          --theme-pen-color: ${selectedPenColor}; /* 🖊️ 선택된 펜글씨 색상 바인딩 */
        }

        /* 화면 미리보기 스크롤용 */
        .journal-preview-container {
          max-height: calc(100vh - 70px);
          overflow-y: auto;
          padding: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 40px;
        }

        /* 💡 A4 규격화 스타일 */
        .hokma-page {
          background: var(--theme-bg);
          color: #27272a;
          width: 210mm;
          height: 297mm;
          padding: 15mm 12mm;
          box-sizing: border-box;
          position: relative;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

          @media print {
          .hokma-journal-print-root {
            background: transparent !important;
            position: static !important;
            overflow: visible !important;
            height: auto !important;
          }
          .hokma-action-bar {
            display: none !important;
          }
          .journal-preview-container {
            overflow: visible !important;
            padding: 0 !important;
            max-height: none !important;
            gap: 0 !important;
            background: transparent !important;
            flex: none !important;
          }
          .hokma-page {
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            width: 210mm !important;
            height: 297mm !important;
            padding: 15mm 12mm !important;
            background: var(--theme-bg) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }

        /* 💡 일지 표 공통 레이아웃 스타일 */
        .hj-title-container {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 6mm;
          position: relative;
        }
        .hj-main-title {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 2px;
          margin: 0;
          color: var(--theme-title-color);
          border-bottom: 3px double var(--theme-line-color);
          padding-bottom: 1mm;
        }
        
        /* 결재란 (확인란) */
        .hj-sign-table {
          border-collapse: collapse;
          font-size: 11px;
          text-align: center;
          background: #ffffff;
        }
        .hj-sign-table th, .hj-sign-table td {
          border: 1.5px solid var(--theme-border);
          padding: 0;
        }
        .hj-sign-table th {
          background-color: var(--theme-header-bg);
          color: var(--theme-header-text);
          font-weight: bold;
          width: 58px;
          height: 22px;
        }
        .hj-sign-table td {
          height: 48px;
        }
        .hj-sign-title-cell {
          width: 24px;
          background-color: var(--theme-header-bg);
          color: var(--theme-header-text);
          font-weight: bold;
          font-size: 10px;
          padding: 2px !important;
          line-height: 1.2;
          writing-mode: vertical-rl;
          text-orientation: upright;
          letter-spacing: 1px;
        }

        .hj-meta-info {
          display: flex;
          justify-content: flex-end;
          gap: 30px;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 5mm;
          border-bottom: 2.5px solid var(--theme-line-color);
          padding-bottom: 2mm;
          color: #4b5563;
        }

        .hj-section-title {
          font-size: 16px;
          font-weight: 900;
          margin-top: 5mm;
          margin-bottom: 2mm;
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--theme-title-color);
        }

        /* 💡 메인 테이블 스타일 */
        .hj-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          text-align: center;
          background: #ffffff;
        }
        .hj-table th, .hj-table td {
          border: 1.5px solid var(--theme-border);
          height: 38px;
          padding: 2px 4px;
          box-sizing: border-box;
        }
        .hj-table th {
          background-color: var(--theme-header-bg);
          color: var(--theme-header-text);
          font-weight: bold;
        }
        .hj-desc-text {
          font-size: 10px;
          color: var(--theme-desc-color);
          margin-top: 1.5mm;
          margin-bottom: 3mm;
          font-weight: bold;
        }

        /* 💡 나눔펜글씨 수기 폰트 클래스 */
        .hj-handwriting {
          font-family: 'Nanum Pen Script', cursive !important;
          color: var(--theme-pen-color) !important; /* 🖊️ 선택된 펜 잉크 컬러로 동적 적용 */
          font-weight: normal !important;
          line-height: 1.1 !important;
        }

        .text-left {
          text-align: left;
        }
        .text-center {
          text-align: center;
        }
        .font-black {
          font-weight: 900;
        }
        
        /* 4. 한달을 돌아보며 레이아웃 */
        .hj-feedback-box {
          width: 100%;
          border: 1.5px solid var(--theme-border);
          border-collapse: collapse;
          background: #ffffff;
        }
        .hj-feedback-box td {
          border: 1.5px solid var(--theme-border);
          padding: 8px;
          font-size: 12px;
        }
        .hj-feedback-title {
          font-weight: bold;
          background-color: var(--theme-header-bg);
          color: var(--theme-header-text);
          width: 80px;
          text-align: center;
        }
        .hj-feedback-sub-title {
          font-weight: bold;
          background-color: var(--theme-bg);
          color: var(--theme-header-text);
          text-align: center;
          height: 24px;
        }
        .hj-feedback-content-area {
          height: 80px;
          vertical-align: top;
        }
        .hj-teacher-feedback-area {
          height: 100px;
          vertical-align: top;
        }
      ` }} />

      {/* 상단 액션바 (인쇄 시 숨겨짐) */}
      <div className="hokma-action-bar flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-lg font-black tracking-wider flex items-center gap-2">
            <Printer className="text-amber-500" /> 월간 {academyName} 일지 인쇄
          </h2>
          
          <div className="flex items-center gap-3">
            {/* 대상 월 선택 */}
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded border border-slate-700">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">대상 월</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.val} value={opt.val} className="bg-slate-800 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 🎨 디자인 테마 선택 */}
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded border border-slate-700">
              <Palette size={14} className="text-amber-400" />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">디자인 테마</span>
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value as ThemeKey)}
                className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
              >
                {Object.entries(JOURNAL_THEMES).map(([key, config]) => (
                  <option key={key} value={key} className="bg-slate-800 text-white">
                    {config.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 🖊️ 손글씨 펜 색상 선택 추가 */}
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded border border-slate-700">
              <Edit3 size={14} className="text-blue-400" />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">펜 색상</span>
              <select
                value={selectedPenColor}
                onChange={(e) => setSelectedPenColor(e.target.value)}
                className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
              >
                {PEN_COLORS.map((col) => (
                  <option key={col.val} value={col.val} className="bg-slate-800 text-white">
                    {col.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 총 선택된 인원수 표시 */}
          <span className="text-xs text-slate-300 font-bold bg-slate-900 border border-slate-700 px-3 py-2 rounded shrink-0">
            총 <span className="text-amber-500 font-extrabold">{targetStudents.length}</span>명 선택됨
          </span>

          {/* 모든학생 토글 버튼 */}
          {allStudents.length > 0 && (
            <button
              onClick={() => setShowAllStudents(prev => !prev)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-black transition-all ${
                showAllStudents 
                  ? 'bg-blue-600 border border-blue-500 text-white shadow-lg' 
                  : 'bg-slate-700 hover:bg-slate-650 border border-slate-600 text-slate-300'
              }`}
            >
              모든학생
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-black rounded shadow transition-all"
          >
            <Printer size={16} /> 인쇄
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-950 overflow-y-auto journal-preview-container">
        {targetStudents.map((student) => {
          const [yearStr, monthStr] = selectedMonth.split('-');
          const targetYear = parseInt(yearStr, 10);
          const targetMonth = parseInt(monthStr, 10);

          const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
          const endOfMonth = new Date(targetYear, targetMonth, 0);

          const allSessionLogs = [...(student.allLogs || [])];
          if (student.todaySession) {
            const exists = allSessionLogs.some(l => l.date === student.todaySession?.date);
            if (!exists) allSessionLogs.push(student.todaySession);
          }

          const monthLogs = allSessionLogs
            .filter((log) => {
              const logDate = new Date(log.date || log.session_date || '');
              return logDate >= startOfMonth && logDate <= endOfMonth;
            })
            .sort((a, b) => {
              return new Date(a.date || a.session_date || '').getTime() - new Date(b.date || b.session_date || '').getTime();
            });

          // 💡 [안정화] 합의된 결석(수업제외, 수업취소)만 걷어내며, 출결 상태가 null이거나 빈 값인 유효 세션도 정상 포함합니다.
          const validMonthLogs = monthLogs.filter(
            (log) => !log.attendance_status || !['수업제외', '수업취소'].includes(log.attendance_status)
          );

          // 💡 [안정화] 예정만 잡아놓고 미응시한 날(예: /8/2)은 제외하고, 실제로 채점(예: 6/8/2 또는 90점)이 완료된 건만 앞페이지에 인쇄합니다.
          const testLogs = validMonthLogs.filter((log) => {
            const hasTestId = log.test_id && 
                              log.test_id.trim() !== '' && 
                              log.test_id.trim() !== '없음' && 
                              log.test_id.trim() !== '-';
            if (!hasTestId) return false;
            
            const hasScoreField = log.test_score !== undefined && 
                                  log.test_score !== null && 
                                  String(log.test_score).trim() !== '';
            if (hasScoreField) return true;

            if (log.test_id && log.test_id.includes(':')) {
              const parts = log.test_id.split(':');
              const scorePart = parts.slice(1).join(':').trim(); // 예: "6/8/2" 또는 "/8/2"
              if (scorePart.includes('/')) {
                const correctCount = scorePart.split('/')[0].trim();
                return correctCount !== '' && !isNaN(Number(correctCount)); // 슬래시 앞 맞은 개수가 빈칸이 아닌 숫자인지 체크
              }
              return scorePart !== '';
            }
            return false;
          });

          const logsPerSheet = 13;
          const totalSheets = Math.max(
            Math.ceil(validMonthLogs.length / logsPerSheet),
            Math.ceil(testLogs.length / logsPerSheet),
            1
          );

          return Array.from({ length: totalSheets }).map((_, sheetIdx) => {
            const startIdx = sheetIdx * logsPerSheet;
            const endIdx = startIdx + logsPerSheet;

            const rows = Array.from({ length: logsPerSheet }).map((_, idx) => {
              const globalIdx = startIdx + idx;
              const log = validMonthLogs[globalIdx] as SessionLog | undefined;
              
              if (log) {
                const logDate = new Date(log.date || log.session_date || '');
                const dateText = `${logDate.getMonth() + 1}/${logDate.getDate()}`;
                
                let attendanceSign = '';
                const attStatus = log.attendance_status || '';
                if (attStatus.includes('출석') || attStatus.includes('보강')) {
                  attendanceSign = 'O';
                } else if (attStatus.includes('결석')) {
                  attendanceSign = 'X';
                } else if (attStatus.includes('지각')) {
                  attendanceSign = '▲';
                }

                let hwScore = '';
                if (attStatus.includes('결석')) {
                  hwScore = '-'; // 💡 결석인 날은 숙제 기록에 0점이 적히지 않고 하이픈(-)으로 대체
                } else if (log.hw_checked_today === true || log.hw_passed_today === true) {
                  hwScore = '10점';
                } else if (log.todo_achievement !== undefined) {
                  if (log.todo_achievement >= 100) hwScore = '10점';
                  else if (log.todo_achievement >= 70) hwScore = '7점';
                  else if (log.todo_achievement >= 40) hwScore = '4점';
                  else if (log.todo_achievement > 0) hwScore = '4점';
                  else hwScore = '0점';
                }

                let classworkText = log.completed_classwork_text || '';
                let homeworkText = log.homework_text || '';

                if (attStatus.includes('결석')) {
                  const reason = log.attendance_reason ? ` (${log.attendance_reason})` : '';
                  classworkText = `결석${reason}`;
                  homeworkText = '-'; // 💡 숙제란도 하이픈(-)으로 정돈
                } else if (attStatus.includes('수업제외') || attStatus.includes('수업취소')) {
                  const reason = log.attendance_reason ? ` (${log.attendance_reason})` : '';
                  classworkText = `${attStatus}${reason}`;
                  homeworkText = '-'; // 💡 숙제란도 하이픈(-)으로 정돈
                }

                return {
                  dateText,
                  attendanceSign,
                  hwScore,
                  classworkText,
                  homeworkText
                };
              }
              return {
                dateText: '',
                attendanceSign: '',
                hwScore: '',
                classworkText: '',
                homeworkText: ''
              };
            });

            const testRows = Array.from({ length: logsPerSheet }).map((_, idx) => {
              const globalTestIdx = startIdx + idx;
              const log = testLogs[globalTestIdx] as SessionLog | undefined;

              if (log) {
                const logDate = new Date(log.date || log.session_date || '');
                const dateText = `${logDate.getMonth() + 1}월 ${logDate.getDate()}일`;

                let scoreText = '';
                let testName = log.test_id || '';

                // 💡 [안정화] test_score가 비어있고 test_id에 콜론(:)이 포함된 인라인 채점 기록의 경우, 쪼개서 분배합니다.
                const hasScoreField = log.test_score !== undefined && log.test_score !== null && log.test_score !== '';
                const hasInlineScore = testName.includes(':');

                if (hasScoreField) {
                  if (log.test_score_type === 'count') {
                    scoreText = `${log.test_score} / ${log.test_total_count || 20}`;
                  } else {
                    scoreText = `${log.test_score}점`;
                  }
                } else if (hasInlineScore) {
                  const parts = testName.split(':');
                  testName = parts[0].trim();
                  scoreText = parts.slice(1).join(':').trim();
                }

                // 💡 [안정화] 쉼표 2개(,,) 뒤에 붙은 메모 텍스트는 인쇄용 점수 컬럼에서 제외하고 순수 점수/개수만 남깁니다.
                if (scoreText.includes(',,')) {
                  scoreText = scoreText.split(',,')[0].trim();
                }

                // 💡 [개선] 6/8/2 나 7/8/1 처럼 커트라인 개수까지 적힌 인라인 채점 결과의 경우, 마지막 커트라인(2, 1 등) 정보는 지우고 6/8, 7/8 형태로만 출력합니다.
                if (scoreText.includes('/')) {
                  const slashParts = scoreText.split('/');
                  if (slashParts.length >= 3) {
                    scoreText = `${slashParts[0].trim()}/${slashParts[1].trim()}`;
                  }
                }

                const matchedTextbook = masterTextbooks.find((m) => m.bookcode === testName);
                if (matchedTextbook) testName = matchedTextbook.title;

                return {
                  dateText,
                  testName,
                  scoreText
                };
              }
              return {
                dateText: '',
                testName: '',
                scoreText: ''
              };
            });

            const pageSuffix = totalSheets > 1 ? ` (${sheetIdx + 1}/${totalSheets})` : '';

            return (
              <React.Fragment key={`${student.id}-sheet-${sheetIdx}`}>
                {/* PAGE 1: 앞면 */}
                <div className="hokma-page">
                  {/* 상단 콘텐츠 그룹 */}
                  <div>
                    {/* 1. 헤더 */}
                    <div className="hj-title-container">
                      <h1 className="hj-main-title">
                        〈 나의 {targetMonth}월 {academyName} 일지{pageSuffix} 〉
                      </h1>
                      {logoSrc && (
                        <img 
                          src={logoSrc} 
                          alt="Academy Logo" 
                          style={{ 
                            position: 'absolute',
                            right: '220px',
                            bottom: '-2px',
                            width: '135px',
                            height: '65px',
                            opacity: 0.42,
                            objectFit: 'contain',
                            filter: currentThemeConfig.logoFilter,
                            pointerEvents: 'none'
                          }} 
                        />
                      )}
                      <table className="hj-sign-table">
                        <tbody>
                          <tr>
                            <td rowSpan={2} className="hj-sign-title-cell">확인란</td>
                            <th>학 생</th>
                            <th>담 임</th>
                            <th>원 장</th>
                          </tr>
                          <tr>
                            <td></td>
                            <td></td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 2. 메타 정보 */}
                    <div className="hj-meta-info">
                      <div>학교 : <span style={{ color: currentThemeConfig.metaTextColor, fontWeight: 600 }}>{student.school || '　　　　'}</span></div>
                      <div>학년 : <span style={{ color: currentThemeConfig.metaTextColor, fontWeight: 600 }}>{student.grade || '　　　'}</span></div>
                      <div>이름 : <span style={{ color: currentThemeConfig.metaTextColor, fontWeight: 600 }}>{student.name}</span></div>
                    </div>

                    {/* 3. 출석 영역 */}
                    <h3 className="hj-section-title">1. 출석</h3>
                    <table className="hj-table">
                      <thead>
                        <tr>
                          <th style={{ width: '15.5%' }}>수업 날짜</th>
                          {rows.map((r, i) => {
                            const globalNum = startIdx + i + 1;
                            return (
                              <th key={i} style={{ width: '6.5%' }} className="relative">
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: currentThemeConfig.headerText, display: 'block', marginBottom: '1px' }}>
                                  {globalNum}회
                                </span>
                                {r.dateText && (
                                  <div className="hj-handwriting" style={{ fontSize: '16px', marginTop: '-4px' }}>
                                    {r.dateText}
                                  </div>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th>출석 체크</th>
                          {rows.map((r, i) => (
                            <td key={i} className="hj-handwriting" style={{ fontSize: r.attendanceSign === '▲' ? '17px' : '24px' }}>
                              {r.dateText ? r.attendanceSign : ''}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                    <div className="hj-desc-text">
                      ※ 출석 - O (매 시 10분 전 등원 / 3점)　결석 - X (0점)　지각 - ▲ (매 시 10분 이후에 등원하면 지각입니다. / 2점)
                    </div>

                    {/* 4. 숙제 영역 */}
                    <h3 className="hj-section-title">2. 숙제</h3>
                    <table className="hj-table">
                      <thead>
                        <tr>
                          <th style={{ width: '15.5%' }}>수업 날짜</th>
                          {rows.map((r, i) => {
                            const globalNum = startIdx + i + 1;
                            return (
                              <th key={i} style={{ width: '6.5%' }} className="relative">
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: currentThemeConfig.headerText, display: 'block', marginBottom: '1px' }}>
                                  {globalNum}회
                                </span>
                                {r.dateText && (
                                  <div className="hj-handwriting" style={{ fontSize: '16px', marginTop: '-4px' }}>
                                    {r.dateText}
                                  </div>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th>숙제 완성도</th>
                          {rows.map((r, i) => (
                            <td key={i} className="hj-handwriting" style={{ fontSize: '20px' }}>
                              {r.dateText ? r.hwScore : ''}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                    <div className="hj-desc-text">
                      ※ 0점 - 하나도 안함 / 4점 - 풀이만 / 7점 - 채점까지 / 10점 - 완벽하게함(오답까지) : 내준 숙제를 다 해왔을 때는 10점 만점입니다.
                    </div>
                  </div>

                  {/* 하단 콘텐츠 그룹 */}
                  <div style={{ marginBottom: '2mm' }}>
                    {/* 5. 테스트 결과 */}
                    <h3 className="hj-section-title">3. 테스트 결과</h3>
                    <table className="hj-table" style={{ fontSize: '11px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '15%', height: '30px' }}>날 짜</th>
                          <th style={{ width: '60%' }}>시 험 명</th>
                          <th style={{ width: '25%' }}>점수 or 맞은 개수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testRows.map((r, i) => (
                          <tr key={i}>
                            <td style={{ height: '30px', fontSize: '18px' }} className="hj-handwriting">
                              {r.dateText}
                            </td>
                            <td className="text-left hj-handwriting" style={{ paddingLeft: '8px', fontSize: getHandwritingFontSize(r.testName, 19) }}>
                              {r.testName}
                            </td>
                            <td className="hj-handwriting" style={{ fontSize: '20px' }}>
                              {r.scoreText}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PAGE 2: 뒷면 */}
                <div className="hokma-page">
                  {/* 상단 그룹: 일일 진도 기록 표 */}
                  <div>
                    <h3 className="hj-section-title" style={{ fontSize: '18px', marginTop: '0', marginBottom: '3mm' }}>
                      3. 일일 진도 기록{pageSuffix}
                    </h3>
                    <table className="hj-table" style={{ fontSize: '11px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '12%', height: '34px' }}>날 짜</th>
                          <th style={{ width: '44%' }}>오늘의 진도 (교재, 페이지)</th>
                          <th style={{ width: '44%' }}>오늘의 숙제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const globalNum = startIdx + i + 1;
                          return (
                            <tr key={i}>
                              <td style={{ height: '52px' }} className="relative">
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: currentThemeConfig.headerText, display: 'block', marginBottom: '2px' }}>
                                  {globalNum}회
                                </span>
                                {r.dateText && (
                                  <div className="hj-handwriting" style={{ fontSize: '17px' }}>
                                    {r.dateText}
                                  </div>
                                )}
                              </td>
                              <td className="text-left hj-handwriting" style={{ paddingLeft: '6px', whiteSpace: 'pre-wrap', lineHeight: '1.2', fontSize: getHandwritingFontSize(r.classworkText, 18) }}>
                                {r.classworkText}
                              </td>
                              <td className="text-left hj-handwriting" style={{ paddingLeft: '6px', whiteSpace: 'pre-wrap', lineHeight: '1.2', fontSize: getHandwritingFontSize(r.homeworkText, 18) }}>
                                {r.homeworkText}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 하단 그룹: 한달을 돌아보며 (A4 최하단으로 고정 배치됨) */}
                  <div style={{ marginBottom: '2mm' }}>
                    <h3 className="hj-section-title" style={{ fontSize: '16px', marginTop: '0', marginBottom: '2mm' }}>
                      4. 한 달을 돌아보며 ...{pageSuffix}
                    </h3>
                    <table className="hj-feedback-box">
                      <tbody>
                        {/* 학생 회고 영역 */}
                        <tr>
                          <td rowSpan={2} className="hj-feedback-title">학 생</td>
                          <td className="hj-feedback-sub-title" style={{ width: '50%' }}>아쉬운 점 or 반성할 점</td>
                          <td className="hj-feedback-sub-title" style={{ width: '50%' }}>잘한 점 or 칭찬할 점</td>
                        </tr>
                        <tr>
                          <td className="hj-feedback-content-area" style={{ height: '80px' }}></td>
                          <td className="hj-feedback-content-area" style={{ height: '80px' }}></td>
                        </tr>
                        {/* 선생님 피드백 영역 */}
                        <tr>
                          <td className="hj-feedback-title">선생님</td>
                          <td colSpan={2} className="hj-teacher-feedback-area" style={{ height: '100px' }}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </React.Fragment>
            );
          });
        })}
      </div>
    </div>,
    document.body
  );
}
